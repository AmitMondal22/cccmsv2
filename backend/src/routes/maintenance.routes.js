import { MaintenanceTicket, Device, Alert, User, Street, Ward, Zone, City } from '../models/index.js';
import { Op } from 'sequelize';

const deviceInclude = [
  { model: Street, as: 'street', include: [{ model: Ward, as: 'ward', include: [{ model: Zone, as: 'zone', include: [{ model: City, as: 'city' }] }] }] },
];

export default async function maintenanceRoutes(fastify, opts) {
  // GET /api/maintenance/tickets
  fastify.get('/tickets', { preHandler: [fastify.authenticate] }, async (request) => {
    const { status, priority, assigned_to, device_id, page = 1, limit = 50 } = request.query;
    const where = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (assigned_to) where.assigned_to = assigned_to;
    if (device_id) where.device_id = device_id;

    // Maintenance users only see their own tickets
    if (request.user.role === 'maintenance_user') {
      where.assigned_to = request.user.id;
    }

    const result = await MaintenanceTicket.findAndCountAll({
      where,
      include: [
        { model: Device, as: 'device', include: deviceInclude },
        { model: Alert, as: 'alert', attributes: ['id', 'alert_type', 'severity'] },
        { model: User, as: 'assignedTechnician', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'creator', attributes: ['id', 'name'] },
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      distinct: true,
    });

    return { data: result.rows, total: result.count, page: parseInt(page), pages: Math.ceil(result.count / parseInt(limit)) };
  });

  // GET /api/maintenance/tickets/stats
  fastify.get('/tickets/stats', { preHandler: [fastify.authenticate] }, async () => {
    const [open, assigned, inProgress, pending, resolved, closed] = await Promise.all([
      MaintenanceTicket.count({ where: { status: 'open' } }),
      MaintenanceTicket.count({ where: { status: 'assigned' } }),
      MaintenanceTicket.count({ where: { status: 'in_progress' } }),
      MaintenanceTicket.count({ where: { status: 'pending' } }),
      MaintenanceTicket.count({ where: { status: 'resolved' } }),
      MaintenanceTicket.count({ where: { status: 'closed' } }),
    ]);
    return { open, assigned, inProgress, pending, resolved, closed, total: open + assigned + inProgress + pending };
  });

  // GET /api/maintenance/tickets/:id
  fastify.get('/tickets/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const ticket = await MaintenanceTicket.findByPk(request.params.id, {
      include: [
        { model: Device, as: 'device', include: deviceInclude },
        { model: Alert, as: 'alert' },
        { model: User, as: 'assignedTechnician', attributes: ['id', 'name', 'email', 'phone'] },
      ],
    });
    if (!ticket) return reply.status(404).send({ error: 'Ticket not found' });
    return ticket;
  });

  // POST /api/maintenance/tickets
  fastify.post('/tickets', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const {
        device_id, alert_id, assigned_to, title, description,
        problem_type, priority = 'medium', status = 'open',
        assigned_team, due_date,
      } = request.body || {};

      if (!title || !title.trim()) {
        return reply.status(400).send({ error: 'Ticket title is required' });
      }

      const ticketNum = `TKT-${Date.now().toString().slice(-6)}`;
      
      // Sanitize due_date to avoid invalid date syntax in PostgreSQL
      let cleanDueDate = null;
      if (due_date && typeof due_date === 'string' && due_date.trim()) {
        const parsed = new Date(due_date);
        if (!isNaN(parsed.getTime())) {
          cleanDueDate = parsed;
        }
      }

      const ticket = await MaintenanceTicket.create({
        ticket_number: ticketNum,
        device_id: device_id ? parseInt(device_id) : null,
        alert_id: alert_id ? parseInt(alert_id) : null,
        assigned_to: assigned_to ? parseInt(assigned_to) : null,
        title: title.trim(),
        description: description ? description.trim() : '',
        problem_type: problem_type ? problem_type.trim() : 'general_maintenance',
        priority,
        status: status || 'open',
        assigned_team: assigned_team ? assigned_team.trim() : '',
        due_date: cleanDueDate,
        created_by: request.user?.id || null,
      });

      const fullTicket = await MaintenanceTicket.findByPk(ticket.id, {
        include: [
          { model: Device, as: 'device', include: deviceInclude },
          { model: Alert, as: 'alert' },
          { model: User, as: 'assignedTechnician', attributes: ['id', 'name', 'email', 'phone'] },
        ],
      });

      return reply.status(201).send(fullTicket);
    } catch (err) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // PUT /api/maintenance/tickets/:id
  fastify.put('/tickets/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const ticket = await MaintenanceTicket.findByPk(request.params.id);
      if (!ticket) return reply.status(404).send({ error: 'Ticket not found' });

      const updates = { ...request.body };
      if (updates.due_date === '' || updates.due_date === null) {
        updates.due_date = null;
      } else if (updates.due_date) {
        const parsed = new Date(updates.due_date);
        if (!isNaN(parsed.getTime())) {
          updates.due_date = parsed;
        } else {
          delete updates.due_date;
        }
      }

      await ticket.update(updates);
      return ticket;
    } catch (err) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // PUT / POST / PATCH /api/maintenance/tickets/:id/resolve
  const handleResolveTicket = async (request, reply) => {
    try {
      const ticket = await MaintenanceTicket.findByPk(request.params.id);
      if (!ticket) return reply.status(404).send({ error: 'Ticket not found' });

      const notes = request.body?.repair_notes || request.body?.notes || (typeof request.body === 'string' ? request.body : 'Resolved by technician');
      const diagnosis = request.body?.diagnosis || '';

      await ticket.update({
        status: 'resolved',
        resolved_at: new Date(),
        repair_notes: notes,
        diagnosis,
      });

      return reply.send(ticket);
    } catch (err) {
      return reply.status(500).send({ error: err.message });
    }
  };

  fastify.put('/tickets/:id/resolve', { preHandler: [fastify.authenticate] }, handleResolveTicket);
  fastify.post('/tickets/:id/resolve', { preHandler: [fastify.authenticate] }, handleResolveTicket);
  fastify.patch('/tickets/:id/resolve', { preHandler: [fastify.authenticate] }, handleResolveTicket);

  // PUT /api/maintenance/tickets/:id/close
  fastify.put('/tickets/:id/close', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const ticket = await MaintenanceTicket.findByPk(request.params.id);
      if (!ticket) return reply.status(404).send({ error: 'Ticket not found' });
      await ticket.update({ status: 'closed', closed_at: new Date() });
      return ticket;
    } catch (err) {
      return reply.status(500).send({ error: err.message });
    }
  });
}

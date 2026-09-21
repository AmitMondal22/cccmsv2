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
    const ticketNum = `TKT-${Date.now()}`;
    const ticket = await MaintenanceTicket.create({
      ...request.body,
      ticket_number: ticketNum,
      created_by: request.user.id,
    });
    return reply.status(201).send(ticket);
  });

  // PUT /api/maintenance/tickets/:id
  fastify.put('/tickets/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const ticket = await MaintenanceTicket.findByPk(request.params.id);
    if (!ticket) return reply.status(404).send({ error: 'Not found' });
    await ticket.update(request.body);
    return ticket;
  });

  // PUT /api/maintenance/tickets/:id/resolve
  fastify.put('/tickets/:id/resolve', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const ticket = await MaintenanceTicket.findByPk(request.params.id);
    if (!ticket) return reply.status(404).send({ error: 'Not found' });
    await ticket.update({
      status: 'resolved',
      resolved_at: new Date(),
      repair_notes: request.body.repair_notes,
      diagnosis: request.body.diagnosis,
    });
    return ticket;
  });

  // PUT /api/maintenance/tickets/:id/close
  fastify.put('/tickets/:id/close', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const ticket = await MaintenanceTicket.findByPk(request.params.id);
    if (!ticket) return reply.status(404).send({ error: 'Not found' });
    await ticket.update({ status: 'closed', closed_at: new Date() });
    return ticket;
  });
}

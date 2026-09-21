import { Alert, AlertRule, Device, User, Notification, DeviceLatestState, Street, Ward, Zone, City, Project } from '../models/index.js';
import { Op } from 'sequelize';

const deviceInclude = [
  {
    model: Street, as: 'street',
    include: [{
      model: Ward, as: 'ward',
      include: [{
        model: Zone, as: 'zone',
        include: [{
          model: City, as: 'city',
          include: [{ model: Project, as: 'project' }]
        }]
      }]
    }]
  }
];

export default async function alertRoutes(fastify, opts) {
  // GET /api/alerts — active alerts with filters (including city, zone, ward, severity, status)
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request) => {
    const {
      status, severity, page = 1, limit = 50, device_id,
      city_id, zone_id, ward_id, search, alert_type,
    } = request.query;

    const where = {};
    if (status) where.status = status;
    if (severity) where.severity = severity;
    if (device_id) where.device_id = device_id;
    if (alert_type) where.alert_type = alert_type;
    if (search) {
      where[Op.or] = [
        { message: { [Op.iLike]: `%${search}%` } },
        { alert_type: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const streetWhere = {};
    const wardWhere = {};
    if (ward_id) wardWhere.id = ward_id;
    const zoneWhere = {};
    if (zone_id) zoneWhere.id = zone_id;
    const cityWhere = {};
    if (city_id) cityWhere.id = city_id;

    const hasHierarchyFilter = !!(ward_id || zone_id || city_id);

    const result = await Alert.findAndCountAll({
      where,
      include: [
        {
          model: Device, as: 'device',
          required: hasHierarchyFilter,
          include: [
            {
              model: Street, as: 'street',
              include: [{
                model: Ward, as: 'ward', where: Object.keys(wardWhere).length ? wardWhere : undefined,
                required: !!(ward_id || zone_id || city_id),
                include: [{
                  model: Zone, as: 'zone', where: Object.keys(zoneWhere).length ? zoneWhere : undefined,
                  required: !!(zone_id || city_id),
                  include: [{
                    model: City, as: 'city', where: Object.keys(cityWhere).length ? cityWhere : undefined,
                    required: !!city_id,
                  }]
                }]
              }]
            }
          ]
        },
        { model: AlertRule, as: 'rule', attributes: ['id', 'name', 'scope_type', 'scope_id', 'condition_field', 'condition_op', 'condition_value'] },
        { model: User, as: 'assignedUser', attributes: ['id', 'name', 'email'] },
      ],
      order: [['detected_at', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      distinct: true,
    });

    return {
      data: result.rows,
      total: result.count,
      page: parseInt(page),
      pages: Math.ceil(result.count / parseInt(limit))
    };
  });

  // GET /api/alerts/active-stats
  fastify.get('/active-stats', { preHandler: [fastify.authenticate] }, async () => {
    const activeStatuses = { [Op.in]: ['open', 'acknowledged', 'assigned', 'in_progress'] };
    const [critical, major, warning, info] = await Promise.all([
      Alert.count({ where: { severity: 'critical', status: activeStatuses } }),
      Alert.count({ where: { severity: 'major', status: activeStatuses } }),
      Alert.count({ where: { severity: 'warning', status: activeStatuses } }),
      Alert.count({ where: { severity: 'info', status: activeStatuses } }),
    ]);
    return { critical, major, warning, info, total: critical + major + warning + info };
  });

  // GET /api/alerts/:id
  fastify.get('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const alert = await Alert.findByPk(request.params.id, {
      include: [
        { model: Device, as: 'device', include: deviceInclude },
        { model: AlertRule, as: 'rule' },
        { model: User, as: 'assignedUser', attributes: ['id', 'name'] },
      ],
    });
    if (!alert) return reply.status(404).send({ error: 'Alert not found' });
    return alert;
  });

  // PUT /api/alerts/:id/acknowledge
  fastify.put('/:id/acknowledge', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const alert = await Alert.findByPk(request.params.id);
    if (!alert) return reply.status(404).send({ error: 'Not found' });
    await alert.update({ status: 'acknowledged', acknowledged_at: new Date() });
    return alert;
  });

  // PUT /api/alerts/:id/assign
  fastify.put('/:id/assign', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const alert = await Alert.findByPk(request.params.id);
    if (!alert) return reply.status(404).send({ error: 'Not found' });
    await alert.update({
      status: 'assigned',
      assigned_to: request.body.assigned_to,
      assigned_by: request.user?.id,
      assigned_at: new Date(),
    });
    return alert;
  });

  // PUT /api/alerts/:id/resolve
  fastify.put('/:id/resolve', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const alert = await Alert.findByPk(request.params.id);
    if (!alert) return reply.status(404).send({ error: 'Not found' });
    await alert.update({
      status: 'resolved',
      resolved_at: new Date(),
      resolution_notes: request.body.notes || 'Resolved by operator',
    });
    return alert;
  });

  // PUT /api/alerts/:id/close
  fastify.put('/:id/close', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const alert = await Alert.findByPk(request.params.id);
    if (!alert) return reply.status(404).send({ error: 'Not found' });
    await alert.update({ status: 'closed', closed_at: new Date() });
    return alert;
  });

  // ── Alert Rules ──────────────────────────────────────────────────

  // GET /api/alerts/rules/list — with optional scope filtering
  fastify.get('/rules/list', { preHandler: [fastify.authenticate] }, async (request) => {
    const { scope_type, scope_id, is_active } = request.query;
    const where = {};
    if (scope_type) where.scope_type = scope_type;
    if (scope_id) where.scope_id = scope_id;
    if (is_active !== undefined) where.is_active = is_active === 'true';

    const rules = await AlertRule.findAll({
      where,
      order: [['id', 'ASC']]
    });

    // Enrich rules with scope name details for convenient frontend display
    const enriched = await Promise.all(rules.map(async (r) => {
      const data = r.toJSON();
      if (data.scope_type === 'city' && data.scope_id) {
        const c = await City.findByPk(data.scope_id);
        data.scope_name = c ? `City: ${c.name}` : `City ID ${data.scope_id}`;
      } else if (data.scope_type === 'zone' && data.scope_id) {
        const z = await Zone.findByPk(data.scope_id, { include: [{ model: City, as: 'city' }] });
        data.scope_name = z ? `Zone: ${z.name} (${z.city?.name || ''})` : `Zone ID ${data.scope_id}`;
      } else if (data.scope_type === 'ward' && data.scope_id) {
        const w = await Ward.findByPk(data.scope_id, { include: [{ model: Zone, as: 'zone' }] });
        data.scope_name = w ? `Ward: ${w.name} (${w.zone?.name || ''})` : `Ward ID ${data.scope_id}`;
      } else if (data.scope_type === 'device' && data.scope_id) {
        const d = await Device.findByPk(data.scope_id);
        data.scope_name = d ? `Device: ${d.uid} - ${d.name}` : `Device ID ${data.scope_id}`;
      } else {
        data.scope_name = 'Global (All Devices)';
      }
      return data;
    }));

    return enriched;
  });

  // POST /api/alerts/rules
  fastify.post('/rules', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const rule = await AlertRule.create(request.body);
    return reply.status(201).send(rule);
  });

  // PUT /api/alerts/rules/:id
  fastify.put('/rules/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const rule = await AlertRule.findByPk(request.params.id);
    if (!rule) return reply.status(404).send({ error: 'Not found' });
    await rule.update(request.body);
    return rule;
  });

  // DELETE /api/alerts/rules/:id
  fastify.delete('/rules/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const rule = await AlertRule.findByPk(request.params.id);
    if (!rule) return reply.status(404).send({ error: 'Not found' });
    await rule.update({ is_active: false });
    return { success: true };
  });
}

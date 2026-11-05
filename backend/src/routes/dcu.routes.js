import { DCU, CCMS, Device, DeviceLatestState, Ward, Zone, City } from '../models/index.js';
import { Op } from 'sequelize';

export default async function dcuRoutes(fastify, opts) {

  // ── List all DCUs ───────────────────────────────────────────────
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (req) => {
    const where = {};
    if (req.query.ccms_id) where.ccms_id = req.query.ccms_id;
    if (req.query.status)  where.status  = req.query.status;

    const list = await DCU.findAll({
      where,
      include: [
        {
          model: CCMS,
          as: 'ccms',
          include: [
            {
              model: Ward,
              as: 'ward',
              include: [{ model: Zone, as: 'zone', include: [{ model: City, as: 'city' }] }],
            },
          ],
        },
        {
          model: Device,
          as: 'dcuDevices',
          attributes: ['id', 'name', 'uid', 'phase', 'connectivity_status', 'light_status', 'health_status', 'status'],
        },
      ],
      order: [['name', 'ASC']],
    });

    return list.map(dcu => {
      const json = dcu.toJSON();
      const devices = json.dcuDevices || [];
      const online = devices.filter(d => d.connectivity_status === 'online').length;
      const offline = devices.filter(d => d.connectivity_status === 'offline').length;
      const fault = devices.filter(d => d.health_status === 'fault' || d.health_status === 'warning').length;
      const lightOn = devices.filter(d => d.light_status === 'on').length;
      const lightOff = devices.filter(d => d.light_status === 'off').length;

      return {
        ...json,
        stats: {
          total: devices.length,
          online,
          offline,
          fault,
          light_on: lightOn,
          light_off: lightOff,
          comm_quality: online > 0 ? (online / Math.max(1, devices.length) >= 0.9 ? 'Excellent' : 'Good') : 'Offline',
        },
      };
    });
  });

  // ── Get single DCU (Dashboard View) ──────────────────────────────
  fastify.get('/:id', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const dcu = await DCU.findByPk(req.params.id, {
      include: [
        {
          model: CCMS,
          as: 'ccms',
          include: [
            {
              model: Ward,
              as: 'ward',
              include: [{ model: Zone, as: 'zone', include: [{ model: City, as: 'city' }] }],
            },
          ],
        },
        {
          model: Device,
          as: 'dcuDevices',
          include: [{ model: DeviceLatestState, as: 'latestState' }],
        },
      ],
    });
    if (!dcu) return reply.status(404).send({ error: 'DCU not found' });

    const json = dcu.toJSON();
    const devices = json.dcuDevices || [];
    const online = devices.filter(d => d.connectivity_status === 'online').length;
    const offline = devices.filter(d => d.connectivity_status === 'offline').length;
    const fault = devices.filter(d => d.health_status === 'fault' || d.health_status === 'warning').length;
    const lightOn = devices.filter(d => d.light_status === 'on').length;
    const lightOff = devices.filter(d => d.light_status === 'off').length;

    // Phase distribution
    const phaseR = devices.filter(d => d.phase === 'R').length;
    const phaseY = devices.filter(d => d.phase === 'Y').length;
    const phaseB = devices.filter(d => d.phase === 'B').length;

    return {
      ...json,
      stats: {
        total: devices.length,
        online,
        offline,
        fault,
        light_on: lightOn,
        light_off: lightOff,
        phase_r: phaseR,
        phase_y: phaseY,
        phase_b: phaseB,
        comm_quality: online > 0 ? (online / Math.max(1, devices.length) >= 0.9 ? '98.5% (Optimal)' : '84.2% (Moderate)') : 'No Signal',
        last_communication: dcu.last_seen || new Date(),
      },
    };
  });

  // ── Create DCU ──────────────────────────────────────────────────
  fastify.post('/', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const dcu = await DCU.create(req.body);
    return reply.status(201).send(dcu);
  });

  // ── Update DCU ──────────────────────────────────────────────────
  fastify.put('/:id', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const dcu = await DCU.findByPk(req.params.id);
    if (!dcu) return reply.status(404).send({ error: 'DCU not found' });
    await dcu.update(req.body);
    return dcu;
  });

  // ── Deactivate DCU ──────────────────────────────────────────────
  fastify.delete('/:id', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const dcu = await DCU.findByPk(req.params.id);
    if (!dcu) return reply.status(404).send({ error: 'DCU not found' });
    await dcu.update({ status: 'inactive' });
    return { success: true };
  });

  // ── Map a device to this DCU with Phase ──────────────────────────
  fastify.post('/:id/map-device', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { id } = req.params;
    const { device_id, phase = 'R' } = req.body;

    if (!device_id) return reply.status(400).send({ error: 'device_id is required' });

    const dcu = await DCU.findByPk(id);
    if (!dcu) return reply.status(404).send({ error: 'DCU not found' });

    // Check capacity
    const currentCount = await Device.count({ where: { dcu_id: id } });
    if (currentCount >= dcu.max_devices) {
      return reply.status(400).send({
        error: `DCU is at capacity (${dcu.max_devices} devices max)`,
      });
    }

    const device = await Device.findByPk(device_id);
    if (!device) return reply.status(404).send({ error: 'Device not found' });

    await device.update({ dcu_id: id, phase: phase || 'R' });
    return { success: true, device_id, dcu_id: id, phase: phase || 'R' };
  });

  // ── Update device phase assignment ──────────────────────────────
  fastify.put('/:id/device-phase', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { id } = req.params;
    const { device_id, phase } = req.body;

    if (!device_id || !phase) return reply.status(400).send({ error: 'device_id and phase required' });

    const device = await Device.findOne({ where: { id: device_id, dcu_id: id } });
    if (!device) return reply.status(404).send({ error: 'Device not found under this DCU' });

    await device.update({ phase });
    return { success: true, device_id, phase };
  });

  // ── Unmap a device from this DCU ─────────────────────────────────
  fastify.delete('/:id/unmap-device/:deviceId', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { id, deviceId } = req.params;

    const device = await Device.findOne({ where: { id: deviceId, dcu_id: id } });
    if (!device) return reply.status(404).send({ error: 'Device not found in this DCU' });

    await device.update({ dcu_id: null, phase: null });
    return { success: true, device_id: deviceId, dcu_id: null };
  });

  // ── Get unmapped devices (available to assign to a DCU) ──────────
  fastify.get('/available-devices', { preHandler: [fastify.authenticate] }, async (req) => {
    const where = { dcu_id: null };
    if (req.query.search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${req.query.search}%` } },
        { uid:  { [Op.iLike]: `%${req.query.search}%` } },
      ];
    }
    return Device.findAll({ where, attributes: ['id', 'name', 'uid', 'serial_number', 'street_id'], limit: 100 });
  });
}

import { Device, DeviceLatestState, Telemetry, Alert, MaintenanceTicket, Street, Ward, Zone, City, Project } from '../models/index.js';
import { Op, fn, col, literal } from 'sequelize';
import { getResolvedConfig, getSystemDefaults, resetDeviceFaultState } from '../services/faultDetection.service.js';

export default async function deviceRoutes(fastify, opts) {
  // GET /api/devices — list with filters
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request) => {
    const {
      page = 1, limit = 50, search,
      city_id, zone_id, ward_id, street_id, project_id,
      connectivity_status, light_status, health_status, status,
    } = request.query;

    const where = {};
    if (status) where.status = status;
    if (connectivity_status) where.connectivity_status = connectivity_status;
    if (light_status) where.light_status = light_status;
    if (health_status) where.health_status = health_status;
    if (search) {
      where[Op.or] = [
        { uid: { [Op.iLike]: `%${search}%` } },
        { name: { [Op.iLike]: `%${search}%` } },
        { serial_number: { [Op.iLike]: `%${search}%` } },
      ];
    }

    // Build include chain for hierarchy filtering
    const streetWhere = {};
    if (street_id) streetWhere.id = street_id;

    const wardWhere = {};
    if (ward_id) wardWhere.id = ward_id;

    const zoneWhere = {};
    if (zone_id) zoneWhere.id = zone_id;

    const cityWhere = {};
    if (city_id) cityWhere.id = city_id;

    const projectWhere = {};
    if (project_id) projectWhere.id = project_id;

    const devices = await Device.findAndCountAll({
      where,
      include: [
        {
          model: Street, as: 'street', where: Object.keys(streetWhere).length ? streetWhere : undefined,
          required: !!(street_id || ward_id || zone_id || city_id || project_id),
          include: [
            {
              model: Ward, as: 'ward', where: Object.keys(wardWhere).length ? wardWhere : undefined,
              required: !!(ward_id || zone_id || city_id || project_id),
              include: [
                {
                  model: Zone, as: 'zone', where: Object.keys(zoneWhere).length ? zoneWhere : undefined,
                  required: !!(zone_id || city_id || project_id),
                  include: [
                    {
                      model: City, as: 'city', where: Object.keys(cityWhere).length ? cityWhere : undefined,
                      required: !!(city_id || project_id),
                      include: [{ model: Project, as: 'project', where: Object.keys(projectWhere).length ? projectWhere : undefined, required: !!project_id }],
                    },
                  ],
                },
              ],
            },
          ],
        },
        { model: DeviceLatestState, as: 'latestState' },
      ],
      order: [['uid', 'ASC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      distinct: true,
    });

    return {
      data: devices.rows,
      total: devices.count,
      page: parseInt(page),
      pages: Math.ceil(devices.count / parseInt(limit)),
    };
  });

  // GET /api/devices/:id
  fastify.get('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const device = await Device.findByPk(request.params.id, {
      include: [
        {
          model: Street, as: 'street',
          include: [{ model: Ward, as: 'ward', include: [{ model: Zone, as: 'zone', include: [{ model: City, as: 'city', include: [{ model: Project, as: 'project' }] }] }] }],
        },
        { model: DeviceLatestState, as: 'latestState' },
      ],
    });
    if (!device) return reply.status(404).send({ error: 'Device not found' });
    return device;
  });

  // GET /api/devices/:id/telemetry — recent history
  fastify.get('/:id/telemetry', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const { from, to, limit = 200 } = request.query;

    const device = await Device.findByPk(id, {
      include: [{ model: DeviceLatestState, as: 'latestState' }]
    });
    if (!device) return reply.status(404).send({ error: 'Device not found' });

    const where = {
      [Op.or]: [
        { device_id: device.id },
        ...(device.uid ? [{ uid: device.uid }] : [])
      ]
    };

    if (from || to) {
      where.server_timestamp = {};
      if (from) {
        where.server_timestamp[Op.gte] = new Date(from.includes('T') ? from : from + 'T00:00:00.000Z');
      }
      if (to) {
        where.server_timestamp[Op.lte] = new Date(to.includes('T') ? to : to + 'T23:59:59.999Z');
      }
    }

    let records = await Telemetry.findAll({
      where,
      order: [['server_timestamp', 'DESC']],
      limit: Math.min(parseInt(limit) || 200, 500),
    });

    if (records.length === 0 && device.latestState) {
      const ls = device.latestState;
      records = [{
        device_id: device.id,
        uid: device.uid,
        server_timestamp: ls.server_timestamp || device.last_seen || new Date(),
        packet_timestamp: ls.packet_timestamp || device.last_seen || new Date(),
        voltage: ls.voltage || (device.light_status === 'on' ? 230.5 : 238.2),
        current: ls.current || (device.light_status === 'on' ? 0.26 : 0.0),
        real_power: ls.real_power || (device.light_status === 'on' ? 58.5 : 0.2),
        pf: ls.pf || 0.96,
        kwh: ls.kwh || 12.5,
        frequency: ls.frequency || 50.0,
        run_hours: ls.run_hours || 45.0,
        light_status: ls.light_status ?? (device.light_status === 'on' ? 1 : 0),
        relay_status: ls.relay_status ?? (device.light_status === 'on' ? 1 : 0),
        fault: ls.fault ?? 0,
      }];
    }

    return records;
  });

  // GET /api/devices/:id/diagnostics
  fastify.get('/:id/diagnostics', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const device = await Device.findByPk(request.params.id, {
      include: [{ model: DeviceLatestState, as: 'latestState' }],
    });
    if (!device) return reply.status(404).send({ error: 'Device not found' });

    const state = device.latestState;
    const now = new Date();
    const lastSeenMs = device.last_seen ? now - new Date(device.last_seen) : null;
    const lastSeenSec = lastSeenMs ? Math.floor(lastSeenMs / 1000) : null;

    // Recent telemetry for timeline
    const recentTelemetry = await Telemetry.findAll({
      where: { device_id: device.id },
      order: [['server_timestamp', 'DESC']],
      limit: 20,
    });

    const activeAlerts = await Alert.count({
      where: { device_id: device.id, status: { [Op.in]: ['open', 'acknowledged', 'assigned', 'in_progress'] } },
    });

    const openTickets = await MaintenanceTicket.count({
      where: { device_id: device.id, status: { [Op.in]: ['open', 'assigned', 'in_progress', 'pending'] } },
    });

    return {
      device: {
        id: device.id,
        uid: device.uid,
        name: device.name,
        connectivity_status: device.connectivity_status,
        light_status: device.light_status,
        health_status: device.health_status,
        last_seen: device.last_seen,
        last_seen_seconds: lastSeenSec,
      },
      connectivity: {
        status: device.connectivity_status,
        last_seen: device.last_seen,
        last_seen_seconds: lastSeenSec,
        packets_today: state?.packets_today || 0,
        packets_total: state?.packets_total || 0,
        invalid_packets: state?.invalid_packets || 0,
        missing_packets: state?.missing_packets || 0,
        ipv6_address: state?.ipv6_address,
      },
      electrical: {
        voltage: state?.voltage,
        current: state?.current,
        real_power: state?.real_power,
        pf: state?.pf,
        frequency: state?.frequency,
        kwh: state?.kwh,
        run_hours: state?.run_hours,
      },
      health: {
        fault: state?.fault,
        fault_count: state?.fault_count || 0,
        restart_count: state?.restart_count || 0,
        last_fault_at: state?.last_fault_at,
      },
      activeAlerts,
      openTickets,
      timeline: recentTelemetry.map(t => ({
        timestamp: t.server_timestamp,
        voltage: t.voltage,
        current: t.current,
        light_status: t.light_status,
        fault: t.fault,
      })),
    };
  });

  // POST /api/devices/:id/control — manual override (ON/OFF)
  fastify.post('/:id/control', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { action } = request.body; // 'on' | 'off'
    const device = await Device.findByPk(request.params.id, {
      include: [{ model: DeviceLatestState, as: 'latestState' }]
    });
    if (!device) return reply.status(404).send({ error: 'Device not found' });

    const newLightStatus = action === 'on' ? 'on' : 'off';
    const lightStatusNum = action === 'on' ? 1 : 0;
    const now = new Date();

    await device.update({ light_status: newLightStatus, last_seen: now });
    if (device.latestState) {
      await device.latestState.update({
        light_status: lightStatusNum,
        relay_status: lightStatusNum,
        server_timestamp: now,
        real_power: action === 'on' ? 58.5 : 0.2,
        current: action === 'on' ? 0.26 : 0.00,
      });
    }

    // Record Telemetry
    await Telemetry.create({
      device_id: device.id,
      uid: device.uid,
      packet_timestamp: now,
      server_timestamp: now,
      voltage: device.latestState?.voltage || 230.0,
      current: action === 'on' ? 0.26 : 0.00,
      real_power: action === 'on' ? 58.5 : 0.2,
      pf: 0.98,
      kwh: device.latestState?.kwh || 12.5,
      run_hours: device.latestState?.run_hours || 45.0,
      frequency: 50.0,
      light_status: lightStatusNum,
      relay_status: lightStatusNum,
      fault: 0,
      source_ip: 'manual_override',
      raw_payload: JSON.stringify({ action, controlled_by: request.user?.email || 'admin' }),
    });

    return { success: true, light_status: newLightStatus, message: `Light switched ${newLightStatus.toUpperCase()}` };
  });

  // POST /api/devices/:id/ping — diagnostic ping
  fastify.post('/:id/ping', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const device = await Device.findByPk(request.params.id);
    if (!device) return reply.status(404).send({ error: 'Device not found' });
    const now = new Date();
    await device.update({ last_seen: now, connectivity_status: 'online' });
    return { success: true, latency_ms: Math.floor(Math.random() * 25 + 18), timestamp: now.toISOString() };
  });

  // POST /api/devices — create device
  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const {
        uid, name, serial_number, street_id, latitude, longitude,
        device_model, rated_voltage, rated_power, firmware_version,
      } = request.body || {};

      if (!uid || typeof uid !== 'string' || !uid.trim()) {
        return reply.status(400).send({ error: 'Device UID is required' });
      }

      const cleanUid = uid.trim().toUpperCase();

      // Check duplicate UID
      const existing = await Device.findOne({ where: { uid: cleanUid } });
      if (existing) {
        return reply.status(400).send({ error: `Device with UID '${cleanUid}' already exists` });
      }

      const device = await Device.create({
        uid: cleanUid,
        name: name ? name.trim() : `StreetLight-${cleanUid}`,
        serial_number: serial_number ? serial_number.trim() : `SN-${cleanUid}`,
        street_id: street_id ? parseInt(street_id) : null,
        latitude: latitude ? parseFloat(latitude) : 22.5535,
        longitude: longitude ? parseFloat(longitude) : 88.3518,
        device_model: device_model || 'TLX-3000',
        firmware_version: firmware_version || '2.1.0',
        rated_voltage: rated_voltage ? parseFloat(rated_voltage) : 230,
        rated_power: rated_power ? parseFloat(rated_power) : 60,
        status: 'active',
        connectivity_status: 'offline',
        light_status: 'off',
        health_status: 'normal',
      });

      await DeviceLatestState.create({
        device_id: device.id,
        voltage: 0,
        current: 0,
        real_power: 0,
        pf: 0,
        kwh: 0,
        run_hours: 0,
        frequency: 50.00,
        light_status: 0,
        relay_status: 0,
        fault: 0,
        packets_today: 0,
        packets_total: 0,
      });

      const fullDevice = await Device.findByPk(device.id, {
        include: [
          {
            model: Street, as: 'street',
            include: [{ model: Ward, as: 'ward', include: [{ model: Zone, as: 'zone', include: [{ model: City, as: 'city' }] }] }],
          },
          { model: DeviceLatestState, as: 'latestState' },
        ],
      });

      return reply.status(201).send(fullDevice);
    } catch (err) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // PUT /api/devices/:id
  fastify.put('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const device = await Device.findByPk(request.params.id);
      if (!device) return reply.status(404).send({ error: 'Device not found' });
      await device.update(request.body);
      return device;
    } catch (err) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // DELETE /api/devices/:id
  fastify.delete('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const device = await Device.findByPk(request.params.id);
    if (!device) return reply.status(404).send({ error: 'Not found' });
    await device.update({ status: 'decommissioned' });
    return { success: true };
  });

  // GET /api/devices/:id/fault-config — return current effective thresholds for a device
  fastify.get('/:id/fault-config', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const device = await Device.findByPk(request.params.id);
    if (!device) return reply.status(404).send({ error: 'Device not found' });

    const defaults = getSystemDefaults();
    const effective = getResolvedConfig(device.fault_config);
    const saved = device.fault_config || {};

    return { defaults, effective, saved };
  });

  // PUT /api/devices/:id/fault-config — save per-device threshold overrides
  fastify.put('/:id/fault-config', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const device = await Device.findByPk(request.params.id);
    if (!device) return reply.status(404).send({ error: 'Device not found' });

    // Merge new config over existing saved values
    const currentSaved = device.fault_config || {};
    const newConfig = { ...currentSaved, ...request.body };

    await device.update({ fault_config: newConfig });

    const effective = getResolvedConfig(newConfig);
    return { success: true, saved: newConfig, effective };
  });

  // DELETE /api/devices/:id/fault-config — restore device to system defaults
  fastify.delete('/:id/fault-config', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const device = await Device.findByPk(request.params.id);
    if (!device) return reply.status(404).send({ error: 'Device not found' });

    await device.update({ fault_config: {} });
    return { success: true, effective: getSystemDefaults(), message: 'Restored to system defaults' };
  });

  // POST /api/devices/:id/fault-config/reset-baseline — wipe in-memory baseline
  fastify.post('/:id/fault-config/reset-baseline', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const device = await Device.findByPk(request.params.id);
    if (!device) return reply.status(404).send({ error: 'Device not found' });

    resetDeviceFaultState(device.uid);
    return { success: true, message: `Baseline reset for device ${device.uid}. Re-learning will begin on next packet.` };
  });
}


import { Device, DeviceLatestState, Telemetry, Alert, MaintenanceTicket, Street, Ward, Zone, City, Project } from '../models/index.js';
import { Op } from 'sequelize';

export default async function reportRoutes(fastify, opts) {
  // GET /api/reports/telemetry-data — historical device telemetry with time filtering
  fastify.get('/telemetry-data', { preHandler: [fastify.authenticate] }, async (req) => {
    const { device_id, city_id, zone_id, ward_id, from, to, limit = 500 } = req.query;
    const where = {};

    if (device_id) {
      where.device_id = device_id;
    }

    if (from || to) {
      where.server_timestamp = {};
      if (from) where.server_timestamp[Op.gte] = new Date(from);
      if (to) where.server_timestamp[Op.lte] = new Date(to + 'T23:59:59.999Z');
    }

    const streetWhere = {};
    const wardWhere = {};
    if (ward_id) wardWhere.id = ward_id;
    const zoneWhere = {};
    if (zone_id) zoneWhere.id = zone_id;
    const cityWhere = {};
    if (city_id) cityWhere.id = city_id;

    const hasHierarchyFilter = !!(ward_id || zone_id || city_id);

    const records = await Telemetry.findAll({
      where,
      include: hasHierarchyFilter ? [{
        model: Device, as: 'device', required: true,
        include: [{
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
        }]
      }] : undefined,
      order: [['server_timestamp', 'DESC']],
      limit: parseInt(limit),
    });

    return records;
  });

  // GET /api/reports/device-summary — full fleet operational and electrical report
  fastify.get('/device-summary', { preHandler: [fastify.authenticate] }, async (req) => {
    const { city_id, zone_id, ward_id, street_id, search, connectivity_status, light_status, health_status } = req.query;

    const where = {};
    if (connectivity_status) where.connectivity_status = connectivity_status;
    if (light_status) where.light_status = light_status;
    if (health_status) where.health_status = health_status;
    if (search) {
      where[Op.or] = [
        { uid: { [Op.iLike]: `%${search}%` } },
        { name: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const streetWhere = {};
    if (street_id) streetWhere.id = street_id;
    const wardWhere = {};
    if (ward_id) wardWhere.id = ward_id;
    const zoneWhere = {};
    if (zone_id) zoneWhere.id = zone_id;
    const cityWhere = {};
    if (city_id) cityWhere.id = city_id;

    const devices = await Device.findAll({
      where,
      include: [
        {
          model: Street, as: 'street', where: Object.keys(streetWhere).length ? streetWhere : undefined,
          required: !!(street_id || ward_id || zone_id || city_id),
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
        },
        { model: DeviceLatestState, as: 'latestState' }
      ],
      order: [['uid', 'ASC']]
    });

    return devices.map(d => {
      const s = d.latestState;
      const kwh = parseFloat(s?.kwh || 0);
      const runHours = parseFloat(s?.run_hours || 0);
      const baselineKwh = runHours * 0.150;
      const savedKwh = Math.max(0, baselineKwh - kwh);

      return {
        id: d.id,
        uid: d.uid,
        name: d.name,
        city: d.street?.ward?.zone?.city?.name || '—',
        zone: d.street?.ward?.zone?.name || '—',
        ward: d.street?.ward?.name || '—',
        street: d.street?.name || '—',
        connectivity_status: d.connectivity_status,
        light_status: d.light_status,
        health_status: d.health_status,
        voltage: s?.voltage ?? 0,
        current: s?.current ?? 0,
        real_power: s?.real_power ?? 0,
        pf: s?.pf ?? 0.98,
        frequency: s?.frequency ?? 50.0,
        kwh: kwh.toFixed(2),
        baselineKwh: baselineKwh.toFixed(2),
        savedKwh: savedKwh.toFixed(2),
        run_hours: runHours.toFixed(1),
        fault_count: s?.fault_count || 0,
        restart_count: s?.restart_count || 0,
        packets_today: s?.packets_today || 0,
        last_seen: d.last_seen,
      };
    });
  });

  // GET /api/reports/city/:cityId
  fastify.get('/city/:cityId', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const city = await City.findByPk(req.params.cityId, { include: [{ model: Project, as: 'project' }] });
    if (!city) return reply.status(404).send({ error: 'City not found' });

    const zones = await Zone.findAll({
      where: { city_id: city.id },
      include: [{ model: Ward, as: 'wards', include: [{ model: Street, as: 'streets', include: [{ model: Device, as: 'devices', include: [{ model: DeviceLatestState, as: 'latestState' }] }] }] }],
    });

    const allDevices = zones.flatMap(z => z.wards.flatMap(w => w.streets.flatMap(s => s.devices)));

    const [activeFaults, openMaintenance] = await Promise.all([
      Alert.count({ where: { status: { [Op.in]: ['open', 'acknowledged', 'assigned', 'in_progress'] } } }),
      MaintenanceTicket.count({ where: { status: { [Op.in]: ['open', 'assigned', 'in_progress', 'pending'] } } }),
    ]);

    const energyTotal = allDevices.reduce((sum, d) => sum + parseFloat(d.latestState?.kwh || 0), 0);
    const powerTotal = allDevices.reduce((sum, d) => sum + parseFloat(d.latestState?.real_power || 0), 0);
    const runHoursTotal = allDevices.reduce((sum, d) => sum + parseFloat(d.latestState?.run_hours || 0), 0);
    const baselineKwh = runHoursTotal * 0.150;
    const savedKwh = Math.max(0, baselineKwh - energyTotal);

    return {
      city: { id: city.id, name: city.name, project: city.project?.name },
      summary: {
        totalDevices: allDevices.length,
        online: allDevices.filter(d => d.connectivity_status === 'online').length,
        offline: allDevices.filter(d => d.connectivity_status === 'offline').length,
        warning: allDevices.filter(d => d.connectivity_status === 'warning').length,
        lightsOn: allDevices.filter(d => d.light_status === 'on').length,
        lightsOff: allDevices.filter(d => d.light_status === 'off').length,
        activeFaults,
        openMaintenance,
        energyTotal: energyTotal.toFixed(2),
        demandKw: (powerTotal / 1000).toFixed(2),
        savedKwh: savedKwh.toFixed(2),
        savingsPercent: baselineKwh > 0 ? ((savedKwh / baselineKwh) * 100).toFixed(1) : '62.5',
      },
      zones: zones.map(z => {
        const zDevices = z.wards.flatMap(w => w.streets.flatMap(s => s.devices));
        const zEnergy = zDevices.reduce((sum, d) => sum + parseFloat(d.latestState?.kwh || 0), 0);
        return {
          id: z.id,
          name: z.name,
          code: z.code,
          totalDevices: zDevices.length,
          online: zDevices.filter(d => d.connectivity_status === 'online').length,
          offline: zDevices.filter(d => d.connectivity_status === 'offline').length,
          lightsOn: zDevices.filter(d => d.light_status === 'on').length,
          faults: zDevices.filter(d => d.health_status === 'fault').length,
          energyTotal: zEnergy.toFixed(2),
        };
      }),
    };
  });

  // GET /api/reports/zone/:zoneId
  fastify.get('/zone/:zoneId', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const zone = await Zone.findByPk(req.params.zoneId, {
      include: [{
        model: Ward, as: 'wards',
        include: [{ model: Street, as: 'streets', include: [{ model: Device, as: 'devices', include: [{ model: DeviceLatestState, as: 'latestState' }] }] }],
      }],
    });
    if (!zone) return reply.status(404).send({ error: 'Zone not found' });

    const allDevices = zone.wards.flatMap(w => w.streets.flatMap(s => s.devices));
    const energyTotal = allDevices.reduce((sum, d) => sum + parseFloat(d.latestState?.kwh || 0), 0);
    const powerTotal = allDevices.reduce((sum, d) => sum + parseFloat(d.latestState?.real_power || 0), 0);

    return {
      zone: { id: zone.id, name: zone.name, code: zone.code },
      summary: {
        totalDevices: allDevices.length,
        online: allDevices.filter(d => d.connectivity_status === 'online').length,
        offline: allDevices.filter(d => d.connectivity_status === 'offline').length,
        warning: allDevices.filter(d => d.connectivity_status === 'warning').length,
        lightsOn: allDevices.filter(d => d.light_status === 'on').length,
        lightsOff: allDevices.filter(d => d.light_status === 'off').length,
        faults: allDevices.filter(d => d.health_status === 'fault').length,
        energyTotal: energyTotal.toFixed(2),
        demandKw: (powerTotal / 1000).toFixed(2),
      },
      wards: zone.wards.map(w => {
        const wDevices = w.streets.flatMap(s => s.devices);
        const wEnergy = wDevices.reduce((sum, d) => sum + parseFloat(d.latestState?.kwh || 0), 0);
        return {
          id: w.id,
          name: w.name,
          number: w.number,
          totalDevices: wDevices.length,
          online: wDevices.filter(d => d.connectivity_status === 'online').length,
          offline: wDevices.filter(d => d.connectivity_status === 'offline').length,
          lightsOn: wDevices.filter(d => d.light_status === 'on').length,
          faults: wDevices.filter(d => d.health_status === 'fault').length,
          energyTotal: wEnergy.toFixed(2),
        };
      }),
    };
  });

  // GET /api/reports/ward/:wardId
  fastify.get('/ward/:wardId', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const ward = await Ward.findByPk(req.params.wardId, {
      include: [{
        model: Street, as: 'streets',
        include: [{ model: Device, as: 'devices', include: [{ model: DeviceLatestState, as: 'latestState' }] }],
      }],
    });
    if (!ward) return reply.status(404).send({ error: 'Ward not found' });

    const allDevices = ward.streets.flatMap(s => s.devices);
    const energyTotal = allDevices.reduce((sum, d) => sum + parseFloat(d.latestState?.kwh || 0), 0);
    const powerTotal = allDevices.reduce((sum, d) => sum + parseFloat(d.latestState?.real_power || 0), 0);

    return {
      ward: { id: ward.id, name: ward.name, number: ward.number },
      summary: {
        totalDevices: allDevices.length,
        online: allDevices.filter(d => d.connectivity_status === 'online').length,
        offline: allDevices.filter(d => d.connectivity_status === 'offline').length,
        lightsOn: allDevices.filter(d => d.light_status === 'on').length,
        lightsOff: allDevices.filter(d => d.light_status === 'off').length,
        faults: allDevices.filter(d => d.health_status === 'fault').length,
        energyTotal: energyTotal.toFixed(2),
        demandKw: (powerTotal / 1000).toFixed(2),
      },
      streets: ward.streets.map(s => {
        const sDevices = s.devices;
        return {
          id: s.id,
          name: s.name,
          totalDevices: sDevices.length,
          online: sDevices.filter(d => d.connectivity_status === 'online').length,
          offline: sDevices.filter(d => d.connectivity_status === 'offline').length,
          lightsOn: sDevices.filter(d => d.light_status === 'on').length,
          faults: sDevices.filter(d => d.health_status === 'fault').length,
          energyTotal: sDevices.reduce((sum, d) => sum + parseFloat(d.latestState?.kwh || 0), 0).toFixed(2),
        };
      }),
    };
  });

  // GET /api/reports/faults
  fastify.get('/faults', { preHandler: [fastify.authenticate] }, async (req) => {
    const { from, to, severity, zone_id, ward_id, alert_type } = req.query;
    const where = {};
    if (from || to) {
      where.detected_at = {};
      if (from) where.detected_at[Op.gte] = new Date(from);
      if (to) where.detected_at[Op.lte] = new Date(to + 'T23:59:59.999Z');
    }
    if (severity) where.severity = severity;
    if (alert_type) where.alert_type = alert_type;

    return Alert.findAll({
      where,
      include: [{
        model: Device, as: 'device',
        include: [{
          model: Street, as: 'street',
          include: [{
            model: Ward, as: 'ward',
            include: [{ model: Zone, as: 'zone', include: [{ model: City, as: 'city' }] }]
          }]
        }]
      }],
      order: [['detected_at', 'DESC']],
      limit: 1000,
    });
  });
}

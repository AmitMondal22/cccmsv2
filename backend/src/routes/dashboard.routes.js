import { Device, DeviceLatestState, Alert, MaintenanceTicket, Street, Ward, Zone, City, Project } from '../models/index.js';
import { Op, fn, col, literal } from 'sequelize';

export default async function dashboardRoutes(fastify, opts) {
  // GET /api/dashboard/kpis
  fastify.get('/kpis', { preHandler: [fastify.authenticate] }, async (request) => {
    const [
      totalDevices,
      lightsOn,
      lightsOff,
      online,
      offline,
      warning,
      activeFaults,
      openMaintenance,
    ] = await Promise.all([
      Device.count({ where: { status: 'active' } }),
      Device.count({ where: { light_status: 'on', status: 'active' } }),
      Device.count({ where: { light_status: 'off', status: 'active' } }),
      Device.count({ where: { connectivity_status: 'online', status: 'active' } }),
      Device.count({ where: { connectivity_status: 'offline', status: 'active' } }),
      Device.count({ where: { connectivity_status: 'warning', status: 'active' } }),
      Alert.count({ where: { status: { [Op.in]: ['open', 'acknowledged', 'assigned', 'in_progress'] } } }),
      MaintenanceTicket.count({ where: { status: { [Op.in]: ['open', 'assigned', 'in_progress', 'pending'] } } }),
    ]);

    // Energy Today — sum of kwh from today's telemetry (use latest state as approximation)
    const energyResult = await DeviceLatestState.sum('kwh');
    const runHoursResult = await DeviceLatestState.sum('run_hours');

    return {
      totalDevices,
      lightsOn,
      lightsOff,
      online,
      offline,
      warning,
      activeFaults,
      openMaintenance,
      energyToday: parseFloat(energyResult || 0).toFixed(2),
      runningHours: parseFloat(runHoursResult || 0).toFixed(0),
    };
  });

  // GET /api/dashboard/zone-summary
  fastify.get('/zone-summary', { preHandler: [fastify.authenticate] }, async (request) => {
    const zones = await Zone.findAll({
      include: [
        {
          model: Ward,
          as: 'wards',
          include: [
            {
              model: Street,
              as: 'streets',
              include: [{ model: Device, as: 'devices', attributes: ['connectivity_status', 'light_status', 'health_status'] }],
            },
          ],
        },
      ],
    });

    return zones.map(zone => {
      const allDevices = zone.wards.flatMap(w => w.streets.flatMap(s => s.devices));
      return {
        id: zone.id,
        name: zone.name,
        code: zone.code,
        totalDevices: allDevices.length,
        online: allDevices.filter(d => d.connectivity_status === 'online').length,
        offline: allDevices.filter(d => d.connectivity_status === 'offline').length,
        warning: allDevices.filter(d => d.connectivity_status === 'warning').length,
        lightsOn: allDevices.filter(d => d.light_status === 'on').length,
        lightsOff: allDevices.filter(d => d.light_status === 'off').length,
        faults: allDevices.filter(d => d.health_status === 'fault').length,
      };
    });
  });

  // GET /api/dashboard/ward-summary/:zoneId
  fastify.get('/ward-summary/:zoneId', { preHandler: [fastify.authenticate] }, async (request) => {
    const { zoneId } = request.params;
    const wards = await Ward.findAll({
      where: { zone_id: zoneId },
      include: [
        {
          model: Street,
          as: 'streets',
          include: [{ model: Device, as: 'devices', attributes: ['connectivity_status', 'light_status', 'health_status'] }],
        },
      ],
    });

    return wards.map(ward => {
      const allDevices = ward.streets.flatMap(s => s.devices);
      return {
        id: ward.id,
        name: ward.name,
        number: ward.number,
        totalDevices: allDevices.length,
        online: allDevices.filter(d => d.connectivity_status === 'online').length,
        offline: allDevices.filter(d => d.connectivity_status === 'offline').length,
        lightsOn: allDevices.filter(d => d.light_status === 'on').length,
        lightsOff: allDevices.filter(d => d.light_status === 'off').length,
        faults: allDevices.filter(d => d.health_status === 'fault').length,
      };
    });
  });
}

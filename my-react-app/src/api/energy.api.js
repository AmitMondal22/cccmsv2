import client from './client.js';

export const getEnergySummary = (params) => client.get('/energy/summary', { params });
export const getEnergyTrend = (params) => client.get('/energy/trend', { params });
export const getZoneEnergyBreakdown = (params) => client.get('/energy/zone-breakdown', { params });
export const getDeviceWiseEnergy = (params) => client.get('/energy/device-wise', { params });

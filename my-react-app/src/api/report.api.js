import client from './client.js';

export const getCityReport = (cityId) => client.get(`/reports/city/${cityId}`);
export const getZoneReport = (zoneId) => client.get(`/reports/zone/${zoneId}`);
export const getWardReport = (wardId) => client.get(`/reports/ward/${wardId}`);
export const getFaultReport = (params) => client.get('/reports/faults', { params });
export const getTelemetryDataReport = (params) => client.get('/reports/telemetry-data', { params });
export const getDeviceSummaryReport = (params) => client.get('/reports/device-summary', { params });

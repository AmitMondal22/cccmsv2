import client from './client.js';

export const getDevices = (params) => client.get('/devices', { params });
export const getDevice = (id) => client.get(`/devices/${id}`);
export const getDeviceTelemetry = (id, params) => client.get(`/devices/${id}/telemetry`, { params });
export const getDeviceDiagnostics = (id) => client.get(`/devices/${id}/diagnostics`);
export const controlDevice = (id, action) => client.post(`/devices/${id}/control`, { action });
export const pingDevice = (id) => client.post(`/devices/${id}/ping`);
export const createDevice = (data) => client.post('/devices', data);
export const updateDevice = (id, data) => client.put(`/devices/${id}`, data);
export const deleteDevice = (id) => client.delete(`/devices/${id}`);

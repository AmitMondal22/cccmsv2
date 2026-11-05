import client from './client.js';

export const getDCUList = (params) => client.get('/dcu', { params });
export const getDCU = (id) => client.get(`/dcu/${id}`);
export const createDCU = (data) => client.post('/dcu', data);
export const updateDCU = (id, data) => client.put(`/dcu/${id}`, data);
export const deleteDCU = (id) => client.delete(`/dcu/${id}`);
export const mapDeviceToDCU = (id, data) => client.post(`/dcu/${id}/map-device`, data);
export const unmapDeviceFromDCU = (id, deviceId) => client.delete(`/dcu/${id}/unmap-device/${deviceId}`);
export const updateDevicePhase = (id, data) => client.put(`/dcu/${id}/device-phase`, data);
export const getAvailableDevices = (params) => client.get('/dcu/available-devices', { params });

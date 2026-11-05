import client from './client.js';

export const getCCMSList = (params) => client.get('/ccms', { params });
export const getCCMS = (id) => client.get(`/ccms/${id}`);
export const createCCMS = (data) => client.post('/ccms', data);
export const updateCCMS = (id, data) => client.put(`/ccms/${id}`, data);
export const deleteCCMS = (id) => client.delete(`/ccms/${id}`);
export const controlCCMS = (id, data) => client.post(`/ccms/${id}/control`, data);
export const getCCMSTelemetry = (id, params) => client.get(`/ccms/${id}/telemetry`, { params });
export const getCCMSEnergySummary = (id, params) => client.get(`/ccms/${id}/energy-summary`, { params });
export const getCCMSReconciliation = (id, params) => client.get(`/ccms/${id}/reconciliation`, { params });
export const getCCMSActivity = (id) => client.get(`/ccms/${id}/activity`);
export const getCCMSHierarchy = (id) => client.get(`/ccms/${id}/hierarchy`);


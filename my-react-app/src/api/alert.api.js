import client from './client.js';

export const getAlerts = (params) => client.get('/alerts', { params });
export const getActiveStats = () => client.get('/alerts/active-stats');
export const getAlert = (id) => client.get(`/alerts/${id}`);
export const acknowledgeAlert = (id) => client.put(`/alerts/${id}/acknowledge`);
export const assignAlert = (id, data) => client.put(`/alerts/${id}/assign`, data);
export const resolveAlert = (id, data) => client.put(`/alerts/${id}/resolve`, data);
export const closeAlert = (id) => client.put(`/alerts/${id}/close`);
export const getAlertRules = () => client.get('/alerts/rules/list');
export const createAlertRule = (data) => client.post('/alerts/rules', data);
export const updateAlertRule = (id, data) => client.put(`/alerts/rules/${id}`, data);
export const deleteAlertRule = (id) => client.delete(`/alerts/rules/${id}`);

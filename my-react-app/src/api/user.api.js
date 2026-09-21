import client from './client.js';

export const getUsers = () => client.get('/users');
export const getUser = (id) => client.get(`/users/${id}`);
export const createUser = (data) => client.post('/users', data);
export const updateUser = (id, data) => client.put(`/users/${id}`, data);
export const deleteUser = (id) => client.delete(`/users/${id}`);

export const getAuditLogs = (params) => client.get('/audit', { params });
export const getNotifications = () => client.get('/notifications');
export const markNotificationRead = (id) => client.put(`/notifications/${id}/read`);
export const markAllRead = () => client.put('/notifications/read-all');

import client from './client.js';

export const getTickets = (params) => client.get('/maintenance/tickets', { params });
export const getTicketStats = () => client.get('/maintenance/tickets/stats');
export const getTicket = (id) => client.get(`/maintenance/tickets/${id}`);
export const createTicket = (data) => client.post('/maintenance/tickets', data);
export const updateTicket = (id, data) => client.put(`/maintenance/tickets/${id}`, data);
export const resolveTicket = (id, data) => client.put(`/maintenance/tickets/${id}/resolve`, data);
export const closeTicket = (id) => client.put(`/maintenance/tickets/${id}/close`);

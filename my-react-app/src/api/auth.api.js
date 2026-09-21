import client from './client.js';

export const login = (data) => client.post('/auth/login', data);
export const getMe = () => client.get('/auth/me');

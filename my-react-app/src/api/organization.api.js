import client from './client.js';

export const getProjects = () => client.get('/org/projects');
export const createProject = (data) => client.post('/org/projects', data);
export const updateProject = (id, data) => client.put(`/org/projects/${id}`, data);

export const getCities = (params) => client.get('/org/cities', { params });
export const createCity = (data) => client.post('/org/cities', data);
export const updateCity = (id, data) => client.put(`/org/cities/${id}`, data);

export const getZones = (params) => client.get('/org/zones', { params });
export const createZone = (data) => client.post('/org/zones', data);
export const updateZone = (id, data) => client.put(`/org/zones/${id}`, data);

export const getWards = (params) => client.get('/org/wards', { params });
export const createWard = (data) => client.post('/org/wards', data);
export const updateWard = (id, data) => client.put(`/org/wards/${id}`, data);

export const getStreets = (params) => client.get('/org/streets', { params });
export const createStreet = (data) => client.post('/org/streets', data);
export const updateStreet = (id, data) => client.put(`/org/streets/${id}`, data);

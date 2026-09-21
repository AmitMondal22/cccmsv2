import client from './client.js';

export const getKPIs = () => client.get('/dashboard/kpis');
export const getZoneSummary = () => client.get('/dashboard/zone-summary');
export const getWardSummary = (zoneId) => client.get(`/dashboard/ward-summary/${zoneId}`);

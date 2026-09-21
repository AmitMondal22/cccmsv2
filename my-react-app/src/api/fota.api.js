import client from './client.js';

export const getFirmwareReleases = () => client.get('/fota/releases');
export const createFirmwareRelease = (data) => client.post('/fota/releases', data);
export const uploadFirmwareBinary = (formData) => client.post('/fota/upload', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
});
export const updateFirmwareRelease = (id, data) => client.patch(`/fota/releases/${id}`, data);
export const deleteFirmwareRelease = (id) => client.delete(`/fota/releases/${id}`);

export const checkFotaUpdates = (params) => client.get('/fota/check-updates', { params });

export const getFotaCampaigns = () => client.get('/fota/campaigns');
export const getFotaCampaign = (id) => client.get(`/fota/campaigns/${id}`);
export const createFotaCampaign = (data) => client.post('/fota/campaigns', data);

export const triggerSingleDeviceFota = (data) => client.post('/fota/single-device-update', data);

import axios from 'axios';

// Base API URL pointing to https://ccms-api.iotblitz.in/api with fallback/env support
const RAW_URL = import.meta.env.VITE_API_URL || 'https://ccms-api.iotblitz.in';
const API_BASE = RAW_URL.endsWith('/api') ? RAW_URL : `${RAW_URL.replace(/\/+$/, '')}/api`;

const client = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('techavo_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('techavo_token');
      localStorage.removeItem('techavo_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export { API_BASE };
export default client;

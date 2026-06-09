import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
});

const TENANT_SLUG = import.meta.env.VITE_TENANT_SLUG || 'demo';

api.interceptors.request.use(config => {
  config.headers['X-Tenant-Slug'] = TENANT_SLUG;
  return config;
});

export default api;

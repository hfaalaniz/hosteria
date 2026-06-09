import axios from 'axios';

// In production VITE_API_URL = "https://hosteria-api.workers.dev"
// so calls to "/api/web/..." become "https://hosteria-api.workers.dev/api/web/..."
// In dev the Vite proxy handles /api → localhost:5000 so baseURL stays empty.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
});

export default api;

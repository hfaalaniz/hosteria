import axios from 'axios';

// VITE_API_URL es build-time y siempre vacío en deploys dinámicos.
// Fallback: si estamos en *.pages.dev (no es el proyecto base), apuntar al Worker directamente.
function getBaseURL() {
  if (import.meta.env.VITE_API_URL) return `${import.meta.env.VITE_API_URL}/api`;
  const hostname = window.location.hostname;
  if (hostname === 'localhost') return '/api';
  // Cualquier deploy en pages.dev apunta siempre al mismo Worker
  return 'https://hosteria-api.soportetecnicoaf1.workers.dev/api';
}

const api = axios.create({
  baseURL: getBaseURL(),
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

import axios from 'axios';

function getBaseURL() {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  const hostname = window.location.hostname;
  if (hostname === 'localhost') return '';
  return 'https://hosteria-api.soportetecnicoaf1.workers.dev';
}

const api = axios.create({
  baseURL: getBaseURL(),
});

// Lee el slug en runtime: ?slug=xxx > subdominio > localStorage > VITE_TENANT_SLUG > 'demo'
// Orden de prioridad:
//   1. ?slug=xxx en la URL
//   2. Subdominio del hostname: web-dormirbien.pages.dev → dormirbien
//   3. localStorage (sesión previa)
//   4. VITE_TENANT_SLUG (build time, siempre vacío en deploys dinámicos)
//   5. 'demo'
function getTenantSlug() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('slug');
  if (fromUrl) {
    localStorage.setItem('tenant_slug', fromUrl);
    return fromUrl;
  }

  // Extraer slug del subdominio: web-{slug}.pages.dev o {slug}.pages.dev
  const hostname = window.location.hostname;
  const subdomain = hostname.split('.')[0]; // ej: "web-dormirbien"
  const fromHost = subdomain.startsWith('web-')
    ? subdomain.slice(4)   // "web-dormirbien" → "dormirbien"
    : subdomain !== 'localhost' && subdomain !== 'hosteria-web' && subdomain !== 'web'
      ? subdomain
      : null;
  if (fromHost) {
    localStorage.setItem('tenant_slug', fromHost);
    return fromHost;
  }

  return localStorage.getItem('tenant_slug')
    || import.meta.env.VITE_TENANT_SLUG
    || 'demo';
}

api.interceptors.request.use(config => {
  config.headers['X-Tenant-Slug'] = getTenantSlug();
  return config;
});

export default api;
export { getTenantSlug };

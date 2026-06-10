import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { auth as authRoute } from './routes/auth.js';
import { usuarios } from './routes/usuarios.js';
import { habitaciones } from './routes/habitaciones.js';
import { tiposHabitacion } from './routes/tipos_habitacion.js';
import { huespedes } from './routes/huespedes.js';
import { reservas } from './routes/reservas.js';
import { consumos } from './routes/consumos.js';
import { servicios } from './routes/servicios.js';
import { facturas } from './routes/facturas.js';
import { dashboard } from './routes/dashboard.js';
import { mantenimiento } from './routes/mantenimiento.js';
import { configuracion } from './routes/configuracion.js';
import { reservasWeb } from './routes/reservas_web.js';
import { historial } from './routes/historial.js';
import { reportes } from './routes/reportes.js';
import { permisos } from './routes/permisos.js';
import { partesLimpieza } from './routes/partes_limpieza.js';
import { partesMantenimiento } from './routes/partes_mantenimiento.js';
import { icalFeeds } from './routes/ical_feeds.js';
import { ical as icalPublic } from './routes/ical.js';
import { notificaciones } from './routes/notificaciones.js';
import { tenants } from './routes/tenants.js';
import { initDB } from './db/init.js';

const app = new Hono();

app.use('*', async (c, next) => {
  const origin = c.req.header('Origin') || '';

  // Permitir cualquier subdominio de pages.dev + localhost
  const isAllowed =
    origin.endsWith('.pages.dev') ||
    origin === 'http://localhost:3000' ||
    origin === 'http://localhost:4001' ||
    origin === c.env.FRONTEND_URL ||
    origin === c.env.WEB_URL;

  // Nunca '*' con credentials:true (inválido por spec): fallback a un origen concreto
  const allowed = isAllowed ? origin : (c.env.FRONTEND_URL || 'https://hosteria-admin.pages.dev');

  return cors({
    origin: allowed,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Slug'],
    credentials: true,
  })(c, next);
});

app.use('*', async (c, next) => {
  await initDB(c.env.DB);
  return next();
});

app.get('/api/health', c => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.route('/api/auth', authRoute);
app.route('/api/usuarios', usuarios);
app.route('/api/habitaciones', habitaciones);
app.route('/api/tipos-habitacion', tiposHabitacion);
app.route('/api/huespedes', huespedes);
app.route('/api/reservas', reservas);
app.route('/api/consumos', consumos);
app.route('/api/servicios', servicios);
app.route('/api/facturas', facturas);
app.route('/api/dashboard', dashboard);
app.route('/api/mantenimiento', mantenimiento);
app.route('/api/configuracion', configuracion);
app.route('/api/web', reservasWeb);
app.route('/api/historial', historial);
app.route('/api/reportes', reportes);
app.route('/api/permisos', permisos);
app.route('/api/partes-limpieza', partesLimpieza);
app.route('/api/partes-mantenimiento', partesMantenimiento);
app.route('/api/ical-feeds', icalFeeds);
app.route('/ical', icalPublic);
app.route('/api/notificaciones', notificaciones);
app.route('/api/tenants', tenants);

export default app;

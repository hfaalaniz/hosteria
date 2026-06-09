import { Hono } from 'hono';
import { authMiddleware, adminOnly } from '../middleware/auth.js';

export const configuracion = new Hono();

configuracion.get('/', authMiddleware, async c => {
  const { results } = await c.env.DB.prepare('SELECT clave,valor FROM configuracion').all();
  return c.json(results.reduce((a, r) => ({ ...a, [r.clave]: r.valor }), {}));
});

configuracion.put('/', authMiddleware, adminOnly, async c => {
  const body = await c.req.json();
  const entries = Object.entries(body);
  if (entries.length === 0) return c.json({ mensaje: 'Sin cambios' });
  await c.env.DB.batch(entries.map(([k, v]) => c.env.DB.prepare('INSERT OR REPLACE INTO configuracion (clave,valor) VALUES (?,?)').bind(k, String(v))));
  return c.json({ mensaje: 'Configuración actualizada' });
});

configuracion.get('/publica', async c => {
  const claves = ['nombre_hosteria','direccion','telefono','email','moneda','simbolo_moneda','hora_checkin','hora_checkout','pago_cbu','pago_alias','pago_titular','pago_banco','pago_instrucciones'];
  const { results } = await c.env.DB.prepare(`SELECT clave,valor FROM configuracion WHERE clave IN (${claves.map(() => '?').join(',')})`).bind(...claves).all();
  return c.json(results.reduce((a, r) => ({ ...a, [r.clave]: r.valor }), {}));
});

// Test email usando Resend
configuracion.post('/test-email', authMiddleware, adminOnly, async c => {
  const { results } = await c.env.DB.prepare("SELECT clave,valor FROM configuracion WHERE clave IN ('resend_api_key','smtp_from','nombre_hosteria')").all();
  const cfg = results.reduce((a, r) => ({ ...a, [r.clave]: r.valor }), {});
  if (!cfg.resend_api_key) return c.json({ error: 'Configurá la Resend API Key primero en configuración' }, 400);
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cfg.resend_api_key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `"${cfg.nombre_hosteria||'Hostería'}" <${cfg.smtp_from||'noreply@hosteria.com'}>`, to: cfg.smtp_from||'noreply@hosteria.com', subject: '✅ Test email', html: '<p>El email funciona correctamente.</p>' }),
    });
    if (!resp.ok) { const e = await resp.json(); return c.json({ error: e.message || 'Error de Resend' }, 400); }
    return c.json({ ok: true, mensaje: 'Email de prueba enviado correctamente.' });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

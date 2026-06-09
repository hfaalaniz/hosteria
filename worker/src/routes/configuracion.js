import { Hono } from 'hono';
import { authMiddleware, adminOnly } from '../middleware/auth.js';

export const configuracion = new Hono();

configuracion.get('/', authMiddleware, async c => {
  const { tenant_id } = c.get('user');
  const { results } = await c.env.DB.prepare('SELECT clave,valor FROM configuracion_mt WHERE tenant_id=?').bind(tenant_id).all();
  return c.json(results.reduce((a, r) => ({ ...a, [r.clave]: r.valor }), {}));
});

configuracion.put('/', authMiddleware, adminOnly, async c => {
  const { tenant_id } = c.get('user');
  const body = await c.req.json();
  const entries = Object.entries(body);
  if (entries.length === 0) return c.json({ mensaje: 'Sin cambios' });
  await c.env.DB.batch(entries.map(([k, v]) => c.env.DB.prepare('INSERT OR REPLACE INTO configuracion_mt (tenant_id,clave,valor) VALUES (?,?,?)').bind(tenant_id, k, String(v))));
  return c.json({ mensaje: 'Configuración actualizada' });
});

configuracion.post('/test-email', authMiddleware, adminOnly, async c => {
  const { tenant_id } = c.get('user');
  const { results } = await c.env.DB.prepare("SELECT clave,valor FROM configuracion_mt WHERE tenant_id=? AND clave IN ('resend_api_key','smtp_from','nombre_hosteria')").bind(tenant_id).all();
  const cfg = results.reduce((a, r) => ({ ...a, [r.clave]: r.valor }), {});
  // Fallback to Worker-level secret if not configured per-tenant
  const apiKey = cfg.resend_api_key || c.env.RESEND_API_KEY;
  if (!apiKey) return c.json({ error: 'Configurá la Resend API Key primero en configuración' }, 400);
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `"${cfg.nombre_hosteria||'Hostería'}" <${cfg.smtp_from||'noreply@resend.dev'}>`, to: cfg.smtp_from||'noreply@resend.dev', subject: '✅ Test email', html: '<p>El email funciona correctamente.</p>' }),
    });
    if (!resp.ok) { const e = await resp.json(); return c.json({ error: e.message || 'Error de Resend' }, 400); }
    return c.json({ ok: true, mensaje: 'Email de prueba enviado correctamente.' });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

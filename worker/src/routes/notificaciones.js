import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';

export const notificaciones = new Hono();

notificaciones.get('/', authMiddleware, async c => {
  const { tenant_id } = c.get('user');
  const { todas } = c.req.query();
  const { results } = todas
    ? await c.env.DB.prepare('SELECT * FROM notificaciones WHERE tenant_id=? ORDER BY creado_en DESC LIMIT 100').bind(tenant_id).all()
    : await c.env.DB.prepare('SELECT * FROM notificaciones WHERE tenant_id=? AND leida=0 ORDER BY creado_en DESC').bind(tenant_id).all();
  return c.json(results);
});

notificaciones.patch('/leer-todas', authMiddleware, async c => {
  const { tenant_id } = c.get('user');
  await c.env.DB.prepare('UPDATE notificaciones SET leida=1 WHERE tenant_id=? AND leida=0').bind(tenant_id).run();
  return c.json({ ok: true });
});

notificaciones.patch('/:id/leer', authMiddleware, async c => {
  const { tenant_id } = c.get('user');
  const { meta } = await c.env.DB.prepare('UPDATE notificaciones SET leida=1 WHERE id=? AND tenant_id=?').bind(c.req.param('id'), tenant_id).run();
  if (meta.changes === 0) return c.json({ error: 'Notificación no encontrada' }, 404);
  return c.json({ ok: true });
});

notificaciones.post('/', authMiddleware, async c => {
  const { tenant_id } = c.get('user');
  const { tipo, titulo, mensaje, link, referencia_id, referencia_tipo } = await c.req.json();
  if (!tipo || !titulo) return c.json({ error: 'tipo y titulo requeridos' }, 400);
  const { meta } = await c.env.DB.prepare('INSERT INTO notificaciones (tenant_id,tipo,titulo,mensaje,link,referencia_id,referencia_tipo) VALUES (?,?,?,?,?,?,?)').bind(tenant_id, tipo, titulo, mensaje||null, link||null, referencia_id||null, referencia_tipo||null).run();
  return c.json({ id: meta.last_row_id }, 201);
});

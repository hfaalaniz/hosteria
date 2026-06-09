import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';

export const notificaciones = new Hono();

notificaciones.get('/', authMiddleware, async c => {
  const { todas } = c.req.query();
  const { results } = todas
    ? await c.env.DB.prepare('SELECT * FROM notificaciones ORDER BY creado_en DESC LIMIT 100').all()
    : await c.env.DB.prepare('SELECT * FROM notificaciones WHERE leida=0 ORDER BY creado_en DESC').all();
  return c.json(results);
});

notificaciones.patch('/leer-todas', authMiddleware, async c => {
  await c.env.DB.prepare('UPDATE notificaciones SET leida=1 WHERE leida=0').run();
  return c.json({ ok: true });
});

notificaciones.patch('/:id/leer', authMiddleware, async c => {
  const { meta } = await c.env.DB.prepare('UPDATE notificaciones SET leida=1 WHERE id=?').bind(c.req.param('id')).run();
  if (meta.changes === 0) return c.json({ error: 'Notificación no encontrada' }, 404);
  return c.json({ ok: true });
});

notificaciones.post('/', authMiddleware, async c => {
  const { tipo, titulo, mensaje, link, referencia_id, referencia_tipo } = await c.req.json();
  if (!tipo || !titulo) return c.json({ error: 'tipo y titulo requeridos' }, 400);
  const { meta } = await c.env.DB.prepare('INSERT INTO notificaciones (tipo,titulo,mensaje,link,referencia_id,referencia_tipo) VALUES (?,?,?,?,?,?)').bind(tipo, titulo, mensaje||null, link||null, referencia_id||null, referencia_tipo||null).run();
  return c.json({ id: meta.last_row_id }, 201);
});

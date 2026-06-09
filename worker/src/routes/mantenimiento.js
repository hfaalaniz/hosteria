import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';

export const mantenimiento = new Hono();

mantenimiento.get('/', authMiddleware, async c => {
  const { tenant_id } = c.get('user');
  const { estado, habitacion_id } = c.req.query();
  let q = `SELECT m.*,hab.numero as habitacion_numero FROM mantenimiento m JOIN habitaciones hab ON m.habitacion_id=hab.id WHERE m.tenant_id=?`;
  const params = [tenant_id];
  if (estado) { q += ' AND m.estado=?'; params.push(estado); }
  if (habitacion_id) { q += ' AND m.habitacion_id=?'; params.push(habitacion_id); }
  q += " ORDER BY CASE m.prioridad WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END, m.creado_en DESC";
  const { results } = await c.env.DB.prepare(q).bind(...params).all();
  return c.json(results);
});

mantenimiento.post('/', authMiddleware, async c => {
  const user = c.get('user');
  const { tenant_id } = user;
  const { habitacion_id, descripcion, prioridad } = await c.req.json();
  if (!habitacion_id || !descripcion) return c.json({ error: 'Habitación y descripción son requeridas' }, 400);

  const stmts = [
    c.env.DB.prepare('INSERT INTO mantenimiento (tenant_id,habitacion_id,descripcion,prioridad,reportado_por) VALUES (?,?,?,?,?)').bind(tenant_id, habitacion_id, descripcion, prioridad||'media', user.id),
    c.env.DB.prepare("UPDATE habitaciones SET estado='mantenimiento' WHERE id=? AND tenant_id=?").bind(habitacion_id, tenant_id),
  ];
  const [result] = await c.env.DB.batch(stmts);

  if ((prioridad||'media') === 'alta') {
    const hab = await c.env.DB.prepare('SELECT numero FROM habitaciones WHERE id=? AND tenant_id=?').bind(habitacion_id, tenant_id).first();
    await c.env.DB.prepare('INSERT INTO notificaciones (tenant_id,tipo,titulo,mensaje,link,referencia_id,referencia_tipo) VALUES (?,?,?,?,?,?,?)').bind(tenant_id, 'mantenimiento_urgente', `Mantenimiento urgente — Hab. ${hab?.numero||habitacion_id}`, descripcion, '/mantenimiento', result.meta.last_row_id, 'mantenimiento').run();
  }
  return c.json({ id: result.meta.last_row_id, mensaje: 'Reporte creado' }, 201);
});

mantenimiento.patch('/:id/resolver', authMiddleware, async c => {
  const { tenant_id } = c.get('user');
  const m = await c.env.DB.prepare('SELECT * FROM mantenimiento WHERE id=? AND tenant_id=?').bind(c.req.param('id'), tenant_id).first();
  if (!m) return c.json({ error: 'Reporte no encontrado' }, 404);
  await c.env.DB.prepare("UPDATE mantenimiento SET estado='resuelto',resuelto_en=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?").bind(c.req.param('id'), tenant_id).run();
  const otroPendiente = await c.env.DB.prepare("SELECT id FROM mantenimiento WHERE habitacion_id=? AND tenant_id=? AND estado!='resuelto' AND id!=?").bind(m.habitacion_id, tenant_id, c.req.param('id')).first();
  if (!otroPendiente) await c.env.DB.prepare("UPDATE habitaciones SET estado='disponible' WHERE id=? AND tenant_id=? AND estado='mantenimiento'").bind(m.habitacion_id, tenant_id).run();
  return c.json({ mensaje: 'Reporte resuelto' });
});

mantenimiento.delete('/:id', authMiddleware, async c => {
  const { tenant_id } = c.get('user');
  await c.env.DB.prepare('DELETE FROM mantenimiento WHERE id=? AND tenant_id=?').bind(c.req.param('id'), tenant_id).run();
  return c.json({ mensaje: 'Reporte eliminado' });
});

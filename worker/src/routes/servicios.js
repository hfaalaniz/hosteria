import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';

export const servicios = new Hono();

servicios.get('/', authMiddleware, async c => {
  const { tenant_id } = c.get('user');
  const { results } = await c.env.DB.prepare('SELECT * FROM servicios WHERE tenant_id=? AND activo=1 ORDER BY categoria,nombre').bind(tenant_id).all();
  return c.json(results);
});

servicios.post('/', authMiddleware, async c => {
  const { tenant_id } = c.get('user');
  const { nombre, descripcion, precio, categoria } = await c.req.json();
  if (!nombre || !precio) return c.json({ error: 'Nombre y precio son requeridos' }, 400);
  const { meta } = await c.env.DB.prepare('INSERT INTO servicios (tenant_id,nombre,descripcion,precio,categoria) VALUES (?,?,?,?,?)')
    .bind(tenant_id, nombre, descripcion||null, precio, categoria||'otro').run();
  return c.json({ id: meta.last_row_id, mensaje: 'Servicio creado' }, 201);
});

servicios.put('/:id', authMiddleware, async c => {
  const { tenant_id } = c.get('user');
  const { nombre, descripcion, precio, categoria, activo } = await c.req.json();
  await c.env.DB.prepare('UPDATE servicios SET nombre=?,descripcion=?,precio=?,categoria=?,activo=? WHERE id=? AND tenant_id=?')
    .bind(nombre, descripcion||null, precio, categoria||'otro', activo??1, c.req.param('id'), tenant_id).run();
  return c.json({ mensaje: 'Servicio actualizado' });
});

servicios.delete('/:id', authMiddleware, async c => {
  const { tenant_id } = c.get('user');
  await c.env.DB.prepare('UPDATE servicios SET activo=0 WHERE id=? AND tenant_id=?').bind(c.req.param('id'), tenant_id).run();
  return c.json({ mensaje: 'Servicio desactivado' });
});

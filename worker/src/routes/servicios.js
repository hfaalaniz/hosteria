import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';

export const servicios = new Hono();

servicios.get('/', authMiddleware, async c => {
  const { results } = await c.env.DB.prepare('SELECT * FROM servicios WHERE activo=1 ORDER BY categoria, nombre').all();
  return c.json(results);
});

servicios.get('/publicos', async c => {
  const { results } = await c.env.DB.prepare('SELECT id,nombre,descripcion,precio,categoria FROM servicios WHERE activo=1 ORDER BY categoria,nombre').all();
  return c.json(results);
});

servicios.post('/', authMiddleware, async c => {
  const { nombre, descripcion, precio, categoria } = await c.req.json();
  if (!nombre || !precio) return c.json({ error: 'Nombre y precio son requeridos' }, 400);
  const { meta } = await c.env.DB.prepare('INSERT INTO servicios (nombre,descripcion,precio,categoria) VALUES (?,?,?,?)').bind(nombre, descripcion||null, precio, categoria||'otro').run();
  return c.json({ id: meta.last_row_id, mensaje: 'Servicio creado' }, 201);
});

servicios.put('/:id', authMiddleware, async c => {
  const { nombre, descripcion, precio, categoria, activo } = await c.req.json();
  await c.env.DB.prepare('UPDATE servicios SET nombre=?,descripcion=?,precio=?,categoria=?,activo=? WHERE id=?').bind(nombre, descripcion||null, precio, categoria||'otro', activo??1, c.req.param('id')).run();
  return c.json({ mensaje: 'Servicio actualizado' });
});

servicios.delete('/:id', authMiddleware, async c => {
  await c.env.DB.prepare('UPDATE servicios SET activo=0 WHERE id=?').bind(c.req.param('id')).run();
  return c.json({ mensaje: 'Servicio desactivado' });
});

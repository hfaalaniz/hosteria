import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';

export const tiposHabitacion = new Hono();

function parseTipo(t) {
  return { ...t, amenidades: JSON.parse(t.amenidades || '[]'), camas: JSON.parse(t.camas || '[]') };
}

tiposHabitacion.get('/', authMiddleware, async c => {
  const { tenant_id } = c.get('user');
  const { results } = await c.env.DB.prepare('SELECT * FROM tipos_habitacion WHERE tenant_id=? AND activo=1 ORDER BY nombre').bind(tenant_id).all();
  return c.json(results.map(parseTipo));
});

tiposHabitacion.get('/imagenes', authMiddleware, async c => {
  try {
    const list = await c.env.R2.list({ prefix: '' });
    const imgs = (list.objects || []).filter(o => /\.(png|jpg|jpeg|webp|gif)$/i.test(o.key)).map(o => ({ nombre: o.key, url: `/imgs/${o.key}` }));
    return c.json(imgs);
  } catch { return c.json([]); }
});

tiposHabitacion.post('/upload-imagen', authMiddleware, async c => {
  const formData = await c.req.formData();
  const file = formData.get('imagen');
  if (!file) return c.json({ error: 'No se recibió imagen' }, 400);
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['jpg','jpeg','png','webp','gif'].includes(ext)) return c.json({ error: 'Solo imágenes JPG/PNG/WEBP/GIF' }, 400);
  if (file.size > 5 * 1024 * 1024) return c.json({ error: 'Imagen demasiado grande (máx 5MB)' }, 400);
  const key = `tipo_${Date.now()}.${ext}`;
  await c.env.R2.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
  return c.json({ url: `/imgs/${key}` });
});

tiposHabitacion.get('/:id', authMiddleware, async c => {
  const { tenant_id } = c.get('user');
  const t = await c.env.DB.prepare('SELECT * FROM tipos_habitacion WHERE id=? AND tenant_id=?').bind(c.req.param('id'), tenant_id).first();
  if (!t) return c.json({ error: 'Tipo no encontrado' }, 404);
  return c.json(parseTipo(t));
});

tiposHabitacion.post('/', authMiddleware, async c => {
  const { tenant_id } = c.get('user');
  const { nombre, descripcion, capacidad, precio_base, precio_fin_semana, imagen, amenidades, camas } = await c.req.json();
  if (!nombre || !precio_base) return c.json({ error: 'Nombre y precio son requeridos' }, 400);
  const { meta } = await c.env.DB.prepare('INSERT INTO tipos_habitacion (tenant_id,nombre,descripcion,capacidad,precio_base,precio_fin_semana,imagen,amenidades,camas) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(tenant_id, nombre, descripcion||null, capacidad||2, precio_base, precio_fin_semana||null, imagen||null, JSON.stringify(amenidades||[]), JSON.stringify(camas||[])).run();
  return c.json({ id: meta.last_row_id, mensaje: 'Tipo creado' }, 201);
});

tiposHabitacion.put('/:id', authMiddleware, async c => {
  const { tenant_id } = c.get('user');
  const { nombre, descripcion, capacidad, precio_base, precio_fin_semana, imagen, amenidades, camas, activo } = await c.req.json();
  await c.env.DB.prepare('UPDATE tipos_habitacion SET nombre=?,descripcion=?,capacidad=?,precio_base=?,precio_fin_semana=?,imagen=?,amenidades=?,camas=?,activo=? WHERE id=? AND tenant_id=?')
    .bind(nombre, descripcion||null, capacidad||2, precio_base, precio_fin_semana||null, imagen||null, JSON.stringify(amenidades||[]), JSON.stringify(camas||[]), activo??1, c.req.param('id'), tenant_id).run();
  return c.json({ mensaje: 'Tipo actualizado' });
});

tiposHabitacion.delete('/:id', authMiddleware, async c => {
  const { tenant_id } = c.get('user');
  await c.env.DB.prepare('UPDATE tipos_habitacion SET activo=0 WHERE id=? AND tenant_id=?').bind(c.req.param('id'), tenant_id).run();
  return c.json({ mensaje: 'Tipo desactivado' });
});

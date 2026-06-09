import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';

export const huespedes = new Hono();

huespedes.get('/', authMiddleware, async c => {
  const { buscar } = c.req.query();
  let where = '1=1';
  const params = [];
  if (buscar) {
    where += ' AND (h.nombre LIKE ? OR h.apellido LIKE ? OR h.email LIKE ? OR h.documento_numero LIKE ? OR h.telefono LIKE ?)';
    const s = `%${buscar}%`;
    params.push(s, s, s, s, s);
  }
  const { results } = await c.env.DB.prepare(`
    SELECT h.*, COUNT(r.id) as total_reservas, MAX(r.fecha_entrada) as ultima_visita,
      COALESCE(SUM(CASE WHEN r.estado NOT IN ('cancelada','noshow') THEN r.precio_total ELSE 0 END),0) as total_gastado,
      SUM(CASE WHEN r.estado='checkin' THEN 1 ELSE 0 END) as actualmente_alojado
    FROM huespedes h LEFT JOIN reservas r ON r.huesped_id=h.id
    WHERE ${where} GROUP BY h.id ORDER BY h.apellido, h.nombre`).bind(...params).all();
  return c.json(results);
});

huespedes.get('/:id', authMiddleware, async c => {
  const h = await c.env.DB.prepare('SELECT * FROM huespedes WHERE id=?').bind(c.req.param('id')).first();
  if (!h) return c.json({ error: 'Huésped no encontrado' }, 404);
  const { results: reservas } = await c.env.DB.prepare(`
    SELECT r.*, hab.numero as habitacion_numero, t.nombre as tipo_nombre
    FROM reservas r JOIN habitaciones hab ON r.habitacion_id=hab.id JOIN tipos_habitacion t ON hab.tipo_id=t.id
    WHERE r.huesped_id=? ORDER BY r.fecha_entrada DESC`).bind(c.req.param('id')).all();
  return c.json({ ...h, reservas });
});

huespedes.post('/', authMiddleware, async c => {
  const { nombre, apellido, email, telefono, nacionalidad, documento_tipo, documento_numero, direccion, notas } = await c.req.json();
  if (!nombre || !apellido) return c.json({ error: 'Nombre y apellido son requeridos' }, 400);
  const { meta } = await c.env.DB.prepare('INSERT INTO huespedes (nombre,apellido,email,telefono,nacionalidad,documento_tipo,documento_numero,direccion,notas) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(nombre, apellido, email||null, telefono||null, nacionalidad||null, documento_tipo||'DNI', documento_numero||null, direccion||null, notas||null).run();
  return c.json({ id: meta.last_row_id, mensaje: 'Huésped registrado' }, 201);
});

huespedes.put('/:id', authMiddleware, async c => {
  const { nombre, apellido, email, telefono, nacionalidad, documento_tipo, documento_numero, direccion, notas } = await c.req.json();
  await c.env.DB.prepare('UPDATE huespedes SET nombre=?,apellido=?,email=?,telefono=?,nacionalidad=?,documento_tipo=?,documento_numero=?,direccion=?,notas=? WHERE id=?')
    .bind(nombre, apellido, email||null, telefono||null, nacionalidad||null, documento_tipo||'DNI', documento_numero||null, direccion||null, notas||null, c.req.param('id')).run();
  return c.json({ mensaje: 'Huésped actualizado' });
});

huespedes.delete('/:id', authMiddleware, async c => {
  const activo = await c.env.DB.prepare("SELECT id FROM reservas WHERE huesped_id=? AND estado IN ('checkin','confirmada','pendiente')").bind(c.req.param('id')).first();
  if (activo) return c.json({ error: 'No se puede eliminar un huésped con reservas activas' }, 400);
  await c.env.DB.prepare('DELETE FROM huespedes WHERE id=?').bind(c.req.param('id')).run();
  return c.json({ mensaje: 'Huésped eliminado' });
});

// Subir foto de documento → R2
huespedes.post('/:id/foto-documento', authMiddleware, async c => {
  const formData = await c.req.formData();
  const file = formData.get('foto');
  if (!file) return c.json({ error: 'No se recibió archivo' }, 400);
  if (file.size > 8 * 1024 * 1024) return c.json({ error: 'Imagen demasiado grande (máx 8MB)' }, 400);

  const ext = file.name.split('.').pop().toLowerCase();
  if (!['jpg','jpeg','png','webp'].includes(ext)) return c.json({ error: 'Solo JPG/PNG/WEBP' }, 400);

  const key = `docs/doc_${c.req.param('id')}_${Date.now()}.${ext}`;
  await c.env.R2.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
  const url = `/imgs/${key}`;
  await c.env.DB.prepare('UPDATE huespedes SET foto_documento=? WHERE id=?').bind(url, c.req.param('id')).run();
  return c.json({ url });
});

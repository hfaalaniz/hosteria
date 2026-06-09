import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';

export const habitaciones = new Hono();

function parseH(h) {
  return { ...h, amenidades: JSON.parse(h.amenidades || '[]'), camas: JSON.parse(h.camas || '[]'), precio_efectivo: h.precio_override ?? h.precio_base };
}

habitaciones.get('/', authMiddleware, async c => {
  const { estado, tipo_id } = c.req.query();
  const hoy = new Date().toISOString().split('T')[0];
  let query = `SELECT h.*, t.nombre as tipo_nombre, t.precio_base, t.precio_fin_semana, t.capacidad, t.amenidades,
    CASE WHEN h.estado IN ('mantenimiento','limpieza') THEN h.estado
         WHEN h.estado = 'ocupada' THEN 'ocupada'
         WHEN EXISTS (SELECT 1 FROM reservas r WHERE r.habitacion_id=h.id AND r.estado NOT IN ('cancelada','checkout','noshow') AND r.fecha_entrada<=? AND r.fecha_salida>?) THEN 'ocupada'
         ELSE 'disponible' END as estado_real
    FROM habitaciones h JOIN tipos_habitacion t ON h.tipo_id=t.id WHERE 1=1`;
  const params = [hoy, hoy];
  if (estado === 'disponible') {
    query += ` AND h.estado NOT IN ('mantenimiento','limpieza','ocupada') AND NOT EXISTS (SELECT 1 FROM reservas r WHERE r.habitacion_id=h.id AND r.estado NOT IN ('cancelada','checkout','noshow') AND r.fecha_entrada<=? AND r.fecha_salida>?)`;
    params.push(hoy, hoy);
  } else if (estado) { query += ' AND h.estado=?'; params.push(estado); }
  if (tipo_id) { query += ' AND h.tipo_id=?'; params.push(tipo_id); }
  query += ' ORDER BY h.piso, h.numero';
  const stmt = c.env.DB.prepare(query);
  const { results } = await stmt.bind(...params).all();
  return c.json(results.map(h => ({ ...parseH(h), estado: h.estado_real ?? h.estado })));
});

habitaciones.get('/disponibles', authMiddleware, async c => {
  const { fecha_entrada, fecha_salida, adultos } = c.req.query();
  if (!fecha_entrada || !fecha_salida) return c.json({ error: 'Fechas requeridas' }, 400);
  const { results } = await c.env.DB.prepare(`
    SELECT h.*, t.nombre as tipo_nombre, t.precio_base, t.precio_fin_semana, t.capacidad, t.amenidades
    FROM habitaciones h JOIN tipos_habitacion t ON h.tipo_id=t.id
    WHERE h.estado NOT IN ('mantenimiento','limpieza')
      AND (? IS NULL OR t.capacidad >= ?)
      AND NOT EXISTS (SELECT 1 FROM reservas r WHERE r.habitacion_id=h.id AND r.estado NOT IN ('cancelada','checkout','noshow') AND r.fecha_entrada<? AND r.fecha_salida>?)
    ORDER BY h.piso, h.numero`).bind(adultos || null, adultos || null, fecha_salida, fecha_entrada).all();
  return c.json(results.map(h => ({ ...parseH(h), estado: 'disponible' })));
});

habitaciones.get('/disponibilidad/check', authMiddleware, async c => {
  const { habitacion_id, fecha_entrada, fecha_salida, excluir_id } = c.req.query();
  let q = `SELECT id FROM reservas WHERE habitacion_id=? AND estado NOT IN ('cancelada','checkout','noshow') AND fecha_entrada<? AND fecha_salida>?`;
  const params = [habitacion_id, fecha_salida, fecha_entrada];
  if (excluir_id) { q += ' AND id != ?'; params.push(excluir_id); }
  const conflicto = await c.env.DB.prepare(q).bind(...params).first();
  return c.json({ disponible: !conflicto });
});

habitaciones.get('/tipos/all', authMiddleware, async c => {
  const { results } = await c.env.DB.prepare('SELECT * FROM tipos_habitacion WHERE activo=1 ORDER BY nombre').all();
  return c.json(results.map(t => ({ ...t, amenidades: JSON.parse(t.amenidades || '[]') })));
});

habitaciones.get('/:id', authMiddleware, async c => {
  const h = await c.env.DB.prepare(`SELECT h.*, t.nombre as tipo_nombre, t.precio_base, t.precio_fin_semana, t.capacidad, t.amenidades FROM habitaciones h JOIN tipos_habitacion t ON h.tipo_id=t.id WHERE h.id=?`).bind(c.req.param('id')).first();
  if (!h) return c.json({ error: 'Habitación no encontrada' }, 404);
  return c.json(parseH(h));
});

habitaciones.post('/', authMiddleware, async c => {
  const { numero, piso, tipo_id, notas, camas, precio_override, descripcion, metros_cuadrados, vista, bano_privado } = await c.req.json();
  if (!numero || !tipo_id) return c.json({ error: 'Número y tipo son requeridos' }, 400);
  try {
    const { meta } = await c.env.DB.prepare('INSERT INTO habitaciones (numero,piso,tipo_id,notas,camas,precio_override,descripcion,metros_cuadrados,vista,bano_privado) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .bind(numero, piso||1, tipo_id, notas||null, JSON.stringify(camas||[]), precio_override||null, descripcion||null, metros_cuadrados||null, vista||null, bano_privado??1).run();
    return c.json({ id: meta.last_row_id, mensaje: 'Habitación creada' }, 201);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return c.json({ error: 'El número de habitación ya existe' }, 400);
    return c.json({ error: e.message }, 500);
  }
});

habitaciones.put('/:id', authMiddleware, async c => {
  const { numero, piso, tipo_id, estado, notas, camas, precio_override, descripcion, metros_cuadrados, vista, bano_privado } = await c.req.json();
  const h = await c.env.DB.prepare('SELECT id FROM habitaciones WHERE id=?').bind(c.req.param('id')).first();
  if (!h) return c.json({ error: 'Habitación no encontrada' }, 404);
  await c.env.DB.prepare('UPDATE habitaciones SET numero=?,piso=?,tipo_id=?,estado=?,notas=?,camas=?,precio_override=?,descripcion=?,metros_cuadrados=?,vista=?,bano_privado=? WHERE id=?')
    .bind(numero,piso,tipo_id,estado,notas,JSON.stringify(camas||[]),precio_override||null,descripcion||null,metros_cuadrados||null,vista||null,bano_privado??1,c.req.param('id')).run();
  return c.json({ mensaje: 'Habitación actualizada' });
});

habitaciones.patch('/:id/estado', authMiddleware, async c => {
  const { estado } = await c.req.json();
  const estados = ['disponible','ocupada','limpieza','mantenimiento'];
  if (!estados.includes(estado)) return c.json({ error: 'Estado inválido' }, 400);
  await c.env.DB.prepare('UPDATE habitaciones SET estado=? WHERE id=?').bind(estado, c.req.param('id')).run();
  return c.json({ mensaje: 'Estado actualizado' });
});

habitaciones.delete('/:id', authMiddleware, async c => {
  const ocupada = await c.env.DB.prepare("SELECT id FROM reservas WHERE habitacion_id=? AND estado IN ('checkin','confirmada')").bind(c.req.param('id')).first();
  if (ocupada) return c.json({ error: 'No se puede eliminar una habitación con reservas activas' }, 400);
  await c.env.DB.prepare('DELETE FROM habitaciones WHERE id=?').bind(c.req.param('id')).run();
  return c.json({ mensaje: 'Habitación eliminada' });
});

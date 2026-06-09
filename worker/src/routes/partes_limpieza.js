import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';

export const partesLimpieza = new Hono();

function parseParte(p) {
  if (!p) return p;
  return { ...p, tareas_realizadas: JSON.parse(p.tareas_realizadas || '[]'), insumos_usados: JSON.parse(p.insumos_usados || '[]'), insumos_faltantes: JSON.parse(p.insumos_faltantes || '[]') };
}

partesLimpieza.get('/', authMiddleware, async c => {
  const { habitacion_id, fecha_desde, fecha_hasta, usuario_id } = c.req.query();
  let q = `SELECT pl.*,hab.numero as habitacion_numero,hab.piso,u.nombre as usuario_nombre FROM partes_limpieza pl JOIN habitaciones hab ON pl.habitacion_id=hab.id JOIN usuarios u ON pl.usuario_id=u.id WHERE 1=1`;
  const params = [];
  if (habitacion_id) { q += ' AND pl.habitacion_id=?'; params.push(habitacion_id); }
  if (fecha_desde) { q += ' AND pl.fecha>=?'; params.push(fecha_desde); }
  if (fecha_hasta) { q += ' AND pl.fecha<=?'; params.push(fecha_hasta); }
  if (usuario_id) { q += ' AND pl.usuario_id=?'; params.push(usuario_id); }
  q += ' ORDER BY pl.creado_en DESC';
  const { results } = await c.env.DB.prepare(q).bind(...params).all();
  return c.json(results.map(parseParte));
});

partesLimpieza.get('/:id', authMiddleware, async c => {
  const p = await c.env.DB.prepare(`SELECT pl.*,hab.numero as habitacion_numero,hab.piso,u.nombre as usuario_nombre FROM partes_limpieza pl JOIN habitaciones hab ON pl.habitacion_id=hab.id JOIN usuarios u ON pl.usuario_id=u.id WHERE pl.id=?`).bind(c.req.param('id')).first();
  if (!p) return c.json({ error: 'Parte no encontrado' }, 404);
  return c.json(parseParte(p));
});

partesLimpieza.post('/', authMiddleware, async c => {
  const user = c.get('user');
  const { habitacion_id, fecha, turno, estado_habitacion, tareas_realizadas, hallazgos, objetos_encontrados, insumos_usados, insumos_faltantes, ropa_cama, toallas, amenities, minibar, observaciones, tiempo_minutos } = await c.req.json();
  if (!habitacion_id) return c.json({ error: 'Habitación requerida' }, 400);

  const { meta } = await c.env.DB.prepare(`INSERT INTO partes_limpieza (habitacion_id,usuario_id,fecha,turno,estado_habitacion,tareas_realizadas,hallazgos,objetos_encontrados,insumos_usados,insumos_faltantes,ropa_cama,toallas,amenities,minibar,observaciones,tiempo_minutos) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(habitacion_id, user.id, fecha || new Date().toISOString().split('T')[0], turno || 'manana', estado_habitacion || 'limpia', JSON.stringify(tareas_realizadas || []), hallazgos || null, objetos_encontrados || null, JSON.stringify(insumos_usados || []), JSON.stringify(insumos_faltantes || []), ropa_cama || 'ok', toallas || 'ok', amenities || 'ok', minibar || 'no_aplica', observaciones || null, tiempo_minutos || null).run();

  const parteId = meta.last_row_id;
  const notifStmts = [];
  const hab = await c.env.DB.prepare('SELECT numero FROM habitaciones WHERE id=?').bind(habitacion_id).first();

  if ((estado_habitacion || 'limpia') === 'limpia') await c.env.DB.prepare(`UPDATE habitaciones SET estado='disponible' WHERE id=? AND estado='limpieza'`).bind(habitacion_id).run();

  if (objetos_encontrados) notifStmts.push(c.env.DB.prepare('INSERT INTO notificaciones (tipo,titulo,mensaje,link,referencia_id,referencia_tipo) VALUES (?,?,?,?,?,?)').bind('otro', `Objetos encontrados — Hab. ${hab?.numero || habitacion_id}`, objetos_encontrados, '/partes-limpieza', parteId, 'partes_limpieza'));
  if (estado_habitacion === 'danio') notifStmts.push(c.env.DB.prepare('INSERT INTO notificaciones (tipo,titulo,mensaje,link,referencia_id,referencia_tipo) VALUES (?,?,?,?,?,?)').bind('mantenimiento_urgente', `Daño reportado en limpieza — Hab. ${hab?.numero || habitacion_id}`, hallazgos || 'Se reportó un daño durante el parte de limpieza.', '/partes-limpieza', parteId, 'partes_limpieza'));
  if (notifStmts.length) await c.env.DB.batch(notifStmts);

  return c.json({ id: parteId, mensaje: 'Parte de limpieza registrado' }, 201);
});

partesLimpieza.put('/:id', authMiddleware, async c => {
  const { turno, estado_habitacion, tareas_realizadas, hallazgos, objetos_encontrados, insumos_usados, insumos_faltantes, ropa_cama, toallas, amenities, minibar, observaciones, tiempo_minutos } = await c.req.json();
  await c.env.DB.prepare(`UPDATE partes_limpieza SET turno=?,estado_habitacion=?,tareas_realizadas=?,hallazgos=?,objetos_encontrados=?,insumos_usados=?,insumos_faltantes=?,ropa_cama=?,toallas=?,amenities=?,minibar=?,observaciones=?,tiempo_minutos=? WHERE id=?`)
    .bind(turno, estado_habitacion, JSON.stringify(tareas_realizadas || []), hallazgos, objetos_encontrados, JSON.stringify(insumos_usados || []), JSON.stringify(insumos_faltantes || []), ropa_cama, toallas, amenities, minibar, observaciones, tiempo_minutos, c.req.param('id')).run();
  return c.json({ mensaje: 'Parte actualizado' });
});

partesLimpieza.delete('/:id', authMiddleware, async c => {
  await c.env.DB.prepare('DELETE FROM partes_limpieza WHERE id=?').bind(c.req.param('id')).run();
  return c.json({ mensaje: 'Parte eliminado' });
});

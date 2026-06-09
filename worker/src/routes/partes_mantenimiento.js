import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';

export const partesMantenimiento = new Hono();

function parseParte(p) {
  if (!p) return p;
  return { ...p, materiales_usados: JSON.parse(p.materiales_usados || '[]'), materiales_necesarios: JSON.parse(p.materiales_necesarios || '[]') };
}

partesMantenimiento.get('/', authMiddleware, async c => {
  const { tenant_id } = c.get('user');
  const { habitacion_id, estado, tipo, fecha_desde, fecha_hasta } = c.req.query();
  let q = `SELECT pm.*,hab.numero as habitacion_numero,hab.piso,u.nombre as usuario_nombre FROM partes_mantenimiento pm JOIN habitaciones hab ON pm.habitacion_id=hab.id JOIN usuarios u ON pm.usuario_id=u.id WHERE pm.tenant_id=?`;
  const params = [tenant_id];
  if (habitacion_id) { q += ' AND pm.habitacion_id=?'; params.push(habitacion_id); }
  if (estado) { q += ' AND pm.estado=?'; params.push(estado); }
  if (tipo) { q += ' AND pm.tipo=?'; params.push(tipo); }
  if (fecha_desde) { q += ' AND pm.fecha>=?'; params.push(fecha_desde); }
  if (fecha_hasta) { q += ' AND pm.fecha<=?'; params.push(fecha_hasta); }
  q += ` ORDER BY CASE pm.prioridad WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END,pm.creado_en DESC`;
  const { results } = await c.env.DB.prepare(q).bind(...params).all();
  return c.json(results.map(parseParte));
});

partesMantenimiento.get('/:id', authMiddleware, async c => {
  const { tenant_id } = c.get('user');
  const p = await c.env.DB.prepare(`SELECT pm.*,hab.numero as habitacion_numero,hab.piso,u.nombre as usuario_nombre FROM partes_mantenimiento pm JOIN habitaciones hab ON pm.habitacion_id=hab.id JOIN usuarios u ON pm.usuario_id=u.id WHERE pm.id=? AND pm.tenant_id=?`).bind(c.req.param('id'), tenant_id).first();
  if (!p) return c.json({ error: 'Parte no encontrado' }, 404);
  return c.json(parseParte(p));
});

partesMantenimiento.post('/', authMiddleware, async c => {
  const user = c.get('user');
  const { tenant_id } = user;
  const { habitacion_id, fecha, tipo, prioridad, descripcion, diagnostico, trabajo_realizado, estado, materiales_usados, materiales_necesarios, requiere_externo, proveedor_externo, costo_estimado, costo_real, tiempo_minutos, observaciones, proxima_revision } = await c.req.json();
  if (!habitacion_id || !descripcion) return c.json({ error: 'Habitación y descripción son requeridas' }, 400);

  const { meta } = await c.env.DB.prepare(`INSERT INTO partes_mantenimiento (tenant_id,habitacion_id,usuario_id,fecha,tipo,prioridad,descripcion,diagnostico,trabajo_realizado,estado,materiales_usados,materiales_necesarios,requiere_externo,proveedor_externo,costo_estimado,costo_real,tiempo_minutos,observaciones,proxima_revision) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(tenant_id, habitacion_id, user.id, fecha || new Date().toISOString().split('T')[0], tipo || 'correctivo', prioridad || 'media', descripcion, diagnostico || null, trabajo_realizado || null, estado || 'pendiente', JSON.stringify(materiales_usados || []), JSON.stringify(materiales_necesarios || []), requiere_externo ? 1 : 0, proveedor_externo || null, costo_estimado || null, costo_real || null, tiempo_minutos || null, observaciones || null, proxima_revision || null).run();

  const parteId = meta.last_row_id;

  if (['alta', 'urgente'].includes(prioridad) || tipo === 'urgente') {
    const hab = await c.env.DB.prepare('SELECT numero FROM habitaciones WHERE id=? AND tenant_id=?').bind(habitacion_id, tenant_id).first();
    await c.env.DB.batch([
      c.env.DB.prepare("UPDATE habitaciones SET estado='mantenimiento' WHERE id=? AND tenant_id=?").bind(habitacion_id, tenant_id),
      c.env.DB.prepare('INSERT INTO notificaciones (tenant_id,tipo,titulo,mensaje,link,referencia_id,referencia_tipo) VALUES (?,?,?,?,?,?,?)').bind(tenant_id, 'mantenimiento_urgente', `Parte mantenimiento urgente — Hab. ${hab?.numero || habitacion_id}`, descripcion, '/partes-mantenimiento', parteId, 'partes_mantenimiento'),
    ]);
  }

  return c.json({ id: parteId, mensaje: 'Parte de mantenimiento registrado' }, 201);
});

partesMantenimiento.put('/:id', authMiddleware, async c => {
  const { tenant_id } = c.get('user');
  const id = c.req.param('id');
  const { tipo, prioridad, descripcion, diagnostico, trabajo_realizado, estado, materiales_usados, materiales_necesarios, requiere_externo, proveedor_externo, costo_estimado, costo_real, tiempo_minutos, observaciones, proxima_revision } = await c.req.json();

  const existente = await c.env.DB.prepare('SELECT resuelto_en,habitacion_id FROM partes_mantenimiento WHERE id=? AND tenant_id=?').bind(id, tenant_id).first();
  if (!existente) return c.json({ error: 'Parte no encontrado' }, 404);
  const resuelto_en = estado === 'resuelto' ? (existente?.resuelto_en || new Date().toISOString()) : null;

  await c.env.DB.prepare(`UPDATE partes_mantenimiento SET tipo=?,prioridad=?,descripcion=?,diagnostico=?,trabajo_realizado=?,estado=?,materiales_usados=?,materiales_necesarios=?,requiere_externo=?,proveedor_externo=?,costo_estimado=?,costo_real=?,tiempo_minutos=?,observaciones=?,proxima_revision=?,resuelto_en=? WHERE id=? AND tenant_id=?`)
    .bind(tipo, prioridad, descripcion, diagnostico, trabajo_realizado, estado, JSON.stringify(materiales_usados || []), JSON.stringify(materiales_necesarios || []), requiere_externo ? 1 : 0, proveedor_externo, costo_estimado, costo_real, tiempo_minutos, observaciones, proxima_revision, resuelto_en, id, tenant_id).run();

  if (existente.habitacion_id) {
    if (estado === 'resuelto') {
      const otroPendiente = await c.env.DB.prepare(`SELECT id FROM partes_mantenimiento WHERE habitacion_id=? AND tenant_id=? AND estado NOT IN ('resuelto','derivado') AND id!=?`).bind(existente.habitacion_id, tenant_id, id).first();
      if (!otroPendiente) await c.env.DB.prepare(`UPDATE habitaciones SET estado='disponible' WHERE id=? AND tenant_id=? AND estado='mantenimiento'`).bind(existente.habitacion_id, tenant_id).run();
    } else if (estado === 'en_proceso' && prioridad === 'alta') {
      await c.env.DB.prepare(`UPDATE habitaciones SET estado='mantenimiento' WHERE id=? AND tenant_id=?`).bind(existente.habitacion_id, tenant_id).run();
    }
  }

  return c.json({ mensaje: 'Parte actualizado' });
});

partesMantenimiento.delete('/:id', authMiddleware, async c => {
  const { tenant_id } = c.get('user');
  await c.env.DB.prepare('DELETE FROM partes_mantenimiento WHERE id=? AND tenant_id=?').bind(c.req.param('id'), tenant_id).run();
  return c.json({ mensaje: 'Parte eliminado' });
});

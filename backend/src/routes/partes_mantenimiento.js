const express = require('express');
const { db } = require('../db/database');
const { auth } = require('../middleware/auth');
const { crearNotificacion } = require('../utils/notificaciones');

const router = express.Router();

function parseParte(p) {
  if (!p) return p;
  return {
    ...p,
    materiales_usados:    JSON.parse(p.materiales_usados    || '[]'),
    materiales_necesarios: JSON.parse(p.materiales_necesarios || '[]'),
  };
}

// GET /
router.get('/', auth, (req, res) => {
  const { habitacion_id, estado, tipo, fecha_desde, fecha_hasta } = req.query;
  let q = `
    SELECT pm.*, hab.numero as habitacion_numero, hab.piso,
           u.nombre as usuario_nombre
    FROM partes_mantenimiento pm
    JOIN habitaciones hab ON pm.habitacion_id = hab.id
    JOIN usuarios u ON pm.usuario_id = u.id
    WHERE 1=1
  `;
  const params = [];
  if (habitacion_id) { q += ' AND pm.habitacion_id = ?'; params.push(habitacion_id); }
  if (estado)        { q += ' AND pm.estado = ?';        params.push(estado); }
  if (tipo)          { q += ' AND pm.tipo = ?';          params.push(tipo); }
  if (fecha_desde)   { q += ' AND pm.fecha >= ?';        params.push(fecha_desde); }
  if (fecha_hasta)   { q += ' AND pm.fecha <= ?';        params.push(fecha_hasta); }
  q += ` ORDER BY
    CASE pm.prioridad WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END,
    pm.creado_en DESC`;
  res.json(db.prepare(q).all(...params).map(parseParte));
});

// GET /:id
router.get('/:id', auth, (req, res) => {
  const p = db.prepare(`
    SELECT pm.*, hab.numero as habitacion_numero, hab.piso,
           u.nombre as usuario_nombre
    FROM partes_mantenimiento pm
    JOIN habitaciones hab ON pm.habitacion_id = hab.id
    JOIN usuarios u ON pm.usuario_id = u.id
    WHERE pm.id = ?
  `).get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Parte no encontrado' });
  res.json(parseParte(p));
});

// POST /
router.post('/', auth, (req, res) => {
  const {
    habitacion_id, fecha, tipo, prioridad, descripcion, diagnostico,
    trabajo_realizado, estado,
    materiales_usados, materiales_necesarios,
    requiere_externo, proveedor_externo,
    costo_estimado, costo_real, tiempo_minutos,
    observaciones, proxima_revision,
  } = req.body;

  if (!habitacion_id || !descripcion)
    return res.status(400).json({ error: 'Habitación y descripción son requeridas' });

  const result = db.prepare(`
    INSERT INTO partes_mantenimiento (
      habitacion_id, usuario_id, fecha, tipo, prioridad, descripcion,
      diagnostico, trabajo_realizado, estado,
      materiales_usados, materiales_necesarios,
      requiere_externo, proveedor_externo,
      costo_estimado, costo_real, tiempo_minutos,
      observaciones, proxima_revision
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    habitacion_id, req.user.id,
    fecha || new Date().toISOString().split('T')[0],
    tipo || 'correctivo',
    prioridad || 'media',
    descripcion,
    diagnostico || null,
    trabajo_realizado || null,
    estado || 'pendiente',
    JSON.stringify(materiales_usados || []),
    JSON.stringify(materiales_necesarios || []),
    requiere_externo ? 1 : 0,
    proveedor_externo || null,
    costo_estimado || null,
    costo_real || null,
    tiempo_minutos || null,
    observaciones || null,
    proxima_revision || null,
  );

  // Si es urgente o alta prioridad, marcar habitación en mantenimiento
  if (['alta', 'urgente'].includes(prioridad) || tipo === 'urgente') {
    db.prepare("UPDATE habitaciones SET estado = 'mantenimiento' WHERE id = ?").run(habitacion_id);
  }

  // Notificación si alta prioridad o tipo urgente
  if (['alta', 'urgente'].includes(prioridad || 'media') || tipo === 'urgente') {
    const hab = db.prepare('SELECT numero FROM habitaciones WHERE id = ?').get(habitacion_id);
    crearNotificacion(
      'mantenimiento_urgente',
      `Parte mantenimiento urgente — Hab. ${hab?.numero || habitacion_id}`,
      descripcion,
      '/partes-mantenimiento',
      result.lastInsertRowid,
      'partes_mantenimiento'
    );
  }

  res.status(201).json({ id: result.lastInsertRowid, mensaje: 'Parte de mantenimiento registrado' });
});

// PUT /:id
router.put('/:id', auth, (req, res) => {
  const {
    tipo, prioridad, descripcion, diagnostico, trabajo_realizado, estado,
    materiales_usados, materiales_necesarios,
    requiere_externo, proveedor_externo,
    costo_estimado, costo_real, tiempo_minutos,
    observaciones, proxima_revision,
  } = req.body;

  const resuelto_en = estado === 'resuelto'
    ? db.prepare('SELECT resuelto_en FROM partes_mantenimiento WHERE id = ?').get(req.params.id)?.resuelto_en || new Date().toISOString()
    : null;

  db.prepare(`
    UPDATE partes_mantenimiento SET
      tipo=?, prioridad=?, descripcion=?, diagnostico=?,
      trabajo_realizado=?, estado=?,
      materiales_usados=?, materiales_necesarios=?,
      requiere_externo=?, proveedor_externo=?,
      costo_estimado=?, costo_real=?, tiempo_minutos=?,
      observaciones=?, proxima_revision=?, resuelto_en=?
    WHERE id=?
  `).run(
    tipo, prioridad, descripcion, diagnostico,
    trabajo_realizado, estado,
    JSON.stringify(materiales_usados || []),
    JSON.stringify(materiales_necesarios || []),
    requiere_externo ? 1 : 0, proveedor_externo,
    costo_estimado, costo_real, tiempo_minutos,
    observaciones, proxima_revision, resuelto_en,
    req.params.id,
  );

  // Sincronizar estado habitación
  const parte = db.prepare('SELECT habitacion_id FROM partes_mantenimiento WHERE id = ?').get(req.params.id);
  if (parte) {
    if (estado === 'resuelto') {
      const otroPendiente = db.prepare(`
        SELECT id FROM partes_mantenimiento
        WHERE habitacion_id = ? AND estado NOT IN ('resuelto','derivado') AND id != ?
      `).get(parte.habitacion_id, req.params.id);
      if (!otroPendiente) {
        db.prepare("UPDATE habitaciones SET estado = 'disponible' WHERE id = ? AND estado = 'mantenimiento'").run(parte.habitacion_id);
      }
    } else if (estado === 'en_proceso' && prioridad === 'alta') {
      db.prepare("UPDATE habitaciones SET estado = 'mantenimiento' WHERE id = ?").run(parte.habitacion_id);
    }
  }

  res.json({ mensaje: 'Parte actualizado' });
});

// DELETE /:id
router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM partes_mantenimiento WHERE id = ?').run(req.params.id);
  res.json({ mensaje: 'Parte eliminado' });
});

module.exports = router;

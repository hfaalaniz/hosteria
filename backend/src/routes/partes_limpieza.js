const express = require('express');
const { db } = require('../db/database');
const { auth } = require('../middleware/auth');
const { crearNotificacion } = require('../utils/notificaciones');

const router = express.Router();

function parseParte(p) {
  if (!p) return p;
  return {
    ...p,
    tareas_realizadas: JSON.parse(p.tareas_realizadas || '[]'),
    insumos_usados:    JSON.parse(p.insumos_usados    || '[]'),
    insumos_faltantes: JSON.parse(p.insumos_faltantes || '[]'),
  };
}

// GET / — lista partes, filtros: habitacion_id, fecha_desde, fecha_hasta, usuario_id
router.get('/', auth, (req, res) => {
  const { habitacion_id, fecha_desde, fecha_hasta, usuario_id } = req.query;
  let q = `
    SELECT pl.*, hab.numero as habitacion_numero, hab.piso,
           u.nombre as usuario_nombre
    FROM partes_limpieza pl
    JOIN habitaciones hab ON pl.habitacion_id = hab.id
    JOIN usuarios u ON pl.usuario_id = u.id
    WHERE 1=1
  `;
  const params = [];
  if (habitacion_id) { q += ' AND pl.habitacion_id = ?'; params.push(habitacion_id); }
  if (fecha_desde)   { q += ' AND pl.fecha >= ?';        params.push(fecha_desde); }
  if (fecha_hasta)   { q += ' AND pl.fecha <= ?';        params.push(fecha_hasta); }
  if (usuario_id)    { q += ' AND pl.usuario_id = ?';    params.push(usuario_id); }
  q += ' ORDER BY pl.creado_en DESC';
  res.json(db.prepare(q).all(...params).map(parseParte));
});

// GET /:id
router.get('/:id', auth, (req, res) => {
  const p = db.prepare(`
    SELECT pl.*, hab.numero as habitacion_numero, hab.piso,
           u.nombre as usuario_nombre
    FROM partes_limpieza pl
    JOIN habitaciones hab ON pl.habitacion_id = hab.id
    JOIN usuarios u ON pl.usuario_id = u.id
    WHERE pl.id = ?
  `).get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Parte no encontrado' });
  res.json(parseParte(p));
});

// POST /
router.post('/', auth, (req, res) => {
  const {
    habitacion_id, fecha, turno, estado_habitacion,
    tareas_realizadas, hallazgos, objetos_encontrados,
    insumos_usados, insumos_faltantes,
    ropa_cama, toallas, amenities, minibar,
    observaciones, tiempo_minutos,
  } = req.body;

  if (!habitacion_id) return res.status(400).json({ error: 'Habitación requerida' });

  const result = db.prepare(`
    INSERT INTO partes_limpieza (
      habitacion_id, usuario_id, fecha, turno, estado_habitacion,
      tareas_realizadas, hallazgos, objetos_encontrados,
      insumos_usados, insumos_faltantes,
      ropa_cama, toallas, amenities, minibar,
      observaciones, tiempo_minutos
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    habitacion_id, req.user.id,
    fecha || new Date().toISOString().split('T')[0],
    turno || 'manana',
    estado_habitacion || 'limpia',
    JSON.stringify(tareas_realizadas || []),
    hallazgos || null,
    objetos_encontrados || null,
    JSON.stringify(insumos_usados || []),
    JSON.stringify(insumos_faltantes || []),
    ropa_cama || 'ok',
    toallas || 'ok',
    amenities || 'ok',
    minibar || 'no_aplica',
    observaciones || null,
    tiempo_minutos || null,
  );

  // Si la habitación estaba en limpieza y el estado es limpia, pasarla a disponible
  if (['limpia'].includes(estado_habitacion || 'limpia')) {
    db.prepare(`
      UPDATE habitaciones SET estado = 'disponible'
      WHERE id = ? AND estado = 'limpieza'
    `).run(habitacion_id);
  }

  // Notificación si hay objetos encontrados o daño en habitación
  const hab = db.prepare('SELECT numero FROM habitaciones WHERE id = ?').get(habitacion_id);
  if (objetos_encontrados) {
    crearNotificacion(
      'otro',
      `Objetos encontrados — Hab. ${hab?.numero || habitacion_id}`,
      objetos_encontrados,
      '/partes-limpieza',
      result.lastInsertRowid,
      'partes_limpieza'
    );
  }
  if (estado_habitacion === 'danio') {
    crearNotificacion(
      'mantenimiento_urgente',
      `Daño reportado en limpieza — Hab. ${hab?.numero || habitacion_id}`,
      hallazgos || 'Se reportó un daño durante el parte de limpieza.',
      '/partes-limpieza',
      result.lastInsertRowid,
      'partes_limpieza'
    );
  }

  res.status(201).json({ id: result.lastInsertRowid, mensaje: 'Parte de limpieza registrado' });
});

// PUT /:id
router.put('/:id', auth, (req, res) => {
  const {
    turno, estado_habitacion, tareas_realizadas, hallazgos,
    objetos_encontrados, insumos_usados, insumos_faltantes,
    ropa_cama, toallas, amenities, minibar, observaciones, tiempo_minutos,
  } = req.body;

  db.prepare(`
    UPDATE partes_limpieza SET
      turno=?, estado_habitacion=?, tareas_realizadas=?, hallazgos=?,
      objetos_encontrados=?, insumos_usados=?, insumos_faltantes=?,
      ropa_cama=?, toallas=?, amenities=?, minibar=?,
      observaciones=?, tiempo_minutos=?
    WHERE id=?
  `).run(
    turno, estado_habitacion,
    JSON.stringify(tareas_realizadas || []),
    hallazgos, objetos_encontrados,
    JSON.stringify(insumos_usados || []),
    JSON.stringify(insumos_faltantes || []),
    ropa_cama, toallas, amenities, minibar,
    observaciones, tiempo_minutos,
    req.params.id,
  );
  res.json({ mensaje: 'Parte actualizado' });
});

// DELETE /:id
router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM partes_limpieza WHERE id = ?').run(req.params.id);
  res.json({ mensaje: 'Parte eliminado' });
});

module.exports = router;

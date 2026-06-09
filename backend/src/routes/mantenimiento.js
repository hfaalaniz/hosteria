const express = require('express');
const { db } = require('../db/database');
const { auth } = require('../middleware/auth');
const { crearNotificacion } = require('../utils/notificaciones');

const router = express.Router();

router.get('/', auth, (req, res) => {
  const { estado, habitacion_id } = req.query;
  let query = `
    SELECT m.*, hab.numero as habitacion_numero
    FROM mantenimiento m JOIN habitaciones hab ON m.habitacion_id = hab.id
    WHERE 1=1
  `;
  const params = [];
  if (estado) { query += ' AND m.estado = ?'; params.push(estado); }
  if (habitacion_id) { query += ' AND m.habitacion_id = ?'; params.push(habitacion_id); }
  query += ' ORDER BY CASE m.prioridad WHEN \'alta\' THEN 1 WHEN \'media\' THEN 2 ELSE 3 END, m.creado_en DESC';
  res.json(db.prepare(query).all(...params));
});

router.post('/', auth, (req, res) => {
  const { habitacion_id, descripcion, prioridad } = req.body;
  if (!habitacion_id || !descripcion) return res.status(400).json({ error: 'Habitación y descripción son requeridas' });

  const result = db.prepare('INSERT INTO mantenimiento (habitacion_id, descripcion, prioridad, reportado_por) VALUES (?, ?, ?, ?)')
    .run(habitacion_id, descripcion, prioridad || 'media', req.user.id);

  // Marcar habitación en mantenimiento
  db.prepare("UPDATE habitaciones SET estado = 'mantenimiento' WHERE id = ?").run(habitacion_id);

  // Notificación si prioridad alta
  if ((prioridad || 'media') === 'alta') {
    const hab = db.prepare('SELECT numero FROM habitaciones WHERE id = ?').get(habitacion_id);
    crearNotificacion(
      'mantenimiento_urgente',
      `Mantenimiento urgente — Hab. ${hab?.numero || habitacion_id}`,
      descripcion,
      '/mantenimiento',
      result.lastInsertRowid,
      'mantenimiento'
    );
  }

  res.status(201).json({ id: result.lastInsertRowid, mensaje: 'Reporte creado' });
});

router.patch('/:id/resolver', auth, (req, res) => {
  const m = db.prepare('SELECT * FROM mantenimiento WHERE id = ?').get(req.params.id);
  if (!m) return res.status(404).json({ error: 'Reporte no encontrado' });

  db.prepare("UPDATE mantenimiento SET estado = 'resuelto', resuelto_en = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id);
  // Liberar habitación si no hay otros pendientes
  const otroPendiente = db.prepare("SELECT id FROM mantenimiento WHERE habitacion_id = ? AND estado != 'resuelto' AND id != ?").get(m.habitacion_id, m.id);
  if (!otroPendiente) {
    db.prepare("UPDATE habitaciones SET estado = 'disponible' WHERE id = ? AND estado = 'mantenimiento'").run(m.habitacion_id);
  }
  res.json({ mensaje: 'Reporte resuelto' });
});

router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM mantenimiento WHERE id = ?').run(req.params.id);
  res.json({ mensaje: 'Reporte eliminado' });
});

module.exports = router;

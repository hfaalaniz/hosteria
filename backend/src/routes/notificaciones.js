const express = require('express');
const { db } = require('../db/database');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/notificaciones — lista no leídas (o todas con ?todas=1)
router.get('/', auth, (req, res) => {
  const { todas } = req.query;
  const rows = todas
    ? db.prepare('SELECT * FROM notificaciones ORDER BY creado_en DESC LIMIT 100').all()
    : db.prepare('SELECT * FROM notificaciones WHERE leida = 0 ORDER BY creado_en DESC').all();
  res.json(rows);
});

// PATCH /api/notificaciones/:id/leer — marcar una como leída
router.patch('/:id/leer', auth, (req, res) => {
  const { id } = req.params;
  const r = db.prepare('UPDATE notificaciones SET leida = 1 WHERE id = ?').run(id);
  if (r.changes === 0) return res.status(404).json({ error: 'Notificación no encontrada' });
  res.json({ ok: true });
});

// PATCH /api/notificaciones/leer-todas — marcar todas como leídas
router.patch('/leer-todas', auth, (req, res) => {
  db.prepare('UPDATE notificaciones SET leida = 1 WHERE leida = 0').run();
  res.json({ ok: true });
});

// POST /api/notificaciones — crear manualmente (uso interno / admin)
router.post('/', auth, (req, res) => {
  const { tipo, titulo, mensaje, link, referencia_id, referencia_tipo } = req.body;
  if (!tipo || !titulo) return res.status(400).json({ error: 'tipo y titulo requeridos' });
  const r = db.prepare(`
    INSERT INTO notificaciones (tipo, titulo, mensaje, link, referencia_id, referencia_tipo)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(tipo, titulo, mensaje || null, link || null, referencia_id || null, referencia_tipo || null);
  res.status(201).json({ id: r.lastInsertRowid });
});

module.exports = router;

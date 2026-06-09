const express = require('express');
const { db } = require('../db/database');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, (req, res) => {
  const { categoria } = req.query;
  let query = 'SELECT * FROM servicios WHERE activo = 1';
  const params = [];
  if (categoria) { query += ' AND categoria = ?'; params.push(categoria); }
  query += ' ORDER BY categoria, nombre';
  res.json(db.prepare(query).all(...params));
});

// Ruta pública para la web de reservas
router.get('/publicos', (req, res) => {
  res.json(db.prepare('SELECT id, nombre, descripcion, precio, categoria FROM servicios WHERE activo = 1 ORDER BY categoria, nombre').all());
});

router.post('/', auth, (req, res) => {
  const { nombre, descripcion, precio, categoria } = req.body;
  if (!nombre || !precio) return res.status(400).json({ error: 'Nombre y precio son requeridos' });
  const result = db.prepare('INSERT INTO servicios (nombre, descripcion, precio, categoria) VALUES (?, ?, ?, ?)').run(nombre, descripcion, precio, categoria);
  res.status(201).json({ id: result.lastInsertRowid, mensaje: 'Servicio creado' });
});

router.put('/:id', auth, (req, res) => {
  const { nombre, descripcion, precio, categoria, activo } = req.body;
  db.prepare('UPDATE servicios SET nombre=?, descripcion=?, precio=?, categoria=?, activo=? WHERE id=?')
    .run(nombre, descripcion, precio, categoria, activo ?? 1, req.params.id);
  res.json({ mensaje: 'Servicio actualizado' });
});

router.delete('/:id', auth, (req, res) => {
  db.prepare('UPDATE servicios SET activo = 0 WHERE id = ?').run(req.params.id);
  res.json({ mensaje: 'Servicio desactivado' });
});

module.exports = router;

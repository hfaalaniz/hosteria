const express = require('express');
const { db } = require('../db/database');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/reserva/:reserva_id', auth, (req, res) => {
  const consumos = db.prepare(`
    SELECT c.*, s.nombre as servicio_nombre, s.categoria
    FROM consumos c LEFT JOIN servicios s ON c.servicio_id = s.id
    WHERE c.reserva_id = ? ORDER BY c.fecha DESC
  `).all(req.params.reserva_id);
  res.json(consumos);
});

router.post('/', auth, (req, res) => {
  const { reserva_id, servicio_id, descripcion, cantidad, precio_unitario } = req.body;
  if (!reserva_id || !descripcion || !precio_unitario) return res.status(400).json({ error: 'Datos incompletos' });

  const precioNum = Number(precio_unitario);
  const cantNum = Number(cantidad) || 1;
  if (!Number.isFinite(precioNum) || precioNum <= 0) return res.status(400).json({ error: 'El precio debe ser un número positivo' });
  if (!Number.isFinite(cantNum) || cantNum <= 0) return res.status(400).json({ error: 'La cantidad debe ser un número positivo' });

  const total = cantNum * precioNum;
  const result = db.prepare(`
    INSERT INTO consumos (reserva_id, servicio_id, descripcion, cantidad, precio_unitario, total)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(reserva_id, servicio_id || null, descripcion, cantNum, precioNum, total);

  res.status(201).json({ id: result.lastInsertRowid, mensaje: 'Consumo registrado' });
});

router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM consumos WHERE id = ?').run(req.params.id);
  res.json({ mensaje: 'Consumo eliminado' });
});

module.exports = router;

const express = require('express');
const { db } = require('../db/database');
const { auth } = require('../middleware/auth');

const router = express.Router();

function parseHabitacion(h) {
  return {
    ...h,
    amenidades: JSON.parse(h.amenidades || '[]'),
    camas: JSON.parse(h.camas || '[]'),
    // precio efectivo: precio_override de la habitación, o precio_base del tipo
    precio_efectivo: h.precio_override ?? h.precio_base,
    precio_fin_semana_efectivo: h.precio_override ? null : h.precio_fin_semana,
  };
}

// GET /api/habitaciones
router.get('/', auth, (req, res) => {
  const { estado, tipo_id } = req.query;
  const hoy = new Date().toISOString().split('T')[0];

  // estado_real: considera reservas activas hoy además del estado físico
  let query = `
    SELECT h.*, t.nombre as tipo_nombre, t.precio_base, t.precio_fin_semana, t.capacidad, t.amenidades,
      CASE
        WHEN h.estado IN ('mantenimiento','limpieza') THEN h.estado
        WHEN h.estado = 'ocupada' THEN 'ocupada'
        WHEN EXISTS (
          SELECT 1 FROM reservas r
          WHERE r.habitacion_id = h.id
            AND r.estado NOT IN ('cancelada','checkout','noshow')
            AND r.fecha_entrada <= ? AND r.fecha_salida > ?
        ) THEN 'ocupada'
        ELSE 'disponible'
      END as estado_real
    FROM habitaciones h
    JOIN tipos_habitacion t ON h.tipo_id = t.id
    WHERE 1=1
  `;
  const params = [hoy, hoy];

  // Si se filtra por estado=disponible, usar estado_real
  if (estado === 'disponible') {
    query += ` AND (
      h.estado NOT IN ('mantenimiento','limpieza','ocupada')
      AND NOT EXISTS (
        SELECT 1 FROM reservas r
        WHERE r.habitacion_id = h.id
          AND r.estado NOT IN ('cancelada','checkout','noshow')
          AND r.fecha_entrada <= ? AND r.fecha_salida > ?
      )
    )`;
    params.push(hoy, hoy);
  } else if (estado) {
    query += ' AND h.estado = ?';
    params.push(estado);
  }

  if (tipo_id) { query += ' AND h.tipo_id = ?'; params.push(tipo_id); }
  query += ' ORDER BY h.piso, h.numero';

  res.json(db.prepare(query).all(...params).map(h => ({
    ...parseHabitacion(h),
    estado: h.estado_real ?? h.estado,
  })));
});

// GET /api/habitaciones/disponibles?fecha_entrada=&fecha_salida=&adultos=
router.get('/disponibles', auth, (req, res) => {
  const { fecha_entrada, fecha_salida, adultos } = req.query;
  if (!fecha_entrada || !fecha_salida) return res.status(400).json({ error: 'Fechas requeridas' });

  const rows = db.prepare(`
    SELECT h.*, t.nombre as tipo_nombre, t.precio_base, t.precio_fin_semana, t.capacidad, t.amenidades
    FROM habitaciones h
    JOIN tipos_habitacion t ON h.tipo_id = t.id
    WHERE h.estado NOT IN ('mantenimiento','limpieza')
      AND (? IS NULL OR t.capacidad >= ?)
      AND NOT EXISTS (
        SELECT 1 FROM reservas r
        WHERE r.habitacion_id = h.id
          AND r.estado NOT IN ('cancelada','checkout','noshow')
          AND r.fecha_entrada < ? AND r.fecha_salida > ?
      )
    ORDER BY h.piso, h.numero
  `).all(adultos || null, adultos || null, fecha_salida, fecha_entrada);

  res.json(rows.map(h => ({ ...parseHabitacion(h), estado: 'disponible' })));
});

// GET /api/habitaciones/:id
router.get('/:id', auth, (req, res) => {
  const h = db.prepare(`
    SELECT h.*, t.nombre as tipo_nombre, t.precio_base, t.precio_fin_semana, t.capacidad, t.amenidades
    FROM habitaciones h JOIN tipos_habitacion t ON h.tipo_id = t.id
    WHERE h.id = ?
  `).get(req.params.id);
  if (!h) return res.status(404).json({ error: 'Habitación no encontrada' });
  res.json(parseHabitacion(h));
});

// POST /api/habitaciones
router.post('/', auth, (req, res) => {
  const { numero, piso, tipo_id, notas, camas, precio_override, descripcion, metros_cuadrados, vista, bano_privado } = req.body;
  if (!numero || !tipo_id) return res.status(400).json({ error: 'Número y tipo son requeridos' });

  try {
    const result = db.prepare(`
      INSERT INTO habitaciones (numero, piso, tipo_id, notas, camas, precio_override, descripcion, metros_cuadrados, vista, bano_privado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      numero, piso || 1, tipo_id,
      notas || null,
      JSON.stringify(camas || []),
      precio_override || null,
      descripcion || null,
      metros_cuadrados || null,
      vista || null,
      bano_privado ?? 1,
    );
    res.status(201).json({ id: result.lastInsertRowid, mensaje: 'Habitación creada' });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'El número de habitación ya existe' });
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/habitaciones/:id
router.put('/:id', auth, (req, res) => {
  const { numero, piso, tipo_id, estado, notas, camas, precio_override, descripcion, metros_cuadrados, vista, bano_privado } = req.body;
  const h = db.prepare('SELECT id FROM habitaciones WHERE id = ?').get(req.params.id);
  if (!h) return res.status(404).json({ error: 'Habitación no encontrada' });

  db.prepare(`
    UPDATE habitaciones
    SET numero=?, piso=?, tipo_id=?, estado=?, notas=?, camas=?,
        precio_override=?, descripcion=?, metros_cuadrados=?, vista=?, bano_privado=?
    WHERE id=?
  `).run(
    numero, piso, tipo_id, estado, notas,
    JSON.stringify(camas || []),
    precio_override || null,
    descripcion || null,
    metros_cuadrados || null,
    vista || null,
    bano_privado ?? 1,
    req.params.id,
  );
  res.json({ mensaje: 'Habitación actualizada' });
});

// PATCH /api/habitaciones/:id/estado
router.patch('/:id/estado', auth, (req, res) => {
  const { estado } = req.body;
  const estados = ['disponible', 'ocupada', 'limpieza', 'mantenimiento'];
  if (!estados.includes(estado)) return res.status(400).json({ error: 'Estado inválido' });
  db.prepare('UPDATE habitaciones SET estado = ? WHERE id = ?').run(estado, req.params.id);
  res.json({ mensaje: 'Estado actualizado' });
});

// DELETE /api/habitaciones/:id
router.delete('/:id', auth, (req, res) => {
  const ocupada = db.prepare("SELECT id FROM reservas WHERE habitacion_id = ? AND estado IN ('checkin','confirmada')").get(req.params.id);
  if (ocupada) return res.status(400).json({ error: 'No se puede eliminar una habitación con reservas activas' });
  db.prepare('DELETE FROM habitaciones WHERE id = ?').run(req.params.id);
  res.json({ mensaje: 'Habitación eliminada' });
});

// GET /api/habitaciones/tipos/all
router.get('/tipos/all', auth, (req, res) => {
  const tipos = db.prepare('SELECT * FROM tipos_habitacion WHERE activo = 1 ORDER BY nombre').all();
  res.json(tipos.map(t => ({ ...t, amenidades: JSON.parse(t.amenidades || '[]') })));
});

module.exports = router;

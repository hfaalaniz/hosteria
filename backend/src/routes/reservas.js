const express = require('express');
const { db } = require('../db/database');
const { auth } = require('../middleware/auth');
const { emailConfirmacionReserva, emailSeniaCobrada } = require('../services/email');
const { crearNotificacion } = require('../utils/notificaciones');

const router = express.Router();

function generarCodigo() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'RES-';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function calcularNoches(entrada, salida) {
  const d1 = new Date(entrada);
  const d2 = new Date(salida);
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

// GET /api/reservas
router.get('/', auth, (req, res) => {
  const { estado, fecha_inicio, fecha_fin, huesped_id, habitacion_id, busqueda } = req.query;
  let query = `
    SELECT r.*,
      h.nombre || ' ' || h.apellido as huesped_nombre, h.email as huesped_email, h.telefono as huesped_telefono,
      hab.numero as habitacion_numero, hab.piso as habitacion_piso, t.nombre as tipo_nombre
    FROM reservas r
    JOIN huespedes h ON r.huesped_id = h.id
    JOIN habitaciones hab ON r.habitacion_id = hab.id
    JOIN tipos_habitacion t ON hab.tipo_id = t.id
    WHERE 1=1
  `;
  const params = [];
  if (estado) { query += ' AND r.estado = ?'; params.push(estado); }
  if (fecha_inicio) { query += ' AND r.fecha_entrada >= ?'; params.push(fecha_inicio); }
  if (fecha_fin) { query += ' AND r.fecha_salida <= ?'; params.push(fecha_fin); }
  if (huesped_id) { query += ' AND r.huesped_id = ?'; params.push(huesped_id); }
  if (habitacion_id) { query += ' AND r.habitacion_id = ?'; params.push(habitacion_id); }
  if (busqueda) {
    query += ` AND (
      (h.nombre || ' ' || h.apellido) LIKE ?
      OR h.email LIKE ?
      OR r.codigo LIKE ?
      OR CAST(hab.numero AS TEXT) LIKE ?
    )`;
    const like = `%${busqueda}%`;
    params.push(like, like, like, like);
  }
  query += ' ORDER BY r.fecha_entrada DESC';

  res.json(db.prepare(query).all(...params));
});

// GET /api/reservas/calendario?fecha_inicio=YYYY-MM-DD&semanas=4
// IMPORTANTE: debe estar ANTES de /:id para que Express no lo capture como id='calendario'
router.get('/calendario', auth, (req, res) => {
  const hoy = new Date().toISOString().split('T')[0];
  const fecha_inicio = req.query.fecha_inicio || hoy;
  const semanas = Math.min(parseInt(req.query.semanas) || 4, 12);
  const dias = semanas * 7;
  const fecha_fin_dt = new Date(fecha_inicio);
  fecha_fin_dt.setDate(fecha_fin_dt.getDate() + dias);
  const fecha_fin = fecha_fin_dt.toISOString().split('T')[0];

  const habitaciones = db.prepare(`
    SELECT h.id, h.numero, h.piso, h.estado,
           t.nombre as tipo_nombre, t.capacidad
    FROM habitaciones h
    JOIN tipos_habitacion t ON h.tipo_id = t.id
    WHERE h.estado != 'mantenimiento'
    ORDER BY h.piso, h.numero
  `).all();

  const reservas = db.prepare(`
    SELECT r.id, r.codigo, r.habitacion_id, r.fecha_entrada, r.fecha_salida,
           r.estado, r.adultos, r.ninos, r.precio_total, r.origen, r.noches,
           hu.nombre || ' ' || hu.apellido as huesped_nombre,
           hu.email as huesped_email
    FROM reservas r
    JOIN huespedes hu ON r.huesped_id = hu.id
    WHERE r.estado NOT IN ('cancelada', 'noshow')
      AND r.fecha_entrada < ? AND r.fecha_salida > ?
    ORDER BY r.fecha_entrada
  `).all(fecha_fin, fecha_inicio);

  res.json({ habitaciones, reservas, fecha_inicio, fecha_fin, dias });
});

// GET /api/reservas/disponibilidad/check
// IMPORTANTE: debe estar ANTES de /:id
router.get('/disponibilidad/check', auth, (req, res) => {
  const { habitacion_id, fecha_entrada, fecha_salida, excluir_id } = req.query;
  let query = `
    SELECT id FROM reservas
    WHERE habitacion_id = ? AND estado NOT IN ('cancelada','checkout','noshow')
    AND fecha_entrada < ? AND fecha_salida > ?
  `;
  const params = [habitacion_id, fecha_salida, fecha_entrada];
  if (excluir_id) { query += ' AND id != ?'; params.push(excluir_id); }

  const conflicto = db.prepare(query).get(...params);
  res.json({ disponible: !conflicto });
});

// GET /api/reservas/alertas/noshow — reservas que deberían ser noshow (confirmada/pendiente con entrada pasada)
router.get('/alertas/noshow', auth, (req, res) => {
  const hoy = new Date().toISOString().split('T')[0];
  const reservas = db.prepare(`
    SELECT r.id, r.codigo, r.estado, r.fecha_entrada, r.fecha_salida, r.noches, r.precio_total,
           h.nombre || ' ' || h.apellido as huesped_nombre, h.email as huesped_email,
           hab.numero as habitacion_numero, t.nombre as tipo_nombre
    FROM reservas r
    JOIN huespedes h ON r.huesped_id = h.id
    JOIN habitaciones hab ON r.habitacion_id = hab.id
    JOIN tipos_habitacion t ON hab.tipo_id = t.id
    WHERE r.estado IN ('confirmada', 'pendiente')
      AND r.fecha_entrada < ?
    ORDER BY r.fecha_entrada ASC
  `).all(hoy);
  res.json(reservas);
});

// GET /api/reservas/:id
router.get('/:id', auth, (req, res) => {
  const r = db.prepare(`
    SELECT r.*,
      h.nombre || ' ' || h.apellido as huesped_nombre, h.email as huesped_email, h.telefono as huesped_telefono,
      h.documento_tipo, h.documento_numero, h.nacionalidad,
      hab.numero as habitacion_numero, t.nombre as tipo_nombre, t.capacidad
    FROM reservas r
    JOIN huespedes h ON r.huesped_id = h.id
    JOIN habitaciones hab ON r.habitacion_id = hab.id
    JOIN tipos_habitacion t ON hab.tipo_id = t.id
    WHERE r.id = ?
  `).get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Reserva no encontrada' });

  const consumos = db.prepare(`
    SELECT c.*, s.nombre as servicio_nombre, s.categoria
    FROM consumos c LEFT JOIN servicios s ON c.servicio_id = s.id
    WHERE c.reserva_id = ?
  `).all(req.params.id);

  res.json({ ...r, consumos });
});

// POST /api/reservas
router.post('/', auth, (req, res) => {
  try {
    let { huesped_id, huesped, habitacion_id, fecha_entrada, fecha_salida, adultos, ninos, origen, precio_noche, notas, acompanantes } = req.body;

    // Si viene objeto huesped (nuevo flujo), crear o reutilizar huésped existente
    if (!huesped_id && huesped) {
      const { nombre, apellido, email, telefono, nacionalidad, documento_tipo, documento_numero } = huesped;
      if (!nombre || !apellido) return res.status(400).json({ error: 'Nombre y apellido del huésped son requeridos' });
      let existente = null;
      if (email) existente = db.prepare('SELECT id FROM huespedes WHERE email = ?').get(email);
      if (!existente && documento_numero) existente = db.prepare('SELECT id FROM huespedes WHERE documento_numero = ?').get(documento_numero);
      if (existente) {
        huesped_id = existente.id;
      } else {
        const r = db.prepare(`
          INSERT INTO huespedes (nombre, apellido, email, telefono, nacionalidad, documento_tipo, documento_numero)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(nombre, apellido, email || null, telefono || null, nacionalidad || null, documento_tipo || 'DNI', documento_numero || null);
        huesped_id = r.lastInsertRowid;
      }
    }

    if (!huesped_id || !habitacion_id || !fecha_entrada || !fecha_salida) {
      return res.status(400).json({ error: 'Huésped, habitación y fechas son requeridos' });
    }

    const conflicto = db.prepare(`
      SELECT id FROM reservas
      WHERE habitacion_id = ? AND estado NOT IN ('cancelada','checkout','noshow')
      AND fecha_entrada < ? AND fecha_salida > ?
    `).get(habitacion_id, fecha_salida, fecha_entrada);
    if (conflicto) return res.status(400).json({ error: 'La habitación no está disponible en esas fechas' });

    const noches = calcularNoches(fecha_entrada, fecha_salida);
    if (noches <= 0) return res.status(400).json({ error: 'Las fechas son inválidas' });

    const precio_total = precio_noche * noches;
    let codigo = generarCodigo();
    while (db.prepare('SELECT id FROM reservas WHERE codigo = ?').get(codigo)) {
      codigo = generarCodigo();
    }

    // Crear reserva + acompañantes en una transacción
    const crearReserva = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO reservas (codigo, huesped_id, habitacion_id, fecha_entrada, fecha_salida, adultos, ninos, estado, origen, precio_total, precio_noche, noches, notas)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmada', ?, ?, ?, ?, ?)
      `).run(codigo, huesped_id, habitacion_id, fecha_entrada, fecha_salida,
             adultos || 1, ninos || 0, origen || 'directo', precio_total, precio_noche, noches, notas || null);

      const reservaId = result.lastInsertRowid;

      if (Array.isArray(acompanantes) && acompanantes.length > 0) {
        // Crear tabla si no existe (migración inline por si la DB es anterior)
        db.prepare(`
          CREATE TABLE IF NOT EXISTS reserva_acompanantes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reserva_id INTEGER NOT NULL REFERENCES reservas(id) ON DELETE CASCADE,
            tipo TEXT NOT NULL CHECK(tipo IN ('adulto','nino')),
            nombre TEXT NOT NULL,
            documento_tipo TEXT,
            documento_numero TEXT,
            edad INTEGER,
            created_at TEXT DEFAULT (datetime('now'))
          )
        `).run();
        const insertAcomp = db.prepare(`
          INSERT INTO reserva_acompanantes (reserva_id, tipo, nombre, documento_tipo, documento_numero, edad)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        for (const a of acompanantes) {
          if (a.nombre) insertAcomp.run(reservaId, a.tipo || 'adulto', a.nombre, a.documento_tipo || null, a.documento_numero || null, a.edad || null);
        }
      }

      return reservaId;
    });

    const reservaId = crearReserva();

    // Email de confirmación
    const reservaParaEmail = db.prepare(`
      SELECT r.codigo, r.estado, r.fecha_entrada, r.fecha_salida, r.noches, r.adultos, r.ninos, r.precio_total, r.senia,
             h.nombre || ' ' || h.apellido as huesped_nombre, h.email as huesped_email,
             hab.numero as habitacion_numero, t.nombre as tipo_nombre
      FROM reservas r
      JOIN huespedes h ON r.huesped_id = h.id
      JOIN habitaciones hab ON r.habitacion_id = hab.id
      JOIN tipos_habitacion t ON hab.tipo_id = t.id
      WHERE r.id = ?
    `).get(reservaId);
    if (reservaParaEmail?.huesped_email) {
      emailConfirmacionReserva(reservaParaEmail).catch(err => console.error('Email error:', err.message));
    }

    res.status(201).json({ id: reservaId, codigo, mensaje: 'Reserva creada' });
  } catch (err) {
    console.error('POST /reservas error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/reservas/:id
router.put('/:id', auth, (req, res) => {
  const { fecha_entrada, fecha_salida, adultos, ninos, origen, precio_noche, notas, notas_internas } = req.body;
  const reserva = db.prepare('SELECT * FROM reservas WHERE id = ?').get(req.params.id);
  if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });

  const noches = calcularNoches(fecha_entrada, fecha_salida);
  const precio_total = precio_noche * noches;

  db.prepare(`
    UPDATE reservas SET fecha_entrada=?, fecha_salida=?, adultos=?, ninos=?, origen=?, precio_noche=?, precio_total=?, noches=?, notas=?, notas_internas=?, actualizado_en=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(fecha_entrada, fecha_salida, adultos, ninos, origen, precio_noche, precio_total, noches, notas, notas_internas, req.params.id);

  res.json({ mensaje: 'Reserva actualizada' });
});

// PATCH /api/reservas/:id/notas — actualiza notas y notas_internas sin tocar el resto
router.patch('/:id/notas', auth, (req, res) => {
  const { notas, notas_internas } = req.body;
  db.prepare('UPDATE reservas SET notas=?, notas_internas=?, actualizado_en=CURRENT_TIMESTAMP WHERE id=?')
    .run(notas ?? null, notas_internas ?? null, req.params.id);
  res.json({ mensaje: 'Notas actualizadas' });
});

// PATCH /api/reservas/:id/senia — registrar cobro de seña
router.patch('/:id/senia', auth, async (req, res) => {
  const { metodo } = req.body; // efectivo | transferencia | tarjeta | otro
  const metodos = ['efectivo', 'transferencia', 'tarjeta', 'otro'];
  if (!metodos.includes(metodo)) return res.status(400).json({ error: 'Método inválido' });

  const reserva = db.prepare(`
    SELECT r.*, h.nombre || ' ' || h.apellido as huesped_nombre, h.email as huesped_email,
           hab.numero as habitacion_numero, t.nombre as tipo_nombre
    FROM reservas r
    JOIN huespedes h ON r.huesped_id = h.id
    JOIN habitaciones hab ON r.habitacion_id = hab.id
    JOIN tipos_habitacion t ON hab.tipo_id = t.id
    WHERE r.id = ?
  `).get(req.params.id);
  if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });
  if (!reserva.senia) return res.status(400).json({ error: 'Esta reserva no tiene seña registrada' });

  const fecha = new Date().toISOString().split('T')[0];
  db.prepare(`
    UPDATE reservas SET senia_cobrada = 1, senia_metodo = ?, senia_fecha = ?, actualizado_en = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(metodo, fecha, req.params.id);

  // Email al huésped
  if (reserva.huesped_email) {
    emailSeniaCobrada({ ...reserva, senia_metodo: metodo }).catch(err => console.error('Email error:', err.message));
  }

  res.json({ mensaje: 'Seña registrada como cobrada' });
});

// POST /api/reservas/:id/recordatorio — enviar email recordatorio manualmente
router.post('/:id/recordatorio', auth, async (req, res) => {
  const { emailRecordatorio } = require('../services/email');
  const reserva = db.prepare(`
    SELECT r.*, h.nombre || ' ' || h.apellido as huesped_nombre, h.email as huesped_email,
           hab.numero as habitacion_numero, t.nombre as tipo_nombre
    FROM reservas r
    JOIN huespedes h ON r.huesped_id = h.id
    JOIN habitaciones hab ON r.habitacion_id = hab.id
    JOIN tipos_habitacion t ON hab.tipo_id = t.id
    WHERE r.id = ?
  `).get(req.params.id);
  if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });
  if (!reserva.huesped_email) return res.status(400).json({ error: 'El huésped no tiene email registrado' });

  try {
    await emailRecordatorio(reserva);
    res.json({ mensaje: 'Recordatorio enviado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al enviar email: ' + err.message });
  }
});

// PATCH /api/reservas/:id/estado
router.patch('/:id/estado', auth, (req, res) => {
  const { estado } = req.body;
  const estados = ['pendiente', 'confirmada', 'checkin', 'checkout', 'cancelada', 'noshow'];
  if (!estados.includes(estado)) return res.status(400).json({ error: 'Estado inválido' });

  const reserva = db.prepare('SELECT * FROM reservas WHERE id = ?').get(req.params.id);
  if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });

  let penalidad = null;
  let diasAnticipacion = null;
  let seniaSeDev = null;

  if (estado === 'cancelada') {
    // Calcular días de anticipación desde HOY hasta fecha_entrada
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const entrada = new Date(reserva.fecha_entrada + 'T00:00:00');
    diasAnticipacion = Math.round((entrada - hoy) / 86400000);

    // Política: finde/feriado → 5 días; normal → 3 días para devolver seña
    // Sin info de feriado aquí, usamos 3 días como mínimo universal
    const diasMinimos = 3;
    penalidad = diasAnticipacion < diasMinimos ? 1 : 0;
    seniaSeDev = penalidad === 0; // true = se devuelve

    db.prepare(`
      UPDATE reservas SET estado = ?, cancelacion_penalidad = ?, cancelacion_dias_anticipacion = ?,
        actualizado_en = CURRENT_TIMESTAMP WHERE id = ?
    `).run(estado, penalidad, diasAnticipacion, req.params.id);
  } else {
    db.prepare('UPDATE reservas SET estado = ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?').run(estado, req.params.id);
  }

  if (estado === 'checkin') {
    db.prepare("UPDATE habitaciones SET estado = 'ocupada' WHERE id = ?").run(reserva.habitacion_id);
  } else if (estado === 'checkout') {
    db.prepare("UPDATE habitaciones SET estado = 'limpieza' WHERE id = ?").run(reserva.habitacion_id);
  } else if (estado === 'cancelada' || estado === 'noshow') {
    const hab = db.prepare("SELECT estado FROM habitaciones WHERE id = ?").get(reserva.habitacion_id);
    if (hab?.estado === 'ocupada') {
      db.prepare("UPDATE habitaciones SET estado = 'disponible' WHERE id = ?").run(reserva.habitacion_id);
    }
  }

  // Notificación no-show
  if (estado === 'noshow') {
    const info = db.prepare(`
      SELECT r.codigo, h.nombre || ' ' || h.apellido as huesped_nombre, hab.numero as habitacion_numero
      FROM reservas r
      JOIN huespedes h ON r.huesped_id = h.id
      JOIN habitaciones hab ON r.habitacion_id = hab.id
      WHERE r.id = ?
    `).get(req.params.id);
    if (info) {
      crearNotificacion(
        'noshow',
        `No-show — ${info.huesped_nombre}`,
        `Reserva ${info.codigo} · Hab. ${info.habitacion_numero}`,
        '/reservas',
        parseInt(req.params.id),
        'reservas'
      );
    }
  }

  const respuesta = { mensaje: 'Estado actualizado' };
  if (estado === 'cancelada') {
    respuesta.cancelacion = {
      dias_anticipacion: diasAnticipacion,
      penalidad: penalidad === 1,
      senia_se_devuelve: seniaSeDev,
      senia_monto: reserva.senia ?? null,
    };
  }
  res.json(respuesta);
});

// PATCH /api/reservas/:id/extender — extiende fecha de salida (solo en checkin)
router.patch('/:id/extender', auth, (req, res) => {
  const { nueva_fecha_salida } = req.body;
  if (!nueva_fecha_salida) return res.status(400).json({ error: 'nueva_fecha_salida requerida' });

  const reserva = db.prepare('SELECT * FROM reservas WHERE id = ?').get(req.params.id);
  if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });
  if (reserva.estado !== 'checkin') return res.status(400).json({ error: 'Solo se puede extender una reserva con checkin activo' });
  if (nueva_fecha_salida <= reserva.fecha_salida) return res.status(400).json({ error: 'La nueva fecha de salida debe ser posterior a la actual' });

  // Verificar que no haya conflicto para los días adicionales
  const conflicto = db.prepare(`
    SELECT id FROM reservas
    WHERE habitacion_id = ? AND id != ?
      AND estado NOT IN ('cancelada','checkout','noshow')
      AND fecha_entrada < ? AND fecha_salida > ?
  `).get(reserva.habitacion_id, reserva.id, nueva_fecha_salida, reserva.fecha_salida);
  if (conflicto) return res.status(400).json({ error: 'La habitación tiene otra reserva en las fechas adicionales' });

  const msPerDay = 86400000;
  const nuevasNoches = Math.round((new Date(nueva_fecha_salida) - new Date(reserva.fecha_entrada)) / msPerDay);
  const nuevoPrecioTotal = Math.round(reserva.precio_noche * nuevasNoches * 100) / 100;

  db.prepare(`
    UPDATE reservas SET fecha_salida = ?, noches = ?, precio_total = ?, actualizado_en = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(nueva_fecha_salida, nuevasNoches, nuevoPrecioTotal, req.params.id);

  res.json({ mensaje: 'Estadía extendida', noches: nuevasNoches, precio_total: nuevoPrecioTotal });
});

module.exports = router;

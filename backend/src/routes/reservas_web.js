const express = require('express');
const { db } = require('../db/database');
const { emailConfirmacionReserva } = require('../services/email');
const { crearNotificacion } = require('../utils/notificaciones');

const router = express.Router();

// GET /api/web/config — configuración pública (datos de pago, info general)
router.get('/config', (req, res) => {
  const claves = ['nombre_hosteria', 'direccion', 'telefono', 'email', 'hora_checkin', 'hora_checkout', 'pago_cbu', 'pago_alias', 'pago_titular', 'pago_banco', 'pago_instrucciones', 'descuentos_noches'];
  const rows = db.prepare(`SELECT clave, valor FROM configuracion WHERE clave IN (${claves.map(() => '?').join(',')})`).all(...claves);
  res.json(rows.reduce((acc, r) => ({ ...acc, [r.clave]: r.valor }), {}));
});

function parseHab(h) {
  const amenidades = JSON.parse(h.amenidades || '[]');
  const camas = JSON.parse(h.camas || '[]');
  const precio_noche = h.precio_override ?? h.precio_base;
  return { ...h, amenidades, camas, precio_noche };
}

// Catálogo completo de habitaciones (sin filtro de fechas, para el inicio)
router.get('/habitaciones', (req, res) => {
  const hoy = new Date().toISOString().split('T')[0];
  const rows = db.prepare(`
    SELECT h.id, h.numero, h.piso, h.descripcion, h.metros_cuadrados, h.vista,
           h.bano_privado, h.camas, h.precio_override, h.estado,
           t.id as tipo_id, t.nombre as tipo_nombre, t.descripcion as tipo_descripcion,
           t.capacidad, t.precio_base, t.precio_fin_semana, t.amenidades, t.imagen,
           CASE WHEN h.estado = 'mantenimiento' THEN 'mantenimiento'
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
    WHERE t.activo = 1
    ORDER BY h.piso, h.numero
  `).all(hoy, hoy);
  res.json(rows.map(h => ({ ...parseHab(h), estado: h.estado_real })));
});

// Disponibilidad por habitación individual para un rango de fechas
router.get('/disponibilidad', (req, res) => {
  const { fecha_entrada, fecha_salida, adultos } = req.query;
  if (!fecha_entrada || !fecha_salida) return res.status(400).json({ error: 'Fechas requeridas' });

  const noches = Math.round((new Date(fecha_salida) - new Date(fecha_entrada)) / (1000 * 60 * 60 * 24));
  if (noches <= 0) return res.status(400).json({ error: 'Fechas inválidas' });

  const esFinDeSemana = [5, 6].includes(new Date(fecha_entrada).getDay());

  const rows = db.prepare(`
    SELECT h.id, h.numero, h.piso, h.descripcion, h.metros_cuadrados, h.vista,
           h.bano_privado, h.camas, h.precio_override, h.estado,
           t.id as tipo_id, t.nombre as tipo_nombre, t.descripcion as tipo_descripcion,
           t.capacidad, t.precio_base, t.precio_fin_semana, t.amenidades, t.imagen
    FROM habitaciones h
    JOIN tipos_habitacion t ON h.tipo_id = t.id
    WHERE t.activo = 1 AND h.estado NOT IN ('mantenimiento', 'ocupada')
    AND h.id NOT IN (
      SELECT habitacion_id FROM reservas
      WHERE estado NOT IN ('cancelada','checkout','noshow')
      AND fecha_entrada < ? AND fecha_salida > ?
    )
    ORDER BY h.piso, h.numero
  `).all(fecha_salida, fecha_entrada);

  const resultado = rows
    .map(h => {
      const precio_base_efectivo = esFinDeSemana && h.precio_fin_semana ? h.precio_fin_semana : h.precio_base;
      const precio_noche = h.precio_override ?? precio_base_efectivo;
      return {
        ...parseHab(h),
        precio_noche,
        precio_total: precio_noche * noches,
        noches,
      };
    })
    .filter(h => !adultos || h.capacidad >= parseInt(adultos));

  res.json(resultado);
});

// Crear reserva web con habitacion_id directo
router.post('/reservar', (req, res) => {
  const { habitacion_id, fecha_entrada, fecha_salida, adultos, ninos, precio_noche, huesped, senia } = req.body;

  if (!habitacion_id || !fecha_entrada || !fecha_salida || !huesped?.nombre || !huesped?.apellido || !huesped?.email) {
    return res.status(400).json({ error: 'Datos incompletos' });
  }

  // Verificar que la habitación sigue disponible
  const conflicto = db.prepare(`
    SELECT id FROM reservas
    WHERE habitacion_id = ? AND estado NOT IN ('cancelada','checkout','noshow')
    AND fecha_entrada < ? AND fecha_salida > ?
  `).get(habitacion_id, fecha_salida, fecha_entrada);
  if (conflicto) return res.status(400).json({ error: 'La habitación ya no está disponible para esas fechas' });

  const noches = Math.round((new Date(fecha_salida) - new Date(fecha_entrada)) / (1000 * 60 * 60 * 24));
  const precio_total = precio_noche * noches;

  // Crear o reusar huésped por email
  let huespedId;
  const huespedExiste = db.prepare('SELECT id FROM huespedes WHERE email = ?').get(huesped.email);
  if (huespedExiste) {
    huespedId = huespedExiste.id;
  } else {
    const r = db.prepare(`
      INSERT INTO huespedes (nombre, apellido, email, telefono, nacionalidad, documento_tipo, documento_numero)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(huesped.nombre, huesped.apellido, huesped.email,
      huesped.telefono || null, huesped.nacionalidad || null,
      huesped.documento_tipo || null, huesped.documento_numero || null);
    huespedId = r.lastInsertRowid;
  }

  // Código único
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let codigo = 'WEB-';
  for (let i = 0; i < 6; i++) codigo += chars[Math.floor(Math.random() * chars.length)];
  while (db.prepare('SELECT id FROM reservas WHERE codigo = ?').get(codigo)) {
    codigo = 'WEB-';
    for (let i = 0; i < 6; i++) codigo += chars[Math.floor(Math.random() * chars.length)];
  }

  const seniaVal = senia != null ? Number(senia) : Math.round(precio_total * 0.10 * 100) / 100;

  const result = db.prepare(`
    INSERT INTO reservas (codigo, huesped_id, habitacion_id, fecha_entrada, fecha_salida, adultos, ninos, estado, origen, precio_total, precio_noche, noches, senia)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pendiente', 'web', ?, ?, ?, ?)
  `).run(codigo, huespedId, habitacion_id, fecha_entrada, fecha_salida,
    adultos || 1, ninos || 0, precio_total, precio_noche, noches, seniaVal);

  // Notificación interna para el personal
  const habInfo = db.prepare('SELECT numero FROM habitaciones WHERE id = ?').get(habitacion_id);
  crearNotificacion(
    'reserva_web',
    `Nueva reserva web — Hab. ${habInfo?.numero || habitacion_id}`,
    `${huesped.nombre} ${huesped.apellido} · ${fecha_entrada} → ${fecha_salida} · ${noches} noche(s) · $${precio_total}`,
    '/reservas',
    result.lastInsertRowid,
    'reservas'
  );

  // Email de confirmación — sin await para no bloquear la respuesta
  const reservaParaEmail = db.prepare(`
    SELECT r.codigo, r.estado, r.fecha_entrada, r.fecha_salida, r.noches, r.adultos, r.ninos, r.precio_total, r.senia,
           h.nombre || ' ' || h.apellido as huesped_nombre, h.email as huesped_email,
           hab.numero as habitacion_numero, t.nombre as tipo_nombre
    FROM reservas r
    JOIN huespedes h ON r.huesped_id = h.id
    JOIN habitaciones hab ON r.habitacion_id = hab.id
    JOIN tipos_habitacion t ON hab.tipo_id = t.id
    WHERE r.id = ?
  `).get(result.lastInsertRowid);
  if (reservaParaEmail?.huesped_email) {
    emailConfirmacionReserva(reservaParaEmail).catch(err => console.error('Email error:', err.message));
  }

  res.status(201).json({ codigo, id: result.lastInsertRowid, senia: seniaVal, mensaje: 'Reserva recibida.' });
});

// Días ocupados de una habitación (próximos 4 meses) — para el calendario web
router.get('/ocupacion/:hab_id', (req, res) => {
  const hoy = new Date().toISOString().split('T')[0];
  const finDt = new Date();
  finDt.setMonth(finDt.getMonth() + 4);
  const fin = finDt.toISOString().split('T')[0];

  const reservas = db.prepare(`
    SELECT fecha_entrada, fecha_salida
    FROM reservas
    WHERE habitacion_id = ?
      AND estado NOT IN ('cancelada','checkout','noshow')
      AND fecha_salida > ? AND fecha_entrada < ?
  `).all(req.params.hab_id, hoy, fin);

  // Expandir cada reserva en un array de días ocupados
  const diasOcupados = new Set();
  for (const r of reservas) {
    const d = new Date(r.fecha_entrada + 'T00:00:00');
    const end = new Date(r.fecha_salida + 'T00:00:00');
    while (d < end) {
      diasOcupados.add(d.toISOString().split('T')[0]);
      d.setDate(d.getDate() + 1);
    }
  }

  res.json({ hab_id: req.params.hab_id, dias_ocupados: [...diasOcupados] });
});

// Consultar estado de reserva por código
router.get('/estado/:codigo', (req, res) => {
  const r = db.prepare(`
    SELECT r.codigo, r.estado, r.fecha_entrada, r.fecha_salida, r.noches, r.adultos, r.ninos, r.precio_total,
      h.nombre || ' ' || h.apellido as huesped_nombre,
      hab.numero as habitacion_numero, t.nombre as tipo_nombre
    FROM reservas r
    JOIN huespedes h ON r.huesped_id = h.id
    JOIN habitaciones hab ON r.habitacion_id = hab.id
    JOIN tipos_habitacion t ON hab.tipo_id = t.id
    WHERE r.codigo = ?
  `).get(req.params.codigo);
  if (!r) return res.status(404).json({ error: 'Reserva no encontrada' });
  res.json(r);
});

module.exports = router;

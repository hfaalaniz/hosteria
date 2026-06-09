const express = require('express');
const { db } = require('../db/database');
const { auth } = require('../middleware/auth');
const { crearNotificacion } = require('../utils/notificaciones');

const router = express.Router();

// Genera notificaciones de checkout pendiente una sola vez por día
function generarNotificacionesCheckoutHoy(hoy) {
  // Verificar si ya se generaron hoy (buscamos cualquier checkout_pendiente creado hoy)
  const yaGenerado = db.prepare(`
    SELECT id FROM notificaciones
    WHERE tipo = 'checkout_pendiente' AND DATE(creado_en) = ?
    LIMIT 1
  `).get(hoy);
  if (yaGenerado) return;

  // Reservas en checkin cuya fecha de salida es hoy o anterior (checkout vencido)
  const pendientes = db.prepare(`
    SELECT r.id, r.codigo, r.fecha_salida,
           h.nombre || ' ' || h.apellido as huesped_nombre,
           hab.numero as habitacion_numero
    FROM reservas r
    JOIN huespedes h ON r.huesped_id = h.id
    JOIN habitaciones hab ON r.habitacion_id = hab.id
    WHERE r.estado = 'checkin' AND r.fecha_salida <= ?
  `).all(hoy);

  for (const r of pendientes) {
    crearNotificacion(
      'checkout_pendiente',
      `Checkout pendiente — Hab. ${r.habitacion_numero}`,
      `${r.huesped_nombre} · Salida: ${r.fecha_salida} · ${r.codigo}`,
      '/checkout',
      r.id,
      'reservas'
    );
  }
}

router.get('/stats', auth, (req, res) => {
  const hoy = new Date().toISOString().split('T')[0];

  // Generar notificaciones de checkout pendiente si corresponde
  generarNotificacionesCheckoutHoy(hoy);
  const ayer = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // Ocupación actual — combina estado físico + reservas activas hoy
  const totalHabitaciones = db.prepare("SELECT COUNT(*) as c FROM habitaciones WHERE estado != 'mantenimiento'").get().c;
  const mantenimiento = db.prepare("SELECT COUNT(*) as c FROM habitaciones WHERE estado = 'mantenimiento'").get().c;
  const limpieza = db.prepare("SELECT COUNT(*) as c FROM habitaciones WHERE estado = 'limpieza'").get().c;

  // Ocupadas: estado físico 'ocupada' O tiene reserva activa hoy (checkin/confirmada/pendiente)
  const ocupadas = db.prepare(`
    SELECT COUNT(DISTINCT h.id) as c FROM habitaciones h
    WHERE h.estado = 'ocupada'
    OR EXISTS (
      SELECT 1 FROM reservas r
      WHERE r.habitacion_id = h.id
        AND r.estado NOT IN ('cancelada','checkout','noshow')
        AND r.fecha_entrada <= ? AND r.fecha_salida > ?
    )
  `).get(hoy, hoy).c;

  const disponibles = totalHabitaciones - mantenimiento - limpieza - ocupadas < 0
    ? 0
    : totalHabitaciones - limpieza - ocupadas;

  // Check-ins y check-outs de hoy
  const checkinHoy = db.prepare("SELECT COUNT(*) as c FROM reservas WHERE fecha_entrada = ? AND estado IN ('confirmada','checkin')").get(hoy).c;
  const checkoutHoy = db.prepare("SELECT COUNT(*) as c FROM reservas WHERE estado = 'checkout' AND DATE(actualizado_en) = ?").get(hoy).c;

  // Reservas activas (en casa)
  const enCasa = db.prepare("SELECT COUNT(*) as c FROM reservas WHERE estado = 'checkin'").get().c;

  // Ingresos del mes
  const inicioMes = hoy.substring(0, 7) + '-01';
  const ingresosMes = db.prepare(`
    SELECT COALESCE(SUM(total), 0) as total FROM facturas
    WHERE estado = 'pagada' AND emitida_en >= ?
  `).get(inicioMes).total;

  // Ingresos del día de hoy
  const ingresosHoy = db.prepare(`
    SELECT COALESCE(SUM(total), 0) as total FROM facturas
    WHERE estado = 'pagada' AND DATE(emitida_en) = ?
  `).get(hoy).total;

  // Próximas llegadas (7 días)
  const proximasLlegadas = db.prepare(`
    SELECT r.*, h.nombre || ' ' || h.apellido as huesped_nombre, hab.numero as habitacion_numero
    FROM reservas r
    JOIN huespedes h ON r.huesped_id = h.id
    JOIN habitaciones hab ON r.habitacion_id = hab.id
    WHERE r.fecha_entrada BETWEEN ? AND DATE(?, '+7 days')
    AND r.estado IN ('pendiente','confirmada')
    ORDER BY r.fecha_entrada
    LIMIT 10
  `).all(hoy, hoy);

  // Próximas salidas (7 días)
  const proximasSalidas = db.prepare(`
    SELECT r.*, h.nombre || ' ' || h.apellido as huesped_nombre, hab.numero as habitacion_numero
    FROM reservas r
    JOIN huespedes h ON r.huesped_id = h.id
    JOIN habitaciones hab ON r.habitacion_id = hab.id
    WHERE r.fecha_salida BETWEEN ? AND DATE(?, '+7 days')
    AND r.estado = 'checkin'
    ORDER BY r.fecha_salida
    LIMIT 10
  `).all(hoy, hoy);

  // Ingresos últimos 30 días (por día)
  const ingresosUltimos30 = db.prepare(`
    SELECT DATE(emitida_en) as fecha, SUM(total) as total
    FROM facturas
    WHERE estado = 'pagada' AND emitida_en >= DATE(?, '-30 days')
    GROUP BY DATE(emitida_en)
    ORDER BY fecha
  `).all(hoy);

  // Ocupación por tipo de habitación
  const ocupacionPorTipo = db.prepare(`
    SELECT t.nombre, COUNT(h.id) as total,
      SUM(CASE WHEN h.estado = 'ocupada' THEN 1 ELSE 0 END) as ocupadas
    FROM tipos_habitacion t
    LEFT JOIN habitaciones h ON h.tipo_id = t.id
    WHERE t.activo = 1
    GROUP BY t.id, t.nombre
  `).all();

  // Mantenimiento pendiente
  const mantenimientoPendiente = db.prepare(`
    SELECT m.*, hab.numero as habitacion_numero
    FROM mantenimiento m
    JOIN habitaciones hab ON m.habitacion_id = hab.id
    WHERE m.estado != 'resuelto'
    ORDER BY CASE m.prioridad WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END
    LIMIT 5
  `).all();

  res.json({
    ocupacion: { total: totalHabitaciones, ocupadas, disponibles, limpieza, mantenimiento, porcentaje: Math.round((ocupadas / totalHabitaciones) * 100) || 0 },
    hoy: { checkins: checkinHoy, checkouts: checkoutHoy, enCasa, ingresos: ingresosHoy },
    mes: { ingresos: ingresosMes },
    proximasLlegadas,
    proximasSalidas,
    ingresosUltimos30,
    ocupacionPorTipo,
    mantenimientoPendiente,
  });
});

// Ingresos por mes (últimos 12 meses)
router.get('/ingresos-anuales', auth, (req, res) => {
  const hoy = new Date().toISOString().split('T')[0];
  const data = db.prepare(`
    SELECT strftime('%Y-%m', emitida_en) as mes, SUM(total) as total, COUNT(*) as facturas
    FROM facturas
    WHERE estado = 'pagada' AND emitida_en >= DATE(?, '-12 months')
    GROUP BY strftime('%Y-%m', emitida_en)
    ORDER BY mes
  `).all(hoy);
  res.json(data);
});

module.exports = router;

const express = require('express');
const { db } = require('../db/database');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/reportes/ocupacion?tipo=diario|semanal|quincenal|mensual|libre&fecha=YYYY-MM-DD&fecha_desde=&fecha_hasta=
router.get('/ocupacion', auth, (req, res) => {
  const { tipo = 'diario', fecha, fecha_desde, fecha_hasta } = req.query;

  const hoy = fecha || new Date().toISOString().split('T')[0];

  let desde, hasta;
  if (tipo === 'diario') {
    desde = hoy;
    hasta = hoy;
  } else if (tipo === 'semanal') {
    const d = new Date(hoy + 'T12:00:00');
    const dow = d.getDay();
    const diffLunes = (dow === 0 ? -6 : 1 - dow);
    const lunes = new Date(d); lunes.setDate(d.getDate() + diffLunes);
    const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
    desde = lunes.toISOString().split('T')[0];
    hasta = domingo.toISOString().split('T')[0];
  } else if (tipo === 'quincenal') {
    const d = new Date(hoy + 'T12:00:00');
    const dia = d.getDate();
    if (dia <= 15) {
      desde = hoy.substring(0, 8) + '01';
      hasta = hoy.substring(0, 8) + '15';
    } else {
      desde = hoy.substring(0, 8) + '16';
      const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      hasta = hoy.substring(0, 8) + String(ultimo).padStart(2, '0');
    }
  } else if (tipo === 'mensual') {
    const d = new Date(hoy + 'T12:00:00');
    desde = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    hasta = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`;
  } else if (tipo === 'libre') {
    if (!fecha_desde || !fecha_hasta) return res.status(400).json({ error: 'fecha_desde y fecha_hasta requeridas' });
    desde = fecha_desde;
    hasta = fecha_hasta;
  } else {
    return res.status(400).json({ error: 'tipo inválido' });
  }

  // Config del establecimiento
  const cfg = {};
  db.prepare('SELECT clave, valor FROM configuracion').all().forEach(r => { cfg[r.clave] = r.valor; });

  const totalHabs = db.prepare("SELECT COUNT(*) as c FROM habitaciones").get().c;

  // Reservas activas en el período (cualquier overlap con desde-hasta)
  const reservas = db.prepare(`
    SELECT r.*,
      h.nombre || ' ' || h.apellido as huesped_nombre,
      h.documento_tipo, h.documento_numero, h.nacionalidad,
      h.email as huesped_email, h.telefono as huesped_telefono,
      hab.numero as habitacion_numero,
      t.nombre as tipo_nombre, t.capacidad
    FROM reservas r
    JOIN huespedes h ON r.huesped_id = h.id
    JOIN habitaciones hab ON r.habitacion_id = hab.id
    JOIN tipos_habitacion t ON hab.tipo_id = t.id
    WHERE r.estado NOT IN ('cancelada','noshow')
      AND r.fecha_entrada <= ? AND r.fecha_salida > ?
    ORDER BY r.fecha_entrada
  `).all(hasta, desde);

  // Check-ins ocurridos en el período
  const checkins = db.prepare(`
    SELECT r.*,
      h.nombre || ' ' || h.apellido as huesped_nombre,
      h.documento_tipo, h.documento_numero, h.nacionalidad,
      hab.numero as habitacion_numero,
      t.nombre as tipo_nombre
    FROM reservas r
    JOIN huespedes h ON r.huesped_id = h.id
    JOIN habitaciones hab ON r.habitacion_id = hab.id
    JOIN tipos_habitacion t ON hab.tipo_id = t.id
    WHERE r.fecha_entrada BETWEEN ? AND ?
      AND r.estado NOT IN ('cancelada','noshow')
    ORDER BY r.fecha_entrada
  `).all(desde, hasta);

  // Check-outs ocurridos en el período
  const checkouts = db.prepare(`
    SELECT r.*,
      h.nombre || ' ' || h.apellido as huesped_nombre,
      h.documento_tipo, h.documento_numero, h.nacionalidad,
      hab.numero as habitacion_numero,
      t.nombre as tipo_nombre
    FROM reservas r
    JOIN huespedes h ON r.huesped_id = h.id
    JOIN habitaciones hab ON r.habitacion_id = hab.id
    JOIN tipos_habitacion t ON hab.tipo_id = t.id
    WHERE r.fecha_salida BETWEEN ? AND ?
      AND r.estado IN ('checkout','checkin')
    ORDER BY r.fecha_salida
  `).all(desde, hasta);

  // Cancelaciones en el período
  const cancelaciones = db.prepare(`
    SELECT r.*,
      h.nombre || ' ' || h.apellido as huesped_nombre,
      hab.numero as habitacion_numero
    FROM reservas r
    JOIN huespedes h ON r.huesped_id = h.id
    JOIN habitaciones hab ON r.habitacion_id = hab.id
    WHERE r.estado = 'cancelada'
      AND DATE(r.actualizado_en) BETWEEN ? AND ?
    ORDER BY r.actualizado_en
  `).all(desde, hasta);

  // Ingresos facturados en el período
  const ingresos = db.prepare(`
    SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as facturas
    FROM facturas
    WHERE estado = 'pagada' AND DATE(emitida_en) BETWEEN ? AND ?
  `).get(desde, hasta);

  // Ocupación por tipo de habitación
  const porTipo = db.prepare(`
    SELECT t.nombre as tipo,
      COUNT(DISTINCT hab.id) as habitaciones,
      COUNT(DISTINCT r.id) as reservas,
      SUM(r.adultos) as adultos,
      SUM(r.ninos) as ninos,
      COALESCE(SUM(r.precio_total), 0) as ingresos
    FROM tipos_habitacion t
    JOIN habitaciones hab ON hab.tipo_id = t.id
    LEFT JOIN reservas r ON r.habitacion_id = hab.id
      AND r.estado NOT IN ('cancelada','noshow')
      AND r.fecha_entrada <= ? AND r.fecha_salida > ?
    WHERE t.activo = 1
    GROUP BY t.id, t.nombre
    ORDER BY t.nombre
  `).all(hasta, desde);

  // Huéspedes únicos y su procedencia
  const procedencia = db.prepare(`
    SELECT h.nacionalidad, COUNT(DISTINCT h.id) as cantidad
    FROM reservas r
    JOIN huespedes h ON r.huesped_id = h.id
    WHERE r.estado NOT IN ('cancelada','noshow')
      AND r.fecha_entrada <= ? AND r.fecha_salida > ?
      AND h.nacionalidad IS NOT NULL AND h.nacionalidad != ''
    GROUP BY h.nacionalidad
    ORDER BY cantidad DESC
  `).all(hasta, desde);

  // Origen de las reservas
  const origenes = db.prepare(`
    SELECT origen, COUNT(*) as cantidad
    FROM reservas
    WHERE estado NOT IN ('cancelada','noshow')
      AND fecha_entrada <= ? AND fecha_salida > ?
    GROUP BY origen
    ORDER BY cantidad DESC
  `).all(hasta, desde);

  // Estadísticas calculadas
  const totalPersonas = reservas.reduce((s, r) => s + r.adultos + r.ninos, 0);
  const totalAdultos = reservas.reduce((s, r) => s + r.adultos, 0);
  const totalNinos = reservas.reduce((s, r) => s + r.ninos, 0);
  const habitacionesOcupadas = new Set(reservas.map(r => r.habitacion_numero)).size;

  // Noches-habitación vendidas en el período
  const d1 = new Date(desde + 'T12:00:00');
  const d2 = new Date(hasta + 'T12:00:00');
  const diasPeriodo = Math.round((d2 - d1) / 86400000) + 1;
  const nochesHabitacion = reservas.reduce((s, r) => {
    const entrada = new Date(r.fecha_entrada + 'T12:00:00');
    const salida = new Date(r.fecha_salida + 'T12:00:00');
    const ini = entrada < d1 ? d1 : entrada;
    const fin = salida > new Date(hasta + 'T12:00:00') ? new Date(hasta + 'T12:00:00') : salida;
    const noches = Math.max(0, Math.round((fin - ini) / 86400000));
    return s + noches;
  }, 0);
  const capacidadTotal = totalHabs * diasPeriodo;
  const porcentajeOcupacion = capacidadTotal > 0 ? Math.round((nochesHabitacion / capacidadTotal) * 100) : 0;

  res.json({
    periodo: { tipo, desde, hasta, dias: diasPeriodo },
    establecimiento: cfg,
    resumen: {
      total_habitaciones: totalHabs,
      habitaciones_ocupadas: habitacionesOcupadas,
      porcentaje_ocupacion: porcentajeOcupacion,
      noches_vendidas: nochesHabitacion,
      capacidad_total: capacidadTotal,
      total_huespedes: totalPersonas,
      adultos: totalAdultos,
      ninos: totalNinos,
      reservas_activas: reservas.length,
      checkins_periodo: checkins.length,
      checkouts_periodo: checkouts.length,
      cancelaciones: cancelaciones.length,
      ingresos_facturados: ingresos.total,
      facturas_emitidas: ingresos.facturas,
    },
    huespedes: reservas.map(r => ({
      apellido: r.huesped_nombre,
      documento: r.documento_tipo ? `${r.documento_tipo}: ${r.documento_numero}` : r.documento_numero || '—',
      nacionalidad: r.nacionalidad || '—',
      habitacion: r.habitacion_numero,
      tipo: r.tipo_nombre,
      entrada: r.fecha_entrada,
      salida: r.fecha_salida,
      noches: r.noches,
      adultos: r.adultos,
      ninos: r.ninos,
      estado: r.estado,
      origen: r.origen,
      importe: r.precio_total,
    })),
    checkins,
    checkouts,
    cancelaciones,
    por_tipo: porTipo,
    procedencia,
    origenes,
  });
});

// GET /api/reportes/estadisticas?tipo=hoy|7dias|15dias
router.get('/estadisticas', auth, (req, res) => {
  const { tipo = 'hoy' } = req.query;
  const hoy = new Date().toISOString().split('T')[0];

  let desde;
  if (tipo === 'hoy') {
    desde = hoy;
  } else if (tipo === '7dias') {
    desde = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];
  } else if (tipo === '15dias') {
    desde = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];
  } else {
    return res.status(400).json({ error: 'tipo debe ser hoy, 7dias o 15dias' });
  }
  const hasta = hoy;

  const cfg = {};
  db.prepare('SELECT clave, valor FROM configuracion').all().forEach(r => { cfg[r.clave] = r.valor; });

  const totalHabs = db.prepare('SELECT COUNT(*) as c FROM habitaciones').get().c;
  const d1 = new Date(desde + 'T12:00:00');
  const d2 = new Date(hasta + 'T12:00:00');
  const diasPeriodo = Math.round((d2 - d1) / 86400000) + 1;
  const capacidadTotal = totalHabs * diasPeriodo;

  // Reservas activas en el período
  const reservas = db.prepare(`
    SELECT r.adultos, r.ninos, r.fecha_entrada, r.fecha_salida, h.nacionalidad, r.origen
    FROM reservas r
    JOIN huespedes h ON r.huesped_id = h.id
    WHERE r.estado NOT IN ('cancelada','noshow')
      AND r.fecha_entrada <= ? AND r.fecha_salida > ?
  `).all(hasta, desde);

  // Noches-habitación vendidas en el período
  const nochesHabitacion = reservas.reduce((s, r) => {
    const entrada = new Date(r.fecha_entrada + 'T12:00:00');
    const salida = new Date(r.fecha_salida + 'T12:00:00');
    const ini = entrada < d1 ? d1 : entrada;
    const fin = salida > d2 ? d2 : salida;
    return s + Math.max(0, Math.round((fin - ini) / 86400000));
  }, 0);

  const pctOcupacion = capacidadTotal > 0 ? Math.round((nochesHabitacion / capacidadTotal) * 100) : 0;
  const totalPersonas = reservas.reduce((s, r) => s + r.adultos + r.ninos, 0);
  const adultos = reservas.reduce((s, r) => s + r.adultos, 0);
  const ninos = reservas.reduce((s, r) => s + r.ninos, 0);
  const habitacionesOcupadas = new Set(
    db.prepare(`SELECT DISTINCT habitacion_id FROM reservas
      WHERE estado NOT IN ('cancelada','noshow') AND fecha_entrada <= ? AND fecha_salida > ?`)
      .all(hasta, desde).map(r => r.habitacion_id)
  ).size;

  // Check-ins y check-outs del período
  const checkinsCnt = db.prepare(`SELECT COUNT(*) as c FROM reservas
    WHERE fecha_entrada BETWEEN ? AND ? AND estado NOT IN ('cancelada','noshow')`).get(desde, hasta).c;
  const checkoutsCnt = db.prepare(`SELECT COUNT(*) as c FROM reservas
    WHERE fecha_salida BETWEEN ? AND ? AND estado IN ('checkout','checkin')`).get(desde, hasta).c;
  const cancelacionesCnt = db.prepare(`SELECT COUNT(*) as c FROM reservas
    WHERE estado = 'cancelada' AND DATE(actualizado_en) BETWEEN ? AND ?`).get(desde, hasta).c;

  // Ingresos facturados
  const ingresos = db.prepare(`SELECT COALESCE(SUM(total),0) as total, COUNT(*) as cnt
    FROM facturas WHERE estado='pagada' AND DATE(emitida_en) BETWEEN ? AND ?`).get(desde, hasta);

  // Ocupación por tipo
  const porTipo = db.prepare(`
    SELECT t.nombre as tipo,
      COUNT(DISTINCT hab.id) as habitaciones_total,
      COUNT(DISTINCT r.habitacion_id) as habitaciones_ocupadas,
      COALESCE(SUM(r.adultos),0) as adultos,
      COALESCE(SUM(r.ninos),0) as ninos
    FROM tipos_habitacion t
    JOIN habitaciones hab ON hab.tipo_id = t.id
    LEFT JOIN reservas r ON r.habitacion_id = hab.id
      AND r.estado NOT IN ('cancelada','noshow')
      AND r.fecha_entrada <= ? AND r.fecha_salida > ?
    WHERE t.activo = 1
    GROUP BY t.id, t.nombre
    ORDER BY t.nombre
  `).all(hasta, desde).map(t => ({
    ...t,
    pct: t.habitaciones_total > 0 ? Math.round((t.habitaciones_ocupadas / t.habitaciones_total) * 100) : 0,
  }));

  // Procedencia (porcentaje)
  const procRaw = db.prepare(`
    SELECT h.nacionalidad, COUNT(DISTINCT r.id) as cantidad
    FROM reservas r JOIN huespedes h ON r.huesped_id = h.id
    WHERE r.estado NOT IN ('cancelada','noshow')
      AND r.fecha_entrada <= ? AND r.fecha_salida > ?
      AND h.nacionalidad IS NOT NULL AND h.nacionalidad != ''
    GROUP BY h.nacionalidad ORDER BY cantidad DESC
  `).all(hasta, desde);
  const totalProc = procRaw.reduce((s, p) => s + p.cantidad, 0);
  const procedencia = procRaw.map(p => ({ ...p, pct: totalProc > 0 ? Math.round((p.cantidad / totalProc) * 100) : 0 }));

  // Origen reservas (porcentaje)
  const origRaw = db.prepare(`
    SELECT origen, COUNT(*) as cantidad FROM reservas
    WHERE estado NOT IN ('cancelada','noshow')
      AND fecha_entrada <= ? AND fecha_salida > ?
    GROUP BY origen ORDER BY cantidad DESC
  `).all(hasta, desde);
  const totalOrig = origRaw.reduce((s, o) => s + o.cantidad, 0);
  const origenes = origRaw.map(o => ({ ...o, pct: totalOrig > 0 ? Math.round((o.cantidad / totalOrig) * 100) : 0 }));

  // Ocupación por día dentro del período
  const porDia = [];
  for (let i = 0; i < diasPeriodo; i++) {
    const dia = new Date(d1); dia.setDate(d1.getDate() + i);
    const diaStr = dia.toISOString().split('T')[0];
    const ocup = db.prepare(`
      SELECT COUNT(DISTINCT habitacion_id) as c FROM reservas
      WHERE estado NOT IN ('cancelada','noshow')
        AND fecha_entrada <= ? AND fecha_salida > ?
    `).get(diaStr, diaStr).c;
    porDia.push({ fecha: diaStr, ocupadas: ocup, pct: totalHabs > 0 ? Math.round((ocup / totalHabs) * 100) : 0 });
  }

  res.json({
    periodo: { tipo, desde, hasta, dias: diasPeriodo },
    establecimiento: cfg,
    resumen: {
      total_habitaciones: totalHabs,
      habitaciones_ocupadas: habitacionesOcupadas,
      pct_ocupacion: pctOcupacion,
      noches_vendidas: nochesHabitacion,
      capacidad_total: capacidadTotal,
      total_huespedes: totalPersonas,
      adultos,
      ninos,
      pct_adultos: totalPersonas > 0 ? Math.round((adultos / totalPersonas) * 100) : 0,
      pct_ninos: totalPersonas > 0 ? Math.round((ninos / totalPersonas) * 100) : 0,
      checkins: checkinsCnt,
      checkouts: checkoutsCnt,
      cancelaciones: cancelacionesCnt,
      pct_cancelacion: (checkinsCnt + cancelacionesCnt) > 0
        ? Math.round((cancelacionesCnt / (checkinsCnt + cancelacionesCnt)) * 100) : 0,
      ingresos: ingresos.total,
      facturas: ingresos.cnt,
    },
    por_dia: porDia,
    por_tipo: porTipo,
    procedencia,
    origenes,
  });
});

// GET /api/reportes/huespedes-frecuentes?limite=10&desde=YYYY-MM-DD&hasta=YYYY-MM-DD
router.get('/huespedes-frecuentes', auth, (req, res) => {
  const { limite = 10, desde, hasta } = req.query;

  const params = [];
  let whereExtra = '';

  if (desde) {
    whereExtra += ' AND r.fecha_entrada >= ?';
    params.push(desde);
  }
  if (hasta) {
    whereExtra += ' AND r.fecha_entrada <= ?';
    params.push(hasta);
  }

  const limitVal = parseInt(limite, 10) || 10;

  const rows = db.prepare(`
    SELECT
      h.id            AS huesped_id,
      h.nombre || ' ' || h.apellido AS nombre,
      h.email,
      h.nacionalidad,
      COUNT(r.id)     AS total_reservas,
      SUM(r.noches)   AS total_noches,
      COALESCE(SUM(r.precio_total), 0) AS total_gastado,
      MIN(r.fecha_entrada) AS primera_visita,
      MAX(r.fecha_entrada) AS ultima_visita
    FROM reservas r
    JOIN huespedes h ON r.huesped_id = h.id
    WHERE r.estado NOT IN ('cancelada', 'noshow')
      ${whereExtra}
    GROUP BY h.id
    HAVING COUNT(r.id) > 1
    ORDER BY total_reservas DESC, total_gastado DESC
    LIMIT ?
  `).all(...params, limitVal);

  res.json({ limite: limitVal, desde: desde || null, hasta: hasta || null, huespedes: rows });
});

module.exports = router;

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';

export const reportes = new Hono();

function calcPeriodo(tipo, fecha, fecha_desde, fecha_hasta) {
  const hoy = fecha || new Date().toISOString().split('T')[0];
  let desde, hasta;
  if (tipo === 'diario') { desde = hasta = hoy; }
  else if (tipo === 'semanal') {
    const d = new Date(hoy + 'T12:00:00');
    const dow = d.getDay();
    const lunes = new Date(d); lunes.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
    const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
    desde = lunes.toISOString().split('T')[0]; hasta = domingo.toISOString().split('T')[0];
  } else if (tipo === 'quincenal') {
    const d = new Date(hoy + 'T12:00:00');
    const dia = d.getDate();
    desde = hoy.substring(0, 8) + (dia <= 15 ? '01' : '16');
    if (dia <= 15) hasta = hoy.substring(0, 8) + '15';
    else { const u = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); hasta = hoy.substring(0, 8) + String(u).padStart(2, '0'); }
  } else if (tipo === 'mensual') {
    const d = new Date(hoy + 'T12:00:00');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const u = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    desde = `${d.getFullYear()}-${mm}-01`; hasta = `${d.getFullYear()}-${mm}-${String(u).padStart(2, '0')}`;
  } else if (tipo === 'libre') {
    desde = fecha_desde; hasta = fecha_hasta;
  }
  return { desde, hasta };
}

reportes.get('/ocupacion', authMiddleware, async c => {
  const { tipo = 'diario', fecha, fecha_desde, fecha_hasta } = c.req.query();
  if (tipo === 'libre' && (!fecha_desde || !fecha_hasta)) return c.json({ error: 'fecha_desde y fecha_hasta requeridas' }, 400);
  const { desde, hasta } = calcPeriodo(tipo, fecha, fecha_desde, fecha_hasta);
  if (!desde) return c.json({ error: 'tipo inválido' }, 400);

  const d1 = new Date(desde + 'T12:00:00');
  const d2 = new Date(hasta + 'T12:00:00');
  const diasPeriodo = Math.round((d2 - d1) / 86400000) + 1;

  const [cfgRes, habsRes, reservasRes, checkinsRes, checkoutsRes, cancelRes, ingresosRes, porTipoRes, procRes, origenRes] = await Promise.all([
    c.env.DB.prepare('SELECT clave,valor FROM configuracion').all(),
    c.env.DB.prepare('SELECT COUNT(*) as c FROM habitaciones').first(),
    c.env.DB.prepare(`SELECT r.*,h.nombre||' '||h.apellido as huesped_nombre,h.documento_tipo,h.documento_numero,h.nacionalidad,h.email as huesped_email,h.telefono as huesped_telefono,hab.numero as habitacion_numero,t.nombre as tipo_nombre,t.capacidad FROM reservas r JOIN huespedes h ON r.huesped_id=h.id JOIN habitaciones hab ON r.habitacion_id=hab.id JOIN tipos_habitacion t ON hab.tipo_id=t.id WHERE r.estado NOT IN ('cancelada','noshow') AND r.fecha_entrada<=? AND r.fecha_salida>? ORDER BY r.fecha_entrada`).bind(hasta, desde).all(),
    c.env.DB.prepare(`SELECT r.*,h.nombre||' '||h.apellido as huesped_nombre,h.documento_tipo,h.documento_numero,h.nacionalidad,hab.numero as habitacion_numero,t.nombre as tipo_nombre FROM reservas r JOIN huespedes h ON r.huesped_id=h.id JOIN habitaciones hab ON r.habitacion_id=hab.id JOIN tipos_habitacion t ON hab.tipo_id=t.id WHERE r.fecha_entrada BETWEEN ? AND ? AND r.estado NOT IN ('cancelada','noshow') ORDER BY r.fecha_entrada`).bind(desde, hasta).all(),
    c.env.DB.prepare(`SELECT r.*,h.nombre||' '||h.apellido as huesped_nombre,h.documento_tipo,h.documento_numero,h.nacionalidad,hab.numero as habitacion_numero,t.nombre as tipo_nombre FROM reservas r JOIN huespedes h ON r.huesped_id=h.id JOIN habitaciones hab ON r.habitacion_id=hab.id JOIN tipos_habitacion t ON hab.tipo_id=t.id WHERE r.fecha_salida BETWEEN ? AND ? AND r.estado IN ('checkout','checkin') ORDER BY r.fecha_salida`).bind(desde, hasta).all(),
    c.env.DB.prepare(`SELECT r.*,h.nombre||' '||h.apellido as huesped_nombre,hab.numero as habitacion_numero FROM reservas r JOIN huespedes h ON r.huesped_id=h.id JOIN habitaciones hab ON r.habitacion_id=hab.id WHERE r.estado='cancelada' AND DATE(r.actualizado_en) BETWEEN ? AND ? ORDER BY r.actualizado_en`).bind(desde, hasta).all(),
    c.env.DB.prepare(`SELECT COALESCE(SUM(total),0) as total,COUNT(*) as facturas FROM facturas WHERE estado='pagada' AND DATE(emitida_en) BETWEEN ? AND ?`).bind(desde, hasta).first(),
    c.env.DB.prepare(`SELECT t.nombre as tipo,COUNT(DISTINCT hab.id) as habitaciones,COUNT(DISTINCT r.id) as reservas,COALESCE(SUM(r.adultos),0) as adultos,COALESCE(SUM(r.ninos),0) as ninos,COALESCE(SUM(r.precio_total),0) as ingresos FROM tipos_habitacion t JOIN habitaciones hab ON hab.tipo_id=t.id LEFT JOIN reservas r ON r.habitacion_id=hab.id AND r.estado NOT IN ('cancelada','noshow') AND r.fecha_entrada<=? AND r.fecha_salida>? WHERE t.activo=1 GROUP BY t.id,t.nombre ORDER BY t.nombre`).bind(hasta, desde).all(),
    c.env.DB.prepare(`SELECT h.nacionalidad,COUNT(DISTINCT h.id) as cantidad FROM reservas r JOIN huespedes h ON r.huesped_id=h.id WHERE r.estado NOT IN ('cancelada','noshow') AND r.fecha_entrada<=? AND r.fecha_salida>? AND h.nacionalidad IS NOT NULL AND h.nacionalidad!='' GROUP BY h.nacionalidad ORDER BY cantidad DESC`).bind(hasta, desde).all(),
    c.env.DB.prepare(`SELECT origen,COUNT(*) as cantidad FROM reservas WHERE estado NOT IN ('cancelada','noshow') AND fecha_entrada<=? AND fecha_salida>? GROUP BY origen ORDER BY cantidad DESC`).bind(hasta, desde).all(),
  ]);

  const cfg = cfgRes.results.reduce((a, r) => ({ ...a, [r.clave]: r.valor }), {});
  const totalHabs = habsRes.c;
  const reservas = reservasRes.results;

  const nochesHabitacion = reservas.reduce((s, r) => {
    const entrada = new Date(r.fecha_entrada + 'T12:00:00');
    const salida = new Date(r.fecha_salida + 'T12:00:00');
    const ini = entrada < d1 ? d1 : entrada;
    const fin = salida > d2 ? d2 : salida;
    return s + Math.max(0, Math.round((fin - ini) / 86400000));
  }, 0);

  const capacidadTotal = totalHabs * diasPeriodo;
  const habitacionesOcupadas = new Set(reservas.map(r => r.habitacion_numero)).size;

  return c.json({
    periodo: { tipo, desde, hasta, dias: diasPeriodo },
    establecimiento: cfg,
    resumen: {
      total_habitaciones: totalHabs, habitaciones_ocupadas: habitacionesOcupadas,
      porcentaje_ocupacion: capacidadTotal > 0 ? Math.round((nochesHabitacion / capacidadTotal) * 100) : 0,
      noches_vendidas: nochesHabitacion, capacidad_total: capacidadTotal,
      total_huespedes: reservas.reduce((s, r) => s + r.adultos + r.ninos, 0),
      adultos: reservas.reduce((s, r) => s + r.adultos, 0),
      ninos: reservas.reduce((s, r) => s + r.ninos, 0),
      reservas_activas: reservas.length,
      checkins_periodo: checkinsRes.results.length,
      checkouts_periodo: checkoutsRes.results.length,
      cancelaciones: cancelRes.results.length,
      ingresos_facturados: ingresosRes.total,
      facturas_emitidas: ingresosRes.facturas,
    },
    huespedes: reservas.map(r => ({ apellido: r.huesped_nombre, documento: r.documento_tipo ? `${r.documento_tipo}: ${r.documento_numero}` : r.documento_numero || '—', nacionalidad: r.nacionalidad || '—', habitacion: r.habitacion_numero, tipo: r.tipo_nombre, entrada: r.fecha_entrada, salida: r.fecha_salida, noches: r.noches, adultos: r.adultos, ninos: r.ninos, estado: r.estado, origen: r.origen, importe: r.precio_total })),
    checkins: checkinsRes.results,
    checkouts: checkoutsRes.results,
    cancelaciones: cancelRes.results,
    por_tipo: porTipoRes.results,
    procedencia: procRes.results,
    origenes: origenRes.results,
  });
});

reportes.get('/estadisticas', authMiddleware, async c => {
  const { tipo = 'hoy' } = c.req.query();
  const hoy = new Date().toISOString().split('T')[0];
  let desde;
  if (tipo === 'hoy') desde = hoy;
  else if (tipo === '7dias') desde = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];
  else if (tipo === '15dias') desde = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];
  else return c.json({ error: 'tipo debe ser hoy, 7dias o 15dias' }, 400);
  const hasta = hoy;

  const d1 = new Date(desde + 'T12:00:00');
  const d2 = new Date(hasta + 'T12:00:00');
  const diasPeriodo = Math.round((d2 - d1) / 86400000) + 1;

  const [cfgRes, habsRes, reservasRes, habOcupRes, checkinsCnt, checkoutsCnt, cancelCnt, ingresosRes, porTipoRes, procRes, origRes] = await Promise.all([
    c.env.DB.prepare('SELECT clave,valor FROM configuracion').all(),
    c.env.DB.prepare('SELECT COUNT(*) as c FROM habitaciones').first(),
    c.env.DB.prepare(`SELECT r.adultos,r.ninos,r.fecha_entrada,r.fecha_salida,h.nacionalidad,r.origen FROM reservas r JOIN huespedes h ON r.huesped_id=h.id WHERE r.estado NOT IN ('cancelada','noshow') AND r.fecha_entrada<=? AND r.fecha_salida>?`).bind(hasta, desde).all(),
    c.env.DB.prepare(`SELECT COUNT(DISTINCT habitacion_id) as c FROM reservas WHERE estado NOT IN ('cancelada','noshow') AND fecha_entrada<=? AND fecha_salida>?`).bind(hasta, desde).first(),
    c.env.DB.prepare(`SELECT COUNT(*) as c FROM reservas WHERE fecha_entrada BETWEEN ? AND ? AND estado NOT IN ('cancelada','noshow')`).bind(desde, hasta).first(),
    c.env.DB.prepare(`SELECT COUNT(*) as c FROM reservas WHERE fecha_salida BETWEEN ? AND ? AND estado IN ('checkout','checkin')`).bind(desde, hasta).first(),
    c.env.DB.prepare(`SELECT COUNT(*) as c FROM reservas WHERE estado='cancelada' AND DATE(actualizado_en) BETWEEN ? AND ?`).bind(desde, hasta).first(),
    c.env.DB.prepare(`SELECT COALESCE(SUM(total),0) as total,COUNT(*) as cnt FROM facturas WHERE estado='pagada' AND DATE(emitida_en) BETWEEN ? AND ?`).bind(desde, hasta).first(),
    c.env.DB.prepare(`SELECT t.nombre as tipo,COUNT(DISTINCT hab.id) as habitaciones_total,COUNT(DISTINCT r.habitacion_id) as habitaciones_ocupadas,COALESCE(SUM(r.adultos),0) as adultos,COALESCE(SUM(r.ninos),0) as ninos FROM tipos_habitacion t JOIN habitaciones hab ON hab.tipo_id=t.id LEFT JOIN reservas r ON r.habitacion_id=hab.id AND r.estado NOT IN ('cancelada','noshow') AND r.fecha_entrada<=? AND r.fecha_salida>? WHERE t.activo=1 GROUP BY t.id,t.nombre ORDER BY t.nombre`).bind(hasta, desde).all(),
    c.env.DB.prepare(`SELECT h.nacionalidad,COUNT(DISTINCT r.id) as cantidad FROM reservas r JOIN huespedes h ON r.huesped_id=h.id WHERE r.estado NOT IN ('cancelada','noshow') AND r.fecha_entrada<=? AND r.fecha_salida>? AND h.nacionalidad IS NOT NULL AND h.nacionalidad!='' GROUP BY h.nacionalidad ORDER BY cantidad DESC`).bind(hasta, desde).all(),
    c.env.DB.prepare(`SELECT origen,COUNT(*) as cantidad FROM reservas WHERE estado NOT IN ('cancelada','noshow') AND fecha_entrada<=? AND fecha_salida>? GROUP BY origen ORDER BY cantidad DESC`).bind(hasta, desde).all(),
  ]);

  const cfg = cfgRes.results.reduce((a, r) => ({ ...a, [r.clave]: r.valor }), {});
  const totalHabs = habsRes.c;
  const reservas = reservasRes.results;
  const capacidadTotal = totalHabs * diasPeriodo;

  const nochesHabitacion = reservas.reduce((s, r) => {
    const entrada = new Date(r.fecha_entrada + 'T12:00:00');
    const salida = new Date(r.fecha_salida + 'T12:00:00');
    const ini = entrada < d1 ? d1 : entrada;
    const fin = salida > d2 ? d2 : salida;
    return s + Math.max(0, Math.round((fin - ini) / 86400000));
  }, 0);

  const adultos = reservas.reduce((s, r) => s + r.adultos, 0);
  const ninos = reservas.reduce((s, r) => s + r.ninos, 0);
  const totalPersonas = adultos + ninos;
  const totalProc = procRes.results.reduce((s, p) => s + p.cantidad, 0);
  const totalOrig = origRes.results.reduce((s, o) => s + o.cantidad, 0);

  // per-day breakdown
  const porDiaPromises = [];
  for (let i = 0; i < diasPeriodo; i++) {
    const dia = new Date(d1); dia.setDate(d1.getDate() + i);
    const diaStr = dia.toISOString().split('T')[0];
    porDiaPromises.push(c.env.DB.prepare(`SELECT COUNT(DISTINCT habitacion_id) as c FROM reservas WHERE estado NOT IN ('cancelada','noshow') AND fecha_entrada<=? AND fecha_salida>?`).bind(diaStr, diaStr).first().then(r => ({ fecha: diaStr, ocupadas: r.c, pct: totalHabs > 0 ? Math.round((r.c / totalHabs) * 100) : 0 })));
  }
  const porDia = await Promise.all(porDiaPromises);

  return c.json({
    periodo: { tipo, desde, hasta, dias: diasPeriodo },
    establecimiento: cfg,
    resumen: {
      total_habitaciones: totalHabs, habitaciones_ocupadas: habOcupRes.c,
      pct_ocupacion: capacidadTotal > 0 ? Math.round((nochesHabitacion / capacidadTotal) * 100) : 0,
      noches_vendidas: nochesHabitacion, capacidad_total: capacidadTotal,
      total_huespedes: totalPersonas, adultos, ninos,
      pct_adultos: totalPersonas > 0 ? Math.round((adultos / totalPersonas) * 100) : 0,
      pct_ninos: totalPersonas > 0 ? Math.round((ninos / totalPersonas) * 100) : 0,
      checkins: checkinsCnt.c, checkouts: checkoutsCnt.c, cancelaciones: cancelCnt.c,
      pct_cancelacion: (checkinsCnt.c + cancelCnt.c) > 0 ? Math.round((cancelCnt.c / (checkinsCnt.c + cancelCnt.c)) * 100) : 0,
      ingresos: ingresosRes.total, facturas: ingresosRes.cnt,
    },
    por_dia: porDia,
    por_tipo: porTipoRes.results.map(t => ({ ...t, pct: t.habitaciones_total > 0 ? Math.round((t.habitaciones_ocupadas / t.habitaciones_total) * 100) : 0 })),
    procedencia: procRes.results.map(p => ({ ...p, pct: totalProc > 0 ? Math.round((p.cantidad / totalProc) * 100) : 0 })),
    origenes: origRes.results.map(o => ({ ...o, pct: totalOrig > 0 ? Math.round((o.cantidad / totalOrig) * 100) : 0 })),
  });
});

reportes.get('/huespedes-frecuentes', authMiddleware, async c => {
  const { limite = 10, desde, hasta } = c.req.query();
  const limitVal = parseInt(limite, 10) || 10;
  let q = `SELECT h.id AS huesped_id,h.nombre||' '||h.apellido AS nombre,h.email,h.nacionalidad,COUNT(r.id) AS total_reservas,SUM(r.noches) AS total_noches,COALESCE(SUM(r.precio_total),0) AS total_gastado,MIN(r.fecha_entrada) AS primera_visita,MAX(r.fecha_entrada) AS ultima_visita FROM reservas r JOIN huespedes h ON r.huesped_id=h.id WHERE r.estado NOT IN ('cancelada','noshow')`;
  const params = [];
  if (desde) { q += ' AND r.fecha_entrada>=?'; params.push(desde); }
  if (hasta) { q += ' AND r.fecha_entrada<=?'; params.push(hasta); }
  q += ' GROUP BY h.id HAVING COUNT(r.id)>1 ORDER BY total_reservas DESC,total_gastado DESC LIMIT ?';
  params.push(limitVal);
  const { results } = await c.env.DB.prepare(q).bind(...params).all();
  return c.json({ limite: limitVal, desde: desde || null, hasta: hasta || null, huespedes: results });
});

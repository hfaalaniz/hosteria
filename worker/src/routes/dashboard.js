import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';

export const dashboard = new Hono();

dashboard.get('/stats', authMiddleware, async c => {
  const { tenant_id } = c.get('user');
  const hoy = new Date().toISOString().split('T')[0];
  const inicioMes = hoy.substring(0, 7) + '-01';

  const [
    { results: [{ c: totalHabitaciones }] },
    { results: [{ c: mantenimientoCount }] },
    { results: [{ c: limpiezaCount }] },
    { results: [{ c: ocupadasCount }] },
    { results: [{ c: checkinHoy }] },
    { results: [{ c: checkoutHoy }] },
    { results: [{ c: enCasa }] },
    { results: [{ total: ingresosMes }] },
    { results: [{ total: ingresosHoy }] },
    { results: proximasLlegadas },
    { results: proximasSalidas },
    { results: ingresosUltimos30 },
    { results: ocupacionPorTipo },
    { results: mantenimientoPendiente },
  ] = await c.env.DB.batch([
    c.env.DB.prepare("SELECT COUNT(*) as c FROM habitaciones WHERE tenant_id=? AND estado!='mantenimiento'").bind(tenant_id),
    c.env.DB.prepare("SELECT COUNT(*) as c FROM habitaciones WHERE tenant_id=? AND estado='mantenimiento'").bind(tenant_id),
    c.env.DB.prepare("SELECT COUNT(*) as c FROM habitaciones WHERE tenant_id=? AND estado='limpieza'").bind(tenant_id),
    c.env.DB.prepare(`SELECT COUNT(DISTINCT h.id) as c FROM habitaciones h WHERE h.tenant_id=? AND (h.estado='ocupada' OR EXISTS (SELECT 1 FROM reservas r WHERE r.habitacion_id=h.id AND r.tenant_id=h.tenant_id AND r.estado NOT IN ('cancelada','checkout','noshow') AND r.fecha_entrada<=? AND r.fecha_salida>?))`).bind(tenant_id, hoy, hoy),
    c.env.DB.prepare("SELECT COUNT(*) as c FROM reservas WHERE tenant_id=? AND fecha_entrada=? AND estado IN ('confirmada','checkin')").bind(tenant_id, hoy),
    c.env.DB.prepare("SELECT COUNT(*) as c FROM reservas WHERE tenant_id=? AND estado='checkout' AND DATE(actualizado_en)=?").bind(tenant_id, hoy),
    c.env.DB.prepare("SELECT COUNT(*) as c FROM reservas WHERE tenant_id=? AND estado='checkin'").bind(tenant_id),
    c.env.DB.prepare("SELECT COALESCE(SUM(total),0) as total FROM facturas WHERE tenant_id=? AND estado='pagada' AND emitida_en>=?").bind(tenant_id, inicioMes),
    c.env.DB.prepare("SELECT COALESCE(SUM(total),0) as total FROM facturas WHERE tenant_id=? AND estado='pagada' AND DATE(emitida_en)=?").bind(tenant_id, hoy),
    c.env.DB.prepare(`SELECT r.*,h.nombre||' '||h.apellido as huesped_nombre,hab.numero as habitacion_numero FROM reservas r JOIN huespedes h ON r.huesped_id=h.id JOIN habitaciones hab ON r.habitacion_id=hab.id WHERE r.tenant_id=? AND r.fecha_entrada BETWEEN ? AND DATE(?,' +7 days') AND r.estado IN ('pendiente','confirmada') ORDER BY r.fecha_entrada LIMIT 10`).bind(tenant_id, hoy, hoy),
    c.env.DB.prepare(`SELECT r.*,h.nombre||' '||h.apellido as huesped_nombre,hab.numero as habitacion_numero FROM reservas r JOIN huespedes h ON r.huesped_id=h.id JOIN habitaciones hab ON r.habitacion_id=hab.id WHERE r.tenant_id=? AND r.fecha_salida BETWEEN ? AND DATE(?,' +7 days') AND r.estado='checkin' ORDER BY r.fecha_salida LIMIT 10`).bind(tenant_id, hoy, hoy),
    c.env.DB.prepare(`SELECT DATE(emitida_en) as fecha,SUM(total) as total FROM facturas WHERE tenant_id=? AND estado='pagada' AND emitida_en>=DATE(?,' -30 days') GROUP BY DATE(emitida_en) ORDER BY fecha`).bind(tenant_id, hoy),
    c.env.DB.prepare(`SELECT t.nombre,COUNT(h.id) as total,SUM(CASE WHEN h.estado='ocupada' THEN 1 ELSE 0 END) as ocupadas FROM tipos_habitacion t LEFT JOIN habitaciones h ON h.tipo_id=t.id AND h.tenant_id=t.tenant_id WHERE t.tenant_id=? AND t.activo=1 GROUP BY t.id,t.nombre`).bind(tenant_id),
    c.env.DB.prepare(`SELECT m.*,hab.numero as habitacion_numero FROM mantenimiento m JOIN habitaciones hab ON m.habitacion_id=hab.id WHERE m.tenant_id=? AND m.estado!='resuelto' ORDER BY CASE m.prioridad WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END LIMIT 5`).bind(tenant_id),
  ]);

  const disponibles = Math.max(0, totalHabitaciones - limpiezaCount - ocupadasCount);
  return c.json({
    ocupacion: { total: totalHabitaciones, ocupadas: ocupadasCount, disponibles, limpieza: limpiezaCount, mantenimiento: mantenimientoCount, porcentaje: Math.round((ocupadasCount / Math.max(totalHabitaciones, 1)) * 100) },
    hoy: { checkins: checkinHoy, checkouts: checkoutHoy, enCasa, ingresos: ingresosHoy },
    mes: { ingresos: ingresosMes },
    proximasLlegadas, proximasSalidas, ingresosUltimos30, ocupacionPorTipo, mantenimientoPendiente,
  });
});

dashboard.get('/ingresos-anuales', authMiddleware, async c => {
  const { tenant_id } = c.get('user');
  const hoy = new Date().toISOString().split('T')[0];
  const { results } = await c.env.DB.prepare(`SELECT strftime('%Y-%m',emitida_en) as mes,SUM(total) as total,COUNT(*) as facturas FROM facturas WHERE tenant_id=? AND estado='pagada' AND emitida_en>=DATE(?,' -12 months') GROUP BY strftime('%Y-%m',emitida_en) ORDER BY mes`).bind(tenant_id, hoy).all();
  return c.json(results);
});

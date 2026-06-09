import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';

export const historial = new Hono();

historial.get('/', authMiddleware, async c => {
  const { desde, hasta, tipo, buscar, page = 1 } = c.req.query();
  const limit = 50;
  const offset = (parseInt(page) - 1) * limit;
  const hoy = new Date().toISOString().split('T')[0];
  const fechaDesde = desde || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const fechaHasta = hasta || hoy;

  const queries = [];
  const s = buscar ? `%${buscar}%` : null;

  if (!tipo || tipo === 'reserva') queries.push(c.env.DB.prepare(`SELECT r.id,r.codigo,r.estado,r.origen,r.fecha_entrada,r.fecha_salida,r.noches,r.precio_total,r.adultos,r.ninos,r.creado_en,r.actualizado_en,h.nombre||' '||h.apellido as huesped_nombre,h.email as huesped_email,hab.numero as habitacion_numero,t.nombre as tipo_nombre FROM reservas r JOIN huespedes h ON r.huesped_id=h.id JOIN habitaciones hab ON r.habitacion_id=hab.id JOIN tipos_habitacion t ON hab.tipo_id=t.id WHERE DATE(r.creado_en) BETWEEN ? AND ?${s?' AND (h.nombre||? || h.apellido LIKE ? OR r.codigo LIKE ? OR hab.numero LIKE ?)':''}`).bind(fechaDesde,fechaHasta,...(s?[s,s,s]:[])).all());
  if (!tipo || tipo === 'factura') queries.push(c.env.DB.prepare(`SELECT f.id,f.numero,f.total,f.metodo_pago,f.estado,f.emitida_en,h.nombre||' '||h.apellido as huesped_nombre,hab.numero as habitacion_numero FROM facturas f JOIN huespedes h ON f.huesped_id=h.id JOIN reservas r ON f.reserva_id=r.id JOIN habitaciones hab ON r.habitacion_id=hab.id WHERE DATE(f.emitida_en) BETWEEN ? AND ?${s?' AND (h.nombre||? || h.apellido LIKE ? OR f.numero LIKE ?)':''}`).bind(fechaDesde,fechaHasta,...(s?[s,s]:[])).all());
  if (!tipo || tipo === 'mantenimiento') queries.push(c.env.DB.prepare(`SELECT m.id,m.descripcion,m.prioridad,m.estado,m.creado_en,m.resuelto_en,hab.numero as habitacion_numero FROM mantenimiento m JOIN habitaciones hab ON m.habitacion_id=hab.id WHERE DATE(m.creado_en) BETWEEN ? AND ?${s?' AND (m.descripcion LIKE ? OR hab.numero LIKE ?)':''}`).bind(fechaDesde,fechaHasta,...(s?[s,s]:[])).all());

  const allResults = await Promise.all(queries);
  const eventos = [];

  if (!tipo || tipo === 'reserva') {
    for (const r of (allResults[0]?.results||[])) eventos.push({ id:`reserva-${r.id}`,tipo:'reserva',fecha:r.creado_en,titulo:`Nueva reserva — ${r.huesped_nombre}`,detalle:`Hab. ${r.habitacion_numero} · ${r.fecha_entrada} → ${r.fecha_salida} · ${r.noches} noches · $${r.precio_total}`,huesped:r.huesped_nombre,habitacion:r.habitacion_numero,codigo:r.codigo,estado:r.estado,origen:r.origen,meta:{adultos:r.adultos,ninos:r.ninos,precio_total:r.precio_total} });
  }
  if (!tipo || tipo === 'factura') {
    const idx = (!tipo||tipo==='reserva') ? 1 : 0;
    for (const f of (allResults[idx]?.results||[])) eventos.push({ id:`factura-${f.id}`,tipo:'factura',fecha:f.emitida_en,titulo:`Factura ${f.numero} — ${f.huesped_nombre}`,detalle:`Hab. ${f.habitacion_numero} · Total: $${f.total} · Pago: ${f.metodo_pago}`,huesped:f.huesped_nombre,habitacion:f.habitacion_numero,meta:{numero:f.numero,total:f.total,metodo_pago:f.metodo_pago,estado:f.estado} });
  }
  if (!tipo || tipo === 'mantenimiento') {
    const idx = allResults.length - 1;
    for (const m of (allResults[idx]?.results||[])) eventos.push({ id:`mant-${m.id}`,tipo:'mantenimiento',fecha:m.creado_en,titulo:`Mantenimiento — Hab. ${m.habitacion_numero}`,detalle:`${m.descripcion} · ${m.prioridad} · ${m.estado}`,habitacion:m.habitacion_numero,meta:{prioridad:m.prioridad,estado:m.estado,resuelto_en:m.resuelto_en} });
  }

  eventos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  const total = eventos.length;
  return c.json({ eventos: eventos.slice(offset, offset+limit), total, page: parseInt(page), pages: Math.ceil(total/limit) });
});

const express = require('express');
const { db } = require('../db/database');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, (req, res) => {
  const { desde, hasta, tipo, buscar, page = 1 } = req.query;
  const limit = 50;
  const offset = (parseInt(page) - 1) * limit;

  const hoy = new Date().toISOString().split('T')[0];
  const fechaDesde = desde || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const fechaHasta = hasta || hoy;

  const eventos = [];

  // ── Reservas creadas ──────────────────────────────────────────────────────
  if (!tipo || tipo === 'reserva') {
    const reservas = db.prepare(`
      SELECT r.id, r.codigo, r.estado, r.origen, r.fecha_entrada, r.fecha_salida,
             r.noches, r.precio_total, r.adultos, r.ninos, r.creado_en, r.actualizado_en,
             h.nombre || ' ' || h.apellido as huesped_nombre, h.email as huesped_email,
             hab.numero as habitacion_numero, t.nombre as tipo_nombre
      FROM reservas r
      JOIN huespedes h ON r.huesped_id = h.id
      JOIN habitaciones hab ON r.habitacion_id = hab.id
      JOIN tipos_habitacion t ON hab.tipo_id = t.id
      WHERE DATE(r.creado_en) BETWEEN ? AND ?
      ${buscar ? `AND (h.nombre || ' ' || h.apellido LIKE ? OR r.codigo LIKE ? OR hab.numero LIKE ?)` : ''}
    `).all(fechaDesde, fechaHasta, ...(buscar ? [`%${buscar}%`, `%${buscar}%`, `%${buscar}%`] : []));

    for (const r of reservas) {
      eventos.push({
        id: `reserva-${r.id}`,
        tipo: 'reserva',
        fecha: r.creado_en,
        titulo: `Nueva reserva — ${r.huesped_nombre}`,
        detalle: `Hab. ${r.habitacion_numero} (${r.tipo_nombre}) · ${r.fecha_entrada} → ${r.fecha_salida} · ${r.noches} noches · $${r.precio_total}`,
        huesped: r.huesped_nombre,
        habitacion: r.habitacion_numero,
        codigo: r.codigo,
        estado: r.estado,
        origen: r.origen,
        meta: { adultos: r.adultos, ninos: r.ninos, precio_total: r.precio_total },
      });
    }
  }

  // ── Check-ins ─────────────────────────────────────────────────────────────
  if (!tipo || tipo === 'checkin') {
    const checkins = db.prepare(`
      SELECT r.id, r.codigo, r.fecha_entrada, r.fecha_salida, r.noches, r.actualizado_en,
             h.nombre || ' ' || h.apellido as huesped_nombre,
             hab.numero as habitacion_numero, t.nombre as tipo_nombre
      FROM reservas r
      JOIN huespedes h ON r.huesped_id = h.id
      JOIN habitaciones hab ON r.habitacion_id = hab.id
      JOIN tipos_habitacion t ON hab.tipo_id = t.id
      WHERE r.estado IN ('checkin','checkout')
        AND DATE(r.actualizado_en) BETWEEN ? AND ?
        AND r.fecha_entrada = DATE(r.actualizado_en)
      ${buscar ? `AND (h.nombre || ' ' || h.apellido LIKE ? OR r.codigo LIKE ?)` : ''}
    `).all(fechaDesde, fechaHasta, ...(buscar ? [`%${buscar}%`, `%${buscar}%`] : []));

    for (const r of checkins) {
      eventos.push({
        id: `checkin-${r.id}`,
        tipo: 'checkin',
        fecha: r.actualizado_en,
        titulo: `Check-in — ${r.huesped_nombre}`,
        detalle: `Hab. ${r.habitacion_numero} (${r.tipo_nombre}) · Salida: ${r.fecha_salida} · ${r.noches} noches`,
        huesped: r.huesped_nombre,
        habitacion: r.habitacion_numero,
        codigo: r.codigo,
      });
    }
  }

  // ── Check-outs ────────────────────────────────────────────────────────────
  if (!tipo || tipo === 'checkout') {
    const checkouts = db.prepare(`
      SELECT r.id, r.codigo, r.fecha_entrada, r.fecha_salida, r.noches, r.precio_total, r.actualizado_en,
             h.nombre || ' ' || h.apellido as huesped_nombre,
             hab.numero as habitacion_numero, t.nombre as tipo_nombre,
             f.total as factura_total, f.numero as factura_numero, f.metodo_pago
      FROM reservas r
      JOIN huespedes h ON r.huesped_id = h.id
      JOIN habitaciones hab ON r.habitacion_id = hab.id
      JOIN tipos_habitacion t ON hab.tipo_id = t.id
      LEFT JOIN facturas f ON f.reserva_id = r.id
      WHERE r.estado = 'checkout'
        AND DATE(r.actualizado_en) BETWEEN ? AND ?
      ${buscar ? `AND (h.nombre || ' ' || h.apellido LIKE ? OR r.codigo LIKE ?)` : ''}
    `).all(fechaDesde, fechaHasta, ...(buscar ? [`%${buscar}%`, `%${buscar}%`] : []));

    for (const r of checkouts) {
      eventos.push({
        id: `checkout-${r.id}`,
        tipo: 'checkout',
        fecha: r.actualizado_en,
        titulo: `Check-out — ${r.huesped_nombre}`,
        detalle: `Hab. ${r.habitacion_numero} · ${r.fecha_entrada} → ${r.fecha_salida} · ${r.noches} noches · Total: $${r.factura_total ?? r.precio_total}`,
        huesped: r.huesped_nombre,
        habitacion: r.habitacion_numero,
        codigo: r.codigo,
        meta: { factura_numero: r.factura_numero, metodo_pago: r.metodo_pago, total: r.factura_total ?? r.precio_total },
      });
    }
  }

  // ── Cancelaciones ─────────────────────────────────────────────────────────
  if (!tipo || tipo === 'cancelacion') {
    const canceladas = db.prepare(`
      SELECT r.id, r.codigo, r.fecha_entrada, r.fecha_salida, r.origen, r.actualizado_en,
             h.nombre || ' ' || h.apellido as huesped_nombre,
             hab.numero as habitacion_numero
      FROM reservas r
      JOIN huespedes h ON r.huesped_id = h.id
      JOIN habitaciones hab ON r.habitacion_id = hab.id
      WHERE r.estado = 'cancelada'
        AND DATE(r.actualizado_en) BETWEEN ? AND ?
      ${buscar ? `AND (h.nombre || ' ' || h.apellido LIKE ? OR r.codigo LIKE ?)` : ''}
    `).all(fechaDesde, fechaHasta, ...(buscar ? [`%${buscar}%`, `%${buscar}%`] : []));

    for (const r of canceladas) {
      eventos.push({
        id: `cancelacion-${r.id}`,
        tipo: 'cancelacion',
        fecha: r.actualizado_en,
        titulo: `Cancelación — ${r.huesped_nombre}`,
        detalle: `Hab. ${r.habitacion_numero} · ${r.fecha_entrada} → ${r.fecha_salida} · Origen: ${r.origen}`,
        huesped: r.huesped_nombre,
        habitacion: r.habitacion_numero,
        codigo: r.codigo,
      });
    }
  }

  // ── Mantenimiento ─────────────────────────────────────────────────────────
  if (!tipo || tipo === 'mantenimiento') {
    const mantenimientos = db.prepare(`
      SELECT m.id, m.descripcion, m.prioridad, m.estado, m.creado_en, m.resuelto_en,
             hab.numero as habitacion_numero
      FROM mantenimiento m
      JOIN habitaciones hab ON m.habitacion_id = hab.id
      WHERE DATE(m.creado_en) BETWEEN ? AND ?
      ${buscar ? `AND (m.descripcion LIKE ? OR hab.numero LIKE ?)` : ''}
    `).all(fechaDesde, fechaHasta, ...(buscar ? [`%${buscar}%`, `%${buscar}%`] : []));

    for (const m of mantenimientos) {
      eventos.push({
        id: `mant-${m.id}`,
        tipo: 'mantenimiento',
        fecha: m.creado_en,
        titulo: `Mantenimiento — Hab. ${m.habitacion_numero}`,
        detalle: `${m.descripcion} · Prioridad: ${m.prioridad} · Estado: ${m.estado}`,
        habitacion: m.habitacion_numero,
        meta: { prioridad: m.prioridad, estado: m.estado, resuelto_en: m.resuelto_en },
      });
    }
  }

  // ── Facturas emitidas ─────────────────────────────────────────────────────
  if (!tipo || tipo === 'factura') {
    const facturas = db.prepare(`
      SELECT f.id, f.numero, f.total, f.metodo_pago, f.estado, f.emitida_en,
             h.nombre || ' ' || h.apellido as huesped_nombre,
             hab.numero as habitacion_numero
      FROM facturas f
      JOIN huespedes h ON f.huesped_id = h.id
      JOIN reservas r ON f.reserva_id = r.id
      JOIN habitaciones hab ON r.habitacion_id = hab.id
      WHERE DATE(f.emitida_en) BETWEEN ? AND ?
      ${buscar ? `AND (h.nombre || ' ' || h.apellido LIKE ? OR f.numero LIKE ?)` : ''}
    `).all(fechaDesde, fechaHasta, ...(buscar ? [`%${buscar}%`, `%${buscar}%`] : []));

    for (const f of facturas) {
      eventos.push({
        id: `factura-${f.id}`,
        tipo: 'factura',
        fecha: f.emitida_en,
        titulo: `Factura ${f.numero} — ${f.huesped_nombre}`,
        detalle: `Hab. ${f.habitacion_numero} · Total: $${f.total} · Pago: ${f.metodo_pago}`,
        huesped: f.huesped_nombre,
        habitacion: f.habitacion_numero,
        meta: { numero: f.numero, total: f.total, metodo_pago: f.metodo_pago, estado: f.estado },
      });
    }
  }

  // Ordenar por fecha descendente y paginar
  eventos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  const total = eventos.length;
  const paginados = eventos.slice(offset, offset + limit);

  res.json({ eventos: paginados, total, page: parseInt(page), pages: Math.ceil(total / limit) });
});

module.exports = router;

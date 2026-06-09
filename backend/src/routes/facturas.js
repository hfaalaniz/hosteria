const express = require('express');
const { db } = require('../db/database');
const { auth } = require('../middleware/auth');

const router = express.Router();

function generarNumeroFactura() {
  const fecha = new Date();
  const año = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const count = db.prepare('SELECT COUNT(*) as c FROM facturas').get().c + 1;
  return `FAC-${año}${mes}-${String(count).padStart(4, '0')}`;
}

router.get('/', auth, (req, res) => {
  const facturas = db.prepare(`
    SELECT f.*, h.nombre || ' ' || h.apellido as huesped_nombre, r.codigo as reserva_codigo
    FROM facturas f
    JOIN huespedes h ON f.huesped_id = h.id
    JOIN reservas r ON f.reserva_id = r.id
    ORDER BY f.emitida_en DESC
  `).all();
  res.json(facturas);
});

router.get('/:id', auth, (req, res) => {
  const f = db.prepare(`
    SELECT f.*,
      h.nombre, h.apellido, h.email, h.telefono, h.documento_tipo, h.documento_numero, h.direccion,
      r.codigo as reserva_codigo, r.fecha_entrada, r.fecha_salida, r.noches,
      hab.numero as habitacion_numero, t.nombre as tipo_nombre
    FROM facturas f
    JOIN huespedes h ON f.huesped_id = h.id
    JOIN reservas r ON f.reserva_id = r.id
    JOIN habitaciones hab ON r.habitacion_id = hab.id
    JOIN tipos_habitacion t ON hab.tipo_id = t.id
    WHERE f.id = ?
  `).get(req.params.id);
  if (!f) return res.status(404).json({ error: 'Factura no encontrada' });

  const consumos = db.prepare(`
    SELECT c.*, s.nombre as servicio_nombre
    FROM consumos c LEFT JOIN servicios s ON c.servicio_id = s.id
    WHERE c.reserva_id = ?
  `).all(f.reserva_id);

  const config = db.prepare('SELECT clave, valor FROM configuracion').all()
    .reduce((acc, r) => ({ ...acc, [r.clave]: r.valor }), {});

  res.json({ ...f, consumos, config });
});

router.post('/', auth, (req, res) => {
  const { reserva_id, metodo_pago, descuento, notas } = req.body;
  if (!reserva_id) return res.status(400).json({ error: 'Reserva requerida' });

  const reserva = db.prepare('SELECT * FROM reservas WHERE id = ?').get(reserva_id);
  if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });

  try {
    const resultado = db.transaction(() => {
      const yaExiste = db.prepare("SELECT id FROM facturas WHERE reserva_id = ? AND estado != 'anulada'").get(reserva_id);
      if (yaExiste) throw Object.assign(new Error('Ya existe una factura para esta reserva'), { status: 400 });

      const consumos = db.prepare('SELECT SUM(total) as total FROM consumos WHERE reserva_id = ?').get(reserva_id);
      const configImp = db.prepare("SELECT valor FROM configuracion WHERE clave = 'impuesto_porcentaje'").get();
      const impPct = parseFloat(configImp?.valor || '0') / 100;

      const subtotal = reserva.precio_total + (consumos?.total || 0);
      const descuentoVal = descuento || 0;
      const base = subtotal - descuentoVal;
      const impuestos = base * impPct;
      const total = base + impuestos;

      const numero = generarNumeroFactura();
      const result = db.prepare(`
        INSERT INTO facturas (numero, reserva_id, huesped_id, subtotal, impuestos, descuento, total, metodo_pago, estado, notas)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pagada', ?)
      `).run(numero, reserva_id, reserva.huesped_id, subtotal, impuestos, descuentoVal, total, metodo_pago || 'efectivo', notas);

      if (reserva.estado === 'checkin') {
        db.prepare("UPDATE reservas SET estado = 'checkout', actualizado_en = CURRENT_TIMESTAMP WHERE id = ?").run(reserva_id);
        db.prepare("UPDATE habitaciones SET estado = 'limpieza' WHERE id = ?").run(reserva.habitacion_id);
      }

      return { id: result.lastInsertRowid, numero, total };
    })();

    res.status(201).json({ ...resultado, mensaje: 'Factura generada' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.patch('/:id/anular', auth, (req, res) => {
  db.prepare("UPDATE facturas SET estado = 'anulada' WHERE id = ?").run(req.params.id);
  res.json({ mensaje: 'Factura anulada' });
});

module.exports = router;

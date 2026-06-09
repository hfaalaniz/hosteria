import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';

export const facturas = new Hono();

function generarNumero(count) {
  const d = new Date();
  return `FAC-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}-${String(count+1).padStart(4,'0')}`;
}

facturas.get('/', authMiddleware, async c => {
  const { tenant_id } = c.get('user');
  const { results } = await c.env.DB.prepare(`SELECT f.*,h.nombre||' '||h.apellido as huesped_nombre,r.codigo as reserva_codigo FROM facturas f JOIN huespedes h ON f.huesped_id=h.id JOIN reservas r ON f.reserva_id=r.id WHERE f.tenant_id=? ORDER BY f.emitida_en DESC`).bind(tenant_id).all();
  return c.json(results);
});

facturas.get('/:id', authMiddleware, async c => {
  const { tenant_id } = c.get('user');
  const f = await c.env.DB.prepare(`SELECT f.*,h.nombre,h.apellido,h.email,h.telefono,h.documento_tipo,h.documento_numero,h.direccion,r.codigo as reserva_codigo,r.fecha_entrada,r.fecha_salida,r.noches,hab.numero as habitacion_numero,t.nombre as tipo_nombre FROM facturas f JOIN huespedes h ON f.huesped_id=h.id JOIN reservas r ON f.reserva_id=r.id JOIN habitaciones hab ON r.habitacion_id=hab.id JOIN tipos_habitacion t ON hab.tipo_id=t.id WHERE f.id=? AND f.tenant_id=?`).bind(c.req.param('id'), tenant_id).first();
  if (!f) return c.json({ error: 'Factura no encontrada' }, 404);
  const [{ results: consumos }, { results: cfgs }] = await Promise.all([
    c.env.DB.prepare(`SELECT c.*,s.nombre as servicio_nombre FROM consumos c LEFT JOIN servicios s ON c.servicio_id=s.id WHERE c.reserva_id=? AND c.tenant_id=?`).bind(f.reserva_id, tenant_id).all(),
    c.env.DB.prepare('SELECT clave,valor FROM configuracion_mt WHERE tenant_id=?').bind(tenant_id).all(),
  ]);
  const config = cfgs.reduce((a, r) => ({ ...a, [r.clave]: r.valor }), {});
  return c.json({ ...f, consumos, config });
});

facturas.post('/', authMiddleware, async c => {
  const { tenant_id } = c.get('user');
  const { reserva_id, metodo_pago, descuento, notas } = await c.req.json();
  if (!reserva_id) return c.json({ error: 'Reserva requerida' }, 400);
  const reserva = await c.env.DB.prepare('SELECT * FROM reservas WHERE id=? AND tenant_id=?').bind(reserva_id, tenant_id).first();
  if (!reserva) return c.json({ error: 'Reserva no encontrada' }, 404);

  try {
    const yaExiste = await c.env.DB.prepare("SELECT id FROM facturas WHERE reserva_id=? AND tenant_id=? AND estado!='anulada'").bind(reserva_id, tenant_id).first();
    if (yaExiste) return c.json({ error: 'Ya existe una factura para esta reserva' }, 400);

    const [{ results: cons }, configImp, { results: [{ c: count }] }] = await Promise.all([
      c.env.DB.prepare('SELECT SUM(total) as total FROM consumos WHERE reserva_id=? AND tenant_id=?').bind(reserva_id, tenant_id).all(),
      c.env.DB.prepare("SELECT valor FROM configuracion_mt WHERE tenant_id=? AND clave='impuesto_porcentaje'").bind(tenant_id).first(),
      c.env.DB.prepare('SELECT COUNT(*) as c FROM facturas WHERE tenant_id=?').bind(tenant_id).all(),
    ]);

    const impPct = parseFloat(configImp?.valor || '0') / 100;
    const subtotal = reserva.precio_total + (cons[0]?.total || 0);
    const descuentoVal = descuento || 0;
    const base = subtotal - descuentoVal;
    const impuestos = base * impPct;
    const total = base + impuestos;
    const numero = generarNumero(count);

    const stmts = [
      c.env.DB.prepare('INSERT INTO facturas (tenant_id,numero,reserva_id,huesped_id,subtotal,impuestos,descuento,total,metodo_pago,estado,notas) VALUES (?,?,?,?,?,?,?,?,?,\'pagada\',?)').bind(tenant_id, numero, reserva_id, reserva.huesped_id, subtotal, impuestos, descuentoVal, total, metodo_pago||'efectivo', notas),
    ];
    if (reserva.estado === 'checkin') {
      stmts.push(c.env.DB.prepare("UPDATE reservas SET estado='checkout',actualizado_en=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?").bind(reserva_id, tenant_id));
      stmts.push(c.env.DB.prepare("UPDATE habitaciones SET estado='limpieza' WHERE id=? AND tenant_id=?").bind(reserva.habitacion_id, tenant_id));
    }
    const [result] = await c.env.DB.batch(stmts);
    return c.json({ id: result.meta.last_row_id, numero, total, mensaje: 'Factura generada' }, 201);
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

facturas.patch('/:id/anular', authMiddleware, async c => {
  const { tenant_id } = c.get('user');
  await c.env.DB.prepare("UPDATE facturas SET estado='anulada' WHERE id=? AND tenant_id=?").bind(c.req.param('id'), tenant_id).run();
  return c.json({ mensaje: 'Factura anulada' });
});

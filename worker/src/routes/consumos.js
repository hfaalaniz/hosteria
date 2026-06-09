import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';

export const consumos = new Hono();

consumos.get('/reserva/:reserva_id', authMiddleware, async c => {
  const { tenant_id } = c.get('user');
  const { results } = await c.env.DB.prepare(`SELECT c.*,s.nombre as servicio_nombre,s.categoria FROM consumos c LEFT JOIN servicios s ON c.servicio_id=s.id WHERE c.reserva_id=? AND c.tenant_id=? ORDER BY c.fecha DESC`).bind(c.req.param('reserva_id'), tenant_id).all();
  return c.json(results);
});

consumos.post('/', authMiddleware, async c => {
  const { tenant_id } = c.get('user');
  const { reserva_id, servicio_id, descripcion, cantidad, precio_unitario } = await c.req.json();
  if (!reserva_id || !descripcion || !precio_unitario) return c.json({ error: 'Datos incompletos' }, 400);
  const precioNum = Number(precio_unitario);
  const cantNum = Number(cantidad) || 1;
  if (!Number.isFinite(precioNum) || precioNum <= 0) return c.json({ error: 'El precio debe ser un número positivo' }, 400);
  if (!Number.isFinite(cantNum) || cantNum <= 0) return c.json({ error: 'La cantidad debe ser un número positivo' }, 400);
  const total = cantNum * precioNum;
  const { meta } = await c.env.DB.prepare('INSERT INTO consumos (tenant_id,reserva_id,servicio_id,descripcion,cantidad,precio_unitario,total) VALUES (?,?,?,?,?,?,?)')
    .bind(tenant_id, reserva_id, servicio_id||null, descripcion, cantNum, precioNum, total).run();
  return c.json({ id: meta.last_row_id, mensaje: 'Consumo registrado' }, 201);
});

consumos.delete('/:id', authMiddleware, async c => {
  const { tenant_id } = c.get('user');
  await c.env.DB.prepare('DELETE FROM consumos WHERE id=? AND tenant_id=?').bind(c.req.param('id'), tenant_id).run();
  return c.json({ mensaje: 'Consumo eliminado' });
});

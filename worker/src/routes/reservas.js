import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { emailConfirmacionReserva, emailSeniaCobrada, emailRecordatorio } from '../services/email.js';

export const reservas = new Hono();

function generarCodigo() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'RES-';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function calcularNoches(entrada, salida) {
  return Math.round((new Date(salida) - new Date(entrada)) / 86400000);
}

reservas.get('/', authMiddleware, async c => {
  const { tenant_id } = c.get('user');
  const { estado, fecha_inicio, fecha_fin, huesped_id, habitacion_id, busqueda } = c.req.query();
  let q = `SELECT r.*, h.nombre||' '||h.apellido as huesped_nombre, h.email as huesped_email, h.telefono as huesped_telefono,
    hab.numero as habitacion_numero, hab.piso as habitacion_piso, t.nombre as tipo_nombre
    FROM reservas r JOIN huespedes h ON r.huesped_id=h.id JOIN habitaciones hab ON r.habitacion_id=hab.id JOIN tipos_habitacion t ON hab.tipo_id=t.id
    WHERE r.tenant_id=?`;
  const params = [tenant_id];
  if (estado) { q += ' AND r.estado=?'; params.push(estado); }
  if (fecha_inicio) { q += ' AND r.fecha_entrada>=?'; params.push(fecha_inicio); }
  if (fecha_fin) { q += ' AND r.fecha_salida<=?'; params.push(fecha_fin); }
  if (huesped_id) { q += ' AND r.huesped_id=?'; params.push(huesped_id); }
  if (habitacion_id) { q += ' AND r.habitacion_id=?'; params.push(habitacion_id); }
  if (busqueda) {
    q += ` AND ((h.nombre||' '||h.apellido) LIKE ? OR h.email LIKE ? OR r.codigo LIKE ? OR CAST(hab.numero AS TEXT) LIKE ?)`;
    const like = `%${busqueda}%`;
    params.push(like, like, like, like);
  }
  q += ' ORDER BY r.fecha_entrada DESC';
  const { results } = await c.env.DB.prepare(q).bind(...params).all();
  return c.json(results);
});

reservas.get('/calendario', authMiddleware, async c => {
  const { tenant_id } = c.get('user');
  const hoy = new Date().toISOString().split('T')[0];
  const fecha_inicio = c.req.query('fecha_inicio') || hoy;
  const semanas = Math.min(parseInt(c.req.query('semanas')) || 4, 12);
  const dt = new Date(fecha_inicio); dt.setDate(dt.getDate() + semanas * 7);
  const fecha_fin = dt.toISOString().split('T')[0];
  const [{ results: habs }, { results: resv }] = await Promise.all([
    c.env.DB.prepare(`SELECT h.id,h.numero,h.piso,h.estado,t.nombre as tipo_nombre,t.capacidad FROM habitaciones h JOIN tipos_habitacion t ON h.tipo_id=t.id WHERE h.tenant_id=? AND h.estado!='mantenimiento' ORDER BY h.piso,h.numero`).bind(tenant_id).all(),
    c.env.DB.prepare(`SELECT r.id,r.codigo,r.habitacion_id,r.fecha_entrada,r.fecha_salida,r.estado,r.adultos,r.ninos,r.precio_total,r.origen,r.noches,hu.nombre||' '||hu.apellido as huesped_nombre FROM reservas r JOIN huespedes hu ON r.huesped_id=hu.id WHERE r.tenant_id=? AND r.estado NOT IN ('cancelada','noshow') AND r.fecha_entrada<? AND r.fecha_salida>? ORDER BY r.fecha_entrada`).bind(tenant_id, fecha_fin, fecha_inicio).all(),
  ]);
  return c.json({ habitaciones: habs, reservas: resv, fecha_inicio, fecha_fin, dias: semanas * 7 });
});

reservas.get('/alertas/noshow', authMiddleware, async c => {
  const { tenant_id } = c.get('user');
  const hoy = new Date().toISOString().split('T')[0];
  const { results } = await c.env.DB.prepare(`SELECT r.id,r.codigo,r.estado,r.fecha_entrada,r.fecha_salida,r.noches,r.precio_total,h.nombre||' '||h.apellido as huesped_nombre,h.email as huesped_email,hab.numero as habitacion_numero,t.nombre as tipo_nombre FROM reservas r JOIN huespedes h ON r.huesped_id=h.id JOIN habitaciones hab ON r.habitacion_id=hab.id JOIN tipos_habitacion t ON hab.tipo_id=t.id WHERE r.tenant_id=? AND r.estado IN ('confirmada','pendiente') AND r.fecha_entrada<? ORDER BY r.fecha_entrada`).bind(tenant_id, hoy).all();
  return c.json(results);
});

reservas.get('/:id', authMiddleware, async c => {
  const { tenant_id } = c.get('user');
  const r = await c.env.DB.prepare(`SELECT r.*,h.nombre||' '||h.apellido as huesped_nombre,h.email as huesped_email,h.telefono as huesped_telefono,h.documento_tipo,h.documento_numero,h.nacionalidad,hab.numero as habitacion_numero,t.nombre as tipo_nombre,t.capacidad FROM reservas r JOIN huespedes h ON r.huesped_id=h.id JOIN habitaciones hab ON r.habitacion_id=hab.id JOIN tipos_habitacion t ON hab.tipo_id=t.id WHERE r.id=? AND r.tenant_id=?`).bind(c.req.param('id'), tenant_id).first();
  if (!r) return c.json({ error: 'Reserva no encontrada' }, 404);
  const { results: consumos } = await c.env.DB.prepare(`SELECT c.*,s.nombre as servicio_nombre,s.categoria FROM consumos c LEFT JOIN servicios s ON c.servicio_id=s.id WHERE c.reserva_id=? AND c.tenant_id=?`).bind(c.req.param('id'), tenant_id).all();
  return c.json({ ...r, consumos });
});

reservas.post('/', authMiddleware, async c => {
  const { tenant_id } = c.get('user');
  try {
    let { huesped_id, huesped, habitacion_id, fecha_entrada, fecha_salida, adultos, ninos, origen, precio_noche, notas, acompanantes } = await c.req.json();

    if (!huesped_id && huesped) {
      const { nombre, apellido, email, telefono, nacionalidad, documento_tipo, documento_numero } = huesped;
      if (!nombre || !apellido) return c.json({ error: 'Nombre y apellido del huésped son requeridos' }, 400);
      let existente = null;
      if (email) existente = await c.env.DB.prepare('SELECT id FROM huespedes WHERE email=? AND tenant_id=?').bind(email, tenant_id).first();
      if (!existente && documento_numero) existente = await c.env.DB.prepare('SELECT id FROM huespedes WHERE documento_numero=? AND tenant_id=?').bind(documento_numero, tenant_id).first();
      if (existente) { huesped_id = existente.id; }
      else {
        const { meta } = await c.env.DB.prepare('INSERT INTO huespedes (tenant_id,nombre,apellido,email,telefono,nacionalidad,documento_tipo,documento_numero) VALUES (?,?,?,?,?,?,?,?)')
          .bind(tenant_id, nombre, apellido, email||null, telefono||null, nacionalidad||null, documento_tipo||'DNI', documento_numero||null).run();
        huesped_id = meta.last_row_id;
      }
    }
    if (!huesped_id || !habitacion_id || !fecha_entrada || !fecha_salida) return c.json({ error: 'Huésped, habitación y fechas son requeridos' }, 400);

    const noches = calcularNoches(fecha_entrada, fecha_salida);
    if (noches <= 0) return c.json({ error: 'Las fechas son inválidas' }, 400);
    const precioNocheNum = Number(precio_noche);
    if (!Number.isFinite(precioNocheNum) || precioNocheNum <= 0) return c.json({ error: 'El precio por noche debe ser un número positivo' }, 400);
    const precio_total = precioNocheNum * noches;

    let codigo = generarCodigo();
    while (await c.env.DB.prepare('SELECT id FROM reservas WHERE codigo=? AND tenant_id=?').bind(codigo, tenant_id).first()) codigo = generarCodigo();

    const conflicto = await c.env.DB.prepare(`SELECT id FROM reservas WHERE habitacion_id=? AND tenant_id=? AND estado NOT IN ('cancelada','checkout','noshow') AND fecha_entrada<? AND fecha_salida>?`).bind(habitacion_id, tenant_id, fecha_salida, fecha_entrada).first();
    if (conflicto) return c.json({ error: 'La habitación no está disponible en esas fechas' }, 400);

    await c.env.DB.prepare('INSERT INTO reservas (tenant_id,codigo,huesped_id,habitacion_id,fecha_entrada,fecha_salida,adultos,ninos,estado,origen,precio_total,precio_noche,noches,notas) VALUES (?,?,?,?,?,?,?,?,\'confirmada\',?,?,?,?,?)')
      .bind(tenant_id, codigo, huesped_id, habitacion_id, fecha_entrada, fecha_salida, adultos||1, ninos||0, origen||'directo', precio_total, precioNocheNum, noches, notas||null).run();
    const reserva = await c.env.DB.prepare('SELECT id FROM reservas WHERE codigo=? AND tenant_id=?').bind(codigo, tenant_id).first();
    const reservaId = reserva.id;

    if (Array.isArray(acompanantes) && acompanantes.length > 0) {
      await c.env.DB.batch(acompanantes.filter(a => a.nombre).map(a =>
        c.env.DB.prepare('INSERT INTO reserva_acompanantes (tenant_id,reserva_id,tipo,nombre,documento_tipo,documento_numero,edad) VALUES (?,?,?,?,?,?,?)')
          .bind(tenant_id, reservaId, a.tipo||'adulto', a.nombre, a.documento_tipo||null, a.documento_numero||null, a.edad||null)
      ));
    }

    const rEmail = await c.env.DB.prepare(`SELECT r.codigo,r.estado,r.fecha_entrada,r.fecha_salida,r.noches,r.adultos,r.ninos,r.precio_total,r.senia,h.nombre||' '||h.apellido as huesped_nombre,h.email as huesped_email,hab.numero as habitacion_numero,t.nombre as tipo_nombre FROM reservas r JOIN huespedes h ON r.huesped_id=h.id JOIN habitaciones hab ON r.habitacion_id=hab.id JOIN tipos_habitacion t ON hab.tipo_id=t.id WHERE r.id=?`).bind(reservaId).first();
    if (rEmail?.huesped_email) emailConfirmacionReserva(c.env.DB, rEmail, tenant_id).catch(() => {});

    return c.json({ id: reservaId, codigo, mensaje: 'Reserva creada' }, 201);
  } catch (err) {
    return c.json({ error: err.message }, err.status || 500);
  }
});

reservas.put('/:id', authMiddleware, async c => {
  const { tenant_id } = c.get('user');
  const { fecha_entrada, fecha_salida, adultos, ninos, origen, precio_noche, notas, notas_internas } = await c.req.json();
  const r = await c.env.DB.prepare('SELECT * FROM reservas WHERE id=? AND tenant_id=?').bind(c.req.param('id'), tenant_id).first();
  if (!r) return c.json({ error: 'Reserva no encontrada' }, 404);
  const noches = calcularNoches(fecha_entrada, fecha_salida);
  await c.env.DB.prepare('UPDATE reservas SET fecha_entrada=?,fecha_salida=?,adultos=?,ninos=?,origen=?,precio_noche=?,precio_total=?,noches=?,notas=?,notas_internas=?,actualizado_en=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?')
    .bind(fecha_entrada, fecha_salida, adultos, ninos, origen, precio_noche, precio_noche*noches, noches, notas, notas_internas, c.req.param('id'), tenant_id).run();
  return c.json({ mensaje: 'Reserva actualizada' });
});

reservas.patch('/:id/notas', authMiddleware, async c => {
  const { tenant_id } = c.get('user');
  const { notas, notas_internas } = await c.req.json();
  await c.env.DB.prepare('UPDATE reservas SET notas=?,notas_internas=?,actualizado_en=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?').bind(notas??null, notas_internas??null, c.req.param('id'), tenant_id).run();
  return c.json({ mensaje: 'Notas actualizadas' });
});

reservas.patch('/:id/senia', authMiddleware, async c => {
  const { tenant_id } = c.get('user');
  const { metodo } = await c.req.json();
  const metodos = ['efectivo','transferencia','tarjeta','otro'];
  if (!metodos.includes(metodo)) return c.json({ error: 'Método inválido' }, 400);
  const reserva = await c.env.DB.prepare(`SELECT r.*,h.nombre||' '||h.apellido as huesped_nombre,h.email as huesped_email,hab.numero as habitacion_numero,t.nombre as tipo_nombre FROM reservas r JOIN huespedes h ON r.huesped_id=h.id JOIN habitaciones hab ON r.habitacion_id=hab.id JOIN tipos_habitacion t ON hab.tipo_id=t.id WHERE r.id=? AND r.tenant_id=?`).bind(c.req.param('id'), tenant_id).first();
  if (!reserva) return c.json({ error: 'Reserva no encontrada' }, 404);
  if (!reserva.senia) return c.json({ error: 'Esta reserva no tiene seña registrada' }, 400);
  const fecha = new Date().toISOString().split('T')[0];
  await c.env.DB.prepare('UPDATE reservas SET senia_cobrada=1,senia_metodo=?,senia_fecha=?,actualizado_en=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?').bind(metodo, fecha, c.req.param('id'), tenant_id).run();
  if (reserva.huesped_email) emailSeniaCobrada(c.env.DB, { ...reserva, senia_metodo: metodo }, tenant_id).catch(() => {});
  return c.json({ mensaje: 'Seña registrada como cobrada' });
});

reservas.post('/:id/recordatorio', authMiddleware, async c => {
  const { tenant_id } = c.get('user');
  const reserva = await c.env.DB.prepare(`SELECT r.*,h.nombre||' '||h.apellido as huesped_nombre,h.email as huesped_email,hab.numero as habitacion_numero,t.nombre as tipo_nombre FROM reservas r JOIN huespedes h ON r.huesped_id=h.id JOIN habitaciones hab ON r.habitacion_id=hab.id JOIN tipos_habitacion t ON hab.tipo_id=t.id WHERE r.id=? AND r.tenant_id=?`).bind(c.req.param('id'), tenant_id).first();
  if (!reserva) return c.json({ error: 'Reserva no encontrada' }, 404);
  if (!reserva.huesped_email) return c.json({ error: 'El huésped no tiene email registrado' }, 400);
  try {
    await emailRecordatorio(c.env.DB, reserva, tenant_id);
    return c.json({ mensaje: 'Recordatorio enviado' });
  } catch (err) {
    return c.json({ error: 'Error al enviar email: ' + err.message }, 500);
  }
});

reservas.patch('/:id/estado', authMiddleware, async c => {
  const { tenant_id } = c.get('user');
  const { estado } = await c.req.json();
  const estados = ['pendiente','confirmada','checkin','checkout','cancelada','noshow'];
  if (!estados.includes(estado)) return c.json({ error: 'Estado inválido' }, 400);
  const reserva = await c.env.DB.prepare('SELECT * FROM reservas WHERE id=? AND tenant_id=?').bind(c.req.param('id'), tenant_id).first();
  if (!reserva) return c.json({ error: 'Reserva no encontrada' }, 404);

  let penalidad = null, diasAnticipacion = null, seniaSeDev = null;
  const stmts = [];
  if (estado === 'cancelada') {
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const entrada = new Date(reserva.fecha_entrada + 'T00:00:00');
    diasAnticipacion = Math.round((entrada - hoy) / 86400000);
    penalidad = diasAnticipacion < 3 ? 1 : 0;
    seniaSeDev = penalidad === 0;
    stmts.push(c.env.DB.prepare('UPDATE reservas SET estado=?,cancelacion_penalidad=?,cancelacion_dias_anticipacion=?,actualizado_en=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?').bind(estado, penalidad, diasAnticipacion, c.req.param('id'), tenant_id));
  } else {
    stmts.push(c.env.DB.prepare('UPDATE reservas SET estado=?,actualizado_en=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?').bind(estado, c.req.param('id'), tenant_id));
  }
  if (estado === 'checkin') stmts.push(c.env.DB.prepare("UPDATE habitaciones SET estado='ocupada' WHERE id=? AND tenant_id=?").bind(reserva.habitacion_id, tenant_id));
  else if (estado === 'checkout') stmts.push(c.env.DB.prepare("UPDATE habitaciones SET estado='limpieza' WHERE id=? AND tenant_id=?").bind(reserva.habitacion_id, tenant_id));
  else if (estado === 'cancelada' || estado === 'noshow') {
    const hab = await c.env.DB.prepare("SELECT estado FROM habitaciones WHERE id=? AND tenant_id=?").bind(reserva.habitacion_id, tenant_id).first();
    if (hab?.estado === 'ocupada') stmts.push(c.env.DB.prepare("UPDATE habitaciones SET estado='disponible' WHERE id=? AND tenant_id=?").bind(reserva.habitacion_id, tenant_id));
  }
  await c.env.DB.batch(stmts);

  const respuesta = { mensaje: 'Estado actualizado' };
  if (estado === 'cancelada') respuesta.cancelacion = { dias_anticipacion: diasAnticipacion, penalidad: penalidad === 1, senia_se_devuelve: seniaSeDev, senia_monto: reserva.senia ?? null };
  return c.json(respuesta);
});

reservas.patch('/:id/extender', authMiddleware, async c => {
  const { tenant_id } = c.get('user');
  const { nueva_fecha_salida } = await c.req.json();
  if (!nueva_fecha_salida) return c.json({ error: 'nueva_fecha_salida requerida' }, 400);
  const reserva = await c.env.DB.prepare('SELECT * FROM reservas WHERE id=? AND tenant_id=?').bind(c.req.param('id'), tenant_id).first();
  if (!reserva) return c.json({ error: 'Reserva no encontrada' }, 404);
  if (reserva.estado !== 'checkin') return c.json({ error: 'Solo se puede extender una reserva con checkin activo' }, 400);
  if (nueva_fecha_salida <= reserva.fecha_salida) return c.json({ error: 'La nueva fecha de salida debe ser posterior a la actual' }, 400);
  const conflicto = await c.env.DB.prepare(`SELECT id FROM reservas WHERE habitacion_id=? AND tenant_id=? AND id!=? AND estado NOT IN ('cancelada','checkout','noshow') AND fecha_entrada<? AND fecha_salida>?`).bind(reserva.habitacion_id, tenant_id, reserva.id, nueva_fecha_salida, reserva.fecha_salida).first();
  if (conflicto) return c.json({ error: 'La habitación tiene otra reserva en las fechas adicionales' }, 400);
  const nuevasNoches = Math.round((new Date(nueva_fecha_salida) - new Date(reserva.fecha_entrada)) / 86400000);
  const nuevoPrecioTotal = Math.round(reserva.precio_noche * nuevasNoches * 100) / 100;
  await c.env.DB.prepare('UPDATE reservas SET fecha_salida=?,noches=?,precio_total=?,actualizado_en=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?').bind(nueva_fecha_salida, nuevasNoches, nuevoPrecioTotal, c.req.param('id'), tenant_id).run();
  return c.json({ mensaje: 'Estadía extendida', noches: nuevasNoches, precio_total: nuevoPrecioTotal });
});

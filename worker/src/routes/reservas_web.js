import { Hono } from 'hono';
import { emailConfirmacionReserva } from '../services/email.js';

export const reservasWeb = new Hono();

reservasWeb.get('/config', async c => {
  const claves = ['nombre_hosteria','direccion','telefono','email','hora_checkin','hora_checkout','pago_cbu','pago_alias','pago_titular','pago_banco','pago_instrucciones','descuentos_noches'];
  const { results } = await c.env.DB.prepare(`SELECT clave,valor FROM configuracion WHERE clave IN (${claves.map(()=>'?').join(',')})`).bind(...claves).all();
  return c.json(results.reduce((a, r) => ({ ...a, [r.clave]: r.valor }), {}));
});

reservasWeb.get('/habitaciones', async c => {
  const hoy = new Date().toISOString().split('T')[0];
  const { results } = await c.env.DB.prepare(`
    SELECT h.id,h.numero,h.piso,h.descripcion,h.metros_cuadrados,h.vista,h.bano_privado,h.camas,h.precio_override,h.estado,
           t.id as tipo_id,t.nombre as tipo_nombre,t.descripcion as tipo_descripcion,t.capacidad,t.precio_base,t.precio_fin_semana,t.amenidades,t.imagen,
           CASE WHEN h.estado='mantenimiento' THEN 'mantenimiento' WHEN h.estado='ocupada' THEN 'ocupada'
                WHEN EXISTS (SELECT 1 FROM reservas r WHERE r.habitacion_id=h.id AND r.estado NOT IN ('cancelada','checkout','noshow') AND r.fecha_entrada<=? AND r.fecha_salida>?) THEN 'ocupada'
                ELSE 'disponible' END as estado_real
    FROM habitaciones h JOIN tipos_habitacion t ON h.tipo_id=t.id WHERE t.activo=1 ORDER BY h.piso,h.numero`).bind(hoy, hoy).all();
  return c.json(results.map(h => ({ ...h, amenidades: JSON.parse(h.amenidades||'[]'), camas: JSON.parse(h.camas||'[]'), precio_noche: h.precio_override ?? h.precio_base, estado: h.estado_real })));
});

reservasWeb.get('/disponibilidad', async c => {
  const { fecha_entrada, fecha_salida, adultos } = c.req.query();
  if (!fecha_entrada || !fecha_salida) return c.json({ error: 'Fechas requeridas' }, 400);
  const noches = Math.round((new Date(fecha_salida) - new Date(fecha_entrada)) / 86400000);
  if (noches <= 0) return c.json({ error: 'Fechas inválidas' }, 400);
  const esFinDeSemana = [5, 6].includes(new Date(fecha_entrada).getDay());
  const { results } = await c.env.DB.prepare(`
    SELECT h.id,h.numero,h.piso,h.descripcion,h.metros_cuadrados,h.vista,h.bano_privado,h.camas,h.precio_override,
           t.id as tipo_id,t.nombre as tipo_nombre,t.capacidad,t.precio_base,t.precio_fin_semana,t.amenidades,t.imagen
    FROM habitaciones h JOIN tipos_habitacion t ON h.tipo_id=t.id WHERE t.activo=1 AND h.estado NOT IN ('mantenimiento','ocupada')
    AND h.id NOT IN (SELECT habitacion_id FROM reservas WHERE estado NOT IN ('cancelada','checkout','noshow') AND fecha_entrada<? AND fecha_salida>?)
    ORDER BY h.piso,h.numero`).bind(fecha_salida, fecha_entrada).all();
  const resultado = results.map(h => {
    const precioBase = esFinDeSemana && h.precio_fin_semana ? h.precio_fin_semana : h.precio_base;
    const precio_noche = h.precio_override ?? precioBase;
    return { ...h, amenidades: JSON.parse(h.amenidades||'[]'), camas: JSON.parse(h.camas||'[]'), precio_noche, precio_total: precio_noche * noches, noches };
  }).filter(h => !adultos || h.capacidad >= parseInt(adultos));
  return c.json(resultado);
});

reservasWeb.post('/reservar', async c => {
  const { habitacion_id, fecha_entrada, fecha_salida, adultos, ninos, precio_noche, huesped, senia } = await c.req.json();
  if (!habitacion_id || !fecha_entrada || !fecha_salida || !huesped?.nombre || !huesped?.apellido || !huesped?.email) return c.json({ error: 'Datos incompletos' }, 400);

  const conflicto = await c.env.DB.prepare(`SELECT id FROM reservas WHERE habitacion_id=? AND estado NOT IN ('cancelada','checkout','noshow') AND fecha_entrada<? AND fecha_salida>?`).bind(habitacion_id, fecha_salida, fecha_entrada).first();
  if (conflicto) return c.json({ error: 'La habitación ya no está disponible para esas fechas' }, 400);

  const noches = Math.round((new Date(fecha_salida) - new Date(fecha_entrada)) / 86400000);
  const precio_total = precio_noche * noches;
  const seniaVal = senia != null ? Number(senia) : Math.round(precio_total * 0.10 * 100) / 100;

  let huespedId;
  const existe = await c.env.DB.prepare('SELECT id FROM huespedes WHERE email=?').bind(huesped.email).first();
  if (existe) { huespedId = existe.id; }
  else {
    const { meta } = await c.env.DB.prepare('INSERT INTO huespedes (nombre,apellido,email,telefono,nacionalidad,documento_tipo,documento_numero) VALUES (?,?,?,?,?,?,?)').bind(huesped.nombre, huesped.apellido, huesped.email, huesped.telefono||null, huesped.nacionalidad||null, huesped.documento_tipo||null, huesped.documento_numero||null).run();
    huespedId = meta.last_row_id;
  }

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let codigo = 'WEB-' + Array.from({length:6}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
  while (await c.env.DB.prepare('SELECT id FROM reservas WHERE codigo=?').bind(codigo).first()) codigo = 'WEB-' + Array.from({length:6}, () => chars[Math.floor(Math.random()*chars.length)]).join('');

  const [insRes, habInfo] = await Promise.all([
    c.env.DB.prepare(`INSERT INTO reservas (codigo,huesped_id,habitacion_id,fecha_entrada,fecha_salida,adultos,ninos,estado,origen,precio_total,precio_noche,noches,senia) VALUES (?,?,?,?,?,?,?,'pendiente','web',?,?,?,?)`)
      .bind(codigo, huespedId, habitacion_id, fecha_entrada, fecha_salida, adultos||1, ninos||0, precio_total, precio_noche, noches, seniaVal).run(),
    c.env.DB.prepare('SELECT numero FROM habitaciones WHERE id=?').bind(habitacion_id).first(),
  ]);
  const reservaId = insRes.meta.last_row_id;

  // Notificación
  await c.env.DB.prepare('INSERT INTO notificaciones (tipo,titulo,mensaje,link,referencia_id,referencia_tipo) VALUES (?,?,?,?,?,?)').bind('reserva_web', `Nueva reserva web — Hab. ${habInfo?.numero||habitacion_id}`, `${huesped.nombre} ${huesped.apellido} · ${fecha_entrada} → ${fecha_salida} · ${noches} noche(s)`, '/reservas', reservaId, 'reservas').run();

  // Email
  const rEmail = await c.env.DB.prepare(`SELECT r.codigo,r.estado,r.fecha_entrada,r.fecha_salida,r.noches,r.adultos,r.ninos,r.precio_total,r.senia,h.nombre||' '||h.apellido as huesped_nombre,h.email as huesped_email,hab.numero as habitacion_numero,t.nombre as tipo_nombre FROM reservas r JOIN huespedes h ON r.huesped_id=h.id JOIN habitaciones hab ON r.habitacion_id=hab.id JOIN tipos_habitacion t ON hab.tipo_id=t.id WHERE r.id=?`).bind(reservaId).first();
  if (rEmail?.huesped_email) emailConfirmacionReserva(c.env.DB, rEmail).catch(() => {});

  return c.json({ codigo, id: reservaId, senia: seniaVal, mensaje: 'Reserva recibida.' }, 201);
});

reservasWeb.get('/ocupacion/:hab_id', async c => {
  const hoy = new Date().toISOString().split('T')[0];
  const fin = new Date(); fin.setMonth(fin.getMonth() + 4);
  const finStr = fin.toISOString().split('T')[0];
  const { results } = await c.env.DB.prepare(`SELECT fecha_entrada,fecha_salida FROM reservas WHERE habitacion_id=? AND estado NOT IN ('cancelada','checkout','noshow') AND fecha_salida>? AND fecha_entrada<?`).bind(c.req.param('hab_id'), hoy, finStr).all();
  const diasOcupados = new Set();
  for (const r of results) {
    const d = new Date(r.fecha_entrada + 'T00:00:00');
    const end = new Date(r.fecha_salida + 'T00:00:00');
    while (d < end) { diasOcupados.add(d.toISOString().split('T')[0]); d.setDate(d.getDate() + 1); }
  }
  return c.json({ hab_id: c.req.param('hab_id'), dias_ocupados: [...diasOcupados] });
});

reservasWeb.get('/estado/:codigo', async c => {
  const r = await c.env.DB.prepare(`SELECT r.codigo,r.estado,r.fecha_entrada,r.fecha_salida,r.noches,r.adultos,r.ninos,r.precio_total,h.nombre||' '||h.apellido as huesped_nombre,hab.numero as habitacion_numero,t.nombre as tipo_nombre FROM reservas r JOIN huespedes h ON r.huesped_id=h.id JOIN habitaciones hab ON r.habitacion_id=hab.id JOIN tipos_habitacion t ON hab.tipo_id=t.id WHERE r.codigo=?`).bind(c.req.param('codigo')).first();
  if (!r) return c.json({ error: 'Reserva no encontrada' }, 404);
  return c.json(r);
});

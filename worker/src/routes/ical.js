import { Hono } from 'hono';

export const ical = new Hono();

function toICalDate(dateStr) { return dateStr.replace(/-/g, ''); }
function toICalDateTime(date) { return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }

// Public endpoint — no auth, needed for Booking/Airbnb integration
ical.get('/:hab_id.ics', async c => {
  const hab_id = c.req.param('hab_id');

  const hab = await c.env.DB.prepare(`SELECT h.id,h.numero,h.tenant_id,t.nombre as tipo_nombre FROM habitaciones h JOIN tipos_habitacion t ON h.tipo_id=t.id WHERE h.id=?`).bind(hab_id).first();
  if (!hab) return c.text('Habitación no encontrada', 404);

  const [cfgRow, reservasRes] = await Promise.all([
    c.env.DB.prepare(`SELECT valor FROM configuracion_mt WHERE tenant_id=? AND clave='nombre_hosteria'`).bind(hab.tenant_id).first(),
    c.env.DB.prepare(`SELECT r.codigo,r.fecha_entrada,r.fecha_salida,r.adultos,r.ninos,h.nombre||' '||h.apellido as huesped_nombre FROM reservas r JOIN huespedes h ON r.huesped_id=h.id WHERE r.habitacion_id=? AND r.tenant_id=? AND r.estado NOT IN ('cancelada','checkout','noshow') AND r.fecha_salida>=date('now') ORDER BY r.fecha_entrada`).bind(hab_id, hab.tenant_id).all(),
  ]);

  const nombreHosteria = cfgRow?.valor || 'Hostería';
  const reservas = reservasRes.results;

  const ahora = toICalDateTime(new Date());
  const eventos = reservas.map(r => [
    'BEGIN:VEVENT',
    `UID:${r.codigo}@hosteria`,
    `DTSTAMP:${ahora}`,
    `DTSTART;VALUE=DATE:${toICalDate(r.fecha_entrada)}`,
    `DTEND;VALUE=DATE:${toICalDate(r.fecha_salida)}`,
    `SUMMARY:BLOQUEADO - ${nombreHosteria}`,
    `DESCRIPTION:Reserva ${r.codigo}`,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'END:VEVENT',
  ].join('\r\n')).join('\r\n');

  const cal = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${nombreHosteria}//Hosteria System//ES`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:Hab. ${hab.numero} - ${hab.tipo_nombre}`,
    `X-WR-CALDESC:Disponibilidad ${nombreHosteria} - Habitacion ${hab.numero}`,
    'X-WR-TIMEZONE:America/Argentina/Buenos_Aires',
    eventos,
    'END:VCALENDAR',
  ].join('\r\n');

  return new Response(cal, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="hab_${hab.numero}.ics"`,
      'Cache-Control': 'no-cache, no-store',
    },
  });
});

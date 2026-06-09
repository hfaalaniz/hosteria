const express = require('express');
const { db } = require('../db/database');

const router = express.Router();

// Genera un UUID v4 simple sin dependencias
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// Formatea fecha a iCal: YYYYMMDD
function toICalDate(dateStr) {
  return dateStr.replace(/-/g, '');
}

// Formatea datetime a iCal UTC: YYYYMMDDTHHmmssZ
function toICalDateTime(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// GET /ical/:hab_id.ics  — sin autenticación (Booking/Airbnb necesitan acceso público)
router.get('/:hab_id.ics', (req, res) => {
  const hab_id = req.params.hab_id;

  const hab = db.prepare(`
    SELECT h.id, h.numero, t.nombre as tipo_nombre
    FROM habitaciones h
    JOIN tipos_habitacion t ON h.tipo_id = t.id
    WHERE h.id = ?
  `).get(hab_id);

  if (!hab) return res.status(404).send('Habitación no encontrada');

  const config = db.prepare("SELECT valor FROM configuracion WHERE clave = 'nombre_hosteria'").get();
  const nombreHosteria = config?.valor || 'Hostería';

  const reservas = db.prepare(`
    SELECT r.codigo, r.fecha_entrada, r.fecha_salida, r.adultos, r.ninos,
           h.nombre || ' ' || h.apellido as huesped_nombre
    FROM reservas r
    JOIN huespedes h ON r.huesped_id = h.id
    WHERE r.habitacion_id = ?
      AND r.estado NOT IN ('cancelada', 'checkout', 'noshow')
      AND r.fecha_salida >= date('now')
    ORDER BY r.fecha_entrada
  `).all(hab_id);

  const ahora = toICalDateTime(new Date());

  const eventos = reservas.map(r => {
    const uid = `${r.codigo}@hosteria`;
    const dtstart = toICalDate(r.fecha_entrada);
    const dtend   = toICalDate(r.fecha_salida);
    return [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${ahora}`,
      `DTSTART;VALUE=DATE:${dtstart}`,
      `DTEND;VALUE=DATE:${dtend}`,
      `SUMMARY:BLOQUEADO - ${nombreHosteria}`,
      `DESCRIPTION:Reserva ${r.codigo}`,
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'END:VEVENT',
    ].join('\r\n');
  }).join('\r\n');

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

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `inline; filename="hab_${hab.numero}.ics"`);
  res.setHeader('Cache-Control', 'no-cache, no-store');
  res.send(cal);
});

module.exports = router;

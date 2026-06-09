const nodemailer = require('nodemailer');
const { db } = require('../db/database');

function getSmtpConfig() {
  const rows = db.prepare(
    "SELECT clave, valor FROM configuracion WHERE clave IN ('smtp_host','smtp_port','smtp_user','smtp_pass','smtp_from','smtp_habilitado','nombre_hosteria')"
  ).all();
  return rows.reduce((acc, r) => ({ ...acc, [r.clave]: r.valor }), {});
}

function createTransporter(cfg) {
  return nodemailer.createTransport({
    host: cfg.smtp_host,
    port: Number(cfg.smtp_port) || 587,
    secure: Number(cfg.smtp_port) === 465,
    auth: { user: cfg.smtp_user, pass: cfg.smtp_pass },
  });
}

async function enviarEmail({ to, subject, html }) {
  const cfg = getSmtpConfig();
  if (cfg.smtp_habilitado !== '1' || !cfg.smtp_host || !cfg.smtp_user) return;
  const transporter = createTransporter(cfg);
  await transporter.sendMail({
    from: `"${cfg.nombre_hosteria || 'Hostería'}" <${cfg.smtp_from || cfg.smtp_user}>`,
    to,
    subject,
    html,
  });
}

// ── Templates ────────────────────────────────────────────────────────────────

function baseLayout(contenido, nombreHosteria) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { font-family: Arial, sans-serif; background: #f8f4ef; margin: 0; padding: 20px; color: #333; }
  .card { background: white; border-radius: 12px; max-width: 560px; margin: 0 auto; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,.08); }
  .header { background: #f59e0b; padding: 28px 32px; text-align: center; }
  .header h1 { color: white; margin: 0; font-size: 22px; }
  .header p { color: rgba(255,255,255,.85); margin: 4px 0 0; font-size: 14px; }
  .body { padding: 28px 32px; }
  .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f1f1; font-size: 14px; }
  .row:last-child { border-bottom: none; }
  .label { color: #888; }
  .value { font-weight: bold; color: #333; }
  .badge { display: inline-block; background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; border-radius: 20px; padding: 4px 14px; font-size: 13px; font-weight: bold; }
  .code { font-size: 28px; font-family: monospace; font-weight: bold; color: #b45309; letter-spacing: 4px; text-align: center; background: #fffbeb; border: 2px dashed #fcd34d; border-radius: 8px; padding: 12px; margin: 16px 0; }
  .alert { background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 6px; padding: 12px 16px; font-size: 13px; color: #b91c1c; margin: 12px 0; }
  .info { background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 6px; padding: 12px 16px; font-size: 13px; color: #1e40af; margin: 12px 0; }
  .footer { background: #f8f4ef; padding: 16px 32px; text-align: center; font-size: 12px; color: #999; }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <h1>🏨 ${nombreHosteria}</h1>
  </div>
  <div class="body">${contenido}</div>
  <div class="footer">Este email fue generado automáticamente · ${nombreHosteria}</div>
</div>
</body></html>`;
}

// Email de confirmación de reserva
async function emailConfirmacionReserva(reserva) {
  const cfg = getSmtpConfig();
  const nombre = cfg.nombre_hosteria || 'Hostería';

  const senia = reserva.senia != null
    ? `<div class="info">💳 <strong>Seña requerida (10%):</strong> $${reserva.senia}<br>
       <small>La hostería se comunicará para coordinar el pago. Sin seña confirmada la reserva no queda garantizada.</small><br>
       <small style="color:#16a34a">✅ Si cancelás con 3 días o más de anticipación, la seña se devuelve íntegra.</small><br>
       <small style="color:#ef4444">❌ Con menos de 3 días de anticipación, la seña no se reintegra.</small></div>`
    : '';

  const contenido = `
    <p>Hola <strong>${reserva.huesped_nombre}</strong>,</p>
    <p>¡Tu reserva fue recibida correctamente! Guardá este código:</p>
    <div class="code">${reserva.codigo}</div>
    <div class="badge">${reserva.estado === 'pendiente' ? '⏳ Pendiente de confirmación' : '✅ Confirmada'}</div>
    <br><br>
    <div class="row"><span class="label">Habitación</span><span class="value">${reserva.tipo_nombre} · Hab. ${reserva.habitacion_numero}</span></div>
    <div class="row"><span class="label">Llegada</span><span class="value">${reserva.fecha_entrada}</span></div>
    <div class="row"><span class="label">Salida</span><span class="value">${reserva.fecha_salida}</span></div>
    <div class="row"><span class="label">Noches</span><span class="value">${reserva.noches}</span></div>
    <div class="row"><span class="label">Huéspedes</span><span class="value">${reserva.adultos} adultos${reserva.ninos > 0 ? `, ${reserva.ninos} niños` : ''}</span></div>
    <div class="row"><span class="label">Total</span><span class="value">$${reserva.precio_total}</span></div>
    ${senia}
    <p style="margin-top:20px;font-size:13px;color:#666">Podés consultar el estado de tu reserva en nuestra web usando el código de arriba.</p>
  `;

  await enviarEmail({
    to: reserva.huesped_email,
    subject: `Reserva ${reserva.codigo} — ${nombre}`,
    html: baseLayout(contenido, nombre),
  });
}

// Email de recordatorio pre-llegada (se llama desde un job o manualmente)
async function emailRecordatorio(reserva) {
  const cfg = getSmtpConfig();
  const nombre = cfg.nombre_hosteria || 'Hostería';

  const contenido = `
    <p>Hola <strong>${reserva.huesped_nombre}</strong>,</p>
    <p>Te recordamos que tu llegada a <strong>${nombre}</strong> es <strong>mañana</strong>.</p>
    <div class="row"><span class="label">Habitación</span><span class="value">${reserva.tipo_nombre} · Hab. ${reserva.habitacion_numero}</span></div>
    <div class="row"><span class="label">Llegada</span><span class="value">${reserva.fecha_entrada}</span></div>
    <div class="row"><span class="label">Salida</span><span class="value">${reserva.fecha_salida}</span></div>
    <div class="row"><span class="label">Check-in desde</span><span class="value">${cfg.hora_checkin || '14:00'} hs</span></div>
    <div class="row"><span class="label">Check-out hasta</span><span class="value">${cfg.hora_checkout || '11:00'} hs</span></div>
    <div class="info">📍 <strong>Dirección:</strong> ${cfg.direccion || ''}<br>📞 <strong>Contacto:</strong> ${cfg.telefono || ''}</div>
    <p style="font-size:13px;color:#666">¡Te esperamos! Si necesitás hacer algún cambio contactanos a la brevedad.</p>
  `;

  await enviarEmail({
    to: reserva.huesped_email,
    subject: `Recordatorio: tu llegada mañana — ${nombre}`,
    html: baseLayout(contenido, nombre),
  });
}

// Email al registrar cobro de seña
async function emailSeniaCobrada(reserva) {
  const cfg = getSmtpConfig();
  const nombre = cfg.nombre_hosteria || 'Hostería';
  const saldo = Math.round((reserva.precio_total - reserva.senia) * 100) / 100;

  const contenido = `
    <p>Hola <strong>${reserva.huesped_nombre}</strong>,</p>
    <p>Confirmamos la recepción de tu seña para la reserva <strong>${reserva.codigo}</strong>.</p>
    <div class="row"><span class="label">Seña abonada</span><span class="value">$${reserva.senia}</span></div>
    <div class="row"><span class="label">Método</span><span class="value">${reserva.senia_metodo || '-'}</span></div>
    <div class="row"><span class="label">Saldo al llegar</span><span class="value">$${saldo}</span></div>
    <div class="row"><span class="label">Llegada</span><span class="value">${reserva.fecha_entrada}</span></div>
    <div class="info">✅ Si cancelás con 3 días o más de anticipación, la seña se devuelve íntegra.</div>
    <div class="alert">❌ Con menos de 3 días de anticipación, la seña no se reintegra.</div>
    <p style="font-size:13px;color:#666">Tu reserva queda garantizada. ¡Te esperamos!</p>
  `;

  await enviarEmail({
    to: reserva.huesped_email,
    subject: `Seña confirmada — Reserva ${reserva.codigo}`,
    html: baseLayout(contenido, nombre),
  });
}

module.exports = { enviarEmail, emailConfirmacionReserva, emailRecordatorio, emailSeniaCobrada };

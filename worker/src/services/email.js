async function getSmtpConfig(DB, tenant_id) {
  const { results } = await DB.prepare(
    "SELECT clave,valor FROM configuracion_mt WHERE tenant_id=? AND clave IN ('smtp_habilitado','smtp_from','nombre_hosteria','hora_checkin','hora_checkout','direccion','telefono','resend_api_key')"
  ).bind(tenant_id).all();
  return results.reduce((acc, r) => ({ ...acc, [r.clave]: r.valor }), {});
}

function baseLayout(contenido, nombre) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;background:#f8f4ef;margin:0;padding:20px;color:#333}
  .card{background:white;border-radius:12px;max-width:560px;margin:0 auto;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
  .header{background:#f59e0b;padding:28px 32px;text-align:center}
  .header h1{color:white;margin:0;font-size:22px}
  .body{padding:28px 32px}
  .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f1f1;font-size:14px}
  .row:last-child{border-bottom:none}
  .label{color:#888}.value{font-weight:bold;color:#333}
  .code{font-size:28px;font-family:monospace;font-weight:bold;color:#b45309;letter-spacing:4px;text-align:center;background:#fffbeb;border:2px dashed #fcd34d;border-radius:8px;padding:12px;margin:16px 0}
  .info{background:#eff6ff;border-left:4px solid #3b82f6;border-radius:6px;padding:12px 16px;font-size:13px;color:#1e40af;margin:12px 0}
  .alert{background:#fef2f2;border-left:4px solid #ef4444;border-radius:6px;padding:12px 16px;font-size:13px;color:#b91c1c;margin:12px 0}
  .footer{background:#f8f4ef;padding:16px 32px;text-align:center;font-size:12px;color:#999}
</style></head><body>
<div class="card">
  <div class="header"><h1>🏨 ${nombre}</h1></div>
  <div class="body">${contenido}</div>
  <div class="footer">Email generado automáticamente · ${nombre}</div>
</div></body></html>`;
}

async function enviarEmail(DB, tenant_id, { to, subject, html }) {
  const cfg = await getSmtpConfig(DB, tenant_id);
  if (!cfg.resend_api_key) return;

  const from = cfg.smtp_from || 'noreply@resend.dev';
  const nombre = cfg.nombre_hosteria || 'Hostería';

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cfg.resend_api_key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: `"${nombre}" <${from}>`, to, subject, html }),
  });
}

export async function emailConfirmacionReserva(DB, reserva, tenant_id) {
  const cfg = await getSmtpConfig(DB, tenant_id);
  const nombre = cfg.nombre_hosteria || 'Hostería';
  const senia = reserva.senia != null
    ? `<div class="info">💳 <strong>Seña requerida (10%):</strong> $${reserva.senia}<br>
       <small>✅ Si cancelás con 3+ días de anticipación, la seña se devuelve.</small><br>
       <small style="color:#ef4444">❌ Con menos de 3 días, la seña no se reintegra.</small></div>` : '';
  const contenido = `
    <p>Hola <strong>${reserva.huesped_nombre}</strong>,</p>
    <p>¡Tu reserva fue recibida! Guardá este código:</p>
    <div class="code">${reserva.codigo}</div>
    <div class="row"><span class="label">Habitación</span><span class="value">${reserva.tipo_nombre} · Hab. ${reserva.habitacion_numero}</span></div>
    <div class="row"><span class="label">Llegada</span><span class="value">${reserva.fecha_entrada}</span></div>
    <div class="row"><span class="label">Salida</span><span class="value">${reserva.fecha_salida}</span></div>
    <div class="row"><span class="label">Noches</span><span class="value">${reserva.noches}</span></div>
    <div class="row"><span class="label">Total</span><span class="value">$${reserva.precio_total}</span></div>
    ${senia}`;
  await enviarEmail(DB, tenant_id, { to: reserva.huesped_email, subject: `Reserva ${reserva.codigo} — ${nombre}`, html: baseLayout(contenido, nombre) });
}

export async function emailRecordatorio(DB, reserva, tenant_id) {
  const cfg = await getSmtpConfig(DB, tenant_id);
  const nombre = cfg.nombre_hosteria || 'Hostería';
  const contenido = `
    <p>Hola <strong>${reserva.huesped_nombre}</strong>,</p>
    <p>Te recordamos que tu llegada a <strong>${nombre}</strong> es mañana.</p>
    <div class="row"><span class="label">Habitación</span><span class="value">${reserva.tipo_nombre} · Hab. ${reserva.habitacion_numero}</span></div>
    <div class="row"><span class="label">Llegada</span><span class="value">${reserva.fecha_entrada}</span></div>
    <div class="row"><span class="label">Check-in desde</span><span class="value">${cfg.hora_checkin || '14:00'} hs</span></div>
    <div class="info">📍 ${cfg.direccion || ''} · 📞 ${cfg.telefono || ''}</div>`;
  await enviarEmail(DB, tenant_id, { to: reserva.huesped_email, subject: `Recordatorio: llegada mañana — ${nombre}`, html: baseLayout(contenido, nombre) });
}

export async function emailSeniaCobrada(DB, reserva, tenant_id) {
  const cfg = await getSmtpConfig(DB, tenant_id);
  const nombre = cfg.nombre_hosteria || 'Hostería';
  const saldo = Math.round((reserva.precio_total - reserva.senia) * 100) / 100;
  const contenido = `
    <p>Hola <strong>${reserva.huesped_nombre}</strong>,</p>
    <p>Confirmamos la recepción de tu seña para la reserva <strong>${reserva.codigo}</strong>.</p>
    <div class="row"><span class="label">Seña abonada</span><span class="value">$${reserva.senia}</span></div>
    <div class="row"><span class="label">Saldo al llegar</span><span class="value">$${saldo}</span></div>
    <div class="info">✅ Tu reserva queda garantizada.</div>`;
  await enviarEmail(DB, tenant_id, { to: reserva.huesped_email, subject: `Seña confirmada — Reserva ${reserva.codigo}`, html: baseLayout(contenido, nombre) });
}

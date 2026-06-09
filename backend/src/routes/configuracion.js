const express = require('express');
const { db } = require('../db/database');
const { auth, adminOnly } = require('../middleware/auth');
const nodemailer = require('nodemailer');

const router = express.Router();

router.get('/', auth, (req, res) => {
  const rows = db.prepare('SELECT clave, valor FROM configuracion').all();
  const config = rows.reduce((acc, r) => ({ ...acc, [r.clave]: r.valor }), {});
  res.json(config);
});

router.put('/', auth, adminOnly, (req, res) => {
  const update = db.prepare('INSERT OR REPLACE INTO configuracion (clave, valor) VALUES (?, ?)');
  const updateMany = db.transaction((entries) => {
    for (const [clave, valor] of entries) update.run(clave, String(valor));
  });
  updateMany(Object.entries(req.body));
  res.json({ mensaje: 'Configuración actualizada' });
});

// Ruta pública para la web de reservas (también accesible como /api/web/config via reservas_web)
router.get('/publica', (req, res) => {
  const claves = ['nombre_hosteria', 'direccion', 'telefono', 'email', 'moneda', 'simbolo_moneda', 'hora_checkin', 'hora_checkout', 'pago_cbu', 'pago_alias', 'pago_titular', 'pago_banco', 'pago_instrucciones'];
  const rows = db.prepare(`SELECT clave, valor FROM configuracion WHERE clave IN (${claves.map(() => '?').join(',')})`).all(...claves);
  const config = rows.reduce((acc, r) => ({ ...acc, [r.clave]: r.valor }), {});
  res.json(config);
});

// POST /api/configuracion/test-email — verificar conexión SMTP
router.post('/test-email', auth, adminOnly, async (req, res) => {
  const rows = db.prepare(
    "SELECT clave, valor FROM configuracion WHERE clave IN ('smtp_host','smtp_port','smtp_user','smtp_pass','smtp_from','nombre_hosteria')"
  ).all();
  const cfg = rows.reduce((acc, r) => ({ ...acc, [r.clave]: r.valor }), {});

  if (!cfg.smtp_host || !cfg.smtp_user) {
    return res.status(400).json({ error: 'Configurá host y usuario SMTP primero' });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: cfg.smtp_host,
      port: Number(cfg.smtp_port) || 587,
      secure: Number(cfg.smtp_port) === 465,
      auth: { user: cfg.smtp_user, pass: cfg.smtp_pass },
    });
    await transporter.verify();
    // Enviar email de prueba al mismo remitente
    await transporter.sendMail({
      from: `"${cfg.nombre_hosteria || 'Hostería'}" <${cfg.smtp_from || cfg.smtp_user}>`,
      to: cfg.smtp_from || cfg.smtp_user,
      subject: `✅ Test SMTP — ${cfg.nombre_hosteria || 'Hostería'}`,
      html: '<p>La configuración de email funciona correctamente.</p>',
    });
    res.json({ ok: true, mensaje: 'Conexión exitosa. Se envió un email de prueba.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

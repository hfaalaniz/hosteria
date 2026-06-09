const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db/database');
const { auth } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

  const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ? AND activo = 1').get(email);
  if (!usuario) return res.status(401).json({ error: 'Credenciales inválidas' });

  const valido = bcrypt.compareSync(password, usuario.password);
  if (!valido) return res.status(401).json({ error: 'Credenciales inválidas' });

  const token = jwt.sign(
    { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({ token, usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol } });
});

// GET /api/auth/me
router.get('/me', auth, (req, res) => {
  const usuario = db.prepare('SELECT id, nombre, email, rol FROM usuarios WHERE id = ?').get(req.user.id);
  res.json(usuario);
});

module.exports = router;

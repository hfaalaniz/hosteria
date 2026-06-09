const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db/database');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

// Listar usuarios (solo admin)
router.get('/', auth, adminOnly, (req, res) => {
  const usuarios = db.prepare(
    'SELECT id, nombre, email, rol, activo, creado_en FROM usuarios ORDER BY nombre'
  ).all();
  res.json(usuarios);
});

// Crear usuario (solo admin)
router.post('/', auth, adminOnly, (req, res) => {
  const { nombre, email, password, rol } = req.body;
  if (!nombre || !email || !password || !rol)
    return res.status(400).json({ error: 'Nombre, email, contraseña y rol son requeridos' });

  const existe = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);
  if (existe) return res.status(409).json({ error: 'Ya existe un usuario con ese email' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)'
  ).run(nombre, email, hash, rol);

  res.status(201).json({ id: result.lastInsertRowid, mensaje: 'Usuario creado' });
});

// Actualizar usuario (solo admin)
router.put('/:id', auth, adminOnly, (req, res) => {
  const { nombre, email, rol, activo } = req.body;
  if (!nombre || !email || !rol)
    return res.status(400).json({ error: 'Nombre, email y rol son requeridos' });

  const existe = db.prepare('SELECT id FROM usuarios WHERE email = ? AND id != ?').get(email, req.params.id);
  if (existe) return res.status(409).json({ error: 'Ese email ya está en uso por otro usuario' });

  db.prepare(
    'UPDATE usuarios SET nombre=?, email=?, rol=?, activo=? WHERE id=?'
  ).run(nombre, email, rol, activo ?? 1, req.params.id);

  res.json({ mensaje: 'Usuario actualizado' });
});

// Cambiar contraseña (solo admin, o el propio usuario)
router.patch('/:id/password', auth, (req, res) => {
  const esPropioUsuario = String(req.user.id) === String(req.params.id);
  const esAdmin = req.user.rol === 'admin';
  if (!esPropioUsuario && !esAdmin)
    return res.status(403).json({ error: 'Acceso denegado' });

  const { password } = req.body;
  if (!password || password.length < 6)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

  const hash = bcrypt.hashSync(password, 10);
  db.prepare('UPDATE usuarios SET password=? WHERE id=?').run(hash, req.params.id);
  res.json({ mensaje: 'Contraseña actualizada' });
});

// Activar / desactivar (solo admin, no puede desactivarse a sí mismo)
router.patch('/:id/activo', auth, adminOnly, (req, res) => {
  if (String(req.user.id) === String(req.params.id))
    return res.status(400).json({ error: 'No podés desactivar tu propia cuenta' });

  const { activo } = req.body;
  db.prepare('UPDATE usuarios SET activo=? WHERE id=?').run(activo ? 1 : 0, req.params.id);
  res.json({ mensaje: activo ? 'Usuario activado' : 'Usuario desactivado' });
});

module.exports = router;

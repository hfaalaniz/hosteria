const express = require('express');
const { db } = require('../db/database');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/permisos/:rol — devuelve módulos habilitados para ese rol
router.get('/:rol', auth, (req, res) => {
  const { rol } = req.params;
  // Admin siempre tiene acceso a todo, no se consulta la tabla
  if (rol === 'admin') return res.json({ rol, modulos: ['*'] });

  const rows = db.prepare('SELECT modulo FROM permisos_rol WHERE rol = ?').all(rol);
  res.json({ rol, modulos: rows.map(r => r.modulo) });
});

// GET /api/permisos — todos los roles y sus permisos (solo admin)
router.get('/', auth, adminOnly, (req, res) => {
  const rows = db.prepare('SELECT rol, modulo FROM permisos_rol ORDER BY rol, modulo').all();
  // Agrupar por rol
  const mapa = {};
  for (const r of rows) {
    if (!mapa[r.rol]) mapa[r.rol] = [];
    mapa[r.rol].push(r.modulo);
  }
  res.json(mapa);
});

// PUT /api/permisos/:rol — reemplaza todos los módulos de un rol (solo admin)
router.put('/:rol', auth, adminOnly, (req, res) => {
  const { rol } = req.params;
  if (rol === 'admin') return res.status(400).json({ error: 'No se pueden modificar los permisos del admin' });

  const { modulos } = req.body; // array de strings
  if (!Array.isArray(modulos)) return res.status(400).json({ error: 'modulos debe ser un array' });

  const borrar = db.prepare('DELETE FROM permisos_rol WHERE rol = ?');
  const insertar = db.prepare('INSERT OR IGNORE INTO permisos_rol (rol, modulo) VALUES (?, ?)');

  db.transaction(() => {
    borrar.run(rol);
    for (const m of modulos) insertar.run(rol, m);
  })();

  res.json({ mensaje: 'Permisos actualizados', rol, modulos });
});

module.exports = router;

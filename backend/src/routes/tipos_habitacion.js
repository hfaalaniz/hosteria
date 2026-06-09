const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { db } = require('../db/database');
const { auth } = require('../middleware/auth');

// Directorio de imágenes de habitaciones (dentro del public del frontend)
const IMGS_DIR = path.join(__dirname, '../../../frontend/public/imgs');
if (!fs.existsSync(IMGS_DIR)) fs.mkdirSync(IMGS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, IMGS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const nombre = `tipo_${Date.now()}${ext}`;
    cb(null, nombre);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (/image\/(jpeg|jpg|png|webp|gif)/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Solo se permiten imágenes'));
  },
});

const router = express.Router();

function parseTipo(t) {
  return { ...t, amenidades: JSON.parse(t.amenidades || '[]'), camas: JSON.parse(t.camas || '[]') };
}

router.get('/', auth, (req, res) => {
  const tipos = db.prepare('SELECT * FROM tipos_habitacion WHERE activo = 1 ORDER BY nombre').all();
  res.json(tipos.map(parseTipo));
});

// ── Rutas específicas ANTES de /:id para que Express no las confunda ──────────

// GET /api/tipos-habitacion/imagenes
router.get('/imagenes', auth, (req, res) => {
  try {
    const archivos = fs.readdirSync(IMGS_DIR)
      .filter(f => /\.(png|jpg|jpeg|webp|gif)$/i.test(f))
      .map(f => ({ nombre: f, url: `/imgs/${f}` }));
    res.json(archivos);
  } catch {
    res.json([]);
  }
});

// POST /api/tipos-habitacion/upload-imagen
router.post('/upload-imagen', auth, upload.single('imagen'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió imagen' });
  res.json({ url: `/imgs/${req.file.filename}` });
});

router.get('/:id', auth, (req, res) => {
  const t = db.prepare('SELECT * FROM tipos_habitacion WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Tipo no encontrado' });
  res.json(parseTipo(t));
});

router.post('/', auth, (req, res) => {
  const { nombre, descripcion, capacidad, precio_base, precio_fin_semana, amenidades, camas, imagen } = req.body;
  if (!nombre || !precio_base) return res.status(400).json({ error: 'Nombre y precio base son requeridos' });

  const result = db.prepare(`
    INSERT INTO tipos_habitacion (nombre, descripcion, capacidad, precio_base, precio_fin_semana, amenidades, camas, imagen)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(nombre, descripcion, capacidad || 2, precio_base, precio_fin_semana || null,
    JSON.stringify(amenidades || []), JSON.stringify(camas || []), imagen || null);

  res.status(201).json({ id: result.lastInsertRowid, mensaje: 'Tipo creado' });
});

router.put('/:id', auth, (req, res) => {
  const { nombre, descripcion, capacidad, precio_base, precio_fin_semana, amenidades, camas, activo, imagen } = req.body;
  db.prepare(`
    UPDATE tipos_habitacion SET nombre=?, descripcion=?, capacidad=?, precio_base=?, precio_fin_semana=?, amenidades=?, camas=?, activo=?, imagen=?
    WHERE id=?
  `).run(nombre, descripcion, capacidad, precio_base, precio_fin_semana,
    JSON.stringify(amenidades || []), JSON.stringify(camas || []), activo ?? 1, imagen ?? null, req.params.id);
  res.json({ mensaje: 'Tipo actualizado' });
});

router.delete('/:id', auth, (req, res) => {
  const usado = db.prepare('SELECT id FROM habitaciones WHERE tipo_id = ?').get(req.params.id);
  if (usado) return res.status(400).json({ error: 'No se puede eliminar un tipo con habitaciones asignadas' });
  db.prepare('UPDATE tipos_habitacion SET activo = 0 WHERE id = ?').run(req.params.id);
  res.json({ mensaje: 'Tipo desactivado' });
});

module.exports = router;

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { db } = require('../db/database');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Directorio para fotos de documentos
const DOCS_DIR = path.join(__dirname, '../../../frontend/public/imgs/docs');
if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });

const uploadDoc = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, DOCS_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `doc_${req.params.id}_${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/image\/(jpeg|jpg|png|webp)/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Solo imágenes JPG/PNG/WEBP'));
  },
});

router.get('/', auth, (req, res) => {
  const { buscar } = req.query;
  let where = '1=1';
  const params = [];
  if (buscar) {
    where += ' AND (h.nombre LIKE ? OR h.apellido LIKE ? OR h.email LIKE ? OR h.documento_numero LIKE ? OR h.telefono LIKE ?)';
    const s = `%${buscar}%`;
    params.push(s, s, s, s, s);
  }
  const rows = db.prepare(`
    SELECT h.*,
      COUNT(r.id) as total_reservas,
      MAX(r.fecha_entrada) as ultima_visita,
      COALESCE(SUM(CASE WHEN r.estado NOT IN ('cancelada','noshow') THEN r.precio_total ELSE 0 END), 0) as total_gastado,
      SUM(CASE WHEN r.estado = 'checkin' THEN 1 ELSE 0 END) as actualmente_alojado
    FROM huespedes h
    LEFT JOIN reservas r ON r.huesped_id = h.id
    WHERE ${where}
    GROUP BY h.id
    ORDER BY h.apellido, h.nombre
  `).all(...params);
  res.json(rows);
});

router.get('/:id', auth, (req, res) => {
  const h = db.prepare('SELECT * FROM huespedes WHERE id = ?').get(req.params.id);
  if (!h) return res.status(404).json({ error: 'Huésped no encontrado' });

  const reservas = db.prepare(`
    SELECT r.*, hab.numero as habitacion_numero, t.nombre as tipo_nombre
    FROM reservas r
    JOIN habitaciones hab ON r.habitacion_id = hab.id
    JOIN tipos_habitacion t ON hab.tipo_id = t.id
    WHERE r.huesped_id = ?
    ORDER BY r.fecha_entrada DESC
  `).all(req.params.id);

  res.json({ ...h, reservas });
});

router.post('/', auth, (req, res) => {
  const { nombre, apellido, email, telefono, documento_tipo, documento_numero, nacionalidad, fecha_nacimiento, direccion, notas } = req.body;
  if (!nombre || !apellido) return res.status(400).json({ error: 'Nombre y apellido son requeridos' });

  const result = db.prepare(`
    INSERT INTO huespedes (nombre, apellido, email, telefono, documento_tipo, documento_numero, nacionalidad, fecha_nacimiento, direccion, notas)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(nombre, apellido, email, telefono, documento_tipo, documento_numero, nacionalidad, fecha_nacimiento, direccion, notas);

  res.status(201).json({ id: result.lastInsertRowid, mensaje: 'Huésped registrado' });
});

router.put('/:id', auth, (req, res) => {
  const { nombre, apellido, email, telefono, documento_tipo, documento_numero, nacionalidad, fecha_nacimiento, direccion, notas } = req.body;
  db.prepare(`
    UPDATE huespedes SET nombre=?, apellido=?, email=?, telefono=?, documento_tipo=?, documento_numero=?, nacionalidad=?, fecha_nacimiento=?, direccion=?, notas=?
    WHERE id=?
  `).run(nombre, apellido, email, telefono, documento_tipo, documento_numero, nacionalidad, fecha_nacimiento, direccion, notas, req.params.id);
  res.json({ mensaje: 'Huésped actualizado' });
});

// POST /api/huespedes/:id/foto-documento
router.post('/:id/foto-documento', auth, uploadDoc.single('foto'), (req, res) => {
  const huesped = db.prepare('SELECT id, foto_documento FROM huespedes WHERE id = ?').get(req.params.id);
  if (!huesped) return res.status(404).json({ error: 'Huésped no encontrado' });
  if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });

  // Eliminar foto anterior si existe
  if (huesped.foto_documento) {
    const anterior = path.join(DOCS_DIR, path.basename(huesped.foto_documento));
    if (fs.existsSync(anterior)) fs.unlinkSync(anterior);
  }

  const url = `/imgs/docs/${req.file.filename}`;
  db.prepare('UPDATE huespedes SET foto_documento = ? WHERE id = ?').run(url, req.params.id);
  res.json({ url, mensaje: 'Foto de documento guardada' });
});

// DELETE /api/huespedes/:id/foto-documento
router.delete('/:id/foto-documento', auth, (req, res) => {
  const huesped = db.prepare('SELECT foto_documento FROM huespedes WHERE id = ?').get(req.params.id);
  if (!huesped?.foto_documento) return res.status(404).json({ error: 'Sin foto' });
  const archivo = path.join(DOCS_DIR, path.basename(huesped.foto_documento));
  if (fs.existsSync(archivo)) fs.unlinkSync(archivo);
  db.prepare('UPDATE huespedes SET foto_documento = NULL WHERE id = ?').run(req.params.id);
  res.json({ mensaje: 'Foto eliminada' });
});

router.delete('/:id', auth, (req, res) => {
  const tieneReservas = db.prepare('SELECT id FROM reservas WHERE huesped_id = ?').get(req.params.id);
  if (tieneReservas) return res.status(400).json({ error: 'No se puede eliminar un huésped con reservas' });
  db.prepare('DELETE FROM huespedes WHERE id = ?').run(req.params.id);
  res.json({ mensaje: 'Huésped eliminado' });
});

module.exports = router;

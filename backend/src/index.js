require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDB } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Servir imágenes de habitaciones estáticamente
app.use('/imgs', express.static(path.join(__dirname, '../../frontend/public/imgs')));

// Inicializar DB
initDB();

// Rutas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/habitaciones', require('./routes/habitaciones'));
app.use('/api/tipos-habitacion', require('./routes/tipos_habitacion'));
app.use('/api/huespedes', require('./routes/huespedes'));
app.use('/api/reservas', require('./routes/reservas'));
app.use('/api/consumos', require('./routes/consumos'));
app.use('/api/servicios', require('./routes/servicios'));
app.use('/api/facturas', require('./routes/facturas'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/mantenimiento', require('./routes/mantenimiento'));
app.use('/api/configuracion', require('./routes/configuracion'));
app.use('/api/web', require('./routes/reservas_web'));
app.use('/api/historial', require('./routes/historial'));
app.use('/api/reportes', require('./routes/reportes'));
app.use('/api/permisos', require('./routes/permisos'));
app.use('/api/partes-limpieza', require('./routes/partes_limpieza'));
app.use('/api/partes-mantenimiento', require('./routes/partes_mantenimiento'));
app.use('/api/ical-feeds', require('./routes/ical_feeds'));
app.use('/api/notificaciones', require('./routes/notificaciones'));

// iCal — acceso público, sin /api para URLs más limpias
app.use('/ical', require('./routes/ical'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.listen(PORT, () => {
  console.log(`🏨 Hostería API corriendo en http://localhost:${PORT}`);
});

const express = require('express');
const https = require('https');
const http = require('http');
const { db } = require('../db/database');
const { auth } = require('../middleware/auth');

const router = express.Router();

// --- Utilidades iCal ---

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { timeout: 15000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject).on('timeout', () => reject(new Error('Timeout al obtener el feed')));
  });
}

// Parsea líneas iCal con unfolding (líneas que continúan con espacio/tab)
function unfoldLines(text) {
  return text.replace(/\r\n[ \t]/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

// Parsea VEVENT blocks de un texto iCal
function parseVEvents(text) {
  const unfolded = unfoldLines(text);
  const events = [];
  const veventRe = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
  let match;
  while ((match = veventRe.exec(unfolded)) !== null) {
    const block = match[1];
    const get = (key) => {
      const m = block.match(new RegExp(`^${key}[;:][^\n]*`, 'm'));
      if (!m) return null;
      return m[0].replace(/^[^:]+:/, '').trim();
    };
    const uid = get('UID');
    const summary = get('SUMMARY') || '';

    // Extraer fechas (DATE o DATETIME)
    const dtstart = get('DTSTART');
    const dtend = get('DTEND');

    if (!uid || !dtstart || !dtend) continue;

    // Convertir a YYYY-MM-DD
    const toDate = (v) => {
      if (!v) return null;
      const d = v.replace(/T.*$/, ''); // quitar hora si tiene
      if (d.length === 8) {
        return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
      }
      return null;
    };

    const entrada = toDate(dtstart);
    const salida = toDate(dtend);
    if (!entrada || !salida) continue;

    events.push({ uid, summary, entrada, salida });
  }
  return events;
}

async function syncFeed(feed) {
  const texto = await fetchUrl(feed.url);
  const eventos = parseVEvents(texto);
  const uids = eventos.map(e => e.uid);

  const upsert = db.prepare(`
    INSERT INTO reservas_externas (feed_id, habitacion_id, uid, resumen, fecha_entrada, fecha_salida, origen)
    VALUES (?, ?, ?, ?, ?, ?, 'externo')
    ON CONFLICT(feed_id, uid) DO UPDATE SET
      resumen = excluded.resumen,
      fecha_entrada = excluded.fecha_entrada,
      fecha_salida = excluded.fecha_salida
  `);

  let insertados = 0;
  let actualizados = 0;

  db.transaction(() => {
    if (uids.length > 0) {
      const placeholders = uids.map(() => '?').join(',');
      db.prepare(`DELETE FROM reservas_externas WHERE feed_id = ? AND uid NOT IN (${placeholders})`).run(feed.id, ...uids);
    } else {
      db.prepare('DELETE FROM reservas_externas WHERE feed_id = ?').run(feed.id);
    }
    for (const ev of eventos) {
      const existe = db.prepare('SELECT id FROM reservas_externas WHERE feed_id = ? AND uid = ?').get(feed.id, ev.uid);
      upsert.run(feed.id, feed.habitacion_id, ev.uid, ev.summary, ev.entrada, ev.salida);
      if (existe) actualizados++; else insertados++;
    }
  })();

  return { insertados, actualizados, total: eventos.length };
}

// --- Rutas estáticas ANTES de /:id ---

// GET /api/ical-feeds
router.get('/', auth, (req, res) => {
  const feeds = db.prepare(`
    SELECT f.*, h.numero as habitacion_numero,
      (SELECT COUNT(*) FROM reservas_externas re WHERE re.feed_id = f.id) as total_bloqueados
    FROM ical_feeds f
    JOIN habitaciones h ON f.habitacion_id = h.id
    ORDER BY h.numero, f.nombre
  `).all();
  res.json(feeds);
});

// GET /api/ical-feeds/bloqueados?desde=&hasta= — para el calendario
router.get('/bloqueados', auth, (req, res) => {
  const { desde, hasta } = req.query;
  let where = '1=1';
  const params = [];
  if (desde) { where += ' AND re.fecha_salida >= ?'; params.push(desde); }
  if (hasta) { where += ' AND re.fecha_entrada <= ?'; params.push(hasta); }

  const rows = db.prepare(`
    SELECT re.*, f.nombre as feed_nombre, h.numero as habitacion_numero
    FROM reservas_externas re
    JOIN ical_feeds f ON re.feed_id = f.id
    JOIN habitaciones h ON re.habitacion_id = h.id
    WHERE ${where}
    ORDER BY re.fecha_entrada
  `).all(...params);

  res.json(rows);
});

// POST /api/ical-feeds
router.post('/', auth, (req, res) => {
  const { habitacion_id, nombre, url } = req.body;
  if (!habitacion_id || !nombre || !url) {
    return res.status(400).json({ error: 'habitacion_id, nombre y url son requeridos' });
  }
  const result = db.prepare(`
    INSERT INTO ical_feeds (habitacion_id, nombre, url, activo)
    VALUES (?, ?, ?, 1)
  `).run(habitacion_id, nombre.trim(), url.trim());
  res.status(201).json({ id: result.lastInsertRowid, mensaje: 'Feed creado' });
});

// POST /api/ical-feeds/sync-all — sincroniza todos los feeds activos (antes de /:id)
router.post('/sync-all', auth, async (req, res) => {
  const feeds = db.prepare('SELECT * FROM ical_feeds WHERE activo = 1').all();
  const resultados = [];

  for (const feed of feeds) {
    try {
      const { insertados, actualizados, total } = await syncFeed(feed);
      const resultado = `OK: ${total} eventos`;
      db.prepare('UPDATE ical_feeds SET ultimo_sync=CURRENT_TIMESTAMP, ultimo_resultado=? WHERE id=?').run(resultado, feed.id);
      resultados.push({ feed_id: feed.id, nombre: feed.nombre, resultado });
    } catch (err) {
      const errMsg = `Error: ${err.message}`;
      db.prepare('UPDATE ical_feeds SET ultimo_sync=CURRENT_TIMESTAMP, ultimo_resultado=? WHERE id=?').run(errMsg, feed.id);
      resultados.push({ feed_id: feed.id, nombre: feed.nombre, resultado: errMsg });
    }
  }

  res.json({ resultados });
});

// --- Rutas con parámetro /:id ---

// PUT /api/ical-feeds/:id
router.put('/:id', auth, (req, res) => {
  const { nombre, url, activo } = req.body;
  db.prepare(`
    UPDATE ical_feeds SET nombre=?, url=?, activo=? WHERE id=?
  `).run(nombre, url, activo ? 1 : 0, req.params.id);
  res.json({ mensaje: 'Feed actualizado' });
});

// DELETE /api/ical-feeds/:id
router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM ical_feeds WHERE id = ?').run(req.params.id);
  res.json({ mensaje: 'Feed eliminado' });
});

// POST /api/ical-feeds/:id/sync — sincroniza un feed
router.post('/:id/sync', auth, async (req, res) => {
  const feed = db.prepare('SELECT * FROM ical_feeds WHERE id = ?').get(req.params.id);
  if (!feed) return res.status(404).json({ error: 'Feed no encontrado' });

  try {
    const { insertados, actualizados, total } = await syncFeed(feed);
    const resultado = `OK: ${insertados} nuevos, ${actualizados} actualizados, total ${total} eventos`;
    db.prepare(`
      UPDATE ical_feeds SET ultimo_sync = CURRENT_TIMESTAMP, ultimo_resultado = ? WHERE id = ?
    `).run(resultado, feed.id);

    res.json({ mensaje: resultado, insertados, actualizados, total });
  } catch (err) {
    const errMsg = `Error: ${err.message}`;
    db.prepare(`UPDATE ical_feeds SET ultimo_sync = CURRENT_TIMESTAMP, ultimo_resultado = ? WHERE id = ?`).run(errMsg, feed.id);
    res.status(500).json({ error: errMsg });
  }
});

module.exports = router;

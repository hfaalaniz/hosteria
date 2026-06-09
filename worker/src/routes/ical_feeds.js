import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';

export const icalFeeds = new Hono();

function unfoldLines(text) {
  return text.replace(/\r\n[ \t]/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function parseVEvents(text) {
  const unfolded = unfoldLines(text);
  const events = [];
  const re = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
  let match;
  while ((match = re.exec(unfolded)) !== null) {
    const block = match[1];
    const get = k => { const m = block.match(new RegExp(`^${k}[;:][^\n]*`, 'm')); return m ? m[0].replace(/^[^:]+:/, '').trim() : null; };
    const uid = get('UID'); const dtstart = get('DTSTART'); const dtend = get('DTEND');
    if (!uid || !dtstart || !dtend) continue;
    const toDate = v => { if (!v) return null; const d = v.replace(/T.*$/, ''); return d.length === 8 ? `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}` : null; };
    const entrada = toDate(dtstart); const salida = toDate(dtend);
    if (!entrada || !salida) continue;
    events.push({ uid, summary: get('SUMMARY') || '', entrada, salida });
  }
  return events;
}

async function syncFeed(db, feed) {
  const resp = await fetch(feed.url, { signal: AbortSignal.timeout(15000) });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const texto = await resp.text();
  const eventos = parseVEvents(texto);
  const uids = eventos.map(e => e.uid);

  const stmts = [];
  if (uids.length > 0) {
    stmts.push(db.prepare(`DELETE FROM reservas_externas WHERE feed_id=? AND uid NOT IN (${uids.map(() => '?').join(',')})`).bind(feed.id, ...uids));
  } else {
    stmts.push(db.prepare('DELETE FROM reservas_externas WHERE feed_id=?').bind(feed.id));
  }
  for (const ev of eventos) {
    stmts.push(db.prepare(`INSERT INTO reservas_externas (feed_id,habitacion_id,uid,resumen,fecha_entrada,fecha_salida,origen) VALUES (?,?,?,?,?,?,'externo') ON CONFLICT(feed_id,uid) DO UPDATE SET resumen=excluded.resumen,fecha_entrada=excluded.fecha_entrada,fecha_salida=excluded.fecha_salida`).bind(feed.id, feed.habitacion_id, ev.uid, ev.summary, ev.entrada, ev.salida));
  }
  await db.batch(stmts);
  return { total: eventos.length };
}

icalFeeds.get('/', authMiddleware, async c => {
  const { results } = await c.env.DB.prepare(`SELECT f.*,h.numero as habitacion_numero,(SELECT COUNT(*) FROM reservas_externas re WHERE re.feed_id=f.id) as total_bloqueados FROM ical_feeds f JOIN habitaciones h ON f.habitacion_id=h.id ORDER BY h.numero,f.nombre`).all();
  return c.json(results);
});

icalFeeds.get('/bloqueados', authMiddleware, async c => {
  const { desde, hasta } = c.req.query();
  let where = '1=1'; const params = [];
  if (desde) { where += ' AND re.fecha_salida>=?'; params.push(desde); }
  if (hasta) { where += ' AND re.fecha_entrada<=?'; params.push(hasta); }
  const { results } = await c.env.DB.prepare(`SELECT re.*,f.nombre as feed_nombre,h.numero as habitacion_numero FROM reservas_externas re JOIN ical_feeds f ON re.feed_id=f.id JOIN habitaciones h ON re.habitacion_id=h.id WHERE ${where} ORDER BY re.fecha_entrada`).bind(...params).all();
  return c.json(results);
});

icalFeeds.post('/', authMiddleware, async c => {
  const { habitacion_id, nombre, url } = await c.req.json();
  if (!habitacion_id || !nombre || !url) return c.json({ error: 'habitacion_id, nombre y url son requeridos' }, 400);
  const { meta } = await c.env.DB.prepare('INSERT INTO ical_feeds (habitacion_id,nombre,url,activo) VALUES (?,?,?,1)').bind(habitacion_id, nombre.trim(), url.trim()).run();
  return c.json({ id: meta.last_row_id, mensaje: 'Feed creado' }, 201);
});

icalFeeds.post('/sync-all', authMiddleware, async c => {
  const { results: feeds } = await c.env.DB.prepare('SELECT * FROM ical_feeds WHERE activo=1').all();
  const resultados = await Promise.all(feeds.map(async feed => {
    try {
      const { total } = await syncFeed(c.env.DB, feed);
      const resultado = `OK: ${total} eventos`;
      await c.env.DB.prepare('UPDATE ical_feeds SET ultimo_sync=CURRENT_TIMESTAMP,ultimo_resultado=? WHERE id=?').bind(resultado, feed.id).run();
      return { feed_id: feed.id, nombre: feed.nombre, resultado };
    } catch (err) {
      const errMsg = `Error: ${err.message}`;
      await c.env.DB.prepare('UPDATE ical_feeds SET ultimo_sync=CURRENT_TIMESTAMP,ultimo_resultado=? WHERE id=?').bind(errMsg, feed.id).run();
      return { feed_id: feed.id, nombre: feed.nombre, resultado: errMsg };
    }
  }));
  return c.json({ resultados });
});

icalFeeds.put('/:id', authMiddleware, async c => {
  const { nombre, url, activo } = await c.req.json();
  await c.env.DB.prepare('UPDATE ical_feeds SET nombre=?,url=?,activo=? WHERE id=?').bind(nombre, url, activo ? 1 : 0, c.req.param('id')).run();
  return c.json({ mensaje: 'Feed actualizado' });
});

icalFeeds.delete('/:id', authMiddleware, async c => {
  await c.env.DB.prepare('DELETE FROM ical_feeds WHERE id=?').bind(c.req.param('id')).run();
  return c.json({ mensaje: 'Feed eliminado' });
});

icalFeeds.post('/:id/sync', authMiddleware, async c => {
  const feed = await c.env.DB.prepare('SELECT * FROM ical_feeds WHERE id=?').bind(c.req.param('id')).first();
  if (!feed) return c.json({ error: 'Feed no encontrado' }, 404);
  try {
    const { total } = await syncFeed(c.env.DB, feed);
    const resultado = `OK: ${total} eventos`;
    await c.env.DB.prepare('UPDATE ical_feeds SET ultimo_sync=CURRENT_TIMESTAMP,ultimo_resultado=? WHERE id=?').bind(resultado, feed.id).run();
    return c.json({ mensaje: resultado, total });
  } catch (err) {
    const errMsg = `Error: ${err.message}`;
    await c.env.DB.prepare('UPDATE ical_feeds SET ultimo_sync=CURRENT_TIMESTAMP,ultimo_resultado=? WHERE id=?').bind(errMsg, feed.id).run();
    return c.json({ error: errMsg }, 500);
  }
});

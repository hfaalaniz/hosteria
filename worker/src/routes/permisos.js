import { Hono } from 'hono';
import { authMiddleware, adminOnly } from '../middleware/auth.js';

export const permisos = new Hono();

permisos.get('/', authMiddleware, adminOnly, async c => {
  const { tenant_id } = c.get('user');
  const { results } = await c.env.DB.prepare('SELECT rol,modulo FROM permisos_rol WHERE tenant_id=? ORDER BY rol,modulo').bind(tenant_id).all();
  const mapa = {};
  for (const r of results) { if (!mapa[r.rol]) mapa[r.rol] = []; mapa[r.rol].push(r.modulo); }
  return c.json(mapa);
});

permisos.get('/:rol', authMiddleware, async c => {
  const { tenant_id } = c.get('user');
  const { rol } = c.req.param();
  if (rol === 'admin') return c.json({ rol, modulos: ['*'] });
  const { results } = await c.env.DB.prepare('SELECT modulo FROM permisos_rol WHERE tenant_id=? AND rol=?').bind(tenant_id, rol).all();
  return c.json({ rol, modulos: results.map(r => r.modulo) });
});

permisos.put('/:rol', authMiddleware, adminOnly, async c => {
  const { tenant_id } = c.get('user');
  const { rol } = c.req.param();
  if (rol === 'admin') return c.json({ error: 'No se pueden modificar los permisos del admin' }, 400);
  const { modulos } = await c.req.json();
  if (!Array.isArray(modulos)) return c.json({ error: 'modulos debe ser un array' }, 400);
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM permisos_rol WHERE tenant_id=? AND rol=?').bind(tenant_id, rol),
    ...modulos.map(m => c.env.DB.prepare('INSERT OR IGNORE INTO permisos_rol (tenant_id,rol,modulo) VALUES (?,?,?)').bind(tenant_id, rol, m)),
  ]);
  return c.json({ mensaje: 'Permisos actualizados', rol, modulos });
});

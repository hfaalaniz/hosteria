import { Hono } from 'hono';
import { hash } from 'bcryptjs';
import { authMiddleware, adminOnly } from '../middleware/auth.js';

export const usuarios = new Hono();
const ROLES = ['admin', 'recepcion', 'limpieza', 'mantenimiento'];

usuarios.get('/', authMiddleware, adminOnly, async c => {
  const { tenant_id } = c.get('user');
  const { results } = await c.env.DB.prepare('SELECT id,nombre,email,rol,activo,creado_en FROM usuarios WHERE tenant_id=? ORDER BY nombre').bind(tenant_id).all();
  return c.json(results);
});

usuarios.post('/', authMiddleware, adminOnly, async c => {
  const { tenant_id } = c.get('user');
  const { nombre, email, password, rol } = await c.req.json();
  if (!nombre || !email || !password || !rol) return c.json({ error: 'Nombre, email, contraseña y rol son requeridos' }, 400);
  if (!ROLES.includes(rol)) return c.json({ error: `Rol inválido. Permitidos: ${ROLES.join(', ')}` }, 400);
  const existe = await c.env.DB.prepare('SELECT id FROM usuarios WHERE email=?').bind(email).first();
  if (existe) return c.json({ error: 'Ya existe un usuario con ese email' }, 409);
  const hashed = await hash(password, 10);
  const { meta } = await c.env.DB.prepare('INSERT INTO usuarios (tenant_id,nombre,email,password,rol) VALUES (?,?,?,?,?)').bind(tenant_id, nombre, email, hashed, rol).run();
  return c.json({ id: meta.last_row_id, mensaje: 'Usuario creado' }, 201);
});

usuarios.put('/:id', authMiddleware, adminOnly, async c => {
  const { tenant_id } = c.get('user');
  const { nombre, email, rol, activo } = await c.req.json();
  if (!nombre || !email || !rol) return c.json({ error: 'Nombre, email y rol son requeridos' }, 400);
  if (!ROLES.includes(rol)) return c.json({ error: `Rol inválido. Permitidos: ${ROLES.join(', ')}` }, 400);
  const existe = await c.env.DB.prepare('SELECT id FROM usuarios WHERE email=? AND id!=? AND tenant_id=?').bind(email, c.req.param('id'), tenant_id).first();
  if (existe) return c.json({ error: 'Ese email ya está en uso' }, 409);
  await c.env.DB.prepare('UPDATE usuarios SET nombre=?,email=?,rol=?,activo=? WHERE id=? AND tenant_id=?').bind(nombre, email, rol, activo ?? 1, c.req.param('id'), tenant_id).run();
  return c.json({ mensaje: 'Usuario actualizado' });
});

usuarios.patch('/:id/password', authMiddleware, async c => {
  const user = c.get('user');
  const esPropioUsuario = String(user.id) === c.req.param('id');
  if (!esPropioUsuario && user.rol !== 'admin') return c.json({ error: 'Acceso denegado' }, 403);
  const { password } = await c.req.json();
  if (!password || password.length < 6) return c.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, 400);
  const hashed = await hash(password, 10);
  await c.env.DB.prepare('UPDATE usuarios SET password=? WHERE id=? AND tenant_id=?').bind(hashed, c.req.param('id'), user.tenant_id).run();
  return c.json({ mensaje: 'Contraseña actualizada' });
});

usuarios.patch('/:id/activo', authMiddleware, adminOnly, async c => {
  const user = c.get('user');
  if (String(user.id) === c.req.param('id')) return c.json({ error: 'No podés desactivar tu propia cuenta' }, 400);
  const { activo } = await c.req.json();
  await c.env.DB.prepare('UPDATE usuarios SET activo=? WHERE id=? AND tenant_id=?').bind(activo ? 1 : 0, c.req.param('id'), user.tenant_id).run();
  return c.json({ mensaje: activo ? 'Usuario activado' : 'Usuario desactivado' });
});

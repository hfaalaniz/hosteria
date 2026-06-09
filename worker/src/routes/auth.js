import { Hono } from 'hono';
import { compare, hash } from 'bcryptjs';
import { sign } from '@tsndr/cloudflare-worker-jwt';
import { authMiddleware } from '../middleware/auth.js';

export const auth = new Hono();

auth.post('/login', async c => {
  const { email, password } = await c.req.json();
  if (!email || !password) return c.json({ error: 'Email y contraseña requeridos' }, 400);

  const usuario = await c.env.DB.prepare('SELECT * FROM usuarios WHERE email = ? AND activo = 1').bind(email).first();
  if (!usuario) return c.json({ error: 'Credenciales inválidas' }, 401);

  const valido = await compare(password, usuario.password);
  if (!valido) return c.json({ error: 'Credenciales inválidas' }, 401);

  const token = await sign(
    { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol, exp: Math.floor(Date.now() / 1000) + 86400 },
    c.env.JWT_SECRET
  );
  return c.json({ token, usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol } });
});

auth.get('/me', authMiddleware, async c => {
  const user = c.get('user');
  const usuario = await c.env.DB.prepare('SELECT id, nombre, email, rol FROM usuarios WHERE id = ?').bind(user.id).first();
  return c.json(usuario);
});

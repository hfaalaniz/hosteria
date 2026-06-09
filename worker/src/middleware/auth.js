import { verify } from '@tsndr/cloudflare-worker-jwt';

export async function authMiddleware(c, next) {
  const token = c.req.header('Authorization')?.split(' ')[1];
  if (!token) return c.json({ error: 'Token requerido' }, 401);

  try {
    const ok = await verify(token, c.env.JWT_SECRET);
    if (!ok) return c.json({ error: 'Token inválido' }, 401);
    // decode payload
    const [, payload] = token.split('.');
    c.set('user', JSON.parse(atob(payload)));
    return next();
  } catch {
    return c.json({ error: 'Token inválido' }, 401);
  }
}

export function adminOnly(c, next) {
  const user = c.get('user');
  if (user?.rol !== 'admin') return c.json({ error: 'Acceso denegado' }, 403);
  return next();
}

import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { sign } from '@tsndr/cloudflare-worker-jwt';

export const tenants = new Hono();

const SEED_TIPOS = [
  { nombre: 'Individual', descripcion: 'Habitación individual con cama simple', capacidad: 1, precio_base: 50, precio_fin_semana: 60, amenidades: '["TV","Wifi","Baño privado"]' },
  { nombre: 'Doble', descripcion: 'Habitación doble con cama matrimonial', capacidad: 2, precio_base: 80, precio_fin_semana: 95, amenidades: '["TV","Wifi","Baño privado","Frigobar"]' },
  { nombre: 'Suite', descripcion: 'Suite con sala de estar y vista panorámica', capacidad: 4, precio_base: 150, precio_fin_semana: 180, amenidades: '["TV","Wifi","Baño privado","Frigobar","Jacuzzi","Sala de estar"]' },
  { nombre: 'Familiar', descripcion: 'Habitación familiar con dos camas dobles', capacidad: 4, precio_base: 120, precio_fin_semana: 140, amenidades: '["TV","Wifi","Baño privado","Frigobar"]' },
];

const SEED_SERVICIOS = [
  { nombre: 'Desayuno buffet', descripcion: 'Desayuno completo incluido', precio: 12, categoria: 'desayuno' },
  { nombre: 'Almuerzo', descripcion: 'Almuerzo en el comedor', precio: 18, categoria: 'almuerzo' },
  { nombre: 'Cena', descripcion: 'Cena de 3 tiempos', precio: 22, categoria: 'cena' },
  { nombre: 'Lavandería básica', descripcion: 'Lavado y secado de ropa', precio: 15, categoria: 'lavanderia' },
  { nombre: 'Transfer aeropuerto', descripcion: 'Traslado al/desde aeropuerto', precio: 40, categoria: 'transporte' },
];

const SEED_HABITACIONES = [
  ['101', 1, 0], ['102', 1, 0], ['103', 1, 1], ['104', 1, 1], ['105', 1, 1],
  ['201', 2, 1], ['202', 2, 1], ['203', 2, 3], ['204', 2, 3], ['205', 2, 2],
  ['301', 3, 2], ['302', 3, 2],
];

const CONFIG_DEFAULT = [
  ['nombre_hosteria', 'Mi Hostería'],
  ['direccion', 'Calle Principal 123'],
  ['telefono', '+54 11 1234-5678'],
  ['email', 'info@mihosteria.com'],
  ['moneda', 'USD'],
  ['simbolo_moneda', '$'],
  ['impuesto_porcentaje', '0'],
  ['hora_checkin', '14:00'],
  ['hora_checkout', '11:00'],
  ['smtp_habilitado', '0'],
  ['smtp_host', ''],
  ['smtp_port', '587'],
  ['smtp_user', ''],
  ['smtp_pass', ''],
  ['smtp_from', ''],
  ['descuentos_noches', '[{"desde":7,"pct":15,"label":"Semana completa"},{"desde":4,"pct":10,"label":"Estadía larga"},{"desde":2,"pct":5,"label":"Varios días"}]'],
  ['pago_cbu', ''],
  ['pago_alias', ''],
  ['pago_titular', ''],
  ['pago_banco', ''],
  ['pago_instrucciones', ''],
  ['resend_api_key', ''],
];

const PERMISOS_RECEPCION = ['dashboard','calendario','habitaciones','reservas','huespedes','checkin','checkout','facturacion','servicios'];
const PERMISOS_LIMPIEZA = ['dashboard','habitaciones','partes_limpieza'];
const PERMISOS_MANTENIMIENTO = ['dashboard','habitaciones','partes_mantenimiento'];

async function seedTenant(db, tenantId) {
  const stmts = [];

  // Configuración
  for (const [clave, valor] of CONFIG_DEFAULT) {
    stmts.push(db.prepare('INSERT OR IGNORE INTO configuracion_mt (tenant_id,clave,valor) VALUES (?,?,?)').bind(tenantId, clave, valor));
  }

  // Tipos de habitación
  for (const t of SEED_TIPOS) {
    stmts.push(db.prepare('INSERT INTO tipos_habitacion (tenant_id,nombre,descripcion,capacidad,precio_base,precio_fin_semana,amenidades,activo) VALUES (?,?,?,?,?,?,?,1)').bind(tenantId, t.nombre, t.descripcion, t.capacidad, t.precio_base, t.precio_fin_semana, t.amenidades));
  }

  // Servicios
  for (const s of SEED_SERVICIOS) {
    stmts.push(db.prepare('INSERT INTO servicios (tenant_id,nombre,descripcion,precio,categoria,activo) VALUES (?,?,?,?,?,1)').bind(tenantId, s.nombre, s.descripcion, s.precio, s.categoria));
  }

  // Permisos
  for (const m of PERMISOS_RECEPCION) stmts.push(db.prepare('INSERT OR IGNORE INTO permisos_rol (tenant_id,rol,modulo) VALUES (?,?,?)').bind(tenantId, 'recepcion', m));
  for (const m of PERMISOS_LIMPIEZA) stmts.push(db.prepare('INSERT OR IGNORE INTO permisos_rol (tenant_id,rol,modulo) VALUES (?,?,?)').bind(tenantId, 'limpieza', m));
  for (const m of PERMISOS_MANTENIMIENTO) stmts.push(db.prepare('INSERT OR IGNORE INTO permisos_rol (tenant_id,rol,modulo) VALUES (?,?,?)').bind(tenantId, 'mantenimiento', m));

  await db.batch(stmts);

  // Habitaciones (necesitan los IDs de tipos recién creados)
  const { results: tipos } = await db.prepare('SELECT id,nombre FROM tipos_habitacion WHERE tenant_id=? ORDER BY id').bind(tenantId).all();
  const tipoIdx = [tipos[0]?.id, tipos[1]?.id, tipos[2]?.id, tipos[3]?.id]; // individual, doble, suite, familiar

  const habStmts = SEED_HABITACIONES.map(([numero, piso, tipoPos]) =>
    db.prepare('INSERT INTO habitaciones (tenant_id,numero,piso,tipo_id) VALUES (?,?,?,?)').bind(tenantId, numero, piso, tipoIdx[tipoPos])
  );
  await db.batch(habStmts);
}

// POST /api/tenants/registro
tenants.post('/registro', async c => {
  const { nombre_hosteria, email, password, nombre_admin } = await c.req.json();

  if (!nombre_hosteria || !email || !password)
    return c.json({ error: 'nombre_hosteria, email y password son requeridos' }, 400);
  if (password.length < 6)
    return c.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, 400);

  // Verificar email no duplicado
  const emailExiste = await c.env.DB.prepare('SELECT id FROM usuarios WHERE email=?').bind(email).first();
  if (emailExiste) return c.json({ error: 'Ya existe una cuenta con ese email' }, 400);

  // Generar slug único desde nombre
  let slug = nombre_hosteria.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 40);
  const slugExiste = await c.env.DB.prepare('SELECT id FROM tenants WHERE slug=?').bind(slug).first();
  if (slugExiste) slug = slug + '-' + Date.now().toString(36);

  // Crear tenant
  const { meta: tenantMeta } = await c.env.DB.prepare('INSERT INTO tenants (nombre,slug,plan) VALUES (?,?,?)').bind(nombre_hosteria, slug, 'trial').run();
  const tenantId = tenantMeta.last_row_id;

  // Crear usuario admin
  const hash = await bcrypt.hash(password, 10);
  const { meta: userMeta } = await c.env.DB.prepare('INSERT INTO usuarios (tenant_id,nombre,email,password,rol) VALUES (?,?,?,?,?)').bind(tenantId, nombre_admin || 'Administrador', email, hash, 'admin').run();
  const userId = userMeta.last_row_id;

  // Seed datos de ejemplo
  await seedTenant(c.env.DB, tenantId);

  // Generar JWT
  const token = await sign({ id: userId, nombre: nombre_admin || 'Administrador', email, rol: 'admin', tenant_id: tenantId }, c.env.JWT_SECRET);

  return c.json({
    token,
    usuario: { id: userId, nombre: nombre_admin || 'Administrador', email, rol: 'admin', tenant_id: tenantId },
    tenant: { id: tenantId, nombre: nombre_hosteria, slug },
    aviso: '¡Bienvenido! Tu sistema está listo con datos de ejemplo. Te recomendamos: 1) Actualizar el nombre de la hostería en Configuración, 2) Renombrar o eliminar las habitaciones de ejemplo, 3) Configurar tu email en Configuración.',
  }, 201);
});

// GET /api/tenants/mi-tenant (info del tenant actual)
tenants.get('/mi-tenant', async c => {
  const user = c.get('user');
  if (!user?.tenant_id) return c.json({ error: 'No autenticado' }, 401);
  const tenant = await c.env.DB.prepare('SELECT id,nombre,slug,plan,creado_en FROM tenants WHERE id=?').bind(user.tenant_id).first();
  return c.json(tenant);
});

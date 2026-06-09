-- Schema completo multi-tenant para hosteria-db
-- Uso: npx wrangler d1 execute hosteria-db --remote --file=worker/schema_final.sql

CREATE TABLE IF NOT EXISTS tenants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL DEFAULT 'trial',
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER REFERENCES tenants(id),
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  password TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'recepcion',
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(email)
);

CREATE TABLE IF NOT EXISTS tipos_habitacion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER REFERENCES tenants(id),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  capacidad INTEGER NOT NULL DEFAULT 2,
  precio_base REAL NOT NULL,
  precio_fin_semana REAL,
  imagen TEXT,
  amenidades TEXT,
  camas TEXT DEFAULT '[]',
  activo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS habitaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER REFERENCES tenants(id),
  numero TEXT NOT NULL,
  piso INTEGER NOT NULL DEFAULT 1,
  tipo_id INTEGER NOT NULL,
  estado TEXT NOT NULL DEFAULT 'disponible',
  notas TEXT,
  camas TEXT DEFAULT '[]',
  precio_override REAL,
  descripcion TEXT,
  metros_cuadrados INTEGER,
  vista TEXT,
  bano_privado INTEGER DEFAULT 1,
  FOREIGN KEY (tipo_id) REFERENCES tipos_habitacion(id),
  UNIQUE(tenant_id, numero)
);

CREATE TABLE IF NOT EXISTS huespedes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER REFERENCES tenants(id),
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  email TEXT,
  telefono TEXT,
  documento_tipo TEXT,
  documento_numero TEXT,
  nacionalidad TEXT,
  fecha_nacimiento DATE,
  direccion TEXT,
  notas TEXT,
  foto_documento TEXT,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reservas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER REFERENCES tenants(id),
  codigo TEXT NOT NULL,
  huesped_id INTEGER NOT NULL,
  habitacion_id INTEGER NOT NULL,
  fecha_entrada DATE NOT NULL,
  fecha_salida DATE NOT NULL,
  adultos INTEGER NOT NULL DEFAULT 1,
  ninos INTEGER NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'pendiente',
  origen TEXT DEFAULT 'directo',
  precio_total REAL NOT NULL,
  precio_noche REAL NOT NULL,
  noches INTEGER NOT NULL,
  notas TEXT,
  notas_internas TEXT,
  senia REAL,
  senia_cobrada INTEGER NOT NULL DEFAULT 0,
  senia_metodo TEXT,
  senia_fecha TEXT,
  cancelacion_penalidad INTEGER DEFAULT 0,
  cancelacion_dias_anticipacion INTEGER,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (huesped_id) REFERENCES huespedes(id),
  FOREIGN KEY (habitacion_id) REFERENCES habitaciones(id),
  UNIQUE(tenant_id, codigo)
);

CREATE TABLE IF NOT EXISTS reserva_acompanantes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER REFERENCES tenants(id),
  reserva_id INTEGER NOT NULL REFERENCES reservas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK(tipo IN ('adulto','nino')),
  nombre TEXT NOT NULL,
  documento_tipo TEXT,
  documento_numero TEXT,
  edad INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS servicios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER REFERENCES tenants(id),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  precio REAL NOT NULL,
  categoria TEXT,
  activo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS consumos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER REFERENCES tenants(id),
  reserva_id INTEGER NOT NULL,
  servicio_id INTEGER,
  descripcion TEXT NOT NULL,
  cantidad INTEGER NOT NULL DEFAULT 1,
  precio_unitario REAL NOT NULL,
  total REAL NOT NULL,
  fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reserva_id) REFERENCES reservas(id),
  FOREIGN KEY (servicio_id) REFERENCES servicios(id)
);

CREATE TABLE IF NOT EXISTS facturas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER REFERENCES tenants(id),
  numero TEXT NOT NULL,
  reserva_id INTEGER NOT NULL,
  huesped_id INTEGER NOT NULL,
  subtotal REAL NOT NULL,
  impuestos REAL NOT NULL DEFAULT 0,
  descuento REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL,
  metodo_pago TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente',
  notas TEXT,
  emitida_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reserva_id) REFERENCES reservas(id),
  FOREIGN KEY (huesped_id) REFERENCES huespedes(id),
  UNIQUE(tenant_id, numero)
);

CREATE TABLE IF NOT EXISTS mantenimiento (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER REFERENCES tenants(id),
  habitacion_id INTEGER NOT NULL,
  descripcion TEXT NOT NULL,
  prioridad TEXT DEFAULT 'media',
  estado TEXT DEFAULT 'pendiente',
  reportado_por INTEGER,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  resuelto_en DATETIME,
  FOREIGN KEY (habitacion_id) REFERENCES habitaciones(id)
);

CREATE TABLE IF NOT EXISTS partes_limpieza (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER REFERENCES tenants(id),
  habitacion_id INTEGER NOT NULL,
  usuario_id INTEGER NOT NULL,
  fecha DATE NOT NULL DEFAULT (DATE('now')),
  turno TEXT DEFAULT 'manana',
  estado_habitacion TEXT DEFAULT 'limpia',
  tareas_realizadas TEXT DEFAULT '[]',
  hallazgos TEXT,
  objetos_encontrados TEXT,
  insumos_usados TEXT DEFAULT '[]',
  insumos_faltantes TEXT DEFAULT '[]',
  ropa_cama TEXT DEFAULT 'ok',
  toallas TEXT DEFAULT 'ok',
  amenities TEXT DEFAULT 'ok',
  minibar TEXT DEFAULT 'no_aplica',
  observaciones TEXT,
  tiempo_minutos INTEGER,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (habitacion_id) REFERENCES habitaciones(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS partes_mantenimiento (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER REFERENCES tenants(id),
  habitacion_id INTEGER NOT NULL,
  usuario_id INTEGER NOT NULL,
  fecha DATE NOT NULL DEFAULT (DATE('now')),
  tipo TEXT DEFAULT 'correctivo',
  descripcion TEXT NOT NULL,
  diagnostico TEXT,
  trabajo_realizado TEXT,
  estado TEXT DEFAULT 'pendiente',
  prioridad TEXT DEFAULT 'media',
  materiales_usados TEXT DEFAULT '[]',
  materiales_necesarios TEXT DEFAULT '[]',
  requiere_externo INTEGER DEFAULT 0,
  proveedor_externo TEXT,
  costo_estimado REAL,
  costo_real REAL,
  tiempo_minutos INTEGER,
  observaciones TEXT,
  proxima_revision DATE,
  resuelto_en DATETIME,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (habitacion_id) REFERENCES habitaciones(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS configuracion_mt (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  clave TEXT NOT NULL,
  valor TEXT NOT NULL,
  UNIQUE(tenant_id, clave)
);

CREATE TABLE IF NOT EXISTS ical_feeds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER REFERENCES tenants(id),
  habitacion_id INTEGER NOT NULL REFERENCES habitaciones(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  url TEXT NOT NULL,
  activo INTEGER NOT NULL DEFAULT 1,
  ultimo_sync DATETIME,
  ultimo_resultado TEXT,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reservas_externas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER REFERENCES tenants(id),
  feed_id INTEGER NOT NULL REFERENCES ical_feeds(id) ON DELETE CASCADE,
  habitacion_id INTEGER NOT NULL REFERENCES habitaciones(id) ON DELETE CASCADE,
  uid TEXT NOT NULL,
  resumen TEXT,
  fecha_entrada DATE NOT NULL,
  fecha_salida DATE NOT NULL,
  origen TEXT DEFAULT 'externo',
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(feed_id, uid)
);

CREATE TABLE IF NOT EXISTS permisos_rol (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER REFERENCES tenants(id),
  rol TEXT NOT NULL,
  modulo TEXT NOT NULL,
  UNIQUE(tenant_id, rol, modulo)
);

CREATE TABLE IF NOT EXISTS notificaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER REFERENCES tenants(id),
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensaje TEXT,
  link TEXT,
  referencia_id INTEGER,
  referencia_tipo TEXT,
  leida INTEGER NOT NULL DEFAULT 0,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
);

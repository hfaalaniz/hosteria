-- Hostería D1 Schema
-- Run: npx wrangler d1 execute hosteria-db --file=schema.sql

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'recepcion',
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tipos_habitacion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  numero TEXT UNIQUE NOT NULL,
  piso INTEGER NOT NULL DEFAULT 1,
  tipo_id INTEGER NOT NULL,
  estado TEXT NOT NULL DEFAULT 'disponible',
  notas TEXT,
  camas TEXT DEFAULT '[]',
  precio_override REAL DEFAULT NULL,
  descripcion TEXT DEFAULT NULL,
  metros_cuadrados INTEGER DEFAULT NULL,
  vista TEXT DEFAULT NULL,
  bano_privado INTEGER DEFAULT 1,
  FOREIGN KEY (tipo_id) REFERENCES tipos_habitacion(id)
);

CREATE TABLE IF NOT EXISTS huespedes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  foto_documento TEXT DEFAULT NULL,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reservas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT UNIQUE NOT NULL,
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
  senia REAL DEFAULT NULL,
  senia_cobrada INTEGER NOT NULL DEFAULT 0,
  senia_metodo TEXT DEFAULT NULL,
  senia_fecha TEXT DEFAULT NULL,
  cancelacion_penalidad INTEGER DEFAULT 0,
  cancelacion_dias_anticipacion INTEGER DEFAULT NULL,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (huesped_id) REFERENCES huespedes(id),
  FOREIGN KEY (habitacion_id) REFERENCES habitaciones(id)
);

CREATE TABLE IF NOT EXISTS servicios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  precio REAL NOT NULL,
  categoria TEXT,
  activo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS consumos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  numero TEXT UNIQUE NOT NULL,
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
  FOREIGN KEY (huesped_id) REFERENCES huespedes(id)
);

CREATE TABLE IF NOT EXISTS mantenimiento (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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

CREATE TABLE IF NOT EXISTS ical_feeds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  rol TEXT NOT NULL,
  modulo TEXT NOT NULL,
  PRIMARY KEY (rol, modulo)
);

CREATE TABLE IF NOT EXISTS reserva_acompanantes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reserva_id INTEGER NOT NULL REFERENCES reservas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK(tipo IN ('adulto','nino')),
  nombre TEXT NOT NULL,
  documento_tipo TEXT,
  documento_numero TEXT,
  edad INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notificaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensaje TEXT,
  link TEXT,
  referencia_id INTEGER,
  referencia_tipo TEXT,
  leida INTEGER NOT NULL DEFAULT 0,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS configuracion (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

-- Default configuration
INSERT OR IGNORE INTO configuracion VALUES ('nombre_hosteria','Hostería Familiar');
INSERT OR IGNORE INTO configuracion VALUES ('direccion','Calle Principal 123');
INSERT OR IGNORE INTO configuracion VALUES ('telefono','+1 234 567 890');
INSERT OR IGNORE INTO configuracion VALUES ('email','info@hosteria.com');
INSERT OR IGNORE INTO configuracion VALUES ('moneda','USD');
INSERT OR IGNORE INTO configuracion VALUES ('simbolo_moneda','$');
INSERT OR IGNORE INTO configuracion VALUES ('impuesto_porcentaje','0');
INSERT OR IGNORE INTO configuracion VALUES ('hora_checkin','14:00');
INSERT OR IGNORE INTO configuracion VALUES ('hora_checkout','11:00');
INSERT OR IGNORE INTO configuracion VALUES ('smtp_host','');
INSERT OR IGNORE INTO configuracion VALUES ('smtp_port','587');
INSERT OR IGNORE INTO configuracion VALUES ('smtp_user','');
INSERT OR IGNORE INTO configuracion VALUES ('smtp_pass','');
INSERT OR IGNORE INTO configuracion VALUES ('smtp_from','');
INSERT OR IGNORE INTO configuracion VALUES ('smtp_habilitado','0');
INSERT OR IGNORE INTO configuracion VALUES ('descuentos_noches','[{"desde":7,"pct":15,"label":"Semana completa"},{"desde":4,"pct":10,"label":"Estadía larga"},{"desde":2,"pct":5,"label":"Varios días"}]');
INSERT OR IGNORE INTO configuracion VALUES ('pago_cbu','');
INSERT OR IGNORE INTO configuracion VALUES ('pago_alias','');
INSERT OR IGNORE INTO configuracion VALUES ('pago_titular','');
INSERT OR IGNORE INTO configuracion VALUES ('pago_banco','');
INSERT OR IGNORE INTO configuracion VALUES ('pago_instrucciones','');
INSERT OR IGNORE INTO configuracion VALUES ('resend_api_key','');

-- Default role permissions
INSERT OR IGNORE INTO permisos_rol VALUES ('recepcion','dashboard');
INSERT OR IGNORE INTO permisos_rol VALUES ('recepcion','calendario');
INSERT OR IGNORE INTO permisos_rol VALUES ('recepcion','habitaciones');
INSERT OR IGNORE INTO permisos_rol VALUES ('recepcion','reservas');
INSERT OR IGNORE INTO permisos_rol VALUES ('recepcion','huespedes');
INSERT OR IGNORE INTO permisos_rol VALUES ('recepcion','checkin');
INSERT OR IGNORE INTO permisos_rol VALUES ('recepcion','checkout');
INSERT OR IGNORE INTO permisos_rol VALUES ('recepcion','facturacion');
INSERT OR IGNORE INTO permisos_rol VALUES ('recepcion','servicios');
INSERT OR IGNORE INTO permisos_rol VALUES ('limpieza','dashboard');
INSERT OR IGNORE INTO permisos_rol VALUES ('limpieza','habitaciones');
INSERT OR IGNORE INTO permisos_rol VALUES ('limpieza','partes_limpieza');
INSERT OR IGNORE INTO permisos_rol VALUES ('mantenimiento','dashboard');
INSERT OR IGNORE INTO permisos_rol VALUES ('mantenimiento','habitaciones');
INSERT OR IGNORE INTO permisos_rol VALUES ('mantenimiento','partes_mantenimiento');

-- Sample room types
INSERT OR IGNORE INTO tipos_habitacion (id,nombre,descripcion,capacidad,precio_base,precio_fin_semana,amenidades) VALUES (1,'Individual','Habitación individual con cama simple',1,50,60,'["TV","Wifi","Baño privado"]');
INSERT OR IGNORE INTO tipos_habitacion (id,nombre,descripcion,capacidad,precio_base,precio_fin_semana,amenidades) VALUES (2,'Doble','Habitación doble con cama matrimonial',2,80,95,'["TV","Wifi","Baño privado","Frigobar"]');
INSERT OR IGNORE INTO tipos_habitacion (id,nombre,descripcion,capacidad,precio_base,precio_fin_semana,amenidades) VALUES (3,'Suite','Suite con sala de estar y vista panorámica',4,150,180,'["TV","Wifi","Baño privado","Frigobar","Jacuzzi","Sala de estar"]');
INSERT OR IGNORE INTO tipos_habitacion (id,nombre,descripcion,capacidad,precio_base,precio_fin_semana,amenidades) VALUES (4,'Familiar','Habitación familiar con dos camas dobles',4,120,140,'["TV","Wifi","Baño privado","Frigobar"]');

-- Sample rooms
INSERT OR IGNORE INTO habitaciones (numero,piso,tipo_id) VALUES ('101',1,1);
INSERT OR IGNORE INTO habitaciones (numero,piso,tipo_id) VALUES ('102',1,1);
INSERT OR IGNORE INTO habitaciones (numero,piso,tipo_id) VALUES ('103',1,2);
INSERT OR IGNORE INTO habitaciones (numero,piso,tipo_id) VALUES ('104',1,2);
INSERT OR IGNORE INTO habitaciones (numero,piso,tipo_id) VALUES ('105',1,2);
INSERT OR IGNORE INTO habitaciones (numero,piso,tipo_id) VALUES ('201',2,2);
INSERT OR IGNORE INTO habitaciones (numero,piso,tipo_id) VALUES ('202',2,2);
INSERT OR IGNORE INTO habitaciones (numero,piso,tipo_id) VALUES ('203',2,4);
INSERT OR IGNORE INTO habitaciones (numero,piso,tipo_id) VALUES ('204',2,4);
INSERT OR IGNORE INTO habitaciones (numero,piso,tipo_id) VALUES ('205',2,3);
INSERT OR IGNORE INTO habitaciones (numero,piso,tipo_id) VALUES ('301',3,3);
INSERT OR IGNORE INTO habitaciones (numero,piso,tipo_id) VALUES ('302',3,3);

-- Sample services
INSERT OR IGNORE INTO servicios (nombre,descripcion,precio,categoria) VALUES ('Desayuno buffet','Desayuno completo incluido',12,'desayuno');
INSERT OR IGNORE INTO servicios (nombre,descripcion,precio,categoria) VALUES ('Almuerzo','Almuerzo en el comedor',18,'almuerzo');
INSERT OR IGNORE INTO servicios (nombre,descripcion,precio,categoria) VALUES ('Cena','Cena de 3 tiempos',22,'cena');
INSERT OR IGNORE INTO servicios (nombre,descripcion,precio,categoria) VALUES ('Lavandería básica','Lavado y secado de ropa',15,'lavanderia');
INSERT OR IGNORE INTO servicios (nombre,descripcion,precio,categoria) VALUES ('Lavandería express','Lavado express en 3 horas',25,'lavanderia');
INSERT OR IGNORE INTO servicios (nombre,descripcion,precio,categoria) VALUES ('Transfer aeropuerto','Traslado al/desde aeropuerto',40,'transporte');

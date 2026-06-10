-- Fix 1: habitaciones.numero debe ser UNIQUE(tenant_id, numero), no UNIQUE global
-- SQLite no permite DROP CONSTRAINT, hay que recrear la tabla

PRAGMA foreign_keys = OFF;

CREATE TABLE habitaciones_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero TEXT NOT NULL,
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
  tenant_id INTEGER NOT NULL DEFAULT 1,
  UNIQUE(tenant_id, numero),
  FOREIGN KEY (tipo_id) REFERENCES tipos_habitacion(id)
);

INSERT INTO habitaciones_new SELECT * FROM habitaciones;
DROP TABLE habitaciones;
ALTER TABLE habitaciones_new RENAME TO habitaciones;

-- Fix 2: permisos_rol PK debe incluir tenant_id
CREATE TABLE permisos_rol_new (
  rol TEXT NOT NULL,
  modulo TEXT NOT NULL,
  tenant_id INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, rol, modulo)
);

INSERT INTO permisos_rol_new SELECT * FROM permisos_rol;
DROP TABLE permisos_rol;
ALTER TABLE permisos_rol_new RENAME TO permisos_rol;

PRAGMA foreign_keys = ON;

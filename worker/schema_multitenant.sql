-- Multi-tenant migration
-- Run: npx wrangler d1 execute hosteria-db --remote --file=worker/schema_multitenant.sql

-- 1. Tabla de tenants (hosterías)
CREATE TABLE IF NOT EXISTS tenants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL DEFAULT 'trial',
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Agregar tenant_id a todas las tablas operativas
ALTER TABLE usuarios ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE tipos_habitacion ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE habitaciones ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE huespedes ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE reservas ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE servicios ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE consumos ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE facturas ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE mantenimiento ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE partes_limpieza ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE partes_mantenimiento ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE ical_feeds ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE reservas_externas ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE permisos_rol ADD COLUMN tenant_id INTEGER;
ALTER TABLE reserva_acompanantes ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE notificaciones ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE configuracion ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);

-- 3. La tabla configuracion ya tiene clave TEXT PRIMARY KEY — necesitamos cambiar el esquema
-- para soportar múltiples tenants. Creamos una nueva tabla y migramos.
CREATE TABLE IF NOT EXISTS configuracion_mt (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  clave TEXT NOT NULL,
  valor TEXT NOT NULL,
  UNIQUE(tenant_id, clave)
);

-- 4. Crear tenant demo con los datos existentes (tenant_id = 1)
INSERT OR IGNORE INTO tenants (id, nombre, slug, plan) VALUES (1, 'Hostería Demo', 'demo', 'trial');

-- 5. Asignar tenant_id=1 a todos los datos existentes
UPDATE usuarios SET tenant_id=1 WHERE tenant_id IS NULL;
UPDATE tipos_habitacion SET tenant_id=1 WHERE tenant_id IS NULL;
UPDATE habitaciones SET tenant_id=1 WHERE tenant_id IS NULL;
UPDATE huespedes SET tenant_id=1 WHERE tenant_id IS NULL;
UPDATE reservas SET tenant_id=1 WHERE tenant_id IS NULL;
UPDATE servicios SET tenant_id=1 WHERE tenant_id IS NULL;
UPDATE consumos SET tenant_id=1 WHERE tenant_id IS NULL;
UPDATE facturas SET tenant_id=1 WHERE tenant_id IS NULL;
UPDATE mantenimiento SET tenant_id=1 WHERE tenant_id IS NULL;
UPDATE partes_limpieza SET tenant_id=1 WHERE tenant_id IS NULL;
UPDATE partes_mantenimiento SET tenant_id=1 WHERE tenant_id IS NULL;
UPDATE ical_feeds SET tenant_id=1 WHERE tenant_id IS NULL;
UPDATE reservas_externas SET tenant_id=1 WHERE tenant_id IS NULL;
UPDATE notificaciones SET tenant_id=1 WHERE tenant_id IS NULL;

-- 6. Migrar configuracion existente a configuracion_mt
INSERT OR IGNORE INTO configuracion_mt (tenant_id, clave, valor)
SELECT 1, clave, valor FROM configuracion;

-- 7. Permisos por rol también por tenant
UPDATE permisos_rol SET tenant_id=1 WHERE tenant_id IS NULL;

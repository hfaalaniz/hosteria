-- Migración: agregar tenant_id a todas las tablas existentes
-- tenant_id = 1 por defecto para datos existentes (primer tenant)

-- Primero asegurar que existe el tenant con id=1
INSERT OR IGNORE INTO tenants (id, nombre, slug, activo, creado_en)
VALUES (1, 'Demo Hostería', 'demo', 1, CURRENT_TIMESTAMP);

-- SQLite no permite ADD COLUMN con REFERENCES y DEFAULT no-NULL a la vez
-- Se agrega sin FK constraint (la integridad ya la controla la app)

ALTER TABLE usuarios ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE habitaciones ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE tipos_habitacion ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE huespedes ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE reservas ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE facturas ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE servicios ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE consumos ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE mantenimiento ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE notificaciones ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE partes_limpieza ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE partes_mantenimiento ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE ical_feeds ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE reservas_externas ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE permisos_rol ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1;

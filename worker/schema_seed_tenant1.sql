-- Seed de configuración y permisos para tenant_id=1

INSERT OR IGNORE INTO configuracion_mt (tenant_id,clave,valor) VALUES (1,'nombre_hosteria','Mi Hostería');
INSERT OR IGNORE INTO configuracion_mt (tenant_id,clave,valor) VALUES (1,'direccion','Calle Principal 123');
INSERT OR IGNORE INTO configuracion_mt (tenant_id,clave,valor) VALUES (1,'telefono','+54 11 1234-5678');
INSERT OR IGNORE INTO configuracion_mt (tenant_id,clave,valor) VALUES (1,'email','info@mihosteria.com');
INSERT OR IGNORE INTO configuracion_mt (tenant_id,clave,valor) VALUES (1,'moneda','USD');
INSERT OR IGNORE INTO configuracion_mt (tenant_id,clave,valor) VALUES (1,'simbolo_moneda','$');
INSERT OR IGNORE INTO configuracion_mt (tenant_id,clave,valor) VALUES (1,'impuesto_porcentaje','0');
INSERT OR IGNORE INTO configuracion_mt (tenant_id,clave,valor) VALUES (1,'hora_checkin','14:00');
INSERT OR IGNORE INTO configuracion_mt (tenant_id,clave,valor) VALUES (1,'hora_checkout','11:00');
INSERT OR IGNORE INTO configuracion_mt (tenant_id,clave,valor) VALUES (1,'smtp_habilitado','0');
INSERT OR IGNORE INTO configuracion_mt (tenant_id,clave,valor) VALUES (1,'smtp_host','');
INSERT OR IGNORE INTO configuracion_mt (tenant_id,clave,valor) VALUES (1,'smtp_port','587');
INSERT OR IGNORE INTO configuracion_mt (tenant_id,clave,valor) VALUES (1,'smtp_user','');
INSERT OR IGNORE INTO configuracion_mt (tenant_id,clave,valor) VALUES (1,'smtp_pass','');
INSERT OR IGNORE INTO configuracion_mt (tenant_id,clave,valor) VALUES (1,'smtp_from','');
INSERT OR IGNORE INTO configuracion_mt (tenant_id,clave,valor) VALUES (1,'descuentos_noches','[{"desde":7,"pct":15,"label":"Semana completa"},{"desde":4,"pct":10,"label":"Estadía larga"},{"desde":2,"pct":5,"label":"Varios días"}]');
INSERT OR IGNORE INTO configuracion_mt (tenant_id,clave,valor) VALUES (1,'pago_cbu','');
INSERT OR IGNORE INTO configuracion_mt (tenant_id,clave,valor) VALUES (1,'pago_alias','');
INSERT OR IGNORE INTO configuracion_mt (tenant_id,clave,valor) VALUES (1,'pago_titular','');
INSERT OR IGNORE INTO configuracion_mt (tenant_id,clave,valor) VALUES (1,'pago_banco','');
INSERT OR IGNORE INTO configuracion_mt (tenant_id,clave,valor) VALUES (1,'pago_instrucciones','');
INSERT OR IGNORE INTO configuracion_mt (tenant_id,clave,valor) VALUES (1,'resend_api_key','');

-- Permisos para roles en tenant 1
INSERT OR IGNORE INTO permisos_rol (tenant_id,rol,modulo) VALUES (1,'recepcion','dashboard');
INSERT OR IGNORE INTO permisos_rol (tenant_id,rol,modulo) VALUES (1,'recepcion','calendario');
INSERT OR IGNORE INTO permisos_rol (tenant_id,rol,modulo) VALUES (1,'recepcion','habitaciones');
INSERT OR IGNORE INTO permisos_rol (tenant_id,rol,modulo) VALUES (1,'recepcion','reservas');
INSERT OR IGNORE INTO permisos_rol (tenant_id,rol,modulo) VALUES (1,'recepcion','huespedes');
INSERT OR IGNORE INTO permisos_rol (tenant_id,rol,modulo) VALUES (1,'recepcion','checkin');
INSERT OR IGNORE INTO permisos_rol (tenant_id,rol,modulo) VALUES (1,'recepcion','checkout');
INSERT OR IGNORE INTO permisos_rol (tenant_id,rol,modulo) VALUES (1,'recepcion','facturacion');
INSERT OR IGNORE INTO permisos_rol (tenant_id,rol,modulo) VALUES (1,'recepcion','servicios');
INSERT OR IGNORE INTO permisos_rol (tenant_id,rol,modulo) VALUES (1,'limpieza','dashboard');
INSERT OR IGNORE INTO permisos_rol (tenant_id,rol,modulo) VALUES (1,'limpieza','habitaciones');
INSERT OR IGNORE INTO permisos_rol (tenant_id,rol,modulo) VALUES (1,'limpieza','partes_limpieza');
INSERT OR IGNORE INTO permisos_rol (tenant_id,rol,modulo) VALUES (1,'mantenimiento','dashboard');
INSERT OR IGNORE INTO permisos_rol (tenant_id,rol,modulo) VALUES (1,'mantenimiento','habitaciones');
INSERT OR IGNORE INTO permisos_rol (tenant_id,rol,modulo) VALUES (1,'mantenimiento','partes_mantenimiento');

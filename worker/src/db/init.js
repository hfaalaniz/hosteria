import { hash } from 'bcryptjs';

let initialized = false;

export async function initDB(DB) {
  if (initialized) return;
  initialized = true;

  await DB.exec(`
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
      precio_override REAL,
      descripcion TEXT,
      metros_cuadrados INTEGER,
      vista TEXT,
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
      foto_documento TEXT,
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
      senia REAL,
      senia_cobrada INTEGER NOT NULL DEFAULT 0,
      senia_metodo TEXT,
      senia_fecha TEXT,
      cancelacion_penalidad INTEGER DEFAULT 0,
      cancelacion_dias_anticipacion INTEGER,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (huesped_id) REFERENCES huespedes(id),
      FOREIGN KEY (habitacion_id) REFERENCES habitaciones(id)
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
    CREATE TABLE IF NOT EXISTS configuracion (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
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
    CREATE TABLE IF NOT EXISTS historial (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tabla TEXT NOT NULL,
      registro_id INTEGER NOT NULL,
      accion TEXT NOT NULL,
      datos_anteriores TEXT,
      datos_nuevos TEXT,
      usuario_id INTEGER,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Admin por defecto
  const admin = await DB.prepare('SELECT id FROM usuarios WHERE email = ?').bind('admin@hosteria.com').first();
  if (!admin) {
    const hashed = await hash('admin123', 10);
    await DB.prepare('INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)').bind('Administrador', 'admin@hosteria.com', hashed, 'admin').run();
  }

  // Configs por defecto
  const configs = [
    ['nombre_hosteria','Hostería Familiar'],['direccion','Calle Principal 123'],['telefono','+1 234 567 890'],
    ['email','info@hosteria.com'],['moneda','USD'],['simbolo_moneda','$'],['impuesto_porcentaje','0'],
    ['hora_checkin','14:00'],['hora_checkout','11:00'],['smtp_host',''],['smtp_port','587'],
    ['smtp_user',''],['smtp_pass',''],['smtp_from',''],['smtp_habilitado','0'],
    ['descuentos_noches',JSON.stringify([{desde:7,pct:15,label:'Semana completa'},{desde:4,pct:10,label:'Estadía larga'},{desde:2,pct:5,label:'Varios días'}])],
    ['pago_cbu',''],['pago_alias',''],['pago_titular',''],['pago_banco',''],['pago_instrucciones',''],
    ['resend_api_key',''],
  ];
  await DB.batch(configs.map(([k, v]) => DB.prepare('INSERT OR IGNORE INTO configuracion (clave, valor) VALUES (?, ?)').bind(k, v)));

  // Tipos de habitación de ejemplo
  const { results: tipos } = await DB.prepare('SELECT COUNT(*) as c FROM tipos_habitacion').all();
  if (tipos[0].c === 0) {
    await DB.batch([
      DB.prepare('INSERT INTO tipos_habitacion (nombre, descripcion, capacidad, precio_base, precio_fin_semana, amenidades) VALUES (?, ?, ?, ?, ?, ?)').bind('Individual','Hab. individual cama simple',1,50,60,JSON.stringify(['TV','Wifi','Baño privado'])),
      DB.prepare('INSERT INTO tipos_habitacion (nombre, descripcion, capacidad, precio_base, precio_fin_semana, amenidades) VALUES (?, ?, ?, ?, ?, ?)').bind('Doble','Hab. doble cama matrimonial',2,80,95,JSON.stringify(['TV','Wifi','Baño privado','Frigobar'])),
      DB.prepare('INSERT INTO tipos_habitacion (nombre, descripcion, capacidad, precio_base, precio_fin_semana, amenidades) VALUES (?, ?, ?, ?, ?, ?)').bind('Suite','Suite con sala de estar',4,150,180,JSON.stringify(['TV','Wifi','Baño privado','Frigobar','Jacuzzi'])),
      DB.prepare('INSERT INTO tipos_habitacion (nombre, descripcion, capacidad, precio_base, precio_fin_semana, amenidades) VALUES (?, ?, ?, ?, ?, ?)').bind('Familiar','Hab. familiar dos camas',4,120,140,JSON.stringify(['TV','Wifi','Baño privado','Frigobar'])),
    ]);
  }

  // Permisos por defecto
  const { results: perms } = await DB.prepare('SELECT COUNT(*) as c FROM permisos_rol').all();
  if (perms[0].c === 0) {
    const recepcion = ['dashboard','calendario','habitaciones','reservas','huespedes','checkin','checkout','facturacion','servicios'];
    const limpieza = ['dashboard','habitaciones','partes_limpieza'];
    const mant = ['dashboard','habitaciones','partes_mantenimiento'];
    const stmts = [
      ...recepcion.map(m => DB.prepare('INSERT OR IGNORE INTO permisos_rol VALUES (?,?)').bind('recepcion', m)),
      ...limpieza.map(m => DB.prepare('INSERT OR IGNORE INTO permisos_rol VALUES (?,?)').bind('limpieza', m)),
      ...mant.map(m => DB.prepare('INSERT OR IGNORE INTO permisos_rol VALUES (?,?)').bind('mantenimiento', m)),
    ];
    await DB.batch(stmts);
  }
}

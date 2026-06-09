const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.DB_PATH || './hosteria.db';
const db = new Database(path.resolve(DB_PATH));

// Habilitar WAL para mejor rendimiento
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDB() {
  db.exec(`
    -- Usuarios del sistema
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'recepcion', -- admin, recepcion, limpieza
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Tipos de habitación
    CREATE TABLE IF NOT EXISTS tipos_habitacion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      capacidad INTEGER NOT NULL DEFAULT 2,
      precio_base REAL NOT NULL,
      precio_fin_semana REAL,
      imagen TEXT,
      amenidades TEXT, -- JSON array
      activo INTEGER NOT NULL DEFAULT 1
    );

    -- Habitaciones
    CREATE TABLE IF NOT EXISTS habitaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT UNIQUE NOT NULL,
      piso INTEGER NOT NULL DEFAULT 1,
      tipo_id INTEGER NOT NULL,
      estado TEXT NOT NULL DEFAULT 'disponible', -- disponible, ocupada, limpieza, mantenimiento
      notas TEXT,
      FOREIGN KEY (tipo_id) REFERENCES tipos_habitacion(id)
    );

    -- Huéspedes
    CREATE TABLE IF NOT EXISTS huespedes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      apellido TEXT NOT NULL,
      email TEXT,
      telefono TEXT,
      documento_tipo TEXT, -- dni, pasaporte, cedula
      documento_numero TEXT,
      nacionalidad TEXT,
      fecha_nacimiento DATE,
      direccion TEXT,
      notas TEXT,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Reservas
    CREATE TABLE IF NOT EXISTS reservas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT UNIQUE NOT NULL,
      huesped_id INTEGER NOT NULL,
      habitacion_id INTEGER NOT NULL,
      fecha_entrada DATE NOT NULL,
      fecha_salida DATE NOT NULL,
      adultos INTEGER NOT NULL DEFAULT 1,
      ninos INTEGER NOT NULL DEFAULT 0,
      estado TEXT NOT NULL DEFAULT 'pendiente', -- pendiente, confirmada, checkin, checkout, cancelada, noshow
      origen TEXT DEFAULT 'directo', -- directo, web, telefono, booking, airbnb
      precio_total REAL NOT NULL,
      precio_noche REAL NOT NULL,
      noches INTEGER NOT NULL,
      notas TEXT,
      notas_internas TEXT,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (huesped_id) REFERENCES huespedes(id),
      FOREIGN KEY (habitacion_id) REFERENCES habitaciones(id)
    );

    -- Servicios adicionales
    CREATE TABLE IF NOT EXISTS servicios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      precio REAL NOT NULL,
      categoria TEXT, -- desayuno, almuerzo, cena, lavanderia, transporte, otro
      activo INTEGER NOT NULL DEFAULT 1
    );

    -- Consumos por reserva
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

    -- Facturas
    CREATE TABLE IF NOT EXISTS facturas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT UNIQUE NOT NULL,
      reserva_id INTEGER NOT NULL,
      huesped_id INTEGER NOT NULL,
      subtotal REAL NOT NULL,
      impuestos REAL NOT NULL DEFAULT 0,
      descuento REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL,
      metodo_pago TEXT, -- efectivo, tarjeta, transferencia
      estado TEXT NOT NULL DEFAULT 'pendiente', -- pendiente, pagada, anulada
      notas TEXT,
      emitida_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reserva_id) REFERENCES reservas(id),
      FOREIGN KEY (huesped_id) REFERENCES huespedes(id)
    );

    -- Mantenimiento
    CREATE TABLE IF NOT EXISTS mantenimiento (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      habitacion_id INTEGER NOT NULL,
      descripcion TEXT NOT NULL,
      prioridad TEXT DEFAULT 'media', -- baja, media, alta
      estado TEXT DEFAULT 'pendiente', -- pendiente, en_proceso, resuelto
      reportado_por INTEGER,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      resuelto_en DATETIME,
      FOREIGN KEY (habitacion_id) REFERENCES habitaciones(id)
    );

    -- Configuración general
    CREATE TABLE IF NOT EXISTS configuracion (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    );
  `);

  // Insertar usuario admin por defecto si no existe
  const adminExiste = db.prepare('SELECT id FROM usuarios WHERE email = ?').get('admin@hosteria.com');
  if (!adminExiste) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare(`
      INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)
    `).run('Administrador', 'admin@hosteria.com', hash, 'admin');
  }

  // Configuración por defecto
  const configs = [
    ['nombre_hosteria', 'Hostería Familiar'],
    ['direccion', 'Calle Principal 123'],
    ['telefono', '+1 234 567 890'],
    ['email', 'info@hosteria.com'],
    ['moneda', 'USD'],
    ['simbolo_moneda', '$'],
    ['impuesto_porcentaje', '0'],
    ['hora_checkin', '14:00'],
    ['hora_checkout', '11:00'],
    // SMTP — vacíos por defecto, el admin los completa
    ['smtp_host', ''],
    ['smtp_port', '587'],
    ['smtp_user', ''],
    ['smtp_pass', ''],
    ['smtp_from', ''],
    ['smtp_habilitado', '0'],
    // Descuentos por cantidad de noches (JSON array [{desde, pct, label}])
    ['descuentos_noches', JSON.stringify([
      { desde: 7, pct: 15, label: 'Semana completa' },
      { desde: 4, pct: 10, label: 'Estadía larga' },
      { desde: 2, pct:  5, label: 'Varios días' },
    ])],
    // Datos de pago para seña
    ['pago_cbu', ''],
    ['pago_alias', ''],
    ['pago_titular', ''],
    ['pago_banco', ''],
    ['pago_instrucciones', ''],
  ];
  const insertConfig = db.prepare('INSERT OR IGNORE INTO configuracion (clave, valor) VALUES (?, ?)');
  for (const [clave, valor] of configs) {
    insertConfig.run(clave, valor);
  }

  // Tipos de habitación de ejemplo
  const tiposExisten = db.prepare('SELECT COUNT(*) as count FROM tipos_habitacion').get();
  if (tiposExisten.count === 0) {
    db.prepare(`
      INSERT INTO tipos_habitacion (nombre, descripcion, capacidad, precio_base, precio_fin_semana, amenidades)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('Individual', 'Habitación individual con cama simple', 1, 50, 60, JSON.stringify(['TV', 'Wifi', 'Baño privado']));
    db.prepare(`
      INSERT INTO tipos_habitacion (nombre, descripcion, capacidad, precio_base, precio_fin_semana, amenidades)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('Doble', 'Habitación doble con cama matrimonial', 2, 80, 95, JSON.stringify(['TV', 'Wifi', 'Baño privado', 'Frigobar']));
    db.prepare(`
      INSERT INTO tipos_habitacion (nombre, descripcion, capacidad, precio_base, precio_fin_semana, amenidades)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('Suite', 'Suite con sala de estar y vista panorámica', 4, 150, 180, JSON.stringify(['TV', 'Wifi', 'Baño privado', 'Frigobar', 'Jacuzzi', 'Sala de estar']));
    db.prepare(`
      INSERT INTO tipos_habitacion (nombre, descripcion, capacidad, precio_base, precio_fin_semana, amenidades)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('Familiar', 'Habitación familiar con dos camas dobles', 4, 120, 140, JSON.stringify(['TV', 'Wifi', 'Baño privado', 'Frigobar']));

    // Habitaciones de ejemplo
    const tipos = db.prepare('SELECT id, nombre FROM tipos_habitacion').all();
    const individual = tipos.find(t => t.nombre === 'Individual');
    const doble = tipos.find(t => t.nombre === 'Doble');
    const suite = tipos.find(t => t.nombre === 'Suite');
    const familiar = tipos.find(t => t.nombre === 'Familiar');

    const habitaciones = [
      ['101', 1, individual.id], ['102', 1, individual.id], ['103', 1, doble.id],
      ['104', 1, doble.id], ['105', 1, doble.id],
      ['201', 2, doble.id], ['202', 2, doble.id], ['203', 2, familiar.id],
      ['204', 2, familiar.id], ['205', 2, suite.id],
      ['301', 3, suite.id], ['302', 3, suite.id],
    ];
    const insertHab = db.prepare('INSERT INTO habitaciones (numero, piso, tipo_id) VALUES (?, ?, ?)');
    for (const [numero, piso, tipo_id] of habitaciones) {
      insertHab.run(numero, piso, tipo_id);
    }

    // Servicios de ejemplo
    const servicios = [
      ['Desayuno buffet', 'Desayuno completo incluido', 12, 'desayuno'],
      ['Almuerzo', 'Almuerzo en el comedor', 18, 'almuerzo'],
      ['Cena', 'Cena de 3 tiempos', 22, 'cena'],
      ['Lavandería básica', 'Lavado y secado de ropa', 15, 'lavanderia'],
      ['Lavandería express', 'Lavado express en 3 horas', 25, 'lavanderia'],
      ['Transfer aeropuerto', 'Traslado al/desde aeropuerto', 40, 'transporte'],
    ];
    const insertServ = db.prepare('INSERT INTO servicios (nombre, descripcion, precio, categoria) VALUES (?, ?, ?, ?)');
    for (const [nombre, desc, precio, cat] of servicios) {
      insertServ.run(nombre, desc, precio, cat);
    }
  }

  // Migraciones: agregar columnas nuevas si no existen
  const cols = db.pragma('table_info(habitaciones)').map(c => c.name);
  if (!cols.includes('camas')) {
    db.exec("ALTER TABLE habitaciones ADD COLUMN camas TEXT DEFAULT '[]'");
    console.log('✅ Migración: columna camas agregada');
  }
  if (!cols.includes('precio_override')) {
    db.exec('ALTER TABLE habitaciones ADD COLUMN precio_override REAL DEFAULT NULL');
    console.log('✅ Migración: columna precio_override agregada');
  }
  if (!cols.includes('descripcion')) {
    db.exec('ALTER TABLE habitaciones ADD COLUMN descripcion TEXT DEFAULT NULL');
    console.log('✅ Migración: columna descripcion agregada');
  }
  if (!cols.includes('metros_cuadrados')) {
    db.exec('ALTER TABLE habitaciones ADD COLUMN metros_cuadrados INTEGER DEFAULT NULL');
    console.log('✅ Migración: columna metros_cuadrados agregada');
  }
  if (!cols.includes('vista')) {
    db.exec("ALTER TABLE habitaciones ADD COLUMN vista TEXT DEFAULT NULL");
    console.log('✅ Migración: columna vista agregada');
  }
  if (!cols.includes('bano_privado')) {
    db.exec('ALTER TABLE habitaciones ADD COLUMN bano_privado INTEGER DEFAULT 1');
    console.log('✅ Migración: columna bano_privado agregada');
  }

  // Migración: camas en tipos_habitacion
  const colsTipos = db.pragma('table_info(tipos_habitacion)').map(c => c.name);
  if (!colsTipos.includes('camas')) {
    db.exec("ALTER TABLE tipos_habitacion ADD COLUMN camas TEXT DEFAULT '[]'");
    console.log('✅ Migración: columna camas agregada a tipos_habitacion');
  }

  // Migración: seña en reservas
  const colsReservas = db.pragma('table_info(reservas)').map(c => c.name);
  if (!colsReservas.includes('senia')) {
    db.exec('ALTER TABLE reservas ADD COLUMN senia REAL DEFAULT NULL');
    console.log('✅ Migración: columna senia agregada a reservas');
  }
  if (!colsReservas.includes('senia_cobrada')) {
    db.exec('ALTER TABLE reservas ADD COLUMN senia_cobrada INTEGER NOT NULL DEFAULT 0');
    console.log('✅ Migración: columna senia_cobrada agregada a reservas');
  }
  if (!colsReservas.includes('senia_metodo')) {
    db.exec("ALTER TABLE reservas ADD COLUMN senia_metodo TEXT DEFAULT NULL");
    console.log('✅ Migración: columna senia_metodo agregada a reservas');
  }
  if (!colsReservas.includes('senia_fecha')) {
    db.exec("ALTER TABLE reservas ADD COLUMN senia_fecha TEXT DEFAULT NULL");
    console.log('✅ Migración: columna senia_fecha agregada a reservas');
  }
  if (!colsReservas.includes('cancelacion_penalidad')) {
    db.exec("ALTER TABLE reservas ADD COLUMN cancelacion_penalidad INTEGER DEFAULT 0");
    console.log('✅ Migración: columna cancelacion_penalidad agregada a reservas');
  }
  if (!colsReservas.includes('cancelacion_dias_anticipacion')) {
    db.exec("ALTER TABLE reservas ADD COLUMN cancelacion_dias_anticipacion INTEGER DEFAULT NULL");
    console.log('✅ Migración: columna cancelacion_dias_anticipacion agregada a reservas');
  }

  // Migración: foto_documento en huespedes
  const colsHuespedes = db.prepare("PRAGMA table_info(huespedes)").all().map(c => c.name);
  if (!colsHuespedes.includes('foto_documento')) {
    db.exec("ALTER TABLE huespedes ADD COLUMN foto_documento TEXT DEFAULT NULL");
    console.log('✅ Migración: columna foto_documento agregada a huespedes');
  }

  // Partes de limpieza
  db.exec(`
    CREATE TABLE IF NOT EXISTS partes_limpieza (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      habitacion_id INTEGER NOT NULL,
      usuario_id INTEGER NOT NULL,
      fecha DATE NOT NULL DEFAULT (DATE('now')),
      turno TEXT DEFAULT 'manana', -- manana, tarde, noche
      estado_habitacion TEXT DEFAULT 'limpia', -- limpia, sucia, muy_sucia, danio
      -- Tareas realizadas (JSON array de strings)
      tareas_realizadas TEXT DEFAULT '[]',
      -- Hallazgos (objetos olvidados, daños, etc.)
      hallazgos TEXT,
      objetos_encontrados TEXT,
      -- Insumos usados (JSON array de {nombre, cantidad, unidad})
      insumos_usados TEXT DEFAULT '[]',
      -- Insumos que faltan o hay que reponer (JSON array)
      insumos_faltantes TEXT DEFAULT '[]',
      -- Estado del equipamiento de la habitación
      ropa_cama TEXT DEFAULT 'ok', -- ok, cambio_parcial, cambio_total, falta
      toallas TEXT DEFAULT 'ok',
      amenities TEXT DEFAULT 'ok', -- shampoo, jabón, etc.
      minibar TEXT DEFAULT 'no_aplica',
      -- Observaciones generales
      observaciones TEXT,
      -- Tiempo empleado en minutos
      tiempo_minutos INTEGER,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (habitacion_id) REFERENCES habitaciones(id),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )
  `);

  // Partes de mantenimiento extendidos
  db.exec(`
    CREATE TABLE IF NOT EXISTS partes_mantenimiento (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      habitacion_id INTEGER NOT NULL,
      usuario_id INTEGER NOT NULL,
      fecha DATE NOT NULL DEFAULT (DATE('now')),
      -- Tipo de trabajo
      tipo TEXT DEFAULT 'correctivo', -- correctivo, preventivo, urgente
      -- Descripción del problema / trabajo
      descripcion TEXT NOT NULL,
      -- Lo que se encontró
      diagnostico TEXT,
      -- Lo que se hizo
      trabajo_realizado TEXT,
      -- Estado al cerrar
      estado TEXT DEFAULT 'pendiente', -- pendiente, en_proceso, resuelto, derivado
      prioridad TEXT DEFAULT 'media',
      -- Materiales/repuestos usados (JSON array de {nombre, cantidad, unidad, costo})
      materiales_usados TEXT DEFAULT '[]',
      -- Materiales que se necesitan pedir (JSON array)
      materiales_necesarios TEXT DEFAULT '[]',
      -- Si requiere personal externo
      requiere_externo INTEGER DEFAULT 0,
      proveedor_externo TEXT,
      -- Costo estimado y real
      costo_estimado REAL,
      costo_real REAL,
      -- Tiempo empleado
      tiempo_minutos INTEGER,
      -- Observaciones y próximos pasos
      observaciones TEXT,
      proxima_revision DATE,
      resuelto_en DATETIME,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (habitacion_id) REFERENCES habitaciones(id),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )
  `);

  // iCal feeds de canales externos (Booking, Airbnb, etc.)
  db.exec(`
    CREATE TABLE IF NOT EXISTS ical_feeds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      habitacion_id INTEGER NOT NULL REFERENCES habitaciones(id) ON DELETE CASCADE,
      nombre TEXT NOT NULL,
      url TEXT NOT NULL,
      activo INTEGER NOT NULL DEFAULT 1,
      ultimo_sync DATETIME,
      ultimo_resultado TEXT,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Reservas bloqueadas importadas desde feeds externos
  db.exec(`
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
    )
  `);

  // Tabla de permisos por rol
  db.exec(`
    CREATE TABLE IF NOT EXISTS permisos_rol (
      rol TEXT NOT NULL,
      modulo TEXT NOT NULL,
      PRIMARY KEY (rol, modulo)
    )
  `);

  db.prepare(`
    CREATE TABLE IF NOT EXISTS reserva_acompanantes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reserva_id INTEGER NOT NULL REFERENCES reservas(id) ON DELETE CASCADE,
      tipo TEXT NOT NULL CHECK(tipo IN ('adulto','nino')),
      nombre TEXT NOT NULL,
      documento_tipo TEXT,
      documento_numero TEXT,
      edad INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Permisos por defecto para roles existentes (solo si la tabla está vacía)
  const permisosExisten = db.prepare('SELECT COUNT(*) as c FROM permisos_rol').get().c;
  if (permisosExisten === 0) {
    const defaultRecepcion = ['dashboard','calendario','habitaciones','reservas','huespedes','checkin','checkout','facturacion','servicios'];
    const defaultLimpieza      = ['dashboard','habitaciones','partes_limpieza'];
    const defaultMantenimiento = ['dashboard','habitaciones','partes_mantenimiento'];
    const insertPerm = db.prepare('INSERT OR IGNORE INTO permisos_rol (rol, modulo) VALUES (?, ?)');
    for (const m of defaultRecepcion)    insertPerm.run('recepcion', m);
    for (const m of defaultLimpieza)     insertPerm.run('limpieza', m);
    for (const m of defaultMantenimiento) insertPerm.run('mantenimiento', m);
    console.log('✅ Permisos por defecto creados');
  }

  // Notificaciones persistentes del sistema
  db.exec(`
    CREATE TABLE IF NOT EXISTS notificaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL,         -- reserva_web, mantenimiento_urgente, checkout_pendiente, noshow, otro
      titulo TEXT NOT NULL,
      mensaje TEXT,
      link TEXT,                  -- ruta interna a la que navegar al hacer click, ej: /reservas
      referencia_id INTEGER,      -- id del recurso relacionado (reserva, parte, etc.)
      referencia_tipo TEXT,       -- reservas, mantenimiento, partes_mantenimiento, etc.
      leida INTEGER NOT NULL DEFAULT 0,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('✅ Base de datos inicializada correctamente');
}

module.exports = { db, initDB };

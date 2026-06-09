const { db } = require('../db/database');

/**
 * Crea una notificación persistente en la base de datos.
 * @param {string} tipo - reserva_web | mantenimiento_urgente | checkout_pendiente | noshow | objeto_encontrado | otro
 * @param {string} titulo - Texto corto para el pill
 * @param {string|null} mensaje - Detalle opcional
 * @param {string|null} link - Ruta interna al hacer click, ej: '/reservas'
 * @param {number|null} referencia_id - ID del recurso relacionado
 * @param {string|null} referencia_tipo - Nombre de la tabla/recurso
 */
function crearNotificacion(tipo, titulo, mensaje, link, referencia_id, referencia_tipo) {
  try {
    db.prepare(`
      INSERT INTO notificaciones (tipo, titulo, mensaje, link, referencia_id, referencia_tipo)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(tipo, titulo, mensaje || null, link || null, referencia_id || null, referencia_tipo || null);
  } catch (e) {
    console.error('Error creando notificación:', e.message);
  }
}

module.exports = { crearNotificacion };

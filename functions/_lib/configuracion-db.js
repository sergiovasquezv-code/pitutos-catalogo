// Configuración general del catálogo (por ahora, solo el mensaje
// destacado de promociones/avisos) — una sola fila fija (id=1).

export async function obtenerConfiguracion(db) {
  const fila = await db.prepare("SELECT * FROM configuracion_catalogo WHERE id = 1").first();
  return fila || { mensaje_destacado: null, mensaje_activo: 0 };
}

export async function actualizarConfiguracion(db, { mensajeDestacado, mensajeActivo }) {
  await db
    .prepare(
      `INSERT INTO configuracion_catalogo (id, mensaje_destacado, mensaje_activo, actualizado_en)
       VALUES (1, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET mensaje_destacado = excluded.mensaje_destacado, mensaje_activo = excluded.mensaje_activo, actualizado_en = excluded.actualizado_en`
    )
    .bind(mensajeDestacado || null, mensajeActivo ? 1 : 0)
    .run();
}

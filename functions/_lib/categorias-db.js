// Categorías del catálogo: tienen su propio orden (`orden`), así que
// subir o bajar una categoría mueve con ella a todos sus productos, sin
// tocar los productos uno por uno — el listado siempre se agrupa por
// categorias.orden.

export async function listarCategorias(db) {
  const { results } = await db.prepare("SELECT * FROM categorias ORDER BY orden ASC, id ASC").all();
  return results || [];
}

export async function crearCategoria(db, nombre) {
  const existente = await db.prepare("SELECT id FROM categorias WHERE nombre = ?").bind(nombre).first();
  if (existente) return { error: "Ya existe una categoría con ese nombre." };

  const fila = await db.prepare("SELECT COALESCE(MAX(orden), 0) AS maximo FROM categorias").first();
  const orden = (fila?.maximo || 0) + 1;
  const result = await db
    .prepare("INSERT INTO categorias (nombre, orden, creado_en) VALUES (?,?,datetime('now'))")
    .bind(nombre, orden)
    .run();
  return { id: result.meta.last_row_id };
}

export async function renombrarCategoria(db, id, nuevoNombre) {
  const choque = await db.prepare("SELECT id FROM categorias WHERE nombre = ? AND id != ?").bind(nuevoNombre, id).first();
  if (choque) return { error: "Ya existe otra categoría con ese nombre." };

  await db.prepare("UPDATE categorias SET nombre = ? WHERE id = ?").bind(nuevoNombre, id).run();
  return { ok: true };
}

// Intercambia el `orden` con la categoría vecina (arriba/abajo), así los
// productos de ambas categorías se reordenan juntos automáticamente.
export async function moverCategoria(db, id, direccion) {
  const categorias = await listarCategorias(db);
  const idx = categorias.findIndex((c) => c.id === Number(id));
  if (idx === -1) return { error: "Categoría no encontrada." };

  const vecinoIdx = direccion === "arriba" ? idx - 1 : idx + 1;
  if (vecinoIdx < 0 || vecinoIdx >= categorias.length) return { ok: true }; // ya está en el extremo, no hay nada que mover

  const actual = categorias[idx];
  const vecino = categorias[vecinoIdx];

  await db.batch([
    db.prepare("UPDATE categorias SET orden = ? WHERE id = ?").bind(vecino.orden, actual.id),
    db.prepare("UPDATE categorias SET orden = ? WHERE id = ?").bind(actual.orden, vecino.id),
  ]);
  return { ok: true };
}

// Antes de borrar una categoría, sus productos se pasan a "Sin
// categoría" (se crea si todavía no existe) para que ningún producto
// quede huérfano.
export async function eliminarCategoria(db, id) {
  const categoria = await db.prepare("SELECT * FROM categorias WHERE id = ?").bind(id).first();
  if (!categoria) return { error: "Categoría no encontrada." };
  if (categoria.nombre === "Sin categoría") {
    return { error: '"Sin categoría" no se puede borrar — es la categoría de respaldo.' };
  }

  let sinCategoria = await db.prepare("SELECT id FROM categorias WHERE nombre = 'Sin categoría'").first();
  if (!sinCategoria) {
    const fila = await db.prepare("SELECT COALESCE(MAX(orden), 0) AS maximo FROM categorias").first();
    const result = await db
      .prepare("INSERT INTO categorias (nombre, orden, creado_en) VALUES ('Sin categoría', ?, datetime('now'))")
      .bind((fila?.maximo || 0) + 1)
      .run();
    sinCategoria = { id: result.meta.last_row_id };
  }

  await db.batch([
    db.prepare("UPDATE productos SET categoria_id = ? WHERE categoria_id = ?").bind(sinCategoria.id, id),
    db.prepare("DELETE FROM categorias WHERE id = ?").bind(id),
  ]);
  return { ok: true };
}

// Productos ahora viven en D1 (tabla `productos`), administrables desde
// el panel — reemplaza el catálogo fijo de archivo que se usaba antes.
// Cada producto pertenece a una categoría (tabla `categorias`, con su
// propio orden), así que el catálogo siempre se lista agrupado por
// categorias.orden y dentro de cada una por nombre de producto.

function slugify(texto) {
  return (texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // saca tildes
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// El sku es el identificador estable que se usa en los pedidos ya
// hechos — una vez creado un producto no cambia, aunque se le edite el
// nombre después.
export async function generarSkuUnico(db, nombre) {
  const base = slugify(nombre) || "producto";
  let sku = base;
  let intento = 1;
  while (await db.prepare("SELECT id FROM productos WHERE sku = ?").bind(sku).first()) {
    intento += 1;
    sku = `${base}-${intento}`;
  }
  return sku;
}

const SELECT_ADMIN = `
  SELECT p.*, c.nombre AS categoria_nombre, c.orden AS categoria_orden
  FROM productos p
  LEFT JOIN categorias c ON c.id = p.categoria_id
`;

export async function listarProductosAdmin(db) {
  const { results } = await db.prepare(`${SELECT_ADMIN} ORDER BY c.orden ASC, p.orden ASC, p.nombre ASC`).all();
  return results || [];
}

export async function listarProductosPublicos(db) {
  const { results } = await db
    .prepare(
      `SELECT p.sku, p.nombre, p.precio, p.descripcion, p.foto_key, p.stock, p.tipo, c.nombre AS categoria_nombre, c.orden AS categoria_orden
       FROM productos p
       LEFT JOIN categorias c ON c.id = p.categoria_id
       WHERE p.disponible = 1
       ORDER BY c.orden ASC, p.orden ASC, p.nombre ASC`
    )
    .all();
  return results || [];
}

// Intercambia el `orden` con el producto vecino (arriba/abajo) DENTRO DE
// LA MISMA CATEGORÍA — mover un producto nunca lo saca de su categoría,
// solo cambia su posición entre los demás productos de ahí.
export async function moverProducto(db, id, direccion) {
  const producto = await db.prepare("SELECT * FROM productos WHERE id = ?").bind(id).first();
  if (!producto) return { error: "Producto no encontrado." };

  const { results: hermanos } = await db
    .prepare("SELECT id, orden FROM productos WHERE categoria_id = ? ORDER BY orden ASC, nombre ASC")
    .bind(producto.categoria_id)
    .all();

  const idx = hermanos.findIndex((p) => p.id === Number(id));
  if (idx === -1) return { error: "Producto no encontrado en su categoría." };

  const vecinoIdx = direccion === "arriba" ? idx - 1 : idx + 1;
  if (vecinoIdx < 0 || vecinoIdx >= hermanos.length) return { ok: true }; // ya está en el extremo

  const actual = hermanos[idx];
  const vecino = hermanos[vecinoIdx];

  await db.batch([
    db.prepare("UPDATE productos SET orden = ? WHERE id = ?").bind(vecino.orden, actual.id),
    db.prepare("UPDATE productos SET orden = ? WHERE id = ?").bind(actual.orden, vecino.id),
  ]);
  return { ok: true };
}

// Estadísticas rápidas para las tarjetas del panel de productos.
export async function estadisticasProductos(db) {
  const fila = await db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN disponible = 1 THEN 1 ELSE 0 END), 0) AS activos,
         COALESCE(SUM(CASE WHEN disponible = 1 AND tipo != 'servicio' AND stock <= 0 THEN 1 ELSE 0 END), 0) AS agotados,
         COALESCE(SUM(CASE WHEN disponible = 1 AND tipo != 'servicio' THEN stock ELSE 0 END), 0) AS unidades_stock,
         COALESCE(SUM(CASE WHEN disponible = 1 AND tipo != 'servicio' THEN precio * stock ELSE 0 END), 0) AS valor_inventario
       FROM productos`
    )
    .first();
  return fila || { activos: 0, agotados: 0, unidades_stock: 0, valor_inventario: 0 };
}

export async function buscarProductoPublico(db, sku) {
  return db.prepare("SELECT * FROM productos WHERE sku = ? AND disponible = 1").bind(sku).first();
}

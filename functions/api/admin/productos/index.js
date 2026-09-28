import { json } from "../../../_lib/json.js";
import { nowIso } from "../../../_lib/dates.js";
import { sesionValida } from "../../../_lib/session.js";
import { generarSkuUnico, listarProductosAdmin, estadisticasProductos } from "../../../_lib/productos-db.js";
import { randomFotoProductoKey } from "../../../_lib/tokens.js";

const MAX_BYTES = 6 * 1024 * 1024; // 6 MB
const TIPOS_PERMITIDOS = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function onRequestGet({ request, env }) {
  if (!(await sesionValida(request, env))) return json({ error: "No autorizado." }, 401);
  const [productos, stats] = await Promise.all([listarProductosAdmin(env.DB), estadisticasProductos(env.DB)]);
  return json({ productos, stats });
}

export async function onRequestPost({ request, env }) {
  if (!(await sesionValida(request, env))) return json({ error: "No autorizado." }, 401);

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "No se pudo leer el formulario." }, 400);
  }

  const nombre = (form.get("nombre") || "").toString().trim();
  const precio = Math.round(Number(form.get("precio")));
  const descripcion = (form.get("descripcion") || "").toString().trim();
  const tipo = form.get("tipo") === "servicio" ? "servicio" : "producto";
  // Los servicios no manejan stock (reparación de PC, configuración de
  // servidores, etc.) — se guarda en 0 y el catálogo no lo muestra.
  const stock = tipo === "servicio" ? 0 : Math.max(0, Math.round(Number(form.get("stock")) || 0));
  const disponible = form.get("disponible") === "false" ? 0 : 1;
  const categoriaId = Number(form.get("categoria_id"));
  const foto = form.get("foto");

  if (!nombre) return json({ error: "Falta el nombre del producto." }, 400);
  if (!Number.isFinite(precio) || precio < 0) return json({ error: "El precio no es válido." }, 400);
  if (!categoriaId) return json({ error: "Elige una categoría." }, 400);

  let fotoKey = null;
  if (foto && typeof foto !== "string") {
    if (!TIPOS_PERMITIDOS.has(foto.type)) {
      return json({ error: "La foto debe ser JPG, PNG, WEBP o GIF." }, 400);
    }
    if (foto.size > MAX_BYTES) {
      return json({ error: "La foto no puede pesar más de 6 MB." }, 400);
    }
    if (!env.FOTOS_PRODUCTOS) {
      return json({ error: "El almacenamiento de fotos no está configurado." }, 500);
    }
    fotoKey = randomFotoProductoKey(foto.name);
    await env.FOTOS_PRODUCTOS.put(fotoKey, await foto.arrayBuffer(), { httpMetadata: { contentType: foto.type } });
  }

  const db = env.DB;
  const sku = await generarSkuUnico(db, nombre);
  const ahora = nowIso();

  const result = await db
    .prepare(
      `INSERT INTO productos (sku, nombre, precio, descripcion, foto_key, stock, disponible, categoria_id, tipo, creado_en)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    )
    .bind(sku, nombre, precio, descripcion || null, fotoKey, stock, disponible, categoriaId, tipo, ahora)
    .run();

  return json({ ok: true, id: result.meta.last_row_id, sku });
}

import { json } from "../../../_lib/json.js";
import { nowIso } from "../../../_lib/dates.js";
import { sesionValida } from "../../../_lib/session.js";
import { randomFotoProductoKey } from "../../../_lib/tokens.js";
import { normalizarTipo, tieneStock, enlaceValido, asegurarColumnasDescarga } from "../../../_lib/productos-db.js";

const MAX_BYTES = 6 * 1024 * 1024; // 6 MB
const TIPOS_PERMITIDOS = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function onRequestPut({ request, env, params }) {
  if (!(await sesionValida(request, env))) return json({ error: "No autorizado." }, 401);

  const db = env.DB;
  await asegurarColumnasDescarga(db);
  const id = params.id;
  const producto = await db.prepare("SELECT * FROM productos WHERE id = ?").bind(id).first();
  if (!producto) return json({ error: "Producto no encontrado." }, 404);

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "No se pudo leer el formulario." }, 400);
  }

  const nombre = (form.get("nombre") || "").toString().trim() || producto.nombre;
  const precioRaw = form.get("precio");
  const precio = precioRaw === null || precioRaw === "" ? producto.precio : Math.round(Number(precioRaw));
  const descripcion = form.has("descripcion") ? (form.get("descripcion") || "").toString().trim() : producto.descripcion;
  const tipo = form.has("tipo") ? normalizarTipo(form.get("tipo")) : normalizarTipo(producto.tipo);
  const stockRaw = form.get("stock");
  // Servicios y descargas no manejan stock — si se cambia el tipo se
  // guarda en 0 aunque el formulario mande otra cosa.
  const stock = !tieneStock(tipo)
    ? 0
    : stockRaw === null || stockRaw === ""
      ? producto.stock
      : Math.max(0, Math.round(Number(stockRaw) || 0));
  const enlace = tipo !== "descarga" ? "" : form.has("enlace") ? enlaceValido(form.get("enlace")) : producto.enlace || "";
  const enlaceCompra =
    tipo !== "descarga" ? "" : form.has("enlace_compra") ? enlaceValido(form.get("enlace_compra")) : producto.enlace_compra || "";
  const disponible = form.has("disponible") ? (form.get("disponible") === "false" ? 0 : 1) : producto.disponible;
  const categoriaId = form.has("categoria_id") && form.get("categoria_id") ? Number(form.get("categoria_id")) : producto.categoria_id;
  const foto = form.get("foto");

  if (!Number.isFinite(precio) || precio < 0) return json({ error: "El precio no es válido." }, 400);
  if (tipo === "descarga" && !enlace) return json({ error: "Pon el enlace de descarga (debe empezar con https://)." }, 400);
  if (enlaceCompra === null) return json({ error: "El enlace para comprar debe empezar con https://." }, 400);

  let fotoKey = producto.foto_key;
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
    const nuevaKey = randomFotoProductoKey(foto.name);
    await env.FOTOS_PRODUCTOS.put(nuevaKey, await foto.arrayBuffer(), { httpMetadata: { contentType: foto.type } });
    if (fotoKey) await env.FOTOS_PRODUCTOS.delete(fotoKey).catch(() => {});
    fotoKey = nuevaKey;
  }

  await db
    .prepare(
      `UPDATE productos SET nombre=?, precio=?, descripcion=?, foto_key=?, stock=?, disponible=?, categoria_id=?, tipo=?, enlace=?, enlace_compra=?, actualizado_en=? WHERE id=?`
    )
    .bind(nombre, precio, descripcion || null, fotoKey, stock, disponible, categoriaId, tipo, enlace || null, enlaceCompra || null, nowIso(), id)
    .run();

  return json({ ok: true });
}

export async function onRequestDelete({ request, env, params }) {
  if (!(await sesionValida(request, env))) return json({ error: "No autorizado." }, 401);

  const db = env.DB;
  const id = params.id;
  const producto = await db.prepare("SELECT * FROM productos WHERE id = ?").bind(id).first();
  if (!producto) return json({ error: "Producto no encontrado." }, 404);

  await db.prepare("DELETE FROM productos WHERE id = ?").bind(id).run();
  if (producto.foto_key && env.FOTOS_PRODUCTOS) {
    await env.FOTOS_PRODUCTOS.delete(producto.foto_key).catch(() => {});
  }

  return json({ ok: true });
}

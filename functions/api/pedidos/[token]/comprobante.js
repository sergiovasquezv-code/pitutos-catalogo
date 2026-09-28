import { json } from "../../../_lib/json.js";
import { nowIso } from "../../../_lib/dates.js";
import { randomComprobanteKey } from "../../../_lib/tokens.js";
import { avisoComprobanteSubido } from "../../../_lib/email.js";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const TIPOS_PERMITIDOS = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]);

// El comprador sube su comprobante de transferencia con el link/token que
// le devolvió el checkout — no necesita cuenta ni login.
export async function onRequestPost({ request, env, params }) {
  const url = new URL(request.url);
  const db = env.DB;
  const token = params.token;
  const pedido = await db.prepare("SELECT * FROM pedidos WHERE public_token = ?").bind(token).first();
  if (!pedido) return json({ error: "Pedido no encontrado." }, 404);
  if (pedido.metodo_pago !== "transferencia") {
    return json({ error: "Este pedido no se paga por transferencia." }, 400);
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "No se pudo leer el archivo enviado." }, 400);
  }

  const file = form.get("comprobante");
  const nota = (form.get("nota") || "").toString().trim();

  if (!file || typeof file === "string") {
    return json({ error: "Selecciona una imagen o PDF del comprobante." }, 400);
  }
  if (!TIPOS_PERMITIDOS.has(file.type)) {
    return json({ error: "Solo se permiten imágenes (JPG, PNG, WEBP, GIF) o PDF." }, 400);
  }
  if (file.size > MAX_BYTES) {
    return json({ error: "El archivo no puede pesar más de 8 MB." }, 400);
  }
  if (!env.COMPROBANTES) {
    return json({ error: "El almacenamiento de comprobantes no está configurado." }, 500);
  }

  const key = randomComprobanteKey(pedido.id, file.name);
  await env.COMPROBANTES.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  await db
    .prepare(
      "UPDATE pedidos SET estado = 'comprobante_subido', comprobante_key = ?, comprobante_nota = ?, actualizado_en = ? WHERE id = ?"
    )
    .bind(key, nota || null, nowIso(), pedido.id)
    .run();

  await avisoComprobanteSubido(env, {
    id: pedido.id,
    nombre: pedido.nombre,
    total: pedido.total,
    comprobante_nota: nota,
    comprobante_url: `${url.protocol}//${url.host}/api/comprobantes/${key}`,
  });

  return json({ ok: true });
}

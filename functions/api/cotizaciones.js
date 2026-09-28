import { json } from "../_lib/json.js";
import { nowIso } from "../_lib/dates.js";
import { avisoNuevaCotizacion } from "../_lib/email.js";

// Solicitud de cotización desde el catálogo: en vez de pagar de inmediato
// (como con /api/pedidos), el cliente describe su proyecto/necesidad y eso
// queda registrado para que Sergio lo revise y lo contacte. Pensado para
// servicios (reparación de PC, configuración de servidores, etc.) donde no
// hay un precio ni stock fijo.
export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));

  if (!env.CATALOG_TOKEN || body.token !== env.CATALOG_TOKEN) {
    return json({ error: "Este link no es válido." }, 404);
  }

  const nombre = (body.nombre || "").toString().trim().slice(0, 120);
  const telefono = (body.telefono || "").toString().trim().slice(0, 40);
  const email = (body.email || "").toString().trim().slice(0, 120);
  const descripcion = (body.descripcion || "").toString().trim().slice(0, 3000);
  const productoSku = (body.producto_sku || "").toString().trim().slice(0, 80) || null;
  const productoNombre = (body.producto_nombre || "").toString().trim().slice(0, 200) || null;

  if (!nombre) return json({ error: "Falta tu nombre." }, 400);
  if (!telefono && !email) return json({ error: "Déjanos un teléfono o un correo para contactarte." }, 400);
  if (!descripcion) return json({ error: "Cuéntanos brevemente qué necesitas." }, 400);

  const db = env.DB;
  const ahora = nowIso();
  const result = await db
    .prepare(
      `INSERT INTO cotizaciones (producto_sku, producto_nombre, nombre, telefono, email, descripcion, estado, creado_en)
       VALUES (?,?,?,?,?,?,?,?)`
    )
    .bind(productoSku, productoNombre, nombre, telefono || null, email || null, descripcion, "nueva", ahora)
    .run();

  await avisoNuevaCotizacion(env, {
    id: result.meta.last_row_id,
    producto_nombre: productoNombre,
    nombre,
    telefono,
    email,
    descripcion,
  });

  return json({ ok: true });
}

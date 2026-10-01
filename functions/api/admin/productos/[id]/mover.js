import { json } from "../../../../_lib/json.js";
import { sesionValida } from "../../../../_lib/session.js";
import { moverProducto } from "../../../../_lib/productos-db.js";

// PUT body: { direccion: "arriba" | "abajo" } — sube o baja el producto
// una posición dentro de su propia categoría (igual que mover categorías).
export async function onRequestPut({ request, env, params }) {
  if (!(await sesionValida(request, env))) return json({ error: "No autorizado." }, 401);

  const body = await request.json().catch(() => ({}));
  if (body.direccion !== "arriba" && body.direccion !== "abajo") {
    return json({ error: "Falta la dirección (arriba/abajo)." }, 400);
  }

  const resultado = await moverProducto(env.DB, params.id, body.direccion);
  if (resultado.error) return json({ error: resultado.error }, 400);
  return json({ ok: true });
}

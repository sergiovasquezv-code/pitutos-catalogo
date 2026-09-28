import { json } from "../../../_lib/json.js";
import { sesionValida } from "../../../_lib/session.js";
import { renombrarCategoria, moverCategoria, eliminarCategoria } from "../../../_lib/categorias-db.js";

// PUT body: { nombre } para renombrar, o { mover: "arriba" | "abajo" } para reordenar.
export async function onRequestPut({ request, env, params }) {
  if (!(await sesionValida(request, env))) return json({ error: "No autorizado." }, 401);

  const id = params.id;
  const body = await request.json().catch(() => ({}));

  if (body.mover === "arriba" || body.mover === "abajo") {
    const resultado = await moverCategoria(env.DB, id, body.mover);
    if (resultado.error) return json({ error: resultado.error }, 400);
    return json({ ok: true });
  }

  const nombre = (body.nombre || "").trim();
  if (!nombre) return json({ error: "Falta el nuevo nombre." }, 400);

  const resultado = await renombrarCategoria(env.DB, id, nombre);
  if (resultado.error) return json({ error: resultado.error }, 400);
  return json({ ok: true });
}

export async function onRequestDelete({ request, env, params }) {
  if (!(await sesionValida(request, env))) return json({ error: "No autorizado." }, 401);

  const resultado = await eliminarCategoria(env.DB, params.id);
  if (resultado.error) return json({ error: resultado.error }, 400);
  return json({ ok: true });
}

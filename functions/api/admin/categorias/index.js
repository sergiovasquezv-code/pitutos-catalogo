import { json } from "../../../_lib/json.js";
import { sesionValida } from "../../../_lib/session.js";
import { listarCategorias, crearCategoria } from "../../../_lib/categorias-db.js";

export async function onRequestGet({ request, env }) {
  if (!(await sesionValida(request, env))) return json({ error: "No autorizado." }, 401);
  const categorias = await listarCategorias(env.DB);
  return json({ categorias });
}

export async function onRequestPost({ request, env }) {
  if (!(await sesionValida(request, env))) return json({ error: "No autorizado." }, 401);

  const body = await request.json().catch(() => ({}));
  const nombre = (body.nombre || "").trim();
  if (!nombre) return json({ error: "Falta el nombre de la categoría." }, 400);

  const resultado = await crearCategoria(env.DB, nombre);
  if (resultado.error) return json({ error: resultado.error }, 400);
  return json({ ok: true, id: resultado.id });
}

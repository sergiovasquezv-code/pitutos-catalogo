import { json } from "../../../_lib/json.js";
import { nowIso } from "../../../_lib/dates.js";
import { sesionValida } from "../../../_lib/session.js";

const ESTADOS_PERMITIDOS = new Set(["nueva", "contactado", "cerrada"]);

// Desde el panel, Sergio marca una cotización como "contactado" (ya habló
// con el cliente) o "cerrada" (se concretó o ya no sigue).
export async function onRequestPut({ request, env, params }) {
  if (!(await sesionValida(request, env))) return json({ error: "No autorizado." }, 401);

  const db = env.DB;
  const id = params.id;
  const cotizacion = await db.prepare("SELECT * FROM cotizaciones WHERE id = ?").bind(id).first();
  if (!cotizacion) return json({ error: "Cotización no encontrada." }, 404);

  const body = await request.json().catch(() => ({}));
  const estado = body.estado;
  if (!ESTADOS_PERMITIDOS.has(estado)) return json({ error: "Estado no válido." }, 400);

  await db.prepare("UPDATE cotizaciones SET estado = ?, actualizado_en = ? WHERE id = ?").bind(estado, nowIso(), id).run();

  return json({ ok: true });
}

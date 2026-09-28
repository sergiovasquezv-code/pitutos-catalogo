import { json } from "../../../_lib/json.js";
import { sesionValida } from "../../../_lib/session.js";

// Lista de solicitudes de cotización para el panel — las más recientes
// primero, con un contador de las que todavía están "nuevas" (sin revisar).
export async function onRequestGet({ request, env }) {
  if (!(await sesionValida(request, env))) return json({ error: "No autorizado." }, 401);

  const db = env.DB;
  const { results } = await db.prepare("SELECT * FROM cotizaciones ORDER BY creado_en DESC, id DESC LIMIT 200").all();
  const cotizaciones = results || [];

  const stats = await db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN estado = 'nueva' THEN 1 ELSE 0 END), 0) AS nuevas,
         COUNT(*) AS total
       FROM cotizaciones`
    )
    .first();

  return json({ cotizaciones, stats });
}

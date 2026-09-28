import { json } from "../../../_lib/json.js";
import { sesionValida } from "../../../_lib/session.js";

const ESTADOS_PENDIENTES = ["pendiente_transferencia", "comprobante_subido", "pendiente_mercadopago"];

// Lista de pedidos para el panel — los más recientes primero, con
// estadísticas rápidas para las tarjetas del dashboard.
export async function onRequestGet({ request, env }) {
  if (!(await sesionValida(request, env))) return json({ error: "No autorizado." }, 401);

  const db = env.DB;
  const { results } = await db.prepare("SELECT * FROM pedidos ORDER BY creado_en DESC, id DESC LIMIT 200").all();
  const pedidos = (results || []).map((p) => ({
    ...p,
    items: JSON.parse(p.items),
  }));

  const stats = await db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN estado = 'pagado' THEN total ELSE 0 END), 0) AS total_vendido,
         COALESCE(SUM(CASE WHEN estado = 'pagado' THEN 1 ELSE 0 END), 0) AS pedidos_pagados,
         COALESCE(SUM(CASE WHEN estado IN (${ESTADOS_PENDIENTES.map(() => "?").join(",")}) THEN 1 ELSE 0 END), 0) AS pedidos_pendientes
       FROM pedidos`
    )
    .bind(...ESTADOS_PENDIENTES)
    .first();

  return json({ pedidos, stats });
}

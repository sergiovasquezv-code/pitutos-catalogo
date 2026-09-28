import { json } from "../../_lib/json.js";
import { sesionValida } from "../../_lib/session.js";

// Rankings de "qué se vende más" y "quiénes compran más" — solo cuenta
// pedidos ya marcados como pagados (transferencia confirmada o Mercado
// Pago aprobado), para no mezclar ventas reales con pedidos pendientes
// que todavía podrían no concretarse.
export async function onRequestGet({ request, env }) {
  if (!(await sesionValida(request, env))) return json({ error: "No autorizado." }, 401);

  const db = env.DB;

  // Los items de cada pedido van guardados como JSON de texto
  // ([{sku,nombre,precio,cantidad}]), así que usamos json_each de SQLite
  // para "desarmarlos" fila por fila y sumarlos por producto.
  const topProductos = await db
    .prepare(
      `SELECT
         json_extract(item.value, '$.sku') AS sku,
         json_extract(item.value, '$.nombre') AS nombre,
         SUM(json_extract(item.value, '$.cantidad')) AS unidades,
         SUM(json_extract(item.value, '$.cantidad') * json_extract(item.value, '$.precio')) AS ingresos
       FROM pedidos, json_each(pedidos.items) AS item
       WHERE pedidos.estado = 'pagado'
       GROUP BY sku
       ORDER BY unidades DESC
       LIMIT 10`
    )
    .all();

  const topClientes = await db
    .prepare(
      `SELECT
         COALESCE(NULLIF(telefono, ''), NULLIF(email, ''), nombre) AS clave,
         MAX(nombre) AS nombre,
         MAX(NULLIF(telefono, '')) AS telefono,
         MAX(NULLIF(email, '')) AS email,
         COUNT(*) AS pedidos,
         SUM(total) AS total_gastado
       FROM pedidos
       WHERE estado = 'pagado'
       GROUP BY clave
       ORDER BY total_gastado DESC
       LIMIT 10`
    )
    .all();

  return json({
    top_productos: topProductos.results || [],
    top_clientes: topClientes.results || [],
  });
}

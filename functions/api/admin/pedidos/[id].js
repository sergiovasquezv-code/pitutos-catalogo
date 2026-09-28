import { json } from "../../../_lib/json.js";
import { nowIso } from "../../../_lib/dates.js";
import { sesionValida } from "../../../_lib/session.js";
import { descontarStockSiCorresponde } from "../../../_lib/stock.js";

const ESTADOS_PERMITIDOS = new Set(["pagado", "rechazado", "pendiente_transferencia", "comprobante_subido"]);

// Desde el panel, Sergio confirma manualmente un pedido por transferencia
// (cuando ve la plata en su cuenta) o lo rechaza. Al marcarlo "pagado" se
// descuenta el stock automáticamente (los de Mercado Pago se marcan solos
// vía webhook, ver functions/api/mp/webhook.js).
export async function onRequestPut({ request, env, params }) {
  if (!(await sesionValida(request, env))) return json({ error: "No autorizado." }, 401);

  const db = env.DB;
  const id = params.id;
  const pedido = await db.prepare("SELECT * FROM pedidos WHERE id = ?").bind(id).first();
  if (!pedido) return json({ error: "Pedido no encontrado." }, 404);

  const body = await request.json().catch(() => ({}));
  const estado = body.estado;
  if (!ESTADOS_PERMITIDOS.has(estado)) return json({ error: "Estado no válido." }, 400);

  await db.prepare("UPDATE pedidos SET estado = ?, actualizado_en = ? WHERE id = ?").bind(estado, nowIso(), id).run();

  if (estado === "pagado") {
    await descontarStockSiCorresponde(db, id);
  }

  return json({ ok: true });
}

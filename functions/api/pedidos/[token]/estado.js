import { json } from "../../../_lib/json.js";

// El comprador vuelve a esta página (gracias.html?ped=<token>) después de
// transferir o de pagar con Mercado Pago. Este endpoint le devuelve el
// estado actual de su pedido para mostrarle un mensaje claro, sin necesitar
// cuenta ni login — solo con el token que le dimos al terminar el checkout.
export async function onRequestGet({ env, params }) {
  const db = env.DB;
  const token = params.token;
  const pedido = await db.prepare("SELECT * FROM pedidos WHERE public_token = ?").bind(token).first();
  if (!pedido) return json({ error: "Pedido no encontrado." }, 404);

  return json({
    nombre: pedido.nombre,
    items: JSON.parse(pedido.items),
    total: pedido.total,
    metodo_pago: pedido.metodo_pago,
    estado: pedido.estado,
    mp_status: pedido.mp_status || null,
    comprobante_subido: !!pedido.comprobante_key,
    creado_en: pedido.creado_en,
  });
}

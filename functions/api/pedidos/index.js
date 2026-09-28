import { json } from "../../_lib/json.js";
import { nowIso } from "../../_lib/dates.js";
import { randomToken } from "../../_lib/tokens.js";
import { buscarProductoPublico } from "../../_lib/productos-db.js";
import { avisoNuevoPedido } from "../../_lib/email.js";

// Crea un pedido nuevo desde el checkout del catálogo. El precio y el
// stock de cada ítem se recalculan siempre desde la base de datos —
// nunca se confía en lo que venga del navegador, para que nadie pueda
// manipular el total ni pasar por encima del stock editando la página.
export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  const body = await request.json().catch(() => ({}));

  if (!env.CATALOG_TOKEN || body.token !== env.CATALOG_TOKEN) {
    return json({ error: "Este link no es válido." }, 404);
  }

  const nombre = (body.nombre || "").trim();
  const telefono = (body.telefono || "").trim();
  const email = (body.email || "").trim();
  const direccion = (body.direccion || "").trim();
  // El catálogo público solo ofrece Mercado Pago (se sacó transferencia +
  // subir comprobante) — se fuerza acá también por si llega otra cosa.
  const metodoPago = "mercadopago";
  const carritoRecibido = Array.isArray(body.items) ? body.items : [];

  if (!nombre) return json({ error: "Falta tu nombre." }, 400);
  if (!telefono) return json({ error: "Falta tu teléfono." }, 400);
  if (!email) return json({ error: "Falta tu correo." }, 400);
  if (!direccion) return json({ error: "Falta tu dirección." }, 400);
  if (!carritoRecibido.length) return json({ error: "El carrito está vacío." }, 400);

  const db = env.DB;
  const items = [];
  for (const linea of carritoRecibido) {
    const producto = await buscarProductoPublico(db, String(linea.sku || ""));
    const cantidad = Math.max(1, Math.min(50, Number(linea.cantidad) || 1));
    if (!producto) return json({ error: `Producto no disponible: ${linea.sku}` }, 400);
    if (producto.tipo !== "servicio" && cantidad > producto.stock) {
      return json({ error: `Solo quedan ${producto.stock} unidades de "${producto.nombre}".` }, 400);
    }
    items.push({ sku: producto.sku, nombre: producto.nombre, precio: producto.precio, cantidad });
  }
  const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const publicToken = randomToken();
  const ahora = nowIso();
  const estadoInicial = "pendiente_mercadopago";

  const result = await db
    .prepare(
      `INSERT INTO pedidos (nombre, telefono, email, direccion, items, total, metodo_pago, estado, public_token, creado_en)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    )
    .bind(nombre, telefono, email, direccion, JSON.stringify(items), total, metodoPago, estadoInicial, publicToken, ahora)
    .run();
  const pedidoId = result.meta.last_row_id;

  const pedido = { id: pedidoId, nombre, telefono, email, direccion, items, total, metodo_pago: metodoPago };

  // Mercado Pago (Checkout Pro): se crea una "preferencia" con el detalle
  // del pedido y se le devuelve al comprador el link de pago (init_point).
  // Mercado Pago avisa después el resultado por webhook (ver
  // functions/api/mp/webhook.js), que es lo que realmente confirma el pago
  // — el navegador puede cerrarse antes de eso y el pedido igual queda
  // registrado.
  if (!env.MP_ACCESS_TOKEN) {
    return json({ error: "El pago con Mercado Pago no está configurado todavía. Avísale a Mis Pitutos Informáticos." }, 500);
  }

  const origin = `${url.protocol}//${url.host}`;
  const preferenciaBody = {
    items: items.map((i) => ({
      title: i.nombre,
      quantity: i.cantidad,
      unit_price: i.precio,
      currency_id: "CLP",
    })),
    payer: { name: nombre, email: email || undefined },
    external_reference: publicToken,
    back_urls: {
      success: `${origin}/gracias.html?ped=${publicToken}`,
      pending: `${origin}/gracias.html?ped=${publicToken}`,
      failure: `${origin}/gracias.html?ped=${publicToken}`,
    },
    auto_return: "approved",
    notification_url: `${origin}/api/mp/webhook`,
  };

  let preferencia;
  try {
    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preferenciaBody),
    });
    preferencia = await res.json();
    if (!res.ok || !preferencia.init_point) {
      throw new Error(preferencia.message || "Mercado Pago rechazó la solicitud.");
    }
  } catch (err) {
    return json({ error: "No se pudo generar el link de pago de Mercado Pago. Intenta de nuevo en unos minutos." }, 502);
  }

  await db
    .prepare("UPDATE pedidos SET mp_preference_id = ?, actualizado_en = ? WHERE id = ?")
    .bind(preferencia.id, nowIso(), pedidoId)
    .run();

  await avisoNuevoPedido(env, pedido);

  return json({
    ok: true,
    pedido_id: pedidoId,
    public_token: publicToken,
    metodo_pago: "mercadopago",
    init_point: preferencia.init_point,
  });
}

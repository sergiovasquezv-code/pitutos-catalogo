import { json } from "../../_lib/json.js";
import { nowIso } from "../../_lib/dates.js";
import { avisoPagoMercadoPago } from "../../_lib/email.js";
import { descontarStockSiCorresponde } from "../../_lib/stock.js";

// Mercado Pago llama a esta URL solo (nunca el navegador del comprador),
// avisando que un pago cambió de estado. Es la fuente de verdad real de si
// se pagó o no — el "back_url" al que vuelve el comprador es solo para que
// vea un mensaje, no confirma nada por sí solo.
async function extraerPaymentId(request) {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("data.id") || url.searchParams.get("id");
  if (fromQuery) return fromQuery;
  try {
    const body = await request.clone().json();
    return body?.data?.id || null;
  } catch {
    return null;
  }
}

export async function onRequestPost({ request, env }) {
  const paymentId = await extraerPaymentId(request);
  // Siempre respondemos 200 aunque no podamos procesar algo, porque
  // Mercado Pago reintenta agresivamente notificaciones que no confirmamos
  // — no queremos que nos bombardee de reintentos por un evento que no nos
  // interesa (ej: notificaciones de tipo distinto a "payment").
  if (!paymentId || !env.MP_ACCESS_TOKEN) return json({ ok: true });

  let pago;
  try {
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${env.MP_ACCESS_TOKEN}` },
    });
    if (!res.ok) return json({ ok: true });
    pago = await res.json();
  } catch {
    return json({ ok: true });
  }

  const publicToken = pago.external_reference;
  if (!publicToken) return json({ ok: true });

  const db = env.DB;
  const pedido = await db.prepare("SELECT * FROM pedidos WHERE public_token = ?").bind(publicToken).first();
  if (!pedido) return json({ ok: true });

  // Si el estado no cambió (Mercado Pago puede reenviar el mismo aviso
  // varias veces), no volvemos a mandar el correo ni a tocar la fecha.
  if (pedido.mp_status === pago.status) return json({ ok: true });

  const nuevoEstado = pago.status === "approved" ? "pagado" : pago.status === "rejected" ? "rechazado" : pedido.estado;

  await db
    .prepare("UPDATE pedidos SET estado = ?, mp_payment_id = ?, mp_status = ?, actualizado_en = ? WHERE id = ?")
    .bind(nuevoEstado, String(pago.id), pago.status, nowIso(), pedido.id)
    .run();

  if (nuevoEstado === "pagado") {
    await descontarStockSiCorresponde(db, pedido.id);
  }

  await avisoPagoMercadoPago(env, {
    id: pedido.id,
    nombre: pedido.nombre,
    total: pedido.total,
    items: JSON.parse(pedido.items),
    mp_status: pago.status,
  });

  return json({ ok: true });
}

// Mercado Pago a veces prueba la URL con GET al configurarla — respondemos
// 200 para que la validación no falle, sin hacer nada más.
export async function onRequestGet() {
  return json({ ok: true });
}

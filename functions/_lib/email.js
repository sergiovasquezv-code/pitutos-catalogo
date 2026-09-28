// Avisos por correo de cada movimiento del catálogo, usando la API de
// Resend (resend.com). Si no está configurado (falta RESEND_API_KEY o
// EMAIL_NOTIFICACIONES en los secrets/variables del proyecto), no hace
// nada — el pedido sigue quedando guardado igual, el correo es un aviso
// encima de eso, nunca bloquea el flujo del comprador.
async function enviarCorreo(env, { asunto, cuerpo, replyTo }) {
  if (!env.RESEND_API_KEY || !env.EMAIL_NOTIFICACIONES) return;
  try {
    const payload = {
      // Mientras no verifiques tu propio dominio en Resend, el correo se
      // manda igual pero desde su dominio de pruebas (onboarding@resend.dev);
      // el nombre que ve el destinatario sí queda como el negocio.
      from: env.EMAIL_REMITENTE || "Mis Pitutos Informáticos <onboarding@resend.dev>",
      to: [env.EMAIL_NOTIFICACIONES],
      subject: asunto,
      text: cuerpo,
    };
    if (replyTo) payload.reply_to = replyTo;
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Sin internet, API caída, clave mala, etc. — no interrumpe el flujo.
  }
}

function resumenItems(items) {
  return items.map((i) => `  - ${i.cantidad} x ${i.nombre} — $${(i.precio * i.cantidad).toLocaleString("es-CL")}`).join("\n");
}

export async function avisoNuevoPedido(env, pedido) {
  const metodoLabel = pedido.metodo_pago === "mercadopago" ? "Mercado Pago" : "Transferencia";
  const asunto = `Nuevo pedido #${pedido.id} (${metodoLabel}) — $${pedido.total.toLocaleString("es-CL")}`;
  const cuerpo = [
    `Llegó un pedido nuevo por el catálogo.`,
    ``,
    `Cliente: ${pedido.nombre}${pedido.telefono ? ` (${pedido.telefono})` : ""}${pedido.email ? ` — ${pedido.email}` : ""}`,
    pedido.direccion ? `Dirección: ${pedido.direccion}` : "",
    `Método de pago: ${metodoLabel}`,
    `Total: $${pedido.total.toLocaleString("es-CL")}`,
    ``,
    `Productos:`,
    resumenItems(pedido.items),
    ``,
    pedido.metodo_pago === "transferencia"
      ? `Está pendiente de que el cliente suba el comprobante (o de que confirmes tú directamente en tu cuenta bancaria).`
      : `Está pendiente de confirmación de pago desde Mercado Pago — te va a llegar otro correo apenas se confirme.`,
  ].join("\n");
  await enviarCorreo(env, { asunto, cuerpo, replyTo: pedido.email || undefined });
}

export async function avisoComprobanteSubido(env, pedido) {
  const asunto = `Comprobante subido para el pedido #${pedido.id}`;
  const cuerpo = [
    `${pedido.nombre} subió un comprobante de transferencia para su pedido #${pedido.id} (total $${pedido.total.toLocaleString("es-CL")}).`,
    pedido.comprobante_nota ? `Nota del cliente: ${pedido.comprobante_nota}` : "",
    pedido.comprobante_url ? `Ver comprobante: ${pedido.comprobante_url}` : "",
    ``,
    `Revísalo y confirma manualmente cuando el dinero aparezca en tu cuenta.`,
  ]
    .filter(Boolean)
    .join("\n");
  await enviarCorreo(env, { asunto, cuerpo, replyTo: pedido.email || undefined });
}

export async function avisoContacto(env, { nombre, contacto, mensaje }) {
  const asunto = `Nuevo mensaje de contacto del catálogo — ${nombre}`;
  const cuerpo = [`${nombre} escribió desde el catálogo.`, `Contacto: ${contacto}`, ``, `Mensaje:`, mensaje].join("\n");
  // Si dejó un correo (y no solo un teléfono), puedes responderle tocando
  // "Responder" en tu correo normal, directo a él.
  const replyTo = contacto.includes("@") ? contacto : undefined;
  await enviarCorreo(env, { asunto, cuerpo, replyTo });
}

export async function avisoNuevaCotizacion(env, cotizacion) {
  const asunto = `Solicitud de cotización${cotizacion.producto_nombre ? ` — ${cotizacion.producto_nombre}` : ""}`;
  const cuerpo = [
    `${cotizacion.nombre} pidió una cotización desde el catálogo.`,
    cotizacion.producto_nombre ? `Servicio de interés: ${cotizacion.producto_nombre}` : "",
    `Contacto: ${[cotizacion.telefono, cotizacion.email].filter(Boolean).join(" · ") || "(no dejó datos de contacto)"}`,
    ``,
    `Descripción del proyecto:`,
    cotizacion.descripcion,
  ]
    .filter(Boolean)
    .join("\n");
  const replyTo = cotizacion.email || undefined;
  await enviarCorreo(env, { asunto, cuerpo, replyTo });
}

export async function avisoPagoMercadoPago(env, pedido) {
  const estadoLabel =
    pedido.mp_status === "approved"
      ? "¡Pago APROBADO!"
      : pedido.mp_status === "rejected"
      ? "Pago RECHAZADO"
      : `Pago en estado "${pedido.mp_status}"`;
  const asunto = `${estadoLabel} — Pedido #${pedido.id} vía Mercado Pago`;
  const cuerpo = [
    `El pedido #${pedido.id} de ${pedido.nombre} cambió de estado en Mercado Pago.`,
    `Estado: ${pedido.mp_status}`,
    `Total: $${pedido.total.toLocaleString("es-CL")}`,
    ``,
    `Productos:`,
    resumenItems(pedido.items),
  ].join("\n");
  await enviarCorreo(env, { asunto, cuerpo });
}

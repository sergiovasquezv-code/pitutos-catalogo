const params = new URLSearchParams(window.location.search);
const PED = params.get("ped") || "";

function money(n) {
  return "$" + Number(n || 0).toLocaleString("es-CL");
}

const ESTADOS = {
  pendiente_transferencia: { texto: "Pendiente de transferencia", clase: "estado-warn" },
  comprobante_subido: { texto: "Comprobante recibido, revisando", clase: "estado-warn" },
  pendiente_mercadopago: { texto: "Esperando confirmación de Mercado Pago", clase: "estado-warn" },
  pagado: { texto: "Pagado", clase: "estado-ok" },
  rechazado: { texto: "Pago rechazado", clase: "estado-danger" },
};

async function cargar() {
  const app = document.getElementById("app");
  if (!PED) {
    app.innerHTML = `<div class="error-page">No encontramos tu pedido. Revisa el link que usaste.</div>`;
    return;
  }

  let res, data;
  try {
    res = await fetch(`/api/pedidos/${encodeURIComponent(PED)}/estado`);
    data = await res.json();
  } catch {
    app.innerHTML = `<div class="error-page">No se pudo consultar tu pedido. Revisa tu conexión e intenta de nuevo.</div>`;
    return;
  }

  if (!res.ok) {
    app.innerHTML = `<div class="error-page">${data.error || "No encontramos tu pedido."}</div>`;
    return;
  }

  render(data);
}

function render(p) {
  const app = document.getElementById("app");
  const info = ESTADOS[p.estado] || { texto: p.estado, clase: "estado-warn" };

  const itemsHtml = p.items
    .map((i) => `<li><span>${i.cantidad} x ${i.nombre}</span><span>${money(i.precio * i.cantidad)}</span></li>`)
    .join("");

  let mensajeExtra = "";
  if (p.metodo_pago === "transferencia" && p.estado === "pendiente_transferencia" && !p.comprobante_subido) {
    mensajeExtra = `<p class="hint-small">Aún no recibimos tu comprobante. Si ya transferiste, puedes escribirnos directamente para confirmarlo.</p>`;
  } else if (p.metodo_pago === "transferencia" && p.estado === "comprobante_subido") {
    mensajeExtra = `<p class="hint-small">Recibimos tu comprobante, lo estamos revisando. Te avisaremos apenas quede confirmado.</p>`;
  } else if (p.metodo_pago === "mercadopago" && p.estado === "pendiente_mercadopago") {
    mensajeExtra = `<p class="hint-small">Estamos esperando la confirmación de Mercado Pago. Esto puede tardar unos minutos — no hace falta que hagas nada más.</p>`;
  } else if (p.estado === "pagado") {
    mensajeExtra = `<p class="hint-small">¡Gracias por tu compra! Nos pondremos en contacto para coordinar la entrega.</p>`;
  } else if (p.estado === "rechazado") {
    mensajeExtra = `<p class="hint-small">Tu pago fue rechazado por Mercado Pago. Puedes intentar de nuevo o escribirnos para coordinar otra forma de pago.</p>`;
  }

  app.innerHTML = `
    <div class="estado-card">
      <span class="estado-badge ${info.clase}">${info.texto}</span>
      <h2 style="margin:6px 0 2px;">Hola, ${p.nombre}</h2>
      <p class="hint-small">Pedido creado el ${new Date(p.creado_en).toLocaleString("es-CL")}</p>
      <ul class="estado-lista">
        ${itemsHtml}
        <li><strong>Total</strong><strong>${money(p.total)}</strong></li>
      </ul>
      ${mensajeExtra}
    </div>
  `;
}

cargar();

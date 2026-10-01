// Panel de administración del catálogo — login simple + CRUD de
// productos + revisión de pedidos. Todo protegido por la cookie de sesión
// que entrega /api/admin/login (ver functions/_lib/session.js).

function money(n) {
  return "$" + Number(n || 0).toLocaleString("es-CL");
}

async function api(path, options = {}) {
  const res = await fetch(path, { credentials: "same-origin", ...options });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) throw new Error(data.error || "Ocurrió un error.");
  return data;
}

// ---------- Login / sesión ----------

async function init() {
  let estado;
  try {
    estado = await api("/api/admin/whoami");
  } catch {
    estado = { logueado: false };
  }

  if (estado.logueado) {
    mostrarPanel();
  } else {
    document.getElementById("login-view").hidden = false;
  }
}

function mostrarPanel() {
  document.getElementById("login-view").hidden = true;
  document.getElementById("panel-view").hidden = false;
  cargarCategorias().then(cargarProductos);
  actualizarBadgeCotizaciones();
}

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById("login-error");
  errorEl.hidden = true;
  const usuario = document.getElementById("l-usuario").value.trim();
  const clave = document.getElementById("l-clave").value;

  try {
    await api("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario, clave }),
    });
    mostrarPanel();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
});

document.getElementById("btn-logout").addEventListener("click", async () => {
  await api("/api/admin/logout", { method: "POST" }).catch(() => {});
  window.location.reload();
});

// ---------- Tabs ----------

const TABS = ["productos", "categorias", "pedidos", "cotizaciones", "estadisticas", "ajustes"];

document.querySelectorAll(".admin-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".admin-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    const destino = tab.dataset.tab;
    TABS.forEach((t) => {
      document.getElementById(`tab-${t}`).hidden = t !== destino;
    });
    if (destino === "pedidos") cargarPedidos();
    if (destino === "categorias") renderCategoriasTab();
    if (destino === "cotizaciones") cargarCotizaciones();
    if (destino === "estadisticas") cargarEstadisticas();
    if (destino === "ajustes") cargarAjustes();
  });
});

// ---------- Categorías ----------

let categoriasCache = [];

async function cargarCategorias() {
  try {
    const data = await api("/api/admin/categorias");
    categoriasCache = data.categorias || [];
  } catch {
    categoriasCache = [];
  }
  actualizarFiltroCategorias();
  actualizarSelectCategoriaModal();
}

function actualizarFiltroCategorias() {
  const select = document.getElementById("filtro-categoria");
  const actual = select.value;
  select.innerHTML =
    `<option value="">Todas las categorías</option>` +
    categoriasCache.map((c) => `<option value="${c.id}">${c.nombre}</option>`).join("");
  select.value = categoriasCache.some((c) => String(c.id) === actual) ? actual : "";
}

function actualizarSelectCategoriaModal() {
  const select = document.getElementById("p-categoria-id");
  select.innerHTML = categoriasCache.map((c) => `<option value="${c.id}">${c.nombre}</option>`).join("");
}

document.getElementById("filtro-categoria").addEventListener("change", (e) => {
  filtroCategoriaActual = e.target.value;
  renderProductos();
});

async function renderCategoriasTab() {
  const tbody = document.getElementById("categorias-tbody");
  tbody.innerHTML = `<tr><td colspan="4">Cargando…</td></tr>`;
  await cargarCategorias();

  if (!categoriasCache.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="hint-small">Todavía no hay categorías.</td></tr>`;
    return;
  }

  tbody.innerHTML = categoriasCache
    .map((c, idx) => {
      const cantidad = productosCache.filter((p) => p.categoria_id === c.id).length;
      const esFija = c.nombre === "Sin categoría";
      return `
        <tr>
          <td>
            <div class="row-actions">
              <button type="button" class="btn-mini" data-mover="${c.id}:arriba" ${idx === 0 ? "disabled" : ""}>▲</button>
              <button type="button" class="btn-mini" data-mover="${c.id}:abajo" ${idx === categoriasCache.length - 1 ? "disabled" : ""}>▼</button>
            </div>
          </td>
          <td>${c.nombre}</td>
          <td>${cantidad}</td>
          <td>
            <div class="row-actions">
              <button type="button" class="btn-mini" data-renombrar="${c.id}" ${esFija ? "disabled" : ""}>Renombrar</button>
              <button type="button" class="btn-mini btn-mini-danger" data-borrar-cat="${c.id}" ${esFija ? "disabled" : ""}>Borrar</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  tbody.querySelectorAll("[data-mover]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const [id, direccion] = btn.dataset.mover.split(":");
      moverCategoriaUI(id, direccion);
    });
  });
  tbody.querySelectorAll("[data-renombrar]").forEach((btn) => {
    btn.addEventListener("click", () => renombrarCategoriaUI(Number(btn.dataset.renombrar)));
  });
  tbody.querySelectorAll("[data-borrar-cat]").forEach((btn) => {
    btn.addEventListener("click", () => borrarCategoriaUI(Number(btn.dataset.borrarCat)));
  });
}

async function moverCategoriaUI(id, direccion) {
  try {
    await api(`/api/admin/categorias/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mover: direccion }),
    });
    await renderCategoriasTab();
    await cargarProductos();
  } catch (err) {
    alert(err.message);
  }
}

async function renombrarCategoriaUI(id) {
  const actual = categoriasCache.find((c) => c.id === id);
  const nuevo = prompt("Nuevo nombre de la categoría:", actual ? actual.nombre : "");
  if (!nuevo || !nuevo.trim()) return;
  try {
    await api(`/api/admin/categorias/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nuevo.trim() }),
    });
    await renderCategoriasTab();
    await cargarProductos();
  } catch (err) {
    alert(err.message);
  }
}

async function borrarCategoriaUI(id) {
  const cat = categoriasCache.find((c) => c.id === id);
  const cantidad = productosCache.filter((p) => p.categoria_id === id).length;
  const aviso = cantidad
    ? `¿Borrar "${cat?.nombre}"? Sus ${cantidad} producto(s) pasarán a "Sin categoría".`
    : `¿Borrar "${cat?.nombre}"?`;
  if (!confirm(aviso)) return;
  try {
    await api(`/api/admin/categorias/${id}`, { method: "DELETE" });
    await renderCategoriasTab();
    await cargarProductos();
  } catch (err) {
    alert(err.message);
  }
}

document.getElementById("form-nueva-categoria").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById("categoria-error");
  errorEl.hidden = true;
  const input = document.getElementById("nc-nombre");
  try {
    await api("/api/admin/categorias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: input.value.trim() }),
    });
    input.value = "";
    await renderCategoriasTab();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
});

// ---------- Productos ----------

let productosCache = [];
let filtroCategoriaActual = "";

async function cargarProductos() {
  const tbody = document.getElementById("productos-tbody");
  tbody.innerHTML = `<tr><td colspan="7">Cargando…</td></tr>`;
  try {
    const data = await api("/api/admin/productos");
    productosCache = data.productos || [];
    actualizarKpisProductos(data.stats);
    renderProductos();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="hint-small">${err.message}</td></tr>`;
  }
}

function actualizarKpisProductos(stats) {
  if (!stats) return;
  document.getElementById("kpi-activos").textContent = stats.activos;
  document.getElementById("kpi-unidades").textContent = stats.unidades_stock;
  document.getElementById("kpi-valor").textContent = money(stats.valor_inventario);
  document.getElementById("kpi-agotados").textContent = stats.agotados;
}

function renderProductos() {
  const tbody = document.getElementById("productos-tbody");
  const lista = filtroCategoriaActual
    ? productosCache.filter((p) => String(p.categoria_id) === filtroCategoriaActual)
    : productosCache;

  if (!productosCache.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="hint-small">Todavía no hay productos. Crea el primero con "+ Nuevo producto".</td></tr>`;
    return;
  }
  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="hint-small">No hay productos en esa categoría.</td></tr>`;
    return;
  }

  tbody.innerHTML = lista
    .map((p) => {
      const esServicio = p.tipo === "servicio";

      // Aviso visual de poco stock — solo para productos visibles, con
      // stock bajo pero no agotados (agotado ya tiene su propio badge).
      let alerta = null;
      if (!esServicio && p.disponible && p.stock > 0) {
        if (p.stock === 1) alerta = { texto: "¡Última unidad!", clase: "stock-alert-critica" };
        else if (p.stock <= 3) alerta = { texto: "¡Pocas unidades!", clase: "stock-alert-baja" };
      }

      const fotoInner = p.foto_key
        ? `<img class="admin-thumb" src="/api/fotos/${p.foto_key}" alt="${p.nombre}" />`
        : `<div class="admin-thumb-empty"></div>`;
      const foto = `
        <div class="admin-thumb-wrap">
          ${fotoInner}
          ${alerta ? `<span class="stock-alert-badge ${alerta.clase}">${alerta.texto}</span>` : ""}
        </div>
      `;

      let badge;
      if (!p.disponible) badge = `<span class="badge-pill badge-muted">Pausado</span>`;
      else if (!esServicio && p.stock <= 0) badge = `<span class="badge-pill badge-danger">Agotado</span>`;
      else badge = `<span class="badge-pill badge-ok">Visible</span>`;

      const filaClase = alerta ? ` class="${alerta.clase === "stock-alert-critica" ? "fila-stock-critica" : "fila-stock-baja"}"` : "";

      // Las flechas mueven el producto dentro de SU categoría — la
      // posición se calcula sobre todos los productos de esa categoría
      // (no sobre la lista filtrada), para que siempre sea consistente
      // aunque el filtro de categoría esté activo.
      const hermanos = productosCache
        .filter((x) => x.categoria_id === p.categoria_id)
        .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.nombre.localeCompare(b.nombre));
      const idxHermano = hermanos.findIndex((x) => x.id === p.id);
      const esPrimero = idxHermano <= 0;
      const esUltimo = idxHermano === -1 || idxHermano === hermanos.length - 1;

      return `
        <tr${filaClase}>
          <td>${foto}</td>
          <td>${p.nombre}</td>
          <td>${esServicio ? `<span class="badge-pill badge-servicio">Servicio</span>` : `<span class="hint-small">Producto</span>`}</td>
          <td><span class="categoria-tag">${p.categoria_nombre || "Sin categoría"}</span></td>
          <td>${money(p.precio)}</td>
          <td>${esServicio ? "—" : `${p.stock}${alerta ? `<br><span class="hint-small stock-alert-texto ${alerta.clase}">${alerta.texto}</span>` : ""}`}</td>
          <td>${badge}</td>
          <td>
            <div class="row-actions">
              <button type="button" class="btn-mini" data-mover-producto="${p.id}:arriba" title="Subir dentro de su categoría" ${esPrimero ? "disabled" : ""}>▲</button>
              <button type="button" class="btn-mini" data-mover-producto="${p.id}:abajo" title="Bajar dentro de su categoría" ${esUltimo ? "disabled" : ""}>▼</button>
              <button type="button" class="btn-mini" data-editar="${p.id}">Editar</button>
              <button type="button" class="btn-mini btn-mini-danger" data-borrar="${p.id}">Borrar</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  tbody.querySelectorAll("[data-editar]").forEach((btn) => {
    btn.addEventListener("click", () => abrirModalProducto(Number(btn.dataset.editar)));
  });
  tbody.querySelectorAll("[data-borrar]").forEach((btn) => {
    btn.addEventListener("click", () => borrarProducto(Number(btn.dataset.borrar)));
  });
  tbody.querySelectorAll("[data-mover-producto]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const [id, direccion] = btn.dataset.moverProducto.split(":");
      moverProductoUI(id, direccion);
    });
  });
}

async function moverProductoUI(id, direccion) {
  try {
    await api(`/api/admin/productos/${id}/mover`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direccion }),
    });
    await cargarProductos();
  } catch (err) {
    alert(err.message);
  }
}

function abrirModalProducto(id) {
  if (!categoriasCache.length) {
    alert('Primero crea al menos una categoría, en la pestaña "Categorías".');
    return;
  }

  const modal = document.getElementById("modal-producto");
  const form = document.getElementById("form-producto");
  form.reset();
  actualizarSelectCategoriaModal();
  document.getElementById("producto-error").hidden = true;

  if (id) {
    const p = productosCache.find((x) => x.id === id);
    document.getElementById("modal-producto-titulo").textContent = "Editar producto";
    document.getElementById("p-id").value = p.id;
    document.getElementById("p-nombre").value = p.nombre;
    document.getElementById("p-categoria-id").value = p.categoria_id;
    document.getElementById("p-tipo").value = p.tipo === "servicio" ? "servicio" : "producto";
    document.getElementById("p-precio").value = p.precio;
    document.getElementById("p-descripcion").value = p.descripcion || "";
    document.getElementById("p-stock").value = p.stock;
    document.getElementById("p-disponible").checked = !!p.disponible;
  } else {
    document.getElementById("modal-producto-titulo").textContent = "Nuevo producto";
    document.getElementById("p-id").value = "";
    if (filtroCategoriaActual) document.getElementById("p-categoria-id").value = filtroCategoriaActual;
    document.getElementById("p-tipo").value = "producto";
    document.getElementById("p-disponible").checked = true;
  }

  actualizarVisibilidadStock();
  modal.hidden = false;
}

// Un servicio no maneja stock, así que ese campo se oculta y deja de ser
// obligatorio cuando se elige "Servicio" en el formulario.
function actualizarVisibilidadStock() {
  const esServicio = document.getElementById("p-tipo").value === "servicio";
  document.getElementById("p-stock-label").hidden = esServicio;
  document.getElementById("p-stock").required = !esServicio;
  document.getElementById("p-tipo-hint").hidden = !esServicio;
}

document.getElementById("p-tipo").addEventListener("change", actualizarVisibilidadStock);

function cerrarModalProducto() {
  document.getElementById("modal-producto").hidden = true;
}

document.getElementById("btn-nuevo-producto").addEventListener("click", () => abrirModalProducto(null));
document.getElementById("btn-cancelar-producto").addEventListener("click", cerrarModalProducto);

document.getElementById("form-producto").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById("producto-error");
  errorEl.hidden = true;

  const id = document.getElementById("p-id").value;
  const fd = new FormData();
  fd.append("nombre", document.getElementById("p-nombre").value.trim());
  fd.append("categoria_id", document.getElementById("p-categoria-id").value);
  fd.append("tipo", document.getElementById("p-tipo").value);
  fd.append("precio", document.getElementById("p-precio").value);
  fd.append("descripcion", document.getElementById("p-descripcion").value.trim());
  fd.append("stock", document.getElementById("p-stock").value || "0");
  fd.append("disponible", document.getElementById("p-disponible").checked ? "true" : "false");
  const fotoInput = document.getElementById("p-foto");
  if (fotoInput.files.length) fd.append("foto", fotoInput.files[0]);

  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true;
  btn.textContent = "Guardando…";

  try {
    if (id) {
      await api(`/api/admin/productos/${id}`, { method: "PUT", body: fd });
    } else {
      await api("/api/admin/productos", { method: "POST", body: fd });
    }
    cerrarModalProducto();
    await cargarProductos();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = "Guardar";
  }
});

async function borrarProducto(id) {
  const p = productosCache.find((x) => x.id === id);
  if (!confirm(`¿Borrar "${p ? p.nombre : "este producto"}"? No se puede deshacer.`)) return;
  try {
    await api(`/api/admin/productos/${id}`, { method: "DELETE" });
    await cargarProductos();
  } catch (err) {
    alert(err.message);
  }
}

// ---------- Pedidos ----------

const ESTADOS_PEDIDO = {
  pendiente_transferencia: { texto: "Pendiente transferencia", clase: "badge-warn" },
  comprobante_subido: { texto: "Comprobante subido", clase: "badge-warn" },
  pendiente_mercadopago: { texto: "Esperando Mercado Pago", clase: "badge-warn" },
  pagado: { texto: "Pagado", clase: "badge-ok" },
  rechazado: { texto: "Rechazado", clase: "badge-danger" },
};

let pedidosCache = [];

async function cargarPedidos() {
  const tbody = document.getElementById("pedidos-tbody");
  tbody.innerHTML = `<tr><td colspan="7">Cargando…</td></tr>`;
  try {
    const data = await api("/api/admin/pedidos");
    pedidosCache = data.pedidos || [];
    renderPedidos(pedidosCache);
    actualizarKpisPedidos(data.stats);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="hint-small">${err.message}</td></tr>`;
  }
}

function actualizarKpisPedidos(stats) {
  if (!stats) return;
  document.getElementById("kpi-vendido").textContent = money(stats.total_vendido);
  document.getElementById("kpi-pagados").textContent = stats.pedidos_pagados;
  document.getElementById("kpi-pendientes").textContent = stats.pedidos_pendientes;
}

function renderPedidos(pedidos) {
  const tbody = document.getElementById("pedidos-tbody");
  if (!pedidos.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="hint-small">Todavía no hay pedidos.</td></tr>`;
    return;
  }

  tbody.innerHTML = pedidos
    .map((p) => {
      const info = ESTADOS_PEDIDO[p.estado] || { texto: p.estado, clase: "badge-muted" };
      const itemsTexto = p.items.map((i) => `${i.cantidad} x ${i.nombre}`).join("<br>");
      const contacto = [p.telefono, p.email].filter(Boolean).join(" · ");
      const direccionTexto = p.direccion ? `<br><span class="hint-small">📍 ${p.direccion}</span>` : "";
      const metodoLabel = p.metodo_pago === "mercadopago" ? "Mercado Pago" : "Transferencia";

      let acciones = "";
      if (p.metodo_pago === "transferencia" && (p.estado === "pendiente_transferencia" || p.estado === "comprobante_subido")) {
        acciones += p.comprobante_key
          ? `<a class="btn-mini" href="/api/comprobantes/${p.comprobante_key}" target="_blank" rel="noopener">Ver comprobante</a>`
          : "";
        acciones += ` <button type="button" class="btn-mini" data-pagar="${p.id}">Marcar pagado</button>`;
        acciones += ` <button type="button" class="btn-mini btn-mini-danger" data-rechazar="${p.id}">Rechazar</button>`;
      } else if (p.metodo_pago === "mercadopago") {
        acciones = `<span class="hint-small">Automático (webhook)</span>`;
      }
      if (p.telefono) {
        acciones += ` <button type="button" class="btn-mini" data-whatsapp="${p.id}">📱 WhatsApp</button>`;
      }

      return `
        <tr>
          <td>${new Date(p.creado_en).toLocaleString("es-CL")}</td>
          <td>${p.nombre}<br><span class="hint-small">${contacto}</span>${direccionTexto}</td>
          <td class="pedido-items-mini">${itemsTexto}</td>
          <td>${money(p.total)}</td>
          <td>${metodoLabel}</td>
          <td><span class="badge-pill ${info.clase}">${info.texto}</span></td>
          <td><div class="row-actions">${acciones}</div></td>
        </tr>
      `;
    })
    .join("");

  tbody.querySelectorAll("[data-pagar]").forEach((btn) => {
    btn.addEventListener("click", () => cambiarEstadoPedido(btn.dataset.pagar, "pagado"));
  });
  tbody.querySelectorAll("[data-rechazar]").forEach((btn) => {
    btn.addEventListener("click", () => cambiarEstadoPedido(btn.dataset.rechazar, "rechazado"));
  });
  tbody.querySelectorAll("[data-whatsapp]").forEach((btn) => {
    btn.addEventListener("click", () => abrirModalWhatsapp(btn.dataset.whatsapp));
  });
}

async function cambiarEstadoPedido(id, estado) {
  const mensaje = estado === "pagado" ? "¿Marcar este pedido como pagado? Se descontará el stock." : "¿Rechazar este pedido?";
  if (!confirm(mensaje)) return;
  try {
    await api(`/api/admin/pedidos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    await cargarPedidos();
    await cargarProductos();
  } catch (err) {
    alert(err.message);
  }
}

document.getElementById("btn-refrescar-pedidos").addEventListener("click", cargarPedidos);

// ---------- Avisar por WhatsApp ----------

let whatsappPedidoActual = null;

const PLANTILLAS_WHATSAPP = {
  preparacion: (p) => `Hola ${p.nombre}, te escribimos de Mis Pitutos Informáticos. Tu pedido #${p.id} ya está en preparación. ¡Gracias por tu compra!`,
  despachado: (p) => `Hola ${p.nombre}, tu pedido #${p.id} de Mis Pitutos Informáticos ya fue despachado y está en camino. Cualquier consulta, escríbenos por aquí mismo.`,
  listo_retiro: (p) => `Hola ${p.nombre}, tu pedido #${p.id} de Mis Pitutos Informáticos ya está listo para retirar. Avísanos cuando puedas pasar a buscarlo.`,
  pago_confirmado: (p) => `Hola ${p.nombre}, confirmamos tu pago del pedido #${p.id} por ${money(p.total)}. ¡Gracias por confiar en Mis Pitutos Informáticos!`,
  personalizado: () => "",
};

function abrirModalWhatsapp(id) {
  const p = pedidosCache.find((x) => String(x.id) === String(id));
  if (!p || !p.telefono) return;
  whatsappPedidoActual = p;

  document.getElementById("wa-titulo").textContent = `Avisar a ${p.nombre} por WhatsApp`;
  document.getElementById("wa-plantilla").value = "preparacion";
  document.getElementById("wa-mensaje").value = PLANTILLAS_WHATSAPP.preparacion(p);
  actualizarLinkWhatsapp();

  document.getElementById("modal-whatsapp").hidden = false;
}

function cerrarModalWhatsapp() {
  document.getElementById("modal-whatsapp").hidden = true;
  whatsappPedidoActual = null;
}

function actualizarLinkWhatsapp() {
  if (!whatsappPedidoActual) return;
  const numero = (whatsappPedidoActual.telefono || "").replace(/\D/g, "");
  const texto = document.getElementById("wa-mensaje").value;
  document.getElementById("btn-abrir-whatsapp").href = `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

document.getElementById("wa-plantilla").addEventListener("change", (e) => {
  if (!whatsappPedidoActual) return;
  const fn = PLANTILLAS_WHATSAPP[e.target.value] || PLANTILLAS_WHATSAPP.personalizado;
  document.getElementById("wa-mensaje").value = fn(whatsappPedidoActual);
  actualizarLinkWhatsapp();
});
document.getElementById("wa-mensaje").addEventListener("input", actualizarLinkWhatsapp);
document.getElementById("btn-cerrar-whatsapp").addEventListener("click", cerrarModalWhatsapp);
document.getElementById("modal-whatsapp").addEventListener("click", (e) => {
  if (e.target.id === "modal-whatsapp") cerrarModalWhatsapp();
});

// ---------- Cotizaciones (solicitudes de servicios) ----------

const ESTADOS_COTIZACION = {
  nueva: { texto: "Nueva", clase: "badge-warn" },
  contactado: { texto: "Contactado", clase: "badge-ok" },
  cerrada: { texto: "Cerrada", clase: "badge-muted" },
};

let cotizacionesCache = [];

async function cargarCotizaciones() {
  const tbody = document.getElementById("cotizaciones-tbody");
  tbody.innerHTML = `<tr><td colspan="6">Cargando…</td></tr>`;
  try {
    const data = await api("/api/admin/cotizaciones");
    cotizacionesCache = data.cotizaciones || [];
    renderCotizaciones(cotizacionesCache);
    actualizarBadgeCotizaciones(data.stats);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="hint-small">${err.message}</td></tr>`;
  }
}

async function actualizarBadgeCotizaciones(statsConocidos) {
  let stats = statsConocidos;
  if (!stats) {
    try {
      const data = await api("/api/admin/cotizaciones");
      cotizacionesCache = data.cotizaciones || [];
      stats = data.stats;
    } catch {
      return;
    }
  }
  const badge = document.getElementById("badge-cotizaciones");
  if (stats && stats.nuevas > 0) {
    badge.textContent = stats.nuevas;
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }
}

function renderCotizaciones(filas) {
  const tbody = document.getElementById("cotizaciones-tbody");
  if (!filas.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="hint-small">Todavía no hay solicitudes de cotización.</td></tr>`;
    return;
  }

  tbody.innerHTML = filas
    .map((c) => {
      const info = ESTADOS_COTIZACION[c.estado] || { texto: c.estado, clase: "badge-muted" };
      const contacto = [c.telefono, c.email].filter(Boolean).join(" · ");
      return `
        <tr>
          <td>${new Date(c.creado_en).toLocaleString("es-CL")}</td>
          <td>${c.nombre}${contacto ? `<br><span class="hint-small">${contacto}</span>` : ""}</td>
          <td>${c.producto_nombre || "—"}</td>
          <td class="pedido-items-mini">${c.descripcion}</td>
          <td><span class="badge-pill ${info.clase}">${info.texto}</span></td>
          <td>
            <div class="row-actions">
              ${c.estado !== "contactado" ? `<button type="button" class="btn-mini" data-cot-estado="${c.id}:contactado">Marcar contactado</button>` : ""}
              ${c.estado !== "cerrada" ? `<button type="button" class="btn-mini btn-mini-danger" data-cot-estado="${c.id}:cerrada">Cerrar</button>` : ""}
              ${c.telefono ? `<button type="button" class="btn-mini" data-cot-whatsapp="${c.id}">📱 WhatsApp</button>` : ""}
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  tbody.querySelectorAll("[data-cot-estado]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const [id, estado] = btn.dataset.cotEstado.split(":");
      cambiarEstadoCotizacion(id, estado);
    });
  });
  tbody.querySelectorAll("[data-cot-whatsapp]").forEach((btn) => {
    btn.addEventListener("click", () => abrirModalWhatsappCotizacion(btn.dataset.cotWhatsapp));
  });
}

async function cambiarEstadoCotizacion(id, estado) {
  try {
    await api(`/api/admin/cotizaciones/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    await cargarCotizaciones();
  } catch (err) {
    alert(err.message);
  }
}

function abrirModalWhatsappCotizacion(id) {
  const c = cotizacionesCache.find((x) => String(x.id) === String(id));
  if (!c || !c.telefono) return;
  // Reutilizamos el mismo modal de WhatsApp de los pedidos, con un mensaje
  // pensado para una cotización en vez de un pedido.
  whatsappPedidoActual = { id: c.id, nombre: c.nombre, total: 0, telefono: c.telefono };
  document.getElementById("wa-titulo").textContent = `Responder a ${c.nombre} por WhatsApp`;
  document.getElementById("wa-plantilla").value = "personalizado";
  document.getElementById("wa-mensaje").value = `Hola ${c.nombre}, te escribimos de Mis Pitutos Informáticos por tu solicitud de cotización${
    c.producto_nombre ? ` de "${c.producto_nombre}"` : ""
  }. `;
  actualizarLinkWhatsapp();
  document.getElementById("modal-whatsapp").hidden = false;
}

document.getElementById("btn-refrescar-cotizaciones").addEventListener("click", cargarCotizaciones);

// ---------- Estadísticas (top productos / mejores clientes) ----------

async function cargarEstadisticas() {
  const tbodyProductos = document.getElementById("top-productos-tbody");
  const tbodyClientes = document.getElementById("top-clientes-tbody");
  tbodyProductos.innerHTML = `<tr><td colspan="4">Cargando…</td></tr>`;
  tbodyClientes.innerHTML = `<tr><td colspan="4">Cargando…</td></tr>`;
  try {
    const data = await api("/api/admin/estadisticas");
    renderTopProductos(data.top_productos || []);
    renderTopClientes(data.top_clientes || []);
  } catch (err) {
    tbodyProductos.innerHTML = `<tr><td colspan="4" class="hint-small">${err.message}</td></tr>`;
    tbodyClientes.innerHTML = `<tr><td colspan="4" class="hint-small">${err.message}</td></tr>`;
  }
}

function renderTopProductos(filas) {
  const tbody = document.getElementById("top-productos-tbody");
  if (!filas.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="hint-small">Todavía no hay ventas pagadas para armar el ranking.</td></tr>`;
    return;
  }
  tbody.innerHTML = filas
    .map(
      (f, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${f.nombre || f.sku}</td>
          <td>${f.unidades}</td>
          <td>${money(f.ingresos)}</td>
        </tr>
      `
    )
    .join("");
}

function renderTopClientes(filas) {
  const tbody = document.getElementById("top-clientes-tbody");
  if (!filas.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="hint-small">Todavía no hay ventas pagadas para armar el ranking.</td></tr>`;
    return;
  }
  tbody.innerHTML = filas
    .map((f, i) => {
      const contacto = [f.telefono, f.email].filter(Boolean).join(" · ");
      return `
        <tr>
          <td>${i + 1}</td>
          <td>${f.nombre}${contacto ? `<br><span class="hint-small">${contacto}</span>` : ""}</td>
          <td>${f.pedidos}</td>
          <td>${money(f.total_gastado)}</td>
        </tr>
      `;
    })
    .join("");
}

// ---------- Ajustes (mensaje destacado) ----------

async function cargarAjustes() {
  try {
    const data = await api("/api/admin/configuracion");
    document.getElementById("aj-mensaje").value = data.config?.mensaje_destacado || "";
    document.getElementById("aj-activo").checked = !!data.config?.mensaje_activo;
  } catch (err) {
    alert(err.message);
  }
}

document.getElementById("form-ajustes").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById("ajustes-error");
  const okEl = document.getElementById("ajustes-ok");
  errorEl.hidden = true;
  okEl.hidden = true;

  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true;
  btn.textContent = "Guardando…";

  try {
    await api("/api/admin/configuracion", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mensaje_destacado: document.getElementById("aj-mensaje").value.trim(),
        mensaje_activo: document.getElementById("aj-activo").checked,
      }),
    });
    okEl.hidden = false;
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = "Guardar";
  }
});

init();

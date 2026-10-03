import { json } from "../_lib/json.js";
import { listarProductosPublicos } from "../_lib/productos-db.js";
import { obtenerConfiguracion } from "../_lib/configuracion-db.js";

// El catálogo solo se entrega si el link trae el token correcto (?t=...) —
// así nadie que llegue al dominio pelado ve nada, solo quien recibió el
// link de Sergio. No es una autenticación fuerte (no hay contraseña ni
// usuario), pero alcanza para "solo lo ve quien yo le mando el link".
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const token = url.searchParams.get("t") || "";

  if (!env.CATALOG_TOKEN || token !== env.CATALOG_TOKEN) {
    return json({ error: "Este link no es válido." }, 404);
  }

  const [filas, config] = await Promise.all([listarProductosPublicos(env.DB), obtenerConfiguracion(env.DB)]);
  const productos = filas.map((p) => ({
    sku: p.sku,
    nombre: p.nombre,
    precio: p.precio,
    descripcion: p.descripcion,
    fotos: p.foto_key ? [`/api/fotos/${p.foto_key}`] : [],
    stock: p.stock,
    tipo: p.tipo || "producto",
    enlace: p.tipo === "descarga" ? p.enlace || "" : undefined,
    enlace_compra: p.tipo === "descarga" ? p.enlace_compra || "" : undefined,
    categoria: p.categoria_nombre || "General",
  }));

  return json({
    negocio: env.NOMBRE_NEGOCIO || "Mis Pitutos Informáticos",
    productos,
    mensaje_destacado: config.mensaje_activo ? config.mensaje_destacado || null : null,
    contacto: {
      whatsapp: env.CONTACTO_WHATSAPP || "",
      email: env.CONTACTO_EMAIL || env.EMAIL_NOTIFICACIONES || "",
    },
  });
}

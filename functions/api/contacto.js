import { json } from "../_lib/json.js";
import { avisoContacto } from "../_lib/email.js";

// Formulario de "Escríbenos" del catálogo público. Igual que /api/catalogo,
// solo funciona con el token correcto (?t=...) para que nadie ajeno al link
// pueda usarlo como buzón de spam.
export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Solicitud inválida." }, 400);
  }

  const token = body.token || "";
  if (!env.CATALOG_TOKEN || token !== env.CATALOG_TOKEN) {
    return json({ error: "Este link no es válido." }, 404);
  }

  const nombre = (body.nombre || "").trim().slice(0, 120);
  const contacto = (body.contacto || "").trim().slice(0, 120);
  const mensaje = (body.mensaje || "").trim().slice(0, 2000);

  if (!nombre || !contacto || !mensaje) {
    return json({ error: "Completa todos los campos." }, 400);
  }

  await avisoContacto(env, { nombre, contacto, mensaje });

  return json({ ok: true });
}

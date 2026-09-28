import { json } from "../../_lib/json.js";
import { sesionValida } from "../../_lib/session.js";
import { obtenerConfiguracion, actualizarConfiguracion } from "../../_lib/configuracion-db.js";

export async function onRequestGet({ request, env }) {
  if (!(await sesionValida(request, env))) return json({ error: "No autorizado." }, 401);
  const config = await obtenerConfiguracion(env.DB);
  return json({ config });
}

export async function onRequestPut({ request, env }) {
  if (!(await sesionValida(request, env))) return json({ error: "No autorizado." }, 401);

  const body = await request.json().catch(() => ({}));
  await actualizarConfiguracion(env.DB, {
    mensajeDestacado: (body.mensaje_destacado || "").toString().trim().slice(0, 500),
    mensajeActivo: !!body.mensaje_activo,
  });

  return json({ ok: true });
}

import { json } from "../../_lib/json.js";
import { crearCookieSesion } from "../../_lib/session.js";

export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_USER || !env.ADMIN_PASS || !env.SESSION_SECRET) {
    return json({ error: "El panel de administración no está configurado todavía." }, 500);
  }

  const body = await request.json().catch(() => ({}));
  const usuario = (body.usuario || "").trim();
  const clave = (body.clave || "").trim();

  if (usuario !== env.ADMIN_USER || clave !== env.ADMIN_PASS) {
    return json({ error: "Usuario o contraseña incorrectos." }, 401);
  }

  const cookie = await crearCookieSesion(env);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Set-Cookie": cookie },
  });
}

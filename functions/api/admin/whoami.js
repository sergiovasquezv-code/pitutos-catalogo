import { json } from "../../_lib/json.js";
import { sesionValida } from "../../_lib/session.js";

// El panel usa esto al cargar para saber si ya hay sesión activa o si
// tiene que mostrar el formulario de login.
export async function onRequestGet({ request, env }) {
  const logueado = await sesionValida(request, env);
  return json({ logueado });
}

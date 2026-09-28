// Sesión simple para el panel de administración (/admin), firmada con
// SESSION_SECRET (Web Crypto, HMAC-SHA256) — no se guarda en ninguna base
// de datos, solo se valida la firma y la fecha de expiración cada vez.

const COOKIE_NAME = "pitutos_admin_session";
const DURACION_SEGUNDOS = 30 * 24 * 60 * 60; // 30 días

function base64UrlEncode(bytes) {
  let binario = "";
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecodeToString(str) {
  const normal = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normal.length % 4 === 0 ? "" : "=".repeat(4 - (normal.length % 4));
  return atob(normal + pad);
}

async function firmar(secret, texto) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(texto));
  return base64UrlEncode(new Uint8Array(sig));
}

function comparacionSegura(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function crearCookieSesion(env) {
  const payload = JSON.stringify({ exp: Math.floor(Date.now() / 1000) + DURACION_SEGUNDOS });
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(payload));
  const firma = await firmar(env.SESSION_SECRET, payloadB64);
  const token = `${payloadB64}.${firma}`;
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${DURACION_SEGUNDOS}`;
}

export function cookieLogout() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

function leerCookie(request) {
  const header = request.headers.get("Cookie") || "";
  for (const parte of header.split(";")) {
    const [k, ...resto] = parte.trim().split("=");
    if (k === COOKIE_NAME) return resto.join("=");
  }
  return null;
}

// Devuelve true si la petición trae una cookie de sesión válida y vigente.
export async function sesionValida(request, env) {
  if (!env.SESSION_SECRET) return false;
  const token = leerCookie(request);
  if (!token) return false;
  const [payloadB64, firma] = token.split(".");
  if (!payloadB64 || !firma) return false;

  const firmaEsperada = await firmar(env.SESSION_SECRET, payloadB64);
  if (!comparacionSegura(firma, firmaEsperada)) return false;

  try {
    const payload = JSON.parse(base64UrlDecodeToString(payloadB64));
    return typeof payload.exp === "number" && payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

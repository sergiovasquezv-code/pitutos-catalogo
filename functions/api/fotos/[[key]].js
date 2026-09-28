// Sirve las fotos de productos subidas desde el panel de administración.
export async function onRequestGet({ env, params }) {
  const key = Array.isArray(params.key) ? params.key.join("/") : params.key;
  if (!key || !env.FOTOS_PRODUCTOS) {
    return new Response("No encontrado", { status: 404 });
  }

  const object = await env.FOTOS_PRODUCTOS.get(key);
  if (!object) {
    return new Response("No encontrado", { status: 404 });
  }

  const headers = new Headers();
  if (typeof object.writeHttpMetadata === "function") {
    object.writeHttpMetadata(headers);
  }
  if (object.httpEtag) headers.set("ETag", object.httpEtag);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");

  return new Response(object.body, { headers });
}

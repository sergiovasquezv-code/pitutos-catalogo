// Sirve un comprobante de transferencia subido a R2, para que Sergio pueda
// abrirlo desde el link que le llega en el correo de aviso. No es un link
// listado en ningún lado — solo funciona si se conoce la key exacta, la
// misma lógica de "solo quien tiene el link" que el resto del sitio.
export async function onRequestGet({ env, params }) {
  const key = Array.isArray(params.key) ? params.key.join("/") : params.key;
  if (!key || !env.COMPROBANTES) {
    return new Response("No encontrado", { status: 404 });
  }

  const object = await env.COMPROBANTES.get(key);
  if (!object) {
    return new Response("No encontrado", { status: 404 });
  }

  const headers = new Headers();
  if (typeof object.writeHttpMetadata === "function") {
    object.writeHttpMetadata(headers);
  }
  if (object.httpEtag) headers.set("ETag", object.httpEtag);
  headers.set("Cache-Control", "private, max-age=0, no-cache");

  return new Response(object.body, { headers });
}

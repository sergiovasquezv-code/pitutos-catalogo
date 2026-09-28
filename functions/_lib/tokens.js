// Token largo y aleatorio para que un comprador vuelva a su pedido sin
// necesitar cuenta ni login (imposible de adivinar).
export function randomToken() {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
}

// Llave aleatoria y segura para nombrar un comprobante en R2.
export function randomComprobanteKey(pedidoId, originalName) {
  const ext = (originalName || "").split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  return `pedido-${pedidoId}/${crypto.randomUUID()}.${ext}`;
}

// Llave aleatoria para la foto de un producto en R2.
export function randomFotoProductoKey(originalName) {
  const ext = (originalName || "").split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  return `${crypto.randomUUID()}.${ext}`;
}

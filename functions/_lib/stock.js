// Descuenta el stock de cada producto de un pedido, una sola vez —
// protegido con pedidos.stock_descontado para que no se reste dos veces
// (ej: Mercado Pago reenvía el mismo webhook, o marcas "pagado" sin querer
// más de una vez desde el panel).
export async function descontarStockSiCorresponde(db, pedidoId) {
  const pedido = await db.prepare("SELECT * FROM pedidos WHERE id = ?").bind(pedidoId).first();
  if (!pedido || pedido.stock_descontado) return;

  let items = [];
  try {
    items = JSON.parse(pedido.items);
  } catch {
    items = [];
  }

  for (const item of items) {
    await db
      .prepare("UPDATE productos SET stock = MAX(stock - ?, 0) WHERE sku = ?")
      .bind(item.cantidad, item.sku)
      .run();
  }

  await db.prepare("UPDATE pedidos SET stock_descontado = 1 WHERE id = ?").bind(pedidoId).run();
}

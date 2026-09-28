-- Migración para pasar del catálogo fijo (archivo productos.js) al panel
-- administrable. Aplícala UNA sola vez sobre la base de datos que ya
-- tienes creada (no vuelvas a correr schema.sql completo, ya que
-- reintentaría crear cosas que ya existen).
--
--   npx wrangler d1 execute pitutos-catalogo-db --remote --file=migration_panel_admin.sql

ALTER TABLE pedidos ADD COLUMN stock_descontado INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku TEXT NOT NULL,
    nombre TEXT NOT NULL,
    precio INTEGER NOT NULL,
    descripcion TEXT,
    foto_key TEXT,
    stock INTEGER NOT NULL DEFAULT 0,
    disponible INTEGER NOT NULL DEFAULT 1,
    creado_en TEXT NOT NULL,
    actualizado_en TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_productos_sku ON productos(sku);

INSERT INTO productos (sku, nombre, precio, descripcion, foto_key, stock, disponible, creado_en)
VALUES (
    'router-huawei-e5576-d404',
    'Router Huawei E5576-D404',
    15000,
    'Router Huawei E5576 liberado, compatible con 3G/4G de cualquier compañía.',
    NULL,
    2,
    1,
    datetime('now')
);

-- Agrega categoría a los productos. Aplícala UNA sola vez:
--   npx wrangler d1 execute pitutos-catalogo-db --remote --file=migration_categorias.sql

ALTER TABLE productos ADD COLUMN categoria TEXT NOT NULL DEFAULT 'General';
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria);

-- Le pone una categoría razonable al router que ya tenías cargado.
UPDATE productos SET categoria = 'Routers y modems' WHERE sku = 'router-huawei-e5576-d404';

-- Agrega orden manual a los productos (como ya existe para las
-- categorías), para poder subir/bajar productos dentro de su categoría
-- desde el panel en vez de que siempre salgan en orden alfabético.
-- Aplícala UNA sola vez:
--   npx wrangler d1 execute pitutos-catalogo-db --remote --file=migration_productos_orden.sql

ALTER TABLE productos ADD COLUMN orden INTEGER NOT NULL DEFAULT 0;

-- Numera el orden según el id (orden de creación), para que quede
-- determinístico y puedas reordenar desde ahí.
UPDATE productos SET orden = id;

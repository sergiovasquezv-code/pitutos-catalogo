-- Pasa las categorías de texto libre a una tabla propia con orden (para
-- poder editarlas, subirlas/bajarlas con todos sus productos), y agrega
-- el mensaje destacado del catálogo. Aplícala UNA sola vez:
--   npx wrangler d1 execute pitutos-catalogo-db --remote --file=migration_categorias_avanzado.sql

CREATE TABLE IF NOT EXISTS categorias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    orden INTEGER NOT NULL DEFAULT 0,
    creado_en TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_categorias_nombre ON categorias(nombre);

-- Crea una categoría por cada valor distinto que ya tenías en productos.categoria.
INSERT INTO categorias (nombre, orden, creado_en)
SELECT DISTINCT categoria, 0, datetime('now') FROM productos WHERE categoria IS NOT NULL;

-- Numera el orden según el id (orden de creación), para que quede
-- determinístico y puedas reordenar desde ahí.
UPDATE categorias SET orden = id;

-- Categoría de respaldo para productos que en el futuro se queden sin
-- categoría (ej: si borras la categoría de un producto).
INSERT INTO categorias (nombre, orden, creado_en)
SELECT 'Sin categoría', (SELECT COALESCE(MAX(orden), 0) + 1 FROM categorias), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM categorias WHERE nombre = 'Sin categoría');

ALTER TABLE productos ADD COLUMN categoria_id INTEGER REFERENCES categorias(id);

UPDATE productos
SET categoria_id = (SELECT id FROM categorias WHERE categorias.nombre = productos.categoria)
WHERE categoria_id IS NULL;

UPDATE productos
SET categoria_id = (SELECT id FROM categorias WHERE nombre = 'Sin categoría')
WHERE categoria_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_productos_categoria_id ON productos(categoria_id);

-- Mensaje destacado (promoción o aviso) arriba del catálogo.
CREATE TABLE IF NOT EXISTS configuracion_catalogo (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    mensaje_destacado TEXT,
    mensaje_activo INTEGER NOT NULL DEFAULT 0,
    actualizado_en TEXT
);

INSERT INTO configuracion_catalogo (id, mensaje_destacado, mensaje_activo)
SELECT 1, NULL, 0
WHERE NOT EXISTS (SELECT 1 FROM configuracion_catalogo WHERE id = 1);

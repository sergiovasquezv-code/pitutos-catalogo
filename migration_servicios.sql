-- Agrega soporte para "servicios" (sin stock) además de productos físicos,
-- y una tabla nueva para las solicitudes de cotización que llegan desde el
-- catálogo (el cliente describe su proyecto en vez de pagar de inmediato).

-- 'producto' (el comportamiento de siempre, con stock) o 'servicio' (sin
-- stock — cosas como reparación de PC, configuración de servidores, etc.).
ALTER TABLE productos ADD COLUMN tipo TEXT NOT NULL DEFAULT 'producto';

CREATE TABLE IF NOT EXISTS cotizaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    producto_sku TEXT,
    producto_nombre TEXT,
    nombre TEXT NOT NULL,
    telefono TEXT,
    email TEXT,
    descripcion TEXT NOT NULL,
    -- nueva | contactado | cerrada
    estado TEXT NOT NULL DEFAULT 'nueva',
    creado_en TEXT NOT NULL,
    actualizado_en TEXT
);

CREATE INDEX IF NOT EXISTS idx_cotizaciones_estado ON cotizaciones(estado);

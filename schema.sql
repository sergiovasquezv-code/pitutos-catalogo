-- Esquema para la base de datos D1 del catálogo de productos.

-- Cada pedido queda registrado apenas el comprador termina el checkout
-- (por transferencia o Mercado Pago), para poder avisarte por correo y
-- llevar trazabilidad de cada movimiento.
CREATE TABLE IF NOT EXISTS pedidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    telefono TEXT,
    email TEXT,
    direccion TEXT,
    -- JSON con el detalle de lo comprado: [{sku, nombre, precio, cantidad}]
    items TEXT NOT NULL,
    total INTEGER NOT NULL,
    metodo_pago TEXT NOT NULL, -- 'transferencia' | 'mercadopago'
    -- pendiente_transferencia | comprobante_subido | pendiente_mercadopago |
    -- pagado | rechazado
    estado TEXT NOT NULL DEFAULT 'pendiente_transferencia',
    comprobante_key TEXT,
    comprobante_nota TEXT,
    mp_preference_id TEXT,
    mp_payment_id TEXT,
    mp_status TEXT,
    -- Token único para que el comprador vuelva a su pedido (subir
    -- comprobante, ver estado) sin necesitar cuenta ni login.
    public_token TEXT NOT NULL,
    creado_en TEXT NOT NULL,
    actualizado_en TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_public_token ON pedidos(public_token);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado);

-- Marca si ya se descontó el stock de este pedido, para no restarlo dos
-- veces (ej: Mercado Pago reenvía el mismo webhook, o confirmas "pagado"
-- más de una vez sin querer).
ALTER TABLE pedidos ADD COLUMN stock_descontado INTEGER NOT NULL DEFAULT 0;

-- Categorías del catálogo, con orden propio: subir/bajar una categoría
-- (cambiar su `orden`) mueve con ella a todos sus productos, porque el
-- catálogo siempre se lista agrupado por categorias.orden.
CREATE TABLE IF NOT EXISTS categorias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    orden INTEGER NOT NULL DEFAULT 0,
    creado_en TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_categorias_nombre ON categorias(nombre);

INSERT INTO categorias (nombre, orden, creado_en) VALUES ('Routers y modems', 1, datetime('now'));
INSERT INTO categorias (nombre, orden, creado_en) VALUES ('Sin categoría', 999, datetime('now'));

-- Catálogo de productos, administrable desde el panel (/admin).
CREATE TABLE IF NOT EXISTS productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku TEXT NOT NULL,
    nombre TEXT NOT NULL,
    precio INTEGER NOT NULL,
    descripcion TEXT,
    -- key del archivo en el bucket R2 de fotos de productos (o NULL si
    -- todavía no se le subió foto).
    foto_key TEXT,
    stock INTEGER NOT NULL DEFAULT 0,
    -- 0 = pausado (no aparece en el catálogo aunque tenga stock).
    disponible INTEGER NOT NULL DEFAULT 1,
    categoria_id INTEGER NOT NULL REFERENCES categorias(id),
    -- 'producto' (con stock, se agrega al carrito y se paga) o 'servicio'
    -- (sin stock — reparación de PC, configuración de servidores, etc. — en
    -- el catálogo muestra "Cotizar" en vez de "Agregar al carrito").
    tipo TEXT NOT NULL DEFAULT 'producto',
    creado_en TEXT NOT NULL,
    actualizado_en TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_productos_sku ON productos(sku);
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);

INSERT INTO productos (sku, nombre, precio, descripcion, foto_key, stock, disponible, categoria_id, creado_en)
VALUES (
    'router-huawei-e5576-d404',
    'Router Huawei E5576-D404',
    15000,
    'Router Huawei E5576 liberado, compatible con 3G/4G de cualquier compañía.',
    NULL,
    2,
    1,
    (SELECT id FROM categorias WHERE nombre = 'Routers y modems'),
    datetime('now')
);

-- Mensaje destacado (promoción o aviso) que se muestra arriba del
-- catálogo. Una sola fila fija (id=1).
CREATE TABLE IF NOT EXISTS configuracion_catalogo (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    mensaje_destacado TEXT,
    mensaje_activo INTEGER NOT NULL DEFAULT 0,
    actualizado_en TEXT
);

INSERT INTO configuracion_catalogo (id, mensaje_destacado, mensaje_activo) VALUES (1, NULL, 0);

-- Solicitudes de cotización: cuando el cliente pide un servicio ("Cotizar")
-- describe su proyecto en vez de pagar de inmediato, y eso queda registrado
-- acá para que puedas revisarlo y contactarlo.
CREATE TABLE IF NOT EXISTS cotizaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    producto_sku TEXT,
    producto_nombre TEXT,
    nombre TEXT NOT NULL,
    telefono TEXT,
    email TEXT,
    descripcion TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'nueva', -- nueva | contactado | cerrada
    creado_en TEXT NOT NULL,
    actualizado_en TEXT
);

CREATE INDEX IF NOT EXISTS idx_cotizaciones_estado ON cotizaciones(estado);

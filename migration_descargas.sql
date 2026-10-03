-- Programas para descargar (tipo 'descarga', ej: MiPOS) en el catálogo.
-- NO hace falta correrla: el sitio crea estas columnas solo la primera vez
-- que se abre. Queda aquí solo como registro de los cambios a la base.
ALTER TABLE productos ADD COLUMN enlace TEXT;
ALTER TABLE productos ADD COLUMN enlace_compra TEXT;

-- Agrega la dirección del comprador a los pedidos, y deja teléfono/correo
-- como obligatorios de ahí en adelante (los pedidos viejos pueden quedar
-- con esos campos vacíos, no pasa nada). Aplícala UNA sola vez:
--   npx wrangler d1 execute pitutos-catalogo-db --remote --file=migration_direccion.sql

ALTER TABLE pedidos ADD COLUMN direccion TEXT;

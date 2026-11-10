ALTER TABLE reportes ADD COLUMN estado text NOT NULL DEFAULT 'pendiente'
  CHECK (estado IN ('pendiente', 'revisado', 'resuelto', 'rechazado'));
ALTER TABLE notificaciones ADD COLUMN leida boolean NOT NULL DEFAULT false;
-- Un perfil por usuario. Si existen duplicados, resolverlos antes de migrar.
CREATE UNIQUE INDEX perfiles_usuario_unico ON perfiles(usuario_id);
CREATE TABLE sesiones (
  id uuid PRIMARY KEY,
  usuario_id bigint NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expira_en timestamptz NOT NULL,
  revocada boolean NOT NULL DEFAULT false
);
CREATE INDEX sesiones_usuario_idx ON sesiones(usuario_id);

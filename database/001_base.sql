-- Esquema para PostgreSQL

create table usuarios (
  id bigint primary key generated always as identity,
  nombre text not null,
  email text not null unique,
  password_hash text not null,
  foto_credencial text,
  foto_carnet text,
  verificado boolean not null default false,
  tipo_usuario text
);

create table perfiles (
  id bigint primary key generated always as identity,
  usuario_id bigint not null references usuarios (id) on delete cascade,
  informacion text,
  intereses text[] not null default '{}',
  gustos text[] not null default '{}',
  preferencias text[] not null default '{}'
);

create table recomendaciones (
  id bigint primary key generated always as identity,
  usuario_id bigint not null references usuarios (id) on delete cascade,
  recomendado_id bigint not null references usuarios (id) on delete cascade,
  compatibilidad real,
  check (usuario_id <> recomendado_id),
  unique (usuario_id, recomendado_id)
);

create table interacciones (
  id bigint primary key generated always as identity,
  usuario_id bigint not null references usuarios (id) on delete cascade,
  interactuado_id bigint not null references usuarios (id) on delete cascade,
  tipo_interaccion text not null,
  check (usuario_id <> interactuado_id)
);

create table matches (
  id bigint primary key generated always as identity,
  usuario1_id bigint not null references usuarios (id) on delete cascade,
  usuario2_id bigint not null references usuarios (id) on delete cascade,
  fecha_match timestamp with time zone not null default now(),
  check (usuario1_id <> usuario2_id)
);

create unique index matches_par_unico
  on matches (least(usuario1_id, usuario2_id), greatest(usuario1_id, usuario2_id));

create table chats (
  id bigint primary key generated always as identity,
  match_id bigint not null references matches (id) on delete cascade,
  mensaje text not null,
  enviado_por bigint not null references usuarios (id) on delete cascade,
  fecha_envio timestamp with time zone not null default now()
);

create table mensajesanonimos (
  id bigint primary key generated always as identity,
  remitente_id bigint not null references usuarios (id) on delete cascade,
  destinatario_id bigint not null references usuarios (id) on delete cascade,
  mensaje text not null,
  revelado boolean not null default false
);

create table reportes (
  id bigint primary key generated always as identity,
  reportado_id bigint not null references usuarios (id) on delete cascade,
  reportado_por bigint not null references usuarios (id) on delete cascade,
  razon text,
  fecha_reporte timestamp with time zone not null default now(),
  check (reportado_id <> reportado_por)
);

create table notificaciones (
  id bigint primary key generated always as identity,
  usuario_id bigint not null references usuarios (id) on delete cascade,
  tipo_notificacion text,
  contenido text,
  fecha_notificacion timestamp with time zone not null default now()
);

create index on perfiles (usuario_id);
create index on recomendaciones (usuario_id);
create index on recomendaciones (recomendado_id);
create index on interacciones (usuario_id);
create index on interacciones (interactuado_id);
create index on matches (usuario1_id);
create index on matches (usuario2_id);
create index on chats (match_id, fecha_envio);
create index on chats (enviado_por);
create index on mensajesanonimos (remitente_id);
create index on mensajesanonimos (destinatario_id);
create index on reportes (reportado_id);
create index on reportes (reportado_por);
create index on notificaciones (usuario_id, fecha_notificacion);

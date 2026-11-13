-- Persist uploaded and generated media in Postgres so hosted instances
-- can serve the same creative bytes Meta fetches during a publish.

create table if not exists media_objects (
  storage_key text primary key,
  mime_type text not null,
  byte_size integer not null,
  bytes bytea not null,
  created_at timestamptz not null default now()
);

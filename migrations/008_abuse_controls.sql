-- Durable abuse controls: rate-limit buckets survive process restarts.
-- Instagram media grants stay short-lived and only valid during an active publish.

create table if not exists rate_limit_buckets (
  key text primary key,
  count integer not null,
  reset_at timestamptz not null
);

create index if not exists rate_limit_buckets_reset_idx
  on rate_limit_buckets (reset_at);

alter table instagram_media_grants
  add column if not exists ttl_seconds integer not null default 900;

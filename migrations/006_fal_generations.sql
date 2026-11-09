create table if not exists fal_generations (
  id uuid primary key,
  customer_id uuid not null references customers(id) on delete cascade,
  kind text not null check (kind in ('image', 'logo', 'video')),
  model_id text not null,
  prompt text not null,
  settings jsonb not null default '{}'::jsonb,
  status text not null check (status in ('queued', 'in_progress', 'completed', 'failed')),
  request_id text,
  media_urls jsonb not null default '[]'::jsonb,
  cost_usd numeric(12, 6) not null default 0,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fal_generations_customer_idx on fal_generations (customer_id, created_at desc);
create index if not exists fal_generations_request_idx on fal_generations (request_id);

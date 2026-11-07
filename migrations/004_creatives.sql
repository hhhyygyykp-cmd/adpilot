alter table campaigns
  add column audience_note text;

alter table campaigns
  add column generation_status text not null default 'not_started';

alter table campaigns
  add column generation_note text not null default '';

create table if not exists campaign_creatives (
  id uuid primary key,
  customer_id uuid not null references customers(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  kind text not null,
  provider text not null,
  prompt text not null,
  mime_type text not null,
  byte_size integer not null,
  storage_key text not null,
  original_name text not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  constraint campaign_creatives_kind_chk check (kind in ('image', 'video'))
);

create index if not exists campaign_creatives_campaign_idx
  on campaign_creatives (campaign_id, created_at desc);
create index if not exists campaign_creatives_customer_idx
  on campaign_creatives (customer_id);

create table if not exists business_memory (
  id uuid primary key,
  customer_id uuid not null references customers(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  source_campaign_id uuid references campaigns(id) on delete set null,
  kind text not null,
  label text not null,
  value text not null,
  evidence text not null default '',
  created_at timestamptz not null default now(),
  constraint business_memory_kind_chk check (
    kind in (
      'verified_fact',
      'preference',
      'campaign_history',
      'measured_insight',
      'hypothesis'
    )
  )
);

create index if not exists business_memory_business_idx
  on business_memory (business_id, created_at desc);
create index if not exists business_memory_customer_idx
  on business_memory (customer_id);

alter table campaigns
  add column marketing_plan jsonb not null default '{}'::jsonb;

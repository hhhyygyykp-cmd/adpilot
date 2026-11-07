create table if not exists customers (
  id uuid primary key,
  email text not null unique,
  password_hash text not null,
  name text not null,
  preferred_language text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_language_chk check (preferred_language in ('en', 'ar'))
);

create table if not exists sessions (
  id uuid primary key,
  customer_id uuid not null references customers(id) on delete cascade,
  token_hash text not null unique,
  csrf_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists sessions_customer_id_idx on sessions (customer_id);
create index if not exists sessions_expires_at_idx on sessions (expires_at);

create table if not exists admin_invites (
  id uuid primary key,
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid references customers(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists admin_invites_email_idx on admin_invites (lower(email));

create table if not exists businesses (
  id uuid primary key,
  customer_id uuid not null references customers(id) on delete cascade,
  name text not null default '',
  category text not null default '',
  description text not null default '',
  products_services text not null default '',
  target_customers text not null default '',
  location text not null default '',
  website text not null default '',
  public_contact text not null default '',
  brand_personality text not null default '',
  marketing_goals text not null default '',
  brand_colors jsonb not null default '{}'::jsonb,
  preferred_language text not null default 'en',
  is_active boolean not null default false,
  onboarding_complete boolean not null default false,
  onboarding_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint businesses_language_chk check (preferred_language in ('en', 'ar'))
);

create index if not exists businesses_customer_id_idx on businesses (customer_id);

create table if not exists business_assets (
  id uuid primary key,
  customer_id uuid not null references customers(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  kind text not null,
  original_name text not null,
  mime_type text not null,
  byte_size integer not null,
  storage_key text not null,
  created_at timestamptz not null default now(),
  constraint business_assets_kind_chk check (kind in ('logo', 'product_photo'))
);

create index if not exists business_assets_business_id_idx on business_assets (business_id);
create index if not exists business_assets_customer_id_idx on business_assets (customer_id);

create table if not exists campaigns (
  id uuid primary key,
  customer_id uuid not null references customers(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  status text not null default 'drafting',
  original_prompt text not null default '',
  product_name text,
  offer text,
  objective text,
  format_preference text,
  existing_photos_note text,
  must_appear text,
  conversation jsonb not null default '[]'::jsonb,
  interpreted_brief jsonb not null default '{}'::jsonb,
  interpreter text not null default 'structured',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaigns_status_chk check (status in ('drafting', 'brief_ready', 'confirmed')),
  constraint campaigns_format_chk check (
    format_preference is null
    or format_preference in ('image', 'video', 'both', 'ai_recommend')
  )
);

create index if not exists campaigns_customer_id_idx on campaigns (customer_id);
create index if not exists campaigns_business_id_idx on campaigns (business_id);

create table if not exists audit_log (
  id uuid primary key,
  actor_customer_id uuid references customers(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_actor_idx on audit_log (actor_customer_id);
create index if not exists audit_log_created_idx on audit_log (created_at);

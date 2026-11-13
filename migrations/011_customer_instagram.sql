-- Customer Instagram is analysis-only. Tokens never mix with the agency publishing account.

alter table business_memory drop constraint if exists business_memory_kind_chk;
alter table business_memory add constraint business_memory_kind_chk check (
  kind in (
    'verified_fact',
    'preference',
    'campaign_history',
    'measured_insight',
    'hypothesis',
    'instagram_observation'
  )
);

alter table business_memory add column if not exists source text not null default '';
alter table business_memory add column if not exists confidence text not null default '';
alter table business_memory add column if not exists retrieved_at timestamptz;

create table if not exists customer_instagram_accounts (
  id uuid primary key,
  customer_id uuid not null references customers(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  ig_user_id text,
  username text,
  name text,
  biography text,
  website text,
  profile_picture_url text,
  followers_count integer,
  follows_count integer,
  media_count integer,
  account_type text,
  permissions jsonb not null default '[]'::jsonb,
  token_ciphertext text,
  token_expires_at timestamptz,
  status text not null default 'disconnected',
  last_error text not null default '',
  connected_at timestamptz,
  last_synced_at timestamptz,
  imported_deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_instagram_accounts_business_uidx unique (business_id),
  constraint customer_instagram_accounts_status_chk check (
    status in ('disconnected', 'connected', 'expired', 'needs_reauth', 'ineligible')
  )
);

create index if not exists customer_instagram_accounts_customer_idx
  on customer_instagram_accounts (customer_id);

create table if not exists customer_instagram_oauth_states (
  id uuid primary key,
  state text not null unique,
  customer_id uuid not null references customers(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  authorization_code text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists customer_instagram_oauth_states_expires_idx
  on customer_instagram_oauth_states (expires_at);

create table if not exists customer_instagram_media (
  id uuid primary key,
  customer_id uuid not null references customers(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  ig_media_id text not null,
  media_type text not null default '',
  media_product_type text not null default '',
  caption text not null default '',
  permalink text,
  posted_at timestamptz,
  like_count integer,
  comments_count integer,
  thumbnail_url text,
  insights jsonb,
  insights_unavailable text,
  created_at timestamptz not null default now(),
  constraint customer_instagram_media_uidx unique (business_id, ig_media_id)
);

create index if not exists customer_instagram_media_business_idx
  on customer_instagram_media (business_id, posted_at desc);

create table if not exists customer_instagram_analyses (
  id uuid primary key,
  customer_id uuid not null references customers(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  status text not null default 'ready',
  retrieved jsonb not null default '{}'::jsonb,
  inferred jsonb not null default '{}'::jsonb,
  vision_used boolean not null default false,
  media_count integer not null default 0,
  last_error text not null default '',
  retrieved_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_instagram_analyses_status_chk check (
    status in ('ready', 'failed', 'pending_review', 'confirmed', 'withdrawn')
  )
);

create index if not exists customer_instagram_analyses_business_idx
  on customer_instagram_analyses (business_id, created_at desc);

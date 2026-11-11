-- Agency Instagram publishing: one professional account, dual approval, real post IDs only.

create table if not exists agency_social_accounts (
  id uuid primary key,
  platform text not null,
  ig_user_id text,
  username text,
  account_type text,
  name text,
  permissions jsonb not null default '[]'::jsonb,
  token_ciphertext text,
  token_expires_at timestamptz,
  status text not null default 'disconnected',
  last_error text not null default '',
  connected_at timestamptz,
  connected_by uuid references customers(id) on delete set null,
  last_refreshed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agency_social_accounts_platform_chk check (platform in ('instagram')),
  constraint agency_social_accounts_status_chk check (
    status in ('disconnected', 'connected', 'expired', 'needs_reauth')
  )
);

create unique index if not exists agency_social_accounts_platform_uidx
  on agency_social_accounts (platform);

create table if not exists instagram_oauth_states (
  id uuid primary key,
  state text not null unique,
  admin_customer_id uuid not null references customers(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists instagram_oauth_states_expires_idx
  on instagram_oauth_states (expires_at);

create table if not exists instagram_publications (
  id uuid primary key,
  customer_id uuid not null references customers(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  creative_id uuid not null references campaign_creatives(id) on delete cascade,
  kind text not null,
  caption text not null default '',
  requested_at timestamptz,
  customer_approved_at timestamptz,
  admin_authorized_at timestamptz,
  admin_authorized_by uuid references customers(id) on delete set null,
  publish_status text not null default 'pending_admin',
  ig_media_id text,
  permalink text,
  published_at timestamptz,
  last_error text not null default '',
  insights jsonb,
  insights_fetched_at timestamptz,
  insights_unavailable text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint instagram_publications_kind_chk check (kind in ('image', 'video')),
  constraint instagram_publications_status_chk check (
    publish_status in (
      'pending_admin',
      'authorized',
      'publishing',
      'published',
      'failed',
      'withdrawn',
      'declined'
    )
  )
);

create unique index if not exists instagram_publications_creative_uidx
  on instagram_publications (creative_id);

create index if not exists instagram_publications_customer_idx
  on instagram_publications (customer_id, updated_at desc);

create index if not exists instagram_publications_queue_idx
  on instagram_publications (publish_status, updated_at desc);

create index if not exists instagram_publications_campaign_idx
  on instagram_publications (campaign_id, created_at desc);

create table if not exists instagram_media_grants (
  id uuid primary key,
  token_hash text not null unique,
  creative_id uuid not null references campaign_creatives(id) on delete cascade,
  publication_id uuid not null references instagram_publications(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists instagram_media_grants_expires_idx
  on instagram_media_grants (expires_at);

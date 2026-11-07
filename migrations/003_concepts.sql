alter table campaigns
  add column concept_set jsonb not null default '{}'::jsonb;

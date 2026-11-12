alter table instagram_oauth_states
  add column if not exists authorization_code text;

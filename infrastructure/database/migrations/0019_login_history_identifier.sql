-- Ch.10 §76 gives login_history no column to key a pre-authentication
-- attempt by — only a nullable user_id, which doesn't exist yet for a
-- failed login against an unrecognized email. Account lockout (§81) needs
-- to count recent failed attempts for whatever identifier was typed,
-- before any user_id can be resolved. Surfaced building Phase 4 (Auth).
alter table public.login_history
  add column attempted_identifier text;

create index idx_login_history_attempted_identifier
  on public.login_history (attempted_identifier, occurred_at desc);

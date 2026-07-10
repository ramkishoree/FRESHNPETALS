-- Extensions and the UUIDv7 primary-key generator.
-- Handbook: Ch.10 §3 (pgvector for embeddings/semantic search), §17 (UUID v7
-- for every entity — globally unique, chronologically sortable, no
-- sequential ID exposure, multi-region ready).

create extension if not exists pgcrypto;
create extension if not exists vector;
create extension if not exists pg_trgm; -- fuzzy/typo-tolerant search support for Ch.10 §26/§161 search indexes

-- Postgres has no native uuidv7() before v18; Supabase runs on earlier
-- versions today, so we generate it ourselves: 48-bit big-endian Unix ms
-- timestamp + 74 bits of randomness, with the version/variant bits set per
-- RFC 9562. Deliberately a plain function (not a domain/cast) so it drops
-- in as a normal `default` expression on every table's `id` column.
create or replace function uuid_generate_v7()
returns uuid
language plpgsql
volatile
as $$
declare
  unix_ts_ms bytea;
  rand_bytes bytea;
begin
  unix_ts_ms := substring(int8send(floor(extract(epoch from clock_timestamp()) * 1000)::bigint) from 3 for 6);
  rand_bytes := gen_random_bytes(10);

  -- Byte 6 (first byte of the random block): high nibble = version 7.
  rand_bytes := set_byte(rand_bytes, 0, (get_byte(rand_bytes, 0) & 15) | 112);
  -- Byte 8 (third byte of the random block): top two bits = variant 10.
  rand_bytes := set_byte(rand_bytes, 2, (get_byte(rand_bytes, 2) & 63) | 128);

  return encode(unix_ts_ms || rand_bytes, 'hex')::uuid;
end;
$$;

comment on function uuid_generate_v7() is
  'RFC 9562 UUIDv7: sortable by creation time. Default for every table''s id column per Handbook Ch.10 §17.';

-- ============================================================================
-- Minimal Supabase platform stubs for local migration checks (PGlite).
--
-- These recreate ONLY the parts of a hosted Supabase project that the
-- migrations in supabase/migrations/ depend on, so the migrations can be run
-- end-to-end in CI/local without Docker or a cloud project:
--
--   * roles: anon, authenticated, service_role
--   * schema auth  + auth.users table + auth.uid()/auth.role() helpers
--   * schema storage + storage.buckets, storage.objects, storage.foldername()
--   * schema extensions (target of `create extension pgcrypto`)
--   * publication supabase_realtime
--
-- This file is NOT a migration and must never be applied to a real project.
-- ============================================================================

-- --- roles -------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

-- --- schemas -----------------------------------------------------------------
create schema if not exists extensions;
create schema if not exists auth;
create schema if not exists storage;

grant usage on schema public to anon, authenticated, service_role;

-- --- auth.users --------------------------------------------------------------
create table if not exists auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text,
  encrypted_password  text,
  raw_user_meta_data  jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

-- auth.uid() mirrors Supabase: the `sub` claim of the request JWT, which the
-- API layer injects as a GUC. Returns null for anonymous requests.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon');
$$;

-- --- storage -----------------------------------------------------------------
create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz not null default now()
);

create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text not null references storage.buckets (id),
  name       text not null,
  owner      uuid,
  metadata   jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bucket_id, name)
);

alter table storage.objects enable row level security;
alter table storage.buckets enable row level security;

-- Supabase's helper: splits an object path into its folders.
create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1];
$$;

-- --- realtime publication ----------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

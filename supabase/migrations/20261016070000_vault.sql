-- ============================================================================
-- Memory Vault — a searchable family media archive backed by Google Drive
--
-- Design
-- ------
-- * A family's files live in ONE Google Drive account. The OAuth refresh token
--   is encrypted with GOOGLE_REFRESH_TOKEN_ENCRYPTION_KEY and kept in
--   `vault_connections`, which **no client role may read**: only the Edge
--   Functions, which run as service_role, ever touch it.
-- * `vault_items` is the index the app searches: year, event, kind, caption.
-- * Clients get SELECT on the index and UPDATE on exactly two columns
--   (`is_favorite`, `caption`) via column-level grants. Every write with a
--   Drive side effect — upload, rename, delete — is performed by the Edge
--   Function after it verifies the caller's JWT and family membership, so a
--   member of one family can never reach another family's files even though
--   they share the same Drive account.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Per-family Drive connection (server-side only)
-- ----------------------------------------------------------------------------
create table public.vault_connections (
  family_id         uuid primary key references public.families(id) on delete cascade,
  /** Google account that owns the files, for display in the UI. */
  account_email     text,
  account_name      text,
  /** AES-GCM(nonce || tag || ciphertext), base64 — decrypted only server-side. */
  refresh_token_enc text not null,
  scope             text,
  /** Set when Google reports the token is dead (e.g. 7-day testing expiry). */
  revoked_at        timestamptz,
  connected_by      uuid references public.profiles(id) on delete set null,
  connected_at      timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger vault_connections_set_updated_at
  before update on public.vault_connections
  for each row execute function public.set_updated_at();

alter table public.vault_connections enable row level security;

-- Deliberately unreadable from the API. The policy exists so that the "every
-- table has a policy" invariant holds; it denies everything.
create policy "vault_connections_no_client_access"
  on public.vault_connections for select to authenticated
  using (false);

revoke all on public.vault_connections from anon, authenticated;

-- ----------------------------------------------------------------------------
-- Vault index
-- ----------------------------------------------------------------------------
create table public.vault_items (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null references public.families(id) on delete cascade,
  added_by       uuid not null references public.profiles(id) on delete cascade,
  /** Drive file id. Null while an upload is still in flight. */
  drive_file_id  text,
  drive_folder_id text,
  name           text not null check (length(btrim(name)) between 1 and 300),
  mime_type      text not null default 'application/octet-stream',
  size_bytes     bigint not null default 0 check (size_bytes >= 0),
  kind           text not null default 'other'
                   check (kind in ('photo', 'video', 'audio', 'document', 'other')),
  /** When the memory happened (EXIF / Drive metadata), falling back to upload. */
  captured_at    timestamptz,
  /** Denormalised from captured_at so the Vault can group without a scan. */
  year           int check (year is null or year between 1000 and 9999),
  event_id       uuid references public.family_events(id) on delete set null,
  caption        text check (caption is null or length(caption) <= 2000),
  is_favorite    boolean not null default false,
  upload_state   text not null default 'pending'
                   check (upload_state in ('pending', 'ready', 'failed')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- One row per Drive file: makes the Edge Function's upload retry idempotent.
create unique index vault_items_drive_file_id_key
  on public.vault_items (drive_file_id) where drive_file_id is not null;

create index vault_items_family_year_idx
  on public.vault_items (family_id, year desc nulls last, created_at desc);

create index vault_items_family_kind_idx
  on public.vault_items (family_id, kind, created_at desc);

create index vault_items_family_event_idx
  on public.vault_items (family_id, event_id) where event_id is not null;

create trigger vault_items_set_updated_at
  before update on public.vault_items
  for each row execute function public.set_updated_at();

alter table public.vault_items enable row level security;

-- ----------------------------------------------------------------------------
-- "Who's in the picture" — a real join table so the references are enforced
-- ----------------------------------------------------------------------------
create table public.vault_item_people (
  item_id    uuid not null references public.vault_items(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (item_id, profile_id)
);

alter table public.vault_item_people enable row level security;

-- ----------------------------------------------------------------------------
-- Family resolver: mirrors event_family_id() / ludo_game_family_id() so the
-- child table's policies can be expressed against the parent's family.
-- ----------------------------------------------------------------------------
create or replace function public.vault_item_family_id(p_item_id uuid)
returns uuid
language sql stable security definer set search_path = public, pg_temp
as $$
  select family_id from public.vault_items where id = p_item_id;
$$;

revoke execute on function public.vault_item_family_id(uuid) from public, anon;
grant execute on function public.vault_item_family_id(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Policies
-- ----------------------------------------------------------------------------
create policy "vault_items_select_members"
  on public.vault_items for select to authenticated
  using (public.is_family_member(family_id, auth.uid()));

-- Metadata-only edits. INSERT and DELETE are intentionally absent: rows are
-- created and removed by the Edge Function so Drive and Postgres can never
-- disagree about what exists.
create policy "vault_items_update_members"
  on public.vault_items for update to authenticated
  using (public.is_family_member(family_id, auth.uid()))
  with check (public.is_family_member(family_id, auth.uid()));

create policy "vault_item_people_select_members"
  on public.vault_item_people for select to authenticated
  using (public.is_family_member(public.vault_item_family_id(item_id), auth.uid()));

create policy "vault_item_people_insert_members"
  on public.vault_item_people for insert to authenticated
  with check (public.is_family_member(public.vault_item_family_id(item_id), auth.uid()));

create policy "vault_item_people_delete_members"
  on public.vault_item_people for delete to authenticated
  using (public.is_family_member(public.vault_item_family_id(item_id), auth.uid()));

-- ----------------------------------------------------------------------------
-- Grants: the narrowest surface that still lets the app work.
--
-- `update` is granted per column so an authenticated client can favourite an
-- item or fix a caption, but cannot rewrite `drive_file_id` (which would let a
-- member point a row at another family's file id and then read it back through
-- the server's Drive credentials).
-- ----------------------------------------------------------------------------
revoke all on public.vault_items from anon, authenticated;
grant select on public.vault_items to authenticated;
grant update (is_favorite, caption) on public.vault_items to authenticated;

revoke all on public.vault_item_people from anon, authenticated;
grant select, insert, delete on public.vault_item_people to authenticated;

-- ----------------------------------------------------------------------------
-- Realtime: a new memory refreshes everyone's Vault.
-- ----------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.vault_items;
exception when duplicate_object then null; when undefined_object then null;
end $$;

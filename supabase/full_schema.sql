-- ============================================================================
-- Our Cousin Family â€” Core Schema
-- Profiles, families, invitations, posts, comments, conversations, messages,
-- notifications, bookmarks.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ----------------------------------------------------------------------------
-- Helper: updated_at maintenance
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------
create table public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  full_name             text not null check (char_length(full_name) between 1 and 80),
  nickname              text check (nickname is null or char_length(nickname) <= 40),
  username              text unique check (username is null or username ~ '^[a-z0-9_]{3,24}$'),
  bio                   text check (bio is null or char_length(bio) <= 500),
  birthday              date,
  relationship          text check (relationship is null or relationship in
                          ('cousin', 'sibling', 'uncle', 'aunt', 'parent', 'grandparent', 'other')),
  avatar_url            text,
  show_birthday         boolean not null default true,
  show_online_status    boolean not null default true,
  notification_prefs    jsonb not null default '{}'::jsonb,
  last_seen_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index profiles_username_idx on public.profiles (username);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile whenever an auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(coalesce(new.email, 'family_member'), '@', 1)
    ),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- families
-- ----------------------------------------------------------------------------
create table public.families (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (char_length(name) between 2 and 60),
  description       text check (description is null or char_length(description) <= 1000),
  rules             text check (rules is null or char_length(rules) <= 4000),
  avatar_url        text,
  cover_url         text,
  privacy           text not null default 'invite_only'
                      check (privacy in ('invite_only', 'private')),
  require_approval  boolean not null default false,
  created_by        uuid not null references public.profiles (id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index families_created_by_idx on public.families (created_by);

create trigger families_set_updated_at
  before update on public.families
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- family_members
-- ----------------------------------------------------------------------------
create table public.family_members (
  family_id   uuid not null references public.families (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        text not null default 'member'
                check (role in ('owner', 'admin', 'moderator', 'member')),
  status      text not null default 'active'
                check (status in ('active', 'pending')),
  invited_by  uuid references public.profiles (id),
  joined_at   timestamptz not null default now(),
  primary key (family_id, user_id)
);

create index family_members_user_idx on public.family_members (user_id);
create index family_members_family_status_idx on public.family_members (family_id, status);

-- ----------------------------------------------------------------------------
-- family_invitations
-- ----------------------------------------------------------------------------
create table public.family_invitations (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families (id) on delete cascade,
  code        text not null unique
                check (code ~ '^[A-Z0-9]{8,12}$'),
  created_by  uuid not null references public.profiles (id),
  role        text not null default 'member'
                check (role in ('admin', 'moderator', 'member')),
  expires_at  timestamptz,
  revoked_at  timestamptz,
  max_uses    integer check (max_uses is null or max_uses > 0),
  used_count  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index family_invitations_family_idx on public.family_invitations (family_id);

-- ----------------------------------------------------------------------------
-- posts & social graph
-- ----------------------------------------------------------------------------
create table public.posts (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references public.families (id) on delete cascade,
  author_id       uuid not null references public.profiles (id) on delete cascade,
  content         text check (content is null or char_length(content) <= 5000),
  moment_type     text not null default 'regular'
                    check (moment_type in ('regular', 'birthday', 'wedding', 'trip',
                                           'throwback', 'achievement', 'announcement')),
  visibility      text not null default 'family'
                    check (visibility in ('family', 'admins')),
  is_pinned       boolean not null default false,
  shared_post_id  uuid references public.posts (id) on delete set null,
  edited_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index posts_family_created_idx on public.posts (family_id, created_at desc);
create index posts_author_idx on public.posts (author_id);
create index posts_pinned_idx on public.posts (family_id, is_pinned desc, created_at desc)
  where (is_pinned = true);

create trigger posts_set_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

create table public.post_media (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts (id) on delete cascade,
  storage_path text not null,
  media_type  text not null check (media_type in ('image', 'video', 'audio')),
  mime_type   text not null,
  size_bytes  bigint not null default 0,
  width       integer,
  height      integer,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

create index post_media_post_idx on public.post_media (post_id, position);

create table public.post_reactions (
  post_id     uuid not null references public.posts (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  reaction    text not null default 'like'
                check (reaction in ('like', 'love', 'haha', 'wow', 'sad', 'angry')),
  created_at  timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index post_reactions_user_idx on public.post_reactions (user_id);

create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts (id) on delete cascade,
  author_id   uuid not null references public.profiles (id) on delete cascade,
  parent_id   uuid references public.comments (id) on delete cascade,
  content     text not null check (char_length(content) between 1 and 2000),
  edited_at   timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index comments_post_idx on public.comments (post_id, created_at);
create index comments_parent_idx on public.comments (parent_id);
create index comments_author_idx on public.comments (author_id);

create trigger comments_set_updated_at
  before update on public.comments
  for each row execute function public.set_updated_at();

create table public.post_bookmarks (
  post_id     uuid not null references public.posts (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index post_bookmarks_user_idx on public.post_bookmarks (user_id);

-- ----------------------------------------------------------------------------
-- conversations & messages
-- ----------------------------------------------------------------------------
create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references public.families (id) on delete cascade,
  type            text not null default 'direct'
                    check (type in ('direct', 'group')),
  title           text check (title is null or char_length(title) between 1 and 60),
  created_by      uuid not null references public.profiles (id),
  last_message_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint conversations_group_title_check check (type <> 'group' or title is not null)
);

create index conversations_family_idx on public.conversations (family_id, last_message_at desc);

create trigger conversations_set_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

create table public.conversation_members (
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  role             text not null default 'member'
                     check (role in ('owner', 'member')),
  last_read_at     timestamptz not null default now(),
  muted            boolean not null default false,
  joined_at        timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index conversation_members_user_idx on public.conversation_members (user_id);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references public.profiles (id) on delete cascade,
  reply_to_id     uuid references public.messages (id) on delete set null,
  content         text check (content is null or char_length(content) <= 4000),
  message_type    text not null default 'text'
                    check (message_type in ('text', 'image', 'voice', 'system')),
  edited_at       timestamptz,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now()
);

create index messages_conversation_created_idx
  on public.messages (conversation_id, created_at desc);
create index messages_sender_idx on public.messages (sender_id);

create table public.message_attachments (
  id           uuid primary key default gen_random_uuid(),
  message_id   uuid not null references public.messages (id) on delete cascade,
  storage_path text not null,
  media_type   text not null check (media_type in ('image', 'voice', 'file')),
  mime_type    text not null,
  size_bytes   bigint not null default 0,
  duration_ms  integer,
  created_at   timestamptz not null default now()
);

create index message_attachments_message_idx on public.message_attachments (message_id);

-- ----------------------------------------------------------------------------
-- notifications
-- ----------------------------------------------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  family_id   uuid references public.families (id) on delete cascade,
  actor_id    uuid references public.profiles (id) on delete set null,
  type        text not null
                check (type in ('comment', 'reaction', 'invite', 'announcement',
                                'member_joined', 'member_pending', 'event',
                                'call', 'game', 'message')),
  entity_type text,
  entity_id   uuid,
  title       text not null,
  body        text,
  link        text,
  dedupe_key  text unique,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx
  on public.notifications (user_id) where (read_at is null);
-- ============================================================================
-- Our Cousin Family â€” Authorization helpers, RPCs, RLS policies
--
-- Security model:
--   * Every table has RLS enabled. Client-submitted ids are never trusted.
--   * Membership/role checks live in SECURITY DEFINER helpers (owner: postgres),
--     which avoids policy recursion and centralizes authorization.
--   * Mutations that need cross-row consistency (create/join family, invite,
--     conversation creation, approvals) go through SECURITY DEFINER RPCs.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Authorization helpers (stable, security definer)
-- ----------------------------------------------------------------------------
create or replace function public.is_family_member(p_family_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.family_members
     where family_id = p_family_id
       and user_id = p_user_id
       and status = 'active'
  );
$$;

-- Any membership row (active OR pending) â€” used for "awaiting approval" views.
create or replace function public.has_family_row(p_family_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.family_members
     where family_id = p_family_id
       and user_id = p_user_id
  );
$$;

create or replace function public.family_role(p_family_id uuid, p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role
    from public.family_members
   where family_id = p_family_id
     and user_id = p_user_id
     and status = 'active';
$$;

-- True when both users share an active family (used for profile visibility).
create or replace function public.shares_family_with(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.family_members m1
      join public.family_members m2 on m2.family_id = m1.family_id
     where m1.user_id = p_a
       and m2.user_id = p_b
       and m1.status = 'active'
       and m2.status = 'active'
  );
$$;

create or replace function public.is_conversation_member(p_conversation_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.conversation_members
     where conversation_id = p_conversation_id
       and user_id = p_user_id
  );
$$;

create or replace function public.conversation_role(p_conversation_id uuid, p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role
    from public.conversation_members
   where conversation_id = p_conversation_id
     and user_id = p_user_id;
$$;

-- Storage path guards (validate uuid text before casting inside policies).
create or replace function public.is_family_storage_path(p_family_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when p_family_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.is_family_member(p_family_id::uuid, auth.uid())
    else false
  end;
$$;

create or replace function public.is_conversation_storage_path(p_conversation_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when p_conversation_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.is_conversation_member(p_conversation_id::uuid, auth.uid())
    else false
  end;
$$;

create or replace function public.can_read_avatar_path(p_path text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when (string_to_array(p_path, '/'))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (
        auth.uid() = ((string_to_array(p_path, '/'))[1])::uuid
        or public.shares_family_with(auth.uid(), ((string_to_array(p_path, '/'))[1])::uuid)
      )
    else false
  end;
$$;

-- ----------------------------------------------------------------------------
-- Invite code generation
-- ----------------------------------------------------------------------------
create or replace function public.generate_invite_code()
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_code text := '';
  i integer;
begin
  v_bytes := extensions.gen_random_bytes(10);
  for i in 0..9 loop
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;
  return v_code;
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC: create family (caller becomes owner; returns invite code)
-- ----------------------------------------------------------------------------
create or replace function public.create_family(
  p_name text,
  p_description text default null,
  p_rules text default null,
  p_privacy text default 'invite_only',
  p_require_approval boolean default false,
  p_avatar_url text default null,
  p_cover_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_family_id uuid;
  v_code text;
  v_attempts integer := 0;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_name is null or char_length(trim(p_name)) < 2 or char_length(trim(p_name)) > 60 then
    raise exception 'invalid_family_name';
  end if;

  insert into public.families (name, description, rules, privacy, require_approval, avatar_url, cover_url, created_by)
  values (trim(p_name), p_description, p_rules, p_privacy, p_require_approval, p_avatar_url, p_cover_url, v_uid)
  returning id into v_family_id;

  insert into public.family_members (family_id, user_id, role, status)
  values (v_family_id, v_uid, 'owner', 'active');

  loop
    v_code := public.generate_invite_code();
    begin
      insert into public.family_invitations (family_id, code, created_by)
      values (v_family_id, v_code, v_uid);
      exit;
    exception when unique_violation then
      v_attempts := v_attempts + 1;
      if v_attempts >= 5 then raise; end if;
    end;
  end loop;

  return jsonb_build_object('family_id', v_family_id, 'invite_code', v_code);
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC: preview an invitation (safe to call before joining)
-- ----------------------------------------------------------------------------
create or replace function public.preview_invitation(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid(); -- may be null: preview works before sign-in
  v_inv public.family_invitations%rowtype;
  v_family public.families%rowtype;
  v_status text;
begin
  select * into v_inv
    from public.family_invitations
   where code = upper(trim(p_code));

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v_inv.revoked_at is not null then
    return jsonb_build_object('status', 'revoked');
  end if;
  if v_inv.expires_at is not null and v_inv.expires_at < now() then
    return jsonb_build_object('status', 'expired');
  end if;
  if v_inv.max_uses is not null and v_inv.used_count >= v_inv.max_uses then
    return jsonb_build_object('status', 'exhausted');
  end if;

  select * into v_family from public.families where id = v_inv.family_id;

  select case
           when m.status = 'active' then 'already_member'
           when m.status = 'pending' then 'pending'
           else 'joinable'
         end
    into v_status
    from public.families f
    left join public.family_members m on m.family_id = f.id and m.user_id = v_uid
   where f.id = v_inv.family_id;

  return jsonb_build_object(
    'status', coalesce(v_status, 'joinable'),
    'family_id', v_family.id,
    'family_name', v_family.name,
    'description', v_family.description,
    'avatar_url', v_family.avatar_url,
    'cover_url', v_family.cover_url,
    'require_approval', v_family.require_approval
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC: join a family with an invite code
-- ----------------------------------------------------------------------------
create or replace function public.join_family_by_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.family_invitations%rowtype;
  v_existing public.family_members%rowtype;
  v_status text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_inv
    from public.family_invitations
   where code = upper(trim(p_code))
   for update;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v_inv.revoked_at is not null then
    return jsonb_build_object('status', 'revoked');
  end if;
  if v_inv.expires_at is not null and v_inv.expires_at < now() then
    return jsonb_build_object('status', 'expired');
  end if;
  if v_inv.max_uses is not null and v_inv.used_count >= v_inv.max_uses then
    return jsonb_build_object('status', 'exhausted');
  end if;

  select * into v_existing
    from public.family_members
   where family_id = v_inv.family_id
     and user_id = v_uid;

  if found then
    return jsonb_build_object(
      'status', case when v_existing.status = 'active' then 'already_member' else 'pending' end,
      'family_id', v_inv.family_id
    );
  end if;

  select case when require_approval then 'pending' else 'active' end
    into v_status
    from public.families
   where id = v_inv.family_id;

  insert into public.family_members (family_id, user_id, role, status, invited_by)
  values (v_inv.family_id, v_uid,
          case when v_status = 'pending' then 'member' else v_inv.role end,
          v_status, v_inv.created_by);

  update public.family_invitations
     set used_count = used_count + 1
   where id = v_inv.id;

  -- Notify admins when approval is required; notify inviter on direct join.
  if v_status = 'pending' then
    insert into public.notifications (user_id, family_id, actor_id, type, entity_type, entity_id, title, body, link, dedupe_key)
    select fm.user_id, v_inv.family_id, v_uid, 'member_pending', 'family', v_inv.family_id,
           'New member waiting for approval',
           coalesce((select full_name from public.profiles where id = v_uid), 'Someone') || ' requested to join the family.',
           '/family/members?filter=pending',
           'member_pending:' || v_inv.family_id::text || ':' || v_uid::text
      from public.family_members fm
     where fm.family_id = v_inv.family_id
       and fm.status = 'active'
       and fm.role in ('owner', 'admin', 'moderator')
       and fm.user_id <> v_uid
    on conflict (dedupe_key) do nothing;
  else
    insert into public.notifications (user_id, family_id, actor_id, type, entity_type, entity_id, title, body, link, dedupe_key)
    values (v_inv.created_by, v_inv.family_id, v_uid, 'member_joined', 'family', v_inv.family_id,
            'Someone joined your family',
            coalesce((select full_name from public.profiles where id = v_uid), 'A relative') || ' accepted your invitation.',
            '/family/members',
            'member_joined:' || v_inv.family_id::text || ':' || v_uid::text)
    on conflict (dedupe_key) do nothing;
  end if;

  return jsonb_build_object('status', v_status, 'family_id', v_inv.family_id);
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC: create / revoke invitations (admins only)
-- ----------------------------------------------------------------------------
create or replace function public.create_invitation(
  p_family_id uuid,
  p_role text default 'member',
  p_expires_at timestamptz default null,
  p_max_uses integer default null
)
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_attempts integer := 0;
begin
  if public.family_role(p_family_id, v_uid) not in ('owner', 'admin') then
    raise exception 'not_authorized';
  end if;
  if p_role not in ('admin', 'moderator', 'member') then
    raise exception 'invalid_role';
  end if;

  loop
    v_code := public.generate_invite_code();
    begin
      insert into public.family_invitations (family_id, code, created_by, role, expires_at, max_uses)
      values (p_family_id, v_code, v_uid, p_role, p_expires_at, p_max_uses);
      return v_code;
    exception when unique_violation then
      v_attempts := v_attempts + 1;
      if v_attempts >= 5 then raise; end if;
    end;
  end loop;
end;
$$;

create or replace function public.revoke_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_family_id uuid;
begin
  select family_id into v_family_id
    from public.family_invitations
   where id = p_invitation_id;

  if v_family_id is null then
    return;
  end if;
  if public.family_role(v_family_id, auth.uid()) not in ('owner', 'admin') then
    raise exception 'not_authorized';
  end if;

  update public.family_invitations
     set revoked_at = now()
   where id = p_invitation_id
     and revoked_at is null;
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC: member management (approve / decline / remove / role change / leave)
-- ----------------------------------------------------------------------------
create or replace function public.set_member_status(
  p_family_id uuid,
  p_user_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_actor_role text := public.family_role(p_family_id, v_uid);
  v_target_role text;
begin
  if v_actor_role is null or v_actor_role not in ('owner', 'admin', 'moderator') then
    raise exception 'not_authorized';
  end if;
  if p_status not in ('active', 'pending') then
    raise exception 'invalid_status';
  end if;

  select role into v_target_role
    from public.family_members
   where family_id = p_family_id and user_id = p_user_id;

  if v_target_role is null then
    raise exception 'not_a_member';
  end if;
  if v_target_role = 'owner' and v_actor_role <> 'owner' then
    raise exception 'not_authorized';
  end if;

  update public.family_members
     set status = p_status
   where family_id = p_family_id
     and user_id = p_user_id;

  if p_status = 'active' then
    insert into public.notifications (user_id, family_id, actor_id, type, entity_type, entity_id, title, link, dedupe_key)
    values (p_user_id, p_family_id, v_uid, 'member_joined', 'family', p_family_id,
            'You are approved!', '/home',
            'approved:' || p_family_id::text || ':' || p_user_id::text)
    on conflict (dedupe_key) do nothing;
  end if;
end;
$$;

create or replace function public.remove_member(p_family_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_actor_role text := public.family_role(p_family_id, v_uid);
  v_target_role text;
  v_owner_count integer;
begin
  if v_uid = p_user_id then
    -- Leaving voluntarily (owner protected if last owner).
    v_actor_role := public.family_role(p_family_id, v_uid);
    if v_actor_role is null then return; end if;
  elsif v_actor_role not in ('owner', 'admin') then
    raise exception 'not_authorized';
  end if;

  select role into v_target_role
    from public.family_members
   where family_id = p_family_id and user_id = p_user_id;

  if v_target_role is null then return; end if;

  if v_target_role = 'owner' then
    select count(*) into v_owner_count
      from public.family_members
     where family_id = p_family_id and role = 'owner' and status = 'active';
    if v_owner_count <= 1 then
      raise exception 'last_owner';
    end if;
    if v_uid <> p_user_id and v_actor_role <> 'owner' then
      raise exception 'not_authorized';
    end if;
  end if;

  delete from public.family_members
   where family_id = p_family_id and user_id = p_user_id;
end;
$$;

create or replace function public.set_member_role(p_family_id uuid, p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_actor_role text := public.family_role(p_family_id, v_uid);
  v_owner_count integer;
begin
  if v_actor_role <> 'owner' then
    raise exception 'not_authorized';
  end if;
  if p_role not in ('owner', 'admin', 'moderator', 'member') then
    raise exception 'invalid_role';
  end if;
  if not public.is_family_member(p_family_id, p_user_id) then
    raise exception 'not_a_member';
  end if;

  if p_role <> 'owner' then
    select count(*) into v_owner_count
      from public.family_members
     where family_id = p_family_id and role = 'owner' and status = 'active';
    if v_owner_count <= 1 and p_user_id = v_uid then
      raise exception 'last_owner';
    end if;
  end if;

  update public.family_members
     set role = p_role
   where family_id = p_family_id and user_id = p_user_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC: conversations
-- ----------------------------------------------------------------------------
create or replace function public.create_direct_conversation(p_family_id uuid, p_other_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_existing uuid;
  v_conv uuid;
begin
  if not public.is_family_member(p_family_id, v_uid) then
    raise exception 'not_authorized';
  end if;
  if not public.is_family_member(p_family_id, p_other_user) then
    raise exception 'not_authorized';
  end if;
  if p_other_user = v_uid then
    raise exception 'invalid_target';
  end if;

  select c.id into v_existing
    from public.conversations c
    where c.family_id = p_family_id
      and c.type = 'direct'
      and exists (select 1 from public.conversation_members m
                   where m.conversation_id = c.id and m.user_id = v_uid)
      and exists (select 1 from public.conversation_members m
                   where m.conversation_id = c.id and m.user_id = p_other_user)
    limit 1;

  if v_existing is not null then
    return jsonb_build_object('conversation_id', v_existing, 'created', false);
  end if;

  insert into public.conversations (family_id, type, created_by)
  values (p_family_id, 'direct', v_uid)
  returning id into v_conv;

  insert into public.conversation_members (conversation_id, user_id, role)
  values (v_conv, v_uid, 'owner'), (v_conv, p_other_user, 'member');

  return jsonb_build_object('conversation_id', v_conv, 'created', true);
end;
$$;

create or replace function public.create_group_conversation(
  p_family_id uuid,
  p_title text,
  p_member_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_conv uuid;
  v_member uuid;
  v_members uuid[] := '{}';
begin
  if not public.is_family_member(p_family_id, v_uid) then
    raise exception 'not_authorized';
  end if;
  if p_title is null or char_length(trim(p_title)) < 1 or char_length(trim(p_title)) > 60 then
    raise exception 'invalid_title';
  end if;

  -- Only active family members may be added.
  foreach v_member in array p_member_ids loop
    if v_member <> v_uid and public.is_family_member(p_family_id, v_member) then
      v_members := array_append(v_members, v_member);
    end if;
  end loop;
  if array_length(v_members, 1) is null then
    raise exception 'no_members';
  end if;

  insert into public.conversations (family_id, type, title, created_by)
  values (p_family_id, 'group', trim(p_title), v_uid)
  returning id into v_conv;

  insert into public.conversation_members (conversation_id, user_id, role)
  values (v_conv, v_uid, 'owner');

  insert into public.conversation_members (conversation_id, user_id, role)
  select v_conv, unnest(v_members), 'member'
  on conflict do nothing;

  return jsonb_build_object('conversation_id', v_conv, 'created', true);
end;
$$;

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.conversation_members
     set last_read_at = now()
   where conversation_id = p_conversation_id
     and user_id = auth.uid();
$$;

-- ----------------------------------------------------------------------------
-- RPC: presence heartbeat (client throttled)
-- ----------------------------------------------------------------------------
create or replace function public.touch_last_seen()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.profiles
     set last_seen_at = now()
   where id = auth.uid();
$$;

-- ----------------------------------------------------------------------------
-- Notification helpers (triggers)
-- ----------------------------------------------------------------------------
create or replace function public.notify_comment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_post_author uuid;
  v_family_id uuid;
  v_parent_author uuid;
begin
  select author_id, family_id into v_post_author, v_family_id
    from public.posts where id = new.post_id;

  select author_id into v_parent_author
    from public.comments where id = new.parent_id;

  -- Reply: notify the parent comment author (fallback: post author).
  if new.parent_id is not null and v_parent_author is not null and v_parent_author <> new.author_id then
    insert into public.notifications (user_id, family_id, actor_id, type, entity_type, entity_id, title, link, dedupe_key)
    values (v_parent_author, v_family_id, new.author_id, 'comment', 'comment', new.id,
            'Someone replied to your comment',
            coalesce((select full_name from public.profiles where id = new.author_id), 'A relative')
              || ': ' || left(new.content, 80),
            '/home?post=' || new.post_id::text,
            'comment:' || new.id::text || ':' || v_parent_author::text)
    on conflict (dedupe_key) do nothing;
  elsif v_post_author is not null and v_post_author <> new.author_id then
    insert into public.notifications (user_id, family_id, actor_id, type, entity_type, entity_id, title, body, link, dedupe_key)
    values (v_post_author, v_family_id, new.author_id, 'comment', 'comment', new.id,
            'New comment on your post',
            coalesce((select full_name from public.profiles where id = new.author_id), 'A relative')
              || ': ' || left(new.content, 80),
            '/home?post=' || new.post_id::text,
            'comment:' || new.id::text || ':' || v_post_author::text)
    on conflict (dedupe_key) do nothing;
  end if;
  return new;
end;
$$;

create trigger comments_notify
  after insert on public.comments
  for each row execute function public.notify_comment();

create or replace function public.notify_reaction()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_post_author uuid;
  v_family_id uuid;
begin
  select author_id, family_id into v_post_author, v_family_id
    from public.posts where id = new.post_id;

  if v_post_author is null or v_post_author = new.user_id then
    return new;
  end if;

  insert into public.notifications (user_id, family_id, actor_id, type, entity_type, entity_id, title, link, dedupe_key)
  values (v_post_author, v_family_id, new.user_id, 'reaction', 'post', new.post_id,
          coalesce((select full_name from public.profiles where id = new.user_id), 'A relative')
            || ' reacted to your post (' || new.reaction || ')',
          '/home?post=' || new.post_id::text,
          'reaction:' || new.post_id::text || ':' || new.user_id::text)
  on conflict (dedupe_key) do nothing;
  return new;
end;
$$;

create trigger post_reactions_notify
  after insert on public.post_reactions
  for each row execute function public.notify_reaction();

-- Direct-message notification: only 1:1 conversations end up in the bell
-- (group chat relies on unread badges to avoid notification spam).
create or replace function public.notify_direct_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.notifications (user_id, family_id, actor_id, type, entity_type, entity_id, title, body, link, dedupe_key)
  select cm.user_id, c.family_id, new.sender_id, 'message', 'conversation', c.id,
         coalesce((select full_name from public.profiles where id = new.sender_id), 'A relative'),
         left(coalesce(new.content, 'Sent an attachment'), 120),
         '/chat/' || c.id::text,
         'message:' || new.id::text || ':' || cm.user_id::text
    from public.conversations c
    join public.conversation_members cm on cm.conversation_id = c.id
   where c.id = new.conversation_id
     and c.type = 'direct'
     and cm.user_id <> new.sender_id
     and cm.muted = false
     and cm.last_read_at < new.created_at - interval '1 minute'
  on conflict (dedupe_key) do nothing;
  return new;
end;
$$;

create trigger messages_notify_direct
  after insert on public.messages
  for each row execute function public.notify_direct_message();

-- ----------------------------------------------------------------------------
-- Enable Row Level Security on every table
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.family_invitations enable row level security;
alter table public.posts enable row level security;
alter table public.post_media enable row level security;
alter table public.post_reactions enable row level security;
alter table public.comments enable row level security;
alter table public.post_bookmarks enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_attachments enable row level security;
alter table public.notifications enable row level security;

-- ----------------------------------------------------------------------------
-- profiles policies
-- ----------------------------------------------------------------------------
create policy "profiles_select_visible"
  on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or public.shares_family_with(auth.uid(), id)
  );

create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ----------------------------------------------------------------------------
-- families policies
-- ----------------------------------------------------------------------------
create policy "families_select_member"
  on public.families for select to authenticated
  using (public.has_family_row(id, auth.uid()));

create policy "families_update_admins"
  on public.families for update to authenticated
  using (public.family_role(id, auth.uid()) in ('owner', 'admin'))
  with check (public.family_role(id, auth.uid()) in ('owner', 'admin'));

create policy "families_delete_owner"
  on public.families for delete to authenticated
  using (public.family_role(id, auth.uid()) = 'owner');

-- ----------------------------------------------------------------------------
-- family_members policies (writes go through SECURITY DEFINER RPCs)
-- ----------------------------------------------------------------------------
create policy "family_members_select"
  on public.family_members for select to authenticated
  using (user_id = auth.uid() or public.has_family_row(family_id, auth.uid()));

-- ----------------------------------------------------------------------------
-- family_invitations policies
-- ----------------------------------------------------------------------------
create policy "family_invitations_select_admins"
  on public.family_invitations for select to authenticated
  using (public.family_role(family_id, auth.uid()) in ('owner', 'admin'));

create policy "family_invitations_delete_admins"
  on public.family_invitations for delete to authenticated
  using (public.family_role(family_id, auth.uid()) in ('owner', 'admin'));

-- ----------------------------------------------------------------------------
-- posts policies
-- ----------------------------------------------------------------------------
create policy "posts_select_member"
  on public.posts for select to authenticated
  using (
    public.is_family_member(family_id, auth.uid())
    and (
      visibility = 'family'
      or public.family_role(family_id, auth.uid()) in ('owner', 'admin', 'moderator')
    )
  );

create policy "posts_insert_member"
  on public.posts for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.is_family_member(family_id, auth.uid())
    and (
      visibility = 'family'
      or public.family_role(family_id, auth.uid()) in ('owner', 'admin', 'moderator')
    )
  );

create policy "posts_update_author_or_mod"
  on public.posts for update to authenticated
  using (
    author_id = auth.uid()
    or public.family_role(family_id, auth.uid()) in ('owner', 'admin', 'moderator')
  )
  with check (
    author_id = auth.uid()
    or public.family_role(family_id, auth.uid()) in ('owner', 'admin', 'moderator')
  );

create policy "posts_delete_author_or_mod"
  on public.posts for delete to authenticated
  using (
    author_id = auth.uid()
    or public.family_role(family_id, auth.uid()) in ('owner', 'admin', 'moderator')
  );

-- ----------------------------------------------------------------------------
-- post_media policies
-- ----------------------------------------------------------------------------
create policy "post_media_select_member"
  on public.post_media for select to authenticated
  using (exists (
    select 1 from public.posts p where p.id = post_id
  ));

create policy "post_media_insert_author"
  on public.post_media for insert to authenticated
  with check (exists (
    select 1 from public.posts p
     where p.id = post_id and p.author_id = auth.uid()
  ));

create policy "post_media_update_author"
  on public.post_media for update to authenticated
  using (exists (
    select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()
  ));

create policy "post_media_delete_author"
  on public.post_media for delete to authenticated
  using (exists (
    select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()
  ));

-- ----------------------------------------------------------------------------
-- post_reactions policies
-- ----------------------------------------------------------------------------
create policy "post_reactions_select_member"
  on public.post_reactions for select to authenticated
  using (exists (
    select 1 from public.posts p where p.id = post_id
  ));

create policy "post_reactions_insert_own"
  on public.post_reactions for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.posts p where p.id = post_id)
  );

create policy "post_reactions_delete_own"
  on public.post_reactions for delete to authenticated
  using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- comments policies
-- ----------------------------------------------------------------------------
create policy "comments_select_member"
  on public.comments for select to authenticated
  using (exists (
    select 1 from public.posts p where p.id = post_id
  ));

-- Author must be able to read the post (posts RLS enforces family membership).
create policy "comments_insert_member"
  on public.comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (select 1 from public.posts p where p.id = post_id)
  );

create policy "comments_update_author_or_mod"
  on public.comments for update to authenticated
  using (author_id = auth.uid() or exists (
    select 1 from public.posts p
     where p.id = post_id
       and public.family_role(p.family_id, auth.uid()) in ('owner', 'admin', 'moderator')
  ))
  with check (author_id = auth.uid());

create policy "comments_delete_author_or_mod"
  on public.comments for delete to authenticated
  using (author_id = auth.uid() or exists (
    select 1 from public.posts p
     where p.id = post_id
       and public.family_role(p.family_id, auth.uid()) in ('owner', 'admin', 'moderator')
  ));

-- ----------------------------------------------------------------------------
-- post_bookmarks policies
-- ----------------------------------------------------------------------------
create policy "post_bookmarks_select_own"
  on public.post_bookmarks for select to authenticated
  using (user_id = auth.uid());

create policy "post_bookmarks_insert_own"
  on public.post_bookmarks for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.posts p where p.id = post_id)
  );

create policy "post_bookmarks_delete_own"
  on public.post_bookmarks for delete to authenticated
  using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- conversations policies
-- ----------------------------------------------------------------------------
create policy "conversations_select_member"
  on public.conversations for select to authenticated
  using (public.is_conversation_member(id, auth.uid()));

create policy "conversations_update_member"
  on public.conversations for update to authenticated
  using (public.is_conversation_member(id, auth.uid()))
  with check (public.is_conversation_member(id, auth.uid()));

create policy "conversations_delete_admin_or_creator"
  on public.conversations for delete to authenticated
  using (
    created_by = auth.uid()
    or public.family_role(family_id, auth.uid()) in ('owner', 'admin')
  );

-- ----------------------------------------------------------------------------
-- conversation_members policies
-- ----------------------------------------------------------------------------
create policy "conversation_members_select"
  on public.conversation_members for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_conversation_member(conversation_id, auth.uid())
  );

create policy "conversation_members_update_own"
  on public.conversation_members for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "conversation_members_delete_admin_or_self"
  on public.conversation_members for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.conversations c
       where c.id = conversation_id
         and public.family_role(c.family_id, auth.uid()) in ('owner', 'admin')
    )
  );

-- ----------------------------------------------------------------------------
-- messages policies
-- ----------------------------------------------------------------------------
create policy "messages_select_member"
  on public.messages for select to authenticated
  using (public.is_conversation_member(conversation_id, auth.uid()));

create policy "messages_insert_member"
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_conversation_member(conversation_id, auth.uid())
  );

create policy "messages_update_sender"
  on public.messages for update to authenticated
  using (sender_id = auth.uid() and deleted_at is null)
  with check (sender_id = auth.uid());

create policy "messages_delete_sender_or_family_admin"
  on public.messages for delete to authenticated
  using (
    sender_id = auth.uid()
    or exists (
      select 1 from public.conversations c
       where c.id = conversation_id
         and public.family_role(c.family_id, auth.uid()) in ('owner', 'admin')
    )
  );

-- Soft delete keeps the row; content is hidden by queries (app layer).

-- ----------------------------------------------------------------------------
-- message_attachments policies
-- ----------------------------------------------------------------------------
create policy "message_attachments_select_member"
  on public.message_attachments for select to authenticated
  using (exists (
    select 1 from public.messages m where m.id = message_id
  ));

create policy "message_attachments_insert_sender"
  on public.message_attachments for insert to authenticated
  with check (exists (
    select 1 from public.messages m
     where m.id = message_id and m.sender_id = auth.uid()
  ));

create policy "message_attachments_delete_sender"
  on public.message_attachments for delete to authenticated
  using (exists (
    select 1 from public.messages m
     where m.id = message_id and m.sender_id = auth.uid()
  ));

-- ----------------------------------------------------------------------------
-- notifications policies (insert happens only in server-side triggers/RPCs)
-- ----------------------------------------------------------------------------
create policy "notifications_select_own"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

create policy "notifications_update_own"
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "notifications_delete_own"
  on public.notifications for delete to authenticated
  using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Lock down function execution
--
-- Postgres grants EXECUTE on new functions to PUBLIC by default, and every
-- role (anon included) inherits PUBLIC's privileges. Revoking from `anon`
-- alone therefore leaves signed-out callers able to invoke mutating RPCs
-- through PostgREST, so PUBLIC must be revoked first and access re-granted
-- explicitly below. (Roles are also revoked for defence in depth.)
-- ----------------------------------------------------------------------------
revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;
revoke execute on all functions in schema public from authenticated;

-- Policy helpers must run for the querying role (RLS evaluates them as caller).
-- Trigger functions (set_updated_at, handle_new_user, notify_*) are deliberately
-- NOT granted: Postgres checks EXECUTE on trigger functions at CREATE TRIGGER
-- time, and they continue to fire as the function owner afterwards. Granting
-- them would only add unnecessary RPC surface.
grant execute on function
  public.is_family_member(uuid, uuid),
  public.has_family_row(uuid, uuid),
  public.family_role(uuid, uuid),
  public.shares_family_with(uuid, uuid),
  public.is_conversation_member(uuid, uuid),
  public.conversation_role(uuid, uuid),
  public.is_family_storage_path(text),
  public.is_conversation_storage_path(text),
  public.can_read_avatar_path(text)
to authenticated, anon;

-- Invitation preview is intentionally available before sign-in: possession of
-- the unguessable code is the capability, and it only reveals the family's
-- name/cover â€” never content. Everything else stays authenticated-only.
grant execute on function public.preview_invitation(text) to anon;

-- Mutating RPCs: authenticated callers only.
grant execute on function
  public.generate_invite_code(),
  public.create_family(text, text, text, text, boolean, text, text),
  public.preview_invitation(text),
  public.join_family_by_code(text),
  public.create_invitation(uuid, text, timestamptz, integer),
  public.revoke_invitation(uuid),
  public.set_member_status(uuid, uuid, text),
  public.remove_member(uuid, uuid),
  public.set_member_role(uuid, uuid, text),
  public.create_direct_conversation(uuid, uuid),
  public.create_group_conversation(uuid, text, uuid[]),
  public.mark_conversation_read(uuid),
  public.touch_last_seen()
to authenticated;
-- ============================================================================
-- Our Cousin Family â€” Storage buckets, storage RLS, realtime publication
--
-- Path conventions (enforced by storage policies â€” the FIRST folder is the id):
--   avatars:          {user_id}/{filename}
--   post-media:       {family_id}/{post_id}/{filename}
--   chat-attachments: {conversation_id}/{filename}
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Buckets (private â€” access is granted per-row by policies below)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', false, 5242880,
     array['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
  ('post-media', 'post-media', false, 104857600,
     array['image/png', 'image/jpeg', 'image/webp', 'image/gif',
           'video/mp4', 'video/quicktime', 'video/webm',
           'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/mp4']),
  ('chat-attachments', 'chat-attachments', false, 26214400,
     array['image/png', 'image/jpeg', 'image/webp', 'image/gif',
           'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/mp4',
           'application/pdf'])
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- avatars: owner writes; family members (and self) can read
-- ----------------------------------------------------------------------------
create policy "avatars_select_family"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and public.can_read_avatar_path(name));

create policy "avatars_insert_own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_update_own"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_delete_own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ----------------------------------------------------------------------------
-- post-media: active family members of the family folder may read/write
-- ----------------------------------------------------------------------------
create policy "post_media_storage_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'post-media' and public.is_family_storage_path((storage.foldername(name))[1]));

create policy "post_media_storage_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'post-media' and public.is_family_storage_path((storage.foldername(name))[1]));

create policy "post_media_storage_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'post-media' and public.is_family_storage_path((storage.foldername(name))[1]));

-- ----------------------------------------------------------------------------
-- chat-attachments: conversation members only
-- ----------------------------------------------------------------------------
create policy "chat_storage_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'chat-attachments' and public.is_conversation_storage_path((storage.foldername(name))[1]));

create policy "chat_storage_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-attachments' and public.is_conversation_storage_path((storage.foldername(name))[1]));

create policy "chat_storage_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'chat-attachments' and public.is_conversation_storage_path((storage.foldername(name))[1]));

-- ----------------------------------------------------------------------------
-- Realtime: broadcast changes for core tables (RLS is enforced per subscriber
-- with their own JWT, so members only receive their family's events).
-- ----------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.posts;
exception when duplicate_object then null; when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.comments;
exception when duplicate_object then null; when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.post_reactions;
exception when duplicate_object then null; when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.conversations;
exception when duplicate_object then null; when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.conversation_members;
exception when duplicate_object then null; when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.family_members;
exception when duplicate_object then null; when undefined_object then null;
end $$;
-- ============================================================================
-- Our Cousin Family â€” reporting helpers used by the app shell
-- ============================================================================

-- Per-conversation unread counts for the signed-in user. A single round trip
-- instead of one query per conversation.
create or replace function public.get_unread_counts()
returns table (conversation_id uuid, unread_count bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select cm.conversation_id,
         count(m.id) as unread_count
    from public.conversation_members cm
    left join public.messages m
      on m.conversation_id = cm.conversation_id
     and m.created_at > cm.last_read_at
     and m.sender_id <> cm.user_id
     and m.deleted_at is null
   where cm.user_id = auth.uid()
   group by cm.conversation_id;
$$;

revoke execute on function public.get_unread_counts() from public, anon;
grant execute on function public.get_unread_counts() to authenticated;

-- Keep conversations.last_message_at current so the chat list sorts correctly.
create or replace function public.bump_conversation_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.conversations
     set last_message_at = new.created_at,
         updated_at = now()
   where id = new.conversation_id;
  return new;
end;
$$;

create trigger conversations_bump_activity
  after insert on public.messages
  for each row execute function public.bump_conversation_activity();

-- Trigger functions are not RPCs: keep them off the API surface.
revoke execute on function public.bump_conversation_activity() from public, anon, authenticated;

-- One round trip for the chat list: conversation rows with last-message
-- preview + unread counts for the signed-in user.
create or replace function public.get_conversation_summaries()
returns table (
  conversation_id  uuid,
  family_id       uuid,
  type            text,
  title           text,
  last_message_at timestamptz,
  last_message_content text,
  last_message_type    text,
  unread_count    bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    c.id as conversation_id,
    c.family_id,
    c.type,
    c.title,
    c.last_message_at,
    lm.content as last_message_content,
    lm.message_type as last_message_type,
    coalesce(uc.unread_count, 0) as unread_count
  from public.conversation_members cm
  join public.conversations c on c.id = cm.conversation_id
  left join public.get_unread_counts() uc on uc.conversation_id = c.id
  left join lateral (
    select m.content, m.message_type
      from public.messages m
     where m.conversation_id = c.id
       and m.deleted_at is null
     order by m.created_at desc
     limit 1
  ) lm on true
  where cm.user_id = auth.uid()
  order by c.last_message_at desc nulls last;
$$;

revoke execute on function public.get_conversation_summaries() from public, anon;
grant execute on function public.get_conversation_summaries() to authenticated;
-- ============================================================================
-- Our Cousin Family â€” Family calendar
--
-- Per-family events with RSVPs. Members create events, everyone in the family
-- can see them, and creating one notifies the rest of the family.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- family_events
-- ----------------------------------------------------------------------------
create table public.family_events (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references public.families (id) on delete cascade,
  created_by   uuid not null references public.profiles (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 120),
  description  text check (description is null or char_length(description) <= 2000),
  location     text check (location is null or char_length(location) <= 200),
  starts_at    timestamptz not null,
  ends_at      timestamptz,
  all_day      boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- An event may be open-ended, but must never end before it begins.
  constraint family_events_range check (ends_at is null or ends_at >= starts_at)
);

create index family_events_family_starts_idx
  on public.family_events (family_id, starts_at);

create trigger family_events_set_updated_at
  before update on public.family_events
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- event_rsvps
--
-- One response per member per event. `note` lets people say "bringing the
-- kids" without needing a comment thread.
-- ----------------------------------------------------------------------------
create table public.event_rsvps (
  event_id    uuid not null references public.family_events (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  response    text not null check (response in ('going', 'maybe', 'declined')),
  note        text check (note is null or char_length(note) <= 200),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index event_rsvps_user_idx on public.event_rsvps (user_id);

create trigger event_rsvps_set_updated_at
  before update on public.event_rsvps
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Authorization helper: the family an event belongs to
--
-- RLS on event_rsvps needs the event's family to check membership, and a
-- security definer helper keeps the policy readable (and lets the planner use
-- the primary key on family_events).
-- ----------------------------------------------------------------------------
create or replace function public.event_family_id(p_event_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select family_id from public.family_events where id = p_event_id;
$$;

-- RLS policies are evaluated as the querying role, so `authenticated` needs
-- EXECUTE here â€” but nothing else does, and this migration runs after the
-- "revoke from public" pass, so the default PUBLIC grant is removed explicitly.
revoke execute on function public.event_family_id(uuid) from public, anon;
grant execute on function public.event_family_id(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.family_events enable row level security;
alter table public.event_rsvps enable row level security;

-- Events are readable by every active member of the family.
create policy "family_events_select_member"
  on public.family_events for select to authenticated
  using (public.is_family_member(family_id, auth.uid()));

-- Any active member may add an event, attributed to themselves.
create policy "family_events_insert_member"
  on public.family_events for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.is_family_member(family_id, auth.uid())
  );

-- The author may edit their own event; owners and admins may edit any event in
-- the family (e.g. to fix the time of something the family organises together).
create policy "family_events_update_author_or_admin"
  on public.family_events for update to authenticated
  using (
    public.is_family_member(family_id, auth.uid())
    and (
      created_by = auth.uid()
      or public.family_role(family_id, auth.uid()) in ('owner', 'admin')
    )
  )
  with check (
    public.is_family_member(family_id, auth.uid())
    and (
      created_by = auth.uid()
      or public.family_role(family_id, auth.uid()) in ('owner', 'admin')
    )
  );

create policy "family_events_delete_author_or_admin"
  on public.family_events for delete to authenticated
  using (
    public.is_family_member(family_id, auth.uid())
    and (
      created_by = auth.uid()
      or public.family_role(family_id, auth.uid()) in ('owner', 'admin')
    )
  );

-- RSVPs are readable by the whole family (an RSVP list is a social object).
create policy "event_rsvps_select_member"
  on public.event_rsvps for select to authenticated
  using (public.is_family_member(public.event_family_id(event_id), auth.uid()));

-- Members may only answer for themselves.
create policy "event_rsvps_insert_self"
  on public.event_rsvps for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_family_member(public.event_family_id(event_id), auth.uid())
  );

create policy "event_rsvps_update_self"
  on public.event_rsvps for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and public.is_family_member(public.event_family_id(event_id), auth.uid())
  );

create policy "event_rsvps_delete_self"
  on public.event_rsvps for delete to authenticated
  using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Notify the family when an event is added
-- ----------------------------------------------------------------------------
create or replace function public.notify_event_created()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_author text;
begin
  select full_name into v_author from public.profiles where id = new.created_by;

  insert into public.notifications
    (user_id, family_id, actor_id, type, entity_type, entity_id, title, link, dedupe_key)
  select m.user_id,
         new.family_id,
         new.created_by,
         'event',
         'event',
         new.id,
         'New event: ' || left(new.title, 90),
         '/calendar?event=' || new.id::text,
         'event:' || new.id::text || ':' || m.user_id::text
    from public.family_members m
   where m.family_id = new.family_id
     and m.status = 'active'
     and m.user_id <> new.created_by
  on conflict (dedupe_key) do nothing;

  return new;
end;
$$;

create trigger family_events_notify
  after insert on public.family_events
  for each row execute function public.notify_event_created();

-- Let the organiser know people are coming. Only a *positive* response
-- notifies, and withdrawing (or changing to "maybe") removes the notification
-- again â€” otherwise the organiser keeps seeing "is going" for a declined RSVP.
create or replace function public.notify_event_rsvp()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event   public.family_events%rowtype;
  v_name    text;
  v_key     text := 'event_rsvp:' || new.event_id::text || ':' || new.user_id::text;
begin
  if new.response <> 'going' then
    delete from public.notifications where dedupe_key = v_key;
    return new;
  end if;

  select * into v_event from public.family_events where id = new.event_id;
  if v_event.id is null or v_event.created_by = new.user_id then
    return new;
  end if;

  select full_name into v_name from public.profiles where id = new.user_id;

  insert into public.notifications
    (user_id, family_id, actor_id, type, entity_type, entity_id, title, link, dedupe_key)
  values (
    v_event.created_by,
    v_event.family_id,
    new.user_id,
    'event',
    'event',
    v_event.id,
    coalesce(v_name, 'A relative') || ' is going to ' || left(v_event.title, 80),
    '/calendar?event=' || v_event.id::text,
    v_key
  )
  on conflict (dedupe_key) do nothing;

  return new;
end;
$$;

create trigger event_rsvps_notify
  after insert or update on public.event_rsvps
  for each row execute function public.notify_event_rsvp();

-- No dangling notifications: deleting an event (which cascades its RSVPs) or
-- withdrawing a single RSVP clears the notifications that pointed at them.
create or replace function public.notify_event_removed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.notifications
   where entity_type = 'event' and entity_id = old.id;
  return old;
end;
$$;

create trigger family_events_cleanup_notifications
  after delete on public.family_events
  for each row execute function public.notify_event_removed();

create or replace function public.notify_rsvp_removed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.notifications
   where dedupe_key = 'event_rsvp:' || old.event_id::text || ':' || old.user_id::text;
  return old;
end;
$$;

create trigger event_rsvps_cleanup_notifications
  after delete on public.event_rsvps
  for each row execute function public.notify_rsvp_removed();

-- Trigger functions are not RPCs: keep them off the API surface (they only
-- fire as the table owner when a row is written).
revoke execute on function public.notify_event_created() from public, anon, authenticated;
revoke execute on function public.notify_event_rsvp() from public, anon, authenticated;
revoke execute on function public.notify_event_removed() from public, anon, authenticated;
revoke execute on function public.notify_rsvp_removed() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Realtime: the calendar updates live for everyone in the family
-- ----------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.family_events;
exception when duplicate_object then null; when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.event_rsvps;
exception when duplicate_object then null; when undefined_object then null;
end $$;
-- ============================================================================
-- Our Cousin Family â€” Family Ludo engine (docs/ludo-rules.md is the contract)
--
-- Server-authoritative Ludo for 4, 6 or 8 seats:
--   * every dice roll and position change is computed here, in Postgres;
--   * the browser sends intents only (`roll`, `move`, `pass`) â€” never outcomes;
--   * state lives in `ludo_games.state` (jsonb) under a row lock, with an
--     append-only `ludo_actions` audit trail for replay and disputes;
--   * clients are read-only renderers fed by Realtime.
--
-- Position encoding (relative to each seat, rules Â§3.2):
--   -1                       yard
--   0 .. ring_length - 1    ring (absolute = seat*arm + progress mod ring)
--   ring .. ring + 4        home column
--   ring + 5                home (retired)  = "steps to finish"
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------
create table public.ludo_games (
  id                uuid primary key default gen_random_uuid(),
  family_id         uuid not null references public.families (id) on delete cascade,
  created_by        uuid not null references public.profiles (id),
  board_seats       smallint not null check (board_seats in (4, 6, 8)),
  tokens_per_player smallint not null check (tokens_per_player between 1 and 4),
  status            text not null default 'waiting'
                      check (status in ('waiting', 'playing', 'finished', 'abandoned')),
  phase             text not null default 'awaiting_roll'
                      check (phase in ('awaiting_roll', 'awaiting_move')),
  turn_seat         smallint,
  turn_deadline     timestamptz,
  dice              smallint check (dice between 1 and 6),
  consecutive_sixes smallint not null default 0,
  version           integer not null default 1,
  state             jsonb not null default '{}'::jsonb,
  winner_seat       smallint,
  turn_seconds      smallint not null default 45 check (turn_seconds between 10 and 600),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index ludo_games_family_idx on public.ludo_games (family_id, created_at desc);
create index ludo_games_open_idx on public.ludo_games (family_id, status);

create trigger ludo_games_set_updated_at
  before update on public.ludo_games
  for each row execute function public.set_updated_at();

create table public.ludo_seats (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references public.ludo_games (id) on delete cascade,
  seat       smallint not null check (seat >= 0),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  color      text not null,
  autoplay   boolean not null default false,
  placement  smallint,
  joined_at  timestamptz not null default now(),
  unique (game_id, seat),
  unique (game_id, user_id)
);

create index ludo_seats_game_idx on public.ludo_seats (game_id, seat);
create index ludo_seats_user_idx on public.ludo_seats (user_id);

create table public.ludo_actions (
  id               uuid primary key default gen_random_uuid(),
  game_id          uuid not null references public.ludo_games (id) on delete cascade,
  seq              integer not null,
  seat             smallint,
  action           text not null
                     check (action in ('create', 'join', 'start', 'roll',
                                       'move', 'pass', 'finish')),
  dice             smallint,
  token_index      smallint,
  expected_version integer,
  result           jsonb,
  created_at       timestamptz not null default now(),
  unique (game_id, seq)
);

create index ludo_actions_game_seq_idx on public.ludo_actions (game_id, seq);

-- ----------------------------------------------------------------------------
-- Row Level Security
--
-- Only SELECT policies: a game is readable by every active member of its
-- family, but *nothing* may be written directly. All mutations go through the
-- security-definer functions below, which is what makes the engine
-- cheat-proof â€” a member cannot hand-craft a `state` claiming victory.
-- ----------------------------------------------------------------------------
alter table public.ludo_games enable row level security;
alter table public.ludo_seats enable row level security;
alter table public.ludo_actions enable row level security;

create or replace function public.ludo_game_family_id(p_game_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select family_id from public.ludo_games where id = p_game_id;
$$;

revoke execute on function public.ludo_game_family_id(uuid) from public, anon;
grant execute on function public.ludo_game_family_id(uuid) to authenticated;

create policy "ludo_games_select_member"
  on public.ludo_games for select to authenticated
  using (public.is_family_member(family_id, auth.uid()));

create policy "ludo_seats_select_member"
  on public.ludo_seats for select to authenticated
  using (public.is_family_member(public.ludo_game_family_id(game_id), auth.uid()));

create policy "ludo_actions_select_member"
  on public.ludo_actions for select to authenticated
  using (public.is_family_member(public.ludo_game_family_id(game_id), auth.uid()));

-- ----------------------------------------------------------------------------
-- Geometry (rules Â§3) â€” board dimensions are pure functions of the seat count
-- ----------------------------------------------------------------------------

create or replace function public.ludo_arm(p_seats int)
returns int language sql immutable strict set search_path = public, pg_temp
as $$ select case p_seats when 4 then 13 when 6 then 9 else 7 end $$;

create or replace function public.ludo_ring_length(p_seats int)
returns int language sql immutable strict set search_path = public, pg_temp
as $$ select p_seats * public.ludo_arm(p_seats) $$;

create or replace function public.ludo_finish_line(p_seats int)
returns int language sql immutable strict set search_path = public, pg_temp
as $$ select public.ludo_ring_length(p_seats) + 5 $$;

create or replace function public.ludo_safe_offset(p_seats int)
returns int language sql immutable strict set search_path = public, pg_temp
as $$ select case p_seats when 4 then 8 when 6 then 5 else 4 end $$;

/** The 2 x seats starred squares: each seat's start, plus one offset along. */
create or replace function public.ludo_safe_squares(p_seats int)
returns int[]
language sql immutable strict set search_path = public, pg_temp
as $$
  select array_agg(s order by s)::int[]
  from (
    select (g * public.ludo_arm(p_seats))::int as s
      from generate_series(0, p_seats - 1) g
    union
    select (g * public.ludo_arm(p_seats) + public.ludo_safe_offset(p_seats))::int
      from generate_series(0, p_seats - 1) g
  ) t;
$$;

create or replace function public.ludo_abs_square(p_seats int, p_seat int, p_progress int)
returns int language sql immutable strict set search_path = public, pg_temp
as $$
  select (p_seat * public.ludo_arm(p_seats) + p_progress) % public.ludo_ring_length(p_seats);
$$;

create or replace function public.ludo_is_safe(p_seats int, p_square int)
returns boolean language sql immutable strict set search_path = public, pg_temp
as $$ select p_square = any (public.ludo_safe_squares(p_seats)) $$;

create or replace function public.ludo_seat_color(p_seat int)
returns text language sql immutable strict set search_path = public, pg_temp
as $$
  select (array['red', 'green', 'blue', 'yellow', 'purple', 'orange', 'teal', 'pink'])[p_seat + 1];
$$;


-- ----------------------------------------------------------------------------
-- State helpers: read the jsonb board
-- ----------------------------------------------------------------------------

/** Every token currently standing on one absolute ring square. */
create or replace function public.ludo_tokens_on(
  p_state jsonb, p_seats int, p_square int
)
returns table (seat int, token int)
language sql stable set search_path = public, pg_temp
as $$
  with toks as (
    select (t.obj ->> 'seat')::int as seat,
           (x.ord - 1)::int        as token,
           x.value::int            as progress
      from jsonb_array_elements(coalesce(p_state -> 'tokens', '[]'::jsonb))
             with ordinality t (obj, o),
           lateral jsonb_array_elements_text(coalesce(t.obj -> 'progress', '[]'::jsonb))
             with ordinality x (value, ord)
  )
  select toks.seat, toks.token from (
    select seat, token, progress,
           public.ludo_abs_square(p_seats, seat, progress) as abs_square
      from toks
     where progress between 0 and public.ludo_ring_length(p_seats) - 1
  ) toks
  where toks.abs_square = p_square;
$$;

/** One seat's progress array (0-based token order preserved). */
create or replace function public.ludo_seat_progress(p_state jsonb, p_seat int)
returns int[]
language sql stable set search_path = public, pg_temp
as $$
  select coalesce(
    array_agg(x.value::int order by x.ord),
    '{}'::int[]
  )
  from jsonb_array_elements(coalesce(p_state -> 'tokens', '[]'::jsonb))
         with ordinality t (obj, o),
       lateral jsonb_array_elements_text(coalesce(t.obj -> 'progress', '[]'::jsonb))
         with ordinality x (value, ord)
  where (t.obj ->> 'seat')::int = p_seat;
$$;

/**
 * Rules ï¿½7.2 ï¿½ two or more tokens of one colour on a square form a block
 * that opponents can neither land on nor pass through. Your own colour never
 * blocks you.
 */
create or replace function public.ludo_blocked(
  p_state jsonb, p_seats int, p_square int, p_mover_seat int
)
returns boolean
language sql stable set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.ludo_tokens_on(p_state, p_seats, p_square) t
     where t.seat <> p_mover_seat
     group by t.seat
    having count(*) >= 2
  );
$$;

-- ----------------------------------------------------------------------------
-- Rules engine: is one token's move legal, and what is the full legal set
-- ----------------------------------------------------------------------------
create or replace function public.ludo_move_is_legal(
  p_seats int, p_seat int, p_dice int,
  p_progress int[], p_token int, p_state jsonb
)
returns boolean
language plpgsql stable set search_path = public, pg_temp
as $$
declare
  v_ring  int := public.ludo_ring_length(p_seats);
  v_fin   int := public.ludo_finish_line(p_seats);
  v_start int := p_seat * public.ludo_arm(p_seats);
  v_from  int := p_progress[p_token + 1];   -- plpgsql arrays are 1-based
  v_to    int;
  v_q     int;
begin
  if v_from is null or v_from = v_fin then
    return false;                            -- absent or already home
  end if;

  if v_from = -1 then
    if p_dice <> 6 then
      return false;                          -- rules ï¿½5: a 6 opens the yard
    end if;
    -- Entering your own start square: no path, but the square itself can be
    -- blocked by an opponent's stack.
    return not public.ludo_blocked(p_state, p_seats, v_start, p_seat);
  end if;

  v_to := v_from + p_dice;
  if v_to > v_fin then
    return false;                            -- rules ï¿½6: overshoot is illegal
  end if;

  -- Only ring squares can be blocked; the home column is private.
  if v_from <= v_ring - 1 then
    for v_q in (v_from + 1) .. least(v_to, v_ring - 1) loop
      if public.ludo_blocked(p_state, p_seats,
                             public.ludo_abs_square(p_seats, p_seat, v_q), p_seat) then
        return false;
      end if;
    end loop;
  end if;

  return true;
end;
$$;

create or replace function public.ludo_legal_moves(
  p_seats int, p_seat int, p_tokens int, p_dice int,
  p_progress int[], p_state jsonb
)
returns int[]
language sql stable set search_path = public, pg_temp
as $$
  select coalesce(array_agg(i order by i), '{}'::int[])
  from generate_series(0, p_tokens - 1) i
  where public.ludo_move_is_legal(p_seats, p_seat, p_dice, p_progress, i, p_state);
$$;

/**
 * Apply one validated move: relocate the token, capture any lone opponent on
 * a non-safe landing square (rules ï¿½7.1) and record `lastMove` for the UI.
 */
create or replace function public.ludo_apply_move(
  p_state jsonb, p_seats int, p_seat int, p_token int, p_dice int
)
returns jsonb
language plpgsql set search_path = public, pg_temp
as $$
declare
  v_ring   int := public.ludo_ring_length(p_seats);
  v_fin    int := public.ludo_finish_line(p_seats);
  v_start  int := p_seat * public.ludo_arm(p_seats);
  v_prog   int[] := public.ludo_seat_progress(p_state, p_seat);
  v_from   int := v_prog[p_token + 1];
  v_to     int;
  v_abs    int;
  v_idx    int;
  v_cidx   int;
  v_state  jsonb := p_state;
  v_captured int := 0;
  cap      record;
begin
  if v_from = -1 then
    v_to := 0;
  else
    v_to := v_from + p_dice;
  end if;
  if v_to > v_fin then
    raise exception 'illegal_move';
  end if;

  select (t.o - 1)::int into v_idx
    from jsonb_array_elements(coalesce(v_state -> 'tokens', '[]'::jsonb))
           with ordinality t (obj, o)
   where (t.obj ->> 'seat')::int = p_seat;
  if v_idx is null then
    raise exception 'illegal_move';
  end if;

  v_state := jsonb_set(v_state,
                       array['tokens', v_idx::text, 'progress', p_token::text],
                       to_jsonb(v_to::int));

  -- Capture only applies to a ring landing that is not a safe square.
  if v_from >= 0 and v_to <= v_ring - 1 then
    v_abs := public.ludo_abs_square(p_seats, p_seat, v_to);
    if not public.ludo_is_safe(p_seats, v_abs) then
      for cap in
        select * from public.ludo_tokens_on(v_state, p_seats, v_abs)
         where seat <> p_seat
      loop
        select (t.o - 1)::int into v_cidx
          from jsonb_array_elements(coalesce(v_state -> 'tokens', '[]'::jsonb))
                 with ordinality t (obj, o)
         where (t.obj ->> 'seat')::int = cap.seat;
        v_state := jsonb_set(v_state,
                             array['tokens', v_cidx::text, 'progress', cap.token::text],
                             to_jsonb((-1)::int));   -- back to the yard
        v_captured := v_captured + 1;
      end loop;
    end if;
  end if;

  return v_state || jsonb_build_object(
    'lastMove',
    jsonb_build_object('seat', p_seat, 'token', p_token, 'from', v_from,
                       'to', v_to, 'captured', v_captured)
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- Turn plumbing
-- ----------------------------------------------------------------------------
create or replace function public.ludo_next_seq(p_game_id uuid)
returns int language sql stable set search_path = public, pg_temp
as $$ select coalesce(max(seq), 0) + 1 from public.ludo_actions where game_id = p_game_id $$;

/** Next unfinished seat after `p_from`, wrapping clockwise (rules ï¿½9). */
create or replace function public.ludo_next_seat(p_game_id uuid, p_from int, p_seats int)
returns int
language sql stable security definer set search_path = public, pg_temp
as $$
  select s.seat
    from public.ludo_seats s
   where s.game_id = p_game_id
     and s.placement is null
     and s.seat <> p_from
   order by ((s.seat - p_from + p_seats) % p_seats)
   limit 1;
$$;

/** Everything a client needs to render after an action. */
create or replace function public.ludo_snapshot(p_game_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  g     public.ludo_games%rowtype;
  v_moves int[];
begin
  select * into g from public.ludo_games where id = p_game_id;
  if g.id is null then
    return null;
  end if;
  -- `ludo_snapshot` is the read path the app polls; it must be scoped exactly
  -- like the SELECT policies even though it is security definer.
  if not public.is_family_member(g.family_id, auth.uid()) then
    raise exception 'not_a_member';
  end if;
  if g.phase = 'awaiting_move' and g.dice is not null and g.status = 'playing' then
    v_moves := public.ludo_legal_moves(
      g.board_seats, g.turn_seat, g.tokens_per_player, g.dice,
      public.ludo_seat_progress(g.state, g.turn_seat), g.state);
  end if;
  return jsonb_build_object(
    'id', g.id, 'familyId', g.family_id, 'status', g.status, 'phase', g.phase,
    'turnSeat', g.turn_seat, 'dice', g.dice, 'version', g.version,
    'winnerSeat', g.winner_seat, 'turnDeadline', g.turn_deadline,
    'consecutiveSixes', g.consecutive_sixes, 'boardSeats', g.board_seats,
    'state', g.state,
    'legalMoves', coalesce(to_jsonb(v_moves), '[]'::jsonb)
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- Internal turn functions.
--
-- Each assumes the caller already holds the row lock on the game (they are
-- called from the public RPCs below, which lock first). They are never
-- granted to API roles.
-- ----------------------------------------------------------------------------

create or replace function public.ludo_do_pass(p_game_id uuid, p_is_auto boolean)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  g      public.ludo_games%rowtype;
  v_next int;
  v_total int;
begin
  select * into g from public.ludo_games where id = p_game_id for update;
  if g.id is null then
    raise exception 'game_not_found';
  end if;
  if g.status <> 'playing' then
    return;                                   -- nothing to pass on
  end if;

  insert into public.ludo_actions (game_id, seq, seat, action, result)
  values (p_game_id, public.ludo_next_seq(p_game_id), g.turn_seat, 'pass',
          jsonb_build_object('auto', p_is_auto));

  v_total := (select count(*) from public.ludo_seats where game_id = p_game_id);
  v_next  := public.ludo_next_seat(p_game_id, g.turn_seat, g.board_seats);

  if v_next is null then
    -- Nobody unfinished is left but the current seat: it is placed last.
    update public.ludo_seats set placement = v_total
     where game_id = p_game_id and placement is null;
    update public.ludo_games
       set status = 'finished', dice = null, turn_seat = null, turn_deadline = null,
           winner_seat = coalesce((g.state -> 'finishedOrder' ->> 0)::int, g.turn_seat),
           version = version + 1, updated_at = now()
     where id = p_game_id;
  else
    update public.ludo_games
       set turn_seat = v_next, phase = 'awaiting_roll', dice = null,
           consecutive_sixes = 0, turn_deadline = now() + make_interval(secs => turn_seconds),
           version = version + 1, updated_at = now()
     where id = p_game_id;
  end if;
end;
$$;

create or replace function public.ludo_do_roll(
  p_game_id uuid, p_forced_dice int, p_is_auto boolean
)
returns void
language plpgsql security definer set search_path = public, extensions, pg_temp
as $$
declare
  g      public.ludo_games%rowtype;
  v_dice int;
  v_byte int;
  v_moves int[];
  v_cs   int;
begin
  select * into g from public.ludo_games where id = p_game_id for update;
  if g.id is null then raise exception 'game_not_found'; end if;
  if g.status <> 'playing' then raise exception 'game_not_playing'; end if;
  if g.phase <> 'awaiting_roll' then raise exception 'wrong_phase'; end if;

  -- Server-side RNG. `p_forced_dice` exists only so `db:check` can drive the
  -- engine deterministically; it is refused unless ocf.test_mode is on, which
  -- never happens outside the verification harness.
  if p_forced_dice is not null then
    if coalesce(current_setting('ocf.test_mode', true), 'off') <> 'on' then
      raise exception 'forced_dice_not_allowed';
    end if;
    if p_forced_dice < 1 or p_forced_dice > 6 then
      raise exception 'invalid_dice';
    end if;
    v_dice := p_forced_dice;
  else
    loop
      v_byte := get_byte(extensions.gen_random_bytes(1), 0);
      exit when v_byte < 240;                -- 240 = 6 x 40 keeps the die fair
    end loop;
    v_dice := (v_byte % 6) + 1;
  end if;

  -- Rules ï¿½5: three consecutive sixes forfeit the turn outright.
  if v_dice = 6 then
    v_cs := g.consecutive_sixes + 1;
  else
    v_cs := 0;
  end if;

  if v_cs >= 3 then
    insert into public.ludo_actions (game_id, seq, seat, action, dice, result)
    values (p_game_id, public.ludo_next_seq(p_game_id), g.turn_seat, 'roll', v_dice,
            jsonb_build_object('forfeit', true, 'auto', p_is_auto));
    perform public.ludo_do_pass(p_game_id, p_is_auto);
    return;
  end if;

  v_moves := public.ludo_legal_moves(
    g.board_seats, g.turn_seat, g.tokens_per_player, v_dice,
    public.ludo_seat_progress(g.state, g.turn_seat), g.state);

  if coalesce(array_length(v_moves, 1), 0) = 0 then
    insert into public.ludo_actions (game_id, seq, seat, action, dice, expected_version, result)
    values (p_game_id, public.ludo_next_seq(p_game_id), g.turn_seat, 'roll', v_dice,
            g.version, jsonb_build_object('legalMoves', '[]'::jsonb, 'auto', p_is_auto));
    if v_dice = 6 then
      -- Rules ï¿½4: an unusable 6 still buys another roll.
      update public.ludo_games
         set dice = v_dice, consecutive_sixes = v_cs, phase = 'awaiting_roll',
             turn_deadline = now() + make_interval(secs => turn_seconds), version = version + 1, updated_at = now()
       where id = p_game_id;
    else
      perform public.ludo_do_pass(p_game_id, p_is_auto);
    end if;
    return;
  end if;

  insert into public.ludo_actions (game_id, seq, seat, action, dice, expected_version, result)
  values (p_game_id, public.ludo_next_seq(p_game_id), g.turn_seat, 'roll', v_dice,
          g.version, jsonb_build_object('legalMoves', to_jsonb(v_moves), 'auto', p_is_auto));

  update public.ludo_games
     set dice = v_dice, consecutive_sixes = v_cs, phase = 'awaiting_move',
         turn_deadline = now() + make_interval(secs => turn_seconds), version = version + 1, updated_at = now()
   where id = p_game_id;
end;
$$;

create or replace function public.ludo_do_move(
  p_game_id uuid, p_token int, p_is_auto boolean
)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  g          public.ludo_games%rowtype;
  v_seat     int;
  v_prog     int[];
  v_moves    int[];
  v_state    jsonb;
  v_from     int;
  v_to       int;
  v_captured int;
  v_fin      int;
  v_all_home boolean;
  v_finished int;
  v_total    int;
begin
  select * into g from public.ludo_games where id = p_game_id for update;
  if g.id is null then raise exception 'game_not_found'; end if;
  if g.status <> 'playing' then raise exception 'game_not_playing'; end if;
  if g.phase <> 'awaiting_move' then raise exception 'wrong_phase'; end if;
  if g.dice is null then raise exception 'no_dice'; end if;
  if p_token is null or p_token < 0 or p_token >= g.tokens_per_player then
    raise exception 'invalid_token';
  end if;

  v_seat  := g.turn_seat;
  v_prog  := public.ludo_seat_progress(g.state, v_seat);
  v_moves := public.ludo_legal_moves(
    g.board_seats, v_seat, g.tokens_per_player, g.dice, v_prog, g.state);

  if not (p_token = any (v_moves)) then
    raise exception 'illegal_move';
  end if;

  v_from    := v_prog[p_token + 1];
  v_state   := public.ludo_apply_move(g.state, g.board_seats, v_seat, p_token, g.dice);
  v_to      := (v_state -> 'lastMove' ->> 'to')::int;
  v_captured := coalesce((v_state -> 'lastMove' ->> 'captured')::int, 0);
  v_fin     := public.ludo_finish_line(g.board_seats);

  insert into public.ludo_actions
    (game_id, seq, seat, action, dice, token_index, expected_version, result)
  values
    (p_game_id, public.ludo_next_seq(p_game_id), v_seat, 'move', g.dice, p_token,
     g.version,
     jsonb_build_object('from', v_from, 'to', v_to, 'captured', v_captured,
                        'auto', p_is_auto));

  select bool_and((x.value)::int = v_fin) into v_all_home
    from jsonb_array_elements(coalesce(v_state -> 'tokens', '[]'::jsonb)) t (obj),
         lateral jsonb_array_elements_text(coalesce(t.obj -> 'progress', '[]'::jsonb)) x (value)
   where (t.obj ->> 'seat')::int = v_seat;

  v_total    := (select count(*) from public.ludo_seats where game_id = p_game_id);
  v_finished := (select count(*) from public.ludo_seats
                  where game_id = p_game_id and placement is not null);

  if coalesce(v_all_home, false) then
    v_finished := v_finished + 1;
    update public.ludo_seats set placement = v_finished
     where game_id = p_game_id and seat = v_seat and placement is null;
    v_state := v_state || jsonb_build_object(
      'finishedOrder',
      coalesce(v_state -> 'finishedOrder', '[]'::jsonb) || jsonb_build_array(v_seat));
  end if;

  -- Rules ï¿½9: play on for placement, stop when only one player is unfinished.
  if coalesce(v_all_home, false) and v_finished >= v_total - 1 then
    update public.ludo_seats set placement = v_total
     where game_id = p_game_id and placement is null;
    update public.ludo_games
       set state = v_state, status = 'finished', dice = null, phase = 'awaiting_roll',
           turn_seat = null, turn_deadline = null,
           winner_seat = coalesce((v_state -> 'finishedOrder' ->> 0)::int, v_seat),
           version = version + 1, updated_at = now()
     where id = p_game_id;
    insert into public.ludo_actions (game_id, seq, seat, action, result)
    values (p_game_id, public.ludo_next_seq(p_game_id), v_seat, 'finish',
            jsonb_build_object('placement', v_finished, 'auto', p_is_auto));
    return;
  end if;

  if g.dice = 6 or v_captured > 0 then
    -- Rules ï¿½5: a six or a capture buys another roll (dice is kept so the
    -- UI can still show what caused the extra turn).
    update public.ludo_games
       set state = v_state, phase = 'awaiting_roll',
           turn_deadline = now() + make_interval(secs => turn_seconds), version = version + 1, updated_at = now()
     where id = p_game_id;
  else
    update public.ludo_games set state = v_state, updated_at = now()
     where id = p_game_id;
    perform public.ludo_do_pass(p_game_id, p_is_auto);
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- Public RPC surface (granted to `authenticated` only)
-- ----------------------------------------------------------------------------

create or replace function public.ludo_create_game(
  p_family_id uuid, p_board_seats int, p_turn_seconds int default 45
)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_id     uuid;
  v_tokens int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_board_seats not in (4, 6, 8) then raise exception 'invalid_board'; end if;
  if not exists (
    select 1 from public.family_members
     where family_id = p_family_id and user_id = v_uid and status = 'active'
  ) then
    raise exception 'not_a_member';
  end if;

  -- Rules ï¿½3.1: 8-seat boards use 3 tokens so blocking stays playable.
  v_tokens := case p_board_seats when 8 then 3 else 4 end;

  insert into public.ludo_games
    (family_id, created_by, board_seats, tokens_per_player, turn_seconds, state)
  values (
    p_family_id, v_uid, p_board_seats, v_tokens,
    greatest(10, least(coalesce(p_turn_seconds, 45), 600)),
    jsonb_build_object('safeSquares', public.ludo_safe_squares(p_board_seats),
                       'tokens', '[]'::jsonb,
                       'finishedOrder', '[]'::jsonb,
                       'lastMove', null::jsonb)
  )
  returning id into v_id;

  insert into public.ludo_seats (game_id, seat, user_id, color)
  values (v_id, 0, v_uid, public.ludo_seat_color(0));

  insert into public.ludo_actions (game_id, seq, seat, action, result)
  values (v_id, 1, 0, 'create',
          jsonb_build_object('boardSeats', p_board_seats, 'tokensPerPlayer', v_tokens));

  return v_id;
end;
$$;

create or replace function public.ludo_join_game(p_game_id uuid)
returns int
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  g      public.ludo_games%rowtype;
  v_uid  uuid := auth.uid();
  v_seat int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into g from public.ludo_games where id = p_game_id for update;
  if g.id is null then raise exception 'game_not_found'; end if;
  if not public.is_family_member(g.family_id, v_uid) then raise exception 'not_a_member'; end if;
  if g.status <> 'waiting' then raise exception 'game_already_started'; end if;
  if exists (select 1 from public.ludo_seats where game_id = g.id and user_id = v_uid) then
    raise exception 'already_seated';
  end if;

  select min(x.s) into v_seat
    from generate_series(0, g.board_seats - 1) x (s)
   where not exists (
     select 1 from public.ludo_seats y where y.game_id = g.id and y.seat = x.s
   );
  if v_seat is null then raise exception 'game_full'; end if;

  insert into public.ludo_seats (game_id, seat, user_id, color)
  values (g.id, v_seat, v_uid, public.ludo_seat_color(v_seat));

  insert into public.ludo_actions (game_id, seq, seat, action, result)
  values (p_game_id, public.ludo_next_seq(p_game_id), v_seat, 'join', null);

  return v_seat;
end;
$$;

create or replace function public.ludo_start_game(p_game_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  g        public.ludo_games%rowtype;
  v_uid    uuid := auth.uid();
  v_count  int;
  v_first  int;
  v_tokens jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into g from public.ludo_games where id = p_game_id for update;
  if g.id is null then raise exception 'game_not_found'; end if;
  if not public.is_family_member(g.family_id, v_uid) then raise exception 'not_a_member'; end if;
  if g.created_by <> v_uid then raise exception 'not_the_host'; end if;
  if g.status <> 'waiting' then raise exception 'game_already_started'; end if;

  select count(*) into v_count from public.ludo_seats where game_id = g.id;
  if v_count < 2 then raise exception 'need_more_players'; end if;

  select min(seat) into v_first from public.ludo_seats where game_id = g.id;

  select coalesce(
    jsonb_agg(jsonb_build_object('seat', s.seat, 'progress', s.prog) order by s.seat),
    '[]'::jsonb
  ) into v_tokens
  from (
    select s.seat, to_jsonb(array_fill(-1, array[g.tokens_per_player])) as prog
      from public.ludo_seats s
     where s.game_id = g.id
     order by s.seat
  ) s;

  update public.ludo_games
     set status = 'playing', phase = 'awaiting_roll', turn_seat = v_first,
         turn_deadline = now() + make_interval(secs => turn_seconds), dice = null, consecutive_sixes = 0,
         state = (g.state || jsonb_build_object('tokens', v_tokens, 'finishedOrder', '[]'::jsonb)),
         version = version + 1, updated_at = now()
   where id = p_game_id;

  insert into public.ludo_actions (game_id, seq, seat, action, expected_version, result)
  values (p_game_id, public.ludo_next_seq(p_game_id), v_first, 'start', g.version,
          jsonb_build_object('players', v_count));

  return public.ludo_snapshot(p_game_id);
end;
$$;

create or replace function public.ludo_roll(
  p_game_id uuid, p_expected_version int, p_forced_dice int default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  g    public.ludo_games%rowtype;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into g from public.ludo_games where id = p_game_id for update;
  if g.id is null then raise exception 'game_not_found'; end if;
  if not public.is_family_member(g.family_id, v_uid) then raise exception 'not_a_member'; end if;
  if g.status <> 'playing' then raise exception 'game_not_playing'; end if;
  if g.phase <> 'awaiting_roll' then raise exception 'wrong_phase'; end if;
  if g.turn_seat is null or not exists (
    select 1 from public.ludo_seats
     where game_id = g.id and seat = g.turn_seat and user_id = v_uid
  ) then
    raise exception 'not_your_turn';
  end if;
  if g.version <> p_expected_version then raise exception 'stale_state'; end if;
  if g.turn_deadline is not null and now() > g.turn_deadline then
    raise exception 'turn_expired';
  end if;

  perform public.ludo_do_roll(p_game_id, p_forced_dice, false);
  return public.ludo_snapshot(p_game_id);
end;
$$;

create or replace function public.ludo_move(
  p_game_id uuid, p_token int, p_expected_version int
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  g     public.ludo_games%rowtype;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into g from public.ludo_games where id = p_game_id for update;
  if g.id is null then raise exception 'game_not_found'; end if;
  if not public.is_family_member(g.family_id, v_uid) then raise exception 'not_a_member'; end if;
  if g.status <> 'playing' then raise exception 'game_not_playing'; end if;
  if g.phase <> 'awaiting_move' then raise exception 'wrong_phase'; end if;
  if g.turn_seat is null or not exists (
    select 1 from public.ludo_seats
     where game_id = g.id and seat = g.turn_seat and user_id = v_uid
  ) then
    raise exception 'not_your_turn';
  end if;
  if g.version <> p_expected_version then raise exception 'stale_state'; end if;
  if g.turn_deadline is not null and now() > g.turn_deadline then
    raise exception 'turn_expired';
  end if;

  perform public.ludo_do_move(p_game_id, p_token, false);
  return public.ludo_snapshot(p_game_id);
end;
$$;

create or replace function public.ludo_pass(p_game_id uuid, p_expected_version int)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  g     public.ludo_games%rowtype;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into g from public.ludo_games where id = p_game_id for update;
  if g.id is null then raise exception 'game_not_found'; end if;
  if not public.is_family_member(g.family_id, v_uid) then raise exception 'not_a_member'; end if;
  if g.status <> 'playing' then raise exception 'game_not_playing'; end if;
  if g.phase <> 'awaiting_move' then raise exception 'wrong_phase'; end if;
  if g.turn_seat is null or not exists (
    select 1 from public.ludo_seats
     where game_id = g.id and seat = g.turn_seat and user_id = v_uid
  ) then
    raise exception 'not_your_turn';
  end if;
  if g.version <> p_expected_version then raise exception 'stale_state'; end if;

  perform public.ludo_do_pass(p_game_id, false);
  return public.ludo_snapshot(p_game_id);
end;
$$;

/**
 * Rules ï¿½10 ï¿½ lazy turn-timer resolution. Any family member may nudge a game;
 * if the current seat is over its deadline (or set to autoplay) the turn is
 * resolved deterministically: capture, else leave the yard, else the token
 * furthest along.
 */
create or replace function public.ludo_auto_resolve(p_game_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  g       public.ludo_games%rowtype;
  v_uid   uuid := auth.uid();
  v_auto  boolean;
  v_moves int[];
  v_best  int;
  v_prog  int[];
  v_expired boolean;
  v_iters int := 0;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into g from public.ludo_games where id = p_game_id for update;
  if g.id is null then raise exception 'game_not_found'; end if;
  if not public.is_family_member(g.family_id, v_uid) then raise exception 'not_a_member'; end if;

  loop
    exit when g.status <> 'playing' or v_iters >= 12;

    v_auto := false;
    select coalesce(s.autoplay, false) into v_auto
      from public.ludo_seats s
     where s.game_id = g.id and s.seat = g.turn_seat;

    v_expired := g.turn_deadline is not null and now() > g.turn_deadline;
    exit when not coalesce(v_auto, false) and not v_expired;

    v_iters := v_iters + 1;

    if g.phase = 'awaiting_roll' then
      perform public.ludo_do_roll(p_game_id, null, true);
    else
      v_prog  := public.ludo_seat_progress(g.state, g.turn_seat);
      v_moves := public.ludo_legal_moves(
        g.board_seats, g.turn_seat, g.tokens_per_player, g.dice, v_prog, g.state);
      if coalesce(array_length(v_moves, 1), 0) = 0 then
        perform public.ludo_do_pass(p_game_id, true);
      else
        -- Deterministic: capture > leave the yard > furthest along (rules ï¿½10).
        select m.token into v_best
          from unnest(v_moves) m (token)
         order by
           case when g.dice = 6 and v_prog[m.token + 1] = -1 then 0 else 1 end,
           v_prog[m.token + 1] desc
         limit 1;
        perform public.ludo_do_move(p_game_id, v_best, true);
      end if;
    end if;

    select * into g from public.ludo_games where id = p_game_id;
  end loop;

  return public.ludo_snapshot(p_game_id);
end;
$$;

-- ----------------------------------------------------------------------------
-- API surface: only the RPCs are callable; helpers stay internal
-- ----------------------------------------------------------------------------
do $$
declare
  f record;
begin
  -- PostgreSQL grants EXECUTE to PUBLIC on every new function, so the whole
  -- `ludo\_%` family is stripped first and only the RPCs are handed back.
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname like 'ludo\_%'
       and p.proname <> 'ludo_game_family_id'
  loop
    execute 'revoke execute on function ' || f.sig || ' from public, anon, authenticated';
  end loop;
end $$;

grant execute on function public.ludo_create_game(uuid, int, int) to authenticated;
grant execute on function public.ludo_join_game(uuid) to authenticated;
grant execute on function public.ludo_start_game(uuid) to authenticated;
grant execute on function public.ludo_roll(uuid, int, int) to authenticated;
grant execute on function public.ludo_move(uuid, int, int) to authenticated;
grant execute on function public.ludo_pass(uuid, int) to authenticated;
grant execute on function public.ludo_auto_resolve(uuid) to authenticated;
-- Read path: returns the snapshot (including the server-computed legalMoves)
-- for family members only; the guard lives inside the function.
grant execute on function public.ludo_snapshot(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Realtime: the board is public information, so one channel per game is
-- enough; RLS scopes delivery to family members.
-- ----------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.ludo_games;
exception when duplicate_object then null; when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.ludo_seats;
exception when duplicate_object then null; when undefined_object then null;
end $$;
-- ============================================================================
-- Memory Vault â€” a searchable family media archive backed by Google Drive
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
--   Drive side effect â€” upload, rename, delete â€” is performed by the Edge
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
  /** AES-GCM(nonce || tag || ciphertext), base64 â€” decrypted only server-side. */
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
-- "Who's in the picture" â€” a real join table so the references are enforced
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
-- ============================================================================
-- Milestone 3 Polish: Ludo Autoplay & Extended RPCs
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Autoplay toggle: allows any seated player to delegate their rolls and moves
-- to the server-authoritative ludo_auto_resolve engine.
-- ----------------------------------------------------------------------------
create or replace function public.ludo_set_autoplay(
  p_game_id  uuid,
  p_autoplay boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := auth.uid();
  v_seat int;
  g      public.ludo_games%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into g from public.ludo_games where id = p_game_id for update;
  if g.id is null then raise exception 'game_not_found'; end if;
  if not public.is_family_member(g.family_id, v_uid) then raise exception 'not_a_member'; end if;

  select seat into v_seat
    from public.ludo_seats
   where game_id = p_game_id and user_id = v_uid;
  if v_seat is null then raise exception 'not_a_player'; end if;

  update public.ludo_seats
     set autoplay = coalesce(p_autoplay, false)
   where game_id = p_game_id and seat = v_seat;

  -- If autoplay is enabled and it is currently this seat's turn, resolve immediately
  if coalesce(p_autoplay, false) and g.status = 'playing' and g.turn_seat = v_seat then
    perform public.ludo_auto_resolve(p_game_id);
  end if;
end;
$$;

-- Lockdown function execution permissions
revoke execute on function public.ludo_set_autoplay(uuid, boolean) from public, anon, authenticated;
grant execute on function public.ludo_set_autoplay(uuid, boolean) to authenticated;


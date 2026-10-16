-- ============================================================================
-- Our Cousin Family — Core Schema
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

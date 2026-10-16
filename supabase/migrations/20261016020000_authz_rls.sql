-- ============================================================================
-- Our Cousin Family — Authorization helpers, RPCs, RLS policies
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

-- Any membership row (active OR pending) — used for "awaiting approval" views.
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
-- name/cover — never content. Everything else stays authenticated-only.
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

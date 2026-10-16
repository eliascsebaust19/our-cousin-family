-- ============================================================================
-- Our Cousin Family — Family calendar
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
-- EXECUTE here — but nothing else does, and this migration runs after the
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
-- again — otherwise the organiser keeps seeing "is going" for a declined RSVP.
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

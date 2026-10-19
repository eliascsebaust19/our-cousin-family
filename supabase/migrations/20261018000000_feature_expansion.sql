-- ============================================================================
-- Our Cousin Family — Five Feature Expansion Migration
-- 1. Interactive Family Tree (members, relationships, cycle prevention)
-- 2. Enhanced Calendar & Reminders (categories, cover, recurrence, reminders)
-- 3. Voice Memory & Story Archive (recordings, playback, transcription)
-- 4. Travel & Reunion Planner (plans, participants, itinerary, tasks, budget)
-- 5. Family Fund & Shared Expenses (funds, contributions, expenses, audit log)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. INTERACTIVE FAMILY TREE
-- ----------------------------------------------------------------------------
create table if not exists public.family_tree_members (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references public.families (id) on delete cascade,
  profile_id   uuid references public.profiles (id) on delete set null,
  full_name    text not null check (char_length(trim(full_name)) between 1 and 100),
  gender       text check (gender is null or gender in ('male', 'female', 'other')),
  birth_date   date,
  death_date   date,
  is_deceased  boolean not null default false,
  bio          text check (bio is null or char_length(bio) <= 1000),
  avatar_url   text,
  generation   integer not null default 0,
  created_by   uuid not null references public.profiles (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint check_tree_member_dates check (death_date is null or birth_date is null or death_date >= birth_date)
);

create index if not exists family_tree_members_family_idx
  on public.family_tree_members (family_id, generation);

create index if not exists family_tree_members_profile_idx
  on public.family_tree_members (profile_id);

create trigger family_tree_members_set_updated_at
  before update on public.family_tree_members
  for each row execute function public.set_updated_at();

create table if not exists public.family_tree_relationships (
  id                 uuid primary key default gen_random_uuid(),
  family_id          uuid not null references public.families (id) on delete cascade,
  person_id          uuid not null references public.family_tree_members (id) on delete cascade,
  related_person_id  uuid not null references public.family_tree_members (id) on delete cascade,
  relationship_type  text not null check (relationship_type in ('parent', 'child', 'spouse', 'sibling')),
  status             text not null default 'approved' check (status in ('approved', 'suggested', 'rejected')),
  created_by         uuid not null references public.profiles (id),
  approved_by        uuid references public.profiles (id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint no_self_relation check (person_id <> related_person_id),
  constraint unique_tree_rel unique (family_id, person_id, related_person_id, relationship_type)
);

create index if not exists family_tree_rel_family_idx
  on public.family_tree_relationships (family_id, status);

create index if not exists family_tree_rel_person_idx
  on public.family_tree_relationships (person_id, related_person_id);

create trigger family_tree_rel_set_updated_at
  before update on public.family_tree_relationships
  for each row execute function public.set_updated_at();

-- Cycle prevention for parent-child links
create or replace function public.check_tree_no_cycle(p_parent_id uuid, p_child_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_current uuid;
begin
  if p_parent_id = p_child_id then
    return false;
  end if;

  -- Recursively check if p_child_id is an ancestor of p_parent_id
  with recursive ancestors as (
    select related_person_id as ancestor_id
      from public.family_tree_relationships
     where person_id = p_parent_id
       and relationship_type = 'parent'
       and status = 'approved'
    union
    select r.related_person_id
      from public.family_tree_relationships r
      join ancestors a on r.person_id = a.ancestor_id
     where r.relationship_type = 'parent'
       and r.status = 'approved'
  )
  select ancestor_id into v_current from ancestors where ancestor_id = p_child_id limit 1;

  return (v_current is null);
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. ENHANCED CALENDAR & REMINDERS
-- ----------------------------------------------------------------------------
alter table public.family_events
  add column if not exists category text not null default 'gathering'
    check (category in ('birthday', 'wedding', 'reunion', 'eid', 'anniversary', 'gathering', 'other')),
  add column if not exists cover_url text,
  add column if not exists is_recurring boolean not null default false,
  add column if not exists recurrence_rule text;

create table if not exists public.event_reminders (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.family_events (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  reminder_type  text not null default '1_day_before' check (reminder_type in ('1_day_before', '1_hour_before', 'on_day')),
  is_sent        boolean not null default false,
  created_at     timestamptz not null default now(),
  constraint unique_event_reminder unique (event_id, user_id, reminder_type)
);

create index if not exists event_reminders_user_idx on public.event_reminders (user_id);

-- ----------------------------------------------------------------------------
-- 3. VOICE MEMORY & STORY ARCHIVE
-- ----------------------------------------------------------------------------
create table if not exists public.voice_memories (
  id                uuid primary key default gen_random_uuid(),
  family_id         uuid not null references public.families (id) on delete cascade,
  created_by        uuid not null references public.profiles (id) on delete cascade,
  title             text not null check (char_length(trim(title)) between 1 and 150),
  description       text check (description is null or char_length(description) <= 2000),
  speaker_name      text not null check (char_length(trim(speaker_name)) between 1 and 80),
  speaker_id        uuid references public.profiles (id) on delete set null,
  recorded_date     date not null default current_date,
  language          text not null default 'bn' check (language in ('bn', 'en', 'other')),
  tags              text[] not null default '{}',
  audio_url         text not null,
  duration_seconds  integer not null default 0 check (duration_seconds >= 0),
  file_size_bytes   bigint not null default 0 check (file_size_bytes >= 0),
  cover_url         text,
  transcript        text,
  transcript_status text not null default 'none' check (transcript_status in ('none', 'pending', 'completed', 'failed')),
  transcript_updated_by uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists voice_memories_family_date_idx
  on public.voice_memories (family_id, recorded_date desc);

create trigger voice_memories_set_updated_at
  before update on public.voice_memories
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 4. FAMILY TRAVEL & REUNION PLANNER
-- ----------------------------------------------------------------------------
create table if not exists public.reunion_plans (
  id               uuid primary key default gen_random_uuid(),
  family_id        uuid not null references public.families (id) on delete cascade,
  created_by       uuid not null references public.profiles (id) on delete cascade,
  title            text not null check (char_length(trim(title)) between 1 and 150),
  description      text check (description is null or char_length(description) <= 3000),
  destination      text not null check (char_length(trim(destination)) between 1 and 200),
  cover_url        text,
  start_date       date not null,
  end_date         date,
  status           text not null default 'planning' check (status in ('planning', 'confirmed', 'completed', 'cancelled')),
  estimated_budget numeric(12,2) not null default 0 check (estimated_budget >= 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint check_reunion_dates check (end_date is null or end_date >= start_date)
);

create index if not exists reunion_plans_family_date_idx
  on public.reunion_plans (family_id, start_date desc);

create trigger reunion_plans_set_updated_at
  before update on public.reunion_plans
  for each row execute function public.set_updated_at();

create table if not exists public.reunion_participants (
  id           uuid primary key default gen_random_uuid(),
  reunion_id   uuid not null references public.reunion_plans (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  status       text not null default 'going' check (status in ('going', 'interested', 'declined')),
  adults_count integer not null default 1 check (adults_count >= 1),
  kids_count   integer not null default 0 check (kids_count >= 0),
  notes        text check (notes is null or char_length(notes) <= 300),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint unique_reunion_participant unique (reunion_id, user_id)
);

create trigger reunion_participants_set_updated_at
  before update on public.reunion_participants
  for each row execute function public.set_updated_at();

create table if not exists public.reunion_itinerary (
  id            uuid primary key default gen_random_uuid(),
  reunion_id    uuid not null references public.reunion_plans (id) on delete cascade,
  day_number    integer not null default 1 check (day_number >= 1),
  activity_time text,
  title         text not null check (char_length(trim(title)) between 1 and 120),
  location      text check (location is null or char_length(location) <= 150),
  description   text check (description is null or char_length(description) <= 1000),
  created_at    timestamptz not null default now()
);

create table if not exists public.reunion_tasks (
  id           uuid primary key default gen_random_uuid(),
  reunion_id   uuid not null references public.reunion_plans (id) on delete cascade,
  title        text not null check (char_length(trim(title)) between 1 and 150),
  category     text not null default 'general' check (category in ('transport', 'food', 'lodging', 'supplies', 'activities', 'general')),
  assigned_to  uuid references public.profiles (id) on delete set null,
  due_date     date,
  is_completed boolean not null default false,
  completed_by uuid references public.profiles (id) on delete set null,
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);

create table if not exists public.reunion_expenses (
  id               uuid primary key default gen_random_uuid(),
  reunion_id       uuid not null references public.reunion_plans (id) on delete cascade,
  title            text not null check (char_length(trim(title)) between 1 and 120),
  category         text not null default 'other' check (category in ('food', 'transport', 'lodging', 'tickets', 'activities', 'other')),
  estimated_amount numeric(12,2) not null default 0 check (estimated_amount >= 0),
  actual_amount    numeric(12,2) not null default 0 check (actual_amount >= 0),
  paid_by          uuid references public.profiles (id) on delete set null,
  payer_name       text,
  notes            text,
  created_at       timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 5. FAMILY FUND & SHARED EXPENSES (RECORD-KEEPING ONLY)
-- ----------------------------------------------------------------------------
create table if not exists public.family_funds (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null references public.families (id) on delete cascade,
  created_by     uuid not null references public.profiles (id) on delete cascade,
  title          text not null check (char_length(trim(title)) between 1 and 120),
  purpose        text check (purpose is null or char_length(purpose) <= 2000),
  target_amount  numeric(12,2) not null default 0 check (target_amount >= 0),
  deadline       date,
  is_closed      boolean not null default false,
  is_private     boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists family_funds_family_idx on public.family_funds (family_id);

create trigger family_funds_set_updated_at
  before update on public.family_funds
  for each row execute function public.set_updated_at();

create table if not exists public.fund_contributions (
  id               uuid primary key default gen_random_uuid(),
  fund_id          uuid not null references public.family_funds (id) on delete cascade,
  family_id        uuid not null references public.families (id) on delete cascade,
  contributor_name text not null check (char_length(trim(contributor_name)) between 1 and 80),
  contributor_id   uuid references public.profiles (id) on delete set null,
  amount           numeric(12,2) not null check (amount > 0),
  status           text not null default 'pledged' check (status in ('pledged', 'received', 'cancelled')),
  payment_method   text not null default 'cash' check (payment_method in ('cash', 'bkash', 'nagad', 'bank_transfer', 'other')),
  notes            text check (notes is null or char_length(notes) <= 500),
  received_at      timestamptz,
  confirmed_by     uuid references public.profiles (id) on delete set null,
  created_by       uuid not null references public.profiles (id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists fund_contributions_fund_idx on public.fund_contributions (fund_id, status);

create trigger fund_contributions_set_updated_at
  before update on public.fund_contributions
  for each row execute function public.set_updated_at();

create table if not exists public.fund_expenses (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references public.families (id) on delete cascade,
  fund_id      uuid references public.family_funds (id) on delete set null,
  title        text not null check (char_length(trim(title)) between 1 and 120),
  category     text not null default 'other' check (category in ('food', 'transport', 'medical', 'gifts', 'events', 'utilities', 'other')),
  amount       numeric(12,2) not null check (amount > 0),
  spent_at     date not null default current_date,
  payer_name   text not null check (char_length(trim(payer_name)) between 1 and 80),
  payer_id     uuid references public.profiles (id) on delete set null,
  receipt_url  text,
  description  text check (description is null or char_length(description) <= 1000),
  status       text not null default 'approved' check (status in ('pending_review', 'approved', 'rejected')),
  approved_by  uuid references public.profiles (id) on delete set null,
  created_by   uuid not null references public.profiles (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists fund_expenses_family_date_idx on public.fund_expenses (family_id, spent_at desc);

create trigger fund_expenses_set_updated_at
  before update on public.fund_expenses
  for each row execute function public.set_updated_at();

create table if not exists public.financial_audit_logs (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families (id) on delete cascade,
  actor_id    uuid not null references public.profiles (id) on delete cascade,
  action      text not null,
  target_type text not null check (target_type in ('fund', 'contribution', 'expense')),
  target_id   uuid not null,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists financial_audit_logs_family_idx on public.financial_audit_logs (family_id, created_at desc);

-- ----------------------------------------------------------------------------
-- SECURITY DEFINER HELPERS
-- ----------------------------------------------------------------------------
create or replace function public.reunion_family_id(p_reunion_id uuid)
returns uuid
language sql stable security definer set search_path = public, pg_temp
as $$
  select family_id from public.reunion_plans where id = p_reunion_id;
$$;

create or replace function public.fund_family_id(p_fund_id uuid)
returns uuid
language sql stable security definer set search_path = public, pg_temp
as $$
  select family_id from public.family_funds where id = p_fund_id;
$$;

revoke execute on function public.check_tree_no_cycle(uuid, uuid) from public, anon;
grant execute on function public.check_tree_no_cycle(uuid, uuid) to authenticated;

revoke execute on function public.reunion_family_id(uuid) from public, anon;
grant execute on function public.reunion_family_id(uuid) to authenticated;

revoke execute on function public.fund_family_id(uuid) from public, anon;
grant execute on function public.fund_family_id(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS)
-- ----------------------------------------------------------------------------
alter table public.family_tree_members enable row level security;
alter table public.family_tree_relationships enable row level security;
alter table public.event_reminders enable row level security;
alter table public.voice_memories enable row level security;
alter table public.reunion_plans enable row level security;
alter table public.reunion_participants enable row level security;
alter table public.reunion_itinerary enable row level security;
alter table public.reunion_tasks enable row level security;
alter table public.reunion_expenses enable row level security;
alter table public.family_funds enable row level security;
alter table public.fund_contributions enable row level security;
alter table public.fund_expenses enable row level security;
alter table public.financial_audit_logs enable row level security;

-- Family Tree Members
create policy "family_tree_members_select"
  on public.family_tree_members for select to authenticated
  using (public.is_family_member(family_id, auth.uid()));

create policy "family_tree_members_insert"
  on public.family_tree_members for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.is_family_member(family_id, auth.uid())
  );

create policy "family_tree_members_update"
  on public.family_tree_members for update to authenticated
  using (
    public.is_family_member(family_id, auth.uid())
    and (created_by = auth.uid() or public.family_role(family_id, auth.uid()) in ('owner', 'admin', 'moderator'))
  )
  with check (
    public.is_family_member(family_id, auth.uid())
    and (created_by = auth.uid() or public.family_role(family_id, auth.uid()) in ('owner', 'admin', 'moderator'))
  );

create policy "family_tree_members_delete"
  on public.family_tree_members for delete to authenticated
  using (
    public.is_family_member(family_id, auth.uid())
    and (created_by = auth.uid() or public.family_role(family_id, auth.uid()) in ('owner', 'admin'))
  );

-- Family Tree Relationships
create policy "family_tree_rel_select"
  on public.family_tree_relationships for select to authenticated
  using (public.is_family_member(family_id, auth.uid()));

create policy "family_tree_rel_insert"
  on public.family_tree_relationships for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.is_family_member(family_id, auth.uid())
  );

create policy "family_tree_rel_update"
  on public.family_tree_relationships for update to authenticated
  using (
    public.is_family_member(family_id, auth.uid())
    and (created_by = auth.uid() or public.family_role(family_id, auth.uid()) in ('owner', 'admin', 'moderator'))
  )
  with check (
    public.is_family_member(family_id, auth.uid())
    and (created_by = auth.uid() or public.family_role(family_id, auth.uid()) in ('owner', 'admin', 'moderator'))
  );

create policy "family_tree_rel_delete"
  on public.family_tree_relationships for delete to authenticated
  using (
    public.is_family_member(family_id, auth.uid())
    and (created_by = auth.uid() or public.family_role(family_id, auth.uid()) in ('owner', 'admin'))
  );

-- Event reminders
create policy "event_reminders_select_own"
  on public.event_reminders for select to authenticated
  using (user_id = auth.uid());

create policy "event_reminders_insert_own"
  on public.event_reminders for insert to authenticated
  with check (user_id = auth.uid());

create policy "event_reminders_delete_own"
  on public.event_reminders for delete to authenticated
  using (user_id = auth.uid());

-- Voice Memories
create policy "voice_memories_select"
  on public.voice_memories for select to authenticated
  using (public.is_family_member(family_id, auth.uid()));

create policy "voice_memories_insert"
  on public.voice_memories for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.is_family_member(family_id, auth.uid())
  );

create policy "voice_memories_update"
  on public.voice_memories for update to authenticated
  using (
    public.is_family_member(family_id, auth.uid())
    and (created_by = auth.uid() or public.family_role(family_id, auth.uid()) in ('owner', 'admin', 'moderator'))
  )
  with check (
    public.is_family_member(family_id, auth.uid())
    and (created_by = auth.uid() or public.family_role(family_id, auth.uid()) in ('owner', 'admin', 'moderator'))
  );

create policy "voice_memories_delete"
  on public.voice_memories for delete to authenticated
  using (
    public.is_family_member(family_id, auth.uid())
    and (created_by = auth.uid() or public.family_role(family_id, auth.uid()) in ('owner', 'admin'))
  );

-- Reunion Plans
create policy "reunion_plans_select"
  on public.reunion_plans for select to authenticated
  using (public.is_family_member(family_id, auth.uid()));

create policy "reunion_plans_insert"
  on public.reunion_plans for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.is_family_member(family_id, auth.uid())
  );

create policy "reunion_plans_update"
  on public.reunion_plans for update to authenticated
  using (
    public.is_family_member(family_id, auth.uid())
    and (created_by = auth.uid() or public.family_role(family_id, auth.uid()) in ('owner', 'admin', 'moderator'))
  )
  with check (
    public.is_family_member(family_id, auth.uid())
    and (created_by = auth.uid() or public.family_role(family_id, auth.uid()) in ('owner', 'admin', 'moderator'))
  );

create policy "reunion_plans_delete"
  on public.reunion_plans for delete to authenticated
  using (
    public.is_family_member(family_id, auth.uid())
    and (created_by = auth.uid() or public.family_role(family_id, auth.uid()) in ('owner', 'admin'))
  );

-- Reunion Participants
create policy "reunion_participants_select"
  on public.reunion_participants for select to authenticated
  using (public.is_family_member(public.reunion_family_id(reunion_id), auth.uid()));

create policy "reunion_participants_insert"
  on public.reunion_participants for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_family_member(public.reunion_family_id(reunion_id), auth.uid())
  );

create policy "reunion_participants_update"
  on public.reunion_participants for update to authenticated
  using (
    user_id = auth.uid()
    or public.family_role(public.reunion_family_id(reunion_id), auth.uid()) in ('owner', 'admin')
  )
  with check (
    user_id = auth.uid()
    or public.family_role(public.reunion_family_id(reunion_id), auth.uid()) in ('owner', 'admin')
  );

create policy "reunion_participants_delete"
  on public.reunion_participants for delete to authenticated
  using (
    user_id = auth.uid()
    or public.family_role(public.reunion_family_id(reunion_id), auth.uid()) in ('owner', 'admin')
  );

-- Reunion Itinerary
create policy "reunion_itinerary_select"
  on public.reunion_itinerary for select to authenticated
  using (public.is_family_member(public.reunion_family_id(reunion_id), auth.uid()));

create policy "reunion_itinerary_manage"
  on public.reunion_itinerary for all to authenticated
  using (public.is_family_member(public.reunion_family_id(reunion_id), auth.uid()))
  with check (public.is_family_member(public.reunion_family_id(reunion_id), auth.uid()));

-- Reunion Tasks
create policy "reunion_tasks_select"
  on public.reunion_tasks for select to authenticated
  using (public.is_family_member(public.reunion_family_id(reunion_id), auth.uid()));

create policy "reunion_tasks_manage"
  on public.reunion_tasks for all to authenticated
  using (public.is_family_member(public.reunion_family_id(reunion_id), auth.uid()))
  with check (public.is_family_member(public.reunion_family_id(reunion_id), auth.uid()));

-- Reunion Expenses
create policy "reunion_expenses_select"
  on public.reunion_expenses for select to authenticated
  using (public.is_family_member(public.reunion_family_id(reunion_id), auth.uid()));

create policy "reunion_expenses_manage"
  on public.reunion_expenses for all to authenticated
  using (public.is_family_member(public.reunion_family_id(reunion_id), auth.uid()))
  with check (public.is_family_member(public.reunion_family_id(reunion_id), auth.uid()));

-- Family Funds
create policy "family_funds_select"
  on public.family_funds for select to authenticated
  using (public.is_family_member(family_id, auth.uid()));

create policy "family_funds_insert"
  on public.family_funds for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.is_family_member(family_id, auth.uid())
    and public.family_role(family_id, auth.uid()) in ('owner', 'admin', 'moderator')
  );

create policy "family_funds_update"
  on public.family_funds for update to authenticated
  using (
    public.is_family_member(family_id, auth.uid())
    and (created_by = auth.uid() or public.family_role(family_id, auth.uid()) in ('owner', 'admin'))
  )
  with check (
    public.is_family_member(family_id, auth.uid())
    and (created_by = auth.uid() or public.family_role(family_id, auth.uid()) in ('owner', 'admin'))
  );

create policy "family_funds_delete"
  on public.family_funds for delete to authenticated
  using (
    public.is_family_member(family_id, auth.uid())
    and public.family_role(family_id, auth.uid()) in ('owner', 'admin')
  );

-- Fund Contributions
create policy "fund_contributions_select"
  on public.fund_contributions for select to authenticated
  using (public.is_family_member(family_id, auth.uid()));

create policy "fund_contributions_insert"
  on public.fund_contributions for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.is_family_member(family_id, auth.uid())
  );

create policy "fund_contributions_update"
  on public.fund_contributions for update to authenticated
  using (
    public.is_family_member(family_id, auth.uid())
    and (
      created_by = auth.uid()
      or contributor_id = auth.uid()
      or public.family_role(family_id, auth.uid()) in ('owner', 'admin', 'moderator')
    )
  )
  with check (
    public.is_family_member(family_id, auth.uid())
    and (
      created_by = auth.uid()
      or contributor_id = auth.uid()
      or public.family_role(family_id, auth.uid()) in ('owner', 'admin', 'moderator')
    )
  );

create policy "fund_contributions_delete"
  on public.fund_contributions for delete to authenticated
  using (
    public.is_family_member(family_id, auth.uid())
    and (created_by = auth.uid() or public.family_role(family_id, auth.uid()) in ('owner', 'admin'))
  );

-- Fund Expenses
create policy "fund_expenses_select"
  on public.fund_expenses for select to authenticated
  using (public.is_family_member(family_id, auth.uid()));

create policy "fund_expenses_insert"
  on public.fund_expenses for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.is_family_member(family_id, auth.uid())
  );

create policy "fund_expenses_update"
  on public.fund_expenses for update to authenticated
  using (
    public.is_family_member(family_id, auth.uid())
    and (created_by = auth.uid() or public.family_role(family_id, auth.uid()) in ('owner', 'admin', 'moderator'))
  )
  with check (
    public.is_family_member(family_id, auth.uid())
    and (created_by = auth.uid() or public.family_role(family_id, auth.uid()) in ('owner', 'admin', 'moderator'))
  );

create policy "fund_expenses_delete"
  on public.fund_expenses for delete to authenticated
  using (
    public.is_family_member(family_id, auth.uid())
    and (created_by = auth.uid() or public.family_role(family_id, auth.uid()) in ('owner', 'admin'))
  );

-- Financial Audit Logs
create policy "financial_audit_logs_select"
  on public.financial_audit_logs for select to authenticated
  using (public.is_family_member(family_id, auth.uid()));

create policy "financial_audit_logs_insert"
  on public.financial_audit_logs for insert to authenticated
  with check (
    actor_id = auth.uid()
    and public.is_family_member(family_id, auth.uid())
  );

-- Realtime publication additions
do $$
begin
  alter publication supabase_realtime add table public.family_tree_members;
exception when duplicate_object then null; when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.family_tree_relationships;
exception when duplicate_object then null; when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.voice_memories;
exception when duplicate_object then null; when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.reunion_plans;
exception when duplicate_object then null; when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.family_funds;
exception when duplicate_object then null; when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.fund_contributions;
exception when duplicate_object then null; when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.fund_expenses;
exception when duplicate_object then null; when undefined_object then null;
end $$;


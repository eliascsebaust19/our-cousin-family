-- ============================================================================
-- Our Cousin Family — Family Ludo engine (docs/ludo-rules.md is the contract)
--
-- Server-authoritative Ludo for 4, 6 or 8 seats:
--   * every dice roll and position change is computed here, in Postgres;
--   * the browser sends intents only (`roll`, `move`, `pass`) — never outcomes;
--   * state lives in `ludo_games.state` (jsonb) under a row lock, with an
--     append-only `ludo_actions` audit trail for replay and disputes;
--   * clients are read-only renderers fed by Realtime.
--
-- Position encoding (relative to each seat, rules §3.2):
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
-- cheat-proof — a member cannot hand-craft a `state` claiming victory.
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
-- Geometry (rules §3) — board dimensions are pure functions of the seat count
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
 * Rules �7.2 � two or more tokens of one colour on a square form a block
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
      return false;                          -- rules �5: a 6 opens the yard
    end if;
    -- Entering your own start square: no path, but the square itself can be
    -- blocked by an opponent's stack.
    return not public.ludo_blocked(p_state, p_seats, v_start, p_seat);
  end if;

  v_to := v_from + p_dice;
  if v_to > v_fin then
    return false;                            -- rules �6: overshoot is illegal
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
 * a non-safe landing square (rules �7.1) and record `lastMove` for the UI.
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

/** Next unfinished seat after `p_from`, wrapping clockwise (rules �9). */
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
language plpgsql security definer set search_path = public, pg_temp
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
      v_byte := get_byte(gen_random_bytes(1), 0);
      exit when v_byte < 240;                -- 240 = 6 x 40 keeps the die fair
    end loop;
    v_dice := (v_byte % 6) + 1;
  end if;

  -- Rules �5: three consecutive sixes forfeit the turn outright.
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
      -- Rules �4: an unusable 6 still buys another roll.
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

  -- Rules �9: play on for placement, stop when only one player is unfinished.
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
    -- Rules �5: a six or a capture buys another roll (dice is kept so the
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

  -- Rules �3.1: 8-seat boards use 3 tokens so blocking stays playable.
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
 * Rules �10 � lazy turn-timer resolution. Any family member may nudge a game;
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
        -- Deterministic: capture > leave the yard > furthest along (rules �10).
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
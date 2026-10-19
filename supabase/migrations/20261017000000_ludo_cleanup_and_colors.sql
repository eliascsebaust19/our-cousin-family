-- ============================================================================
-- Ludo Enhancements: Room Deletion, Leaving, and Color Palette
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Colors: Set seat colors matching clockwise flow on classic boards:
--   Seat 0: Red (top-left)
--   Seat 1: Green (top-right)
--   Seat 2: Yellow (bottom-right)
--   Seat 3: Blue (bottom-left)
-- ----------------------------------------------------------------------------
create or replace function public.ludo_seat_color(p_seat int)
returns text language sql immutable strict set search_path = public, pg_temp
as $$
  select (array['red', 'green', 'yellow', 'blue', 'purple', 'orange', 'teal', 'pink'])[p_seat + 1];
$$;

-- ----------------------------------------------------------------------------
-- Delete game: Allows host or family admin to delete a game room.
-- Cascades automatically to ludo_seats and ludo_actions.
-- ----------------------------------------------------------------------------
create or replace function public.ludo_delete_game(p_game_id uuid)
returns boolean
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  g public.ludo_games%rowtype;
  v_uid uuid := auth.uid();
  v_is_admin boolean;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into g from public.ludo_games where id = p_game_id for update;
  if g.id is null then raise exception 'game_not_found'; end if;

  -- Verify caller is host or family admin/owner
  select exists (
    select 1 from public.family_members
     where family_id = g.family_id
       and user_id = v_uid
       and status = 'active'
       and (role in ('owner', 'admin') or user_id = g.created_by)
  ) into v_is_admin;

  if not coalesce(v_is_admin, false) then
    raise exception 'not_authorized';
  end if;

  delete from public.ludo_games where id = p_game_id;
  return true;
end;
$$;

-- ----------------------------------------------------------------------------
-- Leave game: Allows a player to leave a game when waiting.
-- If the host leaves and no one else is in the game, the game is removed.
-- If others remain, host transfers to the next seated member.
-- ----------------------------------------------------------------------------
create or replace function public.ludo_leave_game(p_game_id uuid)
returns boolean
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  g public.ludo_games%rowtype;
  v_uid uuid := auth.uid();
  v_remaining int;
  v_next_host uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into g from public.ludo_games where id = p_game_id for update;
  if g.id is null then raise exception 'game_not_found'; end if;
  if g.status <> 'waiting' then raise exception 'game_already_started'; end if;

  if not exists (select 1 from public.ludo_seats where game_id = p_game_id and user_id = v_uid) then
    raise exception 'not_seated';
  end if;

  -- Delete this player's seat
  delete from public.ludo_seats where game_id = p_game_id and user_id = v_uid;

  -- Check remaining players
  select count(*) into v_remaining from public.ludo_seats where game_id = p_game_id;
  if v_remaining = 0 then
    -- Nobody left, delete the game room
    delete from public.ludo_games where id = p_game_id;
    return true;
  end if;

  -- If host left, transfer host to next player
  if g.created_by = v_uid then
    select user_id into v_next_host
      from public.ludo_seats
     where game_id = p_game_id
     order by seat asc
     limit 1;

    update public.ludo_games
       set created_by = v_next_host, updated_at = now()
     where id = p_game_id;
  end if;

  return true;
end;
$$;

-- Permissions
revoke execute on function public.ludo_delete_game(uuid) from public, anon;
grant execute on function public.ludo_delete_game(uuid) to authenticated;

revoke execute on function public.ludo_leave_game(uuid) from public, anon;
grant execute on function public.ludo_leave_game(uuid) to authenticated;


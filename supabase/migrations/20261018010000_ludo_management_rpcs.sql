-- ----------------------------------------------------------------------------
-- Ludo Game Management RPCs: delete game, leave game, set autoplay
-- ----------------------------------------------------------------------------

create or replace function public.ludo_delete_game(p_game_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_game public.ludo_games%rowtype;
  v_uid  uuid := auth.uid();
  v_role text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_game
    from public.ludo_games
   where id = p_game_id;

  if v_game.id is null then
    return true;
  end if;

  -- Allow if caller is the game creator or family owner/admin/moderator
  if v_game.created_by = v_uid then
    null;
  else
    select role into v_role
      from public.family_members
     where family_id = v_game.family_id
       and user_id = v_uid
       and status = 'active';

    if v_role not in ('owner', 'admin', 'moderator') then
      raise exception 'not_authorized';
    end if;
  end if;

  -- Cascade delete child records then the game
  delete from public.ludo_actions where game_id = p_game_id;
  delete from public.ludo_seats where game_id = p_game_id;
  delete from public.ludo_games where id = p_game_id;

  return true;
end;
$$;

create or replace function public.ludo_leave_game(p_game_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_game public.ludo_games%rowtype;
  v_uid  uuid := auth.uid();
  v_seat_count int;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_game
    from public.ludo_games
   where id = p_game_id;

  if v_game.id is null then
    return true;
  end if;

  if v_game.status = 'waiting' then
    -- In lobby: remove seat
    delete from public.ludo_seats
     where game_id = p_game_id
       and user_id = v_uid;

    -- If no players left, clean up game room
    select count(*) into v_seat_count
      from public.ludo_seats
     where game_id = p_game_id;

    if v_seat_count = 0 then
      delete from public.ludo_actions where game_id = p_game_id;
      delete from public.ludo_games where id = p_game_id;
    end if;
  else
    -- In playing game: set autoplay on so the room is not stuck
    update public.ludo_seats
       set autoplay = true
     where game_id = p_game_id
       and user_id = v_uid;

    if v_game.status = 'playing' then
      perform public.ludo_auto_resolve(p_game_id);
    end if;
  end if;

  return true;
end;
$$;

create or replace function public.ludo_set_autoplay(p_game_id uuid, p_autoplay boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_game public.ludo_games%rowtype;
  v_uid  uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_game
    from public.ludo_games
   where id = p_game_id;

  if v_game.id is null then
    raise exception 'game_not_found';
  end if;

  update public.ludo_seats
     set autoplay = p_autoplay
   where game_id = p_game_id
     and user_id = v_uid;

  if p_autoplay and v_game.status = 'playing' then
    perform public.ludo_auto_resolve(p_game_id);
  end if;
end;
$$;

grant execute on function public.ludo_delete_game(uuid) to authenticated;
grant execute on function public.ludo_leave_game(uuid) to authenticated;
grant execute on function public.ludo_set_autoplay(uuid, boolean) to authenticated;


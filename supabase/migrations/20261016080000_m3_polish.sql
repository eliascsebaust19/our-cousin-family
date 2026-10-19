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


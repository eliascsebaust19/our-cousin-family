-- ============================================================================
-- Our Cousin Family — reporting helpers used by the app shell
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

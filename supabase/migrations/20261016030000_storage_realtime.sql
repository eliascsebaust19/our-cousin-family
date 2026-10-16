-- ============================================================================
-- Our Cousin Family — Storage buckets, storage RLS, realtime publication
--
-- Path conventions (enforced by storage policies — the FIRST folder is the id):
--   avatars:          {user_id}/{filename}
--   post-media:       {family_id}/{post_id}/{filename}
--   chat-attachments: {conversation_id}/{filename}
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Buckets (private — access is granted per-row by policies below)
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

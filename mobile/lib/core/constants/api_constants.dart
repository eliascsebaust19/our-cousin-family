class ApiConstants {
  ApiConstants._();

  // Supabase Storage Buckets
  static const String avatarsBucket = 'avatars';
  static const String familyCoversBucket = 'family-covers';
  static const String postMediaBucket = 'post-media';
  static const String memoryVaultBucket = 'memory-vault';
  static const String voiceRecordingsBucket = 'voice-recordings';
  static const String chatAttachmentsBucket = 'chat-attachments';

  // Supabase Realtime Channels
  static const String feedChannel = 'family-feed';
  static const String chatChannel = 'chat-messages';
  static const String notificationsChannel = 'notifications';
  static const String gameChannel = 'game-state';
  static const String presenceChannel = 'presence';
  static const String typingChannel = 'typing';

  // Supabase Table Names
  static const String profilesTable = 'profiles';
  static const String familiesTable = 'families';
  static const String familyMembersTable = 'family_members';
  static const String familyInvitationsTable = 'family_invitations';
  static const String familyRelationshipsTable = 'family_relationships';
  static const String postsTable = 'posts';
  static const String postMediaTable = 'post_media';
  static const String commentsTable = 'comments';
  static const String postLikesTable = 'post_likes';
  static const String memoryAlbumsTable = 'memory_albums';
  static const String memoriesTable = 'memories';
  static const String conversationsTable = 'conversations';
  static const String conversationMembersTable = 'conversation_members';
  static const String messagesTable = 'messages';
  static const String eventsTable = 'events';
  static const String eventParticipantsTable = 'event_participants';
  static const String notificationsTable = 'notifications';
  static const String gameRoomsTable = 'game_rooms';
  static const String gamePlayersTable = 'game_players';
  static const String gameEventsTable = 'game_events';
  static const String voiceMemoriesTable = 'voice_memories';
  static const String userSettingsTable = 'user_settings';

  // Supabase RPC Functions
  static const String joinFamilyRpc = 'join_family_by_code';
  static const String approveMemberRpc = 'approve_member';
  static const String removeMemberRpc = 'remove_member';
  static const String sendMessageRpc = 'send_message';
  static const String markReadRpc = 'mark_conversation_read';
  static const String rollDiceRpc = 'roll_dice';
  static const String makeMoveRpc = 'make_move';
  static const String joinGameRpc = 'join_game_room';
  static const String createGameRpc = 'create_game_room';
  static const String startGameRpc = 'start_game';
}
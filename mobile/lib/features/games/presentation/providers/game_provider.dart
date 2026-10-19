import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../../shared/models/game.dart';
import '../../../../shared/providers/auth_provider.dart';
import '../../../../core/constants/api_constants.dart';

final gameRoomsProvider = FutureProvider<List<GameRoom>>((ref) async {
  final client = Supabase.instance.client;
  final userId = ref.watch(currentUserIdProvider);
  if (userId == null) return [];

  final response = await client
      .from(ApiConstants.gameRoomsTable)
      .select('*, game_players(*, profiles(*))')
      .order('created_at', ascending: false)
      .limit(20);

  return (response as List).map((r) => GameRoom.fromJson(r)).toList();
});

final gameRoomProvider =
    FutureProvider.family<GameRoom?, String>((ref, roomId) async {
  final client = Supabase.instance.client;

  final response = await client
      .from(ApiConstants.gameRoomsTable)
      .select('*, game_players(*, profiles(*))')
      .eq('id', roomId)
      .maybeSingle();

  if (response == null) return null;
  return GameRoom.fromJson(response);
});
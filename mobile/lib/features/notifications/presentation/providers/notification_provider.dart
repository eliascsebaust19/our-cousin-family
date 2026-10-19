import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../../shared/providers/auth_provider.dart';
import '../../../../core/constants/api_constants.dart';

final unreadNotificationCountProvider = StreamProvider<int>((ref) {
  final userId = ref.watch(currentUserIdProvider);
  if (userId == null) return Stream.value(0);

  final client = Supabase.instance.client;

  // Initial count
  final initialCount = client
      .from(ApiConstants.notificationsTable)
      .select()
      .eq('user_id', userId)
      .eq('is_read', false)
      .count()
      .then((response) => response.count ?? 0);

  // Stream for realtime updates
  final channel = client
      .channel('notifications:$userId')
      .onPostgresChanges(
        event: PostgresChangeEvent.insert,
        schema: 'public',
        table: ApiConstants.notificationsTable,
        filter: PostgresChangeFilter(
          type: PostgresChangeFilterType.eq,
          column: 'user_id',
          value: userId,
        ),
        callback: (_) {},
      )
      .subscribe();

  ref.onDispose(() => channel.unsubscribe());

  return Stream.fromFuture(initialCount);
});
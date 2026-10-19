import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../../shared/models/event.dart';
import '../../../../shared/providers/auth_provider.dart';
import '../../../../shared/providers/family_provider.dart';
import '../../../../core/constants/api_constants.dart';

final upcomingEventsProvider = FutureProvider<List<FamilyEvent>>((ref) async {
  final familyId = ref.watch(activeFamilyIdProvider);
  if (familyId == null) return [];

  final client = Supabase.instance.client;
  final response = await client
      .from(ApiConstants.eventsTable)
      .select('*, profiles(*), event_participants(*, profiles(*))')
      .eq('family_id', familyId)
      .gte('start_date', DateTime.now().toIso8601String())
      .order('start_date', ascending: true)
      .limit(10);

  return (response as List).map((e) => FamilyEvent.fromJson(e)).toList();
});

final eventsForDateProvider =
    FutureProvider.family<List<FamilyEvent>, DateTime>((ref, date) async {
  final familyId = ref.watch(activeFamilyIdProvider);
  if (familyId == null) return [];

  final startOfDay = DateTime(date.year, date.month, date.day);
  final endOfDay = startOfDay.add(const Duration(days: 1));

  final client = Supabase.instance.client;
  final response = await client
      .from(ApiConstants.eventsTable)
      .select('*, profiles(*), event_participants(*, profiles(*))')
      .eq('family_id', familyId)
      .gte('start_date', startOfDay.toIso8601String())
      .lt('start_date', endOfDay.toIso8601String())
      .order('start_date', ascending: true);

  return (response as List).map((e) => FamilyEvent.fromJson(e)).toList();
});
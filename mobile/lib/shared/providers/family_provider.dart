import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/family.dart';
import 'auth_provider.dart';

/// User's active family (the one they're currently viewing)
final activeFamilyIdProvider = StateProvider<String?>((ref) => null);

/// User's families
final userFamiliesProvider = FutureProvider<List<Family>>((ref) async {
  final userId = ref.watch(currentUserIdProvider);
  if (userId == null) return [];

  final client = Supabase.instance.client;
  final response = await client
      .from('family_members')
      .select('families(*)')
      .eq('user_id', userId)
      .order('joined_at', ascending: false);

  return (response as List)
      .map((item) => Family.fromJson(item['families'] as Map<String, dynamic>))
      .toList();
});

/// Active family details
final activeFamilyProvider = FutureProvider<Family?>((ref) async {
  final familyId = ref.watch(activeFamilyIdProvider);
  if (familyId == null) return null;

  final client = Supabase.instance.client;
  final response =
      await client.from('families').select().eq('id', familyId).maybeSingle();

  if (response == null) return null;
  return Family.fromJson(response);
});

/// Family members
final familyMembersProvider =
    FutureProvider.family<List<FamilyMember>, String>((ref, familyId) async {
  final client = Supabase.instance.client;
  final response = await client
      .from('family_members')
      .select('*, profiles(*)')
      .eq('family_id', familyId)
      .order('joined_at', ascending: true);

  return (response as List)
      .map((m) => FamilyMember.fromJson(m as Map<String, dynamic>))
      .toList();
});

/// Current user's role in the active family
final currentFamilyRoleProvider = FutureProvider<FamilyRole?>((ref) async {
  final familyId = ref.watch(activeFamilyIdProvider);
  final userId = ref.watch(currentUserIdProvider);
  if (familyId == null || userId == null) return null;

  final client = Supabase.instance.client;
  final response = await client
      .from('family_members')
      .select('role')
      .eq('family_id', familyId)
      .eq('user_id', userId)
      .maybeSingle();

  if (response == null) return null;
  return familyRoleFromString(response['role'] as String);
});
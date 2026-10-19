import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/user_profile.dart';
import '../../features/auth/data/repositories/auth_repository.dart';

/// Current Supabase auth session
final authSessionProvider = StreamProvider<AuthState?>((ref) {
  final client = Supabase.instance.client;
  return client.auth.onAuthStateChange;
});

/// Current user ID
final currentUserIdProvider = Provider<String?>((ref) {
  final session = ref.watch(authSessionProvider);
  return session.whenData((state) => state?.session?.user.id).valueOrNull;
});

/// Current user profile
final currentUserProfileProvider = FutureProvider<UserProfile?>((ref) async {
  final userId = ref.watch(currentUserIdProvider);
  if (userId == null) return null;
  final repo = ref.watch(authRepositoryProvider);
  return repo.getProfile(userId);
});

/// Auth repository provider
final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(Supabase.instance.client);
});

/// Whether user is authenticated
final isAuthenticatedProvider = Provider<bool>((ref) {
  final session = ref.watch(authSessionProvider);
  return session.whenData((state) => state?.session != null).valueOrNull ??
      false;
});
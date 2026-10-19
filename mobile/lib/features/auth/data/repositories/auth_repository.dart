import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../../shared/models/user_profile.dart';
import '../../../../core/errors/app_exception.dart';

class AuthRepository {
  final SupabaseClient _client;

  AuthRepository(this._client);

  /// Get current user session
  Session? get currentSession => _client.auth.currentSession;

  /// Get current user ID
  String? get currentUserId => _client.auth.currentUser?.id;

  /// Check if user is logged in
  bool get isLoggedIn => currentSession != null;

  /// Sign up with email and password
  Future<AuthResponse> signUp({
    required String email,
    required String password,
    required String fullName,
  }) async {
    try {
      final response = await _client.auth.signUp(
        email: email,
        password: password,
        data: {'full_name': fullName},
      );
      return response;
    } on AuthException catch (e) {
      throw AppErrorHandler.handleAuthError(e);
    } catch (e) {
      throw AuthException(message: e.toString());
    }
  }

  /// Sign in with email and password
  Future<AuthResponse> signIn({
    required String email,
    required String password,
  }) async {
    try {
      final response = await _client.auth.signInWithPassword(
        email: email,
        password: password,
      );
      return response;
    } on AuthException catch (e) {
      throw AppErrorHandler.handleAuthError(e);
    } catch (e) {
      throw AuthException(message: e.toString());
    }
  }

  /// Sign in with Google
  Future<bool> signInWithGoogle() async {
    try {
      return await _client.auth.signInWithOAuth(
        OAuthProvider.google,
        redirectTo: 'com.ourcousinfamily://login-callback',
      );
    } on AuthException catch (e) {
      throw AppErrorHandler.handleAuthError(e);
    } catch (e) {
      throw AuthException(message: e.toString());
    }
  }

  /// Sign out
  Future<void> signOut() async {
    try {
      await _client.auth.signOut();
    } catch (e) {
      throw AuthException(message: 'Failed to sign out: ${e.toString()}');
    }
  }

  /// Send password reset email
  Future<void> sendPasswordReset(String email) async {
    try {
      await _client.auth.resetPasswordForEmail(email);
    } on AuthException catch (e) {
      throw AppErrorHandler.handleAuthError(e);
    } catch (e) {
      throw AuthException(message: e.toString());
    }
  }

  /// Update password
  Future<void> updatePassword(String newPassword) async {
    try {
      await _client.auth.updateUser(
        UserAttributes(password: newPassword),
      );
    } on AuthException catch (e) {
      throw AppErrorHandler.handleAuthError(e);
    } catch (e) {
      throw AuthException(message: e.toString());
    }
  }

  /// Get user profile by ID
  Future<UserProfile?> getProfile(String userId) async {
    try {
      final response = await _client
          .from('profiles')
          .select()
          .eq('id', userId)
          .maybeSingle();

      if (response == null) return null;
      return UserProfile.fromJson(response);
    } catch (e) {
      throw ServerException(message: 'Failed to get profile: ${e.toString()}');
    }
  }

  /// Update user profile
  Future<UserProfile> updateProfile({
    required String userId,
    String? fullName,
    String? avatarUrl,
    String? bio,
    String? phoneNumber,
    DateTime? dateOfBirth,
    String? location,
  }) async {
    try {
      final data = <String, dynamic>{
        'updated_at': DateTime.now().toIso8601String(),
      };
      if (fullName != null) data['full_name'] = fullName;
      if (avatarUrl != null) data['avatar_url'] = avatarUrl;
      if (bio != null) data['bio'] = bio;
      if (phoneNumber != null) data['phone_number'] = phoneNumber;
      if (dateOfBirth != null) {
        data['date_of_birth'] = dateOfBirth.toIso8601String();
      }
      if (location != null) data['location'] = location;

      final response = await _client
          .from('profiles')
          .update(data)
          .eq('id', userId)
          .select()
          .single();

      return UserProfile.fromJson(response);
    } catch (e) {
      throw ServerException(
        message: 'Failed to update profile: ${e.toString()}',
      );
    }
  }

  /// Create initial profile after signup
  Future<UserProfile> createProfile({
    required String userId,
    required String email,
    required String fullName,
  }) async {
    try {
      final response = await _client
          .from('profiles')
          .upsert({
            'id': userId,
            'email': email,
            'full_name': fullName,
          })
          .select()
          .single();

      return UserProfile.fromJson(response);
    } catch (e) {
      throw ServerException(
        message: 'Failed to create profile: ${e.toString()}',
      );
    }
  }

  /// Listen to auth state changes
  Stream<AuthState> get authStateChanges => _client.auth.onAuthStateChange;
}
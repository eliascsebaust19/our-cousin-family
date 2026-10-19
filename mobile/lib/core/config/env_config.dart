import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Centralized environment configuration.
/// Reads from compile-time defines or secure storage.
class EnvConfig {
  EnvConfig._();

  static const String _supabaseUrlKey = 'SUPABASE_URL';
  static const String _supabaseAnonKeyKey = 'SUPABASE_ANON_KEY';
  static const String _livekitUrlKey = 'LIVEKIT_URL';
  static const String _googleClientIdKey = 'GOOGLE_CLIENT_ID';

  static const FlutterSecureStorage _storage = FlutterSecureStorage();

  // Supabase
  static String get supabaseUrl =>
      const String.fromEnvironment(_supabaseUrlKey).isNotEmpty
          ? const String.fromEnvironment(_supabaseUrlKey)
          : '';

  static String get supabaseAnonKey =>
      const String.fromEnvironment(_supabaseAnonKeyKey).isNotEmpty
          ? const String.fromEnvironment(_supabaseAnonKeyKey)
          : '';

  // LiveKit
  static String get livekitUrl =>
      const String.fromEnvironment(_livekitUrlKey, defaultValue: '');

  // Google Drive
  static String get googleClientId =>
      const String.fromEnvironment(_googleClientIdKey, defaultValue: '');

  static bool get isSupabaseConfigured =>
      supabaseUrl.isNotEmpty && supabaseAnonKey.isNotEmpty;

  static bool get isLivekitConfigured => livekitUrl.isNotEmpty;

  static bool get isGoogleDriveConfigured => googleClientId.isNotEmpty;

  /// Store a value securely
  static Future<void> setSecure(String key, String value) async {
    await _storage.write(key: key, value: value);
  }

  /// Read a secure value
  static Future<String?> getSecure(String key) async {
    return _storage.read(key: key);
  }

  /// Delete a secure value
  static Future<void> deleteSecure(String key) async {
    await _storage.delete(key: key);
  }

  /// Clear all secure storage
  static Future<void> clearAll() async {
    await _storage.deleteAll();
  }
}
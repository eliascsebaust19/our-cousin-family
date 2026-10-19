class AppConstants {
  AppConstants._();

  // App Info
  static const String appName = 'Our Cousin Family';
  static const String appVersion = '1.0.0';
  static const String appBuildNumber = '1';

  // Pagination
  static const int defaultPageSize = 20;
  static const int feedPageSize = 15;
  static const int chatPageSize = 30;
  static const int searchPageSize = 25;

  // File Limits
  static const int maxImageSizeMB = 10;
  static const int maxVideoSizeMB = 50;
  static const int maxAudioSizeMB = 20;
  static const int maxDocumentSizeMB = 25;
  static const int imageQuality = 85;
  static const int maxImageWidth = 1920;
  static const int maxImageHeight = 1080;

  // Invitation
  static const int invitationCodeLength = 8;
  static const int invitationExpiryDays = 7;

  // Game
  static const int ludoMinPlayers = 2;
  static const int ludoMaxPlayers = 4;
  static const int ludoTurnTimeoutSeconds = 30;

  // Chat
  static const int typingTimeoutSeconds = 3;
  static const int maxMessageLength = 5000;

  // Cache
  static const Duration cacheExpiry = Duration(hours: 24);
  static const Duration imageCacheExpiry = Duration(days: 7);

  // Animation Durations
  static const Duration shortAnimation = Duration(milliseconds: 200);
  static const Duration mediumAnimation = Duration(milliseconds: 350);
  static const Duration longAnimation = Duration(milliseconds: 500);

  // Date Formats
  static const String dateFormat = 'MMM dd, yyyy';
  static const String timeFormat = 'hh:mm a';
  static const String dateTimeFormat = 'MMM dd, yyyy hh:mm a';
  static const String apiDateFormat = 'yyyy-MM-dd';
  static const String apiDateTimeFormat = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'";

  // Routes
  static const String onboardingRoute = '/onboarding';
  static const String loginRoute = '/login';
  static const String signupRoute = '/signup';
  static const String forgotPasswordRoute = '/forgot-password';
  static const String resetPasswordRoute = '/reset-password';
  static const String homeRoute = '/home';
  static const String familyRoute = '/family';
  static const String memoriesRoute = '/memories';
  static const String chatRoute = '/chat';
  static const String profileRoute = '/profile';
  static const String settingsRoute = '/settings';
  static const String notificationsRoute = '/notifications';
  static const String gamesRoute = '/games';
  static const String eventsRoute = '/events';
  static const String voiceArchiveRoute = '/voice-archive';
  static const String familyTreeRoute = '/family-tree';
  static const String callsRoute = '/calls';
}
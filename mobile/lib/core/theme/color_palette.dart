import 'package:flutter/material.dart';

/// Family-inspired warm color palette
class ColorPalette {
  ColorPalette._();

  // ── Primary: Warm coral/terracotta ──
  static const Color primary = Color(0xFFE07A5F);
  static const Color primaryDark = Color(0xFFC4593F);
  static const Color primaryLight = Color(0xFFF4A58A);
  static const Color primaryExtraLight = Color(0xFFFCE8E1);

  // ── Secondary: Warm gold ──
  static const Color secondary = Color(0xFFF2CC8F);
  static const Color secondaryDark = Color(0xFFD4A85C);
  static const Color secondaryLight = Color(0xFFF8DDB5);
  static const Color secondaryExtraLight = Color(0xFFFDF5E6);

  // ── Tertiary: Sage green ──
  static const Color tertiary = Color(0xFF81B29A);
  static const Color tertiaryDark = Color(0xFF5E9478);
  static const Color tertiaryLight = Color(0xFFA8D5BA);
  static const Color tertiaryExtraLight = Color(0xFFE5F2EB);

  // ── Accent: Warm purple ──
  static const Color accent = Color(0xFF9B72AA);
  static const Color accentLight = Color(0xFFC8A8D4);

  // ── Light Theme ──
  static const Color backgroundLight = Color(0xFFFBF8F5);
  static const Color surfaceLight = Colors.white;
  static const Color surfaceVariantLight = Color(0xFFF5F0EB);
  static const Color textPrimaryLight = Color(0xFF2D2D2D);
  static const Color textSecondaryLight = Color(0xFF7A7A7A);
  static const Color textTertiaryLight = Color(0xFFABABAB);
  static const Color dividerLight = Color(0xFFE8E0D8);

  // ── Dark Theme ──
  static const Color backgroundDark = Color(0xFF1A1614);
  static const Color surfaceDark = Color(0xFF252019);
  static const Color surfaceVariantDark = Color(0xFF332D26);
  static const Color textPrimaryDark = Color(0xFFF5F0EB);
  static const Color textSecondaryDark = Color(0xFFB0A89E);
  static const Color textTertiaryDark = Color(0xFF7A736B);
  static const Color dividerDark = Color(0xFF3D362E);

  // ── Semantic Colors ──
  static const Color success = Color(0xFF4CAF50);
  static const Color successLight = Color(0xFF81C784);
  static const Color error = Color(0xFFE57373);
  static const Color errorLight = Color(0xFFEF9A9A);
  static const Color warning = Color(0xFFFFB74D);
  static const Color warningLight = Color(0xFFFFCC80);
  static const Color info = Color(0xFF64B5F6);
  static const Color infoLight = Color(0xFF90CAF9);

  // ── Game Colors (Ludo) ──
  static const Color ludoRed = Color(0xFFE53935);
  static const Color ludoBlue = Color(0xFF1E88E5);
  static const Color ludoGreen = Color(0xFF43A047);
  static const Color ludoYellow = Color(0xFFFDD835);
  static const Color ludoOrange = Color(0xFFFF6D00);
  static const Color ludoPurple = Color(0xFF8E24AA);
  static const Color ludoPink = Color(0xFFEC407A);
  static const Color ludoCyan = Color(0xFF00ACC1);

  // ── Gradient Presets ──
  static const LinearGradient primaryGradient = LinearGradient(
    colors: [primary, primaryLight],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient warmGradient = LinearGradient(
    colors: [Color(0xFFF2CC8F), Color(0xFFE07A5F)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient sageGradient = LinearGradient(
    colors: [Color(0xFF81B29A), Color(0xFF3D405B)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient sunsetGradient = LinearGradient(
    colors: [Color(0xFFFF6B6B), Color(0xFFFFA07A), Color(0xFFFFD93D)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient nightGradient = LinearGradient(
    colors: [Color(0xFF1A1614), Color(0xFF2D2D2D)],
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
  );

  // ── Avatar Colors ──
  static const List<Color> avatarColors = [
    Color(0xFFE07A5F),
    Color(0xFF81B29A),
    Color(0xFFF2CC8F),
    Color(0xFF9B72AA),
    Color(0xFF3D405B),
    Color(0xFFE53935),
    Color(0xFF1E88E5),
    Color(0xFF43A047),
    Color(0xFFFF6D00),
    Color(0xFF00ACC1),
  ];

  /// Get a consistent color for a user based on their ID
  static Color colorForUser(String userId) {
    final hash = userId.hashCode.abs();
    return avatarColors[hash % avatarColors.length];
  }
}
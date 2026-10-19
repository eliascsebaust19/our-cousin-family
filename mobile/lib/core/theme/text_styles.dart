import 'package:flutter/material.dart';
import 'color_palette.dart';

class AppTextStyles {
  AppTextStyles._();

  static const String _fontFamily = 'Nunito';

  // ── Light Theme Text Styles ──
  static const TextTheme textTheme = TextTheme(
    displayLarge: TextStyle(
      fontFamily: _fontFamily,
      fontSize: 32,
      fontWeight: FontWeight.w800,
      color: ColorPalette.textPrimaryLight,
      letterSpacing: -0.5,
      height: 1.2,
    ),
    displayMedium: TextStyle(
      fontFamily: _fontFamily,
      fontSize: 28,
      fontWeight: FontWeight.w700,
      color: ColorPalette.textPrimaryLight,
      letterSpacing: -0.3,
      height: 1.25,
    ),
    displaySmall: TextStyle(
      fontFamily: _fontFamily,
      fontSize: 24,
      fontWeight: FontWeight.w700,
      color: ColorPalette.textPrimaryLight,
      height: 1.3,
    ),
    headlineLarge: TextStyle(
      fontFamily: _fontFamily,
      fontSize: 22,
      fontWeight: FontWeight.w700,
      color: ColorPalette.textPrimaryLight,
      height: 1.3,
    ),
    headlineMedium: TextStyle(
      fontFamily: _fontFamily,
      fontSize: 20,
      fontWeight: FontWeight.w600,
      color: ColorPalette.textPrimaryLight,
      height: 1.35,
    ),
    headlineSmall: TextStyle(
      fontFamily: _fontFamily,
      fontSize: 18,
      fontWeight: FontWeight.w600,
      color: ColorPalette.textPrimaryLight,
      height: 1.35,
    ),
    titleLarge: TextStyle(
      fontFamily: _fontFamily,
      fontSize: 18,
      fontWeight: FontWeight.w700,
      color: ColorPalette.textPrimaryLight,
      height: 1.4,
    ),
    titleMedium: TextStyle(
      fontFamily: _fontFamily,
      fontSize: 16,
      fontWeight: FontWeight.w600,
      color: ColorPalette.textPrimaryLight,
      height: 1.4,
    ),
    titleSmall: TextStyle(
      fontFamily: _fontFamily,
      fontSize: 14,
      fontWeight: FontWeight.w600,
      color: ColorPalette.textPrimaryLight,
      height: 1.4,
    ),
    bodyLarge: TextStyle(
      fontFamily: _fontFamily,
      fontSize: 16,
      fontWeight: FontWeight.w400,
      color: ColorPalette.textPrimaryLight,
      height: 1.5,
    ),
    bodyMedium: TextStyle(
      fontFamily: _fontFamily,
      fontSize: 14,
      fontWeight: FontWeight.w400,
      color: ColorPalette.textPrimaryLight,
      height: 1.5,
    ),
    bodySmall: TextStyle(
      fontFamily: _fontFamily,
      fontSize: 12,
      fontWeight: FontWeight.w400,
      color: ColorPalette.textSecondaryLight,
      height: 1.5,
    ),
    labelLarge: TextStyle(
      fontFamily: _fontFamily,
      fontSize: 14,
      fontWeight: FontWeight.w600,
      color: ColorPalette.textPrimaryLight,
      height: 1.4,
    ),
    labelMedium: TextStyle(
      fontFamily: _fontFamily,
      fontSize: 12,
      fontWeight: FontWeight.w600,
      color: ColorPalette.textSecondaryLight,
      height: 1.4,
    ),
    labelSmall: TextStyle(
      fontFamily: _fontFamily,
      fontSize: 10,
      fontWeight: FontWeight.w600,
      color: ColorPalette.textSecondaryLight,
      height: 1.4,
    ),
  );

  // ── Dark Theme Text Styles ──
  static const TextTheme darkTextTheme = TextTheme(
    displayLarge: TextStyle(
      fontFamily: _fontFamily,
      fontSize: 32,
      fontWeight: FontWeight.w800,
      color: ColorPalette.textPrimaryDark,
      letterSpacing: -0.5,
      height: 1.2,
    ),
    displayMedium: TextStyle(
      fontFamily: _fontFamily,
      fontSize: 28,
      fontWeight: FontWeight.w700,
      color: ColorPalette.textPrimaryDark,
      letterSpacing: -0.3,
      height: 1.25,
    ),
    displaySmall: TextStyle(
      fontFamily: _fontFamily,
      fontSize: 24,
      fontWeight: FontWeight.w700,
      color: ColorPalette.textPrimaryDark,
      height: 1.3,
    ),
    headlineLarge: TextStyle(
      fontFamily: _fontFamily,
      fontSize: 22,
      fontWeight: FontWeight.w700,
      color: ColorPalette.textPrimaryDark,
      height: 1.3,
    ),
    headlineMedium: TextStyle(
      fontFamily: _fontFamily,
      fontSize: 20,
      fontWeight: FontWeight.w600,
      color: ColorPalette.textPrimaryDark,
      height: 1.35,
    ),
    headlineSmall: TextStyle(
      fontFamily: _fontFamily,
      fontSize: 18,
      fontWeight: FontWeight.w600,
      color: ColorPalette.textPrimaryDark,
      height: 1.35,
    ),
    titleLarge: TextStyle(
      fontFamily: _fontFamily,
      fontSize: 18,
      fontWeight: FontWeight.w700,
      color: ColorPalette.textPrimaryDark,
      height: 1.4,
    ),
    titleMedium: TextStyle(
      fontFamily: _fontFamily,
      fontSize: 16,
      fontWeight: FontWeight.w600,
      color: ColorPalette.textPrimaryDark,
      height: 1.4,
    ),
    titleSmall: TextStyle(
      fontFamily: _fontFamily,
      fontSize: 14,
      fontWeight: FontWeight.w600,
      color: ColorPalette.textPrimaryDark,
      height: 1.4,
    ),
    bodyLarge: TextStyle(
      fontFamily: _fontFamily,
      fontSize: 16,
      fontWeight: FontWeight.w400,
      color: ColorPalette.textPrimaryDark,
      height: 1.5,
    ),
    bodyMedium: TextStyle(
      fontFamily: _fontFamily,
      fontSize: 14,
      fontWeight: FontWeight.w400,
      color: ColorPalette.textPrimaryDark,
      height: 1.5,
    ),
    bodySmall: TextStyle(
      fontFamily: _fontFamily,
      fontSize: 12,
      fontWeight: FontWeight.w400,
      color: ColorPalette.textSecondaryDark,
      height: 1.5,
    ),
    labelLarge: TextStyle(
      fontFamily: _fontFamily,
      fontSize: 14,
      fontWeight: FontWeight.w600,
      color: ColorPalette.textPrimaryDark,
      height: 1.4,
    ),
    labelMedium: TextStyle(
      fontFamily: _fontFamily,
      fontSize: 12,
      fontWeight: FontWeight.w600,
      color: ColorPalette.textSecondaryDark,
      height: 1.4,
    ),
    labelSmall: TextStyle(
      fontFamily: _fontFamily,
      fontSize: 10,
      fontWeight: FontWeight.w600,
      color: ColorPalette.textSecondaryDark,
      height: 1.4,
    ),
  );

  // ── Convenience aliases ──
  static TextStyle get displayL => textTheme.displayLarge!;
  static TextStyle get displayM => textTheme.displayMedium!;
  static TextStyle get displayS => textTheme.displaySmall!;
  static TextStyle get headlineL => textTheme.headlineLarge!;
  static TextStyle get headlineM => textTheme.headlineMedium!;
  static TextStyle get headlineS => textTheme.headlineSmall!;
  static TextStyle get titleL => textTheme.titleLarge!;
  static TextStyle get titleM => textTheme.titleMedium!;
  static TextStyle get titleS => textTheme.titleSmall!;
  static TextStyle get bodyL => textTheme.bodyLarge!;
  static TextStyle get bodyM => textTheme.bodyMedium!;
  static TextStyle get bodyS => textTheme.bodySmall!;
  static TextStyle get labelL => textTheme.labelLarge!;
  static TextStyle get labelM => textTheme.labelMedium!;
  static TextStyle get labelS => textTheme.labelSmall!;
}
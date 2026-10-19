import 'package:flutter_test/flutter_test.dart';

/// Simple validation utilities for testing
class Validator {
  static String? validateEmail(String? value) {
    if (value == null || value.trim().isEmpty) return 'Email is required';
    if (!value.contains('@') || !value.contains('.')) {
      return 'Invalid email address';
    }
    return null;
  }

  static String? validatePassword(String? value) {
    if (value == null || value.isEmpty) return 'Password is required';
    if (value.length < 8) return 'Password must be at least 8 characters';
    return null;
  }

  static String? validateName(String? value) {
    if (value == null || value.trim().isEmpty) return 'Name is required';
    if (value.trim().length < 2) return 'Name must be at least 2 characters';
    return null;
  }

  static String? validateConfirmPassword(String? password, String? confirm) {
    if (confirm == null || confirm.isEmpty) return 'Please confirm password';
    if (password != confirm) return 'Passwords do not match';
    return null;
  }

  static bool isValidInvitationCode(String code) {
    return code.length >= 6 && code.length <= 20 && RegExp(r'^[A-Za-z0-9]+$').hasMatch(code);
  }
}

void main() {
  group('Email Validation', () {
    test('returns null for valid email', () {
      expect(Validator.validateEmail('test@example.com'), null);
    });

    test('returns error for empty email', () {
      expect(Validator.validateEmail(''), 'Email is required');
    });

    test('returns error for null email', () {
      expect(Validator.validateEmail(null), 'Email is required');
    });

    test('returns error for invalid email', () {
      expect(Validator.validateEmail('notanemail'), 'Invalid email address');
    });

    test('returns error for email without domain', () {
      expect(Validator.validateEmail('test@'), 'Invalid email address');
    });
  });

  group('Password Validation', () {
    test('returns null for valid password', () {
      expect(Validator.validatePassword('password123'), null);
    });

    test('returns error for empty password', () {
      expect(Validator.validatePassword(''), 'Password is required');
    });

    test('returns error for short password', () {
      expect(Validator.validatePassword('short'), 'Password must be at least 8 characters');
    });

    test('returns error for null password', () {
      expect(Validator.validatePassword(null), 'Password is required');
    });
  });

  group('Name Validation', () {
    test('returns null for valid name', () {
      expect(Validator.validateName('John Doe'), null);
    });

    test('returns error for empty name', () {
      expect(Validator.validateName(''), 'Name is required');
    });

    test('returns error for single character name', () {
      expect(Validator.validateName('A'), 'Name must be at least 2 characters');
    });
  });

  group('Confirm Password Validation', () {
    test('returns null when passwords match', () {
      expect(
        Validator.validateConfirmPassword('password123', 'password123'),
        null,
      );
    });

    test('returns error when passwords do not match', () {
      expect(
        Validator.validateConfirmPassword('password123', 'different'),
        'Passwords do not match',
      );
    });

    test('returns error for empty confirm', () {
      expect(
        Validator.validateConfirmPassword('password123', ''),
        'Please confirm password',
      );
    });
  });

  group('Invitation Code Validation', () {
    test('valid codes pass', () {
      expect(Validator.isValidInvitationCode('ABC123'), true);
      expect(Validator.isValidInvitationCode('XYZABC78'), true);
    });

    test('too short codes fail', () {
      expect(Validator.isValidInvitationCode('AB'), false);
    });

    test('codes with special characters fail', () {
      expect(Validator.isValidInvitationCode('ABC-123'), false);
      expect(Validator.isValidInvitationCode('ABC 123'), false);
    });
  });
}
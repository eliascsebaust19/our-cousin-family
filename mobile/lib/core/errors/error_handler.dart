import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app_exception.dart';

/// Global error handler that converts raw exceptions into typed AppExceptions
class ErrorHandler {
  ErrorHandler._();

  static AppException handle(dynamic error, [StackTrace? stackTrace]) {
    if (kDebugMode) {
      print('ErrorHandler: $error');
      if (stackTrace != null) print(stackTrace);
    }

    if (error is AppException) return error;

    if (error is SocketException) {
      return const NetworkException(
        message: 'No internet connection. Please check your network.',
      );
    }

    if (error is TimeoutException) {
      return const TimeoutException();
    }

    if (error is HttpException) {
      return NetworkException(message: error.message);
    }

    if (error is AuthException) {
      return AppErrorHandler.handleAuthError(error);
    }

    if (error is PostgrestException) {
      return AppErrorHandler.handlePostgrestError(error);
    }

    if (error is StorageException) {
      return StorageException(
        message: error.message,
        code: error.statusCode,
      );
    }

    return ServerException(
      message: error?.toString() ?? 'An unexpected error occurred.',
      originalError: error,
    );
  }
}

/// Supabase-specific error handling
class AppErrorHandler {
  AppErrorHandler._();

  static AppException handleAuthError(AuthException error) {
    final message = error.message.toLowerCase();

    if (message.contains('invalid login')) {
      return const AuthException(
        message: 'Invalid email or password.',
        code: 'invalid_credentials',
      );
    }
    if (message.contains('email not confirmed')) {
      return const AuthException(
        message: 'Please verify your email before logging in.',
        code: 'email_not_confirmed',
      );
    }
    if (message.contains('user already registered')) {
      return const AuthException(
        message: 'An account with this email already exists.',
        code: 'user_already_exists',
      );
    }
    if (message.contains('password')) {
      return const AuthException(
        message: 'Password must be at least 8 characters.',
        code: 'weak_password',
      );
    }
    if (message.contains('expired')) {
      return const AuthException(
        message: 'Your session has expired. Please log in again.',
        code: 'session_expired',
      );
    }

    return AuthException(message: error.message);
  }

  static AppException handlePostgrestError(PostgrestException error) {
    final code = error.code;

    switch (code) {
      case '23505':
        return const ValidationException(
          message: 'This record already exists.',
          code: 'duplicate',
        );
      case '23503':
        return const ValidationException(
          message: 'Referenced record not found.',
          code: 'foreign_key_violation',
        );
      case '42501':
        return const AuthorizationException(
          code: 'insufficient_privilege',
        );
      case 'P0001':
        return ValidationException(message: error.message);
      default:
        return ServerException(
          message: error.message,
          statusCode: int.tryParse(code ?? ''),
        );
    }
  }

  /// User-friendly error message
  static String userMessage(AppException exception) {
    return exception.message;
  }
}
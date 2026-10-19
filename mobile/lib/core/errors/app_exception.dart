/// Base class for all application exceptions
sealed class AppException implements Exception {
  final String message;
  final String? code;
  final dynamic originalError;

  const AppException({
    required this.message,
    this.code,
    this.originalError,
  });

  @override
  String toString() => 'AppException: $message${code != null ? ' ($code)' : ''}';
}

/// Network-related exceptions
class NetworkException extends AppException {
  const NetworkException({
    super.message = 'Network error. Please check your connection.',
    super.code,
    super.originalError,
  });
}

/// Authentication-related exceptions
class AuthException extends AppException {
  const AuthException({
    super.message = 'Authentication failed.',
    super.code,
    super.originalError,
  });
}

/// Authorization-related exceptions
class AuthorizationException extends AppException {
  const AuthorizationException({
    super.message = 'You are not authorized to perform this action.',
    super.code,
    super.originalError,
  });
}

/// Validation exceptions
class ValidationException extends AppException {
  final Map<String, String>? fieldErrors;

  const ValidationException({
    super.message = 'Validation failed.',
    this.fieldErrors,
    super.code,
    super.originalError,
  });
}

/// Server exceptions
class ServerException extends AppException {
  final int? statusCode;

  const ServerException({
    super.message = 'Server error. Please try again later.',
    this.statusCode,
    super.code,
    super.originalError,
  });
}

/// Cache/local storage exceptions
class CacheException extends AppException {
  const CacheException({
    super.message = 'Local storage error.',
    super.code,
    super.originalError,
  });
}

/// File/storage operation exceptions
class StorageException extends AppException {
  const StorageException({
    super.message = 'File storage error.',
    super.code,
    super.originalError,
  });
}

/// Not found exceptions
class NotFoundException extends AppException {
  const NotFoundException({
    super.message = 'The requested resource was not found.',
    super.code,
    super.originalError,
  });
}

/// Permission exceptions
class PermissionException extends AppException {
  const PermissionException({
    super.message = 'Permission denied.',
    super.code,
    super.originalError,
  });
}

/// Timeout exceptions
class TimeoutException extends AppException {
  const TimeoutException({
    super.message = 'Request timed out. Please try again.',
    super.code,
    super.originalError,
  });
}
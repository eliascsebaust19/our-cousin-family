import 'package:flutter_test/flutter_test.dart';
import 'package:our_cousin_family/core/errors/app_exception.dart';

void main() {
  group('AppException hierarchy', () {
    test('NetworkException has correct message', () {
      const e = NetworkException(message: 'No connection');
      expect(e.message, 'No connection');
      expect(e.toString(), contains('Network'));
    });

    test('AuthException has correct defaults', () {
      const e = AuthException();
      expect(e.message, 'Authentication failed.');
    });

    test('ValidationException includes field errors', () {
      const e = ValidationException(
        message: 'Invalid fields',
        fieldErrors: {'email': 'Invalid email'},
      );
      expect(e.fieldErrors, isNotNull);
      expect(e.fieldErrors!['email'], 'Invalid email');
    });

    test('ServerException includes status code', () {
      const e = ServerException(
        message: 'Internal error',
        statusCode: 500,
      );
      expect(e.statusCode, 500);
    });

    test('NotFoundException has correct default', () {
      const e = NotFoundException();
      expect(e.message, 'The requested resource was not found.');
    });

    test('PermissionException has correct default', () {
      const e = PermissionException();
      expect(e.message, 'Permission denied.');
    });

    test('TimeoutException has correct default', () {
      const e = TimeoutException();
      expect(e.message, 'Request timed out. Please try again.');
    });
  });
}
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/providers/auth_provider.dart';

// ── Login Form State ──
class LoginFormState {
  final String email;
  final String password;
  final bool isLoading;
  final String? errorMessage;
  final bool obscurePassword;

  const LoginFormState({
    this.email = '',
    this.password = '',
    this.isLoading = false,
    this.errorMessage,
    this.obscurePassword = true,
  });

  LoginFormState copyWith({
    String? email,
    String? password,
    bool? isLoading,
    String? errorMessage,
    bool? obscurePassword,
  }) {
    return LoginFormState(
      email: email ?? this.email,
      password: password ?? this.password,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
      obscurePassword: obscurePassword ?? this.obscurePassword,
    );
  }
}

class LoginFormNotifier extends StateNotifier<LoginFormState> {
  final Ref _ref;

  LoginFormNotifier(this._ref) : super(const LoginFormState());

  void setEmail(String email) {
    state = state.copyWith(email: email, errorMessage: null);
  }

  void setPassword(String password) {
    state = state.copyWith(password: password, errorMessage: null);
  }

  void togglePasswordVisibility() {
    state = state.copyWith(obscurePassword: !state.obscurePassword);
  }

  Future<bool> login() async {
    if (state.email.isEmpty || state.password.isEmpty) {
      state = state.copyWith(
        errorMessage: 'Please enter your email and password.',
      );
      return false;
    }

    state = state.copyWith(isLoading: true, errorMessage: null);

    try {
      final repo = _ref.read(authRepositoryProvider);
      await repo.signIn(
        email: state.email.trim(),
        password: state.password,
      );
      state = state.copyWith(isLoading: false);
      return true;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString().replaceFirst('AppException: ', ''),
      );
      return false;
    }
  }
}

final loginFormProvider =
    StateNotifierProvider.autoDispose<LoginFormNotifier, LoginFormState>((ref) {
  return LoginFormNotifier(ref);
});

// ── Signup Form State ──
class SignupFormState {
  final String fullName;
  final String email;
  final String password;
  final String confirmPassword;
  final bool isLoading;
  final String? errorMessage;
  final bool obscurePassword;
  final bool obscureConfirmPassword;
  final bool agreedToTerms;

  const SignupFormState({
    this.fullName = '',
    this.email = '',
    this.password = '',
    this.confirmPassword = '',
    this.isLoading = false,
    this.errorMessage,
    this.obscurePassword = true,
    this.obscureConfirmPassword = true,
    this.agreedToTerms = false,
  });

  SignupFormState copyWith({
    String? fullName,
    String? email,
    String? password,
    String? confirmPassword,
    bool? isLoading,
    String? errorMessage,
    bool? obscurePassword,
    bool? obscureConfirmPassword,
    bool? agreedToTerms,
  }) {
    return SignupFormState(
      fullName: fullName ?? this.fullName,
      email: email ?? this.email,
      password: password ?? this.password,
      confirmPassword: confirmPassword ?? this.confirmPassword,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
      obscurePassword: obscurePassword ?? this.obscurePassword,
      obscureConfirmPassword:
          obscureConfirmPassword ?? this.obscureConfirmPassword,
      agreedToTerms: agreedToTerms ?? this.agreedToTerms,
    );
  }
}

class SignupFormNotifier extends StateNotifier<SignupFormState> {
  final Ref _ref;

  SignupFormNotifier(this._ref) : super(const SignupFormState());

  void setFullName(String value) {
    state = state.copyWith(fullName: value, errorMessage: null);
  }

  void setEmail(String value) {
    state = state.copyWith(email: value, errorMessage: null);
  }

  void setPassword(String value) {
    state = state.copyWith(password: value, errorMessage: null);
  }

  void setConfirmPassword(String value) {
    state = state.copyWith(confirmPassword: value, errorMessage: null);
  }

  void togglePasswordVisibility() {
    state = state.copyWith(obscurePassword: !state.obscurePassword);
  }

  void toggleConfirmPasswordVisibility() {
    state = state.copyWith(
      obscureConfirmPassword: !state.obscureConfirmPassword,
    );
  }

  void toggleTerms() {
    state = state.copyWith(agreedToTerms: !state.agreedToTerms);
  }

  Future<bool> signUp() async {
    // Validation
    if (state.fullName.trim().isEmpty) {
      state = state.copyWith(errorMessage: 'Please enter your full name.');
      return false;
    }
    if (state.email.trim().isEmpty || !state.email.contains('@')) {
      state = state.copyWith(
        errorMessage: 'Please enter a valid email address.',
      );
      return false;
    }
    if (state.password.length < 8) {
      state = state.copyWith(
        errorMessage: 'Password must be at least 8 characters.',
      );
      return false;
    }
    if (state.password != state.confirmPassword) {
      state = state.copyWith(errorMessage: 'Passwords do not match.');
      return false;
    }
    if (!state.agreedToTerms) {
      state = state.copyWith(
        errorMessage: 'Please agree to the terms and conditions.',
      );
      return false;
    }

    state = state.copyWith(isLoading: true, errorMessage: null);

    try {
      final repo = _ref.read(authRepositoryProvider);
      await repo.signUp(
        email: state.email.trim(),
        password: state.password,
        fullName: state.fullName.trim(),
      );
      state = state.copyWith(isLoading: false);
      return true;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString().replaceFirst('AppException: ', ''),
      );
      return false;
    }
  }
}

final signupFormProvider =
    StateNotifierProvider.autoDispose<SignupFormNotifier, SignupFormState>(
        (ref) {
  return SignupFormNotifier(ref);
});
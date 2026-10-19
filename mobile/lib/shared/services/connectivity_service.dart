import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

enum NetworkStatus { online, offline }

final networkStatusProvider = StreamProvider<NetworkStatus>((ref) {
  final service = ConnectivityService();
  ref.onDispose(() => service.dispose());
  return service.statusStream;
});

class ConnectivityService {
  final Connectivity _connectivity = Connectivity();
  final StreamController<NetworkStatus> _controller =
      StreamController<NetworkStatus>.broadcast();

  Stream<NetworkStatus> get statusStream => _controller.stream;

  ConnectivityService() {
    _connectivity.onConnectivityChanged.listen(_onConnectivityChanged);
    _checkInitialStatus();
  }

  void _onConnectivityChanged(List<ConnectivityResult> results) {
    final isConnected =
        results.any((r) => r != ConnectivityResult.none);
    _controller.add(isConnected ? NetworkStatus.online : NetworkStatus.offline);
  }

  Future<void> _checkInitialStatus() async {
    final results = await _connectivity.checkConnectivity();
    final isConnected =
        results.any((r) => r != ConnectivityResult.none);
    _controller.add(isConnected ? NetworkStatus.online : NetworkStatus.offline);
  }

  Future<bool> get isConnected async {
    final results = await _connectivity.checkConnectivity();
    return results.any((r) => r != ConnectivityResult.none);
  }

  void dispose() {
    _controller.close();
  }
}
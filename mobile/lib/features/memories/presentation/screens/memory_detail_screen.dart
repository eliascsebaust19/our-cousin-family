import 'package:flutter/material.dart';

class MemoryDetailScreen extends StatelessWidget {
  final String memoryId;
  const MemoryDetailScreen({super.key, required this.memoryId});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Memory')),
      body: const Center(child: Text('Memory detail view')),
    );
  }
}
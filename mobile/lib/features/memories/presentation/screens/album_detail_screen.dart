import 'package:flutter/material.dart';

import '../../../../core/widgets/empty_state.dart';

class AlbumDetailScreen extends StatelessWidget {
  final String albumId;
  const AlbumDetailScreen({super.key, required this.albumId});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Album')),
      body: const EmptyState(
        icon: Icons.photo_library_rounded,
        title: 'Album Empty',
        message: 'Add memories to this album.',
      ),
    );
  }
}
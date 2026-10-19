import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/color_palette.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../shared/providers/family_provider.dart';

class MemoriesScreen extends ConsumerStatefulWidget {
  const MemoriesScreen({super.key});

  @override
  ConsumerState<MemoriesScreen> createState() => _MemoriesScreenState();
}

class _MemoriesScreenState extends ConsumerState<MemoriesScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Memory Vault'),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'All'),
            Tab(text: 'Albums'),
            Tab(text: 'Voice'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildAllMemories(),
          _buildAlbums(),
          _buildVoiceMemories(),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showUploadOptions(context),
        icon: const Icon(Icons.add_rounded),
        label: const Text('Add Memory'),
      ),
    );
  }

  Widget _buildAllMemories() {
    return EmptyState(
      icon: Icons.photo_library_rounded,
      title: 'No Memories Yet',
      message: 'Start preserving your family memories by adding photos, videos, and documents.',
      actionLabel: 'Add Memory',
      onAction: () => _showUploadOptions(context),
    );
  }

  Widget _buildAlbums() {
    return EmptyState(
      icon: Icons.folder_rounded,
      title: 'No Albums',
      message: 'Create albums to organize your family memories.',
      actionLabel: 'Create Album',
      onAction: () {},
    );
  }

  Widget _buildVoiceMemories() {
    return EmptyState(
      icon: Icons.mic_rounded,
      title: 'No Voice Memories',
      message: 'Record stories from family members to preserve them forever.',
      actionLabel: 'Record',
      onAction: () => context.push('/memories/voice/record'),
    );
  }

  void _showUploadOptions(BuildContext context) {
    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_rounded, color: ColorPalette.primary),
              title: const Text('Upload Photo'),
              onTap: () => Navigator.pop(context),
            ),
            ListTile(
              leading: const Icon(Icons.videocam_rounded, color: ColorPalette.tertiary),
              title: const Text('Upload Video'),
              onTap: () => Navigator.pop(context),
            ),
            ListTile(
              leading: const Icon(Icons.mic_rounded, color: ColorPalette.accent),
              title: const Text('Record Voice'),
              onTap: () {
                Navigator.pop(context);
                context.push('/memories/voice/record');
              },
            ),
            ListTile(
              leading: const Icon(Icons.folder_rounded, color: ColorPalette.secondary),
              title: const Text('Create Album'),
              onTap: () => Navigator.pop(context),
            ),
          ],
        ),
      ),
    );
  }
}
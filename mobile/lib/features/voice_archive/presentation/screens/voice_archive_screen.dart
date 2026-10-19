import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/color_palette.dart';
import '../../../../core/widgets/empty_state.dart';

class VoiceArchiveScreen extends StatelessWidget {
  const VoiceArchiveScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Voice Archive')),
      body: EmptyState(
        icon: Icons.mic_rounded,
        title: 'No Voice Memories',
        message:
            'Record stories from grandparents, parents, and other family members to preserve them forever.',
        actionLabel: 'Start Recording',
        onAction: () => context.push('/memories/voice/record'),
      ),
    );
  }
}
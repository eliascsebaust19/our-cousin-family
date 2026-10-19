import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/color_palette.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/empty_state.dart';

class GameLobbyScreen extends ConsumerWidget {
  const GameLobbyScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Family Games'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Hero section
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    ColorPalette.ludoRed.withOpacity(0.8),
                    ColorPalette.ludoBlue.withOpacity(0.8),
                  ],
                ),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Column(
                children: [
                  const Text('🎲', style: TextStyle(fontSize: 48)),
                  const SizedBox(height: 12),
                  Text(
                    'Ludo',
                    style: theme.textTheme.headlineLarge?.copyWith(
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '2-4 Players • Family Fun!',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: Colors.white70,
                    ),
                  ),
                  const SizedBox(height: 16),
                  AppButton(
                    label: 'Create Game Room',
                    onPressed: () => _showCreateGameDialog(context),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Active games
            Text('Active Games', style: theme.textTheme.titleMedium),
            const SizedBox(height: 12),
            const EmptyState(
              icon: Icons.games_rounded,
              title: 'No Active Games',
              message: 'Create a game room to play with family!',
            ),
            const SizedBox(height: 24),

            // Join with code
            Text('Join a Game', style: theme.textTheme.titleMedium),
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    TextField(
                      decoration: InputDecoration(
                        hintText: 'Enter room code',
                        prefixIcon: const Icon(Icons.vpn_key_rounded),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide.none,
                        ),
                        filled: true,
                      ),
                      textCapitalization: TextCapitalization.characters,
                    ),
                    const SizedBox(height: 12),
                    AppButton(
                      label: 'Join Room',
                      isExpanded: true,
                      icon: Icons.login_rounded,
                      onPressed: () {},
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Game history
            Text('Recent Games', style: theme.textTheme.titleMedium),
            const SizedBox(height: 12),
            ...List.generate(3, (index) {
              return Card(
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundColor: [
                      ColorPalette.ludoRed,
                      ColorPalette.ludoBlue,
                      ColorPalette.ludoGreen,
                    ][index].withOpacity(0.15),
                    child: Icon(
                      Icons.emoji_events_rounded,
                      color: [
                        ColorPalette.ludoRed,
                        ColorPalette.ludoBlue,
                        ColorPalette.ludoGreen,
                      ][index],
                    ),
                  ),
                  title: Text('Game #${1000 + index}'),
                  subtitle: Text('${index + 2} players • ${['Won', 'Lost', 'Draw'][index]}'),
                  trailing: Text(
                    '${index + 1} day${index > 0 ? 's' : ''} ago',
                    style: theme.textTheme.labelSmall,
                  ),
                ),
              );
            }),
          ],
        ),
      ),
    );
  }

  void _showCreateGameDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) {
        int playerCount = 2;
        return StatefulBuilder(
          builder: (context, setState) {
            return AlertDialog(
              title: const Text('Create Game Room'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Select number of players:'),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [2, 3, 4].map((count) {
                      return GestureDetector(
                        onTap: () =>
                            setState(() => playerCount = count),
                        child: Container(
                          width: 60,
                          height: 60,
                          decoration: BoxDecoration(
                            color: playerCount == count
                                ? ColorPalette.primary
                                : ColorPalette.surfaceVariantLight,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Center(
                            child: Text(
                              '$count',
                              style: TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.w700,
                                color: playerCount == count
                                    ? Colors.white
                                    : null,
                              ),
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Cancel'),
                ),
                ElevatedButton(
                  onPressed: () {
                    Navigator.pop(context);
                    // Create game room and navigate
                  },
                  child: const Text('Create'),
                ),
              ],
            );
          },
        );
      },
    );
  }
}
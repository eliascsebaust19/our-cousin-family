import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/color_palette.dart';
import '../../../../core/widgets/cached_avatar.dart';
import '../../../../core/widgets/loading_skeleton.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../shared/providers/auth_provider.dart';
import '../../../../shared/providers/family_provider.dart';
import '../../../notifications/presentation/providers/notification_provider.dart';
import '../../../events/presentation/providers/event_provider.dart';
import '../../../games/presentation/providers/game_provider.dart';
import '../widgets/activity_card.dart';
import '../widgets/quick_action_grid.dart';
import '../widgets/birthday_card.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(currentUserProfileProvider);
    final families = ref.watch(userFamiliesProvider);
    final theme = Theme.of(context);

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(currentUserProfileProvider);
          ref.invalidate(userFamiliesProvider);
        },
        child: CustomScrollView(
          slivers: [
            // App bar
            SliverAppBar(
              floating: true,
              pinned: true,
              expandedHeight: 120,
              flexibleSpace: FlexibleSpaceBar(
                titlePadding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 12,
                ),
                title: profile.when(
                  data: (user) => Row(
                    children: [
                      CachedAvatar(
                        imageUrl: user?.avatarUrl,
                        name: user?.fullName ?? '',
                        radius: 18,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _getGreeting(),
                              style: theme.textTheme.labelSmall?.copyWith(
                                color: theme.textTheme.bodySmall?.color,
                              ),
                            ),
                            Text(
                              user?.fullName.split(' ').first ?? 'Family',
                              style: theme.textTheme.titleMedium,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  loading: () => const SizedBox.shrink(),
                  error: (_, __) => const SizedBox.shrink(),
                ),
              ),
              actions: [
                IconButton(
                  icon: const Icon(Icons.notifications_outlined),
                  onPressed: () => context.push('/home/notifications'),
                ),
              ],
            ),

            // Content
            SliverToBoxAdapter(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 16),

                  // Birthdays section
                  const _BirthdaySection(),
                  const SizedBox(height: 24),

                  // Quick actions
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Text(
                      'Quick Actions',
                      style: theme.textTheme.titleMedium,
                    ),
                  ),
                  const SizedBox(height: 12),
                  QuickActionGrid(
                    actions: [
                      QuickAction(
                        icon: Icons.camera_alt_rounded,
                        label: 'Share Photo',
                        color: ColorPalette.primary,
                        onTap: () {
                          final families =
                              ref.read(userFamiliesProvider).valueOrNull;
                          if (families != null && families.isNotEmpty) {
                            context.push(
                              '/family/feed/${families.first.id}/create',
                            );
                          }
                        },
                      ),
                      QuickAction(
                        icon: Icons.event_rounded,
                        label: 'Calendar',
                        color: ColorPalette.secondary,
                        onTap: () => context.push('/home/events'),
                      ),
                      QuickAction(
                        icon: Icons.games_rounded,
                        label: 'Play Ludo',
                        color: ColorPalette.tertiary,
                        onTap: () => context.push('/home/games'),
                      ),
                      QuickAction(
                        icon: Icons.mic_rounded,
                        label: 'Voice Story',
                        color: ColorPalette.accent,
                        onTap: () => context.push('/memories/voice'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),

                  // Upcoming events
                  const _UpcomingEventsSection(),
                  const SizedBox(height: 24),

                  // Recent activity / Family feeds
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Text(
                      'Your Families',
                      style: theme.textTheme.titleMedium,
                    ),
                  ),
                  const SizedBox(height: 12),
                  families.when(
                    data: (familyList) {
                      if (familyList.isEmpty) {
                        return Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: EmptyState(
                            icon: Icons.family_restroom_rounded,
                            title: 'No Family Yet',
                            message:
                                'Create or join a family to get started!',
                            actionLabel: 'Get Started',
                            onAction: () =>
                                context.push('/create-join-family'),
                          ),
                        );
                      }
                      return Column(
                        children: familyList.map((family) {
                          return _FamilyQuickCard(family: family);
                        }).toList(),
                      );
                    },
                    loading: () => const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 16),
                      child: CardSkeleton(height: 80),
                    ),
                    error: (e, _) => Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: ErrorState(
                        message: e.toString(),
                        onRetry: () => ref.invalidate(userFamiliesProvider),
                      ),
                    ),
                  ),
                  const SizedBox(height: 32),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _getGreeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good Morning ☀️';
    if (hour < 17) return 'Good Afternoon 🌤️';
    return 'Good Evening 🌙';
  }
}

class _BirthdaySection extends ConsumerWidget {
  const _BirthdaySection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Placeholder - will show upcoming birthdays
    return const BirthdayCard(
      name: 'Family Member',
      date: 'Today',
      age: 25,
    );
  }
}

class _UpcomingEventsSection extends ConsumerWidget {
  const _UpcomingEventsSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Upcoming Events', style: theme.textTheme.titleMedium),
              TextButton(
                onPressed: () => context.push('/home/events'),
                child: const Text('See All'),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ActivityCard(
            icon: Icons.calendar_today_rounded,
            title: 'No upcoming events',
            subtitle: 'Create an event for your family',
            color: ColorPalette.secondary,
            onTap: () => context.push('/home/events/create'),
          ),
        ],
      ),
    );
  }
}

class _FamilyQuickCard extends StatelessWidget {
  final dynamic family; // Family model

  const _FamilyQuickCard({required this.family});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Card(
        child: ListTile(
          leading: CircleAvatar(
            backgroundColor: ColorPalette.primaryExtraLight,
            backgroundImage: family.coverImageUrl != null
                ? NetworkImage(family.coverImageUrl!)
                : null,
            child: family.coverImageUrl == null
                ? const Icon(Icons.family_restroom, color: ColorPalette.primary)
                : null,
          ),
          title: Text(
            family.name,
            style: theme.textTheme.titleSmall,
          ),
          subtitle: Text(
            '${family.memberCount} members',
            style: theme.textTheme.bodySmall,
          ),
          trailing: const Icon(Icons.chevron_right_rounded),
          onTap: () {
            // Navigate to family
          },
        ),
      ),
    );
  }
}
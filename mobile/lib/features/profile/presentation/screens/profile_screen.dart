import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../../core/theme/color_palette.dart';
import '../../../../core/widgets/cached_avatar.dart';
import '../../../../shared/providers/auth_provider.dart';
import '../../../../shared/providers/family_provider.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(currentUserProfileProvider);
    final families = ref.watch(userFamiliesProvider);
    final theme = Theme.of(context);

    return Scaffold(
      body: profile.when(
        data: (user) {
          if (user == null) {
            return const Center(child: Text('Profile not found'));
          }

          return CustomScrollView(
            slivers: [
              // Profile header
              SliverAppBar(
                expandedHeight: 200,
                pinned: true,
                flexibleSpace: FlexibleSpaceBar(
                  background: Container(
                    decoration: const BoxDecoration(
                      gradient: ColorPalette.warmGradient,
                    ),
                    child: SafeArea(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          CachedAvatar(
                            imageUrl: user.avatarUrl,
                            name: user.fullName,
                            radius: 40,
                            showBorder: true,
                            borderColor: Colors.white,
                          ),
                          const SizedBox(height: 12),
                          Text(
                            user.fullName,
                            style: theme.textTheme.titleLarge?.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          if (user.bio != null && user.bio!.isNotEmpty)
                            Text(
                              user.bio!,
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: Colors.white70,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                        ],
                      ),
                    ),
                  ),
                ),
                actions: [
                  IconButton(
                    icon: const Icon(Icons.settings_outlined),
                    onPressed: () => context.push('/profile/settings'),
                  ),
                ],
              ),

              SliverToBoxAdapter(
                child: Column(
                  children: [
                    const SizedBox(height: 16),

                    // Stats
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 32),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                        children: [
                          _StatItem(
                            count: families.valueOrNull?.length ?? 0,
                            label: 'Families',
                          ),
                          Container(
                            height: 40,
                            width: 1,
                            color: theme.dividerColor,
                          ),
                          _StatItem(
                            count: 0,
                            label: 'Posts',
                          ),
                          Container(
                            height: 40,
                            width: 1,
                            color: theme.dividerColor,
                          ),
                          _StatItem(
                            count: 0,
                            label: 'Memories',
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Edit profile button
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: OutlinedButton.icon(
                        onPressed: () => context.push('/profile/edit'),
                        icon: const Icon(Icons.edit_rounded, size: 18),
                        label: const Text('Edit Profile'),
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size(double.infinity, 44),
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Menu items
                    _ProfileMenuItem(
                      icon: Icons.family_restroom_rounded,
                      title: 'My Families',
                      subtitle: '${families.valueOrNull?.length ?? 0} families',
                      onTap: () {},
                    ),
                    _ProfileMenuItem(
                      icon: Icons.event_rounded,
                      title: 'My Events',
                      subtitle: 'View your upcoming events',
                      onTap: () => context.push('/home/events'),
                    ),
                    _ProfileMenuItem(
                      icon: Icons.games_rounded,
                      title: 'Game History',
                      subtitle: 'View your game stats',
                      onTap: () => context.push('/home/games'),
                    ),
                    _ProfileMenuItem(
                      icon: Icons.settings_rounded,
                      title: 'Settings',
                      subtitle: 'Account, notifications, theme',
                      onTap: () => context.push('/profile/settings'),
                    ),
                    _ProfileMenuItem(
                      icon: Icons.help_outline_rounded,
                      title: 'Help & Support',
                      subtitle: 'FAQs and contact support',
                      onTap: () {},
                    ),
                    _ProfileMenuItem(
                      icon: Icons.info_outline_rounded,
                      title: 'About',
                      subtitle: 'Version 1.0.0',
                      onTap: () => context.push('/profile/settings/about'),
                    ),
                    const SizedBox(height: 16),

                    // Logout
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: TextButton.icon(
                        onPressed: () async {
                          final confirmed = await showDialog<bool>(
                            context: context,
                            builder: (context) => AlertDialog(
                              title: const Text('Sign Out'),
                              content: const Text(
                                'Are you sure you want to sign out?',
                              ),
                              actions: [
                                TextButton(
                                  onPressed: () =>
                                      Navigator.pop(context, false),
                                  child: const Text('Cancel'),
                                ),
                                TextButton(
                                  onPressed: () =>
                                      Navigator.pop(context, true),
                                  child: const Text('Sign Out'),
                                ),
                              ],
                            ),
                          );

                          if (confirmed == true) {
                            await Supabase.instance.client.auth.signOut();
                            if (context.mounted) context.go('/login');
                          }
                        },
                        icon: const Icon(
                          Icons.logout_rounded,
                          color: ColorPalette.error,
                        ),
                        label: const Text(
                          'Sign Out',
                          style: TextStyle(color: ColorPalette.error),
                        ),
                      ),
                    ),
                    const SizedBox(height: 32),
                  ],
                ),
              ),
            ],
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
      ),
    );
  }
}

class _StatItem extends StatelessWidget {
  final int count;
  final String label;

  const _StatItem({required this.count, required this.label});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      children: [
        Text(
          count.toString(),
          style: theme.textTheme.headlineMedium?.copyWith(
            fontWeight: FontWeight.w800,
          ),
        ),
        Text(label, style: theme.textTheme.bodySmall),
      ],
    );
  }
}

class _ProfileMenuItem extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback? onTap;

  const _ProfileMenuItem({
    required this.icon,
    required this.title,
    this.subtitle,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: ColorPalette.primary),
      title: Text(title),
      subtitle: subtitle != null ? Text(subtitle!) : null,
      trailing: const Icon(Icons.chevron_right_rounded),
      onTap: onTap,
    );
  }
}
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../../core/theme/color_palette.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        children: [
          _SettingsSection(
            title: 'Account',
            children: [
              _SettingsTile(
                icon: Icons.person_outline_rounded,
                title: 'Edit Profile',
                onTap: () => context.push('/profile/edit'),
              ),
              _SettingsTile(
                icon: Icons.lock_outline_rounded,
                title: 'Change Password',
                onTap: () {},
              ),
              _SettingsTile(
                icon: Icons.email_outlined,
                title: 'Email',
                subtitle: Supabase.instance.client.auth.currentUser?.email,
                onTap: () {},
              ),
            ],
          ),
          _SettingsSection(
            title: 'Preferences',
            children: [
              _SettingsTile(
                icon: Icons.notifications_outlined,
                title: 'Notifications',
                onTap: () =>
                    context.push('/profile/settings/notifications'),
              ),
              _SettingsTile(
                icon: Icons.palette_outlined,
                title: 'Theme',
                onTap: () => context.push('/profile/settings/theme'),
              ),
              _SettingsTile(
                icon: Icons.language_rounded,
                title: 'Language',
                subtitle: 'English',
                onTap: () {},
              ),
            ],
          ),
          _SettingsSection(
            title: 'Privacy & Security',
            children: [
              _SettingsTile(
                icon: Icons.privacy_tip_outlined,
                title: 'Privacy',
                onTap: () {},
              ),
              _SettingsTile(
                icon: Icons.shield_outlined,
                title: 'Security',
                onTap: () {},
              ),
              _SettingsTile(
                icon: Icons.block_rounded,
                title: 'Blocked Users',
                onTap: () {},
              ),
            ],
          ),
          _SettingsSection(
            title: 'Support',
            children: [
              _SettingsTile(
                icon: Icons.help_outline_rounded,
                title: 'Help Center',
                onTap: () {},
              ),
              _SettingsTile(
                icon: Icons.bug_report_outlined,
                title: 'Report a Problem',
                onTap: () {},
              ),
              _SettingsTile(
                icon: Icons.info_outline_rounded,
                title: 'About',
                onTap: () => context.push('/profile/settings/about'),
              ),
            ],
          ),
          const SizedBox(height: 24),

          // Danger zone
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              children: [
                OutlinedButton.icon(
                  onPressed: () async {
                    final confirmed = await showDialog<bool>(
                      context: context,
                      builder: (context) => AlertDialog(
                        title: const Text('Delete Account'),
                        content: const Text(
                          'This action cannot be undone. All your data will be permanently deleted.',
                        ),
                        actions: [
                          TextButton(
                            onPressed: () => Navigator.pop(context, false),
                            child: const Text('Cancel'),
                          ),
                          TextButton(
                            onPressed: () => Navigator.pop(context, true),
                            style: TextButton.styleFrom(
                              foregroundColor: ColorPalette.error,
                            ),
                            child: const Text('Delete'),
                          ),
                        ],
                      ),
                    );
                    // Handle delete
                  },
                  icon: const Icon(
                    Icons.delete_outline_rounded,
                    color: ColorPalette.error,
                  ),
                  label: const Text(
                    'Delete Account',
                    style: TextStyle(color: ColorPalette.error),
                  ),
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(double.infinity, 48),
                    side: const BorderSide(color: ColorPalette.error),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }
}

class _SettingsSection extends StatelessWidget {
  final String title;
  final List<Widget> children;

  const _SettingsSection({required this.title, required this.children});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Text(
            title,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: ColorPalette.primary,
                  fontWeight: FontWeight.w700,
                ),
          ),
        ),
        Card(
          margin: const EdgeInsets.symmetric(horizontal: 12),
          child: Column(children: children),
        ),
      ],
    );
  }
}

class _SettingsTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback? onTap;

  const _SettingsTile({
    required this.icon,
    required this.title,
    this.subtitle,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, size: 22),
      title: Text(title),
      subtitle: subtitle != null ? Text(subtitle!) : null,
      trailing: const Icon(Icons.chevron_right_rounded, size: 20),
      onTap: onTap,
    );
  }
}
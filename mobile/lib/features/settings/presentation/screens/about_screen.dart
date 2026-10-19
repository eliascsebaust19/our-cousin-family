import 'package:flutter/material.dart';

import '../../../../core/theme/color_palette.dart';

class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('About')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            const SizedBox(height: 24),
            // App icon
            Container(
              width: 100,
              height: 100,
              decoration: BoxDecoration(
                color: ColorPalette.primary,
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: ColorPalette.primary.withOpacity(0.3),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: const Icon(
                Icons.family_restroom_rounded,
                size: 50,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Our Cousin Family',
              style: theme.textTheme.headlineMedium?.copyWith(
                fontWeight: FontWeight.w800,
              ),
            ),
            Text(
              'Version 1.0.0',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.textTheme.bodySmall?.color,
              ),
            ),
            const SizedBox(height: 32),
            Text(
              'Your private family social network where cousins and extended family stay connected, share memories, and create lasting bonds.',
              style: theme.textTheme.bodyLarge?.copyWith(height: 1.6),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),
            _AboutTile(
              icon: Icons.favorite_rounded,
              title: 'Made with Love',
              subtitle: 'For families everywhere',
            ),
            _AboutTile(
              icon: Icons.security_rounded,
              title: 'Private & Secure',
              subtitle: 'Your family data stays private',
            ),
            _AboutTile(
              icon: Icons.code_rounded,
              title: 'Open Source',
              subtitle: 'Built with Flutter & Supabase',
            ),
            const SizedBox(height: 24),
            const Divider(),
            const SizedBox(height: 16),
            Text(
              '© 2024 Our Cousin Family\nAll rights reserved.',
              style: theme.textTheme.bodySmall,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _AboutTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;

  const _AboutTile({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: ColorPalette.primary),
      title: Text(title),
      subtitle: Text(subtitle),
    );
  }
}
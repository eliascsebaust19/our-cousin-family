import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/color_palette.dart';

class BirthdayCard extends StatelessWidget {
  final String name;
  final String date;
  final int? age;
  final String? avatarUrl;

  const BirthdayCard({
    super.key,
    required this.name,
    required this.date,
    this.age,
    this.avatarUrl,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFFFCE8E1), Color(0xFFFDF5E6)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: ColorPalette.primary.withOpacity(0.2),
          ),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: ColorPalette.primary.withOpacity(0.15),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: const Text(
                '🎂',
                style: TextStyle(fontSize: 24),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Birthday Today!',
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: ColorPalette.primary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    name,
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  if (age != null)
                    Text(
                      'Turning $age 🎉',
                      style: theme.textTheme.bodySmall,
                    ),
                ],
              ),
            ),
            Icon(
              Icons.celebration_rounded,
              color: ColorPalette.primary.withOpacity(0.5),
              size: 28,
            ),
          ],
        ),
      ),
    );
  }
}
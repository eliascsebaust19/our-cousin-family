import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/color_palette.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../shared/providers/family_provider.dart';

class FamilyListScreen extends ConsumerWidget {
  const FamilyListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final families = ref.watch(userFamiliesProvider);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Families'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_rounded),
            onPressed: () => context.push('/create-join-family'),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(userFamiliesProvider),
        child: families.when(
          data: (familyList) {
            if (familyList.isEmpty) {
              return EmptyState(
                icon: Icons.family_restroom_rounded,
                title: 'No Family Groups',
                message:
                    'Create a new family or join an existing one with an invitation code.',
                actionLabel: 'Create or Join',
                onAction: () => context.push('/create-join-family'),
              );
            }
            return ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: familyList.length,
              itemBuilder: (context, index) {
                final family = familyList[index];
                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(16),
                    onTap: () {
                      ref.read(activeFamilyIdProvider.notifier).state =
                          family.id;
                      _showFamilyOptions(context, family.id);
                    },
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        children: [
                          CircleAvatar(
                            radius: 28,
                            backgroundColor: ColorPalette.primaryExtraLight,
                            backgroundImage: family.coverImageUrl != null
                                ? NetworkImage(family.coverImageUrl!)
                                : null,
                            child: family.coverImageUrl == null
                                ? const Icon(Icons.family_restroom,
                                    color: ColorPalette.primary, size: 28)
                                : null,
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  family.name,
                                  style: theme.textTheme.titleMedium,
                                ),
                                if (family.description != null &&
                                    family.description!.isNotEmpty) ...[
                                  const SizedBox(height: 4),
                                  Text(
                                    family.description!,
                                    style: theme.textTheme.bodySmall,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ],
                                const SizedBox(height: 4),
                                Text(
                                  '${family.memberCount} members',
                                  style: theme.textTheme.labelSmall?.copyWith(
                                    color: ColorPalette.primary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const Icon(Icons.chevron_right_rounded),
                        ],
                      ),
                    ),
                  ),
                );
              },
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ErrorState(
            message: e.toString(),
            onRetry: () => ref.invalidate(userFamiliesProvider),
          ),
        ),
      ),
    );
  }

  void _showFamilyOptions(BuildContext context, String familyId) {
    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.feed_rounded),
              title: const Text('Family Feed'),
              onTap: () {
                Navigator.pop(context);
                context.push('/family/feed/$familyId');
              },
            ),
            ListTile(
              leading: const Icon(Icons.account_tree_rounded),
              title: const Text('Family Tree'),
              onTap: () {
                Navigator.pop(context);
                context.push('/family/tree/$familyId');
              },
            ),
            ListTile(
              leading: const Icon(Icons.people_rounded),
              title: const Text('Members'),
              onTap: () => Navigator.pop(context),
            ),
            ListTile(
              leading: const Icon(Icons.settings_rounded),
              title: const Text('Family Settings'),
              onTap: () => Navigator.pop(context),
            ),
          ],
        ),
      ),
    );
  }
}
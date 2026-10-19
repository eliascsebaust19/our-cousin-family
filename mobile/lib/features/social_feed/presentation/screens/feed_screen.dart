import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../../core/theme/color_palette.dart';
import '../../../../core/widgets/cached_avatar.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../shared/models/post.dart';
import '../../../../shared/providers/auth_provider.dart';
import '../../../../shared/providers/family_provider.dart';
import '../../../../core/constants/api_constants.dart';

class FeedScreen extends ConsumerStatefulWidget {
  final String familyId;
  const FeedScreen({super.key, required this.familyId});

  @override
  ConsumerState<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends ConsumerState<FeedScreen> {
  final List<Post> _posts = [];
  bool _isLoading = true;
  bool _hasMore = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadPosts();
  }

  Future<void> _loadPosts() async {
    setState(() => _isLoading = true);
    try {
      final client = Supabase.instance.client;
      final response = await client
          .from(ApiConstants.postsTable)
          .select('*, profiles(*)')
          .eq('family_id', widget.familyId)
          .order('is_pinned', ascending: false)
          .order('created_at', ascending: false)
          .limit(20);

      setState(() {
        _posts.clear();
        _posts.addAll(
          (response as List).map((p) => Post.fromJson(p)),
        );
        _isLoading = false;
        _hasMore = _posts.length >= 20;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Family Feed'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_circle_outline_rounded),
            onPressed: () =>
                context.push('/family/feed/${widget.familyId}/create'),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadPosts,
        child: _buildContent(theme),
      ),
    );
  }

  Widget _buildContent(ThemeData theme) {
    if (_isLoading && _posts.isEmpty) {
      return ListView.builder(
        itemCount: 3,
        itemBuilder: (_, __) => const PostSkeleton(),
      );
    }

    if (_error != null && _posts.isEmpty) {
      return ErrorState(
        message: _error,
        onRetry: _loadPosts,
      );
    }

    if (_posts.isEmpty) {
      return EmptyState(
        icon: Icons.post_add_rounded,
        title: 'No Posts Yet',
        message: 'Be the first to share something with your family!',
        actionLabel: 'Create Post',
        onAction: () =>
            context.push('/family/feed/${widget.familyId}/create'),
      );
    }

    return ListView.builder(
      itemCount: _posts.length + (_hasMore ? 1 : 0),
      itemBuilder: (context, index) {
        if (index == _posts.length) {
          return const Center(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: CircularProgressIndicator(),
            ),
          );
        }
        return _PostCard(post: _posts[index]);
      },
    );
  }
}

class _PostCard extends ConsumerWidget {
  final Post post;
  const _PostCard({required this.post});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final currentUserId = ref.watch(currentUserIdProvider);

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 12, 8),
            child: Row(
              children: [
                CachedAvatar(
                  imageUrl: post.author?.avatarUrl,
                  name: post.author?.fullName ?? '',
                  radius: 20,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        post.author?.fullName ?? 'Unknown',
                        style: theme.textTheme.titleSmall,
                      ),
                      Text(
                        _formatTime(post.createdAt),
                        style: theme.textTheme.labelSmall,
                      ),
                    ],
                  ),
                ),
                if (post.isPinned)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: ColorPalette.secondaryExtraLight,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: const [
                        Icon(Icons.push_pin, size: 12, color: ColorPalette.secondaryDark),
                        SizedBox(width: 4),
                        Text('Pinned', style: TextStyle(fontSize: 10)),
                      ],
                    ),
                  ),
                if (post.momentBadge != null)
                  Container(
                    margin: const EdgeInsets.only(left: 8),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: ColorPalette.primaryExtraLight,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      _getBadgeEmoji(post.momentBadge!) +
                          ' ${post.momentBadge}',
                      style: const TextStyle(fontSize: 10),
                    ),
                  ),
                PopupMenuButton<String>(
                  itemBuilder: (context) => [
                    if (post.authorId == currentUserId)
                      const PopupMenuItem(
                        value: 'delete',
                        child: Text('Delete'),
                      ),
                    const PopupMenuItem(
                      value: 'report',
                      child: Text('Report'),
                    ),
                  ],
                  onSelected: (_) {},
                  icon: const Icon(Icons.more_vert, size: 20),
                ),
              ],
            ),
          ),

          // Content
          if (post.content.isNotEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(
                post.content,
                style: theme.textTheme.bodyMedium,
              ),
            ),

          // Media
          if (post.media.isNotEmpty) ...[
            const SizedBox(height: 8),
            _buildMediaGrid(post.media),
          ],

          // Action buttons
          Padding(
            padding: const EdgeInsets.fromLTRB(8, 4, 8, 4),
            child: Row(
              children: [
                _ActionButton(
                  icon: post.isLikedByMe
                      ? Icons.favorite_rounded
                      : Icons.favorite_outline_rounded,
                  label: post.likesCount > 0
                      ? '${post.likesCount}'
                      : '',
                  color: post.isLikedByMe ? ColorPalette.error : null,
                  onTap: () => _toggleLike(ref),
                ),
                _ActionButton(
                  icon: Icons.chat_bubble_outline_rounded,
                  label: post.commentsCount > 0
                      ? '${post.commentsCount}'
                      : '',
                  onTap: () => context.push(
                    '/family/feed/${post.familyId}/post/${post.id}',
                  ),
                ),
                _ActionButton(
                  icon: Icons.share_outlined,
                  onTap: () {},
                ),
              ],
            ),
          ),
          const SizedBox(height: 4),
        ],
      ),
    );
  }

  Widget _buildMediaGrid(List<PostMedia> media) {
    if (media.isEmpty) return const SizedBox.shrink();

    if (media.length == 1) {
      return AspectRatio(
        aspectRatio: 4 / 3,
        child: Image.network(
          media[0].mediaUrl,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => Container(
            color: Colors.grey[200],
            child: const Center(child: Icon(Icons.broken_image)),
          ),
        ),
      );
    }

    return SizedBox(
      height: 200,
      child: Row(
        children: [
          Expanded(
            child: Image.network(
              media[0].mediaUrl,
              fit: BoxFit.cover,
              height: 200,
            ),
          ),
          if (media.length > 1) ...[
            const SizedBox(width: 2),
            Expanded(
              child: Column(
                children: [
                  Expanded(
                    child: Image.network(
                      media[1].mediaUrl,
                      fit: BoxFit.cover,
                      width: double.infinity,
                    ),
                  ),
                  if (media.length > 2) ...[
                    const SizedBox(height: 2),
                    Expanded(
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          Image.network(
                            media[2].mediaUrl,
                            fit: BoxFit.cover,
                            width: double.infinity,
                          ),
                          if (media.length > 3)
                            Container(
                              color: Colors.black54,
                              child: Center(
                                child: Text(
                                  '+${media.length - 3}',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 18,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _toggleLike(WidgetRef ref) async {
    try {
      final client = Supabase.instance.client;
      if (post.isLikedByMe) {
        await client
            .from(ApiConstants.postLikesTable)
            .delete()
            .eq('post_id', post.id)
            .eq('user_id', client.auth.currentUser!.id);
      } else {
        await client.from(ApiConstants.postLikesTable).insert({
          'post_id': post.id,
          'user_id': client.auth.currentUser!.id,
        });
      }
    } catch (_) {}
  }

  String _formatTime(DateTime date) {
    final now = DateTime.now();
    final diff = now.difference(date);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return '${date.month}/${date.day}/${date.year}';
  }

  String _getBadgeEmoji(String badge) {
    switch (badge) {
      case 'birthday':
        return '🎂';
      case 'trip':
        return '✈️';
      case 'throwback':
        return '📸';
      case 'celebration':
        return '🎉';
      default:
        return '✨';
    }
  }
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String? label;
  final Color? color;
  final VoidCallback? onTap;

  const _ActionButton({
    required this.icon,
    this.label,
    this.color,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 20, color: color),
            if (label != null && label!.isNotEmpty) ...[
              const SizedBox(width: 4),
              Text(
                label!,
                style: theme.textTheme.labelMedium?.copyWith(
                  color: color,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
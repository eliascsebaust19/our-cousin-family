import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../../core/theme/color_palette.dart';
import '../../../../core/widgets/cached_avatar.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../shared/models/chat.dart';
import '../../../../shared/providers/auth_provider.dart';
import '../../../../core/constants/api_constants.dart';

class ChatListScreen extends ConsumerStatefulWidget {
  const ChatListScreen({super.key});

  @override
  ConsumerState<ChatListScreen> createState() => _ChatListScreenState();
}

class _ChatListScreenState extends ConsumerState<ChatListScreen> {
  List<Conversation> _conversations = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadConversations();
  }

  Future<void> _loadConversations() async {
    try {
      final client = Supabase.instance.client;
      final userId = client.auth.currentUser!.id;

      final response = await client
          .from(ApiConstants.conversationMembersTable)
          .select('conversations(*, conversation_members(*, profiles(*)))')
          .eq('user_id', userId)
          .order('joined_at', ascending: false);

      setState(() {
        _conversations = (response as List).map((item) {
          final conv = item['conversations'] as Map<String, dynamic>;
          return Conversation.fromJson(conv);
        }).toList();
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final currentUserId = ref.watch(currentUserIdProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Messages'),
        actions: [
          IconButton(
            icon: const Icon(Icons.edit_square),
            onPressed: () => context.push('/chat/new'),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadConversations,
        child: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : _conversations.isEmpty
                ? EmptyState(
                    icon: Icons.chat_bubble_outline_rounded,
                    title: 'No Conversations',
                    message: 'Start a chat with your family members.',
                    actionLabel: 'New Chat',
                    onAction: () => context.push('/chat/new'),
                  )
                : ListView.builder(
                    itemCount: _conversations.length,
                    itemBuilder: (context, index) {
                      final conv = _conversations[index];
                      return _ConversationTile(
                        conversation: conv,
                        currentUserId: currentUserId ?? '',
                      );
                    },
                  ),
      ),
    );
  }
}

class _ConversationTile extends StatelessWidget {
  final Conversation conversation;
  final String currentUserId;

  const _ConversationTile({
    required this.conversation,
    required this.currentUserId,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final name = conversation.displayName(currentUserId);
    final avatar = conversation.displayAvatar(currentUserId);

    return ListTile(
      leading: CachedAvatar(
        imageUrl: avatar,
        name: name,
        radius: 24,
        badge: conversation.unreadCount > 0
            ? Container(
                padding: const EdgeInsets.all(4),
                decoration: const BoxDecoration(
                  color: ColorPalette.primary,
                  shape: BoxShape.circle,
                ),
                child: Text(
                  '${conversation.unreadCount}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              )
            : null,
      ),
      title: Text(
        name,
        style: theme.textTheme.titleSmall?.copyWith(
          fontWeight: conversation.unreadCount > 0
              ? FontWeight.w700
              : FontWeight.w600,
        ),
      ),
      subtitle: conversation.lastMessage != null
          ? Text(
              conversation.lastMessage!.content,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.bodySmall?.copyWith(
                fontWeight: conversation.unreadCount > 0
                    ? FontWeight.w600
                    : FontWeight.w400,
              ),
            )
          : Text(
              'No messages yet',
              style: theme.textTheme.bodySmall,
            ),
      trailing: conversation.lastMessage != null
          ? Text(
              _formatTime(conversation.lastMessage!.createdAt),
              style: theme.textTheme.labelSmall,
            )
          : null,
      onTap: () => context.push('/chat/conversation/${conversation.id}'),
    );
  }

  String _formatTime(DateTime date) {
    final now = DateTime.now();
    final diff = now.difference(date);
    if (diff.inMinutes < 1) return 'Now';
    if (diff.inHours < 24) {
      return '${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
    }
    if (diff.inDays < 7) {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      return days[date.weekday - 1];
    }
    return '${date.month}/${date.day}';
  }
}
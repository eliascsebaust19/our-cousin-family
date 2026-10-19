import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../../core/theme/color_palette.dart';
import '../../../../core/widgets/cached_avatar.dart';
import '../../../../shared/models/chat.dart';
import '../../../../shared/providers/auth_provider.dart';
import '../../../../core/constants/api_constants.dart';

class ConversationScreen extends ConsumerStatefulWidget {
  final String conversationId;
  const ConversationScreen({super.key, required this.conversationId});

  @override
  ConsumerState<ConversationScreen> createState() =>
      _ConversationScreenState();
}

class _ConversationScreenState extends ConsumerState<ConversationScreen> {
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();
  final List<Message> _messages = [];
  bool _isLoading = true;
  RealtimeChannel? _channel;
  Conversation? _conversation;

  @override
  void initState() {
    super.initState();
    _loadMessages();
    _subscribeToMessages();
  }

  Future<void> _loadMessages() async {
    try {
      final client = Supabase.instance.client;

      // Load conversation details
      final convData = await client
          .from(ApiConstants.conversationsTable)
          .select('*, conversation_members(*, profiles(*))')
          .eq('id', widget.conversationId)
          .single();
      _conversation = Conversation.fromJson(convData);

      // Load messages
      final response = await client
          .from(ApiConstants.messagesTable)
          .select('*, sender:profiles!sender_id(*)')
          .eq('conversation_id', widget.conversationId)
          .order('created_at', ascending: true)
          .limit(50);

      setState(() {
        _messages.clear();
        _messages.addAll(
          (response as List).map((m) => Message.fromJson(m)).toList(),
        );
        _isLoading = false;
      });

      _scrollToBottom();

      // Mark as read
      await client.rpc(ApiConstants.markReadRpc, params: {
        'p_conversation_id': widget.conversationId,
      });
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  void _subscribeToMessages() {
    final client = Supabase.instance.client;
    _channel = client
        .channel('messages:${widget.conversationId}')
        .onPostgresChanges(
          event: PostgresChangeEvent.insert,
          schema: 'public',
          table: ApiConstants.messagesTable,
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'conversation_id',
            value: widget.conversationId,
          ),
          callback: (payload) {
            final message = Message.fromJson(
              payload.newRecord,
            );
            if (message.senderId != client.auth.currentUser!.id) {
              setState(() => _messages.add(message));
              _scrollToBottom();
            }
          },
        )
        .subscribe();
  }

  Future<void> _sendMessage() async {
    final content = _messageController.text.trim();
    if (content.isEmpty) return;

    _messageController.clear();

    try {
      final client = Supabase.instance.client;
      final userId = client.auth.currentUser!.id;

      final response = await client
          .from(ApiConstants.messagesTable)
          .insert({
            'conversation_id': widget.conversationId,
            'sender_id': userId,
            'content': content,
          })
          .select('*, sender:profiles!sender_id(*)')
          .single();

      setState(() {
        _messages.add(Message.fromJson(response));
      });

      _scrollToBottom();

      // Update conversation updated_at
      await client
          .from(ApiConstants.conversationsTable)
          .update({'updated_at': DateTime.now().toIso8601String()})
          .eq('id', widget.conversationId);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to send: $e')),
      );
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    _channel?.unsubscribe();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final currentUserId = ref.watch(currentUserIdProvider);

    return Scaffold(
      appBar: AppBar(
        title: _conversation != null
            ? Row(
                children: [
                  CachedAvatar(
                    imageUrl: _conversation!.displayAvatar(currentUserId ?? ''),
                    name: _conversation!.displayName(currentUserId ?? ''),
                    radius: 16,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      _conversation!.displayName(currentUserId ?? ''),
                      style: theme.textTheme.titleSmall,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              )
            : const Text('Chat'),
        actions: [
          IconButton(
            icon: const Icon(Icons.videocam_rounded),
            onPressed: () {
              // Start video call
            },
          ),
          IconButton(
            icon: const Icon(Icons.call_rounded),
            onPressed: () {
              // Start audio call
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // Messages
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _messages.isEmpty
                    ? const Center(child: Text('No messages yet. Say hello! 👋'))
                    : ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                        itemCount: _messages.length,
                        itemBuilder: (context, index) {
                          final message = _messages[index];
                          final isMe =
                              message.senderId == currentUserId;
                          return _MessageBubble(
                            message: message,
                            isMe: isMe,
                          );
                        },
                      ),
          ),

          // Input
          Container(
            padding: EdgeInsets.only(
              bottom: MediaQuery.of(context).viewInsets.bottom,
              left: 12,
              right: 12,
              top: 8,
            ),
            decoration: BoxDecoration(
              color: theme.scaffoldBackgroundColor,
              border: Border(top: BorderSide(color: theme.dividerColor)),
            ),
            child: SafeArea(
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.attach_file_rounded),
                    onPressed: () {},
                    iconSize: 22,
                  ),
                  Expanded(
                    child: Container(
                      decoration: BoxDecoration(
                        color: theme.colorScheme.surfaceVariant,
                        borderRadius: BorderRadius.circular(24),
                      ),
                      child: Row(
                        children: [
                          const SizedBox(width: 16),
                          Expanded(
                            child: TextField(
                              controller: _messageController,
                              decoration: const InputDecoration(
                                hintText: 'Type a message...',
                                border: InputBorder.none,
                                enabledBorder: InputBorder.none,
                                focusedBorder: InputBorder.none,
                                fillColor: Colors.transparent,
                                filled: false,
                                contentPadding: EdgeInsets.symmetric(
                                  vertical: 10,
                                ),
                              ),
                              maxLines: 4,
                              minLines: 1,
                              textCapitalization:
                                  TextCapitalization.sentences,
                              onSubmitted: (_) => _sendMessage(),
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.mic_rounded),
                            onPressed: () {},
                            iconSize: 20,
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: _sendMessage,
                    child: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: const BoxDecoration(
                        color: ColorPalette.primary,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.send_rounded,
                        color: Colors.white,
                        size: 20,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  final Message message;
  final bool isMe;

  const _MessageBubble({required this.message, required this.isMe});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment:
            isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
        children: [
          if (!isMe)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: CachedAvatar(
                imageUrl: message.sender?.avatarUrl,
                name: message.sender?.fullName ?? '',
                radius: 14,
              ),
            ),
          Flexible(
            child: Container(
              padding: const EdgeInsets.symmetric(
                horizontal: 14,
                vertical: 10,
              ),
              decoration: BoxDecoration(
                color: isMe
                    ? ColorPalette.primary
                    : theme.colorScheme.surfaceVariant,
                borderRadius: BorderRadius.only(
                  topLeft: const Radius.circular(16),
                  topRight: const Radius.circular(16),
                  bottomLeft: Radius.circular(isMe ? 16 : 4),
                  bottomRight: Radius.circular(isMe ? 4 : 16),
                ),
              ),
              child: Column(
                crossAxisAlignment: isMe
                    ? CrossAxisAlignment.end
                    : CrossAxisAlignment.start,
                children: [
                  if (!isMe && message.sender != null)
                    Text(
                      message.sender!.fullName,
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: ColorPalette.colorForUser(message.senderId),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  Text(
                    message.isDeleted
                        ? 'This message was deleted'
                        : message.content,
                    style: TextStyle(
                      color: isMe ? Colors.white : theme.textTheme.bodyMedium?.color,
                      fontStyle:
                          message.isDeleted ? FontStyle.italic : FontStyle.normal,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    _formatTime(message.createdAt),
                    style: TextStyle(
                      color: isMe
                          ? Colors.white70
                          : theme.textTheme.labelSmall?.color,
                      fontSize: 10,
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (isMe)
            Padding(
              padding: const EdgeInsets.only(left: 8),
              child: Icon(
                Icons.done_all,
                size: 14,
                color: ColorPalette.primary.withOpacity(0.5),
              ),
            ),
        ],
      ),
    );
  }

  String _formatTime(DateTime date) {
    return '${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
  }
}
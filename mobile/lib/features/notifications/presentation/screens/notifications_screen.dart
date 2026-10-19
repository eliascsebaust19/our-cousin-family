import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../../core/theme/color_palette.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../shared/models/notification.dart';
import '../../../../shared/providers/auth_provider.dart';
import '../../../../core/constants/api_constants.dart';

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() =>
      _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  List<AppNotification> _notifications = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadNotifications();
  }

  Future<void> _loadNotifications() async {
    try {
      final client = Supabase.instance.client;
      final userId = client.auth.currentUser!.id;

      final response = await client
          .from(ApiConstants.notificationsTable)
          .select()
          .eq('user_id', userId)
          .order('created_at', ascending: false)
          .limit(50);

      setState(() {
        _notifications = (response as List)
            .map((n) => AppNotification.fromJson(n))
            .toList();
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _markAllRead() async {
    try {
      final client = Supabase.instance.client;
      final userId = client.auth.currentUser!.id;

      await client
          .from(ApiConstants.notificationsTable)
          .update({'is_read': true})
          .eq('user_id', userId)
          .eq('is_read', false);

      setState(() {
        _notifications = _notifications
            .map((n) => AppNotification(
                  id: n.id,
                  userId: n.userId,
                  type: n.type,
                  title: n.title,
                  body: n.body,
                  data: n.data,
                  isRead: true,
                  createdAt: n.createdAt,
                ))
            .toList();
      });
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          TextButton(
            onPressed: _markAllRead,
            child: const Text('Mark all read'),
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _notifications.isEmpty
              ? const EmptyState(
                  icon: Icons.notifications_none_rounded,
                  title: 'No Notifications',
                  message: 'You\'re all caught up!',
                )
              : RefreshIndicator(
                  onRefresh: _loadNotifications,
                  child: ListView.builder(
                    itemCount: _notifications.length,
                    itemBuilder: (context, index) {
                      final notification = _notifications[index];
                      return _NotificationTile(notification: notification);
                    },
                  ),
                ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  final AppNotification notification;
  const _NotificationTile({required this.notification});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return ListTile(
      leading: CircleAvatar(
        backgroundColor: _getTypeColor().withOpacity(0.15),
        child: Icon(_getTypeIcon(), color: _getTypeColor(), size: 20),
      ),
      title: Text(
        notification.title,
        style: theme.textTheme.titleSmall?.copyWith(
          fontWeight:
              notification.isRead ? FontWeight.w500 : FontWeight.w700,
        ),
      ),
      subtitle: notification.body != null
          ? Text(
              notification.body!,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            )
          : null,
      trailing: notification.isRead
          ? null
          : Container(
              width: 8,
              height: 8,
              decoration: const BoxDecoration(
                color: ColorPalette.primary,
                shape: BoxShape.circle,
              ),
            ),
      tileColor: notification.isRead
          ? null
          : ColorPalette.primaryExtraLight.withOpacity(0.3),
    );
  }

  IconData _getTypeIcon() {
    switch (notification.type) {
      case 'comment':
        return Icons.comment_rounded;
      case 'reaction':
        return Icons.favorite_rounded;
      case 'invite':
        return Icons.group_add_rounded;
      case 'message':
        return Icons.chat_bubble_rounded;
      case 'game':
        return Icons.games_rounded;
      case 'event':
        return Icons.event_rounded;
      default:
        return Icons.notifications_rounded;
    }
  }

  Color _getTypeColor() {
    switch (notification.type) {
      case 'comment':
        return ColorPalette.info;
      case 'reaction':
        return ColorPalette.error;
      case 'invite':
        return ColorPalette.tertiary;
      case 'message':
        return ColorPalette.primary;
      case 'game':
        return ColorPalette.accent;
      case 'event':
        return ColorPalette.secondary;
      default:
        return ColorPalette.primary;
    }
  }
}
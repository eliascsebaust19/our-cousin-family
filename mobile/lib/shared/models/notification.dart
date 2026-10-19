class AppNotification {
  final String id;
  final String userId;
  final String type; // comment, reaction, reply, invite, approval, message, game, event
  final String title;
  final String? body;
  final Map<String, dynamic>? data;
  final bool isRead;
  final DateTime createdAt;

  const AppNotification({
    required this.id,
    required this.userId,
    required this.type,
    required this.title,
    this.body,
    this.data,
    this.isRead = false,
    required this.createdAt,
  });

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    return AppNotification(
      id: json['id'] as String,
      userId: json['user_id'] as String,
      type: json['type'] as String,
      title: json['title'] as String,
      body: json['body'] as String?,
      data: json['data'] as Map<String, dynamic>?,
      isRead: json['is_read'] as bool? ?? false,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : DateTime.now(),
    );
  }

  String? get route => data?['route'] as String?;
  String? get imageUrl => data?['image_url'] as String?;

  bool get isComment => type == 'comment';
  bool get isReaction => type == 'reaction';
  bool get isInvite => type == 'invite';
  bool get isMessage => type == 'message';
  bool get isGame => type == 'game';
  bool get isEvent => type == 'event';
}
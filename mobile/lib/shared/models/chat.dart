import 'user_profile.dart';

class Conversation {
  final String id;
  final String? name; // null for DMs, set for group chats
  final String? avatarUrl;
  final bool isGroup;
  final String? familyId;
  final String createdBy;
  final DateTime createdAt;
  final DateTime updatedAt;
  final Message? lastMessage;
  final int unreadCount;
  final List<ConversationMember> members;

  const Conversation({
    required this.id,
    this.name,
    this.avatarUrl,
    this.isGroup = false,
    this.familyId,
    required this.createdBy,
    required this.createdAt,
    required this.updatedAt,
    this.lastMessage,
    this.unreadCount = 0,
    this.members = const [],
  });

  factory Conversation.fromJson(Map<String, dynamic> json) {
    return Conversation(
      id: json['id'] as String,
      name: json['name'] as String?,
      avatarUrl: json['avatar_url'] as String?,
      isGroup: json['is_group'] as bool? ?? false,
      familyId: json['family_id'] as String?,
      createdBy: json['created_by'] as String,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : DateTime.now(),
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'] as String)
          : DateTime.now(),
      lastMessage: json['last_message'] != null
          ? Message.fromJson(json['last_message'] as Map<String, dynamic>)
          : null,
      unreadCount: json['unread_count'] as int? ?? 0,
      members: (json['members'] as List<dynamic>?)
              ?.map((m) =>
                  ConversationMember.fromJson(m as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }

  String displayName(String currentUserId) {
    if (name != null && name!.isNotEmpty) return name!;
    if (isGroup) return 'Group Chat';
    final other = members.where((m) => m.userId != currentUserId).toList();
    if (other.isNotEmpty) return other.first.user?.fullName ?? 'Unknown';
    return 'Chat';
  }

  String? displayAvatar(String currentUserId) {
    if (avatarUrl != null) return avatarUrl;
    if (isGroup) return null;
    final other = members.where((m) => m.userId != currentUserId).toList();
    return other.isNotEmpty ? other.first.user?.avatarUrl : null;
  }
}

class ConversationMember {
  final String id;
  final String conversationId;
  final String userId;
  final String role;
  final DateTime? lastReadAt;
  final UserProfile? user;

  const ConversationMember({
    required this.id,
    required this.conversationId,
    required this.userId,
    this.role = 'member',
    this.lastReadAt,
    this.user,
  });

  factory ConversationMember.fromJson(Map<String, dynamic> json) {
    return ConversationMember(
      id: json['id'] as String,
      conversationId: json['conversation_id'] as String,
      userId: json['user_id'] as String,
      role: json['role'] as String? ?? 'member',
      lastReadAt: json['last_read_at'] != null
          ? DateTime.parse(json['last_read_at'] as String)
          : null,
      user: json['profiles'] != null
          ? UserProfile.fromJson(json['profiles'] as Map<String, dynamic>)
          : null,
    );
  }
}

class Message {
  final String id;
  final String conversationId;
  final String senderId;
  final String content;
  final String? mediaUrl;
  final String? mediaType;
  final String? replyToId;
  final bool isEdited;
  final bool isDeleted;
  final DateTime createdAt;
  final DateTime updatedAt;
  final UserProfile? sender;
  final Message? replyTo;

  const Message({
    required this.id,
    required this.conversationId,
    required this.senderId,
    required this.content,
    this.mediaUrl,
    this.mediaType,
    this.replyToId,
    this.isEdited = false,
    this.isDeleted = false,
    required this.createdAt,
    required this.updatedAt,
    this.sender,
    this.replyTo,
  });

  factory Message.fromJson(Map<String, dynamic> json) {
    return Message(
      id: json['id'] as String,
      conversationId: json['conversation_id'] as String,
      senderId: json['sender_id'] as String,
      content: json['content'] as String? ?? '',
      mediaUrl: json['media_url'] as String?,
      mediaType: json['media_type'] as String?,
      replyToId: json['reply_to_id'] as String?,
      isEdited: json['is_edited'] as bool? ?? false,
      isDeleted: json['is_deleted'] as bool? ?? false,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : DateTime.now(),
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'] as String)
          : DateTime.now(),
      sender: json['sender'] != null
          ? UserProfile.fromJson(json['sender'] as Map<String, dynamic>)
          : null,
      replyTo: json['reply_to'] != null
          ? Message.fromJson(json['reply_to'] as Map<String, dynamic>)
          : null,
    );
  }

  bool get hasMedia => mediaUrl != null && mediaUrl!.isNotEmpty;
  bool get isTextOnly => content.isNotEmpty && !hasMedia;
  bool get isVoiceNote => mediaType == 'voice';
  bool get isImage => mediaType == 'image';
  bool get isVideo => mediaType == 'video';
}
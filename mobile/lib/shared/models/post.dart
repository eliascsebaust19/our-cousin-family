class Post {
  final String id;
  final String familyId;
  final String authorId;
  final String content;
  final String? momentBadge; // birthday, trip, throwback, celebration, etc.
  final bool isPinned;
  final int likesCount;
  final int commentsCount;
  final DateTime createdAt;
  final DateTime updatedAt;
  final UserProfile? author;
  final List<PostMedia> media;
  final bool isLikedByMe;
  final List<PostReaction> reactions;

  const Post({
    required this.id,
    required this.familyId,
    required this.authorId,
    required this.content,
    this.momentBadge,
    this.isPinned = false,
    this.likesCount = 0,
    this.commentsCount = 0,
    required this.createdAt,
    required this.updatedAt,
    this.author,
    this.media = const [],
    this.isLikedByMe = false,
    this.reactions = const [],
  });

  factory Post.fromJson(Map<String, dynamic> json) {
    return Post(
      id: json['id'] as String,
      familyId: json['family_id'] as String,
      authorId: json['author_id'] as String,
      content: json['content'] as String? ?? '',
      momentBadge: json['moment_badge'] as String?,
      isPinned: json['is_pinned'] as bool? ?? false,
      likesCount: json['likes_count'] as int? ?? 0,
      commentsCount: json['comments_count'] as int? ?? 0,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : DateTime.now(),
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'] as String)
          : DateTime.now(),
      author: json['profiles'] != null
          ? UserProfile.fromJson(json['profiles'] as Map<String, dynamic>)
          : null,
      media: (json['post_media'] as List<dynamic>?)
              ?.map((m) => PostMedia.fromJson(m as Map<String, dynamic>))
              .toList() ??
          [],
      isLikedByMe: json['is_liked_by_me'] as bool? ?? false,
      reactions: (json['reactions'] as List<dynamic>?)
              ?.map((r) => PostReaction.fromJson(r as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}

class PostMedia {
  final String id;
  final String postId;
  final String mediaType; // image, video, audio
  final String mediaUrl;
  final String? thumbnailUrl;
  final String? caption;
  final int? duration; // seconds, for video/audio
  final int sortOrder;

  const PostMedia({
    required this.id,
    required this.postId,
    required this.mediaType,
    required this.mediaUrl,
    this.thumbnailUrl,
    this.caption,
    this.duration,
    this.sortOrder = 0,
  });

  factory PostMedia.fromJson(Map<String, dynamic> json) {
    return PostMedia(
      id: json['id'] as String,
      postId: json['post_id'] as String,
      mediaType: json['media_type'] as String,
      mediaUrl: json['media_url'] as String,
      thumbnailUrl: json['thumbnail_url'] as String?,
      caption: json['caption'] as String?,
      duration: json['duration'] as int?,
      sortOrder: json['sort_order'] as int? ?? 0,
    );
  }

  bool get isImage => mediaType == 'image';
  bool get isVideo => mediaType == 'video';
  bool get isAudio => mediaType == 'audio';
}

class PostReaction {
  final String emoji;
  final int count;
  final bool reactedByMe;

  const PostReaction({
    required this.emoji,
    this.count = 0,
    this.reactedByMe = false,
  });

  factory PostReaction.fromJson(Map<String, dynamic> json) {
    return PostReaction(
      emoji: json['emoji'] as String,
      count: json['count'] as int? ?? 0,
      reactedByMe: json['reacted_by_me'] as bool? ?? false,
    );
  }
}

class Comment {
  final String id;
  final String postId;
  final String authorId;
  final String content;
  final String? parentCommentId;
  final int likesCount;
  final DateTime createdAt;
  final DateTime updatedAt;
  final UserProfile? author;
  final List<Comment> replies;
  final bool isLikedByMe;

  const Comment({
    required this.id,
    required this.postId,
    required this.authorId,
    required this.content,
    this.parentCommentId,
    this.likesCount = 0,
    required this.createdAt,
    required this.updatedAt,
    this.author,
    this.replies = const [],
    this.isLikedByMe = false,
  });

  factory Comment.fromJson(Map<String, dynamic> json) {
    return Comment(
      id: json['id'] as String,
      postId: json['post_id'] as String,
      authorId: json['author_id'] as String,
      content: json['content'] as String? ?? '',
      parentCommentId: json['parent_comment_id'] as String?,
      likesCount: json['likes_count'] as int? ?? 0,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : DateTime.now(),
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'] as String)
          : DateTime.now(),
      author: json['profiles'] != null
          ? UserProfile.fromJson(json['profiles'] as Map<String, dynamic>)
          : null,
      replies: (json['replies'] as List<dynamic>?)
              ?.map((r) => Comment.fromJson(r as Map<String, dynamic>))
              .toList() ??
          [],
      isLikedByMe: json['is_liked_by_me'] as bool? ?? false,
    );
  }

  bool get isReply => parentCommentId != null;
}
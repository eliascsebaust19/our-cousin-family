class MemoryAlbum {
  final String id;
  final String familyId;
  final String name;
  final String? description;
  final String? coverImageUrl;
  final String createdBy;
  final int memoryCount;
  final DateTime createdAt;
  final DateTime updatedAt;

  const MemoryAlbum({
    required this.id,
    required this.familyId,
    required this.name,
    this.description,
    this.coverImageUrl,
    required this.createdBy,
    this.memoryCount = 0,
    required this.createdAt,
    required this.updatedAt,
  });

  factory MemoryAlbum.fromJson(Map<String, dynamic> json) {
    return MemoryAlbum(
      id: json['id'] as String,
      familyId: json['family_id'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      coverImageUrl: json['cover_image_url'] as String?,
      createdBy: json['created_by'] as String,
      memoryCount: json['memory_count'] as int? ?? 0,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : DateTime.now(),
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'] as String)
          : DateTime.now(),
    );
  }
}

class Memory {
  final String id;
  final String familyId;
  final String? albumId;
  final String uploadedBy;
  final String title;
  final String? description;
  final String mediaType; // photo, video, document, audio
  final String mediaUrl;
  final String? thumbnailUrl;
  final List<String> tags;
  final DateTime? takenAt;
  final int? duration;
  final int? fileSizeBytes;
  final DateTime createdAt;
  final UserProfile? uploader;

  const Memory({
    required this.id,
    required this.familyId,
    this.albumId,
    required this.uploadedBy,
    required this.title,
    this.description,
    required this.mediaType,
    required this.mediaUrl,
    this.thumbnailUrl,
    this.tags = const [],
    this.takenAt,
    this.duration,
    this.fileSizeBytes,
    required this.createdAt,
    this.uploader,
  });

  factory Memory.fromJson(Map<String, dynamic> json) {
    return Memory(
      id: json['id'] as String,
      familyId: json['family_id'] as String,
      albumId: json['album_id'] as String?,
      uploadedBy: json['uploaded_by'] as String,
      title: json['title'] as String,
      description: json['description'] as String?,
      mediaType: json['media_type'] as String,
      mediaUrl: json['media_url'] as String,
      thumbnailUrl: json['thumbnail_url'] as String?,
      tags: (json['tags'] as List<dynamic>?)
              ?.map((t) => t as String)
              .toList() ??
          [],
      takenAt: json['taken_at'] != null
          ? DateTime.parse(json['taken_at'] as String)
          : null,
      duration: json['duration'] as int?,
      fileSizeBytes: json['file_size_bytes'] as int?,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : DateTime.now(),
      uploader: json['profiles'] != null
          ? UserProfile.fromJson(json['profiles'] as Map<String, dynamic>)
          : null,
    );
  }

  bool get isPhoto => mediaType == 'photo';
  bool get isVideo => mediaType == 'video';
  bool get isDocument => mediaType == 'document';
  bool get isAudio => mediaType == 'audio';
}

class VoiceMemory {
  final String id;
  final String familyId;
  final String recordedBy;
  final String title;
  final String? description;
  final String? speakerName;
  final String audioUrl;
  final int durationSeconds;
  final DateTime? recordedAt;
  final DateTime createdAt;
  final UserProfile? recorder;

  const VoiceMemory({
    required this.id,
    required this.familyId,
    required this.recordedBy,
    required this.title,
    this.description,
    this.speakerName,
    required this.audioUrl,
    this.durationSeconds = 0,
    this.recordedAt,
    required this.createdAt,
    this.recorder,
  });

  factory VoiceMemory.fromJson(Map<String, dynamic> json) {
    return VoiceMemory(
      id: json['id'] as String,
      familyId: json['family_id'] as String,
      recordedBy: json['recorded_by'] as String,
      title: json['title'] as String,
      description: json['description'] as String?,
      speakerName: json['speaker_name'] as String?,
      audioUrl: json['audio_url'] as String,
      durationSeconds: json['duration_seconds'] as int? ?? 0,
      recordedAt: json['recorded_at'] != null
          ? DateTime.parse(json['recorded_at'] as String)
          : null,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : DateTime.now(),
      recorder: json['profiles'] != null
          ? UserProfile.fromJson(json['profiles'] as Map<String, dynamic>)
          : null,
    );
  }

  String get formattedDuration {
    final minutes = durationSeconds ~/ 60;
    final seconds = durationSeconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
  }
}
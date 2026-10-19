enum FamilyRole { owner, admin, moderator, member }

FamilyRole familyRoleFromString(String role) {
  switch (role.toLowerCase()) {
    case 'owner':
      return FamilyRole.owner;
    case 'admin':
      return FamilyRole.admin;
    case 'moderator':
      return FamilyRole.moderator;
    default:
      return FamilyRole.member;
  }
}

String familyRoleToString(FamilyRole role) {
  return role.name;
}

class Family {
  final String id;
  final String name;
  final String? description;
  final String? coverImageUrl;
  final String? rules;
  final String createdBy;
  final int memberCount;
  final DateTime createdAt;
  final DateTime updatedAt;

  const Family({
    required this.id,
    required this.name,
    this.description,
    this.coverImageUrl,
    this.rules,
    required this.createdBy,
    this.memberCount = 0,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Family.fromJson(Map<String, dynamic> json) {
    return Family(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      coverImageUrl: json['cover_image_url'] as String?,
      rules: json['rules'] as String?,
      createdBy: json['created_by'] as String,
      memberCount: json['member_count'] as int? ?? 0,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : DateTime.now(),
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'] as String)
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'description': description,
      'cover_image_url': coverImageUrl,
      'rules': rules,
    };
  }
}

class FamilyMember {
  final String id;
  final String familyId;
  final String userId;
  final FamilyRole role;
  final DateTime joinedAt;
  final UserProfile? user;

  const FamilyMember({
    required this.id,
    required this.familyId,
    required this.userId,
    required this.role,
    required this.joinedAt,
    this.user,
  });

  factory FamilyMember.fromJson(Map<String, dynamic> json) {
    return FamilyMember(
      id: json['id'] as String,
      familyId: json['family_id'] as String,
      userId: json['user_id'] as String,
      role: familyRoleFromString(json['role'] as String? ?? 'member'),
      joinedAt: json['joined_at'] != null
          ? DateTime.parse(json['joined_at'] as String)
          : DateTime.now(),
      user: json['profiles'] != null
          ? UserProfile.fromJson(json['profiles'] as Map<String, dynamic>)
          : null,
    );
  }
}

class FamilyInvitation {
  final String id;
  final String familyId;
  final String code;
  final String? invitedBy;
  final String? invitedEmail;
  final FamilyRole role;
  final String status; // pending, accepted, expired, revoked
  final int maxUses;
  final int usedCount;
  final DateTime? expiresAt;
  final DateTime createdAt;

  const FamilyInvitation({
    required this.id,
    required this.familyId,
    required this.code,
    this.invitedBy,
    this.invitedEmail,
    this.role = FamilyRole.member,
    this.status = 'pending',
    this.maxUses = 10,
    this.usedCount = 0,
    this.expiresAt,
    required this.createdAt,
  });

  factory FamilyInvitation.fromJson(Map<String, dynamic> json) {
    return FamilyInvitation(
      id: json['id'] as String,
      familyId: json['family_id'] as String,
      code: json['code'] as String,
      invitedBy: json['invited_by'] as String?,
      invitedEmail: json['invited_email'] as String?,
      role: familyRoleFromString(json['role'] as String? ?? 'member'),
      status: json['status'] as String? ?? 'pending',
      maxUses: json['max_uses'] as int? ?? 10,
      usedCount: json['used_count'] as int? ?? 0,
      expiresAt: json['expires_at'] != null
          ? DateTime.parse(json['expires_at'] as String)
          : null,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : DateTime.now(),
    );
  }

  bool get isExpired =>
      expiresAt != null && expiresAt!.isBefore(DateTime.now());
  bool get isMaxedOut => usedCount >= maxUses;
  bool get isValid => status == 'pending' && !isExpired && !isMaxedOut;
}

class FamilyRelationship {
  final String id;
  final String familyId;
  final String userId;
  final String relatedUserId;
  final String relationshipType; // parent, child, sibling, spouse, cousin, etc.
  final DateTime createdAt;

  const FamilyRelationship({
    required this.id,
    required this.familyId,
    required this.userId,
    required this.relatedUserId,
    required this.relationshipType,
    required this.createdAt,
  });

  factory FamilyRelationship.fromJson(Map<String, dynamic> json) {
    return FamilyRelationship(
      id: json['id'] as String,
      familyId: json['family_id'] as String,
      userId: json['user_id'] as String,
      relatedUserId: json['related_user_id'] as String,
      relationshipType: json['relationship_type'] as String,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : DateTime.now(),
    );
  }
}
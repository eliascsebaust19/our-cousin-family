import 'package:flutter_test/flutter_test.dart';
import 'package:our_cousin_family/shared/models/user_profile.dart';
import 'package:our_cousin_family/shared/models/family.dart';
import 'package:our_cousin_family/shared/models/post.dart';
import 'package:our_cousin_family/shared/models/chat.dart';
import 'package:our_cousin_family/shared/models/game.dart';
import 'package:our_cousin_family/shared/models/event.dart';
import 'package:our_cousin_family/shared/models/notification.dart';

void main() {
  group('UserProfile', () {
    test('fromJson creates correct UserProfile', () {
      final json = {
        'id': 'user-1',
        'email': 'test@example.com',
        'full_name': 'John Doe',
        'avatar_url': null,
        'bio': 'Hello world',
        'created_at': '2024-01-01T00:00:00.000Z',
        'updated_at': '2024-01-01T00:00:00.000Z',
      };

      final profile = UserProfile.fromJson(json);
      expect(profile.id, 'user-1');
      expect(profile.email, 'test@example.com');
      expect(profile.fullName, 'John Doe');
      expect(profile.bio, 'Hello world');
    });

    test('initials returns correct values', () {
      final profile = UserProfile(
        id: '1',
        email: 'test@test.com',
        fullName: 'John Doe',
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );
      expect(profile.initials, 'JD');
    });

    test('initials handles single name', () {
      final profile = UserProfile(
        id: '1',
        email: 'test@test.com',
        fullName: 'John',
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );
      expect(profile.initials, 'JO');
    });

    test('toJson produces correct map', () {
      final profile = UserProfile(
        id: 'user-1',
        email: 'test@test.com',
        fullName: 'John Doe',
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );
      final json = profile.toJson();
      expect(json['id'], 'user-1');
      expect(json['full_name'], 'John Doe');
    });

    test('copyWith creates new instance', () {
      final profile = UserProfile(
        id: 'user-1',
        email: 'test@test.com',
        fullName: 'John Doe',
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );
      final updated = profile.copyWith(fullName: 'Jane Doe');
      expect(updated.fullName, 'Jane Doe');
      expect(updated.id, 'user-1');
    });
  });

  group('Family', () {
    test('fromJson creates correct Family', () {
      final json = {
        'id': 'family-1',
        'name': 'The Ahmed Family',
        'description': 'Our family',
        'created_by': 'user-1',
        'member_count': 5,
        'created_at': '2024-01-01T00:00:00.000Z',
        'updated_at': '2024-01-01T00:00:00.000Z',
      };

      final family = Family.fromJson(json);
      expect(family.id, 'family-1');
      expect(family.name, 'The Ahmed Family');
      expect(family.memberCount, 5);
    });
  });

  group('FamilyRole', () {
    test('familyRoleFromString parses roles correctly', () {
      expect(familyRoleFromString('owner'), FamilyRole.owner);
      expect(familyRoleFromString('admin'), FamilyRole.admin);
      expect(familyRoleFromString('moderator'), FamilyRole.moderator);
      expect(familyRoleFromString('member'), FamilyRole.member);
      expect(familyRoleFromString('unknown'), FamilyRole.member);
    });

    test('familyRoleToString converts correctly', () {
      expect(familyRoleToString(FamilyRole.owner), 'owner');
      expect(familyRoleToString(FamilyRole.admin), 'admin');
    });
  });

  group('FamilyInvitation', () {
    test('isExpired returns true for past dates', () {
      final invitation = FamilyInvitation(
        id: '1',
        familyId: 'f1',
        code: 'ABC123',
        expiresAt: DateTime.now().subtract(const Duration(days: 1)),
        createdAt: DateTime.now().subtract(const Duration(days: 7)),
      );
      expect(invitation.isExpired, true);
    });

    test('isValid returns true for valid invitations', () {
      final invitation = FamilyInvitation(
        id: '1',
        familyId: 'f1',
        code: 'ABC123',
        status: 'pending',
        expiresAt: DateTime.now().add(const Duration(days: 7)),
        createdAt: DateTime.now(),
      );
      expect(invitation.isValid, true);
    });
  });

  group('Post', () {
    test('fromJson creates correct Post', () {
      final json = {
        'id': 'post-1',
        'family_id': 'family-1',
        'author_id': 'user-1',
        'content': 'Hello family!',
        'is_pinned': false,
        'likes_count': 5,
        'comments_count': 2,
        'created_at': '2024-01-01T00:00:00.000Z',
        'updated_at': '2024-01-01T00:00:00.000Z',
      };

      final post = Post.fromJson(json);
      expect(post.id, 'post-1');
      expect(post.content, 'Hello family!');
      expect(post.likesCount, 5);
    });
  });

  group('Message', () {
    test('hasMedia returns true when mediaUrl is set', () {
      final message = Message(
        id: '1',
        conversationId: 'c1',
        senderId: 'u1',
        content: '',
        mediaUrl: 'https://example.com/image.jpg',
        mediaType: 'image',
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );
      expect(message.hasMedia, true);
      expect(message.isImage, true);
    });

    test('isDeleted returns true', () {
      final message = Message(
        id: '1',
        conversationId: 'c1',
        senderId: 'u1',
        content: 'deleted',
        isDeleted: true,
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );
      expect(message.isDeleted, true);
    });
  });

  group('Conversation', () {
    test('displayName returns name for group', () {
      final conv = Conversation(
        id: '1',
        name: 'Family Chat',
        isGroup: true,
        createdBy: 'u1',
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );
      expect(conv.displayName('u1'), 'Family Chat');
    });

    test('displayName returns Group Chat when no name', () {
      final conv = Conversation(
        id: '1',
        isGroup: true,
        createdBy: 'u1',
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );
      expect(conv.displayName('u1'), 'Group Chat');
    });
  });

  group('GameRoom', () {
    test('isWaiting returns true for waiting status', () {
      final room = GameRoom(
        id: '1',
        familyId: 'f1',
        createdBy: 'u1',
        status: 'waiting',
        createdAt: DateTime.now(),
      );
      expect(room.isWaiting, true);
      expect(room.isPlaying, false);
    });
  });

  group('FamilyEvent', () {
    test('isBirthday returns true for birthday events', () {
      final event = FamilyEvent(
        id: '1',
        familyId: 'f1',
        createdBy: 'u1',
        title: 'Birthday',
        eventType: 'birthday',
        startDate: DateTime.now(),
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );
      expect(event.isBirthday, true);
      expect(event.isAnniversary, false);
    });
  });

  group('AppNotification', () {
    test('isComment returns true for comment type', () {
      final notification = AppNotification(
        id: '1',
        userId: 'u1',
        type: 'comment',
        title: 'New comment',
        createdAt: DateTime.now(),
      );
      expect(notification.isComment, true);
      expect(notification.isMessage, false);
    });
  });
}
class FamilyEvent {
  final String id;
  final String familyId;
  final String createdBy;
  final String title;
  final String? description;
  final String eventType; // birthday, anniversary, reunion, religious, custom
  final DateTime startDate;
  final DateTime? endDate;
  final String? location;
  final String? locationUrl;
  final bool isAllDay;
  final bool isRecurring;
  final String? recurrenceRule;
  final int rsvpYes;
  final int rsvpNo;
  final int rsvpMaybe;
  final DateTime createdAt;
  final DateTime updatedAt;
  final UserProfile? creator;
  final List<EventParticipant> participants;

  const FamilyEvent({
    required this.id,
    required this.familyId,
    required this.createdBy,
    required this.title,
    this.description,
    required this.eventType,
    required this.startDate,
    this.endDate,
    this.location,
    this.locationUrl,
    this.isAllDay = false,
    this.isRecurring = false,
    this.recurrenceRule,
    this.rsvpYes = 0,
    this.rsvpNo = 0,
    this.rsvpMaybe = 0,
    required this.createdAt,
    required this.updatedAt,
    this.creator,
    this.participants = const [],
  });

  factory FamilyEvent.fromJson(Map<String, dynamic> json) {
    return FamilyEvent(
      id: json['id'] as String,
      familyId: json['family_id'] as String,
      createdBy: json['created_by'] as String,
      title: json['title'] as String,
      description: json['description'] as String?,
      eventType: json['event_type'] as String? ?? 'custom',
      startDate: DateTime.parse(json['start_date'] as String),
      endDate: json['end_date'] != null
          ? DateTime.parse(json['end_date'] as String)
          : null,
      location: json['location'] as String?,
      locationUrl: json['location_url'] as String?,
      isAllDay: json['is_all_day'] as bool? ?? false,
      isRecurring: json['is_recurring'] as bool? ?? false,
      recurrenceRule: json['recurrence_rule'] as String?,
      rsvpYes: json['rsvp_yes'] as int? ?? 0,
      rsvpNo: json['rsvp_no'] as int? ?? 0,
      rsvpMaybe: json['rsvp_maybe'] as int? ?? 0,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : DateTime.now(),
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'] as String)
          : DateTime.now(),
      creator: json['profiles'] != null
          ? UserProfile.fromJson(json['profiles'] as Map<String, dynamic>)
          : null,
      participants: (json['event_participants'] as List<dynamic>?)
              ?.map((p) =>
                  EventParticipant.fromJson(p as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }

  bool get isBirthday => eventType == 'birthday';
  bool get isAnniversary => eventType == 'anniversary';
  bool get isReunion => eventType == 'reunion';
  bool get isReligious => eventType == 'religious';
}

enum RsvpStatus { yes, no, maybe, pending }

class EventParticipant {
  final String id;
  final String eventId;
  final String userId;
  final RsvpStatus status;
  final UserProfile? user;

  const EventParticipant({
    required this.id,
    required this.eventId,
    required this.userId,
    this.status = RsvpStatus.pending,
    this.user,
  });

  factory EventParticipant.fromJson(Map<String, dynamic> json) {
    return EventParticipant(
      id: json['id'] as String,
      eventId: json['event_id'] as String,
      userId: json['user_id'] as String,
      status: _rsvpFromString(json['status'] as String? ?? 'pending'),
      user: json['profiles'] != null
          ? UserProfile.fromJson(json['profiles'] as Map<String, dynamic>)
          : null,
    );
  }

  static RsvpStatus _rsvpFromString(String status) {
    switch (status.toLowerCase()) {
      case 'yes':
        return RsvpStatus.yes;
      case 'no':
        return RsvpStatus.no;
      case 'maybe':
        return RsvpStatus.maybe;
      default:
        return RsvpStatus.pending;
    }
  }

  static String rsvpToString(RsvpStatus status) {
    return status.name;
  }
}
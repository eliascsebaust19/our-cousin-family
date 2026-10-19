class GameRoom {
  final String id;
  final String familyId;
  final String createdBy;
  final String status; // waiting, playing, finished, cancelled
  final int maxPlayers;
  final int currentPlayers;
  final String? winnerId;
  final int totalTurns;
  final DateTime createdAt;
  final DateTime? startedAt;
  final DateTime? finishedAt;
  final List<GamePlayer> players;
  final GameBoard? board;

  const GameRoom({
    required this.id,
    required this.familyId,
    required this.createdBy,
    this.status = 'waiting',
    this.maxPlayers = 4,
    this.currentPlayers = 0,
    this.winnerId,
    this.totalTurns = 0,
    required this.createdAt,
    this.startedAt,
    this.finishedAt,
    this.players = const [],
    this.board,
  });

  factory GameRoom.fromJson(Map<String, dynamic> json) {
    return GameRoom(
      id: json['id'] as String,
      familyId: json['family_id'] as String,
      createdBy: json['created_by'] as String,
      status: json['status'] as String? ?? 'waiting',
      maxPlayers: json['max_players'] as int? ?? 4,
      currentPlayers: json['current_players'] as int? ?? 0,
      winnerId: json['winner_id'] as String?,
      totalTurns: json['total_turns'] as int? ?? 0,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : DateTime.now(),
      startedAt: json['started_at'] != null
          ? DateTime.parse(json['started_at'] as String)
          : null,
      finishedAt: json['finished_at'] != null
          ? DateTime.parse(json['finished_at'] as String)
          : null,
      players: (json['game_players'] as List<dynamic>?)
              ?.map((p) => GamePlayer.fromJson(p as Map<String, dynamic>))
              .toList() ??
          [],
      board: json['board_state'] != null
          ? GameBoard.fromJson(json['board_state'] as Map<String, dynamic>)
          : null,
    );
  }

  bool get isWaiting => status == 'waiting';
  bool get isPlaying => status == 'playing';
  bool get isFinished => status == 'finished';
  bool get isCancelled => status == 'cancelled';
  bool get isFull => currentPlayers >= maxPlayers;
}

class GamePlayer {
  final String id;
  final String gameRoomId;
  final String userId;
  final int playerIndex; // 0-3
  final String color; // red, blue, green, yellow
  final int turnOrder;
  final int tokensHome; // tokens that reached the center
  final bool isActive;
  final UserProfile? user;

  const GamePlayer({
    required this.id,
    required this.gameRoomId,
    required this.userId,
    required this.playerIndex,
    required this.color,
    this.turnOrder = 0,
    this.tokensHome = 0,
    this.isActive = true,
    this.user,
  });

  factory GamePlayer.fromJson(Map<String, dynamic> json) {
    return GamePlayer(
      id: json['id'] as String,
      gameRoomId: json['game_room_id'] as String,
      userId: json['user_id'] as String,
      playerIndex: json['player_index'] as int,
      color: json['color'] as String,
      turnOrder: json['turn_order'] as int? ?? 0,
      tokensHome: json['tokens_home'] as int? ?? 0,
      isActive: json['is_active'] as bool? ?? true,
      user: json['profiles'] != null
          ? UserProfile.fromJson(json['profiles'] as Map<String, dynamic>)
          : null,
    );
  }
}

class GameBoard {
  final List<List<int>> tokens; // [playerIndex][tokenIndex] = position
  final int currentPlayerIndex;
  final int? lastDiceRoll;
  final List<int> diceHistory;

  const GameBoard({
    required this.tokens,
    required this.currentPlayerIndex,
    this.lastDiceRoll,
    this.diceHistory = const [],
  });

  factory GameBoard.fromJson(Map<String, dynamic> json) {
    return GameBoard(
      tokens: (json['tokens'] as List<dynamic>)
          .map((row) => (row as List<dynamic>).map((t) => t as int).toList())
          .toList(),
      currentPlayerIndex: json['current_player_index'] as int? ?? 0,
      lastDiceRoll: json['last_dice_roll'] as int?,
      diceHistory: (json['dice_history'] as List<dynamic>?)
              ?.map((d) => d as int)
              .toList() ??
          [],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'tokens': tokens,
      'current_player_index': currentPlayerIndex,
      'last_dice_roll': lastDiceRoll,
      'dice_history': diceHistory,
    };
  }
}

class GameEvent {
  final String id;
  final String gameRoomId;
  final String userId;
  final String eventType; // roll, move, capture, home, win
  final Map<String, dynamic> data;
  final DateTime createdAt;

  const GameEvent({
    required this.id,
    required this.gameRoomId,
    required this.userId,
    required this.eventType,
    this.data = const {},
    required this.createdAt,
  });

  factory GameEvent.fromJson(Map<String, dynamic> json) {
    return GameEvent(
      id: json['id'] as String,
      gameRoomId: json['game_room_id'] as String,
      userId: json['user_id'] as String,
      eventType: json['event_type'] as String,
      data: json['data'] as Map<String, dynamic>? ?? {},
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : DateTime.now(),
    );
  }
}
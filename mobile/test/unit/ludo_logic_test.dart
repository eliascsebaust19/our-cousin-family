import 'package:flutter_test/flutter_test.dart';

/// Ludo game logic for testing (simplified server-authoritative model)
class LudoGameLogic {
  static const int boardSize = 52;
  static const int homePathLength = 6;

  /// Validates that a dice roll is within range (1-6)
  static bool isValidDiceRoll(int roll) => roll >= 1 && roll <= 6;

  /// Checks if a token can move from its current position
  /// Returns true if the move is valid
  static bool isValidMove({
    required int currentPosition,
    required int diceValue,
    required int playerStart, // player's starting position on main track
    required bool isInHome, // token is in home base
    required bool hasFinished, // token has reached center
  }) {
    if (hasFinished) return false;
    if (isInHome && diceValue != 6) return false;
    if (isInHome && diceValue == 6) return true;

    // Calculate new position
    final newPosition = (currentPosition + diceValue) % boardSize;

    // Check if overshooting home path
    final stepsToHome = _stepsToHomeEntry(currentPosition, playerStart);
    if (stepsToHome >= 0 && diceValue > stepsToHome + homePathLength) {
      return false; // Overshoot
    }

    return true;
  }

  /// Calculate steps from current position to the home entry
  static int _stepsToHomeEntry(int currentPosition, int playerStart) {
    final homeEntry = (playerStart + boardSize - 1) % boardSize;
    if (currentPosition <= homeEntry) {
      return homeEntry - currentPosition;
    }
    return boardSize - currentPosition + homeEntry;
  }

  /// Determine if a player has won (all 4 tokens home)
  static bool hasPlayerWon(List<int> tokenPositions) {
    return tokenPositions.every((pos) => pos == -2); // -2 = finished
  }

  /// Determine the next player's index
  static int getNextPlayer(int currentIndex, int playerCount,
      List<bool> activePlayers) {
    var next = (currentIndex + 1) % playerCount;
    var attempts = 0;
    while (!activePlayers[next] && attempts < playerCount) {
      next = (next + 1) % playerCount;
      attempts++;
    }
    return next;
  }

  /// Check if dice roll is a 6
  static bool isSix(int diceValue) => diceValue == 6;
}

void main() {
  group('Ludo Dice Validation', () {
    test('valid dice rolls', () {
      for (int i = 1; i <= 6; i++) {
        expect(LudoGameLogic.isValidDiceRoll(i), true);
      }
    });

    test('invalid dice rolls', () {
      expect(LudoGameLogic.isValidDiceRoll(0), false);
      expect(LudoGameLogic.isValidDiceRoll(7), false);
      expect(LudoGameLogic.isValidDiceRoll(-1), false);
    });

    test('isSix returns correct value', () {
      expect(LudoGameLogic.isSix(6), true);
      expect(LudoGameLogic.isSix(5), false);
    });
  });

  group('Ludo Move Validation', () {
    test('token in home can only move with 6', () {
      expect(
        LudoGameLogic.isValidMove(
          currentPosition: -1,
          diceValue: 6,
          playerStart: 0,
          isInHome: true,
          hasFinished: false,
        ),
        true,
      );

      expect(
        LudoGameLogic.isValidMove(
          currentPosition: -1,
          diceValue: 5,
          playerStart: 0,
          isInHome: true,
          hasFinished: false,
        ),
        false,
      );
    });

    test('finished token cannot move', () {
      expect(
        LudoGameLogic.isValidMove(
          currentPosition: -2,
          diceValue: 6,
          playerStart: 0,
          isInHome: false,
          hasFinished: true,
        ),
        false,
      );
    });
  });

  group('Win Condition', () {
    test('player wins when all tokens are home', () {
      expect(LudoGameLogic.hasPlayerWon([-2, -2, -2, -2]), true);
    });

    test('player does not win with tokens remaining', () {
      expect(LudoGameLogic.hasPlayerWon([-2, -2, -2, 10]), false);
    });
  });

  group('Next Player', () {
    test('cycles through players', () {
      expect(LudoGameLogic.getNextPlayer(0, 4, [true, true, true, true]), 1);
      expect(LudoGameLogic.getNextPlayer(3, 4, [true, true, true, true]), 0);
    });

    test('skips inactive players', () {
      expect(
        LudoGameLogic.getNextPlayer(0, 4, [true, false, true, true]),
        2,
      );
    });
  });
}
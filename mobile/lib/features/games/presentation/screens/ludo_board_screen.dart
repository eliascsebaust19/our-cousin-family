import 'package:flutter/material.dart';

import '../../../../core/theme/color_palette.dart';

class LudoBoardScreen extends StatefulWidget {
  final String roomId;
  const LudoBoardScreen({super.key, required this.roomId});

  @override
  State<LudoBoardScreen> createState() => _LudoBoardScreenState();
}

class _LudoBoardScreenState extends State<LudoBoardScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _diceController;
  int? _diceValue;
  bool _canRoll = true;

  @override
  void initState() {
    super.initState();
    _diceController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
  }

  @override
  void dispose() {
    _diceController.dispose();
    super.dispose();
  }

  void _rollDice() {
    if (!_canRoll) return;
    setState(() => _canRoll = false);
    _diceController.forward().then((_) {
      _diceController.reset();
      setState(() {
        _diceValue = (DateTime.now().millisecondsSinceEpoch % 6) + 1;
        // Real dice rolls are validated server-side
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    final boardSize = size.width - 32;

    return Scaffold(
      backgroundColor: const Color(0xFFFBF8F5),
      appBar: AppBar(
        title: Text('Ludo - Room ${widget.roomId.substring(0, 6)}'),
        actions: [
          IconButton(
            icon: const Icon(Icons.people_outline),
            onPressed: () {},
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Player info
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _PlayerInfo(
                    name: 'Player 1',
                    color: ColorPalette.ludoRed,
                    tokensHome: 0,
                    isActive: true,
                  ),
                  _PlayerInfo(
                    name: 'Player 2',
                    color: ColorPalette.ludoBlue,
                    tokensHome: 0,
                    isActive: false,
                  ),
                  _PlayerInfo(
                    name: 'Player 3',
                    color: ColorPalette.ludoGreen,
                    tokensHome: 0,
                    isActive: false,
                  ),
                  _PlayerInfo(
                    name: 'Player 4',
                    color: ColorPalette.ludoYellow,
                    tokensHome: 0,
                    isActive: false,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),

            // Board
            Expanded(
              child: Center(
                child: Container(
                  width: boardSize,
                  height: boardSize,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.1),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: CustomPaint(
                    painter: LudoBoardPainter(),
                    size: Size(boardSize, boardSize),
                  ),
                ),
              ),
            ),

            // Dice and actions
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  // Dice
                  GestureDetector(
                    onTap: _rollDice,
                    child: AnimatedBuilder(
                      animation: _diceController,
                      builder: (context, child) {
                        return Transform.rotate(
                          angle: _diceController.value * 6.28,
                          child: Container(
                            width: 64,
                            height: 64,
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(12),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withOpacity(0.15),
                                  blurRadius: 8,
                                ),
                              ],
                            ),
                            child: Center(
                              child: Text(
                                _diceValue != null
                                    ? _getDiceFace(_diceValue!)
                                    : '?',
                                style: const TextStyle(
                                  fontSize: 32,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _canRoll ? 'Your turn!' : 'Wait...',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                            color: _canRoll
                                ? ColorPalette.primary
                                : Colors.grey,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Tap the dice to roll',
                          style: TextStyle(
                            color: Colors.grey[600],
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _getDiceFace(int value) {
    const faces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    return faces[value - 1];
  }
}

class _PlayerInfo extends StatelessWidget {
  final String name;
  final Color color;
  final int tokensHome;
  final bool isActive;

  const _PlayerInfo({
    required this.name,
    required this.color,
    required this.tokensHome,
    required this.isActive,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
            border: isActive
                ? Border.all(color: Colors.white, width: 3)
                : null,
            boxShadow: isActive
                ? [BoxShadow(color: color.withOpacity(0.5), blurRadius: 8)]
                : null,
          ),
          child: Center(
            child: Text(
              '$tokensHome',
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w700,
                fontSize: 14,
              ),
            ),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          name,
          style: TextStyle(
            fontSize: 10,
            fontWeight: isActive ? FontWeight.w700 : FontWeight.w400,
            color: isActive ? color : Colors.grey,
          ),
        ),
      ],
    );
  }
}

/// Custom painter for the Ludo board
class LudoBoardPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..style = PaintingStyle.fill;
    final strokePaint = Paint()
      ..style = PaintingStyle.stroke
      ..color = Colors.grey[300]!
      ..strokeWidth = 1;

    final cellSize = size.width / 15;
    final halfSize = size.width / 2;

    // Draw colored quadrants
    // Top-left: Red
    paint.color = ColorPalette.ludoRed.withOpacity(0.2);
    canvas.drawRect(
      Rect.fromLTWH(0, 0, cellSize * 6, cellSize * 6),
      paint,
    );

    // Top-right: Blue
    paint.color = ColorPalette.ludoBlue.withOpacity(0.2);
    canvas.drawRect(
      Rect.fromLTWH(cellSize * 9, 0, cellSize * 6, cellSize * 6),
      paint,
    );

    // Bottom-left: Green
    paint.color = ColorPalette.ludoGreen.withOpacity(0.2);
    canvas.drawRect(
      Rect.fromLTWH(0, cellSize * 9, cellSize * 6, cellSize * 6),
      paint,
    );

    // Bottom-right: Yellow
    paint.color = ColorPalette.ludoYellow.withOpacity(0.2);
    canvas.drawRect(
      Rect.fromLTWH(cellSize * 9, cellSize * 9, cellSize * 6, cellSize * 6),
      paint,
    );

    // Center
    paint.color = Colors.grey[100]!;
    canvas.drawRect(
      Rect.fromLTWH(cellSize * 6, cellSize * 6, cellSize * 3, cellSize * 3),
      paint,
    );

    // Draw grid
    for (int i = 0; i <= 15; i++) {
      canvas.drawLine(
        Offset(i * cellSize, 0),
        Offset(i * cellSize, size.height),
        strokePaint,
      );
      canvas.drawLine(
        Offset(0, i * cellSize),
        Offset(size.width, i * cellSize),
        strokePaint,
      );
    }

    // Home bases
    _drawHomeBase(canvas, paint, cellSize, ColorPalette.ludoRed, 1.5, 1.5);
    _drawHomeBase(canvas, paint, cellSize, ColorPalette.ludoBlue, 11.5, 1.5);
    _drawHomeBase(canvas, paint, cellSize, ColorPalette.ludoGreen, 1.5, 11.5);
    _drawHomeBase(canvas, paint, cellSize, ColorPalette.ludoYellow, 11.5, 11.5);

    // Center triangle colors
    final triangles = [
      (ColorPalette.ludoRed, [Offset(cellSize * 6, cellSize * 6), Offset(halfSize, halfSize), Offset(cellSize * 6, cellSize * 9)]),
      (ColorPalette.ludoBlue, [Offset(cellSize * 6, cellSize * 6), Offset(cellSize * 9, cellSize * 6), Offset(halfSize, halfSize)]),
      (ColorPalette.ludoGreen, [Offset(cellSize * 6, cellSize * 9), Offset(halfSize, halfSize), Offset(cellSize * 9, cellSize * 9)]),
      (ColorPalette.ludoYellow, [Offset(halfSize, halfSize), Offset(cellSize * 9, cellSize * 6), Offset(cellSize * 9, cellSize * 9)]),
    ];

    for (final (color, points) in triangles) {
      paint.color = color.withOpacity(0.3);
      final path = Path()
        ..moveTo(points[0].dx, points[0].dy)
        ..lineTo(points[1].dx, points[1].dy)
        ..lineTo(points[2].dx, points[2].dy)
        ..close();
      canvas.drawPath(path, paint);
    }
  }

  void _drawHomeBase(
    Canvas canvas,
    Paint paint,
    double cellSize,
    Color color,
    double cx,
    double cy,
  ) {
    paint.color = color.withOpacity(0.15);
    final center = Offset(cx * cellSize, cy * cellSize);
    final radius = cellSize * 2;
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(center: center, width: radius * 2, height: radius * 2),
        const Radius.circular(12),
      ),
      paint,
    );

    // Inner white circle
    paint.color = Colors.white;
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(
          center: center,
          width: radius * 1.6,
          height: radius * 1.6,
        ),
        const Radius.circular(10),
      ),
      paint,
    );

    // Token positions
    paint.color = color;
    final offsets = [
      Offset(-cellSize * 0.6, -cellSize * 0.6),
      Offset(cellSize * 0.6, -cellSize * 0.6),
      Offset(-cellSize * 0.6, cellSize * 0.6),
      Offset(cellSize * 0.6, cellSize * 0.6),
    ];

    for (final offset in offsets) {
      canvas.drawCircle(center + offset, cellSize * 0.3, paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class AnimatedBuilder extends AnimatedWidget {
  final Widget Function(BuildContext, Widget?) builder;

  const AnimatedBuilder({
    super.key,
    required super.listenable,
    required this.builder,
  });

  @override
  Widget build(BuildContext context) {
    return builder(context, null);
  }
}
import 'package:flutter/material.dart';

import '../../../../core/theme/color_palette.dart';

class ActiveCallScreen extends StatefulWidget {
  final String roomId;
  const ActiveCallScreen({super.key, required this.roomId});

  @override
  State<ActiveCallScreen> createState() => _ActiveCallScreenState();
}

class _ActiveCallScreenState extends State<ActiveCallScreen> {
  bool _isMuted = false;
  bool _isCameraOff = false;
  bool _isSpeakerOn = true;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF1A1614),
      body: SafeArea(
        child: Column(
          children: [
            // Call info
            Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  Text(
                    'Connected',
                    style: TextStyle(
                      color: ColorPalette.success,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    widget.roomId.substring(0, 8),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
            // Video grid
            Expanded(
              child: Center(
                child: Container(
                  margin: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.grey[900],
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Center(
                    child: Icon(
                      Icons.person_rounded,
                      size: 80,
                      color: Colors.white24,
                    ),
                  ),
                ),
              ),
            ),
            // Controls
            Container(
              padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 32),
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.5),
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(24),
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _ControlButton(
                    icon: _isMuted ? Icons.mic_off : Icons.mic,
                    label: 'Mute',
                    isActive: !_isMuted,
                    onTap: () => setState(() => _isMuted = !_isMuted),
                  ),
                  _ControlButton(
                    icon: _isCameraOff ? Icons.videocam_off : Icons.videocam,
                    label: 'Video',
                    isActive: !_isCameraOff,
                    onTap: () =>
                        setState(() => _isCameraOff = !_isCameraOff),
                  ),
                  _ControlButton(
                    icon: Icons.cameraswitch,
                    label: 'Flip',
                    onTap: () {},
                  ),
                  _ControlButton(
                    icon: _isSpeakerOn
                        ? Icons.volume_up
                        : Icons.volume_off,
                    label: 'Speaker',
                    isActive: _isSpeakerOn,
                    onTap: () =>
                        setState(() => _isSpeakerOn = !_isSpeakerOn),
                  ),
                  _ControlButton(
                    icon: Icons.call_end,
                    label: 'End',
                    color: ColorPalette.error,
                    onTap: () => Navigator.pop(context),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ControlButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isActive;
  final Color? color;
  final VoidCallback? onTap;

  const _ControlButton({
    required this.icon,
    required this.label,
    this.isActive = true,
    this.color,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: color ??
                  (isActive
                      ? Colors.white.withOpacity(0.2)
                      : Colors.white.withOpacity(0.1)),
              shape: BoxShape.circle,
            ),
            child: Icon(
              icon,
              color: color ?? Colors.white,
              size: 24,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            label,
            style: TextStyle(
              color: color ?? Colors.white70,
              fontSize: 10,
            ),
          ),
        ],
      ),
    );
  }
}
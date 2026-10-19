import 'dart:async';
import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:record/record.dart';

import '../../../../core/theme/color_palette.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_text_field.dart';

class RecordVoiceScreen extends StatefulWidget {
  const RecordVoiceScreen({super.key});

  @override
  State<RecordVoiceScreen> createState() => _RecordVoiceScreenState();
}

class _RecordVoiceScreenState extends State<RecordVoiceScreen> {
  final _titleController = TextEditingController();
  final _speakerController = TextEditingController();
  final _descriptionController = TextEditingController();
  final AudioRecorder _recorder = AudioRecorder();

  bool _isRecording = false;
  bool _isPaused = false;
  Duration _recordingDuration = Duration.zero;
  Timer? _timer;
  String? _recordedPath;

  @override
  void dispose() {
    _titleController.dispose();
    _speakerController.dispose();
    _descriptionController.dispose();
    _recorder.dispose();
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _startRecording() async {
    final permission = await Permission.microphone.request();
    if (!permission.isGranted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Microphone permission is required')),
      );
      return;
    }

    if (await _recorder.hasPermission()) {
      await _recorder.start(
        const RecordConfig(
          encoder: AudioEncoder.aacLc,
          bitRate: 128000,
          sampleRate: 44100,
        ),
        path: '/tmp/recording_${DateTime.now().millisecondsSinceEpoch}.m4a',
      );

      setState(() {
        _isRecording = true;
        _isPaused = false;
        _recordingDuration = Duration.zero;
      });

      _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
        setState(() {
          _recordingDuration += const Duration(seconds: 1);
        });
      });
    }
  }

  Future<void> _stopRecording() async {
    _timer?.cancel();
    final path = await _recorder.stop();
    setState(() {
      _isRecording = false;
      _isPaused = false;
      _recordedPath = path;
    });
  }

  Future<void> _pauseRecording() async {
    await _recorder.pause();
    setState(() => _isPaused = true);
    _timer?.cancel();
  }

  Future<void> _resumeRecording() async {
    await _recorder.resume();
    setState(() => _isPaused = false);
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      setState(() => _recordingDuration += const Duration(seconds: 1));
    });
  }

  String _formatDuration(Duration d) {
    final minutes = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final seconds = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Record Voice Memory'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Recording visualization
            Container(
              padding: const EdgeInsets.all(32),
              decoration: BoxDecoration(
                color: _isRecording
                    ? ColorPalette.error.withOpacity(0.05)
                    : ColorPalette.primaryExtraLight,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Column(
                children: [
                  // Timer
                  Text(
                    _formatDuration(_recordingDuration),
                    style: TextStyle(
                      fontSize: 48,
                      fontWeight: FontWeight.w800,
                      fontFamily: 'monospace',
                      color:
                          _isRecording ? ColorPalette.error : ColorPalette.primary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _isRecording
                        ? (_isPaused ? 'Paused' : 'Recording...')
                        : 'Ready to record',
                    style: theme.textTheme.bodyLarge?.copyWith(
                      color: _isRecording
                          ? ColorPalette.error
                          : theme.textTheme.bodySmall?.color,
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Record button
                  GestureDetector(
                    onTap: () {
                      if (_isRecording) {
                        _stopRecording();
                      } else {
                        _startRecording();
                      }
                    },
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      width: _isRecording ? 72 : 80,
                      height: _isRecording ? 72 : 80,
                      decoration: BoxDecoration(
                        color: _isRecording
                            ? ColorPalette.error
                            : ColorPalette.primary,
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: (_isRecording
                                    ? ColorPalette.error
                                    : ColorPalette.primary)
                                .withOpacity(0.3),
                            blurRadius: _isRecording ? 20 : 12,
                            spreadRadius: _isRecording ? 4 : 0,
                          ),
                        ],
                      ),
                      child: Icon(
                        _isRecording ? Icons.stop_rounded : Icons.mic_rounded,
                        color: Colors.white,
                        size: _isRecording ? 36 : 40,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Pause/Resume
                  if (_isRecording)
                    TextButton.icon(
                      onPressed: () {
                        if (_isPaused) {
                          _resumeRecording();
                        } else {
                          _pauseRecording();
                        }
                      },
                      icon: Icon(
                        _isPaused ? Icons.play_arrow : Icons.pause,
                      ),
                      label: Text(_isPaused ? 'Resume' : 'Pause'),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Recorded path indicator
            if (_recordedPath != null) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: ColorPalette.success.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: const [
                    Icon(Icons.check_circle, color: ColorPalette.success),
                    SizedBox(width: 8),
                    Text('Recording saved! Add details below.'),
                  ],
                ),
              ),
              const SizedBox(height: 24),
            ],

            // Metadata form
            AppTextField(
              controller: _titleController,
              label: 'Title',
              hint: 'e.g., Grandma\'s story about 1971',
              textCapitalization: TextCapitalization.sentences,
            ),
            const SizedBox(height: 16),
            AppTextField(
              controller: _speakerController,
              label: 'Speaker Name',
              hint: 'Who is telling the story?',
              textCapitalization: TextCapitalization.words,
            ),
            const SizedBox(height: 16),
            AppTextField(
              controller: _descriptionController,
              label: 'Description',
              hint: 'What is this story about?',
              maxLines: 3,
            ),
            const SizedBox(height: 32),

            // Save button
            AppButton(
              label: 'Save Voice Memory',
              isExpanded: true,
              icon: Icons.save_rounded,
              onPressed: _recordedPath != null ? () => Navigator.pop(context) : null,
            ),
          ],
        ),
      ),
    );
  }
}
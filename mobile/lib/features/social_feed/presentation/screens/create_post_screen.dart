import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../../core/theme/color_palette.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/constants/api_constants.dart';
import '../../../../shared/providers/auth_provider.dart';

class CreatePostScreen extends ConsumerStatefulWidget {
  final String familyId;
  const CreatePostScreen({super.key, required this.familyId});

  @override
  ConsumerState<CreatePostScreen> createState() => _CreatePostScreenState();
}

class _CreatePostScreenState extends ConsumerState<CreatePostScreen> {
  final _contentController = TextEditingController();
  final List<XFile> _selectedMedia = [];
  String? _selectedBadge;
  bool _isLoading = false;
  String? _error;

  final _badges = const [
    ('birthday', '🎂', 'Birthday'),
    ('trip', '✈️', 'Trip'),
    ('throwback', '📸', 'Throwback'),
    ('celebration', '🎉', 'Celebration'),
    ('milestone', '🏆', 'Milestone'),
  ];

  @override
  void dispose() {
    _contentController.dispose();
    super.dispose();
  }

  Future<void> _pickMedia() async {
    final picker = ImagePicker();
    final images = await picker.pickMultiImage(imageQuality: 85);
    if (images.isNotEmpty) {
      setState(() => _selectedMedia.addAll(images));
    }
  }

  Future<void> _submit() async {
    if (_contentController.text.trim().isEmpty && _selectedMedia.isEmpty) {
      setState(() => _error = 'Please add some content or media.');
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final client = Supabase.instance.client;
      final userId = client.auth.currentUser!.id;

      // Create post
      final post = await client
          .from(ApiConstants.postsTable)
          .insert({
            'family_id': widget.familyId,
            'author_id': userId,
            'content': _contentController.text.trim(),
            'moment_badge': _selectedBadge,
          })
          .select()
          .single();

      // Upload media
      for (final media in _selectedMedia) {
        final bytes = await media.readAsBytes();
        final ext = media.name.split('.').last.toLowerCase();
        final isVideo = ['mp4', 'mov', 'avi'].contains(ext);
        final path =
            '${widget.familyId}/${post['id']}/${DateTime.now().millisecondsSinceEpoch}.$ext';

        await client.storage
            .from(ApiConstants.postMediaBucket)
            .uploadBinary(path, bytes);

        final url = client.storage
            .from(ApiConstants.postMediaBucket)
            .getPublicUrl(path);

        await client.from(ApiConstants.postMediaTable).insert({
          'post_id': post['id'],
          'media_type': isVideo ? 'video' : 'image',
          'media_url': url,
        });
      }

      if (mounted) context.pop();
    } catch (e) {
      setState(() {
        _error = 'Failed to create post: ${e.toString()}';
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Create Post'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: AppButton(
              label: 'Post',
              isLoading: _isLoading,
              onPressed: _submit,
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Content input
            TextField(
              controller: _contentController,
              maxLines: 8,
              minLines: 4,
              decoration: InputDecoration(
                hintText: "What's happening in the family?",
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                fillColor: Colors.transparent,
                filled: false,
              ),
              style: theme.textTheme.bodyLarge,
              textCapitalization: TextCapitalization.sentences,
            ),
            const SizedBox(height: 16),

            // Selected media preview
            if (_selectedMedia.isNotEmpty)
              SizedBox(
                height: 100,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: _selectedMedia.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (context, index) {
                    return Stack(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: FutureBuilder<List<int>>(
                            future: _selectedMedia[index].readAsBytes(),
                            builder: (context, snapshot) {
                              if (snapshot.hasData) {
                                return Image.memory(
                                  snapshot.data as dynamic,
                                  width: 100,
                                  height: 100,
                                  fit: BoxFit.cover,
                                );
                              }
                              return Container(
                                width: 100,
                                height: 100,
                                color: Colors.grey[200],
                                child: const Center(
                                  child: CircularProgressIndicator(),
                                ),
                              );
                            },
                          ),
                        ),
                        Positioned(
                          top: 4,
                          right: 4,
                          child: GestureDetector(
                            onTap: () =>
                                setState(() => _selectedMedia.removeAt(index)),
                            child: Container(
                              padding: const EdgeInsets.all(4),
                              decoration: const BoxDecoration(
                                color: Colors.black54,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                Icons.close,
                                size: 14,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ),

            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(
                _error!,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: ColorPalette.error,
                ),
              ),
            ],

            const SizedBox(height: 24),
            const Divider(),
            const SizedBox(height: 8),

            // Media buttons
            Row(
              children: [
                _ToolbarButton(
                  icon: Icons.photo_library_rounded,
                  label: 'Photo',
                  color: ColorPalette.primary,
                  onTap: _pickMedia,
                ),
                const SizedBox(width: 16),
                _ToolbarButton(
                  icon: Icons.camera_alt_rounded,
                  label: 'Camera',
                  color: ColorPalette.tertiary,
                  onTap: () async {
                    final picker = ImagePicker();
                    final photo = await picker.pickImage(
                      source: ImageSource.camera,
                      imageQuality: 85,
                    );
                    if (photo != null) {
                      setState(() => _selectedMedia.add(photo));
                    }
                  },
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Moment badges
            Text('Add a moment', style: theme.textTheme.labelLarge),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _badges.map((badge) {
                final isSelected = _selectedBadge == badge.$1;
                return ChoiceChip(
                  label: Text('${badge.$2} ${badge.$3}'),
                  selected: isSelected,
                  onSelected: (_) {
                    setState(() {
                      _selectedBadge = isSelected ? null : badge.$1;
                    });
                  },
                  selectedColor: ColorPalette.primaryExtraLight,
                );
              }).toList(),
            ),
          ],
        ),
      ),
    );
  }
}

class _ToolbarButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback? onTap;

  const _ToolbarButton({
    required this.icon,
    required this.label,
    required this.color,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(width: 6),
            Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }
}
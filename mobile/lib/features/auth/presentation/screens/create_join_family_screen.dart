import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../../core/theme/color_palette.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_text_field.dart';
import '../../../../core/constants/api_constants.dart';

class CreateJoinFamilyScreen extends ConsumerStatefulWidget {
  const CreateJoinFamilyScreen({super.key});

  @override
  ConsumerState<CreateJoinFamilyScreen> createState() =>
      _CreateJoinFamilyScreenState();
}

class _CreateJoinFamilyScreenState
    extends ConsumerState<CreateJoinFamilyScreen> {
  int _selectedTab = 0; // 0 = create, 1 = join
  final _nameController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _codeController = TextEditingController();
  bool _isLoading = false;
  String? _error;

  @override
  void dispose() {
    _nameController.dispose();
    _descriptionController.dispose();
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _createFamily() async {
    if (_nameController.text.trim().isEmpty) {
      setState(() => _error = 'Please enter a family name.');
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final client = Supabase.instance.client;
      final userId = client.auth.currentUser!.id;

      final family = await client
          .from(ApiConstants.familiesTable)
          .insert({
            'name': _nameController.text.trim(),
            'description': _descriptionController.text.trim(),
            'created_by': userId,
          })
          .select()
          .single();

      // Add creator as owner
      await client.from(ApiConstants.familyMembersTable).insert({
        'family_id': family['id'],
        'user_id': userId,
        'role': 'owner',
      });

      if (mounted) context.go('/home');
    } catch (e) {
      setState(() {
        _error = 'Failed to create family: ${e.toString()}';
        _isLoading = false;
      });
    }
  }

  Future<void> _joinFamily() async {
    if (_codeController.text.trim().isEmpty) {
      setState(() => _error = 'Please enter an invitation code.');
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final client = Supabase.instance.client;
      await client.rpc(ApiConstants.joinFamilyRpc, params: {
        'invitation_code': _codeController.text.trim(),
      });

      if (mounted) context.go('/home');
    } catch (e) {
      setState(() {
        _error = 'Failed to join family: ${e.toString()}';
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 40),
              // Header
              Center(
                child: Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    color: ColorPalette.primaryExtraLight,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.people_rounded,
                    size: 40,
                    color: ColorPalette.primary,
                  ),
                ),
              ),
              const SizedBox(height: 24),
              Text(
                'Join Your Family',
                style: theme.textTheme.displaySmall,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                'Create a new family group or join an existing one',
                style: theme.textTheme.bodyLarge?.copyWith(
                  color: theme.textTheme.bodySmall?.color,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),

              // Tab selector
              Container(
                decoration: BoxDecoration(
                  color: theme.colorScheme.surfaceVariant,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: GestureDetector(
                        onTap: () => setState(() {
                          _selectedTab = 0;
                          _error = null;
                        }),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          decoration: BoxDecoration(
                            color: _selectedTab == 0
                                ? ColorPalette.primary
                                : Colors.transparent,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            'Create Family',
                            textAlign: TextAlign.center,
                            style: theme.textTheme.labelLarge?.copyWith(
                              color: _selectedTab == 0
                                  ? Colors.white
                                  : theme.textTheme.bodyMedium?.color,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                    ),
                    Expanded(
                      child: GestureDetector(
                        onTap: () => setState(() {
                          _selectedTab = 1;
                          _error = null;
                        }),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          decoration: BoxDecoration(
                            color: _selectedTab == 1
                                ? ColorPalette.primary
                                : Colors.transparent,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            'Join Family',
                            textAlign: TextAlign.center,
                            style: theme.textTheme.labelLarge?.copyWith(
                              color: _selectedTab == 1
                                  ? Colors.white
                                  : theme.textTheme.bodyMedium?.color,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Error
              if (_error != null) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: ColorPalette.errorLight.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    _error!,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: ColorPalette.error,
                    ),
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // Content
              if (_selectedTab == 0) ...[
                // Create family form
                AppTextField(
                  controller: _nameController,
                  label: 'Family Name',
                  hint: 'e.g., The Ahmed Family',
                  prefixIcon: Icons.family_restroom,
                  textCapitalization: TextCapitalization.words,
                  textInputAction: TextInputAction.next,
                ),
                const SizedBox(height: 16),
                AppTextField(
                  controller: _descriptionController,
                  label: 'Description (Optional)',
                  hint: 'Tell us about your family',
                  maxLines: 3,
                  textInputAction: TextInputAction.done,
                ),
                const SizedBox(height: 24),
                AppButton(
                  label: 'Create Family',
                  isLoading: _isLoading,
                  isExpanded: true,
                  icon: Icons.add,
                  onPressed: _createFamily,
                ),
              ] else ...[
                // Join family form
                AppTextField(
                  controller: _codeController,
                  label: 'Invitation Code',
                  hint: 'Enter the code shared by your family',
                  prefixIcon: Icons.vpn_key_outlined,
                  textInputAction: TextInputAction.done,
                  textCapitalization: TextCapitalization.characters,
                  onSubmitted: (_) => _joinFamily(),
                ),
                const SizedBox(height: 24),
                AppButton(
                  label: 'Join Family',
                  isLoading: _isLoading,
                  isExpanded: true,
                  icon: Icons.group_add,
                  onPressed: _joinFamily,
                ),
              ],

              const SizedBox(height: 24),
              TextButton(
                onPressed: () => context.go('/home'),
                child: const Text('Skip for now'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
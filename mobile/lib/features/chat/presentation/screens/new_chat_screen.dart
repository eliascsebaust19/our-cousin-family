import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../../core/widgets/cached_avatar.dart';
import '../../../../shared/models/user_profile.dart';
import '../../../../shared/providers/auth_provider.dart';
import '../../../../shared/providers/family_provider.dart';
import '../../../../core/constants/api_constants.dart';

class NewChatScreen extends ConsumerStatefulWidget {
  const NewChatScreen({super.key});

  @override
  ConsumerState<NewChatScreen> createState() => _NewChatScreenState();
}

class _NewChatScreenState extends ConsumerState<NewChatScreen> {
  final _searchController = TextEditingController();
  final Set<String> _selectedUserIds = {};
  bool _isGroup = false;
  String _groupName = '';
  List<UserProfile> _members = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadMembers();
  }

  Future<void> _loadMembers() async {
    try {
      final client = Supabase.instance.client;
      final families = ref.read(userFamiliesProvider).valueOrNull;
      if (families == null || families.isEmpty) {
        setState(() => _isLoading = false);
        return;
      }

      final familyId = families.first.id;
      final response = await client
          .from(ApiConstants.familyMembersTable)
          .select('profiles(*)')
          .eq('family_id', familyId);

      setState(() {
        _members = (response as List)
            .map((m) => UserProfile.fromJson(m['profiles']))
            .toList();
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _createConversation() async {
    if (_selectedUserIds.isEmpty) return;

    try {
      final client = Supabase.instance.client;
      final userId = client.auth.currentUser!.id;

      // Create conversation
      final conv = await client
          .from(ApiConstants.conversationsTable)
          .insert({
            'name': _isGroup ? _groupName : null,
            'is_group': _isGroup,
            'created_by': userId,
          })
          .select()
          .single();

      // Add members
      final members = [
        {'conversation_id': conv['id'], 'user_id': userId, 'role': 'admin'},
        ..._selectedUserIds.map((uid) => {
              'conversation_id': conv['id'],
              'user_id': uid,
            }),
      ];

      await client
          .from(ApiConstants.conversationMembersTable)
          .insert(members);

      if (mounted) context.push('/chat/conversation/${conv['id']}');
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final currentUserId = ref.watch(currentUserIdProvider);
    final otherMembers =
        _members.where((m) => m.id != currentUserId).toList();

    return Scaffold(
      appBar: AppBar(
        title: Text(_isGroup ? 'New Group' : 'New Chat'),
        actions: [
          if (_selectedUserIds.isNotEmpty)
            TextButton(
              onPressed: _createConversation,
              child: const Text('Create'),
            ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                // Toggle group
                SwitchListTile(
                  title: const Text('Group Chat'),
                  value: _isGroup,
                  onChanged: (v) => setState(() => _isGroup = v),
                ),
                if (_isGroup)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: TextField(
                      decoration: const InputDecoration(
                        labelText: 'Group Name',
                        hintText: 'Enter group name',
                      ),
                      onChanged: (v) => _groupName = v,
                    ),
                  ),
                // Search
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: TextField(
                    controller: _searchController,
                    decoration: const InputDecoration(
                      hintText: 'Search family members...',
                      prefixIcon: Icon(Icons.search),
                    ),
                  ),
                ),
                // Members list
                Expanded(
                  child: ListView.builder(
                    itemCount: otherMembers.length,
                    itemBuilder: (context, index) {
                      final member = otherMembers[index];
                      final isSelected =
                          _selectedUserIds.contains(member.id);
                      return CheckboxListTile(
                        value: isSelected,
                        onChanged: (v) {
                          setState(() {
                            if (v == true) {
                              _selectedUserIds.add(member.id);
                            } else {
                              _selectedUserIds.remove(member.id);
                            }
                          });
                        },
                        secondary: CachedAvatar(
                          imageUrl: member.avatarUrl,
                          name: member.fullName,
                          radius: 20,
                        ),
                        title: Text(member.fullName),
                      );
                    },
                  ),
                ),
              ],
            ),
    );
  }
}
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../../core/theme/color_palette.dart';
import '../../../../core/widgets/cached_avatar.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../shared/models/family.dart';
import '../../../../shared/providers/auth_provider.dart';
import '../../../../core/constants/api_constants.dart';

class FamilyTreeScreen extends ConsumerStatefulWidget {
  final String familyId;
  const FamilyTreeScreen({super.key, required this.familyId});

  @override
  ConsumerState<FamilyTreeScreen> createState() => _FamilyTreeScreenState();
}

class _FamilyTreeScreenState extends ConsumerState<FamilyTreeScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<FamilyMember> _members = [];
  List<FamilyRelationship> _relationships = [];
  bool _isLoading = true;
  String _searchQuery = '';
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadData();
  }

  Future<void> _loadData() async {
    try {
      final client = Supabase.instance.client;

      final membersData = await client
          .from(ApiConstants.familyMembersTable)
          .select('*, profiles(*)')
          .eq('family_id', widget.familyId);

      final relationshipsData = await client
          .from(ApiConstants.familyRelationshipsTable)
          .select()
          .eq('family_id', widget.familyId);

      setState(() {
        _members = (membersData as List)
            .map((m) => FamilyMember.fromJson(m))
            .toList();
        _relationships = (relationshipsData as List)
            .map((r) => FamilyRelationship.fromJson(r))
            .toList();
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Family Tree'),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(icon: Icon(Icons.account_tree_rounded), text: 'Tree View'),
            Tab(icon: Icon(Icons.list_rounded), text: 'Members'),
          ],
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabController,
              children: [
                _buildTreeView(),
                _buildMemberList(),
              ],
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: _showAddMemberDialog,
        child: const Icon(Icons.person_add),
      ),
    );
  }

  Widget _buildTreeView() {
    if (_members.isEmpty) {
      return EmptyState(
        icon: Icons.account_tree_rounded,
        title: 'No Family Tree Yet',
        message: 'Add family members to build your family tree.',
        actionLabel: 'Add Member',
        onAction: _showAddMemberDialog,
      );
    }

    return InteractiveViewer(
      boundaryMargin: const EdgeInsets.all(500),
      minScale: 0.3,
      maxScale: 3.0,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(40),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildGenerationGroup(
                'Family Members',
                _members,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildGenerationGroup(String title, List<FamilyMember> members) {
    final theme = Theme.of(context);

    return Column(
      children: [
        Text(
          title,
          style: theme.textTheme.titleSmall?.copyWith(
            color: ColorPalette.primary,
          ),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 16,
          runSpacing: 16,
          alignment: WrapAlignment.center,
          children: members.map((member) {
            return _FamilyNode(member: member);
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildMemberList() {
    final filtered = _searchQuery.isEmpty
        ? _members
        : _members.where((m) {
            final name = m.user?.fullName.toLowerCase() ?? '';
            return name.contains(_searchQuery.toLowerCase());
          }).toList();

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: TextField(
            controller: _searchController,
            decoration: InputDecoration(
              hintText: 'Search members...',
              prefixIcon: const Icon(Icons.search),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
              filled: true,
              suffixIcon: _searchQuery.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear),
                      onPressed: () {
                        _searchController.clear();
                        setState(() => _searchQuery = '');
                      },
                    )
                  : null,
            ),
            onChanged: (value) => setState(() => _searchQuery = value),
          ),
        ),
        Expanded(
          child: ListView.builder(
            itemCount: filtered.length,
            itemBuilder: (context, index) {
              final member = filtered[index];
              return ListTile(
                leading: CachedAvatar(
                  imageUrl: member.user?.avatarUrl,
                  name: member.user?.fullName ?? '',
                  radius: 22,
                ),
                title: Text(member.user?.fullName ?? 'Unknown'),
                subtitle: Text(
                  '${member.role.name[0].toUpperCase()}${member.role.name.substring(1)}',
                  style: TextStyle(color: ColorPalette.colorForUser(member.userId)),
                ),
                trailing: IconButton(
                  icon: const Icon(Icons.info_outline),
                  onPressed: () => _showMemberDetail(member),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  void _showMemberDetail(FamilyMember member) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.5,
        minChildSize: 0.3,
        maxChildSize: 0.8,
        expand: false,
        builder: (context, controller) {
          return Padding(
            padding: const EdgeInsets.all(24),
            child: ListView(
              controller: controller,
              children: [
                Center(
                  child: CachedAvatar(
                    imageUrl: member.user?.avatarUrl,
                    name: member.user?.fullName ?? '',
                    radius: 40,
                  ),
                ),
                const SizedBox(height: 16),
                Center(
                  child: Text(
                    member.user?.fullName ?? 'Unknown',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                ),
                const SizedBox(height: 8),
                Center(
                  child: Chip(
                    label: Text(member.role.name.toUpperCase()),
                    backgroundColor: ColorPalette.colorForUser(member.userId).withOpacity(0.1),
                  ),
                ),
                const SizedBox(height: 24),
                if (member.user?.bio != null)
                  Text(member.user!.bio!),
                const SizedBox(height: 16),
                Text(
                  'Joined ${member.joinedAt.toString().substring(0, 10)}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  void _showAddMemberDialog() {
    showDialog(
      context: context,
      builder: (context) {
        final nameController = TextEditingController();
        final relationController = TextEditingController();
        return AlertDialog(
          title: const Text('Add Family Member'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameController,
                decoration: const InputDecoration(
                  labelText: 'Name',
                  hintText: 'Family member name',
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: relationController,
                decoration: const InputDecoration(
                  labelText: 'Relationship',
                  hintText: 'e.g., cousin, uncle, aunt',
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Add'),
            ),
          ],
        );
      },
    );
  }
}

class _FamilyNode extends StatelessWidget {
  final FamilyMember member;
  const _FamilyNode({required this.member});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return GestureDetector(
      onTap: () {},
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: ColorPalette.colorForUser(member.userId),
                width: 3,
              ),
              boxShadow: [
                BoxShadow(
                  color: ColorPalette.colorForUser(member.userId).withOpacity(0.3),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: CachedAvatar(
              imageUrl: member.user?.avatarUrl,
              name: member.user?.fullName ?? '',
              radius: 28,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            member.user?.fullName?.split(' ').first ?? '?',
            style: theme.textTheme.labelMedium?.copyWith(
              fontWeight: FontWeight.w600,
            ),
            textAlign: TextAlign.center,
          ),
          Text(
            member.role.name,
            style: theme.textTheme.labelSmall?.copyWith(
              color: ColorPalette.colorForUser(member.userId),
            ),
          ),
        ],
      ),
    );
  }
}
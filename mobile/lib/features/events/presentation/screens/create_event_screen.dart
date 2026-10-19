import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/color_palette.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_text_field.dart';

class CreateEventScreen extends StatefulWidget {
  const CreateEventScreen({super.key});

  @override
  State<CreateEventScreen> createState() => _CreateEventScreenState();
}

class _CreateEventScreenState extends State<CreateEventScreen> {
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _locationController = TextEditingController();
  String _eventType = 'custom';
  DateTime _startDate = DateTime.now();
  TimeOfDay _startTime = TimeOfDay.now();
  bool _isAllDay = false;
  bool _isLoading = false;

  final _eventTypes = const [
    ('birthday', '🎂', 'Birthday'),
    ('anniversary', '💍', 'Anniversary'),
    ('reunion', '👨‍👩‍👧‍👦', 'Reunion'),
    ('religious', '🕌', 'Religious'),
    ('custom', '📅', 'Custom'),
  ];

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    _locationController.dispose();
    super.dispose();
  }

  Future<void> _selectDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _startDate,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365 * 5)),
    );
    if (picked != null) setState(() => _startDate = picked);
  }

  Future<void> _selectTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _startTime,
    );
    if (picked != null) setState(() => _startTime = picked);
  }

  Future<void> _createEvent() async {
    if (_titleController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter an event title')),
      );
      return;
    }

    setState(() => _isLoading = true);
    // Create event via Supabase
    await Future.delayed(const Duration(seconds: 1));
    if (mounted) context.pop();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Create Event')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Event type
            Text('Event Type', style: theme.textTheme.labelLarge),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _eventTypes.map((type) {
                final isSelected = _eventType == type.$1;
                return ChoiceChip(
                  label: Text('${type.$2} ${type.$3}'),
                  selected: isSelected,
                  onSelected: (_) => setState(() => _eventType = type.$1),
                  selectedColor: ColorPalette.primaryExtraLight,
                );
              }).toList(),
            ),
            const SizedBox(height: 20),

            // Title
            AppTextField(
              controller: _titleController,
              label: 'Event Title',
              hint: 'What\'s the occasion?',
              textCapitalization: TextCapitalization.sentences,
            ),
            const SizedBox(height: 16),

            // Description
            AppTextField(
              controller: _descriptionController,
              label: 'Description',
              hint: 'Add details about the event',
              maxLines: 3,
            ),
            const SizedBox(height: 16),

            // Date & Time
            Row(
              children: [
                Expanded(
                  child: _DateTimeSelector(
                    icon: Icons.calendar_today_rounded,
                    label: 'Date',
                    value: DateFormat('MMM dd, yyyy').format(_startDate),
                    onTap: _selectDate,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _isAllDay
                      ? const SizedBox.shrink()
                      : _DateTimeSelector(
                          icon: Icons.access_time_rounded,
                          label: 'Time',
                          value: _startTime.format(context),
                          onTap: _selectTime,
                        ),
                ),
              ],
            ),
            const SizedBox(height: 8),

            SwitchListTile(
              title: const Text('All Day Event'),
              value: _isAllDay,
              onChanged: (v) => setState(() => _isAllDay = v),
              contentPadding: EdgeInsets.zero,
            ),
            const SizedBox(height: 16),

            // Location
            AppTextField(
              controller: _locationController,
              label: 'Location',
              hint: 'Where is the event?',
              prefixIcon: Icons.location_on_outlined,
            ),
            const SizedBox(height: 32),

            // Create button
            AppButton(
              label: 'Create Event',
              isLoading: _isLoading,
              isExpanded: true,
              onPressed: _createEvent,
            ),
          ],
        ),
      ),
    );
  }
}

class _DateTimeSelector extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final VoidCallback onTap;

  const _DateTimeSelector({
    required this.icon,
    required this.label,
    required this.value,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: theme.colorScheme.surfaceVariant,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 16, color: ColorPalette.primary),
                const SizedBox(width: 6),
                Text(label, style: theme.textTheme.labelSmall),
              ],
            ),
            const SizedBox(height: 4),
            Text(value, style: theme.textTheme.titleSmall),
          ],
        ),
      ),
    );
  }
}
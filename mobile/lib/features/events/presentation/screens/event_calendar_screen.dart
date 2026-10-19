import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:table_calendar/table_calendar.dart';

import '../../../../core/theme/color_palette.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../shared/models/event.dart';
import '../providers/event_provider.dart';

class EventCalendarScreen extends ConsumerStatefulWidget {
  const EventCalendarScreen({super.key});

  @override
  ConsumerState<EventCalendarScreen> createState() =>
      _EventCalendarScreenState();
}

class _EventCalendarScreenState extends ConsumerState<EventCalendarScreen> {
  CalendarFormat _calendarFormat = CalendarFormat.month;
  DateTime _focusedDay = DateTime.now();
  DateTime? _selectedDay;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Family Calendar'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_rounded),
            onPressed: () => context.push('/home/events/create'),
          ),
        ],
      ),
      body: Column(
        children: [
          // Calendar
          Card(
            margin: const EdgeInsets.all(12),
            child: TableCalendar(
              firstDay: DateTime(2020),
              lastDay: DateTime(2030),
              focusedDay: _focusedDay,
              calendarFormat: _calendarFormat,
              selectedDayPredicate: (day) => isSameDay(_selectedDay, day),
              onDaySelected: (selectedDay, focusedDay) {
                setState(() {
                  _selectedDay = selectedDay;
                  _focusedDay = focusedDay;
                });
              },
              onFormatChanged: (format) {
                setState(() => _calendarFormat = format);
              },
              calendarStyle: CalendarStyle(
                todayDecoration: BoxDecoration(
                  color: ColorPalette.primary.withOpacity(0.3),
                  shape: BoxShape.circle,
                ),
                selectedDecoration: const BoxDecoration(
                  color: ColorPalette.primary,
                  shape: BoxShape.circle,
                ),
                todayTextStyle: const TextStyle(fontWeight: FontWeight.w700),
                outsideDaysVisible: false,
              ),
              headerStyle: HeaderStyle(
                formatButtonDecoration: BoxDecoration(
                  border: Border.all(color: ColorPalette.primary),
                  borderRadius: BorderRadius.circular(8),
                ),
                formatButtonTextStyle: const TextStyle(
                  color: ColorPalette.primary,
                  fontSize: 12,
                ),
              ),
              calendarBuilders: CalendarBuilders(
                markerBuilder: (context, day, events) {
                  // Show markers for events on this day
                  return null;
                },
              ),
            ),
          ),

          // Events for selected day
          Expanded(
            child: _selectedDay == null
                ? const Center(
                    child: Text('Select a day to see events'),
                  )
                : _buildEventsList(),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.push('/home/events/create'),
        child: const Icon(Icons.add),
      ),
    );
  }

  Widget _buildEventsList() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
          child: Text(
            _selectedDay != null
                ? 'Events on ${_selectedDay!.month}/${_selectedDay!.day}'
                : '',
            style: Theme.of(context).textTheme.titleSmall,
          ),
        ),
        const Expanded(
          child: EmptyState(
            icon: Icons.event_rounded,
            title: 'No Events',
            message: 'No events scheduled for this day.',
          ),
        ),
      ],
    );
  }
}
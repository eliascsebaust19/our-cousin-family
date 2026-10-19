import 'package:flutter/material.dart';

class NotificationSettingsScreen extends StatefulWidget {
  const NotificationSettingsScreen({super.key});

  @override
  State<NotificationSettingsScreen> createState() =>
      _NotificationSettingsScreenState();
}

class _NotificationSettingsScreenState
    extends State<NotificationSettingsScreen> {
  bool _pushEnabled = true;
  bool _chatMessages = true;
  bool _postComments = true;
  bool _postReactions = true;
  bool _eventReminders = true;
  bool _birthdayReminders = true;
  bool _gameInvites = true;
  bool _familyInvites = true;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Notification Settings')),
      body: ListView(
        children: [
          SwitchListTile(
            title: const Text('Push Notifications'),
            subtitle: const Text('Receive notifications on your device'),
            value: _pushEnabled,
            onChanged: (v) => setState(() => _pushEnabled = v),
          ),
          const Divider(),
          SwitchListTile(
            title: const Text('Chat Messages'),
            subtitle: const Text('New message notifications'),
            value: _chatMessages,
            onChanged: (v) => setState(() => _chatMessages = v),
          ),
          SwitchListTile(
            title: const Text('Post Comments'),
            subtitle: const Text('When someone comments on your post'),
            value: _postComments,
            onChanged: (v) => setState(() => _postComments = v),
          ),
          SwitchListTile(
            title: const Text('Post Reactions'),
            subtitle: const Text('When someone reacts to your post'),
            value: _postReactions,
            onChanged: (v) => setState(() => _postReactions = v),
          ),
          const Divider(),
          SwitchListTile(
            title: const Text('Event Reminders'),
            subtitle: const Text('Upcoming family events'),
            value: _eventReminders,
            onChanged: (v) => setState(() => _eventReminders = v),
          ),
          SwitchListTile(
            title: const Text('Birthday Reminders'),
            subtitle: const Text('Family birthday notifications'),
            value: _birthdayReminders,
            onChanged: (v) => setState(() => _birthdayReminders = v),
          ),
          SwitchListTile(
            title: const Text('Game Invites'),
            subtitle: const Text('When you\'re invited to play'),
            value: _gameInvites,
            onChanged: (v) => setState(() => _gameInvites = v),
          ),
          SwitchListTile(
            title: const Text('Family Invitations'),
            subtitle: const Text('When you\'re invited to a family'),
            value: _familyInvites,
            onChanged: (v) => setState(() => _familyInvites = v),
          ),
        ],
      ),
    );
  }
}
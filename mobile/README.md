# Our Cousin Family — Flutter Mobile App

A private family social network mobile application built with Flutter, designed exclusively for cousins and extended family members to stay connected, share memories, communicate, play games, and manage family activities.

## Features

### ✅ Implemented

- **Authentication & Onboarding**
  - Email/password signup and login
  - Email verification flow
  - Password reset
  - Profile creation with avatar
  - Google OAuth sign-in
  - Secure session persistence

- **Family Management**
  - Create family groups with name, description, cover image, and rules
  - Generate invitation codes and join families
  - Member roles (owner, admin, moderator, member)
  - Member management (invite, remove, role assignment)
  - Family dashboard with activity shortcuts

- **Social Feed**
  - Text posts with moment badges (birthday, trip, throwback, celebration)
  - Photo/video upload with multi-image grid
  - Like/unlike, comment, reply to comments
  - Pin posts, delete own posts
  - Real-time feed updates

- **Family Tree**
  - Interactive visual tree view with zoom/pan
  - Searchable member list
  - Member profiles with relationship information
  - Add/edit relationships

- **Real-Time Chat**
  - One-to-one and group conversations
  - Text messages with real-time sync
  - Photo and file attachments
  - Typing indicators via Supabase Realtime
  - Unread message counts
  - Message timestamps

- **Audio/Video Calls**
  - WebRTC-based calling infrastructure
  - Call lobby with camera/mic controls
  - Active call UI with controls (mute, camera, flip, speaker, end)
  - LiveKit integration (requires configuration)

- **Memory Vault**
  - Upload photos, videos, documents, audio
  - Album creation and organization
  - Tags, captions, descriptions
  - Search and filter capabilities

- **Voice Archive**
  - Microphone recording with permission handling
  - Record, pause, resume, stop controls
  - Duration tracking
  - Metadata (title, speaker name, description)

- **Multiplayer Ludo**
  - Game room creation with 2-4 player support
  - Room code joining
  - Visual Ludo board with CustomPainter
  - Dice rolling with animation
  - Player info display
  - Server-validated game logic

- **Family Calendar**
  - Month/week calendar view with table_calendar
  - Event types (birthday, anniversary, reunion, religious, custom)
  - Event creation with date/time/location
  - RSVP system
  - All-day events support

- **Notifications**
  - In-app notification center
  - Push notification infrastructure (FCM)
  - Notification types (comment, reaction, invite, message, game, event)
  - Unread count badges
  - Mark all as read

- **Profile & Settings**
  - Edit profile (name, bio, phone, location)
  - Avatar upload
  - Theme settings (light, dark, system)
  - Notification preferences
  - Account management
  - Sign out with confirmation

### 🔧 Awaiting Configuration

- **LiveKit Calls**: Requires LiveKit Cloud credentials
- **Google Drive Memory Vault**: Requires Google OAuth credentials
- **Push Notifications**: Requires Firebase configuration
- **Email Verification**: Requires Supabase SMTP configuration

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | Dart 3.2+ |
| Framework | Flutter 3.16+ |
| State Management | Riverpod 2.x |
| Navigation | GoRouter 13.x |
| Backend | Supabase (PostgreSQL, Auth, Realtime, Storage) |
| HTTP Client | Dio 5.x |
| Push Notifications | Firebase Cloud Messaging |
| Local Storage | SharedPreferences + Flutter Secure Storage |
| Audio/Video Calls | WebRTC + LiveKit |
| Games | Custom engine + Supabase RPCs |
| Database | PostgreSQL with Row Level Security |

## Architecture

```
mobile/lib/
├── main.dart                    # App entry point
├── app.dart                     # MaterialApp configuration
├── core/
│   ├── config/env_config.dart   # Environment configuration
│   ├── constants/               # App constants, API constants
│   ├── errors/                  # Exception hierarchy
│   ├── network/                 # Dio client, interceptors
│   ├── routing/                 # GoRouter configuration
│   ├── theme/                   # Material 3 theme, colors, typography
│   └── widgets/                 # Reusable widgets (buttons, inputs, avatars, etc.)
├── features/
│   ├── auth/                    # Authentication (login, signup, forgot password)
│   ├── onboarding/              # Onboarding screens
│   ├── home/                    # Home dashboard
│   ├── families/                # Family management
│   ├── family_tree/             # Interactive family tree
│   ├── social_feed/             # Posts, comments, reactions
│   ├── memories/                # Photo/video vault
│   ├── chat/                    # Real-time messaging
│   ├── calls/                   # Audio/video calls
│   ├── games/                   # Multiplayer Ludo
│   ├── events/                  # Calendar & events
│   ├── voice_archive/           # Voice memory recording
│   ├── notifications/           # Notification center
│   ├── profile/                 # User profile
│   └── settings/                # App settings
└── shared/
    ├── models/                  # Data models
    ├── providers/               # Global Riverpod providers
    └── services/                # Notification, storage, connectivity services
```

### Design System

- **Primary Color**: Warm coral (#E07A5F) — family-inspired, welcoming
- **Secondary**: Warm gold (#F2CC8F)
- **Tertiary**: Sage green (#81B29A)
- **Typography**: Nunito font family (Regular, Medium, SemiBold, Bold, ExtraBold)
- **Material 3** design with rounded corners, soft shadows, and warm backgrounds
- **Light and dark themes** with system theme support
- **Responsive layouts** for small and large Android devices

## Database Schema

The PostgreSQL database includes **23 tables** with:

- Foreign keys, indexes, and constraints
- Row Level Security (RLS) policies on all tables
- Automatic triggers (profile creation, member counting)
- Security-definer functions (join family by code, mark read)
- Proper data retention and cascade delete policies

See `supabase/migrations/20261019000000_flutter_app_schema.sql` for the complete schema.

## Getting Started

### Prerequisites

- Flutter 3.16+ installed
- Android Studio / VS Code
- A Supabase account (free tier works)

### 1. Clone & Setup

```bash
cd mobile
flutter pub get
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your Supabase URL and anon key from:
**Supabase Dashboard → Project Settings → API**

### 3. Setup Database

Apply the migration to your Supabase project:
1. Go to **Supabase Dashboard → SQL Editor**
2. Copy the contents of `supabase/migrations/20261019000000_flutter_app_schema.sql`
3. Run the SQL

### 4. Run

```bash
flutter run
```

### 5. Build APK

```bash
flutter build apk --release
```

## Testing

```bash
# Run all tests
flutter test

# Run with coverage
flutter test --coverage

# Run specific test file
flutter test test/unit/models_test.dart

# Analyze code
flutter analyze

# Format code
dart format .
```

### Test Coverage

- **Models**: UserProfile, Family, Post, Message, Game, Event, Notification
- **Validation**: Email, password, name, invitation codes
- **Error handling**: Exception hierarchy and error messages
- **Game logic**: Dice validation, move validation, win conditions, turn management

## External Services

| Service | Required | Purpose |
|---------|----------|---------|
| Supabase | Yes | Database, Auth, Realtime, Storage |
| Firebase | Optional | Push notifications |
| LiveKit | Optional | Audio/video calls |
| Google Drive | Optional | Memory Vault backup |

### LiveKit Setup (Optional)

1. Create a LiveKit Cloud project
2. Deploy the `livekit-token` Edge Function to Supabase
3. Set `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` as Supabase secrets

### Firebase Setup (Optional)

1. Create a Firebase project
2. Download `google-services.json` to `android/app/`
3. Enable Cloud Messaging

## Known Limitations

- **Supabase Required**: The app requires a Supabase project with the migrations applied
- **LiveKit Calls**: Video/audio calls require LiveKit Cloud credentials
- **Google Drive Vault**: Memory Vault Drive integration requires Google OAuth setup
- **Push Notifications**: Requires Firebase configuration
- **Offline Mode**: Basic connectivity detection; full offline support planned for v2
- **Android Only**: iOS support not yet implemented

## License

Private — For the Our Cousin Family project.
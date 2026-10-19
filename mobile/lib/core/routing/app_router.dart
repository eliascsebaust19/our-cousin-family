import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'route_names.dart';
import '../widgets/app_scaffold.dart';
import '../../features/auth/presentation/screens/splash_screen.dart';
import '../../features/auth/presentation/screens/login_screen.dart';
import '../../features/auth/presentation/screens/signup_screen.dart';
import '../../features/auth/presentation/screens/forgot_password_screen.dart';
import '../../features/auth/presentation/screens/verify_email_screen.dart';
import '../../features/auth/presentation/screens/create_join_family_screen.dart';
import '../../features/onboarding/presentation/screens/onboarding_screen.dart';
import '../../features/home/presentation/screens/home_screen.dart';
import '../../features/families/presentation/screens/family_list_screen.dart';
import '../../features/family_tree/presentation/screens/family_tree_screen.dart';
import '../../features/social_feed/presentation/screens/feed_screen.dart';
import '../../features/social_feed/presentation/screens/create_post_screen.dart';
import '../../features/social_feed/presentation/screens/post_detail_screen.dart';
import '../../features/memories/presentation/screens/memories_screen.dart';
import '../../features/memories/presentation/screens/album_detail_screen.dart';
import '../../features/memories/presentation/screens/memory_detail_screen.dart';
import '../../features/chat/presentation/screens/chat_list_screen.dart';
import '../../features/chat/presentation/screens/conversation_screen.dart';
import '../../features/chat/presentation/screens/new_chat_screen.dart';
import '../../features/calls/presentation/screens/call_lobby_screen.dart';
import '../../features/calls/presentation/screens/active_call_screen.dart';
import '../../features/games/presentation/screens/game_lobby_screen.dart';
import '../../features/games/presentation/screens/ludo_board_screen.dart';
import '../../features/events/presentation/screens/event_calendar_screen.dart';
import '../../features/events/presentation/screens/create_event_screen.dart';
import '../../features/events/presentation/screens/event_detail_screen.dart';
import '../../features/voice_archive/presentation/screens/voice_archive_screen.dart';
import '../../features/voice_archive/presentation/screens/record_voice_screen.dart';
import '../../features/notifications/presentation/screens/notifications_screen.dart';
import '../../features/profile/presentation/screens/profile_screen.dart';
import '../../features/profile/presentation/screens/edit_profile_screen.dart';
import '../../features/settings/presentation/screens/settings_screen.dart';
import '../../features/settings/presentation/screens/notification_settings_screen.dart';
import '../../features/settings/presentation/screens/theme_settings_screen.dart';
import '../../features/settings/presentation/screens/about_screen.dart';

final _rootNavigatorKey = GlobalKey<NavigatorState>();
final _shellNavigatorHomeKey = GlobalKey<NavigatorState>(
  name: 'home-shell',
);
final _shellNavigatorFamilyKey = GlobalKey<NavigatorState>(
  name: 'family-shell',
);
final _shellNavigatorMemoriesKey = GlobalKey<NavigatorState>(
  name: 'memories-shell',
);
final _shellNavigatorChatKey = GlobalKey<NavigatorState>(
  name: 'chat-shell',
);
final _shellNavigatorProfileKey = GlobalKey<NavigatorState>(
  name: 'profile-shell',
);

final appRouterProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: '/home',
    debugLogDiagnostics: false,
    redirect: (context, state) {
      final supabase = Supabase.instance.client;
      final session = supabase.auth.currentSession;
      final isLoggedIn = session != null;
      final isAuthRoute = state.matchedLocation.startsWith('/auth') ||
          state.matchedLocation == '/login' ||
          state.matchedLocation == '/signup' ||
          state.matchedLocation == '/forgot-password' ||
          state.matchedLocation == '/reset-password' ||
          state.matchedLocation == '/verify-email' ||
          state.matchedLocation == '/onboarding' ||
          state.matchedLocation == '/';

      if (!isLoggedIn && !isAuthRoute) {
        return '/login';
      }
      if (isLoggedIn && isAuthRoute) {
        return '/home';
      }
      return null;
    },
    routes: [
      // ── Auth Routes ──
      GoRoute(
        path: '/',
        name: RouteNames.splash,
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: '/onboarding',
        name: RouteNames.onboarding,
        builder: (context, state) => const OnboardingScreen(),
      ),
      GoRoute(
        path: '/login',
        name: RouteNames.login,
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/signup',
        name: RouteNames.signup,
        builder: (context, state) => const SignupScreen(),
      ),
      GoRoute(
        path: '/forgot-password',
        name: RouteNames.forgotPassword,
        builder: (context, state) => const ForgotPasswordScreen(),
      ),
      GoRoute(
        path: '/verify-email',
        name: RouteNames.verifyEmail,
        builder: (context, state) => const VerifyEmailScreen(),
      ),
      GoRoute(
        path: '/create-join-family',
        name: RouteNames.createJoinFamily,
        builder: (context, state) => const CreateJoinFamilyScreen(),
      ),

      // ── Main Shell Routes (Bottom Navigation) ──
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return AppScaffold(navigationShell: navigationShell);
        },
        branches: [
          // Home Tab
          StatefulShellBranch(
            navigatorKey: _shellNavigatorHomeKey,
            routes: [
              GoRoute(
                path: '/home',
                name: RouteNames.home,
                pageBuilder: (context, state) => const NoTransitionPage(
                  child: HomeScreen(),
                ),
                routes: [
                  GoRoute(
                    path: 'notifications',
                    name: RouteNames.notifications,
                    builder: (context, state) =>
                        const NotificationsScreen(),
                  ),
                  GoRoute(
                    path: 'events',
                    name: RouteNames.eventCalendar,
                    builder: (context, state) =>
                        const EventCalendarScreen(),
                    routes: [
                      GoRoute(
                        path: 'create',
                        name: RouteNames.createEvent,
                        builder: (context, state) =>
                            const CreateEventScreen(),
                      ),
                      GoRoute(
                        path: ':id',
                        name: RouteNames.eventDetail,
                        builder: (context, state) => EventDetailScreen(
                          eventId: state.pathParameters['id']!,
                        ),
                      ),
                    ],
                  ),
                  GoRoute(
                    path: 'games',
                    name: RouteNames.gameLobby,
                    builder: (context, state) =>
                        const GameLobbyScreen(),
                    routes: [
                      GoRoute(
                        path: 'room/:id',
                        name: RouteNames.ludoGame,
                        builder: (context, state) => LudoBoardScreen(
                          roomId: state.pathParameters['id']!,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),

          // Family Tab
          StatefulShellBranch(
            navigatorKey: _shellNavigatorFamilyKey,
            routes: [
              GoRoute(
                path: '/family',
                name: RouteNames.family,
                pageBuilder: (context, state) => const NoTransitionPage(
                  child: FamilyListScreen(),
                ),
                routes: [
                  GoRoute(
                    path: 'tree/:familyId',
                    name: RouteNames.familyTree,
                    builder: (context, state) => FamilyTreeScreen(
                      familyId: state.pathParameters['familyId']!,
                    ),
                  ),
                  GoRoute(
                    path: 'feed/:familyId',
                    name: 'family-feed',
                    builder: (context, state) => FeedScreen(
                      familyId: state.pathParameters['familyId']!,
                    ),
                    routes: [
                      GoRoute(
                        path: 'create',
                        name: RouteNames.createPost,
                        builder: (context, state) => CreatePostScreen(
                          familyId: state.pathParameters['familyId']!,
                        ),
                      ),
                      GoRoute(
                        path: 'post/:postId',
                        name: RouteNames.postDetail,
                        builder: (context, state) => PostDetailScreen(
                          postId: state.pathParameters['postId']!,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),

          // Memories Tab
          StatefulShellBranch(
            navigatorKey: _shellNavigatorMemoriesKey,
            routes: [
              GoRoute(
                path: '/memories',
                name: RouteNames.memories,
                pageBuilder: (context, state) => const NoTransitionPage(
                  child: MemoriesScreen(),
                ),
                routes: [
                  GoRoute(
                    path: 'album/:id',
                    name: RouteNames.albumDetail,
                    builder: (context, state) => AlbumDetailScreen(
                      albumId: state.pathParameters['id']!,
                    ),
                  ),
                  GoRoute(
                    path: 'memory/:id',
                    name: RouteNames.memoryDetail,
                    builder: (context, state) => MemoryDetailScreen(
                      memoryId: state.pathParameters['id']!,
                    ),
                  ),
                  GoRoute(
                    path: 'voice',
                    name: RouteNames.voiceRecordings,
                    builder: (context, state) =>
                        const VoiceArchiveScreen(),
                    routes: [
                      GoRoute(
                        path: 'record',
                        name: RouteNames.recordVoice,
                        builder: (context, state) =>
                            const RecordVoiceScreen(),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),

          // Chat Tab
          StatefulShellBranch(
            navigatorKey: _shellNavigatorChatKey,
            routes: [
              GoRoute(
                path: '/chat',
                name: RouteNames.chat,
                pageBuilder: (context, state) => const NoTransitionPage(
                  child: ChatListScreen(),
                ),
                routes: [
                  GoRoute(
                    path: 'conversation/:id',
                    name: RouteNames.conversation,
                    parentNavigatorKey: _rootNavigatorKey,
                    builder: (context, state) => ConversationScreen(
                      conversationId: state.pathParameters['id']!,
                    ),
                  ),
                  GoRoute(
                    path: 'new',
                    name: RouteNames.newChat,
                    builder: (context, state) => const NewChatScreen(),
                  ),
                  GoRoute(
                    path: 'call/:id',
                    name: RouteNames.callLobby,
                    parentNavigatorKey: _rootNavigatorKey,
                    builder: (context, state) => CallLobbyScreen(
                      roomId: state.pathParameters['id']!,
                    ),
                  ),
                  GoRoute(
                    path: 'active-call/:id',
                    name: RouteNames.activeCall,
                    parentNavigatorKey: _rootNavigatorKey,
                    builder: (context, state) => ActiveCallScreen(
                      roomId: state.pathParameters['id']!,
                    ),
                  ),
                ],
              ),
            ],
          ),

          // Profile Tab
          StatefulShellBranch(
            navigatorKey: _shellNavigatorProfileKey,
            routes: [
              GoRoute(
                path: '/profile',
                name: RouteNames.profile,
                pageBuilder: (context, state) => const NoTransitionPage(
                  child: ProfileScreen(),
                ),
                routes: [
                  GoRoute(
                    path: 'edit',
                    name: RouteNames.editProfile,
                    builder: (context, state) =>
                        const EditProfileScreen(),
                  ),
                  GoRoute(
                    path: 'settings',
                    name: RouteNames.settings,
                    builder: (context, state) =>
                        const SettingsScreen(),
                    routes: [
                      GoRoute(
                        path: 'notifications',
                        name: RouteNames.notificationSettings,
                        builder: (context, state) =>
                            const NotificationSettingsScreen(),
                      ),
                      GoRoute(
                        path: 'theme',
                        name: RouteNames.themeSettings,
                        builder: (context, state) =>
                            const ThemeSettingsScreen(),
                      ),
                      GoRoute(
                        path: 'about',
                        name: RouteNames.about,
                        builder: (context, state) =>
                            const AboutScreen(),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 64, color: Colors.red),
            const SizedBox(height: 16),
            Text(
              'Page not found',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 8),
            Text(
              state.error?.toString() ?? 'Unknown error',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => context.go('/home'),
              child: const Text('Go Home'),
            ),
          ],
        ),
      ),
    ),
  );
});
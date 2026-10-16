// Hand-written to match supabase/migrations/*.sql (Regenerate with
// `supabase gen types typescript` once a linked project exists.)

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          nickname: string | null;
          username: string | null;
          bio: string | null;
          birthday: string | null;
          relationship: string | null;
          avatar_url: string | null;
          show_birthday: boolean;
          show_online_status: boolean;
          notification_prefs: Json;
          last_seen_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          nickname?: string | null;
          username?: string | null;
          bio?: string | null;
          birthday?: string | null;
          relationship?: string | null;
          avatar_url?: string | null;
          show_birthday?: boolean;
          show_online_status?: boolean;
          notification_prefs?: Json;
          last_seen_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          full_name?: string;
          nickname?: string | null;
          username?: string | null;
          bio?: string | null;
          birthday?: string | null;
          relationship?: string | null;
          avatar_url?: string | null;
          show_birthday?: boolean;
          show_online_status?: boolean;
          notification_prefs?: Json;
          last_seen_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      families: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          rules: string | null;
          avatar_url: string | null;
          cover_url: string | null;
          privacy: string;
          require_approval: boolean;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          rules?: string | null;
          avatar_url?: string | null;
          cover_url?: string | null;
          privacy?: string;
          require_approval?: boolean;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          rules?: string | null;
          avatar_url?: string | null;
          cover_url?: string | null;
          privacy?: string;
          require_approval?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "families_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      family_members: {
        Row: {
          family_id: string;
          user_id: string;
          role: string;
          status: string;
          invited_by: string | null;
          joined_at: string;
        };
        Insert: {
          family_id: string;
          user_id: string;
          role?: string;
          status?: string;
          invited_by?: string | null;
          joined_at?: string;
        };
        Update: {
          role?: string;
          status?: string;
          invited_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey";
            columns: ["family_id"];
            referencedRelation: "families";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "family_members_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "family_members_invited_by_fkey";
            columns: ["invited_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      family_invitations: {
        Row: {
          id: string;
          family_id: string;
          code: string;
          created_by: string;
          role: string;
          expires_at: string | null;
          revoked_at: string | null;
          max_uses: number | null;
          used_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          family_id: string;
          code: string;
          created_by: string;
          role?: string;
          expires_at?: string | null;
          revoked_at?: string | null;
          max_uses?: number | null;
          used_count?: number;
          created_at?: string;
        };
        Update: {
          expires_at?: string | null;
          revoked_at?: string | null;
          max_uses?: number | null;
          used_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "family_invitations_family_id_fkey";
            columns: ["family_id"];
            referencedRelation: "families";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "family_invitations_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      posts: {
        Row: {
          id: string;
          family_id: string;
          author_id: string;
          content: string | null;
          moment_type: string;
          visibility: string;
          is_pinned: boolean;
          shared_post_id: string | null;
          edited_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          family_id: string;
          author_id: string;
          content?: string | null;
          moment_type?: string;
          visibility?: string;
          is_pinned?: boolean;
          shared_post_id?: string | null;
          edited_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          content?: string | null;
          moment_type?: string;
          visibility?: string;
          is_pinned?: boolean;
          edited_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "posts_family_id_fkey";
            columns: ["family_id"];
            referencedRelation: "families";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "posts_author_id_fkey";
            columns: ["author_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "posts_shared_post_id_fkey";
            columns: ["shared_post_id"];
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      post_media: {
        Row: {
          id: string;
          post_id: string;
          storage_path: string;
          media_type: string;
          mime_type: string;
          size_bytes: number;
          width: number | null;
          height: number | null;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          storage_path: string;
          media_type: string;
          mime_type: string;
          size_bytes?: number;
          width?: number | null;
          height?: number | null;
          position?: number;
          created_at?: string;
        };
        Update: {
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: "post_media_post_id_fkey";
            columns: ["post_id"];
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      post_reactions: {
        Row: {
          post_id: string;
          user_id: string;
          reaction: string;
          created_at: string;
        };
        Insert: {
          post_id: string;
          user_id: string;
          reaction?: string;
          created_at?: string;
        };
        Update: {
          reaction?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_reactions_post_id_fkey";
            columns: ["post_id"];
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_reactions_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      comments: {
        Row: {
          id: string;
          post_id: string;
          author_id: string;
          parent_id: string | null;
          content: string;
          edited_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          author_id: string;
          parent_id?: string | null;
          content: string;
          edited_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          content?: string;
          edited_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comments_post_id_fkey";
            columns: ["post_id"];
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_author_id_fkey";
            columns: ["author_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_parent_id_fkey";
            columns: ["parent_id"];
            referencedRelation: "comments";
            referencedColumns: ["id"];
          },
        ];
      };
      post_bookmarks: {
        Row: {
          post_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          post_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: "post_bookmarks_post_id_fkey";
            columns: ["post_id"];
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_bookmarks_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      conversations: {
        Row: {
          id: string;
          family_id: string;
          type: string;
          title: string | null;
          created_by: string;
          last_message_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          family_id: string;
          type?: string;
          title?: string | null;
          created_by: string;
          last_message_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string | null;
          last_message_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversations_family_id_fkey";
            columns: ["family_id"];
            referencedRelation: "families";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      conversation_members: {
        Row: {
          conversation_id: string;
          user_id: string;
          role: string;
          last_read_at: string;
          muted: boolean;
          joined_at: string;
        };
        Insert: {
          conversation_id: string;
          user_id: string;
          role?: string;
          last_read_at?: string;
          muted?: boolean;
          joined_at?: string;
        };
        Update: {
          last_read_at?: string;
          muted?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey";
            columns: ["conversation_id"];
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversation_members_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          reply_to_id: string | null;
          content: string | null;
          message_type: string;
          edited_at: string | null;
          deleted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          reply_to_id?: string | null;
          content?: string | null;
          message_type?: string;
          edited_at?: string | null;
          deleted_at?: string | null;
          created_at?: string;
        };
        Update: {
          reply_to_id?: string | null;
          content?: string | null;
          edited_at?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey";
            columns: ["reply_to_id"];
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
        ];
      };
      message_attachments: {
        Row: {
          id: string;
          message_id: string;
          storage_path: string;
          media_type: string;
          mime_type: string;
          size_bytes: number;
          duration_ms: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          message_id: string;
          storage_path: string;
          media_type: string;
          mime_type: string;
          size_bytes?: number;
          duration_ms?: number | null;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: "message_attachments_message_id_fkey";
            columns: ["message_id"];
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          family_id: string | null;
          actor_id: string | null;
          type: string;
          entity_type: string | null;
          entity_id: string | null;
          title: string;
          body: string | null;
          link: string | null;
          dedupe_key: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          family_id?: string | null;
          actor_id?: string | null;
          type: string;
          entity_type?: string | null;
          entity_id?: string | null;
          title: string;
          body?: string | null;
          link?: string | null;
          dedupe_key?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          read_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_family_id_fkey";
            columns: ["family_id"];
            referencedRelation: "families";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_actor_id_fkey";
            columns: ["actor_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      family_events: {
        Row: {
          id: string;
          family_id: string;
          created_by: string;
          title: string;
          description: string | null;
          location: string | null;
          starts_at: string;
          ends_at: string | null;
          all_day: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          family_id: string;
          created_by: string;
          title: string;
          description?: string | null;
          location?: string | null;
          starts_at: string;
          ends_at?: string | null;
          all_day?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          location?: string | null;
          starts_at?: string;
          ends_at?: string | null;
          all_day?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "family_events_family_id_fkey";
            columns: ["family_id"];
            referencedRelation: "families";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "family_events_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      event_rsvps: {
        Row: {
          event_id: string;
          user_id: string;
          response: string;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          event_id: string;
          user_id: string;
          response: string;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          response?: string;
          note?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_id_fkey";
            columns: ["event_id"];
            referencedRelation: "family_events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_rsvps_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ludo_games: {
        Row: {
          id: string;
          family_id: string;
          created_by: string;
          board_seats: number;
          tokens_per_player: number;
          status: string;
          phase: string;
          turn_seat: number | null;
          turn_deadline: string | null;
          dice: number | null;
          consecutive_sixes: number;
          version: number;
          state: Json;
          winner_seat: number | null;
          turn_seconds: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          family_id: string;
          created_by: string;
          board_seats: number;
          tokens_per_player: number;
          status?: string;
          phase?: string;
          turn_seat?: number | null;
          turn_deadline?: string | null;
          dice?: number | null;
          consecutive_sixes?: number;
          version?: number;
          state?: Json;
          winner_seat?: number | null;
          turn_seconds?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: string;
          phase?: string;
          turn_seat?: number | null;
          turn_deadline?: string | null;
          dice?: number | null;
          consecutive_sixes?: number;
          version?: number;
          state?: Json;
          winner_seat?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ludo_games_family_id_fkey";
            columns: ["family_id"];
            referencedRelation: "families";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ludo_games_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ludo_seats: {
        Row: {
          id: string;
          game_id: string;
          seat: number;
          user_id: string;
          color: string;
          autoplay: boolean;
          placement: number | null;
          joined_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          seat: number;
          user_id: string;
          color: string;
          autoplay?: boolean;
          placement?: number | null;
          joined_at?: string;
        };
        Update: {
          autoplay?: boolean;
          placement?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "ludo_seats_game_id_fkey";
            columns: ["game_id"];
            referencedRelation: "ludo_games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ludo_seats_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ludo_actions: {
        Row: {
          id: string;
          game_id: string;
          seq: number;
          seat: number | null;
          action: string;
          dice: number | null;
          token_index: number | null;
          expected_version: number | null;
          result: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          seq: number;
          seat?: number | null;
          action: string;
          dice?: number | null;
          token_index?: number | null;
          expected_version?: number | null;
          result?: Json | null;
          created_at?: string;
        };
        Update: {
          result?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "ludo_actions_game_id_fkey";
            columns: ["game_id"];
            referencedRelation: "ludo_games";
            referencedColumns: ["id"];
          },
        ];
      };
      vault_connections: {
        Row: {
          family_id: string;
          account_email: string | null;
          account_name: string | null;
          refresh_token_enc: string;
          scope: string | null;
          revoked_at: string | null;
          connected_by: string | null;
          connected_at: string;
          updated_at: string;
        };
        Insert: {
          family_id: string;
          account_email?: string | null;
          account_name?: string | null;
          refresh_token_enc: string;
          scope?: string | null;
          revoked_at?: string | null;
          connected_by?: string | null;
          connected_at?: string;
          updated_at?: string;
        };
        Update: {
          account_email?: string | null;
          account_name?: string | null;
          refresh_token_enc?: string;
          scope?: string | null;
          revoked_at?: string | null;
          connected_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vault_connections_family_id_fkey";
            columns: ["family_id"];
            referencedRelation: "families";
            referencedColumns: ["id"];
          },
        ];
      };
      vault_items: {
        Row: {
          id: string;
          family_id: string;
          added_by: string;
          drive_file_id: string | null;
          drive_folder_id: string | null;
          name: string;
          mime_type: string;
          size_bytes: number;
          kind: string;
          captured_at: string | null;
          year: number | null;
          event_id: string | null;
          caption: string | null;
          is_favorite: boolean;
          upload_state: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          family_id: string;
          added_by: string;
          drive_file_id?: string | null;
          drive_folder_id?: string | null;
          name: string;
          mime_type?: string;
          size_bytes?: number;
          kind?: string;
          captured_at?: string | null;
          year?: number | null;
          event_id?: string | null;
          caption?: string | null;
          is_favorite?: boolean;
          upload_state?: string;
          created_at?: string;
          updated_at?: string;
        };
        // Column-level grants expose exactly these two columns to clients.
        Update: {
          caption?: string | null;
          is_favorite?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "vault_items_family_id_fkey";
            columns: ["family_id"];
            referencedRelation: "families";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vault_items_added_by_fkey";
            columns: ["added_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vault_items_event_id_fkey";
            columns: ["event_id"];
            referencedRelation: "family_events";
            referencedColumns: ["id"];
          },
        ];
      };
      vault_item_people: {
        Row: {
          item_id: string;
          profile_id: string;
          created_at: string;
        };
        Insert: {
          item_id: string;
          profile_id: string;
          created_at?: string;
        };
        Update: {
          item_id?: string;
          profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vault_item_people_item_id_fkey";
            columns: ["item_id"];
            referencedRelation: "vault_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vault_item_people_profile_id_fkey";
            columns: ["profile_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_family: {
        Args: {
          p_name: string;
          p_description?: string | null;
          p_rules?: string | null;
          p_privacy?: string;
          p_require_approval?: boolean;
          p_avatar_url?: string | null;
          p_cover_url?: string | null;
        };
        Returns: Json;
      };
      preview_invitation: {
        Args: { p_code: string };
        Returns: Json;
      };
      join_family_by_code: {
        Args: { p_code: string };
        Returns: Json;
      };
      create_invitation: {
        Args: {
          p_family_id: string;
          p_role?: string;
          p_expires_at?: string | null;
          p_max_uses?: number | null;
        };
        Returns: string;
      };
      revoke_invitation: {
        Args: { p_invitation_id: string };
        Returns: undefined;
      };
      set_member_status: {
        Args: { p_family_id: string; p_user_id: string; p_status: string };
        Returns: undefined;
      };
      remove_member: {
        Args: { p_family_id: string; p_user_id: string };
        Returns: undefined;
      };
      set_member_role: {
        Args: { p_family_id: string; p_user_id: string; p_role: string };
        Returns: undefined;
      };
      create_direct_conversation: {
        Args: { p_family_id: string; p_other_user: string };
        Returns: Json;
      };
      create_group_conversation: {
        Args: { p_family_id: string; p_title: string; p_member_ids: string[] };
        Returns: Json;
      };
      mark_conversation_read: {
        Args: { p_conversation_id: string };
        Returns: undefined;
      };
      touch_last_seen: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      get_unread_counts: {
        Args: Record<string, never>;
        Returns: { conversation_id: string; unread_count: number }[];
      };
      get_conversation_summaries: {
        Args: Record<string, never>;
        Returns: {
          conversation_id: string;
          family_id: string;
          type: string;
          title: string | null;
          last_message_at: string | null;
          last_message_content: string | null;
          last_message_type: string | null;
          unread_count: number;
        }[];
      };
      ludo_create_game: {
        Args: {
          p_family_id: string;
          p_board_seats: number;
          p_turn_seconds?: number;
        };
        Returns: string;
      };
      ludo_join_game: {
        Args: { p_game_id: string };
        Returns: number;
      };
      ludo_start_game: {
        Args: { p_game_id: string };
        Returns: Json;
      };
      ludo_roll: {
        Args: {
          p_game_id: string;
          p_expected_version: number;
          /** Verification-harness hook; refused unless ocf.test_mode is on. */
          p_forced_dice?: number | null;
        };
        Returns: Json;
      };
      ludo_move: {
        Args: { p_game_id: string; p_token: number; p_expected_version: number };
        Returns: Json;
      };
      ludo_pass: {
        Args: { p_game_id: string; p_expected_version: number };
        Returns: Json;
      };
      ludo_auto_resolve: {
        Args: { p_game_id: string };
        Returns: Json;
      };
      ludo_snapshot: {
        Args: { p_game_id: string };
        Returns: Json;
      };
      vault_item_family_id: {
        Args: { p_item_id: string };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

/** Loose JSON result of our jsonb-returning RPCs. */
export type RpcJson = Record<string, unknown>;

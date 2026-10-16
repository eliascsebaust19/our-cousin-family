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
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

/** Loose JSON result of our jsonb-returning RPCs. */
export type RpcJson = Record<string, unknown>;

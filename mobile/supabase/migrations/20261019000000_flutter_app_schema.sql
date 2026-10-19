-- ============================================================
-- Our Cousin Family — Flutter App Database Schema
-- Complete PostgreSQL schema with RLS policies
-- Compatible with Supabase
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Profiles ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT NOT NULL DEFAULT '',
    avatar_url TEXT,
    bio TEXT,
    phone_number TEXT,
    date_of_birth DATE,
    location TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Families ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS families (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    cover_image_url TEXT,
    rules TEXT,
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    member_count INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Family Members ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS family_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member'
        CHECK (role IN ('owner', 'admin', 'moderator', 'member')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(family_id, user_id)
);

-- ─── Family Invitations ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS family_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    code TEXT UNIQUE NOT NULL,
    invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    invited_email TEXT,
    role TEXT NOT NULL DEFAULT 'member'
        CHECK (role IN ('admin', 'moderator', 'member')),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
    max_uses INT DEFAULT 10,
    used_count INT DEFAULT 0,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Family Relationships (Family Tree) ──────────────────────────────
CREATE TABLE IF NOT EXISTS family_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    related_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL
        CHECK (relationship_type IN (
            'parent', 'child', 'sibling', 'spouse',
            'cousin', 'uncle', 'aunt', 'grandparent',
            'grandchild', 'nephew', 'niece', 'other'
        )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(family_id, user_id, related_user_id, relationship_type),
    CHECK (user_id != related_user_id)
);

-- ─── Posts ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL DEFAULT '',
    moment_badge TEXT,
    is_pinned BOOLEAN DEFAULT FALSE,
    likes_count INT DEFAULT 0,
    comments_count INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Post Media ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video', 'audio')),
    media_url TEXT NOT NULL,
    thumbnail_url TEXT,
    caption TEXT,
    duration INT,
    sort_order INT DEFAULT 0
);

-- ─── Post Likes ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_likes (
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (post_id, user_id)
);

-- ─── Comments ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    likes_count INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Memory Albums ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS memory_albums (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    cover_image_url TEXT,
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    memory_count INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Memories ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    album_id UUID REFERENCES memory_albums(id) ON DELETE SET NULL,
    uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    media_type TEXT NOT NULL CHECK (media_type IN ('photo', 'video', 'document', 'audio')),
    media_url TEXT NOT NULL,
    thumbnail_url TEXT,
    tags TEXT[] DEFAULT '{}',
    taken_at TIMESTAMPTZ,
    duration INT,
    file_size_bytes INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Conversations ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT,
    avatar_url TEXT,
    is_group BOOLEAN DEFAULT FALSE,
    family_id UUID REFERENCES families(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Conversation Members ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversation_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    last_read_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(conversation_id, user_id)
);

-- ─── Messages ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL DEFAULT '',
    media_url TEXT,
    media_type TEXT,
    reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    is_edited BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Events ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    event_type TEXT NOT NULL DEFAULT 'custom'
        CHECK (event_type IN ('birthday', 'anniversary', 'reunion', 'religious', 'custom')),
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ,
    location TEXT,
    location_url TEXT,
    is_all_day BOOLEAN DEFAULT FALSE,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_rule TEXT,
    rsvp_yes INT DEFAULT 0,
    rsvp_no INT DEFAULT 0,
    rsvp_maybe INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Event Participants ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('yes', 'no', 'maybe', 'pending')),
    UNIQUE(event_id, user_id)
);

-- ─── Notifications ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Game Rooms ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS game_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'waiting'
        CHECK (status IN ('waiting', 'playing', 'finished', 'cancelled')),
    max_players INT DEFAULT 4 CHECK (max_players BETWEEN 2 AND 8),
    current_players INT DEFAULT 0,
    winner_id UUID REFERENCES profiles(id),
    total_turns INT DEFAULT 0,
    board_state JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ
);

-- ─── Game Players ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS game_players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_room_id UUID NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    player_index INT NOT NULL,
    color TEXT NOT NULL,
    turn_order INT DEFAULT 0,
    tokens_home INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(game_room_id, user_id),
    UNIQUE(game_room_id, player_index)
);

-- ─── Game Events ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS game_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_room_id UUID NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Voice Memories ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS voice_memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    recorded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    speaker_name TEXT,
    audio_url TEXT NOT NULL,
    duration_seconds INT DEFAULT 0,
    recorded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── User Settings ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_settings (
    user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    theme_mode TEXT DEFAULT 'system' CHECK (theme_mode IN ('system', 'light', 'dark')),
    notifications_enabled BOOLEAN DEFAULT TRUE,
    chat_notifications BOOLEAN DEFAULT TRUE,
    post_notifications BOOLEAN DEFAULT TRUE,
    event_reminders BOOLEAN DEFAULT TRUE,
    birthday_reminders BOOLEAN DEFAULT TRUE,
    game_invites BOOLEAN DEFAULT TRUE,
    language TEXT DEFAULT 'en',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ─────────────────────────────────────────────────────────
CREATE INDEX idx_family_members_family ON family_members(family_id);
CREATE INDEX idx_family_members_user ON family_members(user_id);
CREATE INDEX idx_family_invitations_code ON family_invitations(code);
CREATE INDEX idx_family_invitations_family ON family_invitations(family_id);
CREATE INDEX idx_family_relationships_family ON family_relationships(family_id);
CREATE INDEX idx_family_relationships_user ON family_relationships(user_id);
CREATE INDEX idx_posts_family ON posts(family_id);
CREATE INDEX idx_posts_author ON posts(author_id);
CREATE INDEX idx_posts_created ON posts(created_at DESC);
CREATE INDEX idx_comments_post ON comments(post_id);
CREATE INDEX idx_memory_albums_family ON memory_albums(family_id);
CREATE INDEX idx_memories_family ON memories(family_id);
CREATE INDEX idx_memories_album ON memories(album_id);
CREATE INDEX idx_conversation_members_user ON conversation_members(user_id);
CREATE INDEX idx_conversation_members_conv ON conversation_members(conversation_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(created_at);
CREATE INDEX idx_events_family ON events(family_id);
CREATE INDEX idx_events_start ON events(start_date);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE NOT is_read;
CREATE INDEX idx_game_rooms_family ON game_rooms(family_id);
CREATE INDEX idx_game_rooms_status ON game_rooms(status);
CREATE INDEX idx_game_players_room ON game_players(game_room_id);
CREATE INDEX idx_voice_memories_family ON voice_memories(family_id);

-- ─── RLS Policies ────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read all profiles, update only their own
CREATE POLICY "Profiles: read all" ON profiles FOR SELECT USING (true);
CREATE POLICY "Profiles: update own" ON profiles
    FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Profiles: insert own" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Families: Members can read, creator can update
CREATE POLICY "Families: members read" ON families FOR SELECT
    USING (id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY "Families: create" ON families
    FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Families: owner update" ON families
    FOR UPDATE USING (
        id IN (SELECT family_id FROM family_members
               WHERE user_id = auth.uid() AND role = 'owner')
    );

-- Family Members: Members can read, owners/admins can manage
CREATE POLICY "Family members: read" ON family_members FOR SELECT
    USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY "Family members: insert self" ON family_members
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Posts: Family members can read/write
CREATE POLICY "Posts: family read" ON posts FOR SELECT
    USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY "Posts: create" ON posts
    FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Posts: author update" ON posts
    FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Posts: author delete" ON posts
    FOR DELETE USING (auth.uid() = author_id);

-- Comments: Family members can read/write
CREATE POLICY "Comments: family read" ON comments FOR SELECT
    USING (post_id IN (SELECT id FROM posts WHERE family_id IN
        (SELECT family_id FROM family_members WHERE user_id = auth.uid())));
CREATE POLICY "Comments: create" ON comments
    FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Comments: author update" ON comments
    FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Comments: author delete" ON comments
    FOR DELETE USING (auth.uid() = author_id);

-- Messages: Conversation members can read/send
CREATE POLICY "Messages: member read" ON messages FOR SELECT
    USING (conversation_id IN
        (SELECT conversation_id FROM conversation_members WHERE user_id = auth.uid()));
CREATE POLICY "Messages: member send" ON messages
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Notifications: Users can only see their own
CREATE POLICY "Notifications: own read" ON notifications FOR SELECT
    USING (auth.uid() = user_id);
CREATE POLICY "Notifications: own update" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- User Settings: Users can only access their own
CREATE POLICY "Settings: own read" ON user_settings FOR SELECT
    USING (auth.uid() = user_id);
CREATE POLICY "Settings: own upsert" ON user_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Settings: own update" ON user_settings
    FOR UPDATE USING (auth.uid() = user_id);

-- Game Rooms: Family members can read
CREATE POLICY "Game rooms: family read" ON game_rooms FOR SELECT
    USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));

-- Events: Family members can read
CREATE POLICY "Events: family read" ON events FOR SELECT
    USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY "Events: create" ON events
    FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Voice Memories: Family members can read
CREATE POLICY "Voice memories: family read" ON voice_memories FOR SELECT
    USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY "Voice memories: create" ON voice_memories
    FOR INSERT WITH CHECK (auth.uid() = recorded_by);

-- Memory Albums: Family members can read
CREATE POLICY "Memory albums: family read" ON memory_albums FOR SELECT
    USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY "Memory albums: create" ON memory_albums
    FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Memories: Family members can read
CREATE POLICY "Memories: family read" ON memories FOR SELECT
    USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY "Memories: create" ON memories
    FOR INSERT WITH CHECK (auth.uid() = uploaded_by);

-- ─── Functions ───────────────────────────────────────────────────────

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    );
    INSERT INTO public.user_settings (user_id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update member count
CREATE OR REPLACE FUNCTION update_family_member_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE families SET member_count = member_count + 1 WHERE id = NEW.family_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE families SET member_count = member_count - 1 WHERE id = OLD.family_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER family_member_count_trigger
    AFTER INSERT OR DELETE ON family_members
    FOR EACH ROW EXECUTE FUNCTION update_family_member_count();

-- Join family by invitation code
CREATE OR REPLACE FUNCTION join_family_by_code(invitation_code TEXT)
RETURNS UUID AS $$
DECLARE
    inv family_invitations%ROWTYPE;
    new_member_id UUID;
BEGIN
    SELECT * INTO inv FROM family_invitations
    WHERE code = invitation_code
    AND status = 'pending'
    AND (expires_at IS NULL OR expires_at > NOW())
    AND used_count < max_uses;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid or expired invitation code';
    END IF;

    -- Check if already a member
    IF EXISTS (
        SELECT 1 FROM family_members
        WHERE family_id = inv.family_id AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Already a member of this family';
    END IF;

    -- Add as member
    INSERT INTO family_members (family_id, user_id, role)
    VALUES (inv.family_id, auth.uid(), inv.role)
    RETURNING id INTO new_member_id;

    -- Update invitation
    UPDATE family_invitations
    SET used_count = used_count + 1,
        status = CASE WHEN used_count + 1 >= max_uses THEN 'accepted' ELSE status END
    WHERE id = inv.id;

    RETURN inv.family_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark conversation as read
CREATE OR REPLACE FUNCTION mark_conversation_read(p_conversation_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE conversation_members
    SET last_read_at = NOW()
    WHERE conversation_id = p_conversation_id
    AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
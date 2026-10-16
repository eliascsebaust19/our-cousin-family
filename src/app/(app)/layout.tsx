import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app/app-shell";
import type { FamilyLite, Membership, ProfileLite } from "@/lib/types";

export const dynamic = "force-dynamic";

type MembershipQueryRow = {
  role: string;
  status: string;
  families: FamilyLite | null;
};

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [profileRes, membershipRes] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, full_name, nickname, username, avatar_url, bio, birthday, relationship, show_birthday, show_online_status, last_seen_at",
      )
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("family_members")
      .select(
        "role, status, families!inner(id, name, description, rules, avatar_url, cover_url, privacy, require_approval, created_by)",
      )
      .eq("user_id", user.id)
      .order("joined_at", { ascending: true }),
  ]);

  const profile: ProfileLite =
    (profileRes.data as ProfileLite | null) ?? {
      id: user.id,
      full_name:
        (user.user_metadata?.full_name as string | undefined) ??
        user.email?.split("@")[0] ??
        "Family member",
      nickname: null,
      username: null,
      avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? null,
      bio: null,
      birthday: null,
      relationship: null,
      show_birthday: true,
      show_online_status: true,
      last_seen_at: null,
    };

  const memberships: Membership[] = (
    (membershipRes.data ?? []) as unknown as MembershipQueryRow[]
  )
    .filter((row) => row.families !== null)
    .map((row) => ({
      role: row.role,
      status: row.status,
      family: row.families as FamilyLite,
    }));

  return (
    <AppShell userId={user.id} profile={profile} memberships={memberships}>
      {children}
    </AppShell>
  );
}

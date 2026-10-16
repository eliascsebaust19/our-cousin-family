/**
 * Migration smoke test.
 *
 * Runs every file in supabase/migrations/ (in filename order) against an
 * in-process PGlite database (Postgres compiled to WASM) on top of minimal
 * Supabase platform stubs, then asserts the resulting shape: table count,
 * RLS enabled everywhere, policies present, storage buckets, realtime
 * publication, and — most importantly — the function EXECUTE grants, which
 * are the app's authorization surface for RPCs.
 *
 * Catches: SQL syntax errors, migration ordering bugs, references to objects
 * that don't exist, and `grant execute on function ...(argtypes)` signatures
 * that don't match the actual function definitions.
 *
 * Usage: npm run db:check
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(root, "supabase", "migrations");
const stubsPath = join(root, "scripts", "pglite", "supabase-stubs.sql");

const EXPECTED_PUBLIC_TABLES = 19; // 14 core + 2 calendar + 3 ludo
const EXPECTED_BUCKETS = 3;
const EXPECTED_REALTIME_TABLES = 12; // 8 core + 2 calendar + 2 ludo

/** RPCs an authenticated member may call. */
const AUTHENTICATED_RPCS = [
  "public.create_family(text, text, text, text, boolean, text, text)",
  "public.preview_invitation(text)",
  "public.join_family_by_code(text)",
  "public.create_invitation(uuid, text, timestamptz, integer)",
  "public.revoke_invitation(uuid)",
  "public.set_member_status(uuid, uuid, text)",
  "public.remove_member(uuid, uuid)",
  "public.set_member_role(uuid, uuid, text)",
  "public.create_direct_conversation(uuid, uuid)",
  "public.create_group_conversation(uuid, text, uuid[])",
  "public.mark_conversation_read(uuid)",
  "public.touch_last_seen()",
  "public.get_unread_counts()",
  "public.get_conversation_summaries()",
  "public.ludo_create_game(uuid, int, int)",
  "public.ludo_join_game(uuid)",
  "public.ludo_start_game(uuid)",
  "public.ludo_roll(uuid, int, int)",
  "public.ludo_move(uuid, int, int)",
  "public.ludo_pass(uuid, int)",
  "public.ludo_auto_resolve(uuid)",
  "public.ludo_snapshot(uuid)",
];

/** RPCs an anonymous (signed-out) caller must NOT be able to call. */
const ANON_FORBIDDEN_RPCS = AUTHENTICATED_RPCS.filter(
  (fn) => fn !== "public.preview_invitation(text)",
);

const failures = [];
const notes = [];

function check(label, condition, detail = "") {
  if (condition) {
    console.log(`  \u2713 ${label}`);
  } else {
    console.log(`  \u2717 ${label}${detail ? ` — ${detail}` : ""}`);
    failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
  }
  return condition;
}

const db = new PGlite({ extensions: { pgcrypto } });

console.log("Our Cousin Family — migration check (PGlite)\n");

// --- Stubs -------------------------------------------------------------------
console.log("Supabase platform stubs");
try {
  await db.exec(readFileSync(stubsPath, "utf8"));
  console.log("  \u2713 stubs applied\n");
} catch (error) {
  console.error(`  \u2717 stubs failed: ${error.message}`);
  process.exit(1);
}

// --- Migrations --------------------------------------------------------------
const migrationFiles = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

if (migrationFiles.length === 0) {
  console.error("No migrations found.");
  process.exit(1);
}

console.log(`Migrations (${migrationFiles.length})`);
for (const file of migrationFiles) {
  const sql = readFileSync(join(migrationsDir, file), "utf8");
  const startedAt = Date.now();
  try {
    await db.exec(sql);
    console.log(`  \u2713 ${file} (${Date.now() - startedAt}ms)`);
  } catch (error) {
    console.error(`  \u2717 ${file}\n      ${error.message}`);
    process.exit(1);
  }
}

// --- Structural assertions ---------------------------------------------------
console.log("\nStructure");

const tables = await db.query(
  `select c.relname, c.relrowsecurity,
          (select count(*) from pg_policies p
            where p.schemaname = 'public' and p.tablename = c.relname) as policies
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname`,
);

check(
  `${EXPECTED_PUBLIC_TABLES} tables in public schema`,
  tables.rows.length === EXPECTED_PUBLIC_TABLES,
  `found ${tables.rows.length}: ${tables.rows.map((r) => r.relname).join(", ")}`,
);

const withoutRls = tables.rows.filter((r) => !r.relrowsecurity).map((r) => r.relname);
check("RLS enabled on every public table", withoutRls.length === 0, withoutRls.join(", "));

const withoutPolicies = tables.rows.filter((r) => Number(r.policies) === 0).map((r) => r.relname);
check("every public table has at least one policy", withoutPolicies.length === 0, withoutPolicies.join(", "));

const buckets = await db.query("select id, public from storage.buckets order by id");
check(
  `${EXPECTED_BUCKETS} storage buckets`,
  buckets.rows.length === EXPECTED_BUCKETS,
  buckets.rows.map((r) => r.id).join(", "),
);
const publicBuckets = buckets.rows.filter((r) => r.public).map((r) => r.id);
check("no storage bucket is public", publicBuckets.length === 0, publicBuckets.join(", "));

const realtime = await db.query(
  `select count(*)::int as n from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'`,
);
check(
  `${EXPECTED_REALTIME_TABLES} tables in supabase_realtime`,
  realtime.rows[0].n === EXPECTED_REALTIME_TABLES,
  `found ${realtime.rows[0].n}`,
);

// --- Authorization surface ---------------------------------------------------
console.log("\nRPC grants");

for (const fn of AUTHENTICATED_RPCS) {
  const { rows } = await db.query(
    `select has_function_privilege('authenticated', $1, 'execute') as ok`,
    [fn],
  );
  check(`authenticated may execute ${fn.replace("public.", "")}`, rows[0].ok);
}

for (const fn of ANON_FORBIDDEN_RPCS) {
  const { rows } = await db.query(
    `select has_function_privilege('anon', $1, 'execute') as ok`,
    [fn],
  );
  check(`anon may NOT execute ${fn.replace("public.", "")}`, rows[0].ok === false);
}

const { rows: previewRows } = await db.query(
  `select has_function_privilege('anon', 'public.preview_invitation(text)', 'execute') as ok`,
);
check("anon may execute preview_invitation (pre-sign-in invite preview)", previewRows[0].ok);

// Trigger + helper functions must not be callable by anonymous callers.
const { rows: triggerRows } = await db.query(
  `select has_function_privilege('anon', 'public.set_member_role(uuid, uuid, text)', 'execute') as ok`,
);
check("anon cannot escalate roles via set_member_role", triggerRows[0].ok === false);

// The calendar's helper resolves an event to its family; it must not be a
// general-purpose RPC for anonymous callers.
const { rows: eventHelperRows } = await db.query(
  `select has_function_privilege('anon', 'public.event_family_id(uuid)', 'execute') as ok`,
);
check("anon cannot execute the event helper", eventHelperRows[0].ok === false);

// The Ludo engine's internals (RNG, geometry, jsonb state readers) must stay
// private — only the seven RPCs above are the callable surface.
const { rows: ludoHelperRows } = await db.query(
  `select p.proname,
          has_function_privilege('anon', p.oid::regprocedure::text, 'execute') as anon_ok,
          has_function_privilege('authenticated', p.oid::regprocedure::text, 'execute') as auth_ok
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'ludo\\_%'
      and p.proname not in ('ludo_create_game', 'ludo_join_game', 'ludo_start_game',
                             'ludo_roll', 'ludo_move', 'ludo_pass', 'ludo_auto_resolve',
                             'ludo_snapshot', 'ludo_game_family_id')
      and (has_function_privilege('anon', p.oid::regprocedure::text, 'execute')
        or has_function_privilege('authenticated', p.oid::regprocedure::text, 'execute'))`,
);
check(
  "ludo internals are not callable by API roles",
  ludoHelperRows.length === 0,
  ludoHelperRows.map((r) => r.proname).join(", "),
);

const { rows: ludoFamHelper } = await db.query(
  `select has_function_privilege('anon', 'public.ludo_game_family_id(uuid)', 'execute') as ok`,
);
check("anon cannot execute the ludo game helper", ludoFamHelper[0].ok === false);

// ---------------------------------------------------------------------------
// Behaviour: exercise the policies and RPCs as the real anon/authenticated
// roles (with a JWT `sub` claim), which is the only way to prove that the
// security model actually holds rather than merely compiling.
// ---------------------------------------------------------------------------
console.log("\nBehaviour (as anon / authenticated)");

// Supabase grants table privileges to the API roles and relies on RLS to filter
// rows; mirror that here (equivalent to its default privileges).
await db.exec(`
  grant usage on schema public to anon, authenticated, service_role;
  grant usage on schema storage to anon, authenticated, service_role;
  grant all on all tables in schema public to anon, authenticated, service_role;
  grant all on all sequences in schema public to anon, authenticated, service_role;
  grant all on storage.objects, storage.buckets to anon, authenticated, service_role;
`);

async function asRole(role, uid, fn) {
  await db.exec(`set role ${role}`);
  const { rows: who } = await db.query("select current_user as u");
  if (who[0].u !== role) {
    throw new Error(`could not assume role ${role} (current_user is ${who[0].u})`);
  }
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid ?? ""]);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}

async function expectError(message, sql, params) {
  try {
    await db.query(sql, params);
    check(message, false, "expected an error but the statement succeeded");
    return null;
  } catch (error) {
    check(message, true);
    return error.message;
  }
}

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const D = "44444444-4444-4444-8444-444444444444";
const FAM_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FAM_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

// Fixtures are created as the owner (superuser), like Supabase's dashboard/SQL
// editor would.
await db.query(
  `insert into auth.users (id, email, raw_user_meta_data) values
     ($1, 'ayesha@example.com', '{"full_name":"Ayesha Rahman"}'::jsonb),
     ($2, 'bilal@example.com',  '{"name":"Bilal Khan"}'::jsonb),
     ($3, 'chloe@example.com',  '{}'::jsonb),
     ($4, 'danish@example.com', '{}'::jsonb)`,
  [A, B, C, D],
);

// Trigger: profiles are auto-created on signup with a sensible full_name.
const profiles = await db.query(
  "select id, full_name from public.profiles order by full_name",
);
check("auth.users insert auto-creates 4 profiles", profiles.rows.length === 4, `found ${profiles.rows.length}`);
const ayesha = profiles.rows.find((r) => r.id === A);
check("full_name falls back to metadata `full_name`", ayesha?.full_name === "Ayesha Rahman", ayesha?.full_name);
const bilal = profiles.rows.find((r) => r.id === B);
check("full_name falls back to metadata `name`", bilal?.full_name === "Bilal Khan", bilal?.full_name);
const chloeName = profiles.rows.find((r) => r.id === C)?.full_name;
check("full_name falls back to the email local part", chloeName === "chloe", chloeName);

await db.query(
  `insert into public.families (id, name, created_by, require_approval) values
     ($1, 'Rahman Family', $2, true),
     ($3, 'Khan Family', $4, false)`,
  [FAM_A, A, FAM_B, B],
);
await db.query(
  `insert into public.family_members (family_id, user_id, role, status) values
     ($1, $2, 'owner', 'active'),
     ($1, $3, 'member', 'active'),
     ($4, $5, 'owner', 'active')`,
  [FAM_A, A, C, FAM_B, B],
);
const postA = "a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1";
const postB = "b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1";
await db.query(
  `insert into public.posts (id, family_id, author_id, content) values
     ($1, $2, $3, 'Sunset at the lake'),
     ($4, $5, $6, 'Khan family reunion')`,
  [postA, FAM_A, A, postB, FAM_B, B],
);

// RLS: families are isolated.
const aPosts = await asRole("authenticated", A, () =>
  db.query("select count(*)::int as n from public.posts"),
);
check("member A sees only their own family's posts", aPosts.rows[0].n === 1, `saw ${aPosts.rows[0].n}`);
const bPosts = await asRole("authenticated", B, () =>
  db.query("select count(*)::int as n from public.posts"),
);
check("member B sees only their own family's posts", bPosts.rows[0].n === 1, `saw ${bPosts.rows[0].n}`);
const anonPosts = await asRole("anon", null, () =>
  db.query("select count(*)::int as n from public.posts"),
);
check("signed-out callers see no posts", anonPosts.rows[0].n === 0, `saw ${anonPosts.rows[0].n}`);
const anonFamilies = await asRole("anon", null, () =>
  db.query("select count(*)::int as n from public.families"),
);
check("signed-out callers see no families", anonFamilies.rows[0].n === 0, `saw ${anonFamilies.rows[0].n}`);

// RLS: writes are rejected across families. These must run AS the member —
// the table owner bypasses RLS, so an unwrapped query would silently pass.
await asRole("authenticated", A, () =>
  expectError(
    "A cannot insert a post into another family",
    "insert into public.posts (family_id, author_id, content) values ($1, $2, 'intrusion')",
    [FAM_B, A],
  ),
);

const hijack = await asRole("authenticated", A, () =>
  db.query("update public.families set name = 'hijacked' where id = $1", [FAM_B]),
);
check(
  "A cannot change another family's row",
  hijack.affectedRows === 0,
  `${hijack.affectedRows} row(s) updated`,
);
const famBRow = await db.query("select name from public.families where id = $1", [FAM_B]);
check("the other family's name is unchanged", famBRow.rows[0].name === "Khan Family", famBRow.rows[0].name);

// RPC-level authorization (defence in depth beyond the grant surface).
await asRole("authenticated", A, () =>
  expectError(
    "A cannot set member status in another family",
    "select public.set_member_status($1, $2, 'active')",
    [FAM_B, B],
  ),
);
await asRole("authenticated", A, () =>
  expectError(
    "A cannot start a conversation in another family",
    "select public.create_direct_conversation($1, $2)",
    [FAM_B, B],
  ),
);

// RPC happy path: direct conversation + idempotency.
const conv = await asRole("authenticated", A, () =>
  db.query("select public.create_direct_conversation($1, $2) as r", [FAM_A, C]),
);
const convId = conv.rows[0].r.conversation_id;
check("create_direct_conversation creates a conversation", conv.rows[0].r.created === true);
const convAgain = await asRole("authenticated", A, () =>
  db.query("select public.create_direct_conversation($1, $2) as r", [FAM_A, C]),
);
check("create_direct_conversation is idempotent", convAgain.rows[0].r.created === false && convAgain.rows[0].r.conversation_id === convId);
const convMembers = await db.query(
  "select count(*)::int as n from public.conversation_members where conversation_id = $1",
  [convId],
);
check("direct conversation has exactly two members", convMembers.rows[0].n === 2, `found ${convMembers.rows[0].n}`);

// Invitations: created by an owner, previewed signed-out, joined pending,
// approved by an owner, then usable.
const invite = await asRole("authenticated", A, () =>
  db.query("select public.create_invitation($1) as code", [FAM_A]),
);
const code = invite.rows[0].code;
check("owner can mint an invite code", typeof code === "string" && /^[A-Z0-9]{8,12}$/.test(code), code);

const preview = await asRole("anon", null, () =>
  db.query("select public.preview_invitation($1) as r", [code]),
);
check("signed-out preview returns the family name", preview.rows[0].r.family_name === "Rahman Family", JSON.stringify(preview.rows[0].r));
check("signed-out preview leaks no post content", !("content" in preview.rows[0].r) && !("posts" in preview.rows[0].r));

const joinResult = await asRole("authenticated", D, () =>
  db.query("select public.join_family_by_code($1) as r", [code]),
);
check("joining a require_approval family lands in `pending`", joinResult.rows[0].r.status === "pending", JSON.stringify(joinResult.rows[0].r));
const pendingSees = await asRole("authenticated", D, () =>
  db.query("select count(*)::int as n from public.posts"),
);
check("a pending member cannot read family posts", pendingSees.rows[0].n === 0, `saw ${pendingSees.rows[0].n}`);
const pendingNotifs = await db.query(
  "select count(*)::int as n from public.notifications where user_id = $1 and type = 'member_pending'",
  [A],
);
check("join request notifies the family owner", pendingNotifs.rows[0].n === 1, `found ${pendingNotifs.rows[0].n}`);

await asRole("authenticated", A, () =>
  db.query("select public.set_member_status($1, $2, 'active')", [FAM_A, D]),
);
const approvedSees = await asRole("authenticated", D, () =>
  db.query("select count(*)::int as n from public.posts"),
);
check("approving a member grants read access", approvedSees.rows[0].n === 1, `saw ${approvedSees.rows[0].n}`);

// Comments notify the post author (trigger, not client).
await asRole("authenticated", C, () =>
  db.query("insert into public.comments (post_id, author_id, content) values ($1, $2, 'Lovely photo!')", [postA, C]),
);
const commentNotifs = await db.query(
  "select count(*)::int as n from public.notifications where user_id = $1 and type = 'comment'",
  [A],
);
check("commenting notifies the post author", commentNotifs.rows[0].n === 1, `found ${commentNotifs.rows[0].n}`);

// Realtime/chat: triggers keep conversations.last_message_at fresh.
await db.query(
  "update public.conversation_members set last_read_at = now() - interval '10 minutes' where conversation_id = $1 and user_id = $2",
  [convId, C],
);
await asRole("authenticated", A, () =>
  db.query("insert into public.messages (conversation_id, sender_id, content) values ($1, $2, 'Hello!')", [convId, A]),
);
const bumped = await db.query("select last_message_at from public.conversations where id = $1", [convId]);
check("sending a message bumps conversations.last_message_at", bumped.rows[0].last_message_at !== null);
const dmNotifs = await db.query(
  "select count(*)::int as n from public.notifications where user_id = $1 and type = 'message'",
  [C],
);
check("a direct message notifies the other member", dmNotifs.rows[0].n === 1, `found ${dmNotifs.rows[0].n}`);

// Storage: the first path segment is the authorization key.
const okUpload = await asRole("authenticated", A, () =>
  db.query("insert into storage.objects (bucket_id, name) values ('post-media', $1) returning id", [
    `${FAM_A}/album/photo.jpg`,
  ]),
);
check("A can upload under their own family folder", okUpload.rows.length === 1);
await asRole("authenticated", A, () =>
  expectError(
    "A cannot upload under another family's folder",
    "insert into storage.objects (bucket_id, name) values ('post-media', $1)",
    [`${FAM_B}/album/photo.jpg`],
  ),
);
const okAvatar = await asRole("authenticated", A, () =>
  db.query("insert into storage.objects (bucket_id, name) values ('avatars', $1) returning id", [`${A}/me.jpg`]),
);
check("A can upload their own avatar", okAvatar.rows.length === 1);
await asRole("authenticated", A, () =>
  expectError(
    "A cannot write at another user's avatar path",
    "insert into storage.objects (bucket_id, name) values ('avatars', $1)",
    [`${B}/me.jpg`],
  ),
);
await asRole("authenticated", B, () =>
  expectError(
    "B cannot write into another family's media folder",
    "insert into storage.objects (bucket_id, name) values ('post-media', $1)",
    [`${FAM_A}/album/sneaky.jpg`],
  ),
);

// Calendar: events are family-scoped, RSVPs are self-service, and creating an
// event notifies the other active members.
const eventId = "e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1";
await asRole("authenticated", A, () =>
  db.query(
    `insert into public.family_events (id, family_id, created_by, title, starts_at, location)
     values ($1, $2, $3, 'Eid lunch', now() + interval '3 days', 'Grandma''s house')`,
    [eventId, FAM_A, A],
  ),
);
const eventNotifs = await db.query(
  "select count(*)::int as n from public.notifications where type = 'event' and entity_id = $1",
  [eventId],
);
// Active members of FAM_A other than the creator: C and D (D approved above).
check("creating an event notifies the other active members", eventNotifs.rows[0].n === 2, `found ${eventNotifs.rows[0].n}`);

const bSeesEvents = await asRole("authenticated", B, () =>
  db.query("select count(*)::int as n from public.family_events"),
);
check("another family sees no events", bSeesEvents.rows[0].n === 0, `saw ${bSeesEvents.rows[0].n}`);
await asRole("authenticated", B, () =>
  expectError(
    "B cannot add an event to another family",
    "insert into public.family_events (family_id, created_by, title, starts_at) values ($1, $2, 'Intruder', now())",
    [FAM_A, B],
  ),
);

const rsvp = await asRole("authenticated", C, () =>
  db.query("insert into public.event_rsvps (event_id, user_id, response) values ($1, $2, 'going') returning response", [
    eventId,
    C,
  ]),
);
check("a member can RSVP going", rsvp.rows[0].response === "going");
const rsvpNotifs = await db.query(
  "select count(*)::int as n from public.notifications where type = 'event' and user_id = $1 and dedupe_key = $2",
  [A, `event_rsvp:${eventId}:${C}`],
);
check("a going RSVP notifies the organiser", rsvpNotifs.rows[0].n === 1, `found ${rsvpNotifs.rows[0].n}`);
const rsvpUpdate = await asRole("authenticated", C, () =>
  db.query("update public.event_rsvps set response = 'declined' where event_id = $1 and user_id = $2 returning response", [
    eventId,
    C,
  ]),
);
check("a member can change their own RSVP", rsvpUpdate.rows[0].response === "declined");
const rsvpNotifsAfter = await db.query(
  "select count(*)::int as n from public.notifications where dedupe_key = $1",
  [`event_rsvp:${eventId}:${C}`],
);
check("declining withdraws the organiser's notification", rsvpNotifsAfter.rows[0].n === 0, `found ${rsvpNotifsAfter.rows[0].n}`);
await asRole("authenticated", C, () =>
  expectError(
    "a member cannot answer on someone else's behalf",
    "insert into public.event_rsvps (event_id, user_id, response) values ($1, $2, 'going')",
    [eventId, D],
  ),
);
await asRole("authenticated", B, () =>
  expectError(
    "a non-member cannot RSVP to another family's event",
    "insert into public.event_rsvps (event_id, user_id, response) values ($1, $2, 'going')",
    [eventId, B],
  ),
);

// The calendar helper must resolve the family, not leak across families.
const helperAsC = await asRole("authenticated", C, () =>
  db.query("select public.event_family_id($1) as family_id", [eventId]),
);
check("event_family_id resolves the owning family", helperAsC.rows[0].family_id === FAM_A, helperAsC.rows[0].family_id);

// Deleting an event must not leave dangling notifications or RSVPs behind.
const eventNotifsBefore = await db.query(
  "select count(*)::int as n from public.notifications where entity_type = 'event' and entity_id = $1",
  [eventId],
);
await asRole("authenticated", A, () =>
  db.query("delete from public.family_events where id = $1", [eventId]),
);
const eventNotifsAfter = await db.query(
  "select count(*)::int as n from public.notifications where entity_type = 'event' and entity_id = $1",
  [eventId],
);
check(
  "deleting an event clears every notification it generated",
  eventNotifsBefore.rows[0].n > 0 && eventNotifsAfter.rows[0].n === 0,
  `before=${eventNotifsBefore.rows[0].n} after=${eventNotifsAfter.rows[0].n}`,
);
const rsvpsAfterDelete = await db.query(
  "select count(*)::int as n from public.event_rsvps where event_id = $1",
  [eventId],
);
check("deleting an event cascades its RSVPs", rsvpsAfterDelete.rows[0].n === 0, `found ${rsvpsAfterDelete.rows[0].n}`);

// --- Ludo engine -------------------------------------------------------------
// The acceptance criteria in docs/ludo-rules.md §15, exercised end to end
// against the real security-definer RPCs as the actual player roles.
console.log("\nLudo engine (server-authoritative board)");

/** PGlite hands back jsonb either parsed or as text — normalise both. */
const j = (v) => (typeof v === "string" ? JSON.parse(v) : v);

await db.query("select set_config('ocf.test_mode', 'on', false)");

const ludoGame = await asRole("authenticated", A, () =>
  db.query("select public.ludo_create_game($1, 4, 60) as id", [FAM_A]),
);
const ludoId = ludoGame.rows[0].id;
check("a member creates a 4-seat game", !!ludoId, ludoId);

check(
  "C takes seat 1",
  (await asRole("authenticated", C, () =>
    db.query("select public.ludo_join_game($1) as seat", [ludoId]),
  )).rows[0].seat === 1,
);
check(
  "D takes seat 2",
  (await asRole("authenticated", D, () =>
    db.query("select public.ludo_join_game($1) as seat", [ludoId]),
  )).rows[0].seat === 2,
);

await asRole("authenticated", C, () =>
  expectError("only the host may start the game", "select public.ludo_start_game($1)", [ludoId]),
);
await asRole("authenticated", B, () =>
  expectError("a non-member cannot join the game", "select public.ludo_join_game($1)", [ludoId]),
);

let snap = j(
  (await asRole("authenticated", A, () =>
    db.query("select public.ludo_start_game($1) as s", [ludoId]),
  )).rows[0].s,
);
check(
  "the host starts the game with the lowest seat to move",
  snap.status === "playing" && snap.turnSeat === 0 && snap.phase === "awaiting_roll",
  JSON.stringify({ status: snap.status, turn: snap.turnSeat, phase: snap.phase }),
);
check(
  "every token starts in the yard",
  snap.state.tokens.length === 3 &&
    snap.state.tokens.every((t) => JSON.stringify(t.progress) === "[-1,-1,-1,-1]"),
  JSON.stringify(snap.state.tokens),
);

// The forced-dice escape hatch only exists for this harness.
await db.query("select set_config('ocf.test_mode', 'off', false)");
const forcedRefusal = await asRole("authenticated", A, () =>
  expectError("a forced roll is refused outside the harness",
    "select public.ludo_roll($1, $2, 6)", [ludoId, snap.version]),
);
check(
  "the refusal names forced_dice_not_allowed",
  String(forcedRefusal).includes("forced_dice_not_allowed"),
  String(forcedRefusal),
);
await db.query("select set_config('ocf.test_mode', 'on', false)");

// Rules §5 — a 1 cannot open the yard, so the turn is handed over.
let r = j(
  (await asRole("authenticated", A, () =>
    db.query("select public.ludo_roll($1, $2, 1) as s", [ludoId, snap.version]),
  )).rows[0].s,
);
check(
  "a roll with no legal move hands the turn over",
  r.turnSeat === 1 && r.phase === "awaiting_roll",
  `turn=${r.turnSeat} phase=${r.phase}`,
);
snap = r;

// Rules §5 — a 6 opens the yard and buys another roll.
r = j(
  (await asRole("authenticated", C, () =>
    db.query("select public.ludo_roll($1, $2, 6) as s", [ludoId, snap.version]),
  )).rows[0].s,
);
check(
  "a six opens a yard exit for every token",
  r.phase === "awaiting_move" && JSON.stringify(r.legalMoves) === "[0,1,2,3]",
  `${r.phase} ${JSON.stringify(r.legalMoves)}`,
);
check("consecutive sixes are counted", r.consecutiveSixes === 1, r.consecutiveSixes);
snap = r;

r = j(
  (await asRole("authenticated", C, () =>
    db.query("select public.ludo_move($1, 0, $2) as s", [ludoId, snap.version]),
  )).rows[0].s,
);
check(
  "leaving the yard lands on the start square",
  r.state.tokens[1].progress[0] === 0,
  JSON.stringify(r.state.tokens[1].progress),
);
check(
  "a six grants another roll",
  r.turnSeat === 1 && r.phase === "awaiting_roll",
  `turn=${r.turnSeat} phase=${r.phase}`,
);
snap = r;

r = j(
  (await asRole("authenticated", C, () =>
    db.query("select public.ludo_roll($1, $2, 6) as s", [ludoId, snap.version]),
  )).rows[0].s,
);
check(
  "the second six keeps the turn",
  r.turnSeat === 1 && r.phase === "awaiting_move" && r.consecutiveSixes === 2,
  `turn=${r.turnSeat} cs=${r.consecutiveSixes}`,
);
snap = r;
r = j(
  (await asRole("authenticated", C, () =>
    db.query("select public.ludo_move($1, 0, $2) as s", [ludoId, snap.version]),
  )).rows[0].s,
);
check("the second six's move lands", r.state.tokens[1].progress[0] === 6,
  JSON.stringify(r.state.tokens[1].progress));
snap = r;

// Rules §5 — three consecutive sixes forfeit the turn.
r = j(
  (await asRole("authenticated", C, () =>
    db.query("select public.ludo_roll($1, $2, 6) as s", [ludoId, snap.version]),
  )).rows[0].s,
);
check(
  "three consecutive sixes forfeit the turn",
  r.turnSeat === 2 && r.phase === "awaiting_roll" && r.dice === null && r.consecutiveSixes === 0,
  `turn=${r.turnSeat} dice=${r.dice} cs=${r.consecutiveSixes}`,
);
snap = r;

// Rules §6 — an overshoot is never a legal move (D's token is one from home).
await db.query(
  "update public.ludo_games set state = jsonb_set(state, '{tokens,2,progress,0}', '56'::jsonb) where id = $1",
  [ludoId],
);
r = j(
  (await asRole("authenticated", D, () =>
    db.query("select public.ludo_roll($1, $2, 6) as s", [ludoId, snap.version]),
  )).rows[0].s,
);
check(
  "overshooting home is never offered",
  JSON.stringify(r.legalMoves) === "[1,2,3]",
  JSON.stringify(r.legalMoves),
);
snap = r;
r = j(
  (await asRole("authenticated", D, () =>
    db.query("select public.ludo_move($1, 1, $2) as s", [ludoId, snap.version]),
  )).rows[0].s,
);
check(
  "the yard exit is taken from the offered set",
  r.state.tokens[2].progress[1] === 0,
  JSON.stringify(r.state.tokens[2].progress),
);
snap = r;

r = j(
  (await asRole("authenticated", D, () =>
    db.query("select public.ludo_roll($1, $2, 1) as s", [ludoId, snap.version]),
  )).rows[0].s,
);
check("an exact roll is offered for the final step", r.legalMoves.includes(0),
  JSON.stringify(r.legalMoves));
snap = r;
r = j(
  (await asRole("authenticated", D, () =>
    db.query("select public.ludo_move($1, 0, $2) as s", [ludoId, snap.version]),
  )).rows[0].s,
);
check("an exact roll retires the token", r.state.tokens[2].progress[0] === 57,
  JSON.stringify(r.state.tokens[2].progress));
check("a plain move passes the turn", r.turnSeat !== 2 && r.phase === "awaiting_roll",
  `turn=${r.turnSeat}`);
snap = r;

// Rules §7.1 — landing on a lone opponent on an unsafe square captures it.
await db.query(
  `update public.ludo_games
      set state = jsonb_set(jsonb_set(state, '{tokens,0,progress}', '[5,-1,-1,-1]'::jsonb),
                            '{tokens,1,progress}', '[6,46,-1,-1]'::jsonb)
    where id = $1`,
  [ludoId],
);
r = j(
  (await asRole("authenticated", A, () =>
    db.query("select public.ludo_roll($1, $2, 2) as s", [ludoId, snap.version]),
  )).rows[0].s,
);
check("only the advancing token is offered", JSON.stringify(r.legalMoves) === "[0]",
  JSON.stringify(r.legalMoves));
snap = r;
r = j(
  (await asRole("authenticated", A, () =>
    db.query("select public.ludo_move($1, 0, $2) as s", [ludoId, snap.version]),
  )).rows[0].s,
);
check(
  "capturing sends the opponent back to the yard",
  r.state.tokens[1].progress[1] === -1,
  JSON.stringify(r.state.tokens[1].progress),
);
check(
  "a capture grants another roll",
  r.turnSeat === 0 && r.phase === "awaiting_roll",
  `turn=${r.turnSeat} phase=${r.phase}`,
);
snap = r;

// Authorization: only the seat on turn, only family members, only fresh state.
await asRole("authenticated", C, () =>
  expectError("only the seat on turn may roll",
    "select public.ludo_roll($1, $2, 6)", [ludoId, snap.version]),
);
await asRole("authenticated", B, () =>
  expectError("a non-member cannot play",
    "select public.ludo_roll($1, $2, 1)", [ludoId, snap.version]),
);

// Rules §7.1 — a safe square protects whichever colour stands on it.
await db.query(
  "update public.ludo_games set state = jsonb_set(state, '{tokens,1,progress}', '[0,-1,-1,-1]'::jsonb) where id = $1",
  [ludoId],
);
r = j(
  (await asRole("authenticated", A, () =>
    db.query("select public.ludo_roll($1, $2, 6) as s", [ludoId, snap.version]),
  )).rows[0].s,
);
check(
  "a six opens every yard token",
  JSON.stringify(r.legalMoves) === "[0,1,2,3]",
  JSON.stringify(r.legalMoves),
);
snap = r;
r = j(
  (await asRole("authenticated", A, () =>
    db.query("select public.ludo_move($1, 0, $2) as s", [ludoId, snap.version]),
  )).rows[0].s,
);
check(
  "a safe square protects the standing token",
  r.state.tokens[0].progress[0] === 13 && r.state.tokens[1].progress[0] === 0,
  JSON.stringify(r.state.tokens),
);
check(
  "a six still grants another roll after a quiet move",
  r.turnSeat === 0 && r.phase === "awaiting_roll",
  `turn=${r.turnSeat}`,
);
snap = r;

// Rules §7.2 — an opponent's pair blocks both landing and passage.
await db.query(
  `update public.ludo_games
      set state = jsonb_set(jsonb_set(state, '{tokens,0,progress}', '[15,-1,-1,-1]'::jsonb),
                            '{tokens,1,progress}', '[6,6,5,-1]'::jsonb)
    where id = $1`,
  [ludoId],
);
r = j(
  (await asRole("authenticated", A, () =>
    db.query("select public.ludo_roll($1, $2, 6) as s", [ludoId, snap.version]),
  )).rows[0].s,
);
check(
  "an opponent's block refuses landing and passage",
  JSON.stringify(r.legalMoves) === "[1,2,3]",
  JSON.stringify(r.legalMoves),
);
snap = r;

await asRole("authenticated", A, () =>
  expectError("optimistic concurrency rejects a stale move",
    "select public.ludo_move($1, 0, $2)", [ludoId, snap.version + 100]),
);

r = j(
  (await asRole("authenticated", A, () =>
    db.query("select public.ludo_move($1, 1, $2) as s", [ludoId, snap.version]),
  )).rows[0].s,
);
snap = r;
r = j(
  (await asRole("authenticated", A, () =>
    db.query("select public.ludo_roll($1, $2, 1) as s", [ludoId, snap.version]),
  )).rows[0].s,
);
snap = r;
r = j(
  (await asRole("authenticated", A, () =>
    db.query("select public.ludo_move($1, 1, $2) as s", [ludoId, snap.version]),
  )).rows[0].s,
);
check("turn order wraps to the next seat", r.turnSeat === 1 && r.phase === "awaiting_roll",
  `turn=${r.turnSeat}`);
snap = r;

// Rules §7.2 — your own colour never blocks you.
r = j(
  (await asRole("authenticated", C, () =>
    db.query("select public.ludo_roll($1, $2, 1) as s", [ludoId, snap.version]),
  )).rows[0].s,
);
check("your own colour never blocks you", r.legalMoves.includes(2),
  JSON.stringify(r.legalMoves));
snap = r;
r = j(
  (await asRole("authenticated", C, () =>
    db.query("select public.ludo_move($1, 2, $2) as s", [ludoId, snap.version]),
  )).rows[0].s,
);
check("stacking on your own colour is legal", r.state.tokens[1].progress[2] === 6,
  JSON.stringify(r.state.tokens[1].progress));
snap = r;
check("the turn moves on to D", r.turnSeat === 2, `turn=${r.turnSeat}`);

// Rules §9 — play on for placement, then stop with one player left.
await db.query(
  "update public.ludo_games set state = jsonb_set(state, '{tokens,2,progress}', '[56,57,57,57]'::jsonb) where id = $1",
  [ludoId],
);
r = j(
  (await asRole("authenticated", D, () =>
    db.query("select public.ludo_roll($1, $2, 1) as s", [ludoId, snap.version]),
  )).rows[0].s,
);
snap = r;
r = j(
  (await asRole("authenticated", D, () =>
    db.query("select public.ludo_move($1, 0, $2) as s", [ludoId, snap.version]),
  )).rows[0].s,
);
snap = r;
const seatsAfterFirstWin = await db.query(
  "select seat, placement from public.ludo_seats where game_id = $1 order by seat",
  [ludoId],
);
const placementOf = (seat) =>
  seatsAfterFirstWin.rows.find((x) => x.seat === seat)?.placement ?? null;
check("the first player out takes first place", placementOf(2) === 1, `seat2=${placementOf(2)}`);
check("the game continues for the rest", snap.status === "playing" && snap.turnSeat === 0,
  `status=${snap.status} turn=${snap.turnSeat}`);

await db.query(
  "update public.ludo_games set state = jsonb_set(state, '{tokens,0,progress}', '[56,57,57,57]'::jsonb) where id = $1",
  [ludoId],
);
r = j(
  (await asRole("authenticated", A, () =>
    db.query("select public.ludo_roll($1, $2, 1) as s", [ludoId, snap.version]),
  )).rows[0].s,
);
snap = r;
r = j(
  (await asRole("authenticated", A, () =>
    db.query("select public.ludo_move($1, 0, $2) as s", [ludoId, snap.version]),
  )).rows[0].s,
);
snap = r;
check(
  "the first player to finish wins the game",
  snap.status === "finished" && snap.winnerSeat === 2,
  `status=${snap.status} winner=${snap.winnerSeat}`,
);
const seatsFinal = await db.query(
  "select seat, placement from public.ludo_seats where game_id = $1 order by seat",
  [ludoId],
);
const finalPlacement = (seat) =>
  seatsFinal.rows.find((x) => x.seat === seat)?.placement ?? null;
check("every player is ranked", finalPlacement(2) === 1 && finalPlacement(0) === 2 && finalPlacement(1) === 3,
  seatsFinal.rows.map((x) => `${x.seat}=${x.placement}`).join(","));
await asRole("authenticated", C, () =>
  expectError("a finished game accepts no further rolls",
    "select public.ludo_roll($1, $2, 6)", [ludoId, snap.version]),
);

// Rules §10 — an overdue turn resolves itself, deterministically.
const ludo2 = (
  await asRole("authenticated", A, () =>
    db.query("select public.ludo_create_game($1, 4, 60) as id", [FAM_A]),
  )
).rows[0].id;
await asRole("authenticated", C, () =>
  db.query("select public.ludo_join_game($1) as seat", [ludo2]),
);
const ludo2Start = j(
  (await asRole("authenticated", A, () =>
    db.query("select public.ludo_start_game($1) as s", [ludo2]),
  )).rows[0].s,
);
check("a second game starts with two players",
  ludo2Start.status === "playing" && ludo2Start.state.tokens.length === 2,
  JSON.stringify({ status: ludo2Start.status, players: ludo2Start.state.tokens.length }));

await db.query(
  `update public.ludo_games
      set phase = 'awaiting_move', dice = 1,
          turn_deadline = now() - interval '1 second',
          state = jsonb_set(state, '{tokens,0,progress}', '[5,-1,-1,-1]'::jsonb)
    where id = $1`,
  [ludo2],
);
const autoSnap = j(
  (await asRole("authenticated", C, () =>
    db.query("select public.ludo_auto_resolve($1) as s", [ludo2]),
  )).rows[0].s,
);
check(
  "an overdue turn is resolved automatically",
  autoSnap.state.tokens[0].progress[0] === 6,
  JSON.stringify(autoSnap.state.tokens[0].progress),
);
check(
  "auto-play hands the turn on afterwards",
  autoSnap.turnSeat === 1 && autoSnap.phase === "awaiting_roll",
  `turn=${autoSnap.turnSeat} phase=${autoSnap.phase}`,
);

// An authenticated caller outside the family sees nothing.
const ludoScope = await asRole("authenticated", B, () =>
  db.query(
    `select
       (select count(*)::int from public.ludo_games) as games,
       (select count(*)::int from public.ludo_seats) as seats,
       (select count(*)::int from public.ludo_actions) as actions`,
  ),
);
check(
  "another family cannot see the board, seats or audit trail",
  ludoScope.rows[0].games === 0 && ludoScope.rows[0].seats === 0 && ludoScope.rows[0].actions === 0,
  JSON.stringify(ludoScope.rows[0]),
);
await asRole("anon", null, () =>
  expectError("anonymous callers cannot create games",
    "select public.ludo_create_game($1, 4, 60)", [FAM_A]),
);

// Read path: the snapshot is the only way the app learns which moves are legal,
// so it must be exactly as scoped as the table's SELECT policy.
const snapshotForA = await asRole("authenticated", A, () =>
  db.query("select public.ludo_snapshot($1) as s", [ludoId]),
);
check(
  "a family member can read the game snapshot",
  j(snapshotForA.rows[0].s).status === "finished" &&
    Array.isArray(j(snapshotForA.rows[0].s).legalMoves),
  String(j(snapshotForA.rows[0].s).status),
);
await asRole("authenticated", B, () =>
  expectError("a non-member cannot read the snapshot",
    "select public.ludo_snapshot($1)", [ludoId]),
);

// --- Report ------------------------------------------------------------------
console.log("");
if (notes.length > 0) {
  console.log("Notes:");
  for (const note of notes) console.log(`  • ${note}`);
  console.log("");
}

if (failures.length > 0) {
  console.error(`FAILED — ${failures.length} check(s):`);
  for (const failure of failures) console.error(`  • ${failure}`);
  process.exit(1);
}

console.log("All migration checks passed.");
await db.close();

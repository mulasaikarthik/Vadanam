/* Data-access layer for Supabase (connected mode only).
   Every query matches the verified live schema:
   profiles, user_prefs, teams, team_members, team_timers, invitations,
   messages, attachments, message_reactions, team_reads,
   dm_conversations, dm_messages, milestones, tasks, mentor_messages.
   RLS is always in force — we only use the publishable key. */
import { supabase as sb } from "./supabase";
import type {
  Team, Member, Message, Task, Milestone, TimerState, State, DmMessage, Attachment, MentorMsg,
} from "./store";

/* ---------------- auth ---------------- */
export const authSignUp = (name: string, email: string, password: string) =>
  sb.auth.signUp({ email, password, options: { data: { full_name: name } } });

export const authSignIn = (email: string, password: string) =>
  sb.auth.signInWithPassword({ email, password });

export const authSignOut = () => sb.auth.signOut();

export const authResetPassword = (email: string) =>
  sb.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname,
  });

export const authUpdatePassword = (password: string) =>
  sb.auth.updateUser({ password });

/* ---------------- mapping helpers ---------------- */
const roleUp = (r: string): Member["role"] =>
  r === "owner" ? "Owner" : r === "admin" ? "Admin" : "Member";
const roleDown = (r: Member["role"]) => r.toLowerCase();

type ProfileRow = {
  id: string; full_name: string; email: string; avatar_url: string | null;
  color: string; skill_tags: string[];
};

/* ---------------- profile & prefs ---------------- */
export async function fetchProfile(uid: string) {
  const { data, error } = await sb.from("profiles")
    .select("id, full_name, email, avatar_url, color, skill_tags")
    .eq("id", uid).single();
  if (error) throw error;
  const p = data as ProfileRow;
  return {
    id: p.id, name: p.full_name || p.email.split("@")[0] || "You",
    email: p.email, color: p.color || "#22d3ee",
    avatarUrl: p.avatar_url ?? undefined, skills: p.skill_tags ?? [],
  };
}

export async function saveProfile(uid: string, patch: { name?: string; skills?: string[] }) {
  const upd: Record<string, unknown> = {};
  if (patch.name !== undefined) upd.full_name = patch.name;
  if (patch.skills !== undefined) upd.skill_tags = patch.skills;
  const { error } = await sb.from("profiles").update(upd).eq("id", uid);
  if (error) throw error;
}

export async function uploadAvatar(uid: string, file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${uid}/avatar-${Date.now()}.${ext}`;
  const { error } = await sb.storage.from("avatars").upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = sb.storage.from("avatars").getPublicUrl(path);
  const url = data.publicUrl;
  const { error: e2 } = await sb.from("profiles").update({ avatar_url: url }).eq("id", uid);
  if (e2) throw e2;
  return url;
}

export async function fetchPrefs(uid: string) {
  const { data, error } = await sb.from("user_prefs")
    .select("theme, sound, notifications, mentions, email_digest").eq("user_id", uid).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    theme: (data.theme === "light" ? "light" : "dark") as State["theme"],
    prefs: {
      sound: data.sound, notifications: data.notifications,
      mentions: data.mentions, emailDigest: data.email_digest,
    },
  };
}

export async function savePrefs(uid: string, theme: State["theme"], prefs: State["prefs"]) {
  const { error } = await sb.from("user_prefs").upsert({
    user_id: uid, theme,
    sound: prefs.sound, notifications: prefs.notifications,
    mentions: prefs.mentions, email_digest: prefs.emailDigest,
  });
  if (error) throw error;
}

/* ---------------- teams ---------------- */
type TeamRow = {
  id: string; name: string; description: string; hackathon: string;
  problem_statement: string; emoji: string; color: string; capacity: number;
  created_at: string;
  team_members: { user_id: string; role: string; profiles: ProfileRow | null }[];
};

export async function fetchTeams(myId: string): Promise<Team[]> {
  const { data, error } = await sb.from("teams")
    .select("id, name, description, hackathon, problem_statement, emoji, color, logo_url, capacity, created_at, team_members(user_id, role, profiles(id, full_name, email, avatar_url, color, skill_tags))");
  if (error) throw error;
  return (data as unknown as (TeamRow & { logo_url: string | null })[]).map(t => ({
    id: t.id, name: t.name, description: t.description, hackathon: t.hackathon,
    problem: t.problem_statement, emoji: t.emoji, color: t.color,
    logoUrl: t.logo_url ?? undefined,
    capacity: t.capacity, createdAt: Date.parse(t.created_at),
    members: t.team_members.map(m => ({
      id: m.user_id,
      name: m.user_id === myId ? (m.profiles?.full_name || "You") : (m.profiles?.full_name || "Teammate"),
      role: roleUp(m.role),
      color: m.profiles?.color || "#8b5cf6",
      online: m.user_id === myId, // live presence arrives with Realtime Presence later
      skills: m.profiles?.skill_tags ?? [],
      avatarUrl: m.profiles?.avatar_url ?? undefined,
    })),
  }));
}

/** Structured, secret-free error logging for diagnostics (req. #2). */
function logSbError(operation: string, e: unknown) {
  const err = e as { code?: string; message?: string; details?: string; hint?: string };
  console.error(`[supabase] ${operation} failed`, {
    code: err?.code ?? null,
    message: err?.message ?? String(e),
    details: err?.details ?? null,
    hint: err?.hint ?? null,
  });
}

const newUuid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });

export async function createTeam(uid: string, t: { name: string; description: string; hackathon: string; problem: string; emoji: string; color: string }) {
  // Generate the id client-side and insert WITHOUT `.select()` (RETURNING).
  // Why: RETURNING rows must pass the teams SELECT policy
  // (is_team_member(id)), but the owner membership is created by the
  // AFTER INSERT trigger and is not yet visible at RETURNING time,
  // which raised 42501 "new row violates row-level security policy".
  const id = newUuid();
  const { error } = await sb.from("teams").insert({
    id, name: t.name, description: t.description, hackathon: t.hackathon,
    problem_statement: t.problem, emoji: t.emoji, color: t.color, created_by: uid,
  });
  if (error) { logSbError("teams.insert (createTeam)", error); throw error; }
  return id;
}

export async function updateTeam(id: string, patch: Partial<{ name: string; description: string; hackathon: string; problem: string; capacity: number; logoUrl: string }>) {
  const upd: Record<string, unknown> = {};
  if (patch.name !== undefined) upd.name = patch.name;
  if (patch.description !== undefined) upd.description = patch.description;
  if (patch.hackathon !== undefined) upd.hackathon = patch.hackathon;
  if (patch.problem !== undefined) upd.problem_statement = patch.problem;
  if (patch.capacity !== undefined) upd.capacity = patch.capacity;
  if (patch.logoUrl !== undefined) upd.logo_url = patch.logoUrl;
  const { error } = await sb.from("teams").update(upd).eq("id", id);
  if (error) throw error;
}

/** Uploads a team photo to the public avatars bucket (under the uploader's
 *  own folder, as required by storage RLS) and saves it on the team row. */
export async function uploadTeamLogo(uid: string, teamId: string, file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${uid}/team-${teamId}-${Date.now()}.${ext}`;
  const { error } = await sb.storage.from("avatars").upload(path, file, { upsert: true });
  if (error) { logSbError("storage.avatars.upload (uploadTeamLogo)", error); throw error; }
  const { data } = sb.storage.from("avatars").getPublicUrl(path);
  const url = data.publicUrl;
  const { error: e2 } = await sb.from("teams").update({ logo_url: url }).eq("id", teamId);
  if (e2) {
    logSbError("teams.update logo_url (uploadTeamLogo)", e2);
    // avoid an orphaned file if the DB link failed
    await sb.storage.from("avatars").remove([path]).catch(() => undefined);
    throw e2;
  }
  return url;
}

export async function deleteTeam(id: string) {
  const { error } = await sb.from("teams").delete().eq("id", id);
  if (error) throw error;
}

export async function updateMemberRole(teamId: string, userId: string, role: Member["role"]) {
  const { error } = await sb.from("team_members").update({ role: roleDown(role) })
    .eq("team_id", teamId).eq("user_id", userId);
  if (error) throw error;
}

export async function removeMember(teamId: string, userId: string) {
  const { error } = await sb.from("team_members").delete()
    .eq("team_id", teamId).eq("user_id", userId);
  if (error) throw error;
}

/* ---------------- invitations ---------------- */
export async function createInvite(teamId: string, uid: string) {
  const { data, error } = await sb.from("invitations")
    .insert({ team_id: teamId, created_by: uid })
    .select("token, expires_at").single();
  if (error) throw error;
  return { token: data.token as string, expiresAt: data.expires_at as string };
}

export type InvitePreview = {
  team_name: string; team_emoji: string; team_color: string; description: string;
  hackathon: string; member_count: number; capacity: number;
  state: "valid" | "expired" | "revoked" | "full"; expires_at: string;
};

export async function previewInvite(token: string): Promise<InvitePreview | null> {
  const { data, error } = await sb.rpc("preview_invitation", { _token: token });
  if (error) throw error;
  const rows = data as InvitePreview[] | null;
  return rows && rows.length ? rows[0] : null;
}

export async function acceptInvite(token: string): Promise<string> {
  const { data, error } = await sb.rpc("accept_invitation", { _token: token });
  if (error) throw error;
  return data as string;
}

/* ---------------- team chat ---------------- */
type MsgRow = {
  id: string; team_id: string; author_id: string; body: string;
  reply_to: string | null; edited: boolean; created_at: string;
  message_reactions: { emoji: string; user_id: string }[];
  attachments: { id: string; kind: Attachment["kind"]; file_name: string; size_bytes: number; storage_path: string }[];
};

function mapMessage(r: MsgRow, signedUrls: Record<string, string>): Message {
  const reactions: Record<string, string[]> = {};
  for (const re of r.message_reactions ?? []) (reactions[re.emoji] ??= []).push(re.user_id);
  const att = (r.attachments ?? [])[0];
  return {
    id: r.id, authorId: r.author_id, text: r.body, ts: Date.parse(r.created_at),
    edited: r.edited || undefined, replyTo: r.reply_to ?? undefined, reactions,
    attachment: att ? {
      kind: att.kind, name: att.file_name, size: att.size_bytes,
      status: "done", progress: 100, url: signedUrls[att.storage_path],
    } : undefined,
  };
}

export async function fetchMessages(teamId: string): Promise<Message[]> {
  const { data, error } = await sb.from("messages")
    .select("id, team_id, author_id, body, reply_to, edited, created_at, message_reactions(emoji, user_id), attachments(id, kind, file_name, size_bytes, storage_path)")
    .eq("team_id", teamId).order("created_at", { ascending: true }).limit(300);
  if (error) throw error;
  const rows = data as unknown as MsgRow[];
  const paths = rows.flatMap(r => (r.attachments ?? []).map(a => a.storage_path));
  const signed: Record<string, string> = {};
  if (paths.length) {
    const { data: urls } = await sb.storage.from("team-files").createSignedUrls(paths, 3600);
    for (const u of urls ?? []) if (u.signedUrl && u.path) signed[u.path] = u.signedUrl;
  }
  return rows.map(r => mapMessage(r, signed));
}

export async function sendMessage(teamId: string, uid: string, body: string, replyTo?: string): Promise<Message> {
  const { data, error } = await sb.from("messages")
    .insert({ team_id: teamId, author_id: uid, body, reply_to: replyTo ?? null })
    .select("id, team_id, author_id, body, reply_to, edited, created_at").single();
  if (error) throw error;
  return mapMessage({ ...(data as unknown as MsgRow), message_reactions: [], attachments: [] }, {});
}

export async function editMessage(id: string, body: string) {
  const { error } = await sb.from("messages").update({ body, edited: true }).eq("id", id);
  if (error) throw error;
}

export async function deleteMessage(id: string) {
  const { error } = await sb.from("messages").delete().eq("id", id);
  if (error) throw error;
}

export async function toggleReaction(messageId: string, uid: string, emoji: string, add: boolean) {
  if (add) {
    const { error } = await sb.from("message_reactions").insert({ message_id: messageId, user_id: uid, emoji });
    if (error && error.code !== "23505") throw error; // ignore duplicate
  } else {
    const { error } = await sb.from("message_reactions").delete()
      .eq("message_id", messageId).eq("user_id", uid).eq("emoji", emoji);
    if (error) throw error;
  }
}

export async function uploadAttachment(teamId: string, messageId: string, file: File, kind: Attachment["kind"]): Promise<string> {
  const safe = file.name.replace(/[^\w.\-() ]/g, "_").slice(0, 200);
  const path = `${teamId}/${messageId}/${safe}`;
  const { error } = await sb.storage.from("team-files").upload(path, file, { upsert: true });
  if (error) throw error;
  const { error: e2 } = await sb.from("attachments").insert({
    message_id: messageId, team_id: teamId, kind,
    file_name: safe, size_bytes: file.size,
    mime_type: file.type || "application/octet-stream", storage_path: path,
  });
  if (e2) throw e2;
  const { data } = await sb.storage.from("team-files").createSignedUrl(path, 3600);
  return data?.signedUrl ?? "";
}

export async function markRead(teamId: string, uid: string) {
  await sb.from("team_reads").upsert({ team_id: teamId, user_id: uid, last_read_at: new Date().toISOString() });
}

/* ---------------- tasks ---------------- */
type TaskRow = { id: string; title: string; priority: Task["priority"]; done: boolean; assignee_id: string | null; milestone_id: string | null };
const mapTask = (r: TaskRow): Task => ({
  id: r.id, title: r.title, priority: r.priority, done: r.done,
  assignee: r.assignee_id ?? undefined, milestoneId: r.milestone_id ?? undefined,
});

export async function fetchTasks(teamId: string): Promise<Task[]> {
  const { data, error } = await sb.from("tasks")
    .select("id, title, priority, done, assignee_id, milestone_id")
    .eq("team_id", teamId).order("created_at", { ascending: true });
  if (error) throw error;
  return (data as TaskRow[]).map(mapTask);
}

export async function addTask(teamId: string, uid: string, t: { title: string; priority: Task["priority"]; assignee?: string }): Promise<Task> {
  const { data, error } = await sb.from("tasks").insert({
    team_id: teamId, created_by: uid, title: t.title, priority: t.priority,
    assignee_id: t.assignee ?? null,
  }).select("id, title, priority, done, assignee_id, milestone_id").single();
  if (error) throw error;
  return mapTask(data as TaskRow);
}

export async function setTaskDone(id: string, done: boolean) {
  const { error } = await sb.from("tasks").update({ done }).eq("id", id);
  if (error) throw error;
}

export async function deleteTask(id: string) {
  const { error } = await sb.from("tasks").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------- milestones ---------------- */
type MsRow = {
  id: string; title: string; description: string; due_label: string;
  status: Milestone["status"]; priority: Milestone["priority"];
  depends_on: string | null; acceptance: string[]; position: number;
};
const mapMs = (r: MsRow): Milestone => ({
  id: r.id, title: r.title, description: r.description, due: r.due_label,
  status: r.status, priority: r.priority, dependsOn: r.depends_on ?? undefined,
  acceptance: Array.isArray(r.acceptance) ? r.acceptance : [],
});

export async function fetchMilestones(teamId: string): Promise<Milestone[]> {
  const { data, error } = await sb.from("milestones")
    .select("id, title, description, due_label, status, priority, depends_on, acceptance, position")
    .eq("team_id", teamId).order("position", { ascending: true }).order("created_at", { ascending: true });
  if (error) throw error;
  return (data as unknown as MsRow[]).map(mapMs);
}

export async function addMilestone(teamId: string, uid: string, m: { title: string; due: string; description: string; acceptance: string[]; position: number }): Promise<Milestone> {
  const { data, error } = await sb.from("milestones").insert({
    team_id: teamId, created_by: uid, title: m.title, due_label: m.due,
    description: m.description, acceptance: m.acceptance, position: m.position,
  }).select("id, title, description, due_label, status, priority, depends_on, acceptance, position").single();
  if (error) throw error;
  return mapMs(data as unknown as MsRow);
}

export async function updateMilestoneStatus(id: string, status: Milestone["status"]) {
  const { error } = await sb.from("milestones").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function deleteMilestone(id: string) {
  const { error } = await sb.from("milestones").delete().eq("id", id);
  if (error) throw error;
}

export async function replaceMilestones(teamId: string, uid: string, items: Omit<Milestone, "id">[]): Promise<Milestone[]> {
  const { error: delErr } = await sb.from("milestones").delete().eq("team_id", teamId);
  if (delErr) throw delErr;
  const { data, error } = await sb.from("milestones").insert(items.map((m, i) => ({
    team_id: teamId, created_by: uid, title: m.title, due_label: m.due,
    description: m.description, acceptance: m.acceptance,
    status: m.status, priority: m.priority, position: i,
  }))).select("id, title, description, due_label, status, priority, depends_on, acceptance, position");
  if (error) throw error;
  return (data as unknown as MsRow[]).map(mapMs);
}

/* ---------------- timer ---------------- */
export async function fetchTimer(teamId: string): Promise<TimerState | null> {
  const { data, error } = await sb.from("team_timers")
    .select("label, status, deadline_at, remaining_ms, duration_ms")
    .eq("team_id", teamId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    label: data.label, status: data.status,
    deadline: data.deadline_at ? Date.parse(data.deadline_at) : null,
    remaining: data.remaining_ms, duration: data.duration_ms,
  };
}

export async function saveTimer(teamId: string, uid: string, t: TimerState) {
  const { error } = await sb.from("team_timers").update({
    label: t.label, status: t.status,
    deadline_at: t.deadline ? new Date(t.deadline).toISOString() : null,
    remaining_ms: t.remaining, duration_ms: t.duration, updated_by: uid,
  }).eq("team_id", teamId);
  if (error) throw error;
}

/* ---------------- direct messages ---------------- */
export async function openDm(otherUid: string): Promise<string> {
  const { data, error } = await sb.rpc("get_or_create_dm", { _other: otherUid });
  if (error) throw error;
  return data as string;
}

export async function fetchDms(convId: string, myId: string): Promise<DmMessage[]> {
  const { data, error } = await sb.from("dm_messages")
    .select("id, sender_id, body, created_at")
    .eq("conversation_id", convId).order("created_at", { ascending: true }).limit(200);
  if (error) throw error;
  return (data as { id: string; sender_id: string; body: string; created_at: string }[])
    .map(r => ({ id: r.id, fromMe: r.sender_id === myId, text: r.body, ts: Date.parse(r.created_at) }));
}

export async function sendDm(convId: string, uid: string, body: string): Promise<DmMessage> {
  const { data, error } = await sb.from("dm_messages")
    .insert({ conversation_id: convId, sender_id: uid, body })
    .select("id, sender_id, body, created_at").single();
  if (error) throw error;
  return { id: data.id, fromMe: true, text: data.body, ts: Date.parse(data.created_at) };
}

/* ---------------- AI mentor (Gemini via Edge Function) ---------------- */
export async function fetchMentor(teamId: string): Promise<MentorMsg[]> {
  const { data, error } = await sb.from("mentor_messages")
    .select("id, role, body, created_at")
    .eq("team_id", teamId).order("created_at", { ascending: true }).limit(100);
  if (error) throw error;
  return (data as { id: string; role: "user" | "ai"; body: string; created_at: string }[])
    .map(r => ({ id: r.id, role: r.role, text: r.body, ts: Date.parse(r.created_at) }));
}

/** Calls the `gemini-chat` Edge Function. The user's JWT is attached
 *  automatically; the Gemini key lives only in server secrets. */
export async function askMentor(teamId: string, message: string): Promise<string> {
  const { data, error } = await sb.functions.invoke("gemini-chat", {
    body: { teamId, message },
  });
  if (error) {
    // FunctionsHttpError carries the function's JSON error body
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx) {
        const body = await ctx.json();
        if (body?.error) throw new Error(body.error);                 // our function's friendly message
        if (body?.code === "NOT_FOUND")                                // platform: function not deployed
          throw new Error("The gemini-chat Edge Function isn't deployed yet — see supabase/functions/DEPLOY.md.");
      }
    } catch (inner) {
      if (inner instanceof Error && inner.message && !/JSON|body/i.test(inner.message)) throw inner;
    }
    throw new Error("The AI mentor is unreachable. Is the gemini-chat function deployed?");
  }
  if (!data?.reply) throw new Error("The AI mentor returned an empty reply.");
  return data.reply as string;
}

/* ---------------- realtime ---------------- */
export type RealtimeEvt = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new?: Record<string, unknown>;
  old?: Record<string, unknown>;
};

/** Maps a raw realtime `messages` row to the app Message shape (no joins —
 *  reactions/attachments arrive via their own events). Used for instant,
 *  zero-refetch delivery of incoming chat messages. */
export function mapRealtimeMessage(row: Record<string, unknown>): Message {
  return {
    id: String(row.id),
    authorId: String(row.author_id),
    text: String(row.body ?? ""),
    ts: Date.parse(String(row.created_at)),
    edited: row.edited ? true : undefined,
    replyTo: row.reply_to ? String(row.reply_to) : undefined,
    reactions: {},
  };
}

export function subscribeTeam(
  teamId: string,
  onChange: (table: string, evt?: RealtimeEvt) => void
): () => void {
  const ch = sb.channel(`team-${teamId}`);
  for (const table of ["messages", "attachments", "message_reactions", "tasks", "milestones", "team_timers", "mentor_messages"]) {
    ch.on(
      "postgres_changes",
      { event: "*", schema: "public", table, ...(table !== "message_reactions" ? { filter: `team_id=eq.${teamId}` } : {}) },
      (payload: RealtimeEvt) => onChange(table, payload)
    );
  }
  ch.subscribe();
  return () => { sb.removeChannel(ch); };
}

/** Instant delivery for 1-to-1 chats: pushes every new dm_messages row of
 *  this conversation the moment it is committed. */
export function subscribeDm(
  convId: string,
  onInsert: (row: { id: string; sender_id: string; body: string; created_at: string }) => void
): () => void {
  const ch = sb.channel(`dm-${convId}`);
  ch.on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "dm_messages", filter: `conversation_id=eq.${convId}` },
    (payload: RealtimeEvt) => {
      if (payload.new) onInsert(payload.new as { id: string; sender_id: string; body: string; created_at: string });
    }
  );
  ch.subscribe();
  return () => { sb.removeChannel(ch); };
}

/** Live presence: joins the team presence channel and reports the set of
 *  online user ids whenever someone joins or leaves. */
export function subscribePresence(
  teamId: string,
  userId: string,
  onSync: (onlineIds: Set<string>) => void
): () => void {
  const ch = sb.channel(`presence-${teamId}`, { config: { presence: { key: userId } } });
  const sync = () => {
    const state = ch.presenceState();
    onSync(new Set(Object.keys(state)));
  };
  ch.on("presence", { event: "sync" }, sync)
    .on("presence", { event: "join" }, sync)
    .on("presence", { event: "leave" }, sync)
    .subscribe(status => {
      if (status === "SUBSCRIBED") ch.track({ at: Date.now() });
    });
  return () => { sb.removeChannel(ch); };
}

/* ---------------- error helper ---------------- */
export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
  if (msg.includes("Invalid login credentials")) return "Incorrect email or password.";
  if (msg.includes("Email not confirmed")) return "Please confirm your email first — check your inbox.";
  if (msg.includes("User already registered")) return "An account with this email already exists — sign in instead.";
  if (msg.includes("INVITE_EXPIRED")) return "This invitation has expired.";
  if (msg.includes("INVITE_REVOKED")) return "This invitation was revoked.";
  if (msg.includes("INVITE_INVALID")) return "This invitation link is invalid.";
  if (msg.includes("TEAM_FULL")) return "This team is already full.";
  if (msg.includes("NOT_TEAMMATES")) return "You can only message people you share a team with.";
  if (msg.includes("row-level security")) return "You don't have permission for that action.";
  if (msg.includes("Failed to fetch")) return "Network error — check your connection.";
  return msg.length > 140 ? msg.slice(0, 140) + "…" : msg;
}

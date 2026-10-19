import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate, useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, FolderOpen, Map, ListChecks, Bot, TimerIcon, Settings as SettingsIcon,
  UserPlus, ChevronsUpDown, Menu, Sun, Moon, LogOut, Zap, Copy, Share2, Link2, RefreshCw, Loader2, Clock3,
} from "lucide-react";
import { Button, Avatar, Badge, Modal, Tooltip } from "@/components/ui";
import { BrandIcon } from "@/components/brand";
import { useStore, useTeam, type Member } from "@/lib/store";
import { isConfigured } from "@/lib/supabase";
import * as api from "@/lib/api";
import { cn } from "@/utils";

/* ---------------- timer helper ---------------- */
export function useCountdown() {
  const { state } = useStore();
  const [, force] = useState(0);
  useEffect(() => {
    const i = setInterval(() => force(n => n + 1), 1000);
    return () => clearInterval(i);
  }, []);
  const t = state.timer;
  let remaining = 0;
  if (t.status === "running" && t.deadline) remaining = Math.max(0, t.deadline - Date.now());
  else if (t.status === "paused" && t.remaining != null) remaining = t.remaining;
  else if (t.status === "idle") remaining = t.duration;
  const done = t.status === "done" || (t.status === "running" && remaining <= 0);
  const d = Math.floor(remaining / 86400000);
  const h = Math.floor((remaining % 86400000) / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  const pct = t.duration > 0 ? Math.max(0, Math.min(1, remaining / t.duration)) : 0;
  return { ...t, remaining, d, h, m, s, done, pct, warning: !done && remaining < 2 * 3600000 && t.status === "running" };
}

export const pad = (n: number) => String(n).padStart(2, "0");

/* ---------------- Invite modal ---------------- */
export function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const team = useTeam();
  const { toast } = useStore();
  const [link, setLink] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const { state } = useStore();
  const [expiry, setExpiry] = useState<string | null>(null);

  const generate = () => {
    setGenerating(true);
    if (isConfigured && team && state.user) {
      api.createInvite(team.id, state.user.id)
        .then(({ token, expiresAt }) => {
          setLink(`${window.location.origin}${window.location.pathname}#/join/${token}`);
          setExpiry(expiresAt);
          toast("success", "Invite link generated — valid for 48 hours.");
        })
        .catch(e => toast("error", api.friendlyError(e)))
        .finally(() => setGenerating(false));
      return;
    }
    setTimeout(() => {
      // demo placeholder link (no backend configured)
      setLink(`${window.location.origin}${window.location.pathname}#/join/demo-invite`);
      setGenerating(false);
      toast("info", "Invite link generated.");
    }, 800);
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast("success", "Invite link copied to clipboard.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("error", "Couldn't access the clipboard — copy the link manually.");
    }
  };

  const share = async () => {
    if (!link) return;
    if (navigator.share) {
      try { await navigator.share({ title: `Join ${team?.name} on Vadanam`, url: link }); }
      catch { /* user cancelled */ }
    } else {
      toast("info", "Native sharing isn't supported in this browser — the link was copied instead.");
      copy();
    }
  };

  const seats = team ? `${team.members.length} / ${team.capacity}` : "—";
  const isFull = !!team && team.members.length >= team.capacity;

  return (
    <Modal open={open} onClose={onClose} title="Invite team members">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm text-ink-500 dark:text-ink-300">
          {team?.logoUrl
            ? <img src={team.logoUrl} alt="" className="w-6 h-6 rounded-lg object-cover" />
            : <span className="text-xl">{team?.emoji}</span>} {team?.name}
        </div>
        <Badge tone={isFull ? "rose" : "cyan"}>{seats} seats filled</Badge>
      </div>

      {!link ? (
        <div className="rounded-xl border border-dashed border-ink-300/60 dark:border-white/15 p-6 text-center">
          <Link2 className="w-8 h-8 text-cyan-500 mx-auto mb-3" />
          <p className="text-sm text-ink-500 dark:text-ink-300 mb-4">Generate a shareable link. Anyone with the link can request to join until it expires.</p>
          <Button onClick={generate} disabled={generating || isFull} disabledReason={isFull ? "Team is at capacity — raise it in Team Settings" : undefined}>
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            {generating ? "Generating…" : "Generate Invite Link"}
          </Button>
        </div>
      ) : (
        <>
          <div className="rounded-xl bg-ink-100/70 dark:bg-ink-900/80 border border-ink-200/60 dark:border-white/10 p-3 font-mono text-[12px] text-ink-700 dark:text-cyan-300 break-all select-all">
            {link}
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px] text-ink-400">
            <span className="flex items-center gap-1">
              <Clock3 className="w-3 h-3" />
              {expiry ? `Expires ${new Date(expiry).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}` : "Expires in 48 hours"}
            </span>
            <button onClick={generate} className="flex items-center gap-1 text-cyan-600 dark:text-cyan-300 hover:underline"><RefreshCw className="w-3 h-3" /> Regenerate</button>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <Button variant="secondary" onClick={copy}><Copy className="w-4 h-4" /> {copied ? "Copied!" : "Copy Link"}</Button>
            <Button onClick={share}><Share2 className="w-4 h-4" /> Share</Button>
          </div>
        </>
      )}

      <div className="mt-5 pt-4 border-t border-ink-200/60 dark:border-white/8">
        <p className="text-xs font-bold uppercase tracking-wider text-ink-400 mb-2.5">Pending invitations</p>
        <div className="flex items-center gap-3 text-sm text-ink-500 dark:text-ink-300">
          <span className="w-8 h-8 rounded-full bg-ink-200/70 dark:bg-white/8 flex items-center justify-center text-ink-400"><UserPlus className="w-4 h-4" /></span>
          <span className="flex-1">No pending invitations yet.</span>
        </div>

      </div>
    </Modal>
  );
}

/* ---------------- Member profile card ---------------- */
export function MemberModal({ member, onClose }: { member: Member | null; onClose: () => void }) {
  const { state } = useStore();
  const team = useTeam();
  const navigate = useNavigate();
  const isMe = !!member && member.id === state.user?.id;
  const dmKey = `${team?.id}:${member?.id}`;
  const dmCount = (state.dms[dmKey] ?? []).length;
  const photoUrl = isMe ? state.user?.avatarUrl : member?.avatarUrl;
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { setExpanded(false); }, [member?.id]);

  return (
    <Modal open={!!member} onClose={onClose} title={isMe ? "Your profile" : "Team member"}>
      {member && (
        <>
          {/* tap the avatar to expand their photo */}
          {expanded && photoUrl && (
            <button onClick={() => setExpanded(false)} aria-label="Collapse photo" className="block w-full mb-4">
              <img src={photoUrl} alt={`${member.name}'s photo`} className="w-full rounded-2xl max-h-[50vh] object-contain bg-ink-100/50 dark:bg-white/5" />
            </button>
          )}
          <div className="flex items-center gap-4">
            <button
              onClick={() => photoUrl && setExpanded(e => !e)}
              aria-label={photoUrl ? (expanded ? "Collapse photo" : "Expand photo") : undefined}
              className={cn("rounded-full shrink-0", photoUrl && "hover:scale-105 transition-transform focus-visible:outline-2 focus-visible:outline-cyan-400")}
            >
              <Avatar name={member.name} color={member.color} size={56} online={member.online} src={photoUrl} />
            </button>
            <div>
              <h3 className="font-bold text-lg text-ink-900 dark:text-white leading-tight">
                {isMe ? (state.user?.name ?? member.name) : member.name}{isMe && " (you)"}
              </h3>
              <div className="flex items-center gap-2 mt-1.5">
                <Badge tone={member.role === "Owner" ? "violet" : member.role === "Admin" ? "cyan" : "gray"}>{member.role}</Badge>
                <span className={cn("text-[11px] font-semibold", member.online ? "text-emerald-500" : "text-ink-400")}>
                  {member.online ? "Online" : "Offline"}
                </span>
              </div>
            </div>
          </div>

          {/* skill tags */}
          <div className="mt-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400 mb-2">Skills</p>
            <div className="flex flex-wrap gap-1.5">
              {(isMe ? (state.user?.skills ?? member.skills) : member.skills)?.length
                ? (isMe ? (state.user?.skills ?? member.skills ?? []) : (member.skills ?? [])).map(s => (
                    <Badge key={s} tone="cyan">{s}</Badge>
                  ))
                : <span className="text-[12px] text-ink-400">No skill tags yet{isMe && " — add them in Settings"}.</span>}
            </div>
          </div>

          <div className="mt-6 space-y-2">
            {!isMe && (
              <Button className="w-full" onClick={() => { onClose(); navigate(`/team/${team?.id}/dm/${member.id}`); }}>
                <MessageSquare className="w-4 h-4" /> Message {member.name.split(" ")[0]}
                {dmCount > 0 && <span className="text-[11px] opacity-80">({dmCount})</span>}
              </Button>
            )}
            <Button variant="secondary" className="w-full" onClick={() => { onClose(); navigate(`/team/${team?.id}/tasks`); }}>
              <ListChecks className="w-4 h-4" /> View {isMe ? "your" : "their"} tasks
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => { onClose(); navigate(`/team/${team?.id}/settings`); }}>
              <SettingsIcon className="w-4 h-4" /> {isMe ? "Edit profile in Settings" : "Manage roles in Team Settings"}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}

/* ---------------- Team info modal (click team name/photo) ---------------- */
export function TeamInfoModal({ open, onClose, openInvite }: { open: boolean; onClose: () => void; openInvite: () => void }) {
  const team = useTeam();
  const navigate = useNavigate();
  const [memberFor, setMemberFor] = useState<Member | null>(null);
  if (!team) return null;
  return (
    <>
      <Modal open={open} onClose={onClose} title="Team info">
        <div className="flex items-center gap-4">
          {team.logoUrl ? (
            <img src={team.logoUrl} alt={`${team.name} logo`} className="w-16 h-16 rounded-2xl object-cover border border-ink-200/50 dark:border-white/10" />
          ) : (
            <span className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl" style={{ background: `${team.color}22` }}>{team.emoji}</span>
          )}
          <div className="min-w-0">
            <h3 className="font-bold text-lg text-ink-900 dark:text-white truncate">{team.name}</h3>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <Badge tone="violet">{team.hackathon || "Hackathon team"}</Badge>
              <Badge tone="cyan"><UserPlus className="w-3 h-3" /> {team.members.length} / {team.capacity}</Badge>
            </div>
          </div>
        </div>

        {team.description && (
          <p className="text-[13px] text-ink-500 dark:text-ink-300 mt-4 leading-relaxed">{team.description}</p>
        )}
        {team.problem && (
          <div className="mt-4 rounded-xl bg-ink-100/60 dark:bg-white/5 border-l-2 border-cyan-400/60 px-3.5 py-2.5">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink-400 mb-1">Problem statement</p>
            <p className="text-[12.5px] text-ink-600 dark:text-ink-200 leading-relaxed">{team.problem}</p>
          </div>
        )}

        <div className="mt-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400 mb-2.5">Members — tap for profile & chat</p>
          <div className="space-y-2">
            {team.members.map(m => (
              <button key={m.id} onClick={() => setMemberFor(m)}
                className="w-full flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-ink-100/70 dark:hover:bg-white/6 transition-colors text-left">
                <Avatar name={m.name} color={m.color} size={34} online={m.online} src={m.avatarUrl} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-semibold text-ink-800 dark:text-ink-50 truncate">{m.name}</span>
                  {(m.skills ?? []).length > 0 && <span className="block text-[10.5px] text-ink-400 truncate">{(m.skills ?? []).join(" · ")}</span>}
                </span>
                <Badge tone={m.role === "Owner" ? "violet" : m.role === "Admin" ? "cyan" : "gray"}>{m.role}</Badge>
              </button>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-ink-400 mt-4">Created {new Date(team.createdAt).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}</p>

        <div className="grid grid-cols-2 gap-2 mt-5">
          <Button variant="outline" onClick={() => { onClose(); openInvite(); }}><UserPlus className="w-4 h-4" /> Invite</Button>
          <Button variant="secondary" onClick={() => { onClose(); navigate(`/team/${team.id}/settings`); }}><SettingsIcon className="w-4 h-4" /> Settings</Button>
        </div>
        <Button variant="ghost" className="w-full mt-2" onClick={() => { onClose(); navigate("/teams"); }}>
          <ChevronsUpDown className="w-4 h-4" /> Switch team
        </Button>
      </Modal>
      <MemberModal member={memberFor} onClose={() => setMemberFor(null)} />
    </>
  );
}

/* ---------------- Sidebar ---------------- */
/* Each icon is swappable: drop <brand>.png into public/branding/ to replace it. */
const NAV = [
  { to: "chat", label: "Chat", brand: "chat", icon: <MessageSquare className="w-4.5 h-4.5" /> },
  { to: "files", label: "Shared Files", brand: "files", icon: <FolderOpen className="w-4.5 h-4.5" /> },
  { to: "roadmap", label: "Roadmap", brand: "roadmap", icon: <Map className="w-4.5 h-4.5" /> },
  { to: "tasks", label: "Tasks", brand: "tasks", icon: <ListChecks className="w-4.5 h-4.5" /> },
  { to: "mentor", label: "AI Mentor", brand: "mentor", icon: <Bot className="w-4.5 h-4.5" /> },
  { to: "timer", label: "Timer", brand: "timer", icon: <TimerIcon className="w-4.5 h-4.5" /> },
  { to: "settings", label: "Settings", brand: "settings", icon: <SettingsIcon className="w-4.5 h-4.5" /> },
];

function SidebarContent({ onNavigate, openInvite, openTeamInfo }: { onNavigate?: () => void; openInvite: () => void; openTeamInfo: () => void }) {
  const { state, dispatch } = useStore();
  const team = useTeam();
  const navigate = useNavigate();
  const cd = useCountdown();
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const unread = useMemo(() => {
    if (!team) return 0;
    const msgs = state.messages[team.id] ?? [];
    const last = state.lastRead[team.id] ?? 0;
    return msgs.filter(m => m.ts > last && m.authorId !== state.user?.id && m.authorId !== "u-you").length;
  }, [state.messages, state.lastRead, team]);

  return (
    <div className="flex flex-col h-full">
      {/* Vadanam brand */}
      <div className="flex items-center gap-2.5 px-4 pt-4 select-none">
        <BrandIcon name="logo" size={28} rounded className="!rounded-lg" fallback={
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-400 via-sky-500 to-violet-600 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" fill="currentColor" />
          </span>
        } />
        <span className="font-extrabold tracking-tight text-[15px] text-ink-900 dark:text-white">VADANAM</span>
      </div>
      {/* team identity — opens team info */}
      <button
        onClick={() => { openTeamInfo(); }}
        className="flex items-center gap-3 p-3 m-3 rounded-xl hover:bg-ink-100/70 dark:hover:bg-white/6 transition-colors text-left"
        aria-label="View team info"
      >
        {team?.logoUrl ? (
          <img src={team.logoUrl} alt={`${team.name} logo`} className="w-10 h-10 rounded-xl object-cover shrink-0 border border-ink-200/50 dark:border-white/10" />
        ) : (
          <span className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: `${team?.color}22` }}>{team?.emoji}</span>
        )}
        <span className="flex-1 min-w-0">
          <span className="block font-bold text-[14px] text-ink-900 dark:text-white truncate">{team?.name}</span>
          <span className="block text-[11px] text-ink-400 truncate">{team?.hackathon}</span>
        </span>
        <ChevronsUpDown className="w-4 h-4 text-ink-400 shrink-0" />
      </button>

      {/* countdown chip */}
      <Link to={`/team/${team?.id}/timer`} onClick={onNavigate}
        className={cn("mx-3 mb-2 rounded-xl px-3.5 py-2.5 flex items-center gap-2.5 font-mono text-[13px] font-bold transition-colors",
          cd.done ? "bg-rose-400/12 text-rose-500" : cd.warning ? "bg-amber-400/12 text-amber-500" : "bg-cyan-400/10 text-cyan-600 dark:text-cyan-300 hover:bg-cyan-400/16")}>
        <TimerIcon className="w-4 h-4 shrink-0" />
        {cd.done ? "TIME'S UP" : cd.status === "idle" ? "Timer idle" : `${cd.d > 0 ? pad(cd.d) + ":" : ""}${pad(cd.h)}:${pad(cd.m)}:${pad(cd.s)}`}
        {cd.status === "paused" && <span className="text-[9px] font-sans font-semibold uppercase tracking-wider ml-auto opacity-70">paused</span>}
      </Link>

      {/* nav */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto" aria-label="Workspace">
        {NAV.map(n => (
          <NavLink
            key={n.to}
            to={`/team/${team?.id}/${n.to}`}
            onClick={onNavigate}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] font-semibold transition-all",
              isActive
                ? "bg-gradient-to-r from-cyan-500/14 to-violet-500/14 text-ink-900 dark:text-white shadow-[inset_0_0_0_1px_rgba(34,211,238,0.25)]"
                : "text-ink-500 dark:text-ink-300 hover:bg-ink-100/70 dark:hover:bg-white/6 hover:text-ink-900 dark:hover:text-white"
            )}
          >
            <BrandIcon name={n.brand} size={18} fallback={n.icon} />{n.label}
            {n.to === "chat" && unread > 0 && (
              <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 text-white text-[10px] font-bold flex items-center justify-center">{unread}</span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* members + invite */}
      <div className="p-3 border-t border-ink-200/60 dark:border-white/8">
        <div className="flex items-center justify-between px-1 mb-2.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400">Members</p>
          <span className="text-[10px] text-emerald-500 font-semibold">{team?.members.filter(m => m.online).length} online</span>
        </div>
        <div className="flex items-center gap-1.5 px-1 flex-wrap">
          {team?.members.map(m => (
            <Tooltip key={m.id} label={`${m.name} · ${m.role} — click for chat & more`}>
              <button
                onClick={() => {
                  // teammates: straight to personal chat · yourself: profile card
                  if (m.id === state.user?.id || m.id === "u-you") setSelectedMember(m);
                  else { navigate(`/team/${team?.id}/dm/${m.id}`); onNavigate?.(); }
                }}
                aria-label={m.id === state.user?.id || m.id === "u-you" ? "Open your profile" : `Chat with ${m.name}`}
                className="rounded-full hover:scale-110 transition-transform focus-visible:outline-2 focus-visible:outline-cyan-400"
              >
                <Avatar name={m.name} color={m.color} size={30} online={m.online}
                  src={m.id === state.user?.id || m.id === "u-you" ? state.user?.avatarUrl : m.avatarUrl} />
              </button>
            </Tooltip>
          ))}
        </div>
        <MemberModal member={selectedMember} onClose={() => setSelectedMember(null)} />
        <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => { openInvite(); onNavigate?.(); }}>
          <UserPlus className="w-3.5 h-3.5" /> Invite Members
        </Button>
      </div>

      {/* user */}
      <div className="p-3 border-t border-ink-200/60 dark:border-white/8 flex items-center gap-2.5">
        <Avatar name={state.user?.name ?? "You"} color={state.user?.color ?? "#22d3ee"} size={32} online src={state.user?.avatarUrl} />
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] font-bold text-ink-900 dark:text-white truncate">{state.user?.name}</p>
          <p className="text-[10.5px] text-ink-400 truncate">{state.user?.email}</p>
        </div>
        <Tooltip label="Toggle theme">
          <button onClick={() => dispatch({ type: "patch", patch: { theme: state.theme === "dark" ? "light" : "dark" } })}
            aria-label="Toggle theme" className="p-1.5 rounded-lg text-ink-400 hover:text-ink-700 dark:hover:text-white hover:bg-ink-100 dark:hover:bg-white/8">
            {state.theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </Tooltip>
        <Tooltip label="Sign out">
          <button onClick={async () => {
            if (isConfigured) await api.authSignOut().catch(() => undefined);
            dispatch({ type: "patch", patch: { user: null, activeTeam: null } });
            navigate("/");
          }}
            aria-label="Sign out" className="p-1.5 rounded-lg text-ink-400 hover:text-rose-500 hover:bg-rose-400/10">
            <LogOut className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

/* ---------------- Layout ---------------- */
export default function WorkspaceLayout() {
  const { teamId } = useParams();
  const { state, dispatch } = useStore();
  const team = useTeam(teamId);
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [teamInfoOpen, setTeamInfoOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const unreadBottom = useMemo(() => {
    if (!team) return 0;
    const msgs = state.messages[team.id] ?? [];
    const last = state.lastRead[team.id] ?? 0;
    return msgs.filter(m => m.ts > last && m.authorId !== state.user?.id && m.authorId !== "u-you").length;
  }, [state.messages, state.lastRead, team, state.user?.id]);

  useEffect(() => {
    if (!state.authReady || !state.teamsLoaded) return; // still restoring session / loading teams
    if (!state.user) { navigate("/signin"); return; }
    if (!team) { navigate("/teams"); return; }
    if (state.activeTeam !== team.id) dispatch({ type: "patch", patch: { activeTeam: team.id } });
  }, [state.user, team, state.authReady, state.teamsLoaded]); // eslint-disable-line

  if (!state.authReady || !state.teamsLoaded) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin" aria-label="Loading workspace" />
      </div>
    );
  }
  if (!state.user || !team) return null;

  return (
    // 100dvh (not vh): the layout tracks the real visible viewport on mobile,
    // so the team-name bar stays fixed while chatting — no address-bar jumps
    <div className="h-[100dvh] flex overflow-hidden">
      {/* desktop sidebar */}
      <aside className="hidden lg:flex w-[264px] shrink-0 flex-col border-r border-ink-200/60 dark:border-white/8 bg-white/55 dark:bg-ink-900/55 backdrop-blur-xl">
        <SidebarContent openInvite={() => setInviteOpen(true)} openTeamInfo={() => setTeamInfoOpen(true)} />
      </aside>

      {/* mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-ink-950/60 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 w-[280px] flex flex-col bg-white dark:bg-ink-900 border-r border-ink-200/60 dark:border-white/8 lg:hidden"
              initial={{ x: -290 }} animate={{ x: 0 }} exit={{ x: -290 }} transition={{ type: "spring", stiffness: 380, damping: 34 }}
            >
              <SidebarContent onNavigate={() => setMobileOpen(false)} openInvite={() => setInviteOpen(true)} openTeamInfo={() => { setMobileOpen(false); setTeamInfoOpen(true); }} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* mobile topbar */}
        <div className="lg:hidden flex items-center gap-3 px-4 h-14 border-b border-ink-200/60 dark:border-white/8 bg-white/70 dark:bg-ink-900/70 backdrop-blur-xl shrink-0">
          <button onClick={() => setMobileOpen(true)} aria-label="Open menu" className="p-1.5 -ml-1.5 text-ink-600 dark:text-ink-100"><Menu className="w-5 h-5" /></button>
          {/* tap the team name/photo to view team info */}
          <button
            onClick={() => setTeamInfoOpen(true)}
            aria-label="View team info"
            className="flex items-center gap-2.5 min-w-0 flex-1 text-left rounded-lg px-1 py-1 -mx-1 active:bg-ink-100 dark:active:bg-white/8"
          >
            {team.logoUrl ? (
              <img src={team.logoUrl} alt={`${team.name} logo`} className="w-7 h-7 rounded-lg object-cover border border-ink-200/50 dark:border-white/10 shrink-0" />
            ) : (
              <span className="w-7 h-7 rounded-lg flex items-center justify-center text-base shrink-0" style={{ background: `${team.color}22` }}>{team.emoji}</span>
            )}
            <span className="font-bold text-sm text-ink-900 dark:text-white truncate">{team.name}</span>
          </button>
          <span className="ml-auto shrink-0 flex items-center gap-1.5 select-none" aria-label="Vadanam">
            <BrandIcon name="logo" size={22} rounded className="!rounded-md" fallback={
              <span className="w-[22px] h-[22px] rounded-md bg-gradient-to-br from-cyan-400 to-violet-600 flex items-center justify-center"><Zap className="w-3 h-3 text-white" fill="currentColor" /></span>
            } />
            <span className="font-extrabold tracking-tight text-[12.5px] text-ink-900 dark:text-white">VADANAM</span>
          </span>
        </div>
        <main className="flex-1 min-h-0 overflow-hidden">
          <Outlet context={{ openInvite: () => setInviteOpen(true) }} />
        </main>

        {/* mobile/tablet bottom button bar — thumb-friendly navigation */}
        <nav
          aria-label="Quick navigation"
          className="lg:hidden shrink-0 flex items-stretch justify-around border-t border-ink-200/60 dark:border-white/8 bg-white/85 dark:bg-ink-900/85 backdrop-blur-xl px-1 pt-1 pb-[max(env(safe-area-inset-bottom),6px)]"
        >
          {[
            { to: "chat", label: "Chat", brand: "chat", icon: <MessageSquare className="w-5 h-5" /> },
            { to: "files", label: "Files", brand: "files", icon: <FolderOpen className="w-5 h-5" /> },
            { to: "tasks", label: "Tasks", brand: "tasks", icon: <ListChecks className="w-5 h-5" /> },
            { to: "mentor", label: "Mentor", brand: "mentor", icon: <Bot className="w-5 h-5" /> },
            { to: "timer", label: "Timer", brand: "timer", icon: <TimerIcon className="w-5 h-5" /> },
          ].map(n => (
            <NavLink
              key={n.to}
              to={`/team/${team.id}/${n.to}`}
              className={({ isActive }) => cn(
                "relative flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-xl text-[10px] font-semibold transition-colors min-h-[52px]",
                isActive
                  ? "text-cyan-600 dark:text-cyan-300 bg-cyan-400/10"
                  : "text-ink-400 dark:text-ink-400 active:bg-ink-100 dark:active:bg-white/8"
              )}
            >
              <BrandIcon name={n.brand} size={20} fallback={n.icon} />
              {n.label}
              {n.to === "chat" && unreadBottom > 0 && (
                <span className="absolute top-0.5 right-[22%] min-w-4 h-4 px-1 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 text-white text-[9px] font-bold flex items-center justify-center">{unreadBottom}</span>
              )}
            </NavLink>
          ))}
          {/* Profile — mobile/tablet only (this whole bar is lg:hidden) */}
          <button
            onClick={() => setProfileOpen(true)}
            aria-label="Your profile"
            className="relative flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-xl text-[10px] font-semibold min-h-[52px] text-ink-400 dark:text-ink-400 active:bg-ink-100 dark:active:bg-white/8"
          >
            <Avatar name={state.user?.name ?? "You"} color={state.user?.color ?? "#22d3ee"} size={22} src={state.user?.avatarUrl} />
            Profile
          </button>
        </nav>
      </div>

      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
      <TeamInfoModal open={teamInfoOpen} onClose={() => setTeamInfoOpen(false)} openInvite={() => setInviteOpen(true)} />
      <MemberModal
        member={profileOpen ? (team.members.find(m => m.id === state.user?.id || m.id === "u-you") ?? {
          id: state.user?.id ?? "u-you", name: state.user?.name ?? "You", role: "Member",
          color: state.user?.color ?? "#22d3ee", online: true, skills: state.user?.skills,
        }) : null}
        onClose={() => setProfileOpen(false)}
      />
    </div>
  );
}

import React, { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import { isConfigured } from "./supabase";

/* ---------------- types ---------------- */
export type Member = { id: string; name: string; role: "Owner" | "Admin" | "Member"; color: string; online: boolean; skills?: string[]; avatarUrl?: string };
export type DmMessage = { id: string; fromMe: boolean; text: string; ts: number };
export type Attachment = {
  kind: "image" | "video" | "doc" | "code";
  name: string;
  size: number;
  url?: string;
  lang?: string;
  code?: string;
  status: "uploading" | "done" | "failed";
  progress: number;
};
export type Message = {
  id: string;
  authorId: string;
  text: string;
  ts: number;
  edited?: boolean;
  replyTo?: string;
  reactions: Record<string, string[]>;
  attachment?: Attachment;
};
export type Task = {
  id: string;
  title: string;
  priority: "low" | "medium" | "high" | "critical";
  done: boolean;
  assignee?: string;
  milestoneId?: string;
};
export type Milestone = {
  id: string;
  title: string;
  due: string;
  status: "todo" | "active" | "done";
  priority: "low" | "medium" | "high";
  dependsOn?: string;
  acceptance: string[];
  description: string;
};
export type Team = {
  id: string;
  name: string;
  description: string;
  hackathon: string;
  problem: string;
  emoji: string;
  color: string;
  logoUrl?: string;
  members: Member[];
  capacity: number;
  createdAt: number;
};
export type MentorMsg = { id: string; role: "user" | "ai"; text: string; ts: number };
export type TimerState = {
  label: string;
  deadline: number | null; // epoch ms when running
  remaining: number | null; // ms when paused
  duration: number; // ms original
  status: "idle" | "running" | "paused" | "done";
};
export type Toast = { id: string; kind: "success" | "error" | "info"; text: string };

export type State = {
  theme: "dark" | "light";
  user: { id: string; name: string; email: string; color: string; avatarUrl?: string; skills?: string[] } | null;
  dms: Record<string, DmMessage[]>; // key: `${teamId}:${memberId}`
  teams: Team[];
  activeTeam: string | null;
  messages: Record<string, Message[]>;
  mentor: Record<string, MentorMsg[]>;
  tasks: Record<string, Task[]>;
  milestones: Record<string, Milestone[]>;
  timer: TimerState;
  prefs: { sound: boolean; notifications: boolean; emailDigest: boolean; mentions: boolean };
  lastRead: Record<string, number>;
  pendingInvite: string | null;
  authReady: boolean;   // false while a Supabase session is being restored
  teamsLoaded: boolean; // false until teams were fetched in connected mode
};

/* ---------------- demo seed ---------------- */
export const uid = () => Math.random().toString(36).slice(2, 10);
const now = Date.now();

export const DEMO_MEMBERS: Member[] = [
  { id: "u-you", name: "You", role: "Owner", color: "#22d3ee", online: true, skills: ["frontend", "react"] },
  { id: "u-ava", name: "Ava Chen", role: "Admin", color: "#8b5cf6", online: true, skills: ["design", "ui-ux", "figma"] },
  { id: "u-dev", name: "Dev Rao", role: "Member", color: "#e556b4", online: false, skills: ["backend", "devops"] },
  { id: "u-mia", name: "Mia Torres", role: "Member", color: "#34d399", online: true, skills: ["ml", "python"] },
];

const seedDms: Record<string, DmMessage[]> = {
  "t-nebula:u-ava": [
    { id: "d1", fromMe: false, text: "Hey! Can you review the new route-planner frames when you get a sec?", ts: now - 3600_000 * 6 },
    { id: "d2", fromMe: true, text: "On it — the contrast looks much better now. Shipping feedback in 10.", ts: now - 3600_000 * 5.5 },
  ],
};

const seedTeam: Team = {
  id: "t-nebula",
  name: "Nebula Crew",
  description: "Building an accessibility-first campus navigation app.",
  hackathon: "HackSprint 2026",
  problem: "Students with mobility or vision impairments struggle to find accessible routes across large campuses in real time.",
  emoji: "🚀",
  color: "#8b5cf6",
  members: DEMO_MEMBERS,
  capacity: 6,
  createdAt: now - 86400000 * 2,
};

const seedMessages: Message[] = [
  {
    id: "m1", authorId: "u-ava", ts: now - 3600_000 * 5, reactions: { "🔥": ["u-dev"] },
    text: "Morning team! I pushed the Figma frames for the route-planner screen. Thoughts on the contrast ratios?",
  },
  {
    id: "m2", authorId: "u-dev", ts: now - 3600_000 * 4.6, reactions: {},
    text: "Looks clean. I'd bump the body text to 16px for WCAG AA on mobile though.",
    replyTo: "m1",
  },
  {
    id: "m3", authorId: "u-mia", ts: now - 3600_000 * 3.1, reactions: { "👍": ["u-ava", "u-dev"] },
    text: "Here's the geo-scoring function for ranking accessible routes:\n```ts\n// score routes by accessibility weight\nexport function scoreRoute(route: Route): number {\n  const base = route.distance * 0.4;\n  const penalty = route.stairs * 12 + route.steepSegments * 8;\n  const bonus = route.elevators ? 15 : 0;\n  return Math.max(0, 100 - base - penalty + bonus);\n}\n```\nPenalty weights are a guess — we should calibrate with the survey data.",
  },
  {
    id: "m4", authorId: "u-you", ts: now - 3600_000 * 1.2, reactions: {},
    text: "Nice! I'll wire that into the map layer tonight. Also — demo video script is due before the submission freeze, adding it to tasks.",
  },
];

const seedMilestones: Milestone[] = [
  { id: "ms1", title: "Problem validation & scope lock", due: "Fri 10:00", status: "done", priority: "high", acceptance: ["Problem statement approved by all members", "Core user flow sketched", "Out-of-scope list written"], description: "Lock exactly what we build. No scope creep after this point." },
  { id: "ms2", title: "Working route engine prototype", due: "Fri 22:00", status: "active", priority: "high", dependsOn: "ms1", acceptance: ["Route scoring returns ranked results", "Handles 3 campus test cases", "Unit tests for scoring edge cases"], description: "The core differentiator. Everything else is presentation." },
  { id: "ms3", title: "UI polish + accessibility pass", due: "Sat 14:00", status: "todo", priority: "medium", dependsOn: "ms2", acceptance: ["Keyboard navigable", "Screen-reader labels on map controls", "AA contrast everywhere"], description: "Judges will try keyboard nav — make it flawless." },
  { id: "ms4", title: "Demo video + submission package", due: "Sat 20:00", status: "todo", priority: "high", dependsOn: "ms3", acceptance: ["2-min video recorded", "Devpost page complete", "Repo README with setup steps"], description: "Submit 1 hour before the deadline. Never at the deadline." },
];

const seedTasks: Task[] = [
  { id: "tk1", title: "Calibrate accessibility penalty weights", priority: "high", done: false, assignee: "u-mia", milestoneId: "ms2" },
  { id: "tk2", title: "Wire scoring into map layer", priority: "critical", done: false, assignee: "u-you", milestoneId: "ms2" },
  { id: "tk3", title: "Write demo video script", priority: "medium", done: false, assignee: "u-ava", milestoneId: "ms4" },
  { id: "tk4", title: "Export final Figma frames", priority: "low", done: true, assignee: "u-ava", milestoneId: "ms3" },
  { id: "tk5", title: "Set up Devpost project page", priority: "medium", done: false, assignee: "u-dev", milestoneId: "ms4" },
];

const initial: State = {
  theme: "dark",
  user: null,
  dms: seedDms,
  teams: [seedTeam],
  activeTeam: null,
  messages: { "t-nebula": seedMessages },
  mentor: {},
  tasks: { "t-nebula": seedTasks },
  milestones: { "t-nebula": seedMilestones },
  timer: { label: "HackSprint 2026 — Final Submission", deadline: now + 1000 * 60 * 60 * 26, remaining: null, duration: 1000 * 60 * 60 * 36, status: "running" },
  prefs: { sound: true, notifications: false, emailDigest: true, mentions: true },
  lastRead: {},
  pendingInvite: null,
  authReady: !isConfigured,
  teamsLoaded: !isConfigured,
};

/* ---------------- reducer ---------------- */
type Action =
  | { type: "patch"; patch: Partial<State> }
  | { type: "team:update"; id: string; patch: Partial<Team> }
  | { type: "msg:set"; teamId: string; messages: Message[] }
  | { type: "task:set"; teamId: string; tasks: Task[] }
  | { type: "ms:set"; teamId: string; milestones: Milestone[] }
  | { type: "mentor:set"; teamId: string; messages: MentorMsg[] }
  | { type: "dm:set"; key: string; messages: DmMessage[] };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "patch": return { ...s, ...a.patch };
    case "team:update": return { ...s, teams: s.teams.map(t => (t.id === a.id ? { ...t, ...a.patch } : t)) };
    case "msg:set": return { ...s, messages: { ...s.messages, [a.teamId]: a.messages } };
    case "task:set": return { ...s, tasks: { ...s.tasks, [a.teamId]: a.tasks } };
    case "ms:set": return { ...s, milestones: { ...s.milestones, [a.teamId]: a.milestones } };
    case "mentor:set": return { ...s, mentor: { ...s.mentor, [a.teamId]: a.messages } };
    case "dm:set": return { ...s, dms: { ...s.dms, [a.key]: a.messages } };
  }
}

/* ---------------- context ---------------- */
type Store = {
  state: State;
  dispatch: React.Dispatch<Action>;
  toasts: Toast[];
  toast: (kind: Toast["kind"], text: string) => void;
  dismissToast: (id: string) => void;
};
const Ctx = createContext<Store>(null as unknown as Store);

const LS_KEY = "hcc-state-v1";

function load(): State {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const base = (() => {
      if (!raw) return initial;
      const saved = JSON.parse(raw) as Partial<State>;
      // attachments with blob urls don't survive reloads — strip dead urls
      const messages: Record<string, Message[]> = {};
      for (const [k, v] of Object.entries(saved.messages ?? {})) {
        messages[k] = (v as Message[]).map(m =>
          m.attachment?.url?.startsWith("blob:") ? { ...m, attachment: { ...m.attachment, url: undefined } } : m
        );
      }
      return { ...initial, ...saved, messages: Object.keys(messages).length ? messages : initial.messages };
    })();
    if (isConfigured) {
      // connected mode: Supabase is the source of truth — don't show demo
      // seeds or a stale local session; the sync layer hydrates everything.
      return {
        ...base,
        user: null,
        teams: [],
        activeTeam: base.activeTeam,
        messages: {},
        tasks: {},
        milestones: {},
        dms: {},
        authReady: false,
        teamsLoaded: false,
      };
    }
    return { ...base, authReady: true, teamsLoaded: true };
  } catch {
    return initial;
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  useEffect(() => {
    const t = setTimeout(() => localStorage.setItem(LS_KEY, JSON.stringify(state)), 250);
    return () => clearTimeout(t);
  }, [state]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", state.theme === "dark");
  }, [state.theme]);

  const toast = React.useCallback((kind: Toast["kind"], text: string) => {
    const id = uid();
    setToasts(ts => [...ts, { id, kind, text }]);
    setTimeout(() => setToasts(ts => ts.filter(t => t.id !== id)), 4200);
  }, []);
  const dismissToast = React.useCallback((id: string) => setToasts(ts => ts.filter(t => t.id !== id)), []);

  const value = useMemo(() => ({ state, dispatch, toasts, toast, dismissToast }), [state, toasts, toast, dismissToast]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);

export function useTeam(teamId?: string) {
  const { state } = useStore();
  const id = teamId ?? state.activeTeam ?? "";
  return state.teams.find(t => t.id === id) ?? null;
}

export const fmtTime = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
export const fmtDay = (ts: number) =>
  new Date(ts).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
export const fmtSize = (b: number) =>
  b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : b > 1024 ? `${(b / 1024).toFixed(0)} KB` : `${b} B`;
export const initials = (name: string) =>
  name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

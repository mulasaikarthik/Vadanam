/* Supabase ↔ store synchronisation (connected mode only).
   Renders nothing. Hydrates auth session, profile, prefs, teams; loads the
   active team's chat/tasks/roadmap/timer; subscribes to realtime changes. */
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, isConfigured } from "./supabase";
import { useStore } from "./store";
import * as api from "./api";

export function SupabaseSync() {
  const { state, dispatch, toast } = useStore();
  const navigate = useNavigate();
  const lastUid = useRef<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  /* ---- auth session + profile/prefs/teams hydration ---- */
  useEffect(() => {
    if (!isConfigured) return;

    const hydrate = async (sessionUser: { id: string; email?: string; user_metadata?: Record<string, unknown> }) => {
      const uid = sessionUser.id;
      if (lastUid.current === uid) return;
      lastUid.current = uid;

      // INSTANT sign-in: set the user synchronously from the session so the
      // auth guard never bounces back to /signin while the profile loads.
      if (!stateRef.current.user || stateRef.current.user.id !== uid) {
        dispatch({
          type: "patch",
          patch: {
            user: {
              id: uid,
              name: String(sessionUser.user_metadata?.full_name ?? sessionUser.email?.split("@")[0] ?? "You"),
              email: sessionUser.email ?? "",
              color: "#22d3ee",
            },
            authReady: true,
          },
        });
      }

      try {
        const [profile, prefs, teams] = await Promise.all([
          api.fetchProfile(uid),
          api.fetchPrefs(uid).catch(() => null),
          api.fetchTeams(uid),
        ]);
        const keepActive = teams.some(t => t.id === stateRef.current.activeTeam)
          ? stateRef.current.activeTeam : null;
        dispatch({
          type: "patch",
          patch: {
            user: profile,
            teams,
            activeTeam: keepActive,
            teamsLoaded: true,
            authReady: true,
            ...(prefs ? { theme: prefs.theme, prefs: prefs.prefs } : {}),
          },
        });
      } catch (e) {
        toast("error", api.friendlyError(e));
        dispatch({ type: "patch", patch: { authReady: true, teamsLoaded: true } });
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) hydrate(data.session.user);
      else dispatch({ type: "patch", patch: { authReady: true, teamsLoaded: true } });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) hydrate(session.user);
      if (event === "SIGNED_OUT") {
        lastUid.current = null;
        dispatch({ type: "patch", patch: { user: null, teams: [], activeTeam: null, authReady: true, teamsLoaded: true } });
      }
      if (event === "PASSWORD_RECOVERY") {
        toast("info", "Set a new password to finish the reset.");
        navigate("/reset-password");
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []); // eslint-disable-line

  /* ---- active-team data + realtime ---- */
  useEffect(() => {
    if (!isConfigured || !state.user || !state.activeTeam) return;
    const teamId = state.activeTeam;
    let live = true;

    const mergeMessages = (server: Awaited<ReturnType<typeof api.fetchMessages>>) => {
      // keep local messages that are mid-upload (not yet on the server)
      const local = (stateRef.current.messages[teamId] ?? [])
        .filter(m => m.attachment && m.attachment.status !== "done" && !server.some(s => s.id === m.id));
      dispatch({ type: "msg:set", teamId, messages: [...server, ...local].sort((a, b) => a.ts - b.ts) });
    };

    const loaders: Record<string, () => Promise<void>> = {
      messages: async () => mergeMessages(await api.fetchMessages(teamId)),
      attachments: async () => mergeMessages(await api.fetchMessages(teamId)),
      message_reactions: async () => mergeMessages(await api.fetchMessages(teamId)),
      tasks: async () => { const t = await api.fetchTasks(teamId); if (live) dispatch({ type: "task:set", teamId, tasks: t }); },
      milestones: async () => { const m = await api.fetchMilestones(teamId); if (live) dispatch({ type: "ms:set", teamId, milestones: m }); },
      team_timers: async () => { const t = await api.fetchTimer(teamId); if (live && t) dispatch({ type: "patch", patch: { timer: t } }); },
      mentor_messages: async () => { const m = await api.fetchMentor(teamId); if (live) dispatch({ type: "mentor:set", teamId, messages: m }); },
    };

    Promise.all(Object.values(loaders).map(fn => fn().catch(() => undefined)));

    // live presence: mark members online/offline in real time
    const unsubPresence = api.subscribePresence(teamId, state.user.id, onlineIds => {
      const team = stateRef.current.teams.find(t => t.id === teamId);
      if (!team) return;
      const changed = team.members.some(m => m.online !== onlineIds.has(m.id));
      if (changed) {
        dispatch({
          type: "team:update", id: teamId,
          patch: { members: team.members.map(m => ({ ...m, online: onlineIds.has(m.id) })) },
        });
      }
    });

    const timers: Record<string, ReturnType<typeof setTimeout>> = {};
    const refetch = (table: string, delay = 150) => {
      clearTimeout(timers[table]);
      timers[table] = setTimeout(() => { loaders[table]?.().catch(() => undefined); }, delay);
    };
    const unsub = api.subscribeTeam(teamId, (table, evt) => {
      /* fast path: apply chat message events straight from the payload —
         messages appear instantly with no refetch and no page refresh */
      if (table === "messages" && evt) {
        const cur = stateRef.current.messages[teamId] ?? [];
        if (evt.eventType === "INSERT" && evt.new) {
          const msg = api.mapRealtimeMessage(evt.new);
          if (!cur.some(m => m.id === msg.id)) {
            dispatch({ type: "msg:set", teamId, messages: [...cur, msg].sort((a, b) => a.ts - b.ts) });
          }
          return;
        }
        if (evt.eventType === "UPDATE" && evt.new) {
          const msg = api.mapRealtimeMessage(evt.new);
          dispatch({
            type: "msg:set", teamId,
            messages: cur.map(m => m.id === msg.id ? { ...m, text: msg.text, edited: msg.edited } : m),
          });
          return;
        }
        if (evt.eventType === "DELETE" && evt.old?.id) {
          dispatch({ type: "msg:set", teamId, messages: cur.filter(m => m.id !== String(evt.old!.id)) });
          return;
        }
      }
      /* fast path: AI mentor replies appear the instant they're written —
         applied straight from the payload, no refetch, no refresh */
      if (table === "mentor_messages" && evt?.eventType === "INSERT" && evt.new) {
        const row = evt.new as { id: string; role: "user" | "ai"; body: string; created_at: string };
        const cur = stateRef.current.mentor[teamId] ?? [];
        if (cur.some(m => m.id === row.id)) return; // already shown
        // replace a locally-appended copy of the same message (optimistic echo)
        const dupIdx = cur.findIndex(m => m.role === row.role && m.text === row.body && Date.now() - m.ts < 30000);
        const next = dupIdx >= 0
          ? cur.map((m, i) => i === dupIdx ? { ...m, id: row.id } : m)
          : [...cur, { id: row.id, role: row.role, text: row.body, ts: Date.parse(row.created_at) }];
        dispatch({ type: "mentor:set", teamId, messages: next });
        return;
      }
      refetch(table);
    });
    api.markRead(teamId, state.user.id).catch(() => undefined);

    return () => { live = false; unsub(); unsubPresence(); Object.values(timers).forEach(clearTimeout); };
  }, [state.activeTeam, state.user?.id]); // eslint-disable-line

  /* ---- persist prefs/theme (debounced) ---- */
  useEffect(() => {
    if (!isConfigured || !state.user) return;
    const uid = state.user.id;
    const t = setTimeout(() => {
      api.savePrefs(uid, state.theme, state.prefs).catch(() => undefined);
    }, 800);
    return () => clearTimeout(t);
  }, [state.prefs, state.theme, state.user?.id]); // eslint-disable-line

  return null;
}

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Bot, Send, Sparkles, Map, Settings2, FileQuestion } from "lucide-react";
import { Button, Avatar } from "@/components/ui";
import { useStore, useTeam, uid, fmtTime, type MentorMsg } from "@/lib/store";
import { isConfigured } from "@/lib/supabase";
import * as api from "@/lib/api";
import { MessageBodyLite } from "./mentorBody";
import { cn } from "@/utils";

const SUGGESTIONS = [
  "Help me scope an MVP for our problem statement",
  "What should we demo to impress judges?",
  "Our deploy keeps failing — how should we triage with 8 hours left?",
  "Draft a 30-second pitch opening line",
];

function cannedReply(prompt: string, problem: string, hackathon: string): string {
  const p = prompt.toLowerCase();
  if (p.includes("roadmap") || p.includes("plan")) {
    return `Here's how I'd structure your remaining time for **${hackathon}**:\n\n1. Lock scope now — one core flow, one differentiator.\n2. Build a walking skeleton end-to-end before adding depth.\n3. Reserve the final 20% of time for the demo video and submission.\n\nTip: use the **Generate Roadmap** action below to drop this straight into your Roadmap page.`;
  }
  if (p.includes("scope") || p.includes("mvp")) {
    return `Based on your problem statement${problem ? ` ("${problem.slice(0, 90)}…")` : ""}, I'd scope the MVP to exactly three things:\n\n1. **The core flow** — the single path a judge will walk through.\n2. **One differentiator** — the thing nobody else in the room will have.\n3. **A fallback demo path** — recorded or seeded data, in case the live version breaks.\n\nEverything else goes on the "post-hackathon" list. What feels hardest to cut?`;
  }
  if (p.includes("judge") || p.includes("demo") || p.includes("pitch")) {
    return `Judges remember three things: the problem's emotional hook, one "wow" moment, and whether the demo actually worked.\n\n- Open with the user's pain in one sentence.\n- Show the wow moment within the first 45 seconds.\n- End with impact + what you'd build next.\n\nWant me to draft the opening line for your specific problem statement?`;
  }
  if (p.includes("debug") || p.includes("fail") || p.includes("triage") || p.includes("error")) {
    return `With limited time, triage ruthlessly:\n\n\`\`\`txt\n1. Reproduce → can you trigger it reliably?\n2. Bisect   → last known good commit?\n3. Contain  → can you feature-flag it off?\n4. Fallback → can the demo avoid that path?\n\`\`\`\n\nIf a fix takes more than 60 minutes this close to the deadline, ship the workaround and log the fix for later.`;
  }
  return `Good question. Since I'm running in demo mode, here's the general playbook:\n\n- Anchor every decision to your deadline and judging criteria.\n- Prefer boring, working tech over exciting, broken tech.\n- Demo early to a teammate — twice.\n\nAdd your problem statement in Settings and I'll tailor every answer to your project.`;
}

export default function Mentor() {
  const { state, dispatch, toast } = useStore();
  const team = useTeam();
  const navigate = useNavigate();
  const teamId = team?.id ?? "";
  const msgs = state.mentor[teamId] ?? [];
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length, thinking]);

  // if realtime delivers the reply before the request resolves, stop the dots
  useEffect(() => {
    if (thinking && msgs.length && msgs[msgs.length - 1].role === "ai") setThinking(false);
  }, [msgs, thinking]);

  // connected mode: load persisted conversation from mentor_messages
  useEffect(() => {
    if (!isConfigured || !teamId || !state.user) return;
    let on = true;
    api.fetchMentor(teamId)
      .then(h => { if (on && h.length) dispatch({ type: "mentor:set", teamId, messages: h }); })
      .catch(() => undefined);
    return () => { on = false; };
  }, [teamId, state.user?.id]); // eslint-disable-line

  const send = (text?: string) => {
    const t = (text ?? draft).trim();
    if (!t || thinking) return;
    if (t.length > 4000) { toast("error", "Keep questions under 4,000 characters."); return; }
    const userMsg: MentorMsg = { id: uid(), role: "user", text: t, ts: Date.now() };
    const base = [...msgs, userMsg];
    dispatch({ type: "mentor:set", teamId, messages: base });
    setDraft("");
    setThinking(true);

    /* ---- connected mode: Gemini via the gemini-chat Edge Function ---- */
    if (isConfigured && state.user) {
      api.askMentor(teamId, t)
        .then(reply => {
          // realtime may have already delivered this reply — don't duplicate
          const cur = stateRef.current.mentor[teamId] ?? base;
          if (cur.some(m => m.role === "ai" && m.text === reply)) return;
          dispatch({
            type: "mentor:set", teamId,
            messages: [...cur, { id: uid(), role: "ai", text: reply, ts: Date.now() }],
          });
        })
        .catch(e => {
          toast("error", api.friendlyError(e));
          // keep the user's message visible; they can retry
        })
        .finally(() => setThinking(false));
      return;
    }

    setTimeout(() => {
      dispatch({
        type: "mentor:set", teamId,
        messages: [...base, { id: uid(), role: "ai", text: cannedReply(t, team?.problem ?? "", team?.hackathon ?? "your hackathon"), ts: Date.now() }],
      });
      setThinking(false);
    }, 1200 + Math.random() * 700);
  };

  return (
    <div className="h-full flex flex-col">
      {/* header */}
      <div className="flex items-center gap-3 px-4 sm:px-6 h-14 border-b border-ink-200/60 dark:border-white/8 shrink-0 bg-white/50 dark:bg-ink-900/40 backdrop-blur-xl">
        <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-400 to-violet-600 flex items-center justify-center"><Bot className="w-4.5 h-4.5 text-white" /></span>
        <div>
          <h1 className="font-bold text-[15px] text-ink-900 dark:text-white leading-none">AI Mentor</h1>
          <p className="text-[10.5px] text-ink-400 mt-1">Grounded in your team's problem statement</p>
        </div>

      </div>

      {/* config banner (demo mode only) */}
      {!isConfigured && (
        <div className="px-4 sm:px-6 pt-3 shrink-0">
          <div className="max-w-3xl mx-auto rounded-xl border border-amber-400/30 bg-amber-400/8 px-4 py-2.5 flex items-center gap-2.5 text-[12.5px] text-amber-600 dark:text-amber-300">
            <Settings2 className="w-4 h-4 shrink-0" />
            <span>The mentor is warming up — answers may be limited until setup completes.</span>
          </div>
        </div>
      )}

      <div ref={listRef} className="chat-scroll flex-1 overflow-y-auto px-4 sm:px-6 py-4">
        <div className="max-w-3xl mx-auto">
          {/* project context card */}
          <div className="glass p-4 mb-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400 mb-2 flex items-center gap-1.5"><FileQuestion className="w-3.5 h-3.5" /> Project context</p>
            <p className="text-[13px] text-ink-700 dark:text-ink-100 font-semibold">{team?.name} · {team?.hackathon}</p>
            <p className="text-[12.5px] text-ink-500 dark:text-ink-300 mt-1.5 leading-relaxed">
              {team?.problem || "No problem statement yet — add one in Team Settings so the mentor can give project-specific advice."}
            </p>
          </div>

          {msgs.length === 0 && (
            <div className="text-center py-6">
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-violet-600 flex items-center justify-center mx-auto mb-4 shadow-[0_8px_30px_rgba(139,92,246,0.4)]">
                <Sparkles className="w-6 h-6 text-white" />
              </motion.div>
              <h2 className="font-bold text-ink-900 dark:text-white">Ask me anything about your build</h2>
              <p className="text-[13px] text-ink-400 mt-1.5 max-w-sm mx-auto">Architecture decisions, scoping, pitch strategy, debugging under pressure — I'm tuned for hackathons.</p>
              <div className="flex flex-wrap justify-center gap-2 mt-5">
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => send(s)}
                    className="text-[12.5px] rounded-full border border-cyan-400/40 text-cyan-600 dark:text-cyan-300 px-3.5 py-2 hover:bg-cyan-400/10 transition-colors text-left">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            {msgs.map(m => (
              <div key={m.id} className={cn("flex gap-2.5", m.role === "user" && "flex-row-reverse")}>
                {m.role === "ai"
                  ? <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-400 to-violet-600 flex items-center justify-center shrink-0"><Bot className="w-4 h-4 text-white" /></span>
                  : <Avatar name={state.user?.name ?? "You"} color="#22d3ee" size={32} src={state.user?.avatarUrl} />}
                <div className={cn("max-w-[82%]")}>
                  <div className={cn("rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed",
                    m.role === "user"
                      ? "bg-gradient-to-br from-cyan-500/90 to-violet-500/90 text-white rounded-tr-md"
                      : "bg-white dark:bg-white/7 border border-ink-200/60 dark:border-white/8 text-ink-800 dark:text-ink-50 rounded-tl-md")}>
                    <MessageBodyLite text={m.text} />
                  </div>
                  <p className={cn("text-[10.5px] text-ink-400 mt-1", m.role === "user" && "text-right")}>{fmtTime(m.ts)}</p>
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-400 to-violet-600 flex items-center justify-center shrink-0"><Bot className="w-4 h-4 text-white" /></span>
                <div className="rounded-2xl rounded-tl-md bg-white dark:bg-white/7 border border-ink-200/60 dark:border-white/8 px-4 py-3.5 flex gap-1.5">
                  {[0, 1, 2].map(i => (
                    <motion.span key={i} className="w-2 h-2 rounded-full bg-violet-400"
                      animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.1, delay: i * 0.2 }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* composer */}
      <div className="px-4 sm:px-6 pb-4 pt-1 shrink-0">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
            <Button variant="outline" size="sm" className="shrink-0" onClick={() => { navigate(`/team/${teamId}/roadmap`); toast("info", "Use Generate Roadmap here to build your plan."); }}>
              <Map className="w-3.5 h-3.5" /> Generate Roadmap from this chat
            </Button>
            {msgs.length > 0 && SUGGESTIONS.slice(0, 2).map(s => (
              <button key={s} onClick={() => send(s)} className="shrink-0 text-[11.5px] rounded-full border border-ink-200 dark:border-white/12 text-ink-500 dark:text-ink-300 px-3 py-1.5 hover:border-cyan-400/50 transition-colors">{s}</button>
            ))}
          </div>
          <div className="glass flex items-end gap-2 px-3.5 py-2.5">
            <textarea
              rows={1}
              value={draft}
              onChange={e => { setDraft(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px"; }}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask the mentor… (Enter to send)"
              aria-label="Mentor message composer"
              className="flex-1 bg-transparent outline-none resize-none text-[13.5px] text-ink-900 dark:text-ink-50 placeholder:text-ink-400 py-1.5 max-h-36"
            />
            <Button size="sm" onClick={() => send()} disabled={!draft.trim() || thinking} disabledReason={thinking ? "Mentor is thinking…" : "Type a question first"} className="!rounded-xl !px-3.5 !py-2.5" aria-label="Send">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

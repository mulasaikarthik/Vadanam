import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  TimerIcon, Play, Pause, RotateCcw, Maximize2, PictureInPicture2, Bell, Volume2,
  AlertTriangle, PartyPopper, Minimize2, X, Settings2,
} from "lucide-react";
import { Button, Field, Toggle, Badge, Tooltip } from "@/components/ui";
import { useStore, type TimerState } from "@/lib/store";
import { isConfigured } from "@/lib/supabase";
import * as api from "@/lib/api";
import { useCountdown, pad } from "./Layout";
import { Particles } from "@/components/fx";
import { cn } from "@/utils";

function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880; o.type = "sine";
    g.gain.setValueAtTime(0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    o.start(); o.stop(ctx.currentTime + 0.5);
  } catch { /* no audio available */ }
}

function Digits({ d, h, m, s, scale = 1, compact }: { d: number; h: number; m: number; s: number; scale?: number; compact?: boolean }) {
  const cells = [...(d > 0 || !compact ? [[d, "days"]] : []), [h, "hours"], [m, "min"], [s, "sec"]] as [number, string][];
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3" style={{ transform: `scale(${scale})`, transformOrigin: "center" }}>
      {cells.map(([v, l], i) => (
        <div key={l} className="flex items-center gap-2 sm:gap-3">
          <div className={cn("rounded-2xl bg-ink-900 dark:bg-white/6 border border-white/10 text-center", compact ? "px-3 py-2 min-w-[62px]" : "px-4 sm:px-6 py-3 sm:py-5 min-w-[76px] sm:min-w-[110px]")}>
            <p className={cn("font-mono font-extrabold text-white tabular-nums", compact ? "text-2xl" : "text-4xl sm:text-6xl")}>{pad(v)}</p>
            <p className={cn("uppercase tracking-[0.2em] text-ink-400 font-semibold", compact ? "text-[8px] mt-0.5" : "text-[9px] sm:text-[10px] mt-1.5")}>{l}</p>
          </div>
          {i < cells.length - 1 && <span className={cn("font-mono text-ink-400 font-bold", compact ? "text-xl" : "text-3xl sm:text-5xl")}>:</span>}
        </div>
      ))}
    </div>
  );
}

export default function Timer() {
  const { state, dispatch, toast } = useStore();
  const cd = useCountdown();
  const [label, setLabel] = useState(state.timer.label);
  const [customH, setCustomH] = useState("36");
  const [deadlineInput, setDeadlineInput] = useState("");
  const [compact, setCompact] = useState(false);
  const [scale, setScale] = useState(1);
  const [opacity, setOpacity] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const warned = useRef(false);
  const dinged = useRef(false);

  // completion + warning side-effects
  useEffect(() => {
    if (cd.done && cd.status === "running" && !dinged.current) {
      dinged.current = true;
      dispatch({ type: "patch", patch: { timer: { ...state.timer, status: "done", remaining: 0 } } });
      if (state.prefs.sound) beep();
      toast("info", "⏰ Time's up! The deadline has arrived.");
      if (state.prefs.notifications && "Notification" in window && Notification.permission === "granted")
        new Notification("Vadanam", { body: `${state.timer.label} — time's up!` });
    }
    if (cd.warning && !warned.current) {
      warned.current = true;
      if (state.prefs.sound) beep();
      toast("error", "⚠️ Under 2 hours remaining. Shift to submission mode.");
    }
  }, [cd.done, cd.warning]); // eslint-disable-line

  /** apply locally + persist to the team's shared timer when connected */
  const applyTimer = (next: TimerState) => {
    dispatch({ type: "patch", patch: { timer: next } });
    if (isConfigured && state.user && state.activeTeam) {
      api.saveTimer(state.activeTeam, state.user.id, next).catch(e => toast("error", api.friendlyError(e)));
    }
  };

  const start = () => {
    const t = state.timer;
    if (t.status === "paused" && t.remaining != null) {
      applyTimer({ ...t, status: "running", deadline: Date.now() + t.remaining, remaining: null });
    } else {
      applyTimer({ ...t, status: "running", deadline: Date.now() + t.duration, remaining: null });
    }
    warned.current = false; dinged.current = false;
  };
  const pause = () => {
    if (state.timer.status !== "running" || !state.timer.deadline) return;
    applyTimer({ ...state.timer, status: "paused", remaining: Math.max(0, state.timer.deadline - Date.now()), deadline: null });
  };
  const reset = () => {
    applyTimer({ ...state.timer, status: "idle", deadline: null, remaining: null });
    warned.current = false; dinged.current = false;
  };
  const applyDuration = () => {
    const h = parseFloat(customH);
    if (!h || h <= 0 || h > 240) { toast("error", "Enter a duration between 0 and 240 hours."); return; }
    const duration = h * 3600000;
    applyTimer({ ...state.timer, label, duration, status: "running", deadline: Date.now() + duration, remaining: null });
    warned.current = false; dinged.current = false;
    toast("success", `Timer set: ${h} hours on the clock.`);
  };
  const applyDeadline = () => {
    if (!deadlineInput) { toast("error", "Pick a deadline date & time first."); return; }
    const target = new Date(deadlineInput).getTime();
    if (target <= Date.now()) { toast("error", "That deadline is in the past — pick a future time."); return; }
    applyTimer({ ...state.timer, label, duration: target - Date.now(), status: "running", deadline: target, remaining: null });
    warned.current = false; dinged.current = false;
    toast("success", "Timer locked to your event deadline. It won't drift, even if the tab sleeps.");
  };

  const askNotify = async (v: boolean) => {
    if (v && "Notification" in window && Notification.permission !== "granted") {
      const p = await Notification.requestPermission();
      if (p !== "granted") { toast("error", "Notifications were blocked by the browser."); return; }
    }
    dispatch({ type: "patch", patch: { prefs: { ...state.prefs, notifications: v } } });
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) { await document.documentElement.requestFullscreen(); setFullscreen(true); }
      else { await document.exitFullscreen(); setFullscreen(false); }
    } catch { setFullscreen(f => !f); }
  };

  const statusBadge = cd.done
    ? <Badge tone="rose"><PartyPopper className="w-3 h-3" /> Completed — time's up</Badge>
    : cd.warning
    ? <Badge tone="amber"><AlertTriangle className="w-3 h-3" /> Final stretch — under 2 hours</Badge>
    : cd.status === "running" ? <Badge tone="green">Running · deadline-anchored</Badge>
    : cd.status === "paused" ? <Badge tone="violet">Paused</Badge>
    : <Badge tone="gray">Idle</Badge>;

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[90] bg-ink-950 flex flex-col items-center justify-center overflow-hidden" style={{ opacity }}>
        <Particles density={45} />
        <button onClick={toggleFullscreen} aria-label="Exit fullscreen" className="absolute top-5 right-5 p-2.5 rounded-xl text-ink-400 hover:text-white hover:bg-white/10 z-10">
          <Minimize2 className="w-5 h-5" />
        </button>
        <p className="text-sm sm:text-base font-bold tracking-[0.3em] text-cyan-300 uppercase mb-8 relative">{state.timer.label}</p>
        <div className="relative"><Digits d={cd.d} h={cd.h} m={cd.m} s={cd.s} scale={Math.min(scale * 1.15, 1.4)} /></div>
        <div className="mt-10 relative">{statusBadge}</div>
        {cd.status === "running" && (
          <div className="mt-8 w-72 h-1.5 rounded-full bg-white/10 overflow-hidden relative">
            <div className={cn("h-full rounded-full", cd.warning ? "bg-amber-400" : "bg-gradient-to-r from-cyan-400 to-violet-500")} style={{ width: `${cd.pct * 100}%` }} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <TimerIcon className="w-5 h-5 text-cyan-500" />
          <h1 className="text-xl font-extrabold text-ink-900 dark:text-white tracking-tight">Live Hackathon Countdown</h1>
          <div className="ml-auto flex gap-2">
            <Tooltip label="Open the floating timer in its own route — keep it in a slim side window">
              <Link to="/timer/floating" target="_blank"><Button variant="secondary" size="sm"><PictureInPicture2 className="w-3.5 h-3.5" /> Floating Timer</Button></Link>
            </Tooltip>
            <Button variant="secondary" size="sm" onClick={toggleFullscreen}><Maximize2 className="w-3.5 h-3.5" /> Fullscreen</Button>
          </div>
        </div>

        {/* main timer card */}
        <motion.div layout className={cn("glass-strong p-6 sm:p-10 text-center relative overflow-hidden", cd.warning && "!border-amber-400/40", cd.done && "!border-rose-400/40")}
          style={{ opacity }}>
          {cd.warning && <div className="absolute inset-0 bg-amber-400/5 animate-pulse-soft pointer-events-none" />}
          <p className="text-[12px] font-bold tracking-[0.25em] text-ink-400 uppercase mb-1.5">{state.timer.label}</p>
          <div className="mb-6">{statusBadge}</div>
          <Digits d={cd.d} h={cd.h} m={cd.m} s={cd.s} scale={scale} compact={compact} />
          {cd.status !== "idle" && !cd.done && (
            <div className="mt-7 h-2 rounded-full bg-ink-200/70 dark:bg-white/8 overflow-hidden max-w-md mx-auto">
              <div className={cn("h-full rounded-full transition-all duration-1000", cd.warning ? "bg-gradient-to-r from-amber-400 to-rose-400" : "bg-gradient-to-r from-cyan-400 to-violet-500")} style={{ width: `${cd.pct * 100}%` }} />
            </div>
          )}
          {cd.done && (
            <p className="mt-6 text-rose-500 font-bold flex items-center justify-center gap-2"><PartyPopper className="w-5 h-5" /> Deadline reached — hope you submitted early! 🎉</p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-2.5 mt-8">
            {cd.status === "running" ? (
              <Button variant="secondary" onClick={pause}><Pause className="w-4 h-4" /> Pause</Button>
            ) : (
              <Button onClick={start}><Play className="w-4 h-4" /> {cd.status === "paused" ? "Resume" : "Start"}</Button>
            )}
            <Button variant="ghost" onClick={reset}><RotateCcw className="w-4 h-4" /> Reset</Button>
          </div>
        </motion.div>

        {/* configuration */}
        <div className="grid md:grid-cols-2 gap-4 mt-5">
          <div className="glass p-5">
            <p className="font-bold text-[14px] text-ink-900 dark:text-white mb-4 flex items-center gap-2"><Settings2 className="w-4 h-4 text-cyan-500" /> Event & deadline</p>
            <div className="space-y-3.5">
              <Field label="Event name" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. HackSprint 2026 — Final Submission" />
              <div className="flex gap-2 items-end">
                <div className="flex-1"><Field label="Exact deadline" type="datetime-local" value={deadlineInput} onChange={e => setDeadlineInput(e.target.value)} /></div>
                <Button size="sm" onClick={applyDeadline} className="mb-0.5">Set</Button>
              </div>
              <div className="flex gap-2 items-end">
                <div className="flex-1"><Field label="…or custom duration (hours)" type="number" min={1} max={240} value={customH} onChange={e => setCustomH(e.target.value)} /></div>
                <Button size="sm" variant="secondary" onClick={applyDuration} className="mb-0.5">Start</Button>
              </div>
              <p className="text-[11px] text-ink-400 leading-relaxed">Timing is anchored to the real deadline timestamp — it stays exact even if the tab sleeps or your laptop lids shut.</p>
            </div>
          </div>

          <div className="glass p-5">
            <p className="font-bold text-[14px] text-ink-900 dark:text-white mb-4">Display & alerts</p>
            <div className="space-y-4">
              <label className="flex items-center justify-between gap-3 text-[13px] text-ink-600 dark:text-ink-200">
                <span>Compact mode (hide days when zero)</span>
                <Toggle checked={compact} onChange={setCompact} label="Compact mode" />
              </label>
              <div>
                <p className="text-[13px] text-ink-600 dark:text-ink-200 mb-1.5 flex justify-between"><span>Size</span><span className="text-ink-400">{Math.round(scale * 100)}%</span></p>
                <input type="range" min={0.6} max={1.25} step={0.05} value={scale} onChange={e => setScale(parseFloat(e.target.value))} className="w-full" aria-label="Timer size" />
              </div>
              <div>
                <p className="text-[13px] text-ink-600 dark:text-ink-200 mb-1.5 flex justify-between"><span>Opacity</span><span className="text-ink-400">{Math.round(opacity * 100)}%</span></p>
                <input type="range" min={0.35} max={1} step={0.05} value={opacity} onChange={e => setOpacity(parseFloat(e.target.value))} className="w-full" aria-label="Timer opacity" />
              </div>
              <label className="flex items-center justify-between gap-3 text-[13px] text-ink-600 dark:text-ink-200">
                <span className="flex items-center gap-2"><Volume2 className="w-4 h-4 text-ink-400" /> Sound on warnings & completion</span>
                <Toggle checked={state.prefs.sound} onChange={v => dispatch({ type: "patch", patch: { prefs: { ...state.prefs, sound: v } } })} label="Sound" />
              </label>
              <label className="flex items-center justify-between gap-3 text-[13px] text-ink-600 dark:text-ink-200">
                <span className="flex items-center gap-2"><Bell className="w-4 h-4 text-ink-400" /> Browser notifications</span>
                <Toggle checked={state.prefs.notifications} onChange={askNotify} label="Notifications" />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- floating timer route ---------------- */
export function FloatingTimer() {
  const { state } = useStore();
  const cd = useCountdown();
  const [opacity, setOpacity] = useState(0.95);
  return (
    <div className="min-h-screen bg-ink-950 flex flex-col items-center justify-center p-4 relative overflow-hidden" style={{ opacity }}>
      <Particles density={25} />
      <Link to="/" aria-label="Close floating timer" className="absolute top-3 right-3 p-2 rounded-lg text-ink-500 hover:text-white hover:bg-white/10 z-10"><X className="w-4 h-4" /></Link>
      <p className="text-[10px] font-bold tracking-[0.3em] text-cyan-300 uppercase mb-4 text-center relative">{state.timer.label}</p>
      <div className="relative"><Digits d={cd.d} h={cd.h} m={cd.m} s={cd.s} compact scale={1} /></div>
      {cd.status === "running" && (
        <div className="mt-5 w-48 h-1 rounded-full bg-white/10 overflow-hidden relative">
          <div className={cn("h-full rounded-full", cd.warning ? "bg-amber-400" : "bg-gradient-to-r from-cyan-400 to-violet-500")} style={{ width: `${cd.pct * 100}%` }} />
        </div>
      )}
      <p className="mt-4 text-[10px] text-ink-500 relative">{cd.done ? "⏰ Time's up" : cd.status === "paused" ? "Paused" : "Keep this window beside your editor"}</p>
      <div className="mt-5 w-40 relative">
        <input type="range" min={0.4} max={1} step={0.05} value={opacity} onChange={e => setOpacity(parseFloat(e.target.value))} className="w-full" aria-label="Window opacity" />
      </div>
    </div>
  );
}

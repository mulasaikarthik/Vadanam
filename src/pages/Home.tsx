import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Rocket, MessageSquare, FileUp, Link2, Bot, Map, TimerIcon, ListChecks, Siren,
  ChevronDown, Menu, X, Zap, Moon, Sun, ArrowRight, Paperclip, Smile, Send,
  FileCode2, Image as ImageIcon, CheckCircle2, Users, Sparkles, ShieldCheck, Clock3
} from "lucide-react";
import { Particles, Reveal, Tilt, Page } from "@/components/fx";
import { BrandIcon } from "@/components/brand";
import { Button, Avatar, Badge } from "@/components/ui";
import { useStore } from "@/lib/store";
import { cn } from "@/utils";

/* ================= NAV ================= */
export function Logo({ small }: { small?: boolean }) {
  return (
    <span className="flex items-center gap-2.5 select-none">
      <BrandIcon
        name="logo"
        size={36}
        rounded
        className="!rounded-xl"
        fallback={
          <span className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 via-sky-500 to-violet-600 flex items-center justify-center shadow-[0_4px_18px_rgba(99,102,241,0.45)]">
            <Zap className="w-5 h-5 text-white" fill="currentColor" />
          </span>
        }
      />
      {!small && (
        <span className="leading-none">
          <span className="block font-extrabold tracking-tight text-[16px] text-ink-900 dark:text-white">VADANAM</span>
          <span className="block text-[9px] font-bold tracking-[0.3em] text-gradient">BUILD · BEAT THE DEADLINE</span>
        </span>
      )}
    </span>
  );
}

export function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function Nav() {
  const [open, setOpen] = useState(false);
  const { state, dispatch } = useStore();
  const links = [
    { label: "Features", href: "features" },
    { label: "Team Chat", href: "chat" },
    { label: "AI Mentor", href: "mentor" },
    { label: "Live Timer", href: "timer" },
  ];
  return (
    <header className="fixed top-0 inset-x-0 z-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-3">
        <nav className="glass !rounded-2xl flex items-center justify-between px-4 sm:px-5 h-14">
          <Link to="/" aria-label="Vadanam home"><Logo /></Link>
          <div className="hidden lg:flex items-center gap-1">
            {links.map(l => (
              <button key={l.href} onClick={() => scrollToId(l.href)} className="px-3.5 py-2 rounded-lg text-[13.5px] font-medium text-ink-500 dark:text-ink-200 hover:text-ink-900 dark:hover:text-white hover:bg-ink-100/70 dark:hover:bg-white/8 transition-colors">
                {l.label}
              </button>
            ))}
          </div>
          <div className="hidden lg:flex items-center gap-2">
            <button
              onClick={() => dispatch({ type: "patch", patch: { theme: state.theme === "dark" ? "light" : "dark" } })}
              aria-label="Toggle theme"
              className="p-2 rounded-lg text-ink-400 hover:text-ink-700 dark:hover:text-white hover:bg-ink-100 dark:hover:bg-white/8 transition-colors"
            >
              {state.theme === "dark" ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
            </button>
            <Link to="/signin"><Button variant="ghost" size="sm" className="!text-[13px]">Sign In</Button></Link>
            <Link to="/signup"><Button size="sm" className="!text-[13px] !px-4 !py-2">Get Started</Button></Link>
          </div>
          <button className="lg:hidden p-2 text-ink-600 dark:text-ink-100" onClick={() => setOpen(o => !o)} aria-label="Toggle menu">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </nav>
        {open && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="lg:hidden glass-strong mt-2 p-4 space-y-1">
            {links.map(l => (
              <button key={l.href} onClick={() => { setOpen(false); scrollToId(l.href); }} className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-ink-600 dark:text-ink-100 hover:bg-ink-100 dark:hover:bg-white/8">{l.label}</button>
            ))}
            <div className="flex gap-2 pt-2">
              <Link to="/signin" className="flex-1"><Button variant="secondary" className="w-full">Sign In</Button></Link>
              <Link to="/signup" className="flex-1"><Button className="w-full">Get Started</Button></Link>
            </div>
          </motion.div>
        )}
      </div>
    </header>
  );
}

/* ================= HERO MOCKUP ================= */
function HeroMockup() {
  return (
    <div className="relative mx-auto max-w-5xl mt-14 px-2">
      <div className="absolute -inset-10 bg-gradient-to-r from-cyan-500/14 via-violet-500/14 to-pink-500/10 blur-3xl rounded-full pointer-events-none" />
      <Tilt max={4}>
        <div className="glass-strong glow-border relative p-3 sm:p-4 grid md:grid-cols-[1fr_280px] gap-3 text-left">
          {/* chat panel */}
          <div className="rounded-xl bg-white/60 dark:bg-ink-900/70 border border-ink-200/50 dark:border-white/8 p-4 min-h-[300px] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-ink-200/50 dark:border-white/8">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center text-base">🚀</span>
                <div>
                  <p className="text-[13px] font-bold text-ink-900 dark:text-white leading-none">Nebula Crew</p>
                  <p className="text-[11px] text-emerald-500 mt-1 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />3 online</p>
                </div>
              </div>
              <div className="flex -space-x-2">
                {["#22d3ee", "#8b5cf6", "#e556b4"].map((c, i) => (
                  <span key={i} className="w-6 h-6 rounded-full border-2 border-white dark:border-ink-900" style={{ background: c }} />
                ))}
              </div>
            </div>
            <div className="flex-1 py-3 space-y-3 text-[12.5px]">
              <div className="flex gap-2">
                <Avatar name="Ava Chen" color="#8b5cf6" size={26} />
                <div className="rounded-xl rounded-tl-sm bg-ink-100/80 dark:bg-white/7 px-3 py-2 text-ink-700 dark:text-ink-100 max-w-[75%]">Route engine is live on staging 🎉</div>
              </div>
              <div className="flex gap-2">
                <Avatar name="Mia Torres" color="#34d399" size={26} />
                <div className="rounded-xl rounded-tl-sm bg-ink-100/80 dark:bg-white/7 px-3 py-2 max-w-[75%]">
                  <div className="flex items-center gap-2 text-ink-700 dark:text-ink-100"><FileCode2 className="w-4 h-4 text-cyan-500" /> scoring.ts <span className="text-[10px] text-ink-400">4.2 KB</span></div>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <div className="rounded-xl rounded-tr-sm bg-gradient-to-r from-cyan-500/90 to-violet-500/90 text-white px-3 py-2 max-w-[75%]">Merging now — demo video next ✅</div>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-ink-200/60 dark:border-white/10 px-3 py-2">
              <Paperclip className="w-4 h-4 text-ink-400" /><Smile className="w-4 h-4 text-ink-400" />
              <span className="flex-1 text-[12px] text-ink-400">Message Nebula Crew…</span>
              <span className="w-7 h-7 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 flex items-center justify-center"><Send className="w-3.5 h-3.5 text-white" /></span>
            </div>
          </div>
          {/* right column: timer + files */}
          <div className="flex md:flex-col gap-3">
            <div className="flex-1 rounded-xl bg-gradient-to-br from-ink-900 to-ink-800 dark:from-ink-850 dark:to-ink-900 border border-white/10 p-4 text-center">
              <p className="text-[10px] font-bold tracking-[0.2em] text-cyan-300 uppercase">Submission in</p>
              <div className="flex justify-center gap-1.5 mt-3 font-mono">
                {[["26", "hrs"], ["14", "min"], ["52", "sec"]].map(([v, l]) => (
                  <div key={l} className="rounded-lg bg-white/8 px-2 py-1.5 min-w-[46px]">
                    <p className="text-lg font-bold text-white leading-none">{v}</p>
                    <p className="text-[9px] text-ink-300 mt-1 uppercase">{l}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" />
              </div>
            </div>
            <div className="flex-1 rounded-xl bg-white/60 dark:bg-ink-900/70 border border-ink-200/50 dark:border-white/8 p-4 space-y-2.5">
              <p className="text-[11px] font-bold text-ink-500 dark:text-ink-300 uppercase tracking-wider">Shared files</p>
              {[
                { icon: <ImageIcon className="w-4 h-4 text-pink-400" />, n: "pitch-deck.png" },
                { icon: <FileCode2 className="w-4 h-4 text-cyan-400" />, n: "route-engine.ts" },
                { icon: <FileUp className="w-4 h-4 text-violet-400" />, n: "demo-script.pdf" },
              ].map(f => (
                <div key={f.n} className="flex items-center gap-2 text-[12px] text-ink-600 dark:text-ink-200">
                  {f.icon}<span className="truncate">{f.n}</span><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 ml-auto" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </Tilt>
    </div>
  );
}

/* ================= FEATURES ================= */
const FEATURES = [
  {
    id: "chat", icon: <MessageSquare />, tone: "cyan",
    title: "Real-Time Team Chat",
    body: "A fast, focused messaging space built for sprints — replies, reactions, edits, search and code blocks with syntax highlighting.",
    useCase: "Use case: your backend dev pastes a failing stack trace at 2 AM; teammates reply in a thread without derailing the main channel.",
  },
  {
    id: "files", icon: <FileUp />, tone: "violet",
    title: "Images, Videos, Documents & Code Sharing",
    body: "Drag anything into the chat. Inline image previews, video playback, document cards and highlighted code snippets with one-click download.",
    useCase: "Use case: your designer drops the pitch-deck PNGs and the demo MP4 straight into chat — no email, no third-party drive links.",
  },
  {
    id: "invites", icon: <Link2 />, tone: "magenta",
    title: "Team Invitation Links",
    body: "Spin up a secure invite link, share it anywhere, and teammates land directly in your workspace — with expiry and capacity controls.",
    useCase: "Use case: you meet a great ML engineer at the opening ceremony; one link on their phone and they're in your team before the keynote ends.",
  },
  {
    id: "mentor", icon: <Bot />, tone: "cyan",
    title: "AI Hackathon Mentor",
    body: "A mentor that knows your problem statement. Ask about architecture, scoping, pitch strategy or debugging — grounded in your project context.",
    useCase: "Use case: 6 hours in, you're unsure whether to cut a feature. The mentor weighs it against your deadline and judging criteria.",
  },
  {
    id: "roadmap", icon: <Map />, tone: "violet",
    title: "AI Roadmap Generator",
    body: "Turn a problem statement into a milestone-by-milestone build plan with priorities, dependencies and acceptance criteria.",
    useCase: "Use case: paste your problem statement Friday night and get a realistic 36-hour plan your whole team can rally around.",
  },
  {
    id: "timer", icon: <TimerIcon />, tone: "magenta",
    title: "Live Hackathon Countdown",
    body: "A deadline-anchored timer that never drifts — fullscreen mode, floating widget, warnings and sound alerts as the clock runs down.",
    useCase: "Use case: pin the floating timer over your editor so the whole team feels the final 2 hours without alt-tabbing.",
  },
  {
    id: "tasks", icon: <ListChecks />, tone: "cyan",
    title: "Team Tasks & Milestones",
    body: "Lightweight tasks tied to roadmap milestones. Assign, prioritize and check off — visible to the whole crew at a glance.",
    useCase: "Use case: at the halfway sync, you instantly see the demo script is unassigned — and fix it in two clicks.",
  },
  {
    id: "panic", icon: <Siren />, tone: "magenta",
    title: "Submission Readiness & Panic Mode",
    body: "A pre-flight checklist for your submission — repo, video, Devpost page — plus Panic Mode that re-prioritizes what truly ships.",
    useCase: "Use case: 90 minutes left and the deploy fails. Panic Mode cuts nice-to-haves and surfaces the shortest path to a valid submission.",
  },
] as const;

function FeatureIllustration({ id }: { id: string }) {
  // compact stylized visuals per feature
  const base = "rounded-2xl p-5 h-56 flex flex-col justify-center border border-ink-200/50 dark:border-white/10 bg-gradient-to-br from-white/70 to-white/40 dark:from-ink-850/90 dark:to-ink-900/70 relative overflow-hidden";
  const glow = <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-violet-500/15 blur-3xl" />;
  switch (id) {
    case "chat":
      return (
        <div className={base}>{glow}
          {[["Ava", "#8b5cf6", "Deploy is green ✅"], ["Dev", "#e556b4", "Shipping the map layer"], ["Mia", "#34d399", "🔥🔥🔥"]].map(([, c, t], i) => (
            <div key={i} className={cn("flex gap-2 items-center mb-2.5", i === 2 && "justify-end")}>
              {i !== 2 && <span className="w-6 h-6 rounded-full shrink-0" style={{ background: c }} />}
              <span className={cn("rounded-xl px-3 py-1.5 text-[12px]", i === 2 ? "bg-gradient-to-r from-cyan-500 to-violet-500 text-white" : "bg-ink-100 dark:bg-white/8 text-ink-700 dark:text-ink-100")}>{t}</span>
            </div>
          ))}
          <div className="h-8 rounded-lg border border-dashed border-ink-300/50 dark:border-white/15 flex items-center px-3 text-[11px] text-ink-400">Type a message…</div>
        </div>
      );
    case "files":
      return (
        <div className={base}>{glow}
          <div className="grid grid-cols-2 gap-2.5">
            {[["pitch.png", "🖼️"], ["demo.mp4", "🎬"], ["spec.pdf", "📄"], ["app.tsx", "🧩"]].map(([n, e]) => (
              // eslint-disable-next-line
              <div key={n} className="rounded-xl bg-ink-100/70 dark:bg-white/7 p-3 flex items-center gap-2.5">
                <span className="text-xl">{e}</span>
                <div className="min-w-0"><p className="text-[12px] font-semibold text-ink-700 dark:text-ink-100 truncate">{n}</p>
                  <div className="h-1 mt-1.5 rounded bg-ink-200 dark:bg-white/10"><div className="h-full w-4/5 rounded bg-gradient-to-r from-cyan-400 to-violet-500" /></div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-[11px] text-ink-400 mt-3 border border-dashed border-ink-300/50 dark:border-white/15 rounded-lg py-2">Drop files anywhere to upload</p>
        </div>
      );
    case "invites":
      return (
        <div className={base + " items-center text-center"}>{glow}
          <span className="w-12 h-12 rounded-2xl bg-pink-500/15 text-pink-500 flex items-center justify-center mb-3"><Link2 className="w-6 h-6" /></span>
          <code className="text-[11px] bg-ink-900 text-cyan-300 rounded-lg px-3 py-2 font-mono">hcc.app/join/•••-•••</code>
          <div className="flex -space-x-2 mt-4">
            {["#22d3ee", "#8b5cf6", "#e556b4", "#34d399"].map((c, i) => <span key={i} className="w-8 h-8 rounded-full border-2 border-white dark:border-ink-900" style={{ background: c }} />)}
            <span className="w-8 h-8 rounded-full border-2 border-dashed border-ink-300 dark:border-white/30 flex items-center justify-center text-[11px] text-ink-400 bg-white/60 dark:bg-ink-900">+2</span>
          </div>
          <p className="text-[11px] text-ink-400 mt-2">4 of 6 seats filled · expires in 48h</p>
        </div>
      );
    case "mentor":
      return (
        <div className={base}>{glow}
          <div className="flex gap-2 mb-3">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-400 to-violet-600 flex items-center justify-center"><Bot className="w-4 h-4 text-white" /></span>
            <div className="rounded-xl bg-ink-100 dark:bg-white/8 px-3 py-2 text-[12px] text-ink-700 dark:text-ink-100">Given 26h left, I'd cut offline mode and ship route scoring + the demo. Here's why…</div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["Scope my MVP", "Review my pitch", "Debug strategy"].map(s => <span key={s} className="text-[11px] rounded-full border border-cyan-400/40 text-cyan-600 dark:text-cyan-300 px-2.5 py-1">{s}</span>)}
          </div>
        </div>
      );
    case "roadmap":
      return (
        <div className={base}>{glow}
          {[["Scope lock", "done"], ["Core prototype", "active"], ["Polish + a11y", "todo"], ["Submission", "todo"]].map(([t, s]) => (
            <div key={t} className="flex items-center gap-3 mb-2.5">
              <span className={cn("w-3 h-3 rounded-full shrink-0", s === "done" ? "bg-emerald-400" : s === "active" ? "bg-cyan-400 animate-pulse-soft" : "bg-ink-300 dark:bg-ink-600")} />
              <span className={cn("text-[12.5px] font-medium", s === "done" ? "line-through text-ink-400" : "text-ink-700 dark:text-ink-100")}>{t}</span>
              {s === "active" && <span className="ml-auto text-[10px] font-bold text-cyan-500 uppercase">now</span>}
            </div>
          ))}
          <div className="h-1.5 rounded-full bg-ink-200 dark:bg-white/10 mt-1"><div className="h-full w-[38%] rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400" /></div>
        </div>
      );
    case "timer":
      return (
        <div className={base + " items-center"}>{glow}
          <div className="flex gap-2 font-mono">
            {[["01", "days"], ["02", "hrs"], ["14", "min"], ["52", "sec"]].map(([v, l]) => (
              <div key={l} className="rounded-xl bg-ink-900 dark:bg-white/8 px-3 py-2.5 text-center min-w-[54px]">
                <p className="text-xl font-bold text-white">{v}</p><p className="text-[9px] text-ink-300 uppercase mt-0.5">{l}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-amber-500 font-semibold mt-4 flex items-center gap-1.5"><Clock3 className="w-3.5 h-3.5" /> Warning fires at the final 2 hours</p>
        </div>
      );
    case "tasks":
      return (
        <div className={base}>{glow}
          {[["Wire scoring into map", "critical", true], ["Record demo video", "high", false], ["Devpost page", "medium", false]].map(([t, p, d], i) => (
            <div key={i} className="flex items-center gap-2.5 mb-2.5 rounded-xl bg-ink-100/60 dark:bg-white/6 px-3 py-2.5">
              <span className={cn("w-4.5 h-4.5 rounded-md border-2 flex items-center justify-center", d ? "bg-emerald-400 border-emerald-400" : "border-ink-300 dark:border-white/25")}>{d ? <CheckCircle2 className="w-3 h-3 text-white" /> : null}</span>
              <span className={cn("text-[12.5px] flex-1", d ? "line-through text-ink-400" : "text-ink-700 dark:text-ink-100")}>{t as string}</span>
              <Badge tone={p === "critical" ? "rose" : p === "high" ? "amber" : "cyan"}>{p as string}</Badge>
            </div>
          ))}
        </div>
      );
    default:
      return (
        <div className={base + " items-center text-center"}>{glow}
          <span className="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-500 flex items-center justify-center mb-3"><Siren className="w-6 h-6" /></span>
          {[["Repo README", true], ["2-min video", true], ["Devpost submission", false]].map(([t, d], i) => (
            <div key={i} className="flex items-center gap-2 text-[12.5px] mb-1.5">
              <CheckCircle2 className={cn("w-4 h-4", d ? "text-emerald-400" : "text-ink-300 dark:text-ink-600")} />
              <span className={cn(d ? "text-ink-700 dark:text-ink-100" : "text-ink-400")}>{t as string}</span>
            </div>
          ))}
          <span className="mt-2 text-[11px] font-bold text-rose-500 uppercase tracking-wider animate-pulse-soft">Panic mode armed</span>
        </div>
      );
  }
}

/* ================= FAQ ================= */
const FAQS = [
  ["Is Vadanam free for students?", "Yes. The core workspace — chat, file sharing, roadmap, tasks and the timer — is free for hackathon teams. Advanced AI usage will have generous free limits."],
  ["How many members can join a team?", "Teams support up to 6 members by default, matching most hackathon rules. Owners can adjust capacity in Team Settings."],
  ["Does the countdown timer keep accurate time?", "Yes. The timer is anchored to the actual deadline timestamp rather than a tick counter, so it stays exact even if your laptop sleeps or the tab is suspended."],
  ["What does the AI Mentor know about my project?", "It is grounded in your team's problem statement, roadmap and deadline so answers are specific to your build — not generic advice."],
  ["Can I use it for events other than hackathons?", "Absolutely — game jams, capstone sprints, startup weekends: anything with a team and a hard deadline."],
  ["Who built this?", "Vadanam was founded and created by Sai Karthik to give hackathon teams the focused command center they deserve."],
] as const;

function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="max-w-3xl mx-auto space-y-3">
      {FAQS.map(([q, a], i) => (
        <Reveal key={q} delay={i * 0.04}>
          <div className="glass overflow-hidden">
            <button
              className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
              onClick={() => setOpen(o => (o === i ? null : i))}
              aria-expanded={open === i}
            >
              <span className="font-semibold text-[14.5px] text-ink-800 dark:text-ink-50">{q}</span>
              <ChevronDown className={cn("w-4.5 h-4.5 text-ink-400 transition-transform shrink-0", open === i && "rotate-180")} />
            </button>
            <motion.div initial={false} animate={{ height: open === i ? "auto" : 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
              <p className="px-5 pb-4 text-sm text-ink-500 dark:text-ink-300 leading-relaxed">{a}</p>
            </motion.div>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

/* ================= PAGE ================= */
export default function Home() {
  return (
    <Page className="min-h-screen">
      <Nav />

      {/* HERO */}
      <section className="relative pt-36 pb-20 px-4 overflow-hidden">
        <Particles density={60} />
        <div className="relative max-w-4xl mx-auto text-center">
          <Reveal>
            <Badge tone="violet" className="mb-5 !text-xs !px-3 !py-1"><Sparkles className="w-3.5 h-3.5" /> Built for 24–48 hour sprints</Badge>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-ink-900 dark:text-white leading-[1.05]">
              Build Together.<br /><span className="text-gradient">Beat the Deadline.</span>
            </h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-6 text-base sm:text-lg text-ink-500 dark:text-ink-300 max-w-2xl mx-auto leading-relaxed">
              One workspace for your hackathon team. Chat in real time, share code and files, build your roadmap with AI, and stay ahead of every deadline.
            </p>
          </Reveal>
          <Reveal delay={0.24}>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/signup"><Button size="lg" className="w-56"><Rocket className="w-4.5 h-4.5" /> Start Your Team</Button></Link>
              <Button variant="secondary" size="lg" className="w-56" onClick={() => scrollToId("features")}>Explore Features <ArrowRight className="w-4 h-4" /></Button>
            </div>
          </Reveal>
          <Reveal delay={0.3}>
            <p className="mt-5 text-xs text-ink-400 flex items-center justify-center gap-4">
              <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Teams up to 6</span>
              <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> Invite-only workspaces</span>
            </p>
          </Reveal>
        </div>
        <Reveal delay={0.2}><HeroMockup /></Reveal>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-20 px-4 scroll-mt-24">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <p className="text-xs font-bold tracking-[0.3em] text-cyan-500 uppercase">Everything in one place</p>
              <h2 className="text-3xl sm:text-5xl font-extrabold text-ink-900 dark:text-white mt-3 tracking-tight">Your team's command center</h2>
              <p className="text-ink-500 dark:text-ink-300 mt-4 max-w-xl mx-auto">Eight tools that would normally live in eight tabs — unified into one fast, deadline-aware workspace.</p>
            </div>
          </Reveal>
          <div className="space-y-16">
            {FEATURES.map((f, i) => (
              <Reveal key={f.id}>
                <div id={f.id === "chat" ? "chat" : f.id === "mentor" ? "mentor" : f.id === "timer" ? "timer" : undefined}
                  className={cn("grid md:grid-cols-2 gap-8 md:gap-14 items-center scroll-mt-28", i % 2 === 1 && "md:[&>*:first-child]:order-2")}>
                  <Tilt max={5}><FeatureIllustration id={f.id} /></Tilt>
                  <div>
                    <span className={cn("inline-flex w-11 h-11 rounded-xl items-center justify-center mb-4 [&>svg]:w-5.5 [&>svg]:h-5.5",
                      f.tone === "cyan" ? "bg-cyan-400/12 text-cyan-500" : f.tone === "violet" ? "bg-violet-400/12 text-violet-500" : "bg-pink-400/12 text-pink-500")}>
                      {f.icon}
                    </span>
                    <h3 className="text-2xl font-bold text-ink-900 dark:text-white tracking-tight">{f.title}</h3>
                    <p className="mt-3 text-[15px] text-ink-500 dark:text-ink-300 leading-relaxed">{f.body}</p>
                    <p className="mt-4 text-[13px] text-ink-400 dark:text-ink-400 italic border-l-2 border-cyan-400/50 pl-3 leading-relaxed">{f.useCase}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-500/5 to-transparent pointer-events-none" />
        <div className="max-w-5xl mx-auto relative">
          <Reveal>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-center text-ink-900 dark:text-white tracking-tight mb-14">From sign-up to submission in four steps</h2>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { n: "01", t: "Create your team", d: "Name your crew, set the hackathon and drop in your problem statement.", icon: <Users /> },
              { n: "02", t: "Invite your crew", d: "Share one link. Teammates land straight in the workspace.", icon: <Link2 /> },
              { n: "03", t: "Plan with AI", d: "Generate a milestone roadmap and assign tasks in minutes.", icon: <Map /> },
              { n: "04", t: "Ship & submit", d: "Chat, build, watch the countdown — and submit with time to spare.", icon: <Rocket /> },
            ].map((s, i) => (
              <Reveal key={s.n} delay={i * 0.08}>
                <div className="glass p-5 h-full hover:-translate-y-1 transition-transform duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-cyan-500 [&>svg]:w-5 [&>svg]:h-5">{s.icon}</span>
                    <span className="text-3xl font-extrabold text-ink-200 dark:text-white/10">{s.n}</span>
                  </div>
                  <h3 className="font-bold text-ink-900 dark:text-white mt-4">{s.t}</h3>
                  <p className="text-[13px] text-ink-500 dark:text-ink-300 mt-2 leading-relaxed">{s.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4">
        <Reveal><h2 className="text-3xl sm:text-4xl font-extrabold text-center text-ink-900 dark:text-white tracking-tight mb-12">Frequently asked questions</h2></Reveal>
        <FAQ />
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <Reveal>
          <div className="max-w-4xl mx-auto glass-strong glow-border relative overflow-hidden text-center p-10 sm:p-16">
            <Particles density={30} />
            <div className="relative">
              <h2 className="text-3xl sm:text-5xl font-extrabold text-ink-900 dark:text-white tracking-tight">Your next hackathon<br /><span className="text-gradient">starts here.</span></h2>
              <p className="mt-4 text-ink-500 dark:text-ink-300 max-w-md mx-auto">Set up your team in under two minutes. No credit card, no friction — just you, your crew and the clock.</p>
              <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
                <Link to="/signup"><Button size="lg" className="w-56"><Rocket className="w-4.5 h-4.5" /> Start Your Team</Button></Link>
                <Link to="/signin"><Button variant="secondary" size="lg" className="w-56">Sign In</Button></Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ABOUT / FOUNDER */}
      <section className="pb-16 px-4">
        <Reveal>
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-xs font-bold tracking-[0.3em] text-violet-500 uppercase mb-3">About</p>
            <p className="text-ink-500 dark:text-ink-300 leading-relaxed">
              Vadanam exists because great hackathon teams lose hours juggling chat apps, drive folders, countdown tabs and to-do lists.
              It brings everything a sprinting team needs into one deadline-aware workspace.
            </p>
            <p className="mt-4 font-semibold text-ink-800 dark:text-ink-100">Founded by Sai Karthik</p>
          </div>
        </Reveal>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-ink-200/60 dark:border-white/8 px-4 py-12">
        <div className="max-w-6xl mx-auto grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo />
            <p className="text-[13px] text-ink-400 mt-4 leading-relaxed">Vadanam — one workspace for your hackathon team. Build together. Beat the deadline.</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-ink-400 mb-3">Product</p>
            {[["Features", "features"], ["Team Chat", "chat"], ["AI Mentor", "mentor"], ["Live Timer", "timer"]].map(([l, h]) => (
              <button key={l} onClick={() => scrollToId(h)} className="block text-left text-[13.5px] text-ink-500 dark:text-ink-300 hover:text-cyan-500 py-1 transition-colors">{l}</button>
            ))}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-ink-400 mb-3">Get started</p>
            {[["Sign In", "/signin"], ["Create Account", "/signup"], ["Join via Invite", "/join"]].map(([l, h]) => (
              <Link key={l} to={h} className="block text-[13.5px] text-ink-500 dark:text-ink-300 hover:text-cyan-500 py-1 transition-colors">{l}</Link>
            ))}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-ink-400 mb-3">Credits</p>
            <p className="text-[13.5px] text-ink-500 dark:text-ink-300">Created by <span className="font-semibold text-ink-800 dark:text-white">Sai Karthik</span></p>
            <p className="text-[13.5px] text-ink-500 dark:text-ink-300 mt-1">Founded by Sai Karthik</p>
          </div>
        </div>
        <p className="text-center text-xs text-ink-400 mt-10">© {new Date().getFullYear()} Vadanam · Founded by Sai Karthik</p>
      </footer>
    </Page>
  );
}

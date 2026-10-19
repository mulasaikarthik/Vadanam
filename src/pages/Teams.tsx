import React, { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Users, ArrowRight, Loader2, Upload, Rocket, Link2, LogOut, Sun, Moon } from "lucide-react";
import { Particles, Page, Reveal, Tilt } from "@/components/fx";
import { Button, Field, TextArea, Avatar, Badge, Empty } from "@/components/ui";
import { useStore, uid, type Team } from "@/lib/store";
import { isConfigured } from "@/lib/supabase";
import * as api from "@/lib/api";
import { Logo } from "./Home";
import { InviteJoinModal } from "./Auth";
import { cn } from "@/utils";

function TopBar() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  return (
    <header className="flex items-center justify-between max-w-5xl mx-auto px-4 pt-6">
      <Link to="/"><Logo /></Link>
      <div className="flex items-center gap-2">
        <button
          onClick={() => dispatch({ type: "patch", patch: { theme: state.theme === "dark" ? "light" : "dark" } })}
          aria-label="Toggle theme"
          className="p-2 rounded-lg text-ink-400 hover:text-ink-700 dark:hover:text-white hover:bg-ink-100 dark:hover:bg-white/8 transition-colors"
        >
          {state.theme === "dark" ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
        </button>
        {state.user && (
          <>
            <Avatar name={state.user.name} color={state.user.color} size={32} src={state.user.avatarUrl} />
            <Button variant="ghost" size="sm" onClick={async () => {
              if (isConfigured) await api.authSignOut().catch(() => undefined);
              dispatch({ type: "patch", patch: { user: null, activeTeam: null } });
              navigate("/");
            }}>
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </Button>
          </>
        )}
      </div>
    </header>
  );
}

/* ---------------- TEAM SELECTION ---------------- */
export function TeamSelect() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const [inviteOpen, setInviteOpen] = useState(false);

  const openTeam = (t: Team) => {
    dispatch({ type: "patch", patch: { activeTeam: t.id } });
    navigate(`/team/${t.id}/chat`);
  };

  return (
    <Page className="min-h-screen relative">
      <Particles density={40} className="!fixed" />
      <TopBar />
      <main className="relative max-w-5xl mx-auto px-4 py-14">
        <Reveal>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-ink-900 dark:text-white tracking-tight">
            {state.user ? `Hey ${state.user.name.split(" ")[0]} 👋` : "Your teams"}
          </h1>
          <p className="text-ink-400 mt-2">Pick a team workspace to jump into, or start a new one.</p>
        </Reveal>

        {!state.teamsLoaded ? (
          <div className="grid sm:grid-cols-2 gap-4 mt-10">
            {[0, 1].map(i => (
              <div key={i} className="glass p-5 space-y-3">
                <div className="skeleton w-12 h-12 !rounded-xl" />
                <div className="skeleton h-5 w-2/3" />
                <div className="skeleton h-4 w-full" />
                <div className="skeleton h-4 w-1/3" />
              </div>
            ))}
          </div>
        ) : state.teams.length === 0 ? (
          <div className="glass mt-10">
            <Empty
              icon={<Users className="w-7 h-7" />}
              title="No teams yet"
              body="Create your first team or join one with an invitation link to get started."
              action={
                <div className="flex gap-2">
                  <Link to="/teams/new"><Button><Plus className="w-4 h-4" /> Create Team</Button></Link>
                  <Button variant="outline" onClick={() => setInviteOpen(true)}><Link2 className="w-4 h-4" /> Join via Invite</Button>
                </div>
              }
            />
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4 mt-10">
            {state.teams.map((t, i) => (
              <Reveal key={t.id} delay={i * 0.07}>
                <Tilt max={4}>
                  <button
                    onClick={() => openTeam(t)}
                    className="glass w-full text-left p-5 hover:shadow-[0_12px_40px_rgba(99,102,241,0.18)] transition-shadow group"
                  >
                    <div className="flex items-start justify-between">
                      {t.logoUrl ? (
                        <img src={t.logoUrl} alt={`${t.name} logo`} className="w-12 h-12 rounded-xl object-cover border border-ink-200/50 dark:border-white/10" />
                      ) : (
                        <span className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: `${t.color}22` }}>{t.emoji}</span>
                      )}
                      <ArrowRight className="w-4.5 h-4.5 text-ink-300 group-hover:text-cyan-500 group-hover:translate-x-1 transition-all" />
                    </div>
                    <h2 className="font-bold text-lg text-ink-900 dark:text-white mt-3">{t.name}</h2>
                    <p className="text-[13px] text-ink-400 mt-1 line-clamp-2">{t.description || "No description yet."}</p>
                    <div className="flex items-center justify-between mt-4">
                      <div className="flex -space-x-2">
                        {t.members.slice(0, 4).map(m => <Avatar key={m.id} name={m.name} color={m.color} size={26} src={m.id === state.user?.id || m.id === "u-you" ? state.user?.avatarUrl : m.avatarUrl} />)}
                      </div>
                      <Badge tone="violet">{t.hackathon}</Badge>
                    </div>
                  </button>
                </Tilt>
              </Reveal>
            ))}
            <Reveal delay={state.teams.length * 0.07}>
              <Link
                to="/teams/new"
                className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-ink-300/60 dark:border-white/15 min-h-[210px] text-ink-400 hover:text-cyan-500 hover:border-cyan-400/50 transition-colors"
              >
                <span className="w-11 h-11 rounded-xl bg-cyan-400/10 flex items-center justify-center"><Plus className="w-5.5 h-5.5" /></span>
                <span className="text-sm font-semibold">Create a new team</span>
              </Link>
            </Reveal>
          </div>
        )}

        <Reveal delay={0.2}>
          <div className="mt-8 flex justify-center">
            <Button variant="ghost" onClick={() => setInviteOpen(true)}><Link2 className="w-4 h-4" /> Join a team via invite link</Button>
          </div>
        </Reveal>
      </main>
      <InviteJoinModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </Page>
  );
}

/* ---------------- TEAM CREATION ---------------- */
const EMOJIS = ["🚀", "⚡", "🧠", "🔥", "🛰️", "🦾", "🌌", "💎"];
const COLORS = ["#8b5cf6", "#22d3ee", "#e556b4", "#34d399", "#f59e0b", "#60a5fa"];

export function TeamCreate() {
  const { state, dispatch, toast } = useStore();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ name: "", description: "", hackathon: "", problem: "" });
  const [emoji, setEmoji] = useState("🚀");
  const [color, setColor] = useState("#8b5cf6");
  const [logo, setLogo] = useState<string | null>(null);
  const logoFile = useRef<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: string) => { setForm(f => ({ ...f, [k]: v })); setErrors(p => ({ ...p, [k]: "" })); };

  const onLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast("error", "Please choose an image file for the team photo."); return; }
    if (f.size > 5 * 1024 * 1024) { toast("error", "Team photo must be under 5 MB."); return; }
    logoFile.current = f;
    const reader = new FileReader();
    reader.onload = () => { setLogo(String(reader.result)); toast("success", "Team photo added."); };
    reader.onerror = () => toast("error", "Couldn't read that image — try a different file.");
    reader.readAsDataURL(f);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (form.name.trim().length < 2) errs.name = "Team name must be at least 2 characters.";
    if (!form.hackathon.trim()) errs.hackathon = "Which hackathon are you building for?";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);

    if (isConfigured && state.user) {
      (async () => {
        try {
          const teamId = await api.createTeam(state.user!.id, {
            name: form.name.trim(), description: form.description.trim(),
            hackathon: form.hackathon.trim(), problem: form.problem.trim(),
            emoji, color,
          });
          if (logoFile.current) {
            await api.uploadTeamLogo(state.user!.id, teamId, logoFile.current)
              .catch(err => toast("error", `Team created, but the photo upload failed (${api.friendlyError(err)}). You can retry from Settings.`));
          }
          const teams = await api.fetchTeams(state.user!.id);
          dispatch({ type: "patch", patch: { teams, activeTeam: teamId } });
          toast("success", `${form.name.trim()} is ready! Invite your crew to get rolling. 🎉`);
          navigate(`/team/${teamId}/chat`);
        } catch (err) {
          toast("error", api.friendlyError(err));
        } finally {
          setLoading(false);
        }
      })();
      return;
    }

    setTimeout(() => {
      const team: Team = {
        id: uid(),
        name: form.name.trim(),
        description: form.description.trim(),
        hackathon: form.hackathon.trim(),
        problem: form.problem.trim(),
        emoji, color,
        logoUrl: logo ?? undefined,
        members: [{ id: "u-you", name: state.user?.name ?? "You", role: "Owner", color: "#22d3ee", online: true }],
        capacity: 6,
        createdAt: Date.now(),
      };
      dispatch({ type: "patch", patch: { teams: [...state.teams, team], activeTeam: team.id } });
      toast("success", `${team.name} is ready! Invite your crew to get rolling. 🎉`);
      navigate(`/team/${team.id}/chat`);
      setLoading(false);
    }, 900);
  };

  return (
    <Page className="min-h-screen relative">
      <Particles density={40} className="!fixed" />
      <TopBar />
      <main className="relative max-w-2xl mx-auto px-4 py-14">
        <Reveal>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-ink-900 dark:text-white tracking-tight">Create your team</h1>
          <p className="text-ink-400 mt-2">Your workspace, chat, roadmap and timer all live here.</p>
        </Reveal>
        <Reveal delay={0.1}>
          <form onSubmit={submit} className="glass-strong p-6 sm:p-8 mt-8 space-y-5">
            {/* avatar picker */}
            <div>
              <p className="text-[13px] font-medium text-ink-600 dark:text-ink-200 mb-2.5">Team avatar</p>
              <div className="flex flex-wrap items-center gap-4">
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl border-2 border-dashed border-ink-300/60 dark:border-white/20 hover:border-cyan-400/60 transition-colors overflow-hidden relative"
                  style={{ background: logo ? undefined : `${color}22` }} aria-label="Upload team logo">
                  {logo ? <img src={logo} alt="Team logo" className="w-full h-full object-cover" /> : emoji}
                </button>
                <div className="flex-1 min-w-[200px]">
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {EMOJIS.map(e => (
                      <button key={e} type="button" onClick={() => { setEmoji(e); setLogo(null); }}
                        className={cn("w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-all", emoji === e && !logo ? "bg-cyan-400/20 ring-2 ring-cyan-400/60 scale-110" : "hover:bg-ink-100 dark:hover:bg-white/8")}>
                        {e}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1.5 items-center">
                    {COLORS.map(c => (
                      <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Color ${c}`}
                        className={cn("w-6 h-6 rounded-full transition-transform", color === c && "ring-2 ring-offset-2 ring-cyan-400 dark:ring-offset-ink-900 scale-110")} style={{ background: c }} />
                    ))}
                    <button type="button" onClick={() => fileRef.current?.click()} className="ml-2 text-xs text-cyan-600 dark:text-cyan-300 font-semibold hover:underline inline-flex items-center gap-1">
                      <Upload className="w-3.5 h-3.5" /> Upload logo
                    </button>
                  </div>
                </div>
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onLogo} />
            </div>

            <Field label="Team name" placeholder="e.g. Nebula Crew" value={form.name} onChange={e => set("name", e.target.value)} error={errors.name} />
            <TextArea label="Description" rows={2} placeholder="What are you building? One or two sentences." value={form.description} onChange={e => set("description", e.target.value)} />
            <Field label="Hackathon name" placeholder="e.g. HackSprint 2026" value={form.hackathon} onChange={e => set("hackathon", e.target.value)} error={errors.hackathon} />
            <TextArea label="Problem statement (optional — you can add it later)" rows={3}
              placeholder="Paste the official problem statement or describe the problem you're solving. The AI Mentor and Roadmap Generator use this as context."
              value={form.problem} onChange={e => set("problem", e.target.value)} />

            <div className="flex items-center justify-between pt-2">
              <Button type="button" variant="ghost" onClick={() => navigate(state.teams.length ? "/teams" : "/")}>Cancel</Button>
              <Button type="submit" size="lg" disabled={loading}>
                {loading ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <Rocket className="w-4.5 h-4.5" />}
                {loading ? "Creating…" : "Create Team"}
              </Button>
            </div>
          </form>
        </Reveal>
      </main>
    </Page>
  );
}

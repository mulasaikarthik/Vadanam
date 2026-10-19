import React, { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Link2, Loader2, LogIn, Rocket, ShieldCheck, Users, Clock3, CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { Particles, Page } from "@/components/fx";
import { Button, Field, PasswordField, Modal, Badge } from "@/components/ui";
import { useStore, uid, DEMO_MEMBERS, type Team } from "@/lib/store";
import { isConfigured } from "@/lib/supabase";
import * as api from "@/lib/api";
import { Logo } from "./Home";
import { cn } from "@/utils";

/* ---------------- layout ---------------- */
function AuthLayout({ children, title, sub }: { children: React.ReactNode; title: string; sub: string }) {
  return (
    <Page className="min-h-screen flex">
      {/* illustration side */}
      <div className="hidden lg:flex w-[46%] relative overflow-hidden items-center justify-center bg-gradient-to-br from-ink-900 via-ink-850 to-ink-900 dark:from-ink-950 dark:via-ink-900 dark:to-ink-950">
        <Particles density={50} />
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-24 w-96 h-96 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="relative max-w-md px-10 text-white">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <Logo />
            <h2 className="text-3xl font-extrabold mt-10 leading-tight tracking-tight">Build together.<br /><span className="text-gradient">Beat the deadline.</span></h2>
            <p className="text-ink-300 mt-4 text-[15px] leading-relaxed">Chat, files, AI roadmaps and a deadline-anchored countdown — one workspace for your whole crew.</p>
          </motion.div>
          <div className="mt-10 space-y-3">
            {[
              { icon: <Users className="w-4 h-4" />, t: "Invite teammates with a single link" },
              { icon: <ShieldCheck className="w-4 h-4" />, t: "Private, invite-only workspaces" },
              { icon: <Clock3 className="w-4 h-4" />, t: "Drift-proof hackathon countdown" },
            ].map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.12 }}
                className="glass !bg-white/6 !border-white/10 flex items-center gap-3 px-4 py-3 text-sm text-ink-100">
                <span className="text-cyan-300">{f.icon}</span>{f.t}
              </motion.div>
            ))}
          </div>
          <p className="text-[11px] text-ink-400 mt-10">Founded by Sai Karthik</p>
        </div>
      </div>
      {/* form side */}
      <div className="flex-1 flex items-center justify-center px-4 py-10 relative">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex justify-center"><Link to="/"><Logo /></Link></div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink-900 dark:text-white tracking-tight">{title}</h1>
          <p className="text-sm text-ink-400 mt-2 mb-7">{sub}</p>
          {children}
        </div>
      </div>
    </Page>
  );
}

/* ---------------- invite modal (shared) ---------------- */
export function InviteJoinModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const submit = () => {
    const v = value.trim();
    if (!v) { setError("Paste an invitation link or code to continue."); return; }
    const code = v.includes("/join/") ? v.split("/join/")[1]?.split(/[?#]/)[0] : v;
    if (!code || code.length < 4) { setError("That doesn't look like a valid invite link or code."); return; }
    onClose();
    navigate(`/join/${encodeURIComponent(code)}`);
  };
  return (
    <Modal open={open} onClose={onClose} title="Join a Team via Invite Link">
      <p className="text-sm text-ink-500 dark:text-ink-300 mb-4">Paste the invitation URL or code your teammate shared with you.</p>
      <Field
        label="Invitation link or code"
        placeholder="https://hcc.app/join/XXXX-XXXX or XXXX-XXXX"
        value={value}
        onChange={e => { setValue(e.target.value); setError(""); }}
        onKeyDown={e => e.key === "Enter" && submit()}
        error={error}
        autoFocus
      />
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit}><Link2 className="w-4 h-4" /> Continue</Button>
      </div>
    </Modal>
  );
}

const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

/* ---------------- SIGN IN ---------------- */
export function SignIn() {
  const { state, dispatch, toast } = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const pendingInvite = state.pendingInvite ?? params.get("invite");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!validEmail(email)) errs.email = "Enter a valid email address.";
    if (password.length < 6) errs.password = "Password must be at least 6 characters.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);

    if (isConfigured) {
      const { data, error } = await api.authSignIn(email, password);
      setLoading(false);
      if (error) { toast("error", api.friendlyError(error)); return; }
      // set the user immediately so the guard never bounces back here
      if (data.user) {
        dispatch({
          type: "patch",
          patch: {
            user: {
              id: data.user.id,
              name: String(data.user.user_metadata?.full_name ?? email.split("@")[0]),
              email, color: "#22d3ee",
            },
            authReady: true,
          },
        });
      }
      toast("success", "Welcome back!");
      if (pendingInvite) {
        dispatch({ type: "patch", patch: { pendingInvite: null } });
        navigate(`/join/${pendingInvite}`);
      } else {
        navigate("/teams");
      }
      return;
    }

    setTimeout(() => {
      const name = email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      dispatch({ type: "patch", patch: { user: { id: "u-you", name, email, color: "#22d3ee" } } });
      toast("success", `Welcome back, ${name}!`);
      if (pendingInvite) {
        dispatch({ type: "patch", patch: { pendingInvite: null } });
        navigate(`/join/${pendingInvite}`);
      } else {
        navigate(state.teams.length ? "/teams" : "/teams/new");
      }
      setLoading(false);
    }, 900);
  };

  return (
    <AuthLayout title="Welcome back" sub="Sign in to rejoin your team's workspace.">
      {pendingInvite && (
        <div className="glass !rounded-xl glow-border px-4 py-3 mb-5 flex items-center gap-3 text-sm">
          <Link2 className="w-4 h-4 text-cyan-500 shrink-0" />
          <span className="text-ink-600 dark:text-ink-200">You have a pending team invitation. Sign in to accept it.</span>
        </div>
      )}
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email" name="email" type="email" placeholder="you@team.dev" value={email}
          onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: "" })); }} error={errors.email} />
        <div>
          <PasswordField label="Password" name="password" placeholder="••••••••" value={password}
            onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: "" })); }} error={errors.password} />
          <button type="button" onClick={() => setForgotOpen(true)} className="text-xs text-cyan-600 dark:text-cyan-300 hover:underline mt-2 float-right">Forgot password?</button>
        </div>
        <Button type="submit" className="w-full !mt-7" size="lg" disabled={loading}>
          {loading ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <LogIn className="w-4.5 h-4.5" />}
          {loading ? "Signing in…" : "Sign In"}
        </Button>
      </form>

      <div className="flex items-center gap-3 my-6">
        <span className="h-px flex-1 bg-ink-200 dark:bg-white/10" /><span className="text-xs text-ink-400">or</span><span className="h-px flex-1 bg-ink-200 dark:bg-white/10" />
      </div>
      <Button variant="outline" className="w-full" size="lg" onClick={() => setInviteOpen(true)}>
        <Link2 className="w-4.5 h-4.5" /> Join a Team via Invite Link
      </Button>
      <p className="text-sm text-ink-400 text-center mt-6">
        New here? <Link to={pendingInvite ? `/signup?invite=${pendingInvite}` : "/signup"} className="text-cyan-600 dark:text-cyan-300 font-semibold hover:underline">Create an account</Link>
      </p>

      <InviteJoinModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
      <Modal open={forgotOpen} onClose={() => { setForgotOpen(false); setForgotSent(false); }} title="Reset your password">
        {forgotSent ? (
          <div className="text-center py-4">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <p className="text-sm text-ink-500 dark:text-ink-300">
              {isConfigured
                ? <>If an account exists for <strong>{forgotEmail}</strong>, a password-reset link is on its way. Open it in this browser to set a new password.</>
                : <>If an account exists for <strong>{forgotEmail}</strong>, a reset link is on its way.</>}
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-ink-500 dark:text-ink-300 mb-4">Enter your account email and we'll send a reset link.</p>
            <Field label="Email" type="email" placeholder="you@team.dev" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} />
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="secondary" onClick={() => setForgotOpen(false)}>Cancel</Button>
              <Button
                onClick={async () => {
                  if (!validEmail(forgotEmail)) return;
                  if (isConfigured) {
                    const { error } = await api.authResetPassword(forgotEmail);
                    if (error) { toast("error", api.friendlyError(error)); return; }
                  }
                  setForgotSent(true);
                }}
                disabled={!validEmail(forgotEmail)} disabledReason="Enter a valid email first">
                Send reset link
              </Button>
            </div>
          </>
        )}
      </Modal>
    </AuthLayout>
  );
}

/* ---------------- SIGN UP ---------------- */
function strength(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

export function SignUp() {
  const { state, dispatch, toast } = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const pendingInvite = state.pendingInvite ?? params.get("invite");
  const str = strength(form.password);
  const strLabel = ["Too weak", "Weak", "Okay", "Strong", "Excellent"][str];
  const strColor = ["bg-rose-400", "bg-rose-400", "bg-amber-400", "bg-emerald-400", "bg-emerald-400"][str];

  const set = (k: string, v: string) => { setForm(f => ({ ...f, [k]: v })); setErrors(p => ({ ...p, [k]: "" })); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (form.name.trim().length < 2) errs.name = "Enter your full name.";
    if (!validEmail(form.email)) errs.email = "Enter a valid email address.";
    if (str < 2) errs.password = "Use at least 8 characters with a mix of cases or numbers.";
    if (form.confirm !== form.password) errs.confirm = "Passwords don't match.";
    if (!terms) errs.terms = "Please accept the terms to continue.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);

    if (isConfigured) {
      const { data, error } = await api.authSignUp(form.name.trim(), form.email, form.password);
      setLoading(false);
      if (error) { toast("error", api.friendlyError(error)); return; }
      if (!data.session) {
        toast("info", "Account created! Check your inbox and confirm your email, then sign in.");
        navigate(pendingInvite ? `/signin?invite=${pendingInvite}` : "/signin");
        return;
      }
      if (data.user) {
        dispatch({
          type: "patch",
          patch: {
            user: { id: data.user.id, name: form.name.trim(), email: form.email, color: "#22d3ee" },
            authReady: true,
          },
        });
      }
      toast("success", `Welcome, ${form.name.split(" ")[0]}!`);
      if (pendingInvite) {
        dispatch({ type: "patch", patch: { pendingInvite: null } });
        navigate(`/join/${pendingInvite}`);
      } else navigate("/teams/new");
      return;
    }

    setTimeout(() => {
      dispatch({ type: "patch", patch: { user: { id: "u-you", name: form.name.trim(), email: form.email, color: "#22d3ee" } } });
      toast("success", `Account created. Welcome, ${form.name.split(" ")[0]}!`);
      if (pendingInvite) {
        dispatch({ type: "patch", patch: { pendingInvite: null } });
        navigate(`/join/${pendingInvite}`);
      } else navigate("/teams/new");
      setLoading(false);
    }, 1100);
  };

  return (
    <AuthLayout title="Create your account" sub="Set up your profile, then create or join a team.">
      {pendingInvite && (
        <div className="glass !rounded-xl glow-border px-4 py-3 mb-5 flex items-center gap-3 text-sm">
          <Link2 className="w-4 h-4 text-cyan-500 shrink-0" />
          <span className="text-ink-600 dark:text-ink-200">Create your account to accept your pending team invitation.</span>
        </div>
      )}
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Full name" name="name" placeholder="Sai Karthik" value={form.name} onChange={e => set("name", e.target.value)} error={errors.name} />
        <Field label="Email" name="email" type="email" placeholder="you@team.dev" value={form.email} onChange={e => set("email", e.target.value)} error={errors.email} />
        <div>
          <PasswordField label="Password" name="password" placeholder="At least 8 characters" value={form.password} onChange={e => set("password", e.target.value)} error={errors.password} />
          {form.password && (
            <div className="mt-2">
              <div className="flex gap-1.5">
                {[0, 1, 2, 3].map(i => <span key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors", i < str ? strColor : "bg-ink-200 dark:bg-white/10")} />)}
              </div>
              <p className="text-[11px] text-ink-400 mt-1.5">Password strength: <span className="font-semibold">{strLabel}</span></p>
            </div>
          )}
        </div>
        <PasswordField label="Confirm password" name="confirm" placeholder="Repeat your password" value={form.confirm} onChange={e => set("confirm", e.target.value)} error={errors.confirm} />
        <label className="flex items-start gap-2.5 cursor-pointer pt-1">
          <input type="checkbox" checked={terms} onChange={e => { setTerms(e.target.checked); setErrors(p => ({ ...p, terms: "" })); }}
            className="mt-0.5 w-4 h-4 rounded accent-cyan-500" />
          <span className="text-[13px] text-ink-500 dark:text-ink-300 leading-snug">I agree to the Terms of Service and Privacy Policy.</span>
        </label>
        {errors.terms && <p className="text-xs text-rose-500 -mt-2">{errors.terms}</p>}
        <Button type="submit" className="w-full !mt-6" size="lg" disabled={loading}>
          {loading ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <Rocket className="w-4.5 h-4.5" />}
          {loading ? "Creating account…" : "Create Account"}
        </Button>
      </form>
      <div className="flex items-center gap-3 my-6">
        <span className="h-px flex-1 bg-ink-200 dark:bg-white/10" /><span className="text-xs text-ink-400">or</span><span className="h-px flex-1 bg-ink-200 dark:bg-white/10" />
      </div>
      <Button variant="outline" className="w-full" size="lg" onClick={() => setInviteOpen(true)}>
        <Link2 className="w-4.5 h-4.5" /> Join a Team via Invite Link
      </Button>
      <p className="text-sm text-ink-400 text-center mt-6">
        Already have an account? <Link to={pendingInvite ? `/signin?invite=${pendingInvite}` : "/signin"} className="text-cyan-600 dark:text-cyan-300 font-semibold hover:underline">Sign in</Link>
      </p>
      <InviteJoinModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </AuthLayout>
  );
}

/* ---------------- JOIN VIA INVITE ---------------- */
export function Join() {
  const { code } = useParams();
  const { state, dispatch, toast } = useStore();
  const navigate = useNavigate();
  const [manual, setManual] = useState("");
  const [joining, setJoining] = useState(false);
  const [live, setLive] = useState<api.InvitePreview | "loading" | "invalid" | null>(isConfigured ? "loading" : null);

  // connected mode: ask the database about this invitation
  React.useEffect(() => {
    if (!isConfigured || !code || !state.user) return;
    let on = true;
    setLive("loading");
    api.previewInvite(code)
      .then(p => on && setLive(p ?? "invalid"))
      .catch(() => on && setLive("invalid"));
    return () => { on = false; };
  }, [code, state.user?.id]); // eslint-disable-line

  // demo invite states driven by code suffix so every state is explorable
  const status: "valid" | "expired" | "revoked" | "full" = useMemo(() => {
    if (!code) return "valid";
    if (code.endsWith("expired")) return "expired";
    if (code.endsWith("revoked")) return "revoked";
    if (code.endsWith("full")) return "full";
    return "valid";
  }, [code]);

  if (!code) {
    return (
      <AuthLayout title="Join a team" sub="Paste the invitation link or code your teammate shared.">
        <Field label="Invitation link or code" placeholder="https://hcc.app/join/XXXX-XXXX" value={manual}
          onChange={e => setManual(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && manual.trim()) navigate(`/join/${encodeURIComponent(manual.includes("/join/") ? manual.split("/join/")[1] : manual.trim())}`); }} />
        <Button className="w-full mt-5" size="lg" disabled={!manual.trim()} disabledReason="Paste an invite link or code first"
          onClick={() => navigate(`/join/${encodeURIComponent(manual.includes("/join/") ? manual.split("/join/")[1] : manual.trim())}`)}>
          Continue <ArrowRight className="w-4 h-4" />
        </Button>
        <p className="text-xs text-ink-400 mt-6 leading-relaxed">
          Tip: try codes ending in <code className="font-mono text-cyan-500">expired</code>, <code className="font-mono text-cyan-500">revoked</code> or <code className="font-mono text-cyan-500">full</code> to preview those invite states.
        </p>
      </AuthLayout>
    );
  }

  // not signed in → preserve invite through auth
  if (!state.user) {
    return (
      <AuthLayout title="You've been invited!" sub="Sign in or create an account to join this team.">
        <div className="glass-strong glow-border p-5 mb-6">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-xl bg-violet-500/15 flex items-center justify-center text-2xl">🚀</span>
            <div>
              <p className="font-bold text-ink-900 dark:text-white">Team invitation pending</p>
              <p className="text-xs text-ink-400 mt-0.5 font-mono">code: {code}</p>
            </div>
          </div>
          <p className="text-[13px] text-ink-500 dark:text-ink-300 mt-3 leading-relaxed">
            Your invitation will be preserved while you authenticate — you'll land directly in the team after signing in.
          </p>
        </div>
        <Button className="w-full" size="lg" onClick={() => { dispatch({ type: "patch", patch: { pendingInvite: code } }); navigate(`/signin?invite=${code}`); }}>
          <LogIn className="w-4.5 h-4.5" /> Sign in to accept
        </Button>
        <Button variant="secondary" className="w-full mt-3" size="lg" onClick={() => { dispatch({ type: "patch", patch: { pendingInvite: code } }); navigate(`/signup?invite=${code}`); }}>
          Create account to accept
        </Button>
      </AuthLayout>
    );
  }

  const demoTeam = state.teams[0];

  const errorViews = {
    invalid: { icon: <XCircle className="w-7 h-7" />, title: "This invitation link is invalid", body: "The code doesn't match any invitation. Double-check the link or ask your teammate to send a fresh one." },
    expired: { icon: <Clock3 className="w-7 h-7" />, title: "This invitation has expired", body: "Invite links expire for security. Ask a team member to generate a fresh link from the Invite panel." },
    revoked: { icon: <XCircle className="w-7 h-7" />, title: "This invitation was revoked", body: "The team owner revoked this link. If you think this is a mistake, ask them to send you a new invitation." },
    full: { icon: <Users className="w-7 h-7" />, title: "This team is full", body: "The team has reached its member capacity. The owner can raise the capacity in Team Settings, then re-share the link." },
  } as const;

  /* ---------- connected mode: database-backed invite flow ---------- */
  if (isConfigured) {
    if (live === "loading" || live === null) {
      return (
        <AuthLayout title="Checking invitation…" sub="Validating this invite against the team.">
          <div className="glass-strong p-6 space-y-3">
            <div className="skeleton h-14 w-14 !rounded-2xl" />
            <div className="skeleton h-5 w-2/3" />
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-1/2" />
          </div>
        </AuthLayout>
      );
    }
    const liveState = live === "invalid" ? "invalid" : live.state;
    if (liveState !== "valid") {
      const v = errorViews[liveState as keyof typeof errorViews];
      return (
        <AuthLayout title="Invitation unavailable" sub="This link can't be used right now.">
          <div className="glass-strong p-8 text-center">
            <span className="inline-flex w-14 h-14 rounded-2xl bg-rose-400/12 text-rose-500 items-center justify-center mb-4">{v.icon}</span>
            <h2 className="font-bold text-lg text-ink-900 dark:text-white">{v.title}</h2>
            <p className="text-sm text-ink-500 dark:text-ink-300 mt-2 leading-relaxed">{v.body}</p>
            <div className="flex gap-2 justify-center mt-6">
              <Button variant="secondary" onClick={() => navigate("/join")}>Try another code</Button>
              <Button onClick={() => navigate("/teams")}>Go to my teams</Button>
            </div>
          </div>
        </AuthLayout>
      );
    }
    const p = live as api.InvitePreview;
    const acceptLive = async () => {
      setJoining(true);
      try {
        const teamId = await api.acceptInvite(code);
        const teams = await api.fetchTeams(state.user!.id);
        dispatch({ type: "patch", patch: { teams, activeTeam: teamId, pendingInvite: null } });
        toast("success", `You joined ${p.team_name}! 🎉`);
        navigate(`/team/${teamId}/chat`);
      } catch (e) {
        toast("error", api.friendlyError(e));
      } finally {
        setJoining(false);
      }
    };
    const hrs = Math.max(0, Math.round((Date.parse(p.expires_at) - Date.now()) / 3600000));
    return (
      <AuthLayout title="Join this team?" sub="Preview the team before accepting the invitation.">
        <div className="glass-strong glow-border p-6">
          <div className="flex items-center gap-4">
            <span className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl" style={{ background: `${p.team_color}22` }}>{p.team_emoji}</span>
            <div>
              <h2 className="font-bold text-lg text-ink-900 dark:text-white">{p.team_name}</h2>
              <p className="text-xs text-ink-400">{p.hackathon || "Hackathon team"}</p>
            </div>
          </div>
          {p.description && <p className="text-sm text-ink-500 dark:text-ink-300 mt-4 leading-relaxed">{p.description}</p>}
          <div className="flex items-center justify-between mt-5 pt-4 border-t border-ink-200/60 dark:border-white/8">
            <Badge tone="cyan">{p.member_count} / {p.capacity} members</Badge>
            <span className="text-[11px] text-ink-400">expires in ~{hrs}h</span>
          </div>
        </div>
        <Button className="w-full mt-6" size="lg" onClick={acceptLive} disabled={joining}>
          {joining ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <CheckCircle2 className="w-4.5 h-4.5" />}
          {joining ? "Joining team…" : "Accept & Join Team"}
        </Button>
        <Button variant="ghost" className="w-full mt-2" onClick={() => navigate("/teams")}>Not now</Button>
      </AuthLayout>
    );
  }

  if (status !== "valid") {
    const v = errorViews[status];
    return (
      <AuthLayout title="Invitation unavailable" sub="This link can't be used right now.">
        <div className="glass-strong p-8 text-center">
          <span className="inline-flex w-14 h-14 rounded-2xl bg-rose-400/12 text-rose-500 items-center justify-center mb-4">{v.icon}</span>
          <h2 className="font-bold text-lg text-ink-900 dark:text-white">{v.title}</h2>
          <p className="text-sm text-ink-500 dark:text-ink-300 mt-2 leading-relaxed">{v.body}</p>
          <div className="flex gap-2 justify-center mt-6">
            <Button variant="secondary" onClick={() => navigate("/join")}>Try another code</Button>
            <Button onClick={() => navigate("/teams")}>Go to my teams</Button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  const join = () => {
    setJoining(true);
    setTimeout(() => {
      let team: Team | undefined = state.teams.find(t => t.id === demoTeam?.id);
      if (!team) {
        team = { ...demoTeamFallback(), id: uid() };
        dispatch({ type: "patch", patch: { teams: [...state.teams, team] } });
      }
      dispatch({ type: "patch", patch: { activeTeam: team.id, pendingInvite: null } });
      toast("success", `You joined ${team.name}! 🎉`);
      navigate(`/team/${team.id}/chat`);
    }, 1000);
  };

  return (
    <AuthLayout title="Join this team?" sub="Preview the team before accepting the invitation.">
      <div className="glass-strong glow-border p-6">
        <div className="flex items-center gap-4">
          <span className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl" style={{ background: `${demoTeam?.color ?? "#8b5cf6"}22` }}>{demoTeam?.emoji ?? "🚀"}</span>
          <div>
            <h2 className="font-bold text-lg text-ink-900 dark:text-white">{demoTeam?.name ?? "Nebula Crew"}</h2>
            <p className="text-xs text-ink-400">{demoTeam?.hackathon ?? "HackSprint 2026"}</p>
          </div>
        </div>
        <p className="text-sm text-ink-500 dark:text-ink-300 mt-4 leading-relaxed">{demoTeam?.description}</p>
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-ink-200/60 dark:border-white/8">
          <div className="flex -space-x-2">
            {(demoTeam?.members ?? DEMO_MEMBERS).slice(0, 4).map(m => (
              <span key={m.id} className="w-8 h-8 rounded-full border-2 border-white dark:border-ink-900 flex items-center justify-center text-[10px] font-bold text-white" style={{ background: m.color }}>
                {m.name.split(" ").map(w => w[0]).join("")}
              </span>
            ))}
          </div>
          <Badge tone="cyan">{demoTeam?.members.length ?? 4} / {demoTeam?.capacity ?? 6} members</Badge>
        </div>
        <p className="text-[11px] text-ink-400 mt-3 font-mono">invite code: {code}</p>
      </div>
      <Button className="w-full mt-6" size="lg" onClick={join} disabled={joining}>
        {joining ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <CheckCircle2 className="w-4.5 h-4.5" />}
        {joining ? "Joining team…" : "Accept & Join Team"}
      </Button>
      <Button variant="ghost" className="w-full mt-2" onClick={() => navigate("/teams")}>Not now</Button>
    </AuthLayout>
  );
}

function demoTeamFallback(): Team {
  return {
    id: "t-joined", name: "Nebula Crew", description: "Building an accessibility-first campus navigation app.",
    hackathon: "HackSprint 2026", problem: "", emoji: "🚀", color: "#8b5cf6", members: DEMO_MEMBERS, capacity: 6, createdAt: Date.now(),
  };
}

/* ---------------- RESET PASSWORD (Supabase recovery flow) ---------------- */
export function ResetPassword() {
  const { toast } = useStore();
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (pw.length < 8) errs.pw = "Use at least 8 characters.";
    if (confirm !== pw) errs.confirm = "Passwords don't match.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    if (!isConfigured) { toast("info", "Password reset requires the Supabase backend."); return; }
    setLoading(true);
    const { error } = await api.authUpdatePassword(pw);
    setLoading(false);
    if (error) { toast("error", api.friendlyError(error)); return; }
    toast("success", "Password updated — you're signed in.");
    navigate("/teams");
  };

  return (
    <AuthLayout title="Set a new password" sub="Choose a new password for your account.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <PasswordField label="New password" placeholder="At least 8 characters" value={pw}
          onChange={e => { setPw(e.target.value); setErrors(p => ({ ...p, pw: "" })); }} error={errors.pw} />
        <PasswordField label="Confirm new password" placeholder="Repeat your password" value={confirm}
          onChange={e => { setConfirm(e.target.value); setErrors(p => ({ ...p, confirm: "" })); }} error={errors.confirm} />
        <Button type="submit" className="w-full !mt-6" size="lg" disabled={loading}>
          {loading ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <CheckCircle2 className="w-4.5 h-4.5" />}
          {loading ? "Updating…" : "Update password"}
        </Button>
      </form>
      <p className="text-sm text-ink-400 text-center mt-6">
        Changed your mind? <Link to="/signin" className="text-cyan-600 dark:text-cyan-300 font-semibold hover:underline">Back to sign in</Link>
      </p>
    </AuthLayout>
  );
}

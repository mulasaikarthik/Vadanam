import { useRef, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { Settings as SettingsIcon, User, Palette, Bell, Users, ShieldAlert, UserPlus, Save, Sun, Moon, LogOut, Trash2, Camera, X, Plus } from "lucide-react";
import { Button, Field, TextArea, Toggle, Avatar, Badge, Confirm, Tooltip } from "@/components/ui";
import { useStore, useTeam, type Member } from "@/lib/store";
import { isConfigured } from "@/lib/supabase";
import * as api from "@/lib/api";
import { cn } from "@/utils";

export default function Settings() {
  const { state, dispatch, toast } = useStore();
  const team = useTeam();
  const navigate = useNavigate();
  const { openInvite } = useOutletContext<{ openInvite: () => void }>();

  const [profile, setProfile] = useState({ name: state.user?.name ?? "", email: state.user?.email ?? "" });
  const [skills, setSkills] = useState<string[]>(state.user?.skills ?? []);
  const [skillInput, setSkillInput] = useState("");
  const photoRef = useRef<HTMLInputElement>(null);
  const teamPhotoRef = useRef<HTMLInputElement>(null);

  const onTeamPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !team) return;
    if (!f.type.startsWith("image/")) { toast("error", "Please choose an image file (JPG or PNG)."); return; }
    if (f.size > 5 * 1024 * 1024) { toast("error", "Team photo must be under 5 MB."); return; }

    if (isConfigured && state.user) {
      toast("info", "Uploading team photo…");
      api.uploadTeamLogo(state.user.id, team.id, f)
        .then(url => {
          dispatch({ type: "team:update", id: team.id, patch: { logoUrl: url } });
          toast("success", "Team photo updated — it now shows at the top of the workspace.");
        })
        .catch(err => toast("error", api.friendlyError(err)));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      dispatch({ type: "team:update", id: team.id, patch: { logoUrl: String(reader.result) } });
      toast("success", "Team photo updated — it now shows at the top of the workspace.");
    };
    reader.onerror = () => toast("error", "Couldn't read that image — try a different file.");
    reader.readAsDataURL(f);
  };

  const removeTeamPhoto = () => {
    if (!team) return;
    dispatch({ type: "team:update", id: team.id, patch: { logoUrl: undefined } });
    if (isConfigured) api.updateTeam(team.id, { logoUrl: "" }).catch(() => undefined);
    toast("success", "Team photo removed — back to the emoji avatar.");
  };
  const [teamForm, setTeamForm] = useState({
    name: team?.name ?? "", description: team?.description ?? "",
    hackathon: team?.hackathon ?? "", problem: team?.problem ?? "", capacity: String(team?.capacity ?? 6),
  });
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDeleteTeam, setConfirmDeleteTeam] = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);

  const saveProfile = () => {
    if (profile.name.trim().length < 2) { toast("error", "Your name must be at least 2 characters."); return; }
    dispatch({ type: "patch", patch: { user: { ...state.user!, name: profile.name.trim(), email: profile.email.trim(), skills } } });
    if (isConfigured && state.user) {
      api.saveProfile(state.user.id, { name: profile.name.trim(), skills })
        .then(() => toast("success", "Profile saved to your account."))
        .catch(e => toast("error", api.friendlyError(e)));
    } else {
      toast("success", "Profile updated.");
    }
  };

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast("error", "Please choose an image file (JPG or PNG)."); return; }
    if (f.size > 5 * 1024 * 1024) { toast("error", "Photo must be under 5 MB."); return; }

    if (isConfigured && state.user) {
      toast("info", "Uploading photo…");
      api.uploadAvatar(state.user.id, f)
        .then(url => {
          dispatch({ type: "patch", patch: { user: { ...state.user!, avatarUrl: url } } });
          toast("success", "Profile photo uploaded — it now shows everywhere you appear.");
        })
        .catch(err => toast("error", api.friendlyError(err)));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      dispatch({ type: "patch", patch: { user: { ...state.user!, avatarUrl: String(reader.result) } } });
      toast("success", "Profile photo updated. It now shows everywhere you appear.");
    };
    reader.onerror = () => toast("error", "Couldn't read that image — try a different file.");
    reader.readAsDataURL(f);
  };

  const removePhoto = () => {
    dispatch({ type: "patch", patch: { user: { ...state.user!, avatarUrl: undefined } } });
    toast("success", "Photo removed — back to your initials avatar.");
  };

  const normalizeTag = (t: string) =>
    t.toLowerCase().trim().replace(/[^a-z0-9+\- ]/g, "").replace(/\s+/g, " ").slice(0, 24);

  const addSkill = () => {
    const tag = normalizeTag(skillInput);
    if (tag.length < 2) { toast("error", "Tags need at least 2 characters (e.g. frontend, backend, ml)."); return; }
    if (skills.includes(tag)) { toast("info", `"${tag}" is already in your tags.`); setSkillInput(""); return; }
    if (skills.length >= 10) { toast("error", "Maximum 10 skill tags — remove one first."); return; }
    setSkills(s => [...s, tag]);
    setSkillInput("");
  };

  const saveTeam = () => {
    if (!team) return;
    if (teamForm.name.trim().length < 2) { toast("error", "Team name must be at least 2 characters."); return; }
    const cap = Math.max(team.members.length, Math.min(12, parseInt(teamForm.capacity) || 6));
    const patch = { name: teamForm.name.trim(), description: teamForm.description.trim(), hackathon: teamForm.hackathon.trim(), problem: teamForm.problem.trim(), capacity: cap };
    dispatch({ type: "team:update", id: team.id, patch });
    if (isConfigured) {
      api.updateTeam(team.id, patch)
        .then(() => toast("success", "Team settings saved."))
        .catch(e => toast("error", api.friendlyError(e)));
    } else {
      toast("success", "Team settings saved.");
    }
  };

  const setRole = (m: Member, role: Member["role"]) => {
    if (!team) return;
    if (m.id === state.user?.id) { toast("error", "You can't change your own role as the owner."); return; }
    dispatch({ type: "team:update", id: team.id, patch: { members: team.members.map(x => x.id === m.id ? { ...x, role } : x) } });
    if (isConfigured) {
      api.updateMemberRole(team.id, m.id, role)
        .then(() => toast("success", `${m.name} is now ${role}.`))
        .catch(e => toast("error", api.friendlyError(e)));
    } else {
      toast("success", `${m.name} is now ${role}.`);
    }
  };

  const removeMember = (m: Member) => {
    if (!team) return;
    dispatch({ type: "team:update", id: team.id, patch: { members: team.members.filter(x => x.id !== m.id) } });
    if (isConfigured) {
      api.removeMember(team.id, m.id)
        .then(() => toast("success", `${m.name} was removed from the team.`))
        .catch(e => toast("error", api.friendlyError(e)));
    } else {
      toast("success", `${m.name} was removed from the team.`);
    }
  };

  const Section = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
    <section className="glass p-5 sm:p-6">
      <h2 className="font-bold text-[15px] text-ink-900 dark:text-white mb-5 flex items-center gap-2.5">
        <span className="w-8 h-8 rounded-lg bg-cyan-400/12 text-cyan-500 flex items-center justify-center [&>svg]:w-4 [&>svg]:h-4">{icon}</span>{title}
      </h2>
      {children}
    </section>
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5 pb-14">
        <div className="flex items-center gap-3">
          <SettingsIcon className="w-5 h-5 text-cyan-500" />
          <h1 className="text-xl font-extrabold text-ink-900 dark:text-white tracking-tight">Settings</h1>
        </div>

        {/* profile */}
        <Section icon={<User />} title="Your profile">
          {/* photo upload */}
          <div className="flex items-center gap-5 mb-6">
            <button
              onClick={() => photoRef.current?.click()}
              aria-label="Upload profile photo"
              className="relative group rounded-full focus-visible:outline-2 focus-visible:outline-cyan-400"
            >
              <Avatar name={profile.name || "You"} color={state.user?.color ?? "#22d3ee"} size={72} online src={state.user?.avatarUrl} />
              <span className="absolute inset-0 rounded-full bg-ink-950/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="w-5 h-5 text-white" />
              </span>
            </button>
            <div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => photoRef.current?.click()}>
                  <Camera className="w-3.5 h-3.5" /> Upload photo
                </Button>
                {state.user?.avatarUrl && (
                  <Button size="sm" variant="ghost" onClick={removePhoto}><X className="w-3.5 h-3.5" /> Remove</Button>
                )}
              </div>
              <p className="text-[11.5px] text-ink-400 mt-2">JPG or PNG, up to 5 MB. Shown in chat, DMs and your member card.</p>
            </div>
            <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={onPhoto} />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Full name" value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} />
            <Field label="Email" type="email" value={profile.email} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} />
          </div>

          {/* skill tags editor */}
          <div className="mt-5">
            <p className="text-[13px] font-medium text-ink-600 dark:text-ink-200 mb-2">Skill tags <span className="text-ink-400 font-normal">(frontend, backend, ml… · max 10)</span></p>
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {skills.length === 0 && <span className="text-[12px] text-ink-400">No tags yet — add what you're good at so teammates know who to ping.</span>}
              {skills.map(s => (
                <span key={s} className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/40 bg-cyan-400/10 text-cyan-600 dark:text-cyan-300 px-3 py-1 text-[12px] font-semibold">
                  {s}
                  <button onClick={() => setSkills(sk => sk.filter(x => x !== s))} aria-label={`Remove ${s} tag`} className="hover:text-rose-500 transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={skillInput}
                onChange={e => setSkillInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
                placeholder="e.g. frontend"
                aria-label="Add skill tag"
                className="flex-1 max-w-[220px] rounded-xl px-3.5 py-2 text-sm bg-white dark:bg-ink-850 border border-ink-200 dark:border-white/12 text-ink-900 dark:text-ink-50 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
              />
              <Button size="sm" variant="secondary" onClick={addSkill} disabled={!skillInput.trim()} disabledReason="Type a tag first"><Plus className="w-3.5 h-3.5" /> Add</Button>
            </div>
          </div>

          <div className="flex justify-end mt-5"><Button size="sm" onClick={saveProfile}><Save className="w-3.5 h-3.5" /> Save profile</Button></div>
        </Section>

        {/* appearance */}
        <Section icon={<Palette />} title="Appearance">
          <div className="flex gap-3">
            {(["dark", "light"] as const).map(t => (
              <button key={t} onClick={() => dispatch({ type: "patch", patch: { theme: t } })}
                className={cn("flex-1 rounded-xl border-2 p-4 flex flex-col items-center gap-2 transition-all",
                  state.theme === t ? "border-cyan-400 bg-cyan-400/8" : "border-ink-200 dark:border-white/10 hover:border-ink-300 dark:hover:border-white/20")}>
                {t === "dark" ? <Moon className="w-5 h-5 text-violet-400" /> : <Sun className="w-5 h-5 text-amber-400" />}
                <span className="text-[13px] font-semibold capitalize text-ink-700 dark:text-ink-100">{t} mode</span>
              </button>
            ))}
          </div>
        </Section>

        {/* notifications */}
        <Section icon={<Bell />} title="Notification preferences">
          <div className="space-y-4">
            {([
              ["Timer sounds", "Beep on deadline warnings and completion", "sound"],
              ["Browser notifications", "System notifications for deadline events", "notifications"],
              ["Mentions", "Notify me when a teammate mentions me", "mentions"],
              ["Email digest", "Daily summary of team activity", "emailDigest"],
            ] as const).map(([t, d, k]) => (
              <label key={k} className="flex items-center justify-between gap-4">
                <span>
                  <span className="block text-[13.5px] font-semibold text-ink-800 dark:text-ink-50">{t}</span>
                  <span className="block text-[12px] text-ink-400 mt-0.5">{d}</span>
                </span>
                <Toggle checked={state.prefs[k]} onChange={v => dispatch({ type: "patch", patch: { prefs: { ...state.prefs, [k]: v } } })} label={t} />
              </label>
            ))}
          </div>
        </Section>

        {/* team settings */}
        <Section icon={<Users />} title={`Team settings — ${team?.name}`}>
          {/* team photo */}
          <div className="flex items-center gap-5 mb-6">
            <button
              onClick={() => teamPhotoRef.current?.click()}
              aria-label="Upload team photo"
              className="relative group rounded-xl focus-visible:outline-2 focus-visible:outline-cyan-400"
            >
              {team?.logoUrl ? (
                <img src={team.logoUrl} alt={`${team.name} logo`} className="w-[72px] h-[72px] rounded-xl object-cover border border-ink-200/50 dark:border-white/10" />
              ) : (
                <span className="w-[72px] h-[72px] rounded-xl flex items-center justify-center text-4xl" style={{ background: `${team?.color}22` }}>{team?.emoji}</span>
              )}
              <span className="absolute inset-0 rounded-xl bg-ink-950/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="w-5 h-5 text-white" />
              </span>
            </button>
            <div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => teamPhotoRef.current?.click()}>
                  <Camera className="w-3.5 h-3.5" /> Upload team photo
                </Button>
                {team?.logoUrl && (
                  <Button size="sm" variant="ghost" onClick={removeTeamPhoto}><X className="w-3.5 h-3.5" /> Remove</Button>
                )}
              </div>
              <p className="text-[11.5px] text-ink-400 mt-2">JPG or PNG, up to 5 MB. Replaces the emoji at the top of the workspace and on team cards.</p>
            </div>
            <input ref={teamPhotoRef} type="file" accept="image/*" className="hidden" onChange={onTeamPhoto} />
          </div>

          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Team name" value={teamForm.name} onChange={e => setTeamForm(f => ({ ...f, name: e.target.value }))} />
              <Field label="Hackathon" value={teamForm.hackathon} onChange={e => setTeamForm(f => ({ ...f, hackathon: e.target.value }))} />
            </div>
            <TextArea label="Description" rows={2} value={teamForm.description} onChange={e => setTeamForm(f => ({ ...f, description: e.target.value }))} />
            <TextArea label="Problem statement (powers the AI Mentor & Roadmap)" rows={3} value={teamForm.problem} onChange={e => setTeamForm(f => ({ ...f, problem: e.target.value }))} />
            <Field label="Member capacity (max 12)" type="number" min={team?.members.length} max={12} value={teamForm.capacity} onChange={e => setTeamForm(f => ({ ...f, capacity: e.target.value }))} />
            <div className="flex justify-end"><Button size="sm" onClick={saveTeam}><Save className="w-3.5 h-3.5" /> Save team settings</Button></div>
          </div>

          <div className="mt-6 pt-5 border-t border-ink-200/60 dark:border-white/8">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[13px] font-bold text-ink-700 dark:text-ink-100">Members & roles</p>
              <Button variant="outline" size="sm" onClick={openInvite}><UserPlus className="w-3.5 h-3.5" /> Invite Members</Button>
            </div>
            <div className="space-y-2.5">
              {team?.members.map(m => (
                <div key={m.id} className="flex items-center gap-3 rounded-xl bg-ink-50/60 dark:bg-white/4 px-3.5 py-2.5">
                  <Avatar name={m.name} color={m.color} size={32} online={m.online} src={m.id === state.user?.id || m.id === "u-you" ? state.user?.avatarUrl : m.avatarUrl} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-ink-800 dark:text-ink-50 truncate">{m.name}{m.id === state.user?.id && " (you)"}</p>
                  </div>
                  {m.id === state.user?.id ? (
                    <Badge tone="violet">{m.role}</Badge>
                  ) : (
                    <>
                      <select
                        value={m.role}
                        onChange={e => setRole(m, e.target.value as Member["role"])}
                        aria-label={`Role for ${m.name}`}
                        className="text-[12px] font-semibold rounded-lg border border-ink-200 dark:border-white/12 bg-white dark:bg-ink-850 text-ink-700 dark:text-ink-100 px-2 py-1.5 outline-none focus:ring-2 focus:ring-cyan-400/50"
                      >
                        <option>Admin</option><option>Member</option>
                      </select>
                      <Tooltip label={`Remove ${m.name}`}>
                        <button onClick={() => removeMember(m)} aria-label={`Remove ${m.name}`} className="p-1.5 rounded-lg text-ink-300 dark:text-ink-500 hover:text-rose-500 hover:bg-rose-400/10">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </Tooltip>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* danger zone */}
        <section className="rounded-2xl border border-rose-400/30 bg-rose-400/4 p-5 sm:p-6">
          <h2 className="font-bold text-[15px] text-rose-500 mb-4 flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-rose-400/12 flex items-center justify-center"><ShieldAlert className="w-4 h-4" /></span>Danger zone
          </h2>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-[13.5px] font-semibold text-ink-800 dark:text-ink-50">Leave this team</p><p className="text-[12px] text-ink-400">You'll lose access to its chat, files and roadmap.</p></div>
              <Button variant="secondary" size="sm" onClick={() => setConfirmLeave(true)}><LogOut className="w-3.5 h-3.5" /> Leave team</Button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-[13.5px] font-semibold text-ink-800 dark:text-ink-50">Delete this team</p><p className="text-[12px] text-ink-400">Permanently removes the workspace for everyone.</p></div>
              <Button variant="danger" size="sm" onClick={() => setConfirmDeleteTeam(true)}><Trash2 className="w-3.5 h-3.5" /> Delete team</Button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-[13.5px] font-semibold text-ink-800 dark:text-ink-50">Delete my account</p><p className="text-[12px] text-ink-400">Signs you out and clears your data on this device.</p></div>
              <Button variant="danger" size="sm" onClick={() => setConfirmDeleteAccount(true)}><Trash2 className="w-3.5 h-3.5" /> Delete account</Button>
            </div>
          </div>
        </section>

        <p className="text-center text-[11px] text-ink-400 pt-2">Vadanam · Created by Sai Karthik</p>
      </div>

      <Confirm open={confirmLeave} onClose={() => setConfirmLeave(false)} title="Leave this team?" confirmLabel="Leave team"
        body={`You'll be removed from ${team?.name} and lose access to its workspace. You can rejoin later with a new invite link.`}
        onConfirm={() => {
          if (isConfigured && team && state.user) {
            api.removeMember(team.id, state.user.id).catch(e => toast("error", api.friendlyError(e)));
          }
          dispatch({ type: "patch", patch: { teams: state.teams.filter(t => t.id !== team?.id), activeTeam: null } });
          toast("success", `You left ${team?.name}.`);
          navigate("/teams");
        }} />
      <Confirm open={confirmDeleteTeam} onClose={() => setConfirmDeleteTeam(false)} title="Delete this team?" confirmLabel="Delete forever"
        body={`This permanently deletes ${team?.name}, including its chat history, files, roadmap and tasks. This cannot be undone.`}
        onConfirm={() => {
          if (isConfigured && team) {
            api.deleteTeam(team.id).catch(e => toast("error", api.friendlyError(e)));
          }
          dispatch({ type: "patch", patch: { teams: state.teams.filter(t => t.id !== team?.id), activeTeam: null } });
          toast("success", "Team deleted.");
          navigate("/teams");
        }} />
      <Confirm open={confirmDeleteAccount} onClose={() => setConfirmDeleteAccount(false)} title="Delete your account?" confirmLabel="Delete account"
        body={isConfigured
          ? "This signs you out and clears data on this device. To permanently erase your account, contact support."
          : "This signs you out and clears data on this device."}
        onConfirm={async () => {
          if (isConfigured) await api.authSignOut().catch(() => undefined);
          localStorage.removeItem("hcc-state-v1");
          dispatch({ type: "patch", patch: { user: null, activeTeam: null } });
          navigate("/");
        }} />
    </div>
  );
}

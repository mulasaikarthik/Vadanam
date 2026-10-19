import { useState } from "react";
import { Map, Plus, Sparkles, Check, Loader2, Trash2, Link2, ChevronDown, X } from "lucide-react";
import { Button, Badge, Empty, Field, TextArea, Modal, Confirm, Tooltip } from "@/components/ui";
import { useStore, useTeam, uid, type Milestone } from "@/lib/store";
import { isConfigured } from "@/lib/supabase";
import * as api from "@/lib/api";
import { cn } from "@/utils";

const STATUS_META = {
  done: { dot: "bg-emerald-400", label: "Done", tone: "green" },
  active: { dot: "bg-cyan-400", label: "In progress", tone: "cyan" },
  todo: { dot: "bg-ink-300 dark:bg-ink-600", label: "Up next", tone: "gray" },
} as const;

const GENERATED: Omit<Milestone, "id">[] = [
  { title: "Lock scope & success criteria", due: "Hour 2", status: "todo", priority: "high", acceptance: ["Problem statement agreed by all members", "MVP feature list ≤ 5 items", "Judging criteria mapped to features"], description: "Agree on the smallest demo that wins. Write down what you are NOT building." },
  { title: "Core feature walking skeleton", due: "Hour 10", status: "todo", priority: "high", acceptance: ["End-to-end happy path works", "Deployed to a live URL", "Teammates can click through it"], description: "Ship the thinnest possible end-to-end slice before adding depth." },
  { title: "Differentiator feature complete", due: "Hour 20", status: "todo", priority: "high", acceptance: ["The 'wow' feature works live", "Fallback plan if it breaks during demo"], description: "The one thing judges will remember. Protect time for it." },
  { title: "Polish, a11y & edge cases", due: "Hour 28", status: "todo", priority: "medium", acceptance: ["Empty/error states handled", "Mobile layout verified", "Keyboard navigation works"], description: "Judges poke at broken states. Don't let them find one." },
  { title: "Demo video & submission package", due: "Hour 33", status: "todo", priority: "high", acceptance: ["2-minute video recorded", "Submission form complete", "README has setup steps"], description: "Submit at least one hour early. Platforms crash at deadlines." },
];

export default function Roadmap() {
  const { state, dispatch, toast } = useStore();
  const team = useTeam();
  const teamId = team?.id ?? "";
  const milestones = state.milestones[teamId] ?? [];
  const tasks = state.tasks[teamId] ?? [];
  const [generating, setGenerating] = useState(false);
  const [confirmGen, setConfirmGen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(milestones.find(m => m.status === "active")?.id ?? null);
  const [form, setForm] = useState({ title: "", due: "", description: "", acceptance: "" });

  const setMilestones = (ms: Milestone[]) => dispatch({ type: "ms:set", teamId, milestones: ms });

  const generate = () => {
    setConfirmGen(false);
    setGenerating(true);
    if (isConfigured && state.user) {
      api.replaceMilestones(teamId, state.user.id, GENERATED)
        .then(ms => { setMilestones(ms); toast("success", "Roadmap generated and saved to your team."); })
        .catch(e => toast("error", api.friendlyError(e)))
        .finally(() => setGenerating(false));
      return;
    }
    setTimeout(() => {
      setMilestones(GENERATED.map(g => ({ ...g, id: uid() })));
      setGenerating(false);
      toast("success", "Roadmap generated from a proven hackathon template. The AI-personalized version arrives when a provider is connected.");
    }, 1600);
  };

  const cycle = (m: Milestone) => {
    const next = m.status === "todo" ? "active" : m.status === "active" ? "done" : "todo";
    setMilestones(milestones.map(x => x.id === m.id ? { ...x, status: next } : x));
    if (isConfigured) api.updateMilestoneStatus(m.id, next).catch(e => toast("error", api.friendlyError(e)));
  };

  const add = () => {
    if (form.title.trim().length < 3) { toast("error", "Give the milestone a title."); return; }
    const item = {
      title: form.title.trim(), due: form.due.trim() || "TBD",
      description: form.description.trim(),
      acceptance: form.acceptance.split("\n").map(s => s.trim()).filter(Boolean),
    };
    if (isConfigured && state.user) {
      api.addMilestone(teamId, state.user.id, { ...item, position: milestones.length })
        .then(m => { setMilestones([...(state.milestones[teamId] ?? []), m]); toast("success", "Milestone added."); })
        .catch(e => toast("error", api.friendlyError(e)));
    } else {
      setMilestones([...milestones, { id: uid(), status: "todo", priority: "medium", ...item }]);
      toast("success", "Milestone added.");
    }
    setForm({ title: "", due: "", description: "", acceptance: "" });
    setAddOpen(false);
  };

  const doneCount = milestones.filter(m => m.status === "done").length;
  const progress = milestones.length ? Math.round((doneCount / milestones.length) * 100) : 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <Map className="w-5 h-5 text-cyan-500" />
          <h1 className="text-xl font-extrabold text-ink-900 dark:text-white tracking-tight">Project Roadmap</h1>
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setAddOpen(true)}><Plus className="w-3.5 h-3.5" /> Add Milestone</Button>
            <Button size="sm" onClick={() => milestones.length ? setConfirmGen(true) : generate()} disabled={generating}>
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {generating ? "Generating…" : "Generate Roadmap"}
            </Button>
          </div>
        </div>

        {milestones.length > 0 && (
          <div className="glass p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[13px] font-bold text-ink-700 dark:text-ink-100">{team?.hackathon} · overall progress</p>
              <span className="text-sm font-extrabold text-cyan-500">{progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-ink-200/70 dark:bg-white/8 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {generating ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="glass p-4 flex gap-3">
                <div className="skeleton w-3 h-3 rounded-full mt-1.5" />
                <div className="flex-1 space-y-2.5">
                  <div className="skeleton h-4 w-2/3" />
                  <div className="skeleton h-3 w-full" />
                  <div className="skeleton h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : milestones.length === 0 ? (
          <div className="glass">
            <Empty icon={<Map className="w-6 h-6" />} title="No roadmap yet"
              body="Generate a milestone-by-milestone plan from your problem statement, or build your own from scratch."
              action={<div className="flex gap-2">
                <Button size="sm" onClick={generate}><Sparkles className="w-3.5 h-3.5" /> Generate Roadmap</Button>
                <Button variant="secondary" size="sm" onClick={() => setAddOpen(true)}><Plus className="w-3.5 h-3.5" /> Add Milestone</Button>
              </div>} />
          </div>
        ) : (
          <ol className="relative space-y-3">
            <span className="absolute left-[13px] top-3 bottom-3 w-px bg-gradient-to-b from-cyan-400/40 via-violet-400/30 to-transparent" aria-hidden />
            {milestones.map(m => {
              const meta = STATUS_META[m.status];
              const depends = m.dependsOn ? milestones.find(x => x.id === m.dependsOn) : null;
              const linked = tasks.filter(t => t.milestoneId === m.id);
              const open = expanded === m.id;
              return (
                <li key={m.id} className="relative pl-9">
                  <button onClick={() => cycle(m)} aria-label={`Status: ${meta.label}. Click to change`}
                    className={cn("absolute left-1 top-4 w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center bg-white dark:bg-ink-900",
                      m.status === "done" ? "border-emerald-400 bg-emerald-400" : m.status === "active" ? "border-cyan-400" : "border-ink-300 dark:border-ink-600")}>
                    {m.status === "done" ? <Check className="w-3 h-3 text-white" /> : <span className={cn("w-2 h-2 rounded-full", meta.dot)} />}
                  </button>
                  <div className={cn("glass p-4", m.status === "active" && "!border-cyan-400/50")}>
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className={cn("font-bold text-[14.5px]", m.status === "done" ? "line-through text-ink-400" : "text-ink-900 dark:text-white")}>{m.title}</h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          <Badge tone={meta.tone as "green"}>{meta.label}</Badge>
                          <Badge tone={m.priority === "high" ? "amber" : m.priority === "medium" ? "violet" : "cyan"}>{m.priority} priority</Badge>
                          <span className="text-[11.5px] text-ink-400">Due {m.due}</span>
                          {depends && <Tooltip label={`Blocked until "${depends.title}" is done`}><span className="text-[11px] text-ink-400 flex items-center gap-1"><Link2 className="w-3 h-3" /> after: {depends.title.slice(0, 22)}{depends.title.length > 22 && "…"}</span></Tooltip>}
                        </div>
                      </div>
                      <button onClick={() => setExpanded(open ? null : m.id)} aria-expanded={open} aria-label="Toggle details"
                        className="p-1.5 rounded-lg text-ink-400 hover:bg-ink-100 dark:hover:bg-white/8">
                        <ChevronDown className={cn("w-4 h-4 transition-transform", open && "rotate-180")} />
                      </button>
                      <button onClick={() => setDeleteId(m.id)} aria-label="Delete milestone" className="p-1.5 rounded-lg text-ink-300 dark:text-ink-500 hover:text-rose-500 hover:bg-rose-400/10">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {open && (
                      <div>
                        <p className="text-[13px] text-ink-500 dark:text-ink-300 mt-3 leading-relaxed">{m.description}</p>
                        {m.acceptance.length > 0 && (
                          <div className="mt-3">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400 mb-1.5">Acceptance criteria</p>
                            <ul className="space-y-1">
                              {m.acceptance.map((a, i) => (
                                <li key={i} className="flex items-start gap-2 text-[12.5px] text-ink-600 dark:text-ink-200">
                                  <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" /> {a}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {linked.length > 0 && (
                          <p className="text-[11.5px] text-ink-400 mt-3">{linked.filter(t => t.done).length}/{linked.length} linked tasks complete</p>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add a milestone">
        <div className="space-y-4">
          <Field label="Title" placeholder="e.g. Working prototype of the core feature" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
          <Field label="Due" placeholder="e.g. Sat 14:00 or Hour 20" value={form.due} onChange={e => setForm(f => ({ ...f, due: e.target.value }))} />
          <TextArea label="Description" rows={2} placeholder="What does 'done' look like?" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <TextArea label="Acceptance criteria (one per line)" rows={3} placeholder={"Deployed to live URL\nWorks on mobile"} value={form.acceptance} onChange={e => setForm(f => ({ ...f, acceptance: e.target.value }))} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAddOpen(false)}><X className="w-4 h-4" /> Cancel</Button>
            <Button onClick={add}><Plus className="w-4 h-4" /> Add Milestone</Button>
          </div>
        </div>
      </Modal>

      <Confirm open={confirmGen} onClose={() => setConfirmGen(false)} title="Replace current roadmap?"
        body="Generating a new roadmap will replace your existing milestones. Linked task references will be kept but unpinned." confirmLabel="Replace & Generate" onConfirm={generate} />
      <Confirm open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete milestone?"
        body="This milestone and its acceptance criteria will be removed. Linked tasks stay in your task list."
        onConfirm={() => {
          const id = deleteId!;
          setMilestones(milestones.filter(m => m.id !== id));
          if (isConfigured) api.deleteMilestone(id).catch(e => toast("error", api.friendlyError(e)));
          toast("success", "Milestone deleted.");
        }} />
    </div>
  );
}

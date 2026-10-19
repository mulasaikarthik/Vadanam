import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ListChecks, Plus, Trash2, Check, Siren, X } from "lucide-react";
import { Button, Badge, Avatar, Empty, Field, Modal, Confirm, Tooltip } from "@/components/ui";
import { useStore, useTeam, uid, type Task } from "@/lib/store";
import { isConfigured } from "@/lib/supabase";
import * as api from "@/lib/api";
import { cn } from "@/utils";

const PRIORITIES: Task["priority"][] = ["low", "medium", "high", "critical"];
const PRIO_TONE = { low: "cyan", medium: "violet", high: "amber", critical: "rose" } as const;
const PRIO_RANK = { critical: 0, high: 1, medium: 2, low: 3 };

export default function Tasks() {
  const { state, dispatch, toast } = useStore();
  const team = useTeam();
  const teamId = team?.id ?? "";
  const tasks = state.tasks[teamId] ?? [];
  const milestones = state.milestones[teamId] ?? [];
  const [addOpen, setAddOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [prio, setPrio] = useState<Task["priority"]>("medium");
  const [assignee, setAssignee] = useState<string>("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [panic, setPanic] = useState(false);
  const [filter, setFilter] = useState<"all" | "open" | "done">("all");

  const setTasks = (t: Task[]) => dispatch({ type: "task:set", teamId, tasks: t });

  const visible = useMemo(() => {
    let v = tasks.filter(t => filter === "all" || (filter === "done" ? t.done : !t.done));
    v = [...v].sort((a, b) => Number(a.done) - Number(b.done) || PRIO_RANK[a.priority] - PRIO_RANK[b.priority]);
    if (panic) v = v.filter(t => !t.done && (t.priority === "critical" || t.priority === "high"));
    return v;
  }, [tasks, filter, panic]);

  const doneCount = tasks.filter(t => t.done).length;
  const readiness = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  const add = () => {
    if (title.trim().length < 3) { toast("error", "Give the task a short descriptive title (3+ characters)."); return; }
    if (isConfigured && state.user) {
      api.addTask(teamId, state.user.id, { title: title.trim(), priority: prio, assignee: assignee || undefined })
        .then(t => { setTasks([...(state.tasks[teamId] ?? []), t]); toast("success", "Task added."); })
        .catch(e => toast("error", api.friendlyError(e)));
    } else {
      setTasks([...tasks, { id: uid(), title: title.trim(), priority: prio, done: false, assignee: assignee || undefined }]);
      toast("success", "Task added.");
    }
    setTitle(""); setPrio("medium"); setAssignee(""); setAddOpen(false);
  };

  const toggleDone = (t: Task) => {
    setTasks(tasks.map(x => x.id === t.id ? { ...x, done: !x.done } : x));
    if (isConfigured) api.setTaskDone(t.id, !t.done).catch(e => toast("error", api.friendlyError(e)));
  };

  const member = (id?: string) => team?.members.find(m => m.id === id);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <ListChecks className="w-5 h-5 text-cyan-500" />
          <h1 className="text-xl font-extrabold text-ink-900 dark:text-white tracking-tight">Tasks & Milestone Work</h1>
          <div className="ml-auto flex gap-2">
            <Tooltip label={panic ? "Exit Panic Mode" : "Hide everything that isn't critical to shipping"}>
              <Button variant={panic ? "danger" : "secondary"} size="sm" onClick={() => { setPanic(p => !p); if (!panic) toast("info", "Panic Mode: showing only high & critical open tasks."); }}>
                <Siren className="w-3.5 h-3.5" /> {panic ? "Exit Panic Mode" : "Panic Mode"}
              </Button>
            </Tooltip>
            <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="w-3.5 h-3.5" /> Add Task</Button>
          </div>
        </div>

        {/* readiness */}
        <div className={cn("glass p-4 mt-4 mb-5", panic && "!border-rose-400/40")}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[13px] font-bold text-ink-700 dark:text-ink-100">Submission readiness</p>
            <span className={cn("text-sm font-extrabold", readiness >= 80 ? "text-emerald-500" : readiness >= 40 ? "text-amber-500" : "text-rose-500")}>{readiness}%</span>
          </div>
          <div className="h-2 rounded-full bg-ink-200/70 dark:bg-white/8 overflow-hidden">
            <motion.div className={cn("h-full rounded-full", readiness >= 80 ? "bg-gradient-to-r from-emerald-400 to-cyan-400" : "bg-gradient-to-r from-cyan-400 to-violet-500")}
              animate={{ width: `${readiness}%` }} transition={{ duration: 0.5 }} />
          </div>
          <p className="text-[11.5px] text-ink-400 mt-2">{doneCount} of {tasks.length} tasks complete.{panic && " Panic Mode is filtering to ship-critical work only."}</p>
        </div>

        {/* filters */}
        <div className="flex gap-1.5 mb-4">
          {(["all", "open", "done"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn("px-3.5 py-1.5 rounded-full text-[12.5px] font-semibold capitalize transition-colors",
                filter === f ? "bg-gradient-to-r from-cyan-500 to-violet-500 text-white" : "bg-ink-100 dark:bg-white/7 text-ink-500 dark:text-ink-300 hover:bg-ink-200 dark:hover:bg-white/12")}>
              {f}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className="glass">
            <Empty icon={<ListChecks className="w-6 h-6" />}
              title={panic ? "Nothing ship-critical is open" : "No tasks here"}
              body={panic ? "All high and critical tasks are done. Breathe — then polish." : "Break your milestones into small, assignable tasks your team can knock out."}
              action={!panic ? <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="w-3.5 h-3.5" /> Add your first task</Button> : undefined} />
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {visible.map(t => {
                const ms = milestones.find(m => m.id === t.milestoneId);
                const asg = member(t.assignee);
                return (
                  <motion.div key={t.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -24 }}
                    className={cn("glass flex items-center gap-3 px-4 py-3", t.done && "opacity-60")}>
                    <button
                      onClick={() => toggleDone(t)}
                      aria-label={t.done ? "Mark incomplete" : "Mark complete"}
                      className={cn("w-5.5 h-5.5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
                        t.done ? "bg-emerald-400 border-emerald-400" : "border-ink-300 dark:border-white/25 hover:border-cyan-400")}>
                      {t.done && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-[13.5px] font-semibold truncate", t.done ? "line-through text-ink-400" : "text-ink-800 dark:text-ink-50")}>{t.title}</p>
                      {ms && <p className="text-[11px] text-ink-400 truncate mt-0.5">↳ {ms.title}</p>}
                    </div>
                    <Badge tone={PRIO_TONE[t.priority]}>{t.priority}</Badge>
                    {asg && <Tooltip label={asg.name}><Avatar name={asg.name} color={asg.color} size={26} src={asg.id === state.user?.id || asg.id === "u-you" ? state.user?.avatarUrl : asg.avatarUrl} /></Tooltip>}
                    <Tooltip label="Delete task">
                      <button onClick={() => setDeleteId(t.id)} aria-label="Delete task" className="p-1.5 rounded-lg text-ink-300 dark:text-ink-500 hover:text-rose-500 hover:bg-rose-400/10">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </Tooltip>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* add modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add a task">
        <div className="space-y-4">
          <Field label="Task title" placeholder="e.g. Record the 2-minute demo video" value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} autoFocus />
          <div>
            <p className="text-[13px] font-medium text-ink-600 dark:text-ink-200 mb-2">Priority</p>
            <div className="flex gap-1.5 flex-wrap">
              {PRIORITIES.map(p => (
                <button key={p} onClick={() => setPrio(p)}
                  className={cn("px-3 py-1.5 rounded-full text-[12px] font-semibold capitalize border transition-all",
                    prio === p ? "border-cyan-400/60 bg-cyan-400/12 text-cyan-600 dark:text-cyan-300 scale-105" : "border-ink-200 dark:border-white/12 text-ink-500 dark:text-ink-300 hover:border-ink-300")}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[13px] font-medium text-ink-600 dark:text-ink-200 mb-2">Assignee (optional)</p>
            <div className="flex gap-2 flex-wrap">
              {team?.members.map(m => (
                <button key={m.id} onClick={() => setAssignee(a => a === m.id ? "" : m.id)}
                  className={cn("flex items-center gap-2 rounded-full pl-1 pr-3 py-1 border text-[12px] font-semibold transition-all",
                    assignee === m.id ? "border-cyan-400/60 bg-cyan-400/12 text-cyan-600 dark:text-cyan-300" : "border-ink-200 dark:border-white/12 text-ink-500 dark:text-ink-300")}>
                  <Avatar name={m.name} color={m.color} size={22} src={m.id === state.user?.id || m.id === "u-you" ? state.user?.avatarUrl : m.avatarUrl} />{m.name.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setAddOpen(false)}><X className="w-4 h-4" /> Cancel</Button>
            <Button onClick={add}><Plus className="w-4 h-4" /> Add Task</Button>
          </div>
        </div>
      </Modal>

      <Confirm open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete task?"
        body="This task will be removed for the whole team. This can't be undone."
        onConfirm={() => {
          const id = deleteId!;
          setTasks(tasks.filter(t => t.id !== id));
          if (isConfigured) api.deleteTask(id).catch(e => toast("error", api.friendlyError(e)));
          toast("success", "Task deleted.");
        }} />
    </div>
  );
}

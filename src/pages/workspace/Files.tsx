import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FolderOpen, ImageIcon, Film, FileText, FileCode2, Download, Search, MessageSquare } from "lucide-react";
import { Button, Empty, Badge, Modal, Tooltip } from "@/components/ui";
import { useStore, useTeam, fmtSize, fmtDay, type Attachment } from "@/lib/store";
import { cn } from "@/utils";

const KINDS = [
  { id: "all", label: "All" },
  { id: "image", label: "Images" },
  { id: "video", label: "Videos" },
  { id: "doc", label: "Documents" },
  { id: "code", label: "Code" },
] as const;

export default function Files() {
  const { state, toast } = useStore();
  const team = useTeam();
  const [filter, setFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<Attachment | null>(null);

  const files = useMemo(() => {
    const msgs = state.messages[team?.id ?? ""] ?? [];
    return msgs
      .filter(m => m.attachment && m.attachment.status === "done")
      .map(m => ({ att: m.attachment!, ts: m.ts, authorId: m.authorId }))
      .filter(f => (filter === "all" || f.att.kind === filter) && f.att.name.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => b.ts - a.ts);
  }, [state.messages, team, filter, query]);

  const icon = (k: string) =>
    k === "image" ? <ImageIcon className="w-5 h-5 text-pink-400" /> :
    k === "video" ? <Film className="w-5 h-5 text-violet-400" /> :
    k === "code" ? <FileCode2 className="w-5 h-5 text-cyan-400" /> :
    <FileText className="w-5 h-5 text-amber-400" />;

  const download = (att: Attachment) => {
    if (att.url) { const a = document.createElement("a"); a.href = att.url; a.download = att.name; a.click(); }
    else toast("info", "This file is no longer available. Ask your teammate to share it again.");
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <FolderOpen className="w-5 h-5 text-cyan-500" />
          <h1 className="text-xl font-extrabold text-ink-900 dark:text-white tracking-tight">Shared Files</h1>
          <Badge tone="gray">{files.length} file{files.length === 1 ? "" : "s"}</Badge>
          <div className="ml-auto glass !rounded-xl flex items-center gap-2 px-3 py-2">
            <Search className="w-3.5 h-3.5 text-ink-400" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search files…" className="bg-transparent outline-none text-[13px] w-36 text-ink-800 dark:text-ink-100 placeholder:text-ink-400" />
          </div>
        </div>

        <div className="flex gap-1.5 mb-6 flex-wrap">
          {KINDS.map(k => (
            <button key={k.id} onClick={() => setFilter(k.id)}
              className={cn("px-3.5 py-1.5 rounded-full text-[12.5px] font-semibold transition-colors",
                filter === k.id ? "bg-gradient-to-r from-cyan-500 to-violet-500 text-white" : "bg-ink-100 dark:bg-white/7 text-ink-500 dark:text-ink-300 hover:bg-ink-200 dark:hover:bg-white/12")}>
              {k.label}
            </button>
          ))}
        </div>

        {files.length === 0 ? (
          <div className="glass">
            <Empty icon={<FolderOpen className="w-6 h-6" />} title="No files here yet"
              body="Everything your team shares in chat — images, videos, documents and code — automatically shows up here."
              action={<Link to={`/team/${team?.id}/chat`}><Button variant="outline" size="sm"><MessageSquare className="w-3.5 h-3.5" /> Share something in chat</Button></Link>} />
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {files.map((f, i) => (
              <div key={i} className="glass p-4 hover:-translate-y-0.5 transition-transform group">
                {f.att.kind === "image" && f.att.url ? (
                  <button onClick={() => setPreview(f.att)} className="block w-full h-28 rounded-xl overflow-hidden mb-3 bg-ink-100 dark:bg-white/5">
                    <img src={f.att.url} alt={f.att.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  </button>
                ) : f.att.kind === "video" && f.att.url ? (
                  <video src={f.att.url} className="w-full h-28 rounded-xl object-cover mb-3 bg-ink-900" preload="metadata" />
                ) : (
                  <div className="w-full h-28 rounded-xl bg-ink-100/70 dark:bg-white/5 flex items-center justify-center mb-3">{icon(f.att.kind)}</div>
                )}
                <div className="flex items-start gap-2.5">
                  {icon(f.att.kind)}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-ink-800 dark:text-ink-50 truncate">{f.att.name}</p>
                    <p className="text-[11px] text-ink-400 mt-0.5">{fmtSize(f.att.size)} · {fmtDay(f.ts)}</p>
                  </div>
                  <Tooltip label="Download">
                    <button onClick={() => download(f.att)} className="p-1.5 rounded-lg text-ink-400 hover:text-cyan-500 hover:bg-cyan-400/10" aria-label={`Download ${f.att.name}`}>
                      <Download className="w-4 h-4" />
                    </button>
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.name} wide>
        {preview?.url && <img src={preview.url} alt={preview.name} className="w-full rounded-xl max-h-[65vh] object-contain" />}
      </Modal>
    </div>
  );
}

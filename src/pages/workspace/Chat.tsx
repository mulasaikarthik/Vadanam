import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Smile, Paperclip, ImageIcon, FileCode2, FileText, Film, Search, X, Reply,
  Pencil, Trash2, Copy, SmilePlus, Download, RefreshCw, MessageSquare, CornerUpLeft, Check,
} from "lucide-react";
import { Button, Avatar, Tooltip, Modal, Confirm, Empty } from "@/components/ui";
import { useStore, useTeam, uid, fmtTime, fmtDay, fmtSize, type Message, type Attachment, type Member as MemberType } from "@/lib/store";
import { MemberModal } from "./Layout";
import { isConfigured } from "@/lib/supabase";
import * as api from "@/lib/api";
import { highlight } from "@/components/fx";
import { cn } from "@/utils";

const EMOJIS = ["😀", "😂", "🔥", "🚀", "💯", "👍", "🎉", "❤️", "😅", "🤯", "👀", "🧠", "☕", "🐛", "✅", "😴", "🙌", "⚡", "🤝", "🏆"];
const QUICK_REACTIONS = ["👍", "🔥", "🎉", "❤️", "😂", "👀"];

/* ---------- message body renderer (text + code fences) ---------- */
function MessageBody({ text }: { text: string }) {
  const parts = useMemo(() => text.split(/```(\w*)\n?/), [text]);
  // split produces [text, lang, code, text, lang, code...]
  const out: React.ReactNode[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (i % 3 === 0) {
      if (parts[i]) out.push(<p key={i} className="whitespace-pre-wrap break-words leading-relaxed">{parts[i].replace(/\n$/, "")}</p>);
    } else if (i % 3 === 1) {
      const lang = parts[i];
      const code = (parts[i + 1] ?? "").replace(/\n$/, "");
      out.push(
        <div key={i} className="my-2">
          <div className="flex items-center justify-between rounded-t-xl bg-ink-900 dark:bg-black/40 border border-b-0 border-white/10 px-3 py-1.5">
            <span className="text-[10px] font-mono text-ink-400 uppercase">{lang || "code"}</span>
            <button onClick={() => navigator.clipboard?.writeText(code)} className="text-[10px] text-ink-400 hover:text-cyan-300 flex items-center gap-1"><Copy className="w-3 h-3" /> copy</button>
          </div>
          <pre className="codeblock !rounded-t-none">{highlight(code)}</pre>
        </div>
      );
      i++; // skip code part
    }
  }
  return <>{out}</>;
}

/* ---------- attachment renderer ---------- */
function AttachmentView({ att, onRetry, onPreview }: { att: Attachment; onRetry: () => void; onPreview: (att: Attachment) => void }) {
  const { toast } = useStore();
  const icon = att.kind === "image" ? <ImageIcon className="w-4.5 h-4.5 text-pink-400" />
    : att.kind === "video" ? <Film className="w-4.5 h-4.5 text-violet-400" />
    : att.kind === "code" ? <FileCode2 className="w-4.5 h-4.5 text-cyan-400" />
    : <FileText className="w-4.5 h-4.5 text-amber-400" />;

  if (att.status === "uploading") {
    return (
      <div className="mt-2 rounded-xl border border-ink-200/60 dark:border-white/10 p-3 w-64 max-w-full">
        <div className="flex items-center gap-2.5 text-[13px] text-ink-600 dark:text-ink-200">{icon}<span className="truncate flex-1">{att.name}</span><span className="text-[11px] text-ink-400">{Math.round(att.progress)}%</span></div>
        <div className="h-1.5 rounded-full bg-ink-200 dark:bg-white/10 mt-2.5 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 transition-all duration-200" style={{ width: `${att.progress}%` }} />
        </div>
      </div>
    );
  }
  if (att.status === "failed") {
    return (
      <div className="mt-2 rounded-xl border border-rose-400/40 bg-rose-400/8 p-3 w-64 max-w-full">
        <div className="flex items-center gap-2.5 text-[13px] text-rose-500">{icon}<span className="truncate flex-1">{att.name}</span></div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] text-rose-400">Upload failed</span>
          <button onClick={onRetry} className="text-[11px] font-semibold text-cyan-600 dark:text-cyan-300 hover:underline flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Retry</button>
        </div>
      </div>
    );
  }
  // done
  if (att.kind === "image" && att.url) {
    return (
      <button onClick={() => onPreview(att)} className="mt-2 block rounded-xl overflow-hidden border border-ink-200/60 dark:border-white/10 max-w-[280px] hover:opacity-90 transition-opacity">
        <img src={att.url} alt={att.name} className="w-full max-h-52 object-cover" />
      </button>
    );
  }
  if (att.kind === "video" && att.url) {
    return (
      <div className="mt-2 rounded-xl overflow-hidden border border-ink-200/60 dark:border-white/10 max-w-[320px]">
        <video src={att.url} controls className="w-full max-h-56" preload="metadata" />
      </div>
    );
  }
  const download = () => {
    if (att.url) {
      const a = document.createElement("a");
      a.href = att.url; a.download = att.name; a.click();
    } else {
      toast("info", "This file is no longer available. Ask your teammate to share it again.");
    }
  };
  return (
    <div className="mt-2 rounded-xl border border-ink-200/60 dark:border-white/10 bg-ink-50/50 dark:bg-white/4 p-3 w-64 max-w-full flex items-center gap-3">
      {icon}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-ink-700 dark:text-ink-100 truncate">{att.name}</p>
        <p className="text-[11px] text-ink-400">{fmtSize(att.size)}</p>
      </div>
      <Tooltip label="Download"><button onClick={download} className="p-1.5 rounded-lg text-ink-400 hover:text-cyan-500 hover:bg-cyan-400/10"><Download className="w-4 h-4" /></button></Tooltip>
    </div>
  );
}

/* ---------- main chat ---------- */
export default function Chat() {
  const { state, dispatch, toast } = useStore();
  const team = useTeam();
  const teamId = team?.id ?? "";
  const messages = state.messages[teamId] ?? [];
  const me = state.user?.id ?? "u-you";

  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [reactFor, setReactFor] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Attachment | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<HTMLInputElement>(null);

  const setMessages = (msgs: Message[]) => dispatch({ type: "msg:set", teamId, messages: msgs });

  // mark read
  useEffect(() => {
    dispatch({ type: "patch", patch: { lastRead: { ...state.lastRead, [teamId]: Date.now() } } });
  }, [teamId, messages.length]); // eslint-disable-line

  // autoscroll
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, teamId]);

  const filtered = useMemo(
    () => (query.trim() ? messages.filter(m => m.text.toLowerCase().includes(query.toLowerCase())) : messages),
    [messages, query]
  );

  const member = (id: string) =>
    team?.members.find(m => m.id === id) ?? { name: "Former member", color: "#64748b", avatarUrl: undefined };
  const [profileFor, setProfileFor] = useState<MemberType | null>(null);

  /* ----- long-press a message → action sheet (react/reply/copy/edit/delete) ----- */
  const [sheet, setSheet] = useState<Message | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStart = (m: Message) => {
    pressTimer.current = setTimeout(() => setSheet(m), 420);
  };
  const pressEnd = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
  };

  /* ----- sending ----- */
  const simulateUpload = (msgId: string) => {
    const tick = () => {
      dispatch({ type: "patch", patch: {} }); // noop keep-alive
      setTimeout(() => {
        const cur = (stateRef.current.messages[teamId] ?? []);
        const msg = cur.find(m => m.id === msgId);
        if (!msg?.attachment || msg.attachment.status !== "uploading") return;
        const next = Math.min(100, msg.attachment.progress + 12 + Math.random() * 18);
        const fail = next >= 55 && Math.random() < 0.08;
        dispatch({
          type: "msg:set", teamId,
          messages: cur.map(m => m.id === msgId ? {
            ...m,
            attachment: { ...m.attachment!, progress: fail ? m.attachment!.progress : next, status: fail ? "failed" : next >= 100 ? "done" : "uploading" },
          } : m),
        });
        if (!fail && next < 100) tick();
      }, 260);
    };
    tick();
  };
  const stateRef = useRef(state);
  stateRef.current = state;

  const kindOf = (f: File): Attachment["kind"] =>
    f.type.startsWith("image/") ? "image" : f.type.startsWith("video/") ? "video"
    : /\.(ts|tsx|js|jsx|py|go|rs|java|c|cpp|css|html|json|sh|sql)$/i.test(f.name) ? "code" : "doc";

  const send = () => {
    const text = draft.trim();
    if (!text && pendingFiles.length === 0) return;

    if (editing) {
      setMessages(messages.map(m => m.id === editing.id ? { ...m, text, edited: true } : m));
      if (isConfigured) api.editMessage(editing.id, text).catch(e => toast("error", api.friendlyError(e)));
      setEditing(null); setDraft("");
      return;
    }

    /* ---------- connected mode: write to Supabase ---------- */
    if (isConfigured && state.user) {
      const uidNow = state.user.id;
      const files = pendingFiles;
      const replyId = replyTo?.id;
      setDraft(""); setReplyTo(null); setPendingFiles([]);
      if (taRef.current) taRef.current.style.height = "auto";

      // OPTIMISTIC: show the text instantly — before any network round-trip.
      let tempId: string | null = null;
      if (text) {
        tempId = `tmp-${uid()}`;
        const optimistic: Message = { id: tempId, authorId: uidNow, text, ts: Date.now(), reactions: {}, replyTo: replyId };
        dispatch({ type: "msg:set", teamId, messages: [...(stateRef.current.messages[teamId] ?? []), optimistic] });
      }

      (async () => {
        try {
          if (text || files.length === 0) {
            const msg = await api.sendMessage(teamId, uidNow, text, replyId);
            // reconcile: replace the temp message with the server row
            // (realtime may have already delivered it — dedupe by id)
            const cur = stateRef.current.messages[teamId] ?? [];
            const withoutTemp = tempId ? cur.filter(m => m.id !== tempId) : cur;
            dispatch({
              type: "msg:set", teamId,
              messages: withoutTemp.some(m => m.id === msg.id)
                ? withoutTemp
                : [...withoutTemp, msg].sort((a, b) => a.ts - b.ts),
            });
          }
          for (const f of files) {
            const kind = kindOf(f);
            const holder = await api.sendMessage(teamId, uidNow, "");
            // show local uploading state while the real upload runs
            const local: Message = {
              ...holder,
              attachment: { kind, name: f.name, size: f.size, status: "uploading", progress: 40, url: URL.createObjectURL(f) },
            };
            dispatch({ type: "msg:set", teamId, messages: [...(stateRef.current.messages[teamId] ?? []), local] });
            try {
              const url = await api.uploadAttachment(teamId, holder.id, f, kind);
              dispatch({
                type: "msg:set", teamId,
                messages: (stateRef.current.messages[teamId] ?? []).map(m =>
                  m.id === holder.id ? { ...m, attachment: { ...m.attachment!, status: "done", progress: 100, url: url || m.attachment!.url } } : m),
              });
            } catch (upErr) {
              dispatch({
                type: "msg:set", teamId,
                messages: (stateRef.current.messages[teamId] ?? []).map(m =>
                  m.id === holder.id ? { ...m, attachment: { ...m.attachment!, status: "failed" } } : m),
              });
              toast("error", api.friendlyError(upErr));
            }
          }
        } catch (e) {
          // delivery failed: remove the optimistic message and restore the draft
          if (tempId) {
            dispatch({
              type: "msg:set", teamId,
              messages: (stateRef.current.messages[teamId] ?? []).filter(m => m.id !== tempId),
            });
            setDraft(text);
          }
          toast("error", api.friendlyError(e));
        }
      })();
      return;
    }

    const newMsgs: Message[] = [];
    if (pendingFiles.length) {
      pendingFiles.forEach((f, idx) => {
        const url = URL.createObjectURL(f);
        const id = uid();
        newMsgs.push({
          id, authorId: me, ts: Date.now(), reactions: {}, replyTo: idx === 0 ? replyTo?.id : undefined,
          text: idx === 0 ? text : "",
          attachment: { kind: kindOf(f), name: f.name, size: f.size, url, status: "uploading", progress: 4 },
        });
      });
    } else {
      newMsgs.push({ id: uid(), authorId: me, ts: Date.now(), text, reactions: {}, replyTo: replyTo?.id });
    }
    setMessages([...messages, ...newMsgs]);
    newMsgs.filter(m => m.attachment).forEach(m => simulateUpload(m.id));
    setDraft(""); setReplyTo(null); setPendingFiles([]);
    if (taRef.current) taRef.current.style.height = "auto";
  };

  const retry = (msgId: string) => {
    setMessages(messages.map(m => m.id === msgId && m.attachment ? { ...m, attachment: { ...m.attachment, status: "uploading", progress: 10 } } : m));
    setTimeout(() => simulateUpload(msgId), 50);
  };

  const react = (msgId: string, emoji: string) => {
    const target = messages.find(m => m.id === msgId);
    const had = (target?.reactions[emoji] ?? []).includes(me);
    setMessages(messages.map(m => {
      if (m.id !== msgId) return m;
      const users = m.reactions[emoji] ?? [];
      const reactions = { ...m.reactions, [emoji]: users.includes(me) ? users.filter(u => u !== me) : [...users, me] };
      if (reactions[emoji].length === 0) delete reactions[emoji];
      return { ...m, reactions };
    }));
    if (isConfigured && state.user) {
      api.toggleReaction(msgId, state.user.id, emoji, !had).catch(e => toast("error", api.friendlyError(e)));
    }
    setReactFor(null);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    if (e.key === "Escape") { setEditing(null); setReplyTo(null); if (editing) setDraft(""); }
  };

  const addFiles = (files: FileList | File[]) => {
    const arr = Array.from(files).slice(0, 5);
    if (!arr.length) return;
    setPendingFiles(p => [...p, ...arr].slice(0, 5));
  };

  const copyMsg = (m: Message) => {
    navigator.clipboard?.writeText(m.text).then(() => toast("success", "Message copied."));
  };

  /* ----- day groups ----- */
  let lastDay = "";

  return (
    <div
      className="h-full flex flex-col relative"
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={e => { if (e.currentTarget === e.target) setDragging(false); }}
      onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
    >
      {/* drag overlay */}
      <AnimatePresence>
        {dragging && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-3 z-30 rounded-2xl border-2 border-dashed border-cyan-400 bg-cyan-400/10 backdrop-blur-sm flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <Paperclip className="w-9 h-9 text-cyan-400 mx-auto mb-2" />
              <p className="font-bold text-cyan-600 dark:text-cyan-300">Drop files to share</p>
              <p className="text-xs text-ink-400 mt-1">Images, videos, documents and code</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* header */}
      <div className="flex items-center gap-3 px-4 sm:px-6 h-14 border-b border-ink-200/60 dark:border-white/8 shrink-0 bg-white/50 dark:bg-ink-900/40 backdrop-blur-xl">
        <MessageSquare className="w-4.5 h-4.5 text-cyan-500" />
        <h1 className="font-bold text-[15px] text-ink-900 dark:text-white">Team Chat</h1>
        <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-500">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          {team?.members.filter(m => m.online).length ?? 0} online
        </span>
        <div className="ml-auto flex items-center gap-1">
          {searchOpen ? (
            <div className="flex items-center gap-2 glass !rounded-xl px-3 py-1.5">
              <Search className="w-3.5 h-3.5 text-ink-400" />
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search messages…"
                className="bg-transparent outline-none text-[13px] w-36 sm:w-52 text-ink-800 dark:text-ink-100 placeholder:text-ink-400" />
              <button onClick={() => { setSearchOpen(false); setQuery(""); }} aria-label="Close search"><X className="w-3.5 h-3.5 text-ink-400 hover:text-ink-700 dark:hover:text-white" /></button>
            </div>
          ) : (
            <Tooltip label="Search messages">
              <button onClick={() => setSearchOpen(true)} aria-label="Search messages" className="p-2 rounded-lg text-ink-400 hover:text-ink-800 dark:hover:text-white hover:bg-ink-100 dark:hover:bg-white/8"><Search className="w-4.5 h-4.5" /></button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* messages */}
      <div ref={listRef} className="chat-scroll flex-1 overflow-y-auto px-4 sm:px-6 py-4">
        {filtered.length === 0 ? (
          query ? (
            <Empty icon={<Search className="w-6 h-6" />} title="No messages match" body={`Nothing found for "${query}". Try a different keyword.`} />
          ) : (
            <Empty icon={<MessageSquare className="w-6 h-6" />} title="No messages yet"
              body="This is the beginning of your team's story. Say hi, drop your first idea, or paste the problem statement." />
          )
        ) : (
          <div className="max-w-3xl mx-auto space-y-1">
            {filtered.map(m => {
              const mem = member(m.authorId);
              const mine = m.authorId === me;
              const day = fmtDay(m.ts);
              const showDay = day !== lastDay;
              lastDay = day;
              const replied = m.replyTo ? messages.find(x => x.id === m.replyTo) : null;
              return (
                <React.Fragment key={m.id}>
                  {showDay && (
                    <div className="flex items-center gap-3 py-3">
                      <span className="h-px flex-1 bg-ink-200/70 dark:bg-white/8" />
                      <span className="text-[11px] font-semibold text-ink-400">{day}</span>
                      <span className="h-px flex-1 bg-ink-200/70 dark:bg-white/8" />
                    </div>
                  )}
                  <div className={cn("group flex gap-2.5 py-1.5 relative", mine && "flex-row-reverse")}>
                    <button
                      onClick={() => { const full = team?.members.find(x => x.id === m.authorId); if (full) setProfileFor(full); }}
                      aria-label={`View ${mem.name}'s profile`}
                      className="shrink-0 self-start rounded-full hover:scale-110 transition-transform focus-visible:outline-2 focus-visible:outline-cyan-400"
                    >
                      <Avatar name={mem.name} color={mem.color} size={32} src={mine ? state.user?.avatarUrl : mem.avatarUrl} />
                    </button>
                    <div className={cn("max-w-[78%] min-w-0", mine && "flex flex-col items-end")}>
                      <div className={cn("flex items-baseline gap-2 mb-0.5", mine && "flex-row-reverse")}>
                        <span className="text-[12.5px] font-bold text-ink-800 dark:text-ink-50">{mine ? "You" : mem.name}</span>
                        <span className="text-[10.5px] text-ink-400">{fmtTime(m.ts)}{m.edited && " · edited"}</span>
                      </div>
                      {replied && (
                        <div className={cn("flex items-center gap-1.5 text-[11.5px] text-ink-400 mb-1 rounded-lg bg-ink-100/60 dark:bg-white/5 px-2.5 py-1.5 border-l-2 border-violet-400/60 max-w-full")}>
                          <CornerUpLeft className="w-3 h-3 shrink-0" />
                          <span className="font-semibold shrink-0">{member(replied.authorId).name}:</span>
                          <span className="truncate">{replied.text.replace(/```[\s\S]*```/g, "[code]") || "[attachment]"}</span>
                        </div>
                      )}
                      <div
                        className={cn(
                          "rounded-2xl px-3.5 py-2.5 text-[13.5px] select-none sm:select-text",
                          mine
                            ? "bg-gradient-to-br from-cyan-500/90 to-violet-500/90 text-white rounded-tr-md [&_.codeblock]:!bg-ink-950/60"
                            : "bg-white dark:bg-white/7 border border-ink-200/60 dark:border-white/8 text-ink-800 dark:text-ink-50 rounded-tl-md"
                        )}
                        onTouchStart={() => pressStart(m)}
                        onTouchEnd={pressEnd}
                        onTouchMove={pressEnd}
                        onContextMenu={e => { e.preventDefault(); setSheet(m); }}
                      >
                        {m.text && <MessageBody text={m.text} />}
                        {m.attachment && <AttachmentView att={m.attachment} onRetry={() => retry(m.id)} onPreview={setPreview} />}
                      </div>
                      {/* reactions */}
                      {Object.keys(m.reactions).length > 0 && (
                        <div className={cn("flex flex-wrap gap-1 mt-1", mine && "justify-end")}>
                          {Object.entries(m.reactions).map(([e, users]) => (
                            <button key={e} onClick={() => react(m.id, e)}
                              className={cn("rounded-full px-2 py-0.5 text-[12px] border transition-colors",
                                users.includes(me) ? "bg-cyan-400/15 border-cyan-400/50" : "bg-ink-100/70 dark:bg-white/6 border-transparent hover:border-ink-300 dark:hover:border-white/20")}>
                              {e} <span className="text-[10px] text-ink-500 dark:text-ink-300 font-semibold">{users.length}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {/* hover actions */}
                      <div className={cn(
                        "absolute -top-2.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center glass-strong !rounded-lg px-1 py-0.5 z-10",
                        mine ? "left-12" : "right-12"
                      )}>
                        <Tooltip label="React"><button onClick={() => setReactFor(reactFor === m.id ? null : m.id)} className="p-1.5 rounded-md text-ink-400 hover:text-amber-500 hover:bg-amber-400/10"><SmilePlus className="w-3.5 h-3.5" /></button></Tooltip>
                        <Tooltip label="Reply"><button onClick={() => { setReplyTo(m); setEditing(null); taRef.current?.focus(); }} className="p-1.5 rounded-md text-ink-400 hover:text-cyan-500 hover:bg-cyan-400/10"><Reply className="w-3.5 h-3.5" /></button></Tooltip>
                        <Tooltip label="Copy text"><button onClick={() => copyMsg(m)} className="p-1.5 rounded-md text-ink-400 hover:text-violet-500 hover:bg-violet-400/10"><Copy className="w-3.5 h-3.5" /></button></Tooltip>
                        {mine && (
                          <>
                            <Tooltip label="Edit"><button onClick={() => { setEditing(m); setReplyTo(null); setDraft(m.text); taRef.current?.focus(); }} className="p-1.5 rounded-md text-ink-400 hover:text-emerald-500 hover:bg-emerald-400/10"><Pencil className="w-3.5 h-3.5" /></button></Tooltip>
                            <Tooltip label="Delete"><button onClick={() => setDeleteId(m.id)} className="p-1.5 rounded-md text-ink-400 hover:text-rose-500 hover:bg-rose-400/10"><Trash2 className="w-3.5 h-3.5" /></button></Tooltip>
                          </>
                        )}
                      </div>
                      {/* reaction picker */}
                      <AnimatePresence>
                        {reactFor === m.id && (
                          <motion.div initial={{ opacity: 0, scale: 0.9, y: 4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                            className={cn("absolute top-6 z-20 glass-strong !rounded-full px-2 py-1.5 flex gap-1", mine ? "left-12" : "right-12")}>
                            {QUICK_REACTIONS.map(e => (
                              <button key={e} onClick={() => react(m.id, e)} className="text-lg hover:scale-125 transition-transform px-0.5">{e}</button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      {/* composer */}
      <div className="px-4 sm:px-6 pb-4 pt-1 shrink-0">
        <div className="max-w-3xl mx-auto">
          {/* reply / edit banner */}
          <AnimatePresence>
            {(replyTo || editing) && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                className="flex items-center gap-2.5 glass !rounded-t-xl !rounded-b-none px-4 py-2 text-[12.5px] border-b-0">
                {editing ? <Pencil className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> : <Reply className="w-3.5 h-3.5 text-cyan-500 shrink-0" />}
                <span className="text-ink-500 dark:text-ink-300 truncate flex-1">
                  {editing ? "Editing message" : <>Replying to <strong>{member(replyTo!.authorId).name}</strong>: {replyTo!.text.slice(0, 60) || "[attachment]"}</>}
                </span>
                <button onClick={() => { setReplyTo(null); setEditing(null); if (editing) setDraft(""); }} aria-label="Cancel"><X className="w-3.5 h-3.5 text-ink-400 hover:text-ink-700 dark:hover:text-white" /></button>
              </motion.div>
            )}
          </AnimatePresence>
          {/* pending attachments */}
          {pendingFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 glass !rounded-t-xl !rounded-b-none px-4 py-2.5 border-b-0">
              {pendingFiles.map((f, i) => (
                <span key={i} className="flex items-center gap-1.5 rounded-lg bg-ink-100 dark:bg-white/8 px-2.5 py-1.5 text-[11.5px] text-ink-600 dark:text-ink-200">
                  {f.type.startsWith("image/") ? <ImageIcon className="w-3.5 h-3.5 text-pink-400" /> : f.type.startsWith("video/") ? <Film className="w-3.5 h-3.5 text-violet-400" /> : <FileText className="w-3.5 h-3.5 text-amber-400" />}
                  <span className="max-w-[140px] truncate">{f.name}</span>
                  <button onClick={() => setPendingFiles(p => p.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`}><X className="w-3 h-3 text-ink-400 hover:text-rose-500" /></button>
                </span>
              ))}
            </div>
          )}
          <div className={cn("glass flex items-end gap-1.5 px-3 py-2.5 relative", (replyTo || editing || pendingFiles.length > 0) && "!rounded-t-none")}>
            {/* emoji picker */}
            <AnimatePresence>
              {emojiOpen && (
                <motion.div initial={{ opacity: 0, y: 8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  className="absolute bottom-full left-2 mb-2 glass-strong p-3 grid grid-cols-5 gap-1 z-20 w-56">
                  {EMOJIS.map(e => (
                    <button key={e} onClick={() => { setDraft(d => d + e); setEmojiOpen(false); taRef.current?.focus(); }}
                      className="text-xl p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-white/10 hover:scale-110 transition-all">{e}</button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
            <Tooltip label="Emoji">
              <button onClick={() => setEmojiOpen(o => !o)} aria-label="Emoji picker" className={cn("p-2 rounded-lg transition-colors", emojiOpen ? "text-amber-500 bg-amber-400/10" : "text-ink-400 hover:text-amber-500 hover:bg-amber-400/10")}>
                <Smile className="w-5 h-5" />
              </button>
            </Tooltip>
            <Tooltip label="Attach image or video">
              <button onClick={() => mediaRef.current?.click()} aria-label="Attach media" className="p-2 rounded-lg text-ink-400 hover:text-pink-500 hover:bg-pink-400/10"><ImageIcon className="w-5 h-5" /></button>
            </Tooltip>
            <Tooltip label="Attach document or code">
              <button onClick={() => fileRef.current?.click()} aria-label="Attach file" className="p-2 rounded-lg text-ink-400 hover:text-cyan-500 hover:bg-cyan-400/10"><Paperclip className="w-5 h-5" /></button>
            </Tooltip>
            <input ref={mediaRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
            <input ref={fileRef} type="file" multiple className="hidden" onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
            <textarea
              ref={taRef}
              rows={1}
              value={draft}
              onChange={e => { setDraft(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px"; }}
              onKeyDown={onKeyDown}
              placeholder={`Message ${team?.name}…  (Enter to send · Shift+Enter for a new line · \`\`\` for code)`}
              aria-label="Message composer"
              className="flex-1 bg-transparent outline-none resize-none text-[13.5px] text-ink-900 dark:text-ink-50 placeholder:text-ink-400 py-2 max-h-40"
            />
            <Button size="sm" onClick={send} disabled={!draft.trim() && pendingFiles.length === 0} disabledReason="Type a message or attach a file first" className="!rounded-xl !px-3.5 !py-2.5" aria-label={editing ? "Save edit" : "Send message"}>
              {editing ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>

        </div>
      </div>

      {/* image preview modal */}
      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.name} wide>
        {preview?.url && <img src={preview.url} alt={preview.name} className="w-full rounded-xl max-h-[65vh] object-contain" />}
        <div className="flex justify-between items-center mt-4">
          <span className="text-xs text-ink-400">{preview && fmtSize(preview.size)}</span>
          <Button variant="secondary" size="sm" onClick={() => { if (preview?.url) { const a = document.createElement("a"); a.href = preview.url; a.download = preview.name; a.click(); } }}>
            <Download className="w-3.5 h-3.5" /> Download
          </Button>
        </div>
      </Modal>

      <MemberModal member={profileFor} onClose={() => setProfileFor(null)} />

      {/* long-press action sheet */}
      <Modal open={!!sheet} onClose={() => setSheet(null)} title="Message actions">
        {sheet && (
          <>
            <p className="text-[12.5px] text-ink-400 line-clamp-2 mb-4 rounded-lg bg-ink-100/60 dark:bg-white/5 px-3 py-2">
              {sheet.text.replace(/```[\s\S]*```/g, "[code]") || "[attachment]"}
            </p>
            <div className="flex justify-center gap-1.5 mb-4">
              {QUICK_REACTIONS.map(e => (
                <button key={e} onClick={() => { react(sheet.id, e); setSheet(null); }}
                  className="text-2xl p-1.5 rounded-xl hover:bg-ink-100 dark:hover:bg-white/10 hover:scale-110 transition-all" aria-label={`React ${e}`}>
                  {e}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <Button variant="secondary" className="w-full" onClick={() => { setReplyTo(sheet); setEditing(null); setSheet(null); taRef.current?.focus(); }}>
                <Reply className="w-4 h-4" /> Reply
              </Button>
              <Button variant="secondary" className="w-full" onClick={() => { copyMsg(sheet); setSheet(null); }}>
                <Copy className="w-4 h-4" /> Copy text
              </Button>
              {sheet.authorId === me && (
                <>
                  <Button variant="secondary" className="w-full" onClick={() => { setEditing(sheet); setReplyTo(null); setDraft(sheet.text); setSheet(null); taRef.current?.focus(); }}>
                    <Pencil className="w-4 h-4" /> Edit
                  </Button>
                  <Button variant="danger" className="w-full" onClick={() => { setDeleteId(sheet.id); setSheet(null); }}>
                    <Trash2 className="w-4 h-4" /> Delete
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </Modal>

      <Confirm open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete message?"
        body="This message will be permanently removed from the conversation. This can't be undone."
        onConfirm={() => {
          const id = deleteId!;
          setMessages(messages.filter(m => m.id !== id));
          if (isConfigured) api.deleteMessage(id).catch(e => toast("error", api.friendlyError(e)));
          toast("success", "Message deleted.");
        }} />
    </div>
  );
}

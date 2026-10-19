import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Send, MessageSquare } from "lucide-react";
import { Button, Avatar, Badge, Empty, Modal } from "@/components/ui";
import { useStore, useTeam, uid, fmtTime, fmtDay } from "@/lib/store";
import { isConfigured } from "@/lib/supabase";
import * as api from "@/lib/api";
import { MemberModal } from "./Layout";
import { cn } from "@/utils";

export default function Dm() {
  const { memberId } = useParams();
  const { state, dispatch, toast } = useStore();
  const team = useTeam();
  const teamId = team?.id ?? "";
  const member = team?.members.find(m => m.id === memberId);
  const key = `${teamId}:${memberId}`;
  const msgs = state.dms[key] ?? [];
  const [draft, setDraft] = useState("");
  const [convId, setConvId] = useState<string | null>(null);
  const [dmError, setDmError] = useState<string | null>(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length, key]);

  // connected mode: open (or create) the real conversation and load history
  useEffect(() => {
    if (!isConfigured || !memberId || !state.user || memberId === state.user.id) return;
    let on = true;
    setConvId(null); setDmError(null);
    (async () => {
      try {
        const id = await api.openDm(memberId);
        if (!on) return;
        setConvId(id);
        const history = await api.fetchDms(id, state.user!.id);
        if (on) dispatch({ type: "dm:set", key, messages: history });
      } catch (e) {
        if (on) setDmError(api.friendlyError(e));
      }
    })();
    return () => { on = false; };
  }, [memberId, state.user?.id]); // eslint-disable-line

  // realtime: incoming DMs appear instantly — no refresh needed
  useEffect(() => {
    if (!isConfigured || !convId || !state.user) return;
    const myId = state.user.id;
    const unsub = api.subscribeDm(convId, row => {
      const cur = stateRef.current.dms[key] ?? [];
      if (cur.some(m => m.id === row.id)) return; // already shown (own optimistic send)
      dispatch({
        type: "dm:set", key,
        messages: [...cur, { id: row.id, fromMe: row.sender_id === myId, text: row.body, ts: Date.parse(row.created_at) }]
          .sort((a, b) => a.ts - b.ts),
      });
    });
    return unsub;
  }, [convId, key, state.user?.id]); // eslint-disable-line

  if (!member || member.id === state.user?.id || member.id === "u-you") {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="glass max-w-sm w-full">
          <Empty icon={<MessageSquare className="w-6 h-6" />} title="No conversation here"
            body="Pick a teammate from the sidebar to start an individual chat."
            action={<Link to={`/team/${teamId}/chat`}><Button variant="outline" size="sm"><ArrowLeft className="w-3.5 h-3.5" /> Back to team chat</Button></Link>} />
        </div>
      </div>
    );
  }

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    if (taRef.current) taRef.current.style.height = "auto";

    if (isConfigured && convId && state.user) {
      // OPTIMISTIC: show instantly, reconcile with the server in background
      const tempId = `tmp-${uid()}`;
      dispatch({ type: "dm:set", key, messages: [...(stateRef.current.dms[key] ?? []), { id: tempId, fromMe: true, text, ts: Date.now() }] });
      api.sendDm(convId, state.user.id, text)
        .then(m => {
          const cur = stateRef.current.dms[key] ?? [];
          const withoutTemp = cur.filter(x => x.id !== tempId);
          dispatch({
            type: "dm:set", key,
            messages: withoutTemp.some(x => x.id === m.id)
              ? withoutTemp
              : [...withoutTemp, m].sort((a, b) => a.ts - b.ts),
          });
        })
        .catch(e => {
          dispatch({ type: "dm:set", key, messages: (stateRef.current.dms[key] ?? []).filter(x => x.id !== tempId) });
          setDraft(text);
          toast("error", api.friendlyError(e));
        });
      return;
    }
    dispatch({ type: "dm:set", key, messages: [...msgs, { id: uid(), fromMe: true, text, ts: Date.now() }] });
  };

  let lastDay = "";

  return (
    <div className="h-full flex flex-col">
      {/* header */}
      <div className="flex items-center gap-3 px-4 sm:px-6 h-14 border-b border-ink-200/60 dark:border-white/8 shrink-0 bg-white/50 dark:bg-ink-900/40 backdrop-blur-xl">
        <Link to={`/team/${teamId}/chat`} aria-label="Back to team chat"
          className="p-1.5 -ml-1.5 rounded-lg text-ink-400 hover:text-ink-800 dark:hover:text-white hover:bg-ink-100 dark:hover:bg-white/8">
          <ArrowLeft className="w-4.5 h-4.5" />
        </Link>
        <button
          onClick={() => member.avatarUrl && setPhotoOpen(true)}
          aria-label={member.avatarUrl ? `Expand ${member.name}'s photo` : undefined}
          className={cn("rounded-full", member.avatarUrl && "hover:scale-110 transition-transform focus-visible:outline-2 focus-visible:outline-cyan-400")}
        >
          <Avatar name={member.name} color={member.color} size={32} online={member.online} src={member.avatarUrl} />
        </button>
        <button onClick={() => setAboutOpen(true)} aria-label={`About ${member.name}`} className="text-left rounded-lg px-1 -mx-1 py-0.5 hover:bg-ink-100/60 dark:hover:bg-white/6 transition-colors">
          <h1 className="font-bold text-[14.5px] text-ink-900 dark:text-white leading-none">{member.name}</h1>
          <p className={cn("text-[10.5px] mt-1 font-medium", member.online ? "text-emerald-500" : "text-ink-400")}>
            {member.online ? "Online" : "Offline"} · {member.role}
          </p>
        </button>

      </div>

      {dmError && (
        <div className="mx-4 sm:mx-6 mt-3 rounded-xl border border-rose-400/30 bg-rose-400/8 px-4 py-2.5 text-[12.5px] text-rose-500">
          {dmError}
        </div>
      )}

      {/* messages */}
      <div ref={listRef} className="chat-scroll flex-1 overflow-y-auto px-4 sm:px-6 py-4">
        {msgs.length === 0 ? (
          <Empty icon={<MessageSquare className="w-6 h-6" />} title={`Start a conversation with ${member.name.split(" ")[0]}`}
            body="Private, one-to-one messages — perfect for quick questions that don't need the whole team." />
        ) : (
          <div className="max-w-2xl mx-auto space-y-1">
            {msgs.map(m => {
              const day = fmtDay(m.ts);
              const showDay = day !== lastDay;
              lastDay = day;
              return (
                <div key={m.id}>
                  {showDay && (
                    <div className="flex items-center gap-3 py-3">
                      <span className="h-px flex-1 bg-ink-200/70 dark:bg-white/8" />
                      <span className="text-[11px] font-semibold text-ink-400">{day}</span>
                      <span className="h-px flex-1 bg-ink-200/70 dark:bg-white/8" />
                    </div>
                  )}
                  <div className={cn("flex gap-2.5 py-1.5", m.fromMe && "flex-row-reverse")}>
                    {m.fromMe
                      ? <Avatar name={state.user?.name ?? "You"} color={state.user?.color ?? "#22d3ee"} size={30} src={state.user?.avatarUrl} />
                      : (
                        <button onClick={() => member.avatarUrl && setPhotoOpen(true)} aria-label={`Expand ${member.name}'s photo`}
                          className="shrink-0 self-start rounded-full hover:scale-110 transition-transform">
                          <Avatar name={member.name} color={member.color} size={30} src={member.avatarUrl} />
                        </button>
                      )}
                    <div className={cn("max-w-[75%]", m.fromMe && "text-right")}>
                      <div className={cn(
                        "inline-block rounded-2xl px-3.5 py-2.5 text-[13.5px] text-left whitespace-pre-wrap break-words",
                        m.fromMe
                          ? "bg-gradient-to-br from-cyan-500/90 to-violet-500/90 text-white rounded-tr-md"
                          : "bg-white dark:bg-white/7 border border-ink-200/60 dark:border-white/8 text-ink-800 dark:text-ink-50 rounded-tl-md"
                      )}>
                        {m.text}
                      </div>
                      <p className="text-[10px] text-ink-400 mt-1">{fmtTime(m.ts)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* composer */}
      <div className="px-4 sm:px-6 pb-4 pt-1 shrink-0">
        <div className="max-w-2xl mx-auto">
          <div className="glass flex items-end gap-2 px-3.5 py-2.5">
            <textarea
              ref={taRef}
              rows={1}
              value={draft}
              onChange={e => { setDraft(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px"; }}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={`Message ${member.name.split(" ")[0]}…  (Enter to send)`}
              aria-label="Direct message composer"
              className="flex-1 bg-transparent outline-none resize-none text-[13.5px] text-ink-900 dark:text-ink-50 placeholder:text-ink-400 py-1.5 max-h-36"
            />
            <Button size="sm" onClick={send} disabled={!draft.trim()} disabledReason="Type a message first" className="!rounded-xl !px-3.5 !py-2.5" aria-label="Send">
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10.5px] text-ink-400 mt-1.5 text-center">Private conversation with {member.name.split(" ")[0]}.</p>
        </div>
      </div>

      {/* about this user */}
      <MemberModal member={aboutOpen ? member : null} onClose={() => setAboutOpen(false)} />

      {/* expanded profile photo */}
      <Modal open={photoOpen} onClose={() => setPhotoOpen(false)} title={member.name}>
        {member.avatarUrl && (
          <img src={member.avatarUrl} alt={`${member.name}'s photo`} className="w-full rounded-2xl max-h-[60vh] object-contain" />
        )}
        <div className="flex items-center justify-center gap-2 mt-4">
          <Badge tone={member.role === "Owner" ? "violet" : member.role === "Admin" ? "cyan" : "gray"}>{member.role}</Badge>
          {(member.skills ?? []).slice(0, 4).map(s => <Badge key={s} tone="cyan">{s}</Badge>)}
        </div>
      </Modal>
    </div>
  );
}

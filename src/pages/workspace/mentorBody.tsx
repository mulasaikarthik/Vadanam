import React, { useMemo } from "react";
import { highlight } from "@/components/fx";

/* renders mentor text: paragraphs, **bold**, inline code and ``` fences */
function inline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<strong key={`${keyBase}-${k++}`}>{m[1]}</strong>);
    else out.push(<code key={`${keyBase}-${k++}`} className="font-mono text-[12px] bg-ink-900/10 dark:bg-white/10 rounded px-1 py-0.5">{m[2]}</code>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function MessageBodyLite({ text }: { text: string }) {
  const parts = useMemo(() => text.split(/```(\w*)\n?/), [text]);
  const out: React.ReactNode[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (i % 3 === 0) {
      if (parts[i].trim()) out.push(<p key={i} className="whitespace-pre-wrap break-words">{inline(parts[i].replace(/^\n+|\n+$/g, ""), String(i))}</p>);
    } else if (i % 3 === 1) {
      const code = (parts[i + 1] ?? "").replace(/\n$/, "");
      out.push(<pre key={i} className="codeblock my-2">{highlight(code)}</pre>);
      i++;
    }
  }
  return <div className="space-y-2.5">{out}</div>;
}

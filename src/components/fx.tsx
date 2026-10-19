import React, { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";

/* ---------- animated particle field (canvas, cheap) ---------- */
export function Particles({ density = 55, className = "" }: { density?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let w = 0, h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const colors = ["34,211,238", "139,92,246", "229,86,180"];
    const pts = Array.from({ length: density }, () => ({
      x: Math.random(), y: Math.random(),
      vx: (Math.random() - 0.5) * 0.00022,
      vy: (Math.random() - 0.5) * 0.00022,
      r: Math.random() * 1.8 + 0.6,
      c: colors[Math.floor(Math.random() * colors.length)],
      a: Math.random() * 0.5 + 0.15,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        if (!reduced) {
          p.x += p.vx; p.y += p.vy;
          if (p.x < 0 || p.x > 1) p.vx *= -1;
          if (p.y < 0 || p.y > 1) p.vy *= -1;
        }
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.c},${p.a})`;
        ctx.fill();
      }
      // connecting lines
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = (pts[i].x - pts[j].x) * w, dy = (pts[i].y - pts[j].y) * h;
          const d = dx * dx + dy * dy;
          if (d < 110 * 110) {
            ctx.strokeStyle = `rgba(120,150,255,${0.07 * (1 - d / (110 * 110))})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(pts[i].x * w, pts[i].y * h);
            ctx.lineTo(pts[j].x * w, pts[j].y * h);
            ctx.stroke();
          }
        }
      }
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [density, reduced]);

  return <canvas ref={ref} className={`absolute inset-0 w-full h-full pointer-events-none ${className}`} aria-hidden />;
}

/* ---------- scroll reveal ---------- */
export function Reveal({ children, delay = 0, className = "", y = 28 }: { children: React.ReactNode; delay?: number; className?: string; y?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay, ease: [0.21, 0.6, 0.35, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ---------- 3D tilt card ---------- */
export function Tilt({ children, className = "", max = 7 }: { children: React.ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const onMove = (e: React.MouseEvent) => {
    if (reduced || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    ref.current.style.transform = `perspective(900px) rotateY(${px * max}deg) rotateX(${-py * max}deg) translateZ(0)`;
  };
  const onLeave = () => { if (ref.current) ref.current.style.transform = "perspective(900px) rotateY(0) rotateX(0)"; };
  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} className={className} style={{ transition: "transform 0.25s ease" }}>
      {children}
    </div>
  );
}

/* ---------- page transition wrapper ---------- */
export function Page({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

/* ---------- tiny syntax highlighter ---------- */
const KW = /\b(const|let|var|function|return|if|else|for|while|import|from|export|class|new|async|await|type|interface|extends|public|private|def|print|lambda|try|catch|throw|switch|case|break|default|null|undefined|true|false|this)\b/g;
export function highlight(code: string): React.ReactNode[] {
  const lines = code.split("\n");
  return lines.map((line, i) => {
    const parts: React.ReactNode[] = [];
    const cIdx = line.indexOf("//");
    const pIdx = line.indexOf("#");
    const commentAt = cIdx >= 0 ? cIdx : pIdx === 0 ? 0 : -1;
    let main = line, comment = "";
    if (commentAt >= 0) { main = line.slice(0, commentAt); comment = line.slice(commentAt); }
    let last = 0;
    const regex = new RegExp(`${KW.source}|("[^"]*"|'[^']*'|\`[^\`]*\`)|(\\b\\d+(\\.\\d+)?\\b)|(\\b[a-zA-Z_]\\w*)(?=\\()`, "g");
    let m: RegExpExecArray | null;
    while ((m = regex.exec(main))) {
      if (m.index > last) parts.push(main.slice(last, m.index));
      const txt = m[0];
      if (m[1] || /^(const|let|var|function|return|if|else|for|while|import|from|export|class|new|async|await|type|interface|extends|public|private|def|print|lambda|try|catch|throw|switch|case|break|default|null|undefined|true|false|this)$/.test(txt))
        parts.push(<span key={`${i}-${m.index}k`} className="tok-k">{txt}</span>);
      else if (m[2]) parts.push(<span key={`${i}-${m.index}s`} className="tok-s">{txt}</span>);
      else if (m[3]) parts.push(<span key={`${i}-${m.index}n`} className="tok-n">{txt}</span>);
      else parts.push(<span key={`${i}-${m.index}f`} className="tok-f">{txt}</span>);
      last = m.index + txt.length;
    }
    if (last < main.length) parts.push(main.slice(last));
    if (comment) parts.push(<span key={`${i}c`} className="tok-c">{comment}</span>);
    return <div key={i}>{parts.length ? parts : "\u00A0"}</div>;
  });
}

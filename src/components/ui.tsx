import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, AlertCircle, Info, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { useStore, initials } from "@/lib/store";
import { cn } from "@/utils";

/* ---------------- Button ---------------- */
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  disabledReason?: string;
};
export function Button({ variant = "primary", size = "md", className, disabledReason, disabled, children, ...rest }: BtnProps) {
  const base = "inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-150 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 disabled:opacity-45 disabled:cursor-not-allowed disabled:active:scale-100 select-none";
  const sizes = { sm: "text-xs px-3 py-1.5", md: "text-sm px-4 py-2.5", lg: "text-[15px] px-6 py-3" };
  const variants = {
    primary: "btn-sheen text-white bg-gradient-to-r from-cyan-500 via-sky-500 to-violet-500 hover:shadow-[0_8px_30px_rgba(34,211,238,0.35)] hover:brightness-110",
    secondary: "bg-ink-100 text-ink-800 hover:bg-ink-200 dark:bg-white/8 dark:text-ink-100 dark:hover:bg-white/14 border border-ink-200/60 dark:border-white/10",
    ghost: "text-ink-600 hover:bg-ink-100 dark:text-ink-200 dark:hover:bg-white/8",
    outline: "border border-cyan-400/40 text-cyan-600 dark:text-cyan-300 hover:bg-cyan-400/10",
    danger: "bg-rose-500/90 text-white hover:bg-rose-500 hover:shadow-[0_8px_30px_rgba(244,63,94,0.3)]",
  };
  const btn = (
    <button className={cn(base, sizes[size], variants[variant], className)} disabled={disabled} {...rest}>
      {children}
    </button>
  );
  if (disabled && disabledReason) return <Tooltip label={disabledReason}>{btn}</Tooltip>;
  return btn;
}

/* ---------------- Tooltip ---------------- */
export function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="relative inline-flex group/tt">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap rounded-lg bg-ink-900 text-ink-100 dark:bg-ink-100 dark:text-ink-900 text-[11px] font-medium px-2.5 py-1.5 opacity-0 translate-y-1 transition-all duration-150 group-hover/tt:opacity-100 group-hover/tt:translate-y-0 z-50 shadow-lg"
      >
        {label}
      </span>
    </span>
  );
}

/* ---------------- Inputs ---------------- */
type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string; hint?: string };
export function Field({ label, error, hint, className, id, ...rest }: FieldProps) {
  const fid = id ?? rest.name;
  return (
    <div className="space-y-1.5">
      {label && <label htmlFor={fid} className="block text-[13px] font-medium text-ink-600 dark:text-ink-200">{label}</label>}
      <input
        id={fid}
        className={cn(
          "w-full rounded-xl px-3.5 py-2.5 text-sm bg-white dark:bg-ink-850 border transition-colors",
          "text-ink-900 dark:text-ink-50 placeholder:text-ink-400 dark:placeholder:text-ink-500",
          "focus:outline-none focus:ring-2 focus:ring-cyan-400/50",
          error ? "border-rose-400/70" : "border-ink-200 dark:border-white/12 hover:border-ink-300 dark:hover:border-white/20",
          className
        )}
        aria-invalid={!!error}
        {...rest}
      />
      {error && <p className="text-xs text-rose-500 flex items-center gap-1" role="alert"><AlertCircle className="w-3 h-3" />{error}</p>}
      {!error && hint && <p className="text-xs text-ink-400">{hint}</p>}
    </div>
  );
}

export function PasswordField(props: FieldProps) {
  const [show, setShow] = React.useState(false);
  return (
    <div className="relative">
      <Field {...props} type={show ? "text" : "password"} className="pr-11" />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        className={cn("absolute right-3 text-ink-400 hover:text-ink-600 dark:hover:text-ink-200 transition-colors", props.label ? "top-[34px]" : "top-[11px]")}
      >
        {show ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
      </button>
    </div>
  );
}

export function TextArea({ label, error, className, id, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }) {
  const fid = id ?? rest.name;
  return (
    <div className="space-y-1.5">
      {label && <label htmlFor={fid} className="block text-[13px] font-medium text-ink-600 dark:text-ink-200">{label}</label>}
      <textarea
        id={fid}
        className={cn(
          "w-full rounded-xl px-3.5 py-2.5 text-sm bg-white dark:bg-ink-850 border resize-none",
          "text-ink-900 dark:text-ink-50 placeholder:text-ink-400 dark:placeholder:text-ink-500",
          "focus:outline-none focus:ring-2 focus:ring-cyan-400/50",
          error ? "border-rose-400/70" : "border-ink-200 dark:border-white/12",
          className
        )}
        {...rest}
      />
      {error && <p className="text-xs text-rose-500" role="alert">{error}</p>}
    </div>
  );
}

/* ---------------- Toggle ---------------- */
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative w-11 h-6 rounded-full transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-cyan-400 shrink-0",
        checked ? "bg-gradient-to-r from-cyan-500 to-violet-500" : "bg-ink-300 dark:bg-ink-600"
      )}
    >
      <span className={cn("absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200", checked && "translate-x-5")} />
    </button>
  );
}

/* ---------------- Avatar ---------------- */
export function Avatar({ name, color, size = 36, online, src }: { name: string; color: string; size?: number; online?: boolean; src?: string }) {
  return (
    <span className="relative inline-block shrink-0">
      {src ? (
        <img
          src={src}
          alt={name}
          className="rounded-full object-cover border border-white/20"
          style={{ width: size, height: size }}
        />
      ) : (
        <span
          className="flex items-center justify-center rounded-full font-bold text-white"
          style={{ width: size, height: size, fontSize: size * 0.36, background: `linear-gradient(135deg, ${color}, ${color}88)` }}
        >
          {initials(name)}
        </span>
      )}
      {online !== undefined && (
        <span
          className={cn("absolute bottom-0 right-0 rounded-full border-2 border-white dark:border-ink-900", online ? "bg-emerald-400" : "bg-ink-400")}
          style={{ width: size * 0.3, height: size * 0.3 }}
          title={online ? "Online" : "Offline"}
        />
      )}
    </span>
  );
}

/* ---------------- Badge ---------------- */
export function Badge({ children, tone = "cyan", className }: { children: React.ReactNode; tone?: "cyan" | "violet" | "magenta" | "green" | "amber" | "rose" | "gray"; className?: string }) {
  const tones = {
    cyan: "bg-cyan-400/12 text-cyan-600 dark:text-cyan-300 border-cyan-400/25",
    violet: "bg-violet-400/12 text-violet-600 dark:text-violet-300 border-violet-400/25",
    magenta: "bg-pink-400/12 text-pink-600 dark:text-pink-300 border-pink-400/25",
    green: "bg-emerald-400/12 text-emerald-600 dark:text-emerald-300 border-emerald-400/25",
    amber: "bg-amber-400/12 text-amber-600 dark:text-amber-300 border-amber-400/25",
    rose: "bg-rose-400/12 text-rose-600 dark:text-rose-300 border-rose-400/25",
    gray: "bg-ink-400/12 text-ink-500 dark:text-ink-300 border-ink-400/25",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", tones[tone], className)}>{children}</span>;
}

/* ---------------- Modal ---------------- */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink-950/60 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onMouseDown={e => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            ref={ref}
            role="dialog" aria-modal="true" aria-label={title}
            className={cn("glass-strong w-full max-h-[88vh] overflow-y-auto p-6", wide ? "max-w-2xl" : "max-w-md")}
            initial={{ opacity: 0, scale: 0.94, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          >
            <div className="flex items-start justify-between mb-4">
              {title && <h2 className="text-lg font-bold text-ink-900 dark:text-white">{title}</h2>}
              <button onClick={onClose} aria-label="Close dialog" className="p-1.5 rounded-lg text-ink-400 hover:text-ink-700 dark:hover:text-white hover:bg-ink-100 dark:hover:bg-white/10 transition-colors -mt-1 -mr-1">
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------------- Confirm dialog ---------------- */
export function Confirm({ open, onClose, onConfirm, title, body, confirmLabel = "Delete", danger = true }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; body: string; confirmLabel?: string; danger?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="flex gap-3 items-start">
        <span className={cn("p-2.5 rounded-xl shrink-0", danger ? "bg-rose-400/12 text-rose-500" : "bg-amber-400/12 text-amber-500")}>
          <AlertTriangle className="w-5 h-5" />
        </span>
        <p className="text-sm text-ink-500 dark:text-ink-300 leading-relaxed">{body}</p>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant={danger ? "danger" : "primary"} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}

/* ---------------- Toasts ---------------- */
export function ToastHost() {
  const { toasts, dismissToast } = useStore();
  const icons = { success: <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400" />, error: <AlertCircle className="w-4.5 h-4.5 text-rose-400" />, info: <Info className="w-4.5 h-4.5 text-cyan-400" /> };
  return (
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 w-[320px] max-w-[calc(100vw-2rem)]" aria-live="polite">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, x: 60, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.95 }}
            className="glass-strong flex items-start gap-3 p-3.5 !rounded-xl"
          >
            {icons[t.kind]}
            <p className="text-[13px] text-ink-700 dark:text-ink-100 flex-1 leading-snug">{t.text}</p>
            <button onClick={() => dismissToast(t.id)} aria-label="Dismiss" className="text-ink-400 hover:text-ink-600 dark:hover:text-ink-200"><X className="w-3.5 h-3.5" /></button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ---------------- Empty state ---------------- */
export function Empty({ icon, title, body, action }: { icon: React.ReactNode; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="w-16 h-16 rounded-2xl glass flex items-center justify-center text-cyan-500 dark:text-cyan-300 mb-4 animate-float">{icon}</div>
      <h3 className="font-bold text-ink-800 dark:text-ink-50">{title}</h3>
      <p className="text-sm text-ink-400 mt-1.5 max-w-xs leading-relaxed">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ---------------- Skeleton ---------------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

/* ---------------- Backend pending chip ---------------- */
export function PendingChip({ label = "Connects with backend in Phase 2" }: { label?: string }) {
  return (
    <Badge tone="amber" className="!font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse-soft" /> {label}
    </Badge>
  );
}

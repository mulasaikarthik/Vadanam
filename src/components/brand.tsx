import React, { useState } from "react";
import { cn } from "@/utils";

/* Swappable branding images.
   Drop your own files into public/branding/ as either .png or .jpg
   (e.g. logo.png or logo.jpg, chat.png or chat.jpg, …).
   .png is tried first, then .jpg; if neither exists the built-in
   icon is shown. */

const resolved = new Map<string, string | null>(); // name -> url that worked (null = none)
const EXTS = ["png", "jpg", "jpeg"];

export function BrandIcon({
  name,
  fallback,
  size = 18,
  className,
  rounded = false,
}: {
  name: string;
  fallback: React.ReactNode;
  size?: number;
  className?: string;
  rounded?: boolean;
}) {
  const cached = resolved.get(name);
  const [extIdx, setExtIdx] = useState(0);
  const [dead, setDead] = useState(cached === null);

  if (dead || cached === null) return <>{fallback}</>;

  const src = cached ?? `branding/${name}.${EXTS[extIdx]}`;

  return (
    <img
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      style={{ width: size, height: size }}
      className={cn("object-contain shrink-0 select-none", rounded && "rounded-lg", className)}
      onLoad={() => resolved.set(name, src)}
      onError={() => {
        if (extIdx < EXTS.length - 1) setExtIdx(i => i + 1);
        else { resolved.set(name, null); setDead(true); }
      }}
    />
  );
}

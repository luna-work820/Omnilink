"use client";

import { useEffect, useRef, type CSSProperties, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { setupGlassworkSurface } from "./glasswork/integrate";

export type LiquidGlassProps = HTMLAttributes<HTMLDivElement> & {
  contentClassName?: string;
  /** Corner radius in px. Default 999 (pill). */
  radius?: number;
  /** Width of the refracting rim in px. */
  bevelDepth?: number;
  /** @deprecated Kept for compatibility; Glasswork derives displacement from the rim. */
  scale?: number;
  /** Chromatic split strength from 0 to 1. */
  aberration?: number;
  /** @deprecated Kept for compatibility; Glasswork uses its shared blur token. */
  frost?: number;
  /** Multiplier for the material tint. */
  tint?: number;
  /** Prefers light ink when the sampled backdrop is dark. */
  tone?: "auto" | "dark";
  /** Follows pointer light across the surface. */
  interactive?: boolean;
};

/** Glasswork material with its Chromium rim lens and CSS-only fallback. */
export function LiquidGlass({
  children,
  className,
  contentClassName,
  radius = 999,
  bevelDepth = 14,
  scale,
  aberration = 0.15,
  frost,
  tint = 1,
  tone = "auto",
  interactive = false,
  onPointerMove: onPointerMoveProp,
  onPointerDown: onPointerDownProp,
  onPointerLeave: onPointerLeaveProp,
  onPointerEnter: onPointerEnterProp,
  onFocus: onFocusProp,
  onBlur: onBlurProp,
  style,
  ...rest
}: LiquidGlassProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    return setupGlassworkSurface(element, {
      tone,
      radius,
      rim: bevelDepth,
      dispersion: clamp(aberration, 0, 0.4),
      tint,
    }).destroy;
  }, [aberration, bevelDepth, radius, tint, tone]);

  // These options remain accepted for existing callers but Glasswork owns the lens and blur.
  void scale;
  void frost;

  return (
    <div
      ref={rootRef}
      data-pill={radius >= 999 ? "" : undefined}
      data-glass-tone={tone === "dark" ? "dark" : undefined}
      className={cn(
        "liquid-glass glass relative overflow-hidden",
        interactive && "liquid-glass-interactive",
        className,
      )}
      style={{
        borderRadius: radius,
        "--glass-k": clamp(tint, 0, 1.5),
        ...style,
      } as CSSProperties}
      onPointerMove={(event) => {
        onPointerMoveProp?.(event);
        if (!interactive) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 100));
        const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / Math.max(rect.height, 1)) * 100));
        event.currentTarget.style.setProperty("--glass-pointer-x", `${x}%`);
        event.currentTarget.style.setProperty("--glass-pointer-y", `${y}%`);
      }}
      onPointerDown={(event) => {
        onPointerDownProp?.(event);
        if (!interactive) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 100));
        const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / Math.max(rect.height, 1)) * 100));
        event.currentTarget.style.setProperty("--glass-pointer-x", `${x}%`);
        event.currentTarget.style.setProperty("--glass-pointer-y", `${y}%`);
      }}
      onPointerLeave={(event) => {
        onPointerLeaveProp?.(event);
        if (interactive) {
          event.currentTarget.style.setProperty("--glass-pointer-x", "50%");
          event.currentTarget.style.setProperty("--glass-pointer-y", "0%");
        }
      }}
      onPointerEnter={(event) => {
        onPointerEnterProp?.(event);
        if (interactive) event.currentTarget.style.setProperty("--glass-interaction", "1.14");
      }}
      onFocus={(event) => {
        onFocusProp?.(event);
        if (interactive) event.currentTarget.style.setProperty("--glass-interaction", "1.14");
      }}
      onBlur={(event) => {
        onBlurProp?.(event);
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        if (!event.currentTarget.matches(":hover")) {
          event.currentTarget.style.setProperty("--glass-interaction", "1");
        }
      }}
      {...rest}
    >
      {contentClassName ? <div className={contentClassName}>{children}</div> : children}
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

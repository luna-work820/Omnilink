'use client';

import React, { useEffect, useRef } from 'react';
import './TextCursor.css';

interface TextCursorProps {
  text?: string;
  mode?: 'stamps' | 'chain' | 'ribbon';
  layout?: 'circular' | 'horizontal' | 'vertical';
  spacing?: number;
  maxPoints?: number;
  smoothing?: number;
  removalInterval?: number;
  exitDuration?: number;
  fade?: number;
  shrink?: number;
  popIn?: boolean;
  randomFloat?: boolean;
  followMouseDirection?: boolean;
  keepUpright?: boolean;
  hideCursor?: boolean;
  color?: string;
  fontSize?: string;
  fontWeight?: string;
  fontFamily?: string;
  className?: string;
  style?: React.CSSProperties;
}

const smootherstep = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * x * (x * (x * 6 - 15) + 10);
};

const backOut = (t: number) => {
  const s = 1.70158;
  const x = Math.max(0, t);
  return (x - 1) * (x - 1) * ((s + 1) * (x - 1) + s) + 1;
};

export const TextCursor: React.FC<TextCursorProps> = ({
  text = 'AURA VANGUARD ',
  mode = 'stamps',
  layout = 'horizontal',
  spacing = 24,
  maxPoints = 40,
  smoothing = 0.5,
  removalInterval = 30,
  exitDuration = 0.3,
  fade = 0.15,
  shrink = 0.1,
  popIn = true,
  randomFloat = false,
  followMouseDirection = true,
  keepUpright = true,
  hideCursor = false,
  color = 'rgba(49, 91, 255, 0.45)',
  fontSize = '14px',
  fontWeight = '600',
  fontFamily = 'monospace',
  className = '',
  style
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);

  const settingsRef = useRef({
    spacing,
    maxPoints,
    smoothing,
    removalInterval,
    exitDuration,
    fade,
    shrink,
    popIn,
    randomFloat,
    followMouseDirection,
    keepUpright,
    fontSize: parseFloat(fontSize) || 14
  });

  useEffect(() => {
    settingsRef.current = {
      spacing,
      maxPoints,
      smoothing,
      removalInterval,
      exitDuration,
      fade,
      shrink,
      popIn,
      randomFloat,
      followMouseDirection,
      keepUpright,
      fontSize: parseFloat(fontSize) || 14
    };
  }, [
    spacing,
    maxPoints,
    smoothing,
    removalInterval,
    exitDuration,
    fade,
    shrink,
    popIn,
    randomFloat,
    followMouseDirection,
    keepUpright,
    fontSize
  ]);

  useEffect(() => {
    const root = rootRef.current;
    const layer = layerRef.current;
    if (!root || !layer) return;

    let raf = 0;
    let last = performance.now();
    let clock = 0;
    let lastMove = 0;
    let disposed = false;

    const stamps: any[] = [];
    const pool: HTMLElement[] = [];
    const path: { x: number; y: number; s: number }[] = [];

    const head = { x: 0, y: 0, tx: 0, ty: 0, s: 0, inside: false, live: false };
    let cut = 0;
    let nextStamp = 0;

    const ribbon = mode === 'ribbon';
    const chain = mode === 'chain';

    let links: HTMLElement[] = [];
    let advances: number[] = [];
    let ribbonLength = 0;

    const buildContent = () => {
      layer.replaceChildren();
      pool.length = 0;
      links.length = 0;
      advances.length = 0;

      if (ribbon || chain) {
        const words = text ? text.split('') : [' '];
        for (const ch of words) {
          const span = document.createElement('span');
          span.textContent = ch === ' ' ? '\u00A0' : ch;
          span.style.opacity = '0';
          layer.appendChild(span);
          links.push(span);
        }
        for (const el of links) {
          const w = el.getBoundingClientRect().width || 12;
          advances.push(w);
          ribbonLength += w;
        }
      }
    };

    buildContent();

    const take = (str: string) => {
      let el = pool.pop();
      if (!el) {
        el = document.createElement('span');
        layer.appendChild(el);
      }
      el.textContent = str;
      el.style.opacity = '1';
      return el;
    };

    const release = (el: HTMLElement) => {
      el.style.opacity = '0';
      pool.push(el);
    };

    const reach = () => {
      if (ribbon) return ribbonLength;
      if (chain) return links.length * Math.max(4, settingsRef.current.spacing);
      return 0;
    };

    const point = (sVal: number) => {
      if (!path.length) return { x: head.x, y: head.y, angle: 0 };
      let i = 0;
      while (i < path.length - 1 && path[i + 1].s < sVal) i++;
      if (i >= path.length - 1) {
        const lastP = path[path.length - 1];
        return { x: lastP.x, y: lastP.y, angle: 0 };
      }
      const p0 = path[i];
      const p1 = path[i + 1];
      const span = p1.s - p0.s;
      const t = span > 0 ? (sVal - p0.s) / span : 0;
      const x = p0.x + (p1.x - p0.x) * t;
      const y = p0.y + (p1.y - p0.y) * t;
      const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
      return { x, y, angle };
    };

    const heading = (sVal: number) => {
      const ahead = point(sVal + 2);
      const behind = point(sVal - 2);
      return Math.atan2(ahead.y - behind.y, ahead.x - behind.x);
    };

    const sample = (offset: number) => {
      return point(head.s - offset);
    };

    const record = () => {
      const tail = path[path.length - 1];
      const dx = head.x - (tail ? tail.x : head.x);
      const dy = head.y - (tail ? tail.y : head.y);
      const step = Math.hypot(dx, dy);
      if (!tail) {
        path.push({ x: head.x, y: head.y, s: head.s });
        return;
      }
      if (step < 0.5) return;
      head.s += step;
      path.push({ x: head.x, y: head.y, s: head.s });
      const keep = head.s - reach() - Math.max(40, settingsRef.current.spacing * 2);
      let drop = 0;
      while (drop < path.length - 2 && path[drop + 1].s < keep) drop += 1;
      if (drop) path.splice(0, drop);
    };

    const place = (element: HTMLElement, x: number, y: number, angle: number, scale: number, opacity: number) => {
      element.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) translate(-50%, -50%) rotate(${angle.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
      element.style.opacity = opacity.toFixed(3);
    };

    const frame = (now: number) => {
      if (disposed) return;
      raf = 0;
      const s = settingsRef.current;
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      clock += dt;
      const spacingNow = Math.max(4, s.spacing);
      const tau = Math.max(0, s.smoothing) * 0.12;
      if (head.live) {
        const k = tau > 0 ? 1 - Math.exp(-dt / tau) : 1;
        head.x += (head.tx - head.x) * k;
        head.y += (head.ty - head.y) * k;
        record();
      }
      const idle = !head.inside || now - lastMove > 100;
      let ribbonSpan = 0;
      if (ribbon) {
        let span = 0;
        for (let order = 0; order < links.length; order++) {
          span += (advances[links.length - 1 - order] || 0) * (1 - s.shrink * (span / Math.max(1, ribbonLength)));
        }
        ribbonSpan = span;
      }
      const extent = reach();
      cut = Math.max(cut, head.s - extent);
      if (idle && head.live) {
        const unit = ribbon && advances.length ? ribbonLength / advances.length : spacingNow;
        cut += (unit / Math.max(0.005, s.removalInterval / 1000)) * dt;
      }
      if (cut >= head.s && !head.inside) head.live = false;
      cut = Math.min(cut, head.s);
      const float = s.randomFloat;
      const enter = s.popIn;
      let busy = head.live && (!idle || cut < head.s);

      if (!ribbon && !chain) {
        while (head.live && nextStamp <= head.s) {
          if (nextStamp >= cut) {
            const spot = point(nextStamp);
            let angle = s.followMouseDirection ? (heading(nextStamp) * 180) / Math.PI : 0;
            if (s.keepUpright && Math.abs(angle) > 90) angle -= Math.sign(angle) * 180;
            stamps.push({
              element: take(text),
              x: spot.x,
              y: spot.y,
              s: nextStamp,
              angle,
              born: now,
              died: 0,
              seed: Math.random() * Math.PI * 2
            });
          }
          nextStamp += spacingNow;
        }
        const count = Math.max(1, s.maxPoints);
        let alive = 0;
        for (let i = stamps.length - 1; i >= 0; i--) {
          const stamp = stamps[i];
          if (!stamp.died && (stamp.s < cut || alive >= count)) stamp.died = now;
          if (!stamp.died) alive += 1;
        }
        let order = 0;
        for (let i = stamps.length - 1; i >= 0; i--) {
          const stamp = stamps[i];
          const age = (now - stamp.born) / 1000;
          const rank = Math.min(1, order / Math.max(1, count - 1));
          if (!stamp.died) order += 1;
          let scale = (1 - s.shrink * rank) * (enter ? backOut(age / 0.42) : 1);
          let opacity = (1 - s.fade * rank) * (enter ? smootherstep(age / 0.12) : 1);
          if (stamp.died) {
            const gone = (now - stamp.died) / 1000 / Math.max(0.05, s.exitDuration);
            if (gone >= 1) {
              release(stamp.element);
              stamps.splice(i, 1);
              continue;
            }
            const ease = smootherstep(gone);
            scale *= 1 - 0.55 * ease;
            opacity *= 1 - ease;
          }
          let x = stamp.x;
          let y = stamp.y;
          let angle = stamp.angle;
          if (float) {
            const sway = smootherstep(age / 0.6) * s.fontSize * 0.14;
            x += Math.sin(clock * 1.3 + stamp.seed) * sway;
            y += Math.cos(clock * 1.1 + stamp.seed * 1.7) * sway;
            angle += Math.sin(clock * 0.9 + stamp.seed * 2.3) * 6 * smootherstep(age / 0.6);
          }
          place(stamp.element, x, y, angle, Math.max(0, scale), Math.max(0, opacity));
        }
        if (stamps.length) busy = true;
      } else {
        let distance = 0;
        for (let order = 0; order < links.length; order++) {
          const index = ribbon ? links.length - 1 - order : order;
          const element = links[index];
          const rank = ribbon ? distance / Math.max(1, ribbonLength) : order / Math.max(1, links.length - 1);
          const width = ribbon ? (advances[index] || 0) * (1 - s.shrink * rank) : spacingNow;
          const offset = ribbon ? distance + width / 2 : order * spacingNow;
          distance += width;
          const along = head.s - offset;
          const shown = head.live ? smootherstep((along - cut) / Math.max(4, ribbon ? width : spacingNow)) : 0;
          if (shown <= 0.001) {
            element.style.opacity = '0';
            continue;
          }
          const spot = sample(offset);
          let x = spot.x;
          let y = spot.y;
          if (float) {
            const wave = Math.sin(along / Math.max(30, s.fontSize * 2.2) - clock * 3.2) * s.fontSize * 0.12;
            x += -Math.sin(spot.angle) * wave;
            y += Math.cos(spot.angle) * wave;
          }
          const angle = s.followMouseDirection ? (spot.angle * 180) / Math.PI : 0;
          const scale = (1 - s.shrink * rank) * (enter ? backOut(shown) : shown);
          const opacity = (1 - s.fade * rank) * Math.min(1, shown * 1.6);
          place(element, x, y, angle, Math.max(0, scale), Math.max(0, opacity));
        }
        if (head.live) busy = true;
      }

      if (!head.live && !stamps.length) {
        path.length = 0;
        head.s = 0;
        cut = 0;
        nextStamp = 0;
      }
      if (busy || (float && stamps.length)) raf = requestAnimationFrame(frame);
    };

    const wake = () => {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };

    const onMove = (event: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const insideBounds =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;

      if (!insideBounds) {
        if (head.inside) {
          head.inside = false;
          wake();
        }
        return;
      }

      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (!head.live) {
        head.s = 0;
        path.length = 0;
        cut = 0;
        nextStamp = 0;
      } else if (!head.inside) {
        path.push({ x, y, s: head.s });
        cut = head.s;
        nextStamp = head.s;
      }
      if (!head.live || !head.inside) {
        head.x = x;
        head.y = y;
        head.live = true;
      }
      head.tx = x;
      head.ty = y;
      head.inside = true;
      lastMove = performance.now();
      wake();
    };

    const onLeave = () => {
      if (head.inside) {
        head.inside = false;
        wake();
      }
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onMove, { passive: true });
    root.addEventListener('pointerleave', onLeave);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onMove);
      root.removeEventListener('pointerleave', onLeave);
      layer.replaceChildren();
    };
  }, [mode, text, layout]);

  return (
    <div
      ref={rootRef}
      className={`text-cursor ${className}`.trim()}
      style={{ cursor: hideCursor ? 'none' : undefined, ...style }}
    >
      <div
        ref={layerRef}
        className="text-cursor__layer"
        aria-hidden="true"
        style={{ color, fontSize, fontWeight, fontFamily }}
      />
    </div>
  );
};

export default TextCursor;

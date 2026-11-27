import React, { useEffect, useRef } from "react";

export interface TriOrbitItem {
  src: string;
  alt: string;
  width: number;
  height: number;
}

interface BleibtTriOrbitProps {
  items: TriOrbitItem[];
  cycleSeconds?: number;
  diagonalAngle?: number;
  className?: string;
}

const ORBIT_CLOCK_ORIGIN =
  typeof performance !== "undefined" ? performance.now() : 0;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const modulo = (value: number, divisor: number) =>
  ((value % divisor) + divisor) % divisor;

const smoothstep = (min: number, max: number, value: number) => {
  const x = clamp((value - min) / (max - min || 1), 0, 1);
  return x * x * (3 - 2 * x);
};

/**
 * 3-card 45° diagonal variable-speed orbital gallery on the dark lower stage:
 * - Decelerates smoothly while showcasing the crisp, unclipped foreground image.
 * - Accelerates swiftly when switching between images with dynamic velocity blur.
 * - Wide spatial spacing with the two rear cards positioned one upper, one lower
 *   along a 45° rotated axis.
 */
export const BleibtTriOrbit: React.FC<BleibtTriOrbitProps> = ({
  items,
  cycleSeconds = 4.2,
  diagonalAngle = 45,
  className = "",
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || items.length === 0) return;

    const count = items.length;
    const half = count / 2;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let bounds = root.getBoundingClientRect();
    let visible = true;
    let rafId = 0;

    const ro = new ResizeObserver(() => {
      bounds = root.getBoundingClientRect();
    });
    ro.observe(root);

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible && !rafId) {
          rafId = requestAnimationFrame(render);
        }
      },
      { threshold: 0.01 }
    );
    io.observe(root);

    // Monotonic dwell-and-whip curve:
    // A = 0.142 => derivative at front (f=0) is 0.108x (slow showcase),
    // derivative at mid-swap (f=0.5) is 1.892x (~17.5x faster whip transition).
    const DWELL_AMP = 0.142;
    const TWO_PI = Math.PI * 2;
    const diagRad = (diagonalAngle * Math.PI) / 180;
    const cosDiag = Math.cos(diagRad);
    const sinDiag = Math.sin(diagRad);

    // Cache last written style strings per card to skip redundant DOM mutations
    const cardCache = Array.from({ length: count }, () => ({
      transform: "",
      opacity: "",
      filter: "",
      zIndex: "",
    }));

    const render = (now: number) => {
      rafId = 0;
      if (!visible || document.hidden) return;

      const elapsedSec = reducedMotion.matches
        ? 0
        : (now - ORBIT_CLOCK_ORIGIN) / 1000;
      const tau = elapsedSec / Math.max(cycleSeconds, 0.8);
      const step = Math.floor(tau);
      const frac = tau - step;

      // Non-linear variable progress and instantaneous speed
      const progress = step + (frac - DWELL_AMP * Math.sin(TWO_PI * frac));
      const instantVel = 1 - TWO_PI * DWELL_AMP * Math.cos(TWO_PI * frac);
      const velNorm = clamp((instantVel - 0.108) / 1.784, 0, 1);

      const width = Math.max(bounds.width, 320);
      const height = Math.max(bounds.height, 320);
      const isDesktop = width >= 768;
      const anchorX = isDesktop ? width * 0.58 : width * 0.5;
      const anchorY = height * 0.5;

      const fit = clamp(Math.min(width / 1020, height / 760), 0.44, 1.02);

      // Rear card scale (~0.52 at ±120°) vs front card scale (~1.02 at 0°)
      const maxRearHalfExtent = fit * 195;
      const maxSafeSpanX = Math.max(80, Math.min(anchorX, width - anchorX) - maxRearHalfExtent - 20);
      const maxSafeSpanY = Math.max(80, anchorY - maxRearHalfExtent - 20);
      const diagProj = Math.max(Math.abs(cosDiag), Math.abs(sinDiag)) * 0.866;
      const maxSafeOrbitR = Math.min(maxSafeSpanX, maxSafeSpanY) / Math.max(diagProj, 0.35);

      const desiredOrbitR = clamp(Math.min(width * 0.36, height * 0.48), 180, 440);
      const orbitR = Math.min(desiredOrbitR, Math.max(130, maxSafeOrbitR));

      for (let i = 0; i < count; i++) {
        const card = cardRefs.current[i];
        if (!card) continue;
        const cache = cardCache[i];

        const offset = modulo(i - progress + half, count) - half; // [-1.5, 1.5]
        const theta = offset * (TWO_PI / count); // 0° front, ±120° rear

        // 3D ring coordinates: sin(theta) spreads laterally, cos(theta) sets depth
        const ringSpan = Math.sin(theta) * orbitR;
        const depthRaw = Math.cos(theta); // +1 front, -0.5 rear
        const depth = (depthRaw + 1) / 2; // 1.0 front, 0.25 rear

        // Rotate orbital plane by 45° so rear cards sit one upper-right, one lower-left
        const x = anchorX - width * 0.5 + ringSpan * cosDiag;
        const y = anchorY - height * 0.5 - ringSpan * sinDiag;

        // Front card stands upright (0°); rear cards tilt toward ±45° smoothly
        const cardTiltDeg = Math.sin(theta) * 51.96; // ±45° at ±120°

        // Scale: front card emphasized and guaranteed completely unclipped
        const frontFocus = smoothstep(0.32, 0.98, depth);
        const scale = fit * (0.42 + 0.6 * Math.pow(depth, 1.28));

        // Opacity & Blur: razor-sharp front, soft blurred rear + quantized 0.5px motion blur
        const rearFactor = smoothstep(0.84, 0.22, depth);
        const opacity = 1 - 0.52 * rearFactor;
        const depthBlur = rearFactor * 7.5;
        const transitionBlur =
          velNorm * (0.5 + 4.0 * rearFactor) * (1 - 0.72 * frontFocus);
        const quantizedBlur = Math.round((depthBlur + transitionBlur) * 2) * 0.5;

        const nextTransform = `translate3d(-50%, -50%, 0) translate3d(${x.toFixed(
          1
        )}px, ${y.toFixed(1)}px, 0) rotate(${cardTiltDeg.toFixed(
          1
        )}deg) scale(${scale.toFixed(3)})`;
        const nextOpacity = opacity.toFixed(2);
        const nextFilter =
          quantizedBlur > 0.4 ? `blur(${quantizedBlur.toFixed(1)}px)` : "none";
        const nextZIndex = String(Math.round(depth * 1000) + 10);

        if (cache.transform !== nextTransform) {
          cache.transform = nextTransform;
          card.style.transform = nextTransform;
        }
        if (cache.opacity !== nextOpacity) {
          cache.opacity = nextOpacity;
          card.style.opacity = nextOpacity;
        }
        if (cache.filter !== nextFilter) {
          cache.filter = nextFilter;
          card.style.filter = nextFilter;
        }
        if (cache.zIndex !== nextZIndex) {
          cache.zIndex = nextZIndex;
          card.style.zIndex = nextZIndex;
        }
      }

      if (!reducedMotion.matches) {
        rafId = requestAnimationFrame(render);
      }
    };

    const onVisibility = () => {
      if (!document.hidden && visible && !rafId) {
        rafId = requestAnimationFrame(render);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    rafId = requestAnimationFrame(render);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [items, cycleSeconds, diagonalAngle]);

  return (
    <div
      ref={rootRef}
      className={`relative w-full h-full pointer-events-none select-none overflow-visible ${className}`.trim()}
      aria-hidden="true"
    >
      {items.map((item, idx) => (
        <div
          key={`${item.src}-${idx}`}
          ref={(el) => {
            cardRefs.current[idx] = el;
          }}
          style={{
            width: item.width,
            height: item.height,
            left: "50%",
            top: "50%",
          }}
          className="absolute rounded-[10px] overflow-hidden border-[0.5px] border-white/25 bg-[#111113] will-change-[transform,opacity]"
        >
          <img
            src={item.src}
            alt={item.alt}
            loading="eager"
            draggable={false}
            className="w-full h-full object-cover object-center block"
          />
        </div>
      ))}
    </div>
  );
};

export default BleibtTriOrbit;

'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';

export interface TextPressureProps {
  text?: string;
  flex?: boolean;
  alpha?: boolean;
  stroke?: boolean;
  width?: boolean;
  weight?: boolean;
  italic?: boolean;
  radius?: number;
  smoothing?: number;
  idle?: 'wave' | 'pulse' | 'none';
  idleSpeed?: number;
  clickRipple?: boolean;
  strokeColor?: string;
  strokeWidth?: number;
  minFontSize?: number;
  scale?: boolean;
  textColor?: string;
  fontFamily?: string;
  fontUrl?: string;
  className?: string;
  style?: React.CSSProperties;
}

interface Ripple {
  x: number;
  y: number;
  startTime: number;
}

export const TextPressure: React.FC<TextPressureProps> = ({
  text = 'Omnilink',
  flex = true,
  alpha = false,
  stroke = false,
  width = true,
  weight = true,
  italic = true,
  radius = 0.5,
  smoothing = 0.5,
  idle = 'wave',
  idleSpeed = 1,
  clickRipple = true,
  strokeColor = '#C5412B', // Theme orange / vermilion
  strokeWidth = 3,
  minFontSize = 36,
  scale = false,
  textColor = '#FFFFFF',
  fontFamily = 'Compressa VF',
  fontUrl = 'https://res.cloudinary.com/dr6lvwubh/raw/upload/v1529908256/CompressaPRO-GX.woff2',
  className = '',
  style
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const spansRef = useRef<(HTMLSpanElement | null)[]>([]);
  const ripplesRef = useRef<Ripple[]>([]);
  const [fontSize, setFontSize] = useState<number>(minFontSize);

  const chars = useMemo(() => Array.from(text), [text]);

  // Inject @font-face for Compressa VF if not already present
  useEffect(() => {
    if (!fontUrl) return;
    const styleId = `font-face-${fontFamily.replace(/\s+/g, '-').toLowerCase()}`;
    if (!document.getElementById(styleId)) {
      const styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.textContent = `
        @font-face {
          font-family: '${fontFamily}';
          src: url('${fontUrl}') format('woff2');
          font-weight: 100 900;
          font-style: normal italic;
          font-display: swap;
        }
      `;
      document.head.appendChild(styleEl);
    }
  }, [fontFamily, fontUrl]);

  // Responsive font size calculation
  useEffect(() => {
    const updateSize = () => {
      const container = containerRef.current;
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;

      if (scale) {
        setFontSize(Math.max(minFontSize, Math.min(h * 0.85, (w / chars.length) * 1.8)));
      } else {
        const estimatedSize = Math.max(minFontSize, Math.min(140, (w / (chars.length * 0.7))));
        setFontSize(Math.min(estimatedSize, h * 0.8));
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize, { passive: true });
    return () => window.removeEventListener('resize', updateSize);
  }, [chars.length, minFontSize, scale]);

  // Realtime variable font pressure loop
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let mouseX = -9999;
    let mouseY = -9999;
    let isInside = false;
    let rafId = 0;
    let startTime = performance.now();

    // Lerped value per character
    const charValues = chars.map(() => 0);

    const onPointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
      isInside =
        mouseX >= 0 &&
        mouseY >= 0 &&
        mouseX <= rect.width &&
        mouseY <= rect.height;
    };

    const onPointerLeave = () => {
      isInside = false;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!clickRipple) return;
      const rect = container.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      ripplesRef.current.push({
        x: clickX,
        y: clickY,
        startTime: performance.now()
      });
      if (ripplesRef.current.length > 5) ripplesRef.current.shift();
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    container.addEventListener('pointerdown', onPointerDown, { passive: true });
    container.addEventListener('pointerleave', onPointerLeave, { passive: true });

    const tick = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const rect = container.getBoundingClientRect();
      const maxDist = Math.max(120, Math.min(rect.width, rect.height) * Math.max(0.1, radius) * 2.2);

      // Clean up finished ripples (1.2s duration)
      ripplesRef.current = ripplesRef.current.filter(
        r => (now - r.startTime) / 1000 < 1.2
      );

      spansRef.current.forEach((span, i) => {
        if (!span) return;
        const spanRect = span.getBoundingClientRect();
        const charCenterX = spanRect.left + spanRect.width / 2 - rect.left;
        const charCenterY = spanRect.top + spanRect.height / 2 - rect.top;

        let target = 0;

        // 1. Mouse Proximity
        if (isInside) {
          const dx = mouseX - charCenterX;
          const dy = mouseY - charCenterY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const prox = Math.max(0, 1 - dist / maxDist);
          target = Math.max(target, Math.pow(prox, 1.35));
        }

        // 2. Click Ripples
        for (const ripple of ripplesRef.current) {
          const age = (now - ripple.startTime) / 1000;
          const rippleRadius = age * (maxDist * 1.8);
          const dx = ripple.x - charCenterX;
          const dy = ripple.y - charCenterY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const waveWidth = 70;
          const ringDist = Math.abs(dist - rippleRadius);
          if (ringDist < waveWidth) {
            const rippleWeight = (1 - ringDist / waveWidth) * (1 - age / 1.2);
            target = Math.max(target, rippleWeight);
          }
        }

        // 3. Idle Wave / Pulse
        if (!isInside && ripplesRef.current.length === 0) {
          if (idle === 'wave') {
            const wave = (Math.sin(elapsed * idleSpeed * 3.2 + i * 0.72) + 1) * 0.5;
            target = Math.max(target, wave * 0.65);
          } else if (idle === 'pulse') {
            const pulse = (Math.sin(elapsed * idleSpeed * 2.5) + 1) * 0.5;
            target = Math.max(target, pulse * 0.65);
          }
        }

        // Smoothing interpolation
        const factor = Math.max(0.08, 1 - smoothing * 0.72);
        charValues[i] += (target - charValues[i]) * factor;
        const v = Math.min(1, Math.max(0, charValues[i]));

        // Calculate Variable Axes:
        // Compressa VF: wght: 100..900, wdth: 5..125, ital: 0..1
        const wght = weight ? 100 + v * 800 : 400;
        const wdth = width ? 15 + v * 110 : 100;
        const ital = italic ? v : 0;

        span.style.fontVariationSettings = `'wght' ${wght.toFixed(1)}, 'wdth' ${wdth.toFixed(1)}, 'ital' ${ital.toFixed(2)}`;
        span.style.fontWeight = `${Math.round(wght)}`;

        // Transform fallback / enhancements
        const scaleX = width ? 0.75 + v * 0.5 : 1;
        const skew = italic ? -v * 14 : 0;
        span.style.transform = `scale3d(${scaleX.toFixed(3)}, 1, 1) skewX(${skew.toFixed(2)}deg)`;

        // Alpha modulation
        if (alpha) {
          span.style.opacity = `${(0.25 + v * 0.75).toFixed(2)}`;
        } else {
          span.style.opacity = '1';
        }

        // Stroke styling
        if (stroke) {
          span.style.webkitTextStroke = `${strokeWidth}px ${strokeColor}`;
          span.style.color = 'transparent';
        } else {
          span.style.webkitTextStroke = '0px transparent';
          span.style.color = textColor;
        }

        // Subtle theme accent on high pressure
        const isDarkText = textColor === '#0B0C0E' || textColor === '#111111' || textColor === '#000000';
        if (v > 0.65 && !stroke) {
          span.style.textShadow = isDarkText
            ? `0 0 20px rgba(49, 91, 255, ${(v * 0.4).toFixed(2)})`
            : `0 0 16px rgba(197, 65, 43, ${(v * 0.45).toFixed(2)}), 0 0 32px rgba(49, 91, 255, ${(v * 0.35).toFixed(2)})`;
        } else if (!stroke) {
          span.style.textShadow = isDarkText ? 'none' : '0 2px 14px rgba(0, 0, 0, 0.45)';
        }
      });

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [chars, radius, smoothing, idle, idleSpeed, clickRipple, stroke, strokeColor, strokeWidth, alpha, width, weight, italic, textColor]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full select-none cursor-pointer flex items-center ${
        flex ? 'justify-between' : 'justify-center gap-1 sm:gap-2'
      } ${className}`}
      style={{
        fontFamily: `'${fontFamily}', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`,
        fontSize: `${fontSize}px`,
        lineHeight: 1,
        ...style
      }}
    >
      {chars.map((char, index) => (
        <span
          key={index}
          ref={el => {
            spansRef.current[index] = el;
          }}
          className="inline-block transition-transform duration-75 will-change-[font-variation-settings,transform,text-shadow]"
          style={{
            display: 'inline-block',
            textTransform: 'uppercase',
            textAlign: 'center'
          }}
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </div>
  );
};

export default TextPressure;

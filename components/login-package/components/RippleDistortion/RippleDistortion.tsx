'use client';

import React, { useEffect, useRef } from 'react';
import { sharedRippleGPU } from './sharedRippleGpu';
import './RippleDistortion.css';

export interface RippleDistortionProps {
  src?: string;
  brushSize?: number;
  strength?: number;
  swirl?: number;
  rings?: number;
  spread?: number;
  fade?: number;
  spacing?: number;
  dispersion?: number;
  glint?: number;
  tint?: string;
  tintAmount?: number;
  grayscale?: boolean;
  highlightColor?: string;
  trigger?: 'hover' | 'click';
  clickStrength?: number;
  quality?: 'low' | 'medium' | 'high';
  enabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const RippleDistortion: React.FC<RippleDistortionProps> = ({
  src = '/login-package/assets/aistudio/The_City_Rises_by_Umberto_Boccioni_1910_c08f466e.webp',
  brushSize = 150,
  strength = 0.03,
  swirl = 0.35,
  rings = 1.75,
  spread = 5,
  fade = 3,
  spacing = 1,
  dispersion = 0.4,
  glint = 0,
  tint = '#a855f7',
  tintAmount = 0.1,
  grayscale = false,
  highlightColor = '#ffffff',
  trigger = 'hover',
  clickStrength = 2,
  quality = 'medium',
  enabled = true,
  className = '',
  style,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sharedRippleGPU.updateConfig({
      src,
      brushSize,
      strength,
      swirl,
      rings,
      spread,
      fade,
      spacing,
      dispersion,
      glint,
      tint,
      tintAmount,
      grayscale,
      highlightColor,
      trigger,
      clickStrength,
      quality,
      enabled,
    });
  }, [
    src,
    brushSize,
    strength,
    swirl,
    rings,
    spread,
    fade,
    spacing,
    dispersion,
    glint,
    tint,
    tintAmount,
    grayscale,
    highlightColor,
    trigger,
    clickStrength,
    quality,
    enabled,
  ]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const viewCanvas = document.createElement('canvas');
    viewCanvas.style.width = '100%';
    viewCanvas.style.height = '100%';
    viewCanvas.style.display = 'block';
    mount.appendChild(viewCanvas);

    const ctx = viewCanvas.getContext('2d', { alpha: false, desynchronized: true });
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);

    // Cache layout metrics outside the RAF loop to prevent synchronous scroll reflows
    let docLeft = 0;
    let docTop = 0;
    let localW = 1;
    let localH = 1;

    const measureLayout = () => {
      if (!mount) return;
      const rect = mount.getBoundingClientRect();
      docLeft = rect.left + (window.scrollX || 0);
      docTop = rect.top + (window.scrollY || 0);
      localW = Math.max(1, rect.width);
      localH = Math.max(1, rect.height);
      const targetW = Math.round(localW * dpr);
      const targetH = Math.round(localH * dpr);
      if (viewCanvas.width !== targetW || viewCanvas.height !== targetH) {
        viewCanvas.width = targetW;
        viewCanvas.height = targetH;
      }
    };

    const ro = new ResizeObserver(measureLayout);
    ro.observe(mount);
    window.addEventListener('resize', measureLayout, { passive: true });
    measureLayout();

    // Keep the shared frame loop free when this canvas is offscreen.
    let unsubscribe: (() => void) | null = null;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !unsubscribe) {
        unsubscribe = sharedRippleGPU.subscribe(
      (glCanvas, vpW, vpH, _sampleDisplacement, sharedState) => {
        if (!ctx) return;

        const rectLeft = docLeft;
        const rectTop = docTop - sharedState.scrollY;
        const rectRight = rectLeft + localW;
        const rectBottom = rectTop + localH;

        if (rectBottom <= 0 || rectTop >= vpH || rectRight <= 0 || rectLeft >= vpW) {
          return;
        }

        const visLeft = Math.max(0, rectLeft);
        const visTop = Math.max(0, rectTop);
        const visRight = Math.min(vpW, rectRight);
        const visBottom = Math.min(vpH, rectBottom);
        const visW = visRight - visLeft;
        const visH = visBottom - visTop;

        if (visW <= 0 || visH <= 0) return;

        const scaleX = glCanvas.width / vpW;
        const scaleY = glCanvas.height / vpH;

        const sx = visLeft * scaleX;
        const sy = visTop * scaleY;
        const sw = visW * scaleX;
        const sh = visH * scaleY;

        const dx = (visLeft - rectLeft) * dpr;
        const dy = (visTop - rectTop) * dpr;
        const dw = visW * dpr;
        const dh = visH * dpr;

        ctx.drawImage(glCanvas, sx, sy, sw, sh, dx, dy, dw, dh);
      }
        );
      } else if (!entry.isIntersecting && unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    });
    observer.observe(mount);

    return () => {
      observer.disconnect();
      unsubscribe?.();
      ro.disconnect();
      window.removeEventListener('resize', measureLayout);
      if (viewCanvas.parentNode === mount) {
        mount.removeChild(viewCanvas);
      }
    };
  }, []);

  return <div ref={mountRef} className={`ripple-distortion ${className}`.trim()} style={style} />;
};

export default RippleDistortion;

import React, { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { buildMetaballPath } from "./RippleDistortion/metaballContour";
import BleibtTriOrbit from "./BleibtTriOrbit";
import ScrollReveal, { type ScrollRevealToken } from "./ScrollReveal";
import FlexCarousel from "./FlexCarousel";
import { jumpToFinalLogin } from "../lib/utils";

const webMockupImg = "/login-package/assets/images/omnilink-home-curated.webp";
const mobileMockupImg = "/login-package/assets/images/omnilink-ai-mobile.webp";

// Page 1 tokens for ScrollReveal
const PAGE1_TAGLINE_LINES = [
  "Your world.",
  "Your intentions.",
  "All connected.",
];
const PAGE1_HEADLINE_LINE1_TOKENS: ScrollRevealToken[] = [
  { text: "从你的" },
  { text: "想法" },
  { text: "出发，" },
];
const PAGE1_HEADLINE_LINE2_TOKENS: ScrollRevealToken[] = [
  { text: "连接" },
  { text: "整个" },
  { text: "世界。" },
];
const PAGE1_LEAD_TOKENS: ScrollRevealToken[] = [
  { text: "一个真正" },
  { text: "围绕你" },
  { text: "运转的" },
  { text: "智能空间。" },
];
const PAGE1_BODY_TOKENS: ScrollRevealToken[] = [
  { text: "从一闪而过的灵感，" },
  { text: "到一场精心规划的旅行；" },
  { text: "从寻找心仪的事物，" },
  { text: "到实现自己的创意。" },
  { text: "Omnilink ", className: "font-semibold text-[#008F83]" },
  { text: "理解你的想法，" },
  { text: "记住你的偏好，" },
  { text: "连接散落在世界各处的" },
  { text: "信息、内容与服务。" },
];
const PAGE1_PROMPT_TOKENS: ScrollRevealToken[] = [
  { text: "你只需要" },
  { text: "告诉我们，" },
  { text: "你想做什么。" },
];

const flexCarouselItems = [
  { src: "/login-package/carousel/1.webp", alt: "红色针织背心穿搭" },
  { src: "/login-package/carousel/2.webp", alt: "条纹针织背心穿搭" },
  { src: "/login-package/carousel/3.webp", alt: "室内花艺摆设" },
  { src: "/login-package/carousel/4.webp", alt: "博物馆中的古典雕像" },
  { src: "/login-package/carousel/5.webp", alt: "白色墙面上的雕塑陈列" },
  { src: "/login-package/carousel/6.webp", alt: "花瓶中的绿植与墙面光影" },
];

// Page 1 Lower Black Layer 3-card 45° diagonal rotating showcase (2x enlarged mixed square & rectangle proportions)
const triOrbitItems = [
  { src: "/login-package/assets/images/omnilink-river-editorial.png", alt: "黑白河流与 Omnilink 品牌文字", width: 624, height: 351 },
  { src: "/login-package/assets/images/omnilink-night.webp", alt: "Omnilink 夜间版主页、侧边栏和设置界面", width: 624, height: 351 },
  { src: "/login-package/assets/images/omnilink-iphone-mockup.png", alt: "Omnilink iPhone AI 聊天与浏览界面样机", width: 624, height: 416 },
];

// Viscous, slow, cohesive liquid ripple parameters (avoids fragmented interference)
const RIPPLE_CONFIG = {
  brushSize: 124,
  strength: 0.14,
  swirl: 0.45,
  rings: 1.65,
  spread: 3.4,
  fade: 8.8,
  growthRate: 0.22,
  spacing: 38,
  clickStrength: 1.45,
  maxWaves: 24,
  startScale: 1.15,
  lifeConstant: Math.log(500),
};

interface RippleWave {
  x: number;
  y: number;
  scale: number;
  target: number;
  size: number;
  opacity: number;
}

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

export function BleibtGooeySection() {
  const runwayRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const upperWhiteLayerRef = useRef<HTMLDivElement>(null);
  const lowerBlackLayerRef = useRef<HTMLDivElement>(null);
  const carouselWrapRef = useRef<HTMLDivElement>(null);
  const page2TriggerRef = useRef<HTMLDivElement>(null);
  const lowerPage1TextRef = useRef<HTMLDivElement>(null);
  const upperPage1TextRef = useRef<HTMLDivElement>(null);
  const lowerTriOrbitParallaxRef = useRef<HTMLDivElement>(null);
  const lowerP2MediaParallaxRef = useRef<HTMLDivElement>(null);
  const lowerPage2TextRef = useRef<HTMLDivElement>(null);
  const upperPage2TextRef = useRef<HTMLDivElement>(null);
  const page2VideoRef = useRef<HTMLVideoElement>(null);
  const page2ImageLayerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const runway = runwayRef.current;
    const stage = stageRef.current;
    const upperWhiteLayer = upperWhiteLayerRef.current;
    if (!runway || !stage || !upperWhiteLayer) {
      return;
    }

    let runwayDocTop = 0;
    let runwayHeight = 1;
    let docLeft = 0;
    let width = Math.max(1, stage.clientWidth);
    let vpH = Math.max(1, window.innerHeight || 800);
    let stageHeight = Math.max(1, vpH * 3.3);

    const measureSection = () => {
      if (!runway || !stage) return;
      const runwayRect = runway.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      const scrollY = window.scrollY || 0;
      const scrollX = window.scrollX || 0;
      vpH = Math.max(1, window.innerHeight || 800);
      runwayDocTop = runwayRect.top + scrollY;
      runwayHeight = Math.max(1, runwayRect.height);
      docLeft = stageRect.left + scrollX;
      width = Math.max(1, stageRect.width);
      stageHeight = Math.max(1, vpH * 3.3);
    };

    measureSection();
    const ro = new ResizeObserver(measureSection);
    ro.observe(runway);
    window.addEventListener("resize", measureSection, { passive: true });

    // Wave pool stays empty until pointer movement or click.
    const waves: RippleWave[] = Array.from(
      { length: RIPPLE_CONFIG.maxWaves },
      () => ({
        x: 0,
        y: 0,
        scale: RIPPLE_CONFIG.startScale,
        target: RIPPLE_CONFIG.startScale,
        size: RIPPLE_CONFIG.brushSize,
        opacity: 0,
      })
    );
    const activeWaves: RippleWave[] = [];
    let currentWaveIdx = 0;

    // Stationary liquid aperture anchored strictly at the real mouse cursor
    const cursor = {
      clientX: 0,
      clientY: 0,
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      active: false,
      presence: 0,
    };

    const chain = Array.from({ length: 5 }, (_, idx) => ({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      baseR: [42, 35, 28, 22, 16][idx],
    }));

    let prevSpawnX = 0;
    let prevSpawnY = 0;
    let hasSpawnAnchor = false;

    const spawnWave = (stageX: number, stageY: number, power = 1) => {
      const wave = waves[currentWaveIdx];
      currentWaveIdx = (currentWaveIdx + 1) % RIPPLE_CONFIG.maxWaves;
      wave.x = stageX;
      wave.y = stageY;
      wave.scale = RIPPLE_CONFIG.startScale * power;
      wave.target =
        RIPPLE_CONFIG.startScale * Math.max(1, RIPPLE_CONFIG.spread) * power;
      wave.size = Math.max(1, RIPPLE_CONFIG.brushSize);
      wave.opacity = 1;
    };

    let scrollY = window.scrollY || 0;
    let lastScrollY = scrollY;
    let scrollVelocity = 0;

    const getScrollMetrics = (currentScrollY: number) => {
      const scrollIntoRunway = currentScrollY - runwayDocTop;
      const maxPinScroll = Math.max(1, runwayHeight - vpH);
      const viewOffsetY = clamp(scrollIntoRunway, 0, vpH * 2.3);
      const rawRunwayTop = -scrollIntoRunway;
      const rawRunwayBottom = rawRunwayTop + runwayHeight;
      const stageRectTop =
        scrollIntoRunway <= 0
          ? -scrollIntoRunway
          : scrollIntoRunway <= maxPinScroll
          ? -viewOffsetY
          : -vpH * 2.3 - (scrollIntoRunway - maxPinScroll);
      return {
        scrollIntoRunway,
        maxPinScroll,
        viewOffsetY,
        rawRunwayTop,
        rawRunwayBottom,
        stageRectTop,
      };
    };

    const onScroll = () => {
      scrollY = window.scrollY || 0;
    };

    const onPointerMove = (e: PointerEvent) => {
      const { rawRunwayTop, rawRunwayBottom, stageRectTop } =
        getScrollMetrics(scrollY);
      if (rawRunwayBottom < 0 || rawRunwayTop > vpH) {
        cursor.active = false;
        return;
      }
      if (e.clientX < docLeft || e.clientX > docLeft + width) {
        cursor.active = false;
        return;
      }

      const stageX = e.clientX - docLeft;
      const stageY = e.clientY - stageRectTop;
      if (stageY < 0 || stageY > stageHeight) {
        cursor.active = false;
        return;
      }

      cursor.clientX = stageX;
      cursor.clientY = e.clientY;
      cursor.targetX = stageX;
      cursor.targetY = stageY;

      if (!cursor.active) {
        cursor.active = true;
        if (cursor.presence < 0.05) {
          cursor.x = stageX;
          cursor.y = stageY;
          for (let i = 0; i < chain.length; i++) {
            chain[i].x = stageX;
            chain[i].y = stageY;
            chain[i].vx = 0;
            chain[i].vy = 0;
          }
        }
      }

      if (!hasSpawnAnchor) {
        prevSpawnX = stageX;
        prevSpawnY = stageY;
        hasSpawnAnchor = true;
        spawnWave(stageX, stageY, 1);
        return;
      }

      const dist = Math.hypot(stageX - prevSpawnX, stageY - prevSpawnY);
      if (dist >= RIPPLE_CONFIG.spacing) {
        spawnWave(stageX, stageY, 1);
        prevSpawnX = stageX;
        prevSpawnY = stageY;
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      const { rawRunwayTop, rawRunwayBottom, stageRectTop } =
        getScrollMetrics(scrollY);
      if (rawRunwayBottom < 0 || rawRunwayTop > vpH) return;
      if (e.clientX < docLeft || e.clientX > docLeft + width) return;

      const stageX = e.clientX - docLeft;
      const stageY = e.clientY - stageRectTop;
      if (stageY < 0 || stageY > stageHeight) return;

      cursor.clientX = stageX;
      cursor.clientY = e.clientY;
      cursor.targetX = stageX;
      cursor.targetY = stageY;
      cursor.active = true;
      prevSpawnX = stageX;
      prevSpawnY = stageY;
      hasSpawnAnchor = true;
      spawnWave(stageX, stageY, Math.max(1, RIPPLE_CONFIG.clickStrength));
    };

    const onPointerLeave = () => {
      cursor.active = false;
      hasSpawnAnchor = false;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    document.addEventListener("mouseleave", onPointerLeave, { passive: true });

    let smoothExpand = 0;
    let isFullyExpanded = false;
    let wasIdleClean = true;
    let previousTime = 0;

    // Balanced 64x40 grid for smooth viscous Bezier contours at ~50% lower CPU cost
    const COLS = 64;
    const ROWS = 40;
    const field = new Float32Array((COLS + 1) * (ROWS + 1));
    const xWave1 = new Float32Array(COLS + 1);
    const yWave1 = new Float32Array(ROWS + 1);

    // Preallocated per-wave invariant buffers to eliminate Math.pow inside inner pixel loops
    const waveHalf = new Float32Array(RIPPLE_CONFIG.maxWaves);
    const waveInvHalf = new Float32Array(RIPPLE_CONFIG.maxWaves);
    const waveOpPow = new Float32Array(RIPPLE_CONFIG.maxWaves);

    // Precomputed LUT for thick, cohesive, non-fragmenting viscous ring envelopes
    const LUT_SIZE = 512;
    const radialLut = new Float32Array(LUT_SIZE);
    const ringLut = new Float32Array(LUT_SIZE);
    for (let i = 0; i < LUT_SIZE; i++) {
      const r = i / (LUT_SIZE - 1);
      radialLut[i] = Math.pow(1.0 - r, 1.25);
      ringLut[i] =
        0.58 +
        0.42 * Math.cos(Math.sqrt(r) * Math.PI * 2.0 * RIPPLE_CONFIG.rings);
    }

    const startTime = performance.now();
    let frameSkip = 0;
    let idleBreathSkip = 0;
    let smoothScrollLag = 0;
    const prefersReducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let rafId = 0;
    let disposed = false;

    // Dirty-check caches for zero idle DOM writes
    let lastOrbitBgStr = "";
    let lastMediaBgStr = "";
    let lastFgStr = "";
    let lastCarouselOpacity = "";
    let lastCarouselTransform = "";
    let lastCarouselPointer = "";
    let lastScrollZoom = "";
    let lastCarouselPaused = "";
    let lastTextFadeStr = "";
    let lastVideoPlaying: boolean | null = null;
    let lastHeaderUpperClip = "";
    let lastHeaderLowerClip = "";

    const syncHeaderClip = (upperClip: string, lowerClip: string) => {
      if (upperClip !== lastHeaderUpperClip) {
        const upperEl = document.getElementById("omnilink-header-upper");
        if (upperEl) {
          lastHeaderUpperClip = upperClip;
          upperEl.style.clipPath = upperClip;
        }
      }
      if (lowerClip !== lastHeaderLowerClip) {
        const lowerEl = document.getElementById("omnilink-header-lower");
        if (lowerEl) {
          lastHeaderLowerClip = lowerClip;
          lowerEl.style.clipPath = lowerClip;
        }
      }
    };

    const renderFrame = (now: number) => {
      if (disposed) return;
      rafId = requestAnimationFrame(renderFrame);
      if (document.hidden) return;

      const delta = previousTime
        ? Math.min(0.05, (now - previousTime) / 1000)
        : 0.016;
      previousTime = now;
      const t = (now - startTime) * 0.001;

      scrollVelocity = scrollY - lastScrollY;
      lastScrollY = scrollY;

      const {
        scrollIntoRunway,
        maxPinScroll,
        viewOffsetY,
        rawRunwayBottom,
        stageRectTop,
      } = getScrollMetrics(scrollY);

      // Once final page (#gallery-parallax) reaches top 65%, hand off header theme control cleanly
      if (rawRunwayBottom <= vpH * 0.65) {
        syncHeaderClip("none", "inset(100%)");
      }

      if (rawRunwayBottom < -200) {
        if (lastVideoPlaying !== false && page2VideoRef.current) {
          lastVideoPlaying = false;
          page2VideoRef.current.pause();
        }
        const fcEl = carouselWrapRef.current?.firstElementChild as HTMLElement | null;
        if (fcEl && lastCarouselPaused !== "true") {
          lastCarouselPaused = "true";
          fcEl.dataset.paused = "true";
        }
        return;
      }

      // Pause/resume Page 2 mesh gradient video based on viewport visibility
      const shouldPlayVideo =
        !prefersReducedMotion &&
        scrollIntoRunway >= vpH * 0.12 &&
        scrollIntoRunway <= vpH * 2.55;
      if (shouldPlayVideo !== lastVideoPlaying && page2VideoRef.current) {
        lastVideoPlaying = shouldPlayVideo;
        if (shouldPlayVideo) {
          page2VideoRef.current.play().catch(() => {});
        } else {
          page2VideoRef.current.pause();
        }
      }

      const isScrollingFast = Math.abs(scrollVelocity) > 2.2;

      // Liquid scroll parallax: subtle counter-displacement between black background & white foreground
      const rawLagTarget = prefersReducedMotion
        ? 0
        : clamp(scrollVelocity * 1.45, -44, 44);
      smoothScrollLag += (rawLagTarget - smoothScrollLag) * 0.12;
      if (Math.abs(smoothScrollLag) < 0.05 && Math.abs(rawLagTarget) < 0.05) {
        smoothScrollLag = 0;
      }

      const pageFloat = clamp(scrollIntoRunway / Math.max(1, vpH * 1.25), 0, 2);
      const transitionWave = prefersReducedMotion
        ? 0
        : Math.sin(pageFloat * Math.PI);
      const fgOffsetY = -transitionWave * 14 - smoothScrollLag * 0.25;
      const orbitBgOffsetY = transitionWave * 38 + smoothScrollLag * 0.78;
      const mediaBgOffsetY = transitionWave * 46 + smoothScrollLag * 0.92;

      const nextOrbitBgStr = `translate3d(0, ${orbitBgOffsetY.toFixed(1)}px, 0)`;
      if (nextOrbitBgStr !== lastOrbitBgStr && lowerTriOrbitParallaxRef.current) {
        lastOrbitBgStr = nextOrbitBgStr;
        lowerTriOrbitParallaxRef.current.style.transform = nextOrbitBgStr;
      }

      const nextMediaBgStr = `translate3d(0, ${mediaBgOffsetY.toFixed(1)}px, 0) scale(1.12)`;
      if (nextMediaBgStr !== lastMediaBgStr && lowerP2MediaParallaxRef.current) {
        lastMediaBgStr = nextMediaBgStr;
        lowerP2MediaParallaxRef.current.style.transform = nextMediaBgStr;
      }

      const nextFgStr = `translate3d(0, ${fgOffsetY.toFixed(1)}px, 0)`;
      const fgChanged = nextFgStr !== lastFgStr;
      if (fgChanged) {
        lastFgStr = nextFgStr;
        if (upperPage1TextRef.current) {
          upperPage1TextRef.current.style.transform = nextFgStr;
        }
        if (lowerPage1TextRef.current) {
          lowerPage1TextRef.current.style.transform = nextFgStr;
        }
      }

      // Page 3 lock drill-down expansion
      const pinStart = vpH * 2.3;
      const pinExpandSpan = Math.max(1, maxPinScroll - pinStart);
      const rawExpand = clamp(
        (scrollIntoRunway - pinStart) / pinExpandSpan,
        0,
        1
      );
      smoothExpand += (rawExpand - smoothExpand) * 0.45;
      if (Math.abs(rawExpand - smoothExpand) < 0.0005) {
        smoothExpand = rawExpand;
      }

      const rippleZoom = clamp(smoothExpand, 0, 1);
      const easedZoom = rippleZoom * rippleZoom * (3.0 - 2.0 * rippleZoom);

      const carouselReveal = clamp(
        easedZoom * 0.68 + rippleZoom * 0.32,
        0,
        1
      );
      const carouselWrapEl = carouselWrapRef.current;
      if (carouselWrapEl) {
        const nextOpacity = carouselReveal.toFixed(3);
        if (nextOpacity !== lastCarouselOpacity) {
          lastCarouselOpacity = nextOpacity;
          carouselWrapEl.style.opacity = nextOpacity;
        }
        const liftPx = (1 - carouselReveal) * 28;
        const nextTransform = `translate3d(0, ${liftPx.toFixed(1)}px, 0)`;
        if (nextTransform !== lastCarouselTransform) {
          lastCarouselTransform = nextTransform;
          carouselWrapEl.style.transform = nextTransform;
        }
        const nextPointer = carouselReveal > 0.45 ? "auto" : "none";
        if (nextPointer !== lastCarouselPointer) {
          lastCarouselPointer = nextPointer;
          carouselWrapEl.style.pointerEvents = nextPointer;
        }
        const fcEl = carouselWrapEl.firstElementChild as HTMLElement | null;
        if (fcEl) {
          const zoomFactor = 0.72 + 0.28 * carouselReveal;
          const nextZoom = zoomFactor.toFixed(3);
          if (nextZoom !== lastScrollZoom) {
            lastScrollZoom = nextZoom;
            fcEl.dataset.scrollZoom = nextZoom;
          }
          const nextPaused = carouselReveal <= 0.01 ? "true" : "false";
          if (nextPaused !== lastCarouselPaused) {
            lastCarouselPaused = nextPaused;
            fcEl.dataset.paused = nextPaused;
          }
        }
      }

      const textFadeOut = clamp((vpH * 2.3 - scrollIntoRunway) / (vpH * 0.3), 0, 1);
      const nextTextFadeStr = textFadeOut.toFixed(3);
      if (nextTextFadeStr !== lastTextFadeStr || fgChanged) {
        lastTextFadeStr = nextTextFadeStr;
        if (lowerPage2TextRef.current) {
          lowerPage2TextRef.current.style.opacity = nextTextFadeStr;
          lowerPage2TextRef.current.style.transform = nextFgStr;
        }
        if (upperPage2TextRef.current) {
          upperPage2TextRef.current.style.opacity = nextTextFadeStr;
          upperPage2TextRef.current.style.transform = nextFgStr;
        }
        if (page2ImageLayerRef.current) {
          page2ImageLayerRef.current.style.opacity = nextTextFadeStr;
          page2ImageLayerRef.current.style.transform = nextFgStr;
        }
      }

      // Keep stationary viscous liquid aperture anchored smoothly under the mouse cursor
      cursor.presence +=
        ((cursor.active ? 1 : 0) - cursor.presence) *
        (cursor.active ? 0.14 : 0.055);
      if (cursor.presence < 0.002) cursor.presence = 0;

      if (cursor.active) {
        const liveStageY = clamp(cursor.clientY - stageRectTop, 0, stageHeight);
        cursor.targetX = stageXClamp(cursor.clientX, width);
        cursor.targetY = liveStageY;
        cursor.x += (cursor.targetX - cursor.x) * 0.14;
        cursor.y += (cursor.targetY - cursor.y) * 0.14;

        for (let idx = 0; idx < chain.length; idx++) {
          const node = chain[idx];
          const target = idx === 0 ? cursor : chain[idx - 1];
          const spring = [0.16, 0.12, 0.09, 0.065, 0.045][idx];
          const damping = 0.78;
          node.vx = (node.vx + (target.x - node.x) * spring) * damping;
          node.vy = (node.vy + (target.y - node.y) * spring) * damping;
          node.x += node.vx;
          node.y += node.vy;
        }
      }

      // Advance RippleDistortion wave physics (slower outward growth & slower fade)
      const growth = 1 - Math.exp(-delta * RIPPLE_CONFIG.growthRate);
      const decay = Math.exp(
        (-delta * RIPPLE_CONFIG.lifeConstant) /
          Math.max(0.15, RIPPLE_CONFIG.fade)
      );

      activeWaves.length = 0;
      for (let i = 0; i < RIPPLE_CONFIG.maxWaves; i++) {
        const w = waves[i];
        if (w.opacity <= 0) continue;
        w.opacity *= decay;
        w.scale += (w.target - w.scale) * growth;
        if (w.opacity < 0.005) {
          w.opacity = 0;
          continue;
        }
        const wIdx = activeWaves.length;
        const half = w.scale * w.size * 0.5;
        waveHalf[wIdx] = half;
        waveInvHalf[wIdx] = 1 / Math.max(0.001, half);
        waveOpPow[wIdx] = Math.pow(w.opacity, 1.15);
        activeWaves.push(w);
      }

      const headerOwnsRipple = rawRunwayBottom > vpH * 0.65;

      // Page 3 fully expanded: hide Upper White Layer cleanly
      if (rippleZoom >= 0.985) {
        if (!isFullyExpanded) {
          isFullyExpanded = true;
          upperWhiteLayer.style.clipPath = "inset(100%)";
          upperWhiteLayer.style.maskImage = "none";
          upperWhiteLayer.style.webkitMaskImage = "none";
          upperWhiteLayer.style.opacity = "0";
        }
        if (headerOwnsRipple) {
          syncHeaderClip("inset(100%)", "none");
        }
        return;
      }
      if (isFullyExpanded) {
        isFullyExpanded = false;
        upperWhiteLayer.style.opacity = "1";
      }

      // If pointer hasn't entered / is outside AND all ripples faded AND not in Page 3 drill-down
      if (
        cursor.presence <= 0.01 &&
        activeWaves.length === 0 &&
        rippleZoom <= 0.002
      ) {
        if (!wasIdleClean) {
          wasIdleClean = true;
          upperWhiteLayer.style.clipPath = "none";
          upperWhiteLayer.style.maskImage = "none";
          upperWhiteLayer.style.webkitMaskImage = "none";
        }
        if (headerOwnsRipple) {
          syncHeaderClip("none", "inset(100%)");
        }
        return;
      }
      wasIdleClean = false;

      // Skip metaball grid evaluation BEFORE doing work during fast scroll
      if (isScrollingFast) {
        frameSkip = (frameSkip + 1) % 2;
        if (frameSkip !== 0) return;
      }

      const maxDiag = Math.hypot(width, vpH);
      const swellRadius = easedZoom * maxDiag * 1.38;

      // Throttle idle breathing contour updates to ~30fps when cursor & waves are settled
      const isCursorStationary =
        swellRadius <= 2 &&
        activeWaves.length === 0 &&
        Math.abs(cursor.targetX - cursor.x) < 0.25 &&
        Math.abs(cursor.targetY - cursor.y) < 0.25 &&
        Math.abs(scrollVelocity) < 0.1;
      if (isCursorStationary) {
        idleBreathSkip = (idleBreathSkip + 1) % 2;
        if (idleBreathSkip !== 0) return;
      }

      const swellCenterX = cursor.presence > 0.01 ? cursor.x : width * 0.5;
      const swellCenterY =
        cursor.presence > 0.01
          ? clamp(cursor.y, viewOffsetY, viewOffsetY + vpH)
          : viewOffsetY + vpH * 0.5;

      const PAD = 120;
      const minX = -PAD;
      const minY = viewOffsetY - PAD;
      const spanW = width + PAD * 2;
      const spanH = vpH + PAD * 2;
      const cellW = spanW / COLS;
      const cellH = spanH / ROWS;

      // Compute active bounding box when not doing full-stage Page 3 expansion
      let gxStart = 1;
      let gxEnd = COLS - 1;
      let gyStart = 1;
      let gyEnd = ROWS - 1;
      let boxMinY = minY;

      if (swellRadius <= 2) {
        let boxMinX = Infinity;
        let boxMaxX = -Infinity;
        boxMinY = Infinity;
        let boxMaxY = -Infinity;

        for (let i = 0; i < activeWaves.length; i++) {
          const w = activeWaves[i];
          const reach = waveHalf[i] + 24;
          if (w.x - reach < boxMinX) boxMinX = w.x - reach;
          if (w.x + reach > boxMaxX) boxMaxX = w.x + reach;
          if (w.y - reach < boxMinY) boxMinY = w.y - reach;
          if (w.y + reach > boxMaxY) boxMaxY = w.y + reach;
        }
        if (cursor.presence > 0.01) {
          for (let c = 0; c < chain.length; c++) {
            const node = chain[c];
            const reach = node.baseR * 3.8 + 20;
            if (node.x - reach < boxMinX) boxMinX = node.x - reach;
            if (node.x + reach > boxMaxX) boxMaxX = node.x + reach;
            if (node.y - reach < boxMinY) boxMinY = node.y - reach;
            if (node.y + reach > boxMaxY) boxMaxY = node.y + reach;
          }
        }

        gxStart = Math.max(1, Math.floor((boxMinX - minX) / cellW));
        gxEnd = Math.min(COLS - 1, Math.ceil((boxMaxX - minX) / cellW));
        gyStart = Math.max(1, Math.floor((boxMinY - minY) / cellH));
        gyEnd = Math.min(ROWS - 1, Math.ceil((boxMaxY - minY) / cellH));
      }

      if (gxStart <= gxEnd && gyStart <= gyEnd) {
        for (let gx = gxStart; gx <= gxEnd; gx++) {
          xWave1[gx] = Math.sin((minX + gx * cellW) * 0.011 + t * 0.85);
        }
        for (let gy = gyStart; gy <= gyEnd; gy++) {
          yWave1[gy] = Math.cos((minY + gy * cellH) * 0.011 - t * 0.75);
        }
      }

      field.fill(0);
      const coreSkipR2 =
        swellRadius > 140 ? swellRadius * 0.65 * (swellRadius * 0.65) : 0;
      const cursorPresence = cursor.presence;
      const swirlPi2 = RIPPLE_CONFIG.swirl * Math.PI * 2.0;
      const strength20 = RIPPLE_CONFIG.strength * 20;
      const activeWaveCount = activeWaves.length;

      for (let gy = gyStart; gy <= gyEnd; gy++) {
        const rawY = minY + gy * cellH;
        const yw = yWave1[gy];
        const rowOffset = gy * (COLS + 1);

        for (let gx = gxStart; gx <= gxEnd; gx++) {
          const rawX = minX + gx * cellW;

          if (coreSkipR2 > 0) {
            const cdx = rawX - swellCenterX;
            const cdy = rawY - swellCenterY;
            if (cdx * cdx + cdy * cdy < coreSkipR2) {
              field[rowOffset + gx] = 2.6;
              continue;
            }
          }

          let amount = 0;
          let pushX = 0;
          let pushY = 0;

          // First pass: accumulate active viscous waves & gentle swirl displacement
          for (let i = 0; i < activeWaveCount; i++) {
            const w = activeWaves[i];
            const half = waveHalf[i];
            const dx = rawX - w.x;
            const dy = rawY - w.y;
            if (dx > half || dx < -half || dy > half || dy < -half) continue;

            const invHalf = waveInvHalf[i];
            const px = dx * invHalf;
            const py = dy * invHalf;
            const r = px * px + py * py;
            if (r >= 1.0) continue;

            const lutIdx = (r * (LUT_SIZE - 1)) | 0;
            const disp = radialLut[lutIdx] * ringLut[lutIdx] * waveOpPow[i];
            const theta = disp * swirlPi2;
            const pushMag = disp * strength20;
            pushX += Math.sin(theta) * pushMag;
            pushY += Math.cos(theta) * pushMag;
            amount += disp;
          }

          // Gentle viscous swirl advection
          let swirledSum = 0;
          if (
            amount > 0.01 &&
            (Math.abs(pushX) > 0.5 || Math.abs(pushY) > 0.5)
          ) {
            const sx = rawX + pushX;
            const sy = rawY + pushY;
            for (let i = 0; i < activeWaveCount; i++) {
              const w = activeWaves[i];
              const half = waveHalf[i];
              const dx = sx - w.x;
              const dy = sy - w.y;
              if (dx > half || dx < -half || dy > half || dy < -half) continue;
              const invHalf = waveInvHalf[i];
              const px = dx * invHalf;
              const py = dy * invHalf;
              const r = px * px + py * py;
              if (r >= 1.0) continue;
              const lutIdx = (r * (LUT_SIZE - 1)) | 0;
              swirledSum += radialLut[lutIdx] * ringLut[lutIdx] * waveOpPow[i];
            }
          } else {
            swirledSum = amount;
          }

          let sum = swirledSum;

          // Stationary viscous liquid aperture strictly at the mouse cursor position
          if (cursorPresence > 0.01) {
            const waveMod = 1 + 0.08 * (xWave1[gx] * yw);
            for (let c = 0; c < chain.length; c++) {
              const node = chain[c];
              const dx = rawX - node.x;
              const dy = rawY - node.y;
              const d2 = dx * dx + dy * dy + 72;
              const rEff = node.baseR * waveMod * cursorPresence;
              sum += (rEff * rEff) / d2;
            }
          }

          // Page 3 drill-down radial expansion
          if (swellRadius > 2) {
            const sdx = rawX - swellCenterX;
            const sdy = rawY - swellCenterY;
            const sd2 = sdx * sdx + sdy * sdy + 110;
            sum += (swellRadius * swellRadius) / sd2;
          }

          field[rowOffset + gx] = sum;
        }
      }

      // Threshold 0.36 merges overlapping trails and keeps thick, unbroken viscous rings
      const holeLoops = buildMetaballPath(
        field,
        COLS,
        ROWS,
        minX,
        minY,
        cellW,
        cellH,
        0.36
      );

      const outerRect = `M -400 -400 H ${width + 400} V ${stageHeight + 400} H -400 Z`;
      if (holeLoops && rippleZoom > 0.002) {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${stageHeight}" viewBox="0 0 ${width} ${stageHeight}"><defs><filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter></defs><path d="${outerRect} ${holeLoops}" fill="white" fill-rule="evenodd" filter="url(#soft)"/></svg>`;
        const mask = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
        upperWhiteLayer.style.clipPath = "none";
        upperWhiteLayer.style.maskImage = mask;
        upperWhiteLayer.style.webkitMaskImage = mask;
        upperWhiteLayer.style.maskSize = "100% 100%";
        upperWhiteLayer.style.webkitMaskSize = "100% 100%";
      } else {
        upperWhiteLayer.style.maskImage = "none";
        upperWhiteLayer.style.webkitMaskImage = "none";
        upperWhiteLayer.style.clipPath = holeLoops
          ? `path(evenodd, '${outerRect} ${holeLoops}')`
          : "none";
      }

      // Sync top fixed header with the exact same viewport-space liquid contour
      if (headerOwnsRipple) {
        const swellTouchesTop =
          swellRadius > 2 &&
          swellCenterY + stageRectTop - swellRadius * 1.8 <= 120;
        const rippleTouchesTop =
          holeLoops !== "" &&
          (swellTouchesTop || (swellRadius <= 2 && boxMinY + stageRectTop <= 110));

        if (rippleTouchesTop) {
          const vpOffsetX = docLeft - (window.scrollX || 0);
          const headerHoleLoops = buildMetaballPath(
            field,
            COLS,
            ROWS,
            vpOffsetX + minX,
            minY + stageRectTop,
            cellW,
            cellH,
            0.36
          );
          if (headerHoleLoops) {
            const headerOuter = `M -400 -400 H ${width + 400} V 320 H -400 Z`;
            syncHeaderClip(
              `path(evenodd, '${headerOuter} ${headerHoleLoops}')`,
              `path(evenodd, '${headerHoleLoops}')`
            );
          } else {
            syncHeaderClip("none", "inset(100%)");
          }
        } else {
          syncHeaderClip("none", "inset(100%)");
        }
      }
    };

    const stageXClamp = (x: number, w: number) => clamp(x, 0, w);

    rafId = requestAnimationFrame(renderFrame);

    return () => {
      disposed = true;
      if (rafId) cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener("resize", measureSection);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("mouseleave", onPointerLeave);
    };
  }, []);

  /**
   * Page 1: Pure typographic editorial layout with BlurText reveal,
   * paired with the black/white inverted CTA that morphs along the water ripple.
   * Split at exact 1/4 page width by a continuous 0.5px vertical hairline.
   */
  const renderPage1HeroContent = (isWhiteUpperLayer: boolean) => {
    const titleColor = isWhiteUpperLayer ? "text-[#1C2024]" : "text-[#FCFCFD]";
    const leadColor = isWhiteUpperLayer ? "text-[#1C2024]" : "text-[#F0F0F3]";
    const bodyColor = isWhiteUpperLayer ? "text-[#60646C]" : "text-[#B0B4BA]";
    const accentColor = "text-[#008F83]";
    const primaryBtnClass = isWhiteUpperLayer
      ? "pointer-events-auto bg-[#111113] hover:bg-[#27272A] text-[#FFFFFF] border-[0.5px] border-[#111113]"
      : "pointer-events-none bg-[#FFFFFF] text-[#111113] border-[0.5px] border-[#FFFFFF]";

    return (
      <div className="relative w-full h-[100vh] flex items-start pt-24 md:pt-[11vh] select-none overflow-hidden">
        {/* Continuous 0.5px vertical hairline at exact 1/4 (25%) page width */}
        <div
          className="hidden md:block absolute top-0 bottom-0 left-1/4 -translate-x-1/2 w-[0.5px] pointer-events-none z-[1]"
          style={{
            background: isWhiteUpperLayer
              ? "linear-gradient(180deg, rgba(28,32,36,0) 0%, rgba(28,32,36,0.22) 14%, rgba(28,32,36,0.22) 86%, rgba(28,32,36,0) 100%)"
              : "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.34) 14%, rgba(255,255,255,0.34) 86%, rgba(255,255,255,0) 100%)",
          }}
        />

        <div
          ref={isWhiteUpperLayer ? upperPage1TextRef : lowerPage1TextRef}
          className="relative z-10 w-full grid grid-cols-1 md:grid-cols-4 items-start will-change-transform"
        >
          {/* Left of 1/4 vertical axis: right-aligned flush against the 25% line */}
          <div className="px-6 md:pl-8 md:pr-8 lg:pr-10 md:text-right md:pt-2">
            <div className={`text-sm font-medium leading-[1.7] ${bodyColor}`}>
              {PAGE1_TAGLINE_LINES.map((line, idx) => (
                <ScrollReveal
                  key={`p1-tag-${idx}`}
                  as="p"
                  highlightColor=""
                  mode="enter"
                  splitBy="words"
                  effect="fade"
                  stagger={0.05}
                  duration={0.8}
                  smoothing={0}
                  baseOpacity={0.1}
                  baseRotation={3}
                  baseOffset={0}
                  enableBlur
                  blurStrength={4}
                  containerClassName={idx === 2 ? `font-semibold ${accentColor}` : undefined}
                >
                  {line}
                </ScrollReveal>
              ))}
            </div>
          </div>

          {/* Right of 1/4 vertical axis: left-aligned flush against the 25% line with generous whitespace */}
          <div className="login-editorial-song md:col-span-3 px-6 md:pl-10 lg:pl-14 md:pr-20 mt-6 md:mt-0 text-left">
            <div className="max-w-xl">
              <h1
                className={`text-3xl sm:text-4xl lg:text-[2.65rem] font-bold tracking-tight leading-[1.2] [text-wrap:balance] ${titleColor}`}
              >
                <ScrollReveal
                  as="div"
                  tokens={PAGE1_HEADLINE_LINE1_TOKENS}
                  highlightColor=""
                  mode="enter"
                  splitBy="words"
                  effect="fade"
                  stagger={0.05}
                  duration={0.8}
                  smoothing={0}
                  baseOpacity={0.1}
                  baseRotation={3}
                  baseOffset={0}
                  enableBlur
                  blurStrength={4}
                />
                <ScrollReveal
                  as="div"
                  tokens={PAGE1_HEADLINE_LINE2_TOKENS}
                  highlightColor=""
                  mode="enter"
                  splitBy="words"
                  effect="fade"
                  stagger={0.05}
                  duration={0.8}
                  smoothing={0}
                  baseOpacity={0.1}
                  baseRotation={3}
                  baseOffset={0}
                  enableBlur
                  blurStrength={4}
                  containerClassName={accentColor}
                />
              </h1>

              <ScrollReveal
                as="p"
                tokens={PAGE1_LEAD_TOKENS}
                highlightColor=""
                mode="enter"
                splitBy="words"
                effect="fade"
                stagger={0.05}
                duration={0.8}
                smoothing={0}
                baseOpacity={0.1}
                baseRotation={3}
                baseOffset={0}
                enableBlur
                blurStrength={4}
                containerClassName={`mt-6 text-base sm:text-lg font-medium leading-relaxed ${leadColor}`}
              />

              <ScrollReveal
                as="p"
                tokens={PAGE1_BODY_TOKENS}
                highlightColor=""
                mode="enter"
                splitBy="words"
                effect="fade"
                stagger={0.05}
                duration={0.8}
                smoothing={0}
                baseOpacity={0.1}
                baseRotation={3}
                baseOffset={0}
                enableBlur
                blurStrength={4}
                containerClassName={`mt-4 max-w-md text-sm leading-[1.85] ${bodyColor}`}
              />

              <ScrollReveal
                as="p"
                tokens={PAGE1_PROMPT_TOKENS}
                highlightColor=""
                mode="enter"
                splitBy="words"
                effect="fade"
                stagger={0.05}
                duration={0.8}
                smoothing={0}
                baseOpacity={0.1}
                baseRotation={3}
                baseOffset={0}
                enableBlur
                blurStrength={4}
                containerClassName={`mt-4 text-sm font-medium leading-relaxed ${leadColor}`}
              />

              <div className="mt-6">
                <motion.button
                  type="button"
                  data-liquid-skip="true"
                  initial={{ filter: "blur(4px)", opacity: 0.1, rotate: 3 }}
                  animate={{ filter: "blur(0px)", opacity: 1, rotate: 0 }}
                  transition={{
                    duration: 0.8,
                    delay: 0.25,
                    ease: [0.33, 1, 0.68, 1],
                  }}
                  onClick={isWhiteUpperLayer ? jumpToFinalLogin : undefined}
                  tabIndex={isWhiteUpperLayer ? 0 : -1}
                  aria-hidden={!isWhiteUpperLayer}
                  className={`h-10 px-6 rounded-[8px] text-sm font-medium inline-flex items-center justify-center transition-colors duration-[250ms] ease-out cursor-pointer ${primaryBtnClass}`}
                >
                  开始探索
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPage2EditorialContent = (isWhiteUpperLayer: boolean) => {
    const mainText = isWhiteUpperLayer ? "text-[#1C2024]" : "text-[#F0F0F3]";
    return (
      <div
        ref={isWhiteUpperLayer ? upperPage2TextRef : lowerPage2TextRef}
        className="relative h-[130vh] w-full overflow-hidden font-sans transition-opacity duration-[250ms] ease-out will-change-[transform,opacity]"
      >
        <div className="mx-auto w-full max-w-[1600px] px-6 pt-24 md:px-10 md:pt-[10vh] lg:px-14">
          <div className="grid grid-cols-1 items-end gap-8 md:grid-cols-[minmax(0,3fr)_minmax(0,1fr)] md:gap-8 lg:gap-12">
            <div className="aspect-[4/3] w-full" aria-hidden="true" />
            <div className="min-w-0 pb-1">
              <h2 className={`text-xl font-semibold leading-[1.4] tracking-tight sm:text-2xl ${mainText}`}>
                <span className="text-[#008F83]">Omnilink </span>是一个以个人需求为中心的 AI 生活空间
              </h2>
            </div>
          </div>

        </div>
      </div>
    );
  };

  return (
    <section
      id="product-entropy"
      ref={runwayRef}
      style={{ backgroundColor: "#000000" }}
      className="relative w-full h-[360vh] select-none will-change-[background-color]"
    >
      {/* Unified dual-layer stage */}
      <div
        ref={stageRef}
        className="sticky top-[-230vh] left-0 w-full h-[330vh] bg-[#000000] overflow-hidden select-none cursor-crosshair"
      >
        {/* Static un-transformed Page 2 trigger anchor so ScrollTrigger syncs both layers identically */}
        <div
          ref={page2TriggerRef}
          className="absolute top-[100vh] inset-x-0 h-[130vh] pointer-events-none"
          aria-hidden="true"
        />

        {/* =====================================================================
            LOWER LAYER (下层：统一纯黑 #000000 底色，第一、二页无缝衔接过渡)
            - Page 1 + Page 2 unified 230vh black canvas: seamless cross-boundary
              flow between the 2x 3-card 45° Orbit and Page 2 animated mesh media
            - Page 3 (230-330vh): Seamless #000000 transition into FlexCarousel
        ===================================================================== */}
        <div
          id="page3-liquid-mask-layer"
          ref={lowerBlackLayerRef}
          style={{ backgroundColor: "#000000" }}
          className="absolute inset-0 w-full h-full z-10 will-change-[background-color]"
        >
          {/* Unified Page 1 + Page 2 Lower Black Layer (no seam or overflow clip between 0–230vh) */}
          <div className="relative w-full h-[230vh] bg-[#000000] overflow-visible">
            {/* Continuous Animated Mesh Gradient Media spanning smoothly from lower Page 1 through Page 2 */}
            <div
              ref={lowerP2MediaParallaxRef}
              className="absolute top-[52vh] inset-x-0 h-[182vh] z-[1] pointer-events-none will-change-transform"
              style={{
                transform: "scale(1.12)",
                WebkitMaskImage:
                  "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.45) 20%, #000000 36%, #000000 84%, rgba(0,0,0,0) 100%)",
                maskImage:
                  "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.45) 20%, #000000 36%, #000000 84%, rgba(0,0,0,0) 100%)",
              }}
            >
              <video
                ref={page2VideoRef}
                src="/assets/aistudio/animated-mesh-gradient-1140x1140_c014aba0.webm"
                poster="/assets/aistudio/mesh-gradient-1795588690877_23d82141.png"
                loop
                muted
                playsInline
                preload="auto"
                className="w-full h-full object-cover object-center block"
              />
            </div>

            {/* Page 1 2x 3-Card 45° Diagonal Variable-Speed Gallery (full-width unclipped stage) */}
            <div
              ref={lowerTriOrbitParallaxRef}
              className="absolute top-0 inset-x-0 h-[100vh] z-[2] pointer-events-none overflow-visible will-change-transform"
            >
              <BleibtTriOrbit
                items={triOrbitItems}
                cycleSeconds={4.2}
                diagonalAngle={45}
              />
            </div>

            {/* Page 1 Mirrored White Typography (0–100vh) */}
            <div className="relative w-full h-[100vh] z-10 pointer-events-none">
              {renderPage1HeroContent(false)}
            </div>

            {/* Page 2 Mirrored White Typography (100–230vh) */}
            <div className="relative w-full h-[130vh] z-10 pointer-events-none">
              {renderPage2EditorialContent(false)}
            </div>
          </div>

          {/* Page 3 Lower Black Layer: Pure #000000 + FlexCarousel */}
          <div
            id="page3-upper-editorial"
            className="relative w-full h-[100vh] overflow-hidden will-change-[opacity]"
          >
            <div
              ref={carouselWrapRef}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: "8vh",
                width: "100vw",
                height: "84vh",
                opacity: 0,
                transform: "translate3d(0, 28px, 0)",
                touchAction: "pan-y",
              }}
              className="pointer-events-auto z-30 will-change-transform"
            >
              <FlexCarousel
                items={flexCarouselItems}
                preset="liquid"
                intro="none"
                cardHeight={0.62}
                gap={16}
                squeeze={0.2}
                focusOnClick
                captions={false}
                fit="portrait"
                radius={0}
                lensWidth={0.78}
                lensHeight={1.22}
                tilt={62}
                roundness={0.63}
                bend={0.34}
                reach={0.38}
                curl="twist"
                dispersion={0.85}
                liquid={0.2}
                followCursor={false}
                autoplay
                interval={3.5}
                captureWheel={false}
                initialPaused
              />
            </div>
          </div>
        </div>

        {/* =====================================================================
            UPPER LAYER (上层：统一纯白 #FFFFFF 表层，Page 1 与 Page 2 无缝链接过渡)
            Zero preset holes: remains calm white until pointer hover/click
            triggers concentric swirling RippleDistortion water waves
        ===================================================================== */}
        <div
          ref={upperWhiteLayerRef}
          className="absolute inset-0 w-full h-full bg-[#FFFFFF] z-20 pointer-events-none will-change-[clip-path,opacity]"
        >
          {renderPage1HeroContent(true)}
          {renderPage2EditorialContent(true)}
          <div className="login-editorial-song min-h-[100vh] w-full px-6 pt-24 md:px-10 md:pt-[8vh] lg:px-14">
            <div className="relative mx-auto grid w-full max-w-[1600px] grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <div aria-hidden="true" className="absolute inset-y-0 left-2/3 hidden w-[0.5px] bg-[#60646C] md:block" />
              <p className="self-end pb-5 text-sm font-semibold leading-snug text-[#1C2024] md:pe-10 md:text-right">
                你的世界<br />由你连接
              </p>
              <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-[#1C2024] sm:text-4xl lg:text-5xl md:ps-10">
                连接<span className="text-[#008F83]">灵感</span><br />与生活
              </h2>
              <p className="mt-12 text-3xl font-bold leading-[1.2] tracking-tight text-[#1C2024] sm:text-4xl lg:text-5xl md:mt-16 md:pe-10 md:text-right">
                探索喜欢的事物<br />找到<span className="text-[#008F83]">需要</span>的答案
              </p>
              <p className="mt-6 max-w-sm text-sm leading-[1.8] text-[#60646C] sm:text-base md:mt-16 md:ps-10">
                连接商品、内容与服务，让信息自由流通，把更多时间留给生活。
              </p>
            </div>
          </div>
        </div>

        {/* =====================================================================
            ABOVE-RIPPLE STACKED MOCKUPS (z-30：占左侧 2/3 视觉中心大幅画面，不受水波纹裁切)
        ===================================================================== */}
        <div
          ref={page2ImageLayerRef}
          className="absolute top-[100vh] inset-x-0 h-[130vh] z-30 pointer-events-none pt-20 md:pt-[10vh] transition-opacity duration-[250ms] ease-out will-change-[transform,opacity]"
        >
          <div className="mx-auto grid w-full max-w-[1600px] grid-cols-1 gap-8 px-6 pt-4 md:grid-cols-[minmax(0,3fr)_minmax(0,1fr)] md:gap-8 md:px-10 md:pt-0 lg:gap-12 lg:px-14">
            <div className="min-w-0">
              <div className="relative w-full">
                {/* Web UI Mockup (back) */}
                <div className="w-[91%] aspect-[4/3] rounded-[8px] overflow-hidden border-[0.5px] border-[#D9D9E0] bg-[#FFFFFF]">
                  <img
                    src={webMockupImg}
                    alt="Omnilink 桌面端首页"
                    draggable={false}
                    className="w-full h-full object-cover block select-none"
                  />
                </div>

                {/* Mobile UI Mockup (overlapping front lower-right corner) */}
                <div className="absolute right-0 -bottom-4 md:-bottom-6 w-[23%] max-w-[210px] rounded-[10px] overflow-hidden border-[0.5px] border-[#C9CBD4] bg-[#FFFFFF] shadow-[0_8px_24px_rgba(28,32,36,0.12)]">
                  <img
                    src={mobileMockupImg}
                    alt="Omnilink 移动端 AI 对话界面"
                    draggable={false}
                    className="w-full h-auto block select-none"
                  />
                </div>
              </div>
            </div>

            <div className="hidden md:block" aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>
  );
}

export default BleibtGooeySection;

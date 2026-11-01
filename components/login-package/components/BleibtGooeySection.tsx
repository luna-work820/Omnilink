"use client";

import React, { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import localFont from "next/font/local";
import { sharedRippleGPU } from "./RippleDistortion/sharedRippleGpu";
import { buildMetaballPath } from "./RippleDistortion/metaballContour";

const FlexCarousel = dynamic(() => import("./FlexCarousel"), { ssr: false });
type OrbitImagesProps = {
  images: string[];
  shape: "ellipse";
  radiusX: number;
  radiusY: number;
  rotation: number;
  duration: number;
  itemSize: number;
  itemWidth: number;
  itemHeight: number;
  depth: number;
  hoverScale: number;
  hoverSpeed: number;
  showPath: boolean;
  direction: "normal";
  easing: "easeOut";
  fill: boolean;
  alignToPath: boolean;
  draggable: boolean;
  clickToFront: boolean;
  paused: boolean;
  intro: boolean;
  height: string;
  itemRadius: number;
  shadow: number;
  className: string;
};
const OrbitImages = dynamic<OrbitImagesProps>(
  () =>
    import("../../OrbitImages").then(
      (module) => module.default as React.ComponentType<OrbitImagesProps>
    ),
  { ssr: false }
);

const editorialFont = localFont({
  src: "../../../public/login-package/fonts/lemi-jian-zhuan.ttf",
  weight: "400",
  fallback: ["Songti SC", "SimSun", "Noto Serif CJK SC", "serif"],
  display: "swap",
  preload: false,
});

const HEADLINE_TOKENS = [
  "世界从不缺少选择",
  "缺少的，是",
  "与你有关的那一个",
];

const SUPPORT_TOKENS = [
  "让选择，拥有自己的方向",
  "让每次发现，都更接近自己",
];

const SUBTEXT_TOKENS = [
  "不追随人群",
  "只寻找与你有关的",
];

const TOTAL_RIPPLE_TOKENS =
  HEADLINE_TOKENS.length + SUPPORT_TOKENS.length + SUBTEXT_TOKENS.length;

// Hover lift gives the page-two copy a pointer response without competing with the wave reveal.
const pageTwoHoverLift =
  "transition-transform duration-500 ease-out hover:-translate-y-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0";

const flexCarouselItems = [
  { src: '/login-package/images/one.webp', alt: 'A chrome sculpture', title: 'Iridescence' },
  { src: '/login-package/images/two.webp', alt: 'A figure on a white set', title: 'White Room' },
  { src: '/login-package/images/three.webp', alt: 'A clay bust in profile', title: 'Clay Study', subtitle: 'Studio 04' },
  { src: '/login-package/images/four.webp', alt: 'Liquid impression', title: 'Obsidian Current', subtitle: 'Studio 05' },
  { src: '/login-package/images/one.webp', alt: 'A chrome sculpture', title: 'Iridescence' },
  { src: '/login-package/images/two.webp', alt: 'A figure on a white set', title: 'White Room' },
  { src: '/login-package/images/three.webp', alt: 'A clay bust in profile', title: 'Clay Study', subtitle: 'Studio 04' }
];

interface Droplet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  targetR: number;
  life: number;
  maxLife: number;
}

interface InkTrailNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  maxR: number;
  age: number;
  maxAge: number;
  intensity: number;
}

const galleryImages = [
  "/login-package/images/212.webp",
  "/login-package/images/pexels-92377587-31379973.webp",
  "/login-package/images/pexels-arteeem-1887920.webp",
  "/login-package/images/pexels-ebahir-32106612.webp",
  "/login-package/images/pexels-faisal-shabir-2164409984-39884329.webp",
  "/login-package/images/pexels-madzery-39218180.webp",
  "/login-package/images/pexels-mathilde-11843706.webp",
];

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

export function BleibtGooeySection() {
  const runwayRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const scrollTriggerRulerRef = useRef<HTMLDivElement>(null);
  const inkCanvasRef = useRef<HTMLCanvasElement>(null);
  const liquidMaskLayerRef = useRef<HTMLDivElement>(null);
  const carouselWrapRef = useRef<HTMLDivElement>(null);
  const galleryWrapRef = useRef<HTMLDivElement>(null);
  const upperTextWrapRef = useRef<HTMLDivElement>(null);
  const lowerDividerRef = useRef<HTMLDivElement>(null);
  const upperDividerRef = useRef<HTMLDivElement>(null);
  const lowerTokensRef = useRef<(HTMLSpanElement | null)[]>([]);
  const upperTokensRef = useRef<(HTMLSpanElement | null)[]>([]);
  const carouselLoadedRef = useRef(false);
  const [isGalleryNearViewport, setIsGalleryNearViewport] = useState(false);
  const [isCarouselNearViewport, setIsCarouselNearViewport] = useState(false);

  useEffect(() => {
    const gallery = galleryWrapRef.current;
    if (!gallery) return;

    let rafId = 0;
    const updateVisibility = () => {
      rafId = 0;
      const rect = gallery.getBoundingClientRect();
      const isNearViewport =
        rect.top < window.innerHeight + 200 && rect.bottom > -200;
      setIsGalleryNearViewport(isNearViewport);
    };
    const scheduleVisibilityCheck = () => {
      if (!rafId) rafId = window.requestAnimationFrame(updateVisibility);
    };

    updateVisibility();
    window.addEventListener("scroll", scheduleVisibilityCheck, { passive: true });
    window.addEventListener("resize", scheduleVisibilityCheck, { passive: true });
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", scheduleVisibilityCheck);
      window.removeEventListener("resize", scheduleVisibilityCheck);
    };
  }, []);

  useEffect(() => {
    const runway = runwayRef.current;
    const stage = stageRef.current;
    const inkCanvas = inkCanvasRef.current;
    const liquidMaskLayer = liquidMaskLayerRef.current;
    if (!runway || !stage || !inkCanvas || !liquidMaskLayer) {
      return;
    }

    const inkCtx = inkCanvas.getContext("2d", { desynchronized: true });

    let runwayDocTop = 0;
    let runwayHeight = 1;
    let docLeft = 0;
    let width = Math.max(1, stage.clientWidth);
    let vpH = Math.max(1, window.innerHeight || 800);
    let stageHeight = Math.max(1, vpH * 2);
    const canvasScale = 0.38;

    const BARRIER_TOP = -75;
    const BARRIER_BOTTOM_OFFSET = 110;
    let barrierBottom = Math.max(
      200,
      stageHeight - BARRIER_BOTTOM_OFFSET
    );

    const measureSection = () => {
      if (!runway || !stage || !inkCanvas) return;
      const runwayRect = runway.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      const scrollY = window.scrollY || 0;
      const scrollX = window.scrollX || 0;
      vpH = Math.max(1, window.innerHeight || 800);
      runwayDocTop = runwayRect.top + scrollY;
      runwayHeight = Math.max(1, runwayRect.height);
      docLeft = stageRect.left + scrollX;
      width = Math.max(1, stageRect.width);
      stageHeight = Math.max(1, vpH * 2);
      barrierBottom = Math.max(
        200,
        stageHeight - BARRIER_BOTTOM_OFFSET
      );
      const targetW = Math.max(1, Math.round(width * canvasScale));
      const targetH = Math.max(1, Math.round(vpH * canvasScale));
      if (inkCanvas.width !== targetW || inkCanvas.height !== targetH) {
        inkCanvas.width = targetW;
        inkCanvas.height = targetH;
      }
      sharedRippleGPU.setMaskZoneDocumentBounds(
        runwayDocTop,
        runwayHeight,
        "page2"
      );
    };

    measureSection();
    const ro = new ResizeObserver(measureSection);
    ro.observe(runway);
    window.addEventListener("resize", measureSection, { passive: true });

    const pointer = {
      clientX: width * 0.52,
      clientY: vpH * 0.36,
      anchorClientX: width * 0.52,
      anchorClientY: vpH * 0.36,
      x: width * 0.52,
      y: BARRIER_TOP,
      targetX: width * 0.52,
      targetY: BARRIER_TOP,
      vx: 0,
      vy: 0,
      lastSpawnX: width * 0.52,
      lastSpawnY: BARRIER_TOP,
      lastMoveTime: -10000,
      isInsideSection: false,
    };

    const chain = Array.from({ length: 7 }, (_, idx) => ({
      x: pointer.x,
      y: BARRIER_TOP - idx * 6,
      vx: 0,
      vy: 0,
      baseR: [62, 53, 44, 36, 29, 23, 17][idx],
    }));

    const droplets: Droplet[] = [];
    const inkTrail: InkTrailNode[] = [];

    // Pure math scroll metrics — zero getBoundingClientRect() during scroll/pointermove
    const getScrollMetrics = (currentScrollY: number) => {
      const scrollIntoRunway = currentScrollY - runwayDocTop;
      const maxPinScroll = Math.max(1, runwayHeight - vpH);
      const viewOffsetY = clamp(scrollIntoRunway, 0, vpH);
      const rawRunwayTop = -scrollIntoRunway;
      const rawRunwayBottom = rawRunwayTop + runwayHeight;
      const stageRectTop =
        scrollIntoRunway <= 0
          ? -scrollIntoRunway
          : scrollIntoRunway <= maxPinScroll
          ? -viewOffsetY
          : -vpH - (scrollIntoRunway - maxPinScroll);
      return {
        scrollIntoRunway,
        maxPinScroll,
        viewOffsetY,
        rawRunwayTop,
        rawRunwayBottom,
        stageRectTop,
      };
    };

    const onPointerMove = (e: PointerEvent) => {
      const { rawRunwayTop, rawRunwayBottom, stageRectTop } = getScrollMetrics(
        window.scrollY || 0
      );
      const nx = clamp(e.clientX - docLeft, 90, Math.max(90, width - 90));
      const nyClient = clamp(e.clientY, 24, Math.max(24, vpH - 24));

      pointer.clientX = nx;
      pointer.clientY = nyClient;
      pointer.anchorClientX = nx;
      pointer.anchorClientY = nyClient;

      // Accurate stage Y coordinate across Page 1 -> Page 2 boundary (negative when cursor is still in Page 1)
      const rawStageY = nyClient - stageRectTop;

      pointer.targetX = nx;
      pointer.targetY = clamp(rawStageY, BARRIER_TOP, barrierBottom);

      pointer.isInsideSection =
        rawStageY >= -90 &&
        rawRunwayBottom >= 0 &&
        rawRunwayTop <= vpH &&
        e.clientX >= docLeft - 40 &&
        e.clientX <= docLeft + width + 40;

      if (pointer.isInsideSection) {
        pointer.lastMoveTime = performance.now();
      }

      if (rawStageY < -20) {
        pointer.lastSpawnX = pointer.targetX;
        pointer.lastSpawnY = pointer.targetY;
        return;
      }

      const dist = Math.hypot(
        pointer.targetX - pointer.x,
        pointer.targetY - pointer.y
      );
      const trailDist = Math.hypot(
        pointer.targetX - pointer.lastSpawnX,
        pointer.targetY - pointer.lastSpawnY
      );

      if (trailDist > 14 && pointer.targetY >= -10 && pointer.targetY <= barrierBottom - 10) {
        const moveAngle = Math.atan2(
          pointer.targetY - pointer.lastSpawnY,
          pointer.targetX - pointer.lastSpawnX
        );
        const speed = Math.min(trailDist, 45);
        inkTrail.push({
          x: pointer.x,
          y: pointer.y,
          vx:
            -Math.cos(moveAngle) * speed * 0.03 + (Math.random() - 0.5) * 0.35,
          vy:
            -Math.sin(moveAngle) * speed * 0.03 + (Math.random() - 0.5) * 0.35,
          r: 48 + Math.min(speed * 0.4, 20),
          maxR: 112 + Math.min(speed * 0.85, 42),
          age: 0,
          maxAge: 48 + Math.random() * 16,
          intensity: Math.min(1, 0.58 + speed * 0.01),
        });
        if (inkTrail.length > 20) inkTrail.shift();
        pointer.lastSpawnX = pointer.targetX;
        pointer.lastSpawnY = pointer.targetY;
      }

      if (
        dist > 16 &&
        droplets.length < 8 &&
        pointer.targetY >= 5 &&
        pointer.targetY <= barrierBottom - 15
      ) {
        const angle =
          Math.atan2(
            pointer.targetY - pointer.y,
            pointer.targetX - pointer.x
          ) +
          (Math.random() - 0.5) * 0.85;
        const speed = Math.min(dist * 0.12, 4.5);
        droplets.push({
          x: chain[0].x + (Math.random() - 0.5) * 22,
          y: chain[0].y + (Math.random() - 0.5) * 22,
          vx: -Math.cos(angle) * speed * 0.35,
          vy: -Math.sin(angle) * speed * 0.35,
          r: 8,
          targetR: 18 + Math.random() * 18,
          life: 0,
          maxLife: 32 + Math.random() * 18,
        });
      }
    };

    let hoverAmount = 0;
    let smoothExpand = 0;
    let smoothCursorEntry = 0;
    let lastChainWaveTime = 0;
    let lastExpandRippleTime = 0;
    let isFullyExpanded = false;
    let lastCanvasOffsetY = -99999;

    // Leaner grid + 1D precomputed wave lookup tables for ultra-fast (<0.1ms) Marching Squares
    const COLS = 38;
    const ROWS = 24;
    const field = new Float32Array((COLS + 1) * (ROWS + 1));
    const xWave1 = new Float32Array(COLS + 1);
    const xWave2 = new Float32Array(COLS + 1);
    const yWave1 = new Float32Array(ROWS + 1);
    const yWave2 = new Float32Array(ROWS + 1);
    const startTime = performance.now();
    let frameSkip = 0;
    let smoothTextProgress = -1;
    const lastTokenProgress = new Float32Array(TOTAL_RIPPLE_TOKENS).fill(-1);

    let unsubscribe: (() => void) | null = null;
    const subscribeToFrames = () => {
      if (unsubscribe) return;
      unsubscribe = sharedRippleGPU.subscribe(
      (
      _glCanvas,
      _vpW,
      currentVpH,
      sampleDisplacement,
      sharedState
      ) => {
        vpH = currentVpH;
        const {
          scrollIntoRunway,
          maxPinScroll,
          viewOffsetY,
          rawRunwayTop,
          rawRunwayBottom,
          stageRectTop,
        } = getScrollMetrics(sharedState.scrollY);

        // 向上滚动离开第二页顶部（退回首页）时，重置所有文字与竖线为初始态，避免向上快速滚动时动画冻结
        if (rawRunwayTop > vpH) {
          sharedRippleGPU.setPage2HoverAmount(0, "page2");
          smoothTextProgress = 0;
          const lowerEls = lowerTokensRef.current;
          const upperEls = upperTokensRef.current;
          for (let i = 0; i < TOTAL_RIPPLE_TOKENS; i++) {
            lastTokenProgress[i] = 0;
            const lEl = lowerEls[i];
            const uEl = upperEls[i];
            if (lEl) {
              lEl.style.opacity = "0";
              lEl.style.transform = "translate3d(0, 42px, 0) scale(0.92)";
            }
            if (uEl) {
              uEl.style.opacity = "0";
              uEl.style.transform = "translate3d(0, 42px, 0) scale(0.92)";
            }
          }
          if (lowerDividerRef.current) {
            lowerDividerRef.current.style.opacity = "1";
          }
          if (upperDividerRef.current) {
            upperDividerRef.current.style.opacity = "1";
          }
          return;
        }

        if (rawRunwayBottom < -150) {
          sharedRippleGPU.setPage2HoverAmount(0, "page2");
          return;
        }

        // 跟随鼠标滚动依次上浮文字（保持原字色纯黑/纯白，无变蓝过程，零 React 重渲染直接驱动 GPU 合成层）
        const revealStart = -vpH * 0.78;
        const revealEnd = -vpH * 0.04;
        const rawTextProgress = clamp(
          (scrollIntoRunway - revealStart) / Math.max(1, revealEnd - revealStart),
          0,
          1
        );

        const isScrollingFast = Math.abs(sharedState.scrollVelocity) > 2.0;

        if (smoothTextProgress < 0) {
          smoothTextProgress = rawTextProgress;
        } else if (isScrollingFast) {
          smoothTextProgress = rawTextProgress;
        } else {
          smoothTextProgress += (rawTextProgress - smoothTextProgress) * 0.32;
          if (Math.abs(rawTextProgress - smoothTextProgress) < 0.0006) {
            smoothTextProgress = rawTextProgress;
          }
        }

        // 竖线随着滚动平滑渐隐消失（中式留白美学：初时立轴为界，随滚动意境渐深而自然消融化入水波）
        // 向上滚动时自然重新显现
        const lineFade =
          0.62 + clamp(1 - (smoothTextProgress - 0.22) / 0.68, 0, 1) * 0.38;
        if (lowerDividerRef.current) {
          lowerDividerRef.current.style.opacity = lineFade.toFixed(3);
        }
        if (upperDividerRef.current) {
          upperDividerRef.current.style.opacity = lineFade.toFixed(3);
        }

        const lowerEls = lowerTokensRef.current;
        const upperEls = upperTokensRef.current;
        const tokenSpan = 0.26;
        const maxStagger = 1 - tokenSpan;

        for (let i = 0; i < TOTAL_RIPPLE_TOKENS; i++) {
          const startAt =
            (i / Math.max(1, TOTAL_RIPPLE_TOKENS - 1)) * maxStagger;
          const u = clamp((smoothTextProgress - startAt) / tokenSpan, 0, 1);

          if (Math.abs(u - lastTokenProgress[i]) < 0.001) continue;
          lastTokenProgress[i] = u;

          const lowerEl = lowerEls[i];
          const upperEl = upperEls[i];

          if (u <= 0.001) {
            const hiddenTransform = "translate3d(0, 42px, 0) scale(0.92)";
            if (lowerEl) {
              lowerEl.style.opacity = "0";
              lowerEl.style.transform = hiddenTransform;
            }
            if (upperEl) {
              upperEl.style.opacity = "0";
              upperEl.style.transform = hiddenTransform;
            }
            continue;
          }

          if (u >= 0.999) {
            const settledTransform = "translate3d(0, 0px, 0) scale(1)";
            if (lowerEl) {
              lowerEl.style.opacity = "1";
              lowerEl.style.transform = settledTransform;
            }
            if (upperEl) {
              upperEl.style.opacity = "1";
              upperEl.style.transform = settledTransform;
            }
            continue;
          }

          // 水波纹波峰上浮曲线：由水下浮起，伴随微幅波峰涌动，随后平滑归位（全程保持原本纯黑/纯白字色）
          const inv = 1 - u;
          const easeOut = 1 - inv * inv * inv;
          const waveCrest = Math.sin(u * Math.PI);
          const liftY = (1 - easeOut) * 42 - waveCrest * 5.5;
          const scaleVal = 0.92 + 0.08 * easeOut + waveCrest * 0.025;
          const skewX = waveCrest * -3.5;
          const alpha = clamp(u * 1.55, 0, 1);

          const tf = `translate3d(0, ${liftY.toFixed(2)}px, 0) skewX(${skewX.toFixed(2)}deg) scale(${scaleVal.toFixed(3)})`;
          const op = alpha.toFixed(3);

          if (lowerEl) {
            lowerEl.style.opacity = op;
            lowerEl.style.transform = tf;
          }
          if (upperEl) {
            upperEl.style.opacity = op;
            upperEl.style.transform = tf;
          }
        }

        // Keep the 100vh inkCanvas aligned with the active viewport window inside the 200vh stage
        const roundedOffset = Math.round(viewOffsetY);
        if (Math.abs(roundedOffset - lastCanvasOffsetY) >= 1) {
          lastCanvasOffsetY = roundedOffset;
          inkCanvas.style.transform = `translate3d(0, ${roundedOffset}px, 0)`;
        }

        // 计算第三页锁定期间的水波纹下钻扩张进度 (0 -> 1)
        const pinExpandSpan = Math.max(1, maxPinScroll - vpH);
        const rawExpand = clamp(
          (scrollIntoRunway - vpH) / pinExpandSpan,
          0,
          1
        );
        smoothExpand += (rawExpand - smoothExpand) * 0.45;
        if (Math.abs(rawExpand - smoothExpand) < 0.0005) {
          smoothExpand = rawExpand;
        }

        // 在整个锁定行程中让水波纹液态边界平滑扩张吞没白色区域，并在行程结束时 100% 纯黑并释放滚动
        const rippleZoom = clamp(smoothExpand, 0, 1);
        const easedZoom =
          rippleZoom * rippleZoom * (3.0 - 2.0 * rippleZoom);

        // 随着页面变黑（白色遮罩消失：rippleZoom 0 -> 1），滚动画集渐进浮现并等比例放大；
        // 当白色遮罩完全消失变成纯黑屏时（rippleZoom >= 1），滚动画集 100% 完全出现并放大至 1.0
        const carouselReveal = clamp(
          easedZoom * 0.65 + rippleZoom * 0.35,
          0,
          1
        );
        const galleryEl = galleryWrapRef.current;
        if (galleryEl) {
          galleryEl.style.transform = `translate3d(0, ${Math.round(viewOffsetY)}px, 0)`;
          galleryEl.style.opacity = (0.85 * (1 - carouselReveal)).toFixed(3);
        }
        if (carouselReveal > 0.02 && !carouselLoadedRef.current) {
          carouselLoadedRef.current = true;
          setIsCarouselNearViewport(true);
        }
        const carouselWrapEl = carouselWrapRef.current;
        if (carouselWrapEl) {
          carouselWrapEl.style.opacity = carouselReveal.toFixed(4);
          const liftPx = (1 - carouselReveal) * 32;
          carouselWrapEl.style.transform = `translate3d(0, ${liftPx.toFixed(1)}px, 0)`;
          carouselWrapEl.style.pointerEvents =
            carouselReveal > 0.45 ? "auto" : "none";
          const fcEl = carouselWrapEl.firstElementChild as HTMLElement | null;
          if (fcEl) {
            const zoomFactor = 0.68 + 0.32 * carouselReveal;
            fcEl.dataset.scrollZoom = zoomFactor.toFixed(4);
          }
        }
        const upperTextEl = upperTextWrapRef.current;
        if (upperTextEl) {
          const textAlpha = clamp(1 - carouselReveal * 1.25, 0, 1);
          upperTextEl.style.opacity = textAlpha.toFixed(4);
        }

        const now = performance.now();
        const t = (now - startTime) * 0.001;

        pointer.clientX = clamp(
          sharedState.pointerClientX - docLeft,
          90,
          Math.max(90, width - 90)
        );
        pointer.clientY = clamp(
          sharedState.pointerClientY,
          24,
          Math.max(24, vpH - 24)
        );

        // True cursor Y in stage coordinates: negative when cursor is still on Page 1 above Page 2's top edge
        const rawStageY = pointer.clientY - stageRectTop;
        const maxVisY = Math.min(barrierBottom, viewOffsetY + vpH - 65);

        // Smooth boundary immersion factor as cursor crosses from Page 1 (rawStageY < 0) into Page 2 (rawStageY >= 0)
        const rawEntry = clamp((rawStageY + 95) / 185, 0, 1);
        const targetEntry = rawEntry * rawEntry * (3.0 - 2.0 * rawEntry);
        smoothCursorEntry += (targetEntry - smoothCursorEntry) * 0.22;
        if (Math.abs(targetEntry - smoothCursorEntry) < 0.001) {
          smoothCursorEntry = targetEntry;
        }

        pointer.targetX = pointer.clientX;
        pointer.targetY = clamp(rawStageY, BARRIER_TOP, Math.max(BARRIER_TOP, maxVisY));
        pointer.isInsideSection =
          rawStageY >= -90 &&
          rawRunwayBottom >= 0 &&
          rawRunwayTop <= vpH;

        const idleSec = (now - pointer.lastMoveTime) * 0.001;
        let goalX = pointer.targetX;
        let goalY = pointer.targetY;

        if (rawStageY < -25) {
          // While cursor is still in Page 1, keep chain poised right above the Page 1 / Page 2 boundary at cursor X
          pointer.x += (goalX - pointer.x) * 0.35;
          pointer.y += (goalY - pointer.y) * 0.35;
          for (let idx = 0; idx < chain.length; idx++) {
            const node = chain[idx];
            node.x += (pointer.x - node.x) * 0.35;
            node.y += (pointer.y - idx * 5 - node.y) * 0.35;
            node.vx = 0;
            node.vy = 0;
          }
        } else {
          if (idleSec > 1.2 && rawStageY >= 20) {
            const anchorStageY = clamp(
              pointer.anchorClientY - stageRectTop,
              30,
              Math.max(30, maxVisY)
            );
            goalX = clamp(
              pointer.anchorClientX +
                Math.sin(t * 1.1) * 22 +
                Math.cos(t * 0.65) * 12,
              90,
              Math.max(90, width - 90)
            );
            goalY = clamp(
              anchorStageY +
                Math.cos(t * 0.9) * 18 +
                Math.sin(t * 1.35) * 10,
              30,
              Math.max(30, maxVisY)
            );
          }

          pointer.vx = (goalX - pointer.x) * 0.24;
          pointer.vy = (goalY - pointer.y) * 0.24;
          pointer.x += pointer.vx;
          pointer.y += pointer.vy;
          pointer.y = clamp(pointer.y, BARRIER_TOP, barrierBottom);

          for (let idx = 0; idx < chain.length; idx++) {
            const node = chain[idx];
            const target = idx === 0 ? pointer : chain[idx - 1];
            const spring = [0.26, 0.19, 0.15, 0.12, 0.095, 0.075, 0.06][idx];
            const damping = 0.72;
            node.vx = (node.vx + (target.x - node.x) * spring) * damping;
            node.vy = (node.vy + (target.y - node.y) * spring) * damping;
            node.x += node.vx;
            node.y += node.vy;

            if (node.y > barrierBottom) {
              node.y = barrierBottom;
              node.vy = Math.min(0, node.vy * 0.2);
            }
            if (node.y < BARRIER_TOP - 20) {
              node.y = BARRIER_TOP - 20;
              node.vy = Math.max(0, node.vy * 0.2);
            }
          }
        }

        const headX = chain[0].x;
        const headY = chain[0].y;

        const distToHead = Math.hypot(
          pointer.targetX - headX,
          pointer.targetY - headY
        );
        const isActivelyHovering =
          pointer.isInsideSection &&
          smoothCursorEntry > 0.05 &&
          (idleSec < 1.2 || distToHead < 130 || Math.abs(sharedState.scrollVelocity) > 0.4);

        const targetHover = isActivelyHovering ? smoothCursorEntry : 0;
        hoverAmount +=
          (targetHover - hoverAmount) * (isActivelyHovering ? 0.2 : 0.08);
        if (hoverAmount < 0.002) hoverAmount = 0;
        sharedRippleGPU.setPage2HoverAmount(hoverAmount, "page2");

        // Continuously bridge GPU water ripples across the Page 1 -> Page 2 boundary and along the chain
        if (
          (isActivelyHovering || (rawStageY > -120 && rawStageY < 120 && Math.abs(sharedState.scrollVelocity) > 0.25)) &&
          now - lastChainWaveTime > (isScrollingFast ? 150 : 82)
        ) {
          lastChainWaveTime = now;
          const midNode = chain[Math.min(2, chain.length - 1)];
          const waveStageY = Math.max(-15, midNode.y);
          sharedRippleGPU.spawnWaveAtClient(
            docLeft + midNode.x,
            stageRectTop + waveStageY,
            idleSec < 0.25 ? 0.68 : 0.45
          );
        }

        // 水波纹下钻扩张期间，沿着扩张波前持续激发真实的 GPU 水波纹动态波环 (滚动时自适应限流)
        if (
          rippleZoom > 0.005 &&
          rippleZoom < 0.98 &&
          now - lastExpandRippleTime > (isScrollingFast ? 180 : 100)
        ) {
          lastExpandRippleTime = now;
          const waveAngle = t * 4.6;
          const waveR = easedZoom * Math.hypot(width, vpH) * 0.48;
          const centerBlend = clamp(rippleZoom * 0.75, 0, 0.75);
          const cx = headX * (1 - centerBlend) + width * 0.5 * centerBlend;
          const cy =
            headY * (1 - centerBlend) +
            (viewOffsetY + vpH * 0.5) * centerBlend;
          const spawnX = cx + Math.cos(waveAngle) * waveR * 0.45;
          const spawnY = cy + Math.sin(waveAngle) * waveR * 0.45;
          sharedRippleGPU.spawnWaveAtClient(
            docLeft + spawnX,
            stageRectTop + spawnY,
            isScrollingFast ? 0.55 : 0.45
          );
        }

        // 仅当水波纹边界已经 100% 越过视口四角、白色部分彻底消失后，切换为全屏无裁剪纯黑底
        if (rippleZoom >= 0.985) {
          if (!isFullyExpanded) {
            isFullyExpanded = true;
            liquidMaskLayer.style.clipPath = "inset(0 0 100% 0)";
            if (inkCtx) {
              inkCtx.setTransform(1, 0, 0, 1, 0, 0);
              inkCtx.clearRect(0, 0, inkCanvas.width, inkCanvas.height);
            }
          }
          return;
        }
        isFullyExpanded = false;

        for (let i = droplets.length - 1; i >= 0; i--) {
          const d = droplets[i];
          d.life += 1;
          d.x += d.vx;
          d.y += d.vy;
          d.vx *= 0.94;
          d.vy *= 0.94;

          if (d.y > barrierBottom + 25) {
            d.y = barrierBottom + 25;
            d.vy = -Math.abs(d.vy) * 0.4;
          }

          const progress = d.life / d.maxLife;
          if (progress < 0.25) {
            d.r += (d.targetR - d.r) * 0.25;
          } else {
            d.r = d.targetR * Math.max(0, 1 - (progress - 0.25) / 0.75);
          }

          if (d.life >= d.maxLife || d.r < 2) {
            droplets.splice(i, 1);
          }
        }

        const centerBlend = clamp(rippleZoom * 0.78, 0, 0.78);
        const swellCenterX =
          headX * (1 - centerBlend) + width * 0.5 * centerBlend;
        const swellCenterY =
          headY * (1 - centerBlend) +
          (viewOffsetY + vpH * 0.5) * centerBlend;
        const maxDiag = Math.hypot(width, vpH);

        // Draw soft liquid wake + ink trail on the lightweight 100vh downscaled canvas (skip heavy fills during fast scroll)
        if (inkCtx && !isScrollingFast) {
          inkCtx.save();
          inkCtx.setTransform(
            canvasScale,
            0,
            0,
            canvasScale,
            0,
            -roundedOffset * canvasScale
          );
          inkCtx.clearRect(0, roundedOffset, width, vpH);

          for (let i = inkTrail.length - 1; i >= 0; i--) {
            const node = inkTrail[i];
            node.age += 1;
            node.x += node.vx;
            node.y += node.vy;
            const p = node.age / node.maxAge;
            if (p >= 1) {
              inkTrail.splice(i, 1);
              continue;
            }

            const easeOutP = 1 - (1 - p) * (1 - p);
            const currR = node.r + (node.maxR - node.r) * easeOutP;
            const fade = (1 - p) * (1 - p) * node.intensity;

            const grad = inkCtx.createRadialGradient(
              node.x,
              node.y,
              currR * 0.1,
              node.x,
              node.y,
              currR
            );
            grad.addColorStop(
              0,
              `rgba(135, 144, 160, ${(0.18 * fade).toFixed(3)})`
            );
            grad.addColorStop(
              0.5,
              `rgba(175, 184, 198, ${(0.09 * fade).toFixed(3)})`
            );
            grad.addColorStop(1, "rgba(255, 255, 255, 0)");

            inkCtx.fillStyle = grad;
            inkCtx.beginPath();
            inkCtx.arc(node.x, node.y, currR, 0, Math.PI * 2);
            inkCtx.fill();
          }

          // Soft expanding halo during drill-down or normal chain wake
          if (easedZoom > 0.01) {
            const haloR = 160 + easedZoom * maxDiag * 1.18;
            const innerR = Math.max(10, haloR * 0.62);
            const grad = inkCtx.createRadialGradient(
              swellCenterX,
              swellCenterY,
              innerR,
              swellCenterX,
              swellCenterY,
              haloR
            );
            grad.addColorStop(0, "rgba(122, 132, 150, 0.28)");
            grad.addColorStop(0.65, "rgba(175, 184, 198, 0.12)");
            grad.addColorStop(1, "rgba(255, 255, 255, 0)");
            inkCtx.fillStyle = grad;
            inkCtx.beginPath();
            inkCtx.arc(swellCenterX, swellCenterY, haloR, 0, Math.PI * 2);
            inkCtx.fill();
          } else if (smoothCursorEntry > 0.02) {
            for (let c = chain.length - 1; c >= 0; c -= 2) {
              const node = chain[c];
              const headFactor = (1 - c / chain.length) * smoothCursorEntry;
              const outerInkR = node.baseR * (1.2 + 0.95 * smoothCursorEntry);

              const grad = inkCtx.createRadialGradient(
                node.x,
                node.y,
                node.baseR * 0.25,
                node.x,
                node.y,
                outerInkR
              );
              grad.addColorStop(
                0,
                `rgba(118, 128, 145, ${(0.24 * headFactor).toFixed(3)})`
              );
              grad.addColorStop(
                0.55,
                `rgba(168, 176, 192, ${(0.11 * headFactor).toFixed(3)})`
              );
              grad.addColorStop(1, "rgba(255, 255, 255, 0)");

              inkCtx.fillStyle = grad;
              inkCtx.beginPath();
              inkCtx.arc(node.x, node.y, outerInkR, 0, Math.PI * 2);
              inkCtx.fill();
            }
          }

          inkCtx.restore();
        }

        // Marching Squares 视口出血边界，确保水波纹放大超越屏幕四角时边缘始终保持真实液态水波弧度
        const PAD = Math.max(200, Math.round(maxDiag * 0.22));
        const minX = -PAD;
        const minY = viewOffsetY - PAD;
        const spanW = width + PAD * 2;
        const spanH = vpH + PAD * 2;
        const cellW = spanW / COLS;
        const cellH = spanH / ROWS;

        const swellRadius = easedZoom * maxDiag * 1.34;
        const effectiveEntry = Math.max(smoothCursorEntry, easedZoom);
        const chainScale = effectiveEntry * (1 + easedZoom * 15.5);
        const activeChainCount =
          effectiveEntry < 0.01 ? 0 : easedZoom > 0.3 ? 2 : chain.length;

        const reachMargin = 175 * Math.max(0.5, chainScale) + swellRadius * 1.35;
        let boxMinX = Math.min(
          headX - 175 * Math.max(0.5, chainScale),
          swellCenterX - reachMargin
        );
        let boxMaxX = Math.max(
          headX + 175 * Math.max(0.5, chainScale),
          swellCenterX + reachMargin
        );
        let boxMinY = Math.min(
          headY - 175 * Math.max(0.5, chainScale),
          swellCenterY - reachMargin
        );
        let boxMaxY = Math.max(
          headY + 175 * Math.max(0.5, chainScale),
          swellCenterY + reachMargin
        );

        for (let c = 1; c < activeChainCount; c++) {
          const n = chain[c];
          const rBound = 125 * chainScale;
          if (n.x - rBound < boxMinX) boxMinX = n.x - rBound;
          if (n.x + rBound > boxMaxX) boxMaxX = n.x + rBound;
          if (n.y - rBound < boxMinY) boxMinY = n.y - rBound;
          if (n.y + rBound > boxMaxY) boxMaxY = n.y + rBound;
        }
        for (let d = 0; d < droplets.length; d++) {
          const drop = droplets[d];
          if (drop.x - 90 < boxMinX) boxMinX = drop.x - 90;
          if (drop.x + 90 > boxMaxX) boxMaxX = drop.x + 90;
          if (drop.y - 90 < boxMinY) boxMinY = drop.y - 90;
          if (drop.y + 90 > boxMaxY) boxMaxY = drop.y + 90;
        }

        // Precompute 1D spatial harmonic waves outside the 2D loop (eliminates 50,000+ trig calls/frame)
        for (let gx = 0; gx <= COLS; gx++) {
          const rx = minX + gx * cellW;
          xWave1[gx] = Math.sin(rx * 0.014 + t * 3.2);
          xWave2[gx] = Math.cos(rx * 0.024 - t * 2.5);
        }
        for (let gy = 0; gy <= ROWS; gy++) {
          const ry = minY + gy * cellH;
          yWave1[gy] = Math.cos(ry * 0.014 - t * 2.8);
          yWave2[gy] = Math.sin(ry * 0.024 + t * 3.4);
        }

        field.fill(0);
        const coreSkipR2 =
          swellRadius > 140 ? swellRadius * 0.64 * (swellRadius * 0.64) : 0;
        const harmonicAmp = 1 - rippleZoom * 0.35;

        // Cursor boundary wave bridge when crossing between Page 1 and Page 2 (-130 <= rawStageY <= 140)
        const boundaryProximity = clamp(1 - Math.abs(rawStageY) / 135, 0, 1);

        for (let gy = 1; gy < ROWS; gy++) {
          const rawY = minY + gy * cellH;
          const isTopMeniscusBand = rawY < 115;
          const inYBox = rawY >= boxMinY && rawY <= boxMaxY;
          if (!isTopMeniscusBand && !inYBox) continue;

          const yw1 = yWave1[gy];
          const yw2 = yWave2[gy];
          const rowOffset = gy * (COLS + 1);

          for (let gx = 1; gx < COLS; gx++) {
            const rawX = minX + gx * cellW;
            const inXBox = rawX >= boxMinX && rawX <= boxMaxX;
            if (!isTopMeniscusBand && !inXBox) continue;

            // Fast interior core skip during drill-down expansion
            if (coreSkipR2 > 0) {
              const cdx = rawX - swellCenterX;
              const cdy = rawY - swellCenterY;
              if (cdx * cdx + cdy * cdy < coreSkipR2) {
                field[rowOffset + gx] = 2.5;
                continue;
              }
            }

            const disp = sampleDisplacement(
              docLeft + rawX,
              stageRectTop + rawY
            );

            const px = rawX + disp.pushX * 0.78;
            const py = rawY + disp.pushY * 0.78;

            // Amplify GPU water-ripple envelope near the top boundary so Page 1 waves flow directly into Page 2's liquid mask
            const topBoost = py < 120 ? 1.38 : 0.98;
            let sum = (disp.envelope * 1.05 + disp.amount * 0.48) * topBoost;

            // 在第二页顶部与第一页交界处（py < 110）构建连续水波纹交界，随鼠标从首页滑入产生自然液态波峰衔接
            if (py < 110) {
              const scrollSwell =
                (1 - Math.min(1, sharedState.transitionProgress * 1.25)) * 12;
              const dxPtr = px - pointer.x;
              const cursorBridgeSwell =
                boundaryProximity > 0
                  ? boundaryProximity * 26 * Math.exp(-(dxPtr * dxPtr) / (155 * 155))
                  : 0;
              const waveTopY =
                10 +
                scrollSwell +
                cursorBridgeSwell +
                6 * xWave1[gx] +
                4 * xWave2[gx];
              if (py < waveTopY + 72) {
                const distFromTop = Math.max(1, py - (waveTopY - 28));
                sum += (35 * 35) / (distFromTop * distFromTop + 115);
              }
            }

            if (inXBox && inYBox) {
              const waveHarmonic =
                0.18 * (xWave1[gx] * yw1) + 0.12 * (xWave2[gx] * yw2);

              if (swellRadius > 2) {
                const sdx = px - swellCenterX;
                const sdy = py - swellCenterY;
                const sd2 = sdx * sdx + sdy * sdy + 110;
                const rSwellEff =
                  swellRadius * (1 + harmonicAmp * waveHarmonic);
                sum += (rSwellEff * rSwellEff) / sd2;
              }

              const chainWaveMod = 1 + waveHarmonic;
              for (let c = 0; c < activeChainCount; c++) {
                const node = chain[c];
                const dx = px - node.x;
                const dy = py - node.y;
                const d2 = dx * dx + dy * dy + 90;
                const trailWeight = 1 - c * 0.09;
                const rEff =
                  node.baseR * chainWaveMod * trailWeight * chainScale;
                sum += (rEff * rEff) / d2;
              }

              for (let d = 0; d < droplets.length; d++) {
                const drop = droplets[d];
                const dx = px - drop.x;
                const dy = py - drop.y;
                const d2 = dx * dx + dy * dy + 60;
                const dropR = drop.r * (1 + easedZoom * 6.5);
                sum += (dropR * dropR) / d2;
              }
            }

            field[rowOffset + gx] = sum;
          }
        }

        if (isScrollingFast) {
          frameSkip = (frameSkip + 1) % 2;
          if (frameSkip !== 0) return;
        }

        const maskPath = buildMetaballPath(
          field,
          COLS,
          ROWS,
          minX,
          minY,
          cellW,
          cellH,
          1.08
        );

        liquidMaskLayer.style.clipPath = maskPath
          ? `path(evenodd, 'M 0 0 H ${width.toFixed(1)} V ${stageHeight.toFixed(1)} H 0 Z ${maskPath}')`
          : "inset(0)";
      }
      );
    };

    const activeObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !unsubscribe) {
          window.addEventListener("pointermove", onPointerMove, { passive: true });
          subscribeToFrames();
        } else if (!entry.isIntersecting && unsubscribe) {
          unsubscribe();
          unsubscribe = null;
          window.removeEventListener("pointermove", onPointerMove);
          sharedRippleGPU.setPage2HoverAmount(0, "page2");
        }
      },
      { rootMargin: "80px 0px" }
    );
    activeObserver.observe(runway);

    return () => {
      sharedRippleGPU.clearMaskZone("page2");
      activeObserver.disconnect();
      unsubscribe?.();
      ro.disconnect();
      window.removeEventListener("resize", measureSection);
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, []);

  const renderEditorialLayout = (isUpperMaskedLayer: boolean) => {
    const mainText = isUpperMaskedLayer ? "text-white" : "text-[#0B0C0E]";
    const subText = isUpperMaskedLayer ? "text-white/90" : "text-[#0B0C0E]";
    const watermark = isUpperMaskedLayer
      ? "text-white/20"
      : "text-black/[0.08]";
    const targetRefArray = isUpperMaskedLayer
      ? upperTokensRef.current
      : lowerTokensRef.current;

    return (
      <div className="relative w-full h-full flex flex-col justify-between px-6 sm:px-12 md:px-16 lg:px-20 pt-[14vh] pb-[6vh] select-none font-sans">
        {/* 水波纹波峰依次上浮文本流（零 React 渲染开销，随鼠标滚轮实时同步波峰上浮） */}
        <div
          ref={isUpperMaskedLayer ? upperTextWrapRef : undefined}
          className="relative z-10 w-full flex-1 flex flex-col justify-start transition-opacity duration-75"
        >
          {/* 左侧保留轻量引文，右侧以大字展开主宣言。 */}
          <div className="relative w-full grid grid-cols-1 md:grid-cols-[minmax(0,34fr)_minmax(0,66fr)] gap-8 md:gap-0 items-start pt-2 md:pt-4">
            {/* 左侧主题与短句，垂直落在主标题中段。 */}
            <div className="min-w-0 flex max-w-full flex-col justify-start pr-0 md:ml-auto md:max-w-[clamp(17rem,28vw,22rem)] md:items-end md:pt-[16vh] md:pr-8 md:text-right lg:pr-10">
              <div
                className="mb-4 flex items-center gap-2 font-sans text-[9px] font-semibold uppercase tracking-[0.2em] select-none sm:text-[10px]"
              >
                <span>01 / PERSONAL SIGNAL</span>
                <span className="h-px w-8 bg-current opacity-30" />
              </div>

              <p
                className={`text-sm sm:text-base md:text-base lg:text-lg font-bold tracking-[0.025em] leading-[2.08] ${pageTwoHoverLift} ${subText} ${editorialFont.className}`}
              >
                {SUBTEXT_TOKENS.map((token, idx) => {
                  const globalIdx =
                    HEADLINE_TOKENS.length + SUPPORT_TOKENS.length + idx;
                  return (
                    <span
                      key={`ss-${idx}`}
                      ref={(el) => {
                        targetRefArray[globalIdx] = el;
                      }}
                      style={{
                        display: "block",
                        opacity: 0,
                        transform: "translate3d(0, 42px, 0) scale(0.92)",
                        willChange: "transform, opacity",
                      }}
                    >
                      {token}
                    </span>
                  );
                })}
              </p>
            </div>

            {/* 中置细线界定左右两种字级，随滚动淡出。 */}
            <div
              ref={isUpperMaskedLayer ? upperDividerRef : lowerDividerRef}
              className="hidden md:flex flex-col items-center justify-between absolute top-[-14vh] bottom-[-27vh] left-[34%] -translate-x-1/2 w-[1px] pointer-events-none will-change-[opacity]"
              style={{
                background: isUpperMaskedLayer
                  ? "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.45) 12%, rgba(255,255,255,0.3) 85%, rgba(255,255,255,0) 100%)"
                  : "linear-gradient(180deg, rgba(11,12,14,0) 0%, rgba(11,12,14,0.32) 12%, rgba(11,12,14,0.2) 85%, rgba(11,12,14,0) 100%)",
                transition: "opacity 0.15s ease-out",
              }}
            >
              <span
                className={`text-[9px] tracking-widest my-auto select-none ${
                  isUpperMaskedLayer ? "text-white/40" : "text-black/30"
                }`}
              >
                ◇
              </span>
            </div>

            {/* 右侧主宣言，使用参考页的超大字级与紧行距。 */}
            <div className="min-w-0 flex flex-col justify-start pl-0 md:min-h-[76vh] md:justify-between md:pl-7 lg:pl-8">
              <div
                className={`mb-4 flex items-center gap-2 font-sans text-[9px] font-semibold uppercase tracking-[0.2em] select-none sm:text-[10px] ${
                  isUpperMaskedLayer ? "text-white/45" : "text-black/40"
                }`}
              >
                <span>SIGNAL / CHOICE</span>
                <span className="w-8 h-[1px] bg-current opacity-30" />
              </div>

              <p
                className={`flex flex-col gap-1 text-2xl sm:gap-2 sm:text-3xl md:text-[clamp(2rem,4.75vw,7rem)] font-bold tracking-[-0.035em] leading-[1.18] ${pageTwoHoverLift} ${mainText} ${editorialFont.className}`}
              >
                {HEADLINE_TOKENS.map((token, idx) => (
                  <span
                    key={`h-${idx}`}
                    className="block md:whitespace-nowrap"
                    ref={(el) => {
                      targetRefArray[idx] = el;
                    }}
                    style={{
                      display: "block",
                      opacity: 0,
                      transform: "translate3d(0, 42px, 0) scale(0.92)",
                      willChange: "transform, opacity",
                    }}
                  >
                    {token}
                  </span>
                ))}
              </p>

              <p
                className={`mt-8 flex flex-col gap-5 md:mt-0 text-sm sm:text-base md:text-[clamp(1.5rem,2.2vw,3rem)] font-bold tracking-[0.015em] leading-[2.02] ${pageTwoHoverLift} ${subText} ${editorialFont.className}`}
              >
                {SUPPORT_TOKENS.map((token, idx) => {
                  const globalIdx = HEADLINE_TOKENS.length + idx;
                  return (
                    <span
                      key={`s-${idx}`}
                      ref={(el) => {
                        targetRefArray[globalIdx] = el;
                      }}
                      style={{
                        display: "block",
                        opacity: 0,
                        transform: "translate3d(0, 42px, 0) scale(0.92)",
                        willChange: "transform, opacity",
                      }}
                    >
                      {token}
                    </span>
                  );
                })}
              </p>
            </div>
          </div>
        </div>

        {!isUpperMaskedLayer && (
          <div className="pointer-events-none absolute left-6 right-6 top-[104vh] grid grid-cols-1 items-start gap-8 sm:left-12 sm:right-12 md:left-16 md:right-16 md:grid-cols-[minmax(0,34fr)_minmax(0,66fr)] md:gap-0 lg:left-20 lg:right-20">
            <div className="min-w-0 md:ml-auto md:flex md:min-h-[76vh] md:max-w-[clamp(17rem,28vw,22rem)] md:flex-col md:items-end md:justify-between md:pt-10 md:pr-8 md:text-right lg:pr-10">
              <div>
                <div className="mb-4 flex items-center gap-2 font-sans text-[9px] font-semibold uppercase tracking-[0.2em] text-black/40 sm:text-[10px]">
                  <span>02 / DISCOVERY</span>
                  <span className="h-px w-8 bg-current opacity-30" />
                </div>
                <p className={`text-sm font-bold leading-[2] tracking-[0.025em] text-[#0B0C0E] sm:text-base lg:text-lg ${editorialFont.className}`}>
                  从喜欢出发
                </p>
              </div>
              <p className="mt-8 font-sans text-[9px] font-semibold uppercase tracking-[0.2em] text-black/40 sm:text-[10px]">
                CURATED FOR YOU
              </p>
            </div>

            <div className="relative min-w-0 pl-0 md:flex md:min-h-[76vh] md:flex-col md:justify-between md:pl-7 lg:pl-8">
              <div>
                <div className="mb-4 flex items-center gap-2 font-sans text-[9px] font-semibold uppercase tracking-[0.2em] text-black/40 sm:text-[10px]">
                  <span>CONNECTION / DIRECTION</span>
                  <span className="h-px w-8 bg-current opacity-30" />
                </div>
                <p className={`text-2xl font-bold leading-[1.18] tracking-[-0.035em] text-[#0B0C0E] sm:text-3xl md:text-[clamp(2rem,3.5vw,4.5rem)] ${editorialFont.className}`}>
                  让喜欢相互连接
                  <br />
                  让发现持续发生
                </p>
              </div>
              <p className="mt-8 font-sans text-[9px] font-semibold uppercase tracking-[0.2em] text-black/40 sm:text-[10px] md:mt-0">
                YOUR TASTE, IN MOTION
              </p>
              <span aria-hidden="true" className="absolute -top-[20vh] -bottom-[12vh] left-[calc(-1.75rem-1px)] hidden w-px bg-black/20 md:block lg:left-[calc(-2rem-1px)]" />
            </div>
          </div>
        )}

        {/* 在遮罩消失变成黑屏的第三页，写着 bleibtgleich 的页面插入 FlexCarousel 3D 液态轮播：
            横跨 100vw 左右不留空隙，随变黑过程渐进出现并等比例放大 */}
        {isUpperMaskedLayer ? (
          <div
            ref={carouselWrapRef}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: "104vh",
              width: "100vw",
              height: "84vh",
              opacity: 0,
              transform: "translate3d(0, 32px, 0)",
              touchAction: "pan-y",
            }}
            className="pointer-events-auto z-30 will-change-transform"
          >
            {isCarouselNearViewport && <FlexCarousel
              items={flexCarouselItems}
              preset="liquid"
              intro="none"
              cardHeight={0.62}
              gap={16}
              squeeze={0.2}
              focusOnClick
              captions
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
            />}
          </div>
        ) : (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: "104vh",
              width: "100vw",
              height: "84vh",
            }}
            className="invisible pointer-events-none"
            aria-hidden="true"
          />
        )}

        {/* 第三页底部元数据与水印（无顶部分割线，确保向倒数第二页 fade 过渡时完全无缝） */}
        <div className="relative z-10 flex items-end justify-between pt-4">
          <div
            className={`text-xs font-mono uppercase tracking-widest ${subText}`}
          >
            SCROLL_SCRUB: WORDS // FADE_BLUR
          </div>
          <div
            className={`text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-[-0.04em] leading-none pointer-events-none select-none ${watermark}`}
          >
            bleibtgleich
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
      className="relative w-full h-[270vh] select-none will-change-[background-color]"
    >
      {/* 非 sticky 的参考标尺：供 ScrollReveal 在滚动至第三页锁定期前完整显影所有延伸文字 */}
      <div
        ref={scrollTriggerRulerRef}
        aria-hidden="true"
        className="pointer-events-none absolute top-[14vh] left-0 w-full h-[148vh]"
      />

      {/* 200vh 连续双页舞台（0-100vh 为第二页，100-200vh 为第三页）：
          采用原生 CSS sticky top-[-100vh] 由浏览器合成器线程驱动：
          1. 前 100vh 行程原生平滑滚动从第二页进入第三页（零主线程 transform 抖动）
          2. 滚至第三页（top 抵达 -100vh）后原生锁定在屏幕内，直至水波纹下钻完全吞没白色区域后再滚入下方页面 */}
      <div
        ref={stageRef}
        className="sticky top-[-100vh] left-0 w-full h-[200vh] bg-black overflow-hidden select-none cursor-crosshair"
      >
        {/* 纯黑底层承载画廊，白色前景通过液态开口露出图片。 */}
        <div
          id="page3-black-scene"
          className="absolute inset-0 w-full h-full bg-black z-0"
        >
          <canvas
            ref={inkCanvasRef}
            className="hidden"
          />

        {/* 图片只存在于黑色底层。 */}
        <div
          id="page2-orbit-gallery"
          ref={galleryWrapRef}
          className="absolute left-[-20vw] top-[-12vh] h-[118vh] w-[140vw] z-[9] will-change-transform md:top-[-20vh] md:h-[140vh]"
          style={{
            pointerEvents: "auto",
            opacity: 0.85,
            WebkitMaskImage:
              "linear-gradient(180deg, rgba(0,0,0,0) 0%, #000000 9%, #000000 100%)",
            maskImage:
              "linear-gradient(180deg, rgba(0,0,0,0) 0%, #000000 9%, #000000 100%)",
          }}
        >
          {isGalleryNearViewport && <OrbitImages
            images={galleryImages}
            shape="ellipse"
            radiusX={520}
            radiusY={260}
            rotation={45}
            duration={32}
            itemSize={270}
            itemWidth={270}
            itemHeight={175}
            depth={0.75}
            hoverScale={1.18}
            hoverSpeed={0.3}
            showPath={false}
            direction="normal"
            easing="easeOut"
            fill
            alignToPath={false}
            draggable
            clickToFront={false}
            paused={false}
            intro
            height="100%"
            itemRadius={0}
            shadow={0}
            className="w-full h-full opacity-90"
          />}
        </div>

          <div
            id="page3-upper-editorial"
            className="absolute inset-0 w-full h-full z-10 pointer-events-none will-change-[opacity]"
          >
            {renderEditorialLayout(true)}
          </div>
        </div>

        {/* 白色前景盖住底层；黑色文字随白色表面一起裁切。 */}
        <div
          id="page3-liquid-mask-layer"
          ref={liquidMaskLayerRef}
          className="absolute inset-0 w-full h-full bg-white z-20 will-change-[clip-path]"
        >
          {renderEditorialLayout(false)}
        </div>
      </div>
    </section>
  );
}

export default BleibtGooeySection;

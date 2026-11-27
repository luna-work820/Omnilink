import React, { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { LoginForm } from "@/components/login-package/components/login-form";
import { SignupForm } from "@/components/login-package/components/SignupForm";
import TextCursor from "@/components/login-package/components/TextCursor";
import WarpText from "@/components/login-package/components/WarpText";

export const Skiper30 = ({ redirectTo }: { redirectTo?: string }) => {
  const sectionRef = useRef<HTMLElement>(null);
  const barrageContainerRef = useRef<HTMLDivElement>(null);
  const titleCardButtonRef = useRef<HTMLButtonElement>(null);
  const backFaceRef = useRef<HTMLDivElement>(null);

  // 翻转状态：false = 背面（OMNILINK 水波纹文字），true = 正面（登录/注册卡片）
  const [isFlipped, setIsFlipped] = useState(false);
  // 用户是否手动点击翻转（若手动点击，则临时锁定，滚动出范围后重置）
  const userInteractedRef = useRef(false);

  // 登录/注册卡片内模式切换 ('login' | 'signup')
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  // 黑白渐变进度 (0 = #000000, 1 = #FFFFFF)
  const [fadeProgress, setFadeProgress] = useState(0);
  // 卡片上浮进度 (0 -> 1)
  const [floatProgress, setFloatProgress] = useState(0);
  // 弹幕容器懒渲染状态 (通过 Intersection Observer 控制，初始延迟挂载)
  const [isBarrageVisible, setIsBarrageVisible] = useState(false);

  // 鼠标视差与倾斜互动状态
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isCardHovered, setIsCardHovered] = useState(false);
  const prefersReducedMotion = useReducedMotion() ?? false;

  useEffect(() => {
    if (isFlipped && document.activeElement === titleCardButtonRef.current) {
      document.querySelector<HTMLInputElement>("#gallery-parallax input:not([disabled])")?.focus({ preventScroll: true });
    } else if (
      !isFlipped &&
      backFaceRef.current?.contains(document.activeElement)
    ) {
      titleCardButtonRef.current?.focus({ preventScroll: true });
    }
  }, [isFlipped]);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (prefersReducedMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: -ny * 7, y: nx * 7 });
  };

  const handlePointerLeave = () => {
    setIsCardHovered(false);
    setTilt({ x: 0, y: 0 });
  };

  useEffect(() => {
    let rafId = 0;
    const el = sectionRef.current;
    if (!el) return;

    // 使用 Intersection Observer 监听末尾页区域，临近或进入视口时挂载弹幕组件
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsBarrageVisible(entry.isIntersecting);
      },
      {
        root: null,
        rootMargin: "300px 0px 300px 0px",
        threshold: 0,
      }
    );
    observer.observe(el);

    let lastFadeVal = -1;
    let lastFloatVal = -1;

    const updateScroll = () => {
      rafId = 0;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 800;

      // 1. 黑白渐变背景自然平滑过渡 (#000000 -> #FFFFFF)
      const fadeStart = vh * 0.95;
      const fadeEnd = vh * 0.18;
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

      // 若向上滚动使末页退回至视口下方，立即平滑彻底还原上一页与自身的纯黑底色与文字不透明度
      if (rect.top >= fadeStart) {
        if (lastFadeVal !== 0 || lastFloatVal !== 0) {
          lastFadeVal = 0;
          lastFloatVal = 0;
          el.style.backgroundColor = "#000000";
          const page3Runway = document.getElementById("product-entropy");
          if (page3Runway) {
            page3Runway.style.backgroundColor = "#000000";
          }
          const page3MaskLayer = document.getElementById("page3-liquid-mask-layer");
          if (page3MaskLayer) {
            page3MaskLayer.style.backgroundColor = "#000000";
          }
          const page3UpperEditorial = document.getElementById(
            "page3-upper-editorial"
          );
          if (page3UpperEditorial) {
            page3UpperEditorial.style.opacity = "";
          }
          setFadeProgress(0);
          setFloatProgress(0);
          userInteractedRef.current = false;
          setIsFlipped(false);
        }
        return;
      }

      const rawFade = (fadeStart - rect.top) / Math.max(1, fadeStart - fadeEnd);
      const clampedFade = Math.max(0, Math.min(1, rawFade));
      const easedFade = reduceMotion
        ? Number(clampedFade >= 0.5)
        : clampedFade < 0.5
          ? 2 * clampedFade * clampedFade
          : 1 - Math.pow(-2 * clampedFade + 2, 2) / 2;

      if (Math.abs(easedFade - lastFadeVal) > 0.005) {
        lastFadeVal = easedFade;
        setFadeProgress(easedFade);
      }

      const gray = Math.round(easedFade * 255);
      const bgColor = `rgb(${gray}, ${gray}, ${gray})`;
      el.style.backgroundColor = bgColor;

      // 同步上一页底部跑道与液态遮罩，确保无缝平滑呼吸过渡
      const page3Runway = document.getElementById("product-entropy");
      if (page3Runway) {
        page3Runway.style.backgroundColor = bgColor;
      }
      const page3MaskLayer = document.getElementById("page3-liquid-mask-layer");
      if (page3MaskLayer) {
        page3MaskLayer.style.backgroundColor = bgColor;
      }
      const page3UpperEditorial = document.getElementById(
        "page3-upper-editorial"
      );
      if (page3UpperEditorial) {
        page3UpperEditorial.style.opacity = String(
          Math.max(0, Math.min(1, 1 - easedFade * 1.15))
        );
      }

      // 2. 卡片平滑上浮迅速居中就位
      const floatStart = vh * 0.92;
      const floatEnd = vh * 0.12;
      const rawFloat = (floatStart - rect.top) / Math.max(1, floatStart - floatEnd);
      const clampedFloat = Math.max(0, Math.min(1, rawFloat));
      const easedFloat = reduceMotion ? Number(clampedFloat >= 0.5) : 1 - Math.pow(1 - clampedFloat, 3);
      if (Math.abs(easedFloat - lastFloatVal) > 0.005) {
        lastFloatVal = easedFloat;
        setFloatProgress(easedFloat);
      }

      // 3. 翻转时机控制
      const totalSticky = Math.max(1, el.scrollHeight - vh);
      const pinnedScroll = Math.max(0, -rect.top);
      const pinnedProgress = Math.min(1, pinnedScroll / totalSticky);

      // 若回滚到视口较上方，重置手动交互标记
      if (rect.top > vh * 0.3) {
        userInteractedRef.current = false;
        setIsFlipped(false);
      } else if (!userInteractedRef.current) {
        // 轻微滚动或抵达视口居中即自动翻转为登录/注册卡片
        if (pinnedProgress >= 0.16 || rect.top <= vh * 0.08) {
          setIsFlipped(true);
        } else if (pinnedProgress < 0.06 && rect.top > vh * 0.18) {
          setIsFlipped(false);
        }
      }
    };

    const onScroll = () => {
      if (!rafId) {
        rafId = window.requestAnimationFrame(updateScroll);
      }
    };

    const onOpenFinalLogin = () => {
      userInteractedRef.current = true;
      setAuthMode("login");
      setIsFlipped(true);
      if (!rafId) {
        rafId = window.requestAnimationFrame(updateScroll);
      }
    };

    updateScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    window.addEventListener("omnilink:open-final-login", onOpenFinalLogin);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("omnilink:open-final-login", onOpenFinalLogin);
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, []);

  // 上浮动效参数与视差位移
  const entryTranslateY = (1 - floatProgress) * 45;
  const entryScale = 0.95 + floatProgress * 0.05;
  const cardOpacity = Math.max(0.4, Math.min(1, 0.4 + floatProgress * 0.6));
  const warpTextColor = fadeProgress > 0.45 ? "#0B0C0E" : "#F8FAFC";

  return (
    <section
      id="gallery-parallax"
      ref={sectionRef}
      style={{
        backgroundColor: "#000000",
        willChange: "background-color",
      }}
      className="relative w-full min-h-[165vh] text-[#0B0C0E] select-none"
    >
      {/* 末页固定视口舞台容器 */}
      <div className="sticky top-0 left-0 w-full h-screen overflow-hidden flex items-center justify-center px-4 sm:px-6">
        {/* 1. 弹幕容器 */}
        <div
          ref={barrageContainerRef}
          aria-hidden="true"
          className="absolute inset-0 z-0 overflow-hidden pointer-events-auto"
          style={{
            height: "100%",
            position: "absolute",
            willChange: "transform, opacity",
            transform: "translateZ(0)",
          }}
        >
          {isBarrageVisible && !prefersReducedMotion && (
            <TextCursor
              text="Hello"
              mode="ribbon"
              fontSize="36px"
              spacing={85}
              maxPoints={8}
              shrink={0.5}
              fade={0.65}
              smoothing={0.3}
              exitDuration={0.55}
              removalInterval={28}
              followMouseDirection
              keepUpright
              randomFloat
              popIn
              hideCursor={false}
              color="rgba(49, 91, 255, 0.38)"
            />
          )}
        </div>

        {/* 2. 居中视差与悬停缩放卡片舞台 */}
      <div
          onPointerEnter={() => !prefersReducedMotion && setIsCardHovered(true)}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          style={{
            perspective: "1800px",
            opacity: cardOpacity,
            transform: `translate3d(0, ${entryTranslateY}px, 0) scale(${entryScale * (isCardHovered ? 1.025 : 1)}) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
            transition: prefersReducedMotion ? "none" : "transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease",
            willChange: "transform, opacity",
          }}
          className="relative z-10 w-full max-w-[460px]"
        >
          {/* 上下 3D 翻转主体容器 */}
          <div
            style={{
              transformStyle: "preserve-3d",
              transform: `rotateX(${isFlipped ? 180 : 0}deg)`,
              transition: prefersReducedMotion ? "none" : "transform 0.85s cubic-bezier(0.22, 1, 0.36, 1)",
              willChange: "transform",
            }}
            className={`relative w-full ${isFlipped && authMode === "signup" ? "h-[520px]" : "h-[419px]"}`}
          >
            {/* ── 阶段 1：正面：水波纹浮动文字 OMNILINK ── */}
            <button
              type="button"
              data-liquid-skip="true"
              ref={titleCardButtonRef}
              onClick={() => {
                userInteractedRef.current = true;
                setIsFlipped(true);
              }}
              aria-label="打开登录与注册表单"
              style={{
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                transform: "rotateX(0deg)",
                filter: isFlipped ? "blur(14px)" : "blur(0px)",
                opacity: isFlipped ? 0 : 1,
                pointerEvents: isFlipped ? "none" : "auto",
                transition: prefersReducedMotion
                  ? "none"
                  : "filter 0.65s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.55s ease, transform 0.85s cubic-bezier(0.22, 1, 0.36, 1)",
                outlineColor: fadeProgress < 0.45 ? "#FFFFFF" : "#315BFF",
              }}
              className="relative w-full h-full flex flex-col items-center justify-center cursor-pointer select-none group appearance-none border-0 bg-transparent p-0 text-inherit focus-visible:outline-2 focus-visible:outline-offset-4"
              title="点击翻转至会员登录 / 注册卡片"
              aria-hidden={isFlipped}
              tabIndex={isFlipped ? -1 : 0}
              inert={isFlipped}
            >
              <div
                style={{ willChange: "transform, opacity" }}
                className="w-full h-full relative flex items-center justify-center pointer-events-auto"
              >
                <WarpText
                  key={warpTextColor}
                  text="OMNILINK"
                  color={warpTextColor}
                  fontSize="clamp(3.5rem, 8vw, 5.2rem)"
                  fontWeight={900}
                  letterSpacing="-0.03em"
                  lens="bulge"
                  warpStrength={0.08}
                  warpScale={1.7}
                  speed={0.55}
                  pointerInfluence={0.42}
                  pointerStrength={0.38}
                  refraction={0.016}
                  chromatic={0}
                  ripple={true}
                  clickRipple={true}
                  idleDrift={0.25}
                  className="w-full h-full min-h-[360px]"
                />
              </div>

              {/* 翻转交互提示条 */}
              <div
                style={{ willChange: "transform, opacity" }}
                className="absolute bottom-6 flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-black/10 bg-white/70 backdrop-blur-md text-xs font-mono text-neutral-600 shadow-sm opacity-80 group-hover:opacity-100 transition-opacity"
              >
                <span>点击卡片或滚动翻转至通行凭证</span>
              </div>
            </button>

            {/* ── 阶段 2：背面：玻璃质感登录/注册卡片 ── */}
            <div
              ref={backFaceRef}
              style={{
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                transform: "rotateX(180deg)",
                filter: isFlipped ? "blur(0px)" : "blur(16px)",
                opacity: isFlipped ? 1 : 0,
                pointerEvents: isFlipped ? "auto" : "none",
                transition: prefersReducedMotion
                  ? "none"
                  : "filter 0.75s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.65s ease, transform 0.85s cubic-bezier(0.22, 1, 0.36, 1)",
                willChange: "transform, opacity",
              }}
              className="absolute inset-0 w-full h-full rounded-[28px] bg-white/85 dark:bg-black/75 backdrop-blur-2xl border border-white/60 dark:border-white/20 shadow-[0_30px_90px_rgba(0,0,0,0.15),0_0_0_1px_rgba(255,255,255,0.4)] p-8 sm:p-9 flex flex-col justify-between overflow-y-auto"
              aria-hidden={!isFlipped}
              inert={!isFlipped}
            >
              {/* 卡片主体：同时支持登录与注册完整双模态交互 */}
              <div
                style={{ willChange: "transform, opacity" }}
                className="w-full flex flex-col"
              >
                {authMode === "login" ? (
                  <LoginForm
                    variant="light"
                    className="w-full flex flex-col"
                    hideTitle={false}
                    onSwitchToSignup={() => setAuthMode("signup")}
                    redirectTo={redirectTo}
                  idPrefix="final-login"
                  />
                ) : (
                  <SignupForm
                    variant="light"
                    className="w-full flex flex-col"
                    hideTitle={false}
                    onSwitchToLogin={() => setAuthMode("login")}
                    redirectTo={redirectTo}
                  idPrefix="final-signup"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Skiper30;

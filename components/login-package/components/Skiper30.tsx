import React, { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { RotateCcw } from "lucide-react";
import { LoginForm } from "@/components/login-package/components/login-form";
import { SignupForm } from "@/components/login-package/components/SignupForm";

const TextCursor = dynamic(
  () => import("@/components/login-package/components/TextCursor"),
  { ssr: false }
);
const WarpText = dynamic(
  () => import("@/components/login-package/components/WarpText"),
  { ssr: false }
);

export const Skiper30 = ({ redirectTo }: { redirectTo?: string }) => {
  const sectionRef = useRef<HTMLElement>(null);
  const barrageContainerRef = useRef<HTMLDivElement>(null);
  const cardStageRef = useRef<HTMLDivElement>(null);
  const lightBackgroundRef = useRef(false);

  // 翻转状态：false = 背面（OMNILINK 水波纹文字），true = 正面（登录/注册卡片）
  const [isFlipped, setIsFlipped] = useState(false);
  // 用户是否手动点击翻转（若手动点击，则临时锁定，滚动出范围后重置）
  const userInteractedRef = useRef(false);

  // 登录/注册卡片内模式切换 ('login' | 'signup')
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  // 黑白渐变进度 (0 = #000000, 1 = #FFFFFF)
  const [isLightBackground, setIsLightBackground] = useState(false);
  // 弹幕容器懒渲染状态 (通过 Intersection Observer 控制)
  const [isBarrageVisible, setIsBarrageVisible] = useState(false);

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

    const updateScroll = () => {
      rafId = 0;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 800;

      // 1. 黑白渐变背景自然平滑过渡 (#000000 -> #FFFFFF)
      const fadeStart = vh * 0.95;
      const fadeEnd = vh * 0.18;

      // 若向上滚动使末页退回至视口下方，立即平滑彻底还原上一页与自身的纯黑底色与文字不透明度
      if (rect.top >= fadeStart) {
        el.style.backgroundColor = "#000000";
        const page3Runway = document.getElementById("product-entropy");
        if (page3Runway) {
          page3Runway.style.backgroundColor = "#000000";
        }
        const page3BlackScene = document.getElementById("page3-black-scene");
        if (page3BlackScene) {
          page3BlackScene.style.backgroundColor = "#000000";
        }
        const page3UpperEditorial = document.getElementById(
          "page3-upper-editorial"
        );
        if (page3UpperEditorial) {
          page3UpperEditorial.style.opacity = "";
        }
        if (cardStageRef.current) {
          cardStageRef.current.style.opacity = "0.4";
          cardStageRef.current.style.transform =
            "translate3d(0, 45px, 0) scale(0.95)";
        }
        if (lightBackgroundRef.current) {
          lightBackgroundRef.current = false;
          setIsLightBackground(false);
        }
        userInteractedRef.current = false;
        setIsFlipped(false);
        return;
      }

      const rawFade = (fadeStart - rect.top) / Math.max(1, fadeStart - fadeEnd);
      const clampedFade = Math.max(0, Math.min(1, rawFade));
      const easedFade =
        clampedFade < 0.5
          ? 2 * clampedFade * clampedFade
          : 1 - Math.pow(-2 * clampedFade + 2, 2) / 2;

      const nextIsLightBackground = easedFade > 0.45;
      if (lightBackgroundRef.current !== nextIsLightBackground) {
        lightBackgroundRef.current = nextIsLightBackground;
        setIsLightBackground(nextIsLightBackground);
      }

      const gray = Math.round(easedFade * 255);
      const bgColor = `rgb(${gray}, ${gray}, ${gray})`;
      el.style.backgroundColor = bgColor;

      // 同步上一页底部跑道与黑色底层，确保背景过渡连续
      const page3Runway = document.getElementById("product-entropy");
      if (page3Runway) {
        page3Runway.style.backgroundColor = bgColor;
      }
      const page3BlackScene = document.getElementById("page3-black-scene");
      if (page3BlackScene) {
        page3BlackScene.style.backgroundColor = bgColor;
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
      const easedFloat = 1 - Math.pow(1 - clampedFloat, 3);
      const stage = cardStageRef.current;
      if (stage) {
        stage.style.opacity = String(Math.max(0.4, 0.4 + easedFloat * 0.6));
        stage.style.transform = `translate3d(0, ${(1 - easedFloat) * 45}px, 0) scale(${0.95 + easedFloat * 0.05})`;
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

    updateScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, []);

  // 动态字体颜色：背景较暗时采用高对比纯白，渐变到纯白背景时转为经典深黑炭色，确保文字恒定清晰
  const warpTextColor = isLightBackground ? "#0B0C0E" : "#F8FAFC";

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
      {/* 末页固定视口舞台容器 (注意：祖先不设 will-change: transform 以免打破 position: sticky) */}
      <div className="sticky top-0 left-0 w-full h-screen overflow-hidden flex items-center justify-center px-4 sm:px-6">
        {/* ══════════════ 1. 弹幕容器：使用 will-change: transform 与 translateZ(0) 硬件加速 ══════════════ */}
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
          {isBarrageVisible && (
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

        {/* ══════════════ 2. 居中卡片舞台：内容容器添加 will-change: transform, opacity 保持硬件加速一致性 ══════════════ */}
        <div
          ref={cardStageRef}
          style={{
            perspective: "1600px",
            opacity: 0.4,
            transform: "translate3d(0, 45px, 0) scale(0.95)",
            willChange: "transform, opacity",
          }}
          className="relative z-10 w-full max-w-[460px]"
        >
          {/* 上下 3D 翻转主体容器 (沿 X 轴翻转 rotateX: 0deg <-> 180deg，独立 3D 变换空间) */}
          <div
            style={{
              transformStyle: "preserve-3d",
              transform: `rotateX(${isFlipped ? 180 : 0}deg)`,
              transition: "transform 0.85s cubic-bezier(0.22, 1, 0.36, 1)",
              willChange: "transform",
            }}
            className="relative w-full h-[520px]"
          >
            {/* ── 阶段 1：正面：水波纹浮动文字 OMNILINK ── */}
            <div
              onClick={() => {
                userInteractedRef.current = true;
                setIsFlipped(true);
              }}
              style={{
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                transform: "rotateX(0deg)",
                filter: isFlipped ? "blur(14px)" : "blur(0px)",
                opacity: isFlipped ? 0 : 1,
                pointerEvents: isFlipped ? "none" : "auto",
                transition:
                  "filter 0.65s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.55s ease, transform 0.85s cubic-bezier(0.22, 1, 0.36, 1)",
              }}
              className="relative w-full h-[520px] flex flex-col items-center justify-center cursor-pointer select-none group"
              title="点击翻转至会员登录 / 注册卡片"
            >
              <div
                style={{ willChange: "transform, opacity" }}
                className="w-full h-full relative flex items-center justify-center pointer-events-auto"
              >
                {isBarrageVisible ? (
                  <WarpText
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
                ) : (
                  <span className="text-5xl font-black tracking-[-0.03em] sm:text-6xl" style={{ color: warpTextColor }}>
                    OMNILINK
                  </span>
                )}
              </div>

              {/* 翻转交互提示条 */}
              <div
                style={{ willChange: "transform, opacity" }}
                className="absolute bottom-6 flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-black/10 bg-white/70 backdrop-blur-md text-[11px] font-mono text-neutral-600 shadow-sm opacity-80 group-hover:opacity-100 transition-opacity"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#315BFF] animate-pulse" />
                <span>点击卡片或滚动翻转至通行凭证</span>
              </div>
            </div>

            {/* ── 阶段 2：背面：登录/注册卡片 (翻转先模糊后实体，向上翻转先实体后模糊，卡片内容间隔均匀排布) ── */}
            <div
              style={{
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                transform: "rotateX(180deg)",
                filter: isFlipped ? "blur(0px)" : "blur(16px)",
                opacity: isFlipped ? 1 : 0,
                pointerEvents: isFlipped ? "auto" : "none",
                transition:
                  "filter 0.75s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.65s ease, transform 0.85s cubic-bezier(0.22, 1, 0.36, 1)",
                willChange: "transform, opacity",
              }}
              className="absolute inset-0 w-full h-full rounded-4xl bg-white border border-black/[0.08] shadow-[0_24px_70px_rgba(0,0,0,0.07),0_4px_16px_rgba(0,0,0,0.03)] p-8 sm:p-9 flex flex-col justify-between overflow-hidden"
            >
              {/* 卡片顶部：翻转回 OMNILINK 按钮 */}
              <div className="absolute top-4 right-4 z-20">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    userInteractedRef.current = true;
                    setIsFlipped(false);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono text-neutral-400 hover:text-[#315BFF] hover:bg-black/5 transition-all cursor-pointer"
                  title="翻转回 OMNILINK 水波文字"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="text-[11px]">翻转文字</span>
                </button>
              </div>

              {/* 卡片主体：同时支持登录与注册完整双模态交互 */}
              <div
                style={{ willChange: "transform, opacity" }}
                className="w-full h-full flex flex-col justify-between"
              >
                {authMode === "login" ? (
                  <LoginForm
                    variant="light"
                    className="w-full h-full flex flex-col justify-between"
                    hideTitle={false}
                    onSwitchToSignup={() => setAuthMode("signup")}
                  redirectTo={redirectTo}
                  />
                ) : (
                  <SignupForm
                    variant="light"
                    className="w-full h-full flex flex-col justify-between"
                    hideTitle={false}
                    onSwitchToLogin={() => setAuthMode("login")}
                  redirectTo={redirectTo}
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

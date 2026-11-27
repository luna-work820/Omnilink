import React, { useCallback, useLayoutEffect, useRef, useState, useEffect } from 'react';
import { gsap } from 'gsap';
import { ArrowRight } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { detectCurrentPageTheme, type PageTheme } from '@/components/login-package/hooks/usePageTheme';
import { jumpToFinalLogin } from '@/components/login-package/lib/utils';
import './StaggeredMenu.css';

export const StaggeredMenu = ({
  position = 'right',
  colors = ['#FF6B00', '#315BFF'],
  className,
  menuButtonColor,
  openMenuButtonColor,
  accentColor = '#315BFF',
  changeMenuColorOnOpen = true,
  isFixed = true,
  closeOnClickAway = true,
  theme: propTheme,
  redirectTo,
  onMenuOpen,
  onMenuClose
}: any) => {
  const [open, setOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [activeTheme, setActiveTheme] = useState<PageTheme>('light');
  const [isVisualDark, setIsVisualDark] = useState(false);
  const [isOnFinalPage, setIsOnFinalPage] = useState(false);
  const prefersReducedMotion = useReducedMotion() ?? false;

  const openRef = useRef(false);
  const panelRef = useRef<HTMLElement>(null);
  const preLayersRef = useRef<HTMLDivElement>(null);
  const preLayerElsRef = useRef<HTMLElement[]>([]);
  const plusHRef = useRef<HTMLSpanElement>(null);
  const plusVRef = useRef<HTMLSpanElement>(null);
  const iconRef = useRef<HTMLSpanElement>(null);
  const textInnerRef = useRef<HTMLSpanElement>(null);
  const contentWrapRef = useRef<HTMLDivElement>(null);
  const [textLines, setTextLines] = useState(['登录', '关闭']);

  const openTlRef = useRef<gsap.core.Timeline | null>(null);
  const closeTweenRef = useRef<gsap.core.Tween | null>(null);
  const spinTweenRef = useRef<gsap.core.Tween | null>(null);
  const textCycleAnimRef = useRef<gsap.core.Tween | null>(null);
  const colorTweenRef = useRef<gsap.core.Tween | null>(null);
  const toggleBtnRef = useRef<HTMLButtonElement>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    if (propTheme) {
      setActiveTheme(propTheme);
    }
  }, [propTheme]);

  // 实时检测页面当前视口背后的视觉深浅色（用于闭合时按钮和 Logo 的文本高反差）以及是否位于末页
  useEffect(() => {
    let rafPending = 0;
    let prevOnFinal = false;
    let prevVisualDark = false;

    const commit = (onFinal: boolean, visualDark: boolean) => {
      if (onFinal !== prevOnFinal) {
        prevOnFinal = onFinal;
        setIsOnFinalPage(onFinal);
      }
      if (visualDark !== prevVisualDark) {
        prevVisualDark = visualDark;
        setIsVisualDark(visualDark);
      }
    };

    const evaluateScroll = () => {
      rafPending = 0;
      const vh = window.innerHeight || 800;
      const scrollY = window.scrollY || 0;

      // 检查是否已进入末页 (#gallery-parallax)
      const gallery = document.getElementById('gallery-parallax');
      if (gallery) {
        const gRect = gallery.getBoundingClientRect();
        const inFinalPage = gRect.top <= vh * 0.55 && gRect.bottom >= vh * 0.25;

        if (gRect.top <= vh * 0.65 && gRect.bottom >= vh * 0.25) {
          const computedBg = window.getComputedStyle(gallery).backgroundColor;
          const rgbMatch = computedBg.match(/\d+/g);
          if (rgbMatch && rgbMatch.length >= 3) {
            const r = Number(rgbMatch[0]);
            const g = Number(rgbMatch[1]);
            const b = Number(rgbMatch[2]);
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            commit(inFinalPage, brightness < 128);
            return;
          }
        }
        commit(inFinalPage, false);
        return;
      }

      // 1. 首页 / 第二页 / 第三页统一舞台：由 BleibtGooeySection 双层水波纹裁切同步控制黑白反相
      commit(false, false);
    };

    const handleScroll = () => {
      if (!rafPending) {
        rafPending = requestAnimationFrame(evaluateScroll);
      }
    };

    evaluateScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    return () => {
      if (rafPending) cancelAnimationFrame(rafPending);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  const closedBtnColor = menuButtonColor || (isVisualDark ? '#ffffff' : '#111111');
  const openBtnColor = openMenuButtonColor || (activeTheme === 'dark' ? '#ffffff' : '#111111');

  // 当处于关闭状态且页面滚动改变视觉底色时，直接更新按钮颜色
  useEffect(() => {
    if (!open && toggleBtnRef.current) {
      toggleBtnRef.current.style.color = closedBtnColor;
    }
  }, [closedBtnColor, open]);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const panel = panelRef.current;
      const preContainer = preLayersRef.current;
      const plusH = plusHRef.current;
      const plusV = plusVRef.current;
      const icon = iconRef.current;
      if (!panel) return;

      let preLayers: HTMLElement[] = [];
      if (preContainer) {
        preLayers = Array.from(preContainer.querySelectorAll('.sm-prelayer'));
      }
      preLayerElsRef.current = preLayers;

      const offscreen = position === 'left' ? -100 : 100;
      gsap.set([panel, ...preLayers], { xPercent: offscreen, opacity: 1 });
      if (preContainer) {
        gsap.set(preContainer, { xPercent: 0, opacity: 1 });
      }
      if (plusH && plusV) {
        gsap.set(plusH, { transformOrigin: '50% 50%', rotate: 0 });
        gsap.set(plusV, { transformOrigin: '50% 50%', rotate: 90 });
      }
      if (icon) gsap.set(icon, { rotate: 0, transformOrigin: '50% 50%' });
      if (toggleBtnRef.current) gsap.set(toggleBtnRef.current, { color: closedBtnColor });
    });
    return () => ctx.revert();
  }, [position]);

  const buildOpenTimeline = useCallback(() => {
    const panel = panelRef.current;
    const layers = preLayerElsRef.current;
    const contentWrap = contentWrapRef.current;
    if (!panel) return null;

    openTlRef.current?.kill();
    if (closeTweenRef.current) {
      closeTweenRef.current.kill();
      closeTweenRef.current = null;
    }

    const offscreen = position === 'left' ? -100 : 100;
    const layerStates = layers.map(el => ({ el, start: offscreen }));
    const panelStart = offscreen;

    if (contentWrap) {
      gsap.set(contentWrap, { y: 24, opacity: 0 });
    }

    const tl = gsap.timeline({ paused: true });

    layerStates.forEach((ls, i) => {
      tl.fromTo(ls.el, { xPercent: ls.start }, { xPercent: 0, duration: 0.48, ease: 'power4.out' }, i * 0.06);
    });
    const lastTime = layerStates.length ? (layerStates.length - 1) * 0.06 : 0;
    const panelInsertTime = lastTime + (layerStates.length ? 0.07 : 0);
    const panelDuration = 0.6;
    tl.fromTo(
      panel,
      { xPercent: panelStart },
      { xPercent: 0, duration: panelDuration, ease: 'power4.out' },
      panelInsertTime
    );

    if (contentWrap) {
      tl.to(
        contentWrap,
        {
          y: 0,
          opacity: 1,
          duration: 0.45,
          ease: 'power3.out'
        },
        panelInsertTime + 0.15
      );
    }

    return tl;
  }, [position]);

  const playOpen = useCallback(() => {
    if (busyRef.current) return;
    busyRef.current = true;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reduceMotion) {
      openTlRef.current?.kill();
      closeTweenRef.current?.kill();
      gsap.set([panelRef.current, ...preLayerElsRef.current].filter(Boolean), { xPercent: 0, opacity: 1 });
      if (contentWrapRef.current) gsap.set(contentWrapRef.current, { y: 0, opacity: 1 });
      busyRef.current = false;
      return;
    }
    const tl = buildOpenTimeline();
    if (!tl) {
      busyRef.current = false;
      return;
    }
    openTlRef.current = tl;
    tl.play().then(() => {
      busyRef.current = false;
    });
  }, [buildOpenTimeline]);

  const playClose = useCallback(() => {
    openTlRef.current?.kill();
    openTlRef.current = null;
    if (closeTweenRef.current) {
      closeTweenRef.current.kill();
      closeTweenRef.current = null;
    }

    const panel = panelRef.current;
    const layers = preLayerElsRef.current;
    const contentWrap = contentWrapRef.current;
    if (!panel) return;

    const offscreen = position === 'left' ? -100 : 100;
    const all: HTMLElement[] = [panel, ...layers];

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reduceMotion) {
      gsap.set(all, { xPercent: offscreen });
      if (contentWrap) gsap.set(contentWrap, { y: 16, opacity: 0 });
      busyRef.current = false;
      return;
    }

    if (contentWrap) {
      gsap.to(contentWrap, {
        y: 16,
        opacity: 0,
        duration: 0.2,
        ease: 'power2.in'
      });
    }

    closeTweenRef.current = gsap.to(all, {
      xPercent: offscreen,
      duration: 0.38,
      ease: 'power3.in',
      stagger: 0.02,
      overwrite: 'auto',
      onComplete: () => {
        closeTweenRef.current = null;
        busyRef.current = false;
      }
    });
  }, [position]);

  const animateIcon = useCallback((opening: boolean) => {
    const icon = iconRef.current;
    const h = plusHRef.current;
    const v = plusVRef.current;
    if (!icon || !h || !v) return;

    spinTweenRef.current?.kill();
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reduceMotion) {
      gsap.set(icon, { rotate: opening ? 225 : 0 });
      return;
    }

    if (opening) {
      spinTweenRef.current = gsap.to(icon, { rotate: 225, duration: 0.5, ease: 'power4.out', overwrite: 'auto' });
    } else {
      spinTweenRef.current = gsap.to(icon, { rotate: 0, duration: 0.35, ease: 'power3.inOut', overwrite: 'auto' });
    }
  }, []);

  const animateColor = useCallback(
    (opening: boolean) => {
      const btn = toggleBtnRef.current;
      if (!btn) return;
      colorTweenRef.current?.kill();
      if (changeMenuColorOnOpen) {
        const targetColor = opening ? openBtnColor : closedBtnColor;
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
          gsap.set(btn, { color: targetColor });
          return;
        }
        colorTweenRef.current = gsap.to(btn, {
          color: targetColor,
          delay: 0.14,
          duration: 0.28,
          ease: 'power2.out'
        });
      } else {
        gsap.set(btn, { color: closedBtnColor });
      }
    },
    [openBtnColor, closedBtnColor, changeMenuColorOnOpen]
  );

  const animateText = useCallback((opening: boolean) => {
    const inner = textInnerRef.current;
    if (!inner) return;
    textCycleAnimRef.current?.kill();

    const currentLabel = opening ? '登录' : '关闭';
    const targetLabel = opening ? '关闭' : '登录';
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setTextLines([targetLabel]);
      gsap.set(inner, { yPercent: 0 });
      return;
    }
    const cycles = 3;
    const seq = [currentLabel];
    let last = currentLabel;
    for (let i = 0; i < cycles; i++) {
      last = last === '登录' ? '关闭' : '登录';
      seq.push(last);
    }
    if (last !== targetLabel) seq.push(targetLabel);
    seq.push(targetLabel);
    setTextLines(seq);

    gsap.set(inner, { yPercent: 0 });
    const lineCount = seq.length;
    const finalShift = ((lineCount - 1) / lineCount) * 100;
    textCycleAnimRef.current = gsap.to(inner, {
      yPercent: -finalShift,
      duration: 0.5 + lineCount * 0.07,
      ease: 'power4.out'
    });
  }, []);

  const toggleMenu = useCallback(() => {
    const target = !openRef.current;
    if (target) {
      const current = propTheme || detectCurrentPageTheme();
      setActiveTheme(current);
    }
    openRef.current = target;
    setOpen(target);
    if (target) {
      onMenuOpen?.();
      playOpen();
    } else {
      onMenuClose?.();
      playClose();
    }
    animateIcon(target);
    animateColor(target);
    animateText(target);
  }, [playOpen, playClose, animateIcon, animateColor, animateText, onMenuOpen, onMenuClose, propTheme]);

  const closeMenu = useCallback(() => {
    if (openRef.current) {
      openRef.current = false;
      setOpen(false);
      onMenuClose?.();
      playClose();
      animateIcon(false);
      animateColor(false);
      animateText(false);
    }
  }, [playClose, animateIcon, animateColor, animateText, onMenuClose]);

  useEffect(() => {
    if (!closeOnClickAway || !open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        toggleBtnRef.current &&
        !toggleBtnRef.current.contains(event.target as Node)
      ) {
        closeMenu();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [closeOnClickAway, open, closeMenu]);

  useEffect(() => {
    if (!open) return;

    const panel = panelRef.current;
    const main = document.querySelector<HTMLElement>('.loginPackage > main');
    const mainWasInert = main?.inert ?? false;
    if (main) main.inert = true;

    const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const getFocusable = () => Array.from(panel?.querySelectorAll<HTMLElement>(focusableSelector) ?? []);
    const focusFrame = requestAnimationFrame(() => {
      const firstInput = panel?.querySelector<HTMLElement>('input:not([disabled])');
      (firstInput ?? getFocusable()[0])?.focus({ preventScroll: true });
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu();
        toggleBtnRef.current?.focus({ preventScroll: true });
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = getFocusable();
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) {
        event.preventDefault();
        panel?.focus();
      } else if (event.shiftKey && (document.activeElement === first || !panel?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !panel?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      if (main) main.inert = mainWasInert;
      if (panel?.contains(document.activeElement)) {
        toggleBtnRef.current?.focus({ preventScroll: true });
      }
    };
  }, [open, closeMenu]);

  return (
    <div
      className={(className ? className + ' ' : '') + 'staggered-menu-wrapper' + (isFixed ? ' fixed-wrapper' : '')}
      style={accentColor ? ({ ['--sm-accent' as any]: accentColor }) : undefined}
      data-position={position}
      data-open={open || undefined}
    >
      {/* 点击外部区域半透明遮罩 */}
      {open && (
        <div
          aria-hidden="true"
          onClick={closeMenu}
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[4] pointer-events-auto transition-opacity duration-300"
        />
      )}

      {/* 橙色与蓝色主题过渡层 */}
      <div ref={preLayersRef} className="sm-prelayers" aria-hidden="true">
        {(() => {
          const raw = colors && colors.length ? colors.slice(0, 4) : ['#FF6B00', '#315BFF'];
          const arr = [...raw];
          if (arr.length >= 3) {
            const mid = Math.floor(arr.length / 2);
            arr.splice(mid, 1);
          }
          return arr.map((c, i) => <div key={i} className="sm-prelayer" style={{ background: c }} />);
        })()}
      </div>

      <header
        className="staggered-menu-header group/hdr w-full z-50 bg-transparent"
        aria-label="Main navigation header"
      >
        {/* 下层黑底白字镜像层：由水波纹镂空区域裁切显示 */}
        <div
          id="omnilink-header-lower"
          aria-hidden="true"
          style={{ clipPath: 'inset(100%)' }}
          className="absolute inset-0 flex items-center justify-between px-6 sm:px-12 py-4 pointer-events-none select-none will-change-[clip-path]"
        >
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-[#008F83]">＊</span>
            <span className="font-sans font-extrabold tracking-widest text-sm text-[#FCFCFD]">
              OMNILINK
            </span>
          </div>

          <div
            className={`flex items-center gap-5 transition-all duration-[250ms] ease-out ${
              isOnFinalPage && !open
                ? 'opacity-0 -translate-y-2 invisible'
                : 'opacity-100 translate-y-0 visible'
            }`}
          >
            <span className="relative inline-flex items-center gap-1.5 text-sm font-medium tracking-wide text-[#FCFCFD] group-data-[cta-hovered=true]/hdr:text-[#008F83] transition-colors duration-[250ms] after:content-[''] after:absolute after:left-0 after:right-0 after:-bottom-0.5 after:h-[1px] after:bg-current after:origin-left after:scale-x-0 group-data-[cta-hovered=true]/hdr:after:scale-x-100 after:transition-transform after:duration-[250ms] after:ease-out">
              <span>{open ? '关闭' : '立即开始'}</span>
              {!open && (
                <ArrowRight
                  className="w-3.5 h-3.5 transition-transform duration-[250ms] ease-out group-data-[cta-hovered=true]/hdr:translate-x-0.5"
                  aria-hidden="true"
                />
              )}
            </span>
          </div>
        </div>

        {/* 上层白底深字视觉层：默认显示，鼠标水波纹掠过时按波纹轮廓裁切露出下层白字 */}
        <div
          id="omnilink-header-upper"
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-between px-6 sm:px-12 py-4 pointer-events-none select-none will-change-[clip-path]"
        >
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-[#008F83]">＊</span>
            <span
              className={`font-sans font-extrabold tracking-widest text-sm transition-colors duration-[250ms] ease-out ${
                isVisualDark ? 'text-white' : 'text-[#1C2024]'
              }`}
            >
              OMNILINK
            </span>
          </div>

          <div
            className={`flex items-center gap-5 transition-all duration-[250ms] ease-out ${
              isOnFinalPage && !open
                ? 'opacity-0 -translate-y-2 invisible'
                : 'opacity-100 translate-y-0 visible'
            }`}
          >
            <span
              className={`relative inline-flex items-center gap-1.5 text-sm font-medium tracking-wide transition-colors duration-[250ms] ease-out group-data-[cta-hovered=true]/hdr:!text-[#008F83] after:content-[''] after:absolute after:left-0 after:right-0 after:-bottom-0.5 after:h-[1px] after:bg-current after:origin-left after:scale-x-0 group-data-[cta-hovered=true]/hdr:after:scale-x-100 after:transition-transform after:duration-[250ms] after:ease-out ${
                isVisualDark ? 'text-white' : 'text-[#1C2024]'
              }`}
            >
              <span>{open ? '关闭' : '立即开始'}</span>
              {!open && (
                <ArrowRight
                  className="w-3.5 h-3.5 transition-transform duration-[250ms] ease-out group-data-[cta-hovered=true]/hdr:translate-x-0.5"
                  aria-hidden="true"
                />
              )}
            </span>
          </div>
        </div>

        {/* 交互与无障碍热区层（透明承载点击与悬停状态，不随波纹被裁切失效） */}
        <div className="relative z-10 flex items-center justify-between px-6 sm:px-12 py-4 w-full pointer-events-none">
          <button
            type="button"
            data-liquid-skip="true"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="返回顶部"
            className="flex items-center gap-2 cursor-pointer select-none bg-transparent border-0 p-0 pointer-events-auto opacity-0 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#315BFF]"
            style={{ outlineColor: isVisualDark ? '#FFFFFF' : '#315BFF' }}
          >
            <span className="text-xl font-bold">＊</span>
            <span className="font-sans font-extrabold tracking-widest text-sm">
              OMNILINK
            </span>
          </button>

          <div className="flex items-center gap-5 pointer-events-none">
            <button
              type="button"
              data-liquid-skip="true"
              ref={toggleBtnRef}
              onMouseEnter={(e) => {
                e.currentTarget.closest('header')?.setAttribute('data-cta-hovered', 'true');
              }}
              onMouseLeave={(e) => {
                e.currentTarget.closest('header')?.removeAttribute('data-cta-hovered');
              }}
              onFocus={(e) => {
                e.currentTarget.closest('header')?.setAttribute('data-cta-hovered', 'true');
              }}
              onBlur={(e) => {
                e.currentTarget.closest('header')?.removeAttribute('data-cta-hovered');
              }}
              onClick={(e) => {
                e.preventDefault();
                jumpToFinalLogin();
              }}
              className={`relative inline-flex items-center text-sm font-medium tracking-wide cursor-pointer select-none no-underline bg-transparent border-0 p-0 opacity-0 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#315BFF] ${
                isOnFinalPage && !open
                  ? 'pointer-events-none -translate-y-2 invisible'
                  : 'pointer-events-auto translate-y-0 visible'
              }`}
              style={{ outlineColor: isVisualDark ? '#FFFFFF' : '#315BFF' }}
              aria-label="立即开始"
            >
              <span className="relative inline-flex items-center gap-1.5">
                <span>{open ? '关闭' : '立即开始'}</span>
                {!open && <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />}
              </span>
            </button>
          </div>
        </div>
      </header>


    </div>
  );
};

export default StaggeredMenu;

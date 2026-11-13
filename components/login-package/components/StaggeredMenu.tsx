import React, { useCallback, useLayoutEffect, useRef, useState, useEffect } from 'react';
import { gsap } from 'gsap';
import { LoginForm } from '@/components/login-package/components/login-form';
import { SignupForm } from '@/components/login-package/components/SignupForm';
import TextCursor from '@/components/login-package/components/TextCursor';
import Shuffle from '@/components/login-package/components/Shuffle';
import { detectCurrentPageTheme, PageTheme } from '@/components/login-package/hooks/usePageTheme';
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
  const [isVisualDark, setIsVisualDark] = useState(true);
  const [isOnFinalPage, setIsOnFinalPage] = useState(false);

  const openRef = useRef(false);
  const panelRef = useRef<HTMLElement>(null);
  const preLayersRef = useRef<HTMLDivElement>(null);
  const preLayerElsRef = useRef<HTMLElement[]>([]);
  const plusHRef = useRef<HTMLSpanElement>(null);
  const plusVRef = useRef<HTMLSpanElement>(null);
  const iconRef = useRef<HTMLSpanElement>(null);
  const textInnerRef = useRef<HTMLSpanElement>(null);
  const contentWrapRef = useRef<HTMLDivElement>(null);
  const [textLines, setTextLines] = useState(['登陆', '关闭']);

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
    const handleScroll = () => {
      const vh = window.innerHeight || 800;
      const scrollY = window.scrollY || 0;

      // 检查是否已进入末页 (#gallery-parallax)
      const gallery = document.getElementById('gallery-parallax');
      if (gallery) {
        const gRect = gallery.getBoundingClientRect();
        const inFinalPage = gRect.top <= vh * 0.55 && gRect.bottom >= vh * 0.25;
        setIsOnFinalPage(inFinalPage);

        if (gRect.top <= vh * 0.65 && gRect.bottom >= vh * 0.25) {
          const computedBg = window.getComputedStyle(gallery).backgroundColor;
          const rgbMatch = computedBg.match(/\d+/g);
          if (rgbMatch && rgbMatch.length >= 3) {
            const r = Number(rgbMatch[0]);
            const g = Number(rgbMatch[1]);
            const b = Number(rgbMatch[2]);
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            setIsVisualDark(brightness < 128);
            return;
          }
        }
      } else {
        setIsOnFinalPage(false);
      }

      // 1. 首页 (Hero) 视觉上是黑色液态/画面底色
      if (scrollY < vh * 0.8) {
        setIsVisualDark(true);
        return;
      }

      // 2. 第二页/第三页
      const runway = document.getElementById('product-entropy');
      if (runway) {
        const rRect = runway.getBoundingClientRect();
        const scrollIntoRunway = -rRect.top;
        if (scrollIntoRunway >= vh * 1.25) {
          setIsVisualDark(true);
          return;
        }
      }

      setIsVisualDark(false);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    return () => {
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
      if (!panel || !plusH || !plusV || !icon) return;

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
      gsap.set(plusH, { transformOrigin: '50% 50%', rotate: 0 });
      gsap.set(plusV, { transformOrigin: '50% 50%', rotate: 90 });
      gsap.set(icon, { rotate: 0, transformOrigin: '50% 50%' });
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

    const currentLabel = opening ? '登陆' : '关闭';
    const targetLabel = opening ? '关闭' : '登陆';
    const cycles = 3;
    const seq = [currentLabel];
    let last = currentLabel;
    for (let i = 0; i < cycles; i++) {
      last = last === '登陆' ? '关闭' : '登陆';
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
          let arr = [...raw];
          if (arr.length >= 3) {
            const mid = Math.floor(arr.length / 2);
            arr.splice(mid, 1);
          }
          return arr.map((c, i) => <div key={i} className="sm-prelayer" style={{ background: c }} />);
        })()}
      </div>

      <header className="staggered-menu-header" aria-label="Main navigation header">
        {/* 左上角 Omnilink 已按需求移除 */}
        <div className="sm-logo pointer-events-none" aria-hidden="true" />
        <button
          ref={toggleBtnRef}
          className={`sm-toggle transition-all duration-300 ${
            isOnFinalPage && !open
              ? 'opacity-0 pointer-events-none -translate-y-2 invisible'
              : 'opacity-100 pointer-events-auto translate-y-0 visible'
          }`}
          aria-label={open ? 'Close login panel' : 'Open login panel'}
          aria-expanded={open}
          aria-controls="staggered-menu-panel"
          onClick={toggleMenu}
          type="button"
        >
          <span className="sm-toggle-textWrap" aria-hidden="true">
            <Shuffle
              key={open ? 'close' : 'login'}
              text={open ? '关闭' : '登录'}
              tag="span"
              className="inline-block text-sm font-medium tracking-wide"
              shuffleDirection="right"
              duration={0.3}
              shuffleTimes={2}
              triggerOnHover={true}
              animationMode="evenodd"
            />
          </span>
          <span ref={iconRef} className="sm-icon" aria-hidden="true">
            <span ref={plusHRef} className="sm-icon-line" />
            <span ref={plusVRef} className="sm-icon-line sm-icon-line-v" style={{ transform: 'translate(-50%, -50%) rotate(90deg)' }} />
          </span>
        </button>
      </header>

      {/* 弹出的登录/创建页面：根据用户当前停留在黑色页面/白色页面/首页自适应纯黑/纯白底色 */}
      <aside
        id="staggered-menu-panel"
        ref={panelRef as any}
        className={`staggered-menu-panel ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
        data-theme={activeTheme}
        aria-hidden={!open}
      >
        {/* 背景层：仅在抽屉打开时接收指针事件 */}
        <div
          className={`absolute inset-0 z-0 overflow-hidden ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
          style={{ height: '100%', position: 'absolute' }}
        >
          <TextCursor
            text="Hello"
            mode="ribbon"
            fontSize="33px"
            spacing={88}
            maxPoints={7}
            shrink={0.5}
            fade={0.6}
            smoothing={0.3}
            exitDuration={0.5}
            removalInterval={30}
            followMouseDirection
            keepUpright
            randomFloat
            popIn
            hideCursor={false}
            color={activeTheme === 'dark' ? 'rgba(110, 145, 255, 0.42)' : 'rgba(49, 91, 255, 0.42)'}
          />
        </div>

        {/* 前景内容层：直接复刻末尾登录与创建页面，单层无双重卡片框 */}
        <div ref={contentWrapRef} className="sm-panel-inner">
          <div className="w-full max-w-sm mx-auto my-auto flex flex-col items-center justify-center py-4">
            {/* 单层无嵌套 Card 的表单，仅保留最底下的小字切换 */}
            {authMode === 'login' ? (
              <LoginForm
                variant={activeTheme}
                className="w-full"
                hideTitle={false}
                onSwitchToSignup={() => setAuthMode('signup')}
                redirectTo={redirectTo}
              />
            ) : (
              <SignupForm
                variant={activeTheme}
                className="w-full"
                hideTitle={false}
                onSwitchToLogin={() => setAuthMode('login')}
                redirectTo={redirectTo}
              />
            )}
          </div>
        </div>
      </aside>
    </div>
  );
};

export default StaggeredMenu;

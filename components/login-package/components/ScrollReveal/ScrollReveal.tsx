'use client';

import { Children, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import './ScrollReveal.css';

gsap.registerPlugin(ScrollTrigger);

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const SCRUB_SPAN = 0.5;
const RISE_MASK = 'inset(-1em -1em -0.15em -1em)';

const clampToScroll = (position: any) =>
  typeof position === 'string' && !position.startsWith('clamp(') ? `clamp(${position})` : position;

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);
const smooth = (value: number) => value * value * (3 - 2 * value);
const easeOut = (value: number) => 1 - Math.pow(1 - value, 3);
const easeBack = (value: number, overshoot: number) => {
  const shifted = value - 1;
  return 1 + (overshoot + 1) * shifted * shifted * shifted + overshoot * shifted * shifted;
};
const glowAt = (t: number) => (t <= 0 || t >= 1 ? 0 : t < 0.35 ? smooth(t / 0.35) : 1 - smooth((t - 0.35) / 0.65));

const paintPiece = (piece: HTMLElement, t: number, look: any) => {
  let reveal = t;
  let fadeIn = t;
  let motion = '';
  if (look.effect === 'rise') {
    reveal = easeOut(t);
    fadeIn = clamp01(reveal * 1.25);
    if (reveal < 1) {
      motion = look.masked
        ? `translateY(${((1 - reveal) * 100).toFixed(2)}%) translateY(${((1 - reveal) * 0.2).toFixed(3)}em)`
        : `translateY(${((1 - reveal) * 0.8).toFixed(3)}em)`;
    }
  } else if (look.effect === 'flip') {
    reveal = easeBack(t, 1.2);
    fadeIn = clamp01(t * 2);
    if (t < 1) motion = `perspective(6em) rotateX(${((1 - reveal) * 90).toFixed(2)}deg)`;
  } else if (look.effect === 'scale') {
    reveal = easeBack(t, 1.6);
    fadeIn = clamp01(t * 1.6);
    if (t < 1) motion = `scale(${(0.35 + 0.65 * reveal).toFixed(4)})`;
  }
  if (look.highlightColor) fadeIn = Math.max(fadeIn, clamp01(t / 0.35));
  const settle = clamp01(reveal);
  const lift = look.offset * (1 - settle);
  piece.style.opacity = t >= 1 ? '' : (look.baseOpacity + (1 - look.baseOpacity) * fadeIn).toFixed(3);
  piece.style.transform = [lift ? `translateY(${lift.toFixed(2)}px)` : '', motion].filter(Boolean).join(' ');
  piece.style.filter = look.blur && settle < 1 ? `blur(${(look.blur * (1 - settle)).toFixed(2)}px)` : '';
  if (look.highlightColor) {
    const glow = glowAt(t);
    piece.style.color =
      glow > 0.002 ? `color-mix(in srgb, ${look.highlightColor} ${(glow * 100).toFixed(1)}%, currentColor)` : '';
  }
};

export interface ScrollRevealToken {
  text: string;
  className?: string;
}

const segmentWords = (input: string): string[] => {
  // Preserve explicit whitespace chunks if present (e.g., English or mixed text with spaces)
  if (/\s/.test(input) && !/[\u4e00-\u9fff]/.test(input)) {
    return input.split(/(\s+)/);
  }
  // For CJK or mixed CJK strings without spaces, use Intl.Segmenter for natural word-by-word scrub
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    try {
      const segmenter = new (Intl as any).Segmenter('zh-CN', { granularity: 'word' });
      const parts: string[] = [];
      for (const seg of segmenter.segment(input)) {
        if (seg.segment) parts.push(seg.segment);
      }
      if (parts.length > 0) return parts;
    } catch {
      // Fallback below
    }
  }
  return input.match(/[\u4e00-\u9fff]{1,2}|[a-zA-Z0-9]+|\s+|[^\s]/g) || [input];
};

export const ScrollReveal = ({
  children,
  tokens,
  as = 'h2',
  scrollContainerRef,
  enableBlur = true,
  baseOpacity = 0.1,
  baseRotation = 3,
  blurStrength = 4,
  baseOffset = 0,
  stagger = 0.05,
  smoothing = 0,
  splitBy = 'words',
  effect = 'fade',
  mode = 'scrub',
  duration = 0.8,
  highlightColor = '',
  containerClassName = '',
  textClassName = '',
  rotationEnd = 'bottom 35%',
  wordAnimationEnd = 'bottom 35%',
  triggerElementRef
}: any) => {
  const containerRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  const text = useMemo(() => {
    if (Array.isArray(tokens) && tokens.length > 0) {
      return tokens.map((t: ScrollRevealToken) => t.text).join('');
    }
    const parts = Children.toArray(children);
    return parts.every(part => typeof part === 'string' || typeof part === 'number') ? parts.join('') : null;
  }, [children, tokens]);

  const splitText = useMemo(() => {
    if (Array.isArray(tokens) && tokens.length > 0) {
      return tokens.flatMap((tok: ScrollRevealToken, tokIndex: number) =>
        segmentWords(tok.text).map((word, wIndex) =>
          word.trim() === '' ? (
            word
          ) : (
            <span className={`scroll-reveal-word ${tok.className || ''}`.trim()} key={`${tokIndex}-${wIndex}`}>
              {splitBy === 'chars' ? (
                Array.from(word).map((char, charIndex) => (
                  <span className="scroll-reveal-piece" key={charIndex}>
                    {char}
                  </span>
                ))
              ) : (
                <span className="scroll-reveal-piece">{word}</span>
              )}
            </span>
          )
        )
      );
    }

    if (text === null) return null;
    return segmentWords(text).map((word, index) =>
      word.trim() === '' ? (
        word
      ) : (
        <span className="scroll-reveal-word" key={index}>
          {splitBy === 'chars' ? (
            Array.from(word).map((char, charIndex) => (
              <span className="scroll-reveal-piece" key={charIndex}>
                {char}
              </span>
            ))
          ) : (
            <span className="scroll-reveal-piece">{word}</span>
          )}
        </span>
      )
    );
  }, [text, tokens, splitBy]);

  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useIsomorphicLayoutEffect(() => {
    const el = containerRef.current;
    const textEl = textRef.current;
    if (!el || !textEl) return;
    if (scrollContainerRef && !scrollContainerRef.current) return;

    const scroller = scrollContainerRef?.current || window;
    const wrappers = Array.from(el.querySelectorAll('.scroll-reveal-word')) as HTMLElement[];
    const pieces = wrappers.length ? (Array.from(el.querySelectorAll('.scroll-reveal-piece')) as HTMLElement[]) : [textEl];
    const viewportHeight = () => (scroller instanceof HTMLElement ? scroller.clientHeight : window.innerHeight);
    const scrub = smoothing > 0 ? smoothing : true;
    const span = mode === 'enter' ? Math.max(0.05, duration) : SCRUB_SPAN;
    const gap = Math.max(0, stagger);
    const look = {
      effect,
      masked: effect === 'rise' && wrappers.length > 0,
      baseOpacity,
      blur: enableBlur ? blurStrength : 0,
      offset: baseOffset,
      highlightColor
    };
    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const order = pieces.map((_, index) => index);
      const last = pieces.map(() => -1);
      const state = { p: 0 };
      let count = pieces.length;

      const measure = () => {
        if (splitBy !== 'lines' || !wrappers.length) return;
        let line = -1;
        let top = -Infinity;
        wrappers.forEach((wrapper, index) => {
          const next = wrapper.offsetTop;
          if (Math.abs(next - top) > 2) {
            line += 1;
            top = next;
          }
          order[index] = line;
        });
        count = line + 1;
      };

      const total = () => span + Math.max(0, count - 1) * gap;

      const render = () => {
        const at = state.p * total();
        pieces.forEach((piece, index) => {
          const t = clamp01((at - order[index] * gap) / span);
          const prev = last[index];
          if (t === prev || (t > 0 && t < 1 && Math.abs(t - prev) < 0.006)) return;
          last[index] = t;
          paintPiece(piece, t, look);
        });
      };

      measure();
      pieces.forEach(piece => {
        piece.style.willChange =
          pieces.length > 80
            ? ''
            : effect === 'fade' && !baseOffset
              ? enableBlur
                ? 'opacity, filter'
                : 'opacity'
              : enableBlur
                ? 'opacity, transform, filter'
                : 'opacity, transform';
        piece.style.transformOrigin = effect === 'flip' ? '50% 100%' : '';
      });
      if (look.masked) {
        wrappers.forEach(wrapper => {
          wrapper.style.clipPath = RISE_MASK;
        });
      }
      render();

      if (mode === 'enter') {
        const triggerEl = triggerElementRef?.current || el;
        let played = false;
        const play = () => {
          if (played) return;
          played = true;
          gsap.to(state, { p: 1, duration: total(), ease: 'none', onUpdate: render });
          if (baseRotation) gsap.to(el, { rotate: 0, duration: Math.min(total(), 1.4), ease: 'power3.out' });
        };
        const startAt = () => {
          const view = viewportHeight();
          const top =
            triggerEl.getBoundingClientRect().top -
            (scroller instanceof HTMLElement
              ? scroller.getBoundingClientRect().top + scroller.clientTop - scroller.scrollTop
              : -window.scrollY);
          const raw = top - view + 0.2 * Math.min(triggerEl.offsetHeight, view);
          return Math.min(raw, ScrollTrigger.maxScroll(scroller) - 1);
        };
        if (baseRotation) gsap.set(el, { transformOrigin: '0% 50%', rotate: baseRotation });
        ScrollTrigger.create({
          trigger: triggerEl,
          scroller,
          start: startAt,
          onEnter: play,
          onLeave: play,
          onRefresh: (self: any) => {
            if (self.progress > 0) play();
          }
        });
      } else {
        const triggerEl = triggerElementRef?.current || el;
        if (baseRotation) {
          gsap.fromTo(
            el,
            { transformOrigin: '0% 50%', rotate: baseRotation },
            {
              ease: 'none',
              rotate: 0,
              scrollTrigger: {
                trigger: triggerEl,
                scroller,
                start: 'top bottom',
                end: clampToScroll(rotationEnd),
                scrub
              }
            }
          );
        }
        gsap.to(state, {
          p: 1,
          ease: 'none',
          onUpdate: render,
          scrollTrigger: {
            trigger: triggerEl,
            scroller,
            start: () => `top bottom-=${0.2 * Math.min(triggerEl.offsetHeight, viewportHeight())}`,
            end: clampToScroll(wordAnimationEnd),
            scrub
          }
        });
      }

      const resizeObserver =
        splitBy === 'lines' && typeof ResizeObserver !== 'undefined'
          ? new ResizeObserver(() => {
              measure();
              last.fill(-1);
              render();
            })
          : null;
      resizeObserver?.observe(textEl);

      return () => {
        resizeObserver?.disconnect();
        pieces.forEach(piece => {
          piece.style.opacity = '';
          piece.style.transform = '';
          piece.style.transformOrigin = '';
          piece.style.filter = '';
          piece.style.color = '';
          piece.style.willChange = '';
        });
        wrappers.forEach(wrapper => {
          wrapper.style.clipPath = '';
        });
      };
    });

    return () => mm.revert();
  }, [
    mounted,
    scrollContainerRef,
    triggerElementRef,
    text,
    splitBy,
    effect,
    mode,
    duration,
    highlightColor,
    enableBlur,
    baseOpacity,
    baseRotation,
    blurStrength,
    baseOffset,
    stagger,
    smoothing,
    rotationEnd,
    wordAnimationEnd
  ]);

  const Tag = as as any;

  return (
    <Tag ref={containerRef} className={`scroll-reveal ${containerClassName}`} aria-label={text ?? undefined}>
      <span
        ref={textRef}
        className={`scroll-reveal-text ${textClassName}`}
        aria-hidden={text === null ? undefined : true}
      >
        {splitText ?? children}
      </span>
    </Tag>
  );
};

export default ScrollReveal;

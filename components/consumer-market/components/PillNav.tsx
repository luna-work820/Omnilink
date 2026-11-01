'use client';

import { useState } from 'react';
import { Bot, type LucideIcon } from 'lucide-react';
import { LiquidGlass } from '@/components/ui/liquid-glass';
import './PillNav.css';

type Item = { label: string; href: string; icon: LucideIcon; solid?: boolean };
type PillNavProps = {
  items: Item[];
  activeHref: string;
  onItemClick: (href: string) => void;
};

const navGlass = { radius: 28, bevelDepth: 7, scale: 25, aberration: 1.3, frost: 2.2, tint: 0.58 };

export default function PillNav({ items, activeHref, onItemClick }: PillNavProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const activeIndex = items.findIndex((item) => item.href === activeHref);
  const pillIndex = hovered ?? activeIndex;

  return (
    <div className="pill-nav__layout pointer-events-none mx-auto flex w-full max-w-[560px] items-center gap-2">
      <LiquidGlass {...navGlass} interactive className="pill-nav__orb pointer-events-auto h-14 w-14 shrink-0 rounded-full">
        <button
          type="button"
          onClick={() => onItemClick('/discover/eva')}
          aria-label="打开 AI 助手"
          className="pill-nav__logo flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)]"
        >
          <Bot aria-hidden="true" className="h-7 w-7" strokeWidth={1.8} />
          <span className="text-xs font-semibold leading-none">AI</span>
        </button>
      </LiquidGlass>
      <LiquidGlass
        {...navGlass}
        interactive
        className="pill-nav pointer-events-auto h-14 min-w-0 flex-1 rounded-full"
      >
        <nav aria-label="底部导航" className="pill-nav__content h-full w-full">
          <div className="pill-nav__track relative grid h-full min-w-0 grid-cols-3 items-center rounded-full p-1" onMouseLeave={() => setHovered(null)}>
            {pillIndex >= 0 && <div
              aria-hidden="true"
              className="pill-nav__glide pointer-events-none"
              style={{ position: 'absolute', bottom: 4, top: 4, width: 'calc((100% - 8px) / 3)', left: `calc(4px + (100% - 8px) / 3 * ${pillIndex})` }}
            />}
            {items.map((item, index) => (
              <button
                key={item.href}
                type="button"
                onClick={() => onItemClick(item.href)}
                onMouseEnter={() => setHovered(index)}
                onFocus={() => setHovered(index)}
                onBlur={() => setHovered(null)}
                aria-current={item.href === activeHref ? 'page' : undefined}
                data-highlighted={pillIndex === index}
                className="pill-nav__item relative z-10 flex h-10 min-w-0 items-center justify-center rounded-full px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)]"
              >
                <span className="flex flex-col items-center justify-center gap-0.5 text-xs font-medium leading-none">
                  <item.icon aria-hidden="true" className="h-[21px] w-[21px]" fill={item.solid ? 'currentColor' : 'none'} strokeWidth={item.solid ? 1.5 : 1.9} />
                  <span>{item.label}</span>
                </span>
              </button>
            ))}
          </div>
        </nav>
      </LiquidGlass>
    </div>
  );
}

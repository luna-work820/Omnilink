import React, { useState } from 'react';
import type { DiscoveryType } from '../types';
import { List } from '@phosphor-icons/react';
import { LiquidGlass } from '@/components/ui/liquid-glass';
import { HomeNavigationDrawer } from './HomeNavigationDrawer';

const discoveryTypes: DiscoveryType[] = ['商品', '数字', '服务'];

export const Header: React.FC<{
  selectedType: DiscoveryType;
  onTypeSelect: (type: DiscoveryType) => void;
  onMenuOpenChange?: (open: boolean) => void;
  profileName: string | null;
  deepSeekKeyConfigured: boolean;
}> = ({ selectedType, onTypeSelect, onMenuOpenChange, profileName, deepSeekKeyConfigured }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => {
    setMenuOpen(false);
    onMenuOpenChange?.(false);
  };
  const toggleMenu = () => {
    const nextOpen = !menuOpen;
    setMenuOpen(nextOpen);
    onMenuOpenChange?.(nextOpen);
  };

  return (
    <header className={`fixed inset-x-0 top-0 w-full ${menuOpen ? 'z-[90]' : 'z-30'}`}>
      <LiquidGlass radius={0} bevelDepth={6} scale={10} aberration={0.25} frost={0.3} tint={0.84} interactive className={`consumer-market-header w-full ${menuOpen ? 'consumer-market-header--navigation-open' : ''}`}>
        <div className="flex w-full items-center gap-3 px-3 sm:px-5">
          <LiquidGlass radius={20} bevelDepth={5} scale={6} aberration={0.2} frost={0.2} tint={0.68} interactive className="home-navigation-toggle h-10 w-10 shrink-0 rounded-full">
            <button type="button" onClick={toggleMenu} aria-label={menuOpen ? '收起侧边栏' : '打开侧边栏'} aria-expanded={menuOpen} className="flex h-full w-full items-center justify-center rounded-full text-[var(--market-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)]"><List size={21} aria-hidden="true" /></button>
          </LiquidGlass>
          <nav className="consumer-market-header__categories flex min-w-0 flex-1 gap-7 overflow-x-auto px-1 sm:px-2" aria-label="购物类型">
          {discoveryTypes.map((type) => {
            const selected = type === selectedType;
            return (
              <button
                key={type}
                type="button"
                aria-pressed={selected}
                onClick={() => onTypeSelect(type)}
                className={`relative shrink-0 py-4 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)] ${selected ? 'font-semibold text-[var(--market-ink)]' : 'text-[var(--market-text-muted)] hover:text-[var(--market-ink)]'}`}
              >
                {type}
                {selected && <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--market-ink)]" />}
              </button>
            );
          })}
          </nav>
        </div>
      </LiquidGlass>
      {menuOpen && <HomeNavigationDrawer onClose={closeMenu} profileName={profileName} deepSeekKeyConfigured={deepSeekKeyConfigured} />}
    </header>
  );
};

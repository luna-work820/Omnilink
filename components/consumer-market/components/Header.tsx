import Image from 'next/image';
import React, { useCallback, useRef, useState } from 'react';
import { Archive, CaretRight, GearSix, MagnifyingGlass, NotePencil, SidebarSimple, SquaresFour, UserCircle } from '@phosphor-icons/react';
import { HomeNavigationDrawer } from './HomeNavigationDrawer';
import { useOmnilink } from '../context/OmnilinkContext';

type DrawerView = 'main' | 'skills' | 'archived' | 'settings';

export const Header: React.FC<{
  onMenuOpenChange?: (open: boolean) => void;
  onProfileOpen: () => void;
  profileName: string | null;
  publisherReady: boolean; creatorReady?: boolean;
  deepSeekKeyConfigured: boolean;
}> = ({ onMenuOpenChange, onProfileOpen, profileName, publisherReady, creatorReady = false, deepSeekKeyConfigured }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerView, setDrawerView] = useState<DrawerView>('main');
  const [drawerSearchOpen, setDrawerSearchOpen] = useState(false);
  const { startAiConversation, setHomeChatOpen } = useOmnilink();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    onMenuOpenChange?.(false);
    requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  }, [onMenuOpenChange]);
  const openMenu = (view: DrawerView = 'main', search = false) => {
    setDrawerView(view);
    setDrawerSearchOpen(search);
    setMenuOpen(true);
    onMenuOpenChange?.(true);
  };
  const railButton = 'grid h-[30px] w-[30px] place-items-center rounded-full text-[var(--market-ink)] transition-colors duration-[180ms] hover:bg-[var(--market-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)]';
  const railEdgeButton = 'grid h-11 w-11 place-items-center rounded-full text-[var(--market-ink)] transition-colors duration-[180ms] hover:bg-[var(--market-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)]';

  return <>
    <div className={`home-navigation-fluid-shell fixed inset-y-0 left-0 z-[75] ${menuOpen ? 'is-expanded' : ''}`}>
    <nav aria-label="快捷导航" aria-hidden={menuOpen} inert={menuOpen} className="home-navigation-rail absolute inset-y-0 left-0 flex w-11 flex-col items-center gap-2 py-3">
      <button ref={triggerRef} type="button" onClick={() => openMenu()} aria-label="打开侧边栏" aria-expanded="false" className={`${railEdgeButton} group`}><span className="relative grid h-8 w-8 place-items-center"><Image src="/omnilink-moon.svg" width={32} height={32} alt="" className="h-8 w-8 group-hover:opacity-0 group-focus-visible:opacity-0" /><SidebarSimple size={24} aria-hidden="true" className="absolute opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" /><CaretRight size={10} weight="bold" aria-hidden="true" className="absolute right-0 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" /></span></button>
      <button type="button" onClick={() => { startAiConversation(); setHomeChatOpen(true); }} aria-label="发起新对话" className={railButton}><NotePencil size={16} aria-hidden="true" /></button>
      <button type="button" onClick={() => openMenu('main', true)} aria-label="搜索" className={railButton}><MagnifyingGlass size={16} aria-hidden="true" /></button>
      <button type="button" onClick={() => openMenu('skills')} aria-label="插件和技能" className={railButton}><SquaresFour size={16} aria-hidden="true" /></button>
      <button type="button" onClick={() => openMenu('archived')} aria-label="已归档" className={railButton}><Archive size={16} aria-hidden="true" /></button>
      <div className="flex-1" />
      <button type="button" onClick={() => openMenu('settings')} aria-label="设置" className={railButton}><GearSix size={16} aria-hidden="true" /></button>
      <button type="button" onClick={onProfileOpen} aria-label="个人资料" className={railEdgeButton}><UserCircle size={20} aria-hidden="true" /></button>
    </nav>
    <div aria-hidden={!menuOpen} inert={!menuOpen} className={`home-navigation-drawer-stage absolute inset-0 ${menuOpen ? 'is-visible' : ''}`}>
      <HomeNavigationDrawer open={menuOpen} onClose={closeMenu} profileName={profileName} publisherReady={publisherReady} creatorReady={creatorReady} deepSeekKeyConfigured={deepSeekKeyConfigured} initialView={drawerView} initialSearchOpen={drawerSearchOpen} />
    </div>
    </div>

  </>;
};

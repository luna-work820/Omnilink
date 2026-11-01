import React from 'react';
import { Compass, Heart, UserRound } from 'lucide-react';
import PillNav from './PillNav';
import { useOmnilink } from '../context/OmnilinkContext';

const navItems = [
  { label: '发现', href: '/discover', icon: Compass },
  { label: '收藏', href: '/discover/favorites', icon: Heart, solid: true },
  { label: '个人', href: '/discover/profile', icon: UserRound },
];

export const BottomBar: React.FC = () => {
  const { mainTab, selectTab, openAiPage } = useOmnilink();
  const activeHref = mainTab === 'PROFILE' ? '/discover/profile' : mainTab === 'FAVORITES' ? '/discover/favorites' : mainTab === 'WORLD' ? '/discover' : '';

  const navigate = (href: string) => {
    if (href === '/discover/eva') openAiPage();
    else if (href === '/discover/favorites') selectTab('FAVORITES');
    else if (href === '/discover/profile') selectTab('PROFILE');
    else selectTab('WORLD');
    if (href !== '/discover/eva') window.scrollTo(0, 0);
  };

  return <div className="pointer-events-none fixed inset-x-0 z-30 px-3" style={{ bottom: 'max(14px, env(safe-area-inset-bottom, 0px))' }}>
    <PillNav
      items={navItems}
      activeHref={activeHref}
      onItemClick={navigate}
    />
  </div>;
};

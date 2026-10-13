import React from 'react';
import { Globe, Sparkles, User } from 'lucide-react';
import { useOmnilink } from '../context/OmnilinkContext';

export const BottomBar: React.FC = () => {
  const { mainTab, selectTab, cartCount, openAiDrawer } = useOmnilink();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 select-none border-t border-[#DED9D0]/80 bg-[#FFFFFF]/95 shadow-[0_-4px_16px_rgba(24,24,23,0.06)] backdrop-blur-xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="mx-auto grid h-14 max-w-2xl grid-cols-3 items-center px-3 pointer-events-auto">
        {/* Tab 1: 发现 / 首页 (触控压力反馈 + 柔和呼吸灯特效) */}
        <button
          onClick={() => selectTab('WORLD')}
          className={`relative flex h-12 items-center justify-center gap-1.5 rounded-xl px-3 transition-colors ${
            mainTab === 'WORLD'
              ? 'bg-[#181817] text-white font-semibold'
              : 'text-[#78746E] hover:text-[#181817]'
          }`}
          title="发现首页"
        >
          {/* 柔和呼吸灯闪烁指示点 (仅在激活时呼吸闪烁) */}
          {mainTab === 'WORLD' && (
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-75 duration-1000" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-300" />
            </span>
          )}

          <Globe size={15} strokeWidth={1.8} />
          <span className="text-xs tracking-tight">发现</span>
        </button>

        {/* Center: 全场景智能呼出 AI Capsule Pill (主位高亮、全场景一键唤醒、触控压力微动效) */}
        <button
          onClick={() => openAiDrawer()}
          className="group relative flex h-12 items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold text-[#A73F32] transition-colors hover:bg-[#A73F32]/8 active:bg-[#A73F32]/12"
          title="打开 luar 助手"
        >
          <div className="relative flex items-center justify-center">
            <Sparkles size={15} className="animate-pulse text-amber-200" />
          </div>
          <span className="tracking-tight">luar</span>
        </button>

        {/* Tab 2: 个人中心 (我的，内置购物车，附带红点角标与呼吸灯特效) */}
        <button
          onClick={() => selectTab('PROFILE')}
          className={`relative flex h-12 items-center justify-center gap-1.5 rounded-xl px-3 transition-colors ${
            mainTab === 'PROFILE'
              ? 'bg-[#181817] text-white font-semibold'
              : 'text-[#78746E] hover:text-[#181817]'
          }`}
          title="个人中心（含选品袋）"
        >
          {/* 柔和呼吸灯闪烁指示点 (仅在激活时呼吸闪烁) */}
          {mainTab === 'PROFILE' && (
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-75 duration-1000" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-300" />
            </span>
          )}

          <div className="relative flex items-center justify-center">
            <User size={15} strokeWidth={1.8} />

            {/* 购物车未结角标提示 */}
            {cartCount > 0 && mainTab !== 'PROFILE' && (
              <span className="absolute -top-1.5 -right-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[#A73F32] px-0.5 text-[8px] font-bold text-white shadow-xs">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </div>

          <span className="text-xs tracking-tight">我的</span>
        </button>
      </div>
    </nav>
  );
};

import React from 'react';
import { Search, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useOmnilink } from '../context/OmnilinkContext';

export const Header: React.FC = () => {
  const { setSearchOpen, openAiDrawer } = useOmnilink();

  return (
    <header className="sticky top-0 z-30 w-full bg-[#FFFFFF]/95 backdrop-blur-md border-b border-[#DED9D0]/60 shadow-2xs transition-colors">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-2.5">
        {/* Top Integrated Search Bar (顶部搜索框，点击唤起全局搜索空间) */}
        <div
          onClick={() => setSearchOpen(true)}
          className="flex-1 max-w-md flex items-center gap-2 rounded-full bg-[#F6F3EE] hover:bg-[#EAE5DC]/70 px-3.5 py-1.5 border border-[#DED9D0]/70 cursor-pointer shadow-2xs transition-all text-[#78746E]"
          role="search"
          aria-label="搜索空间美学、单品或品牌"
        >
          <Search size={14} className="text-[#78746E] shrink-0" />
          <span className="text-xs text-[#78746E]/70 truncate flex-1 select-none">
            搜索空间美学、单品、风格或品牌...
          </span>
        </div>

        {/* Quick AI Trigger Button */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => openAiDrawer()}
            className="flex items-center gap-1.5 h-8 px-3 rounded-full bg-[#A73F32]/10 text-[#A73F32] hover:bg-[#A73F32]/15 active:scale-95 transition-all text-xs font-semibold shadow-2xs"
            title="打开 luar 助手"
          >
            <Sparkles size={13} />
            <span className="text-xs font-semibold">luar</span>
          </button>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex h-8 min-h-8 shrink-0 items-center justify-center rounded-full border border-[#DED9D0] px-2.5 text-[10px] font-semibold text-[#181817] transition-colors hover:bg-[#EAE5DC]/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#A73F32] focus-visible:outline-offset-2 sm:px-3 sm:text-[11px]"
        >
          商家工作台
        </Link>
      </div>
    </header>
  );
};

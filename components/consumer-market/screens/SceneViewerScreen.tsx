import { DisplayPrice } from '../components/DisplayPrice';
import React, { useState } from 'react';
import {
  X,
  Play,
  Pause,
  Heart,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ScenePost, ProductItem } from '../types';
import { useOmnilink } from '../context/OmnilinkContext';
import { LiquidGlass } from '@/components/ui/liquid-glass';

interface SceneViewerScreenProps {
  scenePosts: ScenePost[];
  initialIndex: number;
  onClose: () => void;
  onOpenProductCard: (product: ProductItem) => void;
}

export const SceneViewerScreen: React.FC<SceneViewerScreenProps> = ({
  scenePosts,
  initialIndex,
  onClose,
  onOpenProductCard,
}) => {
  const { savedProductIds, toggleSaveProduct } = useOmnilink();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPlaying, setIsPlaying] = useState(true);

  const scene = scenePosts[currentIndex] || scenePosts[0];

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % scenePosts.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + scenePosts.length) % scenePosts.length);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white select-none animate-in fade-in duration-200">
      {/* Top Floating Control Bar */}
      <LiquidGlass tone="dark" radius={0} bevelDepth={20} aberration={0.18} frost={0.1} className="scene-viewer-top-glass absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-4 pt-safe">
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-white/10 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)]"
          aria-label="关闭场景预览"
        >
          <X size={18} />
        </button>

        {/* Scene index indicator & Up/Down navigation */}
        <div className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs">
          <button
            onClick={handlePrev}
            className="p-0.5 transition-colors"
            title="上一个空间"
          >
            <ChevronUp size={14} />
          </button>
          <span className="font-mono text-[11px]">
            {currentIndex + 1} / {scenePosts.length}
          </span>
          <button
            onClick={handleNext}
            className="p-0.5 transition-colors"
            title="下一个空间"
          >
            <ChevronDown size={14} />
          </button>
        </div>
      </LiquidGlass>

      {/* Main Full-screen Media Background */}
      <div className="relative flex-1 w-full overflow-hidden flex items-center justify-center">
        <img
          src={scene.coverImage}
          alt={scene.title}
          className="h-full w-full object-cover"
        />

        {/* Overlay Dark Gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/90 pointer-events-none" />

        {/* Video Play/Pause Touch Area */}
        {scene.isVideo && (
          <LiquidGlass radius={999} bevelDepth={14} aberration={0.2} frost={0.05} className="scene-viewer-play-glass absolute z-20 h-14 w-14 rounded-full">
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              aria-label={isPlaying ? '暂停视频' : '播放视频'}
              className="flex h-full w-full items-center justify-center rounded-full active:scale-90 transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)]"
            >
              {isPlaying ? (
                <Pause size={24} className="fill-current" />
              ) : (
                <Play size={24} className="ml-0.5 fill-current" />
              )}
            </button>
          </LiquidGlass>
        )}
      </div>

      {/* Bottom Scene Content & Linked Objects Area */}
      <div className="relative z-20 w-full bg-gradient-to-t from-black via-black/90 to-transparent p-5 pb-safe">
        {/* Editor Info & Title */}
        <div className="flex items-center gap-2.5 mb-2">
          <img
            src={scene.editorAvatar}
            alt={scene.editorName}
            className="h-8 w-8 rounded-full border border-white/30 object-cover"
          />
          <div className="flex min-w-0 items-baseline gap-2 whitespace-nowrap">
            <span className="truncate text-xs font-semibold text-white/90">{scene.editorName}</span>
            <span className="shrink-0 text-xs text-white/60">空间策展人</span>
          </div>
        </div>

        <h3 className="font-editorial text-xl font-bold text-white leading-snug">
          {scene.title}
        </h3>
        <p className="mt-1 text-xs text-white/80 line-clamp-2 leading-relaxed">
          {scene.description}
        </p>

        {/* Linked Shoppable Objects Shelf */}
        {scene.linkedProducts.length > 0 && (
          <div className="mt-3.5 pt-3 border-t border-white/15">
            <div className="pb-2 text-xs font-medium text-white/70">搭配单品（{scene.linkedProducts.length}）</div>

            {/* Horizontal Linked Products Scroll */}
            <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
              {scene.linkedProducts.map((prod) => {
                const isSaved = savedProductIds.includes(prod.id);
                return (
                  <div
                    key={prod.id}
                    className="relative flex min-w-[210px] max-w-[240px] shrink-0 items-center gap-1 rounded-xl border-[0.5px] border-white/15 bg-white/10 p-2"
                  >
                    <button
                      type="button"
                      onClick={() => onOpenProductCard(prod)}
                      aria-label={`查看商品卡片：${prod.name}`}
                      className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    >
                      <img src={prod.mainImage} alt="" className="h-11 w-11 shrink-0 rounded-lg bg-neutral-800 object-cover" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-white">{prod.name}</span>
                        <span className="block text-xs text-white/80"><DisplayPrice product={prod} /></span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleSaveProduct(prod.id)}
                      aria-label={isSaved ? `取消收藏：${prod.name}` : `收藏：${prod.name}`}
                      aria-pressed={isSaved}
                      title={isSaved ? '取消收藏' : '收藏'}
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${isSaved ? 'text-[var(--palette-orange)]' : 'text-white'}`}
                    >
                      <Heart size={18} fill={isSaved ? 'currentColor' : 'none'} aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

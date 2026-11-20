import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Star,
  MoreVertical,
  Heart,
  Play,
} from 'lucide-react';
import { getDiscoveryType, type ProductItem } from '../types';
import { useOmnilink } from '../context/OmnilinkContext';
import { DisplayPrice } from '../components/DisplayPrice';

interface ProductDetailScreenProps {
  product: ProductItem;
  onClose: () => void;
  onOpenStore: (product: ProductItem) => void;
  onOpenReviews: () => void;
}

function initialSelectedOptions(product: ProductItem): Record<string, string> {
  const defaultVariant = product.variants?.find((variant) => variant.id === product.defaultVariantId);
  return Object.fromEntries((product.options ?? []).map((option) => {
    const firstValue = option.values[0];
    return [option.code, defaultVariant?.optionValues[option.code] ?? defaultVariant?.optionValues[option.name] ?? (typeof firstValue === 'string' ? firstValue : firstValue?.name ?? '')];
  }));
}

export const ProductDetailScreen: React.FC<ProductDetailScreenProps> = ({
  product,
  onClose,
  onOpenStore,
  onOpenReviews,
}) => {
  const {
    showToast,
    savedProductIds,
    toggleSaveProduct,
  } = useOmnilink();
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() => initialSelectedOptions(product));

  // 去除外边滚动：在模态打开时锁定背景滚动
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  const images = [product.mainImage, ...product.secondaryImages];
  const discoveryType = getDiscoveryType(product);
  const isPhysicalProduct = discoveryType === '商品';
  const isAiCapability = product.deliveryType === 'ai_capability';
  const capabilityKindLabel = product.capabilityKind === 'question_set' ? '测试题' : product.capabilityKind === 'plugin' ? '插件' : '技能';
  const isSaved = savedProductIds.includes(product.id);
  const averageRating = product.reviews.length
    ? product.reviews.reduce((sum, review) => sum + review.rating, 0) / product.reviews.length
    : null;
  const options = product.options ?? [];
  const selectedVariant = options.length
    ? product.variants?.find((variant) => options.every((option) =>
        (variant.optionValues[option.code] ?? variant.optionValues[option.name]) === selectedOptions[option.code]
      ))
    : product.variants?.find((variant) => variant.id === product.defaultVariantId);
  const selectedPrice = selectedVariant?.price ?? product.price;
  const invalidSelection = Boolean(options.length && product.variants?.length && !selectedVariant);
  const formattedPrice = product.priceMode === 'unknown' ? product.formattedPrice : product.priceMode === 'inquiry' ? '询价' : product.priceMode === 'free' || selectedPrice === 0 ? '免费' : null;
  const outboundLinks = Object.entries(product.outboundLinks ?? {}).filter((entry): entry is ['xiaohongshu' | 'douyin', string] => Boolean(entry[1]));

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: product.name,
          text: product.shortDescription,
          url: window.location.href,
        })
        .catch(() => {});
    } else {
      navigator.clipboard?.writeText(window.location.href);
      showToast('链接已复制到剪贴板');
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-white text-[var(--market-ink)] select-none animate-in fade-in duration-200 overflow-hidden">
      {/* 内部独立滚动区域 */}
      <div className="flex-1 overflow-y-auto overscroll-contain pb-28">
        <div className="mx-auto max-w-md px-4 pt-3">
          {/* 商品图片区域：四个角为大圆角/半圆，无分割线，底部距离 1px */}
          <div className="w-full pb-[1px]">
            <div className="relative w-full aspect-4/5 overflow-hidden rounded-3xl bg-[var(--market-surface-raised)] shadow-xs">
              {product.videoUrl && activeImageIdx === 0 && isVideoPlaying ? (
                <video
                  src={product.videoUrl}
                  poster={product.mainImage}
                  controls
                  autoPlay
                  playsInline
                  onEnded={() => setIsVideoPlaying(false)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <img
                  src={images[activeImageIdx % images.length]}
                  alt={product.name}
                  className="h-full w-full object-cover transition-opacity duration-300"
                />
              )}
              {product.videoUrl && activeImageIdx === 0 && !isVideoPlaying && (
                <button
                  type="button"
                  onClick={() => setIsVideoPlaying(true)}
                  aria-label="播放商品视频"
                  className="absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[var(--market-ink)] shadow-md"
                >
                  <Play size={18} fill="currentColor" aria-hidden="true" />
                </button>
              )}

              {/* 浮动返回与分享按钮：高透磨砂玻璃质感 */}
              <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-3.5 pointer-events-none">
                <button
                  onClick={onClose}
                  data-glasswork="auto"
                  className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full active:scale-95 transition-transform"
                  aria-label="返回"
                >
                  <ArrowLeft size={18} />
                </button>

                <button
                  onClick={handleShare}
                  data-glasswork="auto"
                  className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full active:scale-95 transition-transform"
                  title="更多操作"
                >
                  <MoreVertical size={18} />
                </button>
              </div>

              {/* 轮播圆点指示器 */}
              {images.length > 1 && (
                <div className="absolute bottom-2 left-0 right-0 flex justify-center items-center gap-1">
                  {images.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveImageIdx(idx)}
                      aria-label={`查看第 ${idx + 1} 张图片`}
                      aria-current={idx === activeImageIdx ? 'true' : undefined}
                      className="flex h-8 w-8 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)]"
                    ><span aria-hidden="true" className={`rounded-full bg-white ${idx === activeImageIdx ? 'h-2 w-2 shadow-sm ring-2 ring-black/20' : 'h-1.5 w-1.5 opacity-60'}`} /></button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 图片下方平铺排版（完全无卡片、无卡片外框、无卡片底色） */}
          <div className="pt-3 px-1">
            {/* 品牌 / 创作者与收藏按钮栏 */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => onOpenStore(product)}
                className="group flex min-h-11 min-w-0 flex-1 items-center gap-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--market-accent)]"
                aria-label={`进入${product.storeName}主页`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--market-surface)] border border-[var(--market-border)] text-xs font-bold text-[var(--market-ink)] shadow-2xs group-hover:border-[var(--market-accent)] transition-colors">
                  {product.storeName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[var(--market-ink)] group-hover:text-[var(--market-accent)] transition-colors">
                    {product.storeName}
                  </h4>
                </div>
              </button>

              <button
                onClick={() => toggleSaveProduct(product.id)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--market-text-muted)] hover:text-[var(--market-accent)] active:scale-90 transition-all"
                title="收藏"
              >
                <Heart
                  size={20}
                  className={isSaved ? 'fill-[var(--market-accent)] text-[var(--market-accent)]' : 'text-[var(--market-text-muted)]'}
                />
              </button>
            </div>

            {/* 单品名称与价格 (左右排版) */}
            <div className="mt-3 flex items-start justify-between gap-4">
              <h1 className="text-lg font-bold text-[var(--market-ink)] leading-snug flex-1">
                {product.name}
              </h1>
              <span className="text-lg font-bold text-[var(--market-ink)] shrink-0">
                {invalidSelection ? '暂无此规格' : formattedPrice ?? <DisplayPrice product={product} amount={selectedPrice} currency={selectedVariant?.currency ?? product.currency} />}
              </span>
            </div>

            {isAiCapability && (
              <div className="mt-4 rounded-2xl border border-[var(--market-border)] bg-[var(--market-surface-muted)] p-4">
                <p className="text-xs font-semibold">数字交付：{capabilityKindLabel}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--market-text-secondary)]">当前仅展示，尚未开放使用。可用的技能将在「我的插件」中提供入口。</p>
              </div>
            )}

            {/* 评分行 */}
            {averageRating ? <button type="button" onClick={onOpenReviews} aria-label={`查看 ${product.reviews.length} 条评价，评分 ${averageRating.toFixed(1)}`} className="mt-2 flex min-h-9 items-center gap-1.5 rounded-md text-xs focus-visible:outline-2 focus-visible:outline-[var(--market-support)]">
              <div className="flex items-center text-amber-500">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={13} fill={averageRating && i < Math.round(averageRating) ? 'currentColor' : 'none'} />
                ))}
              </div>
              <span className="font-bold text-[var(--market-ink)]">{averageRating.toFixed(1)}</span>
              <span className="text-[var(--market-text-muted)] hover:underline">({product.reviews.length} 条评价)</span>
            </button> : <div className="mt-2 flex min-h-9 items-center gap-1.5 text-xs text-[var(--market-text-muted)]">暂无评价</div>}

            {isPhysicalProduct && <div className="mt-4" aria-label="商品规格选择">
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--market-text-muted)]">选择规格</h3>
              {options.length ? options.map((option) => (
                <div key={option.id} className="mb-3">
                  <p className="mb-1.5 text-xs text-[var(--market-text-muted)]">{option.name}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {option.values.map((value) => {
                      const name = typeof value === 'string' ? value : value.name;
                      const active = selectedOptions[option.code] === name;
                      const available = !product.variants?.length || product.variants.some((variant) => (variant.optionValues[option.code] ?? variant.optionValues[option.name]) === name);
                      return <button
                        key={name}
                        type="button"
                        aria-pressed={active}
                        disabled={!available}
                        onClick={() => setSelectedOptions((current) => {
                          const desired = { ...current, [option.code]: name };
                          if (!product.variants?.length) return desired;
                          const exact = product.variants.find((variant) => options.every((item) => (variant.optionValues[item.code] ?? variant.optionValues[item.name]) === desired[item.code]));
                          if (exact) return desired;
                          const fallback = product.variants.find((variant) => (variant.optionValues[option.code] ?? variant.optionValues[option.name]) === name);
                          return fallback ? Object.fromEntries(options.map((item) => [item.code, fallback.optionValues[item.code] ?? fallback.optionValues[item.name] ?? desired[item.code]])) : current;
                        })}
                        className={`inline-flex min-h-9 items-center justify-center rounded-full border px-4 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--market-accent)] disabled:cursor-not-allowed disabled:opacity-40 ${active ? 'border-[var(--market-accent)] bg-[var(--market-accent)]/5 font-semibold text-[var(--market-accent)]' : 'border-[var(--market-border)] text-[var(--market-text-secondary)] hover:border-[var(--market-accent)]'}`}
                      >{name}</button>;
                    })}
                  </div>
                </div>
              )) : <button type="button" aria-pressed="true" className="inline-flex h-9 items-center justify-center rounded-full border border-[var(--market-accent)] bg-[var(--market-accent)]/5 px-4 text-xs font-semibold text-[var(--market-accent)]">标准款</button>}
            </div>}

            {isPhysicalProduct && Object.keys(product.specs).length > 0 && <div className="mt-5">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--market-text-muted)] mb-1.5">
                单品规格与参数
              </h3>
              <table className="w-full text-xs border-collapse">
                <tbody>
                  {Object.entries(product.specs).map(([key, val], idx) => (
                    <tr
                      key={key}
                      className={
                        idx === 0
                          ? 'border-y border-[var(--market-border)]/60'
                          : 'border-b border-[var(--market-border)]/60'
                      }
                    >
                      <td className="py-2 pr-4 text-[var(--market-text-muted)] font-medium w-1/3">
                        {key}
                      </td>
                      <td className="py-2 text-[var(--market-ink)] font-semibold text-right">
                        {val}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}

            {/* 商品详情 */}
            <div className="mt-5">
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--market-text-muted)]">{discoveryType === '服务' ? '服务说明' : discoveryType === '数字' ? '内容详情' : '商品详情'}</h3>
              <p className="text-xs leading-6 text-[var(--market-text-secondary)]">
                {product.contextStory || product.aiSummary || product.shortDescription}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* External channel handoff */}
      <footer className="fixed bottom-0 left-0 right-0 z-30 bg-[var(--market-surface-muted)]/95 text-white backdrop-blur-md border-t border-[var(--market-border)]/60 px-5 py-3 pb-safe shadow-lg">
        <div className="mx-auto flex max-w-md items-center gap-3">
          {outboundLinks.length ? outboundLinks.map(([platform, url], index) => (
            <a key={platform} href={url} target="_blank" rel="noopener noreferrer" className={`flex h-11 min-w-0 flex-1 items-center justify-center rounded-[var(--radius-control)] px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)] ${index === 0 ? 'bg-[var(--market-accent)] text-white' : 'border border-[var(--market-border)] bg-white text-[var(--market-ink)]'}`}>
              前往{platform === 'xiaohongshu' ? '小红书' : '抖音'}查看
            </a>
          )) : <button type="button" onClick={() => onOpenStore(product)} className="flex h-11 w-full items-center justify-center rounded-full bg-[var(--market-ink)] px-4 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)]">查看店铺</button>}
        </div>
      </footer>
    </div>
  );
};

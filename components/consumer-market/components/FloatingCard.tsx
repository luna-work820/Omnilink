import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Heart,
  X,
} from 'lucide-react';
import { ProductItem } from '../types';
import { useOmnilink } from '../context/OmnilinkContext';
import { DisplayPrice } from './DisplayPrice';

interface FloatingProductCardProps {
  product: ProductItem | null;
  onDismiss: () => void;
  onExpandDetail: (product: ProductItem) => void;
}

export const FloatingCard: React.FC<FloatingProductCardProps> = ({
  product,
  onDismiss,
  onExpandDetail,
}) => {
  const { products, savedProductIds, toggleSaveProduct } = useOmnilink();
  const [activeProductId, setActiveProductId] = useState<string>(
    product?.id || ''
  );
  const [slideDirection, setSlideDirection] = useState<'down' | 'up' | 'none'>('none');

  // The parent keys this overlay by product id so the active selection resets on open.
  useEffect(() => {
    const originalOverflow = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Find active product
  const activeProduct = useMemo(() => {
    return products.find((p) => p.id === activeProductId) || product;
  }, [products, activeProductId, product]);

  // Filter products in the same category for vertical sliding
  const sameCategoryProducts = useMemo(() => {
    if (!activeProduct) return [];
    const matched = products.filter(
      (p) =>
        p.category.toLowerCase() === activeProduct.category.toLowerCase() ||
        p.id === activeProduct.id
    );
    return matched.length > 0 ? matched : products;
  }, [products, activeProduct]);

  const currentIndex = useMemo(() => {
    if (!activeProduct) return 0;
    const idx = sameCategoryProducts.findIndex((p) => p.id === activeProduct.id);
    return idx >= 0 ? idx : 0;
  }, [sameCategoryProducts, activeProduct]);

  // Switch to next same-category product
  const goToNextProduct = () => {
    if (sameCategoryProducts.length <= 1) return;
    setSlideDirection('down');
    const nextIdx = (currentIndex + 1) % sameCategoryProducts.length;
    setActiveProductId(sameCategoryProducts[nextIdx].id);
  };

  // Switch to previous same-category product
  const goToPrevProduct = () => {
    if (sameCategoryProducts.length <= 1) return;
    setSlideDirection('up');
    const prevIdx =
      (currentIndex - 1 + sameCategoryProducts.length) %
      sameCategoryProducts.length;
    setActiveProductId(sameCategoryProducts[prevIdx].id);
  };

  // Touch gesture handling
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const hasMovedRef = useRef<boolean>(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
    };
    hasMovedRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.touches[0];
    const diffX = touch.clientX - touchStartRef.current.x;
    const diffY = touch.clientY - touchStartRef.current.y;

    if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
      hasMovedRef.current = true;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || !activeProduct) return;
    const touch = e.changedTouches[0];
    const diffX = touch.clientX - touchStartRef.current.x;
    const diffY = touch.clientY - touchStartRef.current.y;
    touchStartRef.current = null;
    if ((e.target as HTMLElement).closest('button')) return;

    // Vertical swipe down: Browse next same-category product
    if (diffY > 40 && Math.abs(diffY) > Math.abs(diffX)) {
      goToNextProduct();
      return;
    }

    // Vertical swipe up: Browse previous same-category product
    if (diffY < -40 && Math.abs(diffY) > Math.abs(diffX)) {
      goToPrevProduct();
      return;
    }

  };

  // Mouse wheel vertical navigation
  const handleWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaY) > 30) {
      if (e.deltaY > 0) {
        goToNextProduct();
      } else {
        goToPrevProduct();
      }
    }
  };

  if (!activeProduct) return null;
  const isSaved = savedProductIds.includes(activeProduct.id);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 select-none animate-in fade-in duration-200"
      onClick={onDismiss}
    >
      {/* Container to prevent backdrop click closing when touching card */}
      <div
        className="relative flex flex-col items-center max-w-full"
        onClick={(e) => e.stopPropagation()}
        onWheel={handleWheel}
      >
        {/* Position and close control */}
        <div className="w-full flex items-center justify-between pb-2 px-1 text-white/90 text-[11px] font-medium">
          <div data-glasswork="auto" className="rounded-full px-2.5 py-1 font-semibold" aria-label={`第 ${currentIndex + 1} 件，共 ${sameCategoryProducts.length} 件`}>
            {currentIndex + 1}/{sameCategoryProducts.length}
          </div>

          <button
            onClick={onDismiss}
            data-glasswork="auto"
            className="flex h-7 w-7 items-center justify-center rounded-full active:scale-90 transition-transform"
            aria-label="关闭商品卡片"
          >
            <X size={15} />
          </button>
        </div>

        {/* 垂直居中竖长条卡片主体 (Slim Vertical Card) */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={() => {
            if (!hasMovedRef.current) {
              onExpandDetail(activeProduct);
              onDismiss();
            }
          }}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              goToNextProduct();
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              goToPrevProduct();
            } else if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onExpandDetail(activeProduct);
              onDismiss();
            }
          }}
          role="group"
          tabIndex={0}
          aria-label={`${activeProduct.name}，上下方向键切换商品，回车查看详情`}
          className="relative w-[84vw] max-w-[310px] h-[70vh] max-h-[540px] min-h-[460px] rounded-2xl bg-[var(--market-surface)] shadow-2xl flex flex-col overflow-hidden cursor-pointer transition-all duration-300 active:scale-[0.99] border border-[var(--market-border)]/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <div className="floating-storefront-sign flex h-12 shrink-0 items-center justify-center border-b border-[var(--market-border)] bg-[var(--market-surface-muted)] px-4 text-center text-[13px] font-semibold tracking-[0.08em] text-[var(--market-ink)]">
            <span className="h-px min-w-4 flex-1 bg-[var(--market-border)]" aria-hidden="true" />
            <span className="mx-3 truncate border-x border-[var(--market-border)] px-3">{activeProduct.storeName}</span>
            <span className="h-px min-w-4 flex-1 bg-[var(--market-border)]" aria-hidden="true" />
          </div>

          {/* Upper Image Section */}
          <div className="relative flex-1 w-full overflow-hidden bg-[var(--market-surface-muted)]">
            <img
              key={activeProduct.id}
              src={activeProduct.mainImage}
              alt={activeProduct.name}
              className={`h-full w-full object-cover transition-all duration-300 ${
                slideDirection === 'down'
                  ? 'animate-in slide-in-from-top-4 duration-300'
                  : slideDirection === 'up'
                  ? 'animate-in slide-in-from-bottom-4 duration-300'
                  : ''
              }`}
              loading="lazy"
            />

            <div className="absolute left-3 top-3">
              <span className="rounded-full bg-white/90 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-bold text-[var(--market-ink)] shadow-xs">
                {activeProduct.category}
              </span>
            </div>
          </div>

          {/* Lower Information Section */}
          <div className="p-3.5 bg-[var(--market-surface)] flex flex-col justify-between shrink-0 border-t border-[var(--market-border)]/50">
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-bold text-[var(--market-ink)] truncate flex-1">
                  {activeProduct.name}
                </h3>
                <span className="text-sm font-bold text-[var(--market-ink)] shrink-0">
                  <DisplayPrice product={activeProduct} />
                </span>
              </div>

              {activeProduct.creator && activeProduct.creator !== activeProduct.storeName ? (
                <p className="mt-0.5 truncate text-[11px] font-normal text-[var(--market-text-muted)]">
                  {activeProduct.creator}
                </p>
              ) : null}
            </div>

            <p className="mt-2 line-clamp-2 text-[11px] font-normal leading-relaxed text-[var(--market-text-secondary)]">
              {activeProduct.aiSummary}
            </p>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                if (!isSaved) toggleSaveProduct(activeProduct.id);
                onExpandDetail(activeProduct);
                onDismiss();
              }}
              aria-label={isSaved ? '已收藏，查看详情' : '收藏并查看详情'}
              aria-pressed={isSaved}
              className={`mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-full text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)] ${isSaved ? 'bg-[var(--market-surface-muted)] text-[var(--palette-orange)]' : 'bg-[var(--market-ink)] text-white'}`}
            >
              <Heart aria-hidden="true" size={17} fill="currentColor" strokeWidth={1.5} />
              {isSaved ? '已收藏' : '收藏'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

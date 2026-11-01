import React from 'react';
import { Heart } from 'lucide-react';
import { useOmnilink } from '../context/OmnilinkContext';
import { getDiscoveryType } from '../types';

export const FavoritesScreen: React.FC = () => {
  const { products, savedProductIds, toggleSaveProduct, openProductDetail, selectTab } = useOmnilink();
  const savedProducts = products.filter((product) => savedProductIds.includes(product.id));

  return (
    <div className="min-h-screen w-full bg-[var(--market-canvas)] px-4 pb-32 pt-6 text-[var(--market-ink)] sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold">收藏</h1>
          <span className="text-sm text-[var(--market-text-muted)]">{savedProducts.length} 项</span>
        </div>
        {savedProducts.length === 0 ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
            <Heart aria-hidden="true" className="h-8 w-8 text-[var(--market-text-muted)]" fill="currentColor" strokeWidth={1.5} />
            <p className="text-sm text-[var(--market-text-muted)]">还没有收藏的内容</p>
            <button type="button" onClick={() => { selectTab('WORLD'); window.scrollTo(0, 0); }} className="min-h-11 rounded-full bg-[var(--market-ink)] px-5 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)]">去发现</button>
          </div>
        ) : (
          <ul className="mt-5 divide-y-[0.5px] divide-[var(--market-border)]">
            {savedProducts.map((product) => (
              <li key={product.id} className="flex items-center gap-2 py-3 sm:gap-4">
                <button type="button" onClick={() => openProductDetail(product)} className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)] sm:gap-5">
                  <img src={product.mainImage} alt="" className="h-28 w-24 shrink-0 rounded-lg bg-[var(--market-surface-muted)] object-cover sm:h-32 sm:w-28" />
                  <span className="min-w-0 self-stretch py-1">
                    <span className="block text-xs text-[var(--market-text-muted)]">{getDiscoveryType(product)}</span>
                    <span className="mt-2 block line-clamp-2 text-sm font-semibold">{product.name}</span>
                    <span className="mt-1 block truncate text-xs text-[var(--market-text-muted)]">{product.storeName}</span>
                    <span className="mt-3 block text-sm font-medium">{product.formattedPrice}</span>
                  </span>
                </button>
                <button type="button" onClick={() => toggleSaveProduct(product.id)} aria-label={`取消收藏：${product.name}`} title="取消收藏" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--palette-orange)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)]">
                  <Heart aria-hidden="true" className="h-5 w-5" fill="currentColor" strokeWidth={1.5} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

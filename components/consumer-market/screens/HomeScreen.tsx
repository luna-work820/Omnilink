import React from 'react';
import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { useOmnilink } from '../context/OmnilinkContext';
import { ProductItem, ScenePost, Exhibition } from '../types';

export const HomeScreen: React.FC = () => {
  const {
    feedItems,
    exhibitions,
    openExhibition,
    openFloatingProduct,
    openScenePost,
  } = useOmnilink();

  const leftColumn = feedItems.filter((_, idx) => idx % 2 === 0);
  const rightColumn = feedItems.filter((_, idx) => idx % 2 !== 0);

  return (
    <div className="min-h-dvh w-full bg-[#F6F3EE] pb-28 pt-2">
      {/* 顶部策展大卡横滑区 (保留高透磨砂玻璃策展卡片，无冗余文字标题与分类标签) */}
      <section className="px-2 pb-2.5 sm:px-2.5">
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar snap-x snap-mandatory">
          {exhibitions.map((exhibition) => (
            <ExhibitionCard
              key={exhibition.id}
              exhibition={exhibition}
              onClick={() => openExhibition(exhibition)}
            />
          ))}
        </div>
      </section>

      {/* Main Waterfall Feed (缩近卡片间距 gap-1.5, 统一白色底部, 4px边框, 单行商品名, 低调价格) */}
      <section className="px-2 sm:px-2.5">
        <div className="grid grid-cols-2 gap-1.5">
          {/* Left Column */}
          <div className="flex flex-col gap-1.5">
            {leftColumn.map((item, idx) =>
              item.type === 'product' ? (
                <FeedProductCard
                  key={`p-l-${item.product.id}-${idx}`}
                  product={item.product}
                  onClick={() => openFloatingProduct(item.product)}
                />
              ) : (
                <FeedSceneCard
                  key={`s-l-${item.scenePost.id}-${idx}`}
                  scenePost={item.scenePost}
                  onClick={() => openScenePost(item.scenePost)}
                />
              )
            )}
          </div>

          {/* Right Column */}
          <div className="flex flex-col gap-1.5">
            {rightColumn.map((item, idx) =>
              item.type === 'product' ? (
                <FeedProductCard
                  key={`p-r-${item.product.id}-${idx}`}
                  product={item.product}
                  onClick={() => openFloatingProduct(item.product)}
                />
              ) : (
                <FeedSceneCard
                  key={`s-r-${item.scenePost.id}-${idx}`}
                  scenePost={item.scenePost}
                  onClick={() => openScenePost(item.scenePost)}
                />
              )
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

/**
 * 策展卡片 (Full-bleed Background & Hyper-translucent Frosted Glass Pane)
 */
const ExhibitionCard: React.FC<{
  exhibition: Exhibition;
  onClick: () => void;
}> = ({ exhibition, onClick }) => {
  return (
    <div
      onClick={onClick}
      className="group relative h-48 w-[74vw] max-w-[280px] shrink-0 snap-start cursor-pointer overflow-hidden rounded-xl shadow-xs select-none active:scale-[0.99] transition-transform duration-200 border border-white/20"
    >
      {/* Full-bleed 100% Background Photo (Never Truncated) */}
      <img
        src={exhibition.coverImage}
        alt={exhibition.title}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        loading="lazy"
      />

      {/* Floating Hyper-Translucent Frosted Glass Pane */}
      <div
        className="absolute bottom-0 inset-x-0 p-3.5 flex flex-col justify-end"
        style={{
          backgroundImage: 'linear-gradient(to bottom, rgba(35, 34, 29, 0) 0%, rgba(35, 34, 29, 0.168) 28%, rgba(35, 34, 29, 0.816) 100%)',
          backdropFilter: 'blur(0.96px) saturate(110%)',
          WebkitBackdropFilter: 'blur(0.96px) saturate(110%)',
        }}
      >
        <span className="text-[9px] uppercase font-bold tracking-widest text-[#A73F32] bg-white/95 w-fit px-1.5 py-0.5 rounded-xs shadow-2xs">
          策展专栏
        </span>
        <h3 className="mt-1.5 font-editorial text-sm font-bold text-[#FFFFFF] leading-tight drop-shadow-sm truncate">
          {exhibition.title}
        </h3>
        <p className="mt-0.5 text-[10px] truncate font-medium text-[#FFFFFF]/90 drop-shadow-2xs">
          {exhibition.subtitle}
        </p>
      </div>
    </div>
  );
};

/**
 * 瀑布流商品卡片：
 * 1. 统一纯白底部卡片 (#FFFFFF)
 * 2. 边框 4px 距离 (p-[4px])
 * 3. 商品名始终保持只有一行 (truncate, leading-tight, #181817)
 * 4. 价格降低存在感 (#78746E)
 */
const FeedProductCard: React.FC<{
  product: ProductItem;
  onClick: () => void;
}> = ({ product, onClick }) => {
  return (
    <div
      className="group relative w-full overflow-hidden rounded-xl bg-[#FFFFFF] p-[4px] select-none shadow-2xs hover:shadow-xs transition-all duration-200 flex flex-col border border-[#DED9D0]/40"
    >
      {product.storeSlug ? (
        <Link
          href={`/store/${encodeURIComponent(product.storeSlug)}`}
          className="flex min-h-11 items-center truncate px-1.5 text-[11px] font-medium text-[#78746E] hover:text-[#A73F32] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#A73F32]"
          aria-label={`进入${product.storeName}的网页`}
        >
          {product.storeName}
        </Link>
      ) : (
        <div className="flex min-h-11 items-center truncate px-1.5 text-[11px] font-medium text-[#78746E]">
          {product.storeName}
        </div>
      )}

      <button
        type="button"
        onClick={onClick}
        aria-label={`查看商品：${product.name}`}
        className="block w-full cursor-pointer text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#A73F32]"
      >
      {/* 图片展示区 (4px 边距内衬) */}
      <div className="relative w-full overflow-hidden rounded-lg bg-[#F6F3EE]">
        <img
          src={product.mainImage}
          alt={product.name}
          className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-103 block"
          loading="lazy"
        />
      </div>

      {/* 统一纯白底部信息区 */}
      <div className="px-1.5 pt-2 pb-1.5 flex flex-col justify-between">
        {/* 商品名始终保持只有一行 */}
        <h4 className="truncate text-xs font-medium text-[#181817] leading-tight">
          {product.name}
        </h4>

        {/* 价格保持在标题下方，店名显示于商品图上方。 */}
        <div className="mt-1 flex justify-end text-[11px] text-[#78746E]">
          <span className="shrink-0 font-normal text-[#78746E]/90 text-[11px]">
            {product.formattedPrice}
          </span>
        </div>
      </div>
      </button>
    </div>
  );
};

/**
 * 瀑布流场景卡片：
 * 1. 统一纯白底部卡片 (#FFFFFF)
 * 2. 边框 4px 距离 (p-[4px])
 * 3. 标题始终保持只有一行 (truncate, #181817)
 * 4. 购物袋数量无 button，低调纯净 (#78746E)
 */
const FeedSceneCard: React.FC<{
  scenePost: ScenePost;
  onClick: () => void;
}> = ({ scenePost, onClick }) => {
  const productCount = scenePost.linkedProducts?.length || 0;

  return (
    <div
      onClick={onClick}
      className="group relative w-full overflow-hidden rounded-xl bg-[#FFFFFF] p-[4px] cursor-pointer select-none shadow-2xs hover:shadow-xs active:scale-[0.98] transition-all duration-200 flex flex-col border border-[#DED9D0]/40"
    >
      {/* 场景图片展示区 (4px 边距内衬) */}
      <div className="relative w-full overflow-hidden rounded-lg bg-[#F6F3EE]">
        <img
          src={scenePost.coverImage}
          alt={scenePost.title}
          className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-103 block"
          loading="lazy"
        />
      </div>

      {/* 统一纯白底部信息区 */}
      <div className="px-1.5 pt-2 pb-1.5 flex flex-col justify-between">
        {/* 标题始终保持只有一行 */}
        <h4 className="truncate text-xs font-medium text-[#181817] leading-tight">
          {scenePost.title}
        </h4>

        {/* 策展人与低调购物袋计数 (无 button) */}
        <div className="mt-1 flex items-baseline justify-between gap-1 text-[11px] text-[#78746E]">
          <span className="truncate flex-1 min-w-0 font-normal">
            {scenePost.editorName}
          </span>
          {productCount > 0 && (
            <span className="shrink-0 flex items-center gap-1 font-normal text-[#78746E] text-[11px]">
              <ShoppingBag size={11} className="text-[#78746E]/80" />
              <span>{productCount}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

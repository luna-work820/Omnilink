import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Star,
  Send,
  ShoppingBag,
  MoreVertical,
  Heart,
  ShieldCheck,
  Store,
  ChevronRight,
} from 'lucide-react';
import { ProductItem } from '../types';
import { useOmnilink } from '../context/OmnilinkContext';

interface ProductDetailScreenProps {
  product: ProductItem;
  onClose: () => void;
  onOpenStore: (product: ProductItem) => void;
  onOpenReviews: () => void;
  onAddToCart: (product: ProductItem) => void;
}

export const ProductDetailScreen: React.FC<ProductDetailScreenProps> = ({
  product,
  onClose,
  onOpenStore,
  onOpenReviews,
  onAddToCart,
}) => {
  const {
    qnaHistory,
    askProductQna,
    showToast,
    savedProductIds,
    toggleSaveProduct,
  } = useOmnilink();
  const [qnaInput, setQnaInput] = useState('');
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  // 去除外边滚动：在模态打开时锁定背景滚动
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  const images = [product.mainImage, ...product.secondaryImages];
  const qnaList = qnaHistory[product.id] || [];
  const isSaved = savedProductIds.includes(product.id);
  const averageRating = product.reviews.length
    ? product.reviews.reduce((sum, review) => sum + review.rating, 0) / product.reviews.length
    : null;

  const handleSendQna = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!qnaInput.trim()) return;
    askProductQna(product.id, qnaInput.trim());
    setQnaInput('');
  };

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
      showToast('单品链接已复制到剪贴板');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#F6F3EE] text-[#181817] select-none animate-in fade-in duration-200 overflow-hidden">
      {/* 内部独立滚动区域 */}
      <div className="flex-1 overflow-y-auto overscroll-contain pb-28">
        <div className="mx-auto max-w-md px-4 pt-3">
          {/* 商品图片区域：四个角为大圆角/半圆，无分割线，底部距离 1px */}
          <div className="w-full pb-[1px]">
            <div className="relative w-full aspect-4/5 overflow-hidden rounded-3xl bg-[#EAE5DC] shadow-xs">
              <img
                src={images[activeImageIdx % images.length]}
                alt={product.name}
                className="h-full w-full object-cover transition-opacity duration-300"
              />

              {/* 浮动返回与分享按钮：高透磨砂玻璃质感 */}
              <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-3.5 pointer-events-none">
                <button
                  onClick={onClose}
                  className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-black/25 backdrop-blur-md text-white border border-white/25 shadow-xs hover:bg-black/40 active:scale-95 transition-all"
                  aria-label="返回"
                >
                  <ArrowLeft size={18} />
                </button>

                <button
                  onClick={handleShare}
                  className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-black/25 backdrop-blur-md text-white border border-white/25 shadow-xs hover:bg-black/40 active:scale-95 transition-all"
                  title="更多操作"
                >
                  <MoreVertical size={18} />
                </button>
              </div>

              {/* 轮播圆点指示器 */}
              {images.length > 1 && (
                <div className="absolute bottom-3.5 left-0 right-0 flex justify-center items-center gap-1.5">
                  {images.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveImageIdx(idx)}
                      aria-label={`查看第 ${idx + 1} 张图片`}
                      className={`rounded-full transition-all duration-300 ${
                        idx === activeImageIdx
                          ? 'h-2 w-2 bg-white shadow-sm ring-2 ring-black/20'
                          : 'h-1.5 w-1.5 bg-white/60'
                      }`}
                    />
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
                className="group flex min-h-11 items-center gap-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#A73F32]"
                aria-label={`进入${product.storeName}的网页`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FFFFFF] border border-[#DED9D0] text-xs font-bold text-[#181817] shadow-2xs group-hover:border-[#A73F32] transition-colors">
                  {product.storeName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#181817] group-hover:text-[#A73F32] transition-colors">
                    {product.storeName}
                  </h4>
                  <p className="text-[11px] text-[#78746E]">
                    @{product.creator}
                  </p>
                </div>
              </button>

              <button
                onClick={() => toggleSaveProduct(product.id)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[#78746E] hover:text-[#A73F32] active:scale-90 transition-all"
                title="收藏"
              >
                <Heart
                  size={20}
                  className={isSaved ? 'fill-[#A73F32] text-[#A73F32]' : 'text-[#78746E]'}
                />
              </button>
            </div>

            {/* 单品名称与价格 (左右排版) */}
            <div className="mt-3 flex items-start justify-between gap-4">
              <h1 className="text-lg font-bold text-[#181817] leading-snug flex-1">
                {product.name}
              </h1>
              <span className="text-lg font-bold text-[#181817] shrink-0">
                {product.formattedPrice}
              </span>
            </div>

            {/* 评分行 */}
            <div
              onClick={averageRating ? onOpenReviews : undefined}
              className={`mt-2 flex items-center gap-1.5 text-xs ${averageRating ? 'cursor-pointer' : ''}`}
            >
              <div className="flex items-center text-amber-500">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={13} fill={averageRating && i < Math.round(averageRating) ? 'currentColor' : 'none'} />
                ))}
              </div>
              {averageRating ? <>
                <span className="font-bold text-[#181817]">{averageRating.toFixed(1)}</span>
                <span className="text-[#78746E] text-[11px] hover:underline">({product.reviews.length} 条评价)</span>
              </> : <span className="text-[#78746E] text-[11px]">暂无评价</span>}
            </div>

            {/* 简要描述文本 */}
            <p className="mt-2.5 text-xs text-[#78746E] leading-relaxed">
              {product.shortDescription || product.aiSummary}
            </p>

            {/* 品牌工作室入口 (纯净行，无卡片) */}
            <button
              type="button"
              onClick={() => onOpenStore(product)}
              className="mt-4 flex min-h-11 w-full cursor-pointer items-center justify-between border-y border-[#DED9D0]/60 py-2.5 text-left text-xs transition-colors hover:text-[#A73F32] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#A73F32]"
            >
              <div className="flex items-center gap-2">
                <Store size={14} className="text-[#78746E]" />
                <span className="font-medium text-[#181817]">
                  进入品牌展厅：{product.storeName}
                </span>
              </div>
              <ChevronRight size={14} className="text-[#78746E]" />
            </button>

            {/* 单品规格与参数：纯表格形式，无卡片 */}
            <div className="mt-5">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#78746E] mb-1.5">
                单品规格与参数
              </h3>
              <table className="w-full text-xs border-collapse">
                <tbody>
                  {Object.entries(product.specs).map(([key, val], idx) => (
                    <tr
                      key={key}
                      className={
                        idx === 0
                          ? 'border-y border-[#DED9D0]/60'
                          : 'border-b border-[#DED9D0]/60'
                      }
                    >
                      <td className="py-2 pr-4 text-[#78746E] font-medium w-1/3">
                        {key}
                      </td>
                      <td className="py-2 text-[#181817] font-semibold text-right">
                        {val}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 单品智能咨询 (Q&A：纯净文字流，无卡片包裹) */}
            <div className="mt-5">
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-[#A73F32]" />
                <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#78746E]">
                  单品智能咨询 (Q&A)
                </h3>
              </div>

              {/* Q&A 对话列表 */}
              <div className="mt-2.5 space-y-2">
                {qnaList.map((item) => (
                  <div
                    key={item.id}
                    className={`py-2 text-xs leading-relaxed border-b border-[#DED9D0]/40 ${
                      item.isUser ? 'text-[#A73F32]' : 'text-[#181817]'
                    }`}
                  >
                    <span className="font-semibold mr-1">
                      {item.isUser ? '问：' : '答：'}
                    </span>
                    <span>{item.text}</span>
                    {item.evidenceText && (
                      <div className="mt-1 text-[10px] text-[#78746E]">
                        来源：{item.evidenceText}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* 提问输入框 */}
              <form onSubmit={handleSendQna} className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={qnaInput}
                  onChange={(e) => setQnaInput(e.target.value)}
                  placeholder="提问关于材质、尺寸、光线或搭配..."
                  className="flex-1 rounded-full bg-[#FFFFFF] px-4 py-2 text-xs text-[#181817] placeholder-[#78746E]/60 outline-hidden border border-[#DED9D0] focus:ring-1 focus:ring-[#A73F32] shadow-2xs"
                />
                <button
                  type="submit"
                  disabled={!qnaInput.trim()}
                  className="flex h-8.5 w-8.5 items-center justify-center rounded-full bg-[#A73F32] text-[#FFFFFF] hover:bg-[#8F352A] disabled:opacity-40 transition-opacity shadow-xs"
                >
                  <Send size={13} />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* 底部购买固定栏：立即购买为主题红色、椭圆形（rounded-full）、无价格显示 */}
      <footer className="fixed bottom-0 left-0 right-0 z-30 bg-[#F6F3EE]/95 backdrop-blur-md border-t border-[#DED9D0]/60 px-5 py-3 pb-safe shadow-lg">
        <div className="mx-auto flex max-w-md items-center gap-3">
          {/* 加入购物车按钮：无卡片底图，缩小降低存在感 */}
          <button
            onClick={() => {
              onAddToCart(product);
              showToast(`已加入选品袋：${product.name}`);
            }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#78746E] hover:text-[#181817] hover:bg-[#EAE5DC] active:scale-90 transition-all"
            title="加入选品袋"
          >
            <ShoppingBag size={20} strokeWidth={1.75} />
          </button>

          {/* 立即购买按钮：主题红色、椭圆形 (rounded-full)、不带价格 */}
          <button
            onClick={() => {
              onAddToCart(product);
              showToast(`已选购单品：${product.name}`);
            }}
            className="flex-1 flex h-11 items-center justify-center rounded-full bg-[#A73F32] text-sm font-bold text-white shadow-xs hover:bg-[#8F352A] active:scale-98 transition-all"
          >
            <span>立即购买</span>
          </button>
        </div>
      </footer>
    </div>
  );
};

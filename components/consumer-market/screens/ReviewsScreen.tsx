import React, { useState } from 'react';
import { ArrowLeft, Star, Sparkles } from 'lucide-react';
import { Review } from '../types';

interface ReviewsScreenProps {
  reviews: Review[];
  onClose: () => void;
}

export const ReviewsScreen: React.FC<ReviewsScreenProps> = ({
  reviews,
  onClose,
}) => {
  const categories = [
    '全部',
    '质感工艺',
    '空间尺寸',
    '触感体验',
    '经久耐用',
    '物流保障',
  ];
  const [selectedCategory, setSelectedCategory] = useState('全部');

  const filteredReviews =
    selectedCategory === '全部'
      ? reviews
      : reviews.filter(
          (r) =>
            r.categoryTag.toLowerCase().includes(selectedCategory.slice(0, 2).toLowerCase()) ||
            selectedCategory.includes(r.categoryTag)
        );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#F6F3EE] text-[#181817] select-none pb-20 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-[#DED9D0] bg-[#FFFFFF] px-6 py-3.5 pt-safe">
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFFFFF] text-[#181817] border border-[#DED9D0] hover:bg-[#F6F3EE] shadow-xs active:scale-95 transition-transform"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-editorial text-xl font-bold text-[#181817]">
          买家真实印象与实物评价
        </h1>
        <div className="w-9" />
      </div>

      <div className="mx-auto max-w-2xl px-6 pt-4">
        {/* Aggregated Themes Filter */}
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-[#78746E] mb-3">
          <Sparkles size={13} className="text-[#A73F32]" />
          <span>AI 智能汇聚评价主题</span>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-[#A73F32] text-[#FFFFFF] shadow-xs'
                    : 'bg-[#FFFFFF] text-[#78746E] border border-[#DED9D0] hover:border-[#A73F32]'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Reviews List */}
        <div className="mt-6 space-y-3">
          {filteredReviews.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#78746E]/60">
              该主题暂无更多评价记录。
            </div>
          ) : (
            filteredReviews.map((review) => (
              <div
                key={review.id}
                className="rounded-xl bg-[#FFFFFF] p-4 border border-[#DED9D0] shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[#181817]">
                    {review.author}
                  </span>
                  <div className="flex items-center gap-1 text-[#A73F32]">
                    <Star size={13} fill="currentColor" />
                    <span className="text-xs font-bold text-[#181817]">
                      {review.rating.toFixed(1)}
                    </span>
                  </div>
                </div>

                <p className="mt-2 text-xs text-[#181817] leading-relaxed">
                  {review.text}
                </p>

                <div className="mt-2 text-[10px] text-[#78746E]">
                  主题分类：{review.categoryTag}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

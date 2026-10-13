import React from 'react';
import { Sparkles, X } from 'lucide-react';
import { ProductItem } from '../types';

interface AiCartComparisonDialogProps {
  pair: [ProductItem, ProductItem] | null;
  onClose: () => void;
}

export const AiCartComparisonDialog: React.FC<AiCartComparisonDialogProps> = ({
  pair,
  onClose,
}) => {
  if (!pair) return null;
  const [p1, p2] = pair;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg rounded-2xl bg-[#FFFFFF] p-6 shadow-2xl border border-[#DED9D0]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#DED9D0]">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-[#A73F32]" />
            <h2 className="font-editorial text-2xl font-bold text-[#181817]">
              AI 单品智能对比
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#F6F3EE] text-[#181817]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Side by side items */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[p1, p2].map((product, idx) => (
            <div
              key={product.id}
              className="flex flex-col rounded-xl bg-[#FFFFFF] p-3.5 border border-[#DED9D0] shadow-xs"
            >
              <div className="relative h-28 w-full overflow-hidden rounded-lg bg-[#F6F3EE] border border-[#DED9D0]/60">
                <img
                  src={product.mainImage}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
                <span className="absolute top-1.5 left-1.5 rounded-xs bg-[#181817] px-1.5 py-0.5 text-[9px] text-white font-mono">
                  单品 {idx + 1}
                </span>
              </div>
              <h4 className="mt-2.5 font-medium text-xs text-[#181817] line-clamp-1">
                {product.name}
              </h4>
              <span className="text-xs font-bold text-[#A73F32]">
                {product.formattedPrice}
              </span>
              <div className="mt-2 space-y-1 border-t border-[#DED9D0]/60 pt-2 text-[10px] text-[#78746E]">
                <div>
                  <span className="text-[#78746E]/70">类别：</span>{' '}
                  <span className="text-[#181817]">{product.category}</span>
                </div>
                <div>
                  <span className="text-[#78746E]/70">材质：</span>{' '}
                  <span className="text-[#181817] line-clamp-1">
                    {product.specs['材质'] ||
                      product.specs['Material'] ||
                      product.specs['Timber'] ||
                      product.specs['Frame'] ||
                      '自然材质工艺'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* AI Curator Conclusion */}
        <div className="mt-4 rounded-xl border border-[#A73F32]/20 bg-[#A73F32]/8 p-3.5 text-xs text-[#181817]">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#A73F32]">
            <Sparkles size={12} />
            <span>AI 空间策展人结论</span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-[#181817]">
            {p1.category === p2.category
              ? `两件器物均展现了独特的建筑空间结构。若注重细腻触感与温润光影，${p1.name} 能营造宁静的私密焦点；而 ${p2.name} 具有更强烈的空间雕塑存在感。`
              : `检测到互补搭配关系。${p1.name}（${p1.category}）与 ${p2.name}（${p2.category}）在同一当代生活空间中放置时，材质与色调能产生和谐自然的呼应。`}
          </p>
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-xl bg-[#A73F32] py-2.5 text-xs font-bold text-white hover:bg-[#8F352A] transition-colors shadow-xs"
        >
          我知道了
        </button>
      </div>
    </div>
  );
};

import React from 'react';
import { Search, X, Compass } from 'lucide-react';
import { ProductItem } from '../types';

interface SearchScreenProps {
  query: string;
  results: ProductItem[];
  onQueryChange: (query: string) => void;
  onClose: () => void;
  onProductClick: (product: ProductItem) => void;
}

export const SearchScreen: React.FC<SearchScreenProps> = ({
  query,
  results,
  onQueryChange,
  onClose,
  onProductClick,
}) => {
  const suggestedContexts = [
    '包豪斯书房',
    '侘寂阅读角',
    '重磅亚麻工装',
    '复古机械键盘',
    '日光绿植客厅',
    '空间监听耳机',
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#F6F3EE] text-[#181817] select-none p-5 sm:p-6 pt-safe pb-24 animate-in fade-in duration-200">
      <div className="mx-auto max-w-2xl">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#78746E]"
            />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="搜索单品、材质、品牌、空间风格..."
              className="w-full rounded-2xl border border-[#DED9D0] bg-[#FFFFFF] py-3 pl-10 pr-10 text-sm text-[#181817] placeholder-[#78746E]/50 outline-hidden focus:border-[#A73F32] focus:ring-1 focus:ring-[#A73F32] shadow-xs"
            />
            {query && (
              <button
                onClick={() => onQueryChange('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#78746E] hover:text-[#181817]"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFFFFF] border border-[#DED9D0] text-[#181817] hover:bg-[#F6F3EE] active:scale-95 transition-all shadow-xs"
            title="关闭"
          >
            <X size={18} />
          </button>
        </div>

        {/* Suggested Contexts */}
        <div className="mt-6">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#78746E]">
            推荐搜索灵感
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestedContexts.map((contextTag) => (
              <button
                key={contextTag}
                onClick={() => onQueryChange(contextTag)}
                className="rounded-full bg-[#FFFFFF] px-3.5 py-1.5 text-xs text-[#181817] border border-[#DED9D0] hover:border-[#A73F32] hover:text-[#A73F32] transition-all shadow-xs"
              >
                {contextTag}
              </button>
            ))}
          </div>
        </div>

        {/* Results Area */}
        <div className="mt-8">
          {!query.trim() ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-[#78746E]">
              <Compass size={36} strokeWidth={1.5} className="text-[#78746E]/40" />
              <h4 className="mt-4 font-editorial text-2xl font-normal text-[#181817]">
                视觉灵感搜索空间
              </h4>
              <p className="mt-1 text-xs text-[#78746E] max-w-xs">
                支持按形态、材质、创作者或空间情绪检索美学单品
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#DED9D0]">
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#78746E]">
                  搜索结果 ({results.length})
                </span>
              </div>

              {results.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#78746E]">
                  未找到与 &ldquo;{query}&rdquo; 匹配的实物单品。
                </div>
              ) : (
                <div className="mt-3 space-y-2.5">
                  {results.map((product) => (
                    <div
                      key={product.id}
                      onClick={() => onProductClick(product)}
                      className="flex cursor-pointer items-center justify-between rounded-xl bg-[#FFFFFF] p-3 border border-[#DED9D0] shadow-xs hover:border-[#A73F32]/50 transition-all active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={product.mainImage}
                          alt={product.name}
                          className="h-16 w-16 rounded-lg object-cover bg-[#F6F3EE] border border-[#DED9D0]"
                        />
                        <div>
                          <h4 className="text-sm font-bold text-[#181817]">
                            {product.name}
                          </h4>
                          <p className="text-xs text-[#78746E]">
                            {product.creator} • {product.category}
                          </p>
                        </div>
                      </div>

                      <span className="text-xs font-bold text-[#181817] pr-2">
                        {product.formattedPrice}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

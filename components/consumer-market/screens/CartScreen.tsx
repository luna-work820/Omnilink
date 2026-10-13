import React from 'react';
import { Minus, Plus, Sparkles, Trash2, ShoppingBag } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useOmnilink } from '../context/OmnilinkContext';
import { formatConsumerPrice, groupCartByStore, writeStoreCheckoutCart } from '../services/cartHandoff';

export const CartScreen: React.FC = () => {
  const router = useRouter();
  const {
    cartItems,
    updateCartQuantity,
    removeFromCart,
    openProductDetail,
    startCartComparison,
  } = useOmnilink();

  const storeGroups = groupCartByStore(cartItems);
  const amountSummary = storeGroups.length === 1
    ? formatConsumerPrice(storeGroups[0].items.reduce((sum, item) => sum + item.product.price * item.quantity, 0), storeGroups[0].items[0].product.currency)
    : '按店铺分别核算';

  const handleCheckout = (storeSlug: string) => {
    writeStoreCheckoutCart(storeSlug, cartItems);
    router.push(`/store/${storeSlug}/checkout`);
  };

  return (
    <div className="min-h-screen bg-[#F6F3EE] text-[#181817] pb-32 pt-2 select-none">
      <div className="mx-auto max-w-2xl px-5 sm:px-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4">
          <div>
            <h1 className="font-editorial text-3xl font-bold text-[#181817]">
              选品清单
            </h1>
            <p className="text-xs text-[#78746E]">
              已选 {cartItems.length} 件独立空间实物单品
            </p>
          </div>

          {cartItems.length >= 2 && (
            <button
              onClick={() =>
                startCartComparison(cartItems[0].product, cartItems[1].product)
              }
              className="flex items-center gap-1.5 rounded-full bg-[#A73F32]/10 px-3.5 py-1.5 text-xs font-semibold text-[#A73F32] hover:bg-[#A73F32]/20 active:scale-95 transition-all shadow-xs border border-[#A73F32]/20"
            >
              <Sparkles size={13} />
              <span>AI 智能对比</span>
            </button>
          )}
        </div>

        {cartItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center text-[#78746E]">
            <ShoppingBag size={40} strokeWidth={1.5} className="text-[#78746E]/40" />
            <h3 className="mt-4 font-editorial text-2xl text-[#181817]">
              您的选品袋当前为空
            </h3>
            <p className="mt-1 text-xs text-[#78746E] max-w-xs">
              欢迎前往首页瀑布流或 AI 空间工坊发现心仪美学单品。
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {/* Items list */}
            {cartItems.map((item) => (
              <div
                key={item.product.id}
                className="flex items-center justify-between rounded-xl bg-[#FFFFFF] p-3.5 shadow-xs border border-[#DED9D0]/60"
              >
                <div
                  onClick={() => openProductDetail(item.product)}
                  className="flex cursor-pointer items-center gap-3.5 flex-1 min-w-0"
                >
                  <img
                    src={item.product.mainImage}
                    alt={item.product.name}
                    className="h-16 w-16 rounded-lg object-cover bg-[#F6F3EE] shrink-0"
                  />
                  <div className="min-w-0 pr-2">
                    <h4 className="truncate text-sm font-bold text-[#181817]">
                      {item.product.name}
                    </h4>
                    <p className="text-[11px] text-[#78746E]">
                      款式规格: {item.variant}
                    </p>
                    <span className="text-xs font-bold text-[#181817]">
                      {item.product.formattedPrice}
                    </span>
                  </div>
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-full bg-[#F6F3EE] border border-[#DED9D0]/60 p-1">
                    <button
                      onClick={() => updateCartQuantity(item.product.id, -1)}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#181817] hover:bg-[#F6F3EE] shadow-xs active:scale-90 transition-all"
                      aria-label="减少"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-7 text-center text-xs font-bold text-[#181817]">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateCartQuantity(item.product.id, 1)}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#181817] hover:bg-[#F6F3EE] shadow-xs active:scale-90 transition-all"
                      aria-label="增加"
                    >
                      <Plus size={12} />
                    </button>
                  </div>

                  <button
                    onClick={() => removeFromCart(item.product.id)}
                    className="p-1.5 text-[#78746E]/60 hover:text-[#A73F32] transition-colors"
                    title="移除单品"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}

            {/* Summary & Checkout Card */}
            <div className="mt-6 rounded-xl bg-[#FFFFFF] p-5 shadow-xs border border-[#DED9D0]/60">
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-[#78746E]">
                  <span>商品金额参考</span>
                  <span className="text-[#181817] font-bold">
                    {amountSummary}
                  </span>
                </div>
                <div className="flex justify-between text-[#78746E]">
                  <span>运费与库存</span>
                  <span className="text-[#78746E]">提交询价后由商家确认</span>
                </div>

                <div className="pt-3 flex justify-between items-baseline border-t border-[#DED9D0]">
                  <span className="font-editorial text-lg font-bold text-[#181817]">
                    商品金额小计
                  </span>
                  <span className="font-editorial text-2xl font-bold text-[#181817]">
                    {amountSummary}
                  </span>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                {storeGroups.map(({ storeSlug, storeName, items }) => {
                  const count = items.reduce((sum, item) => sum + item.quantity, 0);
                  return <button key={storeSlug} onClick={() => handleCheckout(storeSlug)} className="flex h-12 w-full items-center justify-center rounded-xl bg-[#A73F32] px-3 text-xs font-bold text-[#FFFFFF] transition-colors hover:bg-[#8F352A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A73F32]">
                    {storeGroups.length > 1 ? `向 ${storeName} 提交询价（${count} 件）` : '前往询价'}
                  </button>;
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

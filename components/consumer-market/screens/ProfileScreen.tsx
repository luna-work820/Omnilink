import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Heart,
  ShoppingBag,
  Sparkles,
  Settings,
  ChevronRight,
  Package,
  ShieldCheck,
  Bookmark,
  Trash2,
  Minus,
  Plus,
  HelpCircle,
} from 'lucide-react';
import { useOmnilink } from '../context/OmnilinkContext';
import { formatConsumerPrice, groupCartByStore, writeStoreCheckoutCart } from '../services/cartHandoff';

export const ProfileScreen: React.FC = () => {
  const router = useRouter();
  const {
    products,
    savedProductIds,
    cartItems,
    cartCount,
    updateCartQuantity,
    removeFromCart,
    openProductDetail,
    startCartComparison,
    openAiDrawer,
    showToast,
  } = useOmnilink();

  const [activeTab, setActiveTab] = useState<'CART' | 'SAVED' | 'PREFERENCES' | 'ORDERS'>('CART');

  const savedProducts = products.filter((p) =>
    savedProductIds.includes(p.id)
  );

  const storeGroups = groupCartByStore(cartItems);
  const amountSummary = storeGroups.length === 1
    ? formatConsumerPrice(storeGroups[0].items.reduce((sum, item) => sum + item.product.price * item.quantity, 0), storeGroups[0].items[0].product.currency)
    : '按店铺分别核算';

  const handleCheckout = (storeSlug: string) => {
    writeStoreCheckoutCart(storeSlug, cartItems);
    router.push(`/store/${storeSlug}/checkout`);
  };

  const styleTags = [
    { label: '极简包豪斯', count: 12 },
    { label: '侘寂陶艺', count: 8 },
    { label: '现代有机', count: 15 },
    { label: '亚麻自然光影', count: 6 },
    { label: '中世纪复古', count: 9 },
  ];

  const orderHistory: Array<{ id: string; date: string; status: string; total: string; items: Array<{ name: string; count: number; image: string }> }> = [];

  return (
    <div className="min-h-screen w-full bg-[#F6F3EE] text-[#181817] pb-32 pt-3 select-none">
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        {/* Personal Profile Header */}
        <div className="rounded-3xl bg-[#FFFFFF] p-5 sm:p-6 border border-[#DED9D0]/80 shadow-xs">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <img
                  src="/consumer-market/img_creator_alex.jpg"
                  alt="Luna"
                  className="h-16 w-16 sm:h-18 sm:w-18 rounded-full object-cover border-2 border-[#FFFFFF] shadow-sm ring-1 ring-[#DED9D0]"
                />
                <span className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-[#A73F32] text-white shadow-xs">
                  <Sparkles size={11} />
                </span>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-editorial text-2xl font-normal text-[#181817]">
                    Luna
                  </h2>
                  <span className="rounded-full bg-[#A73F32]/10 px-2 py-0.5 text-[10px] font-bold text-[#A73F32]">
                    美学策展人
                  </span>
                </div>
                <p className="text-xs text-[#78746E] mt-0.5">
                  空间摄影 · 独立设计 · 极简生活方式
                </p>
                <div className="flex items-center gap-2 text-[11px] text-[#78746E]/80 mt-1">
                  <span>上海 · 柏林</span>
                  <span>•</span>
                  <span>已策展 24 个空间方案</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => showToast('个人资料与偏好设置已更新')}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F6F3EE] hover:bg-[#DED9D0]/60 active:scale-90 transition-all text-[#78746E]"
              title="设置"
            >
              <Settings size={16} />
            </button>
          </div>

          {/* Core Stats Bar */}
          <div className="mt-5 grid grid-cols-4 divide-x divide-[#DED9D0]/60 rounded-2xl bg-[#F6F3EE]/60 py-3 text-center border border-[#DED9D0]/40">
            <div
              onClick={() => setActiveTab('CART')}
              className="cursor-pointer hover:opacity-80 transition-opacity"
            >
              <div className="font-editorial text-lg font-bold text-[#A73F32]">
                {cartCount}
              </div>
              <div className="text-[10px] text-[#78746E] font-medium mt-0.5">
                选品袋
              </div>
            </div>

            <div
              onClick={() => setActiveTab('SAVED')}
              className="cursor-pointer hover:opacity-80 transition-opacity"
            >
              <div className="font-editorial text-lg font-bold text-[#181817]">
                {savedProducts.length}
              </div>
              <div className="text-[10px] text-[#78746E] font-medium mt-0.5">
                收藏单品
              </div>
            </div>

            <div
              onClick={() => setActiveTab('ORDERS')}
              className="cursor-pointer hover:opacity-80 transition-opacity"
            >
              <div className="font-editorial text-lg font-bold text-[#181817]">
                {orderHistory.length}
              </div>
              <div className="text-[10px] text-[#78746E] font-medium mt-0.5">
                选品订单
              </div>
            </div>

            <div
              onClick={() => setActiveTab('PREFERENCES')}
              className="cursor-pointer hover:opacity-80 transition-opacity"
            >
              <div className="font-editorial text-lg font-bold text-[#181817]">
                {styleTags.length}
              </div>
              <div className="text-[10px] text-[#78746E] font-medium mt-0.5">
                美学偏好
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-5 flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-[#DED9D0]/70 pb-2">
          {/* Tab 1: 选品袋 */}
          <button
            onClick={() => setActiveTab('CART')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 active:scale-95 ${
              activeTab === 'CART'
                ? 'bg-[#181817] text-white shadow-xs'
                : 'text-[#78746E] hover:text-[#181817] hover:bg-[#FFFFFF]'
            }`}
          >
            <ShoppingBag size={13} />
            <span>选品袋 ({cartCount})</span>
          </button>

          {/* Tab 2: 我的收藏 */}
          <button
            onClick={() => setActiveTab('SAVED')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 active:scale-95 ${
              activeTab === 'SAVED'
                ? 'bg-[#181817] text-white shadow-xs'
                : 'text-[#78746E] hover:text-[#181817] hover:bg-[#FFFFFF]'
            }`}
          >
            <Bookmark size={13} />
            <span>我的收藏 ({savedProducts.length})</span>
          </button>

          {/* Tab 3: 美学偏好 */}
          <button
            onClick={() => setActiveTab('PREFERENCES')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 active:scale-95 ${
              activeTab === 'PREFERENCES'
                ? 'bg-[#181817] text-white shadow-xs'
                : 'text-[#78746E] hover:text-[#181817] hover:bg-[#FFFFFF]'
            }`}
          >
            <Sparkles size={13} />
            <span>美学偏好与档案</span>
          </button>

          {/* Tab 4: 选品订单 */}
          <button
            onClick={() => setActiveTab('ORDERS')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 active:scale-95 ${
              activeTab === 'ORDERS'
                ? 'bg-[#181817] text-white shadow-xs'
                : 'text-[#78746E] hover:text-[#181817] hover:bg-[#FFFFFF]'
            }`}
          >
            <Package size={13} />
            <span>选品订单</span>
          </button>
        </div>

        {/* Tab Content 1: 选品袋 (Cart in Profile) */}
        {activeTab === 'CART' && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-[#78746E]">
                已选 {cartItems.length} 款独立实物单品
              </span>

              {cartItems.length >= 2 && (
                <button
                  onClick={() =>
                    startCartComparison(cartItems[0].product, cartItems[1].product)
                  }
                  className="flex items-center gap-1.5 rounded-full bg-[#A73F32]/10 px-3 py-1 text-xs font-semibold text-[#A73F32] hover:bg-[#A73F32]/20 active:scale-95 transition-all border border-[#A73F32]/20"
                >
                  <Sparkles size={12} />
                  <span>AI 智能对比</span>
                </button>
              )}
            </div>

            {cartItems.length === 0 ? (
              <div className="rounded-3xl bg-[#FFFFFF] p-10 text-center border border-[#DED9D0] shadow-2xs">
                <ShoppingBag size={36} className="mx-auto text-[#DED9D0] mb-2" />
                <h4 className="font-editorial text-lg text-[#181817]">
                  您的选品袋当前为空
                </h4>
                <p className="text-xs text-[#78746E] mt-1">
                  前往首页探索空间美学，或呼出 luar 助手即时寻找同款商品。
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {cartItems.map((item) => (
                  <div
                    key={item.product.id}
                    className="flex items-center justify-between rounded-2xl bg-[#FFFFFF] p-3.5 shadow-xs border border-[#DED9D0]/70"
                  >
                    <div
                      onClick={() => openProductDetail(item.product)}
                      className="flex cursor-pointer items-center gap-3 flex-1 min-w-0"
                    >
                      <img
                        src={item.product.mainImage}
                        alt={item.product.name}
                        className="h-14 w-14 rounded-xl object-cover bg-[#F6F3EE] shrink-0 border border-[#DED9D0]/60"
                      />
                      <div className="min-w-0 pr-2">
                        <h4 className="truncate text-xs font-bold text-[#181817]">
                          {item.product.name}
                        </h4>
                        <p className="text-[11px] text-[#78746E] mt-0.5">
                          款式: {item.variant}
                        </p>
                        <div className="text-xs font-bold text-[#181817] mt-1">
                          {item.product.formattedPrice}
                        </div>
                      </div>
                    </div>

                    {/* Quantity Stepper */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center rounded-full bg-[#F6F3EE] border border-[#DED9D0]/60 p-0.5">
                        <button
                          onClick={() => updateCartQuantity(item.product.id, -1)}
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#181817] hover:bg-[#F6F3EE] shadow-xs active:scale-90 transition-all"
                          aria-label="减少"
                        >
                          <Minus size={11} />
                        </button>
                        <span className="w-6 text-center text-xs font-bold text-[#181817]">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateCartQuantity(item.product.id, 1)}
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#181817] hover:bg-[#F6F3EE] shadow-xs active:scale-90 transition-all"
                          aria-label="增加"
                        >
                          <Plus size={11} />
                        </button>
                      </div>

                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="p-1 text-[#78746E]/60 hover:text-[#A73F32] active:scale-90 transition-all"
                        title="移除单品"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Checkout Bar */}
                <div className="rounded-2xl bg-[#FFFFFF] p-4 border border-[#DED9D0]/80 shadow-xs flex items-center justify-between mt-4">
                  <div>
                    <span className="text-xs text-[#78746E]">商品金额参考</span>
                    <div className="font-editorial text-xl font-bold text-[#181817]">
                      {amountSummary}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {storeGroups.map(({ storeSlug, storeName, items }) => {
                      const count = items.reduce((sum, item) => sum + item.quantity, 0);
                      return <button key={storeSlug} onClick={() => handleCheckout(storeSlug)} className="flex h-10 items-center justify-center rounded-full bg-[#A73F32] px-4 text-xs font-bold text-white transition-colors hover:bg-[#8F352A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A73F32]">
                        {storeGroups.length > 1 ? `向 ${storeName} 询价（${count} 件）` : `前往询价（${count} 件）`}
                      </button>;
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab Content 2: Saved Products */}
        {activeTab === 'SAVED' && (
          <div className="mt-4">
            {savedProducts.length === 0 ? (
              <div className="rounded-2xl bg-[#FFFFFF] p-10 text-center border border-[#DED9D0] shadow-2xs">
                <Heart size={32} className="mx-auto text-[#DED9D0] mb-2" />
                <p className="text-xs text-[#78746E]">
                  您暂未收藏单品，在商品详情中点击心形图标即可收藏
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {savedProducts.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => openProductDetail(product)}
                    className="group flex cursor-pointer items-center justify-between rounded-2xl bg-[#FFFFFF] p-3.5 border border-[#DED9D0]/80 shadow-xs hover:border-[#A73F32]/50 hover:shadow-md transition-all active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={product.mainImage}
                        alt={product.name}
                        className="h-14 w-14 rounded-xl object-cover bg-[#F6F3EE] border border-[#DED9D0]/60 shrink-0"
                      />
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-[#181817] truncate group-hover:text-[#A73F32] transition-colors">
                          {product.name}
                        </h4>
                        <p className="text-[11px] text-[#78746E] mt-0.5">
                          {product.storeName}
                        </p>
                        <div className="text-xs font-bold text-[#181817] mt-1">
                          {product.formattedPrice}
                        </div>
                      </div>
                    </div>

                    <ChevronRight
                      size={15}
                      className="text-[#78746E] group-hover:translate-x-0.5 transition-transform shrink-0 ml-2"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab Content 3: Aesthetic Preferences & Lookbook */}
        {activeTab === 'PREFERENCES' && (
          <div className="mt-4 space-y-4">
            {/* Style Preference Tags */}
            <div className="rounded-3xl bg-[#FFFFFF] p-5 border border-[#DED9D0]/80 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-xs font-bold text-[#181817]">
                  <Sparkles size={14} className="text-[#A73F32]" />
                  <span>已训练的美学偏好标签</span>
                </div>
                <button
                  onClick={() => openAiDrawer('请帮我分析我的空间美学偏好并推荐新的搭配灵感')}
                  className="text-[11px] text-[#A73F32] font-semibold hover:underline active:scale-95 transition-all"
                >
                  AI 重新训练
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {styleTags.map((tag) => (
                  <div
                    key={tag.label}
                    className="flex items-center gap-1.5 rounded-full bg-[#F6F3EE] px-3.5 py-1.5 text-xs font-medium text-[#181817] border border-[#DED9D0]/60"
                  >
                    <span>{tag.label}</span>
                    <span className="text-[10px] text-[#78746E]">
                      ({tag.count})
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Invocation Banner */}
            <div
              onClick={() => openAiDrawer()}
              className="flex cursor-pointer items-center justify-between rounded-3xl bg-gradient-to-r from-[#A73F32] to-[#8F352A] p-5 text-white shadow-md hover:opacity-95 transition-all active:scale-[0.99]"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-200">
                  <Sparkles size={13} />
                  <span>luar • 空间智能助手</span>
                </div>
                <h4 className="text-base font-bold">
                  上传新空间或实物，秒获全套搭配
                </h4>
                <p className="text-xs text-white/80">
                  随时随地呼出多模态智能搭配档案
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-md text-white shrink-0">
                <ChevronRight size={18} />
              </div>
            </div>
          </div>
        )}

        {/* Tab Content 4: Orders */}
        {activeTab === 'ORDERS' && (
          <div className="mt-4 space-y-3">
            {orderHistory.length === 0 ? <div className="rounded-3xl bg-white p-8 text-center text-xs text-[#78746E]">订单记录需要登录后关联，目前尚未接入消费者账号。</div> : orderHistory.map((order) => (
              <div
                key={order.id}
                className="rounded-3xl bg-[#FFFFFF] p-4 sm:p-5 border border-[#DED9D0]/80 shadow-xs"
              >
                <div className="flex items-center justify-between border-b border-[#DED9D0]/60 pb-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#181817]">
                      {order.id}
                    </span>
                    <span className="text-[#78746E] text-[11px]">
                      {order.date}
                    </span>
                  </div>
                  <span className="rounded-full bg-[#A73F32]/10 px-2 py-0.5 text-[10px] font-bold text-[#A73F32]">
                    {order.status}
                  </span>
                </div>

                <div className="mt-3 space-y-2.5">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="h-11 w-11 rounded-lg object-cover bg-[#F6F3EE] border border-[#DED9D0]/60"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-[#181817] truncate">
                          {item.name}
                        </div>
                        <div className="text-[10px] text-[#78746E]">
                          数量：{item.count}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-[#DED9D0]/60 pt-3 text-xs">
                  <span className="text-[#78746E]">实付金额</span>
                  <span className="font-editorial text-base font-bold text-[#181817]">
                    {order.total}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Service & System Links */}
        <div className="mt-6 rounded-3xl bg-[#FFFFFF] border border-[#DED9D0]/80 shadow-xs divide-y divide-[#DED9D0]/60 overflow-hidden">
          <div
            onClick={() => showToast('已连接空间美学专属策展客服')}
            className="flex cursor-pointer items-center justify-between px-5 py-3.5 hover:bg-[#F6F3EE] active:bg-[#EAE5DC]/60 transition-colors text-xs font-medium text-[#181817]"
          >
            <div className="flex items-center gap-3">
              <ShieldCheck size={16} className="text-[#A73F32]" />
              <span>空间搭配顾问与售后保障</span>
            </div>
            <ChevronRight size={14} className="text-[#78746E]" />
          </div>

          <div
            onClick={() => showToast('关于 Omnilink 空间美学平台 v2.4')}
            className="flex cursor-pointer items-center justify-between px-5 py-3.5 hover:bg-[#F6F3EE] active:bg-[#EAE5DC]/60 transition-colors text-xs font-medium text-[#181817]"
          >
            <div className="flex items-center gap-3">
              <HelpCircle size={16} className="text-[#78746E]" />
              <span>关于 Omnilink 与美学准则</span>
            </div>
            <ChevronRight size={14} className="text-[#78746E]" />
          </div>
        </div>
      </div>
    </div>
  );
};

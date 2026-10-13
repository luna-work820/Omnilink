import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  User,
  Image as ImageIcon,
  Trash2,
  Repeat,
  Zap,
  ArrowRight,
  X,
  Bot,
  Shuffle,
  Dice5,
  Check,
  Plus,
  Camera,
} from 'lucide-react';
import { useOmnilink } from '../context/OmnilinkContext';
import { ProductItem } from '../types';

export const PersonalStudioScreen: React.FC = () => {
  const {
    personalSubTab,
    setPersonalSubTab,
    aiMessages,
    isAiThinking,
    sendAiMessage,
    sendAiImageMessage,
    deleteMatchedItem,
    replaceMatchedItem,
    openProductDetail,
    addMultipleToCart,
    showToast,
    savedProductIds,
    products,
  } = useOmnilink();

  const [inputVal, setInputVal] = useState('');
  const [isUploadMenuOpen, setIsUploadMenuOpen] = useState(false);
  const [replacingTarget, setReplacingTarget] = useState<{
    messageId: string;
    product: ProductItem;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [aiMessages, isAiThinking]);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputVal.trim()) return;
    sendAiMessage(inputVal.trim());
    setInputVal('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        sendAiImageMessage(result, inputVal.trim() || undefined);
        setInputVal('');
      };
      reader.readAsDataURL(file);
    }
  };

  const samplePhotoPresets = [
    { label: '🏛️ 包豪斯日光工作室', src: '/consumer-market/img_render_bauhaus.jpg', text: '请识别这间包豪斯极简工作室的风格并找同款家具与台灯' },
    { label: '🍵 侘寂陶艺阅读角', src: '/consumer-market/img_render_wabisabi.jpg', text: '请识别这间侘寂风陶艺阅读角落并找同款单品' },
    { label: '🧥 画廊极简亚麻工装', src: '/consumer-market/img_render_outfit.jpg', text: '请识别这套画廊极简亚麻工装造型并找同款' },
    { label: '🌿 日光绿植有机客厅', src: '/consumer-market/img_render_living.jpg', text: '请识别这个阳光绿植客厅的搭配风格并找同款' },
  ];

  const savedProducts = products.filter((p) =>
    savedProductIds.includes(p.id)
  );

  return (
    <div className="min-h-screen bg-[#F6F3EE] text-[#181817] pb-32 pt-2 select-none flex flex-col justify-between">
      {/* Top Header Switcher (luar <-> 我的收藏) */}
      <div className="flex justify-center px-6 py-2 sticky top-0 z-10 bg-[#FFFFFF] border-b border-[#DED9D0]/60">
        <div className="inline-flex rounded-full bg-[#F6F3EE] p-1 border border-[#DED9D0]">
          <button
            onClick={() => setPersonalSubTab('AI')}
            className={`flex items-center gap-1.5 rounded-full px-5 py-1.5 text-xs font-medium transition-all ${
              personalSubTab === 'AI'
                ? 'bg-[#A73F32] text-[#FFFFFF] shadow-xs'
                : 'text-[#78746E] hover:text-[#181817]'
            }`}
          >
            <Sparkles size={13} />
            <span>luar</span>
          </button>
          <button
            onClick={() => setPersonalSubTab('ME')}
            className={`flex items-center gap-1.5 rounded-full px-5 py-1.5 text-xs font-medium transition-all ${
              personalSubTab === 'ME'
                ? 'bg-[#A73F32] text-[#FFFFFF] shadow-xs'
                : 'text-[#78746E] hover:text-[#181817]'
            }`}
          >
            <User size={13} />
            <span>我的收藏</span>
          </button>
        </div>
      </div>

      {personalSubTab === 'AI' ? (
        /* Real Left-Right Conversational Dialogue Mode (左右对话流) */
        <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 pt-3 flex-1 flex flex-col">
          {/* Quick preset chips */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-3 px-0.5">
            <span className="text-xs text-[#78746E] shrink-0">快捷试用:</span>
            {samplePhotoPresets.map((preset) => (
              <button
                key={preset.label}
                onClick={() => sendAiImageMessage(preset.src, preset.text)}
                className="shrink-0 flex items-center gap-1.5 rounded-full bg-white/75 backdrop-blur-md px-3.5 py-1.5 text-xs font-medium text-[#181817] border border-[#DED9D0]/70 hover:border-[#A73F32] hover:bg-white transition-all shadow-xs"
              >
                <img
                  src={preset.src}
                  alt={preset.label}
                  className="h-4 w-4 rounded-full object-cover"
                />
                <span>{preset.label}</span>
              </button>
            ))}
          </div>

          {/* Left-Right Conversation Stream */}
          <div className="space-y-6 pb-28 pt-2">
            {aiMessages.map((msg) => (
              <div key={msg.id} className="w-full">
                {msg.isUser ? (
                  /* User Message: Aligned to the RIGHT with 50% Opacity Frosted Glass Bubble */
                  <div className="flex items-start justify-end gap-2.5 pl-8 sm:pl-16">
                    <div className="flex flex-col items-end max-w-[84%] space-y-1">
                      <div className="flex items-center gap-1 text-[11px] text-[#78746E] pr-1 font-medium">
                        <span>我</span>
                      </div>

                      <div className="rounded-2xl rounded-tr-xs bg-white/50 backdrop-blur-xl border border-[#DED9D0]/70 text-[#181817] p-3.5 text-xs shadow-md shadow-stone-900/5 space-y-2">
                        {msg.image && (
                          <img
                            src={msg.image}
                            alt="User uploaded reference"
                            className="max-h-60 w-full rounded-xl object-cover border border-[#DED9D0]/60"
                          />
                        )}
                        <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                      </div>
                    </div>

                    <img
                      src="/consumer-market/img_creator_alex.jpg"
                      alt="User"
                      className="h-8 w-8 rounded-full object-cover border border-[#DED9D0] shrink-0 mt-4 shadow-2xs"
                    />
                  </div>
                ) : (
                  /* AI Message: Aligned to the LEFT with 50% Opacity Frosted Glass Card */
                  <div className="flex items-start gap-2.5 pr-4 sm:pr-12">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#A73F32] text-[#FFFFFF] shadow-xs shrink-0 mt-4">
                      <Bot size={16} />
                    </div>

                    <div className="flex flex-col items-start flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-1 text-[11px] text-[#78746E] pl-1 font-medium">
                        <span>luar</span>
                      </div>

                      {/* Unified Frosted Glass AI Conversation Card (50% 透明度) */}
                      <div className="w-full max-w-[390px] sm:max-w-[420px] rounded-2xl rounded-tl-xs bg-white/50 backdrop-blur-xl border border-[#DED9D0]/70 text-xs shadow-md shadow-stone-900/5 overflow-hidden">
                        {/* Top: AI Conversational Reasoning Text */}
                        <div className="px-4 py-3.5 space-y-1.5">
                          {msg.styleTag && (
                            <div className="inline-flex items-center gap-1 rounded-md bg-[#A73F32]/10 px-2 py-0.5 text-[11px] font-semibold text-[#A73F32]">
                              <Sparkles size={11} />
                              <span>风格识别：{msg.styleTag}</span>
                            </div>
                          )}
                          <p className="text-[#181817] leading-relaxed">{msg.text}</p>
                        </div>

                        {/* Middle: Products with Inset Horizontal Divider Lines (分割线缩短到对齐图片和删除键) */}
                        {msg.matchedProducts && msg.matchedProducts.length > 0 && (
                          <div>
                            {/* Top divider before first product (对齐图片与删除键宽度) */}
                            <div className="mx-4 border-t border-[#DED9D0]/60" />

                            {/* Products with Inset Dividers (每一道分割线均严格对齐图片与删除键) */}
                            <div>
                              {msg.matchedProducts.map((product, pIdx) => (
                                <React.Fragment key={product.id}>
                                  {pIdx > 0 && (
                                    <div className="mx-4 border-t border-[#DED9D0]/50" />
                                  )}
                                  <div className="group flex items-center justify-between px-4 py-3 hover:bg-white/40 transition-colors gap-3">
                                    {/* Product Thumbnail & Minimal Title/Price */}
                                    <div
                                      onClick={() => openProductDetail(product)}
                                      className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer pr-1"
                                    >
                                      <img
                                        src={product.mainImage}
                                        alt={product.name}
                                        className="h-11 w-11 rounded-lg object-cover bg-[#F6F3EE] shrink-0 border border-[#DED9D0]/60"
                                      />
                                      <div className="min-w-0 flex-1">
                                        <h4 className="text-xs font-semibold text-[#181817] truncate leading-tight">
                                          {product.name}
                                        </h4>
                                        <div className="text-xs font-bold text-[#181817] mt-0.5">
                                          {product.formattedPrice}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Low-presence Bare Symbol Actions */}
                                    <div className="flex items-center gap-1 shrink-0 text-[#78746E]/60">
                                      {/* ⇄ Replace */}
                                      <button
                                        onClick={() =>
                                          setReplacingTarget({
                                            messageId: msg.id,
                                            product,
                                          })
                                        }
                                        className="flex h-7 w-7 items-center justify-center rounded-md text-[#78746E]/60 hover:text-[#181817] hover:bg-white/50 active:scale-90 transition-all"
                                        title="挑选替换"
                                      >
                                        <Repeat size={13} strokeWidth={1.75} />
                                      </button>

                                      {/* 🗑 Delete */}
                                      <button
                                        onClick={() =>
                                          deleteMatchedItem(msg.id, product.id)
                                        }
                                        className="flex h-7 w-7 items-center justify-center rounded-md text-[#78746E]/60 hover:text-[#A73F32] hover:bg-white/50 active:scale-90 transition-all"
                                        title="移除"
                                      >
                                        <Trash2 size={13} strokeWidth={1.75} />
                                      </button>
                                    </div>
                                  </div>
                                </React.Fragment>
                              ))}
                            </div>

                            {/* Bottom Divider before Total (对齐图片与删除键宽度) */}
                            <div className="mx-4 border-t border-[#DED9D0]/60" />

                            {/* Bottom: Total Price & One-Click Buy */}
                            <div className="flex items-center justify-between px-4 py-3 bg-[#FFFFFF]/95">
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-[11px] text-[#78746E]">总计：</span>
                                <span className="font-editorial text-base font-bold text-[#181817]">
                                  ¥{msg.matchedProducts.reduce((sum, p) => sum + p.price, 0).toFixed(0)}
                                </span>
                                <span className="text-[10px] text-[#78746E]">
                                  ({msg.matchedProducts.length}件)
                                </span>
                              </div>

                              <button
                                onClick={() => {
                                  addMultipleToCart(msg.matchedProducts || []);
                                  showToast(`已一键选购 ${msg.matchedProducts?.length} 件实物单品！`);
                                }}
                                className="flex h-8 px-4 items-center justify-center gap-1.5 rounded-xl bg-[#A73F32] text-xs font-bold text-white shadow-xs hover:bg-[#8F352A] active:scale-95 transition-all"
                              >
                                <Zap size={13} className="fill-white" />
                                <span>一键购买</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* AI Typing Indicator (50% 透明度) */}
            {isAiThinking && (
              <div className="flex items-start gap-2.5 pr-4 sm:pr-12">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#A73F32] text-[#FFFFFF] shadow-xs shrink-0 mt-1">
                  <Bot size={16} />
                </div>
                <div className="flex items-center gap-2 rounded-2xl rounded-tl-xs bg-white/50 backdrop-blur-xl px-4 py-3 text-xs text-[#78746E] border border-[#DED9D0]/70 shadow-md shadow-stone-900/5">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-[#A73F32] animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-2 w-2 rounded-full bg-[#A73F32] animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="h-2 w-2 rounded-full bg-[#A73F32] animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span>luar 正在分析图片并匹配商品...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Google-Inspired Frosted Glass Chat Input Bar (无分割线、同色系毛玻璃、旋转加号菜单、圆形发送按钮) */}
          <div className="fixed bottom-16 left-0 right-0 z-20 px-3.5 sm:px-6 pb-2 pointer-events-none">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />

            <form
              onSubmit={handleSend}
              className="relative mx-auto flex max-w-2xl items-center gap-1.5 rounded-full bg-[#F6F3EE]/80 backdrop-blur-xl border border-[#DED9D0]/80 p-1.5 pl-2 shadow-lg shadow-black/5 pointer-events-auto transition-all focus-within:border-[#A73F32]/50 focus-within:shadow-xl focus-within:shadow-black/8"
            >
              {/* Rotating Plus Button with Upload Type Popover */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsUploadMenuOpen(!isUploadMenuOpen)}
                  className={`flex h-9 w-9 items-center justify-center rounded-full bg-white/80 hover:bg-white text-[#181817] shadow-2xs transition-all active:scale-90 ${
                    isUploadMenuOpen ? 'bg-white ring-2 ring-[#A73F32]/20' : ''
                  }`}
                  title="选择上传类型"
                >
                  <Plus
                    size={17}
                    className={`transition-transform duration-300 ease-out ${
                      isUploadMenuOpen
                        ? 'rotate-45 text-[#A73F32]'
                        : 'rotate-0 text-[#78746E]'
                    }`}
                  />
                </button>

                {/* Upload Options Menu */}
                {isUploadMenuOpen && (
                  <div className="absolute bottom-12 left-0 z-50 w-56 rounded-2xl bg-white/95 backdrop-blur-xl border border-[#DED9D0] p-1.5 shadow-xl shadow-stone-900/10 animate-in fade-in slide-in-from-bottom-2 duration-200 select-none">
                    <div className="text-[10px] font-bold text-[#78746E] px-3 py-1.5 uppercase tracking-wider">
                      上传与识别模式
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsUploadMenuOpen(false);
                        fileInputRef.current?.click();
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-[#181817] hover:bg-[#F6F3EE] active:scale-98 transition-all text-left"
                    >
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#A73F32]/10 text-[#A73F32] shrink-0">
                        <ImageIcon size={14} />
                      </div>
                      <div>
                        <div className="font-semibold text-xs text-[#181817]">上传空间照片</div>
                        <div className="text-[10px] text-[#78746E]">识别美学风格并找全套实物</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsUploadMenuOpen(false);
                        fileInputRef.current?.click();
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-[#181817] hover:bg-[#F6F3EE] active:scale-98 transition-all text-left"
                    >
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#A73F32]/10 text-[#A73F32] shrink-0">
                        <Camera size={14} />
                      </div>
                      <div>
                        <div className="font-semibold text-xs text-[#181817]">拍摄空间或实物</div>
                        <div className="text-[10px] text-[#78746E]">即拍即配实物同款</div>
                      </div>
                    </button>

                    <div className="my-1 border-t border-[#DED9D0]/60" />

                    <div className="text-[10px] font-bold text-[#78746E] px-3 py-1 uppercase tracking-wider">
                      快捷试用模版
                    </div>

                    {samplePhotoPresets.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setIsUploadMenuOpen(false);
                          sendAiImageMessage(preset.src, preset.text);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#181817] hover:bg-[#F6F3EE] active:scale-98 transition-all text-left truncate"
                      >
                        <img
                          src={preset.src}
                          alt=""
                          className="h-4.5 w-4.5 rounded-md object-cover shrink-0 border border-[#DED9D0]/60"
                        />
                        <span className="truncate text-[11px] text-[#181817] font-medium">
                          {preset.label}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Chat Input Text Field */}
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="发送消息或上传照片，让 luar 识别风格并推荐商品..."
                className="flex-1 bg-transparent px-2.5 text-xs text-[#181817] placeholder-[#78746E]/60 outline-hidden font-medium"
              />

              {/* Round Send Button */}
              <button
                type="submit"
                disabled={!inputVal.trim()}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#A73F32] text-[#FFFFFF] shadow-xs hover:bg-[#8F352A] disabled:opacity-30 active:scale-95 transition-all shrink-0"
                title="发送"
              >
                <Send size={14} />
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* ME Archive View */
        <div className="mx-auto max-w-2xl px-6 pt-4 w-full">
          <div className="flex items-center gap-4 rounded-2xl bg-[#FFFFFF] p-5 border border-[#DED9D0] shadow-xs">
            <img
              src="/consumer-market/img_creator_alex.jpg"
              alt="Luna"
              className="h-16 w-16 rounded-full object-cover border-2 border-[#DED9D0]"
            />
            <div>
              <h3 className="font-editorial text-2xl font-normal text-[#181817]">
                Luna
              </h3>
              <p className="text-xs text-[#78746E]">
                创意 / 摄影 / 空间美学
              </p>
            </div>
          </div>

          <div className="mt-6">
            <h4 className="text-xs font-semibold text-[#78746E] mb-3">
              我的收藏 ({savedProducts.length})
            </h4>

            <div className="space-y-2.5">
              {savedProducts.length === 0 ? (
                <div className="py-10 text-center text-xs text-[#78746E]/60">
                  暂无收藏商品
                </div>
              ) : (
                savedProducts.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => openProductDetail(product)}
                    className="group flex cursor-pointer items-center justify-between rounded-xl bg-[#FFFFFF] p-3 border border-[#DED9D0] shadow-xs hover:border-[#A73F32]/50 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={product.mainImage}
                        alt={product.name}
                        className="h-12 w-12 rounded-lg object-cover bg-[#F6F3EE] border border-[#DED9D0]"
                      />
                      <div>
                        <h5 className="text-xs font-semibold text-[#181817]">
                          {product.name}
                        </h5>
                        <p className="text-[11px] text-[#78746E]">
                          {product.formattedPrice}
                        </p>
                      </div>
                    </div>

                    <ArrowRight
                      size={14}
                      className="text-[#78746E] group-hover:translate-x-0.5 transition-transform"
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Replacement Modal */}
      {replacingTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-3xl bg-[#FFFFFF] p-4 sm:p-5 shadow-2xl max-h-[80vh] flex flex-col border border-[#DED9D0]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#DED9D0] pb-2.5">
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <Repeat size={14} className="text-[#A73F32] shrink-0" />
                <span className="text-xs font-semibold text-[#181817] truncate">
                  {replacingTarget.product.name}
                </span>
              </div>
              <button
                onClick={() => setReplacingTarget(null)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FFFFFF] text-[#181817] border border-[#DED9D0] hover:bg-[#F6F3EE] shrink-0"
              >
                <X size={14} />
              </button>
            </div>

            {/* Random Pick Button */}
            <div className="pt-2.5 pb-1">
              <button
                onClick={() => {
                  const candidates = products.filter(
                    (p) => p.id !== replacingTarget.product.id
                  );
                  if (candidates.length > 0) {
                    const randomPick =
                      candidates[Math.floor(Math.random() * candidates.length)];
                    replaceMatchedItem(
                      replacingTarget.messageId,
                      replacingTarget.product.id,
                      randomPick
                    );
                    setReplacingTarget(null);
                  }
                }}
                className="flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-[#A73F32] text-[#FFFFFF] shadow-xs hover:bg-[#8F352A] active:scale-98 transition-all"
              >
                <Dice5 size={16} />
                <Shuffle size={16} />
              </button>
            </div>

            {/* Candidate List */}
            <div className="mt-1.5 flex-1 overflow-y-auto space-y-1.5 no-scrollbar py-1">
              {products
                .filter((p) => p.id !== replacingTarget.product.id)
                .map((candidate) => (
                  <div
                    key={candidate.id}
                    onClick={() => {
                      replaceMatchedItem(
                        replacingTarget.messageId,
                        replacingTarget.product.id,
                        candidate
                      );
                      setReplacingTarget(null);
                    }}
                    className="group flex cursor-pointer items-center justify-between rounded-xl p-2.5 bg-[#FFFFFF] border border-[#DED9D0] hover:border-[#A73F32] hover:bg-[#F6F3EE] transition-all"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <img
                        src={candidate.mainImage}
                        alt={candidate.name}
                        className="h-10 w-10 rounded-lg object-cover bg-[#F6F3EE] border border-[#DED9D0] shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#181817] truncate">
                          {candidate.name}
                        </div>
                        <div className="text-xs font-bold text-[#A73F32] mt-0.5">
                          {candidate.formattedPrice}
                        </div>
                      </div>
                    </div>

                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FFFFFF] text-[#181817] border border-[#DED9D0] group-hover:bg-[#A73F32] group-hover:text-[#FFFFFF] group-hover:border-[#A73F32] transition-colors shrink-0">
                      <Check size={14} />
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Image as ImageIcon,
  Trash2,
  Repeat,
  Zap,
  X,
  Bot,
  Plus,
  Camera,
  ChevronDown,
} from 'lucide-react';
import { useOmnilink } from '../context/OmnilinkContext';
import { ProductItem } from '../types';

export const GlobalAiDrawer: React.FC = () => {
  const {
    isAiDrawerOpen,
    closeAiDrawer,
    aiMessages,
    isAiThinking,
    products,
    sendAiMessage,
    sendAiImageMessage,
    deleteMatchedItem,
    replaceMatchedItem,
    openProductDetail,
    addMultipleToCart,
    showToast,
  } = useOmnilink();

  const [inputVal, setInputVal] = useState('');
  const [isUploadMenuOpen, setIsUploadMenuOpen] = useState(false);
  const [replacingTarget, setReplacingTarget] = useState<{
    messageId: string;
    product: ProductItem;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (!isAiDrawerOpen) return;
    const originalOverflow = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isAiDrawerOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isAiDrawerOpen) {
      scrollToBottom();
    }
  }, [aiMessages, isAiThinking, isAiDrawerOpen]);

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
    {
      label: '🏛️ 包豪斯日光工作室',
      src: '/consumer-market/img_render_bauhaus.jpg',
      text: '请识别这间包豪斯极简工作室的风格并找同款家具与台灯',
    },
    {
      label: '🍵 侘寂陶艺阅读角',
      src: '/consumer-market/img_render_wabisabi.jpg',
      text: '请识别这间侘寂风陶艺阅读角落并找同款单品',
    },
    {
      label: '🧥 画廊极简亚麻工装',
      src: '/consumer-market/img_render_outfit.jpg',
      text: '请识别这套画廊极简亚麻工装造型并找同款',
    },
    {
      label: '🌿 日光绿植有机客厅',
      src: '/consumer-market/img_render_living.jpg',
      text: '请识别这个阳光绿植客厅的搭配风格并找同款',
    },
  ];

  if (!isAiDrawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-sm select-none animate-in fade-in duration-200">
      {/* Backdrop click to dismiss */}
      <div className="absolute inset-0" onClick={closeAiDrawer} />

      {/* Slide-Up Omni-AI Sheet */}
      <div
        className="relative z-10 flex flex-col h-[85vh] max-h-[720px] w-full max-w-2xl mx-auto rounded-t-3xl bg-[#F6F3EE]/95 backdrop-blur-2xl border-t border-[#DED9D0]/90 shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header with Drag Handle & Status */}
        <div className="sticky top-0 z-30 bg-[#F6F3EE]/95 backdrop-blur-md px-5 pt-3 pb-3 border-b border-[#DED9D0]/60 shrink-0">
          <div className="mx-auto h-1 w-10 rounded-full bg-[#DED9D0] mb-2.5" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#A73F32] text-white shadow-xs">
                <Sparkles size={16} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-[#181817] tracking-tight">
                    luar
                  </h3>
                  <span className="rounded-md bg-[#A73F32]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#A73F32]">
                    全场景智能
                  </span>
                </div>
                <p className="text-[11px] text-[#78746E]">
                  即时识图、风格拆解与实物全套匹配
                </p>
              </div>
            </div>

            <button
              onClick={closeAiDrawer}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-[#78746E] hover:text-[#181817] hover:bg-white active:scale-95 transition-all shadow-2xs border border-[#DED9D0]"
              title="收起AI"
            >
              <ChevronDown size={18} />
            </button>
          </div>
        </div>

        {/* Conversation Stream Scroll Area */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-24 space-y-4">
          {/* Quick preset chips */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 px-0.5">
            <span className="text-xs text-[#78746E] shrink-0 font-medium">
              快捷灵感:
            </span>
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
          <div className="space-y-5 pt-1">
            {aiMessages.map((msg) => (
              <div key={msg.id} className="w-full">
                {msg.isUser ? (
                  /* User Message */
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
                            className="max-h-56 w-full rounded-xl object-cover border border-[#DED9D0]/60"
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
                  /* AI Message */
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

                        {/* Middle: Products with Inset Horizontal Divider Lines */}
                        {msg.matchedProducts && msg.matchedProducts.length > 0 && (
                          <div>
                            {/* Top divider */}
                            <div className="mx-4 border-t border-[#DED9D0]/60" />

                            <div>
                              {msg.matchedProducts.map((product, pIdx) => (
                                <React.Fragment key={product.id}>
                                  {pIdx > 0 && (
                                    <div className="mx-4 border-t border-[#DED9D0]/50" />
                                  )}
                                  <div className="group flex items-center justify-between px-4 py-3 hover:bg-white/40 transition-colors gap-3">
                                    {/* Thumbnail & Title/Price */}
                                    <div
                                      onClick={() => {
                                        closeAiDrawer();
                                        openProductDetail(product);
                                      }}
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

                                    {/* Bare Symbol Actions */}
                                    <div className="flex items-center gap-1 shrink-0 text-[#78746E]/60">
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

                            {/* Bottom Divider before Total */}
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
                                  <span>加入选品袋</span>
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

            {/* AI Typing Indicator */}
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
        </div>

        {/* Google-Inspired Frosted Glass Chat Input Bar */}
        <div className="absolute bottom-0 left-0 right-0 z-40 bg-[#F6F3EE]/95 backdrop-blur-md px-4 py-2.5 pb-safe border-t border-[#DED9D0]/50">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            className="hidden"
          />

          <form
            onSubmit={handleSend}
            className="relative mx-auto flex max-w-2xl items-center gap-1.5 rounded-full bg-[#FFFFFF]/85 backdrop-blur-xl border border-[#DED9D0]/80 p-1.5 pl-2 shadow-lg shadow-black/5 transition-all focus-within:border-[#A73F32]/50"
          >
            {/* Rotating Plus Button with Popover */}
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
                </div>
              )}
            </div>

            {/* Chat Input Text Field */}
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="提问或上传空间图，找全套实物搭配..."
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
        {replacingTarget && <div role="dialog" aria-modal="true" aria-labelledby="market-replace-title" className="absolute inset-0 z-50 flex items-center justify-center bg-black/35 p-5" onClick={() => setReplacingTarget(null)}>
          <div className="w-full max-w-md rounded-2xl border border-[#DED9D0] bg-[#F6F3EE] p-4 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 id="market-replace-title" className="text-sm font-bold text-[#181817]">替换推荐商品</h2>
                <p className="mt-1 text-xs text-[#78746E]">从已发布的商品中选择替代项</p>
              </div>
              <button type="button" aria-label="关闭替换商品" onClick={() => setReplacingTarget(null)} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#A73F32]"><X size={16} /></button>
            </div>
            <div className="mt-3 max-h-[55vh] space-y-2 overflow-y-auto">
              {products.filter((product) => product.id !== replacingTarget.product.id).map((product) => <button key={product.id} type="button" onClick={() => {
                replaceMatchedItem(replacingTarget.messageId, replacingTarget.product.id, product);
                setReplacingTarget(null);
                showToast(`已替换为 ${product.name}`);
              }} className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-[#DED9D0]/80 bg-white px-3 py-2 text-left hover:border-[#A73F32]/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#A73F32]">
                <img src={product.mainImage} alt="" className="h-10 w-10 rounded-lg object-cover" />
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[#181817]">{product.name}</span>
                <span className="shrink-0 text-xs font-semibold text-[#78746E]">{product.formattedPrice}</span>
              </button>)}
              {products.length <= 1 && <p className="py-8 text-center text-xs text-[#78746E]">没有其他可替换商品。</p>}
            </div>
          </div>
        </div>}
      </div>
    </div>
  );
};

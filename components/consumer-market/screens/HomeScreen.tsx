'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, Download, FileText, Heart, Layers, Play, Plus, ShoppingBag, X } from 'lucide-react';
import { useOmnilink } from '../context/OmnilinkContext';
import { getDiscoveryType, type DiscoveryType, type ProductItem, type ScenePost } from '../types';
import { rankDiscoveryFeed } from '@/lib/consumer-advisor/discovery-ranking';
import { FeedChatDock, FEED_CHAT_SCROLL_KEY, type FeedAttachment } from '../components/FeedChatDock';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { AiChatMessage } from '../types';
import { InitialAssistantSetup } from './InitialAssistantSetup';
import { emptyEvaProfile, type EvaProfile } from '@/lib/consumer-advisor/eva-onboarding';
import { DEFAULT_INSTALLED_SKILL_IDS, EVA_SKILLS, EVA_SKILLS_STORAGE_KEY, readInstalledSkillIds, type EvaSkillId } from '../components/CapabilityLibrary';

const excludedDiscoveryProductIds = new Set(['P0006', 'ssd-cat-paw-slippers']);

export const HomeScreen: React.FC<{ selectedType: DiscoveryType; navigationOpen?: boolean; chatDockPreview?: boolean; initialOnboarding?: boolean; initialEvaProfile?: EvaProfile; profileName?: string | null; deepSeekKeyConfigured?: boolean; onboardingPreview?: boolean; initialInstalledSkillIds?: EvaSkillId[]; persistSkillChanges?: boolean }> = ({ selectedType, navigationOpen = false, chatDockPreview = false, initialOnboarding = false, initialEvaProfile, profileName, deepSeekKeyConfigured = false, onboardingPreview = false, initialInstalledSkillIds, persistSkillChanges = false }) => {
  const {
    feedItems,
    products,
    savedProductIds,
    rejectedProductIds,
    toggleSaveProduct,
    toggleRejectProduct,
    openFloatingProduct,
    openScenePost,
    aiMessages,
    activeAiConversationId,
    isAiThinking,
    showToast,
    sendAiMessage,
    sendAiImageMessage,
    sendAiFileMessage,
    homeChatOpen,
    setHomeChatOpen,
  } = useOmnilink();
  const visibleFeedItems = rankDiscoveryFeed(feedItems.filter((item) => item.type === 'product'
      ? !excludedDiscoveryProductIds.has(item.product.id) && getDiscoveryType(item.product) === selectedType
      : item.scenePost.linkedProducts.some((product) => getDiscoveryType(product) === selectedType)), products, savedProductIds, rejectedProductIds);
  const feedScrollerRef = useRef<HTMLDivElement>(null);
  const chatScrollerRef = useRef<HTMLElement>(null);
  const [feedView, setFeedView] = useState<'feed' | 'chat' | 'returning'>(homeChatOpen ? 'chat' : 'feed');
  const [previewMessages, setPreviewMessages] = useState<AiChatMessage[]>([]);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [deepSeekConnected, setDeepSeekConnected] = useState(deepSeekKeyConfigured);
  const [installedSkillIds, setInstalledSkillIds] = useState<EvaSkillId[]>(initialInstalledSkillIds ?? DEFAULT_INSTALLED_SKILL_IDS);
  const [knowYourselfStage, setKnowYourselfStage] = useState<'closed' | 'preview' | 'detail'>('closed');
  const closeKnowYourselfPreview = useCallback(() => setKnowYourselfStage('closed'), []);
  const openKnowYourselfDetail = useCallback(() => setKnowYourselfStage('detail'), []);
  const returnToKnowYourselfPreview = useCallback(() => setKnowYourselfStage('preview'), []);
  const onboardingActive = initialOnboarding && !onboardingCompleted;
  const conversationMessages = chatDockPreview ? previewMessages : aiMessages.filter((message) => message.conversationId === activeAiConversationId);
  const knowYourselfSkill = EVA_SKILLS.find((skill) => skill.id === 'know-yourself')!;
  const knowYourselfInstalled = installedSkillIds.includes(knowYourselfSkill.id);

  useEffect(() => {
    const ids = initialInstalledSkillIds ?? readInstalledSkillIds();
    setInstalledSkillIds(ids);
    if (initialInstalledSkillIds) localStorage.setItem(EVA_SKILLS_STORAGE_KEY, JSON.stringify(ids));
  }, [initialInstalledSkillIds]);

  const toggleKnowYourself = () => {
    const next = knowYourselfInstalled
      ? installedSkillIds.filter((id) => id !== knowYourselfSkill.id)
      : [...installedSkillIds, knowYourselfSkill.id];
    setInstalledSkillIds(next);
    localStorage.setItem(EVA_SKILLS_STORAGE_KEY, JSON.stringify(next));
    if (!persistSkillChanges) return;
    void fetch('/api/consumer/eva-profile', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'skills', skillIds: next }),
    }).then((response) => {
      if (!response.ok) throw new Error('保存失败');
    }).catch(() => showToast('技能状态未能保存，请检查网络后重试。'));
  };

  useEffect(() => {
    if (homeChatOpen) setFeedView('chat');
    else setFeedView((current) => current === 'chat' ? 'returning' : current);
  }, [homeChatOpen]);

  useEffect(() => { setPreviewMessages([]); }, [activeAiConversationId]);

  useEffect(() => {
    if (feedView !== 'chat') return;
    const scroller = chatScrollerRef.current;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [feedView, conversationMessages.length, isAiThinking]);

  useEffect(() => {
    if (!chatDockPreview) return;
    const savedScroll = sessionStorage.getItem(FEED_CHAT_SCROLL_KEY);
    if (savedScroll === null) return;
    sessionStorage.removeItem(FEED_CHAT_SCROLL_KEY);
    requestAnimationFrame(() => {
      if (feedScrollerRef.current) feedScrollerRef.current.scrollTop = Number(savedScroll);
    });
  }, [chatDockPreview]);

  useEffect(() => {
    if (feedView !== 'returning') return;
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setFeedView('feed'));
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [feedView]);

  const submitFeedMessage = (message: string, selectedProductIds: string[]) => {
    if (onboardingActive) return;
    if (chatDockPreview) setPreviewMessages((current) => [...current, { id: `preview-${Date.now()}`, conversationId: activeAiConversationId, text: message, isUser: true }]);
    else sendAiMessage(message, selectedProductIds);
    setHomeChatOpen(true);
  };

  const submitFeedAttachment = (attachment: FeedAttachment, message: string, selectedProductIds: string[]) => {
    if (onboardingActive) return;
    if (chatDockPreview) {
      setPreviewMessages((current) => [...current, {
        id: `preview-${Date.now()}`,
        conversationId: activeAiConversationId,
        text: message,
        isUser: true,
        ...(attachment.kind === 'image' ? { image: attachment.data } : { fileName: attachment.name }),
      }]);
    } else if (attachment.kind === 'image') {
      sendAiImageMessage(attachment.data, message, selectedProductIds);
    } else {
      sendAiFileMessage(attachment.name, attachment.data, message, selectedProductIds);
    }
    setHomeChatOpen(true);
  };

  const returnToFeed = () => setHomeChatOpen(false);

  const feedContent = <>
    <section className="px-2 sm:px-2.5">
      {visibleFeedItems.length === 0 && <p className="mx-auto max-w-md py-16 text-center text-sm text-[var(--market-text-secondary)]">{selectedType}暂无内容。</p>}
      <div className={`columns-2 gap-1.5 ${navigationOpen ? 'lg:columns-2 2xl:columns-2' : 'lg:columns-3 2xl:columns-4'}`}>
        <div className="mb-1.5 break-inside-avoid">
          <article className="product-feed-card group w-full select-none rounded-[var(--radius-card)] bg-[var(--market-canvas)] p-1 transition-colors duration-200 hover:bg-[var(--market-hover)]">
            <div className="px-2">
              <div className="flex min-h-16 w-full min-w-0 flex-col justify-center gap-0.5 py-2.5">
                <span className="text-[11px] font-medium tracking-[0.12em] text-[var(--market-text-muted)]">发布者</span>
                <span className="w-full truncate text-base font-semibold leading-[1.25] text-[var(--market-ink)] sm:text-lg">Luna</span>
              </div>
            </div>
            <button type="button" onClick={() => setKnowYourselfStage('preview')} aria-label="预览识己技能" className="block w-full cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)]">
              <img src="/consumer-market/skills/know-yourself-cover.png" alt="" className="block aspect-[3/4] w-full object-cover" loading="lazy" />
              <span className="flex min-h-10 items-center px-2 py-2">
                <span className="text-xs font-medium leading-tight text-[var(--market-ink)] sm:text-sm">{knowYourselfSkill.title}</span>
              </span>
            </button>
          </article>
        </div>
        {visibleFeedItems.map((item, idx) =>
          <div key={`${item.type}-${idx}`} className="mb-1.5 break-inside-avoid">
            {item.type === 'product' ? (
              <FeedProductCard product={item.product} onClick={() => openFloatingProduct(item.product)} />
            ) : (
              <FeedSceneCard scenePost={item.scenePost} onClick={() => openScenePost(item.scenePost)} />
            )}
          </div>
        )}
      </div>
    </section>
  </>;

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-[var(--market-canvas)]">
      <div className="relative h-full min-h-0 w-full overflow-hidden">
        <div
          ref={feedScrollerRef}
          aria-hidden={feedView !== 'feed'}
          inert={feedView !== 'feed'}
          data-navigation-open={navigationOpen}
          className={`home-feed-scroller absolute inset-0 overflow-y-auto overscroll-contain pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[54px] transition-[transform,padding] duration-500 ease-out motion-reduce:transition-none ${feedView === 'chat' ? '-translate-y-full' : feedView === 'returning' ? 'translate-y-full transition-none' : 'translate-y-0'}`}
        >
          {feedContent}
        </div>
        <section
          ref={chatScrollerRef}
          aria-label="对话"
          aria-live="polite"
          aria-hidden={feedView !== 'chat'}
          inert={feedView !== 'chat'}
          className={`absolute inset-0 overflow-y-auto bg-[var(--market-canvas)] px-4 pb-36 pt-[74px] transition-transform duration-500 ease-out motion-reduce:transition-none sm:px-6 sm:pb-28 ${feedView === 'chat' ? 'translate-y-0' : feedView === 'returning' ? '-translate-y-full' : 'translate-y-full'}`}
        >
          <div className="mx-auto w-full max-w-3xl space-y-6">
            {initialOnboarding && <InitialAssistantSetup initialProfile={initialEvaProfile ?? emptyEvaProfile} defaultName={profileName ?? ''} deepSeekConfigured={deepSeekConnected} preview={onboardingPreview} onDeepSeekConfigured={() => setDeepSeekConnected(true)} onComplete={() => setOnboardingCompleted(true)} />}
            {conversationMessages.map((message) => <div key={message.id} className={message.isUser ? 'flex justify-end' : 'text-[var(--market-ink)]'}>
              {message.isUser ? <div className="max-w-[88%] rounded-[20px] bg-[var(--market-surface-muted)] px-4 py-3 text-sm leading-6 sm:text-base">{message.image && <img src={message.image} alt="已发送的图片" className="mb-2 max-h-64 max-w-full rounded-[12px] object-contain" />}{message.fileName && <p className="mb-1 text-xs">{message.fileName}</p>}<p className="whitespace-pre-wrap break-words">{message.text}</p></div> : <div className="max-w-full break-words text-sm leading-7 sm:text-base [&_p]:mb-3 [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border-b-[0.5px] [&_td]:border-[var(--market-border)] [&_td]:p-2 [&_th]:border-b-[0.5px] [&_th]:border-[var(--market-border)] [&_th]:p-2 [&_th]:text-left"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ img: ({ src, alt }) => typeof src === 'string' && src.startsWith('/consumer-market/') ? <img src={src} alt={alt ?? ''} className="mr-2 inline-block h-11 w-11 rounded-[8px] object-cover align-middle" /> : null }}>{message.text}</ReactMarkdown>{message.matchedProducts?.length ? <div className="mt-3 flex gap-2 overflow-x-auto pb-2">{message.matchedProducts.map((product) => <div key={product.id} className="w-44 shrink-0 rounded-[14px] border-[0.5px] border-[var(--market-border)] p-2 text-xs"><button type="button" onClick={() => openFloatingProduct(product)} className="flex w-full flex-col gap-2 text-left focus-visible:outline-2 focus-visible:outline-[var(--market-support)]"><img src={product.mainImage} alt="" className="aspect-square w-full rounded-[8px] object-cover" /><span className="line-clamp-2">{product.name}</span><span className="text-[var(--market-text-muted)]">{product.formattedPrice}</span></button><div className="mt-2 flex items-center gap-3 border-t-[0.5px] border-[var(--market-border)] pt-1"><button type="button" onClick={() => toggleSaveProduct(product.id)} aria-label={`${savedProductIds.includes(product.id) ? '取消收藏' : '收藏'}${product.name}`} aria-pressed={savedProductIds.includes(product.id)} className="flex min-h-8 items-center gap-1"><Heart size={14} fill={savedProductIds.includes(product.id) ? 'currentColor' : 'none'} aria-hidden="true" />收藏</button><button type="button" onClick={() => toggleRejectProduct(product.id)} aria-pressed={rejectedProductIds.includes(product.id)} className="min-h-8 text-[var(--market-text-muted)]">{rejectedProductIds.includes(product.id) ? '撤销' : '不合适'}</button></div></div>)}</div> : null}</div>}
            </div>)}
            {isAiThinking && !chatDockPreview && <p className="text-sm text-[var(--market-text-muted)]" role="status">正在分析</p>}
          </div>
        </section>
        <FeedChatDock
          chatOpen={feedView === 'chat'}
          navigationOpen={navigationOpen}
          disabled={onboardingActive}
          initialInstalledSkillIds={initialInstalledSkillIds}
          onSubmitMessage={submitFeedMessage}
          onSubmitAttachment={submitFeedAttachment}
          onBrowse={returnToFeed}
          getFeedScrollTop={() => feedScrollerRef.current?.scrollTop ?? 0}
        />
        {knowYourselfStage === 'preview' && <KnowYourselfPreview onClose={closeKnowYourselfPreview} onOpenDetail={openKnowYourselfDetail} />}
        {knowYourselfStage === 'detail' && <KnowYourselfDetail installed={knowYourselfInstalled} onClose={returnToKnowYourselfPreview} onToggleInstall={toggleKnowYourself} />}
      </div>
    </div>
  );
};

const KnowYourselfPreview: React.FC<{ onClose: () => void; onOpenDetail: () => void }> = ({ onClose, onOpenDetail }) => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="false" aria-label="识己技能预览" className="fixed inset-0 z-20 bg-[var(--market-canvas)] text-[var(--market-ink)]">
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col px-3 pb-[calc(112px+env(safe-area-inset-bottom))] pt-[calc(70px+env(safe-area-inset-top))] sm:px-6">
        <article className="relative min-h-0 flex-1 overflow-hidden rounded-[var(--radius-card)] bg-[var(--market-canvas)]">
          <button type="button" onClick={onClose} aria-label="关闭预览" className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-[var(--market-canvas)]/90 text-[var(--market-ink)] backdrop-blur-md hover:bg-[var(--market-hover)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]">
            <X size={19} aria-hidden="true" />
          </button>
          <button type="button" onClick={onOpenDetail} aria-label="打开识己技能详情" className="flex h-full w-full flex-col overflow-y-auto text-left focus-visible:outline-2 focus-visible:outline-[var(--market-support)] sm:flex-row sm:overflow-hidden">
            <img src="/consumer-market/skills/know-yourself-cover.png" alt="" className="block aspect-[3/4] w-full shrink-0 object-cover sm:aspect-[3/4] sm:h-full sm:w-auto sm:max-w-[48%]" />
            <span className="flex min-h-0 flex-1 flex-col justify-center gap-3 overflow-y-auto px-5 py-6 sm:px-8">
              <span className="text-xs text-[var(--market-text-muted)]">发布者 Luna</span>
              <span className="text-2xl font-semibold leading-tight sm:text-3xl">识己</span>
              <span className="max-w-xl text-sm leading-6 text-[var(--market-text-secondary)]">{EVA_SKILLS.find((skill) => skill.id === 'know-yourself')?.description}</span>
              <span className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-[var(--market-ink)]">查看详情 <ArrowRight size={16} aria-hidden="true" /></span>
            </span>
          </button>
        </article>
      </div>
    </div>
  );
};

const KnowYourselfDetail: React.FC<{ installed: boolean; onClose: () => void; onToggleInstall: () => void }> = ({ installed, onClose, onToggleInstall }) => {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="识己技能详情" className="fixed inset-0 z-[70] flex select-none flex-col overflow-hidden bg-[var(--market-canvas)] text-[var(--market-ink)]">
      <div className="flex-1 overflow-y-auto overscroll-contain pb-28">
        <div className="mx-auto max-w-md px-4 pt-3">
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl bg-[var(--market-surface-muted)]">
            <img src="/consumer-market/skills/know-yourself-cover.png" alt="识己技能封面" className="h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between p-3.5">
              <button type="button" onClick={onClose} aria-label="返回预览" className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-md transition-colors hover:bg-black/40 focus-visible:outline-2 focus-visible:outline-white">
                <ArrowLeft size={18} aria-hidden="true" />
              </button>
              <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-[var(--market-ink)] backdrop-blur-md">技能</span>
            </div>
          </div>

          <div className="px-1 pt-3">
            <div className="flex min-h-11 items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full border-[0.5px] border-[var(--market-border)] bg-[var(--market-surface)] text-xs font-semibold text-[var(--market-ink)]">L</span>
              <span className="text-xs font-semibold text-[var(--market-ink)]">Luna</span>
            </div>
            <h1 className="mt-3 text-lg font-semibold leading-snug">识己</h1>
            <div className="mt-5">
              <h2 className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-[var(--market-text-muted)]">技能介绍</h2>
              <p className="text-sm leading-6 text-[var(--market-text-secondary)]">{EVA_SKILLS.find((skill) => skill.id === 'know-yourself')?.description}</p>
            </div>
            <div className="mt-5 pb-8">
              <h2 className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-[var(--market-text-muted)]">技能文件</h2>
              <div className="flex min-h-14 items-center justify-between gap-3 border-y-[0.5px] border-[var(--market-border)] py-2">
                <a href="/consumer-market/skills/know-yourself/SKILL.md" target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 text-sm focus-visible:outline-2 focus-visible:outline-[var(--market-support)]">
                  <FileText size={18} className="shrink-0" aria-hidden="true" />
                  <span className="truncate">SKILL.md</span>
                </a>
                <a href="/consumer-market/skills/know-yourself-1.1.0.zip" download className="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-[var(--market-text-secondary)] hover:bg-[var(--market-hover)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]">
                  <Download size={15} aria-hidden="true" />下载技能包
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
      <footer className="fixed bottom-0 left-0 right-0 z-30 border-t-[0.5px] border-[var(--market-border)] bg-[var(--market-canvas)]/95 px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md">
        <div className="mx-auto max-w-md">
          <button type="button" onClick={onToggleInstall} aria-pressed={installed} className={`flex h-11 w-full items-center justify-center gap-2 rounded-full px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)] ${installed ? 'bg-[var(--market-surface-muted)] text-[var(--market-ink)] hover:bg-[var(--market-hover)]' : 'bg-[var(--market-ink)] text-[var(--market-canvas)] hover:opacity-85'}`}>
            {installed ? <Check size={17} aria-hidden="true" /> : <Plus size={17} aria-hidden="true" />}{installed ? '已添加到技能' : '添加到技能'}
          </button>
        </div>
      </footer>
    </div>,
    document.body,
  );
};

const FeedProductCard: React.FC<{
  product: ProductItem;
  onClick: () => void;
}> = ({ product, onClick }) => {
  const images = [product.mainImage, ...product.secondaryImages.filter((image) => image !== product.mainImage)];
  const [imageIndex, setImageIndex] = React.useState(0);
  const imageAspectRatio = Number.isFinite(product.aspectRatio) && product.aspectRatio > 0 ? product.aspectRatio : 1;

  return (
    <div className="product-feed-card group w-full select-none rounded-[var(--radius-card)] bg-[var(--market-canvas)] p-1 transition-colors duration-200 hover:bg-[var(--market-hover)]">
      <div className="px-2">
        {product.storeSlug ? (
          <Link
            href={`/store/${encodeURIComponent(product.storeSlug)}`}
            className="flex min-h-16 w-full min-w-0 flex-col justify-center gap-0.5 py-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--market-accent)]"
            aria-label={`进入${product.storeName}的网页`}
            title={product.storeName}
          >
            <span className="text-[11px] font-medium tracking-[0.12em] text-[var(--market-text-muted)]">发布者</span>
            <span className="w-full truncate text-base font-semibold leading-[1.25] text-[var(--market-ink)] hover:underline sm:text-lg">{product.storeName}</span>
          </Link>
        ) : (
          <div className="flex min-h-16 min-w-0 flex-col justify-center gap-0.5 py-2.5" title={product.storeName}>
            <span className="text-[11px] font-medium tracking-[0.12em] text-[var(--market-text-muted)]">发布者</span>
            <span className="w-full truncate text-base font-semibold leading-[1.25] text-[var(--market-ink)] sm:text-lg">{product.storeName}</span>
          </div>
        )}
      </div>
      <div className="relative">
        <button
          type="button"
          onClick={onClick}
          aria-label={`查看商品：${product.name}`}
          className="product-feed-card__image block w-full cursor-pointer overflow-hidden bg-[var(--market-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-accent)]"
          style={{ aspectRatio: imageAspectRatio }}
        >
          <img
            src={images[imageIndex]}
            alt=""
            className={`product-feed-card__photo h-full w-full object-cover ${product.id === 'P0005' && imageIndex === 0 ? 'product-feed-card__photo--trimmed' : ''}`}
            loading="lazy"
          />
          {product.videoUrl && (
            <span className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-[var(--market-ink)] shadow-sm" aria-label="含视频">
              <Play size={14} fill="currentColor" aria-hidden="true" />
            </span>
          )}
        </button>
        {images.length > 1 ? (
          <div
            role="group"
            aria-label="商品图片"
            className="absolute bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-[var(--market-surface)] px-1 py-0.5"
          >
            {images.map((image, index) => (
              <button
                key={`${image}-${index}`}
                type="button"
                onClick={() => setImageIndex(index)}
                aria-label={`查看第 ${index + 1} 张商品图片`}
                aria-current={index === imageIndex ? 'true' : undefined}
                className="flex h-6 w-6 items-center justify-center"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${index === imageIndex ? 'bg-[var(--market-ink)]' : 'bg-[var(--market-text-muted)]/40'}`} aria-hidden="true" />
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onClick}
        aria-label={`查看商品：${product.name}`}
        className="product-feed-card__details flex min-h-10 w-full cursor-pointer items-center justify-between gap-2 px-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--market-accent)]"
      >
        <span className="min-w-0 flex-1 truncate text-xs font-normal leading-tight text-[var(--market-text-secondary)] sm:text-sm">{product.name}</span>
        <span className="shrink-0 text-xs font-normal text-[var(--market-text-muted)]">{product.formattedPrice}</span>
      </button>
    </div>
  );
};

const FeedSceneCard: React.FC<{
  scenePost: ScenePost;
  onClick: () => void;
}> = ({ scenePost, onClick }) => {
  const productCount = scenePost.linkedProducts?.length || 0;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`查看${scenePost.kind ? '内容' : '场景'}：${scenePost.title}`}
      className="scene-post-card group relative block w-full cursor-pointer overflow-hidden bg-[var(--market-surface-muted)] text-left shadow-2xs transition-all duration-200 hover:shadow-xs active:scale-[0.98]"
    >
      <img
        src={scenePost.coverImage}
        alt=""
        className="block h-auto w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        loading="lazy"
      />
      <span className="scene-post-card__glass pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-1 px-3 pb-3 pt-12 text-white sm:px-4 sm:pb-4">
        <span className="block truncate text-xs font-semibold leading-tight sm:text-sm">
          {scenePost.title}
        </span>
        <span className="flex items-center justify-between gap-2 text-[11px] text-white/90">
          <span className="min-w-0 flex-1 truncate">
            {scenePost.editorName}
          </span>
          {productCount > 0 && (
            <span className="flex shrink-0 items-center gap-1">
              {scenePost.kind ? <Layers size={11} aria-hidden="true" /> : <ShoppingBag size={11} aria-hidden="true" />}
              <span>{productCount}</span>
            </span>
          )}
        </span>
      </span>
    </button>
  );
};

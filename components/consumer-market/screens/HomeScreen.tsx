'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, Download, FileText, Heart, Layers, Play, Plus, ShoppingBag, X } from 'lucide-react';
import { useOmnilink } from '../context/OmnilinkContext';
import { getDiscoveryType, type ProductItem, type ScenePost } from '../types';
import { interleaveDiscoveryFeed, rankDiscoveryFeed } from '@/lib/consumer-advisor/discovery-ranking';
import { FeedChatDock, FEED_CHAT_SCROLL_KEY, type FeedAttachment, type FeedDroppedReference } from '../components/FeedChatDock';
import { useDiscoveryInsight } from '../hooks/useDiscoveryInsight';
import { SparkShockwave } from '../components/SparkShockwave';
import { DiscoveryPriceProvider, DisplayPrice } from '../components/DisplayPrice';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { AiChatMessage } from '../types';
import { SignupInvitation } from '../components/SignupInvitation';
import { InitialAssistantSetup } from './InitialAssistantSetup';
import { MemoryPanel } from './MemoryPanel';
import { ShoppingPreferenceSurveyFlow } from './ShoppingPreferenceSurveyFlow';
import { ExecutionResults } from '../components/ExecutionResults';
import { emptyAiAssistantProfile, type AiAssistantProfile } from '@/lib/consumer-advisor/ai-assistant-profile';
import { DEFAULT_INSTALLED_SKILL_IDS, AI_ASSISTANT_SKILLS, AI_ASSISTANT_SKILLS_STORAGE_KEY, readInstalledSkillIds, type AiAssistantSkillId } from '../components/CapabilityLibrary';
import CarouselCards, { type RailItem } from '@/components/kokonutui/carousel-cards';
import { ProgressiveBlur } from '@/components/ui/progressive-blur';

const excludedDiscoveryProductIds = new Set(['P0006', 'ssd-cat-paw-slippers']);

export const HomeScreen: React.FC<{ initialSignupInvitation?: boolean; invitationUserId?: string; navigationOpen?: boolean; chatDockPreview?: boolean; initialOnboarding?: boolean; initialAiAssistantProfile?: AiAssistantProfile; profileName?: string | null; deepSeekKeyConfigured?: boolean; onboardingPreview?: boolean; initialInstalledSkillIds?: AiAssistantSkillId[]; persistSkillChanges?: boolean;personalPreview?:boolean }> = ({ initialSignupInvitation = false, invitationUserId = 'signup-preview', navigationOpen = false, chatDockPreview = false, initialOnboarding = false, initialAiAssistantProfile, profileName, deepSeekKeyConfigured = false, onboardingPreview = false, initialInstalledSkillIds, persistSkillChanges = false,personalPreview=false }) => {
  const {
    feedItems,
    products,
    savedProductIds,
    rejectedProductIds,
    toggleSaveProduct,
    toggleRejectProduct,
    addToCart,
    openFloatingProduct,
    openScenePost,
    aiMessages,
    activeAiConversationId,
    isAiThinking,
    aiModel,
    showToast,
    sendAiMessage,
    setActiveAssistantSkillId,
    setAiModel,
    sendAiImageMessage,
    sendAiFileMessage,
    sendAiUrlMessage,
    homeChatOpen,
    setHomeChatOpen,
    discovery,discoveryBusy,discoveryError,loadMoreDiscovery,refreshDiscovery,retryDiscovery,clearDiscovery,refineDiscovery,skipDiscoveryQuestion,
    personalView,openPersonalView,resumeDiscovery,
  } = useOmnilink();
  const visibleFeedItems = useMemo(() => {
    if(discovery)return discovery.products.map((product)=>({type:'product' as const,product}));
    if(discoveryError?.retrySpec||discoveryBusy)return [];
    const rankedFeedItems = rankDiscoveryFeed(feedItems.filter((item) => item.type !== 'product'
      || !excludedDiscoveryProductIds.has(item.product.id)), products, savedProductIds, rejectedProductIds);
    return interleaveDiscoveryFeed(rankedFeedItems);
  }, [feedItems, products, rejectedProductIds, savedProductIds,discovery,discoveryError?.retrySpec,discoveryBusy]);
  const feedScrollerRef = useRef<HTMLDivElement>(null);
  const feedMasonryRef = useRef<HTMLDivElement>(null);
  const chatScrollerRef = useRef<HTMLElement>(null);
  const [feedView, setFeedView] = useState<'feed' | 'card' | 'chat' | 'returning'>(homeChatOpen ? 'chat' : 'feed');
  const insight = useDiscoveryInsight(discovery, aiModel, feedScrollerRef, feedMasonryRef, feedView === 'feed' && !personalView);
  const [shockwaveRun, setShockwaveRun] = useState<number | null>(null);
  const shockwaveActiveRef = useRef(false);
  const [previewMessages, setPreviewMessages] = useState<AiChatMessage[]>([]);
  const [previewChoice, setPreviewChoice] = useState<string | null>(null);
  const [previewAnswer, setPreviewAnswer] = useState<string | null>(null);
  const [cardHistoryOpen, setCardHistoryOpen] = useState(false);
  const pageEndRef=useRef<HTMLDivElement>(null);
  const personalPaneRef=useRef<HTMLElement>(null);
  const previousRunRef=useRef<string|null>(null);
  const [droppedReferences, setDroppedReferences] = useState<FeedDroppedReference[]>([]);
  const holdCleanupRef = useRef<(() => void) | null>(null);
  const suppressCardClickRef = useRef(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [deepSeekConnected, setDeepSeekConnected] = useState(deepSeekKeyConfigured);
  const [installedSkillIds, setInstalledSkillIds] = useState<AiAssistantSkillId[]>(initialInstalledSkillIds ?? DEFAULT_INSTALLED_SKILL_IDS);
  const [knowYourselfStage, setKnowYourselfStage] = useState<'closed' | 'preview' | 'detail'>('closed');
  const closeKnowYourselfPreview = useCallback(() => setKnowYourselfStage('closed'), []);
  const openKnowYourselfDetail = useCallback(() => setKnowYourselfStage('detail'), []);
  const returnToKnowYourselfPreview = useCallback(() => setKnowYourselfStage('preview'), []);
  const onboardingActive = initialOnboarding && !onboardingCompleted;
  const conversationMessages = chatDockPreview ? previewMessages : aiMessages.filter((message) => message.conversationId === activeAiConversationId);
  const knowYourselfSkill = AI_ASSISTANT_SKILLS.find((skill) => skill.id === 'know-yourself')!;
  const knowYourselfInstalled = installedSkillIds.includes(knowYourselfSkill.id);

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    if(params.get('memories')==='1')openPersonalView('memories');
    else if(params.get('shoppingPreferences')==='1'||params.get('shoppingPreferencesPreview')==='1')openPersonalView('assessment');
  },[openPersonalView]);
  useEffect(()=>{
    if(!personalView)return;
    const frame=requestAnimationFrame(()=>personalPaneRef.current?.querySelector<HTMLButtonElement>('button')?.focus());
    return()=>cancelAnimationFrame(frame);
  },[personalView]);
  useEffect(()=>{
    if(!discovery||discovery.searchRunId===previousRunRef.current)return;
    previousRunRef.current=discovery.searchRunId;
    setFeedView('feed');setCardHistoryOpen(false);setHomeChatOpen(false);
    if(feedScrollerRef.current)feedScrollerRef.current.scrollTop=0;
  },[discovery,setHomeChatOpen]);
  useEffect(()=>{
    if(!discovery?.nextCursor||discoveryBusy||discoveryError?.message||personalView||feedView!=='feed'||!pageEndRef.current)return;
    const observer=new IntersectionObserver((entries)=>{if(entries.some((entry)=>entry.isIntersecting))loadMoreDiscovery()},
      {root:feedScrollerRef.current,rootMargin:'400px'});
    observer.observe(pageEndRef.current);return()=>observer.disconnect();
  },[discovery?.nextCursor,discoveryBusy,discoveryError?.message,personalView,feedView,loadMoreDiscovery]);

  useLayoutEffect(() => {
    const masonry = feedMasonryRef.current;
    if (!masonry) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const startedAt = performance.now();
    let timer = 0;
    const animateEntry = () => {
      const visibleCards = Array.from(masonry.querySelectorAll<HTMLElement>('[data-feed-key]')).filter((card) => {
        const rect = card.getBoundingClientRect();
        return rect.height > 1 && rect.bottom > -120 && rect.top < window.innerHeight + 120;
      });
      const columns = [...new Set(visibleCards.map((card) => Math.round(card.getBoundingClientRect().left)))].sort((a, b) => a - b);
      const elapsed = performance.now() - startedAt;
      if ((elapsed < 200 || columns.length < Number(getComputedStyle(masonry).columnCount)) && elapsed < 1400) {
        timer = window.setTimeout(animateEntry, 80);
        return;
      }
      visibleCards.forEach((card) => {
        const column = columns.indexOf(Math.round(card.getBoundingClientRect().left));
        const rises = columns.length === 2 ? column % 2 === 0 : column !== 2;
        const delay = Math.max(0, column) * 65;
        const animation = card.animate([
          { opacity: 0.6, filter: 'blur(2.5px)', transform: `translateY(${rises ? 84 : -84}px) scaleY(1.03)` },
          { opacity: 1, filter: 'blur(0px)', transform: 'translateY(0) scaleY(1)' },
        ], { duration: 1000, delay, easing: 'cubic-bezier(0.45, 0, 0.25, 1)' });
      });
    };
    timer = window.setTimeout(animateEntry, 80);
    return () => window.clearTimeout(timer);
  }, []);


  useEffect(() => {
    const ids = initialInstalledSkillIds ?? readInstalledSkillIds();
    setInstalledSkillIds(ids);
    if (initialInstalledSkillIds) localStorage.setItem(AI_ASSISTANT_SKILLS_STORAGE_KEY, JSON.stringify(ids));
  }, [initialInstalledSkillIds]);

  const toggleKnowYourself = () => {
    const next = knowYourselfInstalled
      ? installedSkillIds.filter((id) => id !== knowYourselfSkill.id)
      : [...installedSkillIds, knowYourselfSkill.id];
    setInstalledSkillIds(next);
    localStorage.setItem(AI_ASSISTANT_SKILLS_STORAGE_KEY, JSON.stringify(next));
    if (!persistSkillChanges) return;
    void fetch('/api/consumer/ai-assistant-profile', {
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

  const submitFeedMessage = (message: string, selectedProductIds: string[], hasActiveSkill: boolean, skillId?: AiAssistantSkillId) => {
    if (onboardingActive) return;
    setCardHistoryOpen(true);
    openPersonalView(null);
    if (chatDockPreview) setPreviewMessages((current) => [...current, { id: `preview-${Date.now()}`, conversationId: activeAiConversationId, text: message, isUser: true }]);
    else sendAiMessage(message, selectedProductIds, hasActiveSkill,undefined,skillId);
    setFeedView((current) => current === 'chat' ? current : 'card');
  };

  const submitFeedAttachment = (attachment: FeedAttachment, message: string, selectedProductIds: string[], hasActiveSkill: boolean, skillId?: AiAssistantSkillId) => {
    if (onboardingActive) return;
    setCardHistoryOpen(true);
    openPersonalView(null);
    if (chatDockPreview) {
      setPreviewMessages((current) => [...current, {
        id: `preview-${Date.now()}`,
        conversationId: activeAiConversationId,
        text: message,
        isUser: true,
        ...(attachment.kind === 'image' ? { image: attachment.data } : { fileName: attachment.name }),
      }]);
    } else if(attachment.kind==='url') {
      sendAiUrlMessage(attachment.data,message,selectedProductIds);setHomeChatOpen(true);
    } else if (attachment.kind === 'image') {
      sendAiImageMessage(attachment.data, message, selectedProductIds, hasActiveSkill,undefined,skillId);
    } else {
      sendAiFileMessage(attachment.name, attachment.data, message, selectedProductIds, hasActiveSkill,undefined,skillId);
    }
    setFeedView((current) => current === 'chat' ? current : 'card');
  };

  const activateChat = () => {
    if (feedView !== 'feed') return;
    setCardHistoryOpen(conversationMessages.length > 0);
    setFeedView('card');
    if (shockwaveActiveRef.current) return;
    shockwaveActiveRef.current = true;
    setShockwaveRun((current) => (current ?? 0) + 1);
  };

  const returnToFeed = () => {
    shockwaveActiveRef.current = false;
    setShockwaveRun(null);
    setCardHistoryOpen(false);
    if (feedView === 'card') setFeedView('feed');
    else setHomeChatOpen(false);
  };

  useEffect(() => () => holdCleanupRef.current?.(), []);

  const startCardHold = (event: React.PointerEvent<HTMLDivElement>, reference: FeedDroppedReference) => {
    if (event.button !== 0 || onboardingActive || (event.target as HTMLElement).closest('[role="group"]')) return;
    holdCleanupRef.current?.();
    const card = event.currentTarget;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    let active = false;
    let ghost: HTMLDivElement | null = null;
    let overComposer = false;
    let lastX = startX;
    let lastY = startY;
    const dropTarget = document.querySelector<HTMLElement>('.feed-chat-fluid-card');
    const clear = () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('touchmove', preventTouchScroll);
      dropTarget?.removeAttribute('data-drag-over');
      card.removeAttribute('data-dragging');
      ghost?.remove();
      holdCleanupRef.current = null;
    };
    const update = (x: number, y: number) => {
      if (!ghost) return;
      ghost.style.transform = `translate3d(${x + 14}px, ${y + 14}px, 0) scale(${ghost.dataset.dragScale})`;
      const bounds = dropTarget?.getBoundingClientRect();
      overComposer = Boolean(bounds && x >= bounds.left - 12 && x <= bounds.right + 12 && y >= bounds.top - 12 && y <= bounds.bottom + 12);
      if (overComposer) dropTarget?.setAttribute('data-drag-over', 'true');
      else dropTarget?.removeAttribute('data-drag-over');
    };
    const activate = () => {
      if (active) return;
      active = true;
      card.setAttribute('data-dragging', 'true');
      ghost = document.createElement('div');
      ghost.className = 'feed-card-drag-ghost';
      ghost.setAttribute('aria-hidden', 'true');
      ghost.inert = true;
      const rect = card.getBoundingClientRect();
      ghost.style.width = `${rect.width}px`;
      ghost.style.height = `${rect.height}px`;
      ghost.dataset.dragScale = String(Math.min(0.82, 230 / rect.width, 310 / rect.height));
      ghost.appendChild(card.firstElementChild!.cloneNode(true));
      document.querySelector('.consumer-market-shell')?.appendChild(ghost);
      update(lastX, lastY);
    };
    const timer = window.setTimeout(activate, 380);
    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      lastX = moveEvent.clientX;
      lastY = moveEvent.clientY;
      if (!active && Math.hypot(lastX - startX, lastY - startY) > 9) {
        if (moveEvent.pointerType === 'mouse') activate();
        else { clear(); return; }
      }
      if (active) { moveEvent.preventDefault(); update(lastX, lastY); }
    };
    const end = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return;
      if (active) update(upEvent.clientX, upEvent.clientY);
      const shouldDrop = active && overComposer;
      if (active) {
        suppressCardClickRef.current = true;
        window.setTimeout(() => { suppressCardClickRef.current = false; }, 500);
      }
      clear();
      if (shouldDrop) {
        setDroppedReferences((current) => current.some((item) => item.key === reference.key) ? current : [...current, reference]);
        setFeedView((current) => current === 'feed' ? 'card' : current);
      }
    };
    const cancel = (cancelEvent: PointerEvent) => { if (cancelEvent.pointerId === pointerId) clear(); };
    const preventTouchScroll = (touchEvent: TouchEvent) => { if (active) touchEvent.preventDefault(); };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('touchmove', preventTouchScroll, { passive: false });
    holdCleanupRef.current = clear;
  };

  const renderFeedItem = (item: (typeof visibleFeedItems)[number], index: number) =>
    <div key={`${item.type}-${item.type === 'product' ? item.product.id : item.scenePost.id}-${index}`} data-feed-key={`${item.type}-${item.type === 'product' ? item.product.id : item.scenePost.id}-${index}`} data-product-id={item.type === 'product' ? item.product.id : undefined} className="feed-masonry-card mb-1.5 break-inside-avoid" onPointerDown={(event) => startCardHold(event, item.type === 'product' ? { key: `product-${item.product.id}`, title: item.product.name, url: item.product.sourceUrl ?? (item.product.storeSlug ? `${window.location.origin}/store/${encodeURIComponent(item.product.storeSlug)}/products/${encodeURIComponent(item.product.id)}` : undefined), productId: item.product.id, detail: [item.product.storeName, item.product.formattedPrice, item.product.shortDescription].filter(Boolean).join('；').slice(0, 300) } : { key: `scene-${item.scenePost.id}`, title: item.scenePost.title, url: `${window.location.origin}/discover?post=${encodeURIComponent(item.scenePost.id)}`, detail: [item.scenePost.editorName, item.scenePost.description].filter(Boolean).join('；').slice(0, 300) })} onDragStart={(event) => event.preventDefault()} onContextMenu={(event) => { if (event.currentTarget.hasAttribute('data-dragging')) event.preventDefault(); }} onClickCapture={(event) => { if (suppressCardClickRef.current) { event.preventDefault(); event.stopPropagation(); suppressCardClickRef.current = false; } }}>
      {item.type === 'product'
        ? <FeedProductCard product={item.product} onClick={() => item.product.sourceUrl ? window.location.assign(item.product.sourceUrl) : openFloatingProduct(item.product)} />
        : <FeedSceneCard scenePost={item.scenePost} onClick={() => openScenePost(item.scenePost)} />}
    </div>;

  const feedColumnClasses = navigationOpen ? 'columns-2' : 'columns-2 lg:columns-3';
  const feedInteractive = !personalView&&(feedView === 'feed' || feedView === 'card');

  const feedContent = <DiscoveryPriceProvider active={Boolean(discovery&&(discovery.spec.minPrice!==null||discovery.spec.maxPrice!==null))} currency={discovery?.spec.currency} snapshot={discovery?.priceReference}>
    <section id="discovery-feed-panel" aria-label="探索内容" className="px-2 sm:px-2.5">
      {discovery&&<header className="flex min-h-12 items-center gap-3 px-3 pb-3"><h1 className="min-w-0 flex-1 break-words text-base font-medium">{discovery.query}</h1><span className="text-xs text-[var(--market-text-secondary)]">已加载 {discovery.products.length} 件</span><button type="button" onClick={clearDiscovery} className="min-h-11 rounded-full px-3 text-sm hover:bg-[var(--market-hover)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]">清除</button></header>}
      {discovery?.retrieval?.degraded&&<p role="status" className="px-3 pb-3 text-xs text-[var(--market-text-secondary)]">语义检索暂不可用，已切换关键词检索。</p>}
      {discovery?.priceWarning&&<p role="status" className="px-3 pb-3 text-xs text-[var(--market-text-secondary)]">部分商品汇率不可用，未纳入预算筛选。</p>}
      {visibleFeedItems.length === 0 && !discoveryError?.message&&!discoveryBusy&&<p className="mx-auto max-w-md py-16 text-center text-sm text-[var(--market-text-secondary)]">{discovery?`没有找到符合条件的公开${discovery.spec.type === '服务' ? '服务' : '商品'}，可修改关键词。`:'暂无内容。'}</p>}
      <div ref={feedMasonryRef} className={`${feedColumnClasses} gap-1.5`}>
        {personalPreview&&!initialSignupInvitation&&!discovery&&!discoveryBusy&&!discoveryError?.retrySpec&&<div data-feed-key="know-yourself" className="feed-masonry-card mb-1.5 break-inside-avoid">
          <article className="product-feed-card group w-full select-none rounded-[var(--radius-card)] bg-[var(--market-canvas)] p-1 transition-colors duration-200 hover:bg-[var(--market-hover)]">
            <div className="px-2">
              <div className="flex min-h-16 w-full min-w-0 flex-col justify-center gap-0.5 py-2.5">
                <span className="text-[11px] font-medium tracking-[0.12em] text-[var(--market-text-muted)]">发布者</span>
                <span className="w-full truncate text-base font-semibold leading-[1.25] text-[var(--market-ink)] sm:text-lg">Luna</span>
              </div>
            </div>
            <button type="button" onClick={() => setKnowYourselfStage('preview')} aria-label="预览识己技能" className="block w-full cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)]">
              <img src="/consumer-market/skills/know-yourself-cover.png" alt="" className="block aspect-[3/4] w-full rounded-[var(--radius-card-nested)] object-cover" loading="lazy" />
              <span className="flex min-h-10 items-center px-2 py-2">
                <span className="text-xs font-medium leading-tight text-[var(--market-ink)] sm:text-sm">{knowYourselfSkill.title}</span>
              </span>
            </button>
          </article>
        </div>}
        {visibleFeedItems.map(renderFeedItem)}
      </div>
      {discovery?.question&&<section aria-label="细化本次搜索" className="mx-auto mt-6 max-w-xl px-3 py-4"><h2 className="text-sm font-medium">{discovery.question.prompt}</h2><div className="mt-3 flex flex-wrap gap-2">{discovery.question.options.map((option)=><button type="button" key={option.value} disabled={discoveryBusy} onClick={()=>refineDiscovery(option.value)} className="min-h-11 rounded-full px-4 text-sm hover:bg-[var(--market-hover)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)] disabled:opacity-40">{option.label}</button>)}<button type="button" onClick={skipDiscoveryQuestion} disabled={discoveryBusy} className="min-h-11 rounded-full px-3 text-sm text-[var(--market-text-secondary)] hover:bg-[var(--market-hover)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]">跳过</button></div></section>}
      {discoveryError?.message&&<div role="alert" className="mx-auto max-w-xl px-3 py-4 text-sm"><p>{discoveryError.message}</p>{discoveryError.code!=='MEMORY_WARNING'&&<button type="button" disabled={discoveryBusy} onClick={retryDiscovery} className="mt-2 min-h-11 rounded-full px-4 hover:bg-[var(--market-hover)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]">{discoveryError.code==='CONTEXT_CHANGED'||discoveryError.code==='SEARCH_EXPIRED'?'刷新结果':'重试'}</button>}</div>}
      <div ref={pageEndRef} className="flex min-h-16 items-center justify-center px-3 py-4">
        {discoveryBusy?<p role="status" className="text-sm">正在读取商品…</p>:discovery?.nextCursor?<button type="button" onClick={loadMoreDiscovery} className="min-h-11 rounded-full px-5 text-sm hover:bg-[var(--market-hover)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]">加载更多</button>:discovery&&discovery.products.length>0?<p className="text-xs text-[var(--market-text-secondary)]">已显示本次搜索结果</p>:null}
      </div>
    </section></DiscoveryPriceProvider>;

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-[var(--market-canvas)]">
      <div className="relative h-full min-h-0 w-full overflow-hidden">
        <div
          ref={feedScrollerRef}
          tabIndex={-1}
          aria-hidden={!feedInteractive}
          inert={!feedInteractive}
          data-navigation-open={navigationOpen}
          className={`home-feed-scroller absolute inset-x-0 bottom-0 top-0 overscroll-contain pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[56px] md:pt-[24px] transition-transform duration-500 ease-out motion-reduce:transition-none ${feedInteractive ? 'overflow-y-auto' : 'overflow-hidden'} ${feedView === 'chat' ? '-translate-y-full' : feedView === 'returning' ? 'translate-y-full transition-none' : 'translate-y-0'}`}
        >
          {feedContent}
        </div>
        <section
          ref={chatScrollerRef}
          aria-label="对话"
          aria-live="polite"
          aria-hidden={feedView !== 'chat'||Boolean(personalView)}
          inert={feedView !== 'chat'||Boolean(personalView)}
          className={`home-chat-scroller absolute inset-x-0 bottom-0 top-14 overflow-y-auto bg-[var(--market-canvas)] px-4 pb-36 pt-4 transition-transform duration-500 ease-out motion-reduce:transition-none sm:top-0 sm:px-6 sm:pb-28 sm:pt-[72px] ${feedView === 'chat' ? 'translate-y-0' : feedView === 'returning' ? '-translate-y-full' : 'translate-y-full'}`}
        >
          <div className="mx-auto w-full max-w-3xl space-y-6">
            {onboardingActive && <InitialAssistantSetup initialProfile={initialAiAssistantProfile ?? emptyAiAssistantProfile} defaultName={profileName ?? ''} deepSeekConfigured={deepSeekConnected} preview={onboardingPreview} onDeepSeekConfigured={() => { setDeepSeekConnected(true); if (!onboardingPreview) setAiModel('deepseek-v4-pro'); }} onComplete={() => {setOnboardingCompleted(true);openPersonalView('assessment');}} />}
            {conversationMessages.map((message) => <div key={message.id} className={message.isUser ? 'flex justify-end' : 'text-[var(--market-ink)]'}>
              {message.isUser ? <div className="max-w-[88%] rounded-2xl bg-[var(--market-surface-muted)] px-4 py-3 text-sm leading-6 sm:text-base">{message.image && <img src={message.image} alt="已发送的图片" className="mb-2 max-h-64 max-w-full rounded-lg object-contain" />}{message.fileName && <p className="mb-1 text-xs">{message.fileName}</p>}<p className="whitespace-pre-wrap break-words">{message.text}</p></div> : <div className="max-w-full break-words text-sm leading-7 sm:text-base [&_p]:mb-3 [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border-b-[0.5px] [&_td]:border-[var(--market-border)] [&_td]:p-2 [&_th]:border-b-[0.5px] [&_th]:border-[var(--market-border)] [&_th]:p-2 [&_th]:text-left">{message.intent === 'outfit-styling' && <p className="mb-1 text-xs font-medium text-[var(--market-text-muted)]">穿搭建议</p>}<ReactMarkdown remarkPlugins={[remarkGfm]} components={{ img: ({ src, alt }) => typeof src === 'string' && src.startsWith('/consumer-market/') ? <img src={src} alt={alt ?? ''} className="mr-2 inline-block h-11 w-11 rounded-md object-cover align-middle" /> : null }}>{message.text}</ReactMarkdown>{message.matchedProducts?.length ? <ChatProductRecommendations products={message.matchedProducts} matchReasons={message.matchReasons} savedProductIds={savedProductIds} rejectedProductIds={rejectedProductIds} onOpen={openFloatingProduct} onSave={toggleSaveProduct} onReject={toggleRejectProduct} onAddToCart={addToCart} /> : null}{message.searchRef&&<button type="button" onClick={()=>{const ref=message.searchRef!;openPersonalView(null);setFeedView('feed');setHomeChatOpen(false);resumeDiscovery(ref.searchRunId,ref.contextVersion,ref.spec)}} className="min-h-11 rounded-full px-4 text-sm hover:bg-[var(--market-hover)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]">查看结果</button>}{message.retrySpec&&<button type="button" disabled={discoveryBusy} onClick={()=>{openPersonalView(null);setFeedView('feed');setHomeChatOpen(false);refreshDiscovery(message.retrySpec)}} className="min-h-11 rounded-full px-4 text-sm hover:bg-[var(--market-hover)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]">重试搜索</button>}{message.usedPreferences?.length ? <p className="mt-2 text-xs text-[var(--market-text-muted)]">参考偏好：{message.usedPreferences.join('、')}</p> : null}</div>}
              {!message.isUser&&message.blocks&&<ExecutionResults blocks={message.blocks} sessionId={activeAiConversationId}/>}
              {message.id === 'ai-preview-question' && (previewAnswer ? <div className="mt-4 space-y-4"><div className="flex justify-end"><p className="rounded-2xl bg-[var(--market-surface-muted)] px-4 py-3 text-sm">{previewAnswer}</p></div><p className="text-sm">分层收纳可以让常用物件顺手，也为工作留出空间。</p><ChatProductRecommendations products={products.filter((product) => ['P0055', 'P0057', 'P0058'].includes(product.id))} savedProductIds={savedProductIds} rejectedProductIds={rejectedProductIds} onOpen={openFloatingProduct} onSave={toggleSaveProduct} onReject={toggleRejectProduct} onAddToCart={addToCart} /><button type="button" className="min-h-11 px-3 text-sm text-[var(--market-text-secondary)]" onClick={() => { setPreviewAnswer(null); setPreviewChoice(null); }}>重新选择</button></div> : <fieldset className="mt-3 space-y-2"><legend className="sr-only">选择偏好</legend>{['绿植与自然光营造的松弛感', '物件、收藏和使用痕迹', '一个能让我安静专注的角落', '桌面整洁、工具顺手的工作感', '其他'].map((option) => <label key={option} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm hover:bg-[var(--market-hover)]"><input type="radio" name="preview-choice" checked={previewChoice === option} onChange={() => setPreviewChoice(option)} />{option}</label>)}<button type="button" disabled={!previewChoice} onClick={() => setPreviewAnswer(previewChoice)} className="min-h-11 rounded-full bg-[var(--market-ink)] px-5 text-sm text-[var(--market-canvas)] disabled:opacity-40">提交答案</button></fieldset>)}
              {!message.isUser&&message.state==='cancelled'&&<p className="mt-2 text-xs text-[var(--market-text-secondary)]">已停止</p>}
            </div>)}
            {isAiThinking && !chatDockPreview && <p className="text-sm text-[var(--market-text-muted)]" role="status">正在分析</p>}
          </div>
        </section>
        {feedView === 'chat' && !personalView && <><ProgressiveBlur position="top" className="z-10" /><ProgressiveBlur position="bottom" className="z-10" /></>}
        {personalView&&<section ref={personalPaneRef} aria-label={personalView==='memories'?'个人记忆':'购物偏好'} className="absolute inset-0 z-20 overflow-y-auto bg-[var(--market-canvas)] pb-36 pt-14 sm:pb-28 sm:pt-6">
          {personalView==='memories'?<MemoryPanel preview={personalPreview}/>:<div className="mx-auto max-w-2xl px-4"><header className="mb-4 flex items-center gap-3"><button type="button" onClick={()=>openPersonalView(null)} className="min-h-11 rounded-full px-3 text-sm hover:bg-[var(--market-hover)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]">返回</button><h1 className="text-base font-medium">购物偏好</h1></header><ShoppingPreferenceSurveyFlow embedded preview={personalPreview} initialProfile={initialAiAssistantProfile??emptyAiAssistantProfile} onComplete={()=>{openPersonalView(null);setHomeChatOpen(false);setFeedView('feed');}} onReview={()=>openPersonalView('memories')}/></div>}
        </section>}
        {personalView && <><ProgressiveBlur position="top" className="z-20" /><ProgressiveBlur position="bottom" className="z-20" /></>}
        {shockwaveRun !== null && <SparkShockwave key={shockwaveRun} navigationOpen={navigationOpen} onComplete={() => {
          shockwaveActiveRef.current = false;
          setShockwaveRun(null);
        }} />}
        <SignupInvitation userId={invitationUserId} enabled={initialSignupInvitation} preview={personalPreview}
          blocked={Boolean(personalView) || feedView !== 'feed' || navigationOpen}
          onStartAssistant={() => {
            openPersonalView(null);
            setActiveAssistantSkillId('personal-advisor');
            setHomeChatOpen(false);
            setFeedView('card');
            setCardHistoryOpen(true);
            sendAiMessage('开始个人助手', [], true, undefined, 'personal-advisor');
            requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('textarea[aria-label="搜索或询问 AI assistant"]')?.focus({ preventScroll: true }));
          }}
          onBrowse={() => { setHomeChatOpen(false); setFeedView('feed'); feedScrollerRef.current?.focus(); }} />
        <FeedChatDock
          insightQuestion={insight.question}
          insightThinking={insight.thinking}
          onInsightSkip={()=>{insight.dismiss();skipDiscoveryQuestion();}}
          onInsightSelect={(option)=>{if(!discovery)return;insight.dismiss();refreshDiscovery({...discovery.spec,sessionTerms:option.terms,questionDismissed:true});}}
          chatOpen={feedView === 'card' || feedView === 'chat'}
          chatCardOpen={feedView === 'card'}
          cardHistoryOpen={cardHistoryOpen}
          onToggleCardHistory={() => setCardHistoryOpen((open) => !open)}
          onExpandChat={() => setHomeChatOpen(true)}
          conversationMessages={conversationMessages}
          navigationOpen={navigationOpen}
          disabled={onboardingActive}
          initialInstalledSkillIds={initialInstalledSkillIds}
          onSubmitMessage={submitFeedMessage}
          onSubmitAttachment={submitFeedAttachment}
          onBrowse={returnToFeed}
          onActivate={()=>{if(!personalView)activateChat();}}
          droppedReferences={droppedReferences}
          onRemoveDroppedReference={(key) => setDroppedReferences((current) => current.filter((reference) => reference.key !== key))}
          onClearDroppedReferences={() => setDroppedReferences([])}
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
              <span className="max-w-xl text-sm leading-6 text-[var(--market-text-secondary)]">{AI_ASSISTANT_SKILLS.find((skill) => skill.id === 'know-yourself')?.description}</span>
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
              <button type="button" onClick={onClose} aria-label="返回预览" data-glasswork="auto" className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full transition-transform focus-visible:outline-2 focus-visible:outline-[var(--market-support)]">
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
              <p className="text-sm leading-6 text-[var(--market-text-secondary)]">{AI_ASSISTANT_SKILLS.find((skill) => skill.id === 'know-yourself')?.description}</p>
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

type ChatProductRecommendationsProps = {
  products: ProductItem[];
  matchReasons?: Record<string, string>;
  savedProductIds: string[];
  rejectedProductIds: string[];
  onOpen: (product: ProductItem) => void;
  onSave: (productId: string) => void;
  onReject: (productId: string) => void;
  onAddToCart: (product: ProductItem, variant?: string, selectedOptions?: Record<string, string>) => void;
};

const ChatProductRecommendations: React.FC<ChatProductRecommendationsProps> = ({
  products,
  matchReasons,
  savedProductIds,
  rejectedProductIds,
  onOpen,
  onSave,
  onReject,
  onAddToCart,
}) => {
  const productsById = new Map(products.map((product) => [product.id, product]));

  function getQuickAdd(product: ProductItem) {
    const defaultVariant = product.variants?.find((variant) => variant.id === product.defaultVariantId);
    const needsVariant = Boolean(product.options?.length);
    const canQuickAdd = getDiscoveryType(product) === '商品'
      && product.priceMode !== 'inquiry'
      && product.priceMode !== 'unknown'
      && (!needsVariant || Boolean(defaultVariant));
    const defaultVariantLabel = defaultVariant
      ? Object.values(defaultVariant.optionValues).filter(Boolean).join(' / ') || '标准'
      : '标准';

    return { defaultVariant, defaultVariantLabel, canQuickAdd };
  }

  function renderActions(product: ProductItem) {
    const { defaultVariant, defaultVariantLabel, canQuickAdd } = getQuickAdd(product);
    return <>
      {canQuickAdd && <button type="button" onClick={() => onAddToCart(product, defaultVariantLabel, defaultVariant?.optionValues)} aria-label={`将${product.name}加入购物车`} className="flex min-h-11 items-center justify-center gap-1 rounded-full bg-[var(--market-ink)] px-3 text-xs text-[var(--market-canvas)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)]"><ShoppingBag size={14} aria-hidden="true" />加入购物车</button>}
      <button type="button" onClick={() => onReject(product.id)} aria-pressed={rejectedProductIds.includes(product.id)} className="min-h-11 rounded-full px-3 text-xs text-[var(--market-text-secondary)] hover:bg-[var(--market-hover)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]">{rejectedProductIds.includes(product.id) ? '撤销' : '不合适'}</button>
    </>;
  }

  if (products.length > 1) {
    const items: RailItem[] = products.map((product) => ({
      id: product.id,
      title: product.name,
      location: product.storeName,
      image: product.mainImage,
      imageAlt: product.name,
      aspectRatio: product.aspectRatio,
      description: matchReasons?.[product.id],
      price: product.price,
      priceText: product.formattedPrice,
    }));

    return <CarouselCards
      items={items}
      title="推荐商品"
      eyebrow=""
      defaultFavorites={savedProductIds}
      onToggleFavorite={(id) => onSave(id)}
      onSelect={(item) => {
        const product = productsById.get(item.id);
        if (product) onOpen(product);
      }}
      renderFooter={(item) => {
        const product = productsById.get(item.id);
        return product ? renderActions(product) : null;
      }}
      className="mt-2"
    />;
  }

  const product = products[0];
  if (!product) return null;
  return <article className="mt-3 w-44 shrink-0 text-xs">
    <FeedProductCard product={product} onClick={() => onOpen(product)} />
    {renderActions(product)}
    <div className="flex items-center gap-3 pt-1">
      <button type="button" onClick={() => onSave(product.id)} aria-label={`${savedProductIds.includes(product.id) ? '取消收藏' : '收藏'}${product.name}`} aria-pressed={savedProductIds.includes(product.id)} className="flex min-h-11 items-center gap-1 text-xs"><Heart size={14} fill={savedProductIds.includes(product.id) ? 'currentColor' : 'none'} aria-hidden="true" />收藏</button>
    </div>
  </article>;
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
            <span className="text-[11px] font-medium tracking-[0.12em] text-[var(--market-text-muted)]">商家</span>
            <span className="w-full truncate text-base font-semibold leading-[1.25] text-[var(--market-ink)] hover:underline sm:text-lg">{product.storeName}</span>
          </Link>
        ) : (
          <div className="flex min-h-16 min-w-0 flex-col justify-center gap-0.5 py-2.5" title={product.storeName}>
            <span className="text-[11px] font-medium tracking-[0.12em] text-[var(--market-text-muted)]">商家</span>
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
        <span className="shrink-0 text-xs font-normal text-[var(--market-text-muted)]"><DisplayPrice product={product} /></span>
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

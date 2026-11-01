'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Archive, ArrowLeft, GearSix, Heart, MagnifyingGlass, NotePencil, Trash, X } from '@phosphor-icons/react';
import { Blocks } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { LiquidGlass } from '@/components/ui/liquid-glass';
import { EVA_SKILLS, readInstalledSkillIds, type EvaSkillId } from './CapabilityLibrary';
import { useOmnilink } from '../context/OmnilinkContext';
import type { ConsumerAiModel } from '../types';

const models: { id: ConsumerAiModel; label: string }[] = [
  { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
  { id: 'deepseek-flash', label: 'DeepSeek Flash' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'qwen-plus', label: 'Qwen Plus' },
];

export function HomeNavigationDrawer({ onClose, profileName, deepSeekKeyConfigured }: {
  onClose: () => void;
  profileName: string | null;
  deepSeekKeyConfigured: boolean;
}) {
  const router = useRouter();
  const {
    aiMessages, activeAiConversationId, archivedAiConversationIds, products,
    startAiConversation, selectAiConversation, archiveAiConversation, deleteAiConversation,
    setHomeChatOpen, openFloatingProduct, selectTab, aiModel, setAiModel,
  } = useOmnilink();
  const [view, setView] = useState<'main' | 'skills' | 'archived' | 'settings'>('main');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiStatus, setApiStatus] = useState(deepSeekKeyConfigured ? '已连接' : '未连接');
  const [savingKey, setSavingKey] = useState(false);
  const [installedSkillIds, setInstalledSkillIds] = useState<EvaSkillId[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    if (view === 'skills') setInstalledSkillIds(readInstalledSkillIds());
  }, [view]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const conversationIds = Array.from(new Set([...aiMessages].reverse().map((message) => message.conversationId).filter((id): id is string => Boolean(id))));
  const conversations = conversationIds.map((id) => ({
    id,
    title: aiMessages.find((message) => message.conversationId === id && message.isUser)?.text || '图片消息',
    searchable: aiMessages.filter((message) => message.conversationId === id).map((message) => `${message.text} ${message.fileName ?? ''}`).join(' '),
  }));
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleConversations = conversations.filter((conversation) =>
    (view === 'archived') === archivedAiConversationIds.includes(conversation.id)
    && (!normalizedQuery || conversation.searchable.toLocaleLowerCase().includes(normalizedQuery))
  );
  const matchedProducts = normalizedQuery ? products.filter((product) => `${product.name} ${product.storeName}`.toLocaleLowerCase().includes(normalizedQuery)).slice(0, 8) : [];
  const matchedSkills = normalizedQuery ? EVA_SKILLS.filter((skill) => `${skill.title} ${skill.description}`.toLocaleLowerCase().includes(normalizedQuery)) : [];

  const openConversation = (id: string) => {
    selectAiConversation(id);
    setHomeChatOpen(true);
    onClose();
  };
  const newConversation = () => {
    startAiConversation();
    setHomeChatOpen(true);
    onClose();
  };
  const activateSkill = (id: (typeof EVA_SKILLS)[number]['id']) => {
    if (id === 'shopping-preferences') {
      router.push('/discover?shoppingPreferences=1');
      return;
    }
    newConversation();
  };
  const updateKey = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!apiKey.trim() || savingKey) return;
    setSavingKey(true);
    try {
      const response = await fetch('/api/consumer/deepseek-key', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });
      const result = await response.json() as { configured?: boolean; error?: string };
      if (!response.ok || !result.configured) throw new Error(result.error || '连接失败');
      setApiStatus('已连接');
      setApiKey('');
    } catch (error) {
      setApiStatus(error instanceof Error ? error.message : '连接失败');
    } finally {
      setSavingKey(false);
    }
  };

  const row = 'flex min-h-11 w-full items-center gap-3 rounded-[14px] px-3 text-left text-[13px] text-[var(--market-ink)] transition-colors hover:bg-[var(--market-hover)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]';

  return <div className="pointer-events-none fixed inset-0 z-[80]" role="presentation">
    <LiquidGlass role="complementary" aria-label="导航与对话" radius={0} bevelDepth={6} scale={10} aberration={0.25} frost={0.3} tint={0.68} interactive className="home-navigation-drawer pointer-events-auto flex h-dvh w-full flex-col border-r-[0.5px] border-[var(--market-glass-border)] text-[var(--market-ink)] sm:max-w-[340px]">
      <header className="flex min-h-16 items-center gap-2 px-4">
        <span className="min-w-0 flex-1 text-base font-semibold">Omnilink</span>
        <button type="button" onClick={() => { setView('main'); setSearchOpen((open) => !open); setQuery(''); }} aria-label="搜索" aria-pressed={searchOpen} className="grid h-10 w-10 place-items-center rounded-full hover:bg-[var(--market-hover)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]"><MagnifyingGlass size={20} aria-hidden="true" /></button>
        <button type="button" onClick={onClose} aria-label="收起侧边栏" className="grid h-10 w-10 place-items-center rounded-full hover:bg-[var(--market-hover)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]"><X size={20} aria-hidden="true" /></button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">
        {searchOpen && <label className="mx-2 mb-4 flex h-11 items-center gap-2 rounded-[14px] border-[0.5px] border-[var(--market-border)] px-3"><MagnifyingGlass size={18} aria-hidden="true" /><input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索对话、商品和技能" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>}
        {view !== 'main' && !normalizedQuery && <button type="button" onClick={() => setView('main')} className={`${row} mb-3`}><ArrowLeft size={19} aria-hidden="true" />返回</button>}
        {view === 'settings' && !normalizedQuery ? <div className="px-3">
          <h2 className="mb-5 text-base font-semibold">设置</h2>
          <form onSubmit={updateKey} className="space-y-3"><label htmlFor="home-deepseek-key" className="block text-sm font-medium">DeepSeek API Key</label><div className="flex items-center gap-2"><input id="home-deepseek-key" type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="粘贴 API Key" className="h-11 min-w-0 flex-1 rounded-full border-[0.5px] border-[var(--market-border)] bg-transparent px-4 text-sm outline-none focus-visible:border-[var(--market-support)]" /><button type="submit" disabled={savingKey || !apiKey.trim()} className="h-11 rounded-full bg-[var(--market-ink)] px-5 text-sm text-white disabled:opacity-40">保存</button></div><p className="text-xs text-[var(--market-text-muted)]" aria-live="polite">{apiStatus}</p></form>
          <fieldset className="mt-8"><legend className="mb-2 text-sm font-medium">聊天模型</legend>{models.map((model) => <label key={model.id} className={`${row} cursor-pointer`}><input type="radio" name="home-ai-model" checked={aiModel === model.id} onChange={() => setAiModel(model.id)} className="accent-[var(--market-ink)]" />{model.label}</label>)}</fieldset>
        </div> : view === 'skills' && !normalizedQuery ? <section aria-label="技能"><h2 className="px-3 pb-2 text-xs font-medium text-[var(--market-text-muted)]">技能</h2>{EVA_SKILLS.filter((skill) => installedSkillIds.includes(skill.id)).map((skill) => <button key={skill.id} type="button" onClick={() => activateSkill(skill.id)} className={row}><skill.icon size={20} aria-hidden="true" />{skill.title}</button>)}{installedSkillIds.length === 0 && <p className="px-3 py-3 text-sm text-[var(--market-text-muted)]">暂无已添加技能</p>}</section> : <>
          {view === 'main' && !normalizedQuery && <nav aria-label="导航" className="mb-8">
            <button type="button" onClick={newConversation} className={`${row} bg-[var(--market-surface-muted)] font-semibold`}><NotePencil size={21} aria-hidden="true" />发起新对话</button>
            <button type="button" onClick={() => setView('skills')} className={row}><Blocks size={21} aria-hidden="true" />插件和技能</button>
            <button type="button" onClick={() => setView('archived')} className={row}><Archive size={21} aria-hidden="true" />已归档</button>
            <button type="button" onClick={() => { selectTab('FAVORITES'); onClose(); }} className={row}><Heart size={21} weight="fill" aria-hidden="true" />收藏</button>
          </nav>}
          <section aria-label={view === 'archived' ? '已归档对话' : '最近对话'}>
            <h2 className="px-3 pb-2 text-xs font-medium text-[var(--market-text-muted)]">{normalizedQuery ? '对话' : view === 'archived' ? '已归档' : '最近'}</h2>
            {visibleConversations.length ? visibleConversations.map((conversation) => <div key={conversation.id} className="group flex items-center rounded-[16px] hover:bg-[var(--market-hover)]">
              <button type="button" onClick={() => openConversation(conversation.id)} aria-current={conversation.id === activeAiConversationId ? 'page' : undefined} className="min-h-12 min-w-0 flex-1 truncate px-3 text-left text-sm focus-visible:outline-2 focus-visible:outline-[var(--market-support)]">{conversation.title}</button>
              <button type="button" onClick={() => archiveAiConversation(conversation.id)} aria-label={view === 'archived' ? '恢复对话' : '归档对话'} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--market-text-muted)] hover:text-[var(--market-ink)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]"><Archive size={17} aria-hidden="true" /></button>
              <button type="button" onClick={() => deleteAiConversation(conversation.id)} aria-label="删除对话" className="mr-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--market-text-muted)] hover:text-[var(--market-ink)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]"><Trash size={17} aria-hidden="true" /></button>
            </div>) : <p className="px-3 py-3 text-sm text-[var(--market-text-muted)]">{normalizedQuery ? '没有匹配的对话' : view === 'archived' ? '暂无归档' : '暂无对话'}</p>}
          </section>
          {normalizedQuery && <>
            {matchedProducts.length > 0 && <section className="mt-6" aria-label="商品搜索结果"><h2 className="px-3 pb-2 text-xs font-medium text-[var(--market-text-muted)]">商品</h2>{matchedProducts.map((product) => <button key={product.id} type="button" onClick={() => { openFloatingProduct(product); onClose(); }} className={row}><img src={product.mainImage} alt="" className="h-9 w-9 rounded-[10px] object-cover" /><span className="min-w-0 truncate">{product.name}</span></button>)}</section>}
            {matchedSkills.length > 0 && <section className="mt-6" aria-label="技能搜索结果"><h2 className="px-3 pb-2 text-xs font-medium text-[var(--market-text-muted)]">技能</h2>{matchedSkills.map((skill) => <button key={skill.id} type="button" onClick={() => activateSkill(skill.id)} className={row}><skill.icon size={20} aria-hidden="true" />{skill.title}</button>)}</section>}
          </>}
        </>}
      </div>
      <footer className="flex min-h-20 items-center gap-3 px-5 pb-[env(safe-area-inset-bottom)]">
        <button type="button" onClick={() => { selectTab('PROFILE'); onClose(); }} className="flex min-w-0 flex-1 items-center gap-3 rounded-[16px] py-2 text-left text-sm hover:bg-[var(--market-hover)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--market-surface-muted)] font-semibold">{profileName?.trim().slice(0, 1) || '访'}</span><span className="truncate">{profileName || '访客'}</span></button>
        <button type="button" onClick={() => { setView('settings'); setSearchOpen(false); setQuery(''); }} aria-label="设置" className="grid h-11 w-11 place-items-center rounded-full hover:bg-[var(--market-hover)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]"><GearSix size={22} aria-hidden="true" /></button>
      </footer>
    </LiquidGlass>
  </div>;
}

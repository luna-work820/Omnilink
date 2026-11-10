'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Archive, ArrowLeft, GearSix, MagnifyingGlass, NotePencil, SidebarSimple, Trash } from '@phosphor-icons/react';
import { Blocks, EllipsisVertical, X } from 'lucide-react';
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui';
import { useRouter } from 'next/navigation';
import { AI_ASSISTANT_SKILLS, readInstalledSkillIds, type AiAssistantSkillId } from './CapabilityLibrary';
import { PersonalPanel } from './PersonalPanel';
import { useOmnilink } from '../context/OmnilinkContext';
import type { ConsumerAiModel } from '../types';

const conversationOutline = (title: string) => title.trim().split(/[\r\n，。！？!?；;：:]/, 1)[0]?.trim() || '图片消息';

const models: { id: ConsumerAiModel; label: string }[] = [
  { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
  { id: 'deepseek-flash', label: 'DeepSeek Flash' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'qwen-plus', label: 'Qwen Plus' },
];

export function HomeNavigationDrawer({ onClose, profileName, publisherReady, deepSeekKeyConfigured, initialView = 'main', initialSearchOpen = false }: {
  onClose: () => void;
  profileName: string | null;
  publisherReady: boolean;
  deepSeekKeyConfigured: boolean;
  initialView?: 'main' | 'skills' | 'archived' | 'settings';
  initialSearchOpen?: boolean;
}) {
  const router = useRouter();
  const {
    aiMessages, activeAiConversationId, archivedAiConversationIds, products,
    startAiConversation, selectAiConversation, archiveAiConversation, deleteAiConversation,
    setHomeChatOpen, openFloatingProduct, aiModel, setAiModel,
  } = useOmnilink();
  const [view, setView] = useState<'main' | 'skills' | 'archived' | 'settings'>(initialView);
  const [searchOpen, setSearchOpen] = useState(initialSearchOpen);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiStatus, setApiStatus] = useState(deepSeekKeyConfigured ? '已连接' : '未连接');
  const [savingKey, setSavingKey] = useState(false);
  const [installedSkillIds, setInstalledSkillIds] = useState<AiAssistantSkillId[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    if (view === 'skills') setInstalledSkillIds(readInstalledSkillIds());
  }, [view]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (profileMenuOpen) {
        setProfileMenuOpen(false);
        requestAnimationFrame(() => profileTriggerRef.current?.focus());
      } else if (actionMenuId) setActionMenuId(null);
      else onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [actionMenuId, profileMenuOpen, onClose]);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) setProfileMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePress);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePress);
  }, [profileMenuOpen]);

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
  const matchedSkills = normalizedQuery ? AI_ASSISTANT_SKILLS.filter((skill) => `${skill.title} ${skill.description}`.toLocaleLowerCase().includes(normalizedQuery)) : [];

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
  const activateSkill = (id: (typeof AI_ASSISTANT_SKILLS)[number]['id']) => {
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

  const row = 'flex min-h-[30px] w-full items-center gap-2 market-hover-pill text-left text-xs text-[var(--market-ink)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]';

  return <div className="pointer-events-none absolute inset-0" role="presentation">
    <aside aria-label="导航与对话" className="home-navigation-drawer pointer-events-auto flex h-full w-full flex-col text-[var(--market-ink)]">
      <header className="flex min-h-12 items-center gap-1 px-3">
        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[16px] font-semibold"><img src="/omnilink-moon.svg" width="24" height="24" alt="" className="h-6 w-6 shrink-0" />Omnilink</span>
        <button type="button" onClick={() => { setView('main'); setSearchOpen((open) => !open); setQuery(''); }} aria-label="搜索" aria-pressed={searchOpen} className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-[var(--market-hover)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]"><MagnifyingGlass size={16} aria-hidden="true" /></button>
        <button type="button" onClick={onClose} aria-label="收起侧边栏" className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-[var(--market-hover)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]"><SidebarSimple size={16} aria-hidden="true" /></button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {searchOpen && <label className="mx-1 mb-3 flex h-10 items-center gap-2 rounded-xl border-[0.5px] border-[var(--market-border)] px-2"><MagnifyingGlass size={16} aria-hidden="true" /><input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索对话、商品和技能" className="min-w-0 flex-1 bg-transparent text-xs outline-none" /></label>}
        {view !== 'main' && !normalizedQuery && <button type="button" onClick={() => setView('main')} className={`${row} mb-2`}><ArrowLeft size={17} aria-hidden="true" />返回</button>}
        {view === 'settings' && !normalizedQuery ? <div className="px-3">
          <h2 className="mb-5 text-base font-semibold">设置</h2>
          <form onSubmit={updateKey} className="space-y-3"><label htmlFor="home-deepseek-key" className="block text-sm font-medium">DeepSeek API Key</label><div className="flex items-center gap-2"><input id="home-deepseek-key" type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="粘贴 API Key" className="h-11 min-w-0 flex-1 rounded-full border-[0.5px] border-[var(--market-border)] bg-transparent px-4 text-sm outline-none focus-visible:border-[var(--market-support)]" /><button type="submit" disabled={savingKey || !apiKey.trim()} className="h-11 rounded-full bg-[var(--market-ink)] px-5 text-sm text-white disabled:opacity-40">保存</button></div><p className="text-xs text-[var(--market-text-muted)]" aria-live="polite">{apiStatus}</p></form>
          <fieldset className="mt-8"><legend className="mb-2 text-sm font-medium">聊天模型</legend>{models.map((model) => <label key={model.id} className={`${row} cursor-pointer`}><input type="radio" name="home-ai-model" checked={aiModel === model.id} onChange={() => setAiModel(model.id)} className="accent-[var(--market-ink)]" />{model.label}</label>)}</fieldset>
        </div> : view === 'skills' && !normalizedQuery ? <section aria-label="技能"><h2 className="px-3 pb-2 text-xs font-medium text-[var(--market-text-muted)]">技能</h2>{AI_ASSISTANT_SKILLS.filter((skill) => installedSkillIds.includes(skill.id)).map((skill) => <button key={skill.id} type="button" onClick={() => activateSkill(skill.id)} className={row}><skill.icon size={20} aria-hidden="true" />{skill.title}</button>)}{installedSkillIds.length === 0 && <p className="px-3 py-3 text-sm text-[var(--market-text-muted)]">暂无已添加技能</p>}</section> : <>
          {view === 'main' && !normalizedQuery && <nav aria-label="导航" className="mb-5">
            <button type="button" onClick={newConversation} className={`${row} font-semibold`}><NotePencil size={14} aria-hidden="true" />发起新对话</button>
            <button type="button" onClick={() => setView('skills')} className={row}><Blocks size={14} aria-hidden="true" />插件和技能</button>
            <button type="button" onClick={() => setView('archived')} className={row}><Archive size={14} aria-hidden="true" />已归档</button>
          </nav>}
          <section aria-label={view === 'archived' ? '已归档对话' : '最近对话'}>
            <h2 className="px-3 pb-2 text-xs font-medium text-[var(--market-text-muted)]">{normalizedQuery ? '对话' : view === 'archived' ? '已归档' : '最近'}</h2>
            {visibleConversations.length ? visibleConversations.map((conversation) => <div key={conversation.id} className="conversation-row market-hover-pill group flex min-h-[30px] items-center gap-1 py-1">
              <button type="button" onClick={() => openConversation(conversation.id)} aria-current={conversation.id === activeAiConversationId ? 'page' : undefined} aria-label={conversation.title} title={conversation.title} className="min-w-0 flex-1 whitespace-normal break-words text-left text-xs leading-5 focus-visible:outline-2 focus-visible:outline-[var(--market-support)]">{conversationOutline(conversation.title)}</button>
              <DropdownMenuPrimitive.Root open={actionMenuId === conversation.id} onOpenChange={(open) => setActionMenuId(open ? conversation.id : null)}>
                <DropdownMenuPrimitive.Trigger asChild><button type="button" aria-label={`${conversationOutline(conversation.title)}的更多操作`} className="conversation-action grid h-7 w-7 shrink-0 place-items-center rounded-full text-[var(--market-text-secondary)] hover:bg-[var(--market-surface-muted)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]"><EllipsisVertical size={17} aria-hidden="true" /></button></DropdownMenuPrimitive.Trigger>
                <DropdownMenuPrimitive.Portal>
                  <DropdownMenuPrimitive.Content align="end" sideOffset={6} collisionPadding={8} className="conversation-actions-menu z-[100] w-40 rounded-[var(--radius-overlay)] border-[0.5px] border-[var(--palette-mist)] bg-[var(--palette-porcelain)] p-1.5 text-[var(--palette-ink)] shadow-lg outline-none">
                    <DropdownMenuPrimitive.Item onSelect={() => archiveAiConversation(conversation.id)} className="conversation-actions-item flex min-h-9 cursor-pointer items-center gap-3 rounded-full px-3 text-xs outline-none data-[highlighted]:bg-[var(--interactive-hover)]"><Archive size={17} aria-hidden="true" />{view === 'archived' ? '恢复' : '归档'}</DropdownMenuPrimitive.Item>
                    <DropdownMenuPrimitive.Item onSelect={() => deleteAiConversation(conversation.id)} className="conversation-actions-item flex min-h-9 cursor-pointer items-center gap-3 rounded-full px-3 text-xs outline-none data-[highlighted]:bg-[var(--interactive-hover)]"><Trash size={17} aria-hidden="true" />删除</DropdownMenuPrimitive.Item>
                  </DropdownMenuPrimitive.Content>
                </DropdownMenuPrimitive.Portal>
              </DropdownMenuPrimitive.Root>
            </div>) : <p className="px-3 py-3 text-sm text-[var(--market-text-muted)]">{normalizedQuery ? '没有匹配的对话' : view === 'archived' ? '暂无归档' : '暂无对话'}</p>}
          </section>
          {normalizedQuery && <>
            {matchedProducts.length > 0 && <section className="mt-6" aria-label="商品搜索结果"><h2 className="px-3 pb-2 text-xs font-medium text-[var(--market-text-muted)]">商品</h2>{matchedProducts.map((product) => <button key={product.id} type="button" onClick={() => { openFloatingProduct(product); onClose(); }} className={row}><img src={product.mainImage} alt="" className="h-9 w-9 rounded-md object-cover" /><span className="min-w-0 truncate">{product.name}</span></button>)}</section>}
            {matchedSkills.length > 0 && <section className="mt-6" aria-label="技能搜索结果"><h2 className="px-3 pb-2 text-xs font-medium text-[var(--market-text-muted)]">技能</h2>{matchedSkills.map((skill) => <button key={skill.id} type="button" onClick={() => activateSkill(skill.id)} className={row}><skill.icon size={20} aria-hidden="true" />{skill.title}</button>)}</section>}
          </>}
        </>}
      </div>
      <footer className="flex min-h-16 items-center gap-2 px-3 pb-[env(safe-area-inset-bottom)]">
        <div ref={profileMenuRef} className="relative min-w-0 flex-1">
          {profileMenuOpen && <div id="sidebar-personal-menu" role="dialog" aria-labelledby="personal-menu-title" className="sidebar-profile-popover absolute bottom-[calc(100%+8px)] left-0 z-30 w-[min(296px,calc(100vw-24px))] rounded-3xl border-[0.5px] border-[var(--market-border)] bg-[var(--market-surface-muted)] p-2 shadow-lg">
            <div className="flex justify-end pb-1"><button type="button" autoFocus onClick={() => { setProfileMenuOpen(false); profileTriggerRef.current?.focus(); }} aria-label="关闭个人菜单" className="grid h-7 w-7 place-items-center rounded-full text-[var(--market-ink)] hover:bg-[var(--market-hover)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]"><X size={14} aria-hidden="true" /></button></div>
            <PersonalPanel profileName={profileName} publisherReady={publisherReady} />
          </div>}
          <button ref={profileTriggerRef} type="button" onClick={() => setProfileMenuOpen((open) => !open)} aria-haspopup="dialog" aria-expanded={profileMenuOpen} aria-controls="sidebar-personal-menu" className="flex w-full min-w-0 items-center gap-3 px-3 py-2 text-left text-xs focus-visible:outline-2 focus-visible:outline-[var(--market-support)]"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--market-surface-muted)] font-semibold">{profileName?.trim().slice(0, 1) || '访'}</span><span className="truncate">{profileName || '访客'}</span></button>
        </div>
        <button type="button" onClick={() => { setProfileMenuOpen(false); setView('settings'); setSearchOpen(false); setQuery(''); }} aria-label="设置" className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full hover:bg-[var(--market-hover)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]"><GearSix size={16} aria-hidden="true" /></button>
      </footer>
    </aside>
  </div>;
}

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import {
  Sparkle as Sparkles,
  PaperPlaneRight as Send,
  Image as ImageIcon,
  FileText,
  ArrowDown,
  Plus,
  Camera,
  ShoppingBag,
  Heart,
  ArrowLeft,
  List,
  X,
  NotePencil,
  Microphone as Mic,
  MicrophoneSlash as MicOff,
  CaretDown as ChevronDown,
  Trash,
  Archive,
  MagnifyingGlass,
  GearSix,
} from '@phosphor-icons/react';
import { useOmnilink } from '../context/OmnilinkContext';
import { ProductItem, type ConsumerAiModel } from '../types';
import { LiquidGlass } from '@/components/ui/liquid-glass';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CapabilityLibrary, DEFAULT_INSTALLED_SKILL_IDS, EVA_SKILLS, EVA_SKILLS_STORAGE_KEY, readInstalledSkillIds, type EvaSkillId } from '../components/CapabilityLibrary';
import AILoadingState, { type AgentStep } from '@/components/kokonutui/ai-loading';
import SwipeRow from '@/components/react-bits/SwipeRow';
import { Message, MessageContent, MessageScrollerItem } from '@/components/ai-elements/chat';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Image from 'next/image';
import { Blocks as SkillIcon, LockKeyhole, LockKeyholeOpen } from 'lucide-react';
import { emptyEvaProfile, type EvaProfile } from '@/lib/consumer-advisor/eva-onboarding';
import { InitialAssistantSetup } from '@/components/consumer-market/screens/InitialAssistantSetup';

const CONSUMER_AI_LOADING_STEPS: AgentStep[] = [{
  id: 'request',
  label: '正在分析',
  status: 'running',
  detail: ['正在核对已有信息'],
}];

const CONSUMER_AI_MODELS: { id: ConsumerAiModel; label: string }[] = [
  { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
  { id: 'deepseek-flash', label: 'DeepSeek Flash' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'qwen-plus', label: 'Qwen Plus' },
];

const MENU_GLASS = { radius: 28, bevelDepth: 6, scale: 10, aberration: 0.25, frost: 0.3, tint: 0.86 };
const PINNED_SKILLS_STORAGE_KEY = 'omnilink_pinned_skills_v1';

function readPinnedSkillIds(): EvaSkillId[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(PINNED_SKILLS_STORAGE_KEY) ?? '[]');
    return Array.isArray(saved) ? EVA_SKILLS.map((skill) => skill.id).filter((id) => saved.includes(id)) : [];
  } catch {
    return [];
  }
}

const UserMessageBubble: React.FC<{ text: string }> = ({ text }) => {
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [isSingleLine, setIsSingleLine] = useState(false);

  useLayoutEffect(() => {
    const bubble = bubbleRef.current;
    if (!bubble) return;

    const measureLines = () => {
      const range = document.createRange();
      range.selectNodeContents(bubble);
      const lineTops = Array.from(range.getClientRects())
        .filter((rect) => rect.width > 0 && rect.height > 0)
        .map((rect) => Math.round(rect.top));
      const nextIsSingleLine = lineTops.length > 0 && Math.max(...lineTops) - Math.min(...lineTops) < 2;
      setIsSingleLine((current) => current === nextIsSingleLine ? current : nextIsSingleLine);
    };

    measureLines();
    const observer = new ResizeObserver(measureLines);
    observer.observe(bubble);
    return () => observer.disconnect();
  }, [text]);

  return <div ref={bubbleRef} data-slot="bubble" data-variant="muted" className={`max-w-full bg-[var(--market-surface-muted)] px-4 py-3 text-sm leading-6 ${isSingleLine ? 'rounded-full' : 'rounded-[14px]'}`}>{text}</div>;
};

const AssistantMessageText: React.FC<{ text: string }> = ({ text }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      p: ({ children }) => <p className="text-base leading-6">{children}</p>,
      table: ({ children }) => <div className="my-3 max-w-full overflow-x-auto"><table className="w-full min-w-[360px] border-collapse text-sm sm:min-w-[500px]">{children}</table></div>,
      img: ({ src, alt }) => typeof src === 'string' && src.startsWith('/consumer-market/')
        ? <Image src={src} alt={alt ?? ''} width={44} height={44} sizes="44px" className="mr-2 inline-block h-11 w-11 rounded-[var(--radius-control)] object-cover align-middle" />
        : null,
      th: ({ children }) => <th className="border-b-[0.5px] border-[var(--market-border)] px-2 py-2 text-left font-semibold">{children}</th>,
      td: ({ children }) => <td className="border-b-[0.5px] border-[var(--market-border)] px-2 py-2 align-top text-[var(--market-text-secondary)]">{children}</td>,
      tr: ({ children }) => <tr className="last:border-b-0">{children}</tr>,
    }}
  >
    {text}
  </ReactMarkdown>
);

type VoiceRecognitionResult = { 0?: { transcript?: string }; isFinal?: boolean };
type VoiceRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<VoiceRecognitionResult> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};
type VoiceWindow = Window & {
  SpeechRecognition?: new () => VoiceRecognition;
  webkitSpeechRecognition?: new () => VoiceRecognition;
};

export const PersonalStudioScreen: React.FC<{ profileName: string | null; freshSignupPreview?: boolean; accountSkillIds?: EvaSkillId[]; initialActiveSkillId?: EvaSkillId; persistSkillChanges?: boolean; initialEvaProfile?: EvaProfile; initialOnboarding?: boolean; deepSeekKeyConfigured?: boolean; onboardingPreview?: boolean }> = ({ profileName, freshSignupPreview = false, accountSkillIds, initialActiveSkillId = null, persistSkillChanges = false, initialEvaProfile, initialOnboarding = false, deepSeekKeyConfigured = false, onboardingPreview = false }) => {
  const {
    aiMessages,
    activeAiConversationId,
    archivedAiConversationIds,
    selectAiConversation,
    startAiConversation,
    archiveAiConversation,
    deleteAiConversation,
    isAiThinking,
    aiModel,
    setAiModel,
    sendAiMessage,
    sendAiImageMessage,
    sendAiFileMessage,
    products,
    savedProductIds,
    toggleSaveProduct,
    rejectedProductIds,
    toggleRejectProduct,
    addToCart,
    showToast,
    selectTab,
  } = useOmnilink();

  const [inputVal, setInputVal] = useState('');
  const [onboardingActive, setOnboardingActive] = useState(initialOnboarding);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [deepSeekConfiguredState, setDeepSeekConfiguredState] = useState(deepSeekKeyConfigured);
  const [deepSeekApiKey, setDeepSeekApiKey] = useState('');
  const [deepSeekKeyBusy, setDeepSeekKeyBusy] = useState(false);
  const [deepSeekKeyError, setDeepSeekKeyError] = useState<string | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<{ name: string; kind: 'image' | 'document'; data: string } | null>(null);
  const [selectedRecommendation, setSelectedRecommendation] = useState<ProductItem | null>(null);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [columnView, setColumnView] = useState<'history' | 'features' | 'archived'>('history');
  const [menuMode, setMenuMode] = useState<'main' | 'settings'>('main');
  const [menuSearchOpen, setMenuSearchOpen] = useState(false);
  const [menuSearch, setMenuSearch] = useState('');
  const [isUploadMenuOpen, setIsUploadMenuOpen] = useState(false);
  const [isSkillPanelOpen, setIsSkillPanelOpen] = useState(freshSignupPreview);
  const [installedSkillIds, setInstalledSkillIds] = useState<EvaSkillId[]>(() => accountSkillIds ? [...accountSkillIds] : freshSignupPreview ? [...DEFAULT_INSTALLED_SKILL_IDS] : []);
  const [activeSkillId, setActiveSkillId] = useState<EvaSkillId | null>(initialActiveSkillId);
  const [pinnedSkillIds, setPinnedSkillIds] = useState<EvaSkillId[]>([]);
  const [skillHighlightIndex, setSkillHighlightIndex] = useState(-1);
  const [menuView, setMenuView] = useState<'add' | 'favorites'>('add');
  const [selectedFavoriteProductIds, setSelectedFavoriteProductIds] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const composerFormRef = useRef<HTMLFormElement>(null);
  const voiceRecognitionRef = useRef<VoiceRecognition | null>(null);
  const skillMentionIndexRef = useRef<number | null>(null);
  const messageScrollerRef = useRef<HTMLDivElement>(null);
  const suppressScrollTrackingRef = useRef(false);
  const previousConversationIdRef = useRef(activeAiConversationId);
  const previousLatestMessageIdRef = useRef<string | null>(null);
  const scrollToLastUserAnchorRef = useRef<((behavior?: ScrollBehavior) => void) | null>(null);
  const pendingUserAnchorRef = useRef(false);
  const shouldFollowLatestRef = useRef(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const selectedFavoriteIds = selectedFavoriteProductIds.filter((id) => savedProductIds.includes(id) && products.some((product) => product.id === id));
  const activeSkill = EVA_SKILLS.find((skill) => skill.id === activeSkillId);
  const availableSkills = EVA_SKILLS.filter((skill) => installedSkillIds.includes(skill.id));
  const pinnedAvailableSkills = availableSkills.filter((skill) => pinnedSkillIds.includes(skill.id));
  const conversationMessages = useMemo(() => aiMessages.filter((msg) => msg.conversationId === activeAiConversationId), [aiMessages, activeAiConversationId]);
  const historyConversations = aiMessages.filter((message, index) => message.isUser && !aiMessages.slice(0, index).some((earlier) => earlier.conversationId === message.conversationId));
  const visibleHistory = historyConversations.filter((message) => !archivedAiConversationIds.includes(message.conversationId!));
  const archivedHistory = historyConversations.filter((message) => archivedAiConversationIds.includes(message.conversationId!));
  const searchQuery = menuSearch.trim().toLocaleLowerCase();
  const matchesSearch = (value?: string) => Boolean(value?.toLocaleLowerCase().includes(searchQuery));
  const searchedHistory = searchQuery ? historyConversations.filter((message) => aiMessages.some((entry) => entry.conversationId === message.conversationId && [entry.text, entry.fileName, ...(entry.matchedProducts?.map((product) => product.name) ?? []), ...Object.values(entry.matchReasons ?? {})].some(matchesSearch))) : [];
  const searchedSkills = searchQuery ? EVA_SKILLS.filter((skill) => matchesSearch(skill.title) || matchesSearch(skill.description)) : [];
  const hasSearchPages = searchQuery && (['发起新对话', '插件和技能', '已归档', '个人主页', '设置', profileName ?? ''].some(matchesSearch) || CONSUMER_AI_MODELS.some((model) => matchesSearch(model.label)));

  useEffect(() => {
    if (!columnsOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setColumnsOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [columnsOpen]);

  useEffect(() => {
    if (!selectedRecommendation) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedRecommendation(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedRecommendation]);

  useEffect(() => {
    if (freshSignupPreview) {
      const defaults = [...DEFAULT_INSTALLED_SKILL_IDS];
      localStorage.setItem(EVA_SKILLS_STORAGE_KEY, JSON.stringify(defaults));
      setInstalledSkillIds(defaults);
      setPinnedSkillIds([]);
      return;
    }
    if (accountSkillIds) {
      setInstalledSkillIds(accountSkillIds);
      localStorage.setItem(EVA_SKILLS_STORAGE_KEY, JSON.stringify(accountSkillIds));
      setPinnedSkillIds(readPinnedSkillIds());
      return;
    }
    let mounted = true;
    queueMicrotask(() => {
      if (!mounted) return;
      setPinnedSkillIds(readPinnedSkillIds());
      setInstalledSkillIds(readInstalledSkillIds());
    });
    return () => { mounted = false; };
  }, [accountSkillIds, freshSignupPreview]);

  const persistInstalledSkillIds = (ids: EvaSkillId[]) => {
    setInstalledSkillIds(ids);
    setActiveSkillId((current) => current && !ids.includes(current) ? null : current);
    if (!persistSkillChanges) return;
    void fetch('/api/consumer/eva-profile', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'skills', skillIds: ids }),
    }).then(async (response) => {
      if (!response.ok) throw new Error('保存失败');
    }).catch(() => showToast('技能状态未能保存，请检查网络后重试。'));
  };

  useEffect(() => {
    if (!isUploadMenuOpen && !isSkillPanelOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsUploadMenuOpen(false);
        setIsSkillPanelOpen(false);
        skillMentionIndexRef.current = null;
      }
    };
    const closeOnOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !composerFormRef.current?.contains(event.target)) {
        setIsUploadMenuOpen(false);
        setIsSkillPanelOpen(false);
        skillMentionIndexRef.current = null;
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOnOutside);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('pointerdown', closeOnOutside);
    };
  }, [isUploadMenuOpen, isSkillPanelOpen]);

  const latestConversationMessage = conversationMessages[conversationMessages.length - 1];

  const scrollToLatest = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const scroller = messageScrollerRef.current;
    if (!scroller) return;
    shouldFollowLatestRef.current = true;
    setShowJumpToLatest(false);
    suppressScrollTrackingRef.current = true;
    scroller.scrollTo({ top: scroller.scrollHeight, behavior });
    requestAnimationFrame(() => requestAnimationFrame(() => { suppressScrollTrackingRef.current = false; }));
  }, []);

  const scrollToMessageAnchor = useCallback((messageId: string, behavior: ScrollBehavior = 'smooth') => {
    const scroller = messageScrollerRef.current;
    const anchor = document.getElementById(`eva-message-${messageId}`);
    if (!scroller || !anchor) return;
    suppressScrollTrackingRef.current = true;
    const top = scroller.scrollTop + anchor.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 48;
    scroller.scrollTo({ top: Math.max(0, top), behavior });
    requestAnimationFrame(() => requestAnimationFrame(() => { suppressScrollTrackingRef.current = false; }));
  }, []);

  const scrollToLastUserAnchor = useCallback((behavior: ScrollBehavior = 'auto') => {
    const lastUserMessage = [...conversationMessages].reverse().find((message) => message.isUser);
    if (lastUserMessage) scrollToMessageAnchor(lastUserMessage.id, behavior);
    else scrollToLatest(behavior);
  }, [conversationMessages, scrollToMessageAnchor, scrollToLatest]);

  useEffect(() => {
    scrollToLastUserAnchorRef.current = scrollToLastUserAnchor;
  }, [scrollToLastUserAnchor]);

  useEffect(() => {
    const latestMessage = latestConversationMessage;
    const isConversationChange = previousConversationIdRef.current !== activeAiConversationId;

    if (isConversationChange) {
      previousConversationIdRef.current = activeAiConversationId;
      previousLatestMessageIdRef.current = latestMessage?.id ?? null;
      pendingUserAnchorRef.current = false;
      shouldFollowLatestRef.current = false;
      requestAnimationFrame(() => scrollToLastUserAnchorRef.current?.('auto'));
      return;
    }

    if (previousLatestMessageIdRef.current === null && latestMessage) {
      previousLatestMessageIdRef.current = latestMessage.id;
      shouldFollowLatestRef.current = false;
      requestAnimationFrame(() => scrollToLastUserAnchorRef.current?.('auto'));
      return;
    }

    if (!latestMessage || latestMessage.id === previousLatestMessageIdRef.current) {
      if (isAiThinking && shouldFollowLatestRef.current) {
        requestAnimationFrame(() => scrollToLatest('auto'));
      }
      return;
    }

    previousLatestMessageIdRef.current = latestMessage.id;

    if (pendingUserAnchorRef.current && latestMessage.isUser) {
      pendingUserAnchorRef.current = false;
      shouldFollowLatestRef.current = true;
      setShowJumpToLatest(false);
      requestAnimationFrame(() => scrollToMessageAnchor(latestMessage.id));
      return;
    }

    if (shouldFollowLatestRef.current) requestAnimationFrame(() => scrollToLatest('smooth'));
    else setShowJumpToLatest(true);
  }, [activeAiConversationId, isAiThinking, latestConversationMessage, scrollToLatest, scrollToMessageAnchor]);

  const handleMessageScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (suppressScrollTrackingRef.current) return;
    const scroller = event.currentTarget;
    const atLatest = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 56;
    shouldFollowLatestRef.current = atLatest;
    setShowJumpToLatest(!atLatest);
  };

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (onboardingActive || (!inputVal.trim() && selectedFavoriteIds.length === 0 && !pendingAttachment) || isAiThinking) return;
    pendingUserAnchorRef.current = true;
    const message = inputVal.trim() || (pendingAttachment ? '' : '请分析我选中的收藏商品，并说明搭配建议。');
    const prompt = activeSkill ? `${activeSkill.prompt}${message ? `\n${message}` : ''}` : message;
    if (pendingAttachment?.kind === 'image') sendAiImageMessage(pendingAttachment.data, prompt || undefined, selectedFavoriteIds);
    else if (pendingAttachment?.kind === 'document') sendAiFileMessage(pendingAttachment.name, pendingAttachment.data, prompt, selectedFavoriteIds);
    else sendAiMessage(prompt, selectedFavoriteIds);
    setInputVal('');
    setPendingAttachment(null);
    setActiveSkillId(null);
  };

  const updateDeepSeekKey = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!deepSeekApiKey.trim() || deepSeekKeyBusy) return;
    setDeepSeekKeyBusy(true);
    setDeepSeekKeyError(null);
    try {
      if (onboardingPreview) {
        setDeepSeekConfiguredState(true);
      } else {
        const response = await fetch('/api/consumer/deepseek-key', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: deepSeekApiKey }),
        });
        const result = await response.json() as { configured?: boolean; error?: string };
        if (!response.ok || !result.configured) throw new Error(result.error || 'DeepSeek 连接失败。');
        setDeepSeekConfiguredState(true);
      }
      setDeepSeekApiKey('');
    } catch (cause) {
      setDeepSeekKeyError(cause instanceof Error ? cause.message : 'DeepSeek 连接失败。');
    } finally {
      setDeepSeekKeyBusy(false);
    }
  };

  const toggleVoiceInput = () => {
    if (isRecording) {
      voiceRecognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const speechWindow = window as VoiceWindow;
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      showToast('当前浏览器不支持语音输入。');
      return;
    }

    const recognition = new Recognition();
    recognition.lang = 'zh-CN';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .slice(event.resultIndex)
        .map((result) => result[0]?.transcript || '')
        .join('');
      if (transcript) setInputVal((current) => `${current}${current && !current.endsWith(' ') ? ' ' : ''}${transcript}`);
    };
    recognition.onerror = (event) => {
      setIsRecording(false);
      voiceRecognitionRef.current = null;
      if (event.error !== 'aborted') showToast('语音输入未完成，请检查麦克风权限。');
    };
    recognition.onend = () => {
      setIsRecording(false);
      voiceRecognitionRef.current = null;
    };
    try {
      recognition.start();
      voiceRecognitionRef.current = recognition;
      setIsRecording(true);
    } catch {
      voiceRecognitionRef.current = null;
      setIsRecording(false);
      showToast('无法启动语音输入，请检查麦克风权限。');
    }
  };

  useEffect(() => () => voiceRecognitionRef.current?.stop(), []);

  const toggleSkillPanel = () => {
    if (!isSkillPanelOpen) setInstalledSkillIds(readInstalledSkillIds());
    skillMentionIndexRef.current = null;
    setSkillHighlightIndex(-1);
    setIsUploadMenuOpen(false);
    setIsSkillPanelOpen((open) => !open);
  };

  const togglePinnedSkill = (id: EvaSkillId) => {
    const next = pinnedSkillIds.includes(id) ? pinnedSkillIds.filter((item) => item !== id) : [...pinnedSkillIds, id];
    setPinnedSkillIds(next);
    localStorage.setItem(PINNED_SKILLS_STORAGE_KEY, JSON.stringify(next));
  };

  const handleComposerChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = event.target.value;
    const caret = event.target.selectionStart;
    setInputVal(next);
    if (next[caret - 1] === '@' || next[caret - 1] === '＠') {
      skillMentionIndexRef.current = caret - 1;
      setInstalledSkillIds(readInstalledSkillIds());
      setSkillHighlightIndex(-1);
      setIsUploadMenuOpen(false);
      setIsSkillPanelOpen(true);
    }
  };

  const handleComposerKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape' && (isSkillPanelOpen || isUploadMenuOpen)) {
      event.preventDefault();
      setIsSkillPanelOpen(false);
      setIsUploadMenuOpen(false);
      return;
    }
    if (isSkillPanelOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      if (!availableSkills.length) return;
      setSkillHighlightIndex((current) => current < 0
        ? (event.key === 'ArrowDown' ? 0 : availableSkills.length - 1)
        : (current + (event.key === 'ArrowDown' ? 1 : availableSkills.length - 1)) % availableSkills.length);
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (isSkillPanelOpen) {
        const skill = availableSkills[skillHighlightIndex < 0 ? 0 : skillHighlightIndex];
        if (skill) activateSkill(skill.id);
      }
      else { setSelectedRecommendation(null); handleSend(); }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        showToast('图片不能超过 3 MB。');
        e.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) setPendingAttachment({ name: file.name, kind: 'image', data: result });
      };
      reader.onerror = () => showToast('图片读取失败。');
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const extension = file.name.split('.').at(-1)?.toLowerCase();
    const mimeType = ({ pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', json: 'application/json' } as Record<string, string>)[extension || ''];
    if (!mimeType) { showToast('支持 PDF、TXT、MD、CSV 和 JSON 文件。'); return; }
    if (file.size > (extension === 'pdf' ? 2 * 1024 * 1024 : 24 * 1024)) { showToast(extension === 'pdf' ? 'PDF 不能超过 2 MB。' : '文本文件不能超过 24 KB。'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const encoded = String(reader.result).split(',')[1];
      if (encoded) setPendingAttachment({ name: file.name, kind: 'document', data: `data:${mimeType};base64,${encoded}` });
    };
    reader.onerror = () => showToast('文件读取失败。');
    reader.readAsDataURL(file);
  };

  const activateSkill = (id: EvaSkillId) => {
    if (id === 'shopping-preferences') {
      window.location.assign(persistSkillChanges ? '/discover?shoppingPreferences=1' : '/discover?shoppingPreferencesPreview=1')
      return
    }
    if (!installedSkillIds.includes(id)) {
      const next = [...installedSkillIds, id];
      localStorage.setItem(EVA_SKILLS_STORAGE_KEY, JSON.stringify(next));
      persistInstalledSkillIds(next);
    }
    const mentionIndex = skillMentionIndexRef.current;
    if (mentionIndex !== null) {
      setInputVal((current) => current[mentionIndex] === '@' || current[mentionIndex] === '＠'
        ? `${current.slice(0, mentionIndex)}${current.slice(mentionIndex + 1)}`
        : current);
    }
    skillMentionIndexRef.current = null;
    setIsSkillPanelOpen(false);
    setColumnView('history');
    setColumnsOpen(false);
    setActiveSkillId(id);
    requestAnimationFrame(() => document.getElementById('consumer-ai-input')?.focus());
  };

  return (
    <div className="eva-interface flex h-dvh min-h-0 flex-col overflow-hidden text-[var(--market-ink)] select-none">
      <LiquidGlass
        radius={0}
        bevelDepth={6}
        scale={8}
        aberration={0.2}
        frost={0.3}
        tint={0.84}
        interactive
        className="sticky top-0 z-30 w-full"
      >
        <div className="flex h-16 items-center justify-between gap-2 px-4 sm:px-6">
          <LiquidGlass
            radius={999}
            bevelDepth={8}
            scale={12}
            aberration={0.3}
            frost={0.3}
            tint={0.86}
            interactive
            className={`h-[46px] w-[46px] shrink-0 border-[0.5px] border-[var(--market-glass-border)] ${columnsOpen ? 'invisible' : ''}`}
          >
            <button
              type="button"
              onClick={() => selectTab('WORLD')}
              aria-label="返回发现"
              className="flex h-full w-full items-center justify-center rounded-full text-[var(--market-text-muted)] transition-colors hover:text-[var(--market-ink)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]"
            >
              <ArrowLeft size={18} aria-hidden="true" />
            </button>
          </LiquidGlass>
          <LiquidGlass
            radius={999}
            bevelDepth={8}
            scale={12}
            aberration={0.3}
            frost={0.3}
            tint={0.86}
            interactive
            className="h-[46px] w-[46px] shrink-0 border-[0.5px] border-[var(--market-glass-border)]"
          >
            <button
              type="button"
              onClick={() => { setMenuMode('main'); setMenuSearchOpen(false); setColumnsOpen(true); }}
              aria-label="打开菜单"
              title="菜单"
              className="flex h-full w-full items-center justify-center rounded-full text-[var(--market-text-muted)] transition-colors hover:text-[var(--market-ink)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]"
            >
              <List size={18} aria-hidden="true" />
            </button>
          </LiquidGlass>
        </div>
      </LiquidGlass>

      <div className="flex min-h-0 w-full flex-1 flex-col">
          {columnView === 'features' ? (
            <CapabilityLibrary
              onInstalledSkillsChange={persistInstalledSkillIds}
            />
          ) : columnView === 'archived' ? (
            <section aria-labelledby="eva-archive-title" className="min-h-0 flex-1 overflow-y-auto px-5 py-8 sm:px-8">
              <div className="mx-auto w-full max-w-4xl">
                <h1 id="eva-archive-title" className="text-xl font-semibold">已归档</h1>
                {archivedHistory.length ? <div className="mt-8 divide-y-[0.5px] divide-[var(--market-border)]">
                  {archivedHistory.map((message) => <div key={message.conversationId} className="flex min-h-14 items-center gap-4 py-2">
                    <button type="button" onClick={() => { selectAiConversation(message.conversationId!); setSelectedRecommendation(null); setColumnView('history'); setColumnsOpen(false); }} className="min-w-0 flex-1 truncate text-left text-sm text-[var(--market-ink)] hover:text-[var(--market-support)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]">{message.text || message.fileName || '图片消息'}</button>
                    <button type="button" onClick={() => archiveAiConversation(message.conversationId!)} className="shrink-0 rounded-[var(--radius-control)] px-2 py-1 text-sm text-[var(--market-text-secondary)] hover:bg-[var(--market-surface-muted)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]">恢复</button>
                  </div>)}
                </div> : <p className="mt-8 text-sm text-[var(--market-text-muted)]">暂无归档</p>}
              </div>
            </section>
          ) : <>
              <div
                ref={messageScrollerRef}
                onScroll={handleMessageScroll}
                role="log"
                aria-label="Omnilink 对话"
                aria-live="polite"
                data-slot="message-scroller"
                className="relative min-h-0 w-full flex-1 scroll-pt-4 overflow-y-auto overscroll-contain"
              >
                <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 pb-4 pt-4 sm:px-6">
                {(conversationMessages.length > 0 || onboardingActive || onboardingCompleted) && <div data-slot="message-scroller-content" className="space-y-6">
                {(onboardingActive || onboardingCompleted) && <InitialAssistantSetup initialProfile={initialEvaProfile ?? emptyEvaProfile} defaultName={profileName ?? ''} deepSeekConfigured={deepSeekConfiguredState} preview={onboardingPreview} onDeepSeekConfigured={() => setDeepSeekConfiguredState(true)} onComplete={() => { setOnboardingActive(false); setOnboardingCompleted(true); }} />}
                {conversationMessages.map((msg) => (
                  <MessageScrollerItem
                    key={msg.id}
                    id={`eva-message-${msg.id}`}
                    messageId={msg.id}
                    data-message-id={msg.id}
                    data-role={msg.isUser ? 'user' : 'assistant'}
                    scrollAnchor={msg.isUser}
                  >
                    <Message align={msg.isUser ? 'end' : 'start'} data-role={msg.isUser ? 'user' : 'assistant'} className={msg.isUser ? 'max-w-[88%]' : 'max-w-[92%]'}>
                    <MessageContent className={msg.isUser ? 'items-end gap-2' : 'w-full'}>{msg.isUser ? <div className="flex min-w-0 flex-col items-end gap-2">
                        {msg.image && <img src={msg.image} alt="你发送的图片" className="max-h-[360px] w-auto max-w-full rounded-xl object-cover" />}
                        {msg.fileName && <div className="flex max-w-full items-center gap-2 rounded-[var(--radius-control)] border-[0.5px] border-[var(--market-border)] px-3 py-2 text-sm"><FileText size={17} aria-hidden="true" /><span className="truncate">{msg.fileName}</span></div>}
                        {msg.text && msg.text !== '看看这张图' && <UserMessageBubble text={msg.text} />}
                    </div> : <div className="w-full">
                      {msg.id === 'first-use-preview-assistant' && msg.matchedProducts?.length ? <div>
                        <p className="mb-3 text-base leading-6">三种收纳方式对比：</p>
                        <div className="grid grid-cols-[minmax(0,1fr)_6rem_4rem] gap-2 px-2 py-2 text-sm font-semibold sm:grid-cols-[minmax(0,1fr)_10rem_5rem]"><span>商品</span><span>收纳方式</span><span>参考价</span></div>
                        {msg.matchedProducts.map((product, index) => <button key={product.id} type="button" onClick={() => setSelectedRecommendation(product)} aria-label={`查看${product.name}`} className="mb-1 grid w-full grid-cols-[minmax(0,1fr)_6rem_4rem] items-center gap-2 rounded-[20px] border-[0.5px] border-[var(--market-border)] px-2 py-2 text-left text-sm text-[var(--market-text-secondary)] transition-colors duration-200 ease-out hover:border-[var(--market-text-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)] sm:grid-cols-[minmax(0,1fr)_10rem_5rem]">
                          <span className="flex min-w-0 items-center gap-2"><Image src={product.mainImage} alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-[12px] object-cover" /><span className="min-w-0 line-clamp-2">{product.name}</span></span>
                          <span>{['利用墙面收纳', '桌面分类整理', '沙发旁灵活收纳'][index]}</span>
                          <span>{product.formattedPrice}</span>
                        </button>)}
                      </div> : <AssistantMessageText text={msg.text} />}
                      {msg.id !== 'first-use-preview-assistant' && msg.matchedProducts?.length ? <div className="mt-4 grid gap-3">
                        {msg.matchedProducts.slice(0, 3).map((product) => {
                          const saved = savedProductIds.includes(product.id);
                          const rejected = rejectedProductIds.includes(product.id);
                          return <div key={product.id} className="border-b-[0.5px] border-[var(--market-border)] pb-3 last:border-0">
                            <button type="button" onClick={() => setSelectedRecommendation(product)} aria-label={`查看${product.name}`} className="flex w-full items-center gap-3 rounded-[var(--radius-control)] p-2 text-left hover:bg-[var(--market-surface-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)]">
                              <img src={product.mainImage} alt="" className="h-20 w-20 shrink-0 rounded-[var(--radius-control)] object-cover" />
                              <span className="min-w-0 flex-1"><span className="line-clamp-2 text-sm font-semibold">{product.name}</span><span className="mt-1 block text-sm">{product.formattedPrice}</span>{msg.matchReasons?.[product.id] && <span className="mt-1 block text-xs leading-5 text-[var(--market-text-secondary)]">{msg.matchReasons[product.id]}</span>}</span>
                            </button>
                            <div className="flex items-center gap-4 pl-[92px] text-xs">
                              <button type="button" onClick={() => toggleSaveProduct(product.id)} aria-pressed={saved} aria-label={`${saved ? '取消收藏' : '收藏'}${product.name}`} className="inline-flex min-h-9 items-center gap-1 text-[var(--market-ink)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]"><Heart size={16} weight={saved ? 'fill' : 'regular'} aria-hidden="true" />{saved ? '已收藏' : '收藏'}</button>
                              <button type="button" onClick={() => toggleRejectProduct(product.id)} aria-pressed={rejected} aria-label={`${rejected ? '撤销不合适' : '标记不合适'}：${product.name}`} className="min-h-9 text-[var(--market-text-secondary)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]">{rejected ? '撤销不合适' : '不合适'}</button>
                            </div>
                          </div>;
                        })}
                      </div> : null}
                    </div>}</MessageContent>
                    </Message>
                  </MessageScrollerItem>
                ))}
                {isAiThinking && <MessageScrollerItem messageId="eva-pending"><Message align="start" data-role="assistant"><MessageContent aria-label="Omnilink 正在回复" className="max-w-[92%] text-sm text-[var(--market-text-muted)]"><AILoadingState steps={CONSUMER_AI_LOADING_STEPS} className="justify-start" /></MessageContent></Message></MessageScrollerItem>}
                </div>}
                </div>
                {showJumpToLatest && <button type="button" onClick={() => scrollToLatest()} aria-label="跳到最新消息" className="absolute bottom-48 right-1 flex h-10 w-10 items-center justify-center rounded-full border-[0.5px] border-[var(--market-border)] text-[var(--market-ink)] shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)]"><ArrowDown size={18} aria-hidden="true" /></button>}
              </div>
          <div className="eva-composer-dock relative z-20 w-full shrink-0 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
            <div aria-hidden="true" className="eva-composer-dock__glass" style={{ backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }} />
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/png,image/jpeg,image/webp" className="hidden" />
            <input type="file" ref={documentInputRef} onChange={handleDocumentUpload} accept=".pdf,.txt,.md,.csv,.json,application/pdf,text/plain,text/markdown,text/csv,application/json" className="hidden" />
            <input type="file" ref={cameraInputRef} onChange={handleFileUpload} accept="image/png,image/jpeg,image/webp" capture="environment" className="hidden" />
            <form ref={composerFormRef} onSubmit={(event) => { setSelectedRecommendation(null); handleSend(event); }} className="pointer-events-auto relative mx-auto flex w-full max-w-3xl flex-col gap-2 px-4 sm:px-6">
              <div className="relative flex min-h-10 items-center px-1">
                <div className="eva-skill-launcher absolute bottom-0 left-1 z-30" data-open={isSkillPanelOpen}>
                  {isSkillPanelOpen && <section id="eva-skills-panel" aria-label="选择技能" className="eva-skill-launcher__content no-scrollbar grid gap-1 overflow-y-auto px-2 pt-3">
                    {availableSkills.length ? availableSkills.map((skill, index) => {
                      const Icon = skill.icon;
                      const pinned = pinnedSkillIds.includes(skill.id);
                      return <div key={skill.id} data-highlighted={skillHighlightIndex === index} className="eva-skill-row flex min-h-12 items-center gap-2 rounded-full">
                        <button type="button" disabled={isAiThinking || onboardingActive} onClick={() => activateSkill(skill.id)} onMouseEnter={() => setSkillHighlightIndex(index)} onMouseLeave={() => setSkillHighlightIndex(-1)} onFocus={() => setSkillHighlightIndex(index)} aria-pressed={activeSkillId === skill.id} data-highlighted={skillHighlightIndex === index} className="eva-skill-option flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-full px-2 text-left text-sm font-medium focus-visible:outline-2 focus-visible:outline-[var(--market-support)] disabled:opacity-50">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[0.5px] border-[var(--market-border)] text-[var(--market-ink)]"><Icon size={17} strokeWidth={1.8} aria-hidden="true" /></span>
                          <span className="min-w-0 flex-1 truncate">{skill.title}</span>
                        </button>
                        <button type="button" onClick={() => togglePinnedSkill(skill.id)} aria-label={`${pinned ? '取消固定' : '固定'}${skill.title}`} aria-pressed={pinned} title={pinned ? '取消固定' : '固定到输入框上方'} className="eva-skill-pin flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--market-text-secondary)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]">{pinned ? <LockKeyhole size={18} aria-hidden="true" /> : <LockKeyholeOpen size={18} aria-hidden="true" />}</button>
                      </div>;
                    }) : <p className="px-3 py-4 text-xs text-[var(--market-text-muted)]">暂无已安装技能</p>}
                  </section>}
                  <button type="button" onClick={toggleSkillPanel} disabled={isAiThinking || onboardingActive} aria-label={isSkillPanelOpen ? '关闭技能' : '选择技能'} aria-expanded={isSkillPanelOpen} aria-controls="eva-skills-panel" className="eva-skill-trigger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)] disabled:opacity-50">{isSkillPanelOpen ? <X size={18} aria-hidden="true" /> : <Sparkles size={19} aria-hidden="true" />}<span>选择技能</span></button>
                </div>
                <div className="no-scrollbar ml-12 flex min-w-0 items-center gap-2 overflow-x-auto">
                  {pinnedAvailableSkills.map((skill) => {
                    const id = skill.id;
                    const Icon = skill.icon;
                    return <button key={id} type="button" onClick={() => activateSkill(id)} aria-label={`使用${skill.title}`} aria-pressed={activeSkillId === id} className="eva-skill-shortcut inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)]"><Icon size={15} strokeWidth={1.8} aria-hidden="true" />{skill.title}</button>;
                  })}
                </div>
              </div>
              <div className="relative w-full">
                {isUploadMenuOpen && <div id="eva-add-menu" className="eva-composer-sheet absolute bottom-[calc(100%+8px)] left-0 z-40 w-full max-w-none rounded-[24px] border-[0.5px] border-[var(--market-border)] bg-[var(--market-surface)] p-2 shadow-sm">
                  {menuView === 'favorites' ? <div>
                    <button type="button" onClick={() => setMenuView('add')} className="flex h-11 w-full items-center gap-2 px-2 text-sm"><ArrowLeft size={16} />收藏</button>
                    <div className="max-h-52 overflow-y-auto">
                      {products.filter((product) => savedProductIds.includes(product.id)).length ? products.filter((product) => savedProductIds.includes(product.id)).map((product) => <label key={product.id} className="flex min-h-11 items-center gap-2 px-2 text-xs">
                        <input type="checkbox" checked={selectedFavoriteProductIds.includes(product.id)} onChange={() => setSelectedFavoriteProductIds((current) => current.includes(product.id) ? current.filter((id) => id !== product.id) : [...current, product.id])} />
                        <span className="truncate">{product.name}</span>
                      </label>) : <p className="px-2 py-3 text-xs text-[var(--market-text-muted)]">暂无收藏</p>}
                    </div>
                    <button type="button" onClick={() => setIsUploadMenuOpen(false)} className="h-11 w-full text-sm text-[var(--market-support)]">完成</button>
                  </div> : <>
                    <button type="button" onClick={() => { setIsUploadMenuOpen(false); documentInputRef.current?.click(); }} className="flex h-11 w-full items-center gap-2 rounded-[var(--radius-control)] px-2 text-sm hover:bg-[var(--market-surface-muted)]"><FileText size={17} aria-hidden="true" />文件</button>
                    <button type="button" onClick={() => { setIsUploadMenuOpen(false); fileInputRef.current?.click(); }} className="flex h-11 w-full items-center gap-2 rounded-[var(--radius-control)] px-2 text-sm hover:bg-[var(--market-surface-muted)]"><ImageIcon size={17} aria-hidden="true" />图片</button>
                    <button type="button" onClick={() => { setIsUploadMenuOpen(false); cameraInputRef.current?.click(); }} className="flex h-11 w-full items-center gap-2 rounded-[var(--radius-control)] px-2 text-sm hover:bg-[var(--market-surface-muted)]"><Camera size={17} aria-hidden="true" />拍摄</button>
                    <button type="button" onClick={() => setMenuView('favorites')} className="flex h-11 w-full items-center gap-2 rounded-[var(--radius-control)] px-2 text-sm hover:bg-[var(--market-surface-muted)]"><Heart size={17} aria-hidden="true" />收藏</button>
                  </>}
                </div>}
                <LiquidGlass radius={999} bevelDepth={8} scale={12} aberration={0.25} frost={0.3} tint={0.84} interactive className="eva-composer-surface flex min-h-12 items-center rounded-full border-[0.5px] px-1.5 py-1 text-[var(--market-ink)]">
                  <div data-prompt-input="true" className="flex w-full min-w-0 items-center gap-1.5">
                    <button type="button" disabled={onboardingActive} onClick={() => { setIsSkillPanelOpen(false); setMenuView('add'); setIsUploadMenuOpen((open) => !open); }} aria-label="添加附件" aria-expanded={isUploadMenuOpen} aria-controls="eva-add-menu" className="eva-composer-plus flex h-8 w-8 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)] disabled:opacity-50"><Plus size={16} aria-hidden="true" /></button>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      {(pendingAttachment || activeSkill || selectedFavoriteIds.length > 0) && <div className="flex flex-wrap items-center gap-1.5">
                        {pendingAttachment && <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-[var(--market-surface-muted)] px-2 py-1 text-xs">{pendingAttachment.kind === 'image' ? <ImageIcon size={15} aria-hidden="true" /> : <FileText size={15} aria-hidden="true" />}<span className="max-w-24 truncate">{pendingAttachment.name}</span><button type="button" onClick={() => setPendingAttachment(null)} aria-label={`移除${pendingAttachment.name}`} className="flex h-5 w-5 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-[var(--market-support)]"><X size={12} aria-hidden="true" /></button></span>}
                        {activeSkill && <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-[var(--market-surface-muted)] px-2 py-1 text-xs font-medium"><span className="max-w-28 truncate">@{activeSkill.title}</span><button type="button" onClick={() => setActiveSkillId(null)} aria-label={`取消${activeSkill.title}技能`} className="flex h-5 w-5 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-[var(--market-support)]"><X size={12} aria-hidden="true" /></button></span>}
                        {selectedFavoriteIds.length > 0 && <button type="button" onClick={() => { setIsSkillPanelOpen(false); setMenuView('favorites'); setIsUploadMenuOpen(true); }} className="inline-flex items-center gap-1 rounded-full bg-[var(--market-surface-muted)] px-2 py-1 text-xs font-medium"><Heart size={14} weight="fill" aria-hidden="true" />收藏 {selectedFavoriteIds.length}</button>}
                      </div>}
                      <textarea id="consumer-ai-input" rows={1} value={inputVal} onChange={handleComposerChange} onKeyDown={handleComposerKeyDown} aria-label="发消息" disabled={onboardingActive} className="eva-composer-input min-w-0 flex-1 bg-transparent text-xs text-[var(--market-ink)] outline-none disabled:cursor-not-allowed" />
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button type="button" disabled={isAiThinking || onboardingActive} aria-label={`选择模型，当前为 ${CONSUMER_AI_MODELS.find((model) => model.id === aiModel)?.label ?? 'DeepSeek V4 Pro'}`} className="eva-composer-model flex h-8 shrink-0 items-center gap-1 rounded-full px-1.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-[var(--market-support)] disabled:opacity-50"><span className="hidden sm:inline">{CONSUMER_AI_MODELS.find((model) => model.id === aiModel)?.label ?? 'DeepSeek V4 Pro'}</span><span className="sm:hidden">{aiModel === 'deepseek-v4-pro' ? 'V4 Pro' : aiModel === 'deepseek-flash' ? 'Flash' : aiModel === 'qwen-plus' ? 'Qwen' : 'Gemini'}</span><ChevronDown size={10} aria-hidden="true" /></button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" side="top" className="w-48 !text-[var(--palette-ink)] [&_*]:!text-[var(--palette-ink)]" style={{ backgroundColor: 'color-mix(in srgb, var(--palette-porcelain) 96%, transparent)', borderColor: 'color-mix(in srgb, var(--palette-ink) 14%, transparent)' }}><DropdownMenuRadioGroup value={aiModel} onValueChange={(value) => setAiModel(value as ConsumerAiModel)}>{CONSUMER_AI_MODELS.map((model) => <DropdownMenuRadioItem key={model.id} value={model.id} className="normal-case tracking-normal">{model.label}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup></DropdownMenuContent>
                    </DropdownMenu>
                    <button type="button" onClick={toggleVoiceInput} disabled={isAiThinking || onboardingActive} aria-label={isRecording ? '停止语音输入' : '语音输入'} aria-pressed={isRecording} title={isRecording ? '停止语音输入' : '语音输入'} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-[var(--market-support)] disabled:opacity-50">{isRecording ? <MicOff size={15} aria-hidden="true" /> : <Mic size={15} aria-hidden="true" />}</button>
                    <button type="submit" disabled={onboardingActive || (!inputVal.trim() && selectedFavoriteIds.length === 0 && !pendingAttachment) || isAiThinking} aria-label="发送" className="eva-composer-send flex h-8 w-8 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)] disabled:opacity-50"><Send size={14} weight="bold" aria-hidden="true" /></button>
                  </div>
                </LiquidGlass>
              </div>
            </form>
          </div>
          </>}
        </div>
      {columnsOpen && <div className="fixed inset-0 z-[80]" role="presentation">
        <aside role="dialog" aria-modal="true" aria-label="聊天导航" className="eva-menu-panel">
          <header className="eva-menu__header">
            <div className="eva-menu__header-inner">
              <div className="eva-menu__header-actions">
                <LiquidGlass {...MENU_GLASS} interactive className="eva-menu__glass-button"><button type="button" onClick={() => { setMenuMode('main'); setMenuSearchOpen(!menuSearchOpen); setMenuSearch(''); }} aria-label="搜索此页" aria-pressed={menuSearchOpen} className="eva-menu__glass-action"><MagnifyingGlass size={24} aria-hidden="true" /></button></LiquidGlass>
                <LiquidGlass {...MENU_GLASS} interactive className="eva-menu__glass-button"><button type="button" onClick={() => setColumnsOpen(false)} aria-label="关闭菜单" className="eva-menu__glass-action"><X size={26} aria-hidden="true" /></button></LiquidGlass>
              </div>
            </div>
          </header>
          <div className="eva-menu__scroll">
            <div className="eva-menu__content">
              {menuMode === 'settings' ? <section className="eva-menu__subpage" aria-label="设置">
                  <button type="button" className="eva-menu__back" onClick={() => setMenuMode('main')}><ArrowLeft size={18} aria-hidden="true" />返回菜单</button>
                  <h2>设置</h2>
                  <section className="eva-menu__api-settings" aria-label="DeepSeek API 设置">
                    <div className="eva-menu__api-heading"><h3>DeepSeek API Key</h3><span aria-live="polite">{deepSeekConfiguredState ? '已连接' : '未连接'}</span></div>
                    <form onSubmit={updateDeepSeekKey} className="eva-menu__api-form">
                      <input type="password" autoComplete="off" value={deepSeekApiKey} onChange={(event) => setDeepSeekApiKey(event.target.value)} maxLength={512} aria-label="DeepSeek API Key" placeholder={deepSeekConfiguredState ? '输入新的 API Key' : '粘贴 API Key'} required />
                      <button type="submit" disabled={deepSeekKeyBusy || !deepSeekApiKey.trim()}>{deepSeekKeyBusy ? '提交中' : deepSeekConfiguredState ? '更新' : '提交'}</button>
                    </form>
                    {deepSeekKeyError && <p className="eva-menu__api-error" role="alert">{deepSeekKeyError}</p>}
                  </section>
                  <fieldset className="eva-menu__model-list"><legend>聊天模型</legend>{CONSUMER_AI_MODELS.map((model) => <label key={model.id} className="eva-menu__model-option"><input type="radio" name="menu-model" checked={aiModel === model.id} onChange={() => setAiModel(model.id)} /><span>{model.label}</span></label>)}</fieldset>
                  <button type="button" className="eva-menu__profile-link" onClick={() => { selectTab('PROFILE'); setColumnsOpen(false); }}>个人资料</button>
                </section>
                  : <>
                    {menuSearchOpen ? <>
                      <label className="eva-menu__search"><MagnifyingGlass size={20} aria-hidden="true" /><input autoFocus type="search" value={menuSearch} onChange={(event) => setMenuSearch(event.target.value)} placeholder="搜索对话、商品和技能" aria-label="搜索 AI 内容" /></label>
                      {searchQuery && <div className="eva-menu__search-results">
                        {hasSearchPages && <section className="eva-menu__result-group" aria-label="页面入口"><h2>页面</h2>
                          {matchesSearch('发起新对话') && <button type="button" className="eva-menu__result" onClick={() => { startAiConversation(); setColumnView('history'); setColumnsOpen(false); }}><NotePencil size={22} aria-hidden="true" /><span>发起新对话</span></button>}
                          {matchesSearch('插件和技能') && <button type="button" className="eva-menu__result" onClick={() => { setColumnView('features'); setColumnsOpen(false); }}><SkillIcon size={22} aria-hidden="true" /><span>插件和技能</span></button>}
                          {matchesSearch('已归档') && <button type="button" className="eva-menu__result" onClick={() => { setColumnView('archived'); setColumnsOpen(false); }}><Archive size={22} aria-hidden="true" /><span>已归档</span></button>}
                          {(matchesSearch('个人主页') || matchesSearch(profileName ?? '')) && <button type="button" className="eva-menu__result" onClick={() => { selectTab('PROFILE'); setColumnsOpen(false); }}><span className="eva-menu__result-avatar" aria-hidden="true">{profileName?.trim().slice(0, 1).toUpperCase() || '访'}</span><span>个人主页</span></button>}
                          {(matchesSearch('设置') || CONSUMER_AI_MODELS.some((model) => matchesSearch(model.label))) && <button type="button" className="eva-menu__result" onClick={() => { setMenuMode('settings'); setMenuSearchOpen(false); setMenuSearch(''); }}><GearSix size={22} aria-hidden="true" /><span>设置</span></button>}
                        </section>}
                        {searchedHistory.length > 0 && <section className="eva-menu__result-group" aria-label="对话搜索结果"><h2>对话</h2>{searchedHistory.map((message) => {
                          const matchingMessage = aiMessages.find((entry) => entry.conversationId === message.conversationId && [entry.text, entry.fileName, ...(entry.matchedProducts?.map((product) => product.name) ?? []), ...Object.values(entry.matchReasons ?? {})].some(matchesSearch));
                          const title = message.text || message.fileName || '图片消息';
                          const snippet = [matchingMessage?.text, matchingMessage?.fileName, ...(matchingMessage?.matchedProducts?.map((product) => product.name) ?? []), ...Object.values(matchingMessage?.matchReasons ?? {})].find((value) => value && value !== title && matchesSearch(value));
                          return <button key={message.conversationId} type="button" className="eva-menu__result eva-menu__result--conversation" onClick={() => { selectAiConversation(message.conversationId!); setSelectedRecommendation(null); setColumnView('history'); setColumnsOpen(false); }}><span className="eva-menu__result-copy"><span>{title}</span>{snippet && <small>{snippet}</small>}</span>{archivedAiConversationIds.includes(message.conversationId!) && <span className="eva-menu__result-status">已归档</span>}</button>;
                        })}</section>}
                        {searchedSkills.length > 0 && <section className="eva-menu__result-group" aria-label="技能搜索结果"><h2>技能</h2>{searchedSkills.map((skill) => <button key={skill.id} type="button" className="eva-menu__result" onClick={() => activateSkill(skill.id)}><skill.icon size={22} aria-hidden="true" /><span className="eva-menu__result-copy"><span>{skill.title}</span><small>{skill.description}</small></span></button>)}</section>}
                        {!hasSearchPages && searchedHistory.length === 0 && searchedSkills.length === 0 && <p className="eva-menu__empty">没有匹配的内容</p>}
                      </div>}
                    </> : <>
                    <nav aria-label="导航" className="eva-menu__nav">
                      <button type="button" onClick={() => { startAiConversation(); setColumnView('history'); setColumnsOpen(false); }} className="eva-menu__nav-item eva-menu__new-chat"><NotePencil size={24} aria-hidden="true" /><span>发起新对话</span></button>
                      <button type="button" onClick={() => { setColumnView('features'); setColumnsOpen(false); }} aria-current={columnView === 'features' ? 'page' : undefined} className="eva-menu__nav-item"><SkillIcon size={24} strokeWidth={1.8} aria-hidden="true" /><span>插件和技能</span></button>
                      <button type="button" onClick={() => { setColumnView('archived'); setColumnsOpen(false); }} aria-current={columnView === 'archived' ? 'page' : undefined} className="eva-menu__nav-item"><Archive size={24} aria-hidden="true" /><span>已归档</span></button>
                    </nav>
                    <section aria-label="最近对话" className="eva-menu__history">
                      <h2>最近</h2>
                      <div className="eva-menu__history-list">{visibleHistory.length ? visibleHistory.map((message) => {
                        const openMessage = () => { selectAiConversation(message.conversationId!); setSelectedRecommendation(null); setColumnView('history'); setColumnsOpen(false); };
                        return <SwipeRow key={message.conversationId} label={message.text || message.fileName || '图片消息'} actions={[{ id: 'delete', label: '删除', icon: <Trash size={20} aria-hidden="true" /> }, { id: 'archive', label: '归档', icon: <Archive size={20} aria-hidden="true" />, dismiss: true }]} onCommit={(action) => action.id === 'delete' ? deleteAiConversation(message.conversationId!) : archiveAiConversation(message.conversationId!)} actionColor="var(--market-surface-muted)" drawerColor="var(--market-surface-muted)" rowColor={message.conversationId === activeAiConversationId ? 'var(--market-surface-muted)' : 'var(--market-surface)'} textColor="var(--market-ink)" height={52} radius={16} actionWidth={64} direction="left" snapBounce={0.14} resistance={0.55} collapseMs={200} commitAt={0.6} fullSwipe><button type="button" onClick={openMessage} title={message.text || message.fileName || '图片消息'} aria-current={message.conversationId === activeAiConversationId ? 'page' : undefined} className="h-full w-full min-w-0 truncate px-4 text-left text-base focus-visible:outline-2 focus-visible:outline-[var(--market-support)]">{message.text || message.fileName || '图片消息'}</button></SwipeRow>;
                      }) : <p className="eva-menu__empty">暂无对话</p>}</div>
                    </section>
                    </>}
                  </>}
            </div>
          </div>
          <footer className="eva-menu__footer">
            <div className="eva-menu__footer-inner">
              <button type="button" onClick={() => { selectTab('PROFILE'); setColumnsOpen(false); }} aria-label="打开个人主页" className="eva-menu__account"><span className="eva-menu__avatar" aria-hidden="true">{profileName?.trim().slice(0, 1).toUpperCase() || '访'}</span><span className="eva-menu__account-name">{profileName || '访客'}</span></button>
              <button type="button" onClick={() => { setMenuMode('settings'); setMenuSearchOpen(false); }} aria-label="设置" className="eva-menu__settings"><GearSix size={25} aria-hidden="true" /></button>
            </div>
          </footer>
        </aside>
      </div>}
      {selectedRecommendation && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--market-ink)]/20 px-4 py-6" onClick={() => setSelectedRecommendation(null)} role="presentation">
        <section role="dialog" aria-modal="true" aria-label={selectedRecommendation.name} onClick={(event) => event.stopPropagation()} className="max-h-full w-full max-w-sm overflow-y-auto rounded-2xl border-[0.5px] border-[var(--market-border)] bg-[var(--market-surface)] p-4 shadow-lg">
          <div className="mb-3 flex justify-end"><button type="button" onClick={() => setSelectedRecommendation(null)} aria-label="关闭商品卡片" className="flex h-8 w-8 items-center justify-center rounded-full border-[0.5px] border-[var(--market-border)] hover:border-[var(--market-text-muted)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]"><X size={17} aria-hidden="true" /></button></div>
          <Image src={selectedRecommendation.mainImage} alt={selectedRecommendation.name} width={480} height={480} className="aspect-square w-full rounded-xl object-cover" />
          <div className="mt-4 flex items-start justify-between gap-3 text-base font-semibold"><h2 className="min-w-0">{selectedRecommendation.name}</h2><span className="shrink-0">{selectedRecommendation.formattedPrice}</span></div>
          <button type="button" onClick={() => addToCart(selectedRecommendation)} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-full border-[0.5px] border-[var(--market-border)] text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)]" style={{ color: 'var(--market-ink)' }}><ShoppingBag size={17} aria-hidden="true" />加入购物车</button>
        </section>
      </div>}
    </div>
  );
};

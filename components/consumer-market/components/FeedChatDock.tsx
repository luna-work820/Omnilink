'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react'
import { useOmnilink } from '../context/OmnilinkContext'
import { LiquidGlass } from '@/components/ui/liquid-glass'
import AITextLoading from '@/components/kokonutui/ai-text-loading'
import { InsightQuestion as InsightQuestionView } from './InsightQuestion'
import { PaperPlaneRight as Send } from '@phosphor-icons/react'
import { Camera, ChevronDown as HistoryChevron, Expand, FileText, Heart, Image as ImageIcon, Link as LinkIcon, Square, LockKeyhole, LockKeyholeOpen, MessageCircle, Minus, Plus, X } from 'lucide-react'
import { AI_ASSISTANT_SKILLS, AI_ASSISTANT_SKILLS_STORAGE_KEY, readInstalledSkillIds, type AiAssistantSkillId } from './CapabilityLibrary'
import type { InsightQuestion, InsightOption } from '@/lib/consumer-advisor/fashion-insight'
import type { AiChatMessage } from '../types'
import { APPEARANCE_ACTIONS } from '@/lib/consumer-advisor/appearance-actions'
import { AnalysisMemoryButton } from './AnalysisMemoryButton'

export const FEED_CHAT_SCROLL_KEY = 'omnilink-feed-chat-preview-scroll'
export type FeedAttachment = { name: string; kind: 'image' | 'document' | 'url'; data: string }
export type FeedDroppedReference = { key: string; title: string; url?: string; productId?: string; detail?: string }
const PINNED_SKILLS_STORAGE_KEY = 'omnilink_pinned_skills_v1'

function readPinnedSkillIds(): AiAssistantSkillId[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(PINNED_SKILLS_STORAGE_KEY) ?? '[]')
    const pinned = Array.isArray(saved) ? AI_ASSISTANT_SKILLS.map((skill) => skill.id).filter((id) => saved.includes(id)) : []
    localStorage.setItem(PINNED_SKILLS_STORAGE_KEY, JSON.stringify(pinned))
    return pinned
  } catch { return [] }
}

export function FeedChatDock({
  insightQuestion,
  insightThinking = false,
  selectedInsightValue,
  onInsightChange,
  onInsightSkip,
  onInsightSelect,
  chatOpen = false,
  chatCardOpen = false,
  cardHistoryOpen = false,
  showSignupWelcomeActions = false,
  disabled = false,
  onSubmitMessage,
  onSubmitAttachment,
  onBrowse,
  onActivate,
  onToggleCardHistory,
  onExpandChat,
  onStartSignupAssistant,
  onBrowseSignupWelcome,
  droppedReferences = [],
  onRemoveDroppedReference,
  onClearDroppedReferences,
  conversationMessages = [],
  getFeedScrollTop,
  initialInstalledSkillIds,
  navigationOpen = false,
}: {
  insightQuestion?: InsightQuestion | null
  insightThinking?: boolean
  selectedInsightValue: string
  onInsightChange: (value: string) => void
  onInsightSkip?: () => void
  onInsightSelect?: (option: InsightOption) => void
  chatOpen?: boolean
  chatCardOpen?: boolean
  cardHistoryOpen?: boolean
  showSignupWelcomeActions?: boolean
  disabled?: boolean
  onSubmitMessage?: (message: string, selectedProductIds: string[], hasActiveSkill: boolean, skillId?: AiAssistantSkillId) => void
  onSubmitAttachment?: (attachment: FeedAttachment, message: string, selectedProductIds: string[], hasActiveSkill: boolean, skillId?: AiAssistantSkillId) => void
  onBrowse?: () => void
  onActivate?: () => void
  onToggleCardHistory?: () => void
  onExpandChat?: () => void
  onStartSignupAssistant?: () => void
  onBrowseSignupWelcome?: () => void
  droppedReferences?: FeedDroppedReference[]
  onRemoveDroppedReference?: (key: string) => void
  onClearDroppedReferences?: () => void
  conversationMessages?: AiChatMessage[]
  getFeedScrollTop?: () => number
  initialInstalledSkillIds?: AiAssistantSkillId[]
  navigationOpen?: boolean
}) {
  const [message, setMessage] = useState('')
  const messageInputRef = useRef<HTMLTextAreaElement>(null)
  const appearanceActionsRef = useRef<HTMLDivElement>(null)
  const referenceRowRef = useRef<HTMLDivElement>(null)
  const seenReferenceKeysRef = useRef<Set<string>>(new Set())
  const [panel, setPanel] = useState<'attachments' | 'favorites' | null>(null)
  const [installedSkillIds, setInstalledSkillIds] = useState<AiAssistantSkillId[]>([])
  const [pinnedSkillIds, setPinnedSkillIds] = useState<AiAssistantSkillId[]>([])
  const [attachment, setAttachment] = useState<FeedAttachment | null>(null)
  const [selectedFavoriteIds, setSelectedFavoriteIds] = useState<string[]>([])
  const [urlEntry,setUrlEntry]=useState(false),[urlValue,setUrlValue]=useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const cardHistoryRef = useRef<HTMLDivElement>(null)
  const { openAiPage, showToast, isAiThinking, discoveryBusy, products, savedProductIds,activeAssistantSkillId: activeSkillId,setActiveAssistantSkillId: setActiveSkillId,openPersonalView,stopAiResponse } = useOmnilink()
  const canSend = Boolean(message.trim() || attachment || selectedFavoriteIds.length || droppedReferences.length)
  const activeSkill = AI_ASSISTANT_SKILLS.find((skill) => skill.id === activeSkillId)
  const availableSkills = AI_ASSISTANT_SKILLS.filter((skill) => installedSkillIds.includes(skill.id))
  const pinnedSkills = availableSkills.filter((skill) => pinnedSkillIds.includes(skill.id))
  const favoriteProducts = products.filter((product) => savedProductIds.includes(product.id))
  const conversationTitle = conversationMessages.find((item) => item.isUser)?.text.trim() || '新对话'
  useEffect(() => {
    if (chatCardOpen && cardHistoryOpen && cardHistoryRef.current) {
      cardHistoryRef.current.scrollTop = cardHistoryRef.current.scrollHeight
    }
  }, [chatCardOpen, cardHistoryOpen, conversationMessages.length, insightQuestion])

  useLayoutEffect(() => {
    const newReferences = droppedReferences.filter((reference) => !seenReferenceKeysRef.current.has(reference.key))
    seenReferenceKeysRef.current = new Set(droppedReferences.map((reference) => reference.key))
    if (!newReferences.length) return
    messageInputRef.current?.focus()
    messageInputRef.current?.setSelectionRange(message.length, message.length)
    if (referenceRowRef.current) referenceRowRef.current.scrollLeft = referenceRowRef.current.scrollWidth
  }, [droppedReferences])
  useEffect(() => { queueMicrotask(() => setPinnedSkillIds(readPinnedSkillIds())) }, [])
  useEffect(() => {
    const skillIds = initialInstalledSkillIds ?? readInstalledSkillIds()
    setInstalledSkillIds(skillIds)
    if (initialInstalledSkillIds) localStorage.setItem(AI_ASSISTANT_SKILLS_STORAGE_KEY, JSON.stringify(skillIds))
  }, [initialInstalledSkillIds])

  function togglePinnedSkill(id: AiAssistantSkillId) {
    const next = pinnedSkillIds.includes(id) ? pinnedSkillIds.filter((item) => item !== id) : [...pinnedSkillIds, id]
    setPinnedSkillIds(next)
    localStorage.setItem(PINNED_SKILLS_STORAGE_KEY, JSON.stringify(next))
  }

  function activateSkill(id: AiAssistantSkillId) {
    setActiveSkillId(id)
    setMessage((current) => current.endsWith('@') ? current.slice(0, -1) : current)
    setPanel(null)
    if (id === 'personal-advisor') requestAnimationFrame(() => appearanceActionsRef.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true }))
  }

  function openAssistant(prompt?: string) {
    sessionStorage.setItem(FEED_CHAT_SCROLL_KEY, String(getFeedScrollTop?.() ?? window.scrollY))
    openAiPage(prompt)
  }

  function sendMessage(startPrompt?: string) {
    if ((!canSend && !startPrompt) || isAiThinking || disabled) return
    const typedMessage = message.trim() || (startPrompt || attachment || droppedReferences.length ? '' : '请分析我选中的收藏商品，并说明搭配建议。')
    const activeReferences = droppedReferences
    const referenceText = activeReferences.map((reference) => [
      `@${reference.title}`,
      reference.url ? `链接：${reference.url}` : '',
      reference.detail ? `信息：${reference.detail}` : '',
    ].filter(Boolean).join('\n')).join('\n')
    const content = [startPrompt, typedMessage, referenceText].filter(Boolean).join('\n')
    const prompt = activeSkill && activeSkill.id !== 'personal-advisor' ? `${activeSkill.prompt}${content ? `\n${content}` : ''}` : content
    const productIds = [...new Set([...selectedFavoriteIds, ...activeReferences.map((reference) => reference.productId).filter((id): id is string => Boolean(id))])]
    const keepUrlForLater = Boolean(startPrompt && attachment?.kind === 'url')
    if (attachment && !keepUrlForLater && onSubmitAttachment) onSubmitAttachment(attachment, prompt, productIds, Boolean(activeSkill), activeSkill?.id)
    else if (onSubmitMessage) onSubmitMessage(prompt, productIds, Boolean(activeSkill), activeSkill?.id)
    else openAssistant(prompt)
    setMessage('')
    if (!keepUrlForLater) setAttachment(null)
    setSelectedFavoriteIds([])
    if (activeSkillId !== 'personal-advisor') setActiveSkillId(null)
    onClearDroppedReferences?.()
    setPanel(null)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    sendMessage()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if(event.nativeEvent.isComposing||event.nativeEvent.keyCode===229)return
    if (event.key === 'Escape') setPanel(null)
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
    const imageTypes: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' }
    const documentTypes: Record<string, string> = {
      pdf: 'application/pdf',
      txt: 'text/plain',
      md: 'text/markdown',
      csv: 'text/csv',
      json: 'application/json',
    }
    const imageMimeType = imageTypes[extension]
    const documentMimeType = documentTypes[extension]
    const kind = imageMimeType ? 'image' : documentMimeType ? 'document' : null
    if (!kind) { showToast('仅支持 PNG、JPEG、WebP、PDF、TXT、MD、CSV 或 JSON 文件。'); return }
    if ((kind === 'image' && file.type && !file.type.startsWith('image/')) || (kind === 'document' && file.type.startsWith('image/'))) {
      showToast('文件扩展名与格式不一致，请重新选择。')
      return
    }
    const maxBytes = kind === 'image' ? 3 * 1024 * 1024 : documentMimeType === 'application/pdf' ? 2 * 1024 * 1024 : 24 * 1024
    if (file.size > maxBytes) {
      showToast(kind === 'image' ? '图片不能超过 3 MB。' : documentMimeType === 'application/pdf' ? 'PDF 不能超过 2 MB。' : '文本文件不能超过 24 KB。')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') return
      const mimeType = kind === 'image' ? imageMimeType : documentMimeType
      const data = reader.result.replace(/^data:[^,]*,/, `data:${mimeType};base64,`)
      setAttachment({ name: file.name, kind, data })
    }
    reader.onerror = () => showToast('文件读取失败。')
    reader.readAsDataURL(file)
  }

  const pickerOpen = panel === 'attachments' || panel === 'favorites'
  const attachmentPanelOpen = panel === 'attachments' || panel === 'favorites'

  return <div data-navigation-open={navigationOpen} className="feed-chat-dock-shell pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-4">
    <div className="feed-chat-dock pointer-events-auto relative mx-auto flex w-full max-w-3xl items-end gap-2">
      <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md,.csv,.json" onChange={handleFile} aria-label="添加文件" className="hidden" />
      <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFile} aria-label="添加图片" className="hidden" />
      <input ref={cameraInputRef} type="file" accept="image/png,image/jpeg,image/webp" capture="environment" onChange={handleFile} aria-label="拍摄图片" className="hidden" />
      <form onSubmit={submit} className="relative min-w-0 flex-1" aria-label="询问 AI assistant">
        {insightThinking && !chatOpen && <span role="status" className="absolute bottom-[calc(100%+6px)] left-2 rounded-full bg-[var(--market-canvas)] px-3 py-2 text-xs text-[var(--market-text-secondary)]">正在思考</span>}
        {pickerOpen && <section id="feed-chat-picker-panel" role="group" aria-label={panel === 'favorites' ? '选择收藏' : '添加'} className={`feed-chat-picker-card absolute ${panel === 'attachments' ? 'bottom-[calc(48px+10px)] feed-chat-attachment-panel' : 'bottom-[calc(100%+10px)]'} left-0 right-0 z-30 max-h-[min(55dvh,420px)] overflow-y-auto p-2.5`} data-navigation-open={navigationOpen}>
          {panel === 'favorites' ? <>
            <h2 className="px-2 pb-1.5 text-xs font-medium text-[var(--market-text-secondary)]">收藏</h2>
            {favoriteProducts.length ? favoriteProducts.map((product) => <label key={product.id} className="feed-chat-picker-row flex min-h-12 items-center gap-3 rounded-full px-3 text-xs"><input type="checkbox" checked={selectedFavoriteIds.includes(product.id)} onChange={() => setSelectedFavoriteIds((current) => current.includes(product.id) ? current.filter((id) => id !== product.id) : [...current, product.id])} /><span className="truncate">{product.name}</span></label>) : <p className="px-3 py-3 text-xs text-[var(--market-text-muted)]">暂无收藏</p>}
            <button type="button" onClick={() => setPanel(null)} className="mt-1 min-h-10 w-full rounded-full text-xs hover:bg-[var(--market-hover)]">完成</button>
          </> : <>
            <h2 className="px-2 pb-1.5 text-xs font-medium text-[var(--market-text-secondary)]">添加</h2>
            <div className="grid grid-cols-1 gap-1">
              <button type="button" onClick={() => { setPanel(null); fileInputRef.current?.click() }} className="feed-chat-attachment-option flex min-h-11 items-center gap-2 rounded-full px-3 text-xs"><FileText size={17} aria-hidden="true" />文件</button>
              <button type="button" onClick={() => { setPanel(null); imageInputRef.current?.click() }} className="feed-chat-attachment-option flex min-h-11 items-center gap-2 rounded-full px-3 text-xs"><ImageIcon size={17} aria-hidden="true" />图片</button>
              <button type="button" onClick={() => { setPanel(null); cameraInputRef.current?.click() }} className="feed-chat-attachment-option flex min-h-11 items-center gap-2 rounded-full px-3 text-xs"><Camera size={17} aria-hidden="true" />拍摄</button>
              <button type="button" onClick={() => setPanel('favorites')} className="feed-chat-attachment-option flex min-h-11 items-center gap-2 rounded-full px-3 text-xs"><Heart size={17} aria-hidden="true" />收藏</button>
              <button type="button" onClick={()=>setUrlEntry((open)=>!open)} className="feed-chat-attachment-option flex min-h-11 items-center gap-2 rounded-full px-3 text-xs"><LinkIcon size={17} aria-hidden="true"/>网址</button>
            </div>
            {urlEntry&&<div className="mt-2 flex flex-wrap items-center gap-2 px-2"><label className="min-w-0 flex-1 text-xs">网址<input type="url" autoFocus placeholder="https://" value={urlValue} onChange={(event)=>setUrlValue(event.target.value)} onKeyDown={(event)=>{if(event.key==='Enter')event.preventDefault()}} className="mt-1 min-h-11 w-full rounded-full border-[0.5px] border-[var(--market-border)] bg-transparent px-3 text-sm focus-visible:outline-2 focus-visible:outline-[var(--market-support)]"/></label><button type="button" onClick={()=>{try{const url=new URL(urlValue);if(url.protocol!=='https:')throw new Error();setAttachment({kind:'url',name:url.hostname,data:url.href});setPanel(null);setUrlEntry(false);setUrlValue('')}catch{showToast('请填写 HTTPS 网址。')}}} className="min-h-11 rounded-full px-3 text-xs hover:bg-[var(--market-hover)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]">添加网址</button></div>}
            <h2 className="px-2 pb-1.5 pt-3 text-xs font-medium text-[var(--market-text-secondary)]">技能</h2>
            {availableSkills.length ? availableSkills.map((skill) => {
              const pinned = pinnedSkillIds.includes(skill.id)
              return <div key={skill.id} className="feed-chat-picker-row flex min-h-11 items-center rounded-full">
                <button type="button" onClick={() => activateSkill(skill.id)} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-full px-3 text-left text-xs focus-visible:outline-2 focus-visible:outline-[var(--market-support)]"><skill.icon size={17} aria-hidden="true" /><span className="truncate">{skill.title}</span></button>
                <button type="button" onClick={() => togglePinnedSkill(skill.id)} aria-label={`${pinned ? '取消固定' : '固定'}${skill.title}`} aria-pressed={pinned} className="feed-chat-picker-lock mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--market-text-secondary)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]">{pinned ? <LockKeyhole size={16} aria-hidden="true" /> : <LockKeyholeOpen size={16} aria-hidden="true" />}</button>
              </div>
            }) : <p className="px-3 py-3 text-xs text-[var(--market-text-muted)]">暂无已安装技能</p>}
          </>}
        </section>}
        {pinnedSkills.length > 0 && <div className="relative mb-1.5 min-h-8">
          <div className="flex min-h-8 items-center gap-2 overflow-x-auto">
            {pinnedSkills.map((skill) => <LiquidGlass key={skill.id} radius={999} bevelDepth={12} aberration={0.18} tint={1} interactive className="ai-assistant-composer-surface shrink-0 rounded-full"><button type="button" disabled={disabled} onClick={() => activateSkill(skill.id)} aria-pressed={activeSkillId === skill.id} className="relative flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[11px] text-[var(--market-ink)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)] disabled:opacity-40"><skill.icon size={13} aria-hidden="true" />{skill.title}</button></LiquidGlass>)}
          </div>
        </div>}
        <div className={`feed-chat-fluid-card ${chatCardOpen ? 'is-expanded' : ''} ${activeSkillId === 'personal-advisor' ? 'has-appearance-actions' : ''}`}>
        <div className="feed-chat-card-reveal">
        <section aria-label="当前对话" aria-hidden={!chatCardOpen} inert={!chatCardOpen} className={`feed-chat-conversation-card ${cardHistoryOpen ? 'is-expanded' : ''}`}>
          <div className="feed-chat-card-heading flex h-[46px] min-h-[46px] items-center gap-1 px-2 sm:px-3">
            <button type="button" onClick={onBrowse} aria-label="收起对话卡片" className="grid h-10 w-10 shrink-0 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-[var(--market-support)]"><Minus size={19} aria-hidden="true" /></button>
            <button type="button" onClick={onToggleCardHistory} aria-expanded={cardHistoryOpen} aria-controls={cardHistoryOpen ? 'feed-chat-card-history' : undefined} className="flex h-8 min-h-8 min-w-0 flex-1 items-center gap-2 rounded-lg px-1 text-left text-[9px] text-[var(--market-ink)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]"><MessageCircle size={17} className="shrink-0" aria-hidden="true" /><span className="truncate font-medium" aria-live="polite">{discoveryBusy ? '正在搜索' : (isAiThinking || insightThinking) ? '正在思考' : conversationTitle}</span><HistoryChevron size={14} className={`shrink-0 text-[var(--market-text-secondary)] transition-transform duration-[250ms] ease-out ${cardHistoryOpen ? 'rotate-180' : ''}`} aria-hidden="true" /></button>
            <button type="button" onClick={onExpandChat} aria-label="全屏展开对话" className="grid h-10 w-10 shrink-0 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-[var(--market-support)]"><Expand size={18} aria-hidden="true" /></button>
          </div>
          <div className="feed-chat-history-reveal" aria-hidden={!cardHistoryOpen} inert={!cardHistoryOpen}>
          <div id="feed-chat-card-history" ref={cardHistoryRef} role="log" aria-label="对话内容" className="feed-chat-card-history space-y-3 overflow-y-auto px-4 py-3">
            {conversationMessages.length ? conversationMessages.map((item) => <div key={item.id} className={`flex ${item.isUser ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[88%] break-words rounded-xl px-3 py-2 text-sm leading-6 ${item.isUser ? 'bg-[var(--market-surface-muted)]' : ''}`}>{item.image && <img src={item.image} alt="已发送的图片" className="mb-2 max-h-40 max-w-full object-contain" />}{item.fileName && <p className="text-xs opacity-80">{item.fileName}</p>}<p className="whitespace-pre-wrap">{item.text}</p>{item.id === 'first-login-welcome' && showSignupWelcomeActions && onStartSignupAssistant && onBrowseSignupWelcome && <div role="group" aria-label="首次使用操作" className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={onStartSignupAssistant} className="h-[31px] w-[84px] rounded-full bg-[var(--market-surface-muted)] px-2 text-xs font-medium text-[var(--market-ink)] transition-colors duration-150 ease-out hover:bg-[var(--market-hover)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]">形象助手</button><button type="button" onClick={onBrowseSignupWelcome} className="h-[31px] w-[84px] rounded-full bg-[var(--market-surface-muted)] px-2 text-xs font-medium text-[var(--market-ink)] transition-colors duration-150 ease-out hover:bg-[var(--market-hover)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]">先逛逛</button></div>}{item.memoryProposed && <button type="button" onClick={() => { openPersonalView('memories'); onBrowse?.() }} className="mt-2 min-h-11 whitespace-nowrap rounded-full px-3 text-xs font-medium hover:bg-[var(--market-hover)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]">查看待确认记忆</button>}{item.analysisMessageId && <AnalysisMemoryButton messageId={item.analysisMessageId} onOpen={() => { openPersonalView('memories'); onBrowse?.() }} />}</div></div>) : <p className="py-6 text-center text-sm text-[var(--market-text-secondary)]">暂无消息</p>}
            {insightQuestion && chatCardOpen && <InsightQuestionView question={insightQuestion} selectedValue={selectedInsightValue} onChange={onInsightChange} onSkip={() => onInsightSkip?.()} onSelect={(option) => onInsightSelect?.(option)} disabled={discoveryBusy} name="dock-insight" />}
            {isAiThinking && !conversationMessages.some((message) => message.state === 'streaming') && <AITextLoading />}
          </div>
          </div>
        </section>
        </div>
        <div className="feed-chat-composer-region relative">
          {activeSkillId === 'personal-advisor' && <div ref={appearanceActionsRef} role="group" aria-label="形象助手功能" className="feed-chat-appearance-actions flex flex-wrap gap-1.5 pb-2 pl-7 pr-2 pt-2">
            {APPEARANCE_ACTIONS.map((action) => <LiquidGlass key={action.label} radius={999} bevelDepth={12} aberration={0.18} tint={1} interactive className="ai-assistant-composer-surface shrink-0 rounded-full" style={{ overflow: 'visible' }}><button type="button" disabled={disabled || isAiThinking} onClick={() => sendMessage(action.prompt)} className="relative h-[30px] w-[79px] whitespace-nowrap rounded-full border-[0.5px] border-[var(--market-border)] bg-transparent px-2 text-xs font-medium text-[var(--market-ink)] hover:bg-[var(--market-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)] disabled:opacity-40">{action.label}</button></LiquidGlass>)}
          </div>}
          <LiquidGlass radius={chatOpen && !chatCardOpen ? 24 : 999} bevelDepth={12} aberration={0.18} tint={1} interactive className={`ai-assistant-composer-surface relative flex min-h-12 items-center rounded-full border-[0.5px] px-1.5 py-0.5 text-[var(--market-ink)] ${chatOpen ? 'is-chat-open' : ''} ${chatCardOpen ? 'is-chat-card' : ''}`} style={{ overflow: 'visible' }}>
          <button type="button" disabled={disabled || isAiThinking} onClick={() => { setInstalledSkillIds(readInstalledSkillIds()); setPanel((current) => current === 'attachments' ? null : 'attachments') }} aria-label={attachmentPanelOpen ? '关闭附件菜单' : '添加附件'} aria-expanded={attachmentPanelOpen} aria-controls="feed-chat-picker-panel" className="feed-chat-control feed-chat-attachment-trigger relative box-border flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-[var(--market-support)] disabled:opacity-40">{attachmentPanelOpen ? <X size={17} aria-hidden="true" /> : <Plus size={17} aria-hidden="true" />}</button>
          <div className="feed-chat-message-field flex min-h-11 min-w-0 flex-1 flex-col justify-center">
            <div ref={referenceRowRef} className="feed-chat-inline-input flex min-w-0 items-center gap-1 overflow-x-auto">
              {(activeSkill || attachment || selectedFavoriteIds.length > 0) && <div className="flex shrink-0 items-center gap-1">{activeSkill && <button type="button" onClick={() => setActiveSkillId(null)} className="box-border flex h-[30px] w-[95px] shrink-0 items-center justify-center overflow-hidden whitespace-nowrap rounded-full bg-[var(--market-surface-muted)] px-2 text-xs">@{activeSkill.title} ×</button>}{attachment && <button type="button" onClick={() => setAttachment(null)} className="max-w-24 truncate rounded-full bg-[var(--market-surface-muted)] px-2 py-0.5 text-xs">{attachment.name} ×</button>}{selectedFavoriteIds.length > 0 && <button type="button" onClick={() => setPanel('favorites')} className="rounded-full bg-[var(--market-surface-muted)] px-2 py-0.5 text-xs">收藏 {selectedFavoriteIds.length}</button>}</div>}
              {droppedReferences.map((reference) => <button key={reference.key} type="button" onClick={() => onRemoveDroppedReference?.(reference.key)} title={reference.url ?? reference.title} aria-label={`移除引用 ${reference.title}`} className="feed-chat-reference-chip flex h-7 max-w-40 shrink-0 items-center gap-1 rounded-full bg-[var(--market-surface-muted)] px-2 text-xs text-[var(--market-ink)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]"><span className="truncate">@{reference.title}</span><X size={12} className="shrink-0" aria-hidden="true" /></button>)}
              <textarea ref={messageInputRef} value={message} disabled={disabled} placeholder={droppedReferences.length ? '' : '说说你想找什么，或直接提问'} onClick={onActivate} onFocus={onActivate} onChange={(event) => { const next = event.target.value; setMessage(next); if (next.endsWith('@')) { setInstalledSkillIds(readInstalledSkillIds()); setPanel('attachments') } }} onKeyDown={handleKeyDown} rows={1} wrap="off" aria-label="搜索或询问 AI assistant" className="ai-assistant-composer-input block min-w-20 flex-1 bg-transparent px-1 text-xs text-[var(--market-ink)] outline-none" />
            </div>
          </div>
          {isAiThinking?<button type="button" onClick={stopAiResponse} aria-label="停止回答" className="feed-chat-control relative flex h-[45px] w-[45px] shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-[var(--market-support)]"><Square size={14} aria-hidden="true"/></button>:<button type="submit" disabled={!canSend || disabled} aria-label="发送" className="feed-chat-control ai-assistant-composer-send relative flex h-[45px] w-[45px] shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)]"><Send size={16} weight="bold" aria-hidden="true" /></button>}
          </LiquidGlass>
        </div>
        </div>
      </form>
      {chatOpen && !chatCardOpen && <button type="button" onClick={onBrowse} className="mb-0.5 flex h-11 shrink-0 items-center justify-center rounded-full bg-[var(--market-ink)] px-3 text-xs font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)]">逛一逛</button>}
    </div>
  </div>
}

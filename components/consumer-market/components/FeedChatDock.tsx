'use client'

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { LiquidGlass } from '@/components/ui/liquid-glass'
import { useOmnilink } from '../context/OmnilinkContext'
import { Microphone as Mic, PaperPlaneRight as Send, CaretDown as ChevronDown } from '@phosphor-icons/react'
import { Camera, FileText, Heart, Image as ImageIcon, LockKeyhole, LockKeyholeOpen, Paperclip, Sparkles, X } from 'lucide-react'
import { EVA_SKILLS, EVA_SKILLS_STORAGE_KEY, readInstalledSkillIds, type EvaSkillId } from './CapabilityLibrary'
import type { ConsumerAiModel } from '../types'

export const FEED_CHAT_SCROLL_KEY = 'omnilink-feed-chat-preview-scroll'
export type FeedAttachment = { name: string; kind: 'image' | 'document'; data: string }
type VoiceResult = { results: ArrayLike<ArrayLike<{ transcript: string }>> }
type VoiceRecognition = { lang: string; onresult: ((event: VoiceResult) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; start: () => void; stop: () => void }
type VoiceWindow = Window & { SpeechRecognition?: new () => VoiceRecognition; webkitSpeechRecognition?: new () => VoiceRecognition }
const PINNED_SKILLS_STORAGE_KEY = 'omnilink_pinned_skills_v1'

function readPinnedSkillIds(): EvaSkillId[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(PINNED_SKILLS_STORAGE_KEY) ?? '[]')
    return Array.isArray(saved) ? EVA_SKILLS.map((skill) => skill.id).filter((id) => saved.includes(id)) : []
  } catch { return [] }
}

export function FeedChatDock({
  chatOpen = false,
  disabled = false,
  onSubmitMessage,
  onSubmitAttachment,
  onBrowse,
  getFeedScrollTop,
  initialInstalledSkillIds,
  navigationOpen = false,
}: {
  chatOpen?: boolean
  disabled?: boolean
  onSubmitMessage?: (message: string, selectedProductIds: string[]) => void
  onSubmitAttachment?: (attachment: FeedAttachment, message: string, selectedProductIds: string[]) => void
  onBrowse?: () => void
  getFeedScrollTop?: () => number
  initialInstalledSkillIds?: EvaSkillId[]
  navigationOpen?: boolean
}) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [panel, setPanel] = useState<'skills' | 'attachments' | 'models' | 'favorites' | null>(null)
  const [composerFocused, setComposerFocused] = useState(false)
  const [composerHovered, setComposerHovered] = useState(false)
  const [installedSkillIds, setInstalledSkillIds] = useState<EvaSkillId[]>([])
  const [pinnedSkillIds, setPinnedSkillIds] = useState<EvaSkillId[]>([])
  const [activeSkillId, setActiveSkillId] = useState<EvaSkillId | null>(null)
  const [attachment, setAttachment] = useState<FeedAttachment | null>(null)
  const [selectedFavoriteIds, setSelectedFavoriteIds] = useState<string[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<VoiceRecognition | null>(null)
  const { openAiPage, aiModel, setAiModel, showToast, isAiThinking, products, savedProductIds } = useOmnilink()
  const canSend = Boolean(message.trim() || attachment || selectedFavoriteIds.length)
  const activeSkill = EVA_SKILLS.find((skill) => skill.id === activeSkillId)
  const availableSkills = EVA_SKILLS.filter((skill) => installedSkillIds.includes(skill.id))
  const pinnedSkills = availableSkills.filter((skill) => pinnedSkillIds.includes(skill.id))
  const favoriteProducts = products.filter((product) => savedProductIds.includes(product.id))
  const models: { id: ConsumerAiModel; label: string }[] = [
    { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
    { id: 'deepseek-flash', label: 'DeepSeek Flash' },
    { id: 'gemini', label: 'Gemini' },
    { id: 'qwen-plus', label: 'Qwen Plus' },
  ]
  const currentModel = models.find((model) => model.id === aiModel)?.label ?? 'DeepSeek V4 Pro'
  const glassSolid = composerFocused || composerHovered || panel !== null

  useEffect(() => () => recognitionRef.current?.stop(), [])
  useEffect(() => { queueMicrotask(() => setPinnedSkillIds(readPinnedSkillIds())) }, [])
  useEffect(() => {
    const skillIds = initialInstalledSkillIds ?? readInstalledSkillIds()
    setInstalledSkillIds(skillIds)
    if (initialInstalledSkillIds) localStorage.setItem(EVA_SKILLS_STORAGE_KEY, JSON.stringify(skillIds))
  }, [initialInstalledSkillIds])

  function togglePinnedSkill(id: EvaSkillId) {
    const next = pinnedSkillIds.includes(id) ? pinnedSkillIds.filter((item) => item !== id) : [...pinnedSkillIds, id]
    setPinnedSkillIds(next)
    localStorage.setItem(PINNED_SKILLS_STORAGE_KEY, JSON.stringify(next))
  }

  function activateSkill(id: EvaSkillId) {
    if (id === 'shopping-preferences') { router.push('/discover?shoppingPreferences=1'); return }
    setActiveSkillId(id)
    setMessage((current) => current.endsWith('@') ? current.slice(0, -1) : current)
    setPanel(null)
  }

  function openAssistant(prompt?: string) {
    sessionStorage.setItem(FEED_CHAT_SCROLL_KEY, String(getFeedScrollTop?.() ?? window.scrollY))
    openAiPage(prompt)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSend || isAiThinking || disabled) return
    const typedMessage = message.trim() || (attachment ? '' : '请分析我选中的收藏商品，并说明搭配建议。')
    const prompt = activeSkill ? `${activeSkill.prompt}${typedMessage ? `\n${typedMessage}` : ''}` : typedMessage
    if (attachment && onSubmitAttachment) onSubmitAttachment(attachment, prompt, selectedFavoriteIds)
    else if (onSubmitMessage) onSubmitMessage(prompt, selectedFavoriteIds)
    else openAssistant(prompt)
    setMessage('')
    setAttachment(null)
    setSelectedFavoriteIds([])
    setActiveSkillId(null)
    setPanel(null)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
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
    const kind = file.type.startsWith('image/') ? 'image' : 'document'
    if (file.size > (kind === 'image' ? 3 : 2) * 1024 * 1024) { showToast(kind === 'image' ? '图片不能超过 3 MB。' : '文件不能超过 2 MB。'); return }
    const reader = new FileReader()
    reader.onload = () => { if (typeof reader.result === 'string') setAttachment({ name: file.name, kind, data: reader.result }) }
    reader.onerror = () => showToast('文件读取失败。')
    reader.readAsDataURL(file)
  }

  function toggleVoice() {
    if (isRecording) { recognitionRef.current?.stop(); return }
    const Voice = (window as VoiceWindow).SpeechRecognition || (window as VoiceWindow).webkitSpeechRecognition
    if (!Voice) { showToast('当前浏览器不支持语音输入。'); return }
    const recognition = new Voice()
    recognition.lang = 'zh-CN'
    recognition.onresult = (event) => setMessage((current) => `${current}${event.results[0]?.[0]?.transcript ?? ''}`)
    recognition.onend = () => { setIsRecording(false); recognitionRef.current = null }
    recognition.onerror = () => { setIsRecording(false); recognitionRef.current = null; showToast('语音输入未完成。') }
    try { recognition.start(); recognitionRef.current = recognition; setIsRecording(true) } catch { showToast('无法启动语音输入。') }
  }

  const pickerOpen = panel === 'skills' || panel === 'attachments' || panel === 'favorites'
  const skillPanelOpen = panel === 'skills'
  const attachmentPanelOpen = panel === 'attachments' || panel === 'favorites'

  return <div data-navigation-open={navigationOpen} className="feed-chat-dock-shell pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-4">
    <div className="feed-chat-dock pointer-events-auto relative mx-auto flex w-full max-w-3xl items-end gap-2">
      <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md,.csv,.json" onChange={handleFile} aria-label="添加文件" className="hidden" />
      <input ref={imageInputRef} type="file" accept="image/*" onChange={handleFile} aria-label="添加图片" className="hidden" />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFile} aria-label="拍摄图片" className="hidden" />
      <button type="button" disabled={disabled || isAiThinking} onClick={() => { if (skillPanelOpen) setPanel(null); else { setInstalledSkillIds(readInstalledSkillIds()); setPanel('skills') } }} aria-label={skillPanelOpen ? '关闭技能' : '选择技能'} aria-expanded={skillPanelOpen} aria-controls="feed-chat-picker-panel" className="feed-chat-skill-trigger mb-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-full text-[var(--market-ink)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)] disabled:opacity-40">{skillPanelOpen ? <X size={18} aria-hidden="true" /> : <Sparkles size={18} aria-hidden="true" />}</button>
      <form onSubmit={submit} onFocusCapture={() => setComposerFocused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setComposerFocused(false) }} className="relative min-w-0 flex-1" aria-label="询问个人助手">
        {pickerOpen && <section id="feed-chat-picker-panel" role="group" aria-label={panel === 'skills' ? '选择技能' : panel === 'favorites' ? '选择收藏' : '添加附件'} className="feed-chat-picker-card absolute bottom-[calc(100%+10px)] left-0 right-0 z-30 max-h-[min(55dvh,420px)] overflow-y-auto p-2.5" data-navigation-open={navigationOpen}>
          {skillPanelOpen ? <>
            <h2 className="px-2 pb-1.5 text-xs font-medium text-[var(--market-text-secondary)]">选择技能</h2>
            {availableSkills.length ? availableSkills.map((skill) => {
              const pinned = pinnedSkillIds.includes(skill.id)
              return <div key={skill.id} className="feed-chat-picker-row flex min-h-12 items-center rounded-full">
                <button type="button" onClick={() => activateSkill(skill.id)} className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-full px-3 text-left text-xs focus-visible:outline-2 focus-visible:outline-[var(--market-support)]"><skill.icon size={18} aria-hidden="true" /><span className="truncate">{skill.title}</span></button>
                <button type="button" onClick={() => togglePinnedSkill(skill.id)} aria-label={`${pinned ? '取消固定' : '固定'}${skill.title}`} aria-pressed={pinned} className="feed-chat-picker-lock mr-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--market-text-secondary)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]">{pinned ? <LockKeyhole size={17} aria-hidden="true" /> : <LockKeyholeOpen size={17} aria-hidden="true" />}</button>
              </div>
            }) : <p className="px-3 py-3 text-xs text-[var(--market-text-muted)]">暂无已安装技能</p>}
          </> : panel === 'favorites' ? <>
            <h2 className="px-2 pb-1.5 text-xs font-medium text-[var(--market-text-secondary)]">收藏</h2>
            {favoriteProducts.length ? favoriteProducts.map((product) => <label key={product.id} className="feed-chat-picker-row flex min-h-12 items-center gap-3 rounded-full px-3 text-xs"><input type="checkbox" checked={selectedFavoriteIds.includes(product.id)} onChange={() => setSelectedFavoriteIds((current) => current.includes(product.id) ? current.filter((id) => id !== product.id) : [...current, product.id])} /><span className="truncate">{product.name}</span></label>) : <p className="px-3 py-3 text-xs text-[var(--market-text-muted)]">暂无收藏</p>}
            <button type="button" onClick={() => setPanel(null)} className="mt-1 min-h-10 w-full rounded-full text-xs hover:bg-[var(--market-hover)]">完成</button>
          </> : <>
            <h2 className="px-2 pb-1.5 text-xs font-medium text-[var(--market-text-secondary)]">添加附件</h2>
            <div className="grid grid-cols-2 gap-1">
              <button type="button" onClick={() => { setPanel(null); fileInputRef.current?.click() }} className="flex min-h-11 items-center gap-2 rounded-full px-3 text-xs hover:bg-[var(--market-hover)]"><FileText size={17} aria-hidden="true" />文件</button>
              <button type="button" onClick={() => { setPanel(null); imageInputRef.current?.click() }} className="flex min-h-11 items-center gap-2 rounded-full px-3 text-xs hover:bg-[var(--market-hover)]"><ImageIcon size={17} aria-hidden="true" />图片</button>
              <button type="button" onClick={() => { setPanel(null); cameraInputRef.current?.click() }} className="flex min-h-11 items-center gap-2 rounded-full px-3 text-xs hover:bg-[var(--market-hover)]"><Camera size={17} aria-hidden="true" />拍摄</button>
              <button type="button" onClick={() => setPanel('favorites')} className="flex min-h-11 items-center gap-2 rounded-full px-3 text-xs hover:bg-[var(--market-hover)]"><Heart size={17} aria-hidden="true" />收藏</button>
            </div>
          </>}
        </section>}
        {pinnedSkills.length > 0 && <div className="relative mb-2 min-h-11">
          <div className="flex min-h-11 items-center gap-2 overflow-x-auto">
            {pinnedSkills.map((skill) => <button key={skill.id} type="button" disabled={disabled} onClick={() => activateSkill(skill.id)} aria-pressed={activeSkillId === skill.id} className="flex h-11 shrink-0 items-center gap-1.5 rounded-full border-[0.5px] border-[var(--market-border)] bg-[var(--market-glass-surface)] px-3 text-xs focus-visible:outline-2 focus-visible:outline-[var(--market-support)] disabled:opacity-40"><skill.icon size={15} aria-hidden="true" />{skill.title}</button>)}
          </div>
        </div>}
        {panel === 'models' && <div role="group" aria-label="选择模型" className="feed-chat-secondary-panel absolute bottom-[calc(100%+10px)] right-0 z-20 max-h-[55dvh] w-60 max-w-full overflow-y-auto rounded-[24px] border-[0.5px] border-[var(--market-border)] p-2 text-[var(--market-ink)]">
          {panel === 'models' && models.map((model) => <button key={model.id} type="button" onClick={() => { setAiModel(model.id); setPanel(null) }} aria-pressed={aiModel === model.id} className="flex min-h-11 w-full items-center justify-between rounded-[14px] px-3 text-left text-xs hover:bg-[var(--market-hover)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)]">{model.label}{aiModel === model.id && <span aria-hidden="true">✓</span>}</button>)}
        </div>}
        <div className="relative">
          <LiquidGlass radius={999} bevelDepth={8} scale={12} aberration={0.25} frost={0.3} tint={glassSolid ? 1 : 0.84} style={glassSolid ? { backgroundColor: 'var(--market-surface)' } : undefined} onPointerEnter={() => setComposerHovered(true)} onPointerLeave={() => setComposerHovered(false)} interactive className="eva-composer-surface flex min-h-12 items-center rounded-full border-[0.5px] px-1.5 py-1 text-[var(--market-ink)]">
          <button type="button" disabled={disabled || isAiThinking} onClick={() => setPanel((current) => current === 'attachments' ? null : 'attachments')} aria-label={attachmentPanelOpen ? '关闭附件菜单' : '添加附件'} aria-expanded={attachmentPanelOpen} aria-controls="feed-chat-picker-panel" className="feed-chat-attachment-trigger flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-[var(--market-support)] disabled:opacity-40">{attachmentPanelOpen ? <X size={18} aria-hidden="true" /> : <Paperclip size={18} aria-hidden="true" />}</button>
          <div className="flex min-h-11 min-w-0 flex-1 flex-col justify-center">{(activeSkill || attachment || selectedFavoriteIds.length > 0) && <div className="flex gap-1">{activeSkill && <button type="button" onClick={() => setActiveSkillId(null)} className="max-w-24 truncate rounded-full bg-[var(--market-surface-muted)] px-2 py-0.5 text-xs">@{activeSkill.title} ×</button>}{attachment && <button type="button" onClick={() => setAttachment(null)} className="max-w-24 truncate rounded-full bg-[var(--market-surface-muted)] px-2 py-0.5 text-xs">{attachment.name} ×</button>}{selectedFavoriteIds.length > 0 && <button type="button" onClick={() => setPanel('favorites')} className="rounded-full bg-[var(--market-surface-muted)] px-2 py-0.5 text-xs">收藏 {selectedFavoriteIds.length}</button>}</div>}<textarea value={message} disabled={disabled} onChange={(event) => { setMessage(event.target.value); if (event.target.value.endsWith('@')) { setInstalledSkillIds(readInstalledSkillIds()); setPanel('skills') } }} onKeyDown={handleKeyDown} rows={1} aria-label="发消息" className="eva-composer-input block min-w-0 bg-transparent px-1 text-xs text-[var(--market-ink)] outline-none" /></div>
          <button type="button" disabled={disabled || isAiThinking} onClick={() => setPanel((current) => current === 'models' ? null : 'models')} aria-label={`选择模型，当前为 ${currentModel}`} aria-expanded={panel === 'models'} className="flex h-11 shrink-0 items-center gap-1 rounded-full px-1.5 text-[11.5px] font-medium text-[var(--market-text-secondary)] focus-visible:outline-2 focus-visible:outline-[var(--market-support)] disabled:opacity-40"><span className="hidden sm:inline">{currentModel}</span><span className="sm:hidden">{aiModel === 'deepseek-v4-pro' ? 'V4 Pro' : aiModel === 'deepseek-flash' ? 'Flash' : aiModel === 'qwen-plus' ? 'Qwen' : 'Gemini'}</span><ChevronDown size={10} aria-hidden="true" /></button>
          <button type="button" disabled={disabled || isAiThinking} onClick={toggleVoice} aria-label={isRecording ? '停止语音输入' : '语音输入'} aria-pressed={isRecording} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-[var(--market-support)] disabled:opacity-40"><Mic size={15} aria-hidden="true" /></button>
          <button type="submit" disabled={!canSend || isAiThinking || disabled} aria-label="发送" className="eva-composer-send flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)]"><Send size={16} weight="bold" aria-hidden="true" /></button>
          </LiquidGlass>
        </div>
      </form>
      {chatOpen && <button type="button" onClick={onBrowse} className="mb-0.5 flex h-11 shrink-0 items-center justify-center rounded-full bg-[var(--market-ink)] px-3 text-xs font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)]">逛一逛</button>}
    </div>
  </div>
}

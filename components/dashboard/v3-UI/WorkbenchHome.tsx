'use client'

import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowUp, Circle, History, Package, Search, X, Database as DatabaseIcon, Check, Maximize2, Minimize2, Image as ImageIcon, Plus, Sparkles, Paperclip, AtSign, ChevronDown, Mic } from 'lucide-react'
import type { Database as DatabaseSchema } from '@/lib/database.types'
import type { KnowledgeEntryRecord } from '@/lib/knowledge/model'
import { useDashboardWorkspace } from '@/components/dashboard/DashboardWorkspaceProvider'
import { ProductCreateDialog } from '@/components/product/ProductCreateDialog'
import { UiverseButton } from '@/components/ui/UiverseButton'
import { ContentGenerationStudio } from './ContentGenerationStudio'

type BrandProject = DatabaseSchema['public']['Tables']['brand_projects']['Row']
type Task = { id: string; title: string; description: string; content: string; time: string; href: string; archived?: boolean; thumbnail?: string; messages?: ChatMessage[] }
type WorkMode = 'product' | 'library'
type UploadIntent = 'new-product' | null
type WorkspaceSkill = { id: string; name: string; description: string; icon: string; category: string; version: string }
type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string; pending?: boolean; failed?: boolean; model?: string; images?: string[] }
type VoiceRecognition = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null }
type VoiceWindow = Window & { SpeechRecognition?: new () => VoiceRecognition; webkitSpeechRecognition?: new () => VoiceRecognition }

const skillDisplayNames: Record<string, string> = {
  'merchant-profile': '商家洞察',
  'brand-proposal': '品牌策略',
  'store-copy': '内容撰写',
  'multi-channel-product-content': '商品内容创作',
}

const socialChannels = ['抖音', '小红书', '商品详情页']

const initialTasks: Task[] = [
  { id: 'task-brand', title: '资料归档', description: '整理品牌资料与商品文档', content: '品牌资料与知识库', time: '2 小时前', href: '/dashboard/knowledge' },
  { id: 'task-product', title: '商品整理', description: '补充商品信息与销售字段', content: '商品信息与资料连接', time: '3 小时前', href: '/dashboard/products' },
  { id: 'task-visualisation', title: '字段校验', description: '检查商品资料是否完整', content: '商品字段完整度', time: '昨天', href: '/dashboard/products' },
]

const workModes = [
  { id: 'product' as const, icon: Package, title: '商品管理', description: '创建、编辑和关联商品', placeholder: '描述要创建或修改的商品信息……', href: '/dashboard/products' },
  { id: 'library' as const, icon: DatabaseIcon, title: '上传资料库', description: '上传资料并自动归类', placeholder: '上传资料，或说明它应该归入哪个商品和资料库……', href: '/dashboard/knowledge' },
]

function createHistoryThumbnail(source: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    const image = new window.Image()
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 160
        canvas.height = 160
        const context = canvas.getContext('2d')
        if (!context) return resolve(undefined)
        const side = Math.min(image.naturalWidth, image.naturalHeight)
        context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 160, 160)
        resolve(canvas.toDataURL('image/jpeg', 0.72))
      } catch {
        resolve(undefined)
      }
    }
    image.onerror = () => resolve(undefined)
    image.src = source
  })
}

export function WorkbenchHome({ displayName, merchantProject }: { displayName: string; merchantProject: BrandProject }) {
  const [prompt, setPrompt] = useState('')
  const [query, setQuery] = useState('')
  const [tasks, setTasks] = useState(initialTasks)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [workspaceMode, setWorkspaceMode] = useState<'conversation' | 'fullscreen'>('conversation')
  const [historyReady, setHistoryReady] = useState(false)
  const [contentStudioOpen, setContentStudioOpen] = useState(false)
  const workMode: WorkMode = 'product'
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const [uploadIntent, setUploadIntent] = useState<UploadIntent>(null)
  const [productDialogOpen, setProductDialogOpen] = useState(false)
  const [dropActive, setDropActive] = useState(false)
  const [model, setModel] = useState<'gemini' | 'qwen-plus' | 'deepseek-flash' | 'deepseek-v4-pro'>('gemini')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [lastSubmittedPrompt, setLastSubmittedPrompt] = useState('')
  const [voiceListening, setVoiceListening] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [skills, setSkills] = useState<WorkspaceSkill[]>([])
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null)
  const [skillsStatus, setSkillsStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const [addOpen, setAddOpen] = useState(false)
  const [selectedKnowledgeIds, setSelectedKnowledgeIds] = useState<string[]>([])
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionLoading, setMentionLoading] = useState(false)
  const [mentionLevel, setMentionLevel] = useState<'skills' | 'channels'>('skills')
  const [selectedChannels, setSelectedChannels] = useState<string[]>([])
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionIndex, setMentionIndex] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mentionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const voiceRef = useRef<VoiceRecognition | null>(null)
  const { selectedProduct, selectedProducts, products, knowledgeEntries, setSelectedProducts, addArtifact } = useDashboardWorkspace()
  const merchantName = merchantProject.name || displayName || 'Omnilink'
  const greetingName = merchantName.includes('演示') ? '演示商家' : merchantName
  const visibleTasks = useMemo(
    () => tasks.filter((task) => `${task.title}${task.description}`.toLowerCase().includes(query.toLowerCase())),
    [query, tasks],
  )
  const selectedSkill = skills.find((skill) => skill.id === selectedSkillId) || null
  const mentionOptions = useMemo(
    () => skills
      .map((skill) => ({ id: `skill-${skill.id}`, kind: 'skill' as const, label: skill.name, meta: skill.description, skill }))
      .filter((item) => `${item.label}${item.meta}`.toLowerCase().includes(mentionQuery.toLowerCase())),
    [mentionQuery, skills],
  )

  const loadSkills = useCallback(async () => {
    setSkillsStatus('loading')
    try {
      const response = await fetch('/api/workspace/skills', { credentials: 'include' })
      const payload = await response.json() as { skills?: WorkspaceSkill[] }
      if (!response.ok) throw new Error('技能不可用')
      setSkills((payload.skills || []).map((skill) => ({ ...skill, name: skillDisplayNames[skill.id] || skill.name })))
      setSkillsStatus('ready')
    } catch {
      setSkillsStatus('unavailable')
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSkills(), 0)
    return () => window.clearTimeout(timer)
  }, [loadSkills])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem('omnilink-workbench-history')
        if (saved) setTasks(JSON.parse(saved) as Task[])
      } catch {
        // Ignore malformed local history and keep the starter tasks.
      } finally {
        setHistoryReady(true)
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (historyReady) window.localStorage.setItem('omnilink-workbench-history', JSON.stringify(tasks))
  }, [historyReady, tasks])

  useEffect(() => () => {
    if (mentionTimerRef.current) clearTimeout(mentionTimerRef.current)
  }, [])

  function attachImage(file: File | undefined) {
    if (!file || !file.type.startsWith('image/')) return
    setAttachedFile(file)
    setUploadIntent('new-product')
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDropActive(false)
    attachImage(event.dataTransfer.files[0])
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const value = prompt.trim()
    if (!value || isGenerating) return
    setGenerationError(null)
    setVoiceError(null)
    setLastSubmittedPrompt(value)
    setIsGenerating(true)
    const messageId = `message-${Date.now()}`
    const responseId = `${messageId}-response`
    setMessages((current) => [
      ...current,
      { id: messageId, role: 'user', content: value },
      { id: responseId, role: 'assistant', content: '正在生成…', pending: true, model },
    ])
    setPrompt('')
    try {
      const response = await fetch('/api/knowledge/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          prompt: value,
          model,
          skillId: selectedSkillId,
          context: [
            ...knowledgeEntries.filter((entry) => !selectedKnowledgeIds.length || selectedKnowledgeIds.includes(entry.id)).map((entry) => ({ title: entry.key, summary: entry.value })),
            ...(selectedChannels.length ? [{ title: '目标渠道', summary: selectedChannels.join('、') }] : []),
            ...(products.length ? [{
              title: '可自动识别的商品目录',
              summary: products.slice(0, 100).map((product) => `${product.name}${product.sku ? `（SKU：${product.sku}）` : ''}`).join('、'),
            }] : []),
          ],
        }),
      })
      const payload = await response.json() as { content?: string; error?: string; images?: string[] }
      if (!response.ok || !payload.content) throw new Error(payload.error || '模型没有返回内容。')
      const content = payload.content
      const images = Array.isArray(payload.images) ? payload.images.filter((image): image is string => typeof image === 'string' && image.length > 0).slice(0, 6) : []
      setMessages((current) => current.map((message) => message.id === responseId ? { ...message, content, images, pending: false } : message))
      const historyImage = images.length ? await createHistoryThumbnail(images[images.length - 1]) : undefined
      const taskId = `task-${Date.now()}`
      const mode = workModes.find((item) => item.id === workMode) || workModes[0]
      setTasks((current) => [{ id: taskId, title: value, description: selectedSkill ? `${selectedSkill.name} · ${mode.title}` : (selectedProduct ? `${mode.title} · ${selectedProduct.name}` : mode.title), content, time: '刚刚', href: mode.href, thumbnail: historyImage, messages: [{ id: messageId, role: 'user', content: value }, { id: responseId, role: 'assistant', content, model, images: historyImage ? [historyImage] : [] }] }, ...current])
      addArtifact({ id: taskId, title: value, content, productId: selectedProduct?.id, productName: selectedProduct?.name, createdAt: '刚刚' })
    } catch (error) {
      const message = error instanceof Error ? `${error.message} 请检查网络或重试。` : '模型请求失败。请检查网络或重试。'
      setGenerationError(message)
      setMessages((current) => current.map((item) => item.id === responseId ? { ...item, content: message, pending: false, failed: true } : item))
    } finally {
      setIsGenerating(false)
    }
  }

  function startVoiceInput() {
    if (voiceListening) {
      voiceRef.current?.stop()
      return
    }
    const speechWindow = window as VoiceWindow
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition
    if (!Recognition) {
      setVoiceError('当前浏览器不支持语音输入，请直接键入。')
      return
    }
    setVoiceError(null)
    const recognition = new Recognition()
    recognition.lang = 'zh-CN'
    recognition.interimResults = false
    recognition.continuous = false
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0]?.transcript || '').join('')
      if (transcript) setPrompt((current) => `${current}${current && !current.endsWith(' ') ? ' ' : ''}${transcript}`)
    }
    recognition.onerror = () => {
      setVoiceListening(false)
      setVoiceError('语音输入未完成，请检查麦克风权限后重试。')
    }
    recognition.onend = () => {
      setVoiceListening(false)
      voiceRef.current = null
    }
    voiceRef.current = recognition
    setVoiceListening(true)
    recognition.start()
  }

  function handlePromptChange(value: string) {
    setPrompt(value)
    const match = value.match(/(?:^|\s)@([^\s@]*)$/)
    if (!match) {
      setMentionOpen(false)
      setMentionLoading(false)
      if (mentionTimerRef.current) clearTimeout(mentionTimerRef.current)
      return
    }
    setMentionQuery(match[1])
    setMentionIndex(0)
    setMentionLevel('skills')
    setMentionLoading(true)
    setMentionOpen(true)
    if (mentionTimerRef.current) clearTimeout(mentionTimerRef.current)
    mentionTimerRef.current = setTimeout(() => setMentionLoading(false), 260)
  }

  function handlePromptKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!mentionOpen) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setMentionIndex((current) => mentionOptions.length ? (current + 1) % mentionOptions.length : 0)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setMentionIndex((current) => mentionOptions.length ? (current - 1 + mentionOptions.length) % mentionOptions.length : 0)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setMentionOpen(false)
      setMentionLoading(false)
      setMentionLevel('skills')
    } else if (event.key === 'Enter' && mentionOptions[mentionIndex]) {
      event.preventDefault()
      selectMention(mentionOptions[mentionIndex])
    }
  }

  function selectMention(option: (typeof mentionOptions)[number]) {
    const nextPrompt = prompt.replace(/(?:^|\s)@([^\s@]*)$/, (match) => match.slice(0, match.indexOf('@')).trimEnd())
    setPrompt(nextPrompt)
    setMentionOpen(false)
    setMentionLoading(false)
    setSelectedSkillId(option.skill.id)
    if (option.skill.id === 'multi-channel-product-content') {
      setSelectedChannels([])
      setMentionLevel('channels')
      setMentionOpen(true)
    }
  }

  function toggleChannel(channel: string) {
    setSelectedChannels((current) => current.includes(channel) ? current.filter((item) => item !== channel) : [...current, channel])
  }

  function toggleAllChannels() {
    setSelectedChannels((current) => current.length === socialChannels.length ? [] : socialChannels)
  }

  function removeSelectedSkill() {
    setSelectedSkillId(null)
    setSelectedChannels([])
    setMentionLevel('skills')
  }

  function openHistoryTask(task: Task) {
    if (!task.messages?.length) return
    setMessages(task.messages)
    setPrompt('')
    setGenerationError(null)
    setHistoryOpen(false)
  }

  function startNewConversation() {
    setMessages([])
    setPrompt('')
    setQuery('')
    setGenerationError(null)
    setVoiceError(null)
  }

  async function recordGeneratedImage(name: string, source: string) {
    const thumbnail = await createHistoryThumbnail(source)
    const taskId = `task-image-${Date.now()}`
    const title = name.trim() ? `${name.trim()} · 图片生成` : '图片生成'
    setTasks((current) => [{ id: taskId, title, description: '商品内容创作', content: '已生成商品图片。', time: '刚刚', href: '/dashboard', thumbnail, messages: [{ id: `${taskId}-assistant`, role: 'assistant', content: '已生成商品图片。', images: thumbnail ? [thumbnail] : [] }] }, ...current])
  }

  return (
    <>
    <div className={`workbench-ambient flex min-h-0 text-[var(--text-primary)] ${messages.length ? 'has-conversation' : ''} ${isGenerating ? 'is-generating' : ''}`}>
      <section className="main-workspace relative flex min-w-0 flex-1 flex-col overflow-y-auto">
        <div className="relative z-10 mx-auto flex w-full max-w-[960px] flex-1 flex-col items-center px-5 py-5 sm:px-8 sm:py-7">
          {messages.length ? <div className="mt-12 w-full max-w-[760px] space-y-5 pb-8"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Conversation</p>{messages.map((message) => <article key={message.id} className={message.role === 'user' ? 'ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-[var(--text-primary)] px-4 py-3 text-sm leading-6 text-[var(--surface)]' : `max-w-[92%] rounded-2xl rounded-bl-md border px-4 py-3 text-sm leading-6 ${message.failed ? 'border-red-300 bg-red-50 text-red-800' : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-primary)]'}`}><div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] opacity-60">{message.role === 'user' ? '你' : `AI · ${message.model === 'qwen-plus' ? '千问 Plus' : message.model === 'deepseek-flash' ? 'DeepSeek Flash' : message.model === 'deepseek-v4-pro' ? 'DeepSeek Pro' : 'Gemini'}`}</div><p className={message.pending ? 'animate-pulse text-[var(--text-secondary)]' : 'whitespace-pre-wrap'}>{message.content}</p>{message.images?.length ? <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{message.images.map((image, imageIndex) => <img key={`${message.id}-image-${imageIndex}`} src={image} alt={`生成图片 ${imageIndex + 1}`} className="aspect-square w-full rounded-[10px] object-cover" />)}</div> : null}</article>)}</div> : <div className="workbench-welcome mt-[clamp(4rem,9vh,6.5rem)] max-w-[720px] text-center"><AIAssistantOrb isThinking={isGenerating} hasMessages={messages.length > 0} /><h1 className="workbench-greeting">Hello，{greetingName}</h1></div>}

          <form onSubmit={submit} className={`relative mt-auto w-full max-w-[820px] pb-9 ${messages.length ? 'pt-10' : 'pt-8'}`}>
              <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={(event) => attachImage(event.target.files?.[0])} />
              <div onDragOver={(event) => { event.preventDefault(); setDropActive(true) }} onDragLeave={() => setDropActive(false)} onDrop={handleDrop} className={`prompt-composer relative min-h-[124px] rounded-[24px] px-5 pt-3 pb-3 ${dropActive ? 'is-drop-active' : ''}`}>
                <label htmlFor="workbench-command" className="sr-only">输入任务</label>
                {attachedFile && (
                  <div className="mb-2 flex items-center gap-2 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface)]/80 p-2">
                    <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-[7px] bg-[var(--surface-muted)]"><img src={URL.createObjectURL(attachedFile)} alt="已添加的图片" className="h-full w-full object-cover" /></div>
                    <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-[var(--text-primary)]">{attachedFile.name}</span>
                    <span className="rounded-full bg-[var(--surface-muted)] px-2 py-1 text-[10px] text-[var(--text-secondary)]" title="当前工作模式">商品</span>
                    <button type="button" onClick={() => { setAttachedFile(null); setUploadIntent(null) }} className="grid h-7 w-7 place-items-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--text-primary)] focus-visible:outline-offset-2" aria-label="移除图片" title="移除"><X className="h-3.5 w-3.5" /></button>
                  </div>
                )}
                <div className="relative">
                  {selectedSkill && <div className="selected-skill-pill group" title={selectedChannels.length ? `已选择：${selectedChannels.join('、')}` : selectedSkill.description}><Sparkles className="h-3 w-3 shrink-0" aria-hidden="true" /><span className="truncate">{selectedSkill.name}</span>{selectedSkill.id === 'multi-channel-product-content' && <button type="button" onClick={() => setContentStudioOpen(true)} className="ml-1 shrink-0 rounded-full bg-[var(--surface-muted)] px-2 py-1 text-[10px] font-semibold text-[var(--text-primary)] hover:bg-[var(--border-subtle)]">打开创作工作台</button>}<button type="button" onClick={removeSelectedSkill} aria-label={`移除 Skill：${selectedSkill.name}`} className="selected-skill-pill__remove"><X className="h-3 w-3" aria-hidden="true" /></button></div>}
                  <div className="flex items-center gap-1">
                    <textarea ref={promptRef} id="workbench-command" rows={2} value={prompt} onChange={(event) => handlePromptChange(event.target.value)} onKeyDown={handlePromptKeyDown} placeholder="告诉我你想完成什么，AI 会自动识别商家、商品、风格与资料类型……" className="min-h-[52px] min-w-0 flex-1 resize-none bg-transparent px-1 py-1 text-base leading-7 outline-none placeholder:text-[var(--text-secondary)] sm:text-[15px]" />
                    <button type="button" onClick={() => setWorkspaceMode('fullscreen')} aria-label="进入全屏创作模式" className="workbench-expand grid h-10 w-10 shrink-0 place-items-center rounded-full text-[var(--text-secondary)]"><Maximize2 className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={startVoiceInput} aria-label={voiceListening ? '停止语音输入' : '开始语音输入'} aria-pressed={voiceListening} title={voiceListening ? '停止语音输入' : '开始语音输入'} className={`workbench-voice grid h-10 w-10 shrink-0 self-end place-items-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--text-primary)] focus-visible:outline-offset-2 ${voiceListening ? 'bg-[var(--surface-muted)] text-[var(--text-primary)]' : ''}`}><Mic className="h-3.5 w-3.5" /></button>
                  </div>
                  {mentionOpen && <div className="mention-menu absolute bottom-[calc(100%+12px)] left-0 right-0 z-30 w-auto overflow-hidden rounded-[16px] border border-[var(--border)] bg-[var(--surface)]/95 p-1.5 shadow-[0_18px_48px_rgba(0,0,0,0.14)] backdrop-blur-xl" role="listbox" aria-label={mentionLevel === 'skills' ? '选择 Skill' : '选择社媒渠道'}>
                    {mentionLevel === 'skills' ? <>
                      <div className="flex items-center justify-between gap-3 px-3 py-2 text-[10px] font-semibold tracking-[0.12em] text-[var(--text-muted)]"><span className="flex items-center gap-2"><AtSign className="h-3.5 w-3.5" aria-hidden="true" />选择能力</span><span className="tracking-normal">{skills.length} 项</span></div>
                      {mentionLoading || skillsStatus === 'loading' ? <div className="mention-loading" aria-label="正在搜索 Skill"><span className="mention-loading__line w-2/5" /><span className="mention-loading__line w-4/5" /><span className="mention-loading__line w-3/5" /></div> : skillsStatus === 'unavailable' ? <div className="px-3 py-4 text-xs text-[var(--text-secondary)]"><p>Skill 加载失败，请重试。</p><button type="button" onClick={() => void loadSkills()} className="mt-2 min-h-8 rounded-[10px] border border-[var(--border)] px-3 font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)]">重试</button></div> : mentionOptions.length ? mentionOptions.map((option, index) => <button key={option.id} type="button" role="option" aria-selected={index === mentionIndex} onMouseEnter={() => setMentionIndex(index)} onClick={() => selectMention(option)} className={`mention-option ${index === mentionIndex ? 'is-active' : ''}`}><span className="mention-option__icon"><Sparkles className="h-3.5 w-3.5" aria-hidden="true" /></span><span className="min-w-0 flex-1 text-left"><strong className="block truncate text-xs">{option.label}</strong><span className="mt-0.5 block truncate text-[10px] text-[var(--text-secondary)]">{option.meta}</span></span></button>) : <p className="px-3 py-4 text-xs text-[var(--text-secondary)]">没有匹配的 Skill。</p>}
                    </> : <>
                      <div className="flex items-center justify-between gap-3 px-2 py-2"><button type="button" onClick={() => setMentionLevel('skills')} className="mention-back"><ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />商品内容创作</button><button type="button" onClick={toggleAllChannels} className="mention-select-all">{selectedChannels.length === socialChannels.length ? '取消全选' : '全选'}</button></div>
                      <div className="grid gap-1" role="group" aria-label="选择发布渠道">{socialChannels.map((channel) => { const checked = selectedChannels.includes(channel); return <button key={channel} type="button" aria-pressed={checked} onClick={() => toggleChannel(channel)} className={`mention-option ${checked ? 'is-active' : ''}`}><span className="mention-option__icon"><Check className={`h-3.5 w-3.5 ${checked ? '' : 'opacity-0'}`} aria-hidden="true" /></span><span className="min-w-0 flex-1 text-left"><strong className="block truncate text-xs">{channel}</strong><span className="mt-0.5 block truncate text-[10px] text-[var(--text-secondary)]">用于生成对应渠道内容</span></span></button> })}</div>
                      <button type="button" onClick={() => setMentionOpen(false)} className="mention-confirm">完成{selectedChannels.length ? ` · 已选 ${selectedChannels.length}` : ''}</button>
                    </>}
                  </div>}
                </div>
                <div className="flex items-center justify-between pt-2">
                  <AddMenu open={addOpen} onOpenChange={setAddOpen} onPickFile={() => fileInputRef.current?.click()} products={products} selectedProducts={selectedProducts} knowledgeEntries={knowledgeEntries} selectedKnowledgeIds={selectedKnowledgeIds} onSelectProduct={(product) => { setSelectedProducts([product]); setAddOpen(false) }} onToggleKnowledge={(id) => setSelectedKnowledgeIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} onOpenFullscreen={() => setWorkspaceMode('fullscreen')} />
                  <div className="flex items-center gap-1.5">
                    <div className="relative inline-flex items-center"><label className="sr-only" htmlFor="workspace-model">选择模型</label><select id="workspace-model" value={model} onChange={(event) => setModel(event.target.value as typeof model)} className="workbench-model h-8 w-auto appearance-none px-3 pr-7 text-[10px] font-semibold text-[var(--text-primary)]"><optgroup label="Gemini"><option value="gemini">Gemini 3.8 Flash</option></optgroup><optgroup label="千问"><option value="qwen-plus">千问 Plus</option></optgroup><optgroup label="DeepSeek"><option value="deepseek-flash">DeepSeek V4.1 Flash</option><option value="deepseek-v4-pro">DeepSeek V4 Pro · 深度推理</option></optgroup></select><ChevronDown className="pointer-events-none absolute right-2 h-3 w-3 text-[var(--text-secondary)]" aria-hidden="true" /></div>
                    <button type="submit" disabled={!prompt.trim() || isGenerating} aria-label="发送给模型" className="group grid h-11 w-11 place-items-center rounded-full disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--text-primary)] focus-visible:outline-offset-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--text-primary)] text-[var(--surface)] transition-colors group-hover:bg-[var(--text-secondary)] group-disabled:bg-[var(--surface-subtle)] group-disabled:text-[var(--text-muted)]"><ArrowUp className="h-3 w-3" /></span></button>
                  </div>
                </div>
                {attachedFile && uploadIntent === 'new-product' && <button type="button" onClick={() => setProductDialogOpen(true)} className="mt-2 inline-flex min-h-8 items-center gap-1.5 rounded-full bg-[var(--text-primary)] px-3 text-[11px] font-semibold text-[var(--surface)] hover:bg-[var(--text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--text-primary)] focus-visible:outline-offset-2" title="打开新建商品表单"><Package className="h-3 w-3" aria-hidden="true" />新建商品</button>}
              </div>
              <div className="absolute inset-x-5 bottom-0 flex h-8 min-w-0 items-center overflow-hidden text-xs leading-5">
                {voiceError ? <p role="status" className="min-w-0 truncate text-[var(--text-secondary)]" title={voiceError}>{voiceError}</p> : generationError ? <div role="alert" className="flex w-full min-w-0 items-center justify-between gap-3 text-red-700"><p className="min-w-0 truncate" title={generationError}>{generationError}</p><button type="button" onClick={() => { setPrompt(lastSubmittedPrompt); setGenerationError(null); promptRef.current?.focus() }} className="h-8 shrink-0 rounded-[8px] border border-red-300 px-2 font-semibold text-red-800 hover:bg-red-50">重试</button></div> : null}
              </div>
          </form>
        </div>
      </section>

      <button type="button" onClick={() => setHistoryOpen(true)} className="fixed bottom-5 right-5 z-10 inline-flex min-h-10 items-center gap-2  border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--text-secondary)] shadow-sm hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--text-primary)] focus-visible:outline-offset-2 lg:hidden"><History className="h-3.5 w-3.5" aria-hidden="true" />历史记录</button>
      <HistoryPanel className="context-panel hidden w-[248px] bg-transparent xl:w-[30%] lg:flex" query={query} setQuery={setQuery} tasks={visibleTasks} onSelectTask={openHistoryTask} onNewConversation={startNewConversation} />
      {historyOpen && <div className="fixed inset-0 z-50 flex justify-end bg-[var(--ink)]/20 lg:hidden" role="dialog" aria-modal="true" aria-label="历史记录"><HistoryPanel className="flex w-[min(22rem,90vw)] bg-[var(--surface)] shadow-2xl" query={query} setQuery={setQuery} tasks={visibleTasks} onSelectTask={openHistoryTask} onNewConversation={startNewConversation} onClose={() => setHistoryOpen(false)} /></div>}
    </div>
    <ProductCreateDialog key={productDialogOpen ? 'open' : 'closed'} open={productDialogOpen} initialImages={attachedFile ? [attachedFile] : []} onOpenChange={(open) => { setProductDialogOpen(open); if (!open) { setAttachedFile(null); setUploadIntent(null) } }} />
    {workspaceMode === 'fullscreen' && <FullscreenWorkbench prompt={prompt} setPrompt={setPrompt} submit={submit} onClose={() => setWorkspaceMode('conversation')} selectedProduct={selectedProduct} />}
    {contentStudioOpen && <ContentGenerationStudio selectedProduct={selectedProduct} onClose={() => setContentStudioOpen(false)} onGenerated={(name, source) => void recordGeneratedImage(name, source)} />}
    </>
  )
}

function AddMenu({ open, onOpenChange, onPickFile, onOpenFullscreen, products, selectedProducts, knowledgeEntries, selectedKnowledgeIds, onSelectProduct, onToggleKnowledge }: { open: boolean; onOpenChange: (open: boolean) => void; onPickFile: () => void; onOpenFullscreen: () => void; products: Array<{ id: string; name: string; sku?: string | null }>; selectedProducts: Array<{ id: string; name: string; sku?: string | null }>; knowledgeEntries: KnowledgeEntryRecord[]; selectedKnowledgeIds: string[]; onSelectProduct: (product: { id: string; name: string; sku?: string | null }) => void; onToggleKnowledge: (id: string) => void }) {
  const [picker, setPicker] = useState<'products' | 'knowledge' | null>(null)

  return (
    <div className="relative">
      <button type="button" onClick={() => onOpenChange(!open)} aria-label="添加" aria-expanded={open} aria-controls="workbench-add-menu" className="grid h-10 w-10 place-items-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--text-primary)] focus-visible:outline-offset-2">
        <Plus className={`h-4 w-4 transition-transform ${open ? 'rotate-45' : ''}`} />
      </button>
      {open && <div id="workbench-add-menu" role="menu" aria-label="添加" className="add-menu absolute bottom-12 left-0 z-20 w-[min(23rem,calc(100vw-2rem))] overflow-hidden bg-[var(--surface)]/96 p-2 shadow-[0_20px_55px_rgba(56,43,31,0.16)] backdrop-blur-xl">
        {picker ? <>
          <div className="add-menu__picker-header"><button type="button" onClick={() => setPicker(null)} className="add-menu__back" aria-label="返回添加菜单">‹</button><span>{picker === 'products' ? '选择商品' : '选择知识库文件'}</span></div>
          {picker === 'products' ? <div className="add-menu__list">{products.length ? products.map((product) => { const selected = selectedProducts.some((item) => item.id === product.id); return <button key={product.id} type="button" role="menuitemradio" aria-checked={selected} onClick={() => onSelectProduct(product)} className="add-menu__choice"><span className={`add-menu__choice-mark ${selected ? 'is-selected' : ''}`}>{selected ? '✓' : ''}</span><span className="min-w-0 flex-1 truncate">{product.name}</span>{product.sku && <span className="add-menu__choice-meta">{product.sku}</span>}</button> }) : <p className="add-menu__empty">暂无商品，请先在商品资产库中创建。</p>}</div> : <div className="add-menu__list">{knowledgeEntries.length ? knowledgeEntries.map((entry) => { const selected = selectedKnowledgeIds.includes(entry.id); return <button key={entry.id} type="button" role="menuitemcheckbox" aria-checked={selected} onClick={() => onToggleKnowledge(entry.id)} className="add-menu__choice"><span className={`add-menu__choice-mark ${selected ? 'is-selected' : ''}`}>{selected ? '✓' : ''}</span><span className="min-w-0 flex-1 truncate">{entry.key}</span><span className="add-menu__choice-meta">资料</span></button> }) : <p className="add-menu__empty">暂无知识库文件，请先上传或整理资料。</p>}</div>}
        </> : <>
          <p className="add-menu__heading">添加</p>
          <button type="button" role="menuitem" onClick={() => { onPickFile(); onOpenChange(false) }} className="add-menu__item add-menu__item--active"><Paperclip className="h-5 w-5" aria-hidden="true" /><span className="add-menu__title">文件和图片</span><span className="add-menu__hint">AI 自动识别</span></button>
          <div className="add-menu__section">工作台</div>
          <button type="button" role="menuitem" onClick={() => setPicker('products')} className="add-menu__item"><Package className="h-5 w-5" aria-hidden="true" /><span className="add-menu__title">选择商品</span><span className="add-menu__hint">关联商品上下文</span></button>
          <button type="button" role="menuitem" onClick={() => setPicker('knowledge')} className="add-menu__item"><DatabaseIcon className="h-5 w-5" aria-hidden="true" /><span className="add-menu__title">选择知识库文件</span><span className="add-menu__hint">引用资料内容</span></button>
          <button type="button" role="menuitem" onClick={() => { onOpenFullscreen(); onOpenChange(false) }} className="add-menu__item"><Maximize2 className="h-5 w-5" aria-hidden="true" /><span className="add-menu__title">全屏工作台</span><span className="add-menu__hint">打开更大的创作空间</span></button>
          <div className="add-menu__section">自动识别</div>
          <div className="add-menu__note">商家、商品、风格与资料类型将由 AI 根据输入自动判断。</div>
        </>}
      </div>}
    </div>
  )
}

function AIAssistantOrb({ isThinking, hasMessages }: { isThinking: boolean; hasMessages: boolean }) {
  const [isBlinking, setIsBlinking] = useState(false)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIsBlinking(true)
      window.setTimeout(() => setIsBlinking(false), 160)
    }, 3600)
    return () => window.clearInterval(timer)
  }, [])

  const expression = isThinking ? 'thinking' : hasMessages ? 'happy' : 'idle'

  return (
    <div className={`ai-orb ai-orb--${expression} ${isBlinking ? 'is-blinking' : ''}`} role="img" aria-label={isThinking ? 'AI 正在思考' : 'AI 助手'}>
      <span className="ai-orb__highlight" aria-hidden="true" />
      <span className="ai-orb__face" aria-hidden="true">
        <span className="ai-orb__eye ai-orb__eye--left" />
        <span className="ai-orb__eye ai-orb__eye--right" />
      </span>
    </div>
  )
}

function FullscreenWorkbench({ prompt, setPrompt, submit, onClose, selectedProduct }: { prompt: string; setPrompt: (value: string) => void; submit: (event: FormEvent) => void; onClose: () => void; selectedProduct: { name: string } | null }) {
  return <div className="fixed inset-0 z-[80] flex bg-[var(--canvas)] text-[var(--text-primary)]" role="dialog" aria-modal="true" aria-label="全屏创作工作台">
    <section className="flex w-[38%] min-w-[320px] flex-col border-r border-[var(--border-subtle)] bg-[var(--surface)] p-6">
      <div className="flex items-center justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Conversation</p><h2 className="mt-1 text-lg font-semibold">创作对话</h2></div><button type="button" onClick={onClose} aria-label="退出全屏创作模式" className="grid h-9 w-9 place-items-center rounded-full hover:bg-[var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--text-primary)] focus-visible:outline-offset-2"><Minimize2 className="h-4 w-4" /></button></div>
      <div className="mt-6 flex-1 rounded-[14px] border border-[var(--border-subtle)] bg-[var(--canvas)] p-4"><p className="text-sm font-semibold">准备开始创作</p><p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">适合多张图片、实机渲染和图文并排编辑的任务。</p>{selectedProduct && <p className="mt-4 rounded-[8px] bg-[var(--surface)] px-3 py-2 text-xs">当前商品：{selectedProduct.name}</p>}</div>
      <form onSubmit={submit} className="mt-4"><textarea rows={4} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="描述要生成的画面、文案或修改方式……" className="w-full resize-none rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-3 text-sm leading-6 outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--text-primary)]" /><UiverseButton type="submit" disabled={!prompt.trim()} className="mt-2 h-11 w-full text-sm"><ArrowUp className="h-4 w-4" />生成</UiverseButton></form>
    </section>
    <section className="flex min-w-0 flex-1 flex-col bg-[var(--canvas)] p-6"><div className="flex items-center justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Preview board</p><h2 className="mt-1 text-lg font-semibold">预览画板</h2></div><span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[11px] text-[var(--text-secondary)]">多图与文案工作区</span></div><div className="mt-5 grid min-h-0 flex-1 place-items-center rounded-[16px] border border-dashed border-[var(--border)] bg-[var(--surface)]"><div className="text-center"><ImageIcon className="mx-auto h-8 w-8 text-[var(--text-muted)]" aria-hidden="true" /><p className="mt-3 text-sm font-semibold">把生成的图片和文案放在这里</p><p className="mt-1 text-xs text-[var(--text-secondary)]">后续接入多图渲染后，将在此显示实机预览。</p></div></div></section>
  </div>
}

function HistoryPanel({ className, query, setQuery, tasks, onSelectTask, onNewConversation, onClose }: { className: string; query: string; setQuery: (value: string) => void; tasks: Task[]; onSelectTask: (task: Task) => void; onNewConversation: () => void; onClose?: () => void }) {
  return (
    <aside className={`${className} shrink-0 flex-col px-4 py-5`}>
      <div className="flex items-center justify-between"><h2 className="text-[14px] font-semibold leading-5 tracking-[-0.01em] text-[var(--text-primary)]">聊天记录</h2>{onClose && <button type="button" onClick={onClose} aria-label="关闭聊天记录" className="grid h-9 w-9 place-items-center rounded-full hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--text-primary)] focus-visible:outline-offset-2"><X className="h-4 w-4" /></button>}</div>
      <label className="mt-4 flex min-h-10 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 shadow-[0_2px_8px_var(--surface-muted)] focus-within:border-[var(--text-primary)]"><Search className="h-3.5 w-3.5 text-[var(--text-secondary)]" aria-hidden="true" /><span className="sr-only">搜索聊天记录</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索……" className="w-full bg-transparent text-xs outline-none placeholder:text-[var(--text-secondary)]" /></label>
      <div className="mt-4 flex-1 space-y-0 overflow-y-auto">{tasks.map((task, index) => {
        const latestImage = task.messages?.flatMap((message) => message.images || []).at(-1) || task.thumbnail
        const content = <>
          <div className="flex min-w-0 items-center justify-between gap-2">
            <strong className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--text-primary)]">{task.title}</strong>
            <span className="shrink-0 text-[10px] text-[var(--text-secondary)]">{task.time}</span>
          </div>
          <span className="mt-1 block truncate text-[11px] text-[var(--text-secondary)]">{task.description}</span>
          {latestImage && <img src={latestImage} alt="最近生成的图片" className="mt-2 h-8 w-8 rounded-[6px] object-cover" />}
        </>
        return <div key={`${task.title}-${index}`} className="rounded-[6px] py-3 transition-colors first:pt-1 hover:bg-[var(--surface-muted)] focus-within:bg-[var(--surface-muted)]"><div className="flex gap-2.5"><Circle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--border)]" aria-hidden="true" />{task.messages?.length ? <button type="button" onClick={() => onSelectTask(task)} className="min-w-0 flex-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--text-primary)] focus-visible:outline-offset-2">{content}</button> : <Link href={task.href} onClick={onClose} className="min-w-0 flex-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--text-primary)] focus-visible:outline-offset-2">{content}</Link>}</div></div>
      })}</div>
      <UiverseButton type="button" onClick={() => { onNewConversation(); onClose?.() }} className="mt-4 w-full text-xs">创建新对话</UiverseButton>
    </aside>
  )
}

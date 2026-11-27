'use client'

import type { WorkspaceCapabilities } from '@/lib/workspace/capabilities'

import Link from 'next/link'
import {useWebsiteBuilder} from '@/components/site-builder/useWebsiteBuilder'
import {WebsiteTaskCard} from '@/components/site-builder/WebsiteTaskCard'
import {isWebsiteInstruction} from '@/lib/site-builder/intent'
import { setupGlassworkSurface } from '@/components/ui/glasswork/integrate'
import NextImage from 'next/image'
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowUp, Circle, History, Package, Search, X, Database as DatabaseIcon, Check, Maximize2, Minimize2, Image as ImageIcon, Plus, Sparkles, Paperclip, AtSign, Mic, Lightbulb } from 'lucide-react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Archive02Icon, Delete02Icon } from '@hugeicons/core-free-icons'
import type { Database as DatabaseSchema } from '@/lib/database.types'
import type { KnowledgeEntryRecord } from '@/lib/knowledge/model'
import { useDashboardWorkspace } from '@/components/dashboard/DashboardWorkspaceProvider'
import { ProductCreateDialog } from '@/components/product/ProductCreateDialog'
import { UiverseButton } from '@/components/ui/UiverseButton'
import AITextLoading from '@/components/kokonutui/ai-text-loading'
import AIInputSearch, { type SearchTool } from '@/components/kokonutui/ai-input-search'
import { ContentGenerationStudio } from './ContentGenerationStudio'
import { CreatorQuickUpload } from '@/components/creator-content/CreatorQuickUpload'
import { dismissCreatorUploadIntroAction } from '@/app/actions/onboarding'
import RefineFrame from './RefineFrame'
import SwipeRow from '@/components/react-bits/SwipeRow'
import { Bubble, BubbleContent, Message, MessageContent, MessageScroller, MessageScrollerContent, MessageScrollerItem, MessageScrollerProvider } from '@/components/ai-elements/chat'

type BrandProject = DatabaseSchema['public']['Tables']['brand_projects']['Row']
type Task = { id: string; title: string; description: string; content: string; time: string; href: string; archived?: boolean; thumbnail?: string; messages?: ChatMessage[] }
type WorkMode = 'product' | 'library'
type UploadIntent = 'new-product' | null
type WorkspaceSkill = { id: string; name: string; description: string; icon: string; category: string; version: string }
type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string; pending?: boolean; failed?: boolean; model?: string; images?: string[] }
type AttachedImage = { file: File; previewUrl: string }
type WorkspaceModel = 'gemini' | 'qwen-plus' | 'deepseek-flash' | 'deepseek-v4-pro'
type VoiceRecognition = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null }
type VoiceWindow = Window & { SpeechRecognition?: new () => VoiceRecognition; webkitSpeechRecognition?: new () => VoiceRecognition }
const MAX_CHAT_IMAGE_BYTES = 5 * 1024 * 1024
const CHAT_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_CHAT_IMAGES = 4
const WORKBENCH_TOOLS: SearchTool[] = [
  { id: 'knowledge', label: '资料', icon: DatabaseIcon, color: 'var(--brand-primary)', activity: '正在整理已选资料', placeholder: '输入任务…', readsSources: true },
  { id: 'product', label: '商品', icon: Package, color: 'var(--brand-primary)', activity: '正在分析商品资料', placeholder: '输入任务…' },
  { id: 'visual', label: '视觉', icon: ImageIcon, color: 'var(--brand-primary)', activity: '正在构思视觉方案', placeholder: '输入任务…' },
  { id: 'reason', label: '分析', icon: Lightbulb, color: 'var(--brand-primary)', activity: '正在深入分析', placeholder: '输入任务…' },
]
function readImageBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string' || !result.includes(',')) return reject(new Error('无法读取图片，请重新选择。'))
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = () => reject(new Error('无法读取图片，请重新选择。'))
    reader.readAsDataURL(file)
  })
}

function createLocalId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

const skillDisplayNames: Record<string, string> = {
  'merchant-profile': '商家洞察',
  'brand-proposal': '品牌策略',
  'store-copy': '店铺文案',
  'multi-channel-product-content': '商品文案',
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

export function WorkbenchHome({ displayName, merchantProject, capabilities = { creator: false, merchant: true }, creatorPreview = false, creatorUploadIntroPending = false }: { displayName: string; merchantProject: BrandProject; capabilities?: WorkspaceCapabilities; creatorPreview?: boolean; creatorUploadIntroPending?: boolean }) {
  const creatorOnly=capabilities.creator&&!capabilities.merchant
  const historyKey=creatorOnly?`omnilink-creator-history:${merchantProject.user_id}`:'omnilink-workbench-history'
  useEffect(() => {
    const surface = document.getElementById('workbench-command')?.closest<HTMLElement>('.workbench-ai-input')
    if (!surface) return
    return setupGlassworkSurface(surface, { radius: 28, rim: 12, dispersion: 0.18, tint: 1 }).destroy
  }, [])
  const website=useWebsiteBuilder(capabilities.merchant)
  const [websiteMode,setWebsiteMode]=useState(false)
  useEffect(()=>{
    if(!capabilities.merchant)return
    const active=new URLSearchParams(window.location.search).get('website')==='1'||localStorage.getItem(`website-mode:${merchantProject.id}`)==='1'
    if(active)setWebsiteMode(true)
  },[merchantProject.id,capabilities.merchant])
  const [prompt, setPrompt] = useState('')
  const [query, setQuery] = useState('')
  const [tasks, setTasks] = useState<Task[]>(creatorOnly?[]:initialTasks)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [workspaceMode, setWorkspaceMode] = useState<'conversation' | 'fullscreen'>('conversation')
  const [historyReady, setHistoryReady] = useState<string|null>(null)
  const [contentStudioOpen, setContentStudioOpen] = useState(false)
  const [showCreatorUploadTip, setShowCreatorUploadTip] = useState(false)
  const creatorUploadDismissedKey = `omnilink:creator-upload-intro-dismissed:${merchantProject.user_id}`
  useEffect(() => {
    if (!creatorOnly || !creatorUploadIntroPending) return
    const timer = window.setTimeout(() => {
      try {
        const dismissed = window.localStorage.getItem(creatorUploadDismissedKey) === '1'
        setShowCreatorUploadTip(!dismissed)
        if (dismissed && !creatorPreview) void dismissCreatorUploadIntroAction().catch(() => {})
      } catch {
        setShowCreatorUploadTip(true)
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [creatorOnly, creatorPreview, creatorUploadIntroPending, creatorUploadDismissedKey])
  function dismissCreatorUploadTip() {
    setShowCreatorUploadTip(false)
    try {
      window.localStorage.setItem(creatorUploadDismissedKey, '1')
    } catch {
      // Keep the current session closed when browser storage is unavailable.
    }
    if (!creatorPreview) void dismissCreatorUploadIntroAction().catch(() => {})
  }
  const workMode: WorkMode = 'product'
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([])
  const [uploadIntent, setUploadIntent] = useState<UploadIntent>(null)
  const [productDialogOpen, setProductDialogOpen] = useState(false)
  const [dropActive, setDropActive] = useState(false)
  const [model, setModel] = useState<'gemini' | 'qwen-plus' | 'deepseek-flash' | 'deepseek-v4-pro'>('gemini')
  const [toolMenuOpen, setToolMenuOpen] = useState(false)
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [lastSubmittedPrompt, setLastSubmittedPrompt] = useState('')
  const [voiceListening, setVoiceListening] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [skills, setSkills] = useState<WorkspaceSkill[]>([])
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null)
  const [skillsStatus, setSkillsStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const [selectedKnowledgeIds, setSelectedKnowledgeIds] = useState<string[]>([])
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionLoading, setMentionLoading] = useState(false)
  const [mentionLevel, setMentionLevel] = useState<'skills' | 'channels'>('skills')
  const [selectedChannels, setSelectedChannels] = useState<string[]>([])
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionIndex, setMentionIndex] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const attachedImagesRef = useRef<AttachedImage[]>([])
  const mentionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const voiceRef = useRef<VoiceRecognition | null>(null)
  const { selectedProduct, selectedProducts, products, knowledgeEntries, setSelectedProducts, addArtifact } = useDashboardWorkspace()
  const merchantName = merchantProject.name || displayName || 'Omnilink'
  const greetingName = creatorOnly?displayName:merchantName.includes('演示') ? '演示商家' : merchantName
  const visibleTasks = useMemo(
    () => tasks.filter((task) => `${task.title}${task.description}`.toLowerCase().includes(query.toLowerCase())),
    [query, tasks],
  )
  const selectedSkill = skills.find((skill) => skill.id === selectedSkillId) || null
  const modelOptions = [
    { value: 'gemini', label: 'Gemini 3.8 Flash' },
    { value: 'qwen-plus', label: '千问 Plus' },
    { value: 'deepseek-flash', label: 'DeepSeek V4.1 Flash' },
    { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro（深度推理）' },
  ] as const
  const selectedModelLabel = modelOptions.find((option) => option.value === model)?.label ?? modelOptions[0].label
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
      setSkills((payload.skills || []).filter(skill=>!creatorOnly||!Object.hasOwn(skillDisplayNames,skill.id)).map((skill) => ({ ...skill, name: skillDisplayNames[skill.id] || skill.name })))
      setSkillsStatus('ready')
    } catch {
      setSkillsStatus('unavailable')
    }
  }, [creatorOnly])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSkills(), 0)
    return () => window.clearTimeout(timer)
  }, [loadSkills])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(historyKey)
        const parsed=saved?JSON.parse(saved):null
        setTasks(Array.isArray(parsed)?parsed:creatorOnly?[]:initialTasks)
      } catch {
        // Ignore malformed local history and keep the starter tasks.
      } finally {
        setHistoryReady(historyKey)
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [historyKey,creatorOnly])

  useEffect(() => {
    if (historyReady===historyKey) window.localStorage.setItem(historyKey, JSON.stringify(tasks))
  }, [historyReady,historyKey,tasks])

  useEffect(() => () => {
    if (mentionTimerRef.current) clearTimeout(mentionTimerRef.current)
    attachedImagesRef.current.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl))
  }, [])

  function attachImages(files: File[]) {
    const validFiles = files.filter((file) => CHAT_IMAGE_TYPES.has(file.type) && file.size <= MAX_CHAT_IMAGE_BYTES)
    const rejectedCount = files.length - validFiles.length
    const existingKeys = new Set(attachedImagesRef.current.map(({ file }) => `${file.name}:${file.size}:${file.lastModified}`))
    const uniqueFiles = validFiles.filter((file) => !existingKeys.has(`${file.name}:${file.size}:${file.lastModified}`))
    const availableSlots = Math.max(0, MAX_CHAT_IMAGES - attachedImagesRef.current.length)
    const acceptedFiles = uniqueFiles.slice(0, availableSlots)
    const nextImages = [
      ...attachedImagesRef.current,
      ...acceptedFiles.map((file) => ({ file, previewUrl: URL.createObjectURL(file) })),
    ]
    attachedImagesRef.current = nextImages
    setAttachedImages(nextImages)
    if (nextImages.length) setUploadIntent(capabilities.merchant?'new-product':null)
    setGenerationError(rejectedCount ? '仅支持 5 MB 以内的 JPG、PNG 或 WebP 图片。' : uniqueFiles.length > acceptedFiles.length ? `最多可同时选择 ${MAX_CHAT_IMAGES} 张图片。` : null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function clearAttachedImage() {
    attachedImagesRef.current.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl))
    attachedImagesRef.current = []
    setAttachedImages([])
    setUploadIntent(null)
  }

  function removeAttachedImage(file: File) {
    const nextImages = attachedImagesRef.current.filter((image) => image.file !== file)
    const removedImage = attachedImagesRef.current.find((image) => image.file === file)
    if (removedImage) URL.revokeObjectURL(removedImage.previewUrl)
    attachedImagesRef.current = nextImages
    setAttachedImages(nextImages)
    if (!nextImages.length) setUploadIntent(null)
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDropActive(false)
    attachImages(Array.from(event.dataTransfer.files))
  }

  async function submit(event?: FormEvent, request?: { prompt?: string; model?: WorkspaceModel; files?: File[]; toolId?: string | null; signal?: AbortSignal }) {
    event?.preventDefault()
    const requestFiles = request?.files ?? attachedImages.map(({ file }) => file)
    const requestModel = request?.model ?? model
    const value = request?.prompt?.trim() || prompt.trim() || (requestFiles.length ? '请分析这些图片。' : '')
    if (!value || isGenerating) return
    if(capabilities.merchant&&isWebsiteInstruction(value,websiteMode)){
      if(requestFiles.length){setGenerationError('请先将网站所需图片添加到商品资料，再提交建站要求。');return}
      setWebsiteMode(true);localStorage.setItem(`website-mode:${merchantProject.id}`,'1')
      setGenerationError(null);setLastSubmittedPrompt(value);setIsGenerating(true)
      try{
        await website.generate(value,websiteMode)
        setWebsiteMode(true);localStorage.setItem(`website-mode:${merchantProject.id}`,'1');setPrompt('')
      }catch(error){setGenerationError(error instanceof Error?error.message:'建站请求未完成')}
      finally{setIsGenerating(false)}
      return
    }
    if (requestFiles.length && requestModel !== 'gemini') {
      setGenerationError('图片识别目前使用 Gemini；请选择 Gemini 3.8 Flash 后发送。')
      return
    }
    setGenerationError(null)
    setVoiceError(null)
    setLastSubmittedPrompt(value)
    setIsGenerating(true)
    const messageId = createLocalId('message')
    const responseId = `${messageId}-response`
    setMessages((current) => [
      ...current,
      { id: messageId, role: 'user', content: value },
      { id: responseId, role: 'assistant', content: '正在生成…', pending: true, model: requestModel },
    ])
    setPrompt('')
    try {
      const [requestImages, thumbnails] = await Promise.all([
        Promise.all(requestFiles.map(async (file) => ({ mimeType: file.type, base64: await readImageBase64(file) }))),
        Promise.all(requestFiles.map(async (file) => {
          const preview = attachedImagesRef.current.find((image) => image.file === file)?.previewUrl
          return preview ? createHistoryThumbnail(preview) : undefined
        })),
      ])
      if (request?.signal?.aborted) throw new DOMException('Request aborted', 'AbortError')
      const userThumbnails = thumbnails.filter((thumbnail): thumbnail is string => Boolean(thumbnail))
      if (userThumbnails.length) setMessages((current) => current.map((message) => message.id === messageId ? { ...message, images: userThumbnails } : message))
      const response = await fetch('/api/knowledge/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          prompt: value,
          model: requestModel,
          skillId: selectedSkillId,
          toolId: request?.toolId ?? selectedToolId,
          images: requestImages,
          context: [
            ...(creatorOnly?[{title:'创作场景',summary:'围绕图文、视频脚本、内容选题和素材整理提供帮助。未要求商品推荐或带货时，不默认围绕购物展开。'}]:[]),
            ...knowledgeEntries.filter((entry) => !selectedKnowledgeIds.length || selectedKnowledgeIds.includes(entry.id)).map((entry) => ({ title: entry.key, summary: entry.value })),
            ...(selectedChannels.length ? [{ title: '目标渠道', summary: selectedChannels.join('、') }] : []),
            ...(capabilities.merchant&&products.length ? [{
              title: '可自动识别的商品目录',
              summary: products.slice(0, 100).map((product) => `${product.name}${product.sku ? `（SKU：${product.sku}）` : ''}`).join('、'),
            }] : []),
          ],
        }),
        signal: request?.signal,
      })
      const payload = await response.json() as { content?: string; error?: string; images?: string[] }
      if (!response.ok || !payload.content) throw new Error(payload.error || '模型没有返回内容。')
      const content = payload.content
      const responseImages = Array.isArray(payload.images) ? payload.images.filter((image): image is string => typeof image === 'string' && image.length > 0).slice(0, 6) : []
      if (request?.signal?.aborted) throw new DOMException('Request aborted', 'AbortError')
      setMessages((current) => current.map((message) => message.id === responseId ? { ...message, content, images: responseImages, pending: false } : message))
      const historyImage = responseImages.length ? await createHistoryThumbnail(responseImages[responseImages.length - 1]) : undefined
      const taskId = createLocalId('task')
      const mode = creatorOnly?{title:'内容创作',href:'/dashboard/content'}:workModes.find((item) => item.id === workMode) || workModes[0]
      setTasks((current) => [{ id: taskId, title: value, description: selectedSkill ? `${selectedSkill.name}，${mode.title}` : (selectedProduct ? `${mode.title}，${selectedProduct.name}` : mode.title), content, time: '刚刚', href: mode.href, thumbnail: historyImage || userThumbnails[0], messages: [{ id: messageId, role: 'user', content: value, images: userThumbnails }, { id: responseId, role: 'assistant', content, model: requestModel, images: historyImage ? [historyImage] : [] }] }, ...current])
      addArtifact({ id: taskId, title: value, content, productId: selectedProduct?.id, productName: selectedProduct?.name, createdAt: '刚刚' })
      if (requestFiles.length) clearAttachedImage()
    } catch (error) {
      if (request?.signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
        setMessages((current) => current.map((item) => item.id === responseId ? { ...item, content: '已停止生成。', pending: false } : item))
        return
      }
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
    if (task.archived) setTasks((current) => current.map((item) => item.id === task.id ? { ...item, archived: false } : item))
    clearAttachedImage()
    setMessages(task.messages)
    setPrompt('')
    setGenerationError(null)
    setHistoryOpen(false)
  }

  function archiveHistoryTask(id: string) {
    setTasks((current) => current.map((task) => task.id === id ? { ...task, archived: !task.archived } : task))
  }

  function deleteHistoryTask(id: string) {
    setTasks((current) => current.filter((task) => task.id !== id))
  }

  function startNewConversation() {
    clearAttachedImage()
    setMessages([])
    setPrompt('')
    setQuery('')
    setGenerationError(null)
    setVoiceError(null)
  }

  async function recordGeneratedImage(name: string, source: string) {
    const thumbnail = await createHistoryThumbnail(source)
    const taskId = createLocalId('task-image')
    const title = name.trim() ? `${name.trim()}：图片生成` : '图片生成'
    setTasks((current) => [{ id: taskId, title, description: '商品文案', content: '已生成商品图片。', time: '刚刚', href: '/dashboard', thumbnail, messages: [{ id: `${taskId}-assistant`, role: 'assistant', content: '已生成商品图片。', images: thumbnail ? [thumbnail] : [] }] }, ...current])
  }

  return (
    <>
    <div className={`workbench-ambient workbench-glass-theme flex min-h-0 text-[var(--text-primary)] ${messages.length ? 'has-conversation' : ''} ${isGenerating ? 'is-generating' : ''}`}>
      <section className="main-workspace relative flex min-w-0 flex-1 flex-col overflow-y-auto">
        {(capabilities.merchant || (capabilities.creator && !creatorPreview)) && <nav aria-label="工作台常用操作" className="flex shrink-0 flex-wrap gap-3 px-5 py-4 sm:px-8">
          {capabilities.creator && !creatorPreview && <Link href="/dashboard/content/works" className="rounded-full px-4 py-2 text-sm hover:bg-[var(--interactive-hover)] focus-visible:outline-2 focus-visible:outline-offset-2">我的作品</Link>}
          {capabilities.merchant && <Link href="/dashboard/products/new" className="rounded-full bg-[var(--text-primary)] px-4 py-2 text-sm text-[var(--surface)] focus-visible:outline-2 focus-visible:outline-offset-2">上架商品</Link>}
        </nav>}
        <div className={`workbench-chat-stage relative z-10 mx-auto flex w-full max-w-[960px] flex-1 flex-col items-center px-5 py-5 sm:px-8 sm:pt-7 sm:pb-4 ${messages.length ? 'has-conversation' : ''}`}>
          {messages.length ? (
            <MessageScrollerProvider autoScroll>
              <MessageScroller className="mt-12 w-full max-w-[760px] pb-8">
                <MessageScrollerContent className="space-y-5">
                  {messages.map((message, messageIndex) => (
                    <MessageScrollerItem key={message.id} messageId={message.id} scrollAnchor={message.role === 'user'}>
                      <Message align={message.role === 'user' ? 'end' : 'start'}>
                        <MessageContent className={message.role === 'user' ? 'max-w-[88%]' : 'max-w-[92%]'}>
                          <Bubble
                            align={message.role === 'user' ? 'end' : 'start'}
                            variant={message.role === 'user' ? 'muted' : 'default'}
                            className={`px-1 py-3 ${message.role === 'user' ? '!px-4' : ''} ${message.failed ? 'rounded-xl bg-[var(--palette-danger-soft)] text-[var(--palette-danger)]' : ''}`}
                          >
                            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] opacity-60">
                              {message.role === 'user' ? '你' : `AI ${message.model === 'qwen-plus' ? '千问 Plus' : message.model === 'deepseek-flash' ? 'DeepSeek Flash' : message.model === 'deepseek-v4-pro' ? 'DeepSeek Pro' : 'Gemini'}`}
                            </div>
                            {message.pending ? <AITextLoading /> : <BubbleContent>{message.content}</BubbleContent>}
                            {message.images?.length ? (
                              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                                {message.images.map((image, imageIndex) => message.role === 'assistant' ? (
                                  <div key={`${message.id}-image-${imageIndex}`} className="overflow-hidden rounded-xl">
                                    <RefineFrame status={message.pending ? 'processing' : 'complete'} aspectRatio="1 / 1" width={360} radius={12} background="var(--surface-muted)" color="var(--text-primary)" stageDuration={400} sweep showStatus hideAfter={1200} retryLabel="重试生成" onRetry={() => void submit(undefined, { prompt: messages[messageIndex - 1]?.content || lastSubmittedPrompt, model: (message.model as WorkspaceModel) || model })}>
                                      <img src={image} alt={`生成图片 ${imageIndex + 1}`} crossOrigin="anonymous" />
                                    </RefineFrame>
                                  </div>
                                ) : (
                                  <img key={`${message.id}-image-${imageIndex}`} src={image} alt={`上传图片 ${imageIndex + 1}`} className="aspect-square w-full rounded-md object-cover" />
                                ))}
                              </div>
                            ) : null}
                          </Bubble>
                        </MessageContent>
                      </Message>
                    </MessageScrollerItem>
                  ))}
                </MessageScrollerContent>
              </MessageScroller>
            </MessageScrollerProvider>
          ) : <div className="workbench-welcome mt-[clamp(4rem,9vh,6.5rem)] w-full max-w-[720px] text-center"><AIAssistantOrb isThinking={isGenerating} /><h1 className="workbench-greeting">你好，{greetingName}</h1>{creatorOnly && showCreatorUploadTip && <CreatorQuickUpload destination={creatorPreview ? '/creator?preview=1&view=content&from=workbench' : '/dashboard/content?from=workbench'} onDismiss={dismissCreatorUploadTip} />}</div>}

          {capabilities.merchant&&website.state&&<WebsiteTaskCard state={website.state} onCancel={(buildId,expectedRevision)=>{void website.command({action:'cancel',buildId,expectedRevision}).catch(error=>setGenerationError(error.message))}}/>}
          {websiteMode&&website.needsLogin&&<Link href="/login?next=%2Fdashboard%3Fwebsite%3D1" className="mx-auto mt-3 text-sm underline">登录后开始建站</Link>}
          {websiteMode&&!website.needsLogin&&generationError?.includes('DeepSeek')&&<Link href="/dashboard/settings" className="mx-auto mt-3 text-sm underline">连接 DeepSeek</Link>}
          {websiteMode&&<div className="mx-auto mt-4 flex w-full max-w-[620px] items-center gap-2 text-xs text-[var(--text-secondary)]"><span>网站设计</span><button type="button" aria-label="退出网站设计输入" onClick={()=>{setWebsiteMode(false);localStorage.removeItem(`website-mode:${merchantProject.id}`)}} className="grid h-8 w-8 place-items-center rounded-full hover:bg-[var(--interactive-hover)]">×</button></div>}
          <form onSubmit={submit} className={`relative mt-auto w-full max-w-[620px] ${voiceError || generationError ? 'pb-8' : 'pb-0'} ${messages.length ? 'pt-10' : 'pt-8'}`}>
              <input ref={fileInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => attachImages(Array.from(event.target.files ?? []))} />
              <div onDragOver={(event) => { event.preventDefault(); setDropActive(true) }} onDragLeave={() => setDropActive(false)} onDrop={handleDrop} className="relative w-full">
                <AIInputSearch
                  className="w-full max-w-none py-0"
                  shellClassName={`workbench-ai-input relative rounded-[28px] p-0 ${dropActive ? 'is-drop-active' : ''}`}
                  inputContainerClassName="rounded-[28px] bg-transparent shadow-none ring-0"
                  inputClassName="min-h-[56px] px-4 pt-3.5 pb-1 pr-12 text-[14px] leading-6 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] dark:text-[var(--text-primary)]"
                  inputId="workbench-command"
                  inputLabel="输入任务"
                  placeholder={creatorOnly?'说说你的创作想法…':'输入任务…'}
                  defaultTool={null}
                  showToolHeader={false}
                  tools={creatorOnly?WORKBENCH_TOOLS.filter(tool=>tool.id!=='product'):WORKBENCH_TOOLS}
                  models={modelOptions.map((option) => option.label)}
                  defaultModel={selectedModelLabel}
                  value={prompt}
                  externalFiles={attachedImages.map(({ file }) => file)}
                  showFileChips={false}
                  onRemoveFile={removeAttachedImage}
                  onValueChange={handlePromptChange}
                  onInputKeyDown={handlePromptKeyDown}
                  onToolChange={setSelectedToolId}
                  onToolMenuOpenChange={setToolMenuOpen}
                  onModelChange={(label) => {
                    const selected = modelOptions.find((option) => option.label === label)
                    if (selected) setModel(selected.value)
                  }}
                  onSearch={async (value, options) => {
                    const selected = modelOptions.find((option) => option.label === options.model)
                    await submit(undefined, {
                      prompt: value,
                      model: selected?.value ?? model,
                      files: options.files,
                      toolId: options.tool?.id ?? null,
                      signal: options.signal,
                    })
                  }}
                  shellHeader={attachedImages.length > 0 && <div className="flex flex-wrap items-start gap-2 px-3 pt-3 pb-1" aria-label={`已选择 ${attachedImages.length} 张图片`}>
                      {attachedImages.map(({ file, previewUrl }, index) => <div key={`${file.name}-${file.size}-${file.lastModified}`} className="relative h-14 w-14 overflow-hidden rounded-md border border-black/10 bg-[#f3f4f6] shadow-sm">
                        <NextImage src={previewUrl} alt={`已选择图片 ${index + 1}：${file.name}`} title={file.name} fill sizes="56px" unoptimized className="object-cover" />
                        <button type="button" onClick={() => removeAttachedImage(file)} aria-label={`移除图片：${file.name}`} className="absolute top-1 right-1 grid h-5 w-5 place-items-center rounded-full bg-black/65 text-white shadow-sm hover:bg-black/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"><X className="h-3 w-3" aria-hidden="true" /></button>
                      </div>)}
                      <span className="self-center text-[11px] text-[var(--text-secondary)]">{attachedImages.length}/{MAX_CHAT_IMAGES}</span>
                    </div>}
                  inputHeader={selectedSkill && <div className="selected-skill-pill group mx-3 mt-3 w-fit" title={selectedChannels.length ? `已选择：${selectedChannels.join('、')}` : selectedSkill.description}><Sparkles className="h-[9px] w-[9px] shrink-0" aria-hidden="true" /><span className="truncate">{selectedSkill.name}</span>{selectedSkill.id === 'multi-channel-product-content' && <button type="button" onClick={() => setContentStudioOpen(true)} className="ml-1 shrink-0 rounded-full bg-[var(--surface-muted)] px-2 py-1 text-[7.5px] font-semibold text-[var(--text-primary)] hover:bg-[var(--border-subtle)]">打开商品文案工具</button>}<button type="button" onClick={removeSelectedSkill} aria-label={`移除 Skill：${selectedSkill.name}`} className="selected-skill-pill__remove"><X className="h-[9px] w-[9px]" aria-hidden="true" /></button></div>}
                  inputOverlay={<>
                  <button type="button" onClick={() => setWorkspaceMode('fullscreen')} aria-label="进入全屏工作台" className="workbench-expand absolute right-0 top-0 grid h-10 w-10 place-items-center rounded-full text-[var(--text-secondary)]"><Maximize2 className="h-[10.5px] w-[10.5px]" /></button>
                  {mentionOpen && <div data-glasswork="" data-glasswork-radius="16" data-glasswork-rim="12" data-glasswork-dispersion="0.18" className="ui-glass mention-menu absolute bottom-[calc(100%+12px)] left-0 right-0 z-30 w-auto overflow-hidden rounded-[var(--radius-overlay)] p-1.5" role="listbox" aria-label={mentionLevel === 'skills' ? '选择 Skill' : '选择社媒渠道'}>
                    {mentionLevel === 'skills' ? <>
                      <div className="flex items-center justify-between gap-3 px-3 py-2 text-[10px] font-semibold tracking-[0.12em] text-[var(--text-muted)]"><span className="flex items-center gap-2"><AtSign className="h-3.5 w-3.5" aria-hidden="true" />选择能力</span><span className="tracking-normal">{skills.length} 项</span></div>
                      {mentionLoading || skillsStatus === 'loading' ? <div className="mention-loading" aria-label="正在搜索 Skill"><span className="mention-loading__line w-2/5" /><span className="mention-loading__line w-4/5" /><span className="mention-loading__line w-3/5" /></div> : skillsStatus === 'unavailable' ? <div className="px-3 py-4 text-xs text-[var(--text-secondary)]"><p>Skill 加载失败，请重试。</p><button type="button" onClick={() => void loadSkills()} className="mt-2 min-h-8 rounded-md border border-[var(--border)] px-3 font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)]">重试</button></div> : mentionOptions.length ? mentionOptions.map((option, index) => <button key={option.id} type="button" role="option" aria-selected={index === mentionIndex} onMouseEnter={() => setMentionIndex(index)} onClick={() => selectMention(option)} className={`mention-option ${index === mentionIndex ? 'is-active' : ''}`}><span className="mention-option__icon"><Sparkles className="h-3.5 w-3.5" aria-hidden="true" /></span><span className="min-w-0 flex-1 text-left"><strong className="block truncate text-xs">{option.label}</strong><span className="mt-0.5 block truncate text-[10px] text-[var(--text-secondary)]">{option.meta}</span></span></button>) : <p className="px-3 py-4 text-xs text-[var(--text-secondary)]">没有匹配的 Skill。</p>}
                    </> : <>
                      <div className="flex items-center justify-between gap-3 px-2 py-2"><button type="button" onClick={() => setMentionLevel('skills')} className="mention-back"><ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />商品文案</button><button type="button" onClick={toggleAllChannels} className="mention-select-all">{selectedChannels.length === socialChannels.length ? '取消全选' : '全选'}</button></div>
                      <div className="grid gap-1" role="group" aria-label="选择发布渠道">{socialChannels.map((channel) => { const checked = selectedChannels.includes(channel); return <button key={channel} type="button" aria-pressed={checked} onClick={() => toggleChannel(channel)} className={`mention-option ${checked ? 'is-active' : ''}`}><span className="mention-option__icon"><Check className={`h-3.5 w-3.5 ${checked ? '' : 'opacity-0'}`} aria-hidden="true" /></span><span className="min-w-0 flex-1 text-left"><strong className="block truncate text-xs">{channel}</strong><span className="mt-0.5 block truncate text-[10px] text-[var(--text-secondary)]">用于生成对应渠道内容</span></span></button> })}</div>
                      <button type="button" onClick={() => setMentionOpen(false)} className="mention-confirm">完成{selectedChannels.length ? `（已选 ${selectedChannels.length}）` : ''}</button>
                    </>}
                  </div>}
                  </>}
                  attachmentContent={<AddMenu creatorOnly={creatorOnly} modelOpen={toolMenuOpen} onOpen={() => setToolMenuOpen(false)} onPickFile={() => fileInputRef.current?.click()} products={products} selectedProducts={selectedProducts} knowledgeEntries={knowledgeEntries} selectedKnowledgeIds={selectedKnowledgeIds} onSelectProduct={(product) => setSelectedProducts([product])} onToggleKnowledge={(id) => setSelectedKnowledgeIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} onOpenFullscreen={() => setWorkspaceMode('fullscreen')} />}
                  toolbarMiddleContent={<button type="button" onClick={startVoiceInput} aria-label={voiceListening ? '停止语音输入' : '开始语音输入'} aria-pressed={voiceListening} title={voiceListening ? '停止语音输入' : '开始语音输入'} className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-primary)] focus-visible:outline-offset-2 ${voiceListening ? 'border-[var(--accent-primary)] bg-white text-[var(--accent-primary)]' : 'border-black/10 bg-white text-[#737982] hover:bg-[#f8f8f8]'}`}><Mic className="h-4 w-4" aria-hidden="true" /></button>}
                />
                {attachedImages.length > 0 && uploadIntent === 'new-product' && <button type="button" onClick={() => setProductDialogOpen(true)} className="mt-2 inline-flex min-h-8 items-center gap-1.5 rounded-[var(--radius-control)] bg-[var(--accent-primary)] px-3 text-[8.25px] font-semibold text-[var(--surface)] transition-colors hover:bg-[var(--accent-primary-hover)] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--text-primary)] focus-visible:outline-offset-2" title="打开新建商品表单"><Package className="h-[9px] w-[9px]" aria-hidden="true" />新建商品</button>}
              </div>
              {(voiceError || generationError) && <div className="absolute inset-x-5 bottom-0 flex h-8 min-w-0 items-center overflow-hidden text-xs leading-5">
                {voiceError ? <p role="status" className="min-w-0 truncate text-[var(--text-secondary)]" title={voiceError}>{voiceError}</p> : <div role="alert" className="flex w-full min-w-0 items-center justify-between gap-3 text-red-700"><p className="min-w-0 truncate" title={generationError ?? ''}>{generationError}</p><button type="button" onClick={() => { setPrompt(lastSubmittedPrompt); setGenerationError(null); document.getElementById('workbench-command')?.focus() }} className="h-8 shrink-0 rounded-md border border-red-300 px-2 font-semibold text-red-800 hover:bg-red-50">重试</button></div>}
              </div>}
          </form>
        </div>
      </section>

      <button type="button" data-glasswork="" data-glasswork-radius="20" data-glasswork-rim="10" data-glasswork-dispersion="0.18" data-pill="" onClick={() => setHistoryOpen(true)} aria-label="打开历史记录" title="历史记录" className="workbench-history-trigger fixed right-5 top-5 z-20 grid size-10 place-items-center rounded-full text-[var(--text-secondary)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--text-primary)] focus-visible:outline-offset-2"><History className="h-4 w-4" aria-hidden="true" /></button>
      {historyOpen && <div className="fixed inset-0 z-50" role="presentation"><button type="button" onClick={() => setHistoryOpen(false)} aria-label="关闭历史记录" className="absolute inset-0 bg-black/25" /><HistoryPanel className="workbench-history-panel absolute inset-y-2 right-2 flex w-[min(88vw,380px)] rounded-3xl" query={query} setQuery={setQuery} tasks={visibleTasks} onSelectTask={openHistoryTask} onArchiveTask={archiveHistoryTask} onDeleteTask={deleteHistoryTask} onNewConversation={startNewConversation} onClose={() => setHistoryOpen(false)} /></div>}
    </div>
    {capabilities.merchant&&<ProductCreateDialog key={productDialogOpen ? 'open' : 'closed'} open={productDialogOpen} initialImages={attachedImages.map(({ file }) => file)} onOpenChange={(open) => { setProductDialogOpen(open); if (!open) clearAttachedImage() }} />}
    {workspaceMode === 'fullscreen' && <FullscreenWorkbench prompt={prompt} setPrompt={setPrompt} submit={submit} onClose={() => setWorkspaceMode('conversation')} selectedProduct={selectedProduct} />}
    {contentStudioOpen && <ContentGenerationStudio selectedProduct={selectedProduct} onClose={() => setContentStudioOpen(false)} onGenerated={(name, source) => void recordGeneratedImage(name, source)} />}
    </>
  )
}

function AddMenu({ creatorOnly, modelOpen, onOpen, onPickFile, onOpenFullscreen, products, selectedProducts, knowledgeEntries, selectedKnowledgeIds, onSelectProduct, onToggleKnowledge }: { creatorOnly: boolean; modelOpen: boolean; onOpen: () => void; onPickFile: () => void; onOpenFullscreen: () => void; products: Array<{ id: string; name: string; sku?: string | null }>; selectedProducts: Array<{ id: string; name: string; sku?: string | null }>; knowledgeEntries: KnowledgeEntryRecord[]; selectedKnowledgeIds: string[]; onSelectProduct: (product: { id: string; name: string; sku?: string | null }) => void; onToggleKnowledge: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const [picker, setPicker] = useState<'products' | 'knowledge' | null>(null)

  function toggleMenu() {
    if (!open) { setPicker(null); if (modelOpen) onOpen() }
    setOpen(!open)
  }

  return (
    <div>
      <button type="button" onClick={toggleMenu} aria-label={creatorOnly ? '添加图片' : '添加图片或资料'} aria-expanded={open} aria-controls="workbench-add-menu" className="grid h-11 w-11 place-items-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--text-primary)] focus-visible:outline-offset-2">
        <Plus className={`h-4 w-4 transition-transform ${open ? 'rotate-45' : ''}`} />
      </button>
      {open && <div data-glasswork="" data-glasswork-radius="16" data-glasswork-rim="12" data-glasswork-dispersion="0.18" id="workbench-add-menu" role="menu" aria-label="添加" className="add-menu absolute inset-x-0 bottom-[calc(100%+8px)] z-20 overflow-hidden p-2">
        {picker ? <>
          <div className="add-menu__picker-header"><button type="button" onClick={() => setPicker(null)} className="add-menu__back" aria-label="返回添加菜单">‹</button><span>{picker === 'products' ? '选择商品' : '选择知识库文件'}</span></div>
          {picker === 'products' ? <div className="add-menu__list">{products.length ? products.map((product) => { const selected = selectedProducts.some((item) => item.id === product.id); return <button key={product.id} type="button" role="menuitemradio" aria-checked={selected} onClick={() => { onSelectProduct(product); setOpen(false) }} className="add-menu__choice"><span className={`add-menu__choice-mark ${selected ? 'is-selected' : ''}`}>{selected ? '✓' : ''}</span><span className="min-w-0 flex-1 truncate">{product.name}</span>{product.sku && <span className="add-menu__choice-meta">{product.sku}</span>}</button> }) : <p className="add-menu__empty">暂无商品，请先在商品资产库中创建。</p>}</div> : <div className="add-menu__list">{knowledgeEntries.length ? knowledgeEntries.map((entry) => { const selected = selectedKnowledgeIds.includes(entry.id); return <button key={entry.id} type="button" role="menuitemcheckbox" aria-checked={selected} onClick={() => onToggleKnowledge(entry.id)} className="add-menu__choice"><span className={`add-menu__choice-mark ${selected ? 'is-selected' : ''}`}>{selected ? '✓' : ''}</span><span className="min-w-0 flex-1 truncate">{entry.key}</span><span className="add-menu__choice-meta">资料</span></button> }) : <p className="add-menu__empty">暂无知识库文件，请先上传或整理资料。</p>}</div>}
        </> : <>
          <p className="add-menu__heading">添加</p>
          <button type="button" role="menuitem" onClick={() => { onPickFile(); setOpen(false) }} className="add-menu__item"><Paperclip className="h-3 w-3" aria-hidden="true" /><span className="add-menu__title">添加图片</span><span className="add-menu__hint">{creatorOnly ? '用于创作对话' : '对话识别或新建商品'}</span></button>
          {!creatorOnly && <><Link href="/dashboard/knowledge" role="menuitem" className="add-menu__item"><DatabaseIcon className="h-3 w-3" aria-hidden="true" /><span className="add-menu__title">上传资料文件</span><span className="add-menu__hint">前往资料库</span></Link>
          <div className="add-menu__section">工作台</div>
          <button type="button" role="menuitem" onClick={() => setPicker('products')} className="add-menu__item"><Package className="h-3 w-3" aria-hidden="true" /><span className="add-menu__title">选择商品</span><span className="add-menu__hint">关联商品上下文</span></button>
          <button type="button" role="menuitem" onClick={() => setPicker('knowledge')} className="add-menu__item"><DatabaseIcon className="h-3 w-3" aria-hidden="true" /><span className="add-menu__title">选择知识库文件</span><span className="add-menu__hint">引用资料内容</span></button></>}
          <button type="button" role="menuitem" onClick={() => { onOpenFullscreen(); setOpen(false) }} className="add-menu__item"><Maximize2 className="h-3 w-3" aria-hidden="true" /><span className="add-menu__title">全屏工作台</span><span className="add-menu__hint">打开更大的工作空间</span></button>
        </>}
      </div>}
    </div>
  )
}

function AIAssistantOrb({ isThinking }: { isThinking: boolean }) {
  return (
    <div className="ai-orb" role="img" aria-label={isThinking ? 'AI 正在思考' : 'AI 助手'}>
      <span className="ai-orb__symbols" aria-hidden="true"><Sparkles /></span>
    </div>
  )
}

function FullscreenWorkbench({ prompt, setPrompt, submit, onClose, selectedProduct }: { prompt: string; setPrompt: (value: string) => void; submit: (event: FormEvent) => void; onClose: () => void; selectedProduct: { name: string } | null }) {
  return (
    <div className="workbench-fullscreen fixed inset-0 z-[80] flex text-[var(--text-primary)]" role="dialog" aria-modal="true" aria-label="全屏工作台">
      <section className="workbench-fullscreen-conversation flex w-[38%] min-w-[320px] flex-col p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">工作对话</h2>
          <button type="button" onClick={onClose} aria-label="退出全屏工作台" className="workbench-fullscreen-close grid h-9 w-9 place-items-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)] focus-visible:outline-offset-2"><Minimize2 className="h-4 w-4" /></button>
        </div>
        <div data-glasswork="" data-glasswork-radius="20" data-glasswork-rim="12" data-glasswork-dispersion="0.18" data-glasswork-tint="1.15" className="workbench-fullscreen-dialog mt-6 flex-1 p-4">
          <p className="text-sm font-semibold">开始处理任务</p>
          <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">适合多张图片、实机渲染和图文并排编辑的任务。</p>
          {selectedProduct && <p className="mt-4 text-xs">当前商品：{selectedProduct.name}</p>}
        </div>
        <form onSubmit={submit} className="mt-4">
          <div data-glasswork="" data-glasswork-radius="20" data-glasswork-rim="12" data-glasswork-dispersion="0.18" data-glasswork-tint="1.15" className="workbench-fullscreen-editor">
            <textarea rows={4} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="描述要生成的画面、文案或修改方式……" className="w-full resize-none bg-transparent p-3 text-sm leading-6 outline-none placeholder:text-[var(--text-muted)]" />
          </div>
          <UiverseButton type="submit" disabled={!prompt.trim()} className="workbench-fullscreen-submit mt-2 h-11 w-full text-sm"><ArrowUp className="h-4 w-4" />生成</UiverseButton>
        </form>
      </section>
      <section className="flex min-w-0 flex-1 flex-col p-6">
        <h2 className="text-lg font-semibold">预览画板</h2>
        <div data-glasswork="" data-glasswork-radius="20" data-glasswork-rim="12" data-glasswork-dispersion="0.18" data-glasswork-tint="1.15" className="workbench-fullscreen-preview mt-5 grid min-h-0 flex-1 place-items-center">
          <div className="text-center">
            <ImageIcon className="mx-auto h-8 w-8 text-[var(--text-muted)]" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold">把生成的图片和文案放在这里</p>
          </div>
        </div>
      </section>
    </div>
  )
}

function HistoryPanel({ className, query, setQuery, tasks, onSelectTask, onArchiveTask, onDeleteTask, onNewConversation, onClose }: { className: string; query: string; setQuery: (value: string) => void; tasks: Task[]; onSelectTask: (task: Task) => void; onArchiveTask: (id: string) => void; onDeleteTask: (id: string) => void; onNewConversation: () => void; onClose?: () => void }) {
  const [historyView, setHistoryView] = useState<'recent' | 'archived'>('recent')
  return (
    <aside role="dialog" aria-modal="true" aria-label="历史记录" data-glasswork="" data-glasswork-radius="24" data-glasswork-rim="16" data-glasswork-dispersion="0.18" data-glasswork-tint="1.25" className={`${className} shrink-0 flex-col`}>
      <div className="flex h-16 items-center justify-between border-b border-[var(--border-subtle)] px-5"><h2 className="text-base font-semibold text-[var(--text-primary)]">历史记录</h2>{onClose && <button type="button" onClick={onClose} aria-label="关闭" className="grid h-10 w-10 place-items-center rounded-[var(--radius-control)] hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)]"><X className="h-[18px] w-[18px]" /></button>}</div>
      <label className="mx-4 mt-2 flex h-11 shrink-0 items-center gap-2 rounded-[var(--radius-control)] px-3 transition-colors focus-within:bg-[var(--surface-muted)] focus-within:outline focus-within:outline-2 focus-within:outline-[var(--brand-primary)]"><Search className="h-4 w-4 text-[var(--text-secondary)]" aria-hidden="true" /><span className="sr-only">搜索历史记录</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索历史记录" className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-secondary)]" /></label>
      <div className="flex h-11 shrink-0 items-center gap-2 px-4"><button type="button" onClick={() => setHistoryView('recent')} aria-pressed={historyView === 'recent'} className={`h-9 rounded-full px-3 text-sm hover:bg-[var(--interactive-hover)] ${historyView === 'recent' ? 'font-semibold text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'}`}>最近</button><button type="button" onClick={() => setHistoryView('archived')} aria-pressed={historyView === 'archived'} className={`h-9 rounded-full px-3 text-sm hover:bg-[var(--interactive-hover)] ${historyView === 'archived' ? 'font-semibold text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'}`}>已归档</button></div>
      <div className="flex-1 space-y-2 overflow-y-auto overscroll-contain p-3">{tasks.filter((task) => Boolean(task.archived) === (historyView === 'archived')).map((task, index) => {
        const latestImage = task.messages?.flatMap((message) => message.images || []).at(-1) || task.thumbnail
        const content = <>
          <div className="flex min-w-0 items-center justify-between gap-2">
            <strong className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--text-primary)]">{task.title}</strong>
            <span className="shrink-0 text-[10px] text-[var(--text-secondary)]">{task.time}</span>
          </div>
          <span className="mt-1 block truncate text-[11px] text-[var(--text-secondary)]">{task.description}</span>
          {latestImage && <img src={latestImage} alt="最近生成的图片" className="mt-2 h-8 w-8 rounded-md object-cover" />}
        </>
        return <SwipeRow key={`${task.id}-${index}`} label={task.title} actions={[{ id: 'delete', label: '删除', icon: <HugeiconsIcon icon={Delete02Icon} size={20} /> }, { id: 'archive', label: task.archived ? '恢复' : '归档', icon: <HugeiconsIcon icon={Archive02Icon} size={20} />, dismiss: true }]} onCommit={(action) => action.id === 'delete' ? onDeleteTask(task.id) : onArchiveTask(task.id)} actionColor="var(--accent-primary)" drawerColor="var(--accent-secondary)" rowColor="var(--surface-muted)" textColor="var(--text-primary)" height={64} radius={32} actionWidth={80} direction="left" snapBounce={0.14} resistance={0.55} collapseMs={200} commitAt={0.6} fullSwipe><div className="flex h-full min-w-0 w-full items-center gap-2.5"><Circle className="h-4 w-4 shrink-0 text-[var(--border)]" aria-hidden="true" />{task.messages?.length ? <button type="button" onClick={() => onSelectTask(task)} className="min-w-0 flex-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--text-primary)]">{content}</button> : <Link href={task.href} onClick={onClose} className="min-w-0 flex-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--text-primary)]">{content}</Link>}</div></SwipeRow>
      })}</div>
      <UiverseButton type="button" onClick={() => { onNewConversation(); onClose?.() }} className="workbench-new-chat mx-4 mb-4 h-11 w-auto shrink-0 text-sm"><Plus className="h-4 w-4" aria-hidden="true" />新对话</UiverseButton>
    </aside>
  )
}

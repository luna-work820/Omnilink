'use client'

import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import {
  Check,
  ChevronRight,
  ArrowRight,
  Building2,
  FilePlus2,
  FolderPlus,
  Link2,
  Lock,
  MoreHorizontal,
  Plus,
  Save,
  Search,
  X,
} from 'lucide-react'
import { DEMO_PRODUCTS } from '@/lib/products/demo-data'
import themeTokens from '@/theme.json'
import Folder from './Folder'
import {
  OrganicCard,
  OrganicCardBand,
  OrganicCardBody,
  OrganicCardDescription,
  OrganicCardEyebrow,
  OrganicCardFooter,
  OrganicCardFooterIcon,
  OrganicCardFooterLabel,
  OrganicCardImage,
  OrganicCardTitle,
} from '@/components/ui/organic-card'
import {
  KNOWLEDGE_FILES_STORAGE_KEY,
  KNOWLEDGE_FILES_UPDATED_EVENT,
  createStoredKnowledgeFile,
  readStoredKnowledgeFiles,
  upsertStoredKnowledgeFiles,
  writeStoredKnowledgeFiles,
  type StoredKnowledgeFile,
} from '@/lib/knowledge/local-files'

type Note = StoredKnowledgeFile & {
  example?: boolean
  system?: boolean
}

type KnowledgeView = 'all' | 'uploaded' | 'system'
type SystemProfile = {
  merchantName: string
  legalName: string
  email: string
  phone: string
  region: string
  currency: string
  website: string
  description: string
  businessCategories: string
  customers: string
  salesChannels: string
  brandName: string
  tagline: string
  purpose: string
  positioning: string
  voice: string
  audience: string
  preferredTerms: string
  avoidedTerms: string
  colorPalette: string
  typography: string
  imagery: string
  guardrails: string
}

type FolderColor = keyof typeof APPLE_FOLDER_COLORS
type KnowledgeFolder = {
  id: string
  title: string
  color: string
  noteIds: string[]
}

const APPLE_FOLDER_COLORS = {
  red: { label: '红色', value: '#FF453A' },
  orange: { label: '橙色', value: '#FF9F0A' },
  yellow: { label: '黄色', value: '#FFD60A' },
  green: { label: '绿色', value: '#30D158' },
  blue: { label: '蓝色', value: themeTokens.colors.secondary },
  purple: { label: '紫色', value: '#BF5AF2' },
  pink: { label: '粉色', value: '#FF375F' },
} as const

const EXAMPLE_NOTES: Note[] = [
  {
    id: 'example-manual',
    title: '使用说明示例',
    excerpt: '把规格、使用方式和注意事项集中在一份可追溯的文件里。',
    date: '示例预览',
    kind: 'document',
    fileType: 'Markdown',
    tags: ['说明', '示例'],
    example: true,
    markdown: '# 使用说明示例\n\n把规格、使用方式和注意事项集中在一份可追溯的文件里。\n\n## 使用方式\n\n1. 从左侧选择文件。\n2. 在右侧阅读 Markdown 内容。\n3. 上传真实文件后替换示例预览。',
    parsedJson: { summary: '规格、使用方式和注意事项', sections: ['使用方式'], entities: [], sourceKind: 'markdown' },
  },
  {
    id: 'example-policy',
    title: '售后政策示例',
    excerpt: '把退换货条件、服务边界和处理流程集中在一份可追溯的文件里。',
    date: '示例预览',
    kind: 'document',
    fileType: 'Markdown',
    tags: ['服务', '示例'],
    example: true,
    markdown: '# 售后政策示例\n\n把退换货条件、服务边界和处理流程集中在一份可追溯的文件里。\n\n## 服务范围\n\n- 退换货条件\n- 响应时间\n- 处理流程',
    parsedJson: { summary: '退换货条件、服务边界和处理流程', sections: ['服务范围'], entities: [], sourceKind: 'markdown' },
  },
  {
    id: 'example-product-link',
    title: '产品资料关联示例',
    excerpt: '这份文件同时关联多个商品，方便在阅读资料时回到对应的商品主数据。',
    date: '示例预览',
    kind: 'document',
    fileType: 'Markdown',
    tags: ['商品关联', '示例'],
    example: true,
    linkedProducts: DEMO_PRODUCTS.slice(0, 2).map((product) => ({ id: product.id, name: product.name, imageUrl: product.image_url })),
    markdown: '# 产品资料关联示例\n\n这份文件同时关联多个商品，方便在阅读资料时回到对应的商品主数据。\n\n## 关联商品\n\n该文件关联首个商品主图和多个商品名称。',
    parsedJson: { summary: '文件关联首个商品主图和多个商品名称', sections: ['关联商品'], entities: ['product'], sourceKind: 'markdown' },
  },
]

const SYSTEM_NOTES: Note[] = [
  {
    id: 'system-merchant-profile',
    title: '商家信息',
    excerpt: '系统维护的商家名称、经营主体与基础资料，供 AI 在生成内容时引用。',
    date: '系统同步',
    kind: 'document',
    fileType: 'System',
    tags: ['系统', '商家'],
    system: true,
    markdown: '# 商家信息\n\n这是一份由系统维护的商家基础资料。\n\n- 商家：Omnilink 演示商家\n- 用途：内容生成与商品资料关联\n- 状态：已同步',
    parsedJson: { sourceKind: 'system', entity: 'merchant' },
  },
  {
    id: 'system-brand-style',
    title: '风格',
    excerpt: '系统维护的表达方式、视觉偏好与品牌语调，作为内容创作的稳定上下文。',
    date: '系统同步',
    kind: 'document',
    fileType: 'System',
    tags: ['系统', '风格'],
    system: true,
    markdown: '# 风格\n\n这是一份由系统维护的品牌策略、语言与视觉资料。\n\n- 语调：清晰、克制、可信\n- 视觉：简约、内容优先\n- 用途：AI 内容生成与资料理解',
    parsedJson: { sourceKind: 'system', entity: 'brand-style' },
  },
]

const SYSTEM_PROFILE_STORAGE_KEY = 'omnilink_system_profile_v1'
const DEFAULT_THEME_COLORS = ['#000000', '#569AE2', '#F4EFEB', '#DED6D1', '#7A7572']
const DEFAULT_SYSTEM_PROFILE: SystemProfile = {
  merchantName: 'Omnilink 演示商家',
  legalName: 'Omnilink Commerce Studio',
  email: 'hello@omnilink.local',
  phone: '+86 400 000 0000',
  region: '中国大陆',
  currency: 'CNY · 人民币',
  website: 'https://omnilink.local',
  description: '面向现代品牌的 AI 原生商业工作空间。',
  businessCategories: '商业协作、商品资料管理、内容生产',
  customers: '重视商品资料一致性与内容效率的品牌团队',
  salesChannels: '官方网站、内容渠道、商品详情页',
  brandName: 'Omnilink',
  tagline: '让商业信息保持清晰、可追溯和可复用。',
  purpose: '让每个品牌都能把商业信息沉淀为可复用、可追溯的工作资产。',
  positioning: '面向重视内容效率与商品资料一致性的品牌团队，提供 AI 原生的商业工作空间。',
  voice: '清晰、克制、可信',
  audience: '重视内容效率与商品资料一致性的品牌团队',
  preferredTerms: '清晰、可追溯、工作流、资料一致性',
  avoidedTerms: '颠覆性、革命性、无缝、业内领先',
  colorPalette: DEFAULT_THEME_COLORS.join(', '),
  typography: '现代无衬线；标题强调层级，正文保持克制易读',
  imagery: '真实商品细节、留白充足、低饱和背景',
  guardrails: '避免未经验证的效果承诺；优先陈述可解释的事实与流程。',
}

function parseThemeColors(value: string) {
  const colors = value.match(/#[0-9a-fA-F]{6}/g) ?? []
  return DEFAULT_THEME_COLORS.map((fallback, index) => colors[index]?.toUpperCase() ?? fallback)
}

function themeTextColor(color: string) {
  const [red, green, blue] = [1, 3, 5].map((start) => Number.parseInt(color.slice(start, start + 2), 16))
  return (red * 299 + green * 587 + blue * 114) / 1000 > 160 ? '#1C1C1C' : '#FFFFFF'
}

function readSystemProfile(): SystemProfile {
  if (typeof window === 'undefined') return DEFAULT_SYSTEM_PROFILE
  try {
    const raw = window.localStorage.getItem(SYSTEM_PROFILE_STORAGE_KEY)
    if (!raw) return DEFAULT_SYSTEM_PROFILE
    const parsed = JSON.parse(raw) as Partial<SystemProfile>
    return { ...DEFAULT_SYSTEM_PROFILE, ...parsed }
  } catch {
    return DEFAULT_SYSTEM_PROFILE
  }
}

function writeSystemProfile(profile: SystemProfile) {
  try {
    window.localStorage.setItem(SYSTEM_PROFILE_STORAGE_KEY, JSON.stringify(profile))
    return true
  } catch {
    return false
  }
}

const KNOWLEDGE_FOLDERS_STORAGE_KEY = 'omnilink_knowledge_folders_v1'
const INITIAL_FOLDERS: KnowledgeFolder[] = [{
  id: 'product-folder',
  title: '商品资料',
  color: 'blue',
  noteIds: EXAMPLE_NOTES.map((note) => note.id),
}]

function readStoredKnowledgeFolders(): KnowledgeFolder[] | null {
  try {
    const raw = window.localStorage.getItem(KNOWLEDGE_FOLDERS_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    return parsed.filter((folder): folder is KnowledgeFolder => {
      if (!folder || typeof folder !== 'object') return false
      const candidate = folder as Partial<KnowledgeFolder>
      return typeof candidate.id === 'string'
        && typeof candidate.title === 'string'
        && typeof candidate.color === 'string'
        && typeof candidate.color === 'string'
        && Array.isArray(candidate.noteIds)
        && candidate.noteIds.every((noteId) => typeof noteId === 'string')
    })
  } catch {
    return null
  }
}

function writeStoredKnowledgeFolders(folders: KnowledgeFolder[]) {
  try {
    window.localStorage.setItem(KNOWLEDGE_FOLDERS_STORAGE_KEY, JSON.stringify(folders))
    return true
  } catch {
    return false
  }
}

function mergeStoredNotes(storedNotes: StoredKnowledgeFile[]): Note[] {
  const storedIds = new Set(storedNotes.map((note) => note.id))
  return [...storedNotes, ...EXAMPLE_NOTES.filter((note) => !storedIds.has(note.id)), ...SYSTEM_NOTES]
}

function formatUpdatedAt(note: Note) {
  if (!note.updatedAt) return note.date
  const updatedAt = new Date(note.updatedAt)
  if (Number.isNaN(updatedAt.getTime())) return note.date
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(updatedAt)
}

function SystemInformationPanel({ note, onNotice }: { note: Note; onNotice: (message: string) => void }) {
  const [profile, setProfile] = useState<SystemProfile>(readSystemProfile)
  const isMerchantProfile = note.id === 'system-merchant-profile'
  const updateField = (field: keyof SystemProfile, value: string) => setProfile((current) => ({ ...current, [field]: value }))
  const themeColors = parseThemeColors(profile.colorPalette)
  const updateThemeColor = (index: number, value: string) => {
    const nextColors = [...themeColors]
    nextColors[index] = value.toUpperCase()
    updateField('colorPalette', nextColors.join(', '))
  }
  const saveProfile = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onNotice(writeSystemProfile(profile) ? '系统信息已保存' : '系统信息保存失败，请刷新后重试')
  }

  const fieldClass = 'mt-1 h-10 w-full rounded-sm border border-[#D6D6D3] bg-transparent px-3 text-sm text-[#37352F] outline-none transition-colors focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]'
  const textareaClass = 'mt-1 min-h-24 w-full resize-y rounded-sm border border-[#D6D6D3] bg-transparent px-3 py-2.5 text-sm leading-6 text-[#37352F] outline-none transition-colors focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]'
  const sectionClass = 'border-t border-[#E2E2E2] pt-5'
  const sectionTitleClass = 'text-sm font-semibold text-[#1C1C1C]'
  const sectionDescriptionClass = 'mt-1 text-xs leading-5 text-[#787774]'
  const labelClass = 'text-xs font-medium text-[#37352F]'

  return <article className="min-w-0 bg-transparent">
    <header className="border-b border-[#E2E2E2] px-6 pb-5 pt-5 sm:px-10">
      <div className="flex items-center justify-between gap-4"><div className="flex min-w-0 items-center gap-2 text-xs text-[#636363]"><Lock size={13} aria-hidden="true" /><span>系统信息 · 不可删除</span></div><span className="inline-flex items-center gap-1 text-xs text-[#636363]"><Building2 size={13} aria-hidden="true" />{isMerchantProfile ? '商家档案' : '品牌档案'}</span></div>
      <h2 className="mt-5 text-3xl font-bold tracking-[-0.04em]">{isMerchantProfile ? '商家信息' : '风格'}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#636363]">{isMerchantProfile ? '系统将这些字段用于商品资料、渠道配置与 AI 内容上下文。' : '系统将这些字段用于文案生成、视觉建议与资料理解。'}</p>
    </header>
    <form onSubmit={saveProfile} className="max-w-4xl px-6 py-7 sm:px-10">
      {isMerchantProfile ? <>
        <section aria-labelledby="merchant-identity" className={sectionClass}><h3 id="merchant-identity" className={sectionTitleClass}>商家主体</h3><p className={sectionDescriptionClass}>用于识别商家实体与对外联系信息。</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className={labelClass}>商家名称 <span className="text-[#B42318]">*</span><input required value={profile.merchantName} onChange={(event) => updateField('merchantName', event.target.value)} className={fieldClass} /></label><label className={labelClass}>经营主体 <span className="text-[#B42318]">*</span><input required value={profile.legalName} onChange={(event) => updateField('legalName', event.target.value)} className={fieldClass} /></label><label className={labelClass}>联系邮箱 <span className="text-[#B42318]">*</span><input required type="email" value={profile.email} onChange={(event) => updateField('email', event.target.value)} className={fieldClass} /></label><label className={labelClass}>联系电话<input value={profile.phone} onChange={(event) => updateField('phone', event.target.value)} className={fieldClass} /></label></div></section>
        <section aria-labelledby="merchant-operations" className={`mt-8 ${sectionClass}`}><h3 id="merchant-operations" className={sectionTitleClass}>经营范围</h3><p className={sectionDescriptionClass}>补充商品内容生成真正需要的业务范围与渠道上下文。</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className={labelClass}>经营品类<input value={profile.businessCategories} onChange={(event) => updateField('businessCategories', event.target.value)} className={fieldClass} /></label><label className={labelClass}>服务对象<input value={profile.customers} onChange={(event) => updateField('customers', event.target.value)} className={fieldClass} /></label><label className={`${labelClass} sm:col-span-2`}>销售渠道<input value={profile.salesChannels} onChange={(event) => updateField('salesChannels', event.target.value)} className={fieldClass} /></label><label className={`${labelClass} sm:col-span-2`}>商家简介<textarea value={profile.description} onChange={(event) => updateField('description', event.target.value)} className={textareaClass} /></label></div></section>
        <section aria-labelledby="merchant-settings" className={`mt-8 ${sectionClass}`}><h3 id="merchant-settings" className={sectionTitleClass}>站点设置</h3><p className={sectionDescriptionClass}>参考电商后台的地区、货币和网站默认配置。</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className={labelClass}>默认地区<select value={profile.region} onChange={(event) => updateField('region', event.target.value)} className={fieldClass}><option>中国大陆</option><option>中国香港</option><option>全球</option></select></label><label className={labelClass}>默认货币<select value={profile.currency} onChange={(event) => updateField('currency', event.target.value)} className={fieldClass}><option>CNY · 人民币</option><option>USD · 美元</option><option>HKD · 港币</option></select></label><label className={`${labelClass} sm:col-span-2`}>官方网站<input type="url" value={profile.website} onChange={(event) => updateField('website', event.target.value)} className={fieldClass} /></label></div></section>
      </> : <>
        <section aria-labelledby="brand-core" className={sectionClass}><h3 id="brand-core" className={sectionTitleClass}>品牌核心</h3><p className={sectionDescriptionClass}>用最少的字段，明确 AI 生成内容时必须理解的定位和边界。</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className={labelClass}>品牌名称 <span className="text-[#B42318]">*</span><input required value={profile.brandName} onChange={(event) => updateField('brandName', event.target.value)} className={fieldClass} /></label><label className={labelClass}>品牌短句<input value={profile.tagline} onChange={(event) => updateField('tagline', event.target.value)} className={fieldClass} /></label><label className={`${labelClass} sm:col-span-2`}>品牌使命<textarea value={profile.purpose} onChange={(event) => updateField('purpose', event.target.value)} className={textareaClass} /></label><label className={`${labelClass} sm:col-span-2`}>品牌定位<textarea value={profile.positioning} onChange={(event) => updateField('positioning', event.target.value)} className={textareaClass} /></label><label className={`${labelClass} sm:col-span-2`}>目标受众<textarea value={profile.audience} onChange={(event) => updateField('audience', event.target.value)} className={textareaClass} /></label></div></section>
        <section aria-labelledby="brand-language" className={`mt-8 ${sectionClass}`}><h3 id="brand-language" className={sectionTitleClass}>语言规则</h3><p className={sectionDescriptionClass}>用于商品详情、内容发布和服务沟通中的稳定表达。</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className={labelClass}>整体语气<input value={profile.voice} onChange={(event) => updateField('voice', event.target.value)} className={fieldClass} /></label><label className={labelClass}>常用词<input value={profile.preferredTerms} onChange={(event) => updateField('preferredTerms', event.target.value)} className={fieldClass} /></label><label className={`${labelClass} sm:col-span-2`}>避免使用的词<textarea value={profile.avoidedTerms} onChange={(event) => updateField('avoidedTerms', event.target.value)} className={textareaClass} /></label></div></section>
        <section aria-labelledby="brand-theme-colors" className={`mt-8 ${sectionClass}`}><h3 id="brand-theme-colors" className={sectionTitleClass}>主题色</h3><p className={sectionDescriptionClass}>用于生成内容中的重点色与视觉建议。点击色块即可修改，色值会随表单保存。</p><div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">{themeColors.map((color, index) => { const textColor = themeTextColor(color); return <label key={`${index}-${color}`} className="group relative flex h-24 min-w-0 cursor-pointer items-end overflow-hidden rounded-sm border border-black/10 p-2.5 shadow-[0_2px_6px_rgba(0,0,0,0.05)] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--primary)]" style={{ backgroundColor: color }}><span className="absolute left-0 top-0 px-2.5 py-2 text-[11px] font-medium" style={{ color: textColor }}>主题色 {index + 1}</span><input type="color" value={color} onChange={(event) => updateThemeColor(index, event.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label={`主题色 ${index + 1}，当前为 ${color}`} /><span className="relative font-mono text-xs font-semibold tracking-[0.04em]" style={{ color: textColor }}>{color.slice(1)}</span></label> })}</div></section>
        <section aria-labelledby="brand-guardrails" className={`mt-8 ${sectionClass}`}><h3 id="brand-guardrails" className={sectionTitleClass}>内容约束</h3><p className={sectionDescriptionClass}>记录必须遵守的表达限制，不把未经证实的信息写入生成内容。</p><label className={`mt-5 block ${labelClass}`}>必须遵守<textarea value={profile.guardrails} onChange={(event) => updateField('guardrails', event.target.value)} className={textareaClass} /></label></section>
      </>}
      <div className="mt-8 flex items-center justify-between border-t border-[#E2E2E2] pt-5"><p className="text-xs text-[#787774]">带 <span className="text-[#B42318]">*</span> 的字段为必填项。</p><button type="submit" className="ui-interactive flex h-10 items-center gap-2 rounded-[var(--radius-control)] bg-[var(--accent-primary)] px-4 text-sm font-medium text-white hover:bg-[var(--accent-primary-hover)] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-secondary)]"><Save size={15} aria-hidden="true" />保存系统信息</button></div>
    </form>
  </article>
}

function ProductLinkPanel({
  note,
  productResults,
  productQuery,
  setProductQuery,
  showMenu,
  setShowMenu,
  showPicker,
  setShowPicker,
  toggleProduct,
  addTag,
  removeTag,
}: {
  note: Note
  productResults: typeof DEMO_PRODUCTS
  productQuery: string
  setProductQuery: (value: string) => void
  showMenu: boolean
  setShowMenu: (value: boolean) => void
  showPicker: boolean
  setShowPicker: (value: boolean) => void
  toggleProduct: (productId: string) => void
  addTag: (tag: string) => void
  removeTag: (tag: string) => void
}) {
  const propertyRowClass = 'grid min-h-8 grid-cols-[110px_minmax(0,1fr)] gap-3 rounded-sm px-1 py-1 text-xs hover:bg-[#E8E8E6]/70'
  const [isEditingTags, setIsEditingTags] = useState(false)
  const [tagDraft, setTagDraft] = useState('')

  const commitTag = () => {
    const nextTag = tagDraft.trim()
    if (!nextTag) return
    addTag(nextTag)
    setTagDraft('')
  }

  return <section className="border-b border-[#E2E2E2] px-6 pb-5 sm:px-10">
    <p className="mb-1 text-[11px] font-medium text-[#A3A29E]">页面属性</p>
    <div className={`${propertyRowClass} items-center`}>
      <span className="text-[#787774]">文件类型</span>
      <span className="truncate text-[#37352F]">{note.fileType}</span>
    </div>
    <div className={`${propertyRowClass} items-center`}>
      <span className="text-[#787774]">更新时间</span>
      <time dateTime={note.updatedAt} className="truncate text-[#37352F]" title={note.updatedAt}>{formatUpdatedAt(note)}</time>
    </div>
    <div className={`${propertyRowClass} items-start`}>
      <span className="pt-1 text-[#787774]">标签</span>
      <span className="flex min-w-0 flex-wrap items-center gap-1.5">
        {note.tags.length ? note.tags.map((tag) => isEditingTags ? <span key={tag} className="inline-flex items-center gap-0.5 rounded-sm bg-[#E8E8E6] py-1 pl-1.5 pr-0.5 text-[#37352F]"><span>{tag}</span><button type="button" onClick={() => removeTag(tag)} className="flex h-4 w-4 items-center justify-center rounded-sm text-[#787774] hover:bg-[#D6D6D3] hover:text-[#37352F] focus-visible:outline-2 focus-visible:outline-[var(--primary)]" aria-label={`移除标签 ${tag}`}><X size={11} aria-hidden="true" /></button></span> : <span key={tag} className="rounded-sm bg-[#E8E8E6] px-1.5 py-1 text-[#37352F]">{tag}</span>) : <span className="py-1 text-[#A3A29E]">无标签</span>}
        {isEditingTags ? <><label className="sr-only" htmlFor="knowledge-tag-input">添加标签</label><input id="knowledge-tag-input" value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commitTag() } if (event.key === 'Escape') setIsEditingTags(false) }} placeholder="输入标签" className="h-7 w-24 border border-[#D6D6D3] bg-transparent px-1.5 text-xs outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]" /><button type="button" onClick={commitTag} disabled={!tagDraft.trim()} className="h-7 px-2 text-xs text-[var(--primary)] hover:bg-[#E8E8E6] focus-visible:outline-2 focus-visible:outline-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-40">添加</button><button type="button" onClick={() => { setIsEditingTags(false); setTagDraft('') }} className="h-7 px-2 text-xs text-[#636363] hover:bg-[#E8E8E6] focus-visible:outline-2 focus-visible:outline-[var(--primary)]">完成</button></> : <button type="button" onClick={() => setIsEditingTags(true)} className="flex h-7 items-center gap-1 px-1.5 text-xs text-[#787774] hover:bg-[#E8E8E6] hover:text-[#37352F] focus-visible:outline-2 focus-visible:outline-[var(--primary)]" aria-label="编辑标签"><Plus size={13} aria-hidden="true" />编辑</button>}
      </span>
    </div>
    {note.linkedProducts?.length ? <div className={`${propertyRowClass} items-start`}>
      <span className="flex items-center gap-1.5 pt-1 text-[#787774]"><Link2 size={13} aria-hidden="true" />商品链接</span>
      <span className="flex min-w-0 flex-wrap gap-1.5">{note.linkedProducts.map((product) => <span key={product.id || product.name} className="inline-flex max-w-full items-center gap-1 rounded-sm bg-[#E8E8E6] px-1.5 py-1 text-[#37352F]">{product.id ? <Link href={`/dashboard/products/${product.id}/edit`} className="max-w-[180px] truncate underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-[var(--primary)]">{product.name}</Link> : <span className="max-w-[180px] truncate">{product.name}</span>}{product.id && <button type="button" onClick={() => toggleProduct(product.id!)} className="text-[#787774] hover:text-[#37352F] focus-visible:outline-2 focus-visible:outline-[var(--primary)]" aria-label={`移除${product.name}`}><X size={12} /></button>}</span>)}</span>
    </div> : null}
    <div className="relative mt-0.5 min-h-8 px-1 py-1">
      <button type="button" onClick={() => { setShowMenu(!showMenu); setShowPicker(false) }} className="flex h-7 w-7 items-center justify-center rounded-sm text-[#A3A29E] hover:bg-[#E8E8E6] hover:text-[#37352F] focus-visible:outline-2 focus-visible:outline-[var(--primary)]" aria-label="添加页面属性"><Plus size={15} /></button>
      {showMenu && <div className="absolute left-1 top-9 z-20 w-48 rounded-md border border-[#D6D6D3] bg-[var(--surface)] p-1 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"><p className="px-2 py-1.5 text-[10px] text-[#A3A29E]">添加属性</p><button type="button" onClick={() => { setShowPicker(true); setShowMenu(false) }} className="flex min-h-9 w-full items-center gap-2 rounded-sm px-2 text-left text-xs hover:bg-[#E8E8E6] focus-visible:outline-2 focus-visible:outline-[var(--primary)]"><Link2 size={14} />商品链接</button></div>}
    </div>
    {showPicker && <div className="mt-2 max-w-xl rounded-md border border-[#D6D6D3] bg-[var(--surface)] p-2 shadow-[0_8px_24px_rgba(0,0,0,0.10)]"><div className="flex items-center justify-between px-1 py-1"><span className="text-xs font-medium text-[#37352F]">选择商品，可多选</span><button type="button" onClick={() => setShowPicker(false)} className="rounded-sm p-1 text-[#787774] hover:bg-[#E8E8E6] hover:text-[#37352F] focus-visible:outline-2 focus-visible:outline-[var(--primary)]" aria-label="关闭商品选择"><X size={15} /></button></div><label className="relative mt-1 block"><Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#787774]" /><span className="sr-only">搜索商品</span><input value={productQuery} onChange={(event) => setProductQuery(event.target.value)} placeholder="搜索商品名称或 SKU" className="h-9 w-full rounded-sm border border-[#D6D6D3] bg-transparent pl-8 pr-3 text-xs outline-none focus:border-[#A3A29E] focus:ring-1 focus:ring-[#A3A29E]" /></label><div className="mt-1 max-h-48 overflow-y-auto">{productResults.length ? productResults.map((product) => { const selected = note.linkedProducts?.some((item) => item.id === product.id); return <button key={product.id} type="button" onClick={() => toggleProduct(product.id)} className="flex min-h-10 w-full items-center gap-2 rounded-sm px-2 text-left hover:bg-[#E8E8E6] focus-visible:outline-2 focus-visible:outline-[var(--primary)]"><span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${selected ? 'border-[#37352F] bg-[#37352F] text-white' : 'border-[#B8B8B5]'}`}>{selected && <Check size={12} />}</span><span className="min-w-0 flex-1 truncate text-xs text-[#37352F]">{product.name}</span><span className="text-[10px] text-[#A3A29E]">{product.sku}</span></button> }) : <p className="px-2 py-4 text-xs text-[#787774]">没有匹配商品</p>}</div></div>}
  </section>
}

export function KnowledgeThreePane() {
  const [notes, setNotes] = useState<Note[]>([...EXAMPLE_NOTES, ...SYSTEM_NOTES])
  const [folders, setFolders] = useState<KnowledgeFolder[]>(INITIAL_FOLDERS)
  const [activeId, setActiveId] = useState('example-manual')
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<KnowledgeView>('all')
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null)
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [showMenu, setShowMenu] = useState(false)
  const [showCustomInfoMenu, setShowCustomInfoMenu] = useState(false)
  const [showProductPicker, setShowProductPicker] = useState(false)
  const [productQuery, setProductQuery] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [folderContextMenu, setFolderContextMenu] = useState<{ x: number; y: number; mode: 'menu' | 'create' | 'colors'; folderId?: string } | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderContextMenuRef = useRef<HTMLDivElement>(null)
  const folderNameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const syncNotes = () => setNotes(mergeStoredNotes(readStoredKnowledgeFiles()))
    const handleStorage = (event: StorageEvent) => {
      if (event.key === KNOWLEDGE_FILES_STORAGE_KEY) syncNotes()
    }
    const frameId = window.requestAnimationFrame(syncNotes)
    window.addEventListener(KNOWLEDGE_FILES_UPDATED_EVENT, syncNotes)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener(KNOWLEDGE_FILES_UPDATED_EVENT, syncNotes)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const storedFolders = readStoredKnowledgeFolders()
      if (storedFolders) setFolders(storedFolders)
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [])

  useEffect(() => {
    if (!folderContextMenu) return

    const closeMenu = () => setFolderContextMenu(null)
    const handlePointerDown = (event: PointerEvent) => {
      if (!folderContextMenuRef.current?.contains(event.target as Node)) closeMenu()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', closeMenu)
    window.addEventListener('scroll', closeMenu, true)

    const focusFrameId = window.requestAnimationFrame(() => {
      if (folderContextMenu.mode === 'create') folderNameInputRef.current?.focus()
    })

    return () => {
      window.cancelAnimationFrame(focusFrameId)
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', closeMenu)
      window.removeEventListener('scroll', closeMenu, true)
    }
  }, [folderContextMenu])

  const activeNote = notes.find((note) => note.id === activeId) || notes[0]
  const activeFolder = folders.find((folder) => folder.id === activeFolderId)
  const scopedNotes = useMemo(() => notes.filter((note) => {
    if (activeView === 'uploaded') return Boolean(note.uploadedAt)
    if (activeView === 'system') return Boolean(note.system)
    return true
  }), [activeView, notes])
  const filteredNotes = useMemo(() => scopedNotes.filter((note) => note.title.toLowerCase().includes(query.trim().toLowerCase())), [scopedNotes, query])
  const visibleNotes = activeFolder ? filteredNotes.filter((note) => activeFolder.noteIds.includes(note.id)) : filteredNotes
  const productResults = useMemo(() => DEMO_PRODUCTS.filter((product) => product.name.toLowerCase().includes(productQuery.trim().toLowerCase()) || product.sku.toLowerCase().includes(productQuery.trim().toLowerCase())), [productQuery])

  const persistNotes = (next: Note[]) => writeStoredKnowledgeFiles(next.filter((note) => !note.system).map((note) => ({ ...note, example: undefined })))

  const updateActiveNote = (update: (note: Note) => Note, failureNotice: string) => {
    if (!activeNote) return
    const updatedAt = new Date().toISOString()
    const next = notes.map((note) => note.id === activeNote.id ? { ...update(note), date: '刚刚更新', updatedAt } : note)
    setNotes(next)
    if (!persistNotes(next)) setNotice(failureNotice)
  }

  const toggleLinkedProduct = (productId: string) => {
    const product = DEMO_PRODUCTS.find((item) => item.id === productId)
    if (!product) return
    updateActiveNote((note) => {
      const currentProducts = note.linkedProducts || []
      const isLinked = currentProducts.some((item) => item.id === productId)
      return { ...note, linkedProducts: isLinked ? currentProducts.filter((item) => item.id !== productId) : [...currentProducts, { id: product.id, name: product.name, imageUrl: product.image_url }] }
    }, '关联保存失败，请刷新后重试')
  }

  const addActiveNoteTag = (tag: string) => {
    const normalizedTag = tag.trim()
    if (!normalizedTag || activeNote?.tags.includes(normalizedTag)) return
    updateActiveNote((note) => ({ ...note, tags: [...note.tags, normalizedTag] }), '标签保存失败，请刷新后重试')
  }

  const removeActiveNoteTag = (tag: string) => {
    updateActiveNote((note) => ({ ...note, tags: note.tags.filter((item) => item !== tag) }), '标签保存失败，请刷新后重试')
  }



  const handleNoteDragStart = (event: DragEvent<HTMLDivElement>, noteId: string) => {
    if (notes.find((note) => note.id === noteId)?.system) {
      event.preventDefault()
      return
    }
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', noteId)
    setDraggedNoteId(noteId)
  }

  const handleFolderDrop = (event: DragEvent<HTMLDivElement>, folderId: string) => {
    event.preventDefault()
    const noteId = event.dataTransfer.getData('text/plain')
    if (!noteId || !notes.some((note) => note.id === noteId && !note.system)) return
    const nextFolders = folders.map((folder) => folder.id === folderId ? { ...folder, noteIds: folder.noteIds.includes(noteId) ? folder.noteIds : [...folder.noteIds, noteId] } : folder)
    setFolders(nextFolders)
    const next = notes.map((note) => note.id === noteId ? { ...note, folderId } : note)
    setNotes(next)
    const saved = writeStoredKnowledgeFiles(next.filter((note) => !note.example)) && writeStoredKnowledgeFolders(nextFolders)
    setDragOverFolderId(null)
    setDraggedNoteId(null)
    setNotice(saved ? '文件已加入文件夹' : '文件夹变更保存失败，请刷新后重试')
  }

  const handleFolderColorChange = (folderId: string, color: FolderColor) => {
    const nextFolders = folders.map((folder) => folder.id === folderId ? { ...folder, color } : folder)
    setFolders(nextFolders)
    if (!writeStoredKnowledgeFolders(nextFolders)) setNotice('文件夹颜色保存失败，请刷新后重试')
  }

  const openFolderContextMenu = (x: number, y: number) => {
    setNewFolderName('')
    setFolderContextMenu({
      x: Math.max(8, Math.min(x, window.innerWidth - 248)),
      y: Math.max(8, Math.min(y, window.innerHeight - 190)),
      mode: 'menu',
    })
  }

  const handleFileAreaContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    openFolderContextMenu(event.clientX, event.clientY)
  }

  const handleFolderContextMenu = (event: React.MouseEvent<HTMLDivElement>, folderId: string) => {
    event.preventDefault()
    event.stopPropagation()
    const folder = folders.find((item) => item.id === folderId)
    if (!folder) return
    setFolderContextMenu({
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - 232)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - 152)),
      mode: 'colors',
      folderId,
    })
  }

  const handleFileAreaKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if ((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu') {
      event.preventDefault()
      const bounds = event.currentTarget.getBoundingClientRect()
      openFolderContextMenu(bounds.left + 24, Math.min(bounds.top + 24, bounds.bottom - 24))
    }
  }

  const handleCreateFolder = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const title = newFolderName.trim()
    if (!title) return
    const nextFolders: KnowledgeFolder[] = [...folders, {
      id: `folder-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      color: 'blue',
      noteIds: [],
    }]
    setFolders(nextFolders)
    setFolderContextMenu(null)
    setNewFolderName('')
    setActiveFolderId(null)
    setNotice(writeStoredKnowledgeFolders(nextFolders) ? '文件夹已创建' : '文件夹创建成功，但未能保存到本机')
  }

  const selectView = (view: KnowledgeView) => {
    setActiveView(view)
    setActiveFolderId(null)
  }

  const handleViewTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, view: KnowledgeView) => {
    const views: KnowledgeView[] = ['all', 'uploaded', 'system']
    const currentIndex = views.indexOf(view)
    const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!direction) return
    event.preventDefault()
    const nextView = views[(currentIndex + direction + views.length) % views.length]
    selectView(nextView)
    document.getElementById(`knowledge-view-${nextView}`)?.focus()
  }

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      if (file.type === 'application/pdf' || /\.zip$/i.test(file.name)) {
        const form = new FormData()
        form.set('file', file)
        const response = await fetch('/api/knowledge/uploads', { method: 'POST', body: form })
        const result = await response.json() as { error?: string; status?: string }
        if (!response.ok) throw new Error(result.error ?? '文件未通过安全检查')
      }
      const note = await createStoredKnowledgeFile(file)
      upsertStoredKnowledgeFiles([note])
      setNotes((current) => [note, ...current.filter((item) => item.id !== note.id)])
      setActiveId(note.id)
      setActiveFolderId(null)
      setActiveView('uploaded')
      setNotice('文件已加入当前空间')
    } catch {
      setNotice('文件处理失败，请重新选择')
    }
  }

  const handleCopyLink = async () => {
    if (!activeNote) return
    const link = activeNote.fileLink || `${window.location.origin}/dashboard/knowledge#${activeNote.id}`
    try {
      await navigator.clipboard.writeText(link)
      setNotice('文件链接已复制')
    } catch {
      setNotice('当前环境不支持复制链接')
    }
  }

  return (
    <main className="min-h-[calc(100vh-3rem)] bg-[var(--theme-warm-white)] p-0">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-[1600px] bg-transparent lg:grid-cols-[340px_minmax(0,1fr)]">

        <section className="min-w-0 border-b border-[#E2E2E2] bg-transparent lg:border-b-0 lg:border-r">
          <div className="border-b border-[#E2E2E2] bg-[var(--theme-warm-white)]">
            <div role="tablist" aria-label="知识库文件分类" className="grid grid-cols-3 items-end">
              {([
                ['all', '全部'],
                ['uploaded', '已上传'],
                ['system', '系统信息'],
              ] as const).map(([view, label]) => {
                const isActive = activeView === view
                return <button key={view} id={`knowledge-view-${view}`} type="button" role="tab" aria-selected={isActive} aria-controls="knowledge-file-grid" tabIndex={isActive ? 0 : -1} onClick={() => selectView(view)} onKeyDown={(event) => handleViewTabKeyDown(event, view)} className={`relative z-10 flex h-14 items-center justify-center px-2 text-[15px] font-semibold tracking-[-0.02em] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--primary)] active:scale-[0.98] ${isActive ? 'rounded-t-[26px] bg-[var(--theme-warm-white)] text-[#000000] shadow-[0_-1px_0_rgba(0,0,0,0.05)]' : 'text-[#7A7572] hover:bg-[var(--theme-warm-white)] hover:text-[#000000]'}`}><span className="truncate">{label}</span>{isActive ? <span className="absolute bottom-1.5 h-[3px] w-10 rounded-full bg-[#000000]" aria-hidden="true" /> : null}</button>
              })}
            </div>
            <div className="p-4 pt-3"><div className="flex items-center gap-2"><input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} /><label className="relative min-w-0 flex-1"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#636363]" /><span className="sr-only">搜索文件</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={activeView === 'system' ? '搜索系统信息' : '搜索文件'} className="h-11 w-full border border-[#D6D6D3] bg-transparent pl-9 pr-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]" /></label><button type="button" onClick={() => fileInputRef.current?.click()} className="ui-interactive flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-[var(--accent-secondary-soft)] text-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)] hover:text-white active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-secondary)]" aria-label="上传文件"><FilePlus2 size={18} /></button></div>{activeFolder && <div className="mt-3 flex items-center gap-2 text-xs"><button type="button" onClick={() => setActiveFolderId(null)} className="text-[var(--text-secondary)] underline-offset-2 hover:text-[var(--text-primary)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--primary)]">全部文件</button><ChevronRight size={12} className="text-[var(--text-secondary)]" /><span className="font-semibold text-[var(--text-primary)]">{activeFolder.title}</span></div>}</div>
          </div>
          <div id="knowledge-file-grid" data-testid="knowledge-file-grid" tabIndex={0} onContextMenu={handleFileAreaContextMenu} onKeyDown={handleFileAreaKeyDown} className="grid min-h-[300px] grid-cols-1 content-start items-stretch gap-4 p-3 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[var(--primary)]">{visibleNotes.length || (activeView === 'all' && !activeFolderId && folders.length) ? <>
            {activeView === 'all' && !activeFolderId && folders.map((folder) => {
              const folderMeta = APPLE_FOLDER_COLORS[folder.color as FolderColor]
                ?? Object.values(APPLE_FOLDER_COLORS).find(({ value }) => value.toLowerCase() === folder.color.toLowerCase())
                ?? APPLE_FOLDER_COLORS.blue
              const folderItems = folder.noteIds.flatMap((noteId) => {
                const note = notes.find((candidate) => candidate.id === noteId)
                return note ? [{
                  title: note.title,
                  description: note.excerpt,
                  image: note.linkedProducts?.[0]?.imageUrl,
                  noteId: note.id,
                }] : []
              })
              const displayItems = folderItems.length ? folderItems : [{ title: '暂无文件', description: '添加资料后会显示在这里' }]
              return <Folder
                key={folder.id}
                label={folder.title}
                items={displayItems}
                count={folderItems.length}
                mode="book"
                variant="solid"
                color={folderMeta.value}
                onContextMenu={(event) => handleFolderContextMenu(event, folder.id)}
                layout="row"
                tilt={0.55}
                theme="light"
                onItemClick={(item) => {
                  if (!item.noteId) return
                  setActiveView('all')
                  setActiveFolderId(folder.id)
                  if (item.noteId) setActiveId(item.noteId)
                }}
                onDragOver={(event) => { event.preventDefault(); setDragOverFolderId(folder.id) }}
                onDragLeave={() => setDragOverFolderId(null)}
                onDrop={(event) => handleFolderDrop(event, folder.id)}
                className={dragOverFolderId === folder.id ? 'ring-2 ring-[var(--accent-secondary)] ring-offset-2' : ''}
              />
            })}
            {visibleNotes.map((note) => {
              const imageProduct = note.linkedProducts?.find((product) => product.imageUrl)
              const isSelected = activeId === note.id
              const cardColor = isSelected ? 'var(--accent-secondary-soft)' : 'var(--surface-muted)'
              return <OrganicCard
                key={note.id}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                backgroundColor={cardColor}
                draggable={!note.system}
                onDragStart={(event) => handleNoteDragStart(event, note.id)}
                onDragEnd={() => { setDraggedNoteId(null); setDragOverFolderId(null) }}
                onClick={() => setActiveId(note.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setActiveId(note.id)
                  }
                }}
                className={`group ui-card ui-card--interactive relative flex h-full min-h-72 w-full flex-col overflow-hidden p-0 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-secondary)] ${note.system ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'} ${draggedNoteId === note.id ? 'opacity-50' : ''} ${isSelected ? 'ui-card--selected' : 'hover:bg-[var(--surface-muted)]'}`}
              >
                <OrganicCardBody className="min-h-0 p-4 pb-8">
                  <div>
                    {imageProduct?.imageUrl ? <OrganicCardImage src={imageProduct.imageUrl} alt={imageProduct.name} width={670} height={350} className="mb-5 aspect-[1.92/1] !h-auto w-full object-cover transition-transform duration-300 group-hover/organic-card:scale-[1.02]" /> : null}
                    <OrganicCardEyebrow className="mb-3 flex items-center justify-between gap-2">
                      <span className="truncate">{note.fileType}</span>
                      {isSelected ? <span className="inline-flex shrink-0 items-center gap-1 text-[var(--accent-secondary)]"><Check size={13} aria-hidden="true" />已选</span> : note.system ? <span className="inline-flex shrink-0 items-center gap-1"><Lock size={12} aria-hidden="true" />系统</span> : null}
                    </OrganicCardEyebrow>
                    <OrganicCardTitle className="mb-2 line-clamp-2 break-words text-2xl font-medium">{note.title}</OrganicCardTitle>
                    <OrganicCardDescription className="line-clamp-3 text-base leading-relaxed">{note.excerpt}</OrganicCardDescription>
                  </div>
                </OrganicCardBody>
                <OrganicCardBand />
                <OrganicCardFooter className="bottom-2 pl-4 pr-2">
                  <OrganicCardFooterLabel className="flex min-w-0 items-center gap-3 font-medium">
                    <span className="truncate">查看</span>
                    {note.linkedProducts?.length ? <span className="inline-flex shrink-0 items-center gap-1" title={`${note.linkedProducts.length} 个关联商品`}><Link2 size={13} aria-hidden="true" /><span>{note.linkedProducts.length}</span></span> : null}
                  </OrganicCardFooterLabel>
                  <OrganicCardFooterIcon>
                    <ArrowRight className="size-3" />
                  </OrganicCardFooterIcon>
                </OrganicCardFooter>
              </OrganicCard>
            })}</> : <div className="px-3 py-10 text-center text-sm text-[var(--text-secondary)]"><p className="font-semibold text-[var(--text-primary)]">{activeView === 'uploaded' ? '还没有上传文件' : activeView === 'system' ? '没有匹配系统信息' : '没有匹配文件'}</p><p className="mt-1 leading-5">{activeView === 'uploaded' ? '使用右上角按钮上传第一个文件。' : '换一个关键词或清空搜索条件。'}</p></div>}</div>
        </section>

        <article className="min-w-0 bg-transparent">
          {activeNote ? activeNote.system ? <SystemInformationPanel note={activeNote} onNotice={setNotice} /> : <>
            <header className="px-6 pb-4 pt-5 sm:px-10">
              <div className="flex items-center justify-between gap-4 text-xs text-[#636363]">
              <div className="flex min-w-0 items-center gap-1 truncate">
                <span className="truncate">{activeNote.title}</span>
              </div>
                <div className="relative">
                  <button type="button" onClick={() => setShowMenu((value) => !value)} className="flex min-h-10 min-w-10 items-center justify-center rounded-sm hover:bg-[#F2F2F0] focus-visible:outline-2 focus-visible:outline-[#024AD8]" aria-label="打开文件菜单"><MoreHorizontal size={18} /></button>
                  {showMenu && <div className="absolute right-0 top-11 z-20 w-40 border border-[#E2E2E2] bg-[#F2F2F0] p-1 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"><button type="button" onClick={() => { setNotice('文件已标记为重点'); setShowMenu(false) }} className="w-full px-3 py-2 text-left text-xs hover:bg-[#E8E8E6] focus-visible:outline-2 focus-visible:outline-[#024AD8]">标记重点</button><button type="button" onClick={() => { void handleCopyLink(); setShowMenu(false) }} className="w-full px-3 py-2 text-left text-xs hover:bg-[#E8E8E6] focus-visible:outline-2 focus-visible:outline-[#024AD8]">复制文件链接</button></div>}
                </div>
              </div>
              <h2 className="mt-7 break-words text-3xl font-bold tracking-[-0.04em]">{activeNote.title}</h2>
            </header>
            <ProductLinkPanel note={activeNote} productResults={productResults} productQuery={productQuery} setProductQuery={setProductQuery} showMenu={showCustomInfoMenu} setShowMenu={setShowCustomInfoMenu} showPicker={showProductPicker} setShowPicker={setShowProductPicker} toggleProduct={toggleLinkedProduct} addTag={addActiveNoteTag} removeTag={removeActiveNoteTag} />
            <div className="border-b border-[#E2E2E2] px-6 py-3 sm:px-10"><span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#636363]">Markdown preview</span></div>
            <div className="max-w-3xl px-6 py-8 sm:px-10"><div className="prose prose-neutral max-w-none text-[#3F3F3F] prose-headings:font-bold prose-headings:tracking-[-0.03em] prose-p:leading-7 prose-li:leading-7"><ReactMarkdown>{activeNote.markdown}</ReactMarkdown></div></div>
          </> : <div className="flex min-h-full items-center justify-center p-8 text-sm text-[#636363]">选择一个文件查看内容</div>}
          {notice && <div role="status" className="fixed bottom-5 right-5 z-20 flex items-center gap-2 rounded-md bg-[#1C1C1C] px-4 py-3 text-sm text-white shadow-lg"><Check size={16} /><span>{notice}</span><button type="button" onClick={() => setNotice(null)} className="ml-2 text-white/70 hover:text-white focus-visible:outline-2 focus-visible:outline-white" aria-label="关闭提示">×</button></div>}
        </article>
      </div>
      {folderContextMenu && <div ref={folderContextMenuRef} role={folderContextMenu.mode === 'menu' || folderContextMenu.mode === 'colors' ? 'menu' : undefined} aria-label={folderContextMenu.mode === 'colors' ? '选择文件夹颜色' : '文件区操作'} style={{ left: folderContextMenu.x, top: folderContextMenu.y }} className={`ui-card--floating fixed z-50 p-1 ${folderContextMenu.mode === 'colors' ? 'w-56' : 'w-60 border border-[var(--border-subtle)]'}`}>
        {folderContextMenu.mode === 'menu' ? <button type="button" role="menuitem" autoFocus onClick={() => setFolderContextMenu((current) => current ? { ...current, mode: 'create' } : current)} className="flex h-10 w-full items-center gap-2 px-3 text-left text-sm text-[#37352F] hover:bg-[#E8E8E6] focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[var(--primary)]"><FolderPlus size={16} aria-hidden="true" />新建文件夹</button> : null}
        {folderContextMenu.mode === 'colors' ? (() => {
          const folder = folders.find((item) => item.id === folderContextMenu.folderId)
          const selectedColor = folder
            ? (Object.entries(APPLE_FOLDER_COLORS).find(([key, option]) => key === folder.color || option.value.toLowerCase() === folder.color.toLowerCase())?.[0] ?? 'blue')
            : 'blue'
          return <div className="p-2">
            <p className="mb-2 truncate text-xs font-medium text-[var(--text-secondary)]">{folder?.title ?? '文件夹颜色'}</p>
            <div className="grid grid-cols-4 gap-2" role="group" aria-label="文件夹颜色">
              {Object.entries(APPLE_FOLDER_COLORS).map(([key, option]) => {
                const selected = key === selectedColor
                return <button key={key} type="button" role="menuitemradio" aria-checked={selected} aria-label={`切换为${option.label}`} title={option.label} autoFocus={selected} onClick={() => {
                  if (folder) handleFolderColorChange(folder.id, key as FolderColor)
                  setFolderContextMenu(null)
                }} className={`flex h-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-secondary)] ${selected ? 'bg-[var(--surface-muted)]' : 'bg-[var(--surface)]'}`}>
                  <span className="flex h-4 w-4 items-center justify-center rounded-full border border-black/10" style={{ backgroundColor: option.value }}>{selected && <Check size={11} className="text-white drop-shadow" aria-hidden="true" />}</span>
                </button>
              })}
            </div>
          </div>
        })() : folderContextMenu.mode === 'create' ? <form onSubmit={handleCreateFolder} className="p-2">
          <label htmlFor="new-knowledge-folder" className="text-xs font-medium text-[#37352F]">文件夹名称</label>
          <input ref={folderNameInputRef} id="new-knowledge-folder" value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} maxLength={40} placeholder="未命名文件夹" className="mt-2 h-9 w-full border border-[#D6D6D3] bg-transparent px-2.5 text-sm outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]" />
          <div className="mt-2 flex items-center justify-end gap-2"><button type="button" onClick={() => setFolderContextMenu(null)} className="h-9 border border-[#D6D6D3] px-3 text-xs text-[#636363] hover:bg-[#E8E8E6] focus-visible:outline-2 focus-visible:outline-[var(--primary)]">取消</button><button type="submit" disabled={!newFolderName.trim()} className="h-9 bg-[var(--primary)] px-3 text-xs font-medium text-white hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-40">创建</button></div>
        </form> : null}
      </div>}
    </main>
  )
}

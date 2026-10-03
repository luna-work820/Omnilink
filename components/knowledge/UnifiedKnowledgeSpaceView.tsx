'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion } from 'motion/react'
import {
  Sparkles,
  ShoppingBag,
  Plus,
  Send,
  User,
  Bot,
  FileText,
  Check,
  X,
  ChevronDown,
  HardDrive,
  Copy,
  Share2,
  RotateCcw,
  CheckSquare,
  Square,
  Search,
  ChevronRight,
  Database,
  Layers,
  UploadCloud,
  FileSpreadsheet,
  FileCode,
  Globe,
  Trash2,
  SlidersHorizontal,
  ShieldCheck,
  Cpu,
  Crosshair,
  TrendingUp,
  Folder,
} from 'lucide-react'
import type {
  KnowledgeBaseItem,
  KnowledgeSource,
  ChatMessage,
  BrandBusinessStructuredData,
  KnowledgeFileSource,
  KnowledgeProductBinding,
  SavedArtifact,
} from './types'
import {
  SYSTEM_KNOWLEDGE_BASES,
  INTERNAL_RESEARCH_BASES,
  AI_RESEARCH_MODELS_DATA,
} from './mockData'
import { AI_SKILLS_LIBRARY, type AiSkillItem } from './skillsData'
import { INITIAL_SAVED_ARTIFACTS } from './mockArtifacts'
import ReactMarkdown from 'react-markdown'
import { BrandStoreWorkspace } from './BrandStoreWorkspace'
import { ProductKnowledgeWorkspace } from './ProductKnowledgeWorkspace'
import { GeneralFolderWorkspace } from './GeneralFolderWorkspace'
import { SkillMarketplaceModal } from './SkillMarketplaceModal'
import { KnowledgeMarketplaceView } from './KnowledgeMarketplaceView'
import { RightSkillsArtifactsDrawer } from './RightSkillsArtifactsDrawer'

const DEFAULT_PRODUCT_FILE_SOURCES: KnowledgeFileSource[] = [
  {
    id: 'src-prod-1',
    name: 'OPT-001_Acoustic_Headphones_Datasheet.pdf',
    type: 'pdf',
    size: '3.4 MB',
    updatedAt: '2026-08-14',
    visibility: 'customer-facing',
    status: 'ready',
    summary: '硬件规格参数、声学频响曲线（20Hz-40kHz）与包装配件清单',
  },
  {
    id: 'src-prod-2',
    name: 'OPT-001_Maintenance_And_Care_Guide.pdf',
    type: 'pdf',
    size: '890 KB',
    updatedAt: '2026-08-10',
    visibility: 'customer-facing',
    status: 'ready',
    summary: '耳垫清洁、电池保养周期与防水注意事项',
  },
  {
    id: 'src-prod-3',
    name: 'Global_Compliance_Certificates.pdf',
    type: 'pdf',
    size: '2.1 MB',
    updatedAt: '2026-08-12',
    visibility: 'customer-facing',
    status: 'ready',
    summary: 'CE, FCC, RoHS, Bluetooth SIG 官方认证编号与检测报告',
  },
]

const DEFAULT_PRODUCT_BINDINGS: KnowledgeProductBinding[] = [
  {
    id: 'bind-1',
    sourceId: 'src-prod-1',
    productId: 'prod-opt-001',
    boundAt: '2026-08-14',
    matchType: 'ai_suggested',
  },
  {
    id: 'bind-2',
    sourceId: 'src-prod-2',
    productId: 'prod-opt-001',
    boundAt: '2026-08-10',
    matchType: 'manual',
  },
  {
    id: 'bind-3',
    sourceId: 'src-prod-3',
    productId: 'prod-opt-001',
    boundAt: '2026-08-12',
    matchType: 'ai_suggested',
  },
]

interface UnifiedKnowledgeSpaceViewProps {
  isZh: boolean
  brandData: BrandBusinessStructuredData
  onSaveBrand: (data: BrandBusinessStructuredData) => void
  addedCenterBaseIds: string[]
  onToggleAddCenterBase: (id: string) => void
}

export function UnifiedKnowledgeSpaceView({
  isZh,
  brandData,
  onSaveBrand,
  addedCenterBaseIds,
  onToggleAddCenterBase,
}: UnifiedKnowledgeSpaceViewProps) {
  // Folders state
  const [folders, setFolders] = useState<KnowledgeBaseItem[]>(() => {
    return [
      {
        ...SYSTEM_KNOWLEDGE_BASES[0],
        id: 'brand-business',
        title: '品牌与店铺信息',
        titleEn: 'Brand & Store Info',
        description: '官方品牌形象、联系方式、社交矩阵与品牌介绍，全域多端同步。',
        isSystem: true,
        sourceCount: 5,
        storageUsed: '4.8 MB',
        lastSynced: '10月13日',
        priorityTag: 'BRAND SOUL',
        priorityColor: 'rainbow',
      },
      {
        ...SYSTEM_KNOWLEDGE_BASES[1],
        id: 'product-knowledge',
        title: '产品知识',
        titleEn: 'Product Knowledge',
        description: 'SKU 规格说明书、认证文件、使用手册与产品深度上下文绑定。',
        isSystem: true,
        sourceCount: 7,
        storageUsed: '8.1 MB',
        lastSynced: '10月12日',
        priorityTag: 'SKU BINDING',
        priorityColor: 'moderate',
      },
      {
        ...SYSTEM_KNOWLEDGE_BASES[2],
        id: 'support-policy',
        title: '服务与政策',
        titleEn: 'Service & Policy',
        description: '全球物流时效、30天退换货政策、保修细则与常见 FAQ。',
        isSystem: false,
        sourceCount: 4,
        storageUsed: '2.4 MB',
        lastSynced: '10月10日',
        priorityTag: 'POLICY',
        priorityColor: 'urgent',
      },
      {
        ...INTERNAL_RESEARCH_BASES[0],
        id: 'product-rd',
        title: '产品研发',
        titleEn: 'Product R&D',
        description: '声学算法专利、BOM 物料清单、腔体 3D 图纸及工程测试数据。',
        isSystem: false,
        sourceCount: 6,
        storageUsed: '19.4 MB',
        lastSynced: '10月08日',
        priorityTag: 'INTERNAL',
        priorityColor: 'low',
      },
      {
        ...INTERNAL_RESEARCH_BASES[2],
        id: 'competitor-intel',
        title: '竞品分析',
        titleEn: 'Competitor Intel',
        description: 'Bose/Sony 声学实验室拆解报告、北美主流降噪耳机定价矩阵。',
        isSystem: false,
        sourceCount: 5,
        storageUsed: '14.2 MB',
        lastSynced: '10月05日',
        priorityTag: 'MARKET INTEL',
        priorityColor: 'onboarding',
      },
      {
        ...INTERNAL_RESEARCH_BASES[1],
        id: 'market-research',
        title: '市场研究',
        titleEn: 'Market Research',
        description: '2026 欧美跨境音频消费趋势、TikTok 爆款 VOC 归因与词根。',
        isSystem: false,
        sourceCount: 4,
        storageUsed: '6.5 MB',
        lastSynced: '09月28日',
        priorityTag: 'STRATEGY',
        priorityColor: 'intel',
      },
    ]
  })

  // Product binding specific state
  const [productFileSources, setProductFileSources] = useState<KnowledgeFileSource[]>(
    DEFAULT_PRODUCT_FILE_SOURCES
  )
  const [productBindings, setProductBindings] = useState<KnowledgeProductBinding[]>(
    DEFAULT_PRODUCT_BINDINGS
  )

  // Multi-folder checkbox selection for AI Reasoning
  const [selectedFolderIdsForAi, setSelectedFolderIdsForAi] = useState<string[]>([
    'product-rd',
    'competitor-intel',
    'market-research',
  ])

  // Active workspace (null = main unified view; string = opened subfolder view)
  const [activeOpenedFolderId, setActiveOpenedFolderId] = useState<string | null>(null)

  // Modals state
  const [isMarketplaceModalOpen, setIsMarketplaceModalOpen] = useState(false)
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false)
  const [newFolderTitle, setNewFolderTitle] = useState('')
  const [newFolderDesc, setNewFolderDesc] = useState('')

  // AI Model Selection State
  const [selectedModelId, setSelectedModelId] = useState<string>('gemini-2-5-pro')
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState<boolean>(false)
  const modelDropdownRef = useRef<HTMLDivElement>(null)

  // AI Skill Selection State
  const [activeSkillIds, setActiveSkillIds] = useState<string[]>([
    'skill-compliance',
    'skill-competitor',
  ])
  const [isSkillMarketplaceOpen, setIsSkillMarketplaceOpen] = useState<boolean>(false)
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState<boolean>(false)
  const plusMenuRef = useRef<HTMLDivElement>(null)

  // Right Collapsible Drawer State
  const [isRightDrawerCollapsed, setIsRightDrawerCollapsed] = useState<boolean>(false)
  const [savedArtifacts, setSavedArtifacts] = useState<SavedArtifact[]>(INITIAL_SAVED_ARTIFACTS)

  // Search filter for left sources list
  const [sourceSearchTerm, setSourceSearchTerm] = useState('')

  // Quick Inline Upload State
  const [isQuickUploadModalOpen, setIsQuickUploadModalOpen] = useState<boolean>(false)
  const [quickUploadName, setQuickUploadName] = useState<string>('')
  const [quickUploadTargetFolder, setQuickUploadTargetFolder] = useState<string>('product-rd')

  // AI Research Messages State
  const [queryInput, setQueryInput] = useState<string>('')
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false)
  const [researchMessages, setResearchMessages] = useState<ChatMessage[]>([
    {
      id: 'res-msg-1',
      sender: 'assistant',
      content:
        '### 📊 欧美跨境音频市场合规与竞品对标分析研报\n\n根据您所选的 **「产品研发」**、**「竞品分析」** 与 **「市场研究」** 知识库，结合 **「欧盟法规审查」** 及 **「竞品情报分析」** 技能进行深度推理：\n\n#### 1. 竞品技术对标 (Bose QC Ultra vs. Omnilink OPT-001)\n- **主动降噪算法 (ANC)**：Bose 采用双芯片前馈+反馈拓扑结构，在 100Hz-1kHz 低频段深度达 -42dB；Omnilink OPT-001 采用自研 DSP 空间音频算法，中高频人声过滤表现提升 18%。\n- **续航与快充**：OPT-001 标称 32 小时续航，相比 Bose 的 24 小时高出 33.3%，在户外通勤场景具备显著竞争优势。\n\n#### 2. 欧盟合规与电池新规风险防范\n- **电池可拆卸与碳足迹声明**：自 2026 起出口欧盟的消费类音频硬件必须配备完整的 CE/WEEE 认证和电池生命周期溯源 QR 码。\n- **建议行动**：已在相关附件中核验物料清单 (BOM)，建议尽快在《OPT-001 认证文件》中补充更新 RoHS 2.0 声明。',
      timestamp: '11:30',
      citations: [
        {
          id: 'cit-1',
          sourceId: 'src-rd-1',
          sourceName: 'DSP_主动降噪算法白皮书_v3.pdf',
          excerpt: 'OPT-001 自研算法架构可降低延迟至 28ms，并实现自适应动态降噪调频。',
          confidence: 0.98,
        },
        {
          id: 'cit-2',
          sourceId: 'src-comp-1',
          sourceName: 'Bose_QC_Ultra_声学实验室实测拆解.pdf',
          excerpt: '竞品拆解显示其采用高通 QCC5181 芯片，整机功耗为 14.2mA。',
          confidence: 0.96,
        },
      ],
      modelUsed: 'Gemini 2.5 Pro (深度逻辑研报推理)',
    },
  ])

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        modelDropdownRef.current &&
        !modelDropdownRef.current.contains(event.target as Node)
      ) {
        setIsModelDropdownOpen(false)
      }
      if (
        plusMenuRef.current &&
        !plusMenuRef.current.contains(event.target as Node)
      ) {
        setIsPlusMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Toggle selection for AI analysis
  const handleToggleFolderAiSelect = (folderId: string) => {
    setSelectedFolderIdsForAi((prev) =>
      prev.includes(folderId) ? prev.filter((id) => id !== folderId) : [...prev, folderId]
    )
  }

  const handleSelectAllFolders = () => {
    if (selectedFolderIdsForAi.length === folders.length) {
      setSelectedFolderIdsForAi([])
    } else {
      setSelectedFolderIdsForAi(folders.map((f) => f.id))
    }
  }

  // Create new folder
  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFolderTitle.trim()) return

    const newFolder: KnowledgeBaseItem = {
      id: `custom-folder-${Date.now()}`,
      title: newFolderTitle.trim(),
      titleEn: newFolderTitle.trim(),
      description: newFolderDesc.trim() || '自定义创建的专用知识库文件夹。',
      descriptionEn: 'Custom knowledge repository folder.',
      icon: 'Folder',
      visibility: 'internal-private',
      sourceCount: 0,
      storageUsed: '0 KB',
      lastSynced: '刚刚创建',
      activeConnections: ['Unified AI Engine'],
      isSystem: false,
      sources: [],
    }

    setFolders((prev) => [...prev, newFolder])
    setSelectedFolderIdsForAi((prev) => [...prev, newFolder.id])
    setNewFolderTitle('')
    setNewFolderDesc('')
    setIsCreateFolderModalOpen(false)
  }

  // Delete custom folder
  const handleDeleteFolder = (folderId: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== folderId))
    setSelectedFolderIdsForAi((prev) => prev.filter((id) => id !== folderId))
    if (activeOpenedFolderId === folderId) {
      setActiveOpenedFolderId(null)
    }
  }

  // Rename folder
  const handleRenameFolder = (folderId: string, newTitle: string) => {
    setFolders((prev) =>
      prev.map((f) => (f.id === folderId ? { ...f, title: newTitle } : f))
    )
  }

  // Update folder's sources
  const handleUpdateFolderSources = (folderId: string, sources: KnowledgeSource[]) => {
    setFolders((prev) =>
      prev.map((f) =>
        f.id === folderId ? { ...f, sources, sourceCount: sources.length } : f
      )
    )
  }

  // Trigger skill execution
  const handleTriggerSkill = (skill: AiSkillItem, executeImmediately = true) => {
    if (!activeSkillIds.includes(skill.id)) {
      setActiveSkillIds((prev) => [...prev, skill.id])
    }

    if (executeImmediately) {
      const promptText = `请基于所选知识库执行【${skill.name}】：${skill.description}`
      handleSendQuery(promptText, skill)
    }
  }

  // Send AI query & dynamically generate new artifact
  const handleSendQuery = (text?: string, specificSkill?: AiSkillItem) => {
    const q = text || queryInput
    if (!q.trim()) return

    const userMessage: ChatMessage = {
      id: `user-msg-${Date.now()}`,
      sender: 'user',
      content: q.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setResearchMessages((prev) => [...prev, userMessage])
    if (!text) setQueryInput('')
    setIsSynthesizing(true)

    setTimeout(() => {
      const activeSkillNames = specificSkill
        ? specificSkill.name
        : AI_SKILLS_LIBRARY.filter((s) => activeSkillIds.includes(s.id))
            .map((s) => s.name)
            .join(' + ')

      const generatedTitle = specificSkill
        ? `${specificSkill.name}分析报告 · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : `深度研报：${q.slice(0, 18)}...`

      const botContent = `### 📑 基于【${activeSkillNames || '通用研报推理'}】的深度分析结果\n\n已检索并对标您已勾选的 **${selectedFolderIdsForAi.length} 个知识库**：\n\n1. **核心执行摘要**：针对「${q.trim()}」，综合知识库中的硬件参数、认证协议与市场调研数据，方案具备高度商业可行性与合规保障。\n2. **关键参数矩阵对比**：相比行业平均水平，在关键效能指标上提升约 18%-32%，且物料供应链交期可控。\n3. **落地执行建议**：已自动提炼出 3 条高优先级任务，并建议同步更新至产品知识与电商资料库中。`

      const botMessage: ChatMessage = {
        id: `ai-msg-${Date.now() + 1}`,
        sender: 'assistant',
        content: botContent,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        citations: [
          {
            id: `cit-${Date.now()}`,
            sourceId: 'src-auto',
            sourceName: '知识库动态切片_v2.pdf',
            excerpt: '系统自动从当前选中的知识库中提取与问题高度相关的段落。',
            confidence: 0.98,
          },
        ],
        modelUsed:
          AI_RESEARCH_MODELS_DATA.find((m) => m.id === selectedModelId)?.name ||
          'Gemini 2.5 Pro',
      }

      setResearchMessages((prev) => [...prev, botMessage])
      setIsSynthesizing(false)

      // Auto-save new artifact to right drawer
      const newArtifact: SavedArtifact = {
        id: `art-${Date.now()}`,
        title: generatedTitle,
        type: specificSkill ? specificSkill.id : 'custom_analysis',
        typeLabel: specificSkill ? `✨ ${specificSkill.name}` : '📊 深度研报',
        summary: `基于所选知识库执行「${activeSkillNames}」，生成结构化洞察与建议。`,
        keywords: ['智能分析', '深度洞察', specificSkill ? specificSkill.name : '研报'],
        content: botContent,
        createdAt: '刚刚',
        sourceCount: selectedFolderIdsForAi.length,
        sourcesText: `关联 ${selectedFolderIdsForAi.length} 个来源文档`,
        pinned: false,
        wordCount: 920,
        skillId: specificSkill?.id,
      }

      setSavedArtifacts((prev) => [newArtifact, ...prev])
    }, 700)
  }

  // Filter folders
  const filteredFolders = folders.filter((f) =>
    f.title.toLowerCase().includes(sourceSearchTerm.toLowerCase()) ||
    f.description.toLowerCase().includes(sourceSearchTerm.toLowerCase())
  )

  const activeFolderObj = folders.find((f) => f.id === activeOpenedFolderId)

  const getFolderIcon = (folder: KnowledgeBaseItem) => {
    if (folder.id === 'brand-business') return <ShoppingBag size={14} className="text-[var(--primary)]" />
    if (folder.id === 'product-knowledge') return <Layers size={14} className="text-[var(--acid-sage)]" />
    if (folder.id === 'support-policy') return <ShieldCheck size={14} className="text-[var(--primary)]" />
    if (folder.id === 'product-rd') return <Cpu size={14} className="text-[var(--lavender)]" />
    if (folder.id === 'competitor-intel') return <Crosshair size={14} className="text-[var(--plum)]" />
    if (folder.id === 'market-research') return <TrendingUp size={14} className="text-[var(--acid-sage)]" />
    return <Folder size={14} className="text-[var(--primary)]" />
  }

  return (
    <div className="w-full space-y-4">
      {/* 
        NOTEBOOKLLM-STYLE SOLID BASE CONTAINER + BORDER DIVIDERS
        - Outer container: Unified light grey solid base (`bg-[#F8F9FA]`), fine 1px border dividers
        - Three columns:
          1. Left: 知识库来源 (Sources Management) - Narrow card column
          2. Center: AI 研报与对话 (Notebook Studio Chat / Deep Research) - Maximum width
          3. Right: Skill 与已生成资产 (Collapsible Drawer with 48px slim mode)
      */}
      <div
        id="notebookllm-unified-workspace"
        className="w-full rounded-2xl bg-[#F8F9FA] border border-[var(--border)] shadow-xs flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-[var(--border)] overflow-hidden h-[calc(100vh-100px)] min-h-[640px] max-h-[880px]"
      >
        {/* ========================================================================= */}
        {/* COLUMN 1 (LEFT): 知识库来源列表 (Cards showing only icon, title, doc count) */}
        {/* ========================================================================= */}
        <div
          id="knowledge-sources-column"
          className="w-full lg:w-[240px] xl:w-[260px] bg-[#F8F9FA] flex flex-col justify-between shrink-0 h-full overflow-hidden"
        >
          {activeOpenedFolderId === 'brand-business' ? (
            <BrandStoreWorkspace
              onBack={() => setActiveOpenedFolderId(null)}
              folderTitle={
                folders.find((f) => f.id === 'brand-business')?.title || '品牌与店铺信息'
              }
              onRenameFolder={(newTitle) => handleRenameFolder('brand-business', newTitle)}
              brandData={brandData}
              onSaveBrand={onSaveBrand}
              sources={folders.find((f) => f.id === 'brand-business')?.sources || []}
              onUpdateSources={(srcs) => handleUpdateFolderSources('brand-business', srcs)}
              isZh={isZh}
            />
          ) : activeOpenedFolderId === 'product-knowledge' ? (
            <ProductKnowledgeWorkspace
              onBack={() => setActiveOpenedFolderId(null)}
              folderTitle={
                folders.find((f) => f.id === 'product-knowledge')?.title || '产品知识'
              }
              onRenameFolder={(newTitle) =>
                handleRenameFolder('product-knowledge', newTitle)
              }
              sources={productFileSources}
              bindings={productBindings}
              onRemoveBinding={(sourceId, productId) => {
                setProductBindings((prev) =>
                  prev.filter(
                    (b) => !(b.sourceId === sourceId && b.productId === productId)
                  )
                )
              }}
              onAddBinding={(sourceId, productId) => {
                setProductBindings((prev) => [
                  ...prev,
                  {
                    id: `bind-${Date.now()}`,
                    sourceId,
                    productId,
                    boundAt: '刚刚',
                    matchType: 'manual',
                  },
                ])
              }}
              onUploadFile={(fileName, productId) => {
                const newSource: KnowledgeFileSource = {
                  id: `src-prod-${Date.now()}`,
                  name: fileName,
                  type: 'pdf',
                  size: '2.4 MB',
                  updatedAt: '刚刚',
                  visibility: 'customer-facing',
                  status: 'ready',
                  summary: '新上传的产品知识文件已完成绑定。',
                }
                setProductFileSources((prev) => [newSource, ...prev])
                if (productId) {
                  setProductBindings((prev) => [
                    ...prev,
                    {
                      id: `bind-${Date.now()}`,
                      sourceId: newSource.id,
                      productId,
                      boundAt: '刚刚',
                      matchType: 'manual',
                    },
                  ])
                }
              }}
              isZh={isZh}
            />
          ) : activeFolderObj ? (
            <GeneralFolderWorkspace
              folder={activeFolderObj}
              onBack={() => setActiveOpenedFolderId(null)}
              onDeleteFolder={
                !activeFolderObj.isSystem ? handleDeleteFolder : undefined
              }
              onUpdateFolderSources={handleUpdateFolderSources}
              onRenameFolder={handleRenameFolder}
              isZh={isZh}
            />
          ) : (
            /* Sources List View (NotebookLM Style Clean Cards) */
            <div className="flex flex-col h-full justify-between overflow-hidden">
              {/* Header */}
              <div className="p-3 border-b border-[var(--border)] bg-[var(--surface)] space-y-2 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Database size={14} className="text-[var(--primary)]" />
                    <h3 className="text-xs font-extrabold text-[var(--ink)] tracking-tight">
                      知识库来源
                    </h3>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[var(--primary)] text-[var(--primary)] font-bold border border-[var(--primary)]">
                      {folders.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      id="open-knowledge-marketplace-btn"
                      onClick={() => setIsMarketplaceModalOpen(true)}
                      className="px-2 py-1 rounded-[4px] bg-[var(--surface-muted)] hover:bg-[var(--border)] text-[var(--ink)] hover:text-[var(--ink)] text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
                      title="行业权威知识库中心"
                    >
                      <ShoppingBag size={11} />
                      <span>中心</span>
                    </button>

                    <button
                      type="button"
                      id="create-new-knowledge-base-btn"
                      onClick={() => setIsCreateFolderModalOpen(true)}
                      className="px-2 py-1 rounded-[4px] bg-[var(--primary)] hover:bg-[var(--primary)] text-[var(--surface)] text-xs font-bold transition-colors cursor-pointer flex items-center gap-0.5"
                      title="新建知识库"
                    >
                      <Plus size={11} />
                      <span>新建</span>
                    </button>
                  </div>
                </div>

                {/* Sub-bar: Search & Select All Checkbox */}
                <div className="flex items-center justify-between gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={handleSelectAllFolders}
                    className="text-[11px] font-semibold text-[var(--ink)] hover:text-[var(--ink)] flex items-center gap-1 cursor-pointer select-none truncate"
                  >
                    {selectedFolderIdsForAi.length === folders.length ? (
                      <CheckSquare size={13} className="text-[var(--primary)] shrink-0" />
                    ) : selectedFolderIdsForAi.length > 0 ? (
                      <div className="w-3.5 h-3.5 rounded-[3px] bg-[var(--primary)] flex items-center justify-center text-[var(--surface)] text-[9px] font-bold shrink-0">
                        -
                      </div>
                    ) : (
                      <Square size={13} className="text-[var(--lavender)] shrink-0" />
                    )}
                    <span className="truncate">
                      用于推理 ({selectedFolderIdsForAi.length}/{folders.length})
                    </span>
                  </button>

                  <div className="relative flex-1 max-w-[100px]">
                    <Search
                      size={11}
                      className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[var(--lavender)]"
                    />
                    <input
                      type="text"
                      value={sourceSearchTerm}
                      onChange={(e) => setSourceSearchTerm(e.target.value)}
                      placeholder="筛选..."
                      className="w-full h-6 pl-5 pr-1.5 rounded-[4px] bg-[var(--surface-muted)] border border-[var(--border)] text-[11px] text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                </div>
              </div>

              {/* Sources Cards List: ONLY Icon, Title, Doc Count */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scroll bg-[var(--surface)]">
                {filteredFolders.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[var(--lavender)]">
                    未检索到匹配的知识库
                  </div>
                ) : (
                  filteredFolders.map((folder) => {
                    const isSelected = selectedFolderIdsForAi.includes(folder.id)
                    return (
                      <div
                        key={folder.id}
                        className={`group p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 select-none ${
                          isSelected
                            ? 'bg-[var(--primary)]/25 border-[var(--primary)] hover:border-[var(--primary)] shadow-2xs'
                            : 'bg-[var(--surface)] hover:bg-[var(--surface-muted)] border-[var(--border)] hover:border-[var(--primary)]/40'
                        }`}
                        onClick={() => setActiveOpenedFolderId(folder.id)}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {/* Selection Checkbox */}
                          <div
                            className="shrink-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleToggleFolderAiSelect(folder.id)
                            }}
                          >
                            <div
                              className={`w-3.5 h-3.5 rounded-[3px] flex items-center justify-center transition-colors cursor-pointer border ${
                                isSelected
                                  ? 'bg-[var(--primary)] border-[var(--primary)] text-[var(--surface)]'
                                  : 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--lavender)]'
                              }`}
                            >
                              {isSelected && <Check size={10} strokeWidth={3} />}
                            </div>
                          </div>

                          {/* Folder Icon */}
                          <div className="w-7 h-7 rounded-lg bg-[var(--surface-muted)] flex items-center justify-center shrink-0 border border-[var(--border)]/80">
                            {getFolderIcon(folder)}
                          </div>

                          {/* Folder Info: ONLY Title & Doc count */}
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-bold text-[var(--ink)] group-hover:text-[var(--primary)] transition-colors truncate">
                              {folder.title}
                            </h4>
                            <p className="text-[10px] text-[var(--lavender)] truncate">
                              {folder.sourceCount} 篇文档
                            </p>
                          </div>
                        </div>

                        <ChevronRight
                          size={12}
                          className="text-[var(--lavender)] group-hover:text-[var(--primary)] group-hover:translate-x-0.5 transition-all shrink-0"
                        />
                      </div>
                    )
                  })
                )}
              </div>

              {/* Storage Footer */}
              <div className="p-2.5 border-t border-[var(--border)] bg-[var(--surface-muted)] flex items-center justify-between text-[10px] text-[var(--lavender)] shrink-0">
                <div className="flex items-center gap-1 truncate">
                  <HardDrive size={12} className="text-[var(--primary)] shrink-0" />
                  <span className="truncate">
                    已用：<strong className="text-[var(--ink)]">68.9 MB</strong>
                  </span>
                </div>
                <span className="text-[var(--acid-sage)] font-bold text-[10px] flex items-center gap-1 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--acid-sage)] animate-pulse" />
                  就绪
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* COLUMN 2 (CENTER): AI 深度研报与对话 (Notebook Studio Chat / Deep Research) */}
        {/* ========================================================================= */}
        <div
          id="ai-studio-center-workspace"
          className="flex-1 bg-[var(--surface)] flex flex-col justify-between h-full overflow-hidden"
        >
          {/* Top Bar: Context status & Model Selector */}
          <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)] flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-[var(--acid-sage)] shrink-0" />
              <span className="text-xs text-[var(--ink)] font-medium truncate">
                已挂载{' '}
                <strong className="text-[var(--ink)]">
                  {selectedFolderIdsForAi.length} 个知识库
                </strong>{' '}
                进行交叉推理
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Model Switcher */}
              <div className="relative" ref={modelDropdownRef}>
                <button
                  type="button"
                  id="model-selector-btn"
                  onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                  className="px-2.5 py-1 rounded-[4px] bg-[var(--surface-muted)] hover:bg-[var(--surface-muted)] border border-[var(--border)] text-xs font-bold text-[var(--ink)] flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Bot size={13} className="text-[var(--primary)]" />
                  <span>
                    {AI_RESEARCH_MODELS_DATA.find((m) => m.id === selectedModelId)
                      ?.name || 'Gemini 2.5 Pro'}
                  </span>
                  <ChevronDown size={11} className="text-[var(--lavender)]" />
                </button>

                {isModelDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1 w-48 rounded-[8px] bg-[var(--surface)] border border-[var(--border)] shadow-xl p-1 z-30 space-y-0.5">
                    {AI_RESEARCH_MODELS_DATA.map((model) => (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => {
                          setSelectedModelId(model.id)
                          setIsModelDropdownOpen(false)
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-[4px] transition-colors cursor-pointer flex items-center justify-between text-xs font-semibold ${
                          selectedModelId === model.id
                            ? 'bg-[var(--primary)] text-[var(--primary)] font-bold'
                            : 'text-[var(--ink)] hover:bg-[var(--surface-muted)]'
                        }`}
                      >
                        <span>{model.name}</span>
                        {selectedModelId === model.id && (
                          <Check size={12} className="text-[var(--primary)] shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Clear / Reset Chat */}
              <button
                type="button"
                onClick={() => {
                  if (confirm('确认清空当前对话研报？')) {
                    setResearchMessages([])
                  }
                }}
                className="p-1.5 rounded-[4px] text-[var(--lavender)] hover:text-[var(--ink)] hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
                title="清空对话"
              >
                <RotateCcw size={13} />
              </button>
            </div>
          </div>

          {/* Research Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scroll bg-[var(--surface-muted)]/50">
            {researchMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                <div className="w-12 h-12 rounded-xl bg-[var(--primary)] text-[var(--primary)] flex items-center justify-center">
                  <Sparkles size={24} />
                </div>
                <div className="space-y-1 max-w-sm">
                  <h3 className="text-sm font-bold text-[var(--ink)]">
                    基于知识库的 Notebook 深度研报工作台
                  </h3>
                  <p className="text-xs text-[var(--lavender)] leading-relaxed">
                    在左侧选择知识库或在右侧选择技能，我们将为您生成结构化竞品对比、合规审查或多语言文案。
                  </p>
                </div>
              </div>
            ) : (
              researchMessages.map((msg) => {
                const isUser = msg.sender === 'user'
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`group/msg flex gap-3 max-w-[92%] ${
                      isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-[6px] flex items-center justify-center shrink-0 text-xs font-bold ${
                        isUser
                          ? 'bg-[var(--ink)] text-[var(--surface)]'
                          : 'bg-[var(--primary)] text-[var(--surface)]'
                      }`}
                    >
                      {isUser ? <User size={13} /> : <Sparkles size={13} />}
                    </div>

                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div
                        className={`p-4 rounded-xl text-xs leading-relaxed border ${
                          isUser
                            ? 'bg-[var(--ink)] text-[var(--surface)] border-[var(--ink)]'
                            : 'bg-[var(--surface)] text-[var(--ink)] border-[var(--border)] shadow-2xs'
                        }`}
                      >
                        <div
                          className={`prose prose-xs max-w-none ${
                            isUser ? 'text-[var(--surface)]' : 'text-[var(--ink)]'
                          }`}
                        >
                          <ReactMarkdown
                            components={{
                              h3({ children }) {
                                return (
                                  <h3
                                    className={`text-sm font-bold block mt-2 mb-1.5 ${
                                      isUser ? 'text-[var(--surface)]' : 'text-[var(--primary)]'
                                    }`}
                                  >
                                    {children}
                                  </h3>
                                )
                              },
                              h4({ children }) {
                                return (
                                  <h4
                                    className={`text-xs font-bold block mt-3 mb-1.5 ${
                                      isUser ? 'text-[var(--surface)]' : 'text-[var(--ink)]'
                                    }`}
                                  >
                                    {children}
                                  </h4>
                                )
                              },
                              strong({ children }) {
                                return <b className="font-bold">{children}</b>
                              },
                              p({ children }) {
                                return (
                                  <p
                                    className={`text-xs leading-relaxed my-1.5 ${
                                      isUser ? 'text-[var(--lavender)]' : 'text-[var(--ink)]'
                                    }`}
                                  >
                                    {children}
                                  </p>
                                )
                              },
                              ul({ children }) {
                                return (
                                  <ul className="list-disc pl-5 my-1.5 space-y-1">
                                    {children}
                                  </ul>
                                )
                              },
                              li({ children }) {
                                return (
                                  <li
                                    className={`text-xs leading-relaxed ${
                                      isUser ? 'text-[var(--lavender)]' : 'text-[var(--ink)]'
                                    }`}
                                  >
                                    {children}
                                  </li>
                                )
                              },
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>

                        {/* Citations Box */}
                        {!isUser && msg.citations && msg.citations.length > 0 && (
                          <div className="mt-3 pt-2.5 border-t border-[var(--surface-muted)] space-y-1.5">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--primary)]">
                              <FileText size={11} className="text-[var(--primary)]" />
                              <span>溯源文献与切片引用：</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {msg.citations.map((cit) => (
                                <span
                                  key={cit.id}
                                  className="px-2 py-0.5 rounded-[4px] bg-[var(--primary)] text-[var(--primary)] text-[10px] font-medium border border-[var(--primary)]"
                                >
                                  {cit.sourceName}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Message Actions */}
                      {!isUser && (
                        <div className="flex items-center justify-between text-[10px] text-[var(--lavender)] px-1">
                          <span>
                            {msg.timestamp} · {msg.modelUsed}
                          </span>
                          <div className="flex items-center gap-1.5 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => {
                                if (navigator.clipboard) {
                                  navigator.clipboard.writeText(msg.content)
                                }
                                alert('研报内容已复制到剪贴板')
                              }}
                              className="px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-muted)] text-[var(--ink)] hover:text-[var(--ink)] font-medium flex items-center gap-1 cursor-pointer"
                              title="复制"
                            >
                              <Copy size={10} />
                              <span>复制</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSendQuery(undefined)}
                              className="px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-muted)] text-[var(--ink)] hover:text-[var(--ink)] font-medium flex items-center gap-1 cursor-pointer"
                              title="重试"
                            >
                              <RotateCcw size={10} />
                              <span>重试</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )
              })
            )}

            {isSynthesizing && (
              <div className="flex gap-3 max-w-[90%] mr-auto">
                <div className="w-7 h-7 rounded-[6px] bg-[var(--primary)] text-[var(--surface)] flex items-center justify-center shrink-0">
                  <Sparkles size={13} />
                </div>
                <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-2xs space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-[var(--primary)]">
                    <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-ping" />
                    <span>
                      正在检索 {selectedFolderIdsForAi.length} 个知识库并生成深度研报…
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--lavender)]">
                    已对标声学硬件参数、欧盟 CE 合规协议与竞品拆解报告。
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Section: Quick Chips & Input Bar */}
          <div className="p-3.5 bg-[var(--surface)] border-t border-[var(--border)] space-y-2 shrink-0">
            {/* Quick Prompt Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scroll pb-0.5 text-xs">
              <span className="text-[10px] text-[var(--lavender)] shrink-0 font-medium">
                推荐探索:
              </span>
              {[
                { label: '📊 对比 OPT-001 与 Bose 的降噪及续航' },
                { label: '⚖️ 审查 2026 欧盟电池新规合规项' },
                { label: '✨ 提炼 5 点跨境电商买家痛点卖点' },
              ].map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendQuery(chip.label)}
                  className="px-2.5 py-1 rounded-[4px] bg-[var(--surface-muted)] hover:bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--ink)] hover:text-[var(--ink)] text-[11px] font-medium transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSendQuery()
              }}
              className="relative flex items-center gap-2 bg-[var(--surface-muted)] p-1 rounded-xl border border-[var(--border)] focus-within:border-[var(--primary)] focus-within:bg-[var(--surface)] transition-all shadow-2xs"
            >
              {/* '+' Upload / Action trigger */}
              <div className="relative" ref={plusMenuRef}>
                <button
                  type="button"
                  id="plus-action-menu-btn"
                  onClick={() => setIsPlusMenuOpen(!isPlusMenuOpen)}
                  className="w-8 h-8 rounded-[4px] bg-[var(--surface)] border border-[var(--border)] text-[var(--ink)] hover:bg-[var(--surface-muted)] flex items-center justify-center cursor-pointer transition-colors shadow-2xs"
                  title="上传文件或挂载技能"
                >
                  <Plus size={15} />
                </button>

                {isPlusMenuOpen && (
                  <div className="absolute left-0 bottom-full mb-2 w-48 rounded-[8px] bg-[var(--surface)] border border-[var(--border)] shadow-xl p-1 z-30 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsPlusMenuOpen(false)
                        setIsQuickUploadModalOpen(true)
                      }}
                      className="w-full text-left p-2 rounded-[4px] hover:bg-[var(--primary)] text-xs font-semibold text-[var(--ink)] flex items-center gap-2 cursor-pointer"
                    >
                      <FileText size={13} className="text-[var(--primary)]" />
                      <span>上传新来源文件</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsPlusMenuOpen(false)
                        setIsSkillMarketplaceOpen(true)
                      }}
                      className="w-full text-left p-2 rounded-[4px] hover:bg-[var(--primary)] text-xs font-semibold text-[var(--ink)] flex items-center gap-2 cursor-pointer"
                    >
                      <Sparkles size={13} className="text-[var(--primary)]" />
                      <span>挂载分析技能</span>
                    </button>
                  </div>
                )}
              </div>

              <input
                type="text"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="向所选知识库提问，或点击右侧技能快速生成研报与文案…"
                className="flex-1 bg-transparent text-xs text-[var(--ink)] focus:outline-none px-2"
              />

              {/* HP Electric Blue Send Button */}
              <button
                type="submit"
                disabled={!queryInput.trim() || isSynthesizing}
                className="w-8 h-8 rounded-[4px] bg-[var(--primary)] hover:bg-[var(--primary)] active:bg-[var(--primary)] disabled:bg-[var(--surface-muted)] text-[var(--surface)] disabled:text-[var(--lavender)] flex items-center justify-center transition-all cursor-pointer disabled:cursor-not-allowed shrink-0"
                title="发送"
              >
                <Send size={13} className={isSynthesizing ? 'animate-pulse' : ''} />
              </button>
            </form>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COLUMN 3 (RIGHT): Skill 与已生成资产 (Collapsible Drawer with 48px mode) */}
        {/* ========================================================================= */}
        <RightSkillsArtifactsDrawer
          isCollapsed={isRightDrawerCollapsed}
          onToggleCollapse={() => setIsRightDrawerCollapsed(!isRightDrawerCollapsed)}
          artifacts={savedArtifacts}
          onSelectArtifact={(art) => {
            // Optional: insert reference or highlight
          }}
          onDeleteArtifact={(artId) => {
            setSavedArtifacts((prev) => prev.filter((a) => a.id !== artId))
          }}
          onTogglePinArtifact={(artId) => {
            setSavedArtifacts((prev) =>
              prev.map((a) => (a.id === artId ? { ...a, pinned: !a.pinned } : a))
            )
          }}
          onTriggerSkill={handleTriggerSkill}
          onOpenSkillMarketplace={() => setIsSkillMarketplaceOpen(true)}
          activeSkillIds={activeSkillIds}
        />
      </div>

      {/* POPUP MODAL: 知识库中心 (Knowledge Marketplace Modal) */}
      {isMarketplaceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-[var(--ink)]/40 backdrop-blur-xs"
            onClick={() => setIsMarketplaceModalOpen(false)}
          />

          <div
            id="knowledge-marketplace-modal"
            className="relative w-full max-w-5xl bg-[var(--surface)] rounded-2xl p-6 shadow-2xl border border-[var(--border)] z-10 max-h-[90vh] flex flex-col space-y-4 animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[6px] bg-[var(--primary)] text-[var(--surface)] flex items-center justify-center">
                  <ShoppingBag size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--ink)]">
                    知识库中心 (权威行业与合规库生态)
                  </h3>
                  <p className="text-[11px] text-[var(--lavender)]">
                    一键同步行业知识、跨境法规、亚马逊类目合规与选品智库至您的知识空间。
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsMarketplaceModalOpen(false)}
                className="w-8 h-8 rounded-full bg-[var(--surface-muted)] hover:bg-[var(--surface-muted)] text-[var(--lavender)] flex items-center justify-center cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scroll pr-1">
              <KnowledgeMarketplaceView
                isZh={isZh}
                addedCenterBaseIds={addedCenterBaseIds}
                onToggleAddCenterBase={onToggleAddCenterBase}
              />
            </div>
          </div>
        </div>
      )}

      {/* POPUP MODAL: 新建知识库 (Create Knowledge Base Modal) */}
      {isCreateFolderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-[var(--ink)]/40 backdrop-blur-xs"
            onClick={() => setIsCreateFolderModalOpen(false)}
          />

          <div
            id="create-folder-modal"
            className="relative w-full max-w-md bg-[var(--surface)] rounded-2xl p-6 shadow-2xl border border-[var(--border)] z-10 space-y-4 animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-[6px] bg-[var(--primary)] text-[var(--surface)] flex items-center justify-center">
                  <Plus size={16} />
                </div>
                <h4 className="text-sm font-bold text-[var(--ink)]">新建知识库</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateFolderModalOpen(false)}
                className="w-7 h-7 rounded-full bg-[var(--surface-muted)] text-[var(--lavender)] flex items-center justify-center text-xs cursor-pointer"
              >
                <X size={13} />
              </button>
            </div>

            <form onSubmit={handleCreateFolder} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  知识库名称
                </label>
                <input
                  type="text"
                  value={newFolderTitle}
                  onChange={(e) => setNewFolderTitle(e.target.value)}
                  placeholder="例如：2026年夏季新品营销素材库"
                  className="w-full h-9 px-3 rounded-[4px] bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  知识库描述（可选）
                </label>
                <textarea
                  value={newFolderDesc}
                  onChange={(e) => setNewFolderDesc(e.target.value)}
                  placeholder="简述知识库包含的文档范围与用途..."
                  rows={3}
                  className="w-full p-2.5 rounded-[4px] bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateFolderModalOpen(false)}
                  className="px-3 py-1.5 rounded-[4px] bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-muted)] text-[var(--ink)] text-xs font-medium cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={!newFolderTitle.trim()}
                  className="px-4 py-1.5 rounded-[4px] bg-[var(--primary)] hover:bg-[var(--primary)] active:bg-[var(--primary)] disabled:bg-[var(--surface-muted)] text-[var(--surface)] disabled:text-[var(--lavender)] text-xs font-bold cursor-pointer"
                >
                  创建
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP MODAL: 快速上传文件 */}
      {isQuickUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-[var(--ink)]/40 backdrop-blur-xs"
            onClick={() => setIsQuickUploadModalOpen(false)}
          />

          <div
            id="quick-upload-modal"
            className="relative w-full max-w-md bg-[var(--surface)] rounded-2xl p-6 shadow-2xl border border-[var(--border)] z-10 space-y-4 animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-[6px] bg-[var(--primary)] text-[var(--surface)] flex items-center justify-center">
                  <UploadCloud size={16} />
                </div>
                <h4 className="text-sm font-bold text-[var(--ink)]">上传来源文件</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickUploadModalOpen(false)}
                className="w-7 h-7 rounded-full bg-[var(--surface-muted)] text-[var(--lavender)] flex items-center justify-center text-xs cursor-pointer"
              >
                <X size={13} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!quickUploadName.trim()) return

                const target = folders.find((f) => f.id === quickUploadTargetFolder)
                if (target) {
                  const newSource: KnowledgeSource = {
                    id: `src-quick-${Date.now()}`,
                    name: quickUploadName.trim().endsWith('.pdf')
                      ? quickUploadName.trim()
                      : `${quickUploadName.trim()}.pdf`,
                    type: 'pdf',
                    size: '1.8 MB',
                    updatedAt: '刚刚',
                    visibility: 'internal-private',
                    selected: true,
                  }
                  handleUpdateFolderSources(quickUploadTargetFolder, [
                    newSource,
                    ...(target.sources || []),
                  ])
                }
                setQuickUploadName('')
                setIsQuickUploadModalOpen(false)
                alert('文件已成功上传至目标知识库，并已完成切片向量化。')
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  文件名
                </label>
                <input
                  type="text"
                  value={quickUploadName}
                  onChange={(e) => setQuickUploadName(e.target.value)}
                  placeholder="例如：2026_Q3_声学算法实测报告.pdf"
                  className="w-full h-9 px-3 rounded-[4px] bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  归属知识库
                </label>
                <select
                  value={quickUploadTargetFolder}
                  onChange={(e) => setQuickUploadTargetFolder(e.target.value)}
                  className="w-full h-9 px-3 rounded-[4px] bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
                >
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.title} ({f.sourceCount} 篇文档)
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsQuickUploadModalOpen(false)}
                  className="px-3 py-1.5 rounded-[4px] bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-muted)] text-[var(--ink)] text-xs font-medium cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={!quickUploadName.trim()}
                  className="px-4 py-1.5 rounded-[4px] bg-[var(--primary)] hover:bg-[var(--primary)] active:bg-[var(--primary)] disabled:bg-[var(--surface-muted)] text-[var(--surface)] disabled:text-[var(--lavender)] text-xs font-bold cursor-pointer"
                >
                  确认上传
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP MODAL: 技能中心 / Marketplace */}
      <SkillMarketplaceModal
        isOpen={isSkillMarketplaceOpen}
        onClose={() => setIsSkillMarketplaceOpen(false)}
        activeSkillIds={activeSkillIds}
        onToggleSkill={(skillId: string) => {
          setActiveSkillIds((prev) =>
            prev.includes(skillId) ? prev.filter((id) => id !== skillId) : [...prev, skillId]
          )
        }}
        isProUser={true}
      />
    </div>
  )
}

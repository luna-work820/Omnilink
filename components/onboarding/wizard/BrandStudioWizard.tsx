'use client'

import React, { useState, useRef, useEffect } from 'react'
import {
  ProductImageItem,
} from './types'
import { CircleActionButton } from './CircleActionButton'
import { ColorWheelModal, ColorItem } from './ColorWheelModal'
import type { Y2KBrandAnalysis, Y2KProductRecommendation } from '@/lib/brand/y2k-analysis'
import {
  Upload,
  Trash2,
  Star,
  Plus,
  Check,
  Download,
  ShoppingBag,
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

const DEFAULT_PRESET_IMAGES: ProductImageItem[] = [
  {
    id: 'preset-1',
    url: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=900&auto=format&fit=crop&q=80',
    name: '产品主图.webp',
    isHero: true,
  },
  {
    id: 'preset-2',
    url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=900&auto=format&fit=crop&q=80',
    name: '细节特写.webp',
  },
  {
    id: 'preset-3',
    url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=900&auto=format&fit=crop&q=80',
    name: '空间场景.webp',
  },
]

interface TemplateCardData {
  id: string
  code: string
  title: string
  description: string
  iconPath: string
  primaryHex: string
  previewSrc?: string
}

// 4 个展示模版：2 个 Y2K 变体 + 2 个通用模版
const TPL_MATRIX: TemplateCardData[] = [
  {
    id: 'tpl-y2k-neon',
    code: '千禧潮流',
    title: 'Y2K 霓虹',
    description: '高对比霓虹 · 液态金属质感 · 赛博潮流视觉',
    iconPath: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
    primaryHex: 'var(--lavender)',
    previewSrc: '/template-previews/y2k-neon-reference.png',
  },
  {
    id: 'tpl-y2k-soft',
    code: '柔和千禧',
    title: 'Y2K 柔光',
    description: '粉彩渐变 · 透明塑料质感 · 轻盈年轻视觉',
    iconPath: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 4v6l4 2',
    primaryHex: 'var(--lavender)',
    previewSrc: '/template-previews/y2k-soft-reference.png',
  },
  {
    id: 'tpl-minimal',
    code: '极简通用',
    title: '极简通用',
    description: '留白排版 · 克制层级 · 突出商品本身',
    iconPath: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
    primaryHex: 'var(--primary)',
    previewSrc: '/template-previews/minimal-reference.png',
  },
  {
    id: 'tpl-liquid-glass',
    code: '液态玻璃',
    title: '液态玻璃',
    description: '半透明表面 · 柔和折射 · 未来感通用视觉',
    iconPath: 'M4 4h16v16H4z M8 8h8v8H8z',
    primaryHex: 'var(--primary)',
  },
]

export function BrandStudioWizard() {
  const router = useRouter()
  const flowContainerRef = useRef<HTMLElement>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const isAutoGlidingRef = useRef(false)

  // 1. 第一步状态：图片上传 (最少 1 张，最多 3 张，无说明文案)
  const [images, setImages] = useState<ProductImageItem[]>([])
  const [isDragging, setIsDragging] = useState(false)

  // 2. 第二步状态：品牌名称与概念
  const [brandName, setBrandName] = useState('')
  const [concept, setConcept] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisStatus, setAnalysisStatus] = useState<string | null>(null)
  const [recommendedProducts, setRecommendedProducts] = useState<Y2KProductRecommendation[]>([])

  // 3. 第三步状态：色彩提取调色盘 (横向 6 张卡片与上方 6 个滑动色块一一对应)
  const [colorPalette, setColorPalette] = useState<ColorItem[]>([
    {
      hex: 'var(--plum)',
      name: '深海夜空',
      role: '背景色',
      roleDescription: '页面底色与整体背景',
    },
    {
      hex: 'var(--acid-sage)',
      name: '青翠翡绿',
      role: '主品牌色',
      roleDescription: '核心按钮与主视觉标识',
    },
    {
      hex: 'var(--acid-sage)',
      name: '暖阳烁金',
      role: '高亮强调色',
      roleDescription: '状态徽章与吸睛焦点',
    },
    {
      hex: 'var(--acid-sage)',
      name: '珊瑚暖橙',
      role: '辅助搭配色',
      roleDescription: '次级色块与装饰元素',
    },
    {
      hex: 'var(--plum)',
      name: '陶土赤红',
      role: '次级点缀色',
      roleDescription: '吸睛标签与点缀元素',
    },
    {
      hex: 'var(--ink)',
      name: '曜石墨黑',
      role: '正文文本色',
      roleDescription: '标题与高读写对比文本',
    },
  ])
  const [editingColorIndex, setEditingColorIndex] = useState<number | null>(null)

  // 4. 第四步状态：模版矩阵 (Uiverse 3D 翻转卡片，无边框)
  const [selectedTemplateId, setSelectedTemplateId] = useState('tpl-y2k-neon')

  // 5. 第五步状态：最终网页渲染展示
  const [activeTab, setActiveTab] = useState<'desktop' | 'mobile' | 'posters'>('desktop')
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null)
  const [isDeploying, setIsDeploying] = useState(false)

  // 严格拦截未达到要求的手动向下滚动：上传至少 1 张图后才可进入后续步骤
  useEffect(() => {
    const container = flowContainerRef.current
    if (!container) return

    const handleWheel = (e: WheelEvent) => {
      if (isAutoGlidingRef.current) return
      if (e.deltaY > 0) {
        e.preventDefault()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAutoGlidingRef.current) return
      if (['PageDown', 'ArrowDown', 'Space'].includes(e.code)) {
        if (images.length < 1) {
          e.preventDefault()
        }
      }
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      container.removeEventListener('wheel', handleWheel)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [images.length])

  // 核心交互：点击圆形按钮后自动平滑滑动至对应步骤
  const autoGlideToStep = (stepIndex: number) => {
    const steps = document.querySelectorAll<HTMLElement>('.guided-step')
    if (steps[stepIndex]) {
      isAutoGlidingRef.current = true
      steps[stepIndex].scrollIntoView({ behavior: 'smooth' })
      window.setTimeout(() => {
        isAutoGlidingRef.current = false
      }, 1200)
    }
  }

  const handleProceedFromStep1 = () => {
    if (images.length < 1) return
    autoGlideToStep(1)
  }

  const handleProceedFromStep3 = () => {
    autoGlideToStep(3)
  }

  const handleProceedFromStep4 = () => {
    autoGlideToStep(4)
  }

  const handleSaveColor = (newHex: string) => {
    if (editingColorIndex !== null) {
      setColorPalette((prev) => {
        const next = [...prev]
        next[editingColorIndex] = {
          ...next[editingColorIndex],
          hex: newHex,
        }
        return next
      })
    }
  }

  // 文件上传处理 (最少 1 张，最多 3 张，无文字显现)
  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return

    const maxAllowed = 3
    if (images.length >= maxAllowed) return

    const availableSlots = maxAllowed - images.length
    const acceptedFiles = Array.from(files).slice(0, availableSlots)

    const newItems: ProductImageItem[] = []
    let processed = 0

    acceptedFiles.forEach((file) => {
      if (!file.type.startsWith('image/')) return

      const reader = new FileReader()
      reader.onload = (e) => {
        newItems.push({
          id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          url: e.target?.result as string,
          name: file.name.toUpperCase(),
          file,
          isHero: images.length === 0 && newItems.length === 0,
        })
        processed++
        if (processed === acceptedFiles.length) {
          setImages((prev) => [...prev, ...newItems].slice(0, maxAllowed))
        }
      }
      reader.readAsDataURL(file)
    })
  }

  const handleRemoveImage = (id: string) => {
    setImages((prev) => {
      const remaining = prev.filter((img) => img.id !== id)
      if (remaining.length > 0 && !remaining.some((i) => i.isHero)) {
        remaining[0].isHero = true
      }
      return remaining
    })
  }

  const handleSetHero = (id: string) => {
    setImages((prev) =>
      prev.map((img) => ({
        ...img,
        isHero: img.id === id,
      }))
    )
  }

  const handleLoadDemoAssets = () => {
    setImages(DEFAULT_PRESET_IMAGES)
    setBrandName('极简声学 AURA')
    setConcept('包豪斯几何美学 · 原生声学雕塑 · 现代高质感工业设计')
  }

  const handleAnalyzeBrand = async () => {
    setIsAnalyzing(true)
    setAnalysisStatus(null)

    try {
      const formData = new FormData()
      formData.set('brandName', brandName)
      formData.set('concept', concept)
      images.forEach((image) => {
        if (image.file) formData.append('images', image.file, image.file.name)
      })

      const response = await fetch('/api/ai/analyze-brand', {
        method: 'POST',
        body: formData,
      })
      const payload = (await response.json()) as {
        error?: string
        source?: 'gemini' | 'local'
        persisted?: boolean
        analysis?: Y2KBrandAnalysis
        products?: Y2KProductRecommendation[]
      }

      if (!response.ok || !payload.analysis) {
        throw new Error(payload.error || '品牌识别失败，请稍后重试。')
      }

      const analysis = payload.analysis
      const nextPalette = analysis.palette.slice(0, 6).map((color) => ({
        hex: color.hex,
        name: color.name,
        role: color.role,
        roleDescription: color.roleDescription,
      }))
      if (nextPalette.length > 0) setColorPalette(nextPalette)
      setSelectedTemplateId(analysis.recommendedTemplateIds[0] || 'tpl-y2k-neon')
      setRecommendedProducts(payload.products || [])
      setAnalysisStatus(
        payload.source === 'gemini'
          ? `已完成 Y2K 视觉识别 · 置信度 ${Math.round(analysis.confidence * 100)}%`
          : payload.persisted
            ? '已根据图片颜色与明暗完成 Y2K 风格识别并保存到品牌项目'
            : '已根据图片颜色与明暗完成本地 Y2K 风格识别；登录后可保存结果'
      )
      autoGlideToStep(2)
    } catch (error) {
      setAnalysisStatus(error instanceof Error ? error.message : '品牌识别失败，请稍后重试。')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const heroImage = images.find((i) => i.isHero)?.url || images[0]?.url || DEFAULT_PRESET_IMAGES[0].url
  const displayBrandName = brandName.trim() || '极简声学 AURA'
  const displayConcept = concept.trim() || '包豪斯几何美学 · 原生声学雕塑 · 现代高质感工业设计'
  const selectedTemplate = TPL_MATRIX.find((t) => t.id === selectedTemplateId) || TPL_MATRIX[0]

  return (
    <main suppressHydrationWarning ref={flowContainerRef} className="guided-flow select-none font-sans">
      {/* 极简固定顶栏 (企业级极简规范，全中文无科技符号) */}
      <header suppressHydrationWarning className="fixed top-0 left-0 right-0 z-40 px-6 py-4 flex items-center justify-between bg-[var(--surface)]/80 backdrop-blur-xl shadow-[0_1px_3px_var(--ink)]">
        <div suppressHydrationWarning className="flex items-center gap-2.5">
          <div
            suppressHydrationWarning
            translate="no"
            className="w-6 h-6  bg-[var(--primary)] flex items-center justify-center text-[var(--surface)] shadow-2xs notranslate select-none"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="8" />
            </svg>
          </div>
          <span
            suppressHydrationWarning
            translate="no"
            className="text-sm font-extrabold tracking-tight text-[var(--ink)] notranslate select-none"
          >
            OMNILINK 品牌工坊
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleLoadDemoAssets}
            className="text-xs font-semibold text-[var(--primary)] hover:underline cursor-pointer"
          >
            填充示例数据
          </button>
          <Link
            href="/login"
            className="px-3.5 py-1.5  bg-[var(--surface)] border border-[var(--border)] text-[var(--ink)] hover:bg-[var(--surface-muted)] hover:border-[var(--border)] text-xs font-semibold transition-colors cursor-pointer"
          >
            账号登录
          </Link>
        </div>
      </header>

      {/* =========================================================================
          步骤 1：素材上传 (全中文，无科技符号)
          ========================================================================= */}
      <section className="guided-step">
        <div className="step-content space-y-8 flex flex-col items-center">
          <div className="text-center">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[var(--ink)]">
              上传品牌素材
            </h1>
          </div>

          {/* 无厚边框无卡片的大型拖拽区域 */}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setIsDragging(false)
              handleFileUpload(e.dataTransfer.files)
            }}
            className={`w-full max-w-2xl min-h-[240px] rounded-[16px] flex flex-col justify-center items-center p-6 transition-all ${
              isDragging ? 'bg-[var(--surface-muted)]' : 'bg-[var(--surface-muted)]/90 hover:bg-[var(--surface-muted)]/70'
            }`}
            style={{ border: 'none' }}
          >
            <input
              type="file"
              multiple
              accept="image/*"
              ref={fileInputRef}
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />

            {images.length === 0 ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center text-center cursor-pointer py-10"
              >
                <div className="w-14 h-14 rounded-full bg-[var(--surface)] shadow-sm flex items-center justify-center text-[var(--primary)] mb-3">
                  <Upload size={22} />
                </div>
                <div className="text-sm font-bold text-[var(--lavender)]">
                  点击或拖拽上传产品图片
                </div>
                <div className="text-xs text-[var(--lavender)] mt-1">
                  支持 JPG、PNG、WEBP 格式，至少 1 张，最多 3 张
                </div>
              </div>
            ) : (
              /* 已上传图像阵列 (上限 3 张) */
              <div className="w-full space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-[var(--lavender)] pb-1">
                  <span>已上传图片（{images.length}/3）</span>
                  {images.length < 3 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[var(--primary)] hover:underline cursor-pointer font-bold"
                    >
                      + 继续添加
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {images.map((img, idx) => (
                    <div
                      key={img.id}
                      className="group relative rounded-[12px] overflow-hidden aspect-square flex items-center justify-center shadow-md bg-[var(--ink)]"
                    >
                      <img
                        src={img.url}
                        alt={img.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 left-2 flex items-center gap-1">
                        <span className="px-1.5 py-0.5 rounded-[3px] bg-[var(--ink)]/70 text-[var(--surface)] text-[10px] font-medium">
                          0{idx + 1}
                        </span>
                        {img.isHero && (
                          <span className="px-1.5 py-0.5 rounded-[3px] bg-[var(--primary)] text-[var(--surface)] text-[10px] font-bold">
                            主图
                          </span>
                        )}
                      </div>

                      <div className="absolute inset-0 bg-[var(--ink)]/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        {!img.isHero && (
                          <button
                            type="button"
                            title="设为主视觉图"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSetHero(img.id)
                            }}
                            className="p-1.5  bg-[var(--surface)] text-[var(--lavender)] shadow-sm cursor-pointer hover:bg-[var(--surface-muted)]"
                          >
                            <Star size={13} />
                          </button>
                        )}
                        <button
                          type="button"
                          title="删除图片"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveImage(img.id)
                          }}
                          className="p-1.5  bg-[var(--plum)] text-[var(--surface)] shadow-sm cursor-pointer hover:bg-[var(--plum)]"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {images.length < 3 && (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-[12px] bg-[var(--surface)] aspect-square flex flex-col items-center justify-center text-[var(--lavender)] hover:text-[var(--primary)] cursor-pointer transition-colors shadow-sm"
                    >
                      <Plus size={20} />
                      <span className="text-[11px] font-semibold mt-1">添加</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 纯符号圆形下一步按钮 */}
          <div className="pt-2">
            <CircleActionButton
              direction="down"
              disabled={images.length < 1}
              onClick={handleProceedFromStep1}
              ariaLabel="下一步"
            />
          </div>
        </div>
      </section>

      {/* =========================================================================
          步骤 2：品牌基本信息 (全中文，无科技符号)
          ========================================================================= */}
      <section className="guided-step">
        <div className="step-content space-y-8 flex flex-col items-center">
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[var(--ink)]">
              品牌基本信息
            </h2>
          </div>

          <div className="w-full max-w-2xl space-y-6">
            <div>
              <span className="block text-xs font-bold text-[var(--lavender)] mb-1.5">
                品牌名称
              </span>
              <input
                type="text"
                placeholder="例如：极简声学 AURA"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                className="w-full bg-transparent border-b-2 border-[var(--surface-muted)] focus:border-[var(--primary)] outline-none text-2xl sm:text-3xl font-bold text-[var(--lavender)] py-2 transition-colors placeholder:text-[var(--lavender)]"
              />
            </div>

            <div>
              <span className="block text-xs font-bold text-[var(--lavender)] mb-1.5">
                品牌理念与定位
              </span>
              <textarea
                rows={2}
                placeholder="例如：包豪斯几何美学 · 原生声学雕塑 · 现代高质感工业设计"
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                className="w-full bg-transparent border-b-2 border-[var(--surface-muted)] focus:border-[var(--primary)] outline-none text-base sm:text-lg text-[var(--lavender)] py-2 transition-colors placeholder:text-[var(--lavender)] resize-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-6 pt-4">
            <CircleActionButton
              direction="up"
              onClick={() => autoGlideToStep(0)}
              ariaLabel="上一步"
            />
            <CircleActionButton
              direction="down"
              onClick={handleAnalyzeBrand}
              disabled={isAnalyzing}
              ariaLabel="下一步"
            />
            {isAnalyzing && <span className="text-xs text-[var(--lavender)]">正在识别 Y2K 视觉方向…</span>}
          </div>
        </div>
      </section>

      {/* =========================================================================
          步骤 3：颜色搭配 (横向排列 6 张卡片与上方 6 个滑动色块一一对应)
          ========================================================================= */}
      <section className="guided-step">
        <div className="step-content space-y-6 flex flex-col items-center w-full max-w-6xl px-4">
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[var(--ink)]">
              颜色搭配
            </h2>
            {analysisStatus && (
              <p role="status" className="mt-2 text-xs text-[var(--primary)]">
                {analysisStatus}
              </p>
            )}
          </div>

          {/* Uiverse.io by Cobp 3D 透视交互色卡组件 (6 个色块与下方 6 张卡片一一对应) */}
          <div className="container-items">
            {colorPalette.map((col, idx) => (
              <button
                key={col.role}
                type="button"
                className="item-color"
                style={{ '--color': col.hex } as React.CSSProperties}
                data-color={`${col.role} ${col.hex}`}
                aria-label={`${col.role} ${col.hex}`}
                onClick={() => setEditingColorIndex(idx)}
                title={`点击调整 ${col.role}: ${col.hex}`}
              />
            ))}
          </div>

          {/* 6 张卡片横向排列 (与上方 6 个色块一一对应：背景色、主品牌色、高亮强调色、辅助搭配色、次级点缀色、正文文本色) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 w-full">
            {colorPalette.map((c, idx) => (
              <div
                key={c.role}
                onClick={() => setEditingColorIndex(idx)}
                className="group relative bg-[var(--surface)] rounded-[12px] p-3.5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col items-center text-center cursor-pointer border border-transparent hover:border-[var(--surface-muted)]"
              >
                {/* 顶部色彩预览块 */}
                <div
                  className="w-full h-20 rounded-[8px] shadow-xs mb-2.5 transition-transform group-hover:scale-[1.03] flex items-center justify-center relative overflow-hidden"
                  style={{ backgroundColor: c.hex }}
                >
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--surface)]/90 text-[var(--lavender)] shadow-xs">
                    调节色彩
                  </span>
                </div>

                {/* 角色与中文说明 */}
                <div className="w-full space-y-0.5">
                  <div className="text-sm font-bold text-[var(--lavender)]">
                    {c.role}
                  </div>
                  <div className="text-[11px] text-[var(--lavender)] line-clamp-1">
                    {c.roleDescription}
                  </div>
                </div>

                {/* 底部 Hex 与快捷按钮 */}
                <div className="w-full pt-2.5 mt-auto flex items-center justify-between">
                  <span className="font-mono text-[11px] font-semibold text-[var(--lavender)] uppercase">
                    {c.hex}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingColorIndex(idx)
                    }}
                    className="px-2 py-0.5  bg-[var(--surface-muted)] hover:bg-[var(--primary)] hover:text-[var(--surface)] text-[var(--primary)] text-xs font-semibold transition-colors cursor-pointer"
                  >
                    调整
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* 纯符号圆形按钮 */}
          <div className="flex items-center gap-6 pt-4">
            <CircleActionButton
              direction="up"
              onClick={() => autoGlideToStep(1)}
              ariaLabel="上一步"
            />
            <CircleActionButton
              direction="down"
              onClick={handleProceedFromStep3}
              ariaLabel="下一步"
            />
          </div>
        </div>
      </section>

      {/* =========================================================================
          步骤 4：风格模版选择 (全中文，无科技符号，Uiverse 3D 翻转卡片)
          ========================================================================= */}
      <section className="guided-step">
        <div className="step-content space-y-8 flex flex-col items-center">
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[var(--ink)]">
              风格模版选择
            </h2>
          </div>

          {/* Uiverse 3D 翻转卡片网格 (四张 2*2 矩阵排列) */}
          <div className="tpl-grid grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto justify-items-center">
            {TPL_MATRIX.map((tpl) => {
              const isSelected = selectedTemplateId === tpl.id
              return (
                <div
                  key={tpl.id}
                  onClick={() => setSelectedTemplateId(tpl.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSelectedTemplateId(tpl.id)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  aria-label={`选择${tpl.title}`}
                  className={`card ${isSelected ? 'selected' : ''}`}
                >
                  {tpl.previewSrc ? (
                    <Image
                      src={tpl.previewSrc}
                      alt={`${tpl.title} 页面预览`}
                      fill
                      sizes="(max-width: 640px) 90vw, 290px"
                      className="object-cover object-top"
                    />
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d={tpl.iconPath} />
                    </svg>
                  )}

                  {/* 悬停 3D 翻出全中文内容 */}
                  <div className="card__content">
                    <p className="card__title">{tpl.title}</p>
                    <p className="card__description">{tpl.description}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* 纯符号圆形按钮 */}
          <div className="flex items-center gap-6 pt-4">
            <CircleActionButton
              direction="up"
              onClick={() => autoGlideToStep(2)}
              ariaLabel="上一步"
            />
            <CircleActionButton
              direction="down"
              onClick={handleProceedFromStep4}
              ariaLabel="下一步"
            />
          </div>
        </div>
      </section>

      {/* =========================================================================
          步骤 5：独立站与海报渲染展示 (每个页面单张展示，圆点切换，无域名)
          ========================================================================= */}
      <section className="guided-step !min-h-[120svh] !py-16">
        <div className="step-content space-y-6 flex flex-col items-center">
          {/* 圆点切换 (无文字，纯圆点) */}
          <div className="flex items-center justify-center gap-3 py-1">
            {(['desktop', 'mobile', 'posters'] as const).map((tab, idx) => {
              const isActive = activeTab === tab
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`transition-all duration-300 rounded-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2 ${
                    isActive
                      ? 'w-7 h-2.5 bg-[var(--primary)] shadow-sm'
                      : 'w-2.5 h-2.5 bg-[var(--surface-muted)] hover:bg-[var(--surface-muted)]'
                  }`}
                  aria-label={`切换视图 ${idx + 1}`}
                />
              )
            })}
          </div>

          {downloadNotice && (
            <div className="text-xs font-bold text-[var(--acid-sage)] text-center animate-fadeIn">
              {downloadNotice}
            </div>
          )}

          {/* 页面 1：电脑端单张独立站展示 (无域名) */}
          {activeTab === 'desktop' && (
            <div className="w-full max-w-4xl space-y-4 animate-fadeIn">
              <div
                className="mx-auto w-full bg-[var(--surface)] rounded-[16px] shadow-2xl overflow-hidden transition-all duration-300"
                style={{ border: 'none' }}
              >
                {/* 顶端控制条 (无域名) */}
                <div className="bg-[var(--surface-muted)] px-4 py-2.5 flex items-center">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--plum)]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--acid-sage)]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--acid-sage)]" />
                  </div>
                </div>

                <div className="bg-[var(--surface-muted)] min-h-[440px] text-[var(--lavender)]">
                  <header className="px-6 py-4 flex items-center justify-between">
                    <div className="font-extrabold text-sm tracking-tight text-[var(--lavender)]">
                      {displayBrandName}
                    </div>
                    <nav className="hidden md:flex items-center gap-5 text-xs text-[var(--lavender)] font-medium">
                      <span className="text-[var(--primary)] font-bold">首页</span>
                      <span>全部系列</span>
                      <span>品牌故事</span>
                    </nav>
                    <ShoppingBag size={15} className="text-[var(--lavender)]" />
                  </header>

                  <section className="px-6 py-10 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                    <div className="space-y-3">
                      <span className="text-xs px-2.5 py-0.5  bg-[var(--ink)] text-[var(--surface)] font-semibold">
                        {selectedTemplate.title}
                      </span>
                      <h3 className="text-2xl font-extrabold text-[var(--lavender)] leading-tight">
                        {displayBrandName}
                      </h3>
                      <p className="text-xs text-[var(--lavender)] leading-relaxed">
                        {displayConcept}
                      </p>
                      <button
                        className="px-4 py-2  text-[var(--surface)] text-xs font-semibold shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: colorPalette[1]?.hex || 'var(--primary)' }}
                      >
                        立即选购系列
                      </button>
                    </div>

                    <div className="aspect-4/3 rounded-[12px] overflow-hidden bg-[var(--surface)] shadow-md">
                      <img
                        src={heroImage}
                        alt={displayBrandName}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </section>
                </div>
              </div>
            </div>
          )}

          {/* 页面 2：手机端单张独立站展示 (无域名) */}
          {activeTab === 'mobile' && (
            <div className="w-full max-w-[360px] space-y-4 animate-fadeIn">
              <div
                className="mx-auto w-full bg-[var(--surface)] rounded-[24px] shadow-2xl overflow-hidden transition-all duration-300"
                style={{ border: 'none' }}
              >
                {/* 顶端控制条 (无域名) */}
                <div className="bg-[var(--surface-muted)] px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[var(--plum)]" />
                    <span className="w-2 h-2 rounded-full bg-[var(--acid-sage)]" />
                    <span className="w-2 h-2 rounded-full bg-[var(--acid-sage)]" />
                  </div>
                </div>

                <div className="bg-[var(--surface-muted)] min-h-[480px] text-[var(--lavender)] p-4 space-y-4">
                  <header className="flex items-center justify-between pb-2 border-b border-[var(--surface-muted)]">
                    <div className="font-extrabold text-xs tracking-tight text-[var(--lavender)]">
                      {displayBrandName}
                    </div>
                    <ShoppingBag size={14} className="text-[var(--lavender)]" />
                  </header>

                  <div className="aspect-square rounded-[12px] overflow-hidden bg-[var(--surface)] shadow-sm">
                    <img
                      src={heroImage}
                      alt={displayBrandName}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-[3px] bg-[var(--ink)] text-[var(--surface)] font-semibold inline-block">
                      {selectedTemplate.title}
                    </span>
                    <h3 className="text-lg font-extrabold text-[var(--lavender)] leading-tight">
                      {displayBrandName}
                    </h3>
                    <p className="text-xs text-[var(--lavender)] leading-relaxed line-clamp-2">
                      {displayConcept}
                    </p>
                    <button
                      className="w-full py-2  text-[var(--surface)] text-xs font-semibold shadow-sm cursor-pointer hover:opacity-90 transition-opacity mt-2"
                      style={{ backgroundColor: colorPalette[1]?.hex || 'var(--primary)' }}
                    >
                      立即选购系列
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 页面 3：单张高定海报展示 */}
          {activeTab === 'posters' && (
            <div className="w-full max-w-md space-y-4 animate-fadeIn">
              <div
                className="relative aspect-3/4 rounded-[16px] overflow-hidden shadow-2xl p-7 flex flex-col justify-between"
                style={{
                  border: 'none',
                  backgroundImage: `linear-gradient(to top, var(--ink) 0%, var(--ink) 60%, var(--ink) 100%), url(${heroImage})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                <div className="flex items-center justify-between text-[var(--surface)]">
                  <div className="text-sm font-extrabold tracking-tight">
                    {displayBrandName}
                  </div>
                  <span className="text-[10px] px-2 py-0.5  bg-[var(--surface)]/20 backdrop-blur-md font-semibold">
                    {selectedTemplate.title}
                  </span>
                </div>

                <div className="text-[var(--surface)] space-y-1.5">
                  <h4 className="text-xl font-extrabold leading-tight">
                    匠心工艺 · 纯净之声
                  </h4>
                  <p className="text-xs text-[var(--surface)]/85 line-clamp-2 leading-relaxed">
                    {displayConcept}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setDownloadNotice('高定视觉海报已成功生成并下载')
                  setTimeout(() => setDownloadNotice(null), 3000)
                }}
                className="w-full py-2.5  bg-[var(--primary)] hover:bg-[var(--primary)] text-[var(--surface)] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-sm"
              >
                <Download size={14} />
                <span>导出高定视觉海报 (1080×1440)</span>
              </button>
            </div>
          )}

          {recommendedProducts.length > 0 && (
            <div className="w-full max-w-4xl space-y-3 pt-4">
              <div className="flex items-end justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[var(--lavender)]">推荐商品</h3>
                  <p className="text-xs text-[var(--lavender)] mt-1">商品来自当前目录，点击可查看商品页。</p>
                </div>
                <span className="text-[11px] text-[var(--lavender)]">AI 推荐 · 当前目录</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {recommendedProducts.map((product) => (
                  <a
                    key={product.id}
                    href={product.href}
                    target="_blank"
                    rel="noreferrer"
                    className="group bg-[var(--surface)] rounded-[8px] overflow-hidden border border-[var(--surface-muted)] hover:border-[var(--primary)] transition-colors"
                  >
                    <div className="aspect-square bg-[var(--surface-muted)] overflow-hidden">
                      <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform" />
                    </div>
                    <div className="p-2.5">
                      <div className="text-xs font-semibold text-[var(--lavender)] line-clamp-2">{product.name}</div>
                      <div className="mt-1 text-xs font-bold text-[var(--primary)]">¥{product.price.toLocaleString()}</div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* 底部操作栏：上一步 + 最终确认 */}
          <div className="flex items-center gap-6 pt-4">
            <CircleActionButton
              direction="up"
              onClick={() => autoGlideToStep(3)}
              ariaLabel="上一步"
            />
            <button
              type="button"
              disabled={isDeploying}
              onClick={() => {
                setIsDeploying(true)
                setTimeout(() => router.push('/dashboard'), 800)
              }}
              className="uiverse-circle-btn next-down"
              aria-label="完成配置并进入工作台"
              title="完成配置并进入工作台"
            >
              <Check className="w-6 h-6 stroke-[3.2]" />
            </button>
          </div>
        </div>
      </section>

      {/* 色轮调整弹窗 */}
      {editingColorIndex !== null && (
        <ColorWheelModal
          isOpen={true}
          color={colorPalette[editingColorIndex]}
          onClose={() => setEditingColorIndex(null)}
          onSave={handleSaveColor}
        />
      )}
    </main>
  )
}

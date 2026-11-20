import { GoogleGenAI, Type } from '@google/genai'
import { DEMO_PRODUCTS } from '@/lib/products/demo-data'
import { sampleImage } from '@/lib/image-processing'

export type Y2KTemplateId = 'tpl-y2k-neon' | 'tpl-y2k-soft' | 'tpl-minimal' | 'tpl-liquid-glass'

export interface Y2KBrandAnalysis {
  style: 'y2k'
  confidence: number
  keywords: string[]
  palette: Array<{
    hex: string
    name: string
    role: string
    roleDescription: string
  }>
  mood: string
  brandDirection: string
  recommendedTemplateIds: Y2KTemplateId[]
  recommendedProductIds: string[]
  headline: string
  description: string
  fallback?: boolean
}

export interface Y2KProductRecommendation {
  id: string
  name: string
  price: number
  currency: string
  imageUrl: string
  href: string
  reason: string
}

const TEMPLATE_IDS: Y2KTemplateId[] = [
  'tpl-y2k-neon',
  'tpl-y2k-soft',
  'tpl-minimal',
  'tpl-liquid-glass',
]

const DEFAULT_PALETTE = [
  { hex: '#151122', name: '夜幕黑紫', role: '背景色', roleDescription: '页面底色与整体背景' },
  { hex: 'var(--lavender)', name: '霓虹洋红', role: '主品牌色', roleDescription: '核心按钮与主视觉标识' },
  { hex: 'var(--primary)', name: '电光青蓝', role: '高亮强调色', roleDescription: '状态徽章与吸睛焦点' },
  { hex: 'var(--lavender)', name: '液态紫', role: '辅助搭配色', roleDescription: '次级色块与装饰元素' },
  { hex: '#F7F3FF', name: '云雾白', role: '浅色表面', roleDescription: '卡片与内容表面' },
  { hex: 'var(--ink)', name: '曜石墨黑', role: '正文文本色', roleDescription: '标题与高读写对比文本' },
]

const FALLBACK_ANALYSIS: Y2KBrandAnalysis = {
  style: 'y2k',
  confidence: 0.72,
  keywords: ['霓虹', '金属', '透明材质', '千禧未来感'],
  palette: DEFAULT_PALETTE,
  mood: '高能量、未来感、年轻且具有收藏感',
  brandDirection: '以 Y2K 千禧视觉为核心，用霓虹色、电光高亮和液态金属质感建立品牌识别。',
  recommendedTemplateIds: TEMPLATE_IDS,
  recommendedProductIds: DEMO_PRODUCTS.slice(0, 4).map((product) => product.id),
  headline: '让产品进入下一种未来',
  description: '以高对比色彩、透明质感和千禧科技语言，打造具有购买冲动的品牌体验。',
  fallback: true,
}

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    style: { type: Type.STRING, enum: ['y2k'] },
    confidence: { type: Type.NUMBER },
    keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
    palette: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          hex: { type: Type.STRING },
          name: { type: Type.STRING },
          role: { type: Type.STRING },
          roleDescription: { type: Type.STRING },
        },
        required: ['hex', 'name', 'role', 'roleDescription'],
      },
    },
    mood: { type: Type.STRING },
    brandDirection: { type: Type.STRING },
    recommendedTemplateIds: {
      type: Type.ARRAY,
      items: { type: Type.STRING, enum: TEMPLATE_IDS },
    },
    recommendedProductIds: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    headline: { type: Type.STRING },
    description: { type: Type.STRING },
  },
  required: [
    'style',
    'confidence',
    'keywords',
    'palette',
    'mood',
    'brandDirection',
    'recommendedTemplateIds',
    'recommendedProductIds',
    'headline',
    'description',
  ],
}

function parseModelResult(text: string): Y2KBrandAnalysis | null {
  try {
    const parsed = JSON.parse(text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()) as Partial<Y2KBrandAnalysis>
    if (
      parsed.style !== 'y2k' ||
      !Array.isArray(parsed.palette) ||
      !Array.isArray(parsed.recommendedTemplateIds) ||
      !Array.isArray(parsed.recommendedProductIds) ||
      typeof parsed.headline !== 'string' ||
      typeof parsed.description !== 'string'
    ) {
      return null
    }

    const templates = parsed.recommendedTemplateIds.filter((id): id is Y2KTemplateId =>
      TEMPLATE_IDS.includes(id as Y2KTemplateId)
    )
    const productIds = parsed.recommendedProductIds.filter((id) =>
      DEMO_PRODUCTS.some((product) => product.id === id)
    )

    return {
      ...FALLBACK_ANALYSIS,
      ...parsed,
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
      palette: parsed.palette.slice(0, 6),
      recommendedTemplateIds: templates.length === 4 ? templates : TEMPLATE_IDS,
      recommendedProductIds: productIds.length > 0 ? productIds.slice(0, 4) : FALLBACK_ANALYSIS.recommendedProductIds,
      fallback: false,
    } as Y2KBrandAnalysis
  } catch {
    return null
  }
}

export async function analyzeY2KBrand(input: {
  brandName?: string
  concept?: string
  images: Array<{ bytes: Buffer; mimeType: string }>
}): Promise<Y2KBrandAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return analyzeLocalY2KVisual(input)

  try {
    const ai = new GoogleGenAI({ apiKey })
    const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite'
    const contents = [
      {
        text: `你是 Omnilink 的品牌视觉分析助手。当前演示版本只支持 Y2K 风格。\n品牌名称：${input.brandName?.trim() || '未填写'}\n品牌概念：${input.concept?.trim() || '未填写'}\n请根据品牌概念和图片，提取适合用于电商首页的 Y2K 视觉方向。不要生成虚构商品名称或链接，推荐商品只能从给定商品目录 ID 中选择：${DEMO_PRODUCTS.map((product) => product.id).join(', ')}。四个模板必须全部返回：tpl-y2k-neon、tpl-y2k-soft、tpl-minimal、tpl-liquid-glass。返回 JSON。`,
      },
      ...input.images.map((image) => ({
        inlineData: { mimeType: image.mimeType, data: image.bytes.toString('base64') },
      })),
    ]

    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        responseMimeType: 'application/json',
        responseSchema,
        temperature: 0.2,
      },
    })

    return (response.text && parseModelResult(response.text)) || FALLBACK_ANALYSIS
  } catch (error) {
    console.warn('[brand.y2k] Gemini analysis failed; using fallback:', error)
    return FALLBACK_ANALYSIS
  }
}

async function analyzeLocalY2KVisual(input: {
  brandName?: string
  concept?: string
  images: Array<{ bytes: Buffer; mimeType: string }>
}): Promise<Y2KBrandAnalysis> {
  if (input.images.length === 0) {
    return {
      ...FALLBACK_ANALYSIS,
      brandDirection: input.concept?.trim()
        ? `围绕“${input.concept.trim()}”建立 Y2K 视觉方向，并用霓虹高亮与透明材质强化识别。`
        : FALLBACK_ANALYSIS.brandDirection,
      fallback: true,
    }
  }

  try {
    const samples = await Promise.all(
      input.images.map(async ({ bytes }) => {
        return sampleImage(bytes)
      })
    )

    const buckets = new Map<string, { rgb: [number, number, number]; count: number }>()
    let saturationTotal = 0
    let brightnessTotal = 0
    let pixels = 0

    for (const sample of samples) {
      for (let index = 0; index < sample.data.length; index += sample.channels) {
        const r = sample.data[index] ?? 0
        const g = sample.data[index + 1] ?? 0
        const b = sample.data[index + 2] ?? 0
        const max = Math.max(r, g, b)
        const min = Math.min(r, g, b)
        const saturation = max === 0 ? 0 : (max - min) / max
        const brightness = max / 255
        const key = `${Math.round(r / 32)}-${Math.round(g / 32)}-${Math.round(b / 32)}`
        const bucket = buckets.get(key) || { rgb: [r, g, b], count: 0 }
        bucket.count += 1
        buckets.set(key, bucket)
        saturationTotal += saturation
        brightnessTotal += brightness
        pixels += 1
      }
    }

    const dominant = [...buckets.values()].sort((a, b) => b.count - a.count).slice(0, 3)
    const accents = dominant.map(({ rgb }) => toHex(rgb))
    const averageSaturation = saturationTotal / Math.max(pixels, 1)
    const averageBrightness = brightnessTotal / Math.max(pixels, 1)
    const confidence = Math.min(0.94, Math.max(0.58, 0.58 + averageSaturation * 0.28 + (averageBrightness > 0.35 ? 0.08 : 0)))
    const primary = accents[0] || 'var(--lavender)'
    const secondary = accents[1] || 'var(--primary)'
    const darkBackground = averageBrightness < 0.42 ? '#151122' : '#F7F3FF'

    return {
      ...FALLBACK_ANALYSIS,
      confidence,
      palette: [
        { hex: darkBackground, name: averageBrightness < 0.42 ? '夜幕黑紫' : '云雾白', role: '背景色', roleDescription: '页面底色与整体背景' },
        { hex: primary, name: '主视觉提取色', role: '主品牌色', roleDescription: '核心按钮与主视觉标识' },
        { hex: secondary, name: '高亮提取色', role: '高亮强调色', roleDescription: '状态徽章与吸睛焦点' },
        { hex: 'var(--lavender)', name: '液态紫', role: '辅助搭配色', roleDescription: '次级色块与装饰元素' },
        { hex: 'var(--primary)', name: '电光青蓝', role: '次级点缀色', roleDescription: '吸睛标签与点缀元素' },
        { hex: 'var(--ink)', name: '曜石墨黑', role: '正文文本色', roleDescription: '标题与高读写对比文本' },
      ],
      keywords: averageSaturation > 0.35 ? ['霓虹', '高饱和', '透明材质', '千禧未来感'] : ['金属', '柔光', '透明材质', '千禧未来感'],
      mood: averageSaturation > 0.35 ? '高能量、强对比、未来感' : '轻盈、年轻、带有未来材质感',
      brandDirection: input.concept?.trim()
        ? `以“${input.concept.trim()}”为品牌核心，结合图片提取的高亮色与 Y2K 透明材质，形成可落地的首页视觉方向。`
        : '以图片中的主视觉色为基础，结合 Y2K 霓虹高亮、透明材质和液态金属质感建立品牌识别。',
      fallback: true,
    }
  } catch (error) {
    console.warn('[brand.y2k] local visual analysis failed; using defaults:', error)
    return FALLBACK_ANALYSIS
  }
}

function toHex(rgb: [number, number, number]): string {
  return `#${rgb.map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

export function getY2KRecommendations(analysis: Y2KBrandAnalysis): Y2KProductRecommendation[] {
  return analysis.recommendedProductIds
    .map((id) => DEMO_PRODUCTS.find((product) => product.id === id))
    .filter((product): product is (typeof DEMO_PRODUCTS)[number] => Boolean(product))
    .map((product) => ({
      id: product.id,
      name: product.name,
      price: product.price,
      currency: product.currency,
      imageUrl: product.image_url,
      href: `/store/omnilink-flagship/products/${product.id}`,
      reason: `与${analysis.keywords.slice(0, 2).join('、')}视觉关键词匹配`,
    }))
}

export { DEFAULT_PALETTE, FALLBACK_ANALYSIS }

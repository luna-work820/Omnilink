import { GoogleGenAI, Type } from '@google/genai'
import type { ChannelCopy, ContentChannel, GeneratedImage, ProductSemanticDraft } from './types'

type InputImage = { bytes: Buffer; mimeType: string }
const semanticSchema = {
  type: Type.OBJECT,
  properties: {
    productName: { type: Type.STRING }, material: { type: Type.ARRAY, items: { type: Type.STRING } },
    colors: { type: Type.ARRAY, items: { type: Type.STRING } }, structure: { type: Type.ARRAY, items: { type: Type.STRING } },
    functions: { type: Type.ARRAY, items: { type: Type.STRING } }, audience: { type: Type.ARRAY, items: { type: Type.STRING } },
    sellingPoints: { type: Type.ARRAY, items: { type: Type.STRING } }, claimsNeedingEvidence: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['productName', 'material', 'colors', 'structure', 'functions', 'audience', 'sellingPoints', 'claimsNeedingEvidence'],
}

function list(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 8) : [] }
function fallbackSemantics(name: string): ProductSemanticDraft { return { productName: name || '未命名商品', material: [], colors: [], structure: [], functions: [], audience: [], sellingPoints: [], claimsNeedingEvidence: ['材质、功能与功效需补充商家确认或检测依据。'] } }
function summary(semantics: ProductSemanticDraft): string { return Object.entries(semantics).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join('、') : value}`).join('\n') }
function fallbackCopy(channel: ContentChannel, semantics: ProductSemanticDraft): ChannelCopy { return { channel, title: `${semantics.productName}｜商品内容草稿`, body: `${semantics.productName}的可见卖点待商家确认后发布，具体材质、功能和功效以已确认资料为准。`, hashtags: ['商品内容', '生活方式'], cta: '查看商品详情' } }

async function extract(name: string, images: InputImage[]) {
  if (!process.env.GEMINI_API_KEY) return { semantics: fallbackSemantics(name), live: false }
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    const response = await ai.models.generateContent({ model: process.env.GEMINI_MODEL || 'gemini-2.5-flash', contents: [{ text: `只从商品图提取可见事实，不编造性能结论。商品名称：${name || '未提供'}。不确定内容放入 claimsNeedingEvidence。` }, ...images.map((image) => ({ inlineData: { mimeType: image.mimeType, data: image.bytes.toString('base64') } }))], config: { responseMimeType: 'application/json', responseSchema: semanticSchema } })
    const value = response.text ? JSON.parse(response.text) as Record<string, unknown> : {}
    return { semantics: { productName: typeof value.productName === 'string' && value.productName.trim() ? value.productName : name || '未命名商品', material: list(value.material), colors: list(value.colors), structure: list(value.structure), functions: list(value.functions), audience: list(value.audience), sellingPoints: list(value.sellingPoints), claimsNeedingEvidence: list(value.claimsNeedingEvidence) }, live: true }
  } catch { return { semantics: fallbackSemantics(name), live: false } }
}

async function generateImage(prompt: string, images: InputImage[], aspectRatio: '1:1' | '4:5'): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY) return null
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    const response = await ai.models.generateContent({ model: process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image-preview', contents: [{ text: prompt }, ...images.map((image) => ({ inlineData: { mimeType: image.mimeType, data: image.bytes.toString('base64') } }))], config: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio } } })
    const part = response.candidates?.flatMap((candidate) => candidate.content?.parts || []).find((item) => item.inlineData?.data && item.inlineData.mimeType)
    return part?.inlineData?.data && part.inlineData.mimeType ? `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` : null
  } catch { return null }
}

export async function generateContentPack(input: { productName: string; productImages: InputImage[]; referenceImage: InputImage | null; channels: ContentChannel[]; instruction?: string }) {
  const { semantics, live } = await extract(input.productName, input.productImages)
  const suffix = input.instruction?.trim() ? `\n修改要求：${input.instruction.trim().slice(0, 500)}` : ''
  const prompts = ['干净高级的电商商品主图，保持商品外形、颜色、结构和材质可见细节一致，不添加文字、Logo或额外配件。', '温暖居家生活方式商品图，保持商品主体一致，突出触感和使用氛围，不改变商品事实。', '商品局部细节特写，突出可见材质和结构，不添加不存在的功能或配件。', '商品多角度陈列图，保持主体一致，适合商品详情页，不添加文字和Logo。'].map((prompt) => `${prompt}\n商品语义：${summary(semantics)}${suffix}`)
  const images: GeneratedImage[] = []
  for (let index = 0; index < prompts.length; index += 1) {
    const aspectRatio = index === 1 ? '4:5' : '1:1'
    const dataUrl = await generateImage(prompts[index], input.productImages, aspectRatio)
    if (dataUrl) images.push({ id: `generated-${index + 1}`, dataUrl, kind: 'generated', aspectRatio })
  }
  const notices = [...(!live ? ['未配置 GEMINI_API_KEY，当前仅展示待确认语义与素材预览。'] : []), ...(!images.length ? ['尚未生成 AI 图片；配置图像模型后可生成 4 张结果。'] : [])]
  if (!images.length) images.push(...input.productImages.slice(0, 4).map((image, index) => ({ id: `source-${index + 1}`, dataUrl: `data:${image.mimeType};base64,${image.bytes.toString('base64')}`, kind: 'source-preview' as const, aspectRatio: '1:1' as const })))
  return { semantics, images, copy: input.channels.map((channel) => fallbackCopy(channel, semantics)), notices }
}

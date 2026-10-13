import { NextRequest, NextResponse } from 'next/server'
import { createClientServer } from '@/lib/supabase/server'
import { analyzeY2KBrand, getY2KRecommendations } from '@/lib/brand/y2k-analysis'
import { saveY2KBrandAnalysis } from '@/lib/brand/workspace'

export const runtime = 'nodejs'

const MAX_FILES = 3
const MAX_FILE_SIZE = 8 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const brandName = String(formData.get('brandName') ?? '').trim()
    const concept = String(formData.get('concept') ?? '').trim()
    const files = formData.getAll('images').filter((value): value is File => value instanceof File && value.size > 0)

    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: '最多分析 3 张图片。' }, { status: 400 })
    }

    for (const file of files) {
      if (!ALLOWED_TYPES.has(file.type)) {
        return NextResponse.json({ error: '仅支持 JPG、PNG 或 WebP 图片。' }, { status: 400 })
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: '单张图片不能超过 8MB。' }, { status: 400 })
      }
    }

    if (!brandName && !concept && files.length === 0) {
      return NextResponse.json({ error: '请至少上传图片或填写品牌概念。' }, { status: 400 })
    }

    const images = await Promise.all(
      files.map(async (file) => ({
        bytes: Buffer.from(await file.arrayBuffer()),
        mimeType: file.type,
      }))
    )

    let userId: string | null = null
    try {
      const supabase = await createClientServer()
      const { data } = await supabase.auth.getUser()
      userId = data.user?.id ?? null
    } catch (error) {
      if (process.env.GEMINI_API_KEY) throw error
      console.warn('[brand.y2k] Supabase unavailable; returning local-only analysis')
    }

    if (!userId && process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: '请先登录后再进行品牌识别。' }, { status: 401 })
    }

    const analysis = await analyzeY2KBrand({ brandName, concept, images })
    let persisted = false
    if (userId) {
      await saveY2KBrandAnalysis({
        userId,
        analysis,
        assets: files.map((file) => ({ name: file.name, type: file.type, size: file.size })),
      })
      persisted = true
    }

    return NextResponse.json({
      success: true,
      source: analysis.fallback ? 'local' : 'gemini',
      persisted,
      analysis,
      products: getY2KRecommendations(analysis),
    })
  } catch (error) {
    console.error('[brand.y2k] request failed:', error)
    return NextResponse.json({ error: '品牌识别暂时不可用，请稍后重试。' }, { status: 500 })
  }
}

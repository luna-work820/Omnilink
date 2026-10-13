import { NextRequest, NextResponse } from 'next/server'
import { generateContentPack } from '@/lib/content-generation/service'
import type { ContentChannel } from '@/lib/content-generation/types'
import { getOwnedStoreId, requireUser } from '@/lib/api/auth'

export const runtime = 'nodejs'
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const allowedChannels = new Set<ContentChannel>(['douyin', 'xiaohongshu', 'detail-page'])

export async function POST(request: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  if (!(await getOwnedStoreId(auth.supabase, auth.user))) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  }

  try {
    const form = await request.formData()
    const productName = String(form.get('productName') || '').trim().slice(0, 200)
    const instruction = String(form.get('instruction') || '').trim().slice(0, 500)
    const files = form.getAll('productImages').filter((value): value is File => value instanceof File && value.size > 0).slice(0, 3)
    const reference = form.get('referenceImage')
    const referenceFile = reference instanceof File && reference.size > 0 ? reference : null
    if (!files.length) return NextResponse.json({ error: '请至少上传一张商品图。' }, { status: 400 })
    for (const file of [...files, ...(referenceFile ? [referenceFile] : [])]) if (!allowedTypes.has(file.type) || file.size > 8 * 1024 * 1024) return NextResponse.json({ error: '仅支持 8MB 以内的 JPG、PNG 或 WebP 图片。' }, { status: 400 })
    const toInput = async (file: File) => ({ bytes: Buffer.from(await file.arrayBuffer()), mimeType: file.type })
    const channels = String(form.get('channels') || 'douyin,xiaohongshu,detail-page').split(',').filter((channel): channel is ContentChannel => allowedChannels.has(channel as ContentChannel))
    return NextResponse.json(await generateContentPack({ productName, instruction, productImages: await Promise.all(files.map(toInput)), referenceImage: referenceFile ? await toInput(referenceFile) : null, channels: channels.length ? channels : ['douyin', 'xiaohongshu', 'detail-page'] }))
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : '内容生成失败。' }, { status: 500 }) }
}

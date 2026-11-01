import { NextResponse, type NextRequest } from 'next/server'

export const runtime = 'nodejs'

const allowedTypes = new Set(['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg'])
const requestsByAddress = new Map<string, number[]>()

export async function POST(request: NextRequest) {
  const address = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'local'
  const now = Date.now()
  const recent = (requestsByAddress.get(address) || []).filter((time) => now - time < 15 * 60_000)
  if (recent.length >= 20) return NextResponse.json({ error: '语音请求过于频繁，请稍后再试。' }, { status: 429 })
  requestsByAddress.set(address, [...recent, now])
  if (requestsByAddress.size > 2000) {
    for (const [key, times] of requestsByAddress) {
      if (times.every((time) => now - time >= 15 * 60_000)) requestsByAddress.delete(key)
    }
  }
  if (Number(request.headers.get('content-length') || 0) > 4 * 1024 * 1024) {
    return NextResponse.json({ error: '录音不能超过 4 MB。' }, { status: 413 })
  }

  const apiKey = process.env.GEMINI_API_KEY
  const model = process.env.GEMINI_MODEL?.trim()
  if (!apiKey || !model) return NextResponse.json({ error: '语音识别尚未配置。' }, { status: 503 })

  try {
    const form = await request.formData()
    const audio = form.get('audio')
    if (!(audio instanceof File) || !allowedTypes.has(audio.type.split(';')[0]) || !audio.size || audio.size > 4 * 1024 * 1024) {
      return NextResponse.json({ error: '录音格式无效或文件过大。' }, { status: 400 })
    }
    const mimeType = audio.type.split(';')[0]
    const data = Buffer.from(await audio.arrayBuffer()).toString('base64')
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [
          { text: '把这段中文语音准确转写为一句话。只返回听到的文字，不回答内容，不添加说明。' },
          { inlineData: { mimeType, data } },
        ] }],
        generationConfig: { temperature: 0 },
      }),
    })
    const result = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message?: string } }
    if (!response.ok) return NextResponse.json({ error: result.error?.message || '语音识别失败。' }, { status: 502 })
    const transcript = result.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim().slice(0, 300) || ''
    if (!transcript) return NextResponse.json({ error: '没有听清，请重试。' }, { status: 422 })
    return NextResponse.json({ transcript })
  } catch {
    return NextResponse.json({ error: '语音识别暂时不可用。' }, { status: 502 })
  }
}

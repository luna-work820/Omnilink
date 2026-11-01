import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api/auth'
import { DEEPSEEK_KEY_COOKIE, readDeepSeekKeyForUser, sealDeepSeekKey } from '@/lib/consumer-advisor/deepseek-key-cookie'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  return NextResponse.json({ configured: Boolean(await readDeepSeekKeyForUser(auth.user.id)) })
}

export async function POST(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null) as { apiKey?: unknown } | null
  const apiKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : ''
  if (apiKey.length < 16 || apiKey.length > 512 || /\s/.test(apiKey)) {
    return NextResponse.json({ error: '请输入有效的 DeepSeek API Key。' }, { status: 400 })
  }

  try {
    const response = await fetch('https://api.deepseek.com/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(12_000),
      cache: 'no-store',
    })
    if (response.status === 401 || response.status === 403) {
      return NextResponse.json({ error: 'DeepSeek API Key 无效或没有访问权限。' }, { status: 400 })
    }
    if (!response.ok) {
      return NextResponse.json({ error: 'DeepSeek 暂时无法连接，请稍后重试。' }, { status: 502 })
    }

    const encrypted = sealDeepSeekKey(auth.user.id, apiKey)
    const result = NextResponse.json({ configured: true })
    result.cookies.set(DEEPSEEK_KEY_COOKIE, encrypted, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })
    return result
  } catch {
    return NextResponse.json({ error: 'DeepSeek 暂时无法连接，请检查网络后重试。' }, { status: 502 })
  }
}

export async function DELETE() {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const result = NextResponse.json({ configured: false })
  result.cookies.set(DEEPSEEK_KEY_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 0 })
  return result
}

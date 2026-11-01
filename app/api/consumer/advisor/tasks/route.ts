import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api/auth'
import { createAdvisorTask, loadLatestAdvisorTask } from '@/lib/consumer-advisor/task-server'
import { isStylingGoal } from '@/lib/consumer-advisor/task-contract'
import { previewCreate, previewLatest, previewLatestProfile } from '@/lib/consumer-advisor/preview-task-store'
import { advisorProfileFromEvaProfile } from '@/lib/consumer-advisor/profile-intake'
import { readDeepSeekKeyForUser } from '@/lib/consumer-advisor/deepseek-key-cookie'

export const runtime = 'nodejs'

const previewCookie = 'omnilink_advisor_preview'

export async function GET(request: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) {
    if (process.env.NODE_ENV !== 'production') {
      const sessionId = request.cookies.get(previewCookie)?.value ?? ''
      return NextResponse.json({ task: previewLatest(sessionId), profile: previewLatestProfile(sessionId), preview: true })
    }
    return auth.response
  }
  try {
    const [task] = await Promise.all([loadLatestAdvisorTask(auth.supabase, auth.user.id)])
    const profile = advisorProfileFromEvaProfile(auth.user.user_metadata?.eva_profile)
    return NextResponse.json({ task, profile })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '任务读取失败。' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok && process.env.NODE_ENV === 'production') return auth.response
  let goal: unknown
  try { goal = (await request.json()).goal } catch { return NextResponse.json({ error: '请求格式无效。' }, { status: 400 }) }
  if (typeof goal !== 'string' || !goal.trim() || goal.length > 2000 || !isStylingGoal(goal)) {
    return NextResponse.json({ error: '请描述一个穿搭或形象管理目标（2000 字以内）。' }, { status: 400 })
  }
  try {
    if (!auth.ok) {
      const sessionId = request.cookies.get(previewCookie)?.value ?? crypto.randomUUID()
      const response = NextResponse.json({ task: previewCreate(sessionId, goal.trim()), preview: true }, { status: 201 })
      response.cookies.set(previewCookie, sessionId, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 })
      return response
    }
    const profile = advisorProfileFromEvaProfile(auth.ok ? auth.user.user_metadata?.eva_profile : null)
    const apiKey = await readDeepSeekKeyForUser(auth.user.id) ?? undefined
    return NextResponse.json({ task: await createAdvisorTask(auth.supabase, auth.user.id, goal.trim(), profile, apiKey) }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '任务创建失败。' }, { status: 500 })
  }
}

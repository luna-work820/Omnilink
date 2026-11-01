import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api/auth'
import { advanceAdvisorTask, loadAdvisorTask } from '@/lib/consumer-advisor/task-server'
import type { WorkspaceModel } from '@/lib/ai/workspace-generation'
import { previewAdvance, previewById } from '@/lib/consumer-advisor/preview-task-store'
import { isProfileGoal } from '@/lib/consumer-advisor/profile-intake'
import { advisorProfileFromEvaProfile, PROFILE_QUESTIONS } from '@/lib/consumer-advisor/profile-intake'
import { readDeepSeekKeyForUser } from '@/lib/consumer-advisor/deepseek-key-cookie'

export const runtime = 'nodejs'

const models = new Set<WorkspaceModel>(['gemini', 'qwen-plus', 'deepseek-flash', 'deepseek-v4-pro'])
type Context = { params: Promise<{ id: string }> }

const previewCookie = 'omnilink_advisor_preview'

export async function GET(request: NextRequest, context: Context) {
  const auth = await requireUser()
  if (!auth.ok && process.env.NODE_ENV === 'production') return auth.response
  const { id } = await context.params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: '任务 ID 无效。' }, { status: 400 })
  try {
    if (!auth.ok) {
      const task = previewById(request.cookies.get(previewCookie)?.value ?? '', id)
      return task ? NextResponse.json({ task, preview: true }) : NextResponse.json({ error: '任务不存在。' }, { status: 404 })
    }
    const task = await loadAdvisorTask(auth.supabase, auth.user.id, id)
    return task ? NextResponse.json({ task }) : NextResponse.json({ error: '任务不存在。' }, { status: 404 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '任务读取失败。' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  const auth = await requireUser()
  if (!auth.ok && process.env.NODE_ENV === 'production') return auth.response
  const { id } = await context.params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: '任务 ID 无效。' }, { status: 400 })
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: '请求格式无效。' }, { status: 400 }) }
  const action = body.action
  if (action !== 'answer' && action !== 'revise' && action !== 'retry' && action !== 'cancel') return NextResponse.json({ error: '任务操作无效。' }, { status: 400 })
  const answer = typeof body.answer === 'string' ? body.answer.trim() : ''
  if (action !== 'cancel' && action !== 'retry' && (!answer || answer.length > 1000)) return NextResponse.json({ error: '请填写 1000 字以内的补充信息。' }, { status: 400 })
  const model = typeof body.model === 'string' && models.has(body.model as WorkspaceModel) ? body.model as WorkspaceModel : 'deepseek-v4-pro'
  try {
    if (!auth.ok) {
      const task = await previewAdvance(request.cookies.get(previewCookie)?.value ?? '', id, action, answer, model)
      return task ? NextResponse.json({ task, preview: true }) : NextResponse.json({ error: '任务不存在或状态已变化。' }, { status: 409 })
    }
    const task = await loadAdvisorTask(auth.supabase, auth.user.id, id)
    if (!task) return NextResponse.json({ error: '任务不存在。' }, { status: 404 })
    if (isProfileGoal(task.goal) && (action === 'revise' || action === 'retry')) return NextResponse.json({ error: '请重新开始建档。' }, { status: 409 })
    if (isProfileGoal(task.goal) && task.status === 'completed' && action === 'cancel') return NextResponse.json({ error: '已建立的档案不能通过结束任务取消；可重新建档。' }, { status: 409 })
    if (action === 'cancel') {
      if (task.status === 'running') return NextResponse.json({ error: '请等待当前步骤完成后再取消。' }, { status: 409 })
      const { error } = await auth.supabase.from('consumer_agent_tasks' as any).update({ status: 'cancelled', question: null, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', auth.user.id).eq('revision', task.revision)
      if (error) throw new Error(error.message)
      return NextResponse.json({ task: await loadAdvisorTask(auth.supabase, auth.user.id, id) })
    }
    if (action === 'answer' && task.status !== 'waiting_for_user') return NextResponse.json({ error: '当前没有待回答的问题。' }, { status: 409 })
    if (action === 'revise' && task.status !== 'completed') return NextResponse.json({ error: '方案完成后才能修改约束。' }, { status: 409 })
    if (action === 'retry' && task.status !== 'failed') return NextResponse.json({ error: '当前任务不需要重试。' }, { status: 409 })
    let evaProfile = auth.user.user_metadata?.eva_profile
    if (action === 'answer' && task.question && !isProfileGoal(task.goal)) {
      const question = PROFILE_QUESTIONS.find((item) => item.prompt === task.question)
      if (question) {
        const current = evaProfile && typeof evaProfile === 'object' ? evaProfile as Record<string, unknown> : {}
        const currentAnswers = current.answers && typeof current.answers === 'object' ? current.answers as Record<string, string> : {}
        evaProfile = { ...current, answers: { ...currentAnswers, [question.key]: answer === '跳过' ? '不想提供' : answer } }
        const { error } = await auth.supabase.auth.updateUser({ data: { eva_profile: evaProfile } })
        if (error) throw new Error('个人情况保存失败，请重试。')
      }
    }
    const profile = advisorProfileFromEvaProfile(evaProfile)
    const apiKey = await readDeepSeekKeyForUser(auth.user.id) ?? undefined
    return NextResponse.json({ task: await advanceAdvisorTask(auth.supabase, auth.user.id, task, action === 'retry' ? '' : answer, model, profile, apiKey) })
  } catch (error) {
    const message = error instanceof Error ? error.message : '任务执行失败。'
    return NextResponse.json({ error: message }, { status: /另一处更新|当前无法继续/.test(message) ? 409 : 500 })
  }
}

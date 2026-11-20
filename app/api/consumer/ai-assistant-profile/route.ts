import { readMemoryLifecycle } from '@/lib/consumer-advisor/memory-lifecycle'
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api/auth'
import { advanceAiAssistantProfile, editAiAssistantProfile, readAiAssistantProfile } from '@/lib/consumer-advisor/ai-assistant-profile'
import { loadAiAssistantMemories, manageAiAssistantMemory, profileWithAiAssistantMemories } from '@/lib/consumer-advisor/ai-assistant-memory'
import { assessmentMemoryProposal } from '@/lib/consumer-advisor/assessment-memory-proposal'
import { isUuid } from '@/lib/utils/uuid'
import { loadPersonalContext } from '@/lib/consumer-advisor/personal-context'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  try {
    const [memories,context]=await Promise.all([loadAiAssistantMemories(auth.supabase,auth.user.id),loadPersonalContext(auth.user.id)])
    return NextResponse.json({ profile: profileWithAiAssistantMemories(auth.user.user_metadata?.ai_assistant_profile, memories),contextVersion:context.version })
  } catch { return NextResponse.json({ error: '个人资料读取失败。' }, { status: 500 }) }
}

export async function PATCH(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body || typeof body.action !== 'string') return NextResponse.json({ error: '请求无效。' }, { status: 400 })
  const action = body.action
  if (action === 'signup-invitation-seen') {
    try {
      const { error } = await auth.supabase.auth.updateUser({ data: { signup_invitation_seen: true } })
      if (error) return NextResponse.json({ error: '状态未能保存，请重试。' }, { status: 503 })
      return NextResponse.json({ seen: true })
    } catch { return NextResponse.json({ error: '状态未能保存，请重试。' }, { status: 503 }) }
  }
  if(action==='assessment-propose') {
    try{
      const memories=await loadAiAssistantMemories(auth.supabase,auth.user.id)
      const profile=profileWithAiAssistantMemories(auth.user.user_metadata?.ai_assistant_profile,memories)
      const proposal=await assessmentMemoryProposal(profile)
      if(!proposal) return NextResponse.json({error:'请先完成评测。'},{status:400})
      await manageAiAssistantMemory(auth.user.id,'propose',proposal)
      const [next,context]=await Promise.all([loadAiAssistantMemories(auth.supabase,auth.user.id),loadPersonalContext(auth.user.id)])
      return NextResponse.json({profile:profileWithAiAssistantMemories(profile,next),contextVersion:context.version})
    }catch{return NextResponse.json({error:'提案暂时无法生成，请重试。'},{status:503})}
  }
  if (action === 'basic' && typeof body.avatarUrl === 'string' && body.avatarUrl) {
    try {
      const supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').origin
      const avatarUrl = new URL(body.avatarUrl)
      const expectedPath = `/storage/v1/object/public/omnilink-media-public/consumer-avatars/${auth.user.id}/avatar.webp`
      if (avatarUrl.origin !== supabaseOrigin || avatarUrl.pathname !== expectedPath) {
        return NextResponse.json({ error: '头像地址无效。' }, { status: 400 })
      }
    } catch {
      return NextResponse.json({ error: '头像地址无效。' }, { status: 400 })
    }
  }
  if (action === 'skills') {
    if (!Array.isArray(body.skillIds) || body.skillIds.some((id) => typeof id !== 'string' || !['personal-advisor', 'shopping-preferences', 'know-yourself'].includes(id))) {
      return NextResponse.json({ error: '技能列表无效。' }, { status: 400 })
    }
    const skillIds = [...new Set(body.skillIds as string[])]
    const { error } = await auth.supabase.auth.updateUser({ data: { enabled_skills: skillIds } })
    if (error) return NextResponse.json({ error: '技能状态保存失败。' }, { status: 502 })
    return NextResponse.json({ skillIds })
  }
  if (['memory', 'forget', 'correct', 'confirm', 'reject'].includes(action)) {
    try {
      if (action === 'memory') {
        const text = typeof body.text === 'string' ? body.text.trim() : ''
        const domain = String(body.domain)
        if (!text || text.length > 240 || !['clothing', 'skin', 'hair', 'space', 'other'].includes(domain)) return NextResponse.json({ error: '记忆内容或类别无效。' }, { status: 400 })
        const lifecycle = readMemoryLifecycle(body.lifecycle)
        if (!lifecycle || (lifecycle.expiresAt && Date.parse(lifecycle.expiresAt) <= Date.now())) {
          return NextResponse.json({ error: '记忆适用范围或有效期无效。' }, { status: 400 })
        }
        await manageAiAssistantMemory(auth.user.id, 'manual', { text, domain, evidence: '你手动保存的记忆', sourcePayload: { lifecycle } })
      } else {
        if (typeof body.id !== 'string' || !isUuid(body.id)) return NextResponse.json({ error: '记忆不存在。' }, { status: 400 })
        if (!Number.isInteger(body.revision) || Number(body.revision) < 1) return NextResponse.json({ error: '请刷新后重试。' }, { status: 400 })
        const text = action === 'correct' && typeof body.text === 'string' ? body.text.trim() : ''
        if (action === 'correct' && (!text || text.length > 240)) return NextResponse.json({ error: '请输入 240 字以内的修正内容。' }, { status: 400 })
        await manageAiAssistantMemory(auth.user.id, action as 'forget' | 'reject' | 'correct' | 'confirm', {
          id: body.id, revision: body.revision, ...(action === 'correct' ? { text } : {}),
        })
      }
      const [memories,context]=await Promise.all([loadAiAssistantMemories(auth.supabase,auth.user.id),loadPersonalContext(auth.user.id)])
      return NextResponse.json({ profile: profileWithAiAssistantMemories(auth.user.user_metadata?.ai_assistant_profile, memories), complete: true,contextVersion:context.version })
    } catch (cause) {
      const code = (cause as { code?: string }).code
      const status = code === '40001' || code === '23505' ? 409 : code === 'P0002' ? 404 : code === '22023' || code === '54000' ? 422 : 503
      return NextResponse.json({ error: status === 409 ? '记忆已更新，请刷新后重试。' : '记忆保存失败，请重试。' }, { status })
    }
  }
  let profile
  try { profile = ['update', 'memory', 'forget'].includes(body.action) ? editAiAssistantProfile(readAiAssistantProfile(auth.user.user_metadata?.ai_assistant_profile), body) : advanceAiAssistantProfile(readAiAssistantProfile(auth.user.user_metadata?.ai_assistant_profile), body) }
  catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : '请求无效。' }, { status: 400 }) }
  const complete = profile.stage === 'done'

  const metadataUpdate: Record<string, unknown> = { ai_assistant_profile: profile, ai_assistant_onboarding_complete: complete }
  if (action === 'basic' && typeof auth.user.user_metadata?.avatar_url === 'string') metadataUpdate.avatar_url = auth.user.user_metadata.avatar_url
  if (action === 'basic' && typeof body.avatarUrl === 'string' && body.avatarUrl) {
    metadataUpdate.avatar_url = body.avatarUrl
  }
  if (action === 'basic' && !Array.isArray(auth.user.user_metadata?.enabled_skills)) {
    metadataUpdate.enabled_skills = ['personal-advisor', 'shopping-preferences']
  }
  const { error } = await auth.supabase.auth.updateUser({ data: metadataUpdate })
  if (error) return NextResponse.json({ error: '资料保存失败，请重试。' }, { status: 502 })
  try {
    if (action.startsWith('shopping-preference-')) {
      const previous=await loadAiAssistantMemories(auth.supabase,auth.user.id)
      const proposal = await assessmentMemoryProposal(profileWithAiAssistantMemories(profile,previous))
      if (proposal) await manageAiAssistantMemory(auth.user.id, 'propose', proposal)
    }
    const [memories,context]=await Promise.all([loadAiAssistantMemories(auth.supabase,auth.user.id),loadPersonalContext(auth.user.id)])
    return NextResponse.json({ profile: profileWithAiAssistantMemories(profile, memories), complete,contextVersion:context.version })
  } catch {
    return NextResponse.json({ error: '资料已保存，记忆暂时不可用，请重试。' }, { status: 503 })
  }
}

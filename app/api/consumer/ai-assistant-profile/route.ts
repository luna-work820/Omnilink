import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api/auth'
import { advanceAiAssistantProfile, editAiAssistantProfile, readAiAssistantProfile } from '@/lib/consumer-advisor/ai-assistant-profile'
import { loadAiAssistantMemories, profileWithAiAssistantMemories } from '@/lib/consumer-advisor/ai-assistant-memory'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  try {
    const memories = await loadAiAssistantMemories(auth.supabase, auth.user.id, auth.user.user_metadata?.ai_assistant_profile)
    return NextResponse.json({ profile: profileWithAiAssistantMemories(auth.user.user_metadata?.ai_assistant_profile, memories) })
  } catch { return NextResponse.json({ error: '个人资料读取失败。' }, { status: 500 }) }
}

export async function PATCH(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body || typeof body.action !== 'string') return NextResponse.json({ error: '请求无效。' }, { status: 400 })
  const action = body.action
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
      const db = auth.supabase as any
      await loadAiAssistantMemories(auth.supabase, auth.user.id, auth.user.user_metadata?.ai_assistant_profile)
      if (action === 'memory') {
        const text = typeof body.text === 'string' ? body.text.trim() : ''
        const domain = String(body.domain)
        if (!text || text.length > 120 || !['clothing', 'skin', 'hair', 'space', 'other'].includes(domain)) return NextResponse.json({ error: '记忆内容或类别无效。' }, { status: 400 })
        const { error } = await db.from('consumer_AI assistant_memories').insert({ user_id: auth.user.id, text, domain, origin: 'user', evidence: '你手动保存的记忆' })
        if (error) throw error
      } else {
        if (typeof body.id !== 'string') return NextResponse.json({ error: '记忆不存在。' }, { status: 400 })
        const query = db.from('consumer_AI assistant_memories').eq('id', body.id).eq('user_id', auth.user.id)
        let result
        if (action === 'forget') result = await query.delete()
        else if (action === 'reject') result = await query.update({ status: 'rejected', updated_at: new Date().toISOString() })
        else {
          const text = action === 'correct' && typeof body.text === 'string' ? body.text.trim() : ''
          if (action === 'correct' && (!text || text.length > 120)) return NextResponse.json({ error: '请输入 120 字以内的修正内容。' }, { status: 400 })
          result = await query.update({ ...(action === 'correct' ? { text } : {}), origin: 'user', status: 'active', evidence: action === 'correct' ? '你已修正此判断' : '你已确认此判断', updated_at: new Date().toISOString() })
        }
        if (result.error) throw result.error
        if (['forget', 'reject', 'correct'].includes(action)) {
          const { error: dependentError } = await db.from('consumer_AI assistant_memories').update({ status: 'rejected', updated_at: new Date().toISOString() })
            .eq('user_id', auth.user.id).eq('origin', 'inferred').contains('support_ids', [body.id])
          if (dependentError) throw dependentError
        }
      }
      const memories = await loadAiAssistantMemories(auth.supabase, auth.user.id, null)
      return NextResponse.json({ profile: profileWithAiAssistantMemories(auth.user.user_metadata?.ai_assistant_profile, memories), complete: true })
    } catch { return NextResponse.json({ error: '记忆保存失败，请重试。' }, { status: 500 }) }
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
    const memories = await loadAiAssistantMemories(auth.supabase, auth.user.id, profile)
    return NextResponse.json({ profile: profileWithAiAssistantMemories(profile, memories), complete })
  } catch {
    return NextResponse.json({ profile: profileWithAiAssistantMemories(profile, []), complete })
  }
}

import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api/auth'
import { isUuid } from '@/lib/utils/uuid'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const { data, error } = await (auth.supabase as any).from('consumer_AI assistant_messages')
    .select('id, conversation_id, role, content, style_tag, matched_product_ids, model, created_at')
    .eq('user_id', auth.user.id).order('created_at', { ascending: false }).limit(200)
  if (error) return NextResponse.json({ error: '对话读取失败。' }, { status: 500 })
  return NextResponse.json({ messages: (data ?? []).reverse() })
}

export async function DELETE(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const body = await request.json().catch(() => null) as { conversationId?: unknown } | null
  if (typeof body?.conversationId !== 'string' || !isUuid(body.conversationId)) {
    return NextResponse.json({ error: '会话无效。' }, { status: 400 })
  }
  const { error } = await (auth.supabase as any).from('consumer_AI assistant_messages').delete()
    .eq('user_id', auth.user.id).eq('conversation_id', body.conversationId)
  return error ? NextResponse.json({ error: '删除失败。' }, { status: 500 }) : NextResponse.json({ ok: true })
}

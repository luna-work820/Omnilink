import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getOwnedStoreId, requireUser } from '@/lib/api/auth'
import { generateWorkspaceText, type WorkspaceModel } from '@/lib/ai/workspace-generation'
import {
  getWorkspaceSkillInstructions,
  loadMultiChannelProductContentContext,
  MULTI_CHANNEL_PRODUCT_CONTENT_SKILL_ID,
} from '@/lib/ai/workspace-skill-prompts'

export const runtime = 'nodejs'

const models = new Set<WorkspaceModel>(['gemini', 'qwen-plus', 'deepseek-flash', 'deepseek-v4-pro'])
const previewSkills = [
  { id: 'merchant-profile', name: '商家档案解析', description: '提取商家事实并输出待确认的资料更新。' },
  { id: 'brand-proposal', name: '品牌提案', description: '基于已确认资料生成可审核的品牌方向。' },
  { id: 'store-copy', name: '店铺文案', description: '把确认资料转换为店铺与商品文案草稿。' },
  { id: 'multi-channel-product-content', name: '商品内容创作', description: '从商品事实与素材出发，生成多渠道文案、商品图片与审核清单。' },
]

function getSkillInstructions(skillId: string | null) {
  return skillId === MULTI_CHANNEL_PRODUCT_CONTENT_SKILL_ID
    ? getWorkspaceSkillInstructions(skillId, loadMultiChannelProductContentContext())
    : null
}

async function runPreview(request: NextRequest) {
  const body = await request.json() as { prompt?: unknown; model?: unknown; skillId?: unknown; context?: Array<{ title?: unknown; summary?: unknown }> }
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim().slice(0, 12000) : ''
  const model = typeof body.model === 'string' && models.has(body.model as WorkspaceModel) ? body.model as WorkspaceModel : null
  if (!prompt || !model) return NextResponse.json({ error: '请求或模型无效。' }, { status: 400 })
  const skill = typeof body.skillId === 'string' ? previewSkills.find((item) => item.id === body.skillId) : null
  const sources = (body.context || []).slice(0, 12).map((item) => ({
    title: typeof item.title === 'string' ? item.title.slice(0, 200) : '未命名来源',
    summary: typeof item.summary === 'string' ? item.summary.slice(0, 1200) : '',
  }))
  const content = await generateWorkspaceText(model, [
    '这是本地测试登录模式。不得声称已写入商家资料或知识库。',
    '请先自动识别用户输入涉及的商家、商品、风格、资料类型和任务意图，不要求用户手动选择；支持解析商家链接、上传资料自动归类、生成商品资料、补全商家信息四类任务。有依据的识别结果可以直接使用，没有依据的部分请标注待确认。',
    skill ? `执行技能：${skill.name}\n技能说明：${skill.description}` : '执行自由对话。',
    getSkillInstructions(skill?.id || null) || '',
    `用户问题：${prompt}`,
    `可用来源：\n${sources.map((item) => `- ${item.title}${item.summary ? `：${item.summary}` : ''}`).join('\n') || '无'}`,
  ].join('\n\n'))
  return NextResponse.json({ content, model, preview: true })
}

export async function POST(request: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) {
    if (process.env.NODE_ENV !== 'production') {
      try {
        return await runPreview(request)
      } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : '模型请求失败。' }, { status: 500 })
      }
    }
    return auth.response
  }

  try {
    const body = await request.json() as {
      prompt?: unknown
      model?: unknown
      skillId?: unknown
      context?: Array<{ title?: unknown; summary?: unknown }>
    }
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim().slice(0, 12000) : ''
    const model = typeof body.model === 'string' && models.has(body.model as WorkspaceModel)
      ? body.model as WorkspaceModel
      : null
    if (!prompt || !model) return NextResponse.json({ error: '请求或模型无效。' }, { status: 400 })

    const storeId = await getOwnedStoreId(auth.supabase, auth.user)
    if (!storeId) return NextResponse.json({ error: '未找到可用店铺。' }, { status: 403 })

    const sources = (body.context || []).slice(0, 12).map((item) => ({
      title: typeof item.title === 'string' ? item.title.slice(0, 200) : '未命名来源',
      summary: typeof item.summary === 'string' ? item.summary.slice(0, 1200) : '',
    }))
    const skillId = typeof body.skillId === 'string' ? body.skillId.slice(0, 100) : null
    const db = auth.supabase as unknown as SupabaseClient<any>
    const { data: storeSkill, error: skillError } = skillId
      ? await db
        .from('store_workspace_skills')
        .select('id, workspace_skill_versions!inner(version, manifest, workspace_skills!inner(id, name, description))')
        .eq('store_id', storeId)
        .eq('skill_id', skillId)
        .eq('is_enabled', true)
        .maybeSingle()
      : { data: null, error: null }
    if (skillError) return NextResponse.json({ error: skillError.message }, { status: 500 })
    if (skillId && !storeSkill) return NextResponse.json({ error: '所选技能未启用或不存在。' }, { status: 403 })
    const skill = storeSkill ? (() => {
      const version = (Array.isArray(storeSkill.workspace_skill_versions)
        ? storeSkill.workspace_skill_versions[0]
        : storeSkill.workspace_skill_versions) as { version: string; manifest: unknown; workspace_skills: unknown }
      const definition = (Array.isArray(version.workspace_skills)
        ? version.workspace_skills[0]
        : version.workspace_skills) as { id: string; name: string; description: string }
      return { runId: storeSkill.id, id: definition.id, name: definition.name, description: definition.description, version: version.version, manifest: version.manifest }
    })() : null
    const { data: run, error: runError } = skill
      ? await db.from('workspace_skill_runs').insert({
        store_skill_id: skill.runId,
        trigger_type: 'manual',
        status: 'running',
        started_at: new Date().toISOString(),
        input_snapshot: { prompt, sources },
      }).select('id').single()
      : { data: null, error: null }
    if (runError) return NextResponse.json({ error: runError.message }, { status: 500 })

    let result: string
    try {
      result = await generateWorkspaceText(model, [
        skill ? `执行技能：${skill.name}（版本 ${skill.version}）\n技能说明：${skill.description}\n输出约束：${JSON.stringify(skill.manifest)}` : '执行通用知识库问答。',
        '请先自动识别用户输入涉及的商家、商品、风格、资料类型和任务意图，不要求用户手动选择；支持解析商家链接、上传资料自动归类、生成商品资料、补全商家信息四类任务。有依据的识别结果可以直接使用，没有依据的部分请标注待确认。',
        getSkillInstructions(skill?.id || null) || '',
        `用户问题：${prompt}`,
        `可用来源：\n${sources.map((item) => `- ${item.title}${item.summary ? `：${item.summary}` : ''}`).join('\n') || '无'}`,
      ].join('\n\n'))
    } catch (error) {
      if (run?.id) await db.from('workspace_skill_runs').update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : '模型请求失败。',
        output_snapshot: { error: error instanceof Error ? error.message : '模型请求失败。' },
        completed_at: new Date().toISOString(),
      }).eq('id', run.id)
      throw error
    }

    await auth.supabase.from('ai_jobs').insert({
      store_id: storeId,
      job_type: skill ? `workspace_skill:${skill.id}` : 'workspace_question',
      status: 'completed',
      model,
      input: { prompt, skill: skill ? { id: skill.id, version: skill.version } : null, sources },
      output: { content: result },
    })

    if (run?.id) await db.from('workspace_skill_runs').update({
      status: 'ready_for_review',
      output_snapshot: { content: result, model },
      completed_at: new Date().toISOString(),
    }).eq('id', run.id)

    return NextResponse.json({ content: result, model })
  } catch (error) {
    console.error('[knowledge.assistant] request failed', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : '模型请求失败。' }, { status: 500 })
  }
}

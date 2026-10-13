import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getOwnedStoreId, requireUser } from '@/lib/api/auth'

export const runtime = 'nodejs'

type SkillRow = {
  id: string
  name: string
  description: string
  icon: string
  category: string
  version: string
}

const previewSkills: SkillRow[] = [
  { id: 'merchant-profile', name: '商家档案解析', description: '提取商家事实并输出待确认的资料更新。', icon: 'building-2', category: 'merchant_profile', version: '0.5.0' },
  { id: 'brand-proposal', name: '品牌提案', description: '基于已确认资料生成可审核的品牌方向。', icon: 'palette', category: 'brand', version: '1.1.0' },
  { id: 'store-copy', name: '店铺文案', description: '把确认资料转换为店铺与商品文案草稿。', icon: 'file-pen-line', category: 'copywriting', version: '1.1.0' },
  { id: 'multi-channel-product-content', name: '商品内容创作', description: '从商品事实与素材出发，生成多渠道文案、商品图片与审核清单。', icon: 'share-2', category: 'commerce_content', version: '0.6.0' },
]

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) {
    if (process.env.NODE_ENV !== 'production') return NextResponse.json({ skills: previewSkills, preview: true })
    return auth.response
  }

  const storeId = await getOwnedStoreId(auth.supabase, auth.user)
  if (!storeId) return NextResponse.json({ error: '未找到可用店铺。' }, { status: 403 })

  const db = auth.supabase as unknown as SupabaseClient<any>
  const { data: versions, error: versionsError } = await db
    .from('workspace_skill_versions')
    .select('id, skill_id, version, manifest, workspace_skills!inner(id, name, description, icon, category, visibility)')
    .eq('is_active', true)
    .eq('workspace_skills.visibility', 'system')

  if (versionsError) return NextResponse.json({ error: versionsError.message }, { status: 500 })

  const { data: existing, error: existingError } = await db
    .from('store_workspace_skills')
    .select('skill_id')
    .eq('store_id', storeId)
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })

  const existingIds = new Set((existing || []).map((row: any) => row.skill_id))
  const defaults = (versions || []).filter((version: any) => !existingIds.has(version.skill_id)).map((version: any) => ({
    store_id: storeId,
    skill_id: version.skill_id,
    skill_version_id: version.id,
    is_enabled: true,
  }))

  if (defaults.length) {
    const { error } = await db.from('store_workspace_skills').insert(defaults)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: enabled, error: enabledError } = await db
    .from('store_workspace_skills')
    .select('id, skill_id, is_enabled, workspace_skill_versions!inner(version, workspace_skills!inner(id, name, description, icon, category))')
    .eq('store_id', storeId)
    .eq('is_enabled', true)

  if (enabledError) return NextResponse.json({ error: enabledError.message }, { status: 500 })

  const skills: SkillRow[] = (enabled || []).map((row: any) => {
    const version = Array.isArray(row.workspace_skill_versions) ? row.workspace_skill_versions[0] : row.workspace_skill_versions
    const skill = Array.isArray(version.workspace_skills) ? version.workspace_skills[0] : version.workspace_skills
    return { id: skill.id, name: skill.name, description: skill.description, icon: skill.icon, category: skill.category, version: version.version }
  })

  return NextResponse.json({ skills })
}

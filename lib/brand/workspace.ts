import { createClientServer } from '@/lib/supabase/server'
import type { Database, Json } from '@/lib/database.types'
import type { Y2KBrandAnalysis } from '@/lib/brand/y2k-analysis'

type BrandProjectInsert = Database['public']['Tables']['brand_projects']['Insert']

export async function getBrandProjectByUserId(userId: string) {
  const supabase = await createClientServer()
  const { data, error } = await supabase
    .from('brand_projects')
    .select('*')
    .eq('user_id', userId)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`读取品牌项目失败: ${error.message}`)
  return data
}

export async function initializeBrandProject(params: {
  userId: string
  name: string
  concept?: string | null
  category?: string | null
  logoUrl?: string | null
}): Promise<string> {
  const supabase = await createClientServer()
  const existing = await getBrandProjectByUserId(params.userId)

  if (existing) {
    const { error } = await supabase
      .from('brand_projects')
      .update({
        name: params.name,
        concept: params.concept || null,
        category: params.category || null,
        logo_url: params.logoUrl || null,
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    if (error) throw new Error(`更新品牌项目失败: ${error.message}`)
    await markProfileOnboardingComplete(params.userId)
    return existing.id
  }

  const insert: BrandProjectInsert = {
    user_id: params.userId,
    name: params.name,
    concept: params.concept || null,
    category: params.category || null,
    logo_url: params.logoUrl || null,
    style: 'y2k',
    status: 'active',
    selected_template: 'tpl-y2k-neon',
    palette: [],
    analysis: {
      source: 'onboarding',
      version: 'v1',
    } satisfies Json,
  }

  const { data, error } = await supabase
    .from('brand_projects')
    .insert(insert)
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(`创建品牌项目失败: ${error?.message || '未返回项目 ID'}`)
  }

  await markProfileOnboardingComplete(params.userId)
  return data.id
}

async function markProfileOnboardingComplete(userId: string) {
  const supabase = await createClientServer()
  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_status: 'completed', updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) throw new Error(`更新用户资料状态失败: ${error.message}`)
}

export async function saveY2KBrandAnalysis(params: {
  userId: string
  analysis: Y2KBrandAnalysis
  assets: Array<{ name: string; type: string; size: number }>
}) {
  const supabase = await createClientServer()
  const project = await getBrandProjectByUserId(params.userId)

  if (!project) {
    throw new Error('请先完成品牌项目初始化')
  }

  const { error: updateError } = await supabase
    .from('brand_projects')
    .update({
      style: 'y2k',
      palette: params.analysis.palette as unknown as Json,
      analysis: params.analysis as unknown as Json,
      selected_template: params.analysis.recommendedTemplateIds[0] || 'tpl-y2k-neon',
      updated_at: new Date().toISOString(),
    })
    .eq('id', project.id)
    .eq('user_id', params.userId)

  if (updateError) throw new Error(`保存品牌识别结果失败: ${updateError.message}`)

  if (params.assets.length > 0) {
    const { error: deleteError } = await supabase
      .from('brand_assets')
      .delete()
      .eq('project_id', project.id)
      .eq('user_id', params.userId)
      .eq('asset_type', 'reference')

    if (deleteError) throw new Error(`更新品牌素材失败: ${deleteError.message}`)

    const { error: assetError } = await supabase.from('brand_assets').insert(
      params.assets.map((asset, index) => ({
        project_id: project.id,
        user_id: params.userId,
        asset_type: 'reference',
        sort_order: index,
        metadata: {
          name: asset.name,
          type: asset.type,
          size: asset.size,
          source: 'brand-style-analysis',
        } satisfies Json,
      }))
    )

    if (assetError) throw new Error(`保存品牌素材失败: ${assetError.message}`)
  }

  return project.id
}

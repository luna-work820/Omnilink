'use server'

import { initializeBrandProject } from '@/lib/brand/workspace'
import { createClientServer } from '@/lib/supabase/server'
import { initializeMerchantStore } from '@/lib/stores/service'

export async function createStoreAction(formData: FormData) {
  const store_name = formData.get('store_name') as string
  const industry_id = formData.get('industry_id') as string | null
  const industry_category = formData.get('industry_category') as string | null
  const logo_url = formData.get('logo_url') as string | null
  const description = formData.get('description') as string | null

  const name = store_name?.trim()
  const concept = description?.trim() || null

  if (!name) {
    return { success: false, error: '发布者名称不能为空' }
  }

  // Get user from Supabase session
  const supabase = await createClientServer()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return { success: false, error: '未检测到有效登录状态，请先登录' }
  }

  try {
    await initializeMerchantStore({
      owner_id: user.id,
      store_name: name,
      currency: 'CNY',
    })
    await initializeBrandProject({
      userId: user.id,
      name,
      category: industry_category || industry_id || null,
      logoUrl: logo_url || null,
      concept,
    })
    return { success: true, redirectUrl: '/dashboard?workspace=merchant' }
  } catch (error) {
    return {
      success: false,
      error: `初始化品牌失败: ${error instanceof Error ? error.message : error}`,
    }
  }
}

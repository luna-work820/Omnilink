'use server'

import { getBrandProjectByUserId, initializeBrandProject } from '@/lib/brand/workspace'
import { createClientServer } from '@/lib/supabase/server'
import { getStoreByOwnerId, initializeMerchantStore } from '@/lib/stores/service'

import { enableWorkspaceCapability } from '@/lib/workspace/enable-capability'
import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export async function createStoreAction(formData: FormData) {
  const capability = formData.get('capability') ?? 'merchant'
  if (capability !== 'creator' && capability !== 'merchant') return { success: false, error: '开通类型无效' }
  const submittedName = formData.get('store_name')
  const store_name = typeof submittedName==='string'?submittedName:''
  const industry_id = formData.get('industry_id') as string | null
  const industry_category = formData.get('industry_category') as string | null
  const logo_url = formData.get('logo_url') as string | null
  const submittedDescription = formData.get('description')
  const description = typeof submittedDescription==='string'?submittedDescription:''

  const name = store_name?.trim()
  const concept = description?.trim() || null

  if (!name || name.length>40 || (concept?.length??0)>240) {
    return { success: false, error: !name ? (capability==='creator'?'请填写昵称':'请填写店铺名称') : '名称最多 40 字，简介最多 240 字' }
  }

  // Get user from Supabase session
  const supabase = await createClientServer()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return { success: false, error: '未检测到有效登录状态，请先登录' }
  }

  try {
    const existing = await getStoreByOwnerId(user.id)
    if (capability === 'creator' && !existing) {
      const { error } = await createServiceRoleClient().auth.admin.updateUserById(user.id, { app_metadata: { merchant_enabled: false } })
      if (error) throw new Error('开通失败，请重试')
    }
    await initializeMerchantStore({
      owner_id: user.id,
      store_name: name,
      currency: 'CNY',
    })
    if (!await getBrandProjectByUserId(user.id)) await initializeBrandProject({
      userId: user.id,
      name,
      category: industry_category || industry_id || null,
      logoUrl: logo_url || null,
      concept,
    })
    if (capability === 'creator') {
      const { error } = await supabase.auth.updateUser({
        data: {
          creator_profile: { name, bio: concept || '' },
          ...(user.app_metadata?.creator_enabled === true ? {} : { creator_upload_intro_pending: true }),
        },
      })
      if (error) throw new Error('创作者资料保存失败，请重试')
    }
    await enableWorkspaceCapability(user, capability, Boolean(existing))
    const {error:refreshError}=await supabase.auth.refreshSession()
    if(refreshError)throw new Error('登录状态刷新失败，请重新登录后继续')
    revalidatePath('/dashboard', 'layout')
    revalidatePath('/discover')
    return { success: true, redirectUrl: capability === 'creator' ? '/dashboard/content' : '/dashboard' }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '开通失败，请重试',
    }
  }
}

export async function dismissCreatorUploadIntroAction() {
  const supabase = await createClientServer()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user || user.app_metadata?.creator_enabled !== true) return
  if (user.user_metadata?.creator_upload_intro_pending !== true) return
  const { error } = await supabase.auth.updateUser({ data: { creator_upload_intro_pending: false } })
  if (error) throw new Error('无法保存创作者提示状态')
}

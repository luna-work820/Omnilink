import 'server-only'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { workspaceCapabilities } from './capabilities'
import type { User } from '@supabase/supabase-js'

export async function enableWorkspaceCapability(user: User, capability: 'creator' | 'merchant', hadStore: boolean) {
  const current = workspaceCapabilities(user.app_metadata, hadStore)
  const { error } = await createServiceRoleClient().auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...(capability === 'creator' ? { creator_enabled: true, merchant_enabled: current.merchant } : { merchant_enabled: true }),
    },
  })
  if (error) throw new Error('开通失败，请重试')
}

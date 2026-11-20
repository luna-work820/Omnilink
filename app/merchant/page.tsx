import { workspaceCapabilities } from '@/lib/workspace/capabilities'
import { redirect } from 'next/navigation'
import { createClientServer } from '@/lib/supabase/server'
import { getStoreByOwnerId } from '@/lib/stores/service'

export default async function MerchantEntryPage() {
  const supabase = await createClientServer()
  let user = null

  try {
    const { data } = await supabase.auth.getUser()
    user = data?.user ?? null
  } catch {
    user = null
  }

  if (!user) {
    redirect('/login?next=%2Fmerchant')
  }

  const store = await getStoreByOwnerId(user.id)
  if (!workspaceCapabilities(user.app_metadata, Boolean(store)).merchant) {
    redirect('/onboarding')
  }

  redirect('/dashboard')
}

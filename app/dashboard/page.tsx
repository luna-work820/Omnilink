import { createClientServer } from '@/lib/supabase/server'
import { WorkbenchHome } from '@/components/dashboard/v3-UI/WorkbenchHome'
import { getBrandProjectByUserId } from '@/lib/brand/workspace'
import { DEMO_BRAND_PROJECT, DEMO_PROFILE } from '@/lib/preview/demo-workspace'
import { redirect } from 'next/navigation'
import { getStoreByOwnerId } from '@/lib/stores/service'

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const params = await searchParams
  const supabase = await createClientServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <WorkbenchHome displayName={DEMO_PROFILE.name} merchantProject={DEMO_BRAND_PROJECT} />
  }

  const creatorEnabled = user.app_metadata?.creator_enabled === true
  const store = creatorEnabled ? await getStoreByOwnerId(user.id) : null
  const merchantWorkspaceRequested = params.workspace === 'merchant' && Boolean(store)
  if (creatorEnabled && !merchantWorkspaceRequested && (user.app_metadata?.workspace_mode === 'creator' || !store)) {
    redirect('/dashboard/content')
  }

  const project = await getBrandProjectByUserId(user.id)
  if (!project) return null

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    user.email ||
    '商家'

  return <WorkbenchHome displayName={displayName} merchantProject={project} />
}

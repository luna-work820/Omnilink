import { workspaceCapabilities } from '@/lib/workspace/capabilities'
import { redirect } from 'next/navigation'
import { createClientServer } from '@/lib/supabase/server'
import { V3DashboardShell } from '@/components/dashboard/v3-UI/V3DashboardShell'
import { DashboardWorkspaceProvider } from '@/components/dashboard/DashboardWorkspaceProvider'
import { getBrandProjectByUserId } from '@/lib/brand/workspace'
import { getStoreByOwnerId } from '@/lib/stores/service'
import { DEMO_BRAND_PROJECT, DEMO_PROFILE } from '@/lib/preview/demo-workspace'

/**
 * /dashboard/* — first line of defense.
 *
 * Middleware only refreshes the session cookie; the real authorization gate
 * lives here. Every dashboard route is rendered through this layout, so a
 * missing or invalid session at this layer guarantees a redirect to /login
 * before any page code (including client components) can read store/user
 * data.
 *
 * RLS + page-level `requireUser()` remain defense-in-depth; this layer
 * guarantees the *layout* itself never renders for anonymous visitors.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClientServer()
  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data?.user ?? null
  } catch {
    user = null
  }

  const localPreview = process.env.NODE_ENV !== 'production' && !user
  const creatorEnabled = user?.app_metadata?.creator_enabled === true

  if (!user && !localPreview) {
    redirect('/login')
  }

  const [project, store] = user
    ? await Promise.all([getBrandProjectByUserId(user.id), getStoreByOwnerId(user.id)])
    : [DEMO_BRAND_PROJECT, null]
  const capabilities = localPreview ? { creator: false, merchant: true } : workspaceCapabilities(user?.app_metadata, Boolean(project && store))
  if ((!project || !store) && !localPreview && !creatorEnabled) {
    redirect('/onboarding')
  }

  const profile = {
    id: user?.id ?? DEMO_PROFILE.id,
    email: user?.email ?? DEMO_PROFILE.email,
    name: user
      ? (user.user_metadata?.full_name as string | undefined) ||
        (user.user_metadata?.name as string | undefined) ||
        user.email ||
        '创作者'
      : DEMO_PROFILE.name,
    avatarUrl: user
      ? (user.user_metadata?.avatar_url as string | undefined) ||
        (user.user_metadata?.picture as string | undefined) ||
        null
      : DEMO_PROFILE.avatarUrl,
  }

  return (
    <V3DashboardShell
      profile={profile}
      capabilities={capabilities}
      demo={localPreview}
    >
      <DashboardWorkspaceProvider>{children}</DashboardWorkspaceProvider>
    </V3DashboardShell>
  )
}

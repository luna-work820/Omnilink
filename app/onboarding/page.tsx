import { workspaceCapabilities } from '@/lib/workspace/capabilities'
import { redirect } from 'next/navigation'
import { createClientServer } from '@/lib/supabase/server'
import { StoreCreateForm } from '@/components/onboarding/StoreCreateForm'
import { getBrandProjectByUserId } from '@/lib/brand/workspace'
import { getStoreByOwnerId } from '@/lib/stores/service'
import Link from 'next/link'

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ capability?: string }> }) {
  const capability = (await searchParams).capability === 'creator' ? 'creator' : 'merchant'
  const supabase = await createClientServer()
  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data?.user ?? null
  } catch {
    user = null
  }

  if (!user) {
    redirect('/login')
  }

  const [existingProject, existingStore] = await Promise.all([
    getBrandProjectByUserId(user.id),
    getStoreByOwnerId(user.id),
  ])
  if (existingProject && existingStore && workspaceCapabilities(user.app_metadata, true)[capability]) {
    redirect(capability === 'creator' ? '/dashboard/content' : '/dashboard')
  }

  return (
    <main className="min-h-dvh bg-[var(--background)] px-5 py-8 text-[var(--ink)]">
      <header className="mx-auto mb-12 flex max-w-lg items-center justify-between gap-4">
        <Link href="/discover" className="text-sm font-semibold">Omnilink</Link>
        <Link href="/discover" className="rounded-full px-3 py-2 text-sm hover:bg-[var(--surface-muted)]">返回</Link>
      </header>
      <StoreCreateForm capability={capability} initialName={existingStore?.name || ''} />
    </main>
  )
}

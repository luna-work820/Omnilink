import { redirect } from 'next/navigation'
import { createClientServer } from '@/lib/supabase/server'
import { CreatorContentManager } from '@/components/creator-content/CreatorContentManager'
import { CreatorContentWorkspace } from '@/components/creator-content/CreatorContentWorkspace'

export default async function ContentManagementPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams
  const supabase = await createClientServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    const destination = typeof edit === 'string' ? `/dashboard/content/manage?edit=${encodeURIComponent(edit)}` : '/dashboard/content/manage'
    redirect(`/login?next=${encodeURIComponent(destination)}`)
  }
  if (user.app_metadata?.creator_enabled !== true) redirect('/dashboard')
  if (edit && /^[0-9a-f-]{36}$/i.test(edit)) return <CreatorContentWorkspace requestedId={edit} />
  return <CreatorContentManager key={user.id} ownerKey={`omnilink-creator-video-draft:${user.id}`} publishingHref="/dashboard/content" />
}

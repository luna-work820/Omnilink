import { redirect } from 'next/navigation'
import { createClientServer } from '@/lib/supabase/server'
import { CreatorContentManager } from '@/components/creator-content/CreatorContentManager'
import { CreatorContentWorkspace } from '@/components/creator-content/CreatorContentWorkspace'

export default async function ContentManagementPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const supabase = await createClientServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/creator?preview=1&view=manage')
  if (user.app_metadata?.creator_enabled !== true) redirect('/dashboard')
  const { edit } = await searchParams
  if (edit && /^[0-9a-f-]{36}$/i.test(edit)) return <CreatorContentWorkspace requestedId={edit} />
  return <CreatorContentManager key={user.id} ownerKey={`omnilink-creator-video-draft:${user.id}`} publishingHref="/dashboard/content" />
}

import { createClientServer } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CreatorPublishingWorkspace } from '@/components/creator-content/CreatorPublishingWorkspace'
import type { Viewport } from 'next'

export const viewport: Viewport = { interactiveWidget: 'resizes-content' }

export default async function ContentPage({ searchParams }: { searchParams: Promise<{ from?: string; post?: string }> }) {
  const supabase = await createClientServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/creator?preview=1&view=content')
  if (user && user.app_metadata?.creator_enabled !== true) redirect('/dashboard')
  const params = await searchParams
  return <CreatorPublishingWorkspace key={params.post ?? 'new'} draftKey={`omnilink-creator-video-draft:${user.id}`} recordId={params.post} fromWorkbench={params.from === 'workbench'} />
}

import { createClientServer } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CreatorPublishingWorkspace } from '@/components/creator-content/CreatorPublishingWorkspace'
import type { Viewport } from 'next'

export const viewport: Viewport = { interactiveWidget: 'resizes-content' }

export default async function ContentPage({ searchParams }: { searchParams: Promise<{ from?: string; post?: string }> }) {
  const params = await searchParams
  const supabase = await createClientServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    const query = new URLSearchParams()
    if (typeof params.post === 'string') query.set('post', params.post)
    if (params.from === 'workbench') query.set('from', params.from)
    const destination = `/dashboard/content${query.size ? `?${query}` : ''}`
    redirect(`/login?next=${encodeURIComponent(destination)}`)
  }
  if (user && user.app_metadata?.creator_enabled !== true) redirect('/dashboard')
  return <CreatorPublishingWorkspace key={params.post ?? 'new'} draftKey={`omnilink-creator-video-draft:${user.id}`} recordId={params.post} fromWorkbench={params.from === 'workbench'} />
}

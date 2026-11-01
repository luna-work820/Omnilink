import { CreatorContentWorkspace } from '@/components/creator-content/CreatorContentWorkspace'
import { createClientServer } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function ContentPage({ searchParams }: { searchParams: Promise<{ id?: string; new?: string }> }) {
  const params = await searchParams
  const supabase = await createClientServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (user && user.app_metadata?.creator_enabled !== true) redirect('/dashboard')
  return <CreatorContentWorkspace requestedId={params.id} startNew={params.new === '1'} />
}

import { CreatorWorksManager } from '@/components/creator-content/CreatorContentWorkspace'
import { createClientServer } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function WorksPage() {
  const supabase = await createClientServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (user && user.app_metadata?.creator_enabled !== true) redirect('/dashboard')
  return <CreatorWorksManager />
}

import { redirect } from 'next/navigation'
import { createClientServer } from '@/lib/supabase/server'
import { getStoreByOwnerId } from '@/lib/stores/service'
import {CreatorWorkbenchPreview} from '@/components/creator-content/CreatorWorkbenchPreview'
import type { Viewport } from 'next'

export const viewport: Viewport = { interactiveWidget: 'resizes-content' }

export default async function CreatorEntryPage({searchParams}:{searchParams:Promise<{preview?:string;view?:string;from?:string;post?:string}>}) {
  const params=await searchParams
  if(process.env.NODE_ENV!=='production'&&params.preview==='1')return <CreatorWorkbenchPreview view={params.view==='manage'?'manage':'content'} recordId={params.post} fromWorkbench={params.from==='workbench'}/>
  const supabase = await createClientServer()
  let user=null
  try{const {data}=await supabase.auth.getUser();user=data.user}catch{user=null}
  if (!user) redirect('/login?next=%2Fcreator')
  const store = await getStoreByOwnerId(user.id)
  if (user.app_metadata?.creator_enabled === true && store) redirect('/dashboard/content')
  redirect('/onboarding?capability=creator')
}

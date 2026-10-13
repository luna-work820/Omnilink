import { redirect } from 'next/navigation'
import { BrandStudioWizard } from '@/components/onboarding/wizard'
import { createClientServer } from '@/lib/supabase/server'
import { getBrandProjectByUserId } from '@/lib/brand/workspace'

export default async function BrandStudioPage() {
  const supabase = await createClientServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const project = await getBrandProjectByUserId(user.id)
  if (!project) redirect('/onboarding')

  return <BrandStudioWizard />
}

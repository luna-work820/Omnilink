import { redirect } from 'next/navigation'
import { createClientServer } from '@/lib/supabase/server'
import { KeynoteMotionLanding } from '@/components/landing'

export default async function LoginPage() {
  const supabase = await createClientServer()
  let user = null

  try {
    const { data } = await supabase.auth.getUser()
    user = data?.user ?? null
  } catch {
    user = null
  }

  if (user) {
    redirect('/onboarding')
  }

  if (process.env.NODE_ENV !== 'production') {
    redirect('/dashboard')
  }

  return <KeynoteMotionLanding initialShowLogin={true} />
}

import { redirect } from 'next/navigation'
import { createClientServer } from '@/lib/supabase/server'
import PackageLoginPage from '@/components/login-package/App'

export const metadata = {
  title: 'OMNILINK — 独立美学购物',
}

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
    redirect('/discover')
  }

  return <PackageLoginPage />
}

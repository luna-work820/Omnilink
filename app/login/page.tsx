import { redirect } from 'next/navigation'
import { createClientServer } from '@/lib/supabase/server'
import { safeInternalRedirectPath } from '@/lib/auth/redirect-path'
import PackageLoginPage from '@/components/login-package/App'

export const metadata = {
  title: '登录 | Omnilink',
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[]; error?: string }> }) {
  const params = await searchParams
  const redirectTo = safeInternalRedirectPath(params.next, '/discover')
  const hasRedirectTo = typeof params.next === 'string'
  const supabase = await createClientServer()
  let user = null

  try {
    const { data } = await supabase.auth.getUser()
    user = data?.user ?? null
  } catch {
    user = null
  }

  if (user) {
    redirect(redirectTo)
  }

  return <PackageLoginPage confirmationError={params.error === 'auth_callback_failed'} redirectTo={hasRedirectTo ? redirectTo : undefined} />
}

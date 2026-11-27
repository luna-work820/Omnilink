import { redirect } from 'next/navigation'
import Script from 'next/script'
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

  return <>
    <PackageLoginPage confirmationError={params.error === 'auth_callback_failed'} redirectTo={hasRedirectTo ? redirectTo : undefined} />
    <Script id="impact-tracking" strategy="afterInteractive">{`(function(i,m,p,a,c,t){c.ire_o=p;c[p]=c[p]||function(){(c[p].a=c[p].a||[]).push(arguments)};t=a.createElement(m);var z=a.getElementsByTagName(m)[0];t.async=1;t.src=i;z.parentNode.insertBefore(t,z)})('https://utt.impactcdn.com/P-A8204156-4e97-47fa-a73f-30751a9075b01.js','script','impactStat',document,window);impactStat('transformLinks');impactStat('trackImpression');`}</Script>
  </>
}

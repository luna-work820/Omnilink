import { beforeEach, describe, expect, it, vi } from 'vitest'

const { signIn, createClient } = vi.hoisted(() => ({
  signIn: vi.fn(),
  createClient: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({ createClientServer: createClient }))
vi.mock('next/headers', () => ({ headers: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

import { loginAction } from '@/app/actions/auth'

function credentials(redirectTo?: string) {
  const form = new FormData()
  form.set('email', ' user@example.com ')
  form.set('password', 'test-password')
  if (redirectTo) form.set('redirectTo', redirectTo)
  return form
}

describe('existing account login', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    createClient.mockResolvedValue({ auth: { signInWithPassword: signIn } })
    signIn.mockResolvedValue({ error: null })
  })

  it('opens the waterfall feed after successful sign-in', async () => {
    expect(await loginAction(null, credentials())).toEqual({ redirectUrl: '/discover' })
    expect(signIn).toHaveBeenCalledWith({ email: 'user@example.com', password: 'test-password' })
  })

  it('rejects external redirect destinations', async () => {
    expect(await loginAction(null, credentials('https://example.com'))).toEqual({ redirectUrl: '/discover' })
  })

  it('retains a safe internal destination', async () => {
    expect(await loginAction(null, credentials('/dashboard/products'))).toEqual({ redirectUrl: '/dashboard/products' })
  })

  it('stays on login when credentials are rejected', async () => {
    signIn.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    expect(await loginAction(null, credentials())).toEqual({ error: expect.stringContaining('账号或密码不正确') })
  })

  it('shows a retryable error when the auth request throws', async () => {
    signIn.mockRejectedValue(new Error('fetch failed'))
    expect(await loginAction(null, credentials())).toEqual({ error: '暂时无法登录，请稍后重试。' })
  })

  it('does not submit an empty form', async () => {
    expect(await loginAction(null, new FormData())).toEqual({ error: '请填写电子邮箱和密码' })
    expect(signIn).not.toHaveBeenCalled()
  })
})

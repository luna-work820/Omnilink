import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mock = vi.hoisted(() => ({ exchange: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClientServer: async () => ({ auth: { exchangeCodeForSession: mock.exchange } }) }))
import { GET } from '@/app/auth/callback/route'
beforeEach(() => { vi.resetAllMocks(); mock.exchange.mockResolvedValue({ error: null }) })
it('establishes the session before returning email confirmations to the feed', async () => {
  const response = await GET(new NextRequest('https://omnilink.example/auth/callback?code=confirmation'))
  expect(mock.exchange).toHaveBeenCalledWith('confirmation')
  expect(response.headers.get('location')).toBe('https://omnilink.example/discover')
})
it('does not follow external callback destinations', async () => {
  const response = await GET(new NextRequest('https://omnilink.example/auth/callback?code=confirmation&next=https://evil.example'))
  expect(response.headers.get('location')).toBe('https://omnilink.example/discover')
})
it('returns expired or failed confirmations to a visible login error', async () => {
  mock.exchange.mockRejectedValue(new Error('expired'))
  const response = await GET(new NextRequest('https://omnilink.example/auth/callback?code=expired'))
  expect(response.headers.get('location')).toBe('https://omnilink.example/login?error=auth_callback_failed')
})

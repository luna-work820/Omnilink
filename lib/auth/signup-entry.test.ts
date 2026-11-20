import { describe, expect, it, vi, beforeEach } from 'vitest'
import { needsSignupInvitation, signupInvitationStorageKey } from './signup-entry'
const mock = vi.hoisted(() => ({ signup: vi.fn(), create: vi.fn(), headers: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClientServer: mock.create }))
vi.mock('next/headers', () => ({ headers: mock.headers }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
import { signupAction } from '@/app/actions/auth'

const form = () => { const f = new FormData(); f.set('email', 'person@example.com'); f.set('password', 'test-password'); f.set('redirectTo', '/discover?openAssistant=1'); return f }
beforeEach(() => {
  vi.resetAllMocks()
  mock.create.mockResolvedValue({ auth: { signUp: mock.signup } })
  mock.headers.mockResolvedValue(new Headers({ host: 'omnilink.example', 'x-forwarded-proto': 'https' }))
})
describe('signup entry', () => {
  it('does not send existing users or completed invitations through onboarding again', () => {
    expect(needsSignupInvitation(undefined)).toBe(false)
    expect(needsSignupInvitation({ ai_assistant_onboarding_started: true })).toBe(false)
    expect(needsSignupInvitation({ signup_invitation_version: 1 })).toBe(true)
    expect(needsSignupInvitation({ signup_invitation_version: 1, signup_invitation_seen: true })).toBe(false)
    expect(signupInvitationStorageKey('a')).not.toBe(signupInvitationStorageKey('b'))
  })
  it('lands immediate sessions on the feed rather than opening chat or a questionnaire', async () => {
    mock.signup.mockResolvedValue({ data: { session: {} }, error: null })
    expect(await signupAction(null, form())).toEqual({ redirectUrl: '/discover' })
    expect(mock.signup).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining({
      data: expect.objectContaining({ signup_invitation_version: 1, signup_invitation_seen: false }),
      emailRedirectTo: 'https://omnilink.example/auth/callback?next=%2Fdiscover',
    }) }))
  })
  it('waits for email confirmation when no session exists', async () => {
    mock.signup.mockResolvedValue({ data: { session: null }, error: null })
    expect(await signupAction(null, form())).toEqual({ message: expect.stringContaining('激活链接') })
  })
  it('shows a retryable signup failure when auth transport fails', async () => {
    mock.signup.mockRejectedValue(new Error('network'))
    expect(await signupAction(null, form())).toEqual({ error: '暂时无法注册，请稍后重试。' })
  })
})

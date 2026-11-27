import { describe, expect, it, vi, beforeEach } from 'vitest'
import { needsSignupInvitation, signupInvitationStorageKey } from './signup-entry'
const mock = vi.hoisted(() => ({ signup: vi.fn(), resend: vi.fn(), rpc: vi.fn(), create: vi.fn(), headers: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClientServer: mock.create }))
vi.mock('next/headers', () => ({ headers: mock.headers }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
import { resendSignupConfirmationAction, signupAction } from '@/app/actions/auth'

const form = () => { const f = new FormData(); f.set('name', '测试用户'); f.set('email', 'person@example.com'); f.set('password', 'test-password'); f.set('redirectTo', '/discover?openAssistant=1'); return f }
beforeEach(() => {
  vi.resetAllMocks()
  mock.create.mockResolvedValue({ auth: { signUp: mock.signup, resend: mock.resend }, rpc: mock.rpc })
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
    expect(await signupAction(null, form())).toMatchObject({ message: expect.stringContaining('确认邮件'), canResendConfirmation: true })
  })
  it('reports a confirmed duplicate email returned as an obfuscated user', async () => {
    mock.signup.mockResolvedValue({ data: { session: null, user: { identities: [] } }, error: null })
    expect(await signupAction(null, form())).toEqual({ error: expect.stringContaining('邮箱已被注册') })
    expect(mock.rpc).not.toHaveBeenCalled()
  })
  it('recognizes the provider’s explicit duplicate-email error', async () => {
    mock.signup.mockResolvedValue({ data: null, error: { code: 'user_already_exists', message: 'User already registered' } })
    expect(await signupAction(null, form())).toEqual({ error: expect.stringContaining('邮箱已被注册') })
  })
  it('keeps an unconfirmed registration in the email-verification flow', async () => {
    mock.signup.mockResolvedValue({ data: { session: null, user: { identities: [{ provider: 'email' }] } }, error: null })
    expect(await signupAction(null, form())).toMatchObject({ message: expect.stringContaining('已提交注册'), canResendConfirmation: true })
  })
  it('reports a duplicate username after the database rejects creation', async () => {
    mock.signup.mockResolvedValue({ data: null, error: { code: 'unexpected_failure', message: 'Database error saving new user' } })
    mock.rpc.mockResolvedValue({ data: true, error: null })
    expect(await signupAction(null, form())).toEqual({ error: expect.stringContaining('用户名已被使用') })
    expect(mock.rpc).toHaveBeenCalledWith('signup_username_taken', { candidate: '测试用户' })
  })
  it('does not misreport other database failures as duplicate usernames', async () => {
    mock.signup.mockResolvedValue({ data: null, error: { message: 'Database error saving new user' } })
    mock.rpc.mockResolvedValue({ data: false, error: null })
    expect(await signupAction(null, form())).toEqual({ error: '暂时无法注册，请稍后重试。' })
  })
  it('requires a username before contacting the registration service', async () => {
    const missing = form(); missing.set('name', '  ')
    expect(await signupAction(null, missing)).toEqual({ error: '请填写用户名' })
    expect(mock.signup).not.toHaveBeenCalled()
  })
  it('explains when the email service cannot send to the entered address', async () => {
    mock.signup.mockResolvedValue({ data: null, error: { code: 'email_address_not_authorized', message: 'Email address not authorized' } })
    expect(await signupAction(null, form())).toEqual({ error: expect.stringContaining('无法接收确认邮件') })
  })
  it('resends confirmation to the submitted email with the same callback', async () => {
    mock.resend.mockResolvedValue({ error: null })
    expect(await resendSignupConfirmationAction(null, form())).toMatchObject({ message: expect.stringContaining('确认邮件') })
    expect(mock.resend).toHaveBeenCalledWith({ type: 'signup', email: 'person@example.com', options: { emailRedirectTo: 'https://omnilink.example/auth/callback?next=%2Fdiscover' } })
  })
  it('rejects invalid resend addresses before contacting the mail service', async () => {
    const invalid = new FormData(); invalid.set('email', 'invalid')
    expect(await resendSignupConfirmationAction(null, invalid)).toEqual({ error: '请填写有效的电子邮箱地址。' })
    expect(mock.resend).not.toHaveBeenCalled()
  })
  it('shows a retryable signup failure when auth transport fails', async () => {
    mock.signup.mockRejectedValue(new Error('network'))
    expect(await signupAction(null, form())).toEqual({ error: '暂时无法注册，请稍后重试。' })
  })
})

'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { SIGNUP_DESTINATION, SIGNUP_INVITATION_VERSION } from '@/lib/auth/signup-entry'
import { safeInternalRedirectPath } from '@/lib/auth/redirect-path'
import { createClientServer } from '@/lib/supabase/server'

/**
 * Resolve the origin this request was served from.
 *
 * Needed because signUp() without `emailRedirectTo` falls back to the
 * "Site URL" configured in Supabase Dashboard — which is usually still
 * http://localhost:3000. On a deployed site that means the confirmation
 * link lands on localhost, the session cookie is written to localhost, and
 * the deployment the user actually signed up from never gets a session.
 * Deriving the origin from the request makes signup work on any hostname
 * (Vercel production, per-push preview URLs, or a custom domain).
 */
async function getRequestOrigin(): Promise<string | undefined> {
  try {
    const h = await headers()
    const host = h.get('x-forwarded-host') ?? h.get('host')
    if (!host) return undefined
    const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
    return `${proto}://${host}`
  } catch {
    return undefined
  }
}

async function getSignupConfirmationRedirectTo(): Promise<string | undefined> {
  const origin = await getRequestOrigin()
  return origin ? `${origin}/auth/callback?next=${encodeURIComponent(SIGNUP_DESTINATION)}` : undefined
}

/**
 * P0 Auth Flow — server actions for sign in / sign up / sign out.
 *
 * Uses Supabase Email + Password. No magic link, no OAuth, no third-party
 * SDK. The goal is to establish a Supabase session cookie so that
 * subsequent Server Actions (e.g. createStoreAction) can call
 * supabase.auth.getUser() and get a non-null user.
 *
 * Session cookie name: sb-<ref>-auth-token, set by supabase.auth.* methods
 * via the createClientServer() cookie adapter in lib/supabase/server.ts.
 *
 * IMPORTANT: signup may or may not produce a session depending on the
 * project's "Confirm email" setting in Supabase Dashboard → Auth.
 * If confirmation is on, signUp() returns data.session === null and the
 * user must click the link in the email (handled by /auth/callback).
 * If confirmation is off, signUp() returns a session and we redirect.
 */

export type AuthState = { error?: string; message?: string; redirectUrl?: string; canResendConfirmation?: boolean } | null

function isNetworkError(error: { message?: string } | null | undefined): boolean {
  const message = error?.message?.toLowerCase() ?? ''
  return (
    message.includes('failed to fetch') ||
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('econnreset') ||
    message.includes('enotfound')
  )
}

function authEmailErrorMessage(error: { message: string; code?: string }): string {
  const normalized = `${error.code ?? ''} ${error.message}`.toLowerCase()
  if (/email_address_not_authorized|email address (?:is )?not authorized/.test(normalized)) {
    return '当前邮箱暂时无法接收确认邮件，请使用其他邮箱或稍后重试。'
  }
  if (normalized.includes('over_email_send_rate_limit') || normalized.includes('email rate limit exceeded')) {
    return '邮件发送过于频繁，请稍后重试。'
  }
  return error.message
}

export async function loginAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const redirectTo = safeInternalRedirectPath(formData.get('redirectTo'), '/discover')

  if (!email || !password) {
    return { error: '请填写电子邮箱和密码' }
  }

  let error: { message: string } | null
  try {
    const supabase = await createClientServer()
    const result = await supabase.auth.signInWithPassword({ email, password })
    error = result.error
  } catch {
    return { error: '暂时无法登录，请稍后重试。' }
  }

  if (error) {
    if (isNetworkError(error)) {
      return { error: '当前环境无法连接 Supabase，请检查网络或代理后重试。' }
    }
    if (error.message.includes('Invalid login credentials')) {
      return {
        error:
          '账号或密码不正确。如果您尚未注册该账号，请切换至「注册」创建新账号。',
      }
    }
    if (error.message.includes('Email not confirmed')) {
      return {
        error:
          '该邮箱尚未完成验证。Supabase 已发送确认邮件，请前往您的邮箱点击激活链接后再登录。',
      }
    }
    return { error: error.message }
  }

  // signInWithPassword sets the sb-*-auth-token cookie via the SSR adapter.
  return { redirectUrl: redirectTo }
}

export async function signupAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const name = String(formData.get('name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const redirectTo = SIGNUP_DESTINATION

  if (!name) {
    return { error: '请填写用户名' }
  }
  if (name.length > 40) {
    return { error: '用户名不能超过 40 个字符' }
  }
  if (!email || !password) {
    return { error: '请填写电子邮箱和密码' }
  }

  if (password.length < 6) {
    return { error: '密码长度不能少于 6 个字符' }
  }

  try {
    const supabase = await createClientServer()
    const emailRedirectTo = await getSignupConfirmationRedirectTo()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { signup_invitation_version: SIGNUP_INVITATION_VERSION, signup_invitation_seen: false, ai_assistant_onboarding_started: true, enabled_skills: ['personal-advisor'], ...(name ? { full_name: name } : {}) },
        ...(emailRedirectTo ? { emailRedirectTo } : {}),
      },
    })

    if (error) {
      if (isNetworkError(error)) {
        return { error: '当前环境无法连接 Supabase，注册请求未提交，请检查网络或代理后重试。' }
      }
      if (error.code === 'user_already_exists' || error.message.toLowerCase().includes('already registered')) {
        return { error: '该邮箱已被注册，请直接切换至「登录」模式。' }
      }
      if (error.message.toLowerCase().includes('database error saving new user')) {
        const { data: taken, error: lookupError } = await supabase.rpc('signup_username_taken', { candidate: name })
        if (!lookupError && taken === true) return { error: '用户名已被使用，请更换用户名。' }
        return { error: '暂时无法注册，请稍后重试。' }
      }
      return { error: authEmailErrorMessage(error) }
    }

    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return { error: '该邮箱已被注册，请直接切换至「登录」模式。' }
    }

    // Email confirmation ON: Supabase returns a user but no session.
    // User must click the confirmation link (handled by /auth/callback).
    if (!data.session) {
      return {
        message: '该邮箱已提交注册，请查收确认邮件完成验证。',
        canResendConfirmation: true,
      }
    }

    // Email confirmation OFF: session is established immediately.
    return { redirectUrl: redirectTo }
  } catch {
    return { error: '暂时无法注册，请稍后重试。' }
  }
}

export async function resendSignupConfirmationAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim()
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: '请填写有效的电子邮箱地址。' }
  }

  try {
    const supabase = await createClientServer()
    const emailRedirectTo = await getSignupConfirmationRedirectTo()
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      ...(emailRedirectTo ? { options: { emailRedirectTo } } : {}),
    })

    if (error) {
      if (isNetworkError(error)) {
        return { error: '当前环境无法连接 Supabase，请检查网络或代理后重试。' }
      }
      return { error: authEmailErrorMessage(error) }
    }

    return { message: '确认邮件发送请求已提交，请查收收件箱。' }
  } catch {
    return { error: '暂时无法重新发送确认邮件，请稍后重试。' }
  }
}

export async function logoutAction(formData: FormData): Promise<void> {
  void formData
  const supabase = await createClientServer()
  await supabase.auth.signOut()
  redirect('/login')
}

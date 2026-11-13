import { NextResponse } from 'next/server'
import { createClientServer } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

type Client = Awaited<ReturnType<typeof createClientServer>>
type RequestUser =
  | { ok: true; supabase: Client; user: User | null }
  | { ok: false; response: NextResponse }

function failure(status: number, code: string, error: string): RequestUser {
  return { ok: false, response: NextResponse.json({ error, code }, { status }) }
}

export async function resolveRequestUser(request?: Request): Promise<RequestUser> {
  let supabase: Client
  try {
    supabase = await createClientServer()
  } catch {
    return failure(500, 'AUTH_CLIENT_INIT_FAILED', '认证配置不可用。')
  }
  const authorization = request?.headers.get('authorization')
  const hasCookie = /(?:^|;\s*)sb-[^=;]+-auth-token(?:\.\d+)?=/.test(request?.headers.get('cookie') ?? '')
  const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1]
  if (authorization && !token) return failure(401, 'INVALID_SESSION', '登录状态无效，请重新登录。')
  try {
    const { data, error } = await supabase.auth.getUser(token)
    if (error) {
      if (error.name === 'AuthSessionMissingError' && !authorization && !hasCookie) {
        return { ok: true, supabase, user: null }
      }
      if (error.status && error.status >= 400 && error.status < 500 && error.status !== 429) {
        return failure(401, 'INVALID_SESSION', '登录状态无效，请重新登录。')
      }
      return failure(503, 'AUTH_UNAVAILABLE', '身份验证暂时不可用，请稍后重试。')
    }
    if (!data.user && (authorization || hasCookie)) {
      return failure(401, 'INVALID_SESSION', '登录状态无效，请重新登录。')
    }
    return { ok: true, supabase, user: data.user }
  } catch {
    return failure(503, 'AUTH_UNAVAILABLE', '身份验证暂时不可用，请稍后重试。')
  }
}

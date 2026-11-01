import 'server-only'

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'

export const DEEPSEEK_KEY_COOKIE = 'omnilink_deepseek_key'

function encryptionKey() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('DeepSeek 凭据加密未配置。')
  return createHash('sha256').update(secret).digest()
}

export function sealDeepSeekKey(userId: string, apiKey: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  cipher.setAAD(Buffer.from(userId))
  const encrypted = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.')
}

export function openDeepSeekKey(userId: string, value: string | undefined) {
  if (!value) return null
  const [version, ivValue, tagValue, encryptedValue] = value.split('.')
  if (version !== 'v1' || !ivValue || !tagValue || !encryptedValue) return null
  try {
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivValue, 'base64url'))
    decipher.setAAD(Buffer.from(userId))
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'base64url')),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    return null
  }
}

export async function readDeepSeekKeyForUser(userId: string) {
  const cookieStore = await cookies()
  return openDeepSeekKey(userId, cookieStore.get(DEEPSEEK_KEY_COOKIE)?.value)
}

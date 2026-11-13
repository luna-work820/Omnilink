import { z } from 'zod'

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
const requestId = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/)

export const requestIdentitySchema = z.object({
  requestId: requestId.optional(),
  messageId: requestId.optional(),
  sessionId: uuid.optional(),
  conversationId: uuid.optional(),
}).refine((value) => !value.requestId || !value.messageId || value.requestId === value.messageId, '请求标识不一致。')
  .refine((value) => !value.sessionId || !value.conversationId || value.sessionId === value.conversationId, '会话标识不一致。')

export const sessionRefSchema = z.object({
  id: uuid,
  ownerId: uuid.nullable(),
  version: z.literal(1),
}).strict()

export const unifiedEntityRefSchema = z.object({
  type: z.enum(['product', 'service', 'content', 'creator', 'merchant']),
  id: uuid,
  version: z.number().int().positive().optional(),
}).strict()

export function resolveRequestIdentity(input: unknown, authenticatedUserId: string | null) {
  const value = requestIdentitySchema.parse(input)
  return {
    requestId: value.requestId ?? value.messageId ?? crypto.randomUUID(),
    session: sessionRefSchema.parse({
      id: value.sessionId ?? value.conversationId ?? crypto.randomUUID(),
      ownerId: authenticatedUserId,
      version: 1,
    }),
  }
}

import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), manage: vi.fn(), maybeSingle: vi.fn(), eq: vi.fn(), select: vi.fn(), from: vi.fn() }))
vi.mock('@/lib/api/auth', () => ({ requireUser: mocks.requireUser }))
vi.mock('@/lib/consumer-advisor/ai-assistant-memory', () => ({ manageAiAssistantMemory: mocks.manage }))
vi.mock('@/lib/consumer-advisor/personal-context', () => ({ loadPersonalContext: vi.fn() }))
vi.mock('@/lib/consumer-advisor/assessment-memory-proposal', () => ({ assessmentMemoryProposal: vi.fn() }))

import { PATCH } from './route'

const messageId = 'a10e15af-4619-4df5-940f-7e2019b1d12c'
const request = (body: unknown) => new Request('http://localhost/api/consumer/ai-assistant-profile', { method: 'PATCH', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })

describe('appearance analysis memory proposal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.eq.mockReturnValue({ eq: mocks.eq, maybeSingle: mocks.maybeSingle })
    mocks.select.mockReturnValue({ eq: mocks.eq })
    mocks.from.mockReturnValue({ select: mocks.select })
    mocks.requireUser.mockResolvedValue({ ok: true, user: { id: 'user-1' }, supabase: { from: mocks.from } })
    mocks.manage.mockResolvedValue({ status: 'proposed' })
  })

  it('uses only the signed-in user’s persisted analysis as an inferred proposal', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { id: messageId, content: '肤色偏暖。第二句。' }, error: null })
    const response = await PATCH(request({ action: 'analysis-propose', messageId, text: '伪造内容' }))
    expect(response.status).toBe(200)
    expect(mocks.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(mocks.eq).toHaveBeenCalledWith('role', 'assistant')
    expect(mocks.eq).toHaveBeenCalledWith('style_tag', '形象分析')
    expect(mocks.manage).toHaveBeenCalledWith('user-1', 'propose', expect.objectContaining({ text: '肤色偏暖。', origin: 'inferred', sourceMessageId: messageId }))
  })

  it('does not propose missing or inaccessible records', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null })
    expect((await PATCH(request({ action: 'analysis-propose', messageId }))).status).toBe(404)
    expect(mocks.manage).not.toHaveBeenCalled()
  })

  it('rejects malformed IDs before reading data', async () => {
    expect((await PATCH(request({ action: 'analysis-propose', messageId: 'bad' }))).status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })
})

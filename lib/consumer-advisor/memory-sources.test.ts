import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { withMemorySources } from './memory-sources'
import type { AiAssistantMemory } from './ai-assistant-memory'

const base: AiAssistantMemory = { id: 'memory', domain: 'skin', text: 'T区出油', origin: 'user', status: 'proposed', evidence: 'T区出油', sourceMessageId: 'one', supportIds: [], confirmedAt: null, revision: 1, supersedeIds: [], sourceKind: 'chat', sourcePayload: { observations: ['one', 'two', 'foreign'] } }

describe('memory sources', () => {
  it('only attaches messages returned by the current user’s query', async () => {
    const query = { select: vi.fn(), eq: vi.fn(), in: vi.fn() }
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query)
    query.in.mockResolvedValue({ data: [{ id: 'one', content: 'T区出油', role: 'user', created_at: '2026-01-01' }, { id: 'two', content: '脸颊干', role: 'user', created_at: '2026-01-02' }], error: null })
    const client = { from: vi.fn().mockReturnValue(query) }
    const result = await withMemorySources(client as never, 'user-1', [base])
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(query.in).toHaveBeenCalledWith('id', ['one', 'two', 'foreign'])
    expect(result[0].sourcePayload?.sourceMessages).toEqual([{ id: 'one', content: 'T区出油', role: 'user', createdAt: '2026-01-01' }, { id: 'two', content: '脸颊干', role: 'user', createdAt: '2026-01-02' }])
  })
  it('never attaches assistant messages to a self-report', async () => {
    const query = { select: vi.fn(), eq: vi.fn(), in: vi.fn() }
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query)
    query.in.mockResolvedValue({ data: [{ id: 'one', content: '推断', role: 'assistant', created_at: '2026-01-01' }], error: null })
    const result = await withMemorySources({ from: vi.fn().mockReturnValue(query) } as never, 'user-1', [base])
    expect(result[0].sourcePayload?.sourceMessages).toEqual([])
  })
  it('does not query sources for manual memories', async () => {
    const from = vi.fn()
    await withMemorySources({ from } as never, 'user-1', [{ ...base, sourceKind: 'manual' }])
    expect(from).not.toHaveBeenCalled()
  })
})

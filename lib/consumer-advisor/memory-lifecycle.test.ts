import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { extractMemoryDeclaration, isUsablePersonalMemory, readMemoryLifecycle } from './memory-lifecycle'
import { memoryContext, type AiAssistantMemory } from './ai-assistant-memory'
import { resolvePersonalContext } from './personal-context'

describe('memory scope and evidence', () => {
  it('collects only explicit self preferences with the original evidence', () => {
    expect(extractMemoryDeclaration('请记住，我不喜欢金属家具')).toMatchObject({
      domain: 'space', evidence: '请记住，我不喜欢金属家具',
      sourcePayload: { factKey: '金属家具', polarity: 'negative', preferenceSignals: { avoidTerms: ['金属家具'] } },
    })
  })
  it.each(['我喜欢红色吗？', '我喜欢“我喜欢红色”这句话', '我喜欢这次给朋友买的红色衣服',
    '我喜欢红色，但是不喜欢红色家具', '今天我喜欢红色', '假如我喜欢红色', '文件：偏好.txt\n我喜欢红色'])('does not generalize %s', (text) => {
    expect(extractMemoryDeclaration(text)).toBeNull()
  })
  it('requires a valid end time for temporary memory', () => {
    expect(readMemoryLifecycle({ subject: 'self', scope: 'temporary', expiresAt: null })).toBeNull()
    expect(readMemoryLifecycle({ subject: 'self', scope: 'temporary', expiresAt: 'invalid' })).toBeNull()
  })
  it('excludes other people and expired memory from both prompts and ranking', () => {
    const base: AiAssistantMemory = { id: '1', text: '喜欢原木', domain: 'space', origin: 'user', status: 'active',
      evidence: null, sourceMessageId: null, supportIds: [], supersedeIds: [], confirmedAt: '2026-01-01', revision: 1 }
    const memories = [
      { ...base, sourcePayload: { lifecycle: { subject: 'other', scope: 'long-term', expiresAt: null } } },
      { ...base, sourcePayload: { lifecycle: { subject: 'self', scope: 'temporary', expiresAt: '2000-01-01' } } },
    ]
    expect(memories.every((m) => !isUsablePersonalMemory(m))).toBe(true)
    expect(memoryContext(memories)).toBe('无')
    expect(resolvePersonalContext({ userId: 'a', version: 1, memories }).positiveTerms).toEqual([])
    expect(isUsablePersonalMemory(base)).toBe(true)
  })
})

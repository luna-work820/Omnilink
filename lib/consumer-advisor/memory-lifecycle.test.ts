import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { extractMemoryDeclaration, isSkinSelfReportPrompt, isUsablePersonalMemory, readMemoryLifecycle } from './memory-lifecycle'
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
  it.each(['我T区容易出油', '我是混合性肤质', '我皮肤比较干'])('creates a skin proposal for an explicit self-report: %s', (text) => {
    expect(extractMemoryDeclaration(text)).toMatchObject({text, domain:'skin', origin:'user', evidence:text})
  })
  it('only interprets a short skin answer as self-report in the relevant conversation', () => {
    expect(extractMemoryDeclaration('T区容易出油')).toBeNull()
    expect(extractMemoryDeclaration('T区容易出油', {skinAnswer:true})).toMatchObject({domain:'skin', evidence:'T区容易出油'})
    expect(extractMemoryDeclaration('朋友T区容易出油', {skinAnswer:true})).toBeNull()
  })
  it('uses the preceding question to interpret an answer, without treating a general statement as a question', () => {
    expect(isSkinSelfReportPrompt('请告诉我你的脸颊是否容易出油？')).toBe(true)
    expect(isSkinSelfReportPrompt('皮肤可能会出油。')).toBe(false)
    expect(extractMemoryDeclaration('脸颊比较干', { skinAnswer: true })).toMatchObject({ domain: 'skin', evidence: '脸颊比较干' })
  })
  it('normalizes the same region while retaining conflicting conditions for confirmation', () => {
    expect(extractMemoryDeclaration('我T区容易出油')?.sourcePayload).toMatchObject({ factKey: 'skin:moisture:t区', polarity: 'positive' })
    expect(extractMemoryDeclaration('T区比较干', { skinAnswer: true })?.sourcePayload).toMatchObject({ factKey: 'skin:moisture:t区', polarity: 'negative' })
  })
  it('normalizes only explicitly equivalent clothing preferences and retains polarity', () => {
    const first = extractMemoryDeclaration('我喜欢新中式穿搭')
    const repeated = extractMemoryDeclaration('我喜欢新中式服装')
    const conflict = extractMemoryDeclaration('我不喜欢新中式衣服')
    expect(first).toMatchObject({domain:'clothing', sourcePayload:{factKey:'新中式服装',polarity:'positive'}})
    expect(repeated?.sourcePayload.factKey).toBe(first?.sourcePayload.factKey)
    expect(conflict).toMatchObject({domain:'clothing', sourcePayload:{factKey:'新中式服装',polarity:'negative'}})
    expect(extractMemoryDeclaration('我喜欢中式服装')?.sourcePayload.factKey).not.toBe(first?.sourcePayload.factKey)
  })
  it.each(['我夏天喜欢白色', '我下周喜欢红色', '我今年喜欢黑色'])('does not save time-bound statements as permanent: %s', text => {
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

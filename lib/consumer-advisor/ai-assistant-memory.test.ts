import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import type { SupabaseClient } from '@supabase/supabase-js'
import { parseAiAssistantMemoryCandidate } from './ai-assistant-profile'
import { loadAiAssistantMemories } from './ai-assistant-memory'

describe('AI assistant memory candidates', () => {
  it('keeps direct corrections and requires evidence for inferred habits', () => {
    const prompt = '这件不喜欢，因为要干洗；颜色倒还好。'
    expect(parseAiAssistantMemoryCandidate({
      text: '日常外套不想干洗', domain: 'clothing', origin: 'user',
      evidence: '因为要干洗', supersedeIds: ['old', 'other'],
    }, prompt, ['old'])).toMatchObject({ supersedeIds: ['old'], origin: 'user' })
    expect(parseAiAssistantMemoryCandidate({
      text: '不喜欢红色', domain: 'clothing', origin: 'user', evidence: '不喜欢红色',
    }, prompt, ['old'])).toBeNull()
    expect(parseAiAssistantMemoryCandidate({
      text: '偏好省心', domain: 'other', origin: 'inferred', supports: ['old'],
    }, prompt, ['old'])).toBeNull()
  })
  it('loads memory without writing or importing user-editable profile metadata', async () => {
    const chain = {select:vi.fn(),neq:vi.fn(),eq:vi.fn(),order:vi.fn(),limit:vi.fn().mockResolvedValue({data:[],error:null})}
    for (const method of ['select','neq','eq','order'] as const) chain[method].mockReturnValue(chain)
    const client = {from:vi.fn().mockReturnValue(chain)}
    expect(await loadAiAssistantMemories(client as unknown as SupabaseClient,'user')).toEqual([])
    expect(client.from).toHaveBeenCalledTimes(1)
    expect(chain.neq).toHaveBeenCalledWith('status','rejected')
  })
})

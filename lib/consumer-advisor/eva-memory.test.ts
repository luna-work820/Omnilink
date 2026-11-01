import { describe, expect, it } from 'vitest'
import { parseEvaMemoryCandidate } from './eva-onboarding'

describe('EVA memory candidates', () => {
  it('keeps direct corrections and requires evidence for inferred habits', () => {
    const prompt = '这件不喜欢，因为要干洗；颜色倒还好。'
    expect(parseEvaMemoryCandidate({
      text: '日常外套不想干洗', domain: 'clothing', origin: 'user',
      evidence: '因为要干洗', supersedeIds: ['old', 'other'],
    }, prompt, ['old'])).toMatchObject({ supersedeIds: ['old'], origin: 'user' })
    expect(parseEvaMemoryCandidate({
      text: '不喜欢红色', domain: 'clothing', origin: 'user', evidence: '不喜欢红色',
    }, prompt, ['old'])).toBeNull()
    expect(parseEvaMemoryCandidate({
      text: '偏好省心', domain: 'other', origin: 'inferred', supports: ['old'],
    }, prompt, ['old'])).toBeNull()
  })
})

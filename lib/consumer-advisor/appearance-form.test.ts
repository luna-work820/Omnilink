import { describe, expect, it } from 'vitest'
import { appearanceMissingForm } from './appearance-form'
import { readExecutionBlocks } from './response-contract'

describe('appearance information forms', () => {
  it('creates a restorable form for measurements', () => {
    const form = appearanceMissingForm('需要三围区间才能继续。', 'form_1')!
    expect(form.questions.map((question) => question.id)).toEqual(['bust', 'waist', 'hips'])
    expect(readExecutionBlocks([{ type: 'interactive_form', id: form.id, version: 1, data: form }])).toHaveLength(1)
  })
  it('asks for occasion and does not invent unrelated forms', () => {
    expect(appearanceMissingForm('请告诉我穿着场合。', 'form_2')?.questions[0].type).toBe('single')
    expect(appearanceMissingForm('目前可以给出配色建议。', 'form_3')).toBeNull()
  })
})

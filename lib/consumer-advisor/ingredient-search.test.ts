import { describe, expect, it } from 'vitest'
import { lookupIngredientInfo } from './ingredient-search'

describe('ingredient lookup', () => {
  it('does not treat a word inside an ingredient name as a second ingredient', () => {
    const result = lookupIngredientInfo('Cetearyl alcohol 成分是什么')
    expect(result.text).toContain('cetearyl alcohol：')
    expect(result.text).not.toContain('。 alcohol：')
  })

  it('keeps a separately mentioned ingredient', () => {
    const result = lookupIngredientInfo('Cetearyl alcohol 和 alcohol 有什么作用')
    expect(result.text).toContain('cetearyl alcohol：')
    expect(result.text).toContain('。 alcohol：')
  })
})

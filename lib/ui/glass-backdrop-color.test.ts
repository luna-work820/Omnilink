import { expect, it } from 'vitest'
import { parseBackdropColor } from '@/components/ui/glasswork/backdrop-color'
it('reads computed color-mix srgb channels on the RGB scale', () => {
  expect(parseBackdropColor('color(srgb 1 1 1 / 0.18)')).toEqual([255, 255, 255])
  expect(parseBackdropColor('color(srgb 0.5 0.25 0 / 0.5)')).toEqual([127.5, 63.75, 0])
})
it('retains rgb handling and ignores fully transparent or unsupported colors', () => {
  expect(parseBackdropColor('rgb(252, 253, 254)')).toEqual([252, 253, 254])
  expect(parseBackdropColor('rgba(0, 0, 0, 0)')).toBeNull()
  expect(parseBackdropColor('color(srgb 1 1 1 / 0)')).toBeNull()
  expect(parseBackdropColor('color(display-p3 1 0 0)')).toBeNull()
})

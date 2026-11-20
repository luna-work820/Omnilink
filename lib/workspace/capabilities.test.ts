import { describe, expect, it } from 'vitest'
import { workspaceCapabilities } from './capabilities'

describe('additive workspace capabilities', () => {
  it.each([
    [undefined, false, {creator:false,merchant:false}],
    [undefined, true, {creator:false,merchant:true}],
    [{creator_enabled:true,merchant_enabled:false}, true, {creator:true,merchant:false}],
    [{creator_enabled:true}, true, {creator:true,merchant:true}],
    [{creator_enabled:true,merchant_enabled:true}, true, {creator:true,merchant:true}],
    [{merchant_enabled:true}, false, {creator:false,merchant:false}],
    [{creator_enabled:'true'}, false, {creator:false,merchant:false}],
  ])('resolves metadata %j with store %j', (metadata, store, expected) => {
    expect(workspaceCapabilities(metadata, store)).toEqual(expected)
  })
})

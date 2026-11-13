import { describe,expect,it,vi } from 'vitest'
vi.mock('server-only',()=>({}))
import { resolvePersonalContext } from './personal-context'
import type { AiAssistantMemory } from './ai-assistant-memory'
const memory=(text:string,patch:Partial<AiAssistantMemory>={}):AiAssistantMemory=>({id:crypto.randomUUID(),domain:'space',text,origin:'user',
  status:'active',confirmedAt:'2026-11-12T00:00:00Z',evidence:null,sourceMessageId:null,supportIds:[],supersedeIds:[],revision:1,...patch})
describe('personal context resolution',()=>{
  it('uses confirmed memories, retains negation and excludes unconfirmed results',()=>{
    const context=resolvePersonalContext({userId:'a',version:3,memories:[memory('喜欢原木'),memory('不喜欢金属'),memory('喜欢复古',{status:'proposed',confirmedAt:null})]})
    expect(context.positiveTerms).toContain('原木');expect(context.positiveTerms).not.toContain('金属');expect(context.positiveTerms).not.toContain('复古')
    expect(context.avoidTerms).toContain('金属');expect(context.memories).toHaveLength(2)
  })
  it('scopes version keys by account and never changes explicit current constraints',()=>{
    const input={userId:'a',version:3,memories:[memory('喜欢复古')]}
    const a=resolvePersonalContext(input),b=resolvePersonalContext({...input,userId:'b'})
    expect(a.cacheKey).not.toBe(b.cacheKey)
    expect(a).not.toHaveProperty('minPrice');expect(a).not.toHaveProperty('termGroups')
    expect(resolvePersonalContext({...input,version:4}).cacheKey).not.toBe(a.cacheKey)
  })
})

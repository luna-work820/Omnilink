import { beforeEach,describe,expect,it,vi } from 'vitest'
vi.mock('server-only',()=>({}))
const generate=vi.hoisted(()=>vi.fn())
vi.mock('@/lib/ai/workspace-generation',()=>({generateWorkspaceText:generate,ModelConfigurationError:class extends Error{}}))
import { classifyConsumerIntent } from './intent-classifier'
const input={prompt:'沙发',model:'deepseek-v4-pro' as const,apiKey:'test-user-key',history:[],hasImage:false,hasDocument:false,hasSelectedProducts:false}
beforeEach(()=>vi.clearAllMocks())
describe('bounded semantic intent classification',()=>{
  it('uses one small response on the connected account and no product catalog or memory payload',async()=>{
    generate.mockResolvedValue(JSON.stringify({intent:'product-search',search:{query:'沙发',termGroups:[['沙发','sofa']]}}))
    const result=await classifyConsumerIntent({...input,history:Array.from({length:8},()=>({role:'user',content:'x'.repeat(2000)}))})
    expect(result.intent).toBe('product-search')
    expect(generate).toHaveBeenCalledTimes(1)
    expect(generate).toHaveBeenCalledWith('deepseek-flash',expect.any(String),expect.any(String),expect.objectContaining({
      maxOutputTokens:512,totalBudgetMs:8000,maxAttempts:1,allowEnvironmentKey:false,apiKey:'test-user-key'}))
    expect(JSON.parse(generate.mock.calls[0][1]).recentTurns).toHaveLength(2)
    expect(JSON.parse(generate.mock.calls[0][1]).recentTurns[0].content).toHaveLength(240)
  })
  it('preserves ordinary Q&A and rejects malformed or incomplete decisions without a keyword fallback',async()=>{
    generate.mockResolvedValueOnce(JSON.stringify({intent:'assistant',search:null,needsPersonalContext:false}))
    expect((await classifyConsumerIntent({...input,prompt:'沙发是什么？'})).intent).toBe('assistant')
    generate.mockResolvedValueOnce(JSON.stringify({intent:'product-search',search:null}))
    await expect(classifyConsumerIntent(input)).rejects.toMatchObject({code:'INTENT_UNAVAILABLE',status:503})
    generate.mockResolvedValueOnce('not JSON')
    await expect(classifyConsumerIntent(input)).rejects.toMatchObject({code:'INTENT_UNAVAILABLE'})
  })
})

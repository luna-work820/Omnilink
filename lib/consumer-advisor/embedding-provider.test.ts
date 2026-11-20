import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest'
vi.mock('server-only',()=>({}))
const local=vi.hoisted(()=>vi.fn())
vi.mock('./local-bge',()=>({embedLocalBge:local}))
import { embeddingProfiles } from './embedding-profile'
import { embedConsumerTexts } from './embedding-provider'
const profile=embeddingProfiles['qwen-text-embedding-v4-1024-v1']
const fetchMock=vi.fn()
beforeEach(()=>{
  vi.clearAllMocks();vi.stubGlobal('fetch',fetchMock);vi.stubEnv('DASHSCOPE_API_KEY','test-key');vi.stubEnv('DASHSCOPE_BASE_URL','https://regional.example/compatible-mode/v1')
})
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs()})
describe('consumer embedding provider contracts without network calls',()=>{
  it('uses the configured region, requested model and dimensions and preserves returned index order',async()=>{
    fetchMock.mockResolvedValue(Response.json({model:profile.model,data:[{index:1,embedding:Array(1024).fill(0.2)},{index:0,embedding:Array(1024).fill(0.1)}],usage:{total_tokens:15}}))
    const result=await embedConsumerTexts(profile,['中文','English'],'document')
    expect(result).toMatchObject({calls:1,inputTokens:15})
    expect(result.vectors.map((v)=>v[0])).toEqual([0.1,0.2])
    const [url,request]=fetchMock.mock.calls[0]
    expect(url).toBe('https://regional.example/compatible-mode/v1/embeddings')
    expect(JSON.parse(request.body)).toEqual({model:'text-embedding-v4',input:['中文','English'],dimensions:1024,encoding_format:'float'})
  })
  it.each([
    {model:'a-different-model',data:[{index:0,embedding:Array(1024).fill(1)}]},
    {model:profile.model,data:[{index:0,embedding:Array(512).fill(1)}]},
    {model:profile.model,data:[{index:0,embedding:Array(1024).fill(0)}]},
    {model:profile.model,data:[{index:1,embedding:Array(1024).fill(1)}]},
  ])('rejects an incompatible or malformed provider response',async(data)=>{
    fetchMock.mockResolvedValue(Response.json(data))
    await expect(embedConsumerTexts(profile,['test'],'query')).rejects.toMatchObject({calls:1})
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('reports one failed request with unknown token usage, without an automatic retry',async()=>{
    fetchMock.mockResolvedValue(new Response('',{status:429}))
    await expect(embedConsumerTexts(profile,['test'],'query')).rejects.toMatchObject({code:'EMBEDDING_UNAVAILABLE',calls:1})
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('does not make a request when the key is absent',async()=>{
    vi.stubEnv('DASHSCOPE_API_KEY','')
    await expect(embedConsumerTexts(profile,['test'],'query')).rejects.toMatchObject({code:'EMBEDDING_NOT_CONFIGURED',calls:0})
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('keeps the BGE query/document mode and its dimension separate from Qwen',async()=>{
    const bge=embeddingProfiles['bge-small-zh-v1.5-512-v1']
    local.mockResolvedValue([Array(512).fill(0.1)])
    const result=await embedConsumerTexts(bge,['耳环'],'query')
    expect(local).toHaveBeenCalledWith(['耳环'],'query',expect.any(AbortSignal))
    expect(result).toMatchObject({calls:1,inputTokens:null});expect(fetchMock).not.toHaveBeenCalled()
  })
})

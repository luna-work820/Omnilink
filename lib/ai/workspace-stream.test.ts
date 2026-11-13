import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest'
vi.mock('server-only',()=>({}))
import { streamWorkspaceText } from './workspace-stream'
function response(data:string) {return new Response(new TextEncoder().encode(data),{headers:{'Content-Type':'text/event-stream'}})}
const previous=process.env.DASHSCOPE_API_KEY
beforeEach(()=>{process.env.DASHSCOPE_API_KEY='test-only-key'})
afterEach(()=>{vi.unstubAllGlobals();if(previous===undefined)delete process.env.DASHSCOPE_API_KEY;else process.env.DASHSCOPE_API_KEY=previous})
async function collect(model:'qwen-plus'|'deepseek-flash'='qwen-plus') {const result=[];for await(const chunk of streamWorkspaceText(model,'hello','system'))result.push(chunk);return result}
describe('bounded provider streaming',()=>{
  it('streams text and real usage with one provider attempt',async()=>{
    const fetch=vi.fn().mockResolvedValue(response('data: {"choices":[{"delta":{"content":"你好"}}]}\n\ndata: {"usage":{"prompt_tokens":12,"completion_tokens":2,"prompt_tokens_details":{"cached_tokens":4}}}\n\ndata: [DONE]\n\n'))
    vi.stubGlobal('fetch',fetch)
    expect(await collect()).toEqual([{type:'delta',text:'你好'},{type:'usage',usage:{inputTokens:12,outputTokens:2,cachedInputTokens:4}}])
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({stream:true,max_tokens:1024})
    expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
  })
  it('fails an interrupted stream instead of fabricating a completed answer',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response('data: {"choices":[{"delta":{"content":"半句"}}]}\n\n')))
    await expect(collect()).rejects.toThrow('模型响应中断')
  })
  it('does not retry invalid keys or borrow a platform DeepSeek key',async()=>{
    const fetch=vi.fn().mockResolvedValue(Response.json({error:{message:'invalid'}},{status:401}));vi.stubGlobal('fetch',fetch)
    await expect(collect()).rejects.toMatchObject({code:'MODEL_PROVIDER_UNAVAILABLE',status:500})
    expect(fetch).toHaveBeenCalledTimes(1)
    fetch.mockClear()
    await expect(collect('deepseek-flash')).rejects.toMatchObject({code:'MODEL_KEY_REQUIRED'})
    expect(fetch).not.toHaveBeenCalled()
  })
})

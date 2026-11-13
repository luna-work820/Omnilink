import { afterEach,describe,expect,it,vi } from 'vitest'
import { fetchConsumerReply } from './client-response'
import { readExecutionBlocks } from './response-contract'

const session=crypto.randomUUID(),requestId='request-one'
const body=JSON.stringify({messageId:requestId,conversationId:session,prompt:'你好'})
function stream(events:unknown[],complete=true) {
  const value=events.map((event)=>`data: ${JSON.stringify(event)}\r\n\r\n`).join('')+(complete?'':'data: {')
  const bytes=new TextEncoder().encode(value)
  return new Response(new ReadableStream({start(controller){for(let i=0;i<bytes.length;i+=7)controller.enqueue(bytes.slice(i,i+7));controller.close()}}),{headers:{'Content-Type':'text/event-stream'}})
}
const event=(sequence:number,patch:Record<string,unknown>)=>({requestId,sessionId:session,sequence,...patch})
afterEach(()=>vi.unstubAllGlobals())
describe('client response transport',()=>{
  it('handles split UTF-8, ordered deltas and a final response envelope',async()=>{
    const reply={requestId,sessionId:session,conversationId:session,contractVersion:1,status:'completed',text:'你好',blocks:[]}
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(stream([event(1,{type:'text_delta',delta:'你'}),event(2,{type:'text_delta',delta:'好'}),event(3,{type:'response',response:reply})])))
    const chunks:string[]=[]
    expect(await fetchConsumerReply(body,new AbortController().signal,(s)=>chunks.push(s))).toMatchObject({ok:true,body:reply})
    expect(chunks).toEqual(['你','好'])
  })
  it('bootstraps the guest cookie once with the identical request body before paid calls',async()=>{
    const fetch=vi.fn().mockResolvedValueOnce(Response.json({code:'GUEST_SESSION_REQUIRED'},{status:428})).mockResolvedValueOnce(Response.json({text:'ok'}))
    vi.stubGlobal('fetch',fetch)
    expect((await fetchConsumerReply(body,new AbortController().signal,()=>{})).body).toEqual({text:'ok'})
    expect(fetch).toHaveBeenCalledTimes(2);expect(fetch.mock.calls[0][1].body).toBe(fetch.mock.calls[1][1].body)
  })
  it('rejects cross-session output, repeated sequence numbers and truncated streams',async()=>{
    for(const events of [[event(1,{type:'text_delta',delta:'A',sessionId:crypto.randomUUID()})],
      [event(1,{type:'text_delta',delta:'A'}),event(1,{type:'text_delta',delta:'B'})],[]]) {
      vi.stubGlobal('fetch',vi.fn().mockResolvedValue(stream(events,false)))
      await expect(fetchConsumerReply(body,new AbortController().signal,()=>{})).rejects.toThrow()
    }
  })
  it('does not render injected links from user-editable chat history',()=>{
    const information={type:'information_feed',id:'i',version:1,data:{query:'q',items:[{id:'x',entityType:'source',title:'Bad',excerpt:'',url:'javascript:alert(1)',imageUrl:null,source:'x',updatedAt:'now',version:1}]}}
    expect(readExecutionBlocks([information])).toEqual([])
  })
  it('rejects a versioned JSON response for another request or session',async()=>{
    for(const patch of [{requestId:'foreign'},{sessionId:crypto.randomUUID()}]) {
      vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({contractVersion:1,requestId,sessionId:session,text:'wrong',...patch})))
      await expect(fetchConsumerReply(body,new AbortController().signal,()=>{})).rejects.toThrow('回答结果标识无效。')
    }
  })
})

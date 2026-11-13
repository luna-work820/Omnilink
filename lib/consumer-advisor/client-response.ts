import { readEventData } from './event-stream'
import type { ConsumerResponse,ResponseEvent } from './response-contract'

export async function fetchConsumerReply(body:string,signal:AbortSignal,onDelta:(text:string)=>void) {
  const input=JSON.parse(body) as {messageId?:string;requestId?:string;conversationId?:string;sessionId?:string}
  let response=await fetch('/api/consumer/assistant',{method:'POST',credentials:'include',signal,
    headers:{'Content-Type':'application/json',Accept:'text/event-stream'},body})
  if(response.status===428) {
    const bootstrap=await response.json()
    if(bootstrap.code!=='GUEST_SESSION_REQUIRED')return{ok:false,status:428,body:bootstrap}
    response=await fetch('/api/consumer/assistant',{method:'POST',credentials:'include',signal,
      headers:{'Content-Type':'application/json',Accept:'text/event-stream'},body})
  }
  if(!response.headers.get('Content-Type')?.includes('text/event-stream')) {
    const result=await response.json() as Record<string,unknown>
    if(response.ok&&result.contractVersion===1&&(result.requestId!==(input.requestId??input.messageId)||result.sessionId!==(input.sessionId??input.conversationId)))throw new Error('回答结果标识无效。')
    return{ok:response.ok,status:response.status,body:result}
  }
  if(!response.body)throw new Error('回答流不可用。')
  let sequence=0,characters=0,result:ConsumerResponse|undefined
  for await(const raw of readEventData(response.body)) {
    const event=JSON.parse(raw) as ResponseEvent
    if(!Number.isInteger(event.sequence)||event.sequence!==sequence+1||event.requestId!==(input.requestId??input.messageId)
      ||event.sessionId!==(input.sessionId??input.conversationId))throw new Error('回答流标识或顺序无效。')
    sequence=event.sequence
    if(event.type==='text_delta') {
      if(typeof event.delta!=='string'||(characters+=event.delta.length)>8000)throw new Error('回答内容无效。')
      onDelta(event.delta)
    } else if(event.type==='response'){
      if(event.response?.requestId!==event.requestId||event.response.sessionId!==event.sessionId||typeof event.response.text!=='string')throw new Error('回答结果标识无效。')
      result=event.response
    }
    else if(event.type==='error')throw new Error(event.error)
    else throw new Error('回答流类型无效。')
  }
  if(!result)throw new Error('回答中断，请重新发起。')
  return{ok:true,status:200,body:result}
}

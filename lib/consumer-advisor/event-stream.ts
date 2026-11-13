export async function* readEventData(body: ReadableStream<Uint8Array>) {
  const reader=body.getReader(),decoder=new TextDecoder()
  let buffer='',complete=false
  try {
    while(true) {
      const {value,done}=await reader.read()
      buffer+=done?decoder.decode():decoder.decode(value,{stream:true})
      if(buffer.length>262_144)throw new Error('流式消息超过限制。')
      let end:RegExpExecArray|null
      while((end=/\r?\n\r?\n/.exec(buffer))) {
        const frame=buffer.slice(0,end.index);buffer=buffer.slice(end.index+end[0].length)
        const data=frame.split(/\r?\n/).filter((line)=>line.startsWith('data:')).map((line)=>line.slice(5).trimStart()).join('\n')
        if(data)yield data
      }
      if(done){if(buffer.trim())throw new Error('流式消息未完整结束。');complete=true;break}
    }
  } finally { if(!complete)await reader.cancel().catch(()=>{});reader.releaseLock() }
}

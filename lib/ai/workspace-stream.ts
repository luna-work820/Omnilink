import 'server-only'
import { ModelConfigurationError,type WorkspaceModel } from './workspace-generation'
import { readEventData } from '@/lib/consumer-advisor/event-stream'

export type ModelUsage={inputTokens:number|null;outputTokens:number|null;cachedInputTokens:number|null}
export type ModelChunk={type:'delta';text:string}|{type:'usage';usage:ModelUsage}
export async function* streamWorkspaceText(model:WorkspaceModel,prompt:string,system:string,options:{apiKey?:string;signal?:AbortSignal}={}):AsyncGenerator<ModelChunk> {
  const abort=new AbortController(),signal=AbortSignal.any([abort.signal,AbortSignal.timeout(30_000),...(options.signal?[options.signal]:[])])
  let url:string,headers:Record<string,string>,body:Record<string,unknown>
  if(model==='gemini') {
    const key=process.env.GEMINI_API_KEY,version=process.env.GEMINI_MODEL
    if(!key||!version)throw new ModelConfigurationError('Gemini 尚未配置。',{status:500,code:'MODEL_PROVIDER_UNAVAILABLE'})
    url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(version)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`
    headers={'Content-Type':'application/json'}
    body={systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:0.2,maxOutputTokens:1024}}
  } else {
    const deep=model.startsWith('deepseek'),key=deep?options.apiKey:process.env.DASHSCOPE_API_KEY
    if(!key)throw new ModelConfigurationError(deep?'请在设置中连接自己的 DeepSeek API Key。':'千问尚未配置。',
      {status:deep?400:500,code:deep?'MODEL_KEY_REQUIRED':'MODEL_PROVIDER_UNAVAILABLE'})
    const workspace=process.env.BAILIAN_WORKSPACE_ID?.trim()
    const base=deep?'https://api.deepseek.com':process.env.DASHSCOPE_BASE_URL?.trim()||(workspace?`https://${workspace}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1`:'https://dashscope.aliyuncs.com/compatible-mode/v1')
    url=`${base.replace(/\/$/,'')}/chat/completions`
    headers={'Content-Type':'application/json',Authorization:`Bearer ${key}`}
    body={model,temperature:0.2,max_tokens:1024,stream:true,stream_options:{include_usage:true},
      ...(deep?{thinking:{type:'disabled'}}:{}),messages:[{role:'system',content:system},{role:'user',content:prompt}]}
  }
  let response:Response
  try{response=await fetch(url,{method:'POST',headers,body:JSON.stringify(body),signal})}catch(error){if(signal.aborted)throw signal.reason;throw error}
  if(response.status===401||response.status===403) {
    await response.body?.cancel()
    throw new ModelConfigurationError(model.startsWith('deepseek')?'DeepSeek API Key 无效或没有模型权限。':`${model==='gemini'?'Gemini':'千问'} API Key 无效，请更新配置或切换模型。`,
      {status:model.startsWith('deepseek')?400:500,code:model.startsWith('deepseek')?'MODEL_KEY_INVALID':'MODEL_PROVIDER_UNAVAILABLE'})
  }
  if(!response.ok||!response.body){await response.body?.cancel();throw new Error('模型暂时无法响应。')}
  let length=0,ended=false
  try {
    for await(const raw of readEventData(response.body)) {
      if(raw==='[DONE]'){ended=true;break}
      const data=JSON.parse(raw)
      if(data.error)throw new Error('模型暂时无法响应。')
      const text=model==='gemini'?data.candidates?.[0]?.content?.parts?.filter((p:{thought?:boolean})=>!p.thought).map((p:{text?:string})=>p.text??'').join(''):data.choices?.[0]?.delta?.content
      if(typeof text==='string'&&text){length+=text.length;if(length>8000)throw new Error('回答超过长度限制。');yield{type:'delta',text}}
      if(model==='gemini'&&data.candidates?.[0]?.finishReason)ended=true
      const usage=model==='gemini'?data.usageMetadata:data.usage
      if(usage)yield{type:'usage',usage:{inputTokens:usage.prompt_tokens??usage.promptTokenCount??null,outputTokens:usage.completion_tokens??usage.candidatesTokenCount??null,
        cachedInputTokens:usage.prompt_tokens_details?.cached_tokens??usage.cachedContentTokenCount??null}}
    }
    if(!ended||!length)throw new Error('模型响应中断，请重新发起。')
  } finally {abort.abort()}
}

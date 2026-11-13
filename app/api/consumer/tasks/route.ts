import { NextRequest,NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveRequestUser } from '@/lib/api/request-user'
import { discoveryActor,attachDiscoveryActor } from '@/lib/consumer-advisor/discovery-engine'
import { requestIdentitySchema,resolveRequestIdentity } from '@/lib/consumer-advisor/request-contract'
import { compareInputSchema } from '@/lib/consumer-advisor/response-contract'
import { createComparisonTask,advanceComparisonTask,readComparisonTask } from '@/lib/consumer-advisor/comparison-workflow'
import { DiscoveryError } from '@/lib/consumer-advisor/discovery-contract'

const schema=z.discriminatedUnion('action',[
  z.object({action:z.literal('create'),input:compareInputSchema}),
  z.object({action:z.enum(['get','continue','retry','cancel']),id:z.string().uuid()}),
])
export async function POST(request:NextRequest) {
  const auth=await resolveRequestUser(request)
  if(!auth.ok)return auth.response
  if(Number(request.headers.get('content-length')??0)>16_384)return NextResponse.json({error:'请求过大。'},{status:413})
  const raw=await request.text()
  if(Buffer.byteLength(raw)>16_384)return NextResponse.json({error:'请求过大。'},{status:413})
  let body:unknown;try{body=JSON.parse(raw)}catch{return NextResponse.json({error:'请求无效。'},{status:400})}
  const parsed=schema.safeParse(body),ids=requestIdentitySchema.safeParse(body)
  if(!parsed.success||!ids.success||(!ids.data.sessionId&&!ids.data.conversationId))return NextResponse.json({error:'任务或会话无效。'},{status:400})
  const identity=resolveRequestIdentity(ids.data,auth.user?.id??null),actor=discoveryActor(request,auth.user?.id??null,identity.session.id)
  const reply=(value:Record<string,unknown>,status=200)=>attachDiscoveryActor(NextResponse.json({...value,requestId:identity.requestId,sessionId:actor.sessionId},{status}),actor)
  try {
    const action=parsed.data
    if(action.action==='create')return reply({task:await createComparisonTask(actor,identity.requestId,action.input)})
    if(action.action==='continue')return reply({task:await advanceComparisonTask(actor,action.id,request.signal)})
    return reply({task:await readComparisonTask(actor,action.action,action.id)})
  } catch(error) {
    return error instanceof DiscoveryError?reply({error:error.message,code:error.code},error.status):reply({error:'任务暂时无法执行。',code:'EXECUTION_UNAVAILABLE'},503)
  }
}

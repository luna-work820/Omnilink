import { NextRequest,NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveRequestUser } from '@/lib/api/request-user'
import { discoveryActor,attachDiscoveryActor } from '@/lib/consumer-advisor/discovery-engine'
import { searchInformation } from '@/lib/consumer-advisor/execution-store'
import { DiscoveryError } from '@/lib/consumer-advisor/discovery-contract'

export async function GET(request:NextRequest) {
  const auth=await resolveRequestUser(request);if(!auth.ok)return auth.response
  const parsed=z.object({sessionId:z.string().uuid(),query:z.string().max(160).default('')}).safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if(!parsed.success)return NextResponse.json({error:'查询或会话无效。'},{status:400})
  const actor=discoveryActor(request,auth.user?.id??null,parsed.data.sessionId)
  try{return attachDiscoveryActor(NextResponse.json({items:await searchInformation(actor,parsed.data.query),sessionId:actor.sessionId}),actor)}
  catch(error){return attachDiscoveryActor(NextResponse.json({error:'信息暂时无法读取。',code:error instanceof DiscoveryError?error.code:'INFORMATION_UNAVAILABLE'},{status:503}),actor)}
}

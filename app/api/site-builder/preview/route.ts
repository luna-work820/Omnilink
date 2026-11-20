import {z} from 'zod'
import {websiteAuth,websiteFailure} from '@/lib/site-builder/auth'
import {ensureWebsiteRuntime} from '@/lib/site-builder/service'
export const runtime='nodejs'
export const maxDuration=60
export async function POST(request:Request){
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'请求来源无效'},{status:403})
 const auth=await websiteAuth();if(!auth.ok)return auth.response
 const input=z.object({buildId:z.string().uuid()}).strict().safeParse(await request.json().catch(()=>null))
 if(!input.success)return Response.json({error:'网站版本无效'},{status:400})
 try{
  const result=await ensureWebsiteRuntime({userId:auth.user.id,storeId:auth.store.id,buildId:input.data.buildId,mode:'preview',appOrigin:new URL(request.url).origin})
  return Response.json({url:`${result.runtime.url}/?access=${result.runtime.access}`,expiresAt:result.runtime.expiresAt,products:result.products},{headers:{'Cache-Control':'no-store'}})
 }catch(error){return websiteFailure(error)}
}

import {after} from 'next/server'
import {z} from 'zod'
import {websiteAuth,websiteFailure} from '@/lib/site-builder/auth'
import {readWebsiteState,websiteCommand,executeWebsiteBuild,verifyPublicDataConnection} from '@/lib/site-builder/service'
import {sandboxConfigured} from '@/lib/site-builder/runtime'
import {isWebsiteInstruction} from '@/lib/site-builder/intent'

export const runtime='nodejs'
export const maxDuration=300
const commandSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('generate'),prompt:z.string().trim().min(1).max(4000),requestId:z.string().uuid(),baseBuildId:z.string().uuid().nullable(),continuing:z.boolean().optional()}).strict(),
 z.object({action:z.literal('cancel'),buildId:z.string().uuid(),expectedRevision:z.number().int().nonnegative()}).strict(),
 z.object({action:z.enum(['publish','rollback']),buildId:z.string().uuid()}).strict(),
 z.object({action:z.literal('unpublish')}).strict(),
])
export async function GET(){
 const auth=await websiteAuth();if(!auth.ok)return auth.response
 try{return Response.json(await readWebsiteState(auth.user.id,auth.store.id),{headers:{'Cache-Control':'no-store'}})}catch(error){return websiteFailure(error)}
}
export async function POST(request:Request){
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'请求来源无效'},{status:403})
 const auth=await websiteAuth();if(!auth.ok)return auth.response
 const parsed=commandSchema.safeParse(await request.json().catch(()=>null))
 if(!parsed.success)return Response.json({error:'网站任务参数无效'},{status:400})
 try{
  const body=parsed.data
  if(body.action==='generate'){
   if(!isWebsiteInstruction(body.prompt,body.continuing))return Response.json({error:'请说明建站或修改网站的具体要求'},{status:400})
   const apiKey=process.env.DEEPSEEK_API_KEY?.trim()
   if(!apiKey)return Response.json({error:'服务器尚未配置 DeepSeek 服务'},{status:400})
   if(!sandboxConfigured())return Response.json({error:'服务器尚未配置 Vercel Sandbox 认证'},{status:503})
   const build=await websiteCommand(auth.user.id,auth.store.id,'start',body)
   if(!build.existing)after(()=>executeWebsiteBuild({userId:auth.user.id,storeId:auth.store.id,buildId:build.id,prompt:body.prompt,apiKey}))
   return Response.json({buildId:build.id,status:build.status},{status:202})
  }
  if(body.action==='publish'||body.action==='rollback'){
   const {data:store}=await auth.supabase.from('stores').select('slug').eq('id',auth.store.id).single()
   if(!store)return Response.json({error:'店铺不存在'},{status:404})
   await verifyPublicDataConnection(store.slug)
  }
  await websiteCommand(auth.user.id,auth.store.id,body.action,body)
  return Response.json({success:true})
 }catch(error){return websiteFailure(error)}
}

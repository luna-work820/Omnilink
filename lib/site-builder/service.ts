import 'server-only'
import { randomUUID } from 'node:crypto'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { readBuilderData,readGeneratedPublishedStore } from './data'
import { projectSiteStore } from './projection'
import { generateSiteSource } from './model'
import { artifactDigest, artifactsSchema, buildSiteSource, startSiteRuntime, refreshPreview, stopSiteRuntime, type SiteRuntime } from './runtime'
import type { SiteSourceRevision } from './source'
import { z } from 'zod'

export type WebsiteBuild = {id:string;store_id:string;prompt:string;status:string;revision:number;base_build_id:string|null;source:SiteSourceRevision|null;artifacts:unknown;artifact_digest:string|null;error:string|null;created_at:string}
export class WebsiteError extends Error{constructor(public readonly status:number,message:string){super(message)}}
export async function websiteCommand(userId:string|null,storeId:string,action:string,payload:Record<string,unknown>={}){
  const {data,error}=await createServiceRoleClient().rpc('manage_ai_website',{p_user:userId,p_store:storeId,p_action:action,p_payload:payload})
  if(error){
    if(error.code==='42P01'||error.code==='PGRST202')throw new WebsiteError(503,'建站数据库尚未初始化')
    if(error.code==='42501')throw new WebsiteError(403,'没有此网站的操作权限')
    if(error.code==='40001')throw new WebsiteError(409,error.message==='WEBSITE_BUSY'?'网站正在构建，请等待或取消当前任务':'网站版本已变化，请刷新后重试')
    throw new WebsiteError(error.code==='P0002'?404:400,error.code==='P0002'?'网站或版本不存在':'网站操作未完成，请刷新后重试')
  }
  return data
}
export async function readWebsiteBuild(storeId:string,id:string){
  const {data,error}=await createServiceRoleClient().from('ai_website_builds').select('*').eq('store_id',storeId).eq('id',id).single()
  if(error||!data)throw new WebsiteError(404,'网站版本不存在')
  return data as WebsiteBuild
}
export function publicDataOrigin(){
  try{const url=new URL(process.env.SITE_DATA_ORIGIN??'');if(url.protocol==='https:'&&!url.username&&!url.password&&url.pathname==='/'&&!url.search&&!url.hash&&url.hostname!=='localhost'&&!/^\d+(\.\d+){3}$/.test(url.hostname))return url.origin}catch{}
  return null
}
export async function readWebsiteState(userId:string,storeId:string){
  const db=createServiceRoleClient()
  const {data:store}=await db.from('stores').select('slug,organization_id').eq('id',storeId).single()
  const {data:member}=store?await db.from('organization_members').select('role').eq('organization_id',store.organization_id).eq('user_id',userId).eq('status','active').maybeSingle():{data:null}
  const canPublish=Boolean(publicDataOrigin())&&['owner','admin'].includes(member?.role??'')
  const {data:site,error}=await db.from('ai_websites').select('store_id,draft_build_id,published_build_id,updated_at').eq('store_id',storeId).maybeSingle()
  if(error)throw new WebsiteError(503,'建站数据库尚未初始化')
  if(!site)return {site:null,builds:[],releases:[],canPublish,publicUrl:null}
  await websiteCommand(userId,storeId,'expire')
  const [builds,releases]=await Promise.all([
    db.from('ai_website_builds').select('id,prompt,status,revision,error,created_at').eq('store_id',storeId).order('created_at',{ascending:false}).limit(20),
    db.from('ai_website_releases').select('id,build_id,action,created_at').eq('store_id',storeId).order('created_at',{ascending:false}).limit(30),
  ])
  if(builds.error||releases.error)throw new WebsiteError(503,'网站状态暂时不可用')
  const visibleBuilds=builds.data??[]
  const missing=[site.draft_build_id,site.published_build_id].filter((id):id is string=>Boolean(id)&&!visibleBuilds.some(b=>b.id===id))
  if(missing.length){const extra=await db.from('ai_website_builds').select('id,prompt,status,revision,error,created_at').eq('store_id',storeId).in('id',missing);if(extra.error)throw new WebsiteError(503,'网站版本暂时不可用');visibleBuilds.push(...(extra.data??[]))}
  return {site,builds:visibleBuilds,releases:releases.data??[],canPublish,publicUrl:site.published_build_id&&store?`/sites/${encodeURIComponent(store.slug)}`:null}
}
export async function executeWebsiteBuild(input:{userId:string;storeId:string;buildId:string;prompt:string;apiKey:string}){
  let revision=0
  try{
    const job=await readWebsiteBuild(input.storeId,input.buildId)
    if(job.status!=='generating')return
    const base=job.base_build_id?(await readWebsiteBuild(input.storeId,job.base_build_id)).source:null
    const data=await readBuilderData(input.storeId)
    const source=await generateSiteSource(input.prompt,base,data,input.apiKey)
    const updated=await websiteCommand(input.userId,input.storeId,'building',{buildId:job.id,expectedRevision:0,source}) as WebsiteBuild
    revision=updated.revision
    const artifacts=await buildSiteSource(source)
    await websiteCommand(input.userId,input.storeId,'finish',{buildId:job.id,expectedRevision:revision,artifacts,artifactDigest:artifactDigest(artifacts)})
  }catch(error){
    const message=(error instanceof Error?error.message:'网站生成失败').replaceAll(input.apiKey,'[已隐藏]').slice(0,500)
    try{await websiteCommand(input.userId,input.storeId,'fail',{buildId:input.buildId,expectedRevision:revision,error:message})}catch{/* Cancellation or expiry already fenced this result. */}
  }
}
const runtimeSchema=z.object({lease:z.string(),sandboxId:z.string(),url:z.string().url(),access:z.string().regex(/^[a-f0-9]{64}$/),expiresAt:z.string()})
export async function ensureWebsiteRuntime(input:{userId:string|null;storeId:string;buildId:string;mode:'preview'|'public';appOrigin:string},retry=true):Promise<{runtime:SiteRuntime;products:{id:string;name:string}[]}>{
  const build=await readWebsiteBuild(input.storeId,input.buildId)
  if(build.status!=='ready')throw new WebsiteError(409,'网站尚未构建完成')
  const publicStore=input.mode==='public'?await (async()=>{const {data}=await createServiceRoleClient().from('stores').select('slug').eq('id',input.storeId).single();return data?readGeneratedPublishedStore(data.slug):null})():null
  if(input.mode==='public'&&!publicStore)throw new WebsiteError(404,'网站尚未发布')
  const data=input.mode==='preview'?await readBuilderData(input.storeId):{store:projectSiteStore(publicStore!),products:[]}
  const lease=randomUUID()
  const claim=await websiteCommand(input.userId,input.storeId,'runtime_claim',{buildId:build.id,mode:input.mode,lease})
  if(!claim.claimed){
    const parsed=runtimeSchema.safeParse(claim)
    if(!parsed.success)throw new WebsiteError(409,'网站预览正在启动，请稍后重试')
    try{
      if(input.mode==='preview')await refreshPreview(parsed.data,data)
      else {const response=await fetch(`${parsed.data.url}/?access=${parsed.data.access}`,{signal:AbortSignal.timeout(10000),redirect:'error'});await response.body?.cancel();if(!response.ok)throw new Error('Runtime stopped')}
    }catch{
      if(!retry)throw new WebsiteError(503,'网站预览暂时不可用，请重试')
      await clearRuntime(input.storeId,build.id,input.mode,parsed.data.lease)
      return ensureWebsiteRuntime(input,false)
    }
    return {runtime:parsed.data,products:data.products.map(p=>({id:p.id,name:p.name}))}
  }
  const artifacts=artifactsSchema.parse(build.artifacts)
  if(artifactDigest(artifacts)!==build.artifact_digest)throw new WebsiteError(409,'网站产物校验失败，请重新构建')
  let runtime:SiteRuntime
  try{runtime=await startSiteRuntime({artifacts,data,mode:input.mode,dataOrigin:publicDataOrigin()??undefined,appOrigin:input.appOrigin,lease})}
  catch(error){await clearRuntime(input.storeId,build.id,input.mode,lease);throw error}
  try{await websiteCommand(input.userId,input.storeId,'runtime_commit',{buildId:build.id,mode:input.mode,lease,runtime})}
  catch(error){await stopSiteRuntime(runtime).catch(()=>{});throw error}
  return {runtime,products:data.products.map(p=>({id:p.id,name:p.name}))}
}
async function clearRuntime(storeId:string,buildId:string,mode:'preview'|'public',lease:string){
  const column=mode==='preview'?'preview_runtime':'public_runtime'
  const {error}=await createServiceRoleClient().from('ai_website_builds').update({[column]:null}).eq('store_id',storeId).eq('id',buildId).eq(`${column}->>lease`,lease)
  if(error)throw new WebsiteError(503,'网站运行状态暂时不可用')
}
export async function verifyPublicDataConnection(storeSlug:string){
  const origin=publicDataOrigin()
  if(!origin)throw new WebsiteError(503,'正式发布需要配置公开的网站数据地址 SITE_DATA_ORIGIN')
  const response=await fetch(`${origin}/api/site-data/v1/${encodeURIComponent(storeSlug)}/products?limit=1`,{cache:'no-store',signal:AbortSignal.timeout(10000),redirect:'error'})
  // An unpublished store may legitimately be 404 before its first release.
  const body=await response.json().catch(()=>null)
  if(response.status===404&&body?.error?.code==='STORE_NOT_FOUND')return
  if(!response.ok||body?.schemaVersion!=='1'||body?.storeSlug!==storeSlug)throw new WebsiteError(503,'公开数据接口尚未部署或不可访问，暂不能发布')
}
export type {SiteRuntime}

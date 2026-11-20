import {createServiceRoleClient} from '@/lib/supabase/service-role'
import {ensureWebsiteRuntime} from '@/lib/site-builder/service'
export const runtime='nodejs'
export const maxDuration=60
export async function GET(request:Request,{params}:{params:Promise<{storeSlug:string;path?:string[]}>}){
 const {storeSlug,path=[]}=await params
 const db=createServiceRoleClient()
 const {data:store}=await db.from('stores').select('id').eq('slug',storeSlug).eq('status','active').maybeSingle()
 if(!store)return new Response('网站不存在',{status:404})
 const {data:site}=await db.from('ai_websites').select('published_build_id').eq('store_id',store.id).maybeSingle()
 if(!site?.published_build_id)return new Response('网站尚未发布',{status:404})
 try{
  const {runtime}=await ensureWebsiteRuntime({userId:null,storeId:store.id,buildId:site.published_build_id,mode:'public',appOrigin:new URL(request.url).origin})
  const url=new URL(runtime.url);url.pathname='/'+path.map(encodeURIComponent).join('/');url.searchParams.set('access',runtime.access)
  return new Response(null,{status:307,headers:{Location:url.href,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}})
 }catch{return new Response('网站正在启动，请稍后刷新',{status:503,headers:{'Retry-After':'5','Cache-Control':'no-store'}})}
}

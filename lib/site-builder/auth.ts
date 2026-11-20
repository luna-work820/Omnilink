import {requireUser,getOwnedStore} from '@/lib/api/auth'
import {workspaceCapabilities} from '@/lib/workspace/capabilities'
import {WebsiteError} from './service'

export async function websiteAuth(){
 const auth=await requireUser()
 if(!auth.ok)return {ok:false as const,response:Response.json({error:auth.response.status===401?'请先登录商家账号后建站':'身份验证暂时不可用'},{status:auth.response.status})}
 const store=await getOwnedStore(auth.supabase,auth.user)
 if(!store||!workspaceCapabilities(auth.user.app_metadata,true).merchant)return {ok:false as const,response:Response.json({error:'请先开通商家并完成店铺设置'},{status:403})}
 return {...auth,store}
}
export function websiteFailure(error:unknown){
 return Response.json({error:error instanceof WebsiteError?error.message:'网站服务暂时不可用'},{status:error instanceof WebsiteError?error.status:503})
}

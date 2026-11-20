'use client'
import {useCallback,useEffect,useState} from 'react'
export type BuildSummary={id:string;prompt:string;status:string;revision:number;error:string|null;created_at:string}
export type WebsiteState={site:{store_id:string;draft_build_id:string|null;published_build_id:string|null}|null;builds:BuildSummary[];releases:{id:string;build_id:string|null;action:string;created_at:string}[];canPublish:boolean;publicUrl:string|null}
export const websiteStatus:Record<string,string>={generating:'正在生成网站',building:'正在构建网站',ready:'构建完成',failed:'构建失败',cancelled:'已取消'}
export function useWebsiteBuilder(enabled=true){
 const [state,setState]=useState<WebsiteState|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[needsLogin,setNeedsLogin]=useState(false)
 const reload=useCallback(async(signal?:AbortSignal)=>{
  const response=await fetch('/api/site-builder',{cache:'no-store',signal});const data=await response.json()
  if(!response.ok){setNeedsLogin(response.status===401);throw new Error(data.error||'网站状态读取失败')}
  setState(data);setError('');setLoading(false);return data as WebsiteState
 },[])
 const latestStatus=state?.builds[0]?.status
 useEffect(()=>{
  if(!enabled)return
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>
  const load=async()=>{try{const data=await reload(controller.signal);if(data.builds.some(b=>['generating','building'].includes(b.status)))timer=setTimeout(load,2500)}catch(error){if(!controller.signal.aborted){setLoading(false);setError(error instanceof Error?error.message:'网站状态读取失败')}}}
  void load();return()=>{controller.abort();clearTimeout(timer)}
 },[enabled,reload,latestStatus])
 const command=useCallback(async(body:Record<string,unknown>)=>{
  const response=await fetch('/api/site-builder',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
  const data=await response.json();if(!response.ok){setNeedsLogin(response.status===401);throw new Error(data.error||'网站操作失败')}
  await reload();return data
 },[reload])
 const generate=useCallback(async(prompt:string,continuing:boolean)=>{
  const current=await reload()
  return command({action:'generate',prompt,continuing,requestId:crypto.randomUUID(),baseBuildId:current.site?.draft_build_id??null})
 },[command,reload])
 return {state,error,loading,needsLogin,reload,command,generate}
}

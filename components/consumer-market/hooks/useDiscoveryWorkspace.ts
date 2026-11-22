'use client'

import { useCallback,useEffect,useLayoutEffect,useRef,useState } from 'react'
import type { ProductItem } from '../types'
import { applyDiscoveryPage } from '@/lib/consumer-advisor/discovery-state'
import type { DiscoveryPage,DiscoverySpec } from '@/lib/consumer-advisor/discovery-contract'

export type PersonalView='memories'|'assessment'|null
export type DiscoveryFailure={message:string;code?:string;retrySpec?:DiscoverySpec}
type FailedRequest={payload:Record<string,unknown>;append:boolean;spec?:DiscoverySpec;code?:string}
export function useDiscoveryWorkspace(sessionId:string,onProducts:(products:ProductItem[])=>void,onSearchStart?:()=>void) {
  const [pages,setPages]=useState<Record<string,DiscoveryPage|null>>({})
  const [errors,setErrors]=useState<Record<string,DiscoveryFailure>>({})
  const [busy,setBusy]=useState(false)
  const [personalView,setPersonalView]=useState<PersonalView>(null)
  const [contextVersion,setContextVersion]=useState(0)
  const pagesRef=useRef(pages),sessionRef=useRef(sessionId),epoch=useRef(0),controller=useRef<AbortController|null>(null)
  const busyRef=useRef(false),versionRef=useRef(0)
  const failedRequests=useRef<Record<string,FailedRequest>>({})
  useLayoutEffect(()=>{pagesRef.current=pages},[pages])
  const discovery=pages[sessionId]??null

  useLayoutEffect(() => {sessionRef.current=sessionId;epoch.current++;controller.current?.abort();busyRef.current=false;setBusy(false)},[sessionId])
  useEffect(() => () => controller.current?.abort(),[])
  const cancelPendingDiscovery=useCallback(()=>{
    epoch.current++;controller.current?.abort();busyRef.current=false;setBusy(false)
  },[])
  const acceptDiscovery=useCallback((page:DiscoveryPage,append=false) => {
    if(page.sessionId!==sessionRef.current || page.contextVersion<versionRef.current)return false
    onProducts(page.products)
    setPages((current) => ({...current,[page.sessionId]:applyDiscoveryPage(current[page.sessionId]??null,page,append)}))
    versionRef.current=page.contextVersion
    setContextVersion(page.contextVersion)
    setErrors((current) => ({...current,[page.sessionId]:{message:''}}))
    delete failedRequests.current[page.sessionId]
    return true
  },[onProducts])

  const request=useCallback(async (payload:Record<string,unknown>,append=false,retrySpec?:DiscoverySpec) => {
    if(payload.action==='start'||payload.action==='refine')onSearchStart?.()
    controller.current?.abort()
    const abort=new AbortController();controller.current=abort
    const turn=++epoch.current,target=sessionRef.current
    busyRef.current=true
    setBusy(true)
    setErrors((current) => ({...current,[target]:{message:''}}))
    try{
      const response=await fetch('/api/consumer/discovery',{method:'POST',credentials:'include',signal:abort.signal,
        headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,sessionId:target})})
      const result=await response.json() as {discovery?:DiscoveryPage;dismissed?:boolean;error?:string;code?:string;memoryWarning?:string}
      if(turn!==epoch.current || sessionRef.current!==target) return
      if(!response.ok) {
        failedRequests.current[target]={payload,append,spec:retrySpec,code:result.code}
        setErrors((current) => ({...current,[target]:{message:result.error??'商品暂时无法读取，请重试。',code:result.code,retrySpec}}))
        return
      }
      if(result.discovery && !acceptDiscovery(result.discovery,append)){
        failedRequests.current[target]={payload,append,spec:retrySpec,code:'CONTEXT_CHANGED'}
        setErrors((current)=>({...current,[target]:{message:'偏好已更新，请刷新结果。',code:'CONTEXT_CHANGED',retrySpec}}))
      }
      if(result.dismissed) setPages((current) => {const page=current[target];return page?{...current,[target]:{...page,question:null,spec:{...page.spec,questionDismissed:true}}}:current})
      if(result.memoryWarning) setErrors((current) => ({...current,[target]:{message:result.memoryWarning!,code:'MEMORY_WARNING'}}))
    }catch{
      if(!abort.signal.aborted && turn===epoch.current){
        failedRequests.current[target]={payload,append,spec:retrySpec}
        setErrors((current) => ({...current,[target]:{message:'搜索连接失败，请重试。',retrySpec}}))
      }
    }finally{if(turn===epoch.current){busyRef.current=false;setBusy(false)}}
  },[acceptDiscovery,onSearchStart])
  const loadMore=useCallback(() => {
    const page=pagesRef.current[sessionRef.current]
    if(page?.nextCursor && !busyRef.current) void request({action:'page',searchRunId:page.searchRunId,cursor:page.nextCursor},true,page.spec)
  },[request])
  const refreshDiscovery=useCallback((spec?:DiscoverySpec) => {
    const current=pagesRef.current[sessionRef.current]
    const query=spec??current?.spec
    if(query) void request({action:'start',spec:query},false,query)
  },[request])
  const clearDiscovery=useCallback(() => {
    epoch.current++;controller.current?.abort();busyRef.current=false;setBusy(false)
    setPages((current) => ({...current,[sessionRef.current]:null}))
    setErrors((current) => ({...current,[sessionRef.current]:{message:''}}))
    delete failedRequests.current[sessionRef.current]
  },[])
  const updateContextVersion=useCallback((version:number) => {
    if(version<=versionRef.current)return
    versionRef.current=version
    setContextVersion(version)
    const current=pagesRef.current[sessionRef.current]
    setPages((all)=>Object.fromEntries(Object.entries(all).filter(([,page])=>page?.contextVersion===version)))
    if(current && version!==current.contextVersion) void request({action:'start',spec:current.spec},false,current.spec)
  },[request])
  const refineDiscovery=useCallback((answer:string)=>{
    const page=pagesRef.current[sessionRef.current]
    if(page&&!busyRef.current)void request({action:'refine',searchRunId:page.searchRunId,questionId:'style',answer},false,page.spec)
  },[request])
  const skipDiscoveryQuestion=useCallback(()=>{
    const page=pagesRef.current[sessionRef.current]
    if(page&&!busyRef.current)void request({action:'skip-question',searchRunId:page.searchRunId},false,page.spec)
  },[request])
  const resumeDiscovery=useCallback((runId:string,version:number,spec?:DiscoverySpec)=>{
    void request({action:'resume',searchRunId:runId,contextVersion:version},false,spec)
  },[request])
  const retryDiscovery=useCallback(()=>{
    const failed=failedRequests.current[sessionRef.current]
    if(!failed||busyRef.current)return
    if(failed.spec&&['CONTEXT_CHANGED','SEARCH_EXPIRED','SEARCH_NOT_FOUND','CURSOR_INVALID'].includes(failed.code??'')){
      void request({action:'start',spec:failed.spec},false,failed.spec)
    }else void request(failed.payload,failed.append,failed.spec)
  },[request])
  return {discovery,discoveryBusy:busy,discoveryError:errors[sessionId]??null,acceptDiscovery,loadMoreDiscovery:loadMore,
    refreshDiscovery,clearDiscovery,personalView,openPersonalView:setPersonalView,contextVersion,updateContextVersion,
    refineDiscovery,skipDiscoveryQuestion,resumeDiscovery,
    cancelPendingDiscovery,retryDiscovery,
  }
}

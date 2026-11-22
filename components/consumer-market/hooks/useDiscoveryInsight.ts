'use client'

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import type { DiscoveryPage } from '@/lib/consumer-advisor/discovery-contract'
import type { InsightQuestion } from '@/lib/consumer-advisor/fashion-insight'
import type { ConsumerAiModel } from '../types'

export function useDiscoveryInsight(discovery:DiscoveryPage|null, model:ConsumerAiModel, root:RefObject<HTMLDivElement|null>, grid:RefObject<HTMLDivElement|null>, active:boolean) {
  const [question,setQuestion]=useState<InsightQuestion|null>(null)
  const [thinking,setThinking]=useState(false)
  const seen=useRef(new Set<string>())
  const requested=useRef(false)
  const controller=useRef<AbortController|null>(null)
  const current=useRef(discovery)
  useLayoutEffect(()=>{current.current=discovery},[discovery])
  const runId=discovery?.searchRunId

  useEffect(()=>{
    seen.current=new Set();requested.current=false;setQuestion(null);setThinking(false)
    return ()=>{controller.current?.abort()}
  },[runId])

  useEffect(()=>{
    if(!active||!runId||!discovery||discovery.spec.questionDismissed||!root.current||!grid.current)return
    const timers=new Map<Element,ReturnType<typeof setTimeout>>()
    const request=()=>{
      const page=current.current
      if(!page||page.searchRunId!==runId||requested.current||seen.current.size<30)return
      requested.current=true
      const abort=new AbortController();controller.current=abort
      void (async()=>{
        try {
          const response=await fetch('/api/consumer/discovery',{method:'POST',credentials:'include',signal:abort.signal,headers:{'Content-Type':'application/json'},
            body:JSON.stringify({action:'insight',sessionId:page.sessionId,searchRunId:runId,viewedIds:[...seen.current].slice(0,30),model})})
          if(!response.ok)return
          if(!response.headers.get('content-type')?.includes('application/x-ndjson'))return
          const reader=response.body?.getReader()
          if(!reader)return
          const decoder=new TextDecoder();let buffer=''
          while(true){
            const {done,value}=await reader.read()
            if(done)break
            buffer+=decoder.decode(value,{stream:true})
            const lines=buffer.split('\n');buffer=lines.pop()??''
            for(const line of lines){
              if(!line)continue
              const event=JSON.parse(line) as {phase?:string;question?:InsightQuestion|null}
              if(abort.signal.aborted||current.current?.searchRunId!==runId)return
              if(event.phase==='thinking')setThinking(true)
              if('question' in event)setQuestion(event.question??null)
            }
          }
        } catch { /* Continue browsing if the optional question is unavailable. */ }
        finally {if(!abort.signal.aborted)setThinking(false)}
      })()
    }
    const observer=new IntersectionObserver((entries)=>{
      for(const entry of entries){
        const id=(entry.target as HTMLElement).dataset.productId
        if(!id||seen.current.has(id))continue
        if(entry.isIntersecting&&entry.intersectionRect.height>=Math.min(entry.boundingClientRect.height * 0.5, 200)&&document.visibilityState==='visible'){
          if(!timers.has(entry.target))timers.set(entry.target,setTimeout(()=>{timers.delete(entry.target);if(document.visibilityState==='visible'){seen.current.add(id);request()}},500))
        }else{const timer=timers.get(entry.target);if(timer)clearTimeout(timer);timers.delete(entry.target)}
      }
    },{root:root.current,threshold:[0,0.25,0.5]})
    const onVisibility=()=>{if(document.visibilityState!=='visible'){for(const timer of timers.values())clearTimeout(timer);timers.clear()}else{observer.disconnect();grid.current?.querySelectorAll('[data-product-id]').forEach((element)=>observer.observe(element))}}
    document.addEventListener('visibilitychange',onVisibility)
    grid.current.querySelectorAll('[data-product-id]').forEach((element)=>observer.observe(element))
    return ()=>{observer.disconnect();for(const timer of timers.values())clearTimeout(timer);document.removeEventListener('visibilitychange',onVisibility)}
  },[active,runId,discovery?.products,discovery?.spec.questionDismissed,model,root,grid])

  const dismiss=()=>setQuestion(null)
  return {question,thinking,dismiss}
}

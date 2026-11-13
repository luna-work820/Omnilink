'use client'

import { useCallback,useEffect,useRef,useState } from 'react'
import type { ComparisonResult,ExecutionTask,InformationItem,ResponseBlock } from '@/lib/consumer-advisor/response-contract'

const control='min-h-11 rounded-full px-3 text-sm hover:bg-[var(--market-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)] disabled:opacity-40'
const labels:Record<ExecutionTask['status'],string>={pending:'等待执行',running:'正在处理',paused:'可以继续',completed:'已完成',failed:'执行失败',cancelled:'已取消'}
const stepLabels:Record<string,string>={context:'核对个人上下文',products:'读取公开商品',sources:'读取网址资料',comparison:'核验并生成对比'}

export function InformationResults({items}:{items:InformationItem[]}) {
  return <ul className="mt-3 divide-y-[0.5px] divide-[var(--market-border)]">{items.map((item)=><li key={`${item.entityType}:${item.id}`} className="py-3">
    <a href={item.url} target={item.url.startsWith('https:')?'_blank':undefined} rel="noopener noreferrer" className="inline-flex min-h-11 max-w-full items-center rounded-full px-3 text-sm font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-[var(--market-support)] hover:bg-[var(--market-hover)]">{item.title}</a>
    <p className="px-3 text-xs text-[var(--market-text-secondary)]">{item.source}</p>
    {item.excerpt&&<p className="mt-1 break-words px-3 text-sm leading-6">{item.excerpt.slice(0,240)}</p>}
  </li>)}</ul>
}
function ComparisonTable({result}:{result:ComparisonResult}) {
  if(!result.columns.length)return <p className="py-3 text-sm">没有可公开核验的资料。</p>
  return <section aria-label="对比结果" className="mt-3 min-w-0">
    <div className="overflow-x-auto" role="region" aria-label="商品与资料对比表" tabIndex={0}>
      <table className="w-full min-w-80 border-collapse text-left text-sm"><thead><tr><th scope="col" className="w-20 whitespace-nowrap p-3">项目</th>{result.columns.map((c)=><th key={c.id} scope="col" className="min-w-36 p-3 font-medium"><a href={c.url} target={c.url.startsWith('https:')?'_blank':undefined} rel="noopener noreferrer" className="underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-[var(--market-support)]">{c.title}</a></th>)}</tr></thead>
      <tbody>{result.rows.map((row)=><tr key={row.label} className="border-t-[0.5px] border-[var(--market-border)]"><th scope="row" className="whitespace-nowrap p-3 align-top font-medium">{row.label}</th>{row.values.map((value,index)=><td key={index} className="p-3 align-top leading-6">{value}</td>)}</tr>)}</tbody></table>
    </div>
    {result.unknowns.map((text)=><p key={text} className="mt-2 text-xs text-[var(--market-text-secondary)]">{text}</p>)}
  </section>
}
export function ExecutionTaskResult({initialTask,sessionId}:{initialTask:ExecutionTask;sessionId:string}) {
  const [task,setTask]=useState(initialTask),[error,setError]=useState(''),[busy,setBusy]=useState(false),[automatic,setAutomatic]=useState(true)
  const active=useRef(true),controller=useRef<AbortController|null>(null),pending=useRef(false)
  const perform=useCallback(async(action:'get'|'continue'|'cancel'|'retry')=>{
    if(pending.current&&action!=='cancel')return
    controller.current?.abort();const abort=new AbortController();controller.current=abort
    pending.current=true;setBusy(true);setError('')
    try {
      const response=await fetch('/api/consumer/tasks',{method:'POST',credentials:'include',signal:abort.signal,headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action,id:initialTask.id,sessionId})})
      const result=await response.json() as {task?:ExecutionTask;error?:string}
      if(!response.ok||!result.task)throw new Error(result.error??'任务暂时无法读取。')
      if(active.current&&!abort.signal.aborted)setTask((current)=>result.task!.revision>=current.revision?result.task!:current)
    } catch(cause) {
      if(active.current&&!abort.signal.aborted){setAutomatic(false);setError(cause instanceof Error?cause.message:'任务连接失败。')}
    } finally {if(controller.current===abort){pending.current=false;if(active.current)setBusy(false)}}
  },[initialTask.id,sessionId])
  useEffect(()=>{active.current=true;void perform('get');return()=>{active.current=false;controller.current?.abort();pending.current=false}},[perform])
  useEffect(()=>{
    if(!automatic||busy||!['pending','paused','running'].includes(task.status))return
    const timer=window.setTimeout(()=>void perform('continue'),800)
    return()=>window.clearTimeout(timer)
  },[automatic,busy,task.status,task.revision,perform])
  return <section aria-label="对比任务" className="mt-3 min-w-0 text-sm" aria-busy={busy}>
    <p role="status" className="font-medium">{labels[task.status]}</p>
    <ol className="mt-2 space-y-1 text-xs text-[var(--market-text-secondary)]">{Object.entries(stepLabels).map(([key,label])=><li key={key}>{task.completedSteps.includes(key)?'✓ ':''}{label}</li>)}</ol>
    {task.status==='failed'&&<p className="mt-3 text-sm" role="alert">{task.error==='CONTEXT_CHANGED'?'偏好已更新，请重新确认后继续。':'任务未完成，可从已保存的步骤重试。'}</p>}
    {error&&<p role="alert" className="mt-3">{error}</p>}
    <div className="mt-2 flex flex-wrap gap-1">
      {['pending','paused','running'].includes(task.status)&&<><button type="button" className={control} disabled={busy} onClick={()=>{setAutomatic(true);void perform('continue')}}>继续</button><button type="button" className={control} onClick={()=>{setAutomatic(false);void perform('cancel')}}>取消任务</button></>}
      {task.status==='failed'&&task.attempt<3&&<button type="button" disabled={busy} className={control} onClick={()=>{setAutomatic(true);void perform('retry')}}>重试任务</button>}
      {error&&<button type="button" disabled={busy} className={control} onClick={()=>void perform('get')}>重新读取</button>}
    </div>
    {task.result&&<ComparisonTable result={task.result}/>}
  </section>
}
export function ExecutionResults({blocks,sessionId}:{blocks:ResponseBlock[];sessionId:string}) {
  return <>{blocks.map((block)=>block.type==='task_progress'?<ExecutionTaskResult key={block.id} initialTask={block.data} sessionId={sessionId}/>
    :block.type==='comparison'?<ComparisonTable key={block.id} result={block.data}/>:block.type==='information_feed'?<InformationResults key={block.id} items={block.data.items}/>:null)}</>
}

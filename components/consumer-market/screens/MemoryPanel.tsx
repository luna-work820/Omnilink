'use client'

import Link from 'next/link'
import { useCallback,useEffect,useState,type FormEvent } from 'react'
import { useOmnilink } from '../context/OmnilinkContext'
import { emptyAiAssistantProfile,readAiAssistantProfile,type AiAssistantProfile } from '@/lib/consumer-advisor/ai-assistant-profile'
import { readPreviewAiAssistantProfile,savePreviewAiAssistantProfile } from '@/lib/consumer-advisor/ai-assistant-preview-storage'
import { SHOPPING_PREFERENCE_DEEP_QUESTIONS } from '@/lib/consumer-advisor/shopping-preference-survey'
import { assessmentMemoryProposal,assessmentEvidenceKey } from '@/lib/consumer-advisor/assessment-memory-proposal'

type Memory=AiAssistantProfile['memories'][number]
const domains={other:'其他',space:'空间',clothing:'穿搭',skin:'护肤',hair:'头发'} as const
const secondary='min-h-11 rounded-full px-3 text-sm hover:bg-[var(--market-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)] disabled:opacity-40'
const primary='min-h-11 rounded-full bg-[var(--market-accent)] px-5 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--market-support)] disabled:opacity-40'

function localAction(profile:AiAssistantProfile,body:Record<string,unknown>):AiAssistantProfile {
  const now=new Date().toISOString()
  if(body.action==='memory') {
    if(profile.memories.filter((m)=>m.status!=='rejected').length>=50)throw new Error('记忆已达到上限。')
    return {...profile,memories:[...profile.memories,{id:crypto.randomUUID(),domain:body.domain as Memory['domain'],text:String(body.text),
      origin:'user',status:'active',sourceKind:'manual',evidence:'你手动保存的记忆',confirmedAt:now,revision:1,originalText:String(body.text)}]}
  }
  const target=profile.memories.find((m)=>m.id===body.id)
  if(!target||(target.revision??1)!==body.revision)throw new Error('记忆已更新，请重新读取。')
  const invalid=new Set<string>(['reject','forget','correct'].includes(String(body.action))?[target.id]:target.supersedeIds??[])
  let size=-1
  while(size!==invalid.size){size=invalid.size;for(const m of profile.memories)if(m.supportIds?.some((id)=>invalid.has(id)))invalid.add(m.id)}
  return {...profile,memories:profile.memories.filter((m)=>body.action!=='forget'||m.id!==target.id).map((m)=>{
    if(m.id===target.id)return {...m,text:body.action==='correct'?String(body.text):m.text,status:body.action==='reject'?'rejected' as const:'active' as const,
      confirmedAt:now,revision:(m.revision??1)+1,sourcePayload:body.action==='correct'?{...m.sourcePayload,originalPreferenceSignals:m.sourcePayload?.preferenceSignals,preferenceSignals:null}:m.sourcePayload}
    return invalid.has(m.id)?{...m,status:'rejected' as const,revision:(m.revision??1)+1}:m
  })}
}

function AssessmentEvidence({memory}:{memory:Memory}) {
  const answers=memory.sourcePayload?.answers
  if(!answers||typeof answers!=='object'||Array.isArray(answers))return null
  const values=answers as Record<string,unknown>
  return <details className="mt-2 text-xs text-[var(--market-text-secondary)]"><summary className="cursor-pointer py-2 focus-visible:outline-2 focus-visible:outline-[var(--market-support)]">原始评测</summary>
    <dl className="space-y-3 pb-2">{SHOPPING_PREFERENCE_DEEP_QUESTIONS.filter((q)=>q.id in values).map((q)=>{
      const choices=[...(q.options??[]),q.left,q.right,q.tie_option].filter((o)=>o!==undefined)
      const label=(v:unknown)=>choices.find((o)=>o.value===v)?.label??String(v)
      const answer=values[q.id]
      return <div key={q.id}><dt>{q.prompt}</dt><dd className="mt-1 text-[var(--market-ink)]">{Array.isArray(answer)?answer.map(label).join('、'):label(answer)}</dd></div>
    })}</dl></details>
}

export function MemoryPanel({preview=false}:{preview?:boolean}) {
  const {openPersonalView,updateContextVersion}=useOmnilink()
  const [profile,setProfile]=useState<AiAssistantProfile>(emptyAiAssistantProfile)
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[login,setLogin]=useState(false)
  const [readFailed,setReadFailed]=useState(false)
  const [error,setError]=useState(''),[text,setText]=useState(''),[domain,setDomain]=useState<Memory['domain']>('other')
  const [editing,setEditing]=useState<string|null>(null),[editText,setEditText]=useState('')
  const load=useCallback(async(signal?:AbortSignal)=>{
    setLoading(true);setError('');setReadFailed(false)
    try{
      if(preview){setProfile(readAiAssistantProfile(readPreviewAiAssistantProfile()));return}
      const response=await fetch('/api/consumer/ai-assistant-profile',{credentials:'include',signal,cache:'no-store'})
      if(response.status===401){setLogin(true);return}
      const result=await response.json()
      if(!response.ok||!result.profile)throw new Error(result.error??'记忆暂时无法读取。')
      setProfile(readAiAssistantProfile(result.profile));updateContextVersion(Number(result.contextVersion??0))
    }catch(cause){if(!signal?.aborted){setReadFailed(true);setError(cause instanceof Error?cause.message:'记忆暂时无法读取。')}}
    finally{if(!signal?.aborted)setLoading(false)}
  },[preview,updateContextVersion])
  useEffect(()=>{const abort=new AbortController();void load(abort.signal);return()=>abort.abort()},[load])
  async function mutate(body:Record<string,unknown>) {
    setBusy(true);setError('')
    try{
      if(preview){
        let next:AiAssistantProfile
        if(body.action==='assessment-propose'){
          const proposal=await assessmentMemoryProposal(profile)
          if(!proposal)throw new Error('请先完成评测。')
          const existing=profile.memories.some((m)=>m.sourcePayload?.assessmentId===proposal.sourcePayload.assessmentId&&m.status!=='rejected')
          next=existing?profile:{...profile,memories:[...profile.memories,{...proposal,id:crypto.randomUUID(),status:'proposed',revision:1,confirmedAt:null}]}
        }else next=localAction(profile,body)
        savePreviewAiAssistantProfile(next);setProfile(next)
      }else{
        const response=await fetch('/api/consumer/ai-assistant-profile',{method:'PATCH',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
        const result=await response.json()
        if(!response.ok||!result.profile){if(response.status===409){setEditing(null);await load()}throw new Error(result.error??'记忆暂时无法保存。')}
        setProfile(readAiAssistantProfile(result.profile));updateContextVersion(Number(result.contextVersion??0))
      }
      setEditing(null);if(body.action==='memory')setText('')
    }catch(cause){setError(cause instanceof Error?cause.message:'记忆暂时无法保存。')}
    finally{setBusy(false)}
  }
  function save(event:FormEvent){event.preventDefault();if(text.trim()&&!busy)void mutate({action:'memory',text:text.trim(),domain})}
  const pending=profile.memories.filter((m)=>m.status==='proposed'||!m.status)
  const active=profile.memories.filter((m)=>m.status==='active'&&m.confirmedAt)
  const assessmentRecorded=profile.memories.some((memory)=>{
    const source=memory.sourcePayload
    return memory.status!=='rejected'&&source&&source.answers&&assessmentEvidenceKey({version:String(source.assessmentVersion),
      answers:source.answers as Record<string,unknown>,skipped:Array.isArray(source.skipped)?source.skipped:[]})===assessmentEvidenceKey(profile.shoppingPreferenceSurvey)
  })
  const row=(memory:Memory)=><li key={memory.id} className="py-4">
    {editing===memory.id?<form onSubmit={(e)=>{e.preventDefault();if(editText.trim())void mutate({action:'correct',id:memory.id,revision:memory.revision??1,text:editText.trim()})}}>
      <label className="block text-sm">修正内容<textarea autoFocus maxLength={240} value={editText} onChange={(e)=>setEditText(e.target.value)} className="mt-2 min-h-24 w-full resize-y rounded-[var(--radius-card-nested)] border-[0.5px] border-[var(--market-border)] bg-transparent p-3 focus-visible:outline-2 focus-visible:outline-[var(--market-support)]"/></label>
      <div className="mt-2 flex gap-2"><button type="submit" className={primary} disabled={busy||!editText.trim()}>保存</button><button type="button" className={secondary} onClick={()=>setEditing(null)} disabled={busy}>取消</button></div>
    </form>:<>
      <p className="whitespace-pre-wrap break-words text-sm leading-6">{memory.text}</p>
      <p className="mt-1 text-xs text-[var(--market-text-secondary)]">{domains[memory.domain]}，{memory.origin==='inferred'?'推断':memory.sourceKind==='assessment'?'评测自述':'自述'}{memory.status==='active'?'，已确认':'，待确认'}</p>
      {memory.evidence&&<p className="mt-2 break-words text-xs leading-5 text-[var(--market-text-secondary)]">{memory.evidence}</p>}
      <AssessmentEvidence memory={memory}/>
      <div className="mt-2 flex flex-wrap gap-1">
        {memory.status!=='active'&&<button type="button" className={primary} disabled={busy} onClick={()=>void mutate({action:'confirm',id:memory.id,revision:memory.revision??1})}>确认</button>}
        <button type="button" className={secondary} disabled={busy} onClick={()=>{setEditing(memory.id);setEditText(memory.text)}}>修改</button>
        <button type="button" className={secondary} disabled={busy} onClick={()=>void mutate({action:memory.status==='active'?'forget':'reject',id:memory.id,revision:memory.revision??1})}>{memory.status==='active'?'删除':'拒绝'}</button>
      </div>
    </>}
  </li>
  return <section className="mx-auto w-full max-w-2xl px-4 pb-8 text-[var(--market-ink)]" aria-label="偏好与记忆" aria-busy={loading||busy}>
    <header className="mb-5 flex items-center gap-2"><button type="button" className={secondary} onClick={()=>openPersonalView(null)}>返回</button><h1 className="text-base font-semibold">偏好与记忆</h1><button type="button" className={`${secondary} ml-auto`} onClick={()=>openPersonalView('assessment')}>评测</button></header>
    {preview&&<p className="mb-4 text-xs text-[var(--market-text-secondary)]">本机预览，不会写入账号记忆。</p>}
    {loading?<p className="py-8 text-sm" role="status">正在读取偏好与记忆…</p>:login?<div className="py-8"><p className="text-sm">登录后可管理长期偏好。</p><Link href="/login" className={`${primary} mt-4 inline-flex items-center`}>登录</Link></div>:readFailed?null:<>
      {pending.length>0&&<section aria-label="待确认提案"><h2 className="text-sm font-medium">待确认</h2><ul className="[&>li+li]:border-t-[0.5px] [&>li+li]:border-[var(--market-border)]">{pending.map(row)}</ul></section>}
      <section className="mt-5" aria-label="已确认记忆"><h2 className="text-sm font-medium">已确认</h2>{active.length?<ul className="[&>li+li]:border-t-[0.5px] [&>li+li]:border-[var(--market-border)]">{active.map(row)}</ul>:<p className="py-5 text-sm text-[var(--market-text-secondary)]">还没有已确认记忆，可添加偏好或完成评测。</p>}</section>
      <form onSubmit={save} className="mt-5 space-y-3"><label className="block text-sm">添加记忆<textarea maxLength={240} value={text} onChange={(e)=>setText(e.target.value)} placeholder="填写希望长期保留的偏好" className="mt-2 min-h-24 w-full resize-y rounded-[var(--radius-card-nested)] border-[0.5px] border-[var(--market-border)] bg-transparent p-3 focus-visible:outline-2 focus-visible:outline-[var(--market-support)]"/></label>
        <div className="flex items-center gap-3"><label className="text-xs">类别<select className="ml-2 min-h-11 rounded-full bg-transparent px-3 text-sm focus-visible:outline-2 focus-visible:outline-[var(--market-support)]" value={domain} onChange={(e)=>setDomain(e.target.value as Memory['domain'])}>{Object.entries(domains).map(([v,label])=><option value={v} key={v}>{label}</option>)}</select></label><button type="submit" className={`${primary} ml-auto`} disabled={busy||!text.trim()}>保存</button></div>
      </form>
      {profile.shoppingPreferenceSurvey.status==='complete'&&!assessmentRecorded&&<button type="button" className={`${secondary} mt-4`} disabled={busy} onClick={()=>void mutate({action:'assessment-propose'})}>整理评测提案</button>}
    </>}
    {error&&<div role="alert" className="mt-4 text-sm"><p>{error}</p><button type="button" className={secondary} disabled={loading||busy} onClick={()=>void load()}>重新读取</button></div>}
  </section>
}

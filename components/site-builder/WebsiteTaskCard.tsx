'use client'
import Link from 'next/link'
import {websiteStatus,type WebsiteState} from './useWebsiteBuilder'
export function WebsiteTaskCard({state,onCancel}:{state:WebsiteState;onCancel:(buildId:string,revision:number)=>void}){
 const build=state.builds[0];if(!build)return null
 return <section aria-label="网站任务" className="mx-auto w-full max-w-[620px] rounded-xl border-[0.5px] border-[var(--border-subtle)] p-4 text-sm">
  <div className="flex items-center justify-between gap-3"><span className="font-medium">网站设计</span><span role="status" className="text-xs text-[var(--text-secondary)]">{websiteStatus[build.status]||build.status}</span></div>
  <p className="mt-3 line-clamp-2 text-[var(--text-secondary)]">{build.prompt}</p>
  {build.error&&<p role="alert" className="mt-2 text-xs text-[var(--text-secondary)]">{build.error}</p>}
  <div className="mt-3 flex items-center gap-3">
   <Link href="/dashboard/storefront" className="rounded-full px-3 py-2 hover:bg-[var(--interactive-hover)] focus-visible:outline-2">查看网站</Link>
   {['generating','building'].includes(build.status)&&<button type="button" onClick={()=>onCancel(build.id,build.revision)} className="rounded-full px-3 py-2 hover:bg-[var(--interactive-hover)] focus-visible:outline-2">取消任务</button>}
  </div>
 </section>
}

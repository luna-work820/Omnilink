'use client'
import Link from 'next/link'
import {useEffect,useState} from 'react'
import {useWebsiteBuilder,websiteStatus} from './useWebsiteBuilder'
import {StarterWebsitePreview,type StarterWebsiteData} from './StarterWebsitePreview'

type Preview={buildId:string;refreshKey:number;url:string;expiresAt:string;products:{id:string;name:string}[]}
export function WebsiteDesign({starter=null,starterError=''}:{starter?:StarterWebsiteData|null;starterError?:string}){
 const {state,error,loading,needsLogin,command}=useWebsiteBuilder()
 const [version,setVersion]=useState(''),[device,setDevice]=useState<'desktop'|'mobile'>('desktop'),[page,setPage]=useState('/'),[previewResult,setPreview]=useState<Preview|null>(null),[previewFailure,setPreviewError]=useState<{buildId:string;refreshKey:number;message:string}|null>(null),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0),[actionError,setActionError]=useState('')
 const selected=version||state?.site?.draft_build_id||state?.site?.published_build_id||''
 const preview=previewResult?.buildId===selected&&previewResult.refreshKey===refresh?previewResult:null
 const previewError=previewFailure?.buildId===selected&&previewFailure.refreshKey===refresh?previewFailure.message:''
 const ready=state?.builds.filter(b=>b.status==='ready')??[]
 const latest=state?.builds[0]
 useEffect(()=>{
  if(!selected)return
  const controller=new AbortController()
  fetch('/api/site-builder/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({buildId:selected}),signal:controller.signal})
   .then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||'预览启动失败');return data})
   .then(data=>{if(!controller.signal.aborted)setPreview({...data,buildId:selected,refreshKey:refresh})})
   .catch(error=>{if(!controller.signal.aborted)setPreviewError({buildId:selected,refreshKey:refresh,message:error.message})})
  return()=>controller.abort()
 },[selected,refresh])
 async function action(kind:'publish'|'rollback'|'unpublish'){
  setBusy(true);setActionError('')
  try{await command(kind==='unpublish'?{action:kind}:{action:kind,buildId:selected})}catch(error){setActionError(error instanceof Error?error.message:'操作失败')}finally{setBusy(false)}
 }
 let previewUrl=''
 if(preview){const url=new URL(preview.url);url.pathname=page;previewUrl=url.href}
 const hasRelease=state?.releases.some(r=>r.build_id===selected)
 const button='min-h-10 rounded-full px-4 text-sm hover:bg-[var(--interactive-hover)] disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2'
 return <section className="flex min-h-full flex-col gap-5 px-4 py-6 sm:px-6">
  <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-semibold">网站设计</h1><Link href="/dashboard?website=1" className={button+' inline-flex items-center bg-[var(--text-primary)] text-[var(--surface)]'}>修改</Link></header>
  {error&&<p role="alert" className="text-sm text-[var(--text-secondary)]">{error}</p>}
  {needsLogin&&<Link href="/login?next=%2Fdashboard" className={button+' w-fit'}>登录商家账号</Link>}
  {latest&&<div role="status" className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-secondary)]"><span>{websiteStatus[latest.status]||latest.status}</span>{latest.error&&<span>{latest.error}</span>}</div>}
  <div data-glasswork="" data-glasswork-radius="20" data-glasswork-rim="12" className="relative flex flex-wrap items-center gap-2 rounded-[20px] p-2">
   <select aria-label="预览页面" value={page} onChange={e=>setPage(e.target.value)} className={button+' bg-transparent'}><option value="/">首页</option><option value="/products">商品列表</option>{(selected?preview?.products:starter?.products)?.map(p=><option key={p.id} value={'/products/'+encodeURIComponent(p.id)}>{p.name}</option>)}</select>
   {ready.length>0?<select aria-label="预览版本" value={selected} onChange={e=>{setVersion(e.target.value);setPage('/')}} className={button+' max-w-56 bg-transparent'}>{ready.map((b,i)=><option key={b.id} value={b.id}>{b.id===state?.site?.published_build_id?'线上版本':b.id===state?.site?.draft_build_id?'当前草稿':`历史版本 ${ready.length-i}`}</option>)}</select>:<span className="px-4 text-sm text-[var(--text-secondary)]">初始模板</span>}
   <button type="button" aria-pressed={device==='desktop'} onClick={()=>setDevice('desktop')} className={button}>桌面</button><button type="button" aria-pressed={device==='mobile'} onClick={()=>setDevice('mobile')} className={button}>手机</button>
   {selected&&<button type="button" onClick={()=>setRefresh(n=>n+1)} className={button}>刷新预览</button>}
   {ready.length>0&&
   <button type="button" disabled={busy||!state?.canPublish} onClick={()=>void action(hasRelease&&selected!==state?.site?.draft_build_id?'rollback':'publish')} className={button+' ml-auto bg-[var(--text-primary)] text-[var(--surface)] hover:opacity-90'}>{busy?'处理中…':hasRelease&&selected!==state?.site?.draft_build_id?'回滚到此版本':'发布'}</button>}
  </div>
  {actionError&&<p role="alert" className="text-sm text-[var(--text-secondary)]">{actionError}</p>}
  {ready.length>0&&!state?.canPublish&&<p className="text-xs text-[var(--text-secondary)]">正式发布尚未配置</p>}
  <div className="relative flex min-h-[560px] flex-1 items-start justify-center overflow-auto rounded-xl border-[0.5px] border-[var(--border-subtle)]">
   {!selected?<div className="min-h-[560px] shrink-0" style={{width:device==='mobile'?'min(375px, 100%)':'100%'}}><StarterWebsitePreview data={starter} error={starterError} page={page} onPageChange={setPage}/></div>:preview?<iframe title="网站预览" src={previewUrl} referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-popups" className="min-h-[650px] shrink-0 bg-white" style={{width:device==='mobile'?'min(375px, 100%)':'100%',border:0}}/>:<div className="m-auto p-8 text-center text-sm text-[var(--text-secondary)]"><p role="status">{loading?'正在读取网站':previewError||'正在启动网站预览'}</p>{previewError&&<button type="button" onClick={()=>setRefresh(n=>n+1)} className={button+' mt-4'}>重试预览</button>}</div>}
  </div>
  {state?.site?.published_build_id&&<footer className="flex flex-wrap items-center gap-3 text-sm">{state.publicUrl&&<Link href={state.publicUrl} target="_blank" rel="noopener noreferrer" className={button}>打开网站</Link>}<button type="button" disabled={busy} onClick={()=>void action('unpublish')} className={button}>取消发布</button></footer>}
 </section>
}

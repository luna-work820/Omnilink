'use client'

import {useEffect, useState} from 'react'
import {V3DashboardShell} from '@/components/dashboard/v3-UI/V3DashboardShell'
import {DashboardWorkspaceProvider} from '@/components/dashboard/DashboardWorkspaceProvider'
import {DEMO_PROFILE} from '@/lib/preview/demo-workspace'
import {CREATOR_PREVIEW_OWNER_KEY, ensureCreatorPreviewSample, previewPublicationId} from '@/lib/creator-preview-sample'
import {CreatorPublishingWorkspace} from './CreatorPublishingWorkspace'
import {CreatorContentManager} from './CreatorContentManager'

const profile={...DEMO_PROFILE,id:'local-preview-creator',name:'预览创作者'}
const capabilities={creator:true,merchant:false}

export function CreatorWorkbenchPreview({view='content',fromWorkbench=false,recordId}:{view?:'content'|'manage';fromWorkbench?:boolean;recordId?:string}){
 const [state,setState]=useState<'loading'|'ready'|'error'>('loading')
 const [attempt,setAttempt]=useState(0)
 const postId=previewPublicationId(recordId)
 useEffect(()=>{
  let active=true
  void ensureCreatorPreviewSample().then(()=>{if(active)setState('ready')}).catch(()=>{if(active)setState('error')})
  return ()=>{active=false}
 },[attempt])
 return <V3DashboardShell profile={profile} capabilities={capabilities} activePath={view==='manage'?'/dashboard/content/manage':'/dashboard/content'} demo>
  <DashboardWorkspaceProvider>
   {state==='loading'?<p role="status">正在读取本机内容…</p>:state==='error'?<p role="alert">本机内容读取失败。<button type="button" onClick={()=>{setState('loading');setAttempt(value=>value+1)}}>重试</button></p>:view==='manage'?<CreatorContentManager ownerKey={CREATOR_PREVIEW_OWNER_KEY} publishingHref="/creator?preview=1&view=content" previewMode/>:<CreatorPublishingWorkspace key={postId??'new'} draftKey={CREATOR_PREVIEW_OWNER_KEY} recordId={postId} managementHref="/creator?preview=1&view=manage" fromWorkbench={fromWorkbench} previewMode/>}
  </DashboardWorkspaceProvider>
 </V3DashboardShell>
}

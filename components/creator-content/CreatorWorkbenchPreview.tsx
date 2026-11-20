import {V3DashboardShell} from '@/components/dashboard/v3-UI/V3DashboardShell'
import {DashboardWorkspaceProvider} from '@/components/dashboard/DashboardWorkspaceProvider'
import {DEMO_PROFILE} from '@/lib/preview/demo-workspace'
import {CreatorPublishingWorkspace} from './CreatorPublishingWorkspace'
import {CreatorContentManager} from './CreatorContentManager'

const profile={...DEMO_PROFILE,id:'local-preview-creator',name:'预览创作者'}
const capabilities={creator:true,merchant:false}

export function CreatorWorkbenchPreview({view='content',fromWorkbench=false,recordId}:{view?:'content'|'manage';fromWorkbench?:boolean;recordId?:string}){
 return <V3DashboardShell profile={profile} capabilities={capabilities} activePath={view==='manage'?'/dashboard/content/manage':'/dashboard/content'} demo>
  <DashboardWorkspaceProvider>
   {view==='manage'?<CreatorContentManager ownerKey="omnilink-creator-preview-draft" publishingHref="/creator?preview=1&view=content" previewMode/>:<CreatorPublishingWorkspace key={recordId??'new'} draftKey="omnilink-creator-preview-draft" recordId={recordId} managementHref="/creator?preview=1&view=manage" fromWorkbench={fromWorkbench} previewMode/>}
  </DashboardWorkspaceProvider>
 </V3DashboardShell>
}

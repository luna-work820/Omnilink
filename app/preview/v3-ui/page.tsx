import { WorkbenchHome } from '@/components/dashboard/v3-UI/WorkbenchHome'
import { DashboardWorkspaceProvider } from '@/components/dashboard/DashboardWorkspaceProvider'
import { type Profile } from '@/components/dashboard/OmnilinkLayout'
import { V3DashboardShell } from '@/components/dashboard/v3-UI/V3DashboardShell'
import type { Database } from '@/lib/database.types'

const profile: Profile = {
  id: 'v3-preview-user',
  email: 'preview@omnilink.local',
  name: '演示用户',
  avatarUrl: null,
}

const merchantProject = {
  id: 'v3-preview-project',
  user_id: profile.id,
  name: 'Omnilink 演示商家',
  concept: '商品、素材与知识库正在连接到经营场景。',
  category: '独立设计商家',
  logo_url: null,
  style: 'merchant-workspace',
  status: 'active',
  selected_template: 'merchant-workspace',
  palette: [],
  analysis: {},
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
} satisfies Database['public']['Tables']['brand_projects']['Row']

export default async function V3UIPreviewPage({ searchParams }: { searchParams: Promise<{ capability?: string }> }) {
  const { capability } = await searchParams
  const capabilities = { creator: capability === 'creator' || capability === 'both', merchant: capability !== 'creator' }
  const demoProfile = { ...profile, name: capability === 'creator' ? '演示创作者' : capability === 'both' ? '演示用户' : '演示商家' }
  return (
    <V3DashboardShell profile={demoProfile} capabilities={capabilities} demo>
      <DashboardWorkspaceProvider>
        <WorkbenchHome displayName={demoProfile.name} merchantProject={merchantProject} capabilities={capabilities} />
      </DashboardWorkspaceProvider>
    </V3DashboardShell>
  )
}

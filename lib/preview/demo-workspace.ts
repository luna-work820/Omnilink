import type { Database } from '@/lib/database.types'

export const DEMO_PROFILE = {
  id: 'local-preview-user',
  email: 'preview@omnilink.local',
  name: '演示商家',
  avatarUrl: null,
}

export const DEMO_BRAND_PROJECT = {
  id: 'local-preview-project',
  user_id: DEMO_PROFILE.id,
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

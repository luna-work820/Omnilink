import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`redirect:${url}`) }),
}))

vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('@/lib/supabase/server', () => ({ createClientServer: vi.fn().mockResolvedValue({ auth: { getUser: mocks.getUser } }) }))
vi.mock('@/components/creator-content/CreatorPublishingWorkspace', () => ({ CreatorPublishingWorkspace: () => null }))
vi.mock('@/components/creator-content/CreatorContentManager', () => ({ CreatorContentManager: () => null }))
vi.mock('@/components/creator-content/CreatorContentWorkspace', () => ({ CreatorContentWorkspace: () => null }))

import ContentPage from '@/app/dashboard/content/page'
import ContentManagementPage from '@/app/dashboard/content/manage/page'
import { CreatorPublishingWorkspace } from '@/components/creator-content/CreatorPublishingWorkspace'

const post = '03b3daa1-c7e5-4e3a-b02b-6df83a5036e8'

describe('creator editing entry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getUser.mockResolvedValue({ data: { user: null } })
  })

  it('keeps the online article when an unauthenticated creator signs in', async () => {
    const destination = `/dashboard/content?post=${post}`
    await expect(ContentPage({ searchParams: Promise.resolve({ post }) }))
      .rejects.toThrow(`redirect:/login?next=${encodeURIComponent(destination)}`)
  })

  it('keeps the management destination instead of opening local preview', async () => {
    const destination = `/dashboard/content/manage?edit=${post}`
    await expect(ContentManagementPage({ searchParams: Promise.resolve({ edit: post }) }))
      .rejects.toThrow(`redirect:/login?next=${encodeURIComponent(destination)}`)
  })

  it('passes the same article id into the signed-in editor', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'creator', app_metadata: { creator_enabled: true } } } })
    const page = await ContentPage({ searchParams: Promise.resolve({ post }) })
    expect(page.type).toBe(CreatorPublishingWorkspace)
    expect(page.props.recordId).toBe(post)
    expect(page.props.previewMode).not.toBe(true)
  })
})

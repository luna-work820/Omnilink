import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({auth:vi.fn(),from:vi.fn(),service:vi.fn(),sign:vi.fn()}))
vi.mock('@/lib/api/request-user', () => ({resolveRequestUser:m.auth}))
vi.mock('@/lib/supabase/service-role', () => ({createServiceRoleClient:m.service}))
import { GET } from './route'
const org = '10000000-0000-4000-8000-000000000001'
const path = [org,'20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001.mp4']
const request = new NextRequest('http://localhost/api/creator-posts/media/'+path.join('/'))
const context = {params:Promise.resolve({path})}
function query(data:unknown[],error:unknown = null) {
  const chain = {select:vi.fn(),eq:vi.fn(),contains:vi.fn(),in:vi.fn(),limit:vi.fn().mockResolvedValue({data,error})}
  for (const key of ['select','eq','contains','in'] as const) chain[key].mockReturnValue(chain)
  return chain
}
beforeEach(() => {
  vi.clearAllMocks()
  m.auth.mockResolvedValue({ok:true,user:null,supabase:{from:m.from}})
  m.from.mockImplementation(() => query([]))
  m.sign.mockResolvedValue({data:{signedUrl:'https://example.supabase.co/storage/v1/object/sign/test.mp4?token=test'},error:null})
  m.service.mockReturnValue({storage:{from:() => ({createSignedUrl:m.sign})}})
})
describe('private creator video playback', () => {
  it('never signs a guessed unpublished object path for guests',async () => {
    expect((await GET(request,context)).status).toBe(404)
    expect(m.service).not.toHaveBeenCalled()
  })
  it('signs only a published reference, briefly and without shared caching',async () => {
    m.from.mockImplementation(() => query([{id:'published-post'}]))
    const response = await GET(request,context)
    expect(response.status).toBe(307)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(m.sign).toHaveBeenCalledWith(path.join('/'),60)
  })
  it('allows editors to preview private uploads and denies unrelated users',async () => {
    m.auth.mockResolvedValue({ok:true,user:{id:'editor'},supabase:{from:m.from}})
    m.from.mockImplementation((table) => query(table === 'organization_members' ? [{organization_id:org}] : []))
    expect((await GET(request,context)).status).toBe(307)
    m.from.mockImplementation(() => query([])); m.service.mockClear()
    expect((await GET(request,context)).status).toBe(404)
    expect(m.service).not.toHaveBeenCalled()
  })
  it('does not misreport a failed permissions query as missing content',async () => {
    m.from.mockImplementation(() => query([],{message:'upstream'}))
    expect((await GET(request,context)).status).toBe(503)
    expect(m.service).not.toHaveBeenCalled()
  })
  it('rejects traversal before reaching data or storage',async () => {
    expect((await GET(request,{params:Promise.resolve({path:['..',...path]})})).status).toBe(404)
    expect(m.auth).not.toHaveBeenCalled(); expect(m.service).not.toHaveBeenCalled()
  })
})

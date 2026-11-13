import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({auth:vi.fn(),store:vi.fn(),sign:vi.fn(),service:vi.fn()}))
vi.mock('@/lib/api/auth', () => ({requireUser:m.auth,getOwnedStore:m.store}))
vi.mock('@/lib/supabase/service-role', () => ({createServiceRoleClient:m.service}))
import { POST } from './route'
const org = '10000000-0000-4000-8000-000000000001'
const user = '20000000-0000-4000-8000-000000000001'
beforeEach(() => {
  vi.clearAllMocks()
  const storeQuery = {select:vi.fn(),eq:vi.fn(),maybeSingle:vi.fn().mockResolvedValue({data:{organization_id:org},error:null})}
  storeQuery.select.mockReturnValue(storeQuery); storeQuery.eq.mockReturnValue(storeQuery)
  m.auth.mockResolvedValue({ok:true,user:{id:user},supabase:{from:() => storeQuery}})
  m.store.mockResolvedValue({id:'store'})
  m.sign.mockImplementation(async (path:string) => ({data:{path,token:'upload-token'},error:null}))
  m.service.mockReturnValue({storage:{from:() => ({createSignedUploadUrl:m.sign})}})
})
describe('private creator video uploads', () => {
  it('issues a scoped upload ticket and a stable authorized playback URL',async () => {
    const response = await POST(new NextRequest('http://localhost/api/creator-posts/media', {method:'POST',body:JSON.stringify({contentType:'video/mp4',organizationId:'forged',path:'forged'})}))
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.path).toMatch(new RegExp(`^${org}/${user}/[0-9a-f-]{36}\\.mp4$`))
    expect(body.url).toBe('/api/creator-posts/media/'+body.path)
    expect(body).not.toHaveProperty('publicUrl')
    expect(m.sign).toHaveBeenCalledWith(body.path,{upsert:false})
  })
})

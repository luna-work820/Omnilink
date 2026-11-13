import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), createClient: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClientServer: mocks.createClient }))
import { resolveRequestUser } from './request-user'
import { requireUser } from './auth'

beforeEach(() => {
  vi.resetAllMocks()
  mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser } })
  mocks.getUser.mockResolvedValue({ data:{user:null},error:null })
})
describe('verified request identity', () => {
  it('recognizes a missing session without treating upstream errors as guests', async () => {
    mocks.getUser.mockResolvedValue({data:{user:null},error:{name:'AuthSessionMissingError',status:400}})
    expect(await resolveRequestUser(new Request('http://localhost'))).toMatchObject({ok:true,user:null})
    const required = await requireUser()
    expect(required.ok).toBe(false)
    if (!required.ok) expect(required.response.status).toBe(401)
  })
  it.each([
    [{name:'AuthApiError',code:'bad_jwt',status:401},401,'INVALID_SESSION'],
    [{name:'AuthRetryableFetchError',status:503},503,'AUTH_UNAVAILABLE'],
    [{name:'AuthApiError',status:429},503,'AUTH_UNAVAILABLE'],
    [{name:'UnexpectedError'},503,'AUTH_UNAVAILABLE'],
  ])('handles %j with a closed authorization boundary', async (error,status,code) => {
    mocks.getUser.mockResolvedValue({data:{user:{id:'unverified'}},error})
    const auth = await resolveRequestUser()
    expect(auth.ok).toBe(false)
    if (!auth.ok) {
      expect(auth.response.status).toBe(status)
      expect(await auth.response.json()).toMatchObject({code})
    }
  })
  it('rejects a broken cookie instead of silently using guest credentials', async () => {
    mocks.getUser.mockResolvedValue({data:{user:null},error:{name:'AuthSessionMissingError',status:400}})
    const auth = await resolveRequestUser(new Request('http://localhost',{headers:{cookie:'sb-project-auth-token.0=broken'}}))
    expect(auth.ok).toBe(false)
    if (!auth.ok) expect(auth.response.status).toBe(401)
  })
  it('verifies bearer tokens and never accepts malformed authorization', async () => {
    mocks.getUser.mockResolvedValue({data:{user:{id:'verified'}},error:null})
    expect(await resolveRequestUser(new Request('http://localhost',{headers:{authorization:'Bearer valid-test-token'}}))).toMatchObject({ok:true,user:{id:'verified'}})
    expect(mocks.getUser).toHaveBeenCalledWith('valid-test-token')
    mocks.getUser.mockClear()
    const auth = await resolveRequestUser(new Request('http://localhost',{headers:{authorization:'Basic invalid'}}))
    expect(auth.ok).toBe(false)
    expect(mocks.getUser).not.toHaveBeenCalled()
  })
  it('distinguishes configuration failure and connection failure from signed-out state', async () => {
    mocks.createClient.mockRejectedValueOnce(new Error('secret config'))
    const config = await requireUser()
    if (!config.ok) {
      expect(config.response.status).toBe(500)
      expect(await config.response.text()).not.toContain('secret config')
    } else throw new Error('Expected failure')
    mocks.getUser.mockRejectedValueOnce(new Error('private upstream detail'))
    const network = await resolveRequestUser()
    if (!network.ok) {
      expect(network.response.status).toBe(503)
      expect(await network.response.text()).not.toContain('private upstream detail')
    } else throw new Error('Expected failure')
  })
})

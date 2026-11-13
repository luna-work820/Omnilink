import { NextRequest,NextResponse } from 'next/server'
import { beforeEach,describe,expect,it,vi } from 'vitest'
vi.mock('server-only',()=>({}))
const m=vi.hoisted(()=>({auth:vi.fn(),create:vi.fn(),advance:vi.fn(),store:vi.fn()}))
vi.mock('@/lib/api/request-user',()=>({resolveRequestUser:m.auth}))
vi.mock('@/lib/consumer-advisor/discovery-engine',()=>({discoveryActor:(_r:unknown,userId:string|null,sessionId:string)=>({userId,sessionId,guestHash:null}),attachDiscoveryActor:(r:Response)=>r}))
vi.mock('@/lib/consumer-advisor/comparison-workflow',()=>({createComparisonTask:m.create,advanceComparisonTask:m.advance,readComparisonTask:m.store}))
vi.mock('@/lib/consumer-advisor/execution-store',()=>({taskStore:m.store,taskView:(x:unknown)=>x}))
import { POST } from './route'
import { DiscoveryError } from '@/lib/consumer-advisor/discovery-contract'
const userId=crypto.randomUUID(),sessionId=crypto.randomUUID(),id=crypto.randomUUID()
const request=(body:unknown)=>new NextRequest('http://localhost/api/consumer/tasks',{method:'POST',body:JSON.stringify(body)})
beforeEach(()=>{vi.clearAllMocks();m.auth.mockResolvedValue({ok:true,user:{id:userId},supabase:{}});m.advance.mockResolvedValue({id,status:'paused'});m.create.mockResolvedValue({id,status:'pending'})})
describe('task API boundaries',()=>{
  it('continues only with the server-verified actor and validated session',async()=>{
    expect((await POST(request({action:'continue',id,sessionId,userId:crypto.randomUUID()}))).status).toBe(200)
    expect(m.advance).toHaveBeenCalledWith(expect.objectContaining({userId,sessionId}),id,expect.any(AbortSignal))
  })
  it('stops before tools when authentication or transport validation fails',async()=>{
    m.auth.mockResolvedValueOnce({ok:false,response:NextResponse.json({error:'认证失败'},{status:503})})
    expect((await POST(request({action:'continue',id,sessionId}))).status).toBe(503)
    expect((await POST(request({action:'create',input:{urls:['https://example.com']},sessionId:'invalid'}))).status).toBe(400)
    expect(m.advance).not.toHaveBeenCalled();expect(m.create).not.toHaveBeenCalled()
  })
  it('preserves not-found and cancellation conflicts instead of silently creating a new task',async()=>{
    m.advance.mockRejectedValue(new DiscoveryError('NOT_FOUND',404,'找不到任务。'))
    expect((await POST(request({action:'continue',id,sessionId}))).status).toBe(404)
    expect(m.create).not.toHaveBeenCalled()
  })
  it('does not accept arbitrary tools, payments or network actions',async()=>{
    expect((await POST(request({action:'executeTool',tool:'pay',sessionId}))).status).toBe(400)
    expect(m.create).not.toHaveBeenCalled();expect(m.advance).not.toHaveBeenCalled()
  })
})

import { NextRequest,NextResponse } from 'next/server'
import { beforeEach,describe,expect,it,vi } from 'vitest'
const m=vi.hoisted(()=>({auth:vi.fn(),start:vi.fn(),page:vi.fn(),resume:vi.fn(),owned:vi.fn(),manage:vi.fn(),generate:vi.fn()}))
vi.mock('@/lib/api/request-user',()=>({resolveRequestUser:m.auth}))
vi.mock('@/lib/consumer-advisor/discovery-engine',()=>({startDiscovery:m.start,continueDiscovery:m.page,resumeDiscovery:m.resume,ownedDiscoveryRun:m.owned,
  discoveryActor:(_r:unknown,userId:string|null,sessionId:string)=>({userId,sessionId,guestHash:userId?null:'verified-cookie-hash'}),
  attachDiscoveryActor:(r:Response)=>r}))
vi.mock('@/lib/consumer-advisor/ai-assistant-memory',()=>({manageAiAssistantMemory:m.manage}))
vi.mock('@/lib/ai/workspace-generation',()=>({generateWorkspaceText:m.generate}))
import { POST } from './route'
import { DiscoveryError,discoverySpecSchema } from '@/lib/consumer-advisor/discovery-contract'
const sessionId=crypto.randomUUID(),userId=crypto.randomUUID(),runId=crypto.randomUUID()
const spec=discoverySpecSchema.parse({query:'沙发',termGroups:[['沙发']]})
const page={searchRunId:runId,sessionId,query:'沙发',products:[],nextCursor:null,contextVersion:2,snapshotVersion:1,pageSize:20,returnedCount:0,candidateCount:0,question:null,spec}
const request=(body:unknown)=>new NextRequest('http://localhost/api/consumer/discovery',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
beforeEach(()=>{
  vi.clearAllMocks()
  m.auth.mockResolvedValue({ok:true,user:{id:userId},supabase:{}})
  m.start.mockResolvedValue(page);m.page.mockResolvedValue(page);m.resume.mockResolvedValue(page)
  m.owned.mockResolvedValue({id:runId,spec})
  m.manage.mockResolvedValue({status:'proposed'})
})
describe('discovery API',()=>{
  it('continues an owned session using a signed cursor with zero model calls',async()=>{
    const response=await POST(request({action:'page',searchRunId:runId,cursor:'signed-cursor',sessionId,userId:crypto.randomUUID()}))
    expect(response.status).toBe(200)
    expect(m.page).toHaveBeenCalledWith(expect.objectContaining({userId,sessionId}),'signed-cursor',runId)
    expect(m.start).not.toHaveBeenCalled();expect(m.generate).not.toHaveBeenCalled()
  })
  it('stops at authentication failures and malformed session IDs',async()=>{
    m.auth.mockResolvedValueOnce({ok:false,response:NextResponse.json({error:'认证暂时不可用。'},{status:503})})
    expect((await POST(request({action:'page',sessionId,searchRunId:runId,cursor:'a'}))).status).toBe(503)
    expect((await POST(request({action:'start',spec,sessionId:'broken'}))).status).toBe(400)
    expect(m.start).not.toHaveBeenCalled();expect(m.page).not.toHaveBeenCalled()
  })
  it('refreshes a previous specification without reclassifying and ignores body ownership claims',async()=>{
    expect((await POST(request({action:'start',spec,sessionId,userId:crypto.randomUUID()}))).status).toBe(200)
    expect(m.start).toHaveBeenCalledWith(expect.objectContaining({userId}),spec)
    expect(m.generate).not.toHaveBeenCalled()
  })
  it('does not collapse stale contexts or database failures into successful no-matches',async()=>{
    m.page.mockRejectedValueOnce(new DiscoveryError('CONTEXT_CHANGED',409,'偏好已更新，请刷新结果。'))
    const response=await POST(request({action:'page',searchRunId:runId,cursor:'a',sessionId}))
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({status:'failed',code:'CONTEXT_CHANGED',blocks:[]})
  })
  it('treats a refinement as a session preference and creates only a pending long-term proposal',async()=>{
    expect((await POST(request({action:'refine',questionId:'style',answer:'natural',searchRunId:runId,sessionId}))).status).toBe(200)
    expect(m.start).toHaveBeenCalledWith(expect.objectContaining({userId}),expect.objectContaining({termGroups:spec.termGroups,sessionTerms:['原木','木质','natural','wood']}))
    expect(m.manage).toHaveBeenCalledWith(userId,'propose',expect.objectContaining({sourceKind:'assessment',origin:'user'}))
    expect(m.generate).not.toHaveBeenCalled()
  })
})

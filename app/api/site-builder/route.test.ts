import {beforeEach,describe,it,expect,vi} from 'vitest'
const m=vi.hoisted(()=>({auth:vi.fn(),state:vi.fn(),command:vi.fn(),execute:vi.fn(),verify:vi.fn(),key:vi.fn(),sandbox:vi.fn(),after:vi.fn()}))
vi.mock('next/server',()=>({after:m.after}))
vi.mock('@/lib/site-builder/auth',()=>({websiteAuth:m.auth,websiteFailure:()=>Response.json({error:'服务暂不可用'},{status:503})}))
vi.mock('@/lib/site-builder/service',()=>({readWebsiteState:m.state,websiteCommand:m.command,executeWebsiteBuild:m.execute,verifyPublicDataConnection:m.verify}))
vi.mock('@/lib/consumer-advisor/deepseek-key-cookie',()=>({readDeepSeekKeyForUser:m.key}))
vi.mock('@/lib/site-builder/runtime',()=>({sandboxConfigured:m.sandbox}))
import {GET,POST} from './route'
const requestId='10000000-0000-4000-8000-000000000001'
const body={action:'generate',prompt:'创建网站',requestId,baseBuildId:null}
const post=(data:unknown,origin?:string)=>POST(new Request('https://app.example/api/site-builder',{method:'POST',headers:{'content-type':'application/json',...(origin?{origin}:{})},body:JSON.stringify(data)}))
beforeEach(()=>{vi.resetAllMocks();m.auth.mockResolvedValue({ok:true,user:{id:'user'},store:{id:'store'}});m.key.mockResolvedValue('private-provider-key');m.sandbox.mockReturnValue(true);m.command.mockResolvedValue({id:'build',status:'generating',existing:false})})
describe('website tasks HTTP boundary',()=>{
 it('denies cross-origin mutation before authentication or reservation',async()=>{
  expect((await post(body,'https://other.example')).status).toBe(403);expect(m.auth).not.toHaveBeenCalled();expect(m.command).not.toHaveBeenCalled()
 })
 it('requires merchant authentication for reads and writes',async()=>{
  m.auth.mockResolvedValue({ok:false,response:Response.json({error:'登录'},{status:401})})
  expect((await GET()).status).toBe(401);expect((await post(body)).status).toBe(401);expect(m.command).not.toHaveBeenCalled()
 })
 it.each([{...body,command:'npm install malicious'}, {...body,prompt:'网站是什么'}, {...body,baseBuildId:'other-store-id'}])('rejects malformed or informational commands',async data=>{
  expect((await post(data)).status).toBe(400);expect(m.command).not.toHaveBeenCalled()
 })
 it('does not reserve a task without provider and sandbox configuration',async()=>{
  m.key.mockResolvedValue(null);expect((await post(body)).status).toBe(400);expect(m.command).not.toHaveBeenCalled()
  m.key.mockResolvedValue('private-provider-key');m.sandbox.mockReturnValue(false);expect((await post(body)).status).toBe(503);expect(m.command).not.toHaveBeenCalled()
 })
 it('persists one job then schedules generation without returning the key',async()=>{
  const response=await post(body);expect(response.status).toBe(202);expect(await response.json()).toEqual({buildId:'build',status:'generating'})
  expect(m.command).toHaveBeenCalledWith('user','store','start',body);expect(m.after).toHaveBeenCalledTimes(1)
  await m.after.mock.calls[0][0]();expect(m.execute).toHaveBeenCalledWith({userId:'user',storeId:'store',buildId:'build',prompt:body.prompt,apiKey:'private-provider-key'})
 })
 it('repeated request does not schedule another build',async()=>{
  m.command.mockResolvedValue({id:'build',status:'generating',existing:true});expect((await post(body)).status).toBe(202);expect(m.after).not.toHaveBeenCalled()
 })
 it('does not return internal provider/database errors',async()=>{
  m.command.mockRejectedValue(Error('secret-token'));const response=await post(body);expect(response.status).toBe(503);expect(await response.text()).not.toContain('secret-token')
 })
})

import assert from 'node:assert/strict'
import { execFileSync,spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { mkdir,writeFile } from 'node:fs/promises'
import { once } from 'node:events'

// Only the model transport is a fixture. Requests, tasks and sources use the linked development database.
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE??new URL('../package.json',import.meta.url))
const {chromium}=require('playwright')
const output=process.env.BROWSER_TEST_OUTPUT??'/private/tmp/omnilink-stage45-browser'
await mkdir(output,{recursive:true})
const checks=[],calls=[],measurements={},browserErrors=[],serverLogs=[]
const provider=createServer(async(req,res)=>{
  const chunks=[];for await(const chunk of req)chunks.push(chunk)
  const body=JSON.parse(Buffer.concat(chunks).toString()),classification=body.messages?.[0]?.content?.startsWith('Classify an Omnilink request.')
  const payload=JSON.parse(body.messages.at(-1).content)
  calls.push({classification,stream:body.stream===true,question:payload.input??payload.question,sourceCount:payload.sourceEvidence?.length??0})
  if(classification){
    const info=payload.input.includes('检索资料'),sources=payload.input.includes('资料回答')
    const search=info?{query:'Example',termGroups:[['Example']],excludedTerms:[],minPrice:null,maxPrice:null,currency:'CNY',type:'数字',sessionTerms:[],questionDismissed:false}:null
    res.setHeader('Content-Type','application/json')
    res.end(JSON.stringify({choices:[{message:{content:JSON.stringify({intent:info?'information-search':'assistant',search,needsPersonalContext:false,needsSourceContext:sources})}}],usage:{prompt_tokens:20,completion_tokens:10}}));return
  }
  assert.equal(body.stream,true)
  res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store'})
  const stopping=payload.question.includes('测试停止')
  const text=payload.sourceEvidence?.length?['已读取资料：','Example Domain。','[来源](https://example.com/)']:['流式验证：','第一段中文。','第二段中文。','回答完成。']
  let index=0
  const write=()=>{
    if(index<text.length){res.write(`data: ${JSON.stringify({choices:[{delta:{content:text[index++]}}]})}\n\n`)}
    else{res.write(`data: ${JSON.stringify({choices:[],usage:{prompt_tokens:40,completion_tokens:16,prompt_tokens_details:{cached_tokens:0}}})}\n\ndata: [DONE]\n\n`);res.end();clearInterval(timer)}
  }
  write();const timer=setInterval(write,stopping?1500:500)
  res.on('close',()=>clearInterval(timer))
})
provider.listen(0,'127.0.0.1');await once(provider,'listening')
const env={...process.env,DASHSCOPE_API_KEY:'isolated-browser-fixture',DASHSCOPE_BASE_URL:`http://127.0.0.1:${provider.address().port}/v1`}
if(process.platform==='darwin'&&!env.HTTPS_PROXY&&!env.https_proxy){
  try{
    const settings=execFileSync('scutil',['--proxy'],{encoding:'utf8'})
    const read=(key)=>settings.match(new RegExp(`^\\s*${key}\\s*:\\s*(.+)$`,'m'))?.[1]?.trim()
    if(read('HTTPSEnable')==='1'&&read('HTTPSProxy')&&read('HTTPSPort'))env.HTTPS_PROXY=`http://${read('HTTPSProxy')}:${read('HTTPSPort')}`
  }catch{}
}
if(env.HTTPS_PROXY||env.https_proxy){env.HTTP_PROXY??=env.HTTPS_PROXY??env.https_proxy;env.NODE_USE_ENV_PROXY='1'}
env.NO_PROXY='localhost,127.0.0.1,::1'
const base='http://localhost:3001'
const projectRequire=createRequire(new URL('../package.json',import.meta.url))
function startNext(){
  const child=spawn(process.execPath,[projectRequire.resolve('next/dist/bin/next'),'start','-p','3001','-H','127.0.0.1'],{env,stdio:['ignore','pipe','pipe']})
  for(const stream of [child.stdout,child.stderr])stream.on('data',(chunk)=>serverLogs.push(chunk.toString()))
  return child
}
let next=startNext()
let browser,context,page,taskId,sessionId
async function ready(){
  for(let n=0;n<60;n++){
    if(next.exitCode!==null)throw new Error('Isolated Next server exited')
    try{if((await fetch(`${base}/api/consumer/information`)).status===400)return}catch{}
    await new Promise((resolve)=>setTimeout(resolve,500))
  }
  throw new Error('Isolated Next server did not start')
}
async function check(name,action){await action();checks.push(name);console.log(`PASS ${name}`)}
async function submit(text){await page.getByRole('textbox',{name:'搜索或询问 AI assistant',exact:true}).fill(text);await page.getByRole('button',{name:'发送',exact:true}).click()}
async function api(body){const response=await context.request.post(`${base}/api/consumer/tasks`,{data:body});return{status:response.status(),body:await response.json()}}
async function waitUntil(fn,timeout=25_000){const start=Date.now();while(Date.now()-start<timeout){if(await fn())return;await new Promise((r)=>setTimeout(r,200))}throw new Error('Timed out waiting for a state change')}
try{
  await ready()
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'})
  context=await browser.newContext({viewport:{width:1160,height:734},reducedMotion:'reduce'})
  page=await context.newPage();page.on('pageerror',(error)=>browserErrors.push(error.message))
  await page.goto(`${base}/discover`,{waitUntil:'networkidle'})
  let streamBody
  page.on('request',(request)=>{if(request.url().endsWith('/api/consumer/assistant'))streamBody=request.postDataJSON()})
  await check('real gateway streams partial text before the final response',async()=>{
    const started=Date.now()
    await submit('请进行流式验证')
    await waitUntil(()=>page.getByText('流式验证：',{exact:false}).first().isVisible())
    measurements.fixtureFirstVisibleMs=Date.now()-started
    assert.equal(await page.getByRole('button',{name:'停止回答',exact:true}).count(),1)
    await waitUntil(()=>page.getByRole('button',{name:'停止回答',exact:true}).count().then((n)=>n===0))
    measurements.fixtureCompletedMs=Date.now()-started
    assert.equal(calls.length,2)
    await page.screenshot({path:`${output}/stream-completed.png`})
  })
  await check('replaying the same request returns the stored response without another model call',async()=>{
    const before=calls.length,response=await context.request.post(`${base}/api/consumer/assistant`,{data:streamBody})
    assert.equal(response.status(),200);const result=await response.json()
    assert.equal(result.replayed,true);assert.equal(result.metrics.modelCalls,0);assert.equal(calls.length,before)
    measurements.streamMetrics=result.metrics
  })
  await check('stop preserves partial text and the same request never restarts generation',async()=>{
    await submit('测试停止')
    await waitUntil(()=>calls.filter((c)=>c.stream).length===2)
    await new Promise((r)=>setTimeout(r,250))
    const body=streamBody;sessionId=body.conversationId
    await page.getByRole('button',{name:'停止回答',exact:true}).click()
    const before=calls.length
    await new Promise((r)=>setTimeout(r,500))
    const response=await context.request.post(`${base}/api/consumer/assistant`,{data:body}),result=await response.json()
    assert.ok([409,499].includes(response.status()),JSON.stringify(result))
    if(response.status()===499)assert.equal(result.status,'cancelled')
    assert.equal(calls.length,before);measurements.cancelReplayStatus=response.status()
    await page.screenshot({path:`${output}/stream-stopped.png`})
  })
  await check('the attachment menu creates a genuine private URL task without model calls',async()=>{
    const before=calls.length
    await page.getByRole('button',{name:'添加附件',exact:true}).click()
    await page.getByRole('button',{name:'网址',exact:true}).click()
    await page.getByRole('textbox',{name:'网址',exact:true}).fill('https://example.com/')
    await page.getByRole('button',{name:'添加网址',exact:true}).click()
    const created=page.waitForResponse((r)=>r.url().endsWith('/api/consumer/tasks')&&r.request().postDataJSON().action==='create')
    await page.getByRole('button',{name:'发送',exact:true}).click()
    const response=await created;assert.equal(response.status(),200)
    const data=await response.json();taskId=data.task.id;sessionId=data.sessionId
    await page.getByRole('region',{name:'对比任务',exact:true}).waitFor({state:'visible'})
    assert.equal(calls.length,before)
  })
  await check('a server restart recovers saved Mastra checkpoints and reads the public webpage',async()=>{
    await page.close();page=await context.newPage();page.on('pageerror',(error)=>browserErrors.push(error.message))
    const prepared=await api({action:'continue',sessionId,id:taskId})
    assert.equal(prepared.body.task.status,'paused');assert.ok(prepared.body.task.completedSteps.length>=1)
    const saved=prepared.body.task.completedSteps
    next.kill('SIGTERM');await once(next,'exit');next=startNext();await ready()
    const restored=await api({action:'get',sessionId,id:taskId})
    assert.deepEqual(restored.body.task.completedSteps,saved)
    measurements.restartedAfterSteps=saved
    const started=Date.now(),revisions=[]
    for(let i=0;i<12;i++){
      const response=await api({action:'continue',sessionId,id:taskId});assert.equal(response.status,200)
      const task=response.body.task;revisions.push({revision:task.revision,status:task.status,steps:task.completedSteps})
      if(task.status==='completed'){assert.equal(task.completedSteps.length,4);assert.equal(task.attempt,1);assert.equal(task.result.sources[0].title,'Example Domain');break}
      assert.notEqual(task.status,'failed',task.error)
      await new Promise((r)=>setTimeout(r,500))
    }
    const result=await api({action:'get',sessionId,id:taskId});assert.equal(result.body.task.status,'completed')
    measurements.liveTaskMs=Date.now()-started;measurements.taskRevisions=revisions
  })
  await check('private information search is isolated by guest and session',async()=>{
    const response=await context.request.get(`${base}/api/consumer/information?sessionId=${sessionId}&query=Example`)
    const data=await response.json();assert.equal(response.status(),200);assert.equal(data.items.length,1)
    assert.equal(data.items[0].entityType,'source');assert.equal(data.items[0].title,'Example Domain')
    const other=await browser.newContext(),foreign=await other.request.post(`${base}/api/consumer/tasks`,{data:{action:'get',sessionId,id:taskId}})
    assert.equal(foreign.status(),404)
    const sources=await other.request.get(`${base}/api/consumer/information?sessionId=${sessionId}&query=Example`);assert.deepEqual((await sources.json()).items,[])
    assert.equal((await api({action:'get',sessionId:crypto.randomUUID(),id:taskId})).status,404)
    await other.close()
  })
  await check('cancellation fences later continuations',async()=>{
    const created=await api({action:'create',requestId:`browser_cancel_${crypto.randomUUID()}`,sessionId,input:{urls:['https://example.com/']}})
    assert.equal(created.status,200);const id=created.body.task.id
    assert.equal((await api({action:'cancel',sessionId,id})).body.task.status,'cancelled')
    assert.equal((await api({action:'continue',sessionId,id})).body.task.status,'cancelled')
    measurements.cancelledTaskId=id
  })
  await page.goto(`${base}/discover`,{waitUntil:'networkidle'})
  await check('a later question receives only the owned source excerpt',async()=>{
    const body={model:'qwen-plus',prompt:'根据资料回答这个网页的用途',requestId:`browser_sources_${crypto.randomUUID()}`,sessionId,previousTaskId:taskId}
    const response=await context.request.post(`${base}/api/consumer/assistant`,{data:body,headers:{Accept:'text/event-stream'}})
    assert.equal(response.status(),200);const content=await response.text()
    assert.ok(content.includes('已读取资料'));assert.equal(calls.at(-1).sourceCount,1)
  })
  await check('information results render and remain usable at 390px',async()=>{
    await submit('检索资料 Example')
    await page.locator('ul').getByRole('link',{name:'Example Domain',exact:true}).waitFor({state:'visible'})
    await page.screenshot({path:`${output}/information-desktop.png`})
    await page.setViewportSize({width:390,height:844})
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
    await page.screenshot({path:`${output}/information-mobile.png`})
  })
  assert.deepEqual(browserErrors,[])
}catch(error){if(page&&!page.isClosed())await page.screenshot({path:`${output}/failure.png`});throw error}
finally{
  await writeFile(`${output}/results.json`,JSON.stringify({checks,calls,measurements,browserErrors,taskId,sessionId,note:'Isolated production server, local model fixture, real development Supabase and public example.com. No paid inference or published fixture products.'},null,2))
  await writeFile(`${output}/server.log`,serverLogs.join(''))
  await browser?.close();next.kill('SIGTERM');provider.closeAllConnections();provider.close()
}

import assert from 'node:assert/strict'
import { mkdir,readFile,writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

const require=createRequire(process.env.PLAYWRIGHT_PACKAGE??new URL('../package.json',import.meta.url))
const {chromium}=require('playwright')
const base=process.env.BROWSER_TEST_URL??'http://127.0.0.1:3000'
const output=process.env.BROWSER_TEST_OUTPUT??'/private/tmp/omnilink-stage23-browser'
await mkdir(output,{recursive:true})
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'})
const checks=[],errors=[],calls=[]
const context=await browser.newContext({viewport:{width:1160,height:734},reducedMotion:'reduce'})
const page=await context.newPage()
page.on('pageerror',(error)=>errors.push(error.message))
const spec={query:'沙发',termGroups:[['沙发','sofa']],excludedTerms:[],minPrice:null,maxPrice:null,currency:'CNY',type:'商品',sessionTerms:[],questionDismissed:false}
const products=Array.from({length:45},(_,index)=>({id:`40000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`,
  name:`测试沙发 ${index+1}`,creator:'隔离测试店铺',storeName:'隔离测试店铺',storeSlug:'fixture',itemType:'product',price:100,currency:'CNY',priceMode:'amount',formattedPrice:'¥100',
  mainImage:'/consumer-market/img_mobile_table.jpg',aspectRatio:0.82,secondaryImages:[],category:'沙发',shortDescription:'测试夹具',aiSummary:'测试夹具',reviews:[],specs:{}}))
let session,run,failNext=false
const payload=(offset=0)=>{
  const items=products.slice(offset,offset+20)
  const discovery={searchRunId:run,sessionId:session,query:'沙发',products:items,nextCursor:offset+20<45?String(offset+20):null,
    contextVersion:0,snapshotVersion:1,pageSize:20,returnedCount:items.length,candidateCount:45,question:null,spec}
  return {text:`沙发，本页 ${items.length} 件。`,intent:'product-search',source:'discovery-engine',model:null,discovery,sessionId:session}
}
await page.route('**/api/consumer/assistant',async(route)=>{
  const body=route.request().postDataJSON();calls.push({endpoint:'assistant',prompt:body.prompt});session=body.conversationId;run=crypto.randomUUID()
  await route.fulfill({json:payload()})
})
await page.route('**/api/consumer/discovery',async(route)=>{
  const body=route.request().postDataJSON();calls.push({endpoint:'discovery',action:body.action,sessionId:body.sessionId})
  if(failNext){failNext=false;await route.fulfill({status:503,json:{code:'CATALOG_UNAVAILABLE',error:'商品暂时无法读取，请重试。'}});return}
  await route.fulfill({json:payload(body.action==='page'?Number(body.cursor):0)})
})
async function check(name,action){await action();checks.push(name);console.log(`PASS ${name}`)}
async function visible(locator){await locator.waitFor({state:'visible',timeout:15_000})}
async function countCards(count){await page.waitForFunction((n)=>document.querySelectorAll('#discovery-feed-panel [data-feed-key]').length===n,count)}
async function submit(text){await page.getByRole('textbox',{name:'搜索或询问 AI assistant',exact:true}).fill(text);await page.getByRole('button',{name:'发送',exact:true}).click()}
try{
  await page.goto(`${base}/discover?demoLogin=1`,{waitUntil:'networkidle'})
  await check('search renders the complete first page in the masonry',async()=>{
    await submit('沙发');await countCards(20);await visible(page.getByText('已加载 20 件',{exact:true}))
    assert.equal(calls.filter((c)=>c.endpoint==='assistant').length,1)
    await page.screenshot({path:`${output}/search-page-20.png`})
  })
  await check('scroll pagination appends 20 products with no additional assistant call',async()=>{
    await page.locator('.home-feed-scroller').evaluate((el)=>{el.scrollTop=el.scrollHeight})
    await countCards(40)
    assert.equal(calls.filter((c)=>c.endpoint==='assistant').length,1)
    const ids=await page.locator('#discovery-feed-panel [data-feed-key]').evaluateAll((nodes)=>nodes.map((node)=>node.dataset.feedKey))
    assert.equal(new Set(ids).size,40)
  })
  await check('a page failure preserves results and retry fills the final page',async()=>{
    failNext=true
    await page.locator('.home-feed-scroller').evaluate((el)=>{el.scrollTop=el.scrollHeight})
    await visible(page.getByRole('alert').filter({hasText:'商品暂时无法读取'}))
    assert.equal(await page.locator('#discovery-feed-panel [data-feed-key]').count(),40)
    await page.getByRole('button',{name:'重试',exact:true}).click();await countCards(45)
    await visible(page.getByText('已显示本次搜索结果',{exact:true}))
  })
  await check('a new conversation clears the previous discovery workspace',async()=>{
    await page.getByRole('button',{name:'发起新对话',exact:true}).click()
    assert.equal(await page.getByText('已加载 45 件',{exact:true}).count(),0)
  })
  await page.goto(`${base}/discover?demoLogin=1&memories=1`,{waitUntil:'networkidle'})
  await check('manual preference editing and forgetting work in explicit local preview',async()=>{
    const panel=page.getByRole('region',{name:'偏好与记忆',exact:true})
    await visible(panel)
    await panel.getByRole('textbox',{name:'添加记忆',exact:true}).fill('偏好原木家具')
    await panel.getByRole('button',{name:'保存',exact:true}).click()
    await visible(panel.getByText('偏好原木家具',{exact:true}))
    await panel.getByRole('button',{name:'修改',exact:true}).click()
    await panel.getByRole('textbox',{name:'修正内容',exact:true}).fill('偏好复古家具')
    await panel.getByRole('button',{name:'保存',exact:true}).first().click()
    await visible(panel.getByText('偏好复古家具',{exact:true}))
    await panel.getByRole('button',{name:'删除',exact:true}).click()
    await visible(panel.getByText('还没有已确认记忆，可添加偏好或完成评测。',{exact:true}))
  })
  await check('assessment supports keyboard choice, pause, skip and resume with the same fixed chat input',async()=>{
    await page.getByRole('button',{name:'评测',exact:true}).click()
    const panel=page.getByRole('region',{name:'购物偏好测量',exact:true})
    await visible(panel)
    const first=panel.getByRole('radio').first();await first.focus();await page.keyboard.press('ArrowDown')
    assert.equal(await panel.getByRole('radio').nth(1).getAttribute('aria-checked'),'true')
    await page.getByRole('button',{name:'提交答案',exact:true}).click()
    await page.getByRole('button',{name:'跳过',exact:true}).click()
    const prompt=await panel.locator('legend').innerText()
    await page.getByRole('button',{name:'稍后继续',exact:true}).click()
    await page.getByRole('button',{name:'个人资料',exact:true}).focus();await page.keyboard.press('Enter')
    await page.getByRole('button',{name:'评测',exact:true}).click()
    await visible(panel)
    assert.equal(await panel.locator('legend').innerText(),prompt)
    await visible(page.getByRole('textbox',{name:'搜索或询问 AI assistant',exact:true}))
  })
  const bank=JSON.parse(await readFile(new URL('../lib/consumer-advisor/shopping-preference-survey/questions.json',import.meta.url),'utf8'))
  const profile={name:'预览用户',stage:'done',memories:[],shoppingPreferenceSurvey:{version:'1.1.0',status:'complete',answers:{E1:['极简']},
    skipped:bank.questions.filter((q)=>q.id!=='E1').map((q)=>q.id),ladders:{},updatedAt:new Date().toISOString()}}
  await page.evaluate((p)=>localStorage.setItem('omnilink_ai_assistant_preview_profile',JSON.stringify(p)),profile)
  await page.goto(`${base}/discover?demoLogin=1&memories=1`,{waitUntil:'networkidle'})
  await check('assessment proposals stay pending until confirmation and preserve raw evidence after correction',async()=>{
    await page.getByRole('button',{name:'整理评测提案',exact:true}).click()
    await visible(page.getByRole('heading',{name:'待确认',exact:true}))
    let stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('omnilink_ai_assistant_preview_profile')))
    assert.equal(stored.memories[0].status,'proposed');assert.equal(stored.memories[0].confirmedAt,null)
    await page.getByRole('button',{name:'确认',exact:true}).click()
    await visible(page.getByText('其他，推断，已确认',{exact:true}))
    await page.getByText('原始评测',{exact:true}).click()
    await visible(page.getByText('极简',{exact:true}))
    await page.getByRole('button',{name:'修改',exact:true}).click()
    await page.getByRole('textbox',{name:'修正内容',exact:true}).fill('现在偏好复古风格')
    await page.getByRole('region',{name:'偏好与记忆',exact:true}).getByRole('button',{name:'保存',exact:true}).first().click()
    stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('omnilink_ai_assistant_preview_profile')))
    assert.deepEqual(stored.memories[0].sourcePayload.answers,{E1:['极简']})
    assert.equal(stored.memories[0].text,'现在偏好复古风格')
    await page.screenshot({path:`${output}/confirmed-memory.png`})
  })
  await check('memory view remains usable at 390px without horizontal overflow',async()=>{
    await page.setViewportSize({width:390,height:844})
    await visible(page.getByRole('textbox',{name:'搜索或询问 AI assistant',exact:true}))
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
    await page.screenshot({path:`${output}/mobile-memory.png`})
  })
  assert.deepEqual(errors,[])
  await writeFile(`${output}/results.json`,JSON.stringify({checks,errors,calls,note:'Browser API fixtures and local preview. No production data, credentials or paid model calls.'},null,2))
}catch(error){await page.screenshot({path:`${output}/failure.png`});throw error}
finally{await browser.close()}

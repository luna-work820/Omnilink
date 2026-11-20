import {spawn} from 'node:child_process'
import {mkdtemp,writeFile,readFile,mkdir,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const urlArg=process.argv.indexOf('--url')
const url=new URL(urlArg<0?'http://localhost:3000/discover?demoLogin=1':process.argv[urlArg+1])
if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new Error('体验测试仅允许本地地址。')
const output='/tmp/omnilink-p3'
await mkdir(output,{recursive:true})
const dir=await mkdtemp(path.join(tmpdir(),'omnilink-p3-chrome-'))
const executable=process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const chrome=spawn(executable,['--headless=new','--disable-gpu','--no-first-run','--disable-background-networking','--disable-sync','--disable-component-update','--disable-default-apps','--remote-debugging-port=0',`--user-data-dir=${dir}`,'about:blank'],{stdio:['ignore','ignore','pipe']})
let socket
const report={backend:'simulated HTTP, real application DOM',paidModelCalls:0,cases:[],runtimeErrors:[],blockedRequests:[]}
try {
 const endpoint=await new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>reject(new Error('Chrome startup timeout')),15000);chrome.stderr.on('data',chunk=>{text+=chunk.toString();const match=text.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timer);resolve(match[1])}});chrome.once('exit',code=>reject(new Error(`Chrome exit ${code}`)))})
 socket=new WebSocket(endpoint)
 await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject})
 let sequence=0
 const pending=new Map()
 socket.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const entry=pending.get(message.id);if(entry){clearTimeout(entry.timer);pending.delete(message.id);if(message.error)entry.reject(new Error(JSON.stringify(message.error)));else entry.resolve(message.result)}}else if(message.method==='Runtime.exceptionThrown')report.runtimeErrors.push(message.params.exceptionDetails.text);else if(message.method==='Network.requestWillBeSent'&&message.params.request.url.includes('/api/consumer/'))report.blockedRequests.push(message.params.request.url);else if(message.method==='Network.responseReceived'&&message.params.type==='Image'){report.imageHttpResponses??=[];report.imageHttpResponses.push({url:message.params.response.url,status:message.params.response.status})}}
 const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject,timer:setTimeout(()=>reject(new Error(`${method} timeout`)),20000)});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}))})
 const {targetId}=await send('Target.createTarget',{url:'about:blank'})
 const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true})
 const call=(method,params)=>send(method,params,sessionId)
 await call('Runtime.enable');await call('Page.enable');await call('Network.enable')
 await call('Network.setBlockedURLs',{urls:['*/api/consumer/*','https://*']})
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value}
 const until=async expression=>{for(let n=0;n<100;n++){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,100))}throw new Error(`Condition timeout: ${expression}`)}
 const record=(name,details)=>{report.cases.push({name,status:'pass',details});console.log(JSON.stringify({name,status:'pass',details}))}
 const clickText=async text=>evaluate(`(()=>{const button=Array.from(document.querySelectorAll('button')).find(e=>e.textContent.trim()===${JSON.stringify(text)});if(!button)throw new Error('Button missing');button.click()})()`)
 const fill=async text=>evaluate(`(()=>{const field=document.querySelector('textarea');field.focus();Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(field,${JSON.stringify(text)});field.dispatchEvent(new Event('input',{bubbles:true}))})()`)
 const submit=async text=>{await fill(text);await until('!document.querySelector("button[aria-label=发送]").disabled');await evaluate('document.querySelector("button[aria-label=发送]").click()')}
 const count=()=>evaluate('window.__p3.requests.length')
 const heading=()=>evaluate('Array.from(document.querySelectorAll("h1")).map(e=>e.textContent)')
 const waitQuery=query=>until(`Array.from(document.querySelectorAll('h1')).some(e=>e.textContent===${JSON.stringify(query)})`)
 const cards=()=>evaluate('Array.from(document.querySelectorAll("[data-feed-key^=product-]")).map(e=>e.getAttribute("data-feed-key"))')
 const openMenu=async()=>{await until('!document.getElementById("consumer-model-options-trigger").disabled');await evaluate('(()=>{const button=document.getElementById("consumer-model-options-trigger");button.focus();button.click()})()');await until('Boolean(document.querySelector("select[aria-label=检索方式]"))');await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')}
 const select=async(label,value)=>evaluate(`(()=>{const select=document.querySelector('select[aria-label="${label}"]');select.value=${JSON.stringify(value)};select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
 const escape=async()=>{await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27})}
 await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false})
 await call('Page.navigate',{url:url.href})
 await until('Boolean(document.getElementById("consumer-model-options-trigger"))')
 await until('Object.keys(document.getElementById("consumer-model-options-trigger")).some(k=>k.startsWith("__reactProps"))')
 const catalog=JSON.parse(await readFile(path.join(root,'components/consumer-market/data/five-store-demo-products.json'),'utf8'))
 await evaluate(`(()=>{
  const catalog=${JSON.stringify(catalog)},runs=new Map();
  const state=window.__p3={requests:[],failNext:null,holdNext:false,held:[],degradeNext:false,streamNext:false};
  const original=window.fetch;
  window.fetch=async(url,options={})=>{
   if(!String(url).includes('/api/consumer/assistant')&&!String(url).includes('/api/consumer/discovery')&&!String(url).includes('/api/consumer/tasks'))return original(url,options);
   const body=JSON.parse(options.body),sessionId=body.sessionId??body.conversationId;
   state.requests.push({url:String(url),body});
   if(String(url).includes('/tasks'))return Response.json({task:{id:body.id??crypto.randomUUID(),sessionId,revision:body.action==='create'?1:2,attempt:1,status:body.action==='create'?'pending':'completed',completedSteps:[],error:null,result:null,updatedAt:new Date().toISOString()}});
   if(body.searchScope==='information')return Response.json({requestId:body.messageId,sessionId,conversationId:sessionId,contractVersion:1,status:'completed',text:'没有找到本会话资料。',blocks:[{type:'information_feed',id:body.messageId,version:1,data:{query:body.prompt,items:[]}}]});
   if(state.failNext){const failure=state.failNext;state.failNext=null;return Response.json({error:'商品暂时无法读取，请重试。',code:failure,status:'failed',blocks:[]},{status:failure==='SEARCH_EXPIRED'?410:503})}
   if(state.streamNext&&String(url).includes('/assistant')){
    state.streamNext=false;const encoder=new TextEncoder();let sequence=0;
    return new Response(new ReadableStream({start(controller){
     const event=data=>controller.enqueue(encoder.encode('data: '+JSON.stringify({...data,sequence:++sequence,requestId:body.messageId,sessionId})+'\\n\\n'));
     event({type:'text_delta',delta:'P3_PARTIAL'});
     state.stream={finish(){event({type:'text_delta',delta:'P3_LATE_TOKEN'});event({type:'response',response:{requestId:body.messageId,sessionId,conversationId:sessionId,contractVersion:1,status:'completed',text:'P3_PARTIAL P3_LATE_TOKEN',blocks:[]}});controller.close()}};
    }}),{headers:{'Content-Type':'text/event-stream'}})
   }
   let spec=body.spec??{query:body.prompt,termGroups:[],excludedTerms:[],minPrice:null,maxPrice:null,currency:'CNY',type:body.searchScope==='service'?'服务':'商品',sessionTerms:[],questionDismissed:false,retrieval:body.retrieval};
   let run,offset=0;
   if(body.action==='page'||body.action==='resume'){run=runs.get(body.searchRunId);spec=run.spec;offset=body.action==='page'?20:0}
   else {
    const q=spec.query.toLowerCase();let products=[];
    if(q==='全部商品')products=catalog;
    else if(['耳环','earrings'].includes(q))products=catalog.filter(p=>p.category==='耳饰');
    else if(['项链','necklace'].includes(q))products=catalog.filter(p=>p.category==='项链');
    else if(['戒指','rings'].includes(q))products=catalog.filter(p=>p.category==='戒指');
    const degraded=state.degradeNext;state.degradeNext=false;
    run={id:crypto.randomUUID(),spec,products,degraded};runs.set(run.id,run);
   }
   const products=run.products.slice(offset,offset+20);
   const page={searchRunId:run.id,sessionId,query:spec.query,products,nextCursor:offset+20<run.products.length?'fixture:'+run.id:null,contextVersion:0,snapshotVersion:1,pageSize:20,returnedCount:products.length,candidateCount:run.products.length,question:null,spec,
    retrieval:{requestedMode:spec.retrieval?.mode??'auto',effectiveMode:'keyword',profile:null,degraded:run.degraded,reason:run.degraded?'INDEX_MISSING':null,embeddingCalls:0,embeddingInputTokens:0,embeddingMs:0,retrievalMs:0,candidateCount:run.products.length,keywordCount:run.products.length,semanticCount:0,totalMs:0}};
   const respond=()=>Response.json({requestId:body.requestId??body.messageId,sessionId,conversationId:sessionId,contractVersion:1,status:'completed',text:page.query,model:null,intent:'product-search',matchedProductIds:products.map(p=>p.id),discovery:page,blocks:[{type:'discovery_feed',id:page.searchRunId,version:1,data:page}]});
   if(state.holdNext){state.holdNext=false;return new Promise(resolve=>state.held.push(()=>resolve(respond())))}
   return respond();
  };
 })()`)
 await fill('耳环')
 const beforeIme=await count()
 await evaluate(`document.querySelector('textarea').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true,isComposing:true}))`)
 await evaluate(`document.querySelector('textarea').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true,keyCode:229}))`)
 if(await count()!==beforeIme||await evaluate('document.querySelector("textarea").value')!=='耳环')throw new Error('IME confirmation submitted or cleared input')
 record('Chinese composition confirmation',{requests:0,inputRetained:true,evidence:'simulated composition key events, not native OS IME'})
 await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13})
 await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13})
 await waitQuery('耳环');record('Enter submits',{count:(await cards()).length})
 await fill('line one')
 await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{document.querySelector("textarea").focus();resolve()})))')
 const beforeShift=await count()
 await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,modifiers:8})
 await call('Input.dispatchKeyEvent',{type:'char',text:'\r',unmodifiedText:'\r',modifiers:8})
 await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,modifiers:8})
 if(await count()!==beforeShift||!(await evaluate('document.querySelector("textarea").value')).includes('\n'))throw new Error('Shift+Enter did not preserve multiline input: '+JSON.stringify(await evaluate('({active:document.activeElement.outerHTML,input:document.querySelector("textarea").value})')))
 record('Shift Enter does not submit',{input:await evaluate('document.querySelector("textarea").value')})
 for(const [query,expected] of [['earrings',19],['项链',7],['necklace',7],['戒指',8],['rings',8]]){
  await submit(query);await waitQuery(query);await until(`document.querySelectorAll('[data-feed-key^=product-]').length===${expected}`)
  record('query '+query,{count:(await cards()).length})
 }
 await openMenu();const beforeAnswer=await count();await clickText('DeepSeek Flash')
 if(await count()!==beforeAnswer)throw new Error('Answer model change refreshed retrieval')
 record('Answer model independent',{searchRequests:0})
 await submit('全部商品');await waitQuery('全部商品');await until('document.querySelectorAll("[data-feed-key^=product-]").length===20')
 await clickText('加载更多');await until('document.querySelectorAll("[data-feed-key^=product-]").length===35')
 const all=await cards();if(new Set(all).size!==35)throw new Error('Duplicate pagination product')
 record('Pagination 20 plus 15',{unique:new Set(all).size,lastRequest:await evaluate('window.__p3.requests.at(-1).body.action')})
 await submit('全部商品');await until('document.querySelectorAll("[data-feed-key^=product-]").length===20')
 await openMenu();await select('检索方式','hybrid');await select('向量模型','qwen-text-embedding-v4-1024-v1');await evaluate("window.__p3.failNext='CATALOG_UNAVAILABLE'");await clickText('应用')
 await until('Boolean(document.querySelector("[role=alert]"))')
 await clickText('重试');await until('!document.querySelector("[role=alert]")')
 const retried=await evaluate('window.__p3.requests.slice(-2).map(r=>r.body)')
 if(retried.some(r=>r.action!=='start')||retried[1].spec.retrieval.profile!=='qwen-text-embedding-v4-1024-v1')throw new Error('Wrong retry target after switch failure')
 record('Failed start retries same search',{actions:retried.map(r=>r.action),profile:retried[1].spec.retrieval.profile})
 await evaluate("window.__p3.failNext='CATALOG_UNAVAILABLE'");await clickText('加载更多');await until('Boolean(document.querySelector("[role=alert]"))');await clickText('重试');await until('document.querySelectorAll("[data-feed-key^=product-]").length===35')
 record('Failed page retries page',{actions:await evaluate('window.__p3.requests.slice(-2).map(r=>r.body.action)')})
 await submit('全部商品');await until('document.querySelectorAll("[data-feed-key^=product-]").length===20');await evaluate("window.__p3.failNext='SEARCH_EXPIRED'");await clickText('加载更多');await until('Boolean(document.querySelector("[role=alert]"))');await clickText('刷新结果');await until('!document.querySelector("[role=alert]")')
 if(await evaluate('window.__p3.requests.at(-1).body.action')!=='start')throw new Error('Expired page did not create a new search')
 record('Expired cursor refreshes',{action:'start',query:await heading()})
 await evaluate('window.__p3.degradeNext=true');await submit('耳环');await waitQuery('耳环');await until('document.body.innerText.includes("已切换关键词检索")')
 record('Degraded result is explicit',{count:(await cards()).length})
 await submit('不存在的商品');await waitQuery('不存在的商品');await until('document.querySelectorAll("[data-feed-key^=product-]").length===0')
 record('Zero results has no filler',{cards:0})
 await submit('耳环');await waitQuery('耳环');await openMenu();await select('检索方式','semantic');await evaluate('window.__p3.holdNext=true');await clickText('应用');await until('window.__p3.held.length===1');await submit('项链');await waitQuery('项链');await evaluate('window.__p3.held.shift()()');await new Promise(resolve=>setTimeout(resolve,200))
 if(!(await heading()).includes('项链'))throw new Error('Stale response overwrote newer query')
 record('Stale response ignored',{headings:await heading()})
 await evaluate('window.__p3.streamNext=true');await submit('Explain this concept');await until('Boolean(document.querySelector("button[aria-label=停止回答]"))');await until('document.body.innerText.includes("P3_PARTIAL")');await evaluate('document.querySelector("button[aria-label=停止回答]").click()');await evaluate('window.__p3.stream.finish()');await new Promise(resolve=>setTimeout(resolve,200))
 if(await evaluate('document.body.innerText.includes("P3_LATE_TOKEN")'))throw new Error('Stopped stream kept appending')
 await submit('项链');await waitQuery('项链');record('Stop ignores late tokens and permits next input',{headings:await heading()})
 await evaluate('window.__p3.holdNext=true');await submit('earrings');await until('window.__p3.held.length===1')
 const oldSession=await evaluate('window.__p3.requests.at(-1).body.conversationId')
 await evaluate('document.querySelector("button[aria-label=发起新对话]").click()')
 await until('!document.querySelector("button[aria-label=停止回答]")')
 await submit('rings');await waitQuery('rings')
 const newSession=await evaluate('window.__p3.requests.at(-1).body.conversationId')
 await evaluate('window.__p3.held.shift()()');await new Promise(resolve=>setTimeout(resolve,200))
 if(oldSession===newSession||!(await heading()).includes('rings'))throw new Error('Late response crossed conversation boundaries')
 record('Conversation isolation',{differentSessions:oldSession!==newSession,headings:await heading()})
 const previousRun=await evaluate("window.__p3.requests.filter(r=>r.url.includes('/assistant')).at(-1)");
 await submit('换成金色');await waitQuery('换成金色')
 const followup=await evaluate("window.__p3.requests.filter(r=>r.url.includes('/assistant')).at(-1).body")
 if(!followup.previousSearchRunId||followup.previousContextVersion!==0||followup.conversationId!==previousRun.body.conversationId)throw new Error('Missing owned search reference')
 record('Follow-up search reference',{runId:followup.previousSearchRunId,contextVersion:followup.previousContextVersion})
 await evaluate("document.getElementById('discovery-type-trigger').click()");await clickText('信息')
 await submit('耳环');await until("window.__p3.requests.filter(r=>r.url.includes('/assistant')).at(-1).body.searchScope==='information'&&!document.querySelector('button[aria-label=停止回答]')")
 record('Information scope on new message',{scope:await evaluate("window.__p3.requests.filter(r=>r.url.includes('/assistant')).at(-1).body.searchScope")})
 await evaluate("document.getElementById('discovery-type-trigger').click()");await clickText('服务')
 await submit('earrings');await waitQuery('earrings')
 if(await evaluate("window.__p3.requests.filter(r=>r.url.includes('/assistant')).at(-1).body.searchScope")!=='service')throw new Error('Service scope missing')
 record('Service scope on new message',{scope:'service'})
 await evaluate("document.getElementById('discovery-type-trigger').click()");await clickText('商品')
 await evaluate("document.querySelector('button[aria-label=添加附件]').click()");await clickText('网址')
 await evaluate("(()=>{const field=document.querySelector('input[type=url]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,'https://example.com/product');field.dispatchEvent(new Event('input',{bubbles:true}))})()")
 await clickText('添加网址');await submit('比较材质和尺寸')
 await until("window.__p3.requests.some(r=>r.url.includes('/tasks')&&r.body.action==='create')")
 const taskInput=await evaluate("window.__p3.requests.find(r=>r.url.includes('/tasks')&&r.body.action==='create').body.input")
 if(taskInput.goal!=='比较材质和尺寸'||taskInput.urls[0]!=='https://example.com/product')throw new Error('URL goal missing')
 record('URL task goal',{input:taskInput})
 await openMenu();await select('向量模型','bge-small-zh-v1.5-512-v2');await clickText('应用')
 await until("window.__p3.requests.at(-1).body.spec?.retrieval?.profile==='bge-small-zh-v1.5-512-v2'")
 record('Versioned index switch',{profile:'bge-small-zh-v1.5-512-v2'})
 for(const width of [1280,390,320]){
  await call('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<500});await openMenu()
  const layout=await evaluate('({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,controls:Array.from(document.querySelectorAll("select")).map(e=>({height:e.getBoundingClientRect().height,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right}))})')
  if(layout.scrollWidth>width||layout.controls.some(c=>c.height<44||c.left<0||c.right>width))throw new Error('Responsive control overflow')
  await escape();await until('!document.querySelector("select[aria-label=检索方式]")')
  if(await evaluate('document.activeElement.id')!=='consumer-model-options-trigger')throw new Error('Focus not restored')
  record('Responsive menu '+width,layout)
  const screenshot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(output,`experience-${width}.png`),Buffer.from(screenshot.data,'base64'))
 }
 if(report.runtimeErrors.length)throw new Error('Runtime exceptions')
 record('Runtime console',{exceptions:0})
 if(process.argv.includes('--check-images')){
  await call('Network.setBlockedURLs',{urls:['*/api/consumer/*','*dashscope*','*api.deepseek*','*generativelanguage.googleapis.com*']})
  report.images=await evaluate(`(async()=>{
   const products=${JSON.stringify(catalog)},results=[];
   for(let offset=0;offset<products.length;offset+=4){results.push(...await Promise.all(products.slice(offset,offset+4).map(p=>new Promise(resolve=>{
    const image=new Image();let done=false;const finish=status=>{if(done)return;done=true;clearTimeout(timer);resolve({id:p.id,url:p.mainImage,status,width:image.naturalWidth,height:image.naturalHeight})};
    const timer=setTimeout(()=>finish('timeout'),5000);image.onload=()=>finish('loaded');image.onerror=()=>finish('error');image.src=p.mainImage;
   }))))}return results;
  })()`)
  console.log(JSON.stringify({imageChecks:report.images.length,loaded:report.images.filter(image=>image.status==='loaded').length,unverified:report.images.filter(image=>image.status!=='loaded').map(image=>({id:image.id,status:image.status}))}))
  await evaluate('document.querySelectorAll("img").forEach(image=>{const src=image.src;image.removeAttribute("src");image.src=src})')
  for(const theme of ['light','dark']){
   await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
   await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:theme}]})
   await openMenu()
   await new Promise(resolve=>setTimeout(resolve,260))
   const colors=await evaluate('Array.from(document.querySelectorAll("select")).map(e=>({foreground:getComputedStyle(e).color,background:getComputedStyle(e).backgroundColor}))')
   const luminance=color=>{const values=color.match(/[0-9.]+/g).slice(0,3).map(Number).map(n=>n/255).map(n=>n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4);return values[0]*0.2126+values[1]*0.7152+values[2]*0.0722}
   const contrasts=colors.map(color=>{const a=luminance(color.foreground),b=luminance(color.background);return(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05)})
   if(contrasts.some(value=>!Number.isFinite(value)||value<4.5))throw new Error('Control text contrast is below AA')
   record('System theme '+theme,{colors,contrasts})
   const screenshot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(output,`experience-${theme}.png`),Buffer.from(screenshot.data,'base64'))
   await escape()
  }
 }
 report.requests=await evaluate('window.__p3.requests.map(r=>({url:r.url,action:r.body.action??"assistant",query:r.body.prompt??r.body.spec?.query}))')
 await send('Browser.close')
}catch(error){report.failure=error.message;process.exitCode=1;console.error(error.message)}
finally{socket?.close();chrome.kill();await new Promise(resolve=>setTimeout(resolve,300));await rm(dir,{recursive:true,force:true});await writeFile(path.join(output,'browser-acceptance.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({cases:report.cases.length,status:report.failure?'failed':'passed',report:path.join(output,'browser-acceptance.json')}))}

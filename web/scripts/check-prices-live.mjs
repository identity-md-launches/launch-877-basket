import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import assert from 'node:assert/strict';
import {decodeFunctionData,decodeFunctionResult,encodeFunctionResult,multicall3Abi} from 'viem';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const dist=path.resolve('../dist'),out=path.resolve('../test/scratch/v24-prices');fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{const file=path.resolve(dist,'.'+(req.url==='/'?'/index.html':req.url.split('?')[0])),relative=path.relative(dist,file);if(relative.startsWith('..')||path.isAbsolute(relative)||!fs.existsSync(file)){res.writeHead(404).end();return;}res.setHeader('Content-Type',mime[path.extname(file)]??'application/octet-stream');res.end(fs.readFileSync(file));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base = "http://127.0.0.1:" + server.address().port;
const browser=await chromium.launch();
const feedTargets=new Set(['0x61b7e5650328764b076a108eff5fa7282a1b9ad2','0x78f3556b67e17df817d51ef5a990cdaf09e8d3a9']);
const reads=new Set(['eth_call','eth_chainId','eth_getCode','eth_blockNumber','eth_getBlockByNumber','eth_getBlockByHash']);
let failPrices=false,active=0;const sent=[],cache=new Map();
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce'});
 await page.route('**/*',async route=>{
  if(route.request().url().startsWith(base))return route.continue();
  if(!/^https:\/\/(rpc\.mainnet\.chain\.robinhood\.com|robinhood-rpc\.publicnode\.com)/.test(route.request().url()))return route.abort();
  active++;
  try{
   const query=route.request().postDataJSON();assert.ok(reads.has(query.method),'read-only RPC method');sent.push(query);
   const key=JSON.stringify([query.method,query.params]);
   if(!cache.has(key))cache.set(key,fetch(route.request().url(),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(query),signal:AbortSignal.timeout(25000)}).then(r=>r.json()));
   const response={...await cache.get(key),id:query.id};
   if(failPrices&&query.method==='eth_call'){
    const tx=query.params[0];
    if(feedTargets.has(tx.to?.toLowerCase())){delete response.result;response.error={code:-32000,message:'price read fixture unavailable'};}
    else {let call;try{call=decodeFunctionData({abi:multicall3Abi,data:tx.data});}catch{}
     if(call?.functionName==='aggregate3'&&response.result){const values=decodeFunctionResult({abi:multicall3Abi,functionName:'aggregate3',data:response.result});response.result=encodeFunctionResult({abi:multicall3Abi,functionName:'aggregate3',result:values.map((v,i)=>feedTargets.has(call.args[0][i].target.toLowerCase())?{success:false,returnData:'0x'}:v)});}
    }
   }
   await route.fulfill({body:JSON.stringify(response),contentType:'application/json'});
  }catch{await route.abort();}finally{active--;}
 });
 const quiet=async()=>{for(let i=0;i<100;i++){await page.waitForTimeout(100);if(!active){await page.waitForTimeout(200);if(!active)return;}}};
 const values=async()=>Object.fromEntries(await page.locator('[data-price]').evaluateAll(es=>es.map(e=>[e.dataset.price,e.textContent])));
 const results=[];
 for(const width of [1440,375]){
  await page.setViewportSize({width,height:1100});await page.goto(base+'/#earn');
  await page.locator('.earn-card').first().waitFor({timeout:60000});await quiet();await page.evaluate(()=>document.fonts.ready);
  const before=await values();results.push({width,values:before});
  assert.equal(await page.locator('.token-prices').count(),1);assert.equal(await page.locator('input[name=earn-pool]').count(),2);
  await page.locator('input[name=earn-pool][value=eth] + span').click();assert.ok(await page.locator('[data-pool-view=eth]').isVisible());
  await page.locator('input[name=earn-pool][value=bask] + span').click();
  await page.locator('[data-item-card=bask]').getByRole('tab',{name:'Claim/Withdraw',exact:true}).click();
  await page.locator('[data-item-card=staking]').getByRole('tab',{name:'Claim/Withdraw',exact:true}).click();
  assert.equal(await page.locator('body').evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:path.join(out,`earn-${width}.png`),fullPage:true});
  await page.locator('.token-prices').screenshot({path:path.join(out,`header-prices-${width}.png`)});
 }
 failPrices=true;await page.locator('.item-refresh button').click();await quiet();
 assert.equal((await values())['bask-pool'],'—');assert.equal((await values())['item-pool'],'—');
 failPrices=false;await page.locator('.item-refresh button').click();await quiet();
 assert.notEqual((await values())['bask-pool'],'—');assert.notEqual((await values())['item-pool'],'—');
 for(const route of ['vault','deposit','redeem','docs','owner','losses','transparency']){await page.goto(base+'/#'+route);await quiet();assert.equal(await page.locator('.token-prices').count(),1);}
 const before=sent.length;await page.waitForTimeout(1500);assert.equal(sent.length,before,'no idle polling');
 fs.writeFileSync(path.resolve('../artifacts/v24-prices.json'),JSON.stringify({result:'PASS',results,checks:['two pool buttons select either card','Claim/Withdraw on both card kinds','all eight routes show shared prices','failed feeds clear prices; refresh recovers','no wallet available; only read-only RPC methods','no idle polling; 1440 and 375px fit']},null,2));
 console.log('PASS live read-only v24 UI',JSON.stringify(results));
}finally{await browser.close();await new Promise(r=>server.close(r));}

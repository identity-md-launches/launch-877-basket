import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import assert from 'node:assert/strict';import {build} from 'esbuild';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const scratch=path.resolve('../test/scratch/tokenomics-live');fs.mkdirSync(scratch,{recursive:true});
const source=path.resolve('src/Tokenomics.tsx').replaceAll('\\','/');
const data=path.resolve('src/tokenomicsData.ts').replaceAll('\\','/');
const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {LiveFigures} from ${JSON.stringify(source)};import {ADDRESSES} from ${JSON.stringify(data)};
const mode=new URLSearchParams(location.search).get('mode');
const addresses=Object.fromEntries(Object.keys(ADDRESSES).map((key,i)=>[key,mode===key?null:'0x'+String(i+1).padStart(40,'0')]));
window.calls=0;const reader=async specs=>{window.calls++;window.functions=specs.map(c=>c.functionName);if(mode==='retry'&&window.calls===1)return [{ok:false,error:'mock unavailable'}];return Array(10).fill({ok:true,value:1234567890123456789012345n});};
createRoot(document.getElementById('root')).render(<LiveFigures addresses={addresses} reader={reader}/>);`;
await build({stdin:{contents:entry,loader:'tsx',resolveDir:path.resolve('.')},bundle:true,platform:'browser',format:'esm',outfile:path.join(scratch,'fixture.js'),logLevel:'error'});
const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url.startsWith('/fixture.js')?'text/javascript':'text/html');res.end(req.url.startsWith('/fixture.js')?fs.readFileSync(path.join(scratch,'fixture.js')):'<div id="root"></div><script type="module" src="/fixture.js"></script>');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch(),page=await browser.newPage();let external=0;await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:'))return r.continue();external++;return r.abort();});
try{
 const base='http://127.0.0.1:'+server.address().port;
 for(const mode of ['ITEM','ITEM_STAKING','BASK_USDG_GAUGE','ITEM_ETH_GAUGE','DEV_VESTING']){await page.goto(base+'/?mode='+mode);await page.waitForFunction(()=>window.calls!==undefined);assert.equal(await page.locator('#root').innerHTML(),'');assert.equal(await page.evaluate(()=>window.calls),0);}
 await page.goto(base+'/?mode=success');await page.getByText('ITEM supply',{exact:true}).waitFor();assert.equal(await page.locator('dd').count(),10);assert.equal(await page.locator('dd').first().textContent(),'1,234,567');assert.equal(await page.locator('dd').nth(3).textContent(),'1,234,567.890123');assert.equal(await page.locator('a').count(),5);assert.equal(await page.evaluate(()=>window.calls),1);
 assert.deepEqual(await page.evaluate(()=>window.functions),['totalSupply','released','remaining','totalStaked','released','remaining','totalStaked','vested','released','totalStaked']);
 await page.goto(base+'/?mode=retry');await page.getByText('Live figures unreadable.',{exact:true}).waitFor();assert.equal(await page.locator('dd').count(),0);assert.equal(await page.locator('a').count(),0);await page.getByRole('button',{name:'Retry',exact:true}).click();await page.getByText('ITEM supply',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.calls),2);assert.equal(await page.getByText('Live figures unreadable.',{exact:true}).count(),0);assert.equal(await page.locator('dd').count(),10);assert.equal(external,0);
 console.log('PASS tokenomics live component: five null mounts absent/zero reads, mocked success/explorer rows, failure-only notice, Retry succeeds, zero external requests');
}finally{await browser.close();await new Promise(r=>server.close(r));fs.rmSync(scratch,{recursive:true,force:true});}

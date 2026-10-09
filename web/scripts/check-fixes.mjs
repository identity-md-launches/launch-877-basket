// Exercise the actual wallet hook and Claims component with deterministic failed reads/replacements.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { build } from 'vite';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const scratch=path.resolve('../test/scratch/site-fixes');fs.mkdirSync(scratch,{recursive:true});
const src=path.resolve('src');
fs.writeFileSync(path.join(scratch,'index.html'),'<div id="root"></div><script type="module" src="./entry.tsx"></script>');
fs.writeFileSync(path.join(scratch,'entry.tsx'),`
import React from '${path.resolve('node_modules/react/index.js')}';
import {createRoot} from '${path.resolve('node_modules/react-dom/client.js')}';
import {useWallet} from '${src}/wallet';
import {Claims} from '${src}/Flows';
import {client,VAULT} from '${src}/chain';
import {keccak256,toHex} from '${path.resolve('node_modules/viem/_esm/index.js')}';
const mode=new URLSearchParams(location.search).get('mode');
const hash=keccak256(toHex('isolated pending transaction fixture'));
const key='basket-pending-4663';
const fixture={hash,account:VAULT,functionName:'genesisList',...(mode==='legacy'?{}:{nonce:4})};
sessionStorage.setItem(key,JSON.stringify(fixture));
window.ethereum={request:async({method})=>method==='eth_chainId'?'0x1237':[VAULT]};
let waits=0,refreshed=0;
Object.assign(client,{
 getTransactionReceipt:async()=>{if(mode==='receipt')return {};throw Error('no receipt')},
 getTransaction:async()=>{if(mode==='legacy')return {nonce:4};throw Error('replaced hash no longer known')},
 getTransactionCount:async({blockTag})=>mode==='pending'?(blockTag==='pending'?5:4):mode==='unknown'?4:mode==='queue'?(blockTag==='pending'?6:5):5,
 waitForTransactionReceipt:async()=>{waits++;return {}}
});
const s={assets:[],globals:{},errors:[],complete:mode==='complete',aggregate:false,loadedAt:0,loading:false,retry:()=>{refreshed++}};
function App(){const w=useWallet(async()=>{refreshed++;return s});return <><div data-account>{w.account}</div><button onClick={async()=>{try{await w.listingPending();document.querySelector('output').textContent='clear'}catch(e){document.querySelector('output').textContent=e.message}}}>Check listing</button><button onClick={async()=>{try{await w.waitPending();document.querySelector('output').textContent='waited'}catch(e){document.querySelector('output').textContent=e.message}}}>Wait</button><output/><Claims snapshot={s} wallet={w}/></>}
window.inspect=()=>({saved:sessionStorage.getItem(key),waits,refreshed});
createRoot(document.getElementById('root')).render(<App/>);
`);
await build({configFile:false,root:scratch,base:'./',logLevel:'error',build:{outDir:path.join(scratch,'dist'),emptyOutDir:true}});
const server=http.createServer((req,res)=>{const p=path.join(scratch,'dist',req.url.split('?')[0]==='/'?'index.html':req.url.split('?')[0]);try{res.setHeader('Content-Type',p.endsWith('.js')?'application/javascript':'text/html');res.end(fs.readFileSync(p));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const checks=[];
try{browser=await chromium.launch();const page=await browser.newPage();
for(const mode of ['replaced','legacy','receipt','pending','unknown','queue']){
 await page.goto(`http://127.0.0.1:${server.address().port}/?mode=${mode}`);await page.waitForFunction(()=>document.querySelector('[data-account]').textContent);
 await page.getByRole('button',{name:'Check listing',exact:true}).click();
 const result=await page.locator('output').innerText(),state=await page.evaluate(()=>window.inspect());
 if(['replaced','legacy','receipt'].includes(mode)){assert.equal(result,'clear');assert.equal(state.saved,null);}else{assert.match(result,/pending/);assert.equal(state.saved===null,mode==='queue');}
 checks.push(mode+': nonce/receipt recovery and fail-closed pending guard');
}
await page.goto(`http://127.0.0.1:${server.address().port}/?mode=replaced`);await page.waitForFunction(()=>document.querySelector('[data-account]').textContent);await page.getByRole('button',{name:'Wait',exact:true}).click();assert.equal(await page.locator('output').innerText(),'waited');assert.deepEqual(await page.evaluate(()=>window.inspect()),{saved:null,waits:0,refreshed:1});checks.push('Wait reconciles replaced hash without waiting for impossible receipt');
assert.equal(await page.getByText('Owed balances unreadable. Retry vault.',{exact:true}).count(),1);assert.equal(await page.getByText('Nothing is owed to your connected wallet.',{exact:true}).count(),0);await page.getByRole('button',{name:'Retry vault',exact:true}).click();assert.equal((await page.evaluate(()=>window.inspect())).refreshed,2);checks.push('Incomplete stock read says unreadable, offers functioning Retry vault, never says nothing owed');
await page.goto(`http://127.0.0.1:${server.address().port}/?mode=complete`);await page.getByText('Nothing is owed to your connected wallet.',{exact:true}).waitFor();checks.push('Complete empty stock read retains nothing-owed message');
fs.writeFileSync('../artifacts/site-fixes.json',JSON.stringify({checks,scope:'Actual wallet hook and Claims component, mocked reads only; fork sends tested separately.'},null,2)+'\n');console.log('PASS',checks.length,'site-fix regressions');
}finally{await browser?.close();await new Promise(r=>server.close(r));}

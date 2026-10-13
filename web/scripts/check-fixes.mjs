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
import {client,VAULT,vaultAbi} from '${src}/chain';
import {keccak256,toHex,decodeFunctionData,encodeAbiParameters} from '${path.resolve('node_modules/viem/_esm/index.js')}';
const mode=new URLSearchParams(location.search).get('mode');
const hash=keccak256(toHex('isolated pending transaction fixture'));
const key='basket-pending-4663';
const mockAccount='0x00000000000000000000000000000000000a11ce';
const fixture={hash,account:mockAccount,functionName:'genesisList',...(mode==='legacy'?{}:{nonce:4})};
sessionStorage.setItem(key,JSON.stringify(fixture));
window.ethereum={request:async({method})=>method==='eth_chainId'?'0x1237':[mockAccount]};
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

// v12 SPEC 4: drive the shipped Claims component, including its Activity/key mounting.
const fixtureAddress=(n)=>'0x'+n.toString(16).padStart(40,'0');
const fixtureAssets=[1,2,3].map(n=>({token:fixtureAddress(n),symbol:'FIX'+n,tokenDecimals:0,index:n-1}));
let fixtureState,fixtureUpdate,fixtureReads=[],fixtureCalls=0,fixtureSend;
if(mode==='claims')Object.assign(client,{call:({data})=>new Promise((resolve,reject)=>{
 const decoded=decodeFunctionData({abi:vaultAbi,data});
 if(decoded.functionName!=='owed')throw Error('Unexpected Claims read '+decoded.functionName);
 fixtureCalls++;fixtureReads.push({token:decoded.args[1],resolve,reject});
})});
function ClaimsFixture(){
 const [state,update]=React.useState({account:mockAccount,visible:true,complete:true,loading:false,loadedAt:0,progress:{},empty:false});
 fixtureState=state;fixtureUpdate=update;
 const report=(key,value)=>update(old=>({...old,progress:{...old.progress,[key]:value}}));
 const w={...state,chainId:4663,busy:false,connecting:false,report,fail:(key,message)=>report(key,{message}),send:async(spec,key,label)=>{
   report(key,{message:label+': Waiting for wallet…'});
   await new Promise((resolve,reject)=>{fixtureSend={resolve,reject,key,label}});
   report(key,{message:label+': Confirmed.'});
 },connect:()=>{},switchChain:()=>{}};
 const snapshot={assets:state.empty?[]:fixtureAssets,complete:state.complete,loading:state.loading,loadedAt:state.loadedAt,globals:{},retry:()=>{}};
 return <React.Activity mode={state.visible?'visible':'hidden'}><Claims key={state.account} snapshot={snapshot} wallet={w}/></React.Activity>;
}
window.fixtureUpdate=(change)=>fixtureUpdate(old=>({...old,...change,...(change.bump?{loadedAt:old.loadedAt+1}:{})}));
window.fixtureFinish=(values)=>{for(const item of fixtureReads.splice(0)){const value=values[Number(BigInt(item.token))-1];if(value===null)item.reject(Error('unreadable'));else item.resolve({data:encodeAbiParameters([{type:'uint256'}],[BigInt(value)])});}};
window.fixtureSettle=(error)=>{const send=fixtureSend;fixtureSend=undefined;if(error)send.reject(Error(error));else send.resolve();};
window.fixtureInspect=()=>({calls:fixtureCalls,pending:fixtureReads.length,sending:!!fixtureSend,panel:!!document.querySelector('.claims'),quiet:document.querySelector('.claims-quiet')?.textContent??'',rows:document.querySelectorAll('.claim-grid>.receipt').length,body:document.body.innerText});

createRoot(document.getElementById('root')).render(mode==='claims'?<ClaimsFixture/>:<App/>);
`);
await build({configFile:false,root:scratch,base:'./',logLevel:'error',build:{outDir:path.join(scratch,'dist'),emptyOutDir:true}});
const server=http.createServer((req,res)=>{const p=path.join(scratch,'dist',req.url.split('?')[0]==='/'?'index.html':req.url.split('?')[0]);try{res.setHeader('Content-Type',p.endsWith('.js')?'application/javascript':'text/html');res.end(fs.readFileSync(p));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const checks=[];
const blockedNetwork=[];
try{browser=await chromium.launch();const page=await browser.newPage();
await page.route('**/*',route=>{const address=route.request().url();if(address.startsWith('http://127.0.0.1:'+server.address().port+'/'))return route.continue();blockedNetwork.push(address);return route.abort();});
for(const mode of ['replaced','legacy','receipt','pending','unknown','queue']){
 await page.goto(`http://127.0.0.1:${server.address().port}/?mode=${mode}`);await page.waitForFunction(()=>document.querySelector('[data-account]').textContent);
 await page.getByRole('button',{name:'Check listing',exact:true}).click();
 const result=await page.locator('output').innerText(),state=await page.evaluate(()=>window.inspect());
 if(['replaced','legacy','receipt'].includes(mode)){assert.equal(result,'clear');assert.equal(state.saved,null);}else{assert.match(result,/pending/);assert.equal(state.saved===null,mode==='queue');}
 checks.push(mode+': nonce/receipt recovery and fail-closed pending guard');
}
await page.goto(`http://127.0.0.1:${server.address().port}/?mode=replaced`);await page.waitForFunction(()=>document.querySelector('[data-account]').textContent);await page.getByRole('button',{name:'Wait',exact:true}).click();assert.equal(await page.locator('output').innerText(),'waited');assert.deepEqual(await page.evaluate(()=>window.inspect()),{saved:null,waits:0,refreshed:1});checks.push('Wait reconciles replaced hash without waiting for impossible receipt');
assert.equal(await page.getByText('Owed balances unreadable. Retry vault.',{exact:true}).count(),1);assert.equal(await page.getByText('Nothing is owed to your connected wallet.',{exact:true}).count(),0);await page.getByRole('button',{name:'Retry vault',exact:true}).click();assert.equal((await page.evaluate(()=>window.inspect())).refreshed,2);checks.push('Incomplete stock read says unreadable, offers functioning Retry vault, never says nothing owed');
await page.goto(`http://127.0.0.1:${server.address().port}/?mode=complete`);await page.getByText('Nothing is owed to this wallet.',{exact:true}).waitFor();assert.equal(await page.locator('.claims').count(),0);checks.push('v12 SPEC 4: complete empty stock read has no Claims panel and the exact quiet line');

// Keep the existing pending-transaction regressions above. These additions cover
// v12 SPEC 4 only; all owed reads use the shipped chain adapter with a mocked call.
await page.goto('http://127.0.0.1:'+server.address().port+'/?mode=claims');
const tick=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const state=()=>page.evaluate(()=>window.fixtureInspect());
const update=async(change)=>{await page.evaluate(change=>window.fixtureUpdate(change),change);await tick();};
const finish=async(values)=>{await page.evaluate(values=>window.fixtureFinish(values),values);await tick();};
const check=async(name,predicate)=>{await tick();const value=await state();assert.ok(predicate(value),name+' '+JSON.stringify(value));checks.push(name);};
await page.waitForFunction(()=>window.fixtureInspect?.().pending===3);
await check('v12 Claims: first owed read is blank',v=>!v.panel&&!v.quiet);
await finish([0,0,0]);
await check('v12 Claims: zero owed has only the exact quiet line',v=>!v.panel&&v.quiet==='Nothing is owed to this wallet.');
await update({bump:true});
await check('v12 Claims: refresh retains the quiet line',v=>!v.panel&&v.quiet==='Nothing is owed to this wallet.');
await finish([2,3,0]);
await check('v12 Claims: positive balances show only owed stock rows',v=>v.panel&&v.rows===2);
assert.equal(await page.locator('.claims details').count(),0);
await page.getByText('Claim all collects up to 10 stocks per wallet prompt. If one stock can’t be paid, that batch stays owed: collect the others with their own Claim buttons.',{exact:true}).waitFor();
checks.push('v12 Claims: no zero-stock fold, exact multiple-stock note');
await update({bump:true});
await check('v12 Claims: refresh retains panel rows',v=>v.panel&&v.rows===2);
await finish([2,0,0]);
assert.equal(await page.getByText('Claim all collects up to 10 stocks per wallet prompt. If one stock can’t be paid, that batch stays owed: collect the others with their own Claim buttons.',{exact:true}).count(),0);
checks.push('v12 Claims: one owed stock has no multiple-stock note');
await page.getByRole('button',{name:'Claim all',exact:true}).click();
await check('v12 Claims: running batch retains the panel and status',v=>v.panel&&v.sending&&v.body.includes('Waiting for wallet'));
await page.evaluate(()=>window.fixtureSettle());await page.waitForFunction(()=>window.fixtureInspect().pending===3);
await finish([0,0,0]);
await check('v12 Claims: last claim keeps Confirmed and the empty panel',v=>v.panel&&v.rows===0&&v.body.includes('Confirmed.'));
const callsBeforeHide=(await state()).calls;
await update({visible:false,bump:true});
await check('v12 Claims: hidden Activity starts no owed reads',v=>v.calls===callsBeforeHide);
await update({visible:true});await finish([0,0,0]);
await check('v12 Claims: navigation preserves confirmation for this account',v=>v.panel&&v.body.includes('Confirmed.'));
await update({account:'0x00000000000000000000000000000000000a11cf'});
await check('v12 Claims: account change has no old panel before its read',v=>!v.panel&&!v.quiet);
await finish([0,0,0]);
await check('v12 Claims: account change ignores prior claim status',v=>!v.panel&&v.quiet==='Nothing is owed to this wallet.');
await update({bump:true});await finish([null,0,0]);
await page.getByRole('button',{name:'Retry claims',exact:true}).waitFor();
await check('v12 Claims: unread owed result shows panel and retry reason',v=>v.panel&&v.body.includes('Owed balances are unreadable. Retry claims above.'));
await page.getByRole('button',{name:'Retry claims',exact:true}).click();await finish([0,0,0]);
await check('v12 Claims: retry keeps a previously shown panel',v=>v.panel&&v.rows===0);
await update({visible:false});await update({account:'0x00000000000000000000000000000000000a11d0'});await update({account:'0x00000000000000000000000000000000000a11cf'});await update({visible:true});await finish([0,0,0]);
await check('v12 Claims: account changes while hidden reset the old latch',v=>!v.panel&&v.quiet==='Nothing is owed to this wallet.');
await update({account:'0x00000000000000000000000000000000000a11d1',complete:false});await finish([0,0,0]);
await check('v12 Claims: incomplete stock list shows panel with vault retry reason',v=>v.panel&&v.body.includes('Owed balances unreadable. Retry vault.'));
await update({account:'0x00000000000000000000000000000000000a11d2',empty:true,complete:false,bump:true});
await check('v12 Claims: unreadable empty list shows the panel and exact reason',v=>v.panel&&v.body.includes('Listed stocks unreadable. Retry the vault.'));
await update({account:'0x00000000000000000000000000000000000a11d3',empty:true,complete:true,bump:true});
await check('v12 Claims: complete empty list has the quiet line',v=>!v.panel&&v.quiet==='Nothing is owed to this wallet.');
await update({empty:false,bump:true});
await check('v12 Claims: newly loaded stocks do not reinterpret an old empty owed result',v=>!v.panel&&v.quiet==='Nothing is owed to this wallet.');
await finish([0,0,0]);
await check('v12 Claims: newly loaded zero balances remain quiet',v=>!v.panel&&v.quiet==='Nothing is owed to this wallet.');
await update({progress:{'claim-all':{message:'Claim batch: Confirmed.'}}});
await check('v12 Claims: a claim status reveals and retains its panel',v=>v.panel&&v.body.includes('Claim batch: Confirmed.'));
await update({account:'0x00000000000000000000000000000000000a11d4'});await finish([1,0,0]);await page.getByRole('button',{name:'Claim all',exact:true}).click();
await page.evaluate(()=>window.fixtureSettle('Fixture claim refused'));await tick();
await update({bump:true});await finish([0,0,0]);
await check('v12 Claims: a claim error remains visible after zero owed refresh',v=>v.panel&&v.body.includes('Fixture claim refused'));
await update({account:undefined});
await check('v12 Claims: disconnected has no panel and the exact connection line',v=>!v.panel&&v.quiet==='Connect the receiver wallet to read and claim its owed stocks.');

assert.deepEqual(blockedNetwork,[],'Isolated fixtures request no external network');checks.push('Isolated synthetic-wallet fixtures make no external network request');
fs.writeFileSync('../artifacts/site-fixes.json',JSON.stringify({checks,scope:'Actual wallet hook and Claims component; mocked reads and wallet sends for deterministic regressions; synthetic accounts and no external network; fork sends tested separately.'},null,2)+'\n');console.log('PASS',checks.length,'site-fix regressions');
}finally{await browser?.close();await new Promise(r=>server.close(r));}

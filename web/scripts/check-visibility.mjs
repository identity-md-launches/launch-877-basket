import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import { decodeFunctionData, encodeFunctionResult, multicall3Abi, parseAbi } from 'viem';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const account = '0x00000000000000000000000000000000000a11ce';
const accountWord = account.slice(2);
const accountAbi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function owed(address,address) view returns (uint256)',
]);
const RPC = /^https:\/\/(rpc\.mainnet\.chain\.robinhood\.com|robinhood-rpc\.publicnode\.com)\/?$/;
const READS = new Set(['eth_call','eth_chainId','eth_getCode','eth_blockNumber','eth_getBlockByNumber','eth_getBlockByHash']);
// Replace only the existing empty-token depositStatus read; other public reads stay live.
let statusFixture=0,statusFixtureReads=0;
function fixtureStatus(call) {
  const tx=call?.params?.[0];
  if(call?.method!=='eth_call'||tx?.to?.toLowerCase()!=='0x739fd5b653aa092a434534fa1ade67c1770b5a5b'||tx.data?.toLowerCase()!=='0x6a6ccbd800000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000')return undefined;
  statusFixtureReads++;
  return {jsonrpc:'2.0',id:call.id,result:'0x'+statusFixture.toString(16).padStart(64,'0')+'0'.repeat(64)};
}

const WEEKEND_NOTICE="Deposits reopen when the stock feed prices update around 8pm on Sundays.", ISSUE_NOTICE="Deposits will be back open when “too few fresh prices” is resolved.";
let weekendBlockReads=0;
function fixtureBlock(call,answer) {
  if(statusFixture!==3||call.method!=='eth_getBlockByNumber')return answer;
  assert.ok(answer.result&&typeof answer.result.timestamp==='string','Weekend proof starts with an actual public block');
  weekendBlockReads++;
  return {...answer,result:{...answer.result,timestamp:'0x'+Math.floor(Date.parse('2026-10-10T12:00:00Z')/1000).toString(16)}};
}
const publicCache = new Map(), routingErrors = [];
let inflight = 0;
const server = http.createServer((req,res) => {
  const parts=req.url.split('?')[0].split('/');
  const root=parts[1]==='old'?process.env.BASKET_BASELINE_DIST:path.resolve('../dist');
  const p=path.join(root,parts.slice(2).join('/')||'index.html');
  try {
    res.setHeader('Content-Type',({'.js':'application/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2'})[path.extname(p)]||'text/plain');
    res.end(fs.readFileSync(p));
  } catch { res.writeHead(404).end(); }
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const b=await chromium.launch(),page=await b.newPage({viewport:{width:375,height:812},reducedMotion:'reduce'});
const results=[];

// v15 on the v14 baseline (the live site): no first-screen element changes its
// words or its vertical place on any page; nothing is excepted. The one decided
// difference is across the Vault title panel on phones: the picture stands in
// the middle (it stood left of it), her bubble keeps its place beside her head,
// her shelf line runs across the panel and the heading is centred. The Deposit
// and Redeem titles equal the baseline (no heading focus marker is shown here:
// the pages are opened directly; check-art covers the marker). Every earlier
// state (Vault heading, Docs paragraphs and panels, the open Deposit stock list,
// Redeem layout, status notices) must equal the baseline. The header, slogan
// strip, and start of each title character stay pinned.
const characterPages=['vault','deposit','redeem'];
const docsAdded=[
  'The basket has no set weights. Any listed stock can be deposited, in any amount, as long as the vault’s checks pass and the vault stays under its size limit. So the mix is whatever holders have put in, and it changes with every deposit and redemption.',
  'BASK’s backing moves with every stock in the vault, so its market price can drift from the value behind it. Traders close that gap: they deposit stocks and sell BASK when it trades high, or buy BASK and redeem when it trades low. That keeps BASK near its backing.',
  'The 0.5% fee on each deposit and redemption goes to ITEM staking, so more trading through the vault means more fees for ITEM.',
];
const ITEM_PANELS=['ITEM','Earn ITEM by providing liquidity','Earn BASK by staking ITEM','Rewards FAQ','ITEM risks'];
const words=t=>String(t).replace(/\s+/g,'');
const normalize=t=>String(t).replace(/\s+/g,' ').trim();
const near=(a,b)=>Math.abs(a-b)<=0.5;
const rounded=x=>JSON.parse(JSON.stringify(x,(k,v)=>typeof v==='number'?Math.round(v*100)/100:v));
await page.addInitScript(({account})=>{
  if(location.search.includes('connected')) window.ethereum={
    request:async({method})=>{
      if(method==='eth_chainId')return '0x1237';
      if(method==='eth_accounts'||method==='eth_requestAccounts')return [account];
      throw Error('Visibility fixture refuses '+method);
    },on(){},removeListener(){},
  };
},{account});

async function publicRead(url,call) {
  assert.ok(READS.has(call.method),'Unexpected visibility RPC method: '+call.method);
  assert.ok(!JSON.stringify(call.params??[]).toLowerCase().includes(accountWord),'Fixture account must not reach public RPC');
  const key=JSON.stringify([url,call.method,call.params??[]]);
  if(!publicCache.has(key)) publicCache.set(key,(async()=>{
    const body=JSON.stringify({...call,id:1});
    const endpoints=[url,...['https://rpc.mainnet.chain.robinhood.com','https://robinhood-rpc.publicnode.com'].filter(endpoint=>endpoint!==url.replace(/\/$/,''))];
    const failures=[];
    for(const endpoint of endpoints) {
      assert.ok(RPC.test(endpoint),'Public read fallback must use an allowed RPC');
      let answer;
      try {
        const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body,signal:AbortSignal.timeout(20000)});
        if(!response.ok)throw Error(`HTTP ${response.status} (${response.headers.get('content-type')||'no content type'})`);
        const text=await response.text();
        try {answer=JSON.parse(text);}catch {throw Error(`Non-JSON response (${response.headers.get('content-type')||'no content type'})`);}
      }catch(error){failures.push(`${endpoint}: ${error.message}`);continue;}
      assert.ok(answer&&answer.jsonrpc==='2.0'&&('result' in answer||'error' in answer),'Public RPC must return a JSON-RPC answer');
      if(failures.length)console.warn('Visibility public RPC transport fallback:',failures.join('; '),'->',endpoint);
      return answer.error?{error:answer.error}:{result:answer.result};
    }
    throw Error('All allowed public RPC transports failed: '+failures.join('; '));
  })().catch(error=>{publicCache.delete(key);throw error;}));
  return {jsonrpc:'2.0',id:call.id,...await publicCache.get(key)};
}
function synthetic(data) {
  let decoded;
  try {decoded=decodeFunctionData({abi:accountAbi,data});}catch{return undefined;}
  if(!decoded.args?.some(a=>String(a).toLowerCase()===account))return undefined;
  return encodeFunctionResult({abi:accountAbi,functionName:decoded.functionName,result:0n});
}
async function answer(url,call) {
  const fixed=fixtureStatus(call);if(fixed)return fixed;
  if(call.method==='eth_call'&&call.params?.[0]?.data?.toLowerCase().includes(accountWord)) {
    const tx=call.params[0],made=synthetic(tx.data);
    if(made!==undefined)return {jsonrpc:'2.0',id:call.id,result:made};
    const decoded=decodeFunctionData({abi:multicall3Abi,data:tx.data});
    assert.equal(decoded.functionName,'aggregate3');
    const result=await Promise.all(decoded.args[0].map(async c=>{
      const made=synthetic(c.callData);
      if(made!==undefined)return {success:true,returnData:made};
      const value=await publicRead(url,{...call,params:[{...tx,to:c.target,data:c.callData},...call.params.slice(1)]});
      return {success:!value.error,returnData:value.error?'0x':value.result};
    }));
    return {jsonrpc:'2.0',id:call.id,result:encodeFunctionResult({abi:multicall3Abi,functionName:'aggregate3',result})};
  }
  return fixtureBlock(call,await publicRead(url,call));
}


function capacityGeometry() {
  const cells=[...document.querySelectorAll('.stats > div')],cell=cells[3],label=cell?.querySelector(':scope > span'),note=label?.querySelector('small'),value=cell?.querySelector(':scope > strong');
  if(!cell||!label||!note||!value)return {count:cells.length,label:label?.textContent??null};
  const r=cell.getBoundingClientRect(),s=getComputedStyle(cell),split=[],outside=[];
  const labelRange=document.createRange();labelRange.selectNode(label.firstChild);
  const labelBox=labelRange.getBoundingClientRect(),noteBox=note.getBoundingClientRect(),valueBox=value.getBoundingClientRect();
  const walker=document.createTreeWalker(label,NodeFilter.SHOW_TEXT);
  for(let node;(node=walker.nextNode());)for(const word of node.textContent.matchAll(/\S+/g)) {
    const range=document.createRange();range.setStart(node,word.index);range.setEnd(node,word.index+word[0].length);
    const box=range.getBoundingClientRect();
    if(new Set([...range.getClientRects()].filter(x=>x.width>0).map(x=>Math.round(x.top))).size!==1)split.push(word[0]);
    if(box.left<r.left+parseFloat(s.borderLeftWidth)-0.5||box.right>r.right-parseFloat(s.borderRightWidth)+0.5||box.top<r.top+parseFloat(s.borderTopWidth)-0.5||box.bottom>r.bottom-parseFloat(s.borderBottomWidth)+0.5)outside.push(word[0]);
  }
  return {count:cells.length,label:label.firstChild.textContent.trim(),note:note.textContent,noteCount:label.querySelectorAll('small').length,labelFont:parseFloat(getComputedStyle(label).fontSize),noteFont:parseFloat(getComputedStyle(note).fontSize),noteBelow:noteBox.top>=labelBox.bottom-0.5,valueBelow:valueBox.top>=noteBox.bottom-0.5,value:value.textContent,split,outside};
}
function assertCapacity(g) {
  assert.equal(g.count,4,'Vault keeps all four figures');
  assert.deepEqual([g.label,g.note],['Maximum Basket Capacity','(eligible to be raised)'],'Exact owner capacity wording');
  assert.equal(g.noteCount,1,'Capacity has one smaller note');
  assert.ok(g.labelFont>=14&&g.noteFont>=12&&g.noteFont<g.labelFont,'Capacity note remains readable and smaller than its label');
  assert.equal(g.noteBelow&&g.valueBelow,true,'Capacity note is below the label and above the value');
  assert.deepEqual(g.split,[],'Capacity words are not split');
  assert.deepEqual(g.outside,[],'Capacity wording stays inside its figure box');
}
function ledGeometry() {
  const state=document.querySelector('.flow-layout .deposit-state'),first=state?.querySelector(':scope > p');
  const signs=[...document.querySelectorAll('.deposit-led-sign')].map(e=>{
    const r=e.getBoundingClientRect(),p=e.closest('.deposit-state')?.getBoundingClientRect(),rect=e.querySelector('rect');
    const border=e.querySelector('.deposit-led-border'),chase=e.querySelector('.deposit-led-chase'),letters=e.querySelector('.deposit-led-letters');
    return {label:e.getAttribute('aria-label'),role:e.getAttribute('role'),inline:e.tagName.toLowerCase()==='svg',onDeposit:!!e.closest('.flow-layout > section.panel .deposit-state'),
      width:r.width,height:r.height,inside:!!p&&r.left>=p.left&&r.right<=p.right&&r.top>=p.top&&r.bottom<=p.bottom,
      black:rect?.getAttribute('fill'),blue:border?getComputedStyle(border).stroke:null,red:!!e.querySelector('circle[fill="#ff373d"]'),
      circles:e.querySelectorAll('circle').length,animations:e.getAnimations({subtree:true}).length,
      offset:chase?getComputedStyle(chase).strokeDashoffset:null,glow:letters?getComputedStyle(letters).opacity:null};
  });
  return {status:first?.textContent.replace(/\s+/g,' ').trim()??null,reopening:state?.querySelector('.reopen')?.textContent??null,readIssues:document.querySelectorAll('.read-errors').length,signs};
}
function layoutSnapshot() {
  const box=e=>{
    if(typeof e==='string')e=document.querySelector(e);
    if(!e)return null;
    const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height};
  };
  const m=document.querySelector('header .marquee'),w=m.querySelector('.marquee-window').getBoundingClientRect();
  const halves=[...m.querySelectorAll('.marquee-half')].map(e=>e.getBoundingClientRect()).sort((a,c)=>a.left-c.left);
  const docs=[...document.querySelectorAll('.docs-grid > .panel')];
  const paragraphs=docs[0]?[...docs[0].querySelectorAll(':scope > p')]:[];
  return {
    header:box('header'),hint:box('main .wallet-help'),title:box('main .page-title'),picture:box('main .page-title .title-character img.character-picture'),
    strip:{...box('header .marquee'),animations:m.getAnimations({subtree:true}).length,still:halves.length===2&&Math.abs(halves[0].left-w.left)<0.01&&Math.abs(halves[1].left-halves[0].right)<0.01&&halves[1].right>=w.right-0.01},
    titleParagraphs:[...document.querySelectorAll('.page-title > p')].map(e=>e.textContent.replace(/\s+/g,' ').trim()),
    heading:document.querySelector('.page-title > h1')?.textContent,
    docs:docs.map(box),docsTitles:docs.map(p=>p.querySelector('h2')?.textContent??null),docsParagraphs:paragraphs.map(e=>({text:e.textContent.replace(/\s+/g,' ').trim(),...box(e)})),
    docsAddedHeight:paragraphs.length===5?box(paragraphs[4]).bottom-box(paragraphs[0]).bottom:0,
    redeemAside:document.querySelector('.flow-layout > aside')?.querySelector('h2')?.textContent??null,
    oneColumn:document.querySelector('.flow-layout')?.classList.contains('one-column')??false,
    claims:document.querySelectorAll('.claims').length,
    quiet:document.querySelector('.claims-quiet')?.textContent??null,
    walletLine:[...document.querySelectorAll('.flow-layout > section.panel > p')].map(e=>e.textContent.replace(/\s+/g,' ').trim()).find(t=>t.startsWith('Showing '))??null,
    depositStatus:[...document.querySelectorAll('.deposit-state')].map(e=>({
      compact:!!e.closest('.deposit-summary'),label:e.querySelector(':scope > strong')?.textContent,
      labelBox:box(e.querySelector(':scope > strong')),
      paragraphs:[...e.querySelectorAll(':scope > p')].map(p=>({text:p.textContent.replace(/\s+/g,' ').trim(),...box(p),visible:p.getBoundingClientRect().height>0&&getComputedStyle(p).visibility!=='hidden'})),
    })),
    depositOpen:document.querySelector('.deposit-open')?{text:document.querySelector('.deposit-open').textContent.replace(/\s+/g,' ').trim(),...box('.deposit-open')}:null,
    flowSteps:document.querySelector('.flow-steps')?{text:document.querySelector('.flow-steps').textContent.replace(/\s+/g,' ').trim(),...box('.flow-steps')}:null,
    // v13: the stock list under the Deposit search (the closed fold at the baseline; the open list in v13's empty states).
    stockList:{open:!!document.querySelector('.all-stocks.open-list'),summary:!!document.querySelector('.all-stocks summary'),
      title:document.querySelector('.all-stocks .list-title, .all-stocks summary')?.textContent.replace(/\s+/g,' ').trim()??null,
      ...box('.all-stocks'),
      width:(()=>{const ul=document.querySelector('.all-stocks ul'),panel=ul?.closest('section.panel');if(!ul||!panel)return null;const cs=getComputedStyle(panel),inner=panel.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight);return ul.getBoundingClientRect().width/inner;})(),
      buttons:document.querySelectorAll('.all-stocks ul button').length,
      sentences:[...document.querySelectorAll('.all-stocks p')].map(e=>e.textContent.replace(/\s+/g,' ').trim()),
      grey:(()=>{const p=[...document.querySelectorAll('.all-stocks p')].find(e=>e.textContent.trim()==='Grey stocks are already in the form above.');if(!p)return null;const cs=getComputedStyle(p);return {height:p.getBoundingClientRect().height,marginTop:parseFloat(cs.marginTop),marginBottom:parseFloat(cs.marginBottom)};})()},
    depositSummary:box('.deposit-summary'),
    // v15: where the title picture, her bubble and the heading sit across the panel, and her shelf line (the holder's ::after).
    across:(()=>{
      const t=document.querySelector('main .page-title'),h=t?.querySelector(':scope > .title-character');if(!h)return null;
      const R=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right};},line=getComputedStyle(h,'::after'),hr=h.getBoundingClientRect(),bw=parseFloat(getComputedStyle(t).borderLeftWidth),tr=t.getBoundingClientRect(),h1=t.querySelector(':scope > h1');
      const rg=document.createRange();rg.selectNodeContents(h1);const hs=[...rg.getClientRects()].filter(x=>x.width>0);
      return {frame:{left:tr.left+bw,right:tr.right-bw},picture:R(h.querySelector('img.character-picture')),bubble:R(h.querySelector('p.speech-bubble')),heading:R(h1),headingText:{left:Math.min(...hs.map(x=>x.left)),right:Math.max(...hs.map(x=>x.right))},headingAlign:getComputedStyle(h1).textAlign,
        marker:h1.matches(':focus-visible'),
        shelf:line.content==='none'?null:{left:hr.left+parseFloat(line.left),right:hr.left+parseFloat(line.left)+parseFloat(line.width),bottom:parseFloat(line.bottom),height:parseFloat(line.height)}};
    })(),
    led:ledGeometry(),
    sideways:document.documentElement.scrollWidth>innerWidth,
  };
}
function elementSnapshots(es) {
  const docs=[...document.querySelectorAll('.docs-grid > .panel')];
  return es.filter(e=>e.getBoundingClientRect().height>0).map(e=>({
    tag:e.tagName,text:e.innerText||e.getAttribute('aria-label')||e.name||e.type,
    y:e.getBoundingClientRect().top,bottom:e.getBoundingClientRect().bottom,
    inTitle:!!e.closest('.page-title'),inClaims:!!e.closest('.claims'),
    inRedeemAside:!!e.closest('.flow-layout > aside.panel')&&e.closest('aside').querySelector('h2')?.textContent==='Take your basket home',
    docsIndex:docs.indexOf(e.closest('.docs-grid > .panel')),
  }));
}

try {
  await page.route('**/*',async route=>{
    const url=route.request().url();
    if(url.startsWith(base+'/'))return route.continue();
    if(RPC.test(url)&&route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'POST'}});
    if(RPC.test(url)&&route.request().method()==='POST') {
      inflight++;
      try {
        const body=route.request().postDataJSON();
        const result=Array.isArray(body)?await Promise.all(body.map(c=>answer(url,c))):await answer(url,body);
        await route.fulfill({contentType:'application/json',body:JSON.stringify(result)});
      }catch(e){routingErrors.push(e.message);await route.abort();}
      finally{inflight--;}
      return;
    }
    routingErrors.push('Blocked unexpected request: '+url);await route.abort();
  });
  for(const statusCase of ['normal','closed','weekend']) for(const variant of ['no-wallet','connected']) for(const name of (statusCase==='weekend'?['deposit']:statusCase==='closed'?['vault','deposit']:['vault','deposit','redeem','docs','owner','losses'])) {
    statusFixture=statusCase==='weekend'?3:statusCase==='closed'?14:0;
    const beforeFixtureReads=statusFixtureReads,beforeBlocks=weekendBlockReads;
    const snapshots=[],layout=[];
    for(const ver of ['old','new']) {
      await page.goto(`${base}/${ver}/?${variant}#${name}`);
      await page.evaluate(()=>document.fonts.ready);
      await page.waitForFunction(()=>!document.querySelector('button.refresh').disabled);
      await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
      for(let quiet=0;quiet<2;){await page.waitForTimeout(100);quiet=inflight===0?quiet+1:0;}
      await page.waitForFunction(()=>![...document.querySelectorAll('main p, main small, main button')].some(e=>/Reading\.\.\.|Reading your wallet/.test(e.textContent)));
      await page.evaluate(()=>scrollTo(0,0));
      // The complete original selector stays; metadata only narrows the v12 exceptions.
      snapshots.push(await page.locator('main p, main input, main button, main select, main textarea, main summary, main .empty, main .note').evaluateAll(elementSnapshots));
      await page.evaluate(source=>{window.ledGeometry=Function('return ('+source+')')();},ledGeometry.toString());
      layout.push(await page.evaluate(layoutSnapshot));
      if(name==='vault'&&ver==='new')assertCapacity(await page.evaluate(capacityGeometry));
      if(name==='vault')layout.at(-1).capacity=await page.locator('.stats > div').nth(3).evaluate(e=>({label:e.querySelector(':scope > span').firstChild.textContent.trim(),value:e.querySelector(':scope > strong').textContent}));
    }
    const [old,now]=snapshots,[oldLayout,newLayout]=layout,regressions=[],checks=[],exceptions=[];
    const hintGrowth=(newLayout.hint?.height??0)-(oldLayout.hint?.height??0);
    const counterpart=x=>now.filter(y=>y.tag===x.tag&&words(y.text)===words(x.text)&&y.inTitle===x.inTitle&&y.inClaims===x.inClaims&&y.docsIndex===x.docsIndex).sort((a,c)=>Math.abs(a.y-x.y)-Math.abs(c.y-x.y))[0]??null;
    const prior=old.filter(x=>x.y>=0&&x.bottom<=812);
    const docsGrowth=newLayout.docsAddedHeight;
    if(name==='vault') {
      assert.equal(newLayout.heading,'Always in stock');
      assert.equal(oldLayout.heading,newLayout.heading,'Vault heading equals the baseline');
      assert.deepEqual(oldLayout.titleParagraphs,[]);
      assert.deepEqual(newLayout.titleParagraphs,[]);
      assert.ok(newLayout.title.height<=oldLayout.title.height+0.5,'Vault panel must not get taller');
      assert.equal(oldLayout.capacity.label,'Maximum Basket Capacity','Baseline carries the v12 capacity label');
      assert.deepEqual(newLayout.capacity,oldLayout.capacity,'Capacity label and figure value remain unchanged');
      checks.push('Vault: heading, empty title paragraphs, panel height, capacity label and figure value equal the baseline');
      // v15 (owner, 2026-10-13: "the graphic on mobile is off to the left and doesnt look good"; he chose the picture
      // centred with the heading centred): across the panel only. The baseline proves the look it replaces.
      const mid=a=>(a.frame.left+a.frame.right)/2,centre=r=>(r.left+r.right)/2,o=oldLayout.across,n=newLayout.across;
      assert.ok(near(centre(n.picture),mid(n)),'v15: the Vault picture stands in the middle of the panel: '+(mid(n)-centre(n.picture)));
      assert.ok(mid(o)-centre(o.picture)>10,'Baseline carries the picture left of the middle');
      assert.ok(near(n.bubble.left-n.picture.left,o.bubble.left-o.picture.left),'v15: the bubble keeps its place beside her head');
      assert.ok(n.bubble.right<=n.frame.right-3.5&&n.bubble.left>=n.frame.left,'v15: the bubble stays 4 px inside the frame');
      assert.ok(near(n.shelf.left,n.frame.left)&&near(n.shelf.right,n.frame.right),'v15: her shelf line runs across the panel');
      assert.ok(near(o.shelf.left,o.frame.left)&&o.shelf.right<o.frame.right-40,'Baseline carries the short shelf line');
      assert.deepEqual([n.shelf.bottom,n.shelf.height],[o.shelf.bottom,o.shelf.height],'v15: the shelf line keeps its level and thickness');
      assert.equal(n.headingAlign,'center','v15: the Vault heading is centred');
      assert.ok(Math.abs(centre(n.headingText)-mid(n))<0.75,'v15: the heading words stand in the middle');
      assert.ok(o.headingAlign!=='center'&&mid(o)-centre(o.headingText)>10,'Baseline carries the heading at the left');
      assert.deepEqual(rounded([n.frame,n.heading]),rounded([o.frame,o.heading]),'v15: the panel and the heading box are where they were');
      assert.deepEqual(rounded([newLayout.title,newLayout.picture]),rounded([oldLayout.title,oldLayout.picture]),'v15: the Vault title panel and picture keep their vertical place and height');
      checks.push('v15 Vault: the picture in the middle of the panel (left of it at the baseline), the bubble in its place beside her head and inside the frame, the shelf line across the panel, the heading centred; panel, heading box, picture height and every vertical place equal the baseline');
    }
    if(name==='deposit'||name==='redeem') {
      assert.equal(newLayout.across.marker,false,'No heading focus marker when the page is opened directly');
      assert.deepEqual(rounded(newLayout.across),rounded(oldLayout.across),'v15: the '+name+' title equals the baseline across the panel');
      assert.deepEqual(rounded([newLayout.title,newLayout.picture]),rounded([oldLayout.title,oldLayout.picture]),'v15: the '+name+' title panel and picture equal the baseline');
      checks.push('v15 '+name+': the title (picture, bubble, heading, shelf line) equals the baseline while the heading has no focus marker');
    }
    assert.ok(statusFixtureReads>beforeFixtureReads,'State comparison consumes the existing depositStatus fixture');
    assert.equal(oldLayout.led.signs.length,newLayout.led.signs.length,'Baseline and v15 carry the same sign count');
    if(statusCase==='normal') {
      assert.equal(newLayout.depositStatus.length,0,'Normal operation has no extra status area');
      assert.equal(newLayout.led.signs.length,0,'Normal operation has no sign');
      assert.equal(newLayout.depositOpen,null,'Normal operation has no open-only paragraph');
      if(name==='vault')assert.equal(newLayout.depositSummary.height,0,'Empty Vault status wrapper takes no space');
    } else {
      assert.equal(newLayout.depositStatus.length,1,'Exactly one issue notice on '+name);
      const status=newLayout.depositStatus[0];
      assert.equal(status.label,name==='vault'?'Vault status:':undefined,'Only Vault has the compact status label');
      assert.equal(!!status.labelBox&&status.labelBox.height>0,name==='vault','Only Vault shows the status label');
      assert.equal(status.paragraphs.length,1,'Exactly one short status paragraph; old hours/reason detail is absent');
      assert.ok(status.paragraphs[0].visible&&status.paragraphs[0].text.length>0,'Current status stays visible');
      assert.equal(status.paragraphs[0].text,name==='vault'?'Closed':statusCase==='weekend'?WEEKEND_NOTICE:ISSUE_NOTICE,'Exact owner-approved short notice');
      assert.equal(status.compact,name==='vault','Compact display is scoped to Vault');
      assert.equal(newLayout.led.reopening,null,'Old reopening/countdown paragraphs are absent');
      assert.equal(newLayout.depositOpen,null,'Deposit no longer uses the open-only line');
      if(statusCase==='closed')assert.equal(oldLayout.depositStatus[0].paragraphs[0].text,name==='vault'?'Closed':ISSUE_NOTICE,'Baseline proves the same reason fixture');
      else assert.ok(weekendBlockReads>beforeBlocks,'Weekend comparison uses the public-block timestamp fixture');
      assert.deepEqual(newLayout.depositStatus,oldLayout.depositStatus,'The status area equals the baseline');
      assert.deepEqual(newLayout.led,oldLayout.led,'The sign geometry equals the baseline');
      assert.equal(newLayout.led.signs.length,name==='deposit'?1:0,'Only Deposit has the known-closed sign');
      if(name==='deposit') {
        const sign=newLayout.led.signs[0];
        assert.equal(sign.label,'Closed','No Open sign exists');
        assert.equal(sign.inline&&sign.onDeposit&&sign.inside,true,'Small inline sign remains in Deposit status');
        assert.ok(sign.width>0&&sign.width<=220&&sign.height>0);
        assert.equal(sign.animations,0,'LED is still under reduced motion');
      }
    }
    if(name==='deposit') {
      assert.equal(newLayout.walletLine,null,'Owner removed the wallet-switch instruction from Deposit');
      assert.equal(newLayout.flowSteps.text,oldLayout.flowSteps.text,'Task instructions keep their words');
      if(oldLayout.flowSteps.bottom<=812)assert.ok(newLayout.flowSteps.bottom<=812,'Previously visible Deposit task instructions remain on the first screen');
      // Both variants are empty forms (no wallet; the synthetic account holds nothing), so the list is open across
      // the panel with its plain heading line (v13); the baseline shows the same list.
      assert.deepEqual([oldLayout.stockList.open,oldLayout.stockList.summary,newLayout.stockList.open,newLayout.stockList.summary],[true,false,true,false],'The open list, not the closed fold, in the empty states');
      assert.equal(newLayout.stockList.title,oldLayout.stockList.title,'The list heading keeps its words');
      assert.match(newLayout.stockList.title,/^All stocks you can deposit \(\d+\)$/);
      assert.ok(near(newLayout.stockList.top,oldLayout.stockList.top),'The list starts where the fold line started');
      assert.ok(newLayout.stockList.width>0.98,'The open list spans the panel: '+newLayout.stockList.width);
      assert.ok(newLayout.stockList.buttons>0&&newLayout.stockList.title.endsWith('('+newLayout.stockList.buttons+')'),'Every open stock has its button');
      assert.deepEqual(rounded(newLayout.stockList),rounded(oldLayout.stockList),'The whole stock list equals the baseline');
      checks.push('Deposit: open stock list across the panel in both empty states, no fold, one button per open stock; the whole list equals the baseline');
    }
    checks.push(statusCase==='normal'?'Owner follow-up: no normal status area/sign':'Owner follow-up: exact single '+statusCase+' sentence, compact Vault Closed notice, Deposit-only CLOSED sign');
    if(name==='docs') {
      // The v14 Docs tab equals the baseline: the four paragraphs of "What Basket is" (the live fee sentence last, no
      // not-live sentence), the five ITEM panels between Risks and Find Basket, every panel in its place with its size.
      assert.equal(oldLayout.docsParagraphs.length,4);
      assert.equal(newLayout.docsParagraphs.length,4);
      assert.deepEqual(oldLayout.docsParagraphs.slice(1).map(p=>p.text),docsAdded,'Baseline carries the two v12 paragraphs and the live fee sentence');
      assert.deepEqual(rounded(newLayout.docsParagraphs),rounded(oldLayout.docsParagraphs),'The Docs paragraphs equal the baseline');
      assert.deepEqual(newLayout.docsTitles.slice(-7),['Risks',...ITEM_PANELS,'Find Basket'],'The five ITEM panels sit between Risks and Find Basket');
      assert.deepEqual(newLayout.docsTitles,oldLayout.docsTitles,'The Docs panels equal the baseline, in order');
      assert.deepEqual(rounded(newLayout.docs),rounded(oldLayout.docs),'Every Docs panel keeps its place and size');
      for(const d of newLayout.docs)assert.ok(d.height>0,'Docs panel rendered');
      checks.push('Docs: the four paragraphs with the live fee sentence, the five ITEM panels between Risks and Find Basket; every panel equals the baseline in place and size');
    }
    if(name==='redeem') {
      assert.equal(oldLayout.redeemAside,null);
      assert.equal(newLayout.redeemAside,null);
      assert.equal(newLayout.oneColumn,true);
      assert.equal(oldLayout.claims,0);
      assert.equal(newLayout.claims,0);
      assert.equal(newLayout.quiet,variant==='connected'?'Nothing is owed to this wallet.':'Connect the receiver wallet to read and claim its owed stocks.');
      assert.equal(newLayout.quiet,oldLayout.quiet,'Quiet claims line equals the baseline');
      assert.equal(newLayout.walletLine,null,'No wallet-switch instruction');
      checks.push('Redeem: unchanged; one column, no aside, exact quiet claims line, no wallet-switch line');
    }
    // The stock list has the baseline's height and words; the sentence v14 removed is in neither.
    const listGrowth=name==='deposit'?newLayout.stockList.height-oldLayout.stockList.height:0;
    if(name==='deposit'){
      assert.ok(!oldLayout.stockList.grey&&!newLayout.stockList.grey,'The grey-stocks sentence (removed in v14) is in neither list');
      assert.deepEqual(newLayout.stockList.sentences,oldLayout.stockList.sentences,'The list keeps its words');
      assert.ok(near(listGrowth,0),'The list keeps its height: '+listGrowth);
    }
    for(const x of prior) {
      const y=counterpart(x);
      // v15 changes no word and no vertical place: every prior first-screen element is there, where it was. No exception.
      if(y&&y.bottom<=812) {
        if(!near(y.y,x.y)||!near(y.bottom,x.bottom))regressions.push({...x,now:y,reason:'First-screen content moved vertically'});
        continue;
      }
      regressions.push({...x,now:y});
    }
    // Original slogan-strip and title-character assertions, with explicit header
    // height and overflow pins added. No exception applies to these parts.
    checks.push('header retains its exact position and height');
    if(!near(newLayout.header.top,oldLayout.header.top)||!near(newLayout.header.height,oldLayout.header.height))regressions.push({tag:'HEADER',text:'header',old:oldLayout.header,now:newLayout.header});
    checks.push('slogan strip in the same place and size, still and full under reduced motion');
    {const o=oldLayout.strip,n=newLayout.strip;if(Math.abs(n.top-o.top)>0.01||Math.abs(n.height-o.height)>0.01||n.animations!==0||!n.still)regressions.push({tag:'DIV',text:'slogan strip',old:o,now:n});}
    if(characterPages.includes(name)) {
      checks.push('character picture starts on the first screen');
      if(!newLayout.picture||newLayout.picture.height<=0||newLayout.picture.top<0||newLayout.picture.top>=812)regressions.push({tag:'IMG',text:'title character',now:newLayout.picture});
    }
    assert.equal(newLayout.sideways,false,'No horizontal overflow');
    // Keep the shipped report small; full layout values are used above by every
    // assertion, while the report retains the prior elements and measured deltas.
    results.push({statusCase,variant,name,prior,hintGrowth,checks,exceptions,regressions,
      headerHeights:[oldLayout.header.height,newLayout.header.height],
      ...(name==='docs'?{docsAddedHeight:docsGrowth}:{}),
    });
  }
  assert.deepEqual(routingErrors,[],'Only local files and allowed public RPC reads; fixture account reads stay synthetic');
  for(const r of results)if(r.regressions.length)throw Error(JSON.stringify({variant:r.variant,name:r.name,regressions:r.regressions}));
  console.log('PASS 375x812 baseline visibility: six pages, no-wallet and connected;',results.reduce((n,r)=>n+r.prior.length,0),'previous first-screen elements with their words in the same vertical place, no exception; the Vault title across the panel as decided in v15, the Deposit and Redeem titles equal to the baseline; header height, slogan strip and character assertions retained');
  fs.writeFileSync('../artifacts/phone-visibility.json',JSON.stringify(results,null,2)+'\n');
}finally{await b.close();await new Promise(r=>server.close(r));}

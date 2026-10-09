import fs from 'node:fs';import http from 'node:http';import path from 'node:path';const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const server=http.createServer((req,res)=>{const ps=req.url.split('?')[0].split('/'),root=ps[1]==='old'?process.env.BASKET_BASELINE_DIST:path.resolve('../dist'),p=path.join(root,ps.slice(2).join('/')||'index.html');try{res.setHeader('Content-Type',({'.js':'application/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2'})[path.extname(p)]||'text/plain');res.end(fs.readFileSync(p));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const b=await chromium.launch(),page=await b.newPage({viewport:{width:375,height:812},reducedMotion:'reduce'});const results=[];
const owner=JSON.parse(fs.readFileSync('../artifacts/live-validation.json')).globals.owner;
// v9 look (final, owner's phone mockup): on phones the pop-out character stands in the title panel above the title
// words of Vault, Deposit and Redeem, and the no-wallet hint puts "Copy site link" on its own row (same words, 32 px
// taller). Only these moves are allowed below the first screen; every other element visible on the first screen
// of the previous build must still be visible there, with the same words (line breaks aside).
const characterPages=['vault','deposit','redeem'];
// v9 A4: the Vault title's eyebrow (the old tagline) is removed on purpose; only that element may vanish, only on Vault.
const taglineWords=/^stocktokens.onebasket.$/i;
await page.addInitScript(({owner})=>{if(location.search.includes('connected')) window.ethereum={request:async({method})=>method==='eth_chainId'?'0x1237':[owner]};},{owner});
try{await page.route(/https:\/\//,async route=>{try{const r=await fetch(route.request().url(),{method:'POST',headers:{'content-type':'application/json'},body:route.request().postData()});await route.fulfill({body:await r.text(),contentType:'application/json'});}catch{await route.abort();}});
for(const variant of ['no-wallet','connected']) for(const name of ['vault','deposit','redeem','docs','owner','losses']){const snapshots=[],layout=[];for(const ver of ['old','new']){await page.goto(`http://127.0.0.1:${server.address().port}/${ver}/?${variant}#${name}`);await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>!document.querySelector('button.refresh').disabled);await page.evaluate(()=>scrollTo(0,0));snapshots.push(await page.locator('main p, main input, main button, main select, main textarea, main summary, main .empty, main .note').evaluateAll(es=>es.filter(e=>e.getBoundingClientRect().height>0).map(e=>({tag:e.tagName,text:e.innerText||e.getAttribute('aria-label')||e.name||e.type,y:e.getBoundingClientRect().top,bottom:e.getBoundingClientRect().bottom,inTitle:!!e.closest('.page-title')}))));
layout.push(await page.evaluate(()=>{const box=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height};};return {hint:box('main .wallet-help'),title:box('main .page-title'),picture:box('main .page-title .title-character img.character-picture')};}));}
const words=t=>String(t).replace(/\s+/g,''),[old,now]=snapshots,[,newLayout]=layout,oldLayout=layout[0];
const hintGrowth=(newLayout.hint?.height??0)-(oldLayout.hint?.height??0);
// Where an element of the previous first screen went; null if its words are gone.
const counterpart=x=>now.filter(y=>words(y.text)===words(x.text)).sort((a,c)=>Math.abs(a.y-x.y)-Math.abs(c.y-x.y))[0]??null;
const prior=old.filter(x=>x.y>=0&&x.bottom<=812),moved=[],removed=[],regressions=[];
for(const x of prior){const y=counterpart(x);if(y&&y.bottom<=812)continue;
 if(!y&&name==='vault'&&taglineWords.test(words(x.text))){removed.push({tag:x.tag,oldBottom:x.bottom,reason:'old Vault eyebrow (tagline) removed (v9)'});continue;}
 // Title words of the character pages: below the character's head, still inside the title panel.
 const character=!!y&&y.inTitle&&characterPages.includes(name)&&!!newLayout.picture&&y.y>newLayout.picture.top;
 // Title words pushed down by the taller wallet hint only (no wallet), by no more than its growth.
 const hint=!!y&&y.inTitle&&variant==='no-wallet'&&hintGrowth>0&&hintGrowth<=40&&y.bottom<=812+hintGrowth+1;
 if(character||hint)moved.push({tag:x.tag,text:x.text,oldBottom:x.bottom,newBottom:y.bottom,reason:character?'pop-out character above the title words (v9 look)':'wallet hint '+hintGrowth+' px taller (v9 look)'});
 else regressions.push({...x,now:y});}
const checks=[];
if(characterPages.includes(name)){checks.push('character picture starts on the first screen');if(!newLayout.picture||newLayout.picture.height<=0||newLayout.picture.top<0||newLayout.picture.top>=812)regressions.push({tag:'IMG',text:'title character',now:newLayout.picture});}
// The report leaves the removed tagline's words out.
results.push({variant,name,prior:prior.map(x=>taglineWords.test(words(x.text))?{...x,text:'(old Vault eyebrow, removed)'}:x),hintGrowth,moved,removed,checks,regressions});}
for(const r of results) if(r.regressions.length) throw Error(JSON.stringify({variant:r.variant,name:r.name,regressions:r.regressions,moved:r.moved}));
console.log('PASS 375x812 baseline visibility: six pages, no-wallet and connected;',results.reduce((n,r)=>n+r.moved.length,0),'title elements moved by the v9 look (character, wallet hint);',results.reduce((n,r)=>n+r.removed.length,0),'tagline elements removed (Vault)');fs.writeFileSync('../artifacts/phone-visibility.json',JSON.stringify(results,null,2));}finally{await b.close();await new Promise(r=>server.close(r));}

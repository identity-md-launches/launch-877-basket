import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { build } from 'esbuild';
const root=process.env.BASKET_SOURCE_ROOT||path.resolve('..');
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'});
const baseline=p=>git(['show','HEAD:'+p]);
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
// v10 (on top of v9, which is HEAD): the Docs deposits sentence starts with a capital letter; Deposit and Redeem show
// an always-visible "Redemptions are open 24/7. Deposit hours apply to deposits only." tag (the Redeem title drops
// "Redemption is always open."); the Stock shelves show no price time on the labels or in the drawer (only a reason-9
// price keeps its "old price" tag), so age() leaves model.ts; the slogan strip's two halves each move as their own Web
// Animation started by Marquee (Scenery.tsx). Every other web/src source is byte-identical to HEAD.
const protectedFiles=['Losses.tsx','poolMath.ts','deployment.ts','vault.abi.json','main.tsx','components.tsx','Owner.tsx','wallet.tsx','governance.ts','chain.ts','newYork.ts'];
for(const f of protectedFiles) assert.equal(read('web/src/'+f),baseline('web/src/'+f),f);
// The v10 files: byte-identical to HEAD once their documented pieces [v10, HEAD] are put back (each exactly once), so
// every word, call and attribute in them is pinned, the 24/7 tag text included. Scenery.tsx: the slogan strip fix, two
// pieces (the react import with the whole Marquee hook that animates the halves, and the track's ref), so the hook
// text is pinned too (check-art.mjs and check-motion.mjs test what it does in the browser).
const editedFiles={
 "Docs.tsx":[
  ["          <p>\n            Deposits open Sunday 8 pm to Friday 8 pm New York time, closed on US\n            market holidays, redemptions always open\n",
   "          <p>\n            deposits open Sunday 8 pm to Friday 8 pm New York time, closed on US\n            market holidays, redemptions always open\n"]
 ],
 "Flows.tsx":[
  ["type Props = { snapshot: Snapshot; wallet: Wallet };\n// Always shown at the top of the Deposit and Redeem forms (open or closed), so\n// nobody reads the deposit hours as redemption hours.\nfunction HoursTag() {\n  return (\n    <p className=\"hours-tag\">\n      <strong>Redemptions are open 24/7.</strong>{\" \"}\n      <span>Deposit hours apply to deposits only.</span>\n    </p>\n  );\n}\nexport function DepositPage({ snapshot: s, wallet: w }: Props) {\n",
   "type Props = { snapshot: Snapshot; wallet: Wallet };\nexport function DepositPage({ snapshot: s, wallet: w }: Props) {\n"],
  ["        <section className=\"panel\">\n          <HoursTag />\n          <DepositState snapshot={s} />\n",
   "        <section className=\"panel\">\n          <DepositState snapshot={s} />\n"],
  ["      >\n        Receive your share of every stock.\n      </PageTitle>\n",
   "      >\n        Receive your share of every stock. Redemption is always open.\n      </PageTitle>\n"],
  ["        <section className=\"panel\">\n          <HoursTag />\n          <h2>Redeem shares</h2>\n",
   "        <section className=\"panel\">\n          <h2>Redeem shares</h2>\n"]
 ],
 "Vault.tsx":[
  ["  usd,\n  pairingMatches,\n",
   "  usd,\n  age,\n  pairingMatches,\n"],
  ["// cents in two digits (\"$669.5\" shows as $669 and 50 cents).\nfunction ShelfPrice({ a, stale }: { a: Asset; stale: boolean }) {\n",
   "// cents in two digits (\"$669.5\" shows as $669 and 50 cents).\n// age() as today, but on the labels under 1 minute reads \"just now\" (the long\n// words wrapped and made the row taller; the drawer keeps age()'s full words)\n// and 48 hours or more reads in days (\"4 days ago\")\nfunction shelfAge(a: Asset): string {\n  const t = age(a.updatedAt);\n  if (!t.endsWith(\" ago\") || a.updatedAt === undefined) return t;\n  const s = Math.floor(Date.now() / 1000 - Number(a.updatedAt));\n  return s < 60 ? \"just now\" : s >= 2 * 86400 ? `${Math.floor(s / 86400)} days ago` : t;\n}\nfunction ShelfPrice({ a, stale }: { a: Asset; stale: boolean }) {\n"],
  ["}\n// No price time on the labels or in the drawer: feeds post only on a 0.5% move\n// or every 24 hours, so an age like \"17h 55m ago\" looked stale when it was not.\n// Only a price the vault refuses as too old (reason 9) gets the \"old price\" tag.\nfunction OldPriceTag({ stale }: { stale: boolean }) {\n  return stale ? (\n    <p className=\"sa-age is-stale\">\n      <span className=\"sa-old\">old price</span>\n    </p>\n  ) : null;\n}\n",
   "}\nfunction PriceAge({ a, stale }: { a: Asset; stale: boolean }) {\n  const t = shelfAge(a);\n  return (\n    <p className={stale ? \"sa-age is-stale\" : \"sa-age\"}>\n      {stale && <span className=\"sa-old\">old price</span>}\n      {stale && \" \"}\n      {t.endsWith(\" ago\") || t === \"just now\" ? (\n        <>\n          {/* narrower labels show a small clock (or nothing) instead of the words; still read out */}\n          <span className=\"sa-upd\">price updated </span>\n          <span className=\"sa-when\">\n            <span className=\"sa-clock\" aria-hidden=\"true\" />\n            {t.charAt(0).toLowerCase() + t.slice(1)}\n          </span>\n        </>\n      ) : (\n        `price time: ${t}`\n      )}\n    </p>\n  );\n}\n"],
  ["            <ShelfPrice a={a} stale={stale} />\n            <OldPriceTag stale={stale} />\n          </div>\n",
   "            <ShelfPrice a={a} stale={stale} />\n            <PriceAge a={a} stale={stale} />\n          </div>\n"],
  ["        <div>\n          <dt>Feed price</dt>\n          <dd>\n",
   "        <div>\n          <dt>Feed price / age</dt>\n          <dd>\n"],
  ["              ? \"unreadable / invalid feed\"\n              : \"$\" + fmt(a.answer, a.feedDecimals)}\n          </dd>\n",
   "              ? \"unreadable / invalid feed\"\n              : \"$\" + fmt(a.answer, a.feedDecimals)}{\" \"}\n            <small>{age(a.updatedAt)}</small>\n          </dd>\n"]
 ],
 "model.ts":[
  ["}\nexport const same = (a?: string, b?: string) =>\n",
   "}\nexport function age(n: bigint | undefined, now = Date.now() / 1000) {\n  if (n === undefined || n === 0n) return \"unreadable\";\n  const s = Math.floor(now - Number(n));\n  return s < 0\n    ? \"Future timestamp\"\n    : s < 60\n      ? \"Less than 1 min ago\"\n      : s < 3600\n        ? `${Math.floor(s / 60)} min ago`\n        : `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ago`;\n}\nexport const same = (a?: string, b?: string) =>\n"]
 ],
 "Scenery.tsx":[
  ["import { useLayoutEffect, useRef } from \"react\";\n\nexport function Marquee() {\n  const trackRef = useRef<HTMLDivElement>(null);\n\n  useLayoutEffect(() => {\n    const halves = Array.from(trackRef.current!.children) as HTMLElement[];\n    const reducedMotion = matchMedia(\"(prefers-reduced-motion: reduce)\");\n    const phone = matchMedia(\"(max-width: 660px)\");\n    let animations: Animation[] = [];\n    let width = 0;\n    let speed = 0;\n\n    const update = () => {\n      const nextWidth = halves[0].getBoundingClientRect().width;\n      const nextSpeed = phone.matches ? 64 : 16;\n      if (reducedMotion.matches) {\n        animations.forEach((animation) => animation.cancel());\n        animations = [];\n        return;\n      }\n      if (\n        !nextWidth ||\n        (animations.length && width === nextWidth && speed === nextSpeed)\n      ) return;\n\n      // Keep the visible phase when resizing or when the web font arrives.\n      const distance = (Number(animations[0]?.currentTime ?? 0) * speed) / 1000;\n      animations.forEach((animation) => animation.cancel());\n      width = nextWidth;\n      speed = nextSpeed;\n      const halfDuration = (width / speed) * 1000;\n      const elapsed = ((distance % width) / speed) * 1000;\n      const startTime = Number(document.timeline.currentTime) - elapsed;\n\n      animations = halves.map((half, index) => {\n        // The two halves share a clock. Each wraps only outside the window;\n        // Web Animations don't dispatch CSS animationiteration events to React.\n        const animation = half.animate(\n          [\n            { transform: \"translateX(100%)\" },\n            { transform: \"translateX(-100%)\" },\n          ],\n          {\n            duration: halfDuration * 2,\n            delay: index === 0 ? -halfDuration : 0,\n            iterations: Infinity,\n            easing: \"linear\",\n          },\n        );\n        animation.startTime = startTime;\n        return animation;\n      });\n    };\n\n    const observer = new ResizeObserver(update);\n    observer.observe(halves[0]);\n    reducedMotion.addEventListener(\"change\", update);\n    phone.addEventListener(\"change\", update);\n    update();\n    return () => {\n      observer.disconnect();\n      reducedMotion.removeEventListener(\"change\", update);\n      phone.removeEventListener(\"change\", update);\n      animations.forEach((animation) => animation.cancel());\n    };\n  }, []);\n\n  return (\n",
   "export function Marquee() {\n  return (\n"],
  ["      <div aria-hidden=\"true\" className=\"marquee-window\">\n        <div className=\"marquee-track\" ref={trackRef}>\n          {[0, 1].map((half) => (\n",
   "      <div aria-hidden=\"true\" className=\"marquee-window\">\n        <div className=\"marquee-track\">\n          {[0, 1].map((half) => (\n"]
 ]
};
for(const [f,edits] of Object.entries(editedFiles)){
 let text=read('web/src/'+f);
 for(const [n,o] of edits){assert.equal(text.split(n).length,2,f+': expected once: '+n);text=text.split(n).join(o);}
 assert.equal(text,baseline('web/src/'+f),f+' changed beyond the documented edit');
}
// Calls that build, encode, simulate or send a transaction (or parse its arguments) or read the chain.
const names=new Set(['vault','token','feed','read','many','simulate','verifyNetwork','encode','depositArgs','redeemArgs','w.send','p.request',
 'safe','proposalSpec','proposalAction','settingValues','poolValues','parseLaunch','encodeFunctionData','client.call','client.estimateGas',
 'client.getTransactionCount','client.waitForTransactionReceipt','address','recipient','amount','uint']);
const actionAttributes=new Set(['onClick','onSubmit','onChange','getSpec','disabled','disabledReason','label','scope','role','primary','value','claim','reason','build']);
// A6 G-A: wallet sends and raw provider requests in any form are guarded calls too: a callee ending in one of these
// names (any receiver, optional chaining, casts, element access, string folding) or naming the provider (ethereum).
const SEND=new Set(['send','request','sendTransaction','sendRawTransaction','writeContract','sendAsync','sendCalls','signTransaction','sendUnsignedTransaction']);
const lit=n=>ts.isStringLiteralLike(n)?n.text:ts.isParenthesizedExpression(n)?lit(n.expression):ts.isBinaryExpression(n)&&n.operatorToken.kind===ts.SyntaxKind.PlusToken&&lit(n.left)!==undefined&&lit(n.right)!==undefined?lit(n.left)+lit(n.right):undefined;
const unwrap=n=>ts.isParenthesizedExpression(n)||ts.isNonNullExpression(n)||ts.isAsExpression(n)||ts.isTypeAssertionExpression(n)||ts.isSatisfiesExpression?.(n)?unwrap(n.expression):n;
const calleeName=c=>{const e=unwrap(c.expression);return ts.isIdentifier(e)?e.text:ts.isPropertyAccessExpression(e)?e.name.text:ts.isElementAccessExpression(e)?lit(e.argumentExpression):undefined;};
const isGuarded=(n,tree)=>ts.isCallExpression(n)&&(names.has(n.expression.getText(tree))||SEND.has(calleeName(n))||/ethereum|(^|[.?\]])\s*(send|request|sendTransaction|sendRawTransaction|writeContract)\b/.test(n.expression.getText(tree)));
function calls(text,file) {
 const tree=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS),found=[],all=[],attributes=[];
 const printer=ts.createPrinter({removeComments:true});
 const print=n=>printer.printNode(ts.EmitHint.Unspecified,n,tree).replace(/\s+/g,' ');
 const guardedIn=node=>{const g=[];(function v(n){if(isGuarded(n,tree))g.push(print(n));ts.forEachChild(n,v);})(node);return g;};
 function where(attr){const owner=attr.parent.parent,tag=owner.tagName?.getText(tree)??'?';const named=attr.parent.properties.find(p=>ts.isJsxAttribute(p)&&['title','label','scope'].includes(p.name.getText(tree))&&p.initializer);return tag+(named?' '+named.name.getText(tree)+'='+named.initializer.getText(tree).replace(/\s+/g,' ').slice(0,60):'');}
 function visit(n){
  if(ts.isCallExpression(n)){all.push(print(n));if(isGuarded(n,tree))found.push(print(n));}
  if(ts.isJsxAttribute(n)&&actionAttributes.has(n.name.getText(tree)))attributes.push({name:n.name.getText(tree),text:print(n),guarded:guardedIn(n),where:where(n)});
  ts.forEachChild(n,visit);
 }
 visit(tree);return {found,all,attributes};
}
// Remove the first occurrence of each listed item; every listed item must be present.
function without(list,items,what){const rest=[...list];for(const x of items){const i=rest.indexOf(x);assert.ok(i>=0,what+': expected '+x);rest.splice(i,1);}return rest;}
// Guarded calls: v10 changes none, so in every file they equal HEAD in order (no documented difference).
const expected={};
const putBack=(text,pieces,what)=>{for(const [n,o] of pieces){assert.equal(text.split(n).length,2,what+': expected once: '+n);text=text.split(n).join(o);}return text;};
// Every call expression must equal HEAD in these files, with no exception in v10.
const allCallsEqual={'components.tsx':[], 'Docs.tsx':[], 'Flows.tsx':[]};
// Vault.tsx (the Stock shelves labels): no read, check or send call at all (no guarded call here, and no send or
// request in the scan below). Its action attributes equal HEAD's and this pinned list, in page order: the Retry vault
// button and the vault, Stock Token and price feed address links, plus the shelves' controls (label Details, drawer
// Close, filters, search, Show all), which only change what is shown. v10 changes none of them (only label and
// drawer words). The StockShelves handlers behind those controls are pinned too.
const vaultAttributes=['onClick={s.retry}','value={VAULT}','onClick={onToggle}','onClick={onClose}','value={a.token}','value={a.feed}','role="list"','role="group"','onClick={() => show(f, search)}','value={search}','onChange={(e) => show(filter, e.target.value)}','role="status"','onClick={() => show("all", "")}','onClick={() => show("all", "")}'];
const vaultHandlers={
 show:'const show = (f: ShelfFilter, text: string) => { stopRestock(); setOpenToken(undefined); setFilter(f); setSearch(text); };',
 toggle:'const toggle = (token: string) => setOpenToken(openToken === token ? undefined : token);',
 close:'const close = (token: string) => { setOpenToken(undefined); requestAnimationFrame(() => document.getElementById(`sa-more-${token}`)?.focus()); };',
 group:'const group = { nav, settings: s.globals.settings, openToken, onToggle: toggle, onClose: close };'};
// The variable statements declaring `list` inside the top-level function `fn`, printed without comments (one each).
function localDeclarations(file,text,fn,list){
 const tree=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),printer=ts.createPrinter({removeComments:true}),out={};
 const f=tree.statements.filter(st=>ts.isFunctionDeclaration(st)&&st.name?.text===fn);
 assert.equal(f.length,1,file+': one '+fn);
 (function v(n){if(ts.isVariableStatement(n))for(const d of n.declarationList.declarations)if(ts.isIdentifier(d.name)&&list.includes(d.name.text)){assert.ok(!out[d.name.text],file+': one '+d.name.text+' in '+fn);out[d.name.text]=printer.printNode(ts.EmitHint.Unspecified,n,tree).replace(/\s+/g,' ');}ts.forEachChild(n,v);})(f[0]);
 return out;
}
const sources=git(['ls-tree','-r','--name-only','HEAD','web/src']).trim().split('\n').filter(p=>/\.tsx?$/.test(p)).map(p=>p.slice(8));
assert.deepEqual(git(['ls-files','--cached','--others','--exclude-standard','web/src']).trim().split('\n').filter(p=>/\.tsx?$/.test(p)).map(p=>p.slice(8)).sort(),[...sources].sort(),'No source file added or removed');
// Every source is either frozen (byte-identical to HEAD) or a v10 file with its documented pieces (above).
assert.deepEqual([...sources].sort(),[...protectedFiles,...Object.keys(editedFiles)].filter(f=>/\.tsx?$/.test(f)).sort(),'every web/src source is frozen or a documented v10 file');
const counts={};
for(const f of sources){
 const old=calls(baseline('web/src/'+f),f),now=calls(read('web/src/'+f),f),e=expected[f];
 if(e) assert.deepEqual(without(now.found,e.added,f),without(old.found,e.removed,f),f+' changed guarded calls beyond the documented ones');
 else assert.deepEqual(now.found,old.found,f+' changed calldata/read/check call expressions');
 // Action/send/check attributes: equal HEAD in every file, in order (no exception in v10).
 assert.equal(now.attributes.length,old.attributes.length,f+' action attribute count');
 assert.deepEqual(now.attributes.map((a,i)=>[old.attributes[i],a]).filter(([o,a])=>o.text!==a.text).map(([,a])=>a.where+': '+a.text),[],f+' changed an action, send or check attribute');
 if(f==='Vault.tsx'){
  assert.deepEqual(now.found,[],'Vault.tsx makes no read, check or send call');
  assert.deepEqual(now.attributes.map(a=>a.text),vaultAttributes,'Vault.tsx action attributes differ from the pinned Stock shelves controls');
  for(const a of now.attributes) assert.deepEqual(a.guarded,[],'Vault.tsx '+a.where+': guarded call in an attribute');
  const h=localDeclarations('web/src/Vault.tsx',read('web/src/Vault.tsx'),'StockShelves',Object.keys(vaultHandlers));
  for(const [k,v] of Object.entries(vaultHandlers)) assert.equal(h[k],v,'Vault.tsx StockShelves '+k+' differs from the pinned text');
 }
 if(allCallsEqual[f]){
  const pairs=allCallsEqual[f];
  assert.deepEqual(now.all,old.all.map(x=>pairs.find(p=>p[0]===x)?.[1]??x),f+' changed a call expression');
 }
 counts[f]={guarded:now.found.length,calls:now.all.length,attributes:now.attributes.length};
}
// A6 G-A: no web/src file gains, loses or changes a wallet send or raw request, with no exception. Listed in order per
// file: every use of a send/request name or of the provider (ethereum), with the call around it; every string that
// names a sending or signing method (folded across +); computed access to the global object; eval, Function, Reflect.
const SEND_TEXT=/eth_send|eth_sign|personal_sign|wallet_send|signtypeddata|sendtransaction|sendrawtransaction|writecontract|^(send|request|ethereum)$/i;
const ESCAPES=new Set(['ethereum','eval','Function','Reflect','globalThis']),GLOBAL=new Set(['window','globalThis','self','top','parent','frames']);
function sendsOf(text,file){
 const tree=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS),printer=ts.createPrinter({removeComments:true}),out=[];
 const print=n=>printer.printNode(ts.EmitHint.Unspecified,n,tree).replace(/\s+/g,' ');
 const wraps=(p,n)=>(ts.isPropertyAccessExpression(p)||ts.isElementAccessExpression(p)||ts.isCallExpression(p))&&p.expression===n||ts.isNonNullExpression(p)||ts.isParenthesizedExpression(p)||ts.isAsExpression(p)||ts.isTypeAssertionExpression(p)||!!ts.isSatisfiesExpression?.(p);
 const top=n=>{if(n.parent&&ts.isPropertyAccessExpression(n.parent)&&n.parent.name===n)n=n.parent;while(n.parent&&wraps(n.parent,n))n=n.parent;return n;};
 (function v(n){
  const s=lit(n);
  if(ts.isIdentifier(n)&&(SEND.has(n.text)||ESCAPES.has(n.text)))out.push(print(top(n)));
  else if(ts.isElementAccessExpression(n)&&GLOBAL.has(unwrap(n.expression).getText(tree))&&lit(n.argumentExpression)===undefined)out.push(print(n));
  else if(s!==undefined&&!(n.parent&&lit(n.parent)!==undefined)&&SEND_TEXT.test(s))out.push(print(top(n)));
  else if((ts.isTemplateExpression(n)||ts.isNoSubstitutionTemplateLiteral(n))&&SEND_TEXT.test(ts.isTemplateExpression(n)?n.head.text+n.templateSpans.map(x=>x.literal.text).join(''):n.text))out.push(print(n));
  ts.forEachChild(n,v);
 })(tree);
 return out;
}
const NO_SEND=['Vault.tsx','Scenery.tsx','main.tsx','Docs.tsx'],sendUses={};
for(const f of sources){
 const h=sendsOf(baseline('web/src/'+f),f),n=sendsOf(read('web/src/'+f),f);
 assert.deepEqual(n,h,f+': a wallet send, provider request or signing method was added, removed or changed');
 if(NO_SEND.includes(f))assert.ok(n.every(x=>x==='window.ethereum'),f+' must contain no send or request (only the read of window.ethereum in main.tsx)');
 if(n.length)sendUses[f]=n;
}
// components.tsx (the shared transaction button) keeps exactly HEAD's single wallet.send.
assert.deepEqual(sendUses['components.tsx'].filter(x=>/\(/.test(x)),['wallet.send(await getSpec(), scope, scope)'],'components.tsx sends');
// wallet.tsx send(), the only function that prompts the wallet: printed without comments it must equal HEAD (v10
// documents no piece), so from, to, data, gas (estimate x 1.3), nonce, the chain and account rechecks, the simulation
// and the eth_sendTransaction request are unchanged.
const sendEdits=[];
function sendText(text){
 const tree=ts.createSourceFile('wallet.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),printer=ts.createPrinter({removeComments:true});let out;
 (function v(n){if(ts.isFunctionDeclaration(n)&&n.name?.text==='send')out=printer.printNode(ts.EmitHint.Unspecified,n,tree).replace(/\s+/g,' ');ts.forEachChild(n,v);})(tree);
 assert.ok(out,'wallet.tsx send() found');return out;
}
let sendNow=sendText(read('web/src/wallet.tsx'));
for(const [n,o] of sendEdits){assert.equal(sendNow.split(n).length,2,'wallet.tsx send(): expected once: '+n);sendNow=sendNow.split(n).join(o);}
assert.equal(sendNow,sendText(baseline('web/src/wallet.tsx')),'wallet.tsx send() changed (v10 changes nothing in it)');
// Differential encoding: HEAD and current governance/model/chain bundled side by side. For the same inputs the
// calldata must be byte-identical whenever the current page accepts; v10 adds no refusal, never accepts what HEAD
// refused, and refuses with HEAD's words.
const scratch=path.join(root,'test/scratch/calldata');
fs.rmSync(scratch,{recursive:true,force:true});
for(const p of git(['ls-tree','-r','--name-only','HEAD','web/src']).trim().split('\n').filter(p=>/\.(tsx?|json)$/.test(p))){
 const out=path.join(scratch,'head',p.slice(4));fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,baseline(p));
}
const entry=src=>`export { proposalSpec, proposalAction } from "${src}/governance";\nexport { parseLaunch, address, recipient, amount, uint, deadline, depositArgs, redeemArgs } from "${src}/model";\nexport { encode, vault, token, VAULT } from "${src}/chain";\nexport { newOwner } from "${src}/governance";\n`;
fs.writeFileSync(path.join(scratch,'head-entry.ts'),entry('./head/src'));
fs.writeFileSync(path.join(scratch,'now-entry.ts'),entry('../../../web/src'));
const bundle=async name=>{const outfile=path.join(scratch,name+'.mjs');await build({entryPoints:[path.join(scratch,name+'-entry.ts')],bundle:true,format:'esm',platform:'node',outfile,nodePaths:[path.resolve('node_modules')],logLevel:'error'});return import(pathToFileURL(outfile).href);};
const head=await bundle('head'),now=await bundle('now');
const SPRING='Sunday 2:00-2:59 am New York is skipped on the spring-forward Sunday; choose another start.';
const U128='Minimum raw pool liquidity: enter an unsigned 128-bit whole number.';
const V=now.VAULT,A='0x1111111111111111111111111111111111111111',B='0x2222222222222222222222222222222222222222',Z='0x0000000000000000000000000000000000000000';
const badChecksum='0x'+V.slice(2).replace(/[a-f]/,c=>c.toUpperCase());
const addrs=[A,B,V,V.toUpperCase().replace('0X','0x'),Z,'bad','',badChecksum];
const liqs=['0','1','1000000',String(2n**128n-1n),String(2n**128n),String(2n**200n),String(2n**256n-1n),String(2n**256n),'-1','1.5',' 7',''];
const hourTexts=['Monday 9:30 am','Friday 4:00 pm','Sunday 8:00 pm','Saturday 24:00','Sunday 12:00 am','Sunday 1:59 am','Sunday 2:00 am','Sunday 2:30 am','Sunday 2:59 am','Sunday 3:00 am','Always open','Monday 24:00','junk'];
const values=['0','1','2','3','4','10','48','49','50','299','300','2000','3600','20000','86400','500000','500001',String(2n**256n-1n),String(2n**256n),'1.5',''];
const settingsList=[undefined,{dst:0n},{dst:1n},{dst:2n}];
const cases=[];
for(const token of [A,V,Z,'bad'])for(const feed of [B,V,Z])for(const pool of [A,V,Z])for(const quoteFeed of [B,Z])for(const minLiquidity of liqs)cases.push([0,{token,feed,pool,quoteFeed,minLiquidity}]);
for(const token of addrs)for(const feed of addrs)cases.push([1,{token,feed}]);
for(const k of [2,3,4,6])for(const token of addrs)cases.push([k,{token}]);
for(const token of [A,V,'bad'])for(const pool of [A,V,Z])for(const quoteFeed of [B,Z])for(const minLiquidity of liqs)cases.push([5,{token,pool,quoteFeed,minLiquidity}]);
for(const next of addrs)cases.push([7,{next}]);
for(const cap of ['0','1','1.5','10000000000','10000000000.000000000000000001','x',''])cases.push([8,{cap}]);
for(const recipient of addrs)cases.push([9,{recipient}]);
for(let k=0;k<=16;k++)if(k!==5)for(const value of values)cases.push([10,{setting:String(k),value}]);
for(const from of hourTexts)for(const to of hourTexts)for(const settings of settingsList)cases.push([10,{setting:'5',from,to},settings]);
for(const k of [11,-1])cases.push([k,{}]);
const attempt=f=>{try{return {hex:f()};}catch(e){return {error:e.message};}};
const tally={sameCalldata:0,bothRefused:0,newRefusals:{},refusedBoth:{}};
function compare(label,input,h,n,newRefusalAllowed,t=tally){
 if(n.hex!==undefined){assert.ok(h.hex!==undefined,label+' accepted input HEAD refused: '+JSON.stringify(input));assert.equal(n.hex,h.hex,label+' calldata changed for '+JSON.stringify(input));t.sameCalldata++;}
 else if(h.hex!==undefined){assert.ok(newRefusalAllowed(n.error),label+' new refusal not documented: '+n.error+' for '+JSON.stringify(input));t.newRefusals[n.error]=(t.newRefusals[n.error]||0)+1;}
 else {assert.equal(n.error,h.error,label+' refusal words changed for '+JSON.stringify(input));t.bothRefused++;if(t.refusedBoth)t.refusedBoth[n.error]=(t.refusedBoth[n.error]||0)+1;}
}
const json=x=>JSON.parse(JSON.stringify(x,(k,v)=>typeof v==='bigint'?String(v):v));
for(const [kind,v,settings] of cases){
 const h=attempt(()=>head.encode(head.proposalSpec(kind,v,settings))),n=attempt(()=>now.encode(now.proposalSpec(kind,v,settings)));
 compare('propose',json({kind,v,settings}),h,n,()=>false);
}
for(const next of addrs)compare('transferOwnership',{next},attempt(()=>head.encode(head.vault('transferOwnership',[head.newOwner(next)]))),attempt(()=>now.encode(now.vault('transferOwnership',[now.newOwner(next)]))),()=>false);
for(const pool of [A,Z])for(const quoteFeed of [B,Z])for(const minLiquidity of liqs){
 const text=`AAA ${A} ${B} ${pool} ${quoteFeed} ${minLiquidity}\nBBB ${B} ${A} ${Z} ${Z} 0`;
 const listing=m=>m.parseLaunch(text).map(r=>m.encode(m.vault('listGenesis',[r.token,r.feed,r.pool,r.quoteFeed,r.minLiquidity]))).join();
 compare('listGenesis',{text},attempt(()=>listing(head)),attempt(()=>listing(now)),()=>false);
}
// Deposit, redeem, claim, approve and owner-button calls built from the model parsers, compared under fixed clocks so
// deadline() (the clock plus 600 s, the last argument of every deposit and redeem) is compared too. Here no new
// refusal is allowed: every input must give the same calldata as HEAD or be refused by both.
const sends={},clock=Date.now;
const cmp=(label,input,f)=>compare(label,input,attempt(()=>f(head)),attempt(()=>f(now)),()=>false,sends[label]??={sameCalldata:0,bothRefused:0,newRefusals:{}});
const clocks=[0,999,1791000000000,1791000000999,1791006123456.7,4102444800000];
const amountTexts=['0','1','1.5','0.000001','0.0000001','1.000000000000000001','1.0000000000000000001','10000000000',
 '115792089237316195423570985008687907853269984665640564039457.584007913129639935','115792089237316195423570985008687907853269984665640564039457.584007913129639936',
 String(2n**256n-1n),String(2n**256n),' 2 ','2.','.5','-1','1e18','x',''];
const legsList=[[],[0n],[0n,3333n],[1n,999n,1000n,10n**18n,2n**200n]];
const depositInputs=[[[A,B],[1n,2n],A,1000n],[[A],[0n],B,0n],[[B,A,V],[10n**18n,3n,2n**255n],A,2n**256n-1n],[[],[],A,999n]];
try{
 for(const t of clocks){
  Date.now=()=>t;
  assert.equal(String(now.deadline()),String(head.deadline()),'deadline() at clock '+t);
  for(const args of depositInputs){
   assert.deepEqual(json(now.depositArgs(...args)),json(head.depositArgs(...args)),'depositArgs (all five arguments, deadline included) at clock '+t);
   cmp('deposit',json({clock:t,args}),m=>m.encode(m.vault('deposit',m.depositArgs(...args))));
  }
  for(const shares of [0n,10n,2n**256n-1n])for(const legs of legsList){
   assert.deepEqual(json(now.redeemArgs(shares,A,legs)),json(head.redeemArgs(shares,A,legs)),'redeemArgs (all four arguments, deadline included) at clock '+t);
   cmp('redeemArgs',json({clock:t,shares,legs}),m=>m.encode(m.vault('redeem',m.redeemArgs(shares,A,legs))));
  }
 }
 Date.now=()=>1791000000000;
 // Redeem as Flows builds it: amount(input) shares, recipient(to), redeemArgs(shares, receiver, previewRedeem amounts).
 for(const text of amountTexts)for(const to of addrs)for(const legs of legsList.slice(1,3))
  cmp('redeem',json({text,to,legs}),m=>m.encode(m.vault('redeem',m.redeemArgs(m.amount(text),m.recipient(to),legs))));
 // Deposit amounts (amount(input, false, tokenDecimals)) and the approve built from them.
 for(const text of amountTexts)for(const d of [0,6,8,18])cmp('approve',{text,d},m=>m.encode(m.token(A,'approve',[m.VAULT,m.amount(text,false,d)])));
 // Claim and Claim all: vault("claim", [tokens, recipient(to)]).
 for(const to of addrs)for(const tokens of [[A],[A,B],Array(10).fill(B)])cmp('claim',{to,tokens},m=>m.encode(m.vault('claim',[tokens,m.recipient(to)])));
 // Owner buttons: lowerNAVCap(amount(cap, true)), close and removeRetired(address(token)).
 for(const text of amountTexts)cmp('lowerNAVCap',{text},m=>m.encode(m.vault('lowerNAVCap',[m.amount(text,true)])));
 for(const fn of ['close','removeRetired'])for(const v of addrs)cmp(fn,{v},m=>m.encode(m.vault(fn,[m.address(v)])));
 // The parsers' values themselves.
 for(const v of [...liqs,...amountTexts])for(const bits of [128,256])cmp('uint',{v,bits},m=>String(m.uint(v,bits)));
 for(const v of addrs)for(const zero of [false,true])cmp('address',{v,zero},m=>m.address(v,zero));
}finally{Date.now=clock;}
for(const [label,t] of Object.entries(sends)){
 assert.ok(t.sameCalldata>0,label+': corpus has accepted inputs');
 if(!['deposit','redeemArgs'].includes(label))assert.ok(t.bothRefused>0,label+': corpus has refused inputs');
}
// The transaction-argument builders and parsers, printed without comments, also equal HEAD.
const pinned={'web/src/model.ts':['same','deadline','depositArgs','redeemArgs','amount','address','recipient','uint','parseLaunch'],'web/src/chain.ts':['vault','token','encode']};
function declarations(file,text,list){
 const tree=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS),printer=ts.createPrinter({removeComments:true}),out={};
 for(const st of tree.statements){
  if(ts.isFunctionDeclaration(st)&&st.name&&list.includes(st.name.text))out[st.name.text]=printer.printNode(ts.EmitHint.Unspecified,st,tree);
  if(ts.isVariableStatement(st))for(const d of st.declarationList.declarations)if(ts.isIdentifier(d.name)&&list.includes(d.name.text))out[d.name.text]=printer.printNode(ts.EmitHint.Unspecified,st,tree);
 }
 // Functions inside components (checkRows in LaunchListing): any depth, exactly one declaration.
 (function v(n){if(n!==tree&&ts.isFunctionDeclaration(n)&&n.name&&list.includes(n.name.text)&&n.parent!==tree){assert.ok(!out[n.name.text],file+': one '+n.name.text);out[n.name.text]=printer.printNode(ts.EmitHint.Unspecified,n,tree);}ts.forEachChild(n,v);})(tree);
 for(const n of list)assert.ok(out[n],file+': '+n+' found');
 return out;
}
for(const [file,list] of Object.entries(pinned)){
 const n=declarations(file,read(file),list),h=declarations(file,baseline(file),list);
 for(const k of list)assert.equal(n[k],h[k],file+': '+k+' changed');
}
// A6 G-B: where the send arguments come from. Printed without comments (whitespace folded), each declaration equals
// HEAD (v10 documents no piece: [v10, HEAD] lists are empty), or equals the pinned v9 text: the Guardian and
// FeeRecipient proposal targets (newGuardian(v.next), feeRecipient(v.recipient)), the parsers they use, and the
// listing rows (checkRows) and the Finalize helpers.
const pinnedV9={
 'web/src/governance.ts':{
  proposalAction:[],
  proposalSpec:[],
  settingValues:[],
  poolValues:[],
  newOwner:'export function newOwner(v: string): Address { const next = address(v); if (same(next, VAULT)) throw new InputError("The new owner must not be the vault."); return next; }',
  newGuardian:'function newGuardian(v: string): Address { const next = address(v); if (same(next, VAULT)) throw new InputError("The new guardian must not be the vault."); return next; }',
  feeRecipient:'function feeRecipient(v: string): Address { const target = address(v); if (same(target, VAULT)) throw new InputError("The fee recipient must not be the vault."); return target; }',
  minLiquidityOf:'function minLiquidityOf(v: string) { try { return uint(v, 128); } catch { throw new InputError("Minimum raw pool liquidity: enter an unsigned 128-bit whole number."); } }',
  springForwardStart:'export function springForwardStart(from: bigint, dst: bigint) { return dst === 0n && from >= 7200n && from < 10800n; }',
  SPRING_FORWARD_START:'export const SPRING_FORWARD_START = "Sunday 2:00-2:59 am New York is skipped on the spring-forward Sunday; choose another start.";'},
 'web/src/Owner.tsx':{
  checkRows:[],
  listedDiffers:'function listedDiffers(assets: Asset[], r: ReturnType<typeof parseLaunch>[number]) { const a = assets.find((x) => same(x.token, r.token)); return (!!a && (!same(a.feed, r.feed) || !same(a.pool, r.pool) || !same(a.quoteFeed, r.quoteFeed) || a.minLiquidity !== r.minLiquidity)); }',
  differWords:'const differWords = (tickers: string[]) => `Listed with other values than the pasted lines: ${tickers.join(", ")}. Check pairings shows which field; paste the lines that were listed.`;',
  PASTE_FIRST:'const PASTE_FIRST = "Paste the listing rows first so the page can check none is missing.";'},
};
const one=s=>s.replace(/\s+/g,' ');
// The v9 text, as pinned, also stands at HEAD.
for(const [file,map] of Object.entries(pinnedV9)){
 const h=declarations(file,baseline(file),Object.keys(map));
 for(const [k,x] of Object.entries(map))if(typeof x==='string')assert.equal(one(h[k]),x,file+': '+k+' at HEAD differs from the pinned v9 text');
}
for(const [file,map] of Object.entries(pinnedV9)){
 const list=Object.keys(map),n=declarations(file,read(file),list),old=list.filter(k=>typeof map[k]!=='string'),h=declarations(file,baseline(file),old);
 for(const k of list)assert.equal(typeof map[k]==='string'?one(n[k]):putBack(one(n[k]),map[k],file+' '+k),typeof map[k]==='string'?map[k]:one(h[k]),file+': '+k+' differs from the pinned v9 text');
}
// The names those closures call are bound once, by the import from the module that defines them (no local
// declaration in any scope can stand in for newOwner, vault, read, ...).
const imports={'web/src/Owner.tsx':{newOwner:'./governance',inspectListing:'./governance',proposalSpec:'./governance',vault:'./chain',read:'./chain',InputError:'./chain',address:'./model',same:'./model',parseLaunch:'./model',loadSnapshot:'./model',TransactionCancelled:'./wallet'},
 'web/src/governance.ts':{vault:'./chain',VAULT:'./chain',InputError:'./chain',address:'./model',same:'./model',uint:'./model',amount:'./model'}};
for(const [file,map] of Object.entries(imports)){
 const tree=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS),bound={};
 (function v(n){
  const id=n.name&&ts.isIdentifier(n.name)&&(ts.isVariableDeclaration(n)||ts.isFunctionDeclaration(n)||ts.isFunctionExpression(n)||ts.isParameter(n)||ts.isBindingElement(n)||ts.isClassDeclaration(n)||ts.isImportSpecifier(n)||ts.isNamespaceImport(n)||ts.isImportClause(n))?n.name.text:undefined;
  if(id&&map[id])(bound[id]??=[]).push(ts.isImportSpecifier(n)&&!n.propertyName?n.parent.parent.parent.moduleSpecifier.text:'local '+ts.SyntaxKind[n.kind]);
  ts.forEachChild(n,v);
 })(tree);
 for(const [k,m] of Object.entries(map))assert.deepEqual(bound[k],[m],file+': '+k+' is bound only by its import from '+m);
}
assert.equal(now.VAULT,head.VAULT,'the vault address the encoders use');
// The v9 refusals (uint128 minLiquidity, vault as guardian or new owner, Sunday 2:00-2:59 am start under Dst 0) are
// still made, by HEAD and now alike, and v10 adds none.
for(const m of [U128,'The new guardian must not be the vault.','The new owner must not be the vault.',SPRING]) assert.ok(tally.refusedBoth[m]>0,'corpus exercises (refused by HEAD and now alike): '+m);
assert.deepEqual(tally.newRefusals,{},'no new refusal');
assert.ok(tally.sameCalldata>400,'corpus size '+JSON.stringify(tally));
fs.rmSync(scratch,{recursive:true,force:true});
fs.writeFileSync('../artifacts/calldata-comparison.json',JSON.stringify({result:'PASS',baseline:git(['rev-parse','HEAD']).trim(),protectedFiles,editedFiles:Object.fromEntries(Object.entries(editedFiles).map(([f,x])=>[f,x.length+' documented pieces [v10, HEAD]'])),v10Pieces:editedFiles,counts,
 documentedGuardedCallChanges:expected,vaultStockShelves:{attributes:vaultAttributes,handlers:vaultHandlers},walletSendDocumentedPieces:sendEdits.map(([now,head])=>({now,head})),
 differentialEncoding:{cases:cases.length,...tally},sendBuilders:{clocks,...sends},pinnedDeclarations:pinned,
 sendsAndRequests:{sendFreeFiles:NO_SEND,usesPerFile:Object.fromEntries(Object.entries(sendUses).map(([f,x])=>[f,x.length])),components:sendUses['components.tsx'].filter(x=>/\(/.test(x))},
 pinnedV9Declarations:Object.fromEntries(Object.entries(pinnedV9).map(([f,m])=>[f,Object.fromEntries(Object.entries(m).map(([k,x])=>[k,typeof x==='string'?'v9 text (also at HEAD)':'equal to HEAD ('+x.length+' pieces)']))])),importBindings:imports,
 checks:['v10 scope: Losses, poolMath, deployment, the ABI, main, components, Owner, wallet, governance, chain and newYork byte-identical to HEAD; Docs.tsx, Flows.tsx, Vault.tsx and model.ts byte-identical to HEAD once their documented v10 pieces are put back (Docs: capital D; Flows: the HoursTag "Redemptions are open 24/7. Deposit hours apply to deposits only." at the top of the Deposit and Redeem forms and "Redemption is always open." out of the Redeem title; Vault: no price time on the labels or in the drawer, the reason-9 "old price" tag kept; model: age() removed); Scenery.tsx byte-identical to HEAD once its two slogan strip pieces are put back (the react import with the Marquee hook that runs each half as its own Web Animation, and the track ref); no source file added or removed',
  'Every vault/token/feed/read call, transaction argument parser, encoding, simulation and send (guarded names) in every web/src source equals the HEAD AST in order (v10 changes none)',
  'Action/send/check JSX attributes equal HEAD in every file, in order (v10 changes none); Vault.tsx has no guarded call at all, its attributes equal the pinned list (Retry vault button and address links plus the Stock shelves controls, none with a guarded call) and its StockShelves handlers equal their pinned text',
  'Wallet sends and raw requests: in every web/src file the uses of a send/request name or of the provider (ethereum) with their calls, every string naming a sending or signing method, computed access to the global object and eval/Function/Reflect equal HEAD in order, with no exception; Vault, Scenery, main and Docs have no send or request (main only reads window.ethereum), components keeps the single wallet.send of HEAD',
  'Argument sources: governance.ts proposalAction (Guardian target newGuardian(v.next), FeeRecipient target feeRecipient(v.recipient)), proposalSpec, settingValues and poolValues equal HEAD; newOwner, newGuardian, feeRecipient, minLiquidityOf and the spring-forward rule equal the pinned v9 text (at HEAD and now); Owner.tsx checkRows equals HEAD and the Finalize helpers equal the pinned v9 text; the names these call are bound only by their imports; the encoders use the same vault address',
  'wallet.tsx send() (the only wallet prompt) equals HEAD: from, to, data, gas, nonce, chain and account rechecks, simulation and the eth_sendTransaction request unchanged',
  'Every call expression in components.tsx, Docs.tsx and Flows.tsx equals HEAD (the 24/7 tag is markup only)',
  'Differential encoding of HEAD and current governance/model/chain: identical calldata for every input the page accepts (proposals of every kind, transfer ownership, genesis listing); no new refusal, nothing HEAD refused is accepted, and every refusal has HEAD\'s words (the v9 refusals, uint128 minLiquidity, vault as guardian or new owner, Sunday 2:00-2:59 am start under Dst 0, are still made by both)',
  'Under six fixed clocks: deadline() and the full depositArgs and redeemArgs tuples (deadline included) equal HEAD, and so does the encoded deposit and redeem calldata; redeem built as Flows does (amount, recipient, redeemArgs), approve (amount with 0/6/8/18 decimals), claim (recipient), lowerNAVCap (amount, zero allowed), close and removeRetired (address), and the uint and address parsers give the same value or are refused by both, with no new refusal',
  'The printed text (no comments) of same, deadline, depositArgs, redeemArgs, amount, address, recipient, uint and parseLaunch in model.ts and of vault, token and encode in chain.ts equals HEAD',
  'Only the v10 files change in web/src (check-bundle.mjs)']},null,2)+'\n');
console.log('PASS baseline call-expression comparison',counts,'differential encoding',tally,'send builders',sends);

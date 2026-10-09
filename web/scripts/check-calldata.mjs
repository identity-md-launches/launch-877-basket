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
// v9 (look update + low fixes F1-F16). Byte-identical to HEAD: the pages left alone and everything that defines
// the vault address, its code hash, its ABI and the pool arithmetic.
const protectedFiles=['Losses.tsx','poolMath.ts','deployment.ts','vault.abi.json'];
for(const f of protectedFiles) assert.equal(read('web/src/'+f),baseline('web/src/'+f),f);
// main.tsx and Scenery.tsx: byte-identical to HEAD once the one documented edit is put back (each piece exactly once):
// A4 the footer tagline removed; A2 eight slogan lines per strip half instead of four.
const TAGLINE=['Stock','Tokens.','One','basket.'].join(' ');
const editedFiles={
 'main.tsx':[['<strong>Basket Protocol</strong>\n          <span className="footer-links">','<strong>Basket Protocol</strong>\n          <span>'+TAGLINE+'</span>\n          <span className="footer-links">']],
 'Scenery.tsx':[['{Array.from({ length: 8 }, (_, i) => (','{Array.from({ length: 4 }, (_, i) => (']],
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
// Exact, documented differences of the guarded calls (everything else must equal HEAD, in order).
const expected={
 'governance.ts':{fix:'F1, F15, F16',why:'F1 minLiquidity parsed as uint128 (uint(v, 128) in minLiquidityOf); F16 address(v) in newOwner/newGuardian/feeRecipient (address() plus a refusal of the vault); F15 the current settings() passed down only to refuse a Sunday 2:00-2:59 am Hours start under Dst 0. The Action fields and the propose call are otherwise unchanged (see the differential encoding below).',
  removed:['uint(v.minLiquidity)','address(v.next)','recipient(v.recipient)','settingValues(v)','vault("propose", [proposalAction(kind, v)])','proposalAction(kind, v)'],
  added:['uint(v, 128)','address(v)','address(v)','address(v)','settingValues(v, settings)','vault("propose", [proposalAction(kind, v, settings)])','proposalAction(kind, v, settings)']},
 'Owner.tsx':{fix:'F15, F16',why:'F15 the Setting preview and build pass the current settings() (Dst) to settingValues/proposalSpec; F16 Transfer ownership parses the address with newOwner (address() plus a refusal of the vault) before the unchanged guardian read and vault("transferOwnership", [next]).',
  removed:['settingValues({ ...v, setting: String(key), })','proposalSpec(10, { ...v, setting: String(key) })','address(v.next)'],
  added:['settingValues({ ...v, setting: String(key), }, current)','proposalSpec(10, { ...v, setting: String(key) }, current)']},
 'wallet.tsx':{fix:'F13',why:'waitForTransactionReceipt gains onReplaced to learn whether the wallet cancelled or replaced the transaction (then the page says so instead of Confirmed). The eth_sendTransaction request, its data (encode(s)), gas, nonce read and simulation are unchanged.',
  removed:['client.waitForTransactionReceipt({ hash: tx, timeout: 180000, pollingInterval: 3000, })'],
  added:['client.waitForTransactionReceipt({ hash: tx, timeout: 180000, pollingInterval: 3000, onReplaced: (r) => { replaced = r.reason; }, })']},
};
// Owner.tsx action attributes that change, in page order, each with its send calls compared below. A6 G-B: each one,
// printed without comments, must also equal HEAD's text once its documented pieces [v9, HEAD] are put back (each
// exactly once), so the listing loop's row (checkedRows[i]), the listGenesis arguments, the new owner
// (newOwner(v.next)) and everything else around the sends are pinned, not only the send calls.
const ownerAttributes=[
 ['onClick','List stocks / Resume listing button: F13 cancelled-in-wallet and not-listed-after-receipt words; same listingPending, inspectListing and w.send(vault("listGenesis", ...)) calls',[
  ['let rowName = "Listing", rowNumber = 0;','let rowName = "Listing";'],['rowNumber = i + 1; ',''],
  ['if (!after.listed) throw new TransactionCancelled("Not listed after the receipt."); if (after.error) throw new InputError(after.error);','if (!after.listed || after.error) throw new InputError(after.error || "Listing confirmation unreadable. Re-check before continuing.");'],
  ['if (e instanceof TransactionCancelled) { const text = `Row ${rowNumber}: the transaction was cancelled in the wallet; nothing was listed. Press Resume listing.`; setError(text); w.notice("listing", text); } else setError(','setError(']]],
 ['onClick','Wait for pending transaction button: F13 also clears the stale error',[['setPending(""); setError(""); setResume(true);','setPending(""); setResume(true);']]],
 ['build','Set <setting> form: F15 passes the current settings() to proposalSpec(10, ...)',[['String(key) }, current)','String(key) })']]],
 ['disabledReason','Finalize genesis: F14 "Paste the listing rows first..." and the listed-with-other-values words',[['{!listing.trim() ? PASTE_FIRST : listingError','{listingError'],['. List them first.` : differing.length ? differWords(differing) : "At least','. List them first.` : "At least']]],
 ['disabled','Finalize genesis: F14 also disabled while the paste box is empty or a pasted row is listed with other values',[['finalized !== false || !listing.trim() || !!listingError','finalized !== false || !!listingError'],['!!unlisted.length || !!differing.length ||','!!unlisted.length ||']]],
 ['build','Finalize genesis: F14 refuses an empty paste box and listed-with-other-values rows before the unchanged vault("finalizeGenesis")',[
  ['{ if (!listing.trim()) throw new InputError(PASTE_FIRST); await w.listingPending();','{ await w.listingPending();'],
  ['const pasted = parseLaunch(listing); const missing = pasted.filter((r) => !fresh.assets.some((a) => same(a.token, r.token)));','const missing = listing.trim() ? parseLaunch(listing).filter((r) => !fresh.assets.some((a) => same(a.token, r.token))) : [];'],
  ['const changed = pasted.filter((r) => listedDiffers(fresh.assets, r)); if (changed.length) throw new InputError(differWords(changed.map((r) => r.ticker))); ',''],
  ['${reasonWords(a.reason, fresh.globals.settings)}','${a.reason === undefined ? "unreadable" : reasons[a.reason]}']]],
 ['build','Transfer ownership: F16 newOwner(v.next) refuses the vault before the unchanged vault("transferOwnership", [next])',[['const next = newOwner(v.next);','const next = address(v.next);']]],
];
const putBack=(text,pieces,what)=>{for(const [n,o] of pieces){assert.equal(text.split(n).length,2,what+': expected once: '+n);text=text.split(n).join(o);}return text;};
// Every call expression must equal HEAD in these files, except the listed exact pairs (F11: Redeem legs by assetTokens index).
const allCallsEqual={'components.tsx':[], 'Docs.tsx':[], 'Flows.tsx':[
 ['s.assets.map((a, i) => (<p key={a.token}> <bdi>{a.symbol}</bdi>:{" "} {fmt(quote.amounts[i], a.tokenDecimals)} </p>))','s.assets.map((a) => (<p key={a.token}> <bdi>{a.symbol}</bdi>:{" "} {fmt(quote.amounts[a.index], a.tokenDecimals)} </p>))'],
 ['fmt(quote.amounts[i], a.tokenDecimals)','fmt(quote.amounts[a.index], a.tokenDecimals)']]};
// Vault.tsx (v9 with the Stock shelves labels): no read, check or send call at all (no guarded call here, and no send
// or request in the scan below). Its action attributes are pinned in page order: HEAD's Retry vault button and the
// vault, Stock Token and price feed address links, plus the shelves' controls (label Details, drawer Close, filters,
// search, Show all), which only change what is shown; HEAD's search box value/onChange pair is replaced by the
// shelves' search. The StockShelves handlers behind those controls are pinned too.
const vaultAttributes={
 head:['onClick={s.retry}','value={VAULT}','value={search}','onChange={(e) => setSearch(e.target.value)}','value={a.token}','value={a.feed}'],
 now:['onClick={s.retry}','value={VAULT}','onClick={onToggle}','onClick={onClose}','value={a.token}','value={a.feed}','role="list"','role="group"','onClick={() => show(f, search)}','value={search}','onChange={(e) => show(filter, e.target.value)}','role="status"','onClick={() => show("all", "")}','onClick={() => show("all", "")}']};
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
const counts={},ownerChanges=[];
for(const f of sources){
 const old=calls(baseline('web/src/'+f),f),now=calls(read('web/src/'+f),f),e=expected[f];
 if(e) assert.deepEqual(without(now.found,e.added,f),without(old.found,e.removed,f),f+' changed guarded calls beyond the documented ones');
 else assert.deepEqual(now.found,old.found,f+' changed calldata/read/check call expressions');
 if(f==='Vault.tsx'){
  assert.deepEqual(now.found,[],'Vault.tsx makes no read, check or send call');
  assert.deepEqual(old.attributes.map(a=>a.text),vaultAttributes.head,'Vault.tsx HEAD action attributes');
  assert.deepEqual(now.attributes.map(a=>a.text),vaultAttributes.now,'Vault.tsx changed an action attribute beyond the pinned Stock shelves controls');
  for(const a of now.attributes) assert.deepEqual(a.guarded,[],'Vault.tsx '+a.where+': guarded call in an attribute');
  const h=localDeclarations('web/src/Vault.tsx',read('web/src/Vault.tsx'),'StockShelves',Object.keys(vaultHandlers));
  for(const [k,v] of Object.entries(vaultHandlers)) assert.equal(h[k],v,'Vault.tsx StockShelves '+k+' differs from the pinned text');
 } else {
 assert.equal(now.attributes.length,old.attributes.length,f+' action attribute count');
 const changed=now.attributes.map((a,i)=>[old.attributes[i],a]).filter(([o,a])=>o.text!==a.text);
 if(f==='Owner.tsx'){
  assert.deepEqual(changed.map(([,a])=>a.name),ownerAttributes.map(x=>x[0]),'Owner.tsx changed action attributes');
  changed.forEach(([o,a],i)=>{
   assert.equal(o.name,a.name);
   // The send calls inside each changed attribute: equal, apart from the documented Owner.tsx differences.
   const removed=o.guarded.filter(x=>!a.guarded.includes(x)),added=a.guarded.filter(x=>!o.guarded.includes(x));
   for(const x of removed) assert.ok(e.removed.includes(x),'Owner.tsx '+a.where+': removed '+x);
   for(const x of added) assert.ok(e.added.includes(x),'Owner.tsx '+a.where+': added '+x);
   assert.deepEqual(a.guarded.filter(x=>!added.includes(x)),o.guarded.filter(x=>!removed.includes(x)),'Owner.tsx '+a.where+' send call order');
   assert.equal(putBack(a.text,ownerAttributes[i][2],'Owner.tsx '+a.where),o.text,'Owner.tsx '+a.where+' changed beyond its documented pieces');
   ownerChanges.push({attribute:a.name,element:a.where,change:ownerAttributes[i][1],pieces:ownerAttributes[i][2].length,sendCallsBefore:o.guarded,sendCallsAfter:a.guarded});
  });
 } else assert.deepEqual(changed.map(([,a])=>a.text),[],f+' changed an action, send or check attribute');
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
// wallet.tsx send(), the only function that prompts the wallet: printed without comments it must equal HEAD once the
// documented pieces are put back, so from, to, data, gas (estimate x 1.3), nonce, the chain and account rechecks,
// the simulation and the eth_sendTransaction request are unchanged. F13: learn a cancel/replacement from
// waitForTransactionReceipt and say so (no "Confirmed", no link); F7/A5: the proposal detail wording (its end rounded down).
const sendEdits=[
 ['let replaced: string | undefined; ',''],
 ['onReplaced: (r) => { replaced = r.reason; }, ',''],
 ['if (replaced === "cancelled" || replaced === "replaced") throw new TransactionCancelled(replaced === "cancelled" ? "The transaction was cancelled in the wallet; it did not run. Refresh the vault before retrying." : "The transaction was replaced in the wallet by a different one; it did not run. Refresh the vault before retrying."); ',''],
 ['until just before ${date(expiresAt, "end")}, from the Proposed event.','until ${date(expiresAt)} (exclusive), from the Proposed event.'],
 ['if (e instanceof TransactionCancelled) { notice(key, e.message); throw e; } ',''],
 ['if (sent && !settled && s.functionName === "listGenesis") pendingShown.current = true; ',''],
];
function sendText(text){
 const tree=ts.createSourceFile('wallet.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),printer=ts.createPrinter({removeComments:true});let out;
 (function v(n){if(ts.isFunctionDeclaration(n)&&n.name?.text==='send')out=printer.printNode(ts.EmitHint.Unspecified,n,tree).replace(/\s+/g,' ');ts.forEachChild(n,v);})(tree);
 assert.ok(out,'wallet.tsx send() found');return out;
}
let sendNow=sendText(read('web/src/wallet.tsx'));
for(const [n,o] of sendEdits){assert.equal(sendNow.split(n).length,2,'wallet.tsx send(): expected once: '+n);sendNow=sendNow.split(n).join(o);}
assert.equal(sendNow,sendText(baseline('web/src/wallet.tsx')),'wallet.tsx send() changed beyond the documented F13/F7/A5 pieces');
// Differential encoding: HEAD and current governance/model/chain bundled side by side. For the same inputs the
// calldata must be byte-identical whenever the current page accepts; the current page may only add the
// documented refusals (made before any wallet prompt), and never accepts what HEAD refused.
const scratch=path.join(root,'test/scratch/calldata');
fs.rmSync(scratch,{recursive:true,force:true});
for(const p of git(['ls-tree','-r','--name-only','HEAD','web/src']).trim().split('\n').filter(p=>/\.(tsx?|json)$/.test(p))){
 const out=path.join(scratch,'head',p.slice(4));fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,baseline(p));
}
const entry=src=>`export { proposalSpec, proposalAction } from "${src}/governance";\nexport { parseLaunch, address, recipient, amount, uint, deadline, depositArgs, redeemArgs } from "${src}/model";\nexport { encode, vault, token, VAULT } from "${src}/chain";\n`;
fs.writeFileSync(path.join(scratch,'head-entry.ts'),entry('./head/src'));
fs.writeFileSync(path.join(scratch,'now-entry.ts'),entry('../../../web/src')+'export { newOwner } from "../../../web/src/governance";\n');
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
const tally={sameCalldata:0,bothRefused:0,newRefusals:{}};
function compare(label,input,h,n,newRefusalAllowed,t=tally){
 if(n.hex!==undefined){assert.ok(h.hex!==undefined,label+' accepted input HEAD refused: '+JSON.stringify(input));assert.equal(n.hex,h.hex,label+' calldata changed for '+JSON.stringify(input));t.sameCalldata++;}
 else if(h.hex!==undefined){assert.ok(newRefusalAllowed(n.error),label+' new refusal not documented: '+n.error+' for '+JSON.stringify(input));t.newRefusals[n.error]=(t.newRefusals[n.error]||0)+1;}
 else t.bothRefused++;
}
const isV=x=>typeof x==='string'&&x.toLowerCase()===V.toLowerCase();
const json=x=>JSON.parse(JSON.stringify(x,(k,v)=>typeof v==='bigint'?String(v):v));
for(const [kind,v,settings] of cases){
 const h=attempt(()=>head.encode(head.proposalSpec(kind,v))),n=attempt(()=>now.encode(now.proposalSpec(kind,v,settings)));
 compare('propose',json({kind,v,settings}),h,n,error=>{
  if(error===U128)return [0,5].includes(kind)&&/^\d+$/.test(v.minLiquidity)&&BigInt(v.minLiquidity)>=2n**128n&&BigInt(v.minLiquidity)<2n**256n;
  if(error==='The new guardian must not be the vault.')return kind===7&&isV(v.next);
  if(error===SPRING){const from=kind===10&&v.setting==='5'?head.proposalAction(kind,v).value:-1n;return from>=7200n&&from<10800n&&(!settings||settings.dst===0n);}
  return false;
 });
}
for(const next of addrs)compare('transferOwnership',{next},attempt(()=>head.encode(head.vault('transferOwnership',[head.address(next)]))),attempt(()=>now.encode(now.vault('transferOwnership',[now.newOwner(next)]))),error=>error==='The new owner must not be the vault.'&&isV(next));
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
// HEAD once its documented pieces [v9, HEAD] are put back, or equals the pinned v9 text (new in v9): the Guardian and
// FeeRecipient proposal targets (newGuardian(v.next), feeRecipient(v.recipient)), the parsers they use, and the
// listing rows (checkRows, unchanged) and the Finalize helpers.
const pinnedV9={
 'web/src/governance.ts':{
  proposalAction:[['v: Record<string, string>, settings?: any): Action','v: Record<string, string>): Action'],['target: newGuardian(v.next)','target: address(v.next)'],['target: feeRecipient(v.recipient)','target: recipient(v.recipient)'],['settingValues(v, settings)','settingValues(v)']],
  proposalSpec:[['v: Record<string, string>, settings?: any) { return vault("propose", [proposalAction(kind, v, settings)]); }','v: Record<string, string>) { return vault("propose", [proposalAction(kind, v)]); }']],
  settingValues:[['v: Record<string, string>, settings?: any): [','v: Record<string, string>): ['],['if (springForwardStart(from, settings ? BigInt(settings.dst) : 0n)) throw new InputError(SPRING_FORWARD_START); ','']],
  poolValues:[['l = minLiquidityOf(v.minLiquidity);','l = uint(v.minLiquidity);']],
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
for(const m of [U128,'The new guardian must not be the vault.','The new owner must not be the vault.',SPRING]) assert.ok(tally.newRefusals[m]>0,'corpus exercises: '+m);
assert.ok(tally.sameCalldata>400,'corpus size '+JSON.stringify(tally));
fs.rmSync(scratch,{recursive:true,force:true});
fs.writeFileSync('../artifacts/calldata-comparison.json',JSON.stringify({result:'PASS',baseline:git(['rev-parse','HEAD']).trim(),protectedFiles,editedFiles:{'main.tsx':'A4: the footer tagline span removed','Scenery.tsx':'A2: eight slogan lines per strip half instead of four'},counts,
 documentedGuardedCallChanges:expected,ownerActionAttributeChanges:ownerChanges,vaultStockShelves:{attributes:vaultAttributes,handlers:vaultHandlers},walletSendDocumentedPieces:sendEdits.map(([now,head])=>({now,head})),
 differentialEncoding:{cases:cases.length,...tally},sendBuilders:{clocks,...sends},pinnedDeclarations:pinned,
 sendsAndRequests:{sendFreeFiles:NO_SEND,usesPerFile:Object.fromEntries(Object.entries(sendUses).map(([f,x])=>[f,x.length])),components:sendUses['components.tsx'].filter(x=>/\(/.test(x))},
 pinnedV9Declarations:Object.fromEntries(Object.entries(pinnedV9).map(([f,m])=>[f,Object.fromEntries(Object.entries(m).map(([k,x])=>[k,typeof x==='string'?'v9 text':x.length+' pieces from HEAD']))])),importBindings:imports,
 checks:['Losses.tsx, poolMath.ts, deployment.ts and vault.abi.json byte-identical to HEAD; main.tsx and Scenery.tsx byte-identical to HEAD once the one documented edit is put back (A4 footer tagline removed; A2 eight slogan lines per half); no source file added or removed',
  'Every vault/token/feed/read call, transaction argument parser, encoding, simulation and send (guarded names) in every web/src source equals the HEAD AST in order, apart from the exact documented changes listed here',
  'Action/send/check JSX attributes equal HEAD in every file except the seven listed Owner.tsx attributes, whose send calls are compared one by one and whose whole printed text equals HEAD once their documented pieces are put back (the listing row checkedRows[i], the listGenesis arguments, newOwner(v.next) included), and Vault.tsx, whose attributes equal the pinned list (HEAD\'s Retry vault button and address links plus the Stock shelves controls, none with a guarded call) and whose StockShelves handlers equal their pinned text; Vault.tsx has no guarded call at all',
  'Wallet sends and raw requests: in every web/src file the uses of a send/request name or of the provider (ethereum) with their calls, every string naming a sending or signing method, computed access to the global object and eval/Function/Reflect equal HEAD in order, with no exception; Vault, Scenery, main and Docs have no send or request (main only reads window.ethereum), components keeps the single wallet.send of HEAD',
  'Argument sources: governance.ts proposalAction (Guardian target newGuardian(v.next), FeeRecipient target feeRecipient(v.recipient)), proposalSpec, settingValues and poolValues equal HEAD once their documented pieces are put back; newOwner, newGuardian, feeRecipient, minLiquidityOf and the spring-forward rule equal the pinned v9 text; Owner.tsx checkRows equals HEAD and the Finalize helpers equal the pinned v9 text; the names these call are bound only by their imports; the encoders use the same vault address',
  'wallet.tsx send() (the only wallet prompt) equals HEAD once the six documented F13/F7/A5 pieces are put back: from, to, data, gas, nonce, chain and account rechecks, simulation and the eth_sendTransaction request unchanged',
  'Every call expression in components.tsx, Docs.tsx and Flows.tsx equals HEAD, apart from the F11 Redeem-leg index pair',
  'Differential encoding of HEAD and current governance/model/chain: identical calldata for every input the page accepts (proposals of every kind, transfer ownership, genesis listing); the only new refusals are the documented ones (uint128 minLiquidity, vault as guardian or new owner, Sunday 2:00-2:59 am start under Dst 0); nothing HEAD refused is accepted',
  'Under six fixed clocks: deadline() and the full depositArgs and redeemArgs tuples (deadline included) equal HEAD, and so does the encoded deposit and redeem calldata; redeem built as Flows does (amount, recipient, redeemArgs), approve (amount with 0/6/8/18 decimals), claim (recipient), lowerNAVCap (amount, zero allowed), close and removeRetired (address), and the uint and address parsers give the same value or are refused by both, with no new refusal',
  'The printed text (no comments) of same, deadline, depositArgs, redeemArgs, amount, address, recipient, uint and parseLaunch in model.ts and of vault, token and encode in chain.ts equals HEAD',
  'Only the look and fix files change in web/src (check-bundle.mjs)']},null,2)+'\n');
console.log('PASS baseline call-expression comparison',counts,'differential encoding',tally,'send builders',sends);

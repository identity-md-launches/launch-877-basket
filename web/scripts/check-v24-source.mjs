import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import ts from 'typescript';
const pieces=JSON.parse(fs.readFileSync(new URL('./v24-pieces.json',import.meta.url),'utf8'));
// Digests are independent of generated restoration pieces.
const pins=JSON.parse(fs.readFileSync(new URL('./v24-pins.json',import.meta.url),'utf8'));
export function restoreV24(file,text){
 for(const [now,old] of pieces[file.replace(/^web\/src\//,'')]??[]){assert.equal(text.split(now).length,2,file+': one exact v24 piece');text=text.replace(now,old);}
 return text;
}
export function checkV24Sources(root){
 const base='736affca69ad6aefe27b27d7e0ceeb405c236a96';
 const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:1<<25});
 const names=['Earn.tsx','itemConstants.ts','itemFormat.ts','itemReads.ts','main.tsx','styles.css'];
 assert.deepEqual(Object.keys(pieces).sort(),names);assert.deepEqual(Object.keys(pins).sort(),names);
 const sources=git(['ls-tree','-r','--name-only',base,'web/src']).trim().split('\n');
 assert.deepEqual(git(['ls-files','--cached','--others','--exclude-standard','web/src']).trim().split('\n').sort(),sources.sort(),'No source added or removed');
 for(const file of sources){
  const text=fs.readFileSync(path.join(root,file),'utf8'),name=path.basename(file),old=git(['show',base+':'+file]);
  if(pins[name]) assert.equal(createHash('sha256').update(text).digest('hex'),pins[name],file+': independently pinned v24 source');
  assert.equal(restoreV24(file,text),old,file+': v23 byte equality after exact v24 restoration');
 }
 const actual=file=>fs.readFileSync(path.join(root,'web/src',file),'utf8');
 const functionText=(text,name)=>{const tree=ts.createSourceFile('source.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let found=[];const visit=n=>{if(ts.isFunctionDeclaration(n)&&n.name?.text===name)found.push(n.getText(tree));ts.forEachChild(n,visit);};visit(tree);assert.equal(found.length,1,name+': unique function');return found[0];};
 for(const [file,names] of [['Earn.tsx',['act','addLiquidity','moveTab']],['itemReads.ts',['readItemFigures']],['itemFormat.ts',['itemLiquidityQuote','parseItemAmount']]])for(const name of names)assert.equal(functionText(actual(file),name),functionText(git(['show',base+':web/src/'+file]),name),name+': transaction inputs, builders and original Earn reads unchanged');
 assert.match(actual('Earn.tsx'),/Pool prices and BASK stock value, read at the last refresh\./);
 assert.doesNotMatch(actual('Earn.tsx'),/"Manage"|Claim\/Unstake|earn-pool-select/);
 assert.match(actual('Earn.tsx'),/type="radio" name="earn-pool"/);
 assert.match(actual('main.tsx'),/useItemFigures\(page === "Earn" \? "earn" : "prices", page === "Earn" \? wallet.account : undefined, page\)/);
 assert.doesNotMatch(actual('itemReads.ts'),/setInterval|setTimeout|localStorage|sessionStorage|wallet\./);
 console.log('PASS v24 source gate: six independently pinned display/read sources; exact v23 restoration; unchanged sends, approvals, liquidity quotes and original Earn reads');
}

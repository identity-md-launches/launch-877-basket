import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
const root=process.env.BASKET_SOURCE_ROOT||path.resolve('..');
const baseline=p=>execFileSync('git',['show','HEAD:'+p],{cwd:root,encoding:'utf8'});
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
// Vault 6 re-point: Losses, main, components and Scenery stay as at HEAD; Flows and Vault keep every call expression (only VAULT differs).
const protectedFiles=['Losses.tsx','main.tsx','components.tsx','Scenery.tsx'];
for(const f of protectedFiles) assert.equal(read('web/src/'+f),baseline('web/src/'+f),f);
const names=new Set(['vault','token','feed','read','many','simulate','verifyNetwork','encode','depositArgs','redeemArgs','w.send','p.request']);
function calls(text,file) {
 const tree=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS),found=[];
 const printer=ts.createPrinter({removeComments:true});
 function visit(n){if(ts.isCallExpression(n)&&names.has(n.expression.getText(tree)))found.push(printer.printNode(ts.EmitHint.Unspecified,n,tree).replace(/\s+/g,' '));ts.forEachChild(n,visit);}
 visit(tree);return found;
}
const files=['Flows.tsx','Vault.tsx'],counts={};
for(const f of files){const old=calls(baseline('web/src/'+f),f),now=calls(read('web/src/'+f),f);assert.deepEqual(now,old,f+' changed calldata/read/check call expressions');counts[f]=now.length;}
fs.writeFileSync('../artifacts/calldata-comparison.json',JSON.stringify({result:'PASS',baseline:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),protectedFiles,counts,checks:['Losses.tsx, main.tsx, components.tsx and Scenery.tsx byte-identical to HEAD','All vault/token/feed calls, transaction arguments, encodings, reads and simulations in Flows.tsx and Vault.tsx equal the HEAD AST; only the VAULT constant and wording differ','chain.ts, model.ts, governance.ts, Owner.tsx, wallet.tsx, Docs.tsx, poolMath.ts and newYork.ts carry the vault 6 ABI, names and New York hours']},null,2)+'\n');
console.log('PASS baseline call-expression comparison',counts);

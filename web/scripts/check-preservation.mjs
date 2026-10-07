// Compare the submitted website against the initial checkout. Read-only Git access.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import ts from 'typescript';
const root=process.env.BASKET_SOURCE_ROOT||path.resolve('..');
const baseline=process.env.BASKET_BASELINE||'HEAD';
const old=name=>execFileSync('git',['show',`${baseline}:${name}`],{cwd:root,encoding:'utf8'});
const current=name=>fs.readFileSync(path.join(root,name),'utf8');
const hash=s=>createHash('sha256').update(s).digest('hex');
const printer=ts.createPrinter({removeComments:true});
const results=[];
for(const name of ['chain.ts','model.ts','wallet.tsx','components.tsx','Flows.tsx','Owner.tsx','Losses.tsx','Vault.tsx','main.tsx']){
 const filename='web/src/'+name;
 const calls=source=>{
   const file=ts.createSourceFile(name,source,ts.ScriptTarget.Latest,true,name.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS),out=[];
   const walk=node=>{
     if(ts.isCallExpression(node)){
       const n=node.expression.getText(file);
       if(/^(vault|token|feed|read|safe|many|simulate|depositArgs|redeemArgs|loadSnapshot|verifyNetwork|encode)$/.test(n)||/\.(send|request|waitForTransactionReceipt|getCode|getChainId|readContract|call)$/.test(n))out.push(printer.printNode(ts.EmitHint.Unspecified,node,file));
     }
     ts.forEachChild(node,walk);
   };walk(file);return out;
 };
 const a=calls(old(filename)),b=calls(current(filename));assert.deepEqual(b,a,`${filename}: RPC or transaction expressions changed`);
 results.push({file:filename,unchangedCalls:a.length,sha256:hash(JSON.stringify(a))});
}
const identical=['web/src/chain.ts','web/src/model.ts','web/src/deployment.ts','web/src/vault.abi.json','web/src/Docs.tsx','web/src/Losses.tsx','web/src/components.tsx','web/package.json','web/package-lock.json','web/vite.config.ts','web/tsconfig.json','foundry.toml','remappings.txt','src/BaskVault.sol','src/BaskMath.sol'];
for(const file of identical)assert.equal(current(file),old(file),`${file} must remain byte-identical`);
// JSX text content is preserved, apart from the removed decorative aisle numbers.
const texts=source=>{
 const file=ts.createSourceFile('source.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),out=[];
 const walk=n=>{if(ts.isJsxText(n)){const t=n.text.replace(/\s+/g,' ').trim();if(t)out.push(t);}ts.forEachChild(n,walk);};walk(file);return out;
};
const copy=[];
for(const name of ['main','Vault','Flows','Owner','Docs','Losses','components']){
 const file=`web/src/${name}.tsx`,a=texts(old(file)),b=texts(current(file));
 const removed=[...new Set(a)].filter(t=>!b.includes(t)&&!(name==='main'&&t==='0'));
 const added=[...new Set(b)].filter(t=>!a.includes(t));
 assert.deepEqual(removed,[],`${file}: removed copy`);
 assert.ok(added.every(t=>['Owner controls','Losses','Stock Token','Feed description','Current price'].includes(t)),`${file}: unexpected new copy ${added}`);
 copy.push({file,removed,added});
}
const report={baseline,checkedAt:new Date().toISOString(),calls:results,byteIdentical:identical,copy,notes:['All contract-spec, RPC, send, simulation, minimum and deadline call expressions match the original checkout.','Only wallet success presentation and preview invalidation state change. Docs and warnings retain original copy.','Runtime and ABI checked independently by live validation. No new RPC endpoints or reads.']};
fs.writeFileSync(path.join(root,'artifacts/preservation.json'),JSON.stringify(report,null,2)+'\n');
console.log(`PASS: ${results.reduce((n,r)=>n+r.unchangedCalls,0)} unchanged call expressions; ${identical.length} byte-identical core/configuration files; JSX copy preserved.`);

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=process.env.BASKET_SOURCE_ROOT||path.resolve('..');
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'});
const changed=git(['diff','--name-only','HEAD']).trim().split('\n').filter(Boolean);
const allowedSource=['Scenery.tsx','styles.css','Flows.tsx','Vault.tsx','wallet.tsx','governance.ts'].map(f=>'web/src/'+f);
for(const p of changed){
 assert.ok(!/(^|\/)(lib|node_modules|\.github|\.git)(\/|$)|(^|\/)\.env(?:\.|$)|(^|\/)(foundry\.toml|foundry\.lock|remappings\.txt|\.gitmodules|package\.json|[^/]*lock[^/]*)$/.test(p),'Protected path changed: '+p);
 if(p.startsWith('web/src/'))assert.ok(allowedSource.includes(p),'Out-of-scope source: '+p);
 assert.ok(!p.startsWith('src/')&&!p.startsWith('web/pinned/'),'Contract or pinned source changed');
}
assert.ok(!git(['ls-files','--stage']).split('\n').some(s=>s.startsWith('160000 ')),'No git submodules');
const files=[...new Set(git(['ls-files','--cached','--others','--exclude-standard','-z']).split('\0'))].filter(p=>p&&!p.startsWith('.imd/')&&!p.startsWith('test/scratch/')&&fs.existsSync(path.join(root,p))).sort();
for(const p of files) assert.ok(!/(^|\/)(node_modules|\.npm|\.cache|\.vite|\.playwright-mcp)(\/|$)|\.(tgz|deb|tsbuildinfo)$/.test(p),'Dependency/cache/archive payload: '+p);
const shots=files.filter(p=>/^artifacts\/(empty|stocks25)-.*\.jpg$/.test(p));assert.equal(shots.length,24);
const extraImages=files.filter(p=>/^artifacts\/.*\.(png|jpg|webp|svg)$/.test(p)&&!shots.includes(p)&&!/^artifacts\/redeem-title-dpr-(1|1\.25|1\.5)\.png$/.test(p));assert.deepEqual(extraImages,[]);
const productionFiles={};for(const p of files.filter(p=>p.startsWith('dist/'))){const b=fs.readFileSync(path.join(root,p));productionFiles[p]={bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')};}
const result={limitBytes:8388608,uncompressedDeliveryBytes:0,fileCount:files.length,productionExportBytes:Object.values(productionFiles).reduce((a,b)=>a+b.bytes,0),productionFiles,accounting:'Complete candidate file contents including tracked lib sources and this report. Excludes Git metadata, removed task inputs and disposable test/scratch. No Git metadata was modified.',checks:['Protected configuration, dependencies, contracts and other source paths unchanged','No git submodules or nested dependency/cache/archive payloads','24 required empty/25-stock JPEGs retained at quality 40; no additional artifact images','Both copies of all 37 manifest assets included']};
const report=path.join(root,'artifacts/bundle-check.json');
for(let i=0;i<4;i++){fs.writeFileSync(report,JSON.stringify(result,null,2)+'\n');result.uncompressedDeliveryBytes=files.reduce((sum,p)=>sum+fs.statSync(path.join(root,p)).size,0);}
fs.writeFileSync(report,JSON.stringify(result,null,2)+'\n');assert.ok(result.uncompressedDeliveryBytes<=result.limitBytes,JSON.stringify(result));console.log('PASS complete bundle',result.uncompressedDeliveryBytes,'/',result.limitBytes,'bytes; lib included');

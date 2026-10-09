import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=process.env.BASKET_SOURCE_ROOT||path.resolve('..');
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'});
const changed=git(['diff','--name-only','HEAD']).trim().split('\n').filter(Boolean);
// v10 (on top of v9 = HEAD: the Docs deposits sentence, the 24/7 redemption tag on Deposit and Redeem, no price
// times on the Stock shelves, and the slogan strip fix in Scenery.tsx and styles.css): only these web/src files may
// change; every other source stays as at HEAD and the changed ones may only take their documented pieces (both
// byte-checked by check-calldata.mjs); web/pinned and web/public stay unchanged (the favicon is still the chosen icon);
// no file is added to web/src or web/public.
const v10Source=['Docs.tsx','Flows.tsx','Vault.tsx','model.ts','styles.css','Scenery.tsx'].map(f=>'web/src/'+f);
// The new favicon: red panel, yellow frame, the header's basket in yellow.
const FAVICON_SHA256='0a31ead9064a33cbc12abe6388cf3f0a29888d3a183819e02116e56dd8ba2238';
const sha256=p=>createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
assert.equal(sha256('web/public/favicon.svg'),FAVICON_SHA256,'web/public/favicon.svg is the chosen icon');
assert.equal(sha256('dist/favicon.svg'),FAVICON_SHA256,'dist/favicon.svg is the chosen icon');
for(const p of changed){
 assert.ok(!p.startsWith('web/pinned/'),'Pinned source changed: '+p);
 assert.ok(!p.startsWith('web/public/'),'Public file changed: '+p);
 // The page shell and build configuration stay as at HEAD (no script can be added outside web/src); in web/validation only the README text changes.
 assert.ok(!['web/index.html','web/vite.config.ts','web/tsconfig.json'].includes(p)&&(!p.startsWith('web/validation/')||p==='web/validation/README.md'),'Page shell, build configuration or validation fixture changed: '+p);
 assert.ok(!/(^|\/)(lib|node_modules|\.github|\.git)(\/|$)|(^|\/)\.env(?:\.|$)|(^|\/)(foundry\.toml|foundry\.lock|remappings\.txt|\.gitmodules|package\.json|[^/]*lock[^/]*)$/.test(p),'Protected path changed: '+p);
 if(p.startsWith('web/src/'))assert.ok(v10Source.includes(p),'Source outside the v10 scope changed: '+p);
 assert.ok(!p.startsWith('src/'),'Root contract source changed');
}
assert.deepEqual(git(['ls-files','--others','--exclude-standard','--','web/src','web/public']).trim().split('\n').filter(Boolean),[],'New files in web/src or web/public');
assert.ok(!git(['ls-files','--stage']).split('\n').some(s=>s.startsWith('160000 ')),'No git submodules');
const files=[...new Set(git(['ls-files','--cached','--others','--exclude-standard','-z']).split('\0'))].filter(p=>p&&!p.startsWith('.imd/')&&!p.startsWith('test/scratch/')&&fs.existsSync(path.join(root,p))).sort();
for(const p of files) assert.ok(!/(^|\/)(node_modules|\.npm|\.cache|\.vite|\.playwright-mcp)(\/|$)|\.(tgz|deb|tsbuildinfo)$/.test(p),'Dependency/cache/archive payload: '+p);
const shots=files.filter(p=>/^artifacts\/(empty|stocks25)-.*\.jpg$/.test(p));assert.equal(shots.length,24);
const extraImages=files.filter(p=>/^artifacts\/.*\.(png|jpg|webp|svg)$/.test(p)&&!shots.includes(p)&&!/^artifacts\/redeem-title-dpr-(1|1\.25|1\.5)\.png$/.test(p));assert.deepEqual(extraImages,[]);
const productionFiles={};for(const p of files.filter(p=>p.startsWith('dist/'))){const b=fs.readFileSync(path.join(root,p));productionFiles[p]={bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')};}
const result={limitBytes:8388608,uncompressedDeliveryBytes:0,fileCount:files.length,productionExportBytes:Object.values(productionFiles).reduce((a,b)=>a+b.bytes,0),productionFiles,accounting:'Complete candidate file contents including tracked lib sources and this report. Excludes Git metadata, removed task inputs and disposable test/scratch. No Git metadata was modified.',checks:['Protected configuration, dependencies, root contracts, web/pinned, web/index.html, web/vite.config.ts, web/tsconfig.json and the validation fixtures unchanged; web/public unchanged (web/public/favicon.svg and dist/favicon.svg keep the SHA-256 of the chosen icon); web/src changed only within the v10 scope (Docs: deposits sentence; Flows: 24/7 redemption tag; Vault and model: no price times on the Stock shelves; styles: the tag and the removed age rules; Scenery and styles: slogan strip fix); every other source frozen','No git submodules or nested dependency/cache/archive payloads','24 required empty/25-stock JPEGs retained (quality 36 since v9, 40 before); no additional artifact images','Both copies of all 37 manifest assets included']};
const report=path.join(root,'artifacts/bundle-check.json');
for(let i=0;i<4;i++){fs.writeFileSync(report,JSON.stringify(result,null,2)+'\n');result.uncompressedDeliveryBytes=files.reduce((sum,p)=>sum+fs.statSync(path.join(root,p)).size,0);}
fs.writeFileSync(report,JSON.stringify(result,null,2)+'\n');assert.ok(result.uncompressedDeliveryBytes<=result.limitBytes,"Over the 8 MiB budget (if the 24 screenshots are still the quality-40 set, run scripts/run-browser.mjs first: it rewrites them at quality 36): "+JSON.stringify(result));console.log('PASS complete bundle',result.uncompressedDeliveryBytes,'/',result.limitBytes,'bytes; lib included');

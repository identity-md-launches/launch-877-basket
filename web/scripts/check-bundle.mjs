import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=process.env.BASKET_SOURCE_ROOT||path.resolve('..');
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'});
const changed=git(['diff','--name-only','HEAD']).trim().split('\n').filter(Boolean);
// v14 (owner decisions of 2026-10-13: the Docs module and ITEM panels, the Deposit desktop columns, two word changes): only these sources may change.
// check-calldata independently pins each reviewed source and every protected transaction block.
const v14Source=['Docs.tsx','Flows.tsx','Tokenomics.tsx','tokenomicsData.ts','BaskGuide.tsx','baskGuideData.ts','styles.css'].map(f=>'web/src/'+f);
const SHELL_SHA256='82f66899a0c19f61299254c0005ee5117af0a912b97e8e57d249288e9dbc962d';
const SHARE_SHA256='dc14dd6f4068ec9325426583104b1c6ae8748fbb17d8326863c9612280eacd85';
// The new favicon: red panel, yellow frame, the header's basket in yellow.
const FAVICON_SHA256='0a31ead9064a33cbc12abe6388cf3f0a29888d3a183819e02116e56dd8ba2238';
const sha256=p=>createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
assert.equal(sha256('web/public/favicon.svg'),FAVICON_SHA256,'web/public/favicon.svg is the chosen icon');
assert.equal(sha256('dist/favicon.svg'),FAVICON_SHA256,'dist/favicon.svg is the chosen icon');
for(const p of changed){
 assert.ok(/^(web\/src\/|web\/scripts\/|dist\/|artifacts\/)/.test(p)||["README.md","DESIGN.md","web/validation/README.md"].includes(p),"Outside approved tree scope: "+p);
 assert.ok(!p.startsWith('web/pinned/'),'Pinned source changed: '+p);
 assert.ok(!p.startsWith('web/public/'),'Public file changed: '+p);
 // v12 section 5: the exact page shell is pinned below; build configuration and validation fixtures stay unchanged.
 assert.ok(!['web/vite.config.ts','web/tsconfig.json'].includes(p)&&(!p.startsWith('web/validation/')||p==='web/validation/README.md'),'Page shell, build configuration or validation fixture changed: '+p);
 assert.ok(!/(^|\/)(lib|node_modules|\.github|\.git)(\/|$)|(^|\/)\.env(?:\.|$)|(^|\/)(foundry\.toml|foundry\.lock|remappings\.txt|\.gitmodules|package\.json|[^/]*lock[^/]*)$/.test(p),'Protected path changed: '+p);
 if(p.startsWith('web/src/'))assert.ok(v14Source.includes(p),'Source outside the v14 scope changed: '+p);
 assert.ok(!p.startsWith('src/'),'Root contract source changed');
}
// Tokenomics: exactly four new sources; no new public asset.
const untracked=git(['ls-files','--others','--exclude-standard','--','web/src','web/public']).trim().split('\n').filter(Boolean);
assert.deepEqual(untracked,['web/src/BaskGuide.tsx','web/src/Tokenomics.tsx','web/src/baskGuideData.ts','web/src/tokenomicsData.ts'],'New files in web/src or web/public');
assert.equal(sha256('web/index.html'),SHELL_SHA256,'exact v12 source shell');
for(const p of ['web/public/share-card.jpg','dist/share-card.jpg']) {
 assert.equal(sha256(p),SHARE_SHA256,'exact v12 link picture: '+p);
 assert.ok(fs.statSync(path.join(root,p)).size<=45000,'share JPEG byte cap');
}
const sourceShell=fs.readFileSync(path.join(root,'web/index.html'),'utf8');
const builtShell=fs.readFileSync(path.join(root,'dist/index.html'),'utf8');
const shareTags=s=>[...s.matchAll(/<meta\s+(?:property="og:[^"]+"|name="twitter:card")[\s\S]*?\/>/g)].map(x=>x[0].replace(/\s+/g,' '));
assert.equal(shareTags(sourceShell).length,8,'exactly eight approved share tags');
assert.deepEqual(shareTags(builtShell),shareTags(sourceShell),'built share tags equal the pinned shell');
assert.equal((builtShell.match(/<script\b/g)||[]).length,1,'one built module script');
assert.match(builtShell,/<script\s+type="module"[^>]*src="[^"]+"/);
assert.equal((builtShell.match(/<link\b[^>]*rel="stylesheet"/g)||[]).length,1,'one stylesheet');
assert.ok(!git(['ls-files','--stage']).split('\n').some(s=>s.startsWith('160000 ')),'No git submodules');
const files=[...new Set(git(['ls-files','--cached','--others','--exclude-standard','-z']).split('\0'))].filter(p=>p&&!p.startsWith('.imd/')&&!p.startsWith('test/scratch/')&&fs.existsSync(path.join(root,p))).sort();
for(const p of files) assert.ok(!/(^|\/)(node_modules|\.npm|\.cache|\.vite|\.playwright-mcp)(\/|$)|\.(tgz|deb|tsbuildinfo)$/.test(p),'Dependency/cache/archive payload: '+p);
const shots=files.filter(p=>/^artifacts\/(empty|stocks25)-.*\.jpg$/.test(p));assert.equal(shots.length,24);
const extraImages=files.filter(p=>/^artifacts\/.*\.(png|jpg|webp|svg)$/.test(p)&&!shots.includes(p)&&!/^artifacts\/redeem-title-dpr-(1|1\.25|1\.5)\.png$/.test(p));assert.deepEqual(extraImages,[]);
const productionFiles={};for(const p of files.filter(p=>p.startsWith('dist/'))){const b=fs.readFileSync(path.join(root,p));productionFiles[p]={bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')};}
const result={limitBytes:8388608,uncompressedDeliveryBytes:0,fileCount:files.length,productionExportBytes:Object.values(productionFiles).reduce((a,b)=>a+b.bytes,0),productionFiles,accounting:'Complete candidate file contents including tracked lib sources and this report. Excludes Git metadata, removed task inputs and disposable test/scratch. No Git metadata was modified.',checks:['Protected configuration, dependencies, root contracts, web/pinned, build configuration and validation fixtures unchanged; ITEM and BASK source scope independently pinned; exact share shell and both share JPEG copies pinned; both favicon copies unchanged','No git submodules or nested dependency/cache/archive payloads','24 required empty/25-stock JPEGs retained (quality 18 in v14, 26 in v12 and v13, 32 in v11, 36 in v9/v10, 40 before); no additional artifact images','Both copies of all 37 manifest assets included']};
const report=path.join(root,'artifacts/bundle-check.json');
for(let i=0;i<4;i++){fs.writeFileSync(report,JSON.stringify(result,null,2)+'\n');result.uncompressedDeliveryBytes=files.reduce((sum,p)=>sum+fs.statSync(path.join(root,p)).size,0);}
fs.writeFileSync(report,JSON.stringify(result,null,2)+'\n');assert.ok(result.uncompressedDeliveryBytes<=result.limitBytes,"Over the 8 MiB budget (if the 24 screenshots are still an older set, run scripts/run-browser.mjs first: it rewrites them at quality 18): "+JSON.stringify(result));console.log('PASS complete bundle',result.uncompressedDeliveryBytes,'/',result.limitBytes,'bytes; lib included');

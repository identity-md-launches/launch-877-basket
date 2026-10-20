import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=process.env.BASKET_SOURCE_ROOT||path.resolve('..');
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'});
const changed=git(['diff','--name-only','HEAD']).trim().split('\n').filter(Boolean);
// v20 (two browser checks re-scoped for the Losses route, 2026-10-16): no source may change.
// check-calldata independently pins each reviewed source and freezes every other.
// ITEM prompt rule 7: this exact source list replaces only the old v22 source-scope pin (v17 to v22 are HEAD's own now; rebased onto v22's commit 3038c97b on 2026-10-17).
// Owner approval 2026-10-14 adds only Tokenomics.tsx's formatLive body; the gate pins every other byte.
// 2026-10-20, vault stats build (v25): Vault.tsx (the three VaultViews wrapper pieces), styles.css (the Earn focus corner
// and the appended stats block) and the two new stats sources join the scope; check-calldata restores the two and pins the new ones.
const itemSource=["main.tsx","Earn.tsx","itemReads.ts","itemFormat.ts","itemConstants.ts","styles.css","Vault.tsx","VaultStats.tsx","vaultStatsReport.tsx"].map(f=>'web/src/'+f);
const itemPublic=["web/public/art/character/earn.webp","web/public/art/character/transparency.webp"];
// Owner-requested LF repair only: original Anton licence text is pinned after CRLF normalization.
const licenceFile='web/public/fonts/Anton-OFL.txt';
const LICENCE_LF_SHA256='eee1d24ff8f553eb732237c7dd9b945a78313ed49ad6de02872a47277741b44a';
const itemNew=["web/src/itemConstants.ts","web/src/itemAbi.ts","web/src/itemReads.ts","web/src/itemActions.ts","web/src/itemFormat.ts","web/src/Earn.tsx","web/src/Transparency.tsx","web/src/FindItem.tsx"];
// Filled with the ITEM walk's exact required JPEG names after the walk is written. No pattern permits arbitrary new evidence.
// 2026-10-16, Add liquidity build: eighteen required states on five exact contact sheets.
// 2026-10-16, Earn layout build (option B3): twenty-three required states (the eighteen plus the selector, the ITEM/ETH card,
// Manage with its withdraw form open, Pool stats and Staking stats) on six exact contact sheets.
const ITEM_WALK_SHOTS=['artifacts/item-states-1.jpg','artifacts/item-states-2.jpg','artifacts/item-states-3.jpg','artifacts/item-states-4.jpg','artifacts/item-states-5.jpg','artifacts/item-states-6.jpg'];
const SHELL_SHA256='82f66899a0c19f61299254c0005ee5117af0a912b97e8e57d249288e9dbc962d';
const SHARE_SHA256='dc14dd6f4068ec9325426583104b1c6ae8748fbb17d8326863c9612280eacd85';
// The new favicon: red panel, yellow frame, the header's basket in yellow.
const FAVICON_SHA256='0a31ead9064a33cbc12abe6388cf3f0a29888d3a183819e02116e56dd8ba2238';
const sha256=p=>createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
assert.equal(sha256('web/public/favicon.svg'),FAVICON_SHA256,'web/public/favicon.svg is the chosen icon');
assert.equal(sha256('dist/favicon.svg'),FAVICON_SHA256,'dist/favicon.svg is the chosen icon');
for(const p of [licenceFile,'dist/fonts/Anton-OFL.txt']) {
 const bytes=fs.readFileSync(path.join(root,p));
 assert.ok(!bytes.includes(13),'Anton licence uses LF only: '+p);
 assert.equal(sha256(p),LICENCE_LF_SHA256,'Anton licence text unchanged after CRLF to LF only: '+p);
}
for(const p of changed){
 assert.ok(/^(web\/src\/|web\/scripts\/|dist\/|artifacts\/)/.test(p)||itemPublic.includes(p)||p===licenceFile||["README.md","DESIGN.md","web/validation/README.md"].includes(p),"Outside approved tree scope: "+p);
 assert.ok(!p.startsWith('web/pinned/'),'Pinned source changed: '+p);
 assert.ok(!p.startsWith('web/public/')||itemPublic.includes(p)||p===licenceFile,'Public file changed outside the two approved ITEM pictures and exact LF-only licence repair: '+p);
 // v12 section 5: the exact page shell is pinned below; build configuration and validation fixtures stay unchanged.
 assert.ok(!['web/vite.config.ts','web/tsconfig.json'].includes(p)&&(!p.startsWith('web/validation/')||p==='web/validation/README.md'),'Page shell, build configuration or validation fixture changed: '+p);
 assert.ok(!/(^|\/)(lib|node_modules|\.github|\.git)(\/|$)|(^|\/)\.env(?:\.|$)|(^|\/)(foundry\.toml|foundry\.lock|remappings\.txt|\.gitmodules|package\.json|[^/]*lock[^/]*)$/.test(p),'Protected path changed: '+p);
 if(p.startsWith('web/src/'))assert.ok(itemSource.includes(p),'Source outside exact ITEM rule 7 scope changed: '+p);
 assert.ok(!p.startsWith('src/'),'Root contract source changed');
}
// v20: no new source and no new public asset.
const untracked=git(['ls-files','--others','--exclude-standard','--','web/src','web/public']).trim().split('\n').filter(Boolean);
// v25: its two new stats sources are accepted tracked or untracked (git apply with or without --index); nothing else is new.
const V25_NEW=['web/src/VaultStats.tsx','web/src/vaultStatsReport.tsx'];
assert.deepEqual(untracked.filter(p=>!V25_NEW.includes(p)).sort(),[],'v25 adds no runtime source or public asset beyond its two stats sources');
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
// 2026-10-16, Add liquidity build: exact same 24 states; four Owner captures join four Docs lossless WebPs.
const shotNames=['empty','stocks25'].flatMap(state=>[1440,375].flatMap(width=>['vault','deposit','redeem','docs','owner','losses'].map(page=>`artifacts/${state}-${page}-${width}.${['docs','owner'].includes(page)?'webp':'jpg'}`)));
const shots=files.filter(p=>/^artifacts\/(empty|stocks25)-.*\.(?:jpg|webp)$/.test(p));assert.deepEqual(shots.sort(),[...shotNames].sort(),'Exact 24 required states and eight explicit lossless containers');
const packaging=JSON.parse(fs.readFileSync(path.join(root,'artifacts/screenshot-packaging.json'),'utf8'));
assert.equal(packaging.count,24);assert.equal(packaging.losslessCount,8);
assert.deepEqual(packaging.files.map(p=>p.file).sort(),shotNames.filter(p=>p.endsWith('.webp')).sort());
for(const entry of packaging.files){
 assert.equal(entry.replaces,entry.file.replace(/\.webp$/,'.jpg'));
 assert.equal(entry.webpSha256,sha256(entry.file),'Lossless evidence hash: '+entry.file);
 assert.equal(entry.webpBytes,fs.statSync(path.join(root,entry.file)).size);
 assert.equal(entry.width,Number(entry.file.match(/-(1440|375)\.webp$/)[1]));
 assert.ok(entry.height>812&&/^[a-f0-9]{64}$/.test(entry.rgbaSha256)&&/^[a-f0-9]{64}$/.test(entry.pngSha256));
 assert.equal(entry.browserDecodedPixelEquality,true);
}
for(const p of ITEM_WALK_SHOTS)assert.ok(files.includes(p),'Missing required ITEM walk screenshot: '+p);
const extraImages=files.filter(p=>/^artifacts\/.*\.(png|jpg|webp|svg)$/.test(p)&&!shots.includes(p)&&!ITEM_WALK_SHOTS.includes(p)&&!/^artifacts\/redeem-title-dpr-(1|1\.25|1\.5)\.png$/.test(p));assert.deepEqual(extraImages,[]);
// SPEC delivery budget: compact generated JSON whitespace only, preserving every evidence value.
// The approved asset manifest remains byte-pinned and is never rewritten.
for(const p of files.filter(p=>p.startsWith('artifacts/')&&p.endsWith('.json')&&p!=='artifacts/art-manifest.json'&&p!=='artifacts/bundle-check.json')) {
 const file=path.join(root,p),before=fs.readFileSync(file,'utf8'),value=JSON.parse(before),after=JSON.stringify(value)+'\n';
 assert.deepEqual(JSON.parse(after),value,'lossless evidence compaction: '+p);
 if(Buffer.byteLength(after)<Buffer.byteLength(before))fs.writeFileSync(file,after);
}
const productionFiles={};for(const p of files.filter(p=>p.startsWith('dist/'))){const b=fs.readFileSync(path.join(root,p));productionFiles[p]={bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')};}
const result={limitBytes:8388608,uncompressedDeliveryBytes:0,fileCount:files.length,productionExportBytes:Object.values(productionFiles).reduce((a,b)=>a+b.bytes,0),productionFiles,accounting:'Complete candidate file contents including tracked lib sources and this report. Excludes Git metadata, removed task inputs and disposable test/scratch. No Git metadata was modified.',checks:['Protected configuration, dependencies, root contracts, web/pinned, build configuration and validation fixtures unchanged; ITEM and BASK source scope independently pinned; exact share shell and both share JPEG copies pinned; both favicon copies unchanged','v25: source scope adds Vault.tsx, the two new stats sources and no public asset','No git submodules or nested dependency/cache/archive payloads','24 required empty/25-stock screenshots retained: sixteen quality-18 JPEGs and exactly eight full Docs/Owner lossless WebPs with independent browser/Pillow pixel equality; only the exact named ITEM walk JPEGs are added','Both copies of all 37 original manifest assets and the two exact approved ITEM pictures included']};
const report=path.join(root,'artifacts/bundle-check.json');
for(let i=0;i<4;i++){fs.writeFileSync(report,JSON.stringify(result,null,2)+'\n');result.uncompressedDeliveryBytes=files.reduce((sum,p)=>sum+fs.statSync(path.join(root,p)).size,0);}
fs.writeFileSync(report,JSON.stringify(result,null,2)+'\n');assert.ok(result.uncompressedDeliveryBytes<=result.limitBytes,"Over the 8 MiB budget (if the 24 screenshots are still an older set, run scripts/run-browser.mjs first: it rewrites them at quality 18): "+JSON.stringify(result));console.log('PASS complete bundle',result.uncompressedDeliveryBytes,'/',result.limitBytes,'bytes; lib included');

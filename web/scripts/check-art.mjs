import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE);
const root = path.resolve(".."), captures = path.join(root, "test/scratch/art-review");
fs.mkdirSync(captures, { recursive: true });
const manifestBytes = fs.readFileSync(path.join(root, "artifacts/art-manifest.json"));
const sha = b => createHash("sha256").update(b).digest("hex");
assert.equal(sha(manifestBytes), "2d22583bb51557f412a6894d897cfc3bb839d31850fd676a6d0746cd61a588fa");
const manifest = JSON.parse(manifestBytes), hashes = [];
for (const dir of ["web/public", "dist"]) {
  const expected = manifest.files.map(f => f.path).sort();
  const actual = fs.readdirSync(path.join(root, dir, "art"), {recursive:true, withFileTypes:true})
    .filter(e => e.isFile()).map(e => path.relative(path.join(root,dir),path.join(e.parentPath,e.name))).sort();
  assert.deepEqual(actual, expected);
  for (const f of manifest.files) {
    const b = fs.readFileSync(path.join(root, dir, f.path));
    assert.equal(b.length, f.bytes, f.path);
    assert.equal(sha(b), f.sha256, f.path);
    hashes.push({path: `${dir}/${f.path}`, bytes:b.length, sha256:sha(b)});
  }
}
const server = http.createServer((req,res) => {
  const parts = req.url.split("/");
  const dir = parts[1] === "baseline" ? process.env.BASKET_BASELINE_DIST : path.join(root,"dist");
  const p = path.resolve(dir, parts.slice(2).join("/") || "index.html");
  if (!p.startsWith(dir+"/")) return res.writeHead(403).end();
  try {
    res.setHeader("Content-Type", ({".html":"text/html",".js":"application/javascript",".css":"text/css",".webp":"image/webp",".svg":"image/svg+xml",".woff2":"font/woff2"})[path.extname(p)] || "text/plain");
    res.end(fs.readFileSync(p));
  } catch { res.writeHead(404).end(); }
});
await new Promise(r=>server.listen(0,"127.0.0.1",r));
const base = `http://127.0.0.1:${server.address().port}`;
const checks=[], visibility=[], bubbles=[];
let browser;
try {
  for (const [engine, launcher] of [["Chromium",chromium],["WebKit",webkit]]) {
    browser=await launcher.launch({headless:true});
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    await page.route(/https:\/\/(rpc\.mainnet\.chain\.robinhood\.com|robinhood-rpc\.publicnode\.com)\/?$/, async route=> {
      try { const res=await fetch(route.request().url(), {method:"POST",headers:{"content-type":"application/json"},body:route.request().postData(),signal:AbortSignal.timeout(20000)}); await route.fulfill({body:await res.text(),contentType:"application/json"}); }
      catch {await route.abort();}
    });
    for (const width of [375,2560]) {
      await page.setViewportSize({width,height:1000});
      await page.goto(base+"/preview/#deposit");
      await page.evaluate(()=>document.fonts.ready);
      assert.equal(await page.locator('.marquee button').count(),0);
      const track=page.locator('.marquee-track');
      const geometry=await track.evaluate(e=>({halves:[...e.children].map(c=>({width:c.getBoundingClientRect().width,text:c.textContent})),frame:e.parentElement.clientWidth,contain:getComputedStyle(e.parentElement).contain,isolation:getComputedStyle(e.parentElement).isolation,duration:e.getAnimations()[0].effect.getTiming().duration}));
      assert.equal(geometry.halves[0].text,geometry.halves[1].text);
      assert.ok(Math.abs(geometry.halves[0].width-geometry.halves[1].width)<0.01, "Identical halves within compositor subpixel rounding");
      assert.ok(geometry.halves[0].width>=geometry.frame);
      assert.equal(geometry.contain,"none"); assert.equal(geometry.isolation,"auto");
      assert.equal(geometry.duration,width===375?45000:180000);
      for (const fraction of [0,.25,.5,.75,.99999,1]) {
        assert.equal(await track.evaluate((e,f)=>{const a=e.getAnimations()[0];a.pause();a.currentTime=a.effect.getTiming().duration*f;const r=e.getBoundingClientRect(),p=e.parentElement.getBoundingClientRect();return r.left<=p.left&&r.right>=p.right;},fraction),true);
        await page.locator('.marquee').screenshot({path:path.join(captures,`${engine}-loop-${width}-${fraction}.png`)});
      }
      await page.emulateMedia({reducedMotion:"reduce"});
      assert.equal(await track.evaluate(e=>getComputedStyle(e).animationName),"none");
      await page.emulateMedia({reducedMotion:"no-preference"});
      checks.push(`${engine} ${width}: equal full-width halves, sampled complete loop, 45/180s, overflow only, no pause, reduced motion still`);
    }
    await page.emulateMedia({reducedMotion:"reduce"});
    for(const width of [1440,960,800,661,660,375,320]) {
      await page.setViewportSize({width,height:width===375?812:1000});
      for(const name of ["vault","deposit","redeem","docs","owner","losses"]) {
        await page.goto(base+"/preview/#"+name);
        await page.evaluate(()=>document.fonts.ready);
        await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${engine} ${name} ${width} overflow`);
        const shelf=await page.locator('.store-shelf').evaluateAll(es=>es.map(e=>[...e.children].map(row=>({width:row.clientWidth,last:row.lastElementChild.getBoundingClientRect().right,right:row.getBoundingClientRect().right,icons:[...row.children].map(i=>({src:i.getAttribute('src'),w:i.getBoundingClientRect().width,h:i.getBoundingClientRect().height,alt:i.alt,transform:getComputedStyle(i).transform}))}))));
        assert.equal(shelf.length,name==='vault'?2:1);
        const foods=manifest.files.filter(f=>f.path.endsWith('.svg'));
        for(const rows of shelf) for(let n=0;n<2;n++) {
          const row=rows[n],list=n?foods.slice(14):foods.slice(0,14);
          assert.ok(row.last>=row.right,`shelf end ${width}`);
          for(let i=0;i<row.icons.length;i++) {const icon=row.icons[i];assert.equal(icon.w,icon.h);assert.equal(icon.alt,'');assert.equal(icon.transform,'none');assert.equal(icon.src,'./'+list[i%list.length].path);}
        }
        if(['vault','deposit','redeem'].includes(name)) {
          const picture=await page.locator('.character-picture').evaluate(e=>({width:e.getAttribute('width'),height:e.getAttribute('height'),fit:getComputedStyle(e).objectFit,position:getComputedStyle(e).objectPosition,display:getComputedStyle(e).display,h:e.getBoundingClientRect().height,src:e.getAttribute('src')}));
          const f=manifest.files.find(f=>'./'+f.path===picture.src);
          assert.equal(Number(picture.width),f.width);assert.equal(Number(picture.height),f.height);
          assert.equal(picture.fit,'contain');assert.equal(picture.position,'50% 100%');assert.equal(picture.display,'block');
          assert.equal(picture.h,width>960?(name==='vault'?300:320):width>660?260:name==='vault'?200:240);
          const bubble=page.locator('.speech-bubble');
          assert.equal(await bubble.innerText(),({vault:'I was hoping you would come through my aisle',deposit:'Go ahead and put it in hehe',redeem:'are you sure that’s all you came here for?'})[name]);
          assert.equal(await bubble.evaluate(e=>getComputedStyle(e).transform),'none');
          assert.equal(await bubble.evaluate(e=>{const b=e.getBoundingClientRect(),p=e.parentElement.getBoundingClientRect();return b.left>=p.left&&b.right<=p.right&&b.top>=p.top&&b.bottom<=p.bottom;}),true,`${engine} ${name} ${width}: speech stays inside frame`);
          if([1440,800,375,320].includes(width)) {
            await page.locator(name==='vault'?'.vault-hero':'.picture-stage').screenshot({path:path.join(captures,`${engine}-${name}-${width}.png`)});
            await page.screenshot({path:path.join(captures,`${engine}-${name}-${width}-screen.png`)});
          }
          const geometry = await page.locator('.character-picture').evaluate(e => {
            const i=e.getBoundingClientRect(), b=e.parentElement.querySelector('.speech-bubble').getBoundingClientRect();
            const scale=Math.min(i.width/e.naturalWidth,i.height/e.naturalHeight);
            return {scale,x:i.x+(i.width-e.naturalWidth*scale)/2,y:i.bottom-e.naturalHeight*scale,bubble:{x:b.x,y:b.y,width:b.width,height:b.height}};
          });
          bubbles.push({engine,name,width,picture,geometry});
        }
      }
      checks.push(`${engine} ${width}: six routes without overflow; both shelf rows filled with ordered square images, Vault copy included; picture geometry and exact speech`);
    }
    await browser.close();browser=undefined;
  }
  fs.writeFileSync(path.join(root,'artifacts/art-validation.json'),JSON.stringify({hashes,checks,bubbles,limitations:['Linux browser engines; physical iPhone not tested. Rendered screenshots reviewed separately.']},null,2)+'\n');
  console.log('PASS art hashes and browser layout',hashes.length,checks.length);
} finally {await browser?.close();await new Promise(r=>server.close(r));}

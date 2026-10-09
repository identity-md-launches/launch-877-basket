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
    .filter(e => e.isFile()).map(e => path.relative(path.join(root,dir),path.join(e.parentPath,e.name)).split(path.sep).join("/")).sort();
  assert.deepEqual(actual, expected);
  for (const f of manifest.files) {
    const b = fs.readFileSync(path.join(root, dir, f.path));
    assert.equal(b.length, f.bytes, f.path);
    assert.equal(sha(b), f.sha256, f.path);
    hashes.push({path: `${dir}/${f.path}`, bytes:b.length, sha256:sha(b)});
  }
}
// Look update: the pop-out title character on Vault, Deposit and Redeem.
const LINES = {vault:"I was hoping you would come through my aisle", deposit:"Go ahead and put it in", redeem:"are you sure that’s all you came here for?"};
// Picture regions in natural pixels [x0, y0, x1, y1]. The bubble may cover no opaque pixel of the picture and none of
// these boxes; its tail may cover no opaque pixel of the face (mouth included), hands or held items; the title text
// may cover no opaque pixel of the figure.
const REGIONS = {
  vault: {w:606, h:1000, face:[150,55,300,212], raisedHand:[22,12,118,128], restingHand:[345,476,430,532], crate:[290,405,596,902]},
  deposit: {w:313, h:1000, face:[78,58,208,205], leftHand:[30,282,96,348], rightHand:[218,282,282,348], basket:[10,296,293,505]},
  redeem: {w:484, h:1000, face:[240,52,372,214], bag:[12,42,306,448], leftHand:[58,358,136,450], rightHand:[178,378,268,452]},
};
const pictureHeight = width => width >= 1000 ? 390 : width >= 661 ? 340 : width >= 360 ? 300 : 270;
const bundle = fs.readdirSync(path.join(root, "dist/assets")).filter(f => f.endsWith(".js")).map(f => fs.readFileSync(path.join(root, "dist/assets", f), "utf8")).join("\n");
for (const line of Object.values(LINES)) assert.ok(bundle.includes(line), line);
assert.ok(bundle.includes("A different receiver must connect here to claim any stocks still owed to it."), "receiver wording");
for (const gone of ["hehe", "WOW!", "Unsent stocks are owed", "must connect to claim", "vault-hero", "clerk-panel", "picture-stage"]) assert.ok(!bundle.includes(gone), "removed from the bundle: " + gone);
// v9 A4: the old tagline is gone from the whole built site (page, scripts, styles, icon), in any letter case.
const TAGLINE = /one\s+basket/i;
for (const f of fs.readdirSync(path.join(root, "dist"), {recursive:true}).map(String).filter(f => /\.(html|js|css|svg|json|txt)$/.test(f)))
  assert.doesNotMatch(fs.readFileSync(path.join(root, "dist", f), "utf8"), TAGLINE, "tagline in dist/" + f);
// The other pages keep their eyebrow (HEAD text); the Vault title has none.
const EYEBROWS = {vault:null, deposit:"Fill your basket", redeem:"At the checkout", docs:"Know your basket", owner:"Behind the counter", losses:"Accounting health"};
// v9 A2 slogan strip: each half shows k whole slogan lines (one line is 720 px), k = the fewest lines that cover the
// viewport (1 up to 720 px, 2 up to 1440 px, ... 8 from 5041 px); 45 s per line (16 px/s), 11.25 s at 660 px and
// below (64 px/s); the moving block is at most two screens plus two lines wide and has no will-change.
const SLOGAN = "Basket buddies! • Take a stroll down the aisles • Give your cart a twirl • ";
const stripLines = width => Math.min(8, Math.max(1, Math.ceil(width / 720)));
// In the page: the strip's geometry, with the animation paused at `fraction` of its loop (null: leave it). `joins` are
// the gaps from the last glyph of each shown line to the first glyph of the next one (inside a half and across the
// seam between the halves), `wordGap` the normal gap between a bullet and the next word.
function stripGeometry(fraction) {
  const track = document.querySelector(".marquee-track"), win = track.parentElement, a = track.getAnimations();
  if (fraction !== null && a[0]) { a[0].pause(); a[0].currentTime = a[0].effect.getTiming().duration * fraction; }
  const R = e => e.getBoundingClientRect();
  const glyph = (span, i) => {
    const w = document.createTreeWalker(span, NodeFilter.SHOW_TEXT);
    for (let n, k = i; (n = w.nextNode()); k -= n.length) if (k < n.length) { const rg = document.createRange(); rg.setStart(n, k); rg.setEnd(n, k + 1); return rg.getBoundingClientRect(); }
    return null;
  };
  const halves = [...track.children].map(h => ({text: h.textContent, width: R(h).width, minWidth: getComputedStyle(h).minWidth,
    spans: [...h.children].map(s => ({text: s.textContent, display: getComputedStyle(s).display, width: R(s).width}))}));
  const shown = [...track.children].map(h => [...h.children].filter(s => getComputedStyle(s).display !== "none"));
  const run = shown.flat(), text = run[0].textContent, last = text.trimEnd().length - 1, bullet = text.indexOf("•");
  const wordGap = glyph(run[0], bullet + 2).left - glyph(run[0], bullet).right;
  const joins = run.slice(1).map((s, i) => glyph(s, 0).left - glyph(run[i], last).right);
  const t = R(track), w = R(win), cs = getComputedStyle(track);
  // Box edges, exact in both engines: the shown lines sit edge to edge from the track's left end to its right end,
  // each line box as wide as its text (WebKit rounds single-glyph boxes to whole pixels, so glyph gaps get a looser bound).
  const boxes = run.map(R), halfBoxes = [...track.children].map(R);
  const edges = [boxes[0].left - t.left, t.right - boxes[boxes.length - 1].right, halfBoxes[0].left - t.left, halfBoxes[1].left - halfBoxes[0].right, t.right - halfBoxes[1].right,
    ...boxes.slice(1).map((b, i) => b.left - boxes[i].right)];
  const textWidths = run.map(sp => { const rg = document.createRange(); rg.selectNodeContents(sp); return R(sp).width - rg.getBoundingClientRect().width; });
  return {halves, shownCounts: shown.map(s => s.length), track: t.width, frame: w.width, viewport: innerWidth, wordGap, joins,
    lead: glyph(run[0], 0).left - t.left, tail: t.right - glyph(run[run.length - 1], last).right, edges, textWidths,
    covers: t.left <= w.left + 0.01 && t.right >= w.right - 0.01, offset: t.left - w.left, running: a.filter(x => x.playState === "running").length, willChange: cs.willChange, animationName: cs.animationName,
    transform: cs.transform, duration: a[0]?.effect.getTiming().duration, contain: getComputedStyle(win).contain, isolation: getComputedStyle(win).isolation};
}
const server = http.createServer((req,res) => {
  const parts = req.url.split("/");
  const dir = parts[1] === "baseline" ? process.env.BASKET_BASELINE_DIST : path.join(root,"dist");
  const p = path.resolve(dir, parts.slice(2).join("/") || "index.html");
  if (!p.startsWith(dir+path.sep)) return res.writeHead(403).end();
  try {
    res.setHeader("Content-Type", ({".html":"text/html",".js":"application/javascript",".css":"text/css",".webp":"image/webp",".svg":"image/svg+xml",".woff2":"font/woff2"})[path.extname(p)] || "text/plain");
    res.end(fs.readFileSync(p));
  } catch { res.writeHead(404).end(); }
});
await new Promise(r=>server.listen(0,"127.0.0.1",r));
const base = `http://127.0.0.1:${server.address().port}`;
// Title panel geometry in the page: bubble words, bubble/strip/frame edges and the wallet hint gap; with `pixels`, the
// picture pixels under the bubble, its tail and the title text.
function titleGeometry({R, name, pixels}) {
  const title = document.querySelector(".page-title"), r = e => e.getBoundingClientRect();
  const holder = title.querySelector(":scope > .title-character"), img = holder.querySelector("img.character-picture"), bubble = holder.querySelector("p.speech-bubble");
  const T = r(title), br = r(bubble), ir = r(img), cs = getComputedStyle(bubble), bw = parseFloat(getComputedStyle(title).borderTopWidth), bl = parseFloat(cs.borderLeftWidth);
  const out = {overflow: document.documentElement.scrollWidth > innerWidth, split: [], wordOutside: []};
  const tn = bubble.firstChild, lines = new Set();
  for (const m of tn.textContent.matchAll(/\S+/g)) {
    const rg = document.createRange(); rg.setStart(tn, m.index); rg.setEnd(tn, m.index + m[0].length);
    const tops = new Set([...rg.getClientRects()].filter(x => x.width > 0).map(x => Math.round(x.top)));
    if (tops.size !== 1) out.split.push(m[0]);
    tops.forEach(t => lines.add(t));
    const wr = rg.getBoundingClientRect();
    if (wr.left < br.left + bl - 0.5 || wr.right > br.right - bl + 0.5 || wr.top < br.top + bl - 0.5 || wr.bottom > br.bottom - bl + 0.5) out.wordOutside.push(m[0]);
  }
  out.bubbleLines = lines.size;
  const after = getComputedStyle(title, "::after"), stripTop = T.bottom - bw - parseFloat(after.height) - parseFloat(after.borderTopWidth);
  const textRects = [title.querySelector(":scope > .eyebrow"), title.querySelector(":scope > h1"), title.querySelector(":scope > p:last-of-type")]
    .filter(Boolean).flatMap(e => { const rg = document.createRange(); rg.selectNodeContents(e); return [...rg.getClientRects()].filter(x => x.width > 0); });
  out.textToStrip = stripTop - Math.max(...textRects.map(x => x.bottom));
  // v9 A4: the title text block (eyebrow, or the heading where there is none, down to the sentence) is centred
  // vertically beside her on wider screens; on phones the Vault heading starts 17 px under her shelf.
  const firstText = title.querySelector(":scope > .eyebrow") ?? title.querySelector(":scope > h1");
  out.firstText = firstText.tagName;
  out.textAbove = r(firstText).top - (T.top + bw + parseFloat(getComputedStyle(title).paddingTop));
  out.textBelow = stripTop - parseFloat(after.marginTop) - r(title.querySelector(":scope > p:last-of-type")).bottom;
  out.textUnderHolder = r(firstText).top - r(holder).bottom;
  out.phone = innerWidth <= 660;
  out.name = name;
  out.bubbleInFrame = br.left >= T.left + bw - 0.5 && br.right <= T.right - bw + 0.5 && br.top >= T.top + bw - 0.5 && br.bottom <= stripTop + 0.5;
  const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  out.textOnBubble = textRects.some(x => hit(x, br));
  const reg = R[name], ratio = reg.w / reg.h;
  let dw = ir.width, dh = ir.height;
  if (ir.width / ir.height > ratio) dw = ir.height * ratio; else dh = ir.width / ratio;
  const D = {x: ir.left + (ir.width - dw) / 2, y: ir.bottom - dh, w: dw, h: dh}, sx = dw / reg.w, sy = dh / reg.h;
  const keys = Object.keys(reg).filter(k => !["w", "h"].includes(k));
  const box = k => { const [a, b, c, d] = reg[k]; return {left: D.x + a * sx, top: D.y + b * sy, right: D.x + c * sx, bottom: D.y + d * sy}; };
  out.bubbleOnRegions = keys.filter(k => hit(br, box(k)));
  out.picture = {x: D.x, y: D.y, w: D.w, h: D.h, elementHeight: ir.height};
  out.bubble = {x: br.x, y: br.y, w: br.width, h: br.height};
  out.popAboveFrame = T.top - (D.y + 8 * sy);
  out.pictureInView = D.x >= 0 && D.x + D.w <= innerWidth;
  out.clipped = [];
  for (let e = img.parentElement; e && e !== document.documentElement; e = e.parentElement) {
    const c = getComputedStyle(e);
    if (c.overflowX !== "visible" || c.overflowY !== "visible" || c.clipPath !== "none" || c.contain.includes("paint")) {
      const er = r(e);
      if (D.x < er.left - 0.5 || D.x + D.w > er.right + 0.5 || D.y < er.top - 0.5 || D.y + D.h > er.bottom + 0.5) out.clipped.push(e.className || e.tagName);
    }
  }
  const wh = document.querySelector(".wallet-help");
  if (wh) {
    const btn = wh.querySelector("button"), rg = document.createRange();
    rg.selectNodeContents(wh); rg.setEndBefore(btn);
    const rs = [...rg.getClientRects()].filter(x => x.width > 0), b = r(btn), W = r(wh);
    const t = {left: Math.min(...rs.map(x => x.left)), right: Math.max(...rs.map(x => x.right)), top: Math.min(...rs.map(x => x.top)), bottom: Math.max(...rs.map(x => x.bottom))};
    const sameRow = b.top < t.bottom && t.top < b.bottom;
    out.walletGap = sameRow ? b.left - t.right : b.top - t.bottom;
    out.walletInside = b.right <= W.right + 0.5 && t.right <= W.right + 0.5;
  }
  if (pixels) {
    const canvas = document.createElement("canvas"); canvas.width = reg.w; canvas.height = reg.h;
    const g = canvas.getContext("2d"); g.drawImage(img, 0, 0, reg.w, reg.h);
    const A = g.getImageData(0, 0, reg.w, reg.h).data;
    const regionOf = (ix, iy) => keys.find(k => { const [a, b, c, d] = reg[k]; return ix >= a && ix <= c && iy >= b && iy <= d; }) || "other";
    const scan = (rc, test) => {
      const found = {};
      for (let py = Math.floor(Math.max(rc.top, D.y)); py < Math.min(rc.bottom, D.y + D.h); py++)
        for (let px = Math.floor(Math.max(rc.left, D.x)); px < Math.min(rc.right, D.x + D.w); px++) {
          if (test && !test(px + 0.5, py + 0.5)) continue;
          const ix = Math.floor((px + 0.5 - D.x) / sx), iy = Math.floor((py + 0.5 - D.y) / sy);
          if (ix < 0 || iy < 0 || ix >= reg.w || iy >= reg.h || A[(iy * reg.w + ix) * 4 + 3] <= 60) continue;
          const k = regionOf(ix, iy); found[k] = (found[k] || 0) + 1;
        }
      return found;
    };
    out.bubbleCovers = scan(br);
    const before = getComputedStyle(bubble, "::before");
    const ys = before.clipPath.replace(/^polygon\(|\)$/g, "").split(/,\s*(?![^(]*\))/).map(p => parseFloat(p.trim().split(/\s+(?![^(]*\))/).pop()));
    const ox = br.left + bl, oy = br.top + parseFloat(cs.borderTopWidth) + parseFloat(before.top);
    const tip = {x: ox + parseFloat(before.left), y: oy + ys[0]}, b1 = {x: ox, y: oy + ys[1]}, b2 = {x: ox, y: oy + ys[2]};
    const side = (p, q, s) => (p.x - s.x) * (q.y - s.y) - (q.x - s.x) * (p.y - s.y);
    const inTail = (x, y) => { const P = {x, y}, d1 = side(P, tip, b1), d2 = side(P, b1, b2), d3 = side(P, b2, tip); return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)); };
    out.tail = {tip, b1, b2};
    out.tailCovers = scan({left: Math.min(tip.x, ox), top: Math.min(tip.y, b1.y), right: Math.max(tip.x, ox), bottom: b2.y}, inTail);
    out.textCovers = textRects.reduce((n, x) => n + Object.values(scan(x)).reduce((s, v) => s + v, 0), 0);
  }
  return out;
}
function assertGeometry(g, label, pixels) {
  assert.equal(g.overflow, false, `${label} overflow`);
  assert.deepEqual(g.split, [], `${label}: a bubble word is split`);
  assert.deepEqual(g.wordOutside, [], `${label}: bubble text outside the bubble`);
  assert.ok(g.textToStrip >= 12, `${label}: checker strip touches the title text (${g.textToStrip})`);
  assert.equal(g.firstText, g.name === "vault" ? "H1" : "P", `${label}: the Vault title has no eyebrow, the others keep theirs`);
  if (!g.phone) assert.ok(Math.abs(g.textAbove - g.textBelow) < 0.5, `${label}: title text not centred beside her (${g.textAbove} above, ${g.textBelow} below)`);
  else if (g.name === "vault") assert.ok(Math.abs(g.textUnderHolder - 17) < 0.5, `${label}: Vault heading not 17 px under her shelf (${g.textUnderHolder})`);
  assert.equal(g.bubbleInFrame, true, `${label}: bubble outside the title frame`);
  assert.equal(g.textOnBubble, false, `${label}: title text under the bubble`);
  assert.deepEqual(g.bubbleOnRegions, [], `${label}: bubble on face, hands or held item`);
  assert.ok(g.popAboveFrame > 0, `${label}: head does not rise above the panel`);
  assert.equal(g.pictureInView, true, `${label}: picture outside the viewport`);
  assert.deepEqual(g.clipped, [], `${label}: picture clipped`);
  assert.ok(g.walletGap >= 8, `${label}: wallet hint gap ${g.walletGap}`);
  assert.equal(g.walletInside, true, `${label}: wallet hint outside its box`);
  if (pixels) {
    assert.deepEqual(g.bubbleCovers, {}, `${label}: bubble covers the picture`);
    assert.deepEqual(Object.keys(g.tailCovers).filter(k => k !== "other"), [], `${label}: tail covers face, hands or held item`);
    assert.equal(g.textCovers, 0, `${label}: title text on the figure`);
  }
}
// A hash change re-renders asynchronously: wait until the requested route is the current page before measuring it.
const routeShown = name => !!document.querySelector(`a[aria-current="page"][href="#${name}"]`);
const checks=[], visibility=[], bubbles=[], shelfCounts=[];
let browser;
try {
  for (const [engine, launcher] of [["Chromium",chromium],["WebKit",webkit]]) {
    browser=await launcher.launch({headless:true});
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    await page.route(/https:\/\/(rpc\.mainnet\.chain\.robinhood\.com|robinhood-rpc\.publicnode\.com)\/?$/, async route=> {
      try { const res=await fetch(route.request().url(), {method:"POST",headers:{"content-type":"application/json"},body:route.request().postData(),signal:AbortSignal.timeout(20000)}); await route.fulfill({body:await res.text(),contentType:"application/json"}); }
      catch {await route.abort();}
    });
    const strips=[];
    for (const width of [320,375,660,661,720,721,1024,1440,1441,1920,2160,2161,2560,2880,2881,3440,3600,3601,4320,4321,5040,5041,5760]) {
      await page.setViewportSize({width,height:1000});
      await page.goto(base+"/preview/#deposit");
      await page.waitForFunction(routeShown,"deposit");
      await page.evaluate(()=>document.fonts.ready);
      assert.equal(await page.locator('.marquee button').count(),0);
      const k=stripLines(width),per=width<=660?11250:45000,label=`${engine} strip ${width}`;
      const g=await page.evaluate(stripGeometry,null);
      assert.equal(g.viewport,width,label);
      assert.equal(g.halves.length,2,label+': two halves');
      for(const h of g.halves) {
        assert.equal(h.spans.length,8,label+': eight lines in the markup of each half');
        for(const s of h.spans) assert.equal(s.text,SLOGAN,label+': line text');
        assert.equal(h.minWidth,'auto',label+': no min-width on a half');
        h.spans.forEach((s,i)=>{assert.equal(s.display==='none',i>=k,label+`: line ${i+1} shown only when k=${k} needs it`);if(i<k)assert.ok(Math.abs(s.width-720)<0.5,label+': one line is 720 px, not '+s.width);});
      }
      assert.deepEqual(g.shownCounts,[k,k],label+': k whole lines per half');
      assert.equal(g.halves[0].text,g.halves[1].text,label+': identical halves');
      assert.ok(Math.abs(g.halves[0].width-g.halves[1].width)<0.01,label+': equal halves');
      assert.ok(Math.abs(g.halves[0].width-k*720)<0.5*k,label+': half = k lines, not '+g.halves[0].width);
      assert.ok(k*720>=width&&g.halves[0].width>=g.frame-0.01,label+': k lines cover the viewport');
      if(k>1&&width<=5760) assert.ok((k-1)*720<width,label+': the fewest lines that cover it');
      assert.ok(g.track<=2*(width+720)+0.5,label+': moving block '+g.track+' px is over two screens plus two lines');
      assert.equal(g.willChange,'auto',label+': no will-change');
      assert.equal(g.contain,"none"); assert.equal(g.isolation,"auto");
      assert.equal(g.animationName,'shop-scroll',label);
      assert.ok(Math.abs(g.duration-k*per)<0.5,label+': loop '+g.duration+' ms');
      assert.ok(Math.abs(g.halves[0].width/(g.duration/1000)-(width<=660?64:16))<0.05,label+': speed');
      for (const fraction of [0,.1,.25,.5,.75,.9,.99999,1]) {
        const s=await page.evaluate(stripGeometry,fraction);
        assert.equal(s.covers,true,label+': strip window covered at '+fraction);
        assert.ok(s.wordGap>0,label+': word gap');
        // Line boxes edge to edge (no margin, padding or stretch anywhere in the track), each as wide as its text.
        for(const e of s.edges) assert.ok(Math.abs(e)<0.01,label+': line boxes not edge to edge '+JSON.stringify(s.edges));
        for(const e of s.textWidths) assert.ok(Math.abs(e)<1,label+': a line box wider than its text '+JSON.stringify(s.textWidths));
        // Glyphs: WebKit reports single-glyph boxes rounded out to whole pixels (each edge up to 1 px off), hence 2.5 px
        // there; a blank stretch would be a whole line (720 px) or more, and the box edges above are exact.
        const tol=engine==='WebKit'?2.5:0.5;
        assert.ok(Math.abs(s.lead)<tol,label+': text starts at the left end of the track '+s.lead);
        assert.ok(Math.abs(s.tail-s.wordGap)<tol,label+': the track ends one space after the last bullet '+[s.tail,s.wordGap]);
        assert.equal(s.joins.length,2*k-1);
        for(const j of s.joins) assert.ok(Math.abs(j-s.wordGap)<tol,label+`: gap ${j} between lines (or across the seam) is not the word gap ${s.wordGap} at ${fraction}`);
        if([375,1440,3440].includes(width)) await page.locator('.marquee').screenshot({path:path.join(captures,`${engine}-loop-${width}-${fraction}.png`)});
      }
      await page.emulateMedia({reducedMotion:"reduce"});
      await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
      const still=await page.evaluate(stripGeometry,null);
      assert.equal(still.animationName,"none",label+': reduced motion');
      assert.ok(Math.abs(still.offset)<0.01&&still.running===0&&['none','matrix(1, 0, 0, 1, 0, 0)'].includes(still.transform),label+': reduced motion still '+JSON.stringify([still.offset,still.running,still.transform]));
      assert.equal(still.covers,true,label+': still strip full');
      assert.deepEqual(still.shownCounts,[k,k]);
      await page.emulateMedia({reducedMotion:"no-preference"});
      strips.push(`${width}:${k}/${Math.round(g.track)}/${g.duration / 1000}s`);
    }
    checks.push(`${engine} slogan strip, width:lines per half/track px/loop [${strips.join(' ')}]: eight lines in the markup of each half, the first k shown (k = the fewest 720 px lines covering the viewport), identical halves, track <= 2 x (viewport + 720), no will-change, 16 px/s (64 px/s at 660 px and below); at 8 loop positions the window is covered, line boxes sit edge to edge and every line join and the seam between the halves has the normal word gap; reduced motion still and full`);
    await page.emulateMedia({reducedMotion:"reduce"});
    for(const width of [1440,1000,999,960,800,720,661,660,375,360,359,320]) {
      await page.setViewportSize({width,height:width===375?812:1000});
      for(const name of ["vault","deposit","redeem","docs","owner","losses"]) {
        await page.goto(base+"/preview/#"+name);
        await page.waitForFunction(routeShown,name);
        await page.evaluate(()=>document.fonts.ready);
        await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${engine} ${name} ${width} overflow`);
        const shelf=await page.locator('.store-shelf').evaluateAll(es=>es.map(e=>({unit:!!e.closest('.stock-section .sa-unit'),rows:[...e.children].map(row=>({display:getComputedStyle(row).display,width:row.clientWidth,last:row.lastElementChild.getBoundingClientRect().right,right:row.getBoundingClientRect().right,icons:[...row.children].map(i=>({src:i.getAttribute('src'),w:i.getBoundingClientRect().width,h:i.getBoundingClientRect().height,alt:i.alt,transform:getComputedStyle(i).transform}))}))})));
        assert.equal(shelf.length,name==='vault'?2:1);
        // v9 Stock shelves: on Vault the second shelf is the top shelf of the stock shelf unit, which shows only its
        // first food row (by design); every other shelf row is shown and filled to its end.
        assert.equal(shelf.filter(s=>s.unit).length,name==='vault'?1:0,`${engine} ${name} ${width}: food shelf inside the Stock shelves unit`);
        const foods=manifest.files.filter(f=>f.path.endsWith('.svg'));
        for(const {unit,rows} of shelf) for(let n=0;n<2;n++) {
          const row=rows[n],list=n?foods.slice(14):foods.slice(0,14);
          if(unit&&n===1) assert.equal(row.display,'none',`${engine} ${name} ${width}: the shelf unit shows only its first food row`);
          else {assert.notEqual(row.display,'none',`${engine} ${name} ${width}: shelf row ${n+1} shown`);assert.ok(row.width>0&&row.icons.length>0,`${engine} ${name} ${width}: shelf row ${n+1} empty`);assert.ok(row.last>=row.right,`shelf end ${width}`);}
          for(let i=0;i<row.icons.length;i++) {const icon=row.icons[i];assert.equal(icon.w,icon.h);assert.equal(icon.alt,'');assert.equal(icon.transform,'none');assert.equal(icon.src,'./'+list[i%list.length].path);}
        }
        // v9 Stock shelves (shelf-edge labels; the old stock cards are gone): once the vault is read, one label per
        // listed stock (the All count) with its ticker, price, status and Details button, inside the shelf unit (no
        // label sticks out sideways), filters and search at least 44 px tall, no motion under reduced motion.
        if(name==='vault') {
          await page.waitForFunction(()=>!document.querySelector('button.refresh')?.disabled);
          const sh=await page.evaluate(()=>{
            const sec=document.querySelectorAll('.stock-section'),s=sec[0],R=e=>e.getBoundingClientRect(),unit=s?.querySelector(':scope .sa-unit');
            const labels=[...s.querySelectorAll('article.sa-label')].map(l=>({ticker:l.querySelector('h4')?.textContent??'',price:!!l.querySelector('.sa-price'),status:l.querySelector('.sa-st')?.textContent??'',more:l.querySelector('button.sa-more')?.getAttribute('aria-expanded'),left:R(l).left,right:R(l).right,height:R(l).height,inSlot:!!l.parentElement?.matches('li.sa-slot')&&!!l.closest('ul.sa-shelves[role="list"]')}));
            const all=s.querySelector('.sa-filters button');
            return {sections:sec.length,heading:s.querySelector(':scope > .section-heading h2')?.textContent,old:document.querySelectorAll('.stock-grid, .stock-card').length,unit:unit?{left:R(unit).left,right:R(unit).right}:null,labels,
              all:all?Number(all.querySelector('.sa-count')?.textContent):null,allName:all?.firstChild?.textContent?.trim(),controls:[...s.querySelectorAll('.sa-filters button, .sa-search input')].map(e=>R(e).height),
              moving:document.getAnimations().filter(a=>a.effect?.target?.closest?.('.stock-section')).length};
          });
          assert.equal(sh.sections,1,`${engine} vault ${width}: one Stock shelves panel`);
          assert.equal(sh.heading,'Stock shelves');
          assert.equal(sh.old,0,`${engine} vault ${width}: old stock cards`);
          assert.ok(sh.unit,`${engine} vault ${width}: shelf unit`);
          if(sh.all!==null) {
            assert.equal(sh.allName,'All');
            assert.equal(sh.labels.length,sh.all,`${engine} vault ${width}: one label per listed stock`);
            assert.ok(sh.all>0);
            for(const l of sh.labels) {
              assert.ok(l.ticker.length>0&&l.price&&/^(Open|Closed|Retired)/.test(l.status)&&l.more==='false'&&l.inSlot,`${engine} vault ${width}: label ${JSON.stringify(l)}`);
              assert.ok(l.left>=sh.unit.left-0.5&&l.right<=sh.unit.right+0.5,`${engine} vault ${width}: label ${l.ticker} outside the shelf unit`);
              assert.ok(l.height>=44,`${engine} vault ${width}: label ${l.ticker} tap height ${l.height}`);
            }
            assert.equal(sh.controls.length,5);
            for(const h of sh.controls) assert.ok(h>=44,`${engine} vault ${width}: filter/search height ${h}`);
          }
          assert.equal(sh.moving,0,`${engine} vault ${width}: motion in the Stock shelves under reduced motion`);
          shelfCounts.push(`${engine} ${width}:${sh.labels.length}`);
        }
        // The old picture frames and the WOW! burst are gone everywhere; the Fresh! burst stays on the Stock shelves panel.
        assert.equal(await page.locator('.vault-hero, .clerk-panel, .picture-stage, .deposit-picture, .redeem-picture').count(),0,`${engine} ${name} old frames`);
        assert.equal(await page.getByText('WOW!').count(),0,`${engine} ${name} WOW!`);
        assert.equal(await page.locator('.burst').count(),name==='vault'?1:0,`${engine} ${name} bursts`);
        if(name==='vault') assert.equal(await page.locator('.stock-section .section-heading .burst.small').innerText(),'Fresh!');
        // v9 A4: the tagline is nowhere on the page; the Vault title has no eyebrow (no empty one either), the other pages
        // keep theirs; the footer is the basket icon, "Basket Protocol" and the links.
        const words=await page.evaluate(()=>{const t=document.querySelector('.page-title'),e=t.querySelector(':scope > .eyebrow');return {eyebrow:e?e.textContent:null,eyebrows:t.querySelectorAll(':scope > p.eyebrow').length,first:t.firstElementChild.tagName,body:document.body.textContent,title:document.title,footer:[...document.querySelector('footer > div').children].map(c=>c.tagName.toLowerCase()+(c.getAttribute('class')?'.'+c.getAttribute('class'):'')+(c.tagName==='STRONG'?':'+c.textContent:''))};});
        assert.equal(words.eyebrow,EYEBROWS[name],`${engine} ${name} eyebrow`);
        assert.equal(words.eyebrows,name==='vault'?0:1,`${engine} ${name} eyebrow count`);
        assert.equal(words.first,name==='vault'?'H1':'P',`${engine} ${name} first title element`);
        assert.doesNotMatch(words.body+' '+words.title,TAGLINE,`${engine} ${name} tagline on the page`);
        assert.deepEqual(words.footer,['svg.basket-icon','strong:Basket Protocol','span.footer-links'],`${engine} ${name} footer`);
        if(['vault','deposit','redeem'].includes(name)) {
          assert.equal(await page.locator(`.page-title.has-character.character-${name}`).count(),1);
          assert.equal(await page.locator('.character-picture').count(),1,`${engine} ${name} one picture`);
          assert.equal(await page.locator('.speech-bubble').count(),1,`${engine} ${name} one bubble`);
          assert.equal(await page.locator(`.page-title.character-${name} > .title-character > img.character-picture + p.speech-bubble`).count(),1,`${engine} ${name} picture and bubble in the title`);
          assert.equal(await page.locator('aside.panel > :first-child').evaluateAll(es=>es.every(e=>e.tagName==='H2')),true,`${engine} ${name} asides start with their heading`);
          const picture=await page.locator('.character-picture').evaluate(e=>({width:e.getAttribute('width'),height:e.getAttribute('height'),fit:getComputedStyle(e).objectFit,position:getComputedStyle(e).objectPosition,display:getComputedStyle(e).display,h:e.getBoundingClientRect().height,src:e.getAttribute('src'),alt:e.alt}));
          const f=manifest.files.find(f=>'./'+f.path===picture.src);
          assert.equal(picture.src,`./art/character/${name}.webp`);
          assert.equal(Number(picture.width),f.width);assert.equal(Number(picture.height),f.height);
          assert.ok(picture.alt.length>0);
          assert.equal(picture.fit,'contain');assert.equal(picture.position,'50% 100%');assert.equal(picture.display,'block');
          assert.ok(Math.abs(picture.h-pictureHeight(width))<0.01,`${engine} ${name} ${width} picture height ${picture.h}`);
          const bubble=page.locator('.speech-bubble');
          assert.equal(await bubble.innerText(),LINES[name]);
          assert.equal(await bubble.evaluate(e=>getComputedStyle(e).transform),'none');
          const geometry=await page.evaluate(titleGeometry,{R:REGIONS,name,pixels:true});
          assertGeometry(geometry,`${engine} ${name} ${width}`,true);
          if([1440,800,375,320].includes(width)) {
            const clip=await page.evaluate(()=>{const t=document.querySelector('.page-title').getBoundingClientRect(),i=document.querySelector('.character-picture').getBoundingClientRect(),top=Math.max(0,Math.min(t.top,i.top)+scrollY-12);return {x:0,y:top,width:innerWidth,height:t.bottom+scrollY+12-top};});
            await page.screenshot({path:path.join(captures,`${engine}-${name}-${width}.png`),clip,fullPage:true});
            await page.screenshot({path:path.join(captures,`${engine}-${name}-${width}-screen.png`)});
          }
          if([1440,800,375,320].includes(width)) bubbles.push(JSON.parse(JSON.stringify({engine,name,width,picture,geometry:{picture:geometry.picture,bubble:geometry.bubble,bubbleLines:geometry.bubbleLines,textToStrip:geometry.textToStrip,popAboveFrame:geometry.popAboveFrame,walletGap:geometry.walletGap}},(k,v)=>typeof v==='number'?Math.round(v*100)/100:v)));
        } else {
          assert.equal(await page.locator('.page-title.has-character, .title-character, .character-picture, .speech-bubble').count(),0,`${engine} ${name} no character`);
        }
        if(name==='redeem') assert.equal(await page.getByText(/Unsent stocks are owed/).count(),0,`${engine} redeem receiver note`);
        if(name==='docs') {
          const faq=await page.locator('.docs-grid > .panel').evaluateAll(ps=>{const i=ps.findIndex(p=>p.querySelector('h2')?.textContent==='Redemption'),f=ps[i+1];return {heading:f?.querySelector(':scope > h2')?.textContent,question:f?.querySelector(':scope > h3')?.textContent,answer:f?.querySelector(':scope > p')?.textContent.replace(/\s+/g,' ').trim()};});
          assert.deepEqual(faq,{heading:'FAQ',question:'What if a stock can’t be sent when I redeem?',answer:'Rarely, a stock can’t be sent at that moment (for example its issuer has paused transfers). The vault then keeps it for the receiver, who collects it later with Claim on the Redeem page. Only the receiver wallet can claim, so redeem to a wallet you control, not an exchange deposit address.'});
        }
      }
      checks.push(`${engine} ${width}: six routes without overflow; both shelf rows filled with ordered square images (the Stock shelves unit on Vault shows its first row only, by design); Stock shelves: one shelf-edge label per listed stock (${shelfCounts.at(-1)?.split(':')[1]}) with ticker, price, status and Details, inside the shelf unit, labels/filters/search at least 44 px, no old stock cards, still under reduced motion; title character inside the title panel with exact speech and picture height, head above the panel, bubble clear of the picture, tail clear of face/hands/items, whole bubble words, strip clear of the text, wallet hint gap; no old frames or WOW!, Fresh! kept; Docs FAQ; no Redeem receiver note; no tagline on the page, Vault title without eyebrow (text centred beside her, or 17 px under her on phones), other eyebrows kept, footer icon/name/links`);
    }
    // Every width from 320 to 2560 px: whole bubble words inside the bubble, the strip clear of the title text, the bubble in
    // its frame and off the picture's face/hands/item boxes, no overflow and a wallet hint gap of at least 8 px.
    for(const name of ["vault","deposit","redeem"]) {
      await page.setViewportSize({width:1440,height:1000});
      await page.goto(base+"/preview/#"+name);
      await page.waitForFunction(routeShown,name);
      await page.evaluate(()=>document.fonts.ready);
      await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
      const lines={};
      for(let width=320;width<=2560;width++) {
        await page.setViewportSize({width,height:1000});
        const g=await page.evaluate(titleGeometry,{R:REGIONS,name,pixels:width%40===0});
        assertGeometry(g,`${engine} ${name} ${width}`,width%40===0);
        lines[g.bubbleLines]=(lines[g.bubbleLines]||0)+1;
      }
      checks.push(`${engine} ${name}: every width 320-2560 px keeps whole bubble words (bubble lines ${JSON.stringify(lines)}), the strip clear of the title text, the title text centred beside her (Vault heading 17 px under her on phones), the bubble in its frame and the wallet hint gap; picture pixels checked every 40 px`);
    }
    await browser.close();browser=undefined;
  }
  fs.writeFileSync(path.join(root,'artifacts/art-validation.json'),JSON.stringify({hashes,checks,bubbles,limitations:['Linux browser engines; physical iPhone not tested. Rendered screenshots reviewed separately.']},null,2)+'\n');
  console.log('PASS art hashes and browser layout',hashes.length,checks.length);
} finally {await browser?.close();await new Promise(r=>server.close(r));}

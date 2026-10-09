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
// v10: the 24/7 redemption tag and the capitalised Docs deposits sentence are in; the Stock shelves show no price time
// (the label age words and clock, the drawer's age and age() are gone from scripts and styles); the reason-9
// "old price" tag stays.
const V10_TAG = "Redemptions are open 24/7. Deposit hours apply to deposits only.";
const V10_DOCS = "Deposits open Sunday 8 pm to Friday 8 pm New York time, closed on US market holidays, redemptions always open";
const styles = fs.readdirSync(path.join(root, "dist/assets")).filter(f => f.endsWith(".css")).map(f => fs.readFileSync(path.join(root, "dist/assets", f), "utf8")).join("\n");
for (const text of ["Redemptions are open 24/7.", "Deposit hours apply to deposits only.", "Deposits open Sunday 8 pm to Friday 8 pm New York time", "old price", '"sa-old"', "Feed price"]) assert.ok(bundle.includes(text), "v10 text in the bundle: " + text);
for (const gone of ["Redemption is always open.", "deposits open Sunday", "Feed price / age", "just now", "Less than 1 min ago", " min ago", "m ago", "days ago", "price time: ", "Future timestamp", "sa-clock", "sa-upd", "sa-when"]) assert.ok(!(bundle + styles).includes(gone), "removed from the bundle (v10): " + gone);
assert.ok(styles.includes(".hours-tag"), "v10 tag style");
// Words on the shelves that would be a price time.
const PRICE_TIME = /\bago\b|just now|price updated|price time|less than 1 min|future timestamp|\d+h \d+m/i;
// v9 A4: the old tagline is gone from the whole built site (page, scripts, styles, icon), in any letter case.
const TAGLINE = /one\s+basket/i;
for (const f of fs.readdirSync(path.join(root, "dist"), {recursive:true}).map(String).filter(f => /\.(html|js|css|svg|json|txt)$/.test(f)))
  assert.doesNotMatch(fs.readFileSync(path.join(root, "dist", f), "utf8"), TAGLINE, "tagline in dist/" + f);
// The other pages keep their eyebrow (HEAD text); the Vault title has none.
const EYEBROWS = {vault:null, deposit:"Fill your basket", redeem:"At the checkout", docs:"Know your basket", owner:"Behind the counter", losses:"Accounting health"};
// v9 A2 slogan strip: each half shows k whole slogan lines (one line is 720 px), k = the fewest lines that cover the
// viewport (1 up to 720 px, 2 up to 1440 px, ... 8 from 5041 px).
// v10 strip loop: the two identical halves share one grid cell and each moves as its own Web Animation started by
// Marquee (Scenery.tsx; no CSS animation): linear and endless from translateX(100%) to translateX(-100%) of its own
// width, at exactly 16 px/s (64 px/s at 660 px and below; the cycle follows the measured half width L, so it lasts
// 2 L / speed), the second half half a cycle behind the first. So the halves always sit edge to edge and cover the
// window, each jumps back only while it is wholly off screen (wholly left of the window just before, wholly right of
// it just after), no animationiteration event fires at a reset, the only moving blocks are the two halves (k lines
// each, the track itself stays put) and nothing in the strip has will-change, a CSS animation or a 3D transform.
// Under reduced motion both animations are cancelled and the halves stand still side by side from the left edge.
const SLOGAN = "Basket buddies! • Take a stroll down the aisles • Give your cart a twirl • ";
const stripLines = width => Math.min(8, Math.max(1, Math.ceil(width / 720)));
// Loop phases sampled, as fractions of a half's cycle: twelve evenly spaced ones plus just before, at and just after
// each half's reset (the first half jumps back at 0.5, the second at 0 = 1).
const STRIP_PHASES = [...new Set([0, 1e-7, ...Array.from({length: 12}, (_, i) => (i + 1) / 12), 0.4999999, 0.5000001, 0.9999999])].sort((a, b) => a - b);
// In the page: the strip's geometry, with both animations paused at `fraction` of their cycle (null: leave them).
// The halves are taken in screen order (left to right): `joins` are the gaps from the last glyph of each shown line to
// the first glyph of the next one (inside a half and across the seam between the halves), `wordGap` the normal gap
// between a bullet and the next word; `positions` are the halves' left edges (DOM order) from the window's left edge.
function stripGeometry(fraction) {
  const strip = document.querySelector(".marquee"), track = strip.querySelector(".marquee-track"), win = track.parentElement;
  const dom = [...track.children], a = strip.getAnimations({subtree: true});
  const clock = a.map(x => ({state: x.playState, start: x.startTime, current: x.currentTime}));
  if (fraction !== null) for (const x of a) { x.pause(); x.currentTime = x.effect.getTiming().duration * fraction; }
  const R = e => e.getBoundingClientRect();
  const glyph = (span, i) => {
    const w = document.createTreeWalker(span, NodeFilter.SHOW_TEXT);
    for (let n, k = i; (n = w.nextNode()); k -= n.length) if (k < n.length) { const rg = document.createRange(); rg.setStart(n, k); rg.setEnd(n, k + 1); return rg.getBoundingClientRect(); }
    return null;
  };
  const halves = dom.map(h => ({text: h.textContent, width: R(h).width, minWidth: getComputedStyle(h).minWidth,
    spans: [...h.children].map(s => ({text: s.textContent, display: getComputedStyle(s).display, width: R(s).width}))}));
  const order = dom.map((h, i) => i).sort((i, j) => R(dom[i]).left - R(dom[j]).left);
  const shown = order.map(i => [...dom[i].children].filter(s => getComputedStyle(s).display !== "none"));
  const run = shown.flat(), text = run[0].textContent, last = text.trimEnd().length - 1, bullet = text.indexOf("•");
  const wordGap = glyph(run[0], bullet + 2).left - glyph(run[0], bullet).right;
  const joins = run.slice(1).map((s, i) => glyph(s, 0).left - glyph(run[i], last).right);
  const t = R(track), w = R(win), hb = order.map(i => R(dom[i]));
  // Box edges, exact in both engines: the right half starts where the left one ends, and in each half the shown lines
  // sit edge to edge from its left end to its right end, each line box as wide as its text (WebKit rounds single-glyph
  // boxes to whole pixels, so glyph gaps get a looser bound).
  const boxes = shown.map(s => s.map(R));
  const edges = [hb[1].left - hb[0].right, ...boxes.flatMap((b, h) => [b[0].left - hb[h].left, hb[h].right - b[b.length - 1].right, ...b.slice(1).map((x, i) => x.left - b[i].right)])];
  const textWidths = run.map(sp => { const rg = document.createRange(); rg.selectNodeContents(sp); return R(sp).width - rg.getBoundingClientRect().width; });
  // Every element of the strip: no CSS animation, no will-change, no 3D.
  const parts = [strip, win, track, ...dom, ...dom.flatMap(h => [...h.children])];
  const styles = parts.map(e => { const c = getComputedStyle(e); return {cls: e.className, animationName: c.animationName, willChange: c.willChange, transform: c.transform, transformStyle: c.transformStyle, perspective: c.perspective, backface: c.backfaceVisibility}; });
  const animations = a.map(x => { const tm = x.effect.getTiming(); return {target: dom.indexOf(x.effect.target), css: typeof CSSAnimation !== "undefined" && x instanceof CSSAnimation,
    transition: typeof CSSTransition !== "undefined" && x instanceof CSSTransition, delay: tm.delay, duration: tm.duration, iterations: tm.iterations, easing: tm.easing, direction: tm.direction,
    endDelay: tm.endDelay, iterationStart: tm.iterationStart, playbackRate: x.playbackRate, composite: x.effect.composite,
    keyframes: x.effect.getKeyframes().map(k => [k.computedOffset, k.transform, k.easing, k.composite])}; });
  return {halves, order, shownCounts: shown.map(s => s.length), track: t.width, trackLeft: t.left - w.left, frame: w.width, viewport: innerWidth, wordGap, joins,
    leads: shown.map((s, h) => glyph(s[0], 0).left - hb[h].left), tails: shown.map((s, h) => hb[h].right - glyph(s[s.length - 1], last).right), edges, textWidths,
    positions: dom.map(h => R(h).left - w.left), gap: Math.max(0, hb[0].left - w.left, hb[1].left - hb[0].right, w.right - hb[1].right),
    clock, animations, styles, endlessCss: document.getAnimations().filter(x => typeof CSSAnimation !== "undefined" && x instanceof CSSAnimation && x.effect.getTiming().iterations === Infinity).length,
    contain: getComputedStyle(win).contain, isolation: getComputedStyle(win).isolation};
}
// In the page: true once both halves run and their cycle matches the current half width (Marquee re-times the loop
// from a ResizeObserver when the viewport changes or the web font arrives); the exact values are asserted afterwards.
function stripSettled(speed) {
  const h = document.querySelector(".marquee-half"), a = document.querySelector(".marquee").getAnimations({subtree: true});
  return a.length === 2 && a.every(x => x.playState === "running" && Math.abs(x.effect.getTiming().duration - 2 * h.getBoundingClientRect().width / speed * 1000) < 0.01);
}
// No animationiteration event can fire at a reset: that event only comes from CSS animations, and the strip has none
// (assertStripStyles below: no animation-name on any strip element, no endless CSS animation anywhere on the page);
// its loop is two Web Animations, which fire no iteration events.
// The v10 strip assertions shared by the running, paused and still states: no CSS animation, will-change or 3D on any
// strip element (a moving half may only be shifted along x), the window neither contained nor isolated.
function assertStripStyles(g, label) {
  for (const s of g.styles) {
    assert.equal(s.animationName, "none", `${label}: CSS animation on .${s.cls}`);
    assert.equal(s.willChange, "auto", `${label}: will-change on .${s.cls}`);
    assert.ok(s.transformStyle === "flat" && s.perspective === "none" && s.backface === "visible", `${label}: 3D setting on .${s.cls} ${JSON.stringify(s)}`);
    assert.ok(s.transform === "none" || (s.cls === "marquee-half" && /^matrix\(1, 0, 0, 1, -?[\d.e+-]+, 0\)$/.test(s.transform)), `${label}: transform ${s.transform} on .${s.cls}`);
  }
  assert.equal(g.contain, "none"); assert.equal(g.isolation, "auto");
  assert.equal(g.endlessCss, 0, `${label}: an endless CSS animation on the page`);
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
      const k=stripLines(width),per=width<=660?11250:45000,speed=width<=660?64:16,label=`${engine} strip ${width}`;
      // v10: Marquee re-times the loop after a viewport change or the web font's arrival (ResizeObserver): wait for the
      // strip's font itself (document.fonts.ready can resolve before WebKit starts loading it after a reload), then give
      // the loop up to 3 s to settle; the exact cycle and speed are asserted below either way.
      await page.evaluate(()=>document.fonts.load('24px Pixel').then(()=>document.fonts.ready));
      await page.waitForFunction(stripSettled,speed,{timeout:3000}).catch(()=>{});
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
      const L=g.halves[0].width,D=g.animations[0]?.duration;
      // v10: the track stays put (one grid cell, one half wide); the only moving blocks are the two halves, each k lines
      // (at most the viewport plus one line) wide, each with its own Web Animation, both on one clock.
      assert.ok(Math.abs(g.track-L)<0.01&&Math.abs(g.trackLeft)<0.01,label+': the track is one half wide and stays at the left edge '+[g.track,g.trackLeft]);
      assert.ok(L<=width+720+0.5*k,label+': moving block '+L+' px is over the viewport plus one line');
      assert.deepEqual(g.animations.map(x=>x.target).sort(),[0,1],label+': one animation on each half and none elsewhere in the strip '+JSON.stringify(g.animations.map(x=>x.target)));
      assertStripStyles(g,label);
      for(const x of g.animations) {
        assert.equal(x.css,false,label+': the loop is a Web Animation, not a CSS animation');
        assert.equal(x.transition,false,label+': the loop is not a transition');
        assert.equal(x.iterations,Infinity,label+': endless');
        assert.ok(x.easing==='linear'&&x.direction==='normal'&&x.endDelay===0&&x.iterationStart===0&&x.playbackRate===1&&x.composite==='replace',label+': linear, forward, unscaled '+JSON.stringify(x));
        assert.deepEqual(x.keyframes,[[0,'translateX(100%)','linear','auto'],[1,'translateX(-100%)','linear','auto']],label+': keyframes '+JSON.stringify(x.keyframes));
        // Exact speed: two half widths per cycle at 16 px/s (64 px/s at 660 px and below), to a millionth of a px/s.
        assert.ok(Math.abs(2*L/(x.duration/1000)-speed)<1e-6,label+': speed '+2*L/(x.duration/1000)+' px/s, not '+speed);
        assert.ok(Math.abs(x.duration-2*k*per)<=k*per/720+0.5,label+': cycle '+x.duration+' ms is not two k-line halves');
      }
      assert.ok(g.clock.every(c=>c.state==='running')&&Math.abs(g.clock[0].start-g.clock[1].start)<0.001&&g.animations[0].duration===g.animations[1].duration,label+': both halves run on one clock '+JSON.stringify(g.clock));
      const tol=engine==='WebKit'?2.5:0.5;
      for (const fraction of STRIP_PHASES) {
        const s=await page.evaluate(stripGeometry,fraction),at=`${label} at ${fraction}`;
        // Covered: the halves sit edge to edge across the whole window, also just before, at and just after a reset.
        assert.ok(s.gap<0.01,at+': blank stretch of '+s.gap+' px in the strip window '+JSON.stringify(s.positions));
        // Where each half is: each runs from +L to -L, the first half half a cycle ahead of the second (exactly at a
        // half's own reset either end is accepted: both are off screen).
        s.positions.forEach((p,i)=>{const q=(fraction+(i===0?0.5:0))%1,exp=L-2*L*q;
          assert.ok(Math.abs(p-exp)<0.05||(q===0&&Math.abs(p+L)<0.05),at+`: half ${i+1} at ${p} px, not ${exp}`);});
        // Each half jumps back only while wholly off screen: just before its reset it lies wholly left of the window,
        // just after it wholly right of it.
        for(const [i,r] of [[0,0.5],[1,1]]) {
          if(Math.abs(fraction-(r-1e-7))<1e-12) assert.ok(s.positions[i]+L<=0.05,at+`: half ${i+1} still on screen just before its reset (right edge ${s.positions[i]+L})`);
          if(Math.abs(fraction-(r+1e-7)%1)<1e-12) assert.ok(s.positions[i]>=s.frame-0.05,at+`: half ${i+1} not wholly right of the window just after its reset (left edge ${s.positions[i]})`);
        }
        assert.ok(s.wordGap>0,at+': word gap');
        // Line boxes and halves edge to edge (no margin, padding or stretch anywhere), each line box as wide as its text.
        for(const e of s.edges) assert.ok(Math.abs(e)<0.01,at+': line boxes or halves not edge to edge '+JSON.stringify(s.edges));
        for(const e of s.textWidths) assert.ok(Math.abs(e)<1,at+': a line box wider than its text '+JSON.stringify(s.textWidths));
        // Glyphs: WebKit reports single-glyph boxes rounded out to whole pixels (each edge up to 1 px off), hence 2.5 px
        // there; a blank stretch would be a whole line (720 px) or more, and the box edges above are exact.
        for(const x of s.leads) assert.ok(Math.abs(x)<tol,at+': text starts at the left end of each half '+x);
        for(const x of s.tails) assert.ok(Math.abs(x-s.wordGap)<tol,at+': each half ends one space after its last bullet '+[x,s.wordGap]);
        assert.equal(s.joins.length,2*k-1);
        for(const j of s.joins) assert.ok(Math.abs(j-s.wordGap)<tol,at+`: gap ${j} between lines (or across the seam) is not the word gap ${s.wordGap}`);
        assertStripStyles(s,at);
        if([375,1440,3440].includes(width)&&[0,0.25,0.4999999,0.5000001,0.75,0.9999999].includes(fraction)) await page.locator('.marquee').screenshot({path:path.join(captures,`${engine}-loop-${width}-${fraction}.png`)});
      }
      await page.emulateMedia({reducedMotion:"reduce"});
      await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
      const still=await page.evaluate(stripGeometry,null);
      await page.waitForTimeout(150);
      const still2=await page.evaluate(stripGeometry,null);
      // v10 reduced motion: both animations cancelled (not only paused), nothing moves, the halves side by side from the
      // window's left edge, the strip full.
      assert.equal(still.animations.length,0,label+': reduced motion: the loop is cancelled, not only paused');
      assertStripStyles(still,label+' reduced motion');
      assert.deepEqual(still2.positions,still.positions,label+': reduced motion: the strip moved');
      const side=[...still.positions].sort((x,y)=>x-y);
      assert.ok(Math.abs(side[0])<0.01&&Math.abs(side[1]-L)<0.01,label+': reduced motion: halves not side by side from the left edge '+JSON.stringify(still.positions));
      assert.ok(still.gap<0.01,label+': still strip full');
      assert.deepEqual(still.shownCounts,[k,k]);
      await page.emulateMedia({reducedMotion:"no-preference"});
      await page.waitForFunction(stripSettled,speed,{timeout:3000}).catch(()=>{});
      const again=await page.evaluate(stripGeometry,null);
      assert.ok(again.animations.length===2&&again.clock.every(c=>c.state==='running')&&again.animations.every(x=>Math.abs(2*L/(x.duration/1000)-speed)<1e-6)&&again.gap<0.01,label+': motion back when reduced motion is turned off '+JSON.stringify([again.clock,again.gap]));
      strips.push(`${width}:${k}/${Math.round(L)}/${D / 1000}s`);
    }
    checks.push(`${engine} slogan strip, width:lines per half/half px/cycle [${strips.join(' ')}]: eight lines in the markup of each half, the first k shown (k = the fewest 720 px lines covering the viewport), identical halves; v10 loop: the track stays put and the only moving blocks are the two halves (k lines each, at most the viewport plus one line), each its own endless linear Web Animation translateX(100%) to translateX(-100%) on one shared clock, no CSS animation, will-change or 3D in the strip and no endless CSS animation on the page; speed exactly 16 px/s (64 px/s at 660 px and below), two half widths per cycle; at ${STRIP_PHASES.length} loop phases (just before, at and just after each half's reset among them) the halves sit edge to edge across the window at their expected places, each jumping back only while wholly off screen, line boxes edge to edge and every line join and the seam with the normal word gap; so no animationiteration event can fire (that event comes only from CSS animations); reduced motion: no animation (cancelled), a still, full strip from the left edge; motion back when it is turned off`);
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
            const labels=[...s.querySelectorAll('article.sa-label')].map(l=>({ticker:l.querySelector('h4')?.textContent??'',price:!!l.querySelector('.sa-price'),status:l.querySelector('.sa-st')?.textContent??'',more:l.querySelector('button.sa-more')?.getAttribute('aria-expanded'),left:R(l).left,right:R(l).right,height:R(l).height,inSlot:!!l.parentElement?.matches('li.sa-slot')&&!!l.closest('ul.sa-shelves[role="list"]'),
              text:l.textContent,ageLines:[...l.querySelectorAll('.sa-age')].map(e=>e.textContent),dimmed:!!l.querySelector('.sa-price.is-stale'),timeParts:l.querySelectorAll('.sa-clock, .sa-upd, .sa-when, small').length,reason9:(l.querySelector('.sa-chip')?.textContent??'').includes('feed price missing or too old')}));
            const all=s.querySelector('.sa-filters button');
            return {sections:sec.length,heading:s.querySelector(':scope > .section-heading h2')?.textContent,old:document.querySelectorAll('.stock-grid, .stock-card').length,unit:unit?{left:R(unit).left,right:R(unit).right}:null,labels,
              all:all?Number(all.querySelector('.sa-count')?.textContent):null,allName:all?.firstChild?.textContent?.trim(),controls:[...s.querySelectorAll('.sa-filters button, .sa-search input')].map(e=>R(e).height),
              moving:document.getAnimations().filter(a=>a.effect?.target?.closest?.('.stock-section')).length,sectionText:s.textContent};
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
              // v10: no price time on any label; only a price refused as too old (reason 9) keeps the "old price" tag
              // (and is dimmed when it is readable), with no time beside it.
              assert.doesNotMatch(l.text,PRICE_TIME,`${engine} vault ${width}: price time on label ${l.ticker}`);
              assert.equal(l.timeParts,0,`${engine} vault ${width}: label ${l.ticker} has a clock or time part`);
              assert.deepEqual(l.ageLines,l.reason9?['old price']:[],`${engine} vault ${width}: label ${l.ticker} old price tag`);
              if(l.dimmed) assert.equal(l.reason9,true,`${engine} vault ${width}: label ${l.ticker} dimmed without reason 9`);
            }
            assert.doesNotMatch(sh.sectionText,PRICE_TIME,`${engine} vault ${width}: price time on the Stock shelves`);
            // v10: the details drawer names the row "Feed price" and shows the price only (no age).
            if([1440,375].includes(width)&&sh.labels.length) {
              await page.locator('.stock-section article.sa-label button.sa-more').first().click();
              const d=await page.locator('#sa-drawer').evaluate(e=>{const row=[...e.querySelectorAll('dl > div')].find(x=>/^Feed price/.test(x.querySelector('dt')?.textContent??''));return {dt:row?.querySelector('dt').textContent,dd:row?.querySelector('dd').textContent,small:row?row.querySelectorAll('small').length:-1,text:e.textContent};});
              assert.equal(d.dt,'Feed price',`${engine} vault ${width}: drawer row name`);
              assert.match(d.dd,/^(\$[\d,]+(\.\d+)?|unreadable \/ invalid feed)$/,`${engine} vault ${width}: drawer price only (${d.dd})`);
              assert.equal(d.small,0,`${engine} vault ${width}: drawer age`);
              assert.doesNotMatch(d.text,PRICE_TIME,`${engine} vault ${width}: price time in the drawer`);
              await page.locator('#sa-drawer button',{hasText:'Close'}).click();
              await page.waitForFunction(()=>!document.querySelector('#sa-drawer'));
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
        // v10: the 24/7 redemption tag is the first thing in the Deposit and Redeem forms (shown open or closed): exact
        // words, at least 14 px, white on royal blue, inside its panel with whole words, clear of the title character
        // and her bubble; on no other page. The Redeem title sentence no longer says it.
        const tag=await page.evaluate(()=>{
          const ts=[...document.querySelectorAll('.hours-tag')],t=ts[0],title=document.querySelector('.page-title > p:last-of-type')?.textContent.replace(/\s+/g,' ').trim();
          if(!t) return {count:0,title};
          const R=e=>e.getBoundingClientRect(),r=R(t),panel=t.parentElement,pr=R(panel),cs=getComputedStyle(t),pcs=getComputedStyle(panel),split=[];
          const w=document.createTreeWalker(t,NodeFilter.SHOW_TEXT);
          for(let n;(n=w.nextNode());) for(const m of n.textContent.matchAll(/\S+/g)){
            const rg=document.createRange();rg.setStart(n,m.index);rg.setEnd(n,m.index+m[0].length);
            if(new Set([...rg.getClientRects()].filter(x=>x.width>0).map(x=>Math.round(x.top))).size!==1) split.push(m[0]);
            const wr=rg.getBoundingClientRect();if(wr.left<r.left||wr.right>r.right) split.push('outside: '+m[0]);
          }
          const hit=(a,b)=>a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom;
          return {count:ts.length,title,text:t.textContent,first:panel.firstElementChild===t,inForm:panel.matches('.flow-layout > section.panel'),font:parseFloat(cs.fontSize),color:cs.color,background:cs.backgroundColor,
            inside:r.left>=pr.left+parseFloat(pcs.borderLeftWidth)-0.5&&r.right<=pr.right-parseFloat(pcs.borderRightWidth)+0.5,split,overlap:[...document.querySelectorAll('.title-character img, .speech-bubble')].filter(e=>hit(R(e),r)).length};
        });
        if(['deposit','redeem'].includes(name)) {
          assert.equal(tag.count,1,`${engine} ${name} ${width}: one 24/7 tag`);
          assert.equal(tag.text,V10_TAG,`${engine} ${name} ${width}: tag words`);
          assert.equal(tag.first&&tag.inForm,true,`${engine} ${name} ${width}: tag first in the form panel`);
          assert.ok(tag.font>=14,`${engine} ${name} ${width}: tag text ${tag.font} px`);
          assert.deepEqual([tag.color,tag.background],['rgb(255, 255, 255)','rgb(23, 75, 193)'],`${engine} ${name} ${width}: tag colours`);
          assert.equal(tag.inside,true,`${engine} ${name} ${width}: tag outside its panel`);
          assert.deepEqual(tag.split,[],`${engine} ${name} ${width}: tag words split or outside`);
          assert.equal(tag.overlap,0,`${engine} ${name} ${width}: tag under the character or her bubble`);
        } else assert.equal(tag.count,0,`${engine} ${name}: 24/7 tag`);
        if(name==='redeem') assert.equal(tag.title,'Receive your share of every stock.',`${engine} redeem ${width}: title sentence`);
        if(name==='docs') {
          const faq=await page.locator('.docs-grid > .panel').evaluateAll(ps=>{const i=ps.findIndex(p=>p.querySelector('h2')?.textContent==='Redemption'),f=ps[i+1];return {heading:f?.querySelector(':scope > h2')?.textContent,question:f?.querySelector(':scope > h3')?.textContent,answer:f?.querySelector(':scope > p')?.textContent.replace(/\s+/g,' ').trim()};});
          const deposits=await page.locator('.docs-grid > .panel').evaluateAll(ps=>ps.find(p=>p.querySelector('h2')?.textContent==='Deposits')?.querySelector(':scope > p')?.textContent.replace(/\s+/g,' ').trim());
          assert.equal(deposits,V10_DOCS,`${engine} docs ${width}: deposits sentence (v10)`);
          assert.deepEqual(faq,{heading:'FAQ',question:'What if a stock can’t be sent when I redeem?',answer:'Rarely, a stock can’t be sent at that moment (for example its issuer has paused transfers). The vault then keeps it for the receiver, who collects it later with Claim on the Redeem page. Only the receiver wallet can claim, so redeem to a wallet you control, not an exchange deposit address.'});
        }
      }
      checks.push(`${engine} ${width}: six routes without overflow; both shelf rows filled with ordered square images (the Stock shelves unit on Vault shows its first row only, by design); Stock shelves: one shelf-edge label per listed stock (${shelfCounts.at(-1)?.split(':')[1]}) with ticker, price, status and Details, inside the shelf unit, labels/filters/search at least 44 px, no old stock cards, still under reduced motion; title character inside the title panel with exact speech and picture height, head above the panel, bubble clear of the picture, tail clear of face/hands/items, whole bubble words, strip clear of the text, wallet hint gap; no old frames or WOW!, Fresh! kept; Docs FAQ; no Redeem receiver note; v10: the 24/7 redemption tag first in the Deposit and Redeem forms (exact words, at least 14 px, white on royal blue, inside its panel, whole words, clear of the character and her bubble), the Redeem title without it, the capitalised Docs deposits sentence, no price time on any Stock shelves label or in the drawer (reason 9 keeps only its "old price" tag); no tagline on the page, Vault title without eyebrow (text centred beside her, or 17 px under her on phones), other eyebrows kept, footer icon/name/links`);
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

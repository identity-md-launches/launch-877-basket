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
// ITEM SPEC 5: exact approved additions; the original manifest digest and all original assets remain unchanged.
const ITEM_ART=[{"path":"art/character/earn.webp","bytes":99214,"sha256":"b6909185b01f73b987c6c9bd2caf7b96a600d0c3dc91a3cb2757d72eac8bc051","width":453,"height":1000},{"path":"art/character/transparency.webp","bytes":92840,"sha256":"f48d0a806c47889e1f01f6c846428eefc528771c51a43ff24140261d567480fe","width":400,"height":1000}];
for (const dir of ["web/public", "dist"]) {
  const expected = [...manifest.files,...ITEM_ART].map(f => f.path).sort();
  const actual = fs.readdirSync(path.join(root, dir, "art"), {recursive:true, withFileTypes:true})
    .filter(e => e.isFile()).map(e => path.relative(path.join(root,dir),path.join(e.parentPath,e.name)).split(path.sep).join("/")).sort();
  assert.deepEqual(actual, expected);
  for (const f of [...manifest.files,...ITEM_ART]) {
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
// v11 form words remain except the owner-removed normal-operation status sentence.
// of the line under a confirmed deposit and of the header's Disconnect button are in the scripts; the old search label
// is gone from scripts and styles.
for (const text of ["Add another stock", "Disconnect", "Show small balances", "You received", "All stocks you can deposit", "Press a stock to add it to your deposit."]) assert.ok(bundle.includes(text), "v11 text in the bundle: " + text);
for (const gone of ["Search to add stocks"]) assert.ok(!(bundle + styles).includes(gone), "removed from the bundle (v11): " + gone);
for(const text of ['Vault status:',"Deposits reopen when the stock feed prices update around 8pm on Sundays.",'Deposits will be back open when “','” is resolved.']) assert.ok(bundle.includes(text),'Owner short-notice wording '+text);
assert.ok(!bundle.includes('Deposits are open.'),'Owner status placement removes the old Deposit open-only sentence');
assert.ok(styles.includes('.deposit-summary'),'Vault has a scoped compact deposit status');
assert.ok(!bundle.includes('Vault deposit status'),'Owner replaces the old status label');
for(const text of ['Maximum Basket Capacity','(eligible to be raised)'])assert.ok(bundle.includes(text),'Owner capacity wording: '+text);
assert.ok(!bundle.includes('To use another wallet, switch the address in your wallet app: this page follows it.'),'Owner removes the Deposit and Redeem wallet-switch instruction');
// v12 SPEC sections 1-5: exact approved additions and removals; all earlier word pins remain.
const V12_DOCS = [
  "One token, BASK, backed by a basket of Stock Tokens held in a vault on Robinhood Chain. Deposit one or more listed Stock Tokens at once and receive BASK. Redeeming BASK pays a share of every stock in the vault.",
  "The basket has no set weights. Any listed stock can be deposited, in any amount, as long as the vault’s checks pass and the vault stays under its size limit. So the mix is whatever holders have put in, and it changes with every deposit and redemption.",
  "BASK’s backing moves with every stock in the vault, so its market price can drift from the value behind it. Traders close that gap: they deposit stocks and sell BASK when it trades high, or buy BASK and redeem when it trades low. That keeps BASK near its backing.",
  "The 0.5% fee on each deposit and redemption goes to ITEM staking, so more trading through the vault means more fees for ITEM.",
];
const V12_DEPOSIT = [
  "You approve each stock for exactly the amount you deposit. Each approval is its own wallet prompt; the deposit prompt comes last.",
  "A prepared deposit must be sent within ten minutes. The BASK goes to your connected wallet."
];
for (const text of ['Always in stock', ...V12_DOCS.slice(1), ...V12_DEPOSIT,
  'Nothing is owed to this wallet.',
  'Claim all collects up to 10 stocks per wallet prompt. If one stock can’t be paid, that batch stays owed: collect the others with their own Claim buttons.'])
  assert.ok(bundle.includes(text), 'v12 text in the bundle: ' + text);
for (const gone of ['A basket of stocks.', 'Meet Basket (BASK): your share of the Stock Tokens in this vault.',
  'Each short allowance is set to exactly that stock’s amount.', 'Approvals are separate wallet prompts; the deposit follows after simulation.',
  'The deadline is ten minutes from preparation. Your wallet receives the BASK.', 'Take your basket home',
  'Batches of up to 10 stocks, with one wallet prompt per batch.'])
  assert.ok(!bundle.includes(gone), 'removed from the bundle (v12): ' + gone);
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
  const dir = parts[1] === "baseline" ? path.resolve(process.env.BASKET_BASELINE_DIST) : path.join(root,"dist");
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
  // v12 SPEC 1 removes Vault's sentence. Its heading is now the last title text;
  // retain the same centering measurement and tolerance used for every other title.
  const lastText = title.querySelector(":scope > p:last-of-type") ?? title.querySelector(":scope > h1");
  out.textBelow = stripTop - parseFloat(after.marginTop) - r(lastText).bottom;
  out.titleHeight = T.height;
  const headingRange = document.createRange(); headingRange.selectNodeContents(title.querySelector(":scope > h1"));
  const headingRects = [...headingRange.getClientRects()].filter(x => x.width > 0);
  out.headingLines = new Set(headingRects.map(x => Math.round(x.top))).size;
  out.headingInFrame = headingRects.every(x => x.left >= T.left + bw - 0.5 && x.right <= T.right - bw + 0.5 && x.top >= T.top + bw - 0.5 && x.bottom <= stripTop - 12);
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
  // v15: where the picture, the bubble, the heading and her shelf line (the holder's ::after, phones only) sit across
  // the panel, and whether the heading shows the focus marker.
  const h1 = title.querySelector(":scope > h1"), hr = r(holder), H = r(h1), hcs = getComputedStyle(h1), line = getComputedStyle(holder, "::after");
  out.width = innerWidth;
  out.titleTop = T.top;
  out.frame = {left: T.left + bw, right: T.right - bw};
  out.pictureOff = (T.left + T.right) / 2 - (D.x + D.w / 2);
  out.bubbleGap = T.right - bw - br.right;
  out.bubbleFromPicture = br.left - D.x;
  out.headingAlign = hcs.textAlign;
  out.headingOff = (T.left + T.right) / 2 - (Math.min(...headingRects.map(x => x.left)) + Math.max(...headingRects.map(x => x.right))) / 2;
  out.h1 = {left: H.left, right: H.right, top: H.top, bottom: H.bottom};
  out.ring = {shown: h1.matches(":focus-visible"), outline: `${hcs.outlineStyle} ${hcs.outlineWidth} ${hcs.outlineColor}`, shadow: hcs.boxShadow, ink: getComputedStyle(bubble).borderLeftColor};
  const drawn = line.content !== "none" && line.display !== "none";
  out.shelf = !drawn ? null : {left: hr.left + parseFloat(line.left), right: hr.left + parseFloat(line.left) + parseFloat(line.width), top: hr.bottom - parseFloat(line.bottom) - parseFloat(line.height), bottom: hr.bottom - parseFloat(line.bottom), colour: line.backgroundColor};
  return out;
}
// v15 (owner, 2026-10-13: "the graphic on mobile is off to the left and doesnt look good"; he chose the picture
// centred with the heading centred). On phones the Vault picture stands in the middle of the panel, at 375 px and
// wider exactly; narrower, only as far left of the middle as her three-line bubble needs to stay 4 px inside the
// frame. Her shelf line runs across the panel inside the frame and the heading is centred.
function assertVaultPhone(g, label) {
  assert.equal(g.bubbleLines, 3, `${label}: v15 Vault bubble keeps three lines`);
  assert.ok(g.bubbleGap >= 3.5, `${label}: v15 bubble closer than 4 px to the frame (${g.bubbleGap})`);
  assert.ok(g.pictureOff > -0.5 && (Math.abs(g.pictureOff) < 0.5 || Math.abs(g.bubbleGap - 4) < 0.5), `${label}: v15 picture neither in the middle nor as near it as her bubble allows (off ${g.pictureOff}, bubble gap ${g.bubbleGap})`);
  if (g.width >= 375) assert.ok(Math.abs(g.pictureOff) < 0.5, `${label}: v15 picture not in the middle (${g.pictureOff})`);
  assert.ok(g.shelf && Math.abs(g.shelf.left - g.frame.left) < 0.5 && Math.abs(g.shelf.right - g.frame.right) < 0.5, `${label}: v15 shelf line not across the panel ${JSON.stringify([g.shelf, g.frame])}`);
  assert.equal(g.headingAlign, "center", `${label}: v15 heading not centred`);
  assert.ok(Math.abs(g.headingOff) < 0.75, `${label}: v15 heading off the middle (${g.headingOff})`);
}
// v15 (owner, 2026-10-13: "the corner of this graphic is slightly off with the yellow line"; he chose the box stays
// and the line meets its corner). While the Deposit or Redeem heading shows the focus marker on a phone (a 3 px ink
// outline inside a 6 px yellow band), her shelf line is that band's own height and colour, runs from the frame to the
// marker's outer left edge, and lies exactly on the band's bottom strip: one line into the corner.
function assertShelfMeetsMarker(g, label) {
  assert.equal(g.ring.shown, true, `${label}: the heading does not show the focus marker`);
  assert.equal(g.ring.outline, `solid 3px ${g.ring.ink}`, `${label}: marker outline`);
  assert.equal(g.ring.shadow, `${g.shelf.colour} 0px 0px 0px 6px`, `${label}: marker band is not 6 px of the shelf line's yellow`);
  assert.ok(Math.abs(g.shelf.left - g.frame.left) < 0.5, `${label}: shelf line does not start at the frame (${g.shelf.left})`);
  assert.ok(Math.abs(g.shelf.right - (g.h1.left - 6)) < 0.5, `${label}: shelf line does not end at the marker's outer edge (${g.shelf.right} against ${g.h1.left - 6})`);
  assert.ok(Math.abs(g.shelf.top - (g.h1.bottom + 3)) < 0.5 && Math.abs(g.shelf.bottom - (g.h1.bottom + 6)) < 0.5, `${label}: shelf line is not on the marker's bottom band (${g.shelf.top} to ${g.shelf.bottom}, heading bottom ${g.h1.bottom})`);
}
// What v15 may not move: the placing of everything in a title panel, to a hundredth of a pixel. Across the page as
// measured; down the page from the panel's own top edge (what stands above the panel depends on the chain reads,
// which the reference page does not make).
const placed = g => {
  const y = v => v - g.titleTop;
  return JSON.parse(JSON.stringify({picture: {...g.picture, y: y(g.picture.y)}, bubble: {...g.bubble, y: y(g.bubble.y)}, bubbleLines: g.bubbleLines, h1: {...g.h1, top: y(g.h1.top), bottom: y(g.h1.bottom)},
    shelf: g.shelf && {...g.shelf, top: y(g.shelf.top), bottom: y(g.shelf.bottom)}, headingAlign: g.headingAlign, titleHeight: g.titleHeight}, (k, v) => typeof v === "number" ? Math.round(v * 100) / 100 : v));
};
function assertGeometry(g, label, pixels) {
  assert.equal(g.overflow, false, `${label} overflow`);
  assert.deepEqual(g.split, [], `${label}: a bubble word is split`);
  assert.deepEqual(g.wordOutside, [], `${label}: bubble text outside the bubble`);
  assert.ok(g.textToStrip >= 12, `${label}: checker strip touches the title text (${g.textToStrip})`);
  assert.equal(g.firstText, g.name === "vault" ? "H1" : "P", `${label}: the Vault title has no eyebrow, the others keep theirs`);
  if (!g.phone) assert.ok(Math.abs(g.textAbove - g.textBelow) < 0.5, `${label}: title text not centred beside her (${g.textAbove} above, ${g.textBelow} below)`);
  else if (g.name === "vault") assert.ok(Math.abs(g.textUnderHolder - 17) < 0.5, `${label}: Vault heading not 17 px under her shelf (${g.textUnderHolder})`);
  if (g.name === 'vault') {
    assert.ok(g.headingLines >= 1 && g.headingLines <= 2, label+': Vault heading must use one or two lines');
    assert.equal(g.headingInFrame, true, label+': Vault heading outside the frame');
  }
  assert.equal(g.bubbleInFrame, true, `${label}: bubble outside the title frame`);
  assert.equal(g.textOnBubble, false, `${label}: title text under the bubble`);
  assert.deepEqual(g.bubbleOnRegions, [], `${label}: bubble on face, hands or held item`);
  assert.ok(g.popAboveFrame > 0, `${label}: head does not rise above the panel`);
  assert.equal(g.pictureInView, true, `${label}: picture outside the viewport`);
  assert.deepEqual(g.clipped, [], `${label}: picture clipped`);
  assert.ok(g.walletGap >= 8, `${label}: wallet hint gap ${g.walletGap}`);
  assert.equal(g.walletInside, true, `${label}: wallet hint outside its box`);
  if (g.phone && g.name === "vault") assertVaultPhone(g, label);
  if (!g.phone) assert.equal(g.shelf, null, `${label}: a shelf line above phone widths`);
  if (pixels) {
    assert.deepEqual(g.bubbleCovers, {}, `${label}: bubble covers the picture`);
    assert.deepEqual(Object.keys(g.tailCovers).filter(k => k !== "other"), [], `${label}: tail covers face, hands or held item`);
    assert.equal(g.textCovers, 0, `${label}: title text on the figure`);
  }
}
// v12 SPEC 6: unchanged text/colour/placement pins plus whole-word geometry.
function wideLabelGeometry() {
  const ts=[...document.querySelectorAll('.hours-tag')],t=ts[0],panel=t.parentElement;
  const R=e=>e.getBoundingClientRect(),r=R(t),pr=R(panel),cs=getComputedStyle(t),pcs=getComputedStyle(panel),split=[],outside=[],strongTops=new Set();
  const inner={left:r.left+parseFloat(cs.borderLeftWidth)+parseFloat(cs.paddingLeft),right:r.right-parseFloat(cs.borderRightWidth)-parseFloat(cs.paddingRight),top:r.top+parseFloat(cs.borderTopWidth),bottom:r.bottom-parseFloat(cs.borderBottomWidth)};
  const walker=document.createTreeWalker(t,NodeFilter.SHOW_TEXT);
  for(let n;(n=walker.nextNode());) for(const m of n.textContent.matchAll(/\S+/g)) {
    const rg=document.createRange();rg.setStart(n,m.index);rg.setEnd(n,m.index+m[0].length);
    const boxes=[...rg.getClientRects()].filter(b=>b.width>0),tops=new Set(boxes.map(b=>Math.round(b.top)));
    if(tops.size!==1)split.push(m[0]);
    if(n.parentElement.closest('strong')) for(const top of tops)strongTops.add(top);
    const b=rg.getBoundingClientRect();
    if(b.left<inner.left-0.5||b.right>inner.right+0.5||b.top<inner.top-0.5||b.bottom>inner.bottom+0.5)outside.push(m[0]);
  }
  const hit=(a,b)=>a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom;
  return {count:ts.length,text:t.textContent,first:panel.firstElementChild===t,inForm:panel.matches('.flow-layout > section.panel'),font:parseFloat(cs.fontSize),color:cs.color,background:cs.backgroundColor,
    inside:r.left>=pr.left+parseFloat(pcs.borderLeftWidth)-0.5&&r.right<=pr.right-parseFloat(pcs.borderRightWidth)+0.5&&r.top>=pr.top+parseFloat(pcs.borderTopWidth)-0.5&&r.bottom<=pr.bottom-parseFloat(pcs.borderBottomWidth)+0.5,
    split,outside,strongLines:strongTops.size,overlap:[...document.querySelectorAll('.title-character img, .speech-bubble')].filter(e=>hit(R(e),r)).length,overflow:document.documentElement.scrollWidth>innerWidth};
}
function assertWideLabel(tag,label) {
  assert.equal(tag.count,1,label+': one tag');assert.equal(tag.text,V10_TAG,label+': words');
  assert.equal(tag.first&&tag.inForm,true,label+': first in form');assert.ok(tag.font>=14,label+': font');
  assert.deepEqual([tag.color,tag.background],['rgb(255, 255, 255)','rgb(23, 75, 193)'],label+': colours');
  assert.equal(tag.inside,true,label+': pill inside panel');assert.deepEqual(tag.split,[],label+': whole words');
  assert.deepEqual(tag.outside,[],label+': words inside pill');assert.equal(tag.overlap,0,label+': clear of character/bubble');assert.equal(tag.overflow,false,label+': no horizontal scroll');
}
// A hash change re-renders asynchronously: wait until the requested route is the current page before measuring it.
// v20: since v19 no navigation link points at the Losses page (the footer link went; the short-stock notice and the
// Docs panel link to it without a current-page mark), so that route counts as shown once its own heading "Losses" is
// the page title's. Every other route still waits for its current navigation link.
const routeShown = name => name === "losses"
  ? location.hash === "#losses" && document.querySelector("main .page-title > h1")?.textContent.trim() === "Losses"
  : !!document.querySelector(`a[aria-current="page"][href="#${name}"]`);

function capacityGeometry() {
  const cells=[...document.querySelectorAll('.stats > div')],cell=cells[3],label=cell?.querySelector(':scope > span'),note=label?.querySelector('small'),value=cell?.querySelector(':scope > strong');
  if(!cell||!label||!note||!value)return {count:cells.length,label:label?.textContent??null};
  const r=cell.getBoundingClientRect(),s=getComputedStyle(cell),split=[],outside=[];
  const labelRange=document.createRange();labelRange.selectNode(label.firstChild);
  const labelBox=labelRange.getBoundingClientRect(),noteBox=note.getBoundingClientRect(),valueBox=value.getBoundingClientRect();
  const walker=document.createTreeWalker(label,NodeFilter.SHOW_TEXT);
  for(let node;(node=walker.nextNode());)for(const word of node.textContent.matchAll(/\S+/g)) {
    const range=document.createRange();range.setStart(node,word.index);range.setEnd(node,word.index+word[0].length);
    const box=range.getBoundingClientRect();
    if(new Set([...range.getClientRects()].filter(x=>x.width>0).map(x=>Math.round(x.top))).size!==1)split.push(word[0]);
    if(box.left<r.left+parseFloat(s.borderLeftWidth)-0.5||box.right>r.right-parseFloat(s.borderRightWidth)+0.5||box.top<r.top+parseFloat(s.borderTopWidth)-0.5||box.bottom>r.bottom-parseFloat(s.borderBottomWidth)+0.5)outside.push(word[0]);
  }
  return {count:cells.length,label:label.firstChild.textContent.trim(),note:note.textContent,noteCount:label.querySelectorAll('small').length,labelFont:parseFloat(getComputedStyle(label).fontSize),noteFont:parseFloat(getComputedStyle(note).fontSize),noteBelow:noteBox.top>=labelBox.bottom-0.5,valueBelow:valueBox.top>=noteBox.bottom-0.5,value:value.textContent,split,outside};
}
function assertCapacity(g) {
  assert.equal(g.count,4,'Vault keeps all four figures');
  assert.deepEqual([g.label,g.note],['Maximum Basket Capacity','(eligible to be raised)'],'Exact owner capacity wording');
  assert.equal(g.noteCount,1,'Capacity has one smaller note');
  assert.ok(g.labelFont>=14&&g.noteFont>=12&&g.noteFont<g.labelFont,'Capacity note remains readable and smaller than its label');
  assert.equal(g.noteBelow&&g.valueBelow,true,'Capacity note is below the label and above the value');
  assert.deepEqual(g.split,[],'Capacity words are not split');
  assert.deepEqual(g.outside,[],'Capacity wording stays inside its figure box');
}
function ledGeometry() {
  const state=document.querySelector('.flow-layout .deposit-state'),first=state?.querySelector(':scope > p');
  const signs=[...document.querySelectorAll('.deposit-led-sign')].map(e=>{
    const r=e.getBoundingClientRect(),p=e.closest('.deposit-state')?.getBoundingClientRect(),rect=e.querySelector('rect');
    const border=e.querySelector('.deposit-led-border'),chase=e.querySelector('.deposit-led-chase'),letters=e.querySelector('.deposit-led-letters');
    return {label:e.getAttribute('aria-label'),role:e.getAttribute('role'),inline:e.tagName.toLowerCase()==='svg',onDeposit:!!e.closest('.flow-layout > section.panel .deposit-state'),
      width:r.width,height:r.height,inside:!!p&&r.left>=p.left&&r.right<=p.right&&r.top>=p.top&&r.bottom<=p.bottom,
      black:rect?.getAttribute('fill'),blue:border?getComputedStyle(border).stroke:null,red:!!e.querySelector('circle[fill="#ff373d"]'),
      circles:e.querySelectorAll('circle').length,animations:e.getAnimations({subtree:true}).length,
      offset:chase?getComputedStyle(chase).strokeDashoffset:null,glow:letters?getComputedStyle(letters).opacity:null};
  });
  return {status:first?.textContent.replace(/\s+/g,' ').trim()??null,reopening:state?.querySelector('.reopen')?.textContent??null,readIssues:document.querySelectorAll('.read-errors').length,signs};
}
// Replace only the existing empty-token depositStatus read; other public reads stay live.
let statusFixture=0,statusFixtureReads=0;
function fixtureStatus(call) {
  const tx=call?.params?.[0];
  if(call?.method!=='eth_call'||tx?.to?.toLowerCase()!=='0x739fd5b653aa092a434534fa1ade67c1770b5a5b'||tx.data?.toLowerCase()!=='0x6a6ccbd800000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000')return undefined;
  statusFixtureReads++;
  return {jsonrpc:'2.0',id:call.id,result:'0x'+statusFixture.toString(16).padStart(64,'0')+'0'.repeat(64)};
}

const WEEKEND_NOTICE="Deposits reopen when the stock feed prices update around 8pm on Sundays.", ISSUE_NOTICE="Deposits will be back open when “too few fresh prices” is resolved.";
let weekendBlockReads=0;
function fixtureBlock(call,answer) {
  if(statusFixture!==3||call.method!=='eth_getBlockByNumber')return answer;
  assert.ok(answer.result&&typeof answer.result.timestamp==='string','Weekend proof starts with an actual public block');
  weekendBlockReads++;
  return {...answer,result:{...answer.result,timestamp:'0x'+Math.floor(Date.parse('2026-10-10T12:00:00Z')/1000).toString(16)}};
}
const checks=[], visibility=[], bubbles=[], shelfCounts=[], wideLabels=[];
let browser, baselinePage;
try {
  for (const [engine, launcher] of [["Chromium",chromium],["WebKit",webkit]]) {
    browser=await launcher.launch({headless:true});
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    let ledMotionProofs=0;statusFixture=0;
    await page.route(/https:\/\/(rpc\.mainnet\.chain\.robinhood\.com|robinhood-rpc\.publicnode\.com)\/?$/, async route=> {
      try { const call=route.request().postDataJSON(),fixed=fixtureStatus(call);if(fixed){await route.fulfill({body:JSON.stringify(fixed),contentType:'application/json'});return;} const res=await fetch(route.request().url(), {method:"POST",headers:{"content-type":"application/json"},body:route.request().postData(),signal:AbortSignal.timeout(20000)}); const body=await res.text(); await route.fulfill({body:statusFixture===3&&call.method==='eth_getBlockByNumber'?JSON.stringify(fixtureBlock(call,JSON.parse(body))):body,contentType:"application/json"}); }
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
    for(const width of [2560,1440,1000,999,960,800,720,661,660,375,360,359,320]) {
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
        // v12 SPEC 1-4: assert exact requested text/structure on every route width.
        if(name==='vault') {
          assert.equal(await page.locator('.page-title > h1').textContent(), 'Always in stock');
          assertCapacity(await page.evaluate(capacityGeometry));
          assert.equal(await page.locator('.page-title > p').count(), 0, 'Vault has neither a title sentence nor an empty paragraph');
        }
        if(['vault','deposit'].includes(name)) {
          await page.waitForFunction(()=>!document.querySelector('button.refresh')?.disabled);
          assert.equal(await page.locator('.read-errors').count(),0,'Normal-state proof requires readable public vault data');
          assert.equal(await page.locator('.deposit-state').count(),0,'Known normal operation has no status area');
          assert.equal(await page.locator('.deposit-open').count(),0,'The old open-only Deposit line is absent');
          if(name==='vault')assert.equal(await page.locator('.deposit-summary').evaluate(e=>e.getBoundingClientRect().height),0,'Empty Vault status wrapper takes no space');
        }
        assert.equal(await page.locator('.deposit-led-sign').count(),0,'Normal operation and other routes have no sign');
        if(name==='deposit') {
          // v14: the Before-you-deposit notes are an aside at 960px and below and sit under the form inside the panel above that.
          const notes=page.locator(width>960?'.deposit-main > .deposit-notes':'.flow-layout > aside.panel');
          assert.equal(await notes.count(),1,`${engine} deposit ${width}: one Before-you-deposit container`);
          assert.equal(await page.locator(width>960?'.flow-layout > aside.panel':'.deposit-notes').count(),0,`${engine} deposit ${width}: the notes live in one place only`);
          assert.equal(await notes.locator('details').count(),0);
          assert.deepEqual((await notes.locator(':scope > p').allTextContents()).slice(2).map(t=>t.replace(/\s+/g,' ').trim()),V12_DEPOSIT);
          assert.equal(await notes.getByText('Issuer restrictions and pool checks can temporarily halt deposits.',{exact:true}).count(),1,`${engine} deposit ${width}: the approved note`);
          assert.equal(await page.getByText(/Feeds lag the market\. Issuer/).count(),0,`${engine} deposit ${width}: the old note is gone`);
          assert.equal(await page.getByText('Grey stocks are already in the form above.',{exact:true}).count(),0,`${engine} deposit ${width}: the grey-stocks sentence is gone`);
          if(width>960){const two=await page.evaluate(()=>{const m=document.querySelector('.deposit-main'),r=document.querySelector('.deposit-right');if(!m)return null;const a=m.getBoundingClientRect(),b=r?.getBoundingClientRect();return {columns:getComputedStyle(document.querySelector('.deposit-columns')).gridTemplateColumns.split(' ').length,right:b?b.left>=a.right-1&&Math.abs(b.top-a.top)<2:null,open:!!document.querySelector('.deposit-right .all-stocks.open-list'),fold:document.querySelectorAll('details.all-stocks').length};});assert.deepEqual(two,{columns:2,right:two?.right,open:two?.open,fold:0},`${engine} deposit ${width}: two columns`);assert.ok(two.right!==false&&two.open!==false,`${engine} deposit ${width}: list open on the right ${JSON.stringify(two)}`);}
        }
        if(name==='redeem') {
          assert.equal(await page.locator('.flow-layout.one-column').count(),1);
          assert.equal(await page.getByText('Take your basket home',{exact:true}).count(),0);
          assert.equal(await page.locator('.claims').count(),0,'No-wallet Redeem has no claims panel');
          assert.equal(await page.getByText('Connect the receiver wallet to read and claim its owed stocks.',{exact:true}).count(),1);
        }
        if(name==='docs') {
          const first=page.locator('.docs-grid > .panel').filter({has:page.getByRole('heading',{name:'What Basket is',exact:true})});
          assert.deepEqual((await first.locator(':scope > p').allTextContents()).map(t=>t.replace(/\s+/g,' ').trim()),V12_DOCS);
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
    // Owner follow-up: known closure has exactly one short notice; CLOSED sign at every selected width.
    statusFixture=14;
    for(const width of [2560,1440,1000,999,960,800,720,661,660,375,360,359,320])for(const name of ['vault','deposit']) {
      const beforeFixtureReads=statusFixtureReads;
      await page.setViewportSize({width,height:width===375?812:1000});
      await page.goto(base+'/preview/#'+name);await page.reload();
      await page.waitForFunction(routeShown,name);
      await page.evaluate(()=>document.fonts.ready);
      await page.waitForFunction(()=>!document.querySelector('button.refresh')?.disabled);
      assert.ok(statusFixtureReads>beforeFixtureReads,'Closed proof consumed the exact existing depositStatus fixture');
      assert.equal(await page.locator('.read-errors').count(),0,'Closed proof requires readable public vault data');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Closed state has no horizontal overflow');
      if(name==='vault')assertCapacity(await page.evaluate(capacityGeometry));
      assert.equal(await page.locator('.deposit-state > p').first().textContent(),name==='deposit'?ISSUE_NOTICE:'Closed','Exact owner-approved issue notice');
        if(['vault','deposit'].includes(name)) {
          const status=await page.locator('.deposit-state').evaluateAll(es=>es.map(e=>{
            const visible=n=>!!n&&n.getBoundingClientRect().height>0&&getComputedStyle(n).visibility!=='hidden';
            return {compact:!!e.closest('.deposit-summary'),label:e.querySelector(':scope > strong')?.textContent,labelVisible:visible(e.querySelector(':scope > strong')),paragraphs:[...e.querySelectorAll(':scope > p')].map(p=>({text:p.textContent,visible:visible(p)}))};
          }));
          assert.equal(status.length,1,'Exactly one deposit status on '+name);
          assert.equal(status[0].label,name==='vault'?'Vault status:':undefined,'Only Vault has the compact status label');
          assert.equal(status[0].labelVisible,name==='vault');
          assert.equal(status[0].paragraphs.length,1,'Exactly one status paragraph; old hours/reason detail is absent');
          assert.equal(status[0].paragraphs[0].visible,true,'Current status is visible');
          assert.equal(status[0].compact,name==='vault','Only Vault scopes the compact status');
          assert.equal(await page.locator('.deposit-state .reopen, .deposit-state .why').count(),0,'No old detailed status paragraphs');
          assert.equal(await page.locator('.deposit-open').count(),0,'The old open-only Deposit line is absent');
        }
        if(name==='deposit')await page.waitForFunction(()=>!document.querySelector('button.refresh')?.disabled);
        const led=await page.evaluate(ledGeometry);
        const unknown=!led.status||/^(Reading\.\.\.|unreadable)/.test(led.status)||led.reopening==='Deposits may be open now. Press Refresh vault.';
        if(name!=='deposit'||unknown)assert.equal(led.signs.length,0,'LED is absent off Deposit and for unreadable/reopening status');
        else if(!led.readIssues)assert.equal(led.signs.length,1,'Readable Deposit status has exactly one LED sign');
        else assert.ok(led.signs.length<=1,'Partial reads never duplicate the sign');
        if(led.signs.length) {
          const sign=led.signs[0];
          assert.equal(sign.label,'Closed','The only owner-approved LED state is Closed');
          assert.equal(sign.role,'img');
          assert.equal(sign.inline&&sign.onDeposit&&sign.inside,true,'LED is inline SVG contained in the Deposit status box');
          assert.ok(sign.width>0&&sign.width<=220&&sign.height>0,'LED keeps its small approved dimensions');
          assert.equal(sign.black,'#080b14');assert.equal(sign.blue,'rgb(41, 107, 204)');assert.equal(sign.red,true);
          assert.equal(sign.circles,210,'LED keeps the complete CLOSED dot word');
          assert.equal(sign.animations,0,'LED is still under reduced motion');
          if([1440,375].includes(width)) {
            await page.emulateMedia({reducedMotion:'no-preference'});
            await page.waitForFunction(()=>document.querySelector('.deposit-led-sign').getAnimations({subtree:true}).length===2);
            const moving=await page.evaluate(ledGeometry);
            await page.waitForTimeout(120);
            const moved=await page.evaluate(ledGeometry);
            assert.equal(moved.signs[0].label,sign.label,'Animation never changes the status word');
            assert.notEqual(moved.signs[0].offset,moving.signs[0].offset,'Approved border animation moves');
            await page.emulateMedia({reducedMotion:'reduce'});
            await page.waitForFunction(()=>document.querySelector('.deposit-led-sign').getAnimations({subtree:true}).length===0);
            assert.equal((await page.evaluate(ledGeometry)).signs[0].animations,0,'Reduced motion cancels LED animations');
            ledMotionProofs++;
          }
        }
    }
    statusFixture=3;
    for(const width of [1440,375]) {
      const beforeBlocks=weekendBlockReads,beforeStatus=statusFixtureReads;
      await page.setViewportSize({width,height:width===375?812:1000});
      await page.goto(base+'/preview/#deposit');await page.reload();
      await page.waitForFunction(routeShown,'deposit');
      await page.evaluate(()=>document.fonts.ready);
      await page.waitForFunction(()=>!document.querySelector('button.refresh')?.disabled);
      assert.ok(weekendBlockReads>beforeBlocks&&statusFixtureReads>beforeStatus,'Weekend proof consumes both exact status and public-block timestamp fixtures');
      assert.equal(await page.locator('.read-errors').count(),0,'Weekend proof requires readable public vault data');
      assert.deepEqual(await page.locator('.deposit-state > p').allTextContents(),[WEEKEND_NOTICE],'Weekend notice is exactly the one owner sentence');
      assert.equal(await page.locator('.deposit-state > strong, .deposit-state .reopen, .deposit-state .why').count(),0,'Weekend has no extra label or detail');
      const led=await page.evaluate(ledGeometry);
      assert.equal(led.signs.length,1);assert.equal(led.signs[0].label,'Closed');
      assert.equal(led.signs[0].inside,true);assert.equal(led.signs[0].animations,0);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Weekend notice has no horizontal overflow');
    }
    statusFixture=0;
    assert.equal(ledMotionProofs,2,'Both desktop and phone prove LED movement and reduced-motion cancellation');
    checks.push(engine+': normal status area absent; exact single issue paragraph, compact Vault Closed notice, Deposit-only CLOSED LED at all 13 selected widths; desktop/phone exact weekend sentence, motion and reduced-motion cancellation');
    // v12 SPEC 6: portable wide-font stress. Measure a one-line clone, widen only
    // the tag with letter spacing, and make its first sentence at least 240 px and
    // wider than the available text area. No installed fallback font is assumed.
    for(const name of ['deposit','redeem']) for(const width of [661,375,320]) {
      await page.setViewportSize({width,height:1000});
      await page.goto(base+'/preview/#'+name);
      await page.waitForFunction(routeShown,name);
      await page.evaluate(()=>document.fonts.ready);
      await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
      const stress=await page.evaluate(()=>{
        document.getElementById('wide-label-test')?.remove();
        const tag=document.querySelector('.hours-tag'),strong=tag.querySelector('strong');
        const style=document.createElement('style'); style.id='wide-label-test'; document.head.append(style);
        const probe=strong.cloneNode(true);
        probe.style.cssText='position:absolute;visibility:hidden;white-space:nowrap!important;width:max-content;max-width:none;';
        tag.append(probe);
        const tc=getComputedStyle(tag),box=tag.parentElement.getBoundingClientRect(),pc=getComputedStyle(tag.parentElement);
        const room=box.width-parseFloat(pc.borderLeftWidth)-parseFloat(pc.borderRightWidth)-parseFloat(pc.paddingLeft)-parseFloat(pc.paddingRight)-parseFloat(tc.borderLeftWidth)-parseFloat(tc.borderRightWidth)-parseFloat(tc.paddingLeft)-parseFloat(tc.paddingRight);
        const target=Math.max(240,room+16);
        let spacing=0,oneLine=probe.getBoundingClientRect().width;
        while(oneLine<target&&spacing<30) {spacing+=0.25;style.textContent='.hours-tag{letter-spacing:'+spacing+'px!important}';oneLine=probe.getBoundingClientRect().width;}
        probe.remove(); return {spacing,oneLine,room,target};
      });
      const label=engine+' '+name+' '+width+' wide label';
      assert.ok(stress.oneLine>=240&&stress.oneLine>stress.room,label+': stress sentence reached the measured width');
      const current=await page.evaluate(wideLabelGeometry);
      assertWideLabel(current,label);
      assert.ok(current.strongLines>=2,label+': first sentence wraps at whole words');
      // Put back the exact v11 defect on the same page and available width. The
      // same geometry assertion must now reject it; then v12 must pass again.
      const legacy=await page.addStyleTag({content:'.hours-tag strong{white-space:nowrap!important}'});
      const old=await page.evaluate(wideLabelGeometry);
      assert.throws(()=>assertWideLabel(old,label+' with v11 nowrap'),{name:'AssertionError'});
      assert.ok(old.outside.length>0,label+': failure is an actual word outside the pill');
      await legacy.evaluate(e=>e.remove());
      assertWideLabel(await page.evaluate(wideLabelGeometry),label+' restored');
      // Measurements are asserted above; retain bounded evidence, not duplicate
      // full geometry, in the delivery's validation report.
      wideLabels.push({engine,name,width,...stress,strongLines:current.strongLines,v11Outside:old.outside});
      await page.locator('.hours-tag').screenshot({path:path.join(captures,engine+'-'+name+'-'+width+'-wide-label.png')});
      await page.evaluate(()=>document.getElementById('wide-label-test').remove());
      checks.push(label+': one-line width at least 240 px; wraps at word boundaries inside pill and panel, clear of character/bubble; identical check rejects v11 nowrap');
    }
    // v12 SPEC 1: compare the Vault height at every width with the live
    // title. Its public data does not affect title sizing, so this second page
    // loads only local files and never adds a public RPC read. The same page
    // (the live site) is the reference for the placing of every title.
    baselinePage=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    await baselinePage.route('**/*',route=>route.request().url().startsWith(base+'/')?route.continue():route.abort());
    await baselinePage.goto(base+'/baseline/#vault');
    await baselinePage.waitForFunction(routeShown,'vault');
    await baselinePage.evaluate(()=>document.fonts.ready);
    await baselinePage.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
    // Every width from 320 to 2560 px: whole bubble words inside the bubble, the strip clear of the title text, the bubble in
    // its frame and off the picture's face/hands/item boxes, no overflow and a wallet hint gap of at least 8 px.
    for(const name of ["vault","deposit","redeem"]) {
      await page.setViewportSize({width:1440,height:1000});
      await page.goto(base+"/preview/#"+name);
      await page.waitForFunction(routeShown,name);
      await page.evaluate(()=>document.fonts.ready);
      await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
      await baselinePage.setViewportSize({width:1440,height:1000});
      await baselinePage.goto(base+'/baseline/#'+name);
      await baselinePage.waitForFunction(routeShown,name);
      await baselinePage.evaluate(()=>document.fonts.ready);
      await baselinePage.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
      // No focus marker in this sweep (the page moves the focus to the heading on a change of page, and WebKit
      // draws the marker for that focus): it has its own check below.
      for(const p of [page,baselinePage]) await p.evaluate(()=>document.activeElement?.blur?.());
      const lines={};let compared=0,centred=0,nearest=0;
      for(let width=320;width<=2560;width++) {
        await page.setViewportSize({width,height:1000});
        const g=await page.evaluate(titleGeometry,{R:REGIONS,name,pixels:width%40===0});
        assertGeometry(g,`${engine} ${name} ${width}`,width%40===0);
        assert.equal(g.ring.shown,false,`${engine} ${name} ${width}: a focus marker in the sweep`);
        // The live title at the same width (Vault: every width; Deposit and Redeem: every phone width and every
        // 40 px above): nothing in a title is placed differently from the live site while the heading has no
        // focus marker. (v15 moved the Vault title on phones; the live site carries that placing now, and
        // assertGeometry above still asserts it at every phone width.)
        if(name==='vault'||width<=660||width%40===0) {
          await baselinePage.setViewportSize({width,height:1000});
          const label=`${engine} ${name} ${width}`;
          let was=await baselinePage.evaluate(titleGeometry,{R:REGIONS,name,pixels:false});
          // The reference page also moves the focus to its heading on a change of page, and as a background page it
          // may do so late: the comparison is of the plain state, so take that focus away first.
          if(was.ring.shown){await baselinePage.evaluate(()=>document.activeElement?.blur?.());was=await baselinePage.evaluate(titleGeometry,{R:REGIONS,name,pixels:false});}
          assert.equal(was.ring.shown,false,label+': a focus marker on the reference page');
          if(name==='vault') assert.ok(g.titleHeight<=was.titleHeight+0.5,engine+' vault '+width+': title grew from '+was.titleHeight+' to '+g.titleHeight);
          assert.deepEqual(placed(g),placed(was),label+': something in the title is placed differently from the live title');
          if(name==='vault'&&width<=660) Math.abs(g.pictureOff)<0.5?centred++:nearest++;
          compared++;
        }
        lines[g.bubbleLines]=(lines[g.bubbleLines]||0)+1;
      }
      checks.push(name==='vault'
        ?`${engine} vault title: on phones (320-660 px) the picture stands in the middle of the panel at ${centred} widths and, on the ${nearest} narrowest, as near it as her three-line bubble allows 4 px inside the frame; shelf line across the panel, heading centred (v15); the title equals the live title at every width from 320 to 2560 px`
        :`${engine} ${name} title: equals the live title (picture, bubble, heading, shelf line) at every phone width and every 40 px above (${compared} widths) while the heading has no focus marker`);
      checks.push(`${engine} ${name}: every width 320-2560 px keeps whole bubble words (bubble lines ${JSON.stringify(lines)}), the strip clear of the title text, the title text centred beside her (Vault heading 17 px under her on phones), the bubble in its frame and the wallet hint gap; picture pixels checked every 40 px`);
    }
    // v15: the heading's focus marker. A key press first, so that the focus the page itself moves to the heading
    // on a change of page counts as keyboard focus in every engine (iPhone browsers draw the marker after a tap too).
    for(const name of ['deposit','redeem','vault']) for(const width of [661,660,430,393,375,360,359,320]) {
      const label=`${engine} ${name} ${width} focus marker`;
      await page.setViewportSize({width,height:1000});
      await page.goto(base+'/preview/#'+name);
      await page.waitForFunction(routeShown,name);
      await page.evaluate(()=>document.fonts.ready);
      await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
      // Opening the page from another page moves the focus to the heading in a requestAnimationFrame after the hash
      // change (main.tsx), which can land after the route shows: let that frame pass, then take the focus away for the
      // plain state (2026-10-16: measured before it landed once in sixteen runs).
      await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
      await page.evaluate(()=>document.activeElement?.blur?.());
      const plain=await page.evaluate(titleGeometry,{R:REGIONS,name,pixels:false});
      assert.equal(plain.ring.shown,false,label+': marker shown without focus');
      await page.goto(base+'/preview/#docs');
      await page.waitForFunction(routeShown,'docs');
      await page.keyboard.press('Tab');
      await page.evaluate(n=>{location.hash='#'+n;},name);
      await page.waitForFunction(routeShown,name);
      await page.waitForFunction(()=>document.activeElement?.tagName==='H1');
      await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
      const marked=await page.evaluate(titleGeometry,{R:REGIONS,name,pixels:false});
      assert.equal(marked.ring.shown,true,label+': the heading does not show the marker after keyboard focus');
      if(width>660) assert.equal(marked.shelf,null,label+': a shelf line above phone widths');
      else if(name==='vault') {
        // Vault: the line is 17 px above the heading; the marker's band stays clear of it and nothing moves.
        assert.deepEqual(placed(marked),placed(plain),label+': the Vault title moved with the marker');
        assert.ok(marked.h1.top-6-marked.shelf.bottom>=7.5,label+': the marker touches the shelf line');
        // The v14 placing put back (picture and bubble centred as one group, the short line, the heading at the
        // left): the same check rejects it; with it removed the check passes again.
        const legacy=await page.addStyleTag({content:'.page-title.character-vault .title-character{--gx:max(0px, calc((100% - var(--zone)) / 2))!important}.page-title.character-vault .title-character:after{right:auto!important;width:calc(var(--pad) + var(--gx) + var(--w) + 12px)!important}.page-title.character-vault>h1{text-align:left!important}'});
        const old=await page.evaluate(titleGeometry,{R:REGIONS,name,pixels:false});
        assert.throws(()=>assertVaultPhone(old,label+' with the v14 placing'),{name:'AssertionError'},label+': the check accepts the v14 placing');
        await legacy.evaluate(e=>e.remove());
        assertVaultPhone(await page.evaluate(titleGeometry,{R:REGIONS,name,pixels:false}),label+' restored');
      } else {
        assertShelfMeetsMarker(marked,label);
        assert.deepEqual({...placed(marked),shelf:null},{...placed(plain),shelf:null},label+': something besides the shelf line moved with the marker');
        // The live v14 line (ending at the heading's own edge, 3 px above the band) put back: the same check rejects it.
        const legacy=await page.addStyleTag({content:'.page-title .title-character:after{bottom:-3px!important;width:calc(var(--pad) + var(--gx) + var(--w) + 12px)!important}'});
        const old=await page.evaluate(titleGeometry,{R:REGIONS,name,pixels:false});
        assert.throws(()=>assertShelfMeetsMarker(old,label+' with the v14 line'),{name:'AssertionError'},label+': the check accepts the v14 corner');
        assert.deepEqual(old.shelf,plain.shelf,label+': the put-back line is not the line without a marker');
        await legacy.evaluate(e=>e.remove());
        assertShelfMeetsMarker(await page.evaluate(titleGeometry,{R:REGIONS,name,pixels:false}),label+' restored');
        if([430,375,320].includes(width)) {
          const clip=await page.evaluate(()=>{const t=document.querySelector('.page-title').getBoundingClientRect(),i=document.querySelector('.character-picture').getBoundingClientRect(),top=Math.max(0,Math.min(t.top,i.top)+scrollY-12);return {x:0,y:top,width:innerWidth,height:t.bottom+scrollY+12-top};});
          await page.screenshot({path:path.join(captures,`${engine}-${name}-${width}-focus-marker.png`),clip,fullPage:true});
        }
      }
      // Focus gone: the line is back where it is without a marker.
      await page.evaluate(()=>document.activeElement.blur());
      const after=await page.evaluate(titleGeometry,{R:REGIONS,name,pixels:false});
      assert.equal(after.ring.shown,false,label+': marker still shown after blur');
      assert.deepEqual(placed(after),placed(plain),label+': the title is not back in place after blur');
    }
    checks.push(`${engine} v15 focus marker (keyboard focus moved to the heading by a change of page) at 660, 430, 393, 375, 360, 359 and 320 px: on Deposit and Redeem her shelf line runs from the frame to the marker's outer left edge on the marker's bottom band, same height and colour, and nothing else moves; the same check rejects the v14 line put back; without the marker and after blur the line is the plain line; on Vault the marker stays clear of the line and the v14 placing put back is rejected; at 661 px there is no shelf line`);
    await baselinePage.close();baselinePage=undefined;
    await browser.close();browser=undefined;
  }
  fs.writeFileSync(path.join(root,'artifacts/art-validation.json'),JSON.stringify({hashes,checks,bubbles,wideLabels,limitations:['Linux browser engines; physical iPhone not tested. Rendered screenshots reviewed separately.']},null,2)+'\n');
  console.log('PASS art hashes and browser layout',hashes.length,checks.length);
} finally {await browser?.close();await new Promise(r=>server.close(r));}

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const root = path.resolve("../dist"),
  out = path.resolve("../artifacts");
const server = http.createServer((req, res) => {
  const file = path.resolve(
    root,
    req.url === "/preview/" ? "index.html" : req.url.slice(9),
  );
  if (!file.startsWith(root + "/")) return res.writeHead(403).end();
  try {
    res.setHeader(
      "content-type",
      {
        ".js": "application/javascript",
        ".css": "text/css",
        ".html": "text/html",
        ".woff2": "font/woff2",
        ".svg": "image/svg+xml",
        ".webp": "image/webp",
      }[path.extname(file)] || "text/plain",
    );
    res.end(fs.readFileSync(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/preview/`;
let browser;
const checks = [];
try {
  browser = await chromium.launch({ args: ["--no-sandbox"], headless: true });
  for (const scale of [1, 1.25, 1.5]) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      deviceScaleFactor: scale,
    });
    const page = await context.newPage();
    for (const name of [
      "vault",
      "deposit",
      "redeem",
      "docs",
      "owner",
      "losses",
    ]) {
      await page.goto(url + "#" + name);
      // A hash change re-renders asynchronously: wait until the requested route is the current page.
      await page.waitForFunction(
        (n) => !!document.querySelector(`a[aria-current="page"][href="#${n}"]`),
        name,
      );
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(
        () => !document.querySelector("button.refresh").disabled,
      );
      const positions = () =>
        page.evaluate(() =>
          [
            ...document.querySelectorAll(
              ".page-title > p, .page-title h1, .page-title .title-character > *, .brand, .burst",
            ),
          ].map((e) => {
            const r = e.getBoundingClientRect(),
              s = getComputedStyle(e);
            return {
              x: r.x,
              y: r.y + scrollY,
              width: r.width,
              transform: s.transform,
            };
          }),
        );
      const before = await positions();
      for (const y of [80, 240, 400, 600, 0]) {
        await page.evaluate((y) => scrollTo(0, y), y);
        await page.waitForTimeout(60);
        assert.deepEqual(
          await positions(),
          before,
          `${name}: title moved at DPR ${scale}`,
        );
      }
      checks.push(
        `${name}: title/brand/sticker geometry stable while scrolling at Linux Chromium DPR ${scale}`,
      );
      if (name === "vault") {
        // v9 Stock shelves: the restocking swing is the panel's only motion and runs once per label: every animation
        // there has one iteration and ends within 2 s (delay included); after scrolling through the whole page
        // nothing in the panel is still moving, and scrolling back up starts nothing again.
        const shelves = () =>
          page.evaluate(() =>
            document
              .getAnimations()
              .filter((a) => a.effect?.target?.closest?.(".stock-section"))
              .map((a) => ({
                label: a.effect.target.querySelector?.("h4")?.textContent ?? "",
                iterations: a.effect.getComputedTiming().iterations,
                end: a.effect.getComputedTiming().endTime,
                running: a.playState === "running",
              })),
          );
        const labels = await page.locator(".stock-section article.sa-label").count();
        const height = await page.evaluate(() => document.documentElement.scrollHeight);
        const seen = [];
        for (let y = 0; y <= height; y += 200) {
          await page.evaluate((y) => scrollTo(0, y), y);
          await page.waitForTimeout(50);
          seen.push(...(await shelves()));
        }
        assert.ok(
          seen.every((a) => a.iterations === 1 && a.end <= 2000),
          `Stock shelves: an endless or long animation at DPR ${scale}`,
        );
        const swung = new Set(seen.map((a) => a.label));
        if (labels) assert.ok(swung.size > 0, `Stock shelves: no restocking swing at DPR ${scale}`);
        await page.waitForTimeout(2100);
        assert.equal(
          (await shelves()).filter((a) => a.running).length,
          0,
          `Stock shelves still moving at DPR ${scale}`,
        );
        for (let y = height; y >= 0; y -= 400) {
          await page.evaluate((y) => scrollTo(0, y), y);
          await page.waitForTimeout(50);
        }
        assert.equal(
          (await shelves()).length,
          0,
          `Stock shelves moved again on scrolling back at DPR ${scale}`,
        );
        checks.push(
          `vault: Stock shelves restocking swing once per label (${swung.size} of ${labels} labels seen swinging), one iteration within 2 s, nothing moving afterwards or on scrolling back, DPR ${scale}`,
        );
      }
      // Look update: the shot covers the title panel up to the title character; her detailed picture would
      // multiply these tracked PNGs and break the 8 MiB bundle budget (check-bundle.mjs).
      if (name === "redeem")
        await page.screenshot({
          path: path.join(out, `redeem-title-dpr-${scale}.png`),
          fullPage: true,
          clip: await page.locator(".page-title").evaluate((e) => {
            const r = e.getBoundingClientRect(),
              c = e.querySelector(".title-character"),
              right = c ? c.getBoundingClientRect().left - 8 : r.right;
            return {
              x: r.left,
              y: r.top + scrollY,
              width: right - r.left,
              height: r.height,
            };
          }),
        });
    }
    for (const width of [375, 661, 1440, 1920, 2560, 3440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(url + "#deposit");
      await page.evaluate(() => document.fonts.ready);
      const track = page.locator(".marquee-track");
      const lengths = await track.evaluate((e) => ({
        track: e.getBoundingClientRect().width,
        frame: e.parentElement.getBoundingClientRect().width,
        halves: [...e.children].map((h) => ({
          width: h.getBoundingClientRect().width,
          shown: [...h.children].filter(
            (s) => getComputedStyle(s).display !== "none",
          ).length,
        })),
        willChange: getComputedStyle(e).willChange,
      }));
      // v9 slogan strip: each half is k whole 720 px lines, k the fewest that cover the viewport; the moving block
      // is at most two screens plus two lines wide and has no will-change.
      const k = Math.min(8, Math.max(1, Math.ceil(width / 720)));
      for (const h of lengths.halves) {
        assert.equal(h.shown, k, `${k} lines per half at ${width}`);
        assert.ok(Math.abs(h.width - 720 * k) < 0.5 * k, `Half width ${width}`);
      }
      assert.ok(
        720 * k >= width && lengths.track / 2 >= lengths.frame - 0.01,
        `No empty stretch ${width}`,
      );
      assert.ok(lengths.track <= 2 * (width + 720) + 0.5, `Track ${width}`);
      assert.equal(lengths.willChange, "auto", `No will-change ${width}`);
      for (const position of [0, 0.25, 0.49999, 0.75, 0.99999]) {
        const gap = await track.evaluate((e, fraction) => {
          const a = e.getAnimations()[0];
          a.pause();
          a.currentTime = a.effect.getTiming().duration * fraction;
          const r = e.getBoundingClientRect(),
            f = e.parentElement.getBoundingClientRect();
          return r.right < f.right || r.left > f.left;
        }, position);
        assert.equal(gap, false);
      }
      checks.push(
        `Marquee (${k} whole lines per half, no will-change) covers ${width}px at every sampled loop position, DPR ${scale}`,
      );
    }
    await context.close();
  }
  fs.writeFileSync(
    path.join(out, "motion-validation.json"),
    JSON.stringify(
      {
        checks,
        limitation:
          "Linux Chromium deviceScaleFactor emulation only. Native Windows Chrome/Edge at 100%, 125%, 150%, physical phones and compositor glyph rasterization are not verified.",
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS",
    checks.length,
    "motion/layout checks; native Windows scaling NOT VERIFIED",
  );
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
}

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
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(
        () => !document.querySelector("button.refresh").disabled,
      );
      const positions = () =>
        page.evaluate(() =>
          [
            ...document.querySelectorAll(
              ".page-title > p, .page-title h1, .brand, .burst",
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
      if (name === "redeem")
        await page
          .locator(".page-title")
          .screenshot({
            path: path.join(out, `redeem-title-dpr-${scale}.png`),
          });
    }
    for (const width of [375, 661, 1440, 1920, 2560]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(url + "#deposit");
      await page.evaluate(() => document.fonts.ready);
      const track = page.locator(".marquee-track");
      const lengths = await track.evaluate((e) => ({
        track: e.getBoundingClientRect().width,
        frame: e.parentElement.getBoundingClientRect().width,
      }));
      assert.ok(
        lengths.track / 2 >= lengths.frame,
        `No empty stretch ${width}`,
      );
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
        `Marquee covers ${width}px at every sampled loop position, DPR ${scale}`,
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

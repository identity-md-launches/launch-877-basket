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
      const speed = width <= 660 ? 64 : 16;
      // v10: Marquee re-times the loop after a viewport change or the web font's arrival (ResizeObserver): wait for the
      // strip's font itself, then up to 3 s for both halves to run at a cycle that matches the half width; the exact
      // values are asserted below.
      await page.evaluate(() =>
        document.fonts.load("24px Pixel").then(() => document.fonts.ready),
      );
      await page
        .waitForFunction(
          (speed) => {
            const h = document.querySelector(".marquee-half"),
              a = document
                .querySelector(".marquee")
                .getAnimations({ subtree: true });
            return (
              a.length === 2 &&
              a.every(
                (x) =>
                  x.playState === "running" &&
                  Math.abs(
                    x.effect.getTiming().duration -
                      ((2 * h.getBoundingClientRect().width) / speed) * 1000,
                  ) < 0.01,
              )
            );
          },
          speed,
          { timeout: 3000 },
        )
        .catch(() => {});
      const strip = page.locator(".marquee");
      const lengths = await strip.evaluate((m) => {
        const e = m.querySelector(".marquee-track"),
          halves = [...e.children];
        return {
          track: e.getBoundingClientRect().width,
          trackTransform: getComputedStyle(e).transform,
          frame: e.parentElement.getBoundingClientRect().width,
          halves: halves.map((h) => ({
            width: h.getBoundingClientRect().width,
            shown: [...h.children].filter(
              (s) => getComputedStyle(s).display !== "none",
            ).length,
          })),
          parts: [m, e.parentElement, e, ...halves, ...m.querySelectorAll("span")].map(
            (x) => ({
              willChange: getComputedStyle(x).willChange,
              animationName: getComputedStyle(x).animationName,
              transform: getComputedStyle(x).transform,
              flat: [
                getComputedStyle(x).transformStyle,
                getComputedStyle(x).perspective,
                getComputedStyle(x).backfaceVisibility,
              ].join(" "),
            }),
          ),
          loops: m.getAnimations({ subtree: true }).map((a) => ({
            half: halves.indexOf(a.effect.target),
            css: typeof CSSAnimation !== "undefined" && a instanceof CSSAnimation,
            iterations: a.effect.getTiming().iterations,
            duration: a.effect.getTiming().duration,
            start: a.startTime,
            keyframes: a.effect
              .getKeyframes()
              .map((f) => `${f.computedOffset} ${f.transform}`)
              .join(", "),
          })),
        };
      });
      // v9 slogan strip: each half is k whole 720 px lines, k the fewest that cover the viewport.
      // v10: the halves share one grid cell and each moves as its own endless Web Animation (no CSS animation, no
      // will-change, no 3D), so the moving blocks are the two halves (k lines each, at most the viewport plus one
      // line), the track stays put; speed exactly 16 px/s (64 px/s at 660 px and below), two half widths per cycle.
      const k = Math.min(8, Math.max(1, Math.ceil(width / 720)));
      for (const h of lengths.halves) {
        assert.equal(h.shown, k, `${k} lines per half at ${width}`);
        assert.ok(Math.abs(h.width - 720 * k) < 0.5 * k, `Half width ${width}`);
      }
      const L = lengths.halves[0].width;
      assert.ok(
        720 * k >= width && L >= lengths.frame - 0.01,
        `No empty stretch ${width}`,
      );
      assert.ok(
        Math.abs(lengths.track - L) < 0.01 &&
          lengths.trackTransform === "none" &&
          L <= width + 720 + 0.5 * k,
        `Moving blocks ${width}`,
      );
      for (const p of lengths.parts) {
        assert.equal(p.willChange, "auto", `No will-change ${width}`);
        assert.equal(p.animationName, "none", `No CSS animation ${width}`);
        assert.ok(
          p.transform === "none" ||
            /^matrix\(1, 0, 0, 1, -?[\d.e+-]+, 0\)$/.test(p.transform),
          `No 3D ${width}: ${p.transform}`,
        );
        assert.equal(p.flat, "flat none visible", `No 3D ${width}`);
      }
      assert.deepEqual(
        lengths.loops.map((x) => [x.half, x.css, x.iterations]).sort(),
        [
          [0, false, Infinity],
          [1, false, Infinity],
        ],
        `One endless Web Animation on each half ${width}`,
      );
      for (const x of lengths.loops)
        assert.ok(
          Math.abs((2 * L) / (x.duration / 1000) - speed) < 1e-6 &&
            x.start === lengths.loops[0].start &&
            x.keyframes === "0 translateX(100%), 1 translateX(-100%)",
          `Speed ${width}: ${JSON.stringify(x)}`,
        );
      // Paused at loop phases (as fractions of a half's cycle, just before and after each half's reset among them),
      // the halves sit edge to edge across the whole window.
      for (const position of [
        0, 1e-7, 0.25, 0.4999999, 0.5, 0.5000001, 0.75, 0.9999999,
      ]) {
        const gap = await strip.evaluate((m, fraction) => {
          for (const a of m.getAnimations({ subtree: true })) {
            a.pause();
            a.currentTime = a.effect.getTiming().duration * fraction;
          }
          const f = m.querySelector(".marquee-window").getBoundingClientRect(),
            [a, b] = [...m.querySelectorAll(".marquee-half")]
              .map((h) => h.getBoundingClientRect())
              .sort((x, y) => x.left - y.left);
          return Math.max(0, a.left - f.left, b.left - a.right, f.right - b.right);
        }, position);
        assert.ok(gap < 0.01, `Blank of ${gap} px at ${position} ${width}`);
      }
      // Real playback across both resets: no animationiteration event reaches the page.
      const wrap = await strip.evaluate(async (m) => {
        const a = m.getAnimations({ subtree: true }),
          d = a[0].effect.getTiming().duration,
          crossed = [];
        let events = 0;
        const count = () => events++;
        document.addEventListener("animationiteration", count, true);
        for (const at of [d / 2, d]) {
          for (const x of a) {
            x.currentTime = at - 150;
            x.play();
          }
          await new Promise((r) => setTimeout(r, 450));
          crossed.push(a[0].currentTime > at);
        }
        document.removeEventListener("animationiteration", count, true);
        return { events, crossed };
      });
      assert.deepEqual(
        wrap,
        { events: 0, crossed: [true, true] },
        `Loop ends ${width}`,
      );
      checks.push(
        `Marquee (${k} whole lines per half, each half its own endless Web Animation at ${speed} px/s, no CSS animation, will-change or 3D) covers ${width}px at every sampled loop phase incl. both resets, no animationiteration event across a real reset, DPR ${scale}`,
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

import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ||
    "/opt/imd-mcp/node_modules/playwright/index.mjs"
);
const dist = path.resolve("../dist"),
  out = path.resolve("../artifacts");
fs.mkdirSync(out, { recursive: true });
const captures = path.resolve("../test/scratch/export-review");
fs.mkdirSync(captures, { recursive: true });
const server = http.createServer((req, res) => {
  const p = path.resolve(
    dist,
    req.url === "/preview/" ? "index.html" : req.url.slice(9),
  );
  if (!p.startsWith(dist + "/")) {
    res.writeHead(403).end();
    return;
  }
  try {
    const b = fs.readFileSync(p);
    res.setHeader(
      "Content-Type",
      {
        ".html": "text/html",
        ".js": "application/javascript",
        ".css": "text/css",
        ".woff2": "font/woff2",
        ".svg": "image/svg+xml",
        ".webp": "image/webp",
        ".txt": "text/plain",
      }[path.extname(p)] || "application/octet-stream",
    );
    res.end(b);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const p = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    }),
    issues = [],
    results = [],
    outsideRequests = new Set();
  p.on("request", (r) => {
    if (!r.url().startsWith("http://127.0.0.1:")) outsideRequests.add(r.url());
  });
  p.on("pageerror", (e) => issues.push(e.message));
  p.on("response", (r) => {
    if (r.status() >= 400) issues.push(r.status() + " " + r.url());
  });
  const url = `http://127.0.0.1:${server.address().port}/preview/`;
  await p.route(
    /https:\/\/(rpc\.mainnet\.chain\.robinhood\.com|robinhood-rpc\.publicnode\.com)\/?$/,
    async (route) => {
      try {
        const r = await fetch(route.request().url(), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: route.request().postData(),
          signal: AbortSignal.timeout(20000),
        });
        await route.fulfill({
          body: await r.text(),
          contentType: "application/json",
        });
      } catch {
        await route.abort();
      }
    },
  );
  for (const width of [1440, 375, 320, 800]) {
    await p.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
    for (const name of [
      "Vault",
      "Deposit",
      "Redeem",
      "Docs",
      "Owner",
      "Losses",
    ]) {
      await p.goto(url + "#" + name.toLowerCase());
      await p.waitForFunction(
        () => !document.querySelector("button.refresh")?.disabled,
      );
      await p.evaluate(() => document.fonts.ready);
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `${name} ${width}`,
      );
      results.push({
        page: name,
        width,
        heading: await p.locator("h1").innerText(),
      });
      // v10: the 24/7 redemption tag on Deposit and Redeem only, first in the form, whole inside the viewport.
      const tag = await p.locator(".hours-tag").evaluateAll((ts) =>
        ts.map((t) => ({
          text: t.textContent,
          first: t.parentElement.firstElementChild === t,
          inView:
            t.getBoundingClientRect().left >= 0 &&
            t.getBoundingClientRect().right <= innerWidth,
        })),
      );
      assert.deepEqual(
        tag,
        ["Deposit", "Redeem"].includes(name)
          ? [
              {
                text: "Redemptions are open 24/7. Deposit hours apply to deposits only.",
                first: true,
                inView: true,
              },
            ]
          : [],
        `${name} ${width} 24/7 tag`,
      );
      if (width === 1440 || width === 375)
        await p.screenshot({
          path: path.join(captures, `live-${name.toLowerCase()}-${width}.jpg`),
          type: "jpeg",
          quality: 68,
          fullPage: true,
        });
    }
  }
  await p.goto(url);
  await p.keyboard.press("Tab");
  assert.equal(await p.locator(":focus").innerText(), "Skip to content");
  await p.keyboard.press("Enter");
  assert.equal(await p.locator(":focus").getAttribute("id"), "main-content");
  await p.getByRole("button", { name: "Connect wallet" }).first().click();
  await p
    .getByText(/Open this page in your wallet app/)
    .first()
    .waitFor();
  await p.goto(url + "#owner");
  const style = await p.evaluate(() => ({
    fonts: [...document.fonts].map((f) => ({
      family: f.family,
      status: f.status,
    })),
    inputSize: getComputedStyle(document.querySelector("input")).fontSize,
    marquee: getComputedStyle(document.querySelector(".marquee-track"))
      .animationName,
    // v10: the strip's halves move as Web Animations; under reduced motion none may exist (cancelled, not paused), no
    // strip element has a CSS animation, and the halves stand still side by side from the window's left edge.
    marqueeStill: (() => {
      const m = document.querySelector(".marquee"),
        w = m.querySelector(".marquee-window").getBoundingClientRect(),
        h = [...m.querySelectorAll(".marquee-half")]
          .map((e) => e.getBoundingClientRect())
          .sort((a, b) => a.left - b.left);
      return {
        animations: m.getAnimations({ subtree: true }).length,
        cssAnimations: [m, ...m.querySelectorAll("*")].filter(
          (e) => getComputedStyle(e).animationName !== "none",
        ).length,
        halves: h.length,
        start: Math.abs(h[0].left - w.left) < 0.01,
        sideBySide: Math.abs(h[1].left - h[0].right) < 0.01,
        full: h[1].right >= w.right - 0.01,
      };
    })(),
    focus: getComputedStyle(document.querySelector("a")).outlineOffset,
  }));
  assert.equal(style.marquee, "none");
  assert.deepEqual(style.marqueeStill, {
    animations: 0,
    cssAnimations: 0,
    halves: 2,
    start: true,
    sideBySide: true,
    full: true,
  });
  assert.equal(style.inputSize, "16px");
  assert.ok(style.fonts.every((f) => f.status === "loaded"));
  const pairs = [
    ["ink / paper", "#142c54", "#ffffff"],
    ["white / royal", "#ffffff", "#174bc1"],
    ["white / red", "#ffffff", "#df2029"],
    ["ink / sun", "#142c54", "#ffdb29"],
    ["error / paper", "#a01520", "#ffffff"],
    ["error / warning", "#a01520", "#fff5c4"],
    ["disabled text / surface", "#53617a", "#e4e9f0"],
  ];
  function lum(s) {
    const v = s
      .slice(1)
      .match(/../g)
      .map((x) => parseInt(x, 16) / 255)
      .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return v[0] * 0.2126 + v[1] * 0.7152 + v[2] * 0.0722;
  }
  const contrast = pairs.map(([name, fg, bg]) => ({
    name,
    fg,
    bg,
    ratio:
      (Math.max(lum(fg), lum(bg)) + 0.05) / (Math.min(lum(fg), lum(bg)) + 0.05),
  }));
  assert.ok(contrast.every((x) => x.ratio >= 4.5));
  assert.deepEqual(issues, []);
  assert.ok([...outsideRequests].every((url) => /^https:\/\/(rpc\.mainnet\.chain\.robinhood\.com|robinhood-rpc\.publicnode\.com)\/?$/.test(url)), "Only chain RPC may be requested outside the export");
  fs.writeFileSync(
    path.join(out, "export-review.json"),
    JSON.stringify(
      {
        results,
        style,
        contrast,
        issues,
        outsideRequests: [...outsideRequests],
        checks: [
          "Production subpath navigation",
          "No overflow at 320,375,800,1440 on all six pages",
          "Local fonts loaded",
          "Keyboard skip link reaches main",
          "No-wallet recovery message",
          "v10: the 24/7 redemption tag first in the Deposit and Redeem forms at four widths, on no other page",
          "Reduced motion disables marquee (v10: no Web Animation or CSS animation on the strip, the halves still and side by side from the left edge)",
        ],
        limitations: [
          "No screen reader, native zoom or physical device session",
          "Contrast checks cover named solid-color pairs, not every anti-aliased pixel",
        ],
      },
      null,
      2,
    ) + "\n",
  );
  console.log("PASS export review", results.length, "page/viewport checks");
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
}

import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import assert from "node:assert/strict";
import { createPublicClient, http as rpc, encodeFunctionData } from "viem";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ||
    "/opt/imd-mcp/node_modules/playwright/index.mjs"
);
const abi = JSON.parse(fs.readFileSync("src/vault.abi.json", "utf8"));
const deployment = fs.readFileSync("src/deployment.ts", "utf8");
const vault = deployment.match(/VAULT =\s*"(0x[^"]+)"/)[1];
const client = createPublicClient({
  transport: rpc("https://robinhood-rpc.publicnode.com"),
});
const owner = await client.readContract({
    address: vault,
    abi,
    functionName: "owner",
  }),
  guardian = await client.readContract({
    address: vault,
    abi,
    functionName: "guardian",
  });
const dist = path.resolve("../dist"),
  out = path.resolve("../artifacts");
let browser,
  mode = "normal",
  sends = 0;
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
    res.setHeader(
      "content-type",
      {
        ".html": "text/html",
        ".js": "application/javascript",
        ".css": "text/css",
        ".woff2": "font/woff2",
        ".svg": "image/svg+xml",
        ".webp": "image/webp",
      }[path.extname(p)] || "text/plain",
    );
    res.end(fs.readFileSync(p));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
try {
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const p = await browser.newPage();
  await p.exposeFunction("guardProvider", async ({ method }) => {
    if (method === "eth_chainId")
      return mode === "wrong-chain" ? "0x1" : "0x1237";
    if (method === "eth_accounts" || method === "eth_requestAccounts")
      return [mode === "account-change" ? guardian : owner];
    if (method === "wallet_switchEthereumChain") {
      mode = "normal";
      return null;
    }
    if (method === "eth_sendTransaction") {
      sends++;
      throw Error("Test must not send");
    }
    throw Error("Unsupported " + method);
  });
  await p.addInitScript(() => {
    window.ethereum = {
      request: (args) => window.guardProvider(args),
      on() {},
      removeListener() {},
    };
  });
  const pauseData = encodeFunctionData({ abi, functionName: "pauseDeposits" });
  await p.route(
    /https:\/\/(rpc\.mainnet\.chain\.robinhood\.com|robinhood-rpc\.publicnode\.com)\/?$/,
    async (route) => {
      const b = route.request().postDataJSON();
      if (
        mode === "code-mismatch" &&
        b.method === "eth_getCode" &&
        b.params[0].toLowerCase() === vault
      )
        return route.fulfill({
          json: { jsonrpc: "2.0", id: b.id, result: "0x00" },
        });
      if (
        mode === "simulation-failure" &&
        b.method === "eth_call" &&
        b.params[0].data === pauseData
      )
        return route.fulfill({
          json: {
            jsonrpc: "2.0",
            id: b.id,
            error: {
              code: 3,
              message: "execution reverted: injected simulation rejection",
              data: "0x82b42900",
            },
          },
        });
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
  const url = `http://127.0.0.1:${server.address().port}/preview/#owner`;
  await p.goto(url);
  await p.waitForFunction(
    () => !document.querySelector("button.refresh")?.disabled,
  );
  const pause = p.getByRole("button", { name: "Pause deposits", exact: true });
  mode = "account-change";
  await pause.click();
  await p
    .getByText("The wallet account changed. Please retry.", { exact: true })
    .first()
    .waitFor();
  assert.equal(sends, 0);
  mode = "code-mismatch";
  await pause.click();
  await p
    .getByText(
      "Vault code could not be verified. Transactions are unavailable.",
      { exact: true },
    )
    .first()
    .waitFor();
  assert.equal(sends, 0);
  mode = "simulation-failure";
  await pause.click();
  await p
    .getByText("This wallet is not allowed to perform this action.", {
      exact: true,
    })
    .first()
    .waitFor();
  assert.equal(sends, 0);
  mode = "wrong-chain";
  await p.reload();
  await p.waitForFunction(
    () => !document.querySelector("button.refresh")?.disabled,
  );
  assert.ok(await pause.isDisabled());
  await p
    .getByRole("button", { name: "Switch to chain 4663", exact: true })
    .click();
  await p.waitForFunction(
    () =>
      ![...document.querySelectorAll("button")].find(
        (b) => b.textContent === "Pause deposits",
      )?.disabled,
  );
  assert.equal(sends, 0);
  fs.writeFileSync(
    path.join(out, "send-guards.json"),
    JSON.stringify(
      {
        checks: [
          "Account changes block the send",
          "Mismatched runtime blocks the send",
          "Simulation rejection blocks the send and decodes the error",
          "Wrong chain disables send; explicit switch targets chain 4663",
        ],
        walletSends: sends,
        scope:
          "Production export. Failure responses injected; public-chain reads only; no transaction is broadcast.",
      },
      null,
      2,
    ) + "\n",
  );
  console.log("PASS: four send guards; zero sends");
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
}

// One bounded foreground process owns its fork, preview server and browser.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import net from "node:net";
import { spawn, execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import {
  createPublicClient,
  createWalletClient,
  http as transport,
  encodeFunctionData,
  decodeFunctionData,
  keccak256,
  zeroAddress,
  parseAbi,
  getContractAddress,
  encodeAbiParameters,
  toHex,
} from "viem";
import { VAULT, RUNTIME_HASH } from "../src/deployment.ts";
import { chain, vaultAbi, GAS } from "../src/chain.ts";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ||
    "/opt/imd-mcp/node_modules/playwright/index.mjs"
);
const artifacts = path.resolve("../artifacts");
fs.mkdirSync(artifacts, { recursive: true });
const freePort = () =>
  new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
const port = await freePort(),
  rpc = `http://127.0.0.1:${port}`;
const upstreamRpc =
  process.env.BASKET_RPC || "https://rpc.mainnet.chain.robinhood.com";
const head = await fetch(upstreamRpc, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "eth_blockNumber",
    params: [],
  }),
}).then((r) => r.json());
const forkBlock = BigInt(process.env.BASKET_FORK_BLOCK || head.result);
assert.ok(forkBlock > 83448310n);
const proc = spawn(
  "anvil",
  [
    "--fork-url",
    process.env.BASKET_RPC || "https://rpc.mainnet.chain.robinhood.com",
    "--fork-block-number",
    String(forkBlock),
    "--port",
    String(port),
    "--chain-id",
    "4663",
    "--accounts",
    "3",
    "--gas-limit",
    "100000000",
    "--no-storage-caching",
    "--silent",
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let forkLog = "";
proc.stderr.on("data", (d) => (forkLog += d));
let browser, server, page;
const checks = [],
  sends = [],
  rpcCalls = [],
  issues = [];
async function raw(method, params = []) {
  const r = await fetch(rpc, {
    signal: AbortSignal.timeout(20000),
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await r.json();
  if (j.error) throw Object.assign(new Error(j.error.message), j.error);
  return j.result;
}
try {
  for (let i = 0; i < 100; i++) {
    try {
      await raw("eth_chainId");
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  console.log("Fork RPC ready", rpc);
  const pc = createPublicClient({ chain, transport: transport(rpc) });
  assert.equal(keccak256(await pc.getCode({ address: VAULT })), RUNTIME_HASH);
  const rv = (name, args = []) =>
    pc.readContract({
      address: VAULT,
      abi: vaultAbi,
      functionName: name,
      args,
    });
  const owner = await rv("owner"),
    guardian = await rv("guardian"),
    accounts = await raw("eth_accounts"),
    receiver = accounts[1],
    nextOwner = accounts[2];
  await raw("anvil_impersonateAccount", [owner]);
  await raw("anvil_impersonateAccount", [guardian]);
  await raw("anvil_setBalance", [owner, "0x3635c9adc5dea00000"]);
  // Cache genuine reads from the pinned fresh block before the public RPC prunes it.
  // These are reads only; vault storage and runtime are never overwritten.
  const startNonce = await pc.getTransactionCount({ address: owner });
  const anticipated = Array.from({ length: 16 }, (_, i) =>
    getContractAddress({ from: owner, nonce: BigInt(startNonce + i) }),
  );
  const keys = [
    owner,
    guardian,
    receiver,
    nextOwner,
    VAULT,
    zeroAddress,
    toHex(0xdeadn, { size: 20 }),
    ...anticipated,
  ];
  // Warm complete account records too: creation checks query unused destination accounts.
  for (const key of keys)
    await Promise.all(
      ["eth_getBalance", "eth_getCode", "eth_getTransactionCount"].map(
        (method) => raw(method, [key, "latest"]),
      ),
    );
  console.log("Cached account records");
  const mapSlot = (type, key, slot) =>
    BigInt(
      keccak256(
        encodeAbiParameters(
          [{ type }, { type: "uint256" }],
          [key, BigInt(slot)],
        ),
      ),
    );
  const slots = new Set(Array.from({ length: 40 }, (_, i) => BigInt(i)));
  const add = (base, n) => {
    for (let i = 0; i < n; i++) slots.add(base + BigInt(i));
  };
  add(BigInt(keccak256(toHex(25n, { size: 32 }))), 8);
  for (const key of keys) {
    for (const slot of [1, 26, 27, 28, 29, 33, 34, 37, 38])
      add(mapSlot("address", key, slot), slot === 26 ? 8 : slot === 34 ? 2 : 1);
    for (const outer of [owner, receiver, nextOwner, VAULT]) {
      add(mapSlot("address", key, mapSlot("address", outer, 32)), 1);
      add(mapSlot("address", key, mapSlot("address", outer, 2)), 1);
    }
  }
  for (let id = 0; id < 25; id++) {
    const base = mapSlot("uint256", BigInt(id), 35);
    add(base, 8);
    for (let j = 0; j < 3; j++)
      add(BigInt(keccak256(toHex(base + BigInt(j), { size: 32 }))), 5);
  }
  add(mapSlot("uint256", 0n, 31), 1);
  const allSlots = [...slots];
  for (let i = 0; i < allSlots.length; i += 60)
    await Promise.all(
      allSlots
        .slice(i, i + 60)
        .map((slot) =>
          raw("eth_getStorageAt", [VAULT, toHex(slot, { size: 32 }), "latest"]),
        ),
    );
  console.log(
    "Cached pinned vault storage reads:",
    allSlots.length,
    "at",
    String(forkBlock),
  );
  const wc = createWalletClient({
    account: owner,
    chain,
    transport: transport(rpc),
  });
  async function tx(address, abi, name, args = []) {
    const hash = await wc.writeContract({
      address,
      abi,
      functionName: name,
      args,
      gas: 30000000n,
    });
    const receipt = await pc.waitForTransactionReceipt({
      hash,
      pollingInterval: 30,
    });
    assert.equal(receipt.status, "success", name);
    return receipt;
  }
  const solc = process.env.SOLC || "/root/.svm/0.8.26/solc-0.8.26";
  const output = JSON.parse(
    execFileSync(solc, ["--standard-json"], {
      input: JSON.stringify({
        language: "Solidity",
        sources: {
          "Fixtures.sol": {
            content: fs.readFileSync("validation/Fixtures.sol", "utf8"),
          },
        },
        settings: {
          optimizer: { enabled: true, runs: 200 },
          evmVersion: "cancun",
          outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
        },
      }),
      encoding: "utf8",
    }),
  );
  if (output.errors?.some((e) => e.severity === "error"))
    throw Error(JSON.stringify(output.errors));
  const compiled = output.contracts["Fixtures.sol"];
  async function deploy(name, args) {
    const c = compiled[name],
      hash = await wc.deployContract({
        abi: c.abi,
        bytecode: "0x" + c.evm.bytecode.object,
        args,
        gas: 5000000n,
      });
    const receipt = await pc.waitForTransactionReceipt({
      hash,
      pollingInterval: 30,
    });
    assert.equal(receipt.status, "success");
    console.log("Fixture", name, receipt.contractAddress);
    return receipt.contractAddress;
  }
  const symbols = ["FIG", "OAT", "PEA", "RYE"];
  const stocks = [],
    feeds = [];
  for (let i = 0; i < 4; i++) {
    stocks.push(await deploy("TestStock", [symbols[i], i === 1 ? 6 : 18]));
    feeds.push(
      await deploy("TestFeed", [
        "Robinhood " + symbols[i] + " / USD",
        i === 1 ? 10 : 8,
        100n * 10n ** BigInt(i === 1 ? 10 : 8),
      ]),
    );
    await tx(stocks[i], compiled.TestStock.abi, "mint", [
      owner,
      1000000n * 10n ** BigInt(i === 1 ? 6 : 18),
    ]);
  }
  const quoteToken = await deploy("TestStock", ["QUO", 18]),
    quoteFeed = await deploy("TestFeed", ["RHQUO / USD", 8, 100n * 10n ** 8n]);
  const pool = await deploy("TestPool", [stocks[0], quoteToken]);
  const replacementFeed = await deploy("TestFeed", [
    "RHOAT / USD",
    10,
    100n * 10n ** 10n,
  ]);
  const dist = path.resolve("../dist");
  server = http.createServer((req, res) => {
    let p = decodeURIComponent((req.url || "/").split("?")[0]);
    if (p === "/preview/" || p === "/preview") p = "/preview/index.html";
    if (!p.startsWith("/preview/")) {
      res.writeHead(404).end();
      return;
    }
    const file = path.resolve(dist, p.slice(9));
    if (!file.startsWith(dist + "/")) {
      res.writeHead(403).end();
      return;
    }
    try {
      const b = fs.readFileSync(file);
      res.setHeader(
        "Content-Type",
        {
          ".html": "text/html",
          ".js": "application/javascript",
          ".css": "text/css",
          ".svg": "image/svg+xml",
          ".woff2": "font/woff2",
          ".txt": "text/plain",
        }[path.extname(file)] || "application/octet-stream",
      );
      res.end(b);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${server.address().port}/preview/`;
  console.log("Preview:", url);
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  page = await context.newPage();
  page.on("pageerror", (e) => issues.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) issues.push(`${r.status()} ${r.url()}`);
  });
  let currentAccount = owner,
    currentChain = "0x1237",
    now = Number((await pc.getBlock()).timestamp) * 1000,
    failAggregate = false;
  await page.exposeFunction("testWallet", async ({ method, params }) => {
    if (method === "eth_accounts" || method === "eth_requestAccounts")
      return [currentAccount];
    if (method === "eth_chainId") return currentChain;
    if (method === "wallet_switchEthereumChain") {
      currentChain = "0x1237";
      return null;
    }
    if (method === "eth_sendTransaction") {
      const t = params[0];
      assert.equal(t.from.toLowerCase(), currentAccount.toLowerCase());
      const abi =
        t.to.toLowerCase() === VAULT ? vaultAbi : compiled.TestStock.abi;
      const decoded = decodeFunctionData({ abi, data: t.data });
      assert.equal(await raw("eth_chainId"), "0x1237");
      sends.push({ to: t.to, ...decoded, gas: t.gas });
      return raw(method, params);
    }
    return raw(method, params);
  });
  await page.addInitScript(
    ({ now }) => {
      const wallNow = Date.now.bind(Date);
      let offset = now - wallNow();
      Object.defineProperty(window, "__clock", {
        get: () => wallNow() + offset,
        set: (n) => {
          offset = n - wallNow();
        },
      });
      Date.now = () => window.__clock;
      window.ethereum = {
        request: (a) => window.testWallet(a),
        on() {},
        removeListener() {},
      };
    },
    { now },
  );
  await page.route(
    /https:\/\/(rpc\.mainnet\.chain\.robinhood\.com|robinhood-rpc\.publicnode\.com)\/?$/,
    async (route) => {
      const body = route.request().postDataJSON();
      const handle = async (b) => {
        rpcCalls.push(b);
        if (
          failAggregate &&
          b.method === "eth_call" &&
          b.params[0].data?.startsWith(
            encodeFunctionData({ abi: vaultAbi, functionName: "allAssets" }),
          )
        )
          return {
            jsonrpc: "2.0",
            id: b.id,
            error: { code: -32000, message: "Injected aggregate read failure" },
          };
        const r = await fetch(rpc, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(b),
        });
        const response = await r.json();
        if (response.error)
          console.log(
            "RPC error",
            b.method,
            b.params?.[0]?.data?.slice(0, 10),
            response.error,
          );
        return response;
      };
      const result = Array.isArray(body)
        ? await Promise.all(body.map(handle))
        : await handle(body);
      await route.fulfill({ json: result });
    },
  );
  const refresh = async () => {
    await page.getByRole("button", { name: "Retry vault" }).click();
    await page.getByRole("button", { name: "Retry vault" }).toBeEnabled?.();
    await page.waitForFunction(
      () => !document.querySelector("button.refresh")?.disabled,
    );
  };
  const nav = async (name) => {
    now =
      Number((await raw("eth_getBlockByNumber", ["latest", false])).timestamp) *
      1000;
    await page.goto(url + "#" + name.toLowerCase());
    await page.evaluate((n) => (window.__clock = n), now);
    await page.waitForFunction(
      () => !document.querySelector("button.refresh")?.disabled,
    );
  };
  const action = (title) =>
    page
      .locator(".action-panel")
      .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
  async function sendClick(button, name) {
    const before = sends.length;
    const previousLink = await page
      .locator(".wallet-status a")
      .getAttribute("href")
      .catch(() => null);
    await button.click();
    await page.waitForFunction(
      (previous) => {
        const status = document.querySelector(".wallet-status");
        const link = status?.querySelector("a")?.getAttribute("href");
        return (
          link && link !== previous && status.textContent.includes("confirmed")
        );
      },
      previousLink,
      { timeout: 30000 },
    );
    assert.equal(sends.length, before + 1, name);
    assert.equal(sends.at(-1).functionName, name);
    await page.waitForFunction(
      () => !document.querySelector("button.refresh")?.disabled,
    );
    checks.push(name);
    console.log("PASS wallet", name);
  }
  async function form(title, fields, button, fn = "propose") {
    const box = action(title);
    for (const [label, value] of Object.entries(fields)) {
      const f = box.getByLabel(label, { exact: true });
      if ((await f.evaluate((e) => e.tagName)) === "SELECT") {
        const option = await f
          .locator("option")
          .evaluateAll(
            (options, value) =>
              options.find((o) => o.value.toLowerCase() === value.toLowerCase())
                ?.value,
            value,
          );
        await f.selectOption(option ?? value);
      } else await f.fill(value);
    }
    const checkbox = box.getByRole("checkbox");
    if (await checkbox.count()) await checkbox.check();
    await sendClick(box.getByRole("button", { name: button, exact: true }), fn);
  }
  await nav("Owner");
  const lines = stocks
    .slice(0, 3)
    .map(
      (t, i) =>
        `${symbols[i]} ${t} ${feeds[i]} ${i === 0 ? pool : zeroAddress} ${i === 0 ? quoteFeed : zeroAddress} ${i === 0 ? "1" : "0"}`,
    )
    .join("\n");
  await page.getByLabel("Listing rows").fill(lines.replace("FIG ", "WRONG "));
  await page.getByRole("button", { name: "Check pairings / Retry" }).click();
  await page.getByText("check this pairing", { exact: true }).waitFor();
  assert.ok(
    await page
      .getByRole("button", { name: "List stocks", exact: true })
      .isDisabled(),
  );
  checks.push("Marked genesis pairing blocks listing");
  await page.getByLabel("Listing rows").fill(lines);
  await page.getByRole("button", { name: "Check pairings / Retry" }).click();
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll("button")].find(
        (b) => b.textContent === "List stocks",
      )?.disabled === false,
  );
  const genesisStart = sends.length;
  await page.getByRole("button", { name: "List stocks", exact: true }).click();
  await page
    .getByText("All rows listed or already present.", { exact: true })
    .waitFor({ timeout: 30000 });
  assert.equal(sends.length - genesisStart, 3);
  assert.ok(
    sends.slice(genesisStart).every((s) => s.functionName === "genesisList"),
  );
  await page.getByRole("button", { name: "List stocks", exact: true }).click();
  await page.waitForTimeout(400);
  assert.equal(sends.length - genesisStart, 3);
  checks.push("Ordered genesisList: one send per row, listed rows skipped");
  console.log(
    "Direct aggregate reasons",
    (await rv("allAssets")).map((a) => a.reason),
  );
  await refresh();
  await form("Finalize genesis", {}, "Finalize genesis", "finalizeGenesis");
  await nav("Deposit");
  await page.getByLabel("FIG amount", { exact: true }).fill("20000");
  await page
    .getByRole("button", { name: "Preview deposit", exact: true })
    .click();
  await page
    .getByText(
      "This deposit exceeds the vault size limit. Reduce the amount.",
      { exact: true },
    )
    .waitFor();
  checks.push("CapExceeded explained before approvals");
  await page.getByLabel("FIG amount", { exact: true }).fill("10");
  await page.getByLabel("OAT amount", { exact: true }).fill("20");
  await page
    .getByRole("button", { name: "Preview deposit", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Deposit preview", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Approve exact amounts", exact: true })
    .click();
  await page
    .getByText(
      "Deposit simulation passed. Prices and limits can change before confirmation.",
      { exact: true },
    )
    .waitFor({ timeout: 30000 });
  await sendClick(
    page.getByRole("button", { name: "Deposit", exact: true }),
    "deposit",
  );
  assert.equal(
    await page.getByLabel("FIG amount", { exact: true }).inputValue(),
    "",
  );
  assert.equal(
    await page
      .getByRole("heading", { name: "Deposit preview", exact: true })
      .count(),
    0,
  );
  const dep = sends.at(-1);
  assert.deepEqual(
    dep.args[0].map((x) => x.toLowerCase()),
    stocks.slice(0, 2).map((x) => x.toLowerCase()),
  );
  assert.deepEqual(dep.args[1], [10n * 10n ** 18n, 20n * 10n ** 6n]);
  assert.equal(dep.args[2].toLowerCase(), owner.toLowerCase());
  checks.push(
    "Multi-stock deposit, exact approvals, preview invalidated after success",
  );
  // Force a deferred leg, then claim it from the receiver wallet.
  await tx(stocks[0], compiled.TestStock.abi, "setFail", [true]);
  await nav("Redeem");
  await page.getByLabel("BASK amount", { exact: true }).fill("10");
  await page.getByLabel("Receiver", { exact: true }).fill(VAULT);
  await page.getByRole("button", { name: "Preview redemption" }).click();
  await page
    .getByText("The receiver must not be the vault.", { exact: true })
    .waitFor();
  await page.getByLabel("Receiver", { exact: true }).fill(owner);
  await page.getByRole("button", { name: "Preview redemption" }).click();
  await page.getByRole("heading", { name: "Redemption preview" }).waitFor();
  await sendClick(
    page.getByRole("button", { name: "Redeem", exact: true }),
    "redeem",
  );
  assert.ok(sends.at(-1).gas);
  assert.ok((await rv("owed", [owner, stocks[0]])) > 0n);
  await tx(stocks[0], compiled.TestStock.abi, "setFail", [false]);
  await refresh();
  await sendClick(
    page.getByRole("button", { name: "Claim FIG", exact: true }),
    "claim",
  );
  assert.ok(sends.at(-1).gas);
  assert.equal(await rv("owed", [owner, stocks[0]]), 0n);
  // Another redemption creates two debts; Claim all sends one token-array batch.
  for (const t of stocks.slice(0, 2))
    await tx(t, compiled.TestStock.abi, "setFail", [true]);
  await page.getByLabel("BASK amount", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Preview redemption" }).click();
  await page.getByRole("heading", { name: "Redemption preview" }).waitFor();
  await sendClick(
    page.getByRole("button", { name: "Redeem", exact: true }),
    "redeem",
  );
  for (const t of stocks.slice(0, 2))
    await tx(t, compiled.TestStock.abi, "setFail", [false]);
  await refresh();
  await sendClick(
    page.getByRole("button", { name: "Claim all", exact: true }),
    "claim",
  );
  assert.equal(sends.at(-1).args[0].length, 2);
  // Immediate controls and each proposal form.
  await nav("Owner");
  await form(
    "Close a stock",
    { "Stock Token": stocks[1] },
    "Close stock",
    "close",
  );
  await form(
    "Close a stock",
    { "Stock Token": stocks[2] },
    "Close stock",
    "close",
  );
  await sendClick(
    page.getByRole("button", { name: "Pause deposits", exact: true }),
    "pauseDeposits",
  );
  await form(
    "List",
    {
      "New Stock Token address": stocks[3],
      "Stock USD feed address": feeds[3],
      "Pool address (zero for no pool)": zeroAddress,
      "Quote feed address (zero for no pool)": zeroAddress,
      "Minimum raw pool liquidity": "0",
    },
    "Propose List",
  );
  await form(
    "Feed",
    { "Stock Token": stocks[1], "Stock USD feed address": replacementFeed },
    "Propose Feed",
  );
  await form("Centre", { "Stock Token": stocks[0] }, "Propose Centre");
  await form("Reopen", { "Stock Token": stocks[1] }, "Propose Reopen");
  await form("Retire", { "Stock Token": stocks[2] }, "Propose Retire");
  await form(
    "Pool",
    {
      "Stock Token": stocks[0],
      "Pool address (zero for no pool)": pool,
      "Quote feed address (zero for no pool)": quoteFeed,
      "Minimum raw pool liquidity": "1",
    },
    "Propose Pool",
  );
  await form("Resync", { "Stock Token": stocks[0] }, "Propose Resync");
  await form(
    "Guardian",
    { "New guardian address": guardian },
    "Propose Guardian",
  );
  await form(
    "NavCap",
    { "New size limit in dollars": "2000000" },
    "Propose NavCap",
  );
  await form(
    "FeeRecipient",
    { "Fee recipient address": owner },
    "Propose FeeRecipient",
  );
  await page.getByLabel("Setting name", { exact: true }).selectOption("5");
  await form(
    "Set Hours",
    {
      "From UTC (HH:MM:SS; 00:00:00 for all hours)": "00:00:00",
      "To UTC (HH:MM:SS; 24:00:00 allowed)": "00:00:00",
    },
    "Propose setting",
  );
  assert.deepEqual(
    sends
      .filter((s) => s.functionName === "propose")
      .map((s) => Number(s.args[0])),
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
  // Waiting proposals cannot execute. Capture all pages with populated real fork reads.
  assert.ok(
    await page
      .getByRole("button", { name: "Execute", exact: true })
      .first()
      .isDisabled(),
  );
  const shots = [];
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const name of [
      "Vault",
      "Deposit",
      "Redeem",
      "Docs",
      "Owner",
      "Losses",
    ]) {
      await nav(name);
      await page.evaluate(() => document.fonts.ready);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      assert.equal(overflow, false, `${name} overflow at ${width}`);
      const file = `${name.toLowerCase()}-${width}.jpg`;
      await page.screenshot({
        path: path.join(artifacts, file),
        type: "jpeg",
        quality: 72,
        fullPage: true,
      });
      shots.push(file);
    }
  }
  // 320px reflow and keyboard/reduced-motion checks.
  await page.setViewportSize({ width: 320, height: 900 });
  await nav("Docs");
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.keyboard.press("Tab");
  assert.ok(await page.locator(":focus").count());
  assert.equal(
    await page
      .locator(".marquee span")
      .evaluate((e) => getComputedStyle(e).animationName),
    "none",
  );
  checks.push(
    "Six pages: desktop + 375px, 320px Docs reflow, keyboard focus, reduced motion",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  // Aggregate fallback preserves quantities and marks every pool unreadable.
  failAggregate = true;
  await nav("Vault");
  await refresh();
  await page
    .getByText(
      "allAssets: unreadable. Showing individual stock reads; pool checks and price reasons are unreadable.",
      { exact: true },
    )
    .waitFor({ state: "attached" });
  assert.ok(
    (await page.locator(".stock-card").first().innerText()).includes(
      "unreadable",
    ),
  );
  failAggregate = false;
  checks.push("Aggregate failure fallback");
  await raw("evm_increaseTime", [2 * 86400 + 5]);
  await raw("evm_mine");
  now =
    Number((await raw("eth_getBlockByNumber", ["latest", false])).timestamp) *
    1000;
  await page.evaluate((n) => (window.__clock = n), now);
  await nav("Owner");
  await page.evaluate((n) => (window.__clock = n), now);
  await refresh();
  for (let i = 0; i < 11; i++) {
    const card = page.locator("article.receipt").filter({
      has: page.getByRole("heading", {
        name: new RegExp(
          `^${["List", "Feed", "Centre", "Reopen", "Retire", "Pool", "Resync", "Guardian", "NavCap", "FeeRecipient", "Setting"][i]} · Proposal`,
        ),
      }),
    });
    await sendClick(
      card.getByRole("button", { name: "Execute", exact: true }),
      "execute",
    );
  }
  assert.equal(await rv("feeRecipient"), owner);
  assert.equal(await rv("NAV_CAP"), 2000000n * 10n ** 18n);
  await form(
    "Remove retired stock",
    { "Stock Token": stocks[2] },
    "Remove retired",
    "removeRetired",
  );
  await form(
    "Lower size limit",
    { "Lower limit in dollars": "1000000" },
    "Lower NAV cap",
    "lowerNavCap",
  );
  await sendClick(
    page.getByRole("button", { name: "Unpause deposits", exact: true }),
    "unpauseDeposits",
  );
  // Cancel owner and guardian proposal boundaries, without changing the deployed roles.
  await form("Centre", { "Stock Token": stocks[0] }, "Propose Centre");
  await sendClick(
    page.getByRole("button", { name: "Cancel proposal", exact: true }).first(),
    "cancel",
  );
  // Permissionless deficit / loss controls.
  await tx(stocks[0], compiled.TestStock.abi, "burn", [VAULT, 10n ** 18n]);
  await nav("Losses");
  await refresh();
  await sendClick(
    page.getByRole("button", { name: "Flag shortfall", exact: true }),
    "flagDeficit",
  );
  await raw("evm_increaseTime", [7 * 86400 + 5]);
  await raw("evm_mine");
  now =
    Number((await raw("eth_getBlockByNumber", ["latest", false])).timestamp) *
    1000;
  await page.evaluate((n) => (window.__clock = n), now);
  await refresh();
  await sendClick(
    page.getByRole("button", { name: "Recognise loss", exact: true }),
    "recognizeLoss",
  );
  await nav("Owner");
  await form(
    "Transfer ownership",
    { "New owner address": nextOwner },
    "Start ownership transfer",
    "transferOwnership",
  );
  currentAccount = nextOwner;
  await page.reload();
  await nav("Owner");
  await form("Accept ownership", {}, "Accept ownership", "acceptOwnership");
  assert.equal((await rv("owner")).toLowerCase(), nextOwner.toLowerCase());
  for (const call of rpcCalls.filter((x) => x.method === "eth_call")) {
    const data = call.params[0].data;
    try {
      const d = decodeFunctionData({ abi: vaultAbi, data });
      if (
        [
          "allAssets",
          "depositStatus",
          "previewDeposit",
          "previewRedeem",
        ].includes(d.functionName)
      )
        assert.equal(BigInt(call.params[0].gas), GAS);
    } catch (e) {
      if (e.code === "ERR_ASSERTION") throw e;
    }
  }
  const tokenApprovals = sends.filter((s) => s.functionName === "approve");
  assert.deepEqual(
    tokenApprovals.map((s) => s.args[1]),
    [10n * 10n ** 18n, 20n * 10n ** 6n],
  );
  assert.deepEqual(issues, []);
  fs.writeFileSync(
    path.join(artifacts, "browser-fork.json"),
    JSON.stringify(
      {
        forkBlock,
        vault: VAULT,
        runtimeHash: RUNTIME_HASH,
        checks,
        sends,
        shots,
        rpcCalls: rpcCalls.length,
        issues,
        limitations: [
          "Local fork and disposable token/feed/pool fixtures; no live transaction",
          "No physical device or screen-reader session",
          "Claim all batching exercised with two owed tokens; groups of ten covered by source/unit assertions",
        ],
      },
      (_, v) => (typeof v === "bigint" ? String(v) : v),
      2,
    ) + "\n",
  );
  console.log(
    "PASS",
    checks.length,
    "checks;",
    sends.length,
    "wallet sends;",
    shots.length,
    "screenshots",
  );
} catch (e) {
  console.error(e);
  if (page) {
    fs.writeFileSync(
      path.join(artifacts, "browser-failure.txt"),
      await page.locator("body").textContent(),
    );
    await page
      .screenshot({
        path: path.join(artifacts, "browser-failure.jpg"),
        type: "jpeg",
        quality: 65,
        fullPage: true,
      })
      .catch(() => {});
  }
  fs.writeFileSync(
    path.join(artifacts, "rpc-debug.json"),
    JSON.stringify(
      rpcCalls,
      (_, v) => (typeof v === "bigint" ? String(v) : v),
      2,
    ),
  );
  console.error(forkLog);
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (server) await new Promise((r) => server.close(r));
  proc.kill("SIGTERM");
}

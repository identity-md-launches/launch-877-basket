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
import { inside, nextOpening, weekSecond, WEEK } from "../src/newYork.ts";
import { mainnet } from "viem/chains";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ||
    "/opt/imd-mcp/node/node_modules/playwright/index.mjs"
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
  const anticipated = Array.from({ length: 84 }, (_, i) => i)
    .filter((i) => i >= 78 || i % 3 !== 2)
    .map((i) =>
      getContractAddress({ from: owner, nonce: BigInt(startNonce + i) }),
    );
  const keys = [
    owner,
    guardian,
    receiver,
    nextOwner,
    VAULT,
    mainnet.contracts.multicall3.address,
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
  // Anvil also reads the chain's block-history ring while mining. Its deployed
  // bytecode uses (block number - 1) % 0x05ffd0. Warm the next bounded run's
  // genuine slots before upstream pruning; do not replace its code or storage.
  const history = "0x0000F90827F1C53a10cb7A02335B175320002935";
  const historyCode = await raw("eth_getCode", [history, "latest"]);
  assert.ok(historyCode.includes("6205ffd0"), "Unexpected block-history ring");
  for (let i = 0; i < 512; i += 64)
    await Promise.all(
      Array.from({ length: 64 }, (_, j) =>
        raw("eth_getStorageAt", [
          history,
          toHex((forkBlock + BigInt(i + j)) % 0x05ffd0n, { size: 32 }),
          "latest",
        ]),
      ),
    );
  console.log("Cached block-history ring for 512 fork blocks");
  const mapSlot = (type, key, slot) =>
    BigInt(
      keccak256(
        encodeAbiParameters(
          [{ type }, { type: "uint256" }],
          [key, BigInt(slot)],
        ),
      ),
    );
  // Vault 6 layout: words 0-41; tokens array at 26 (data at keccak(26));
  // mappings 1, 2 (nested), 27-30, 34-36, 38-40 (34 nested); assets 7 slots,
  // deficits 2, proposals 12 and no bytes fields.
  const slots = new Set(Array.from({ length: 42 }, (_, i) => BigInt(i)));
  const add = (base, n) => {
    for (let i = 0; i < n; i++) slots.add(base + BigInt(i));
  };
  add(BigInt(keccak256(toHex(26n, { size: 32 }))), 64);
  for (const key of keys) {
    for (const slot of [1, 27, 28, 29, 30, 35, 36, 39, 40])
      add(mapSlot("address", key, slot), slot === 27 ? 7 : slot === 36 ? 2 : 1);
    for (const outer of [owner, receiver, nextOwner, VAULT]) {
      add(mapSlot("address", key, mapSlot("address", outer, 34)), 1);
      add(mapSlot("address", key, mapSlot("address", outer, 2)), 1);
    }
  }
  for (let id = 0; id < 25; id++) add(mapSlot("uint256", BigInt(id), 38), 12);
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
  async function fixtureReceipt(hash) {
    // Setup sends mine automatically; poll receipts directly without block-watch caching.
    const until = Date.now() + 90000;
    while (Date.now() < until) {
      try {
        return await pc.getTransactionReceipt({ hash });
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`Fork fixture receipt unavailable: ${hash}`);
  }
  async function tx(address, abi, name, args = []) {
    const hash = await wc.writeContract({
      address,
      abi,
      functionName: name,
      args,
      gas: 30000000n,
    });
    const receipt = await fixtureReceipt(hash);
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
    const receipt = await fixtureReceipt(hash);
    assert.equal(receipt.status, "success");
    console.log("Fixture", name, receipt.contractAddress);
    return receipt.contractAddress;
  }
  const symbols = [
    "FIG",
    "OAT",
    "PEA",
    "RYE",
    ...Array.from(
      { length: 22 },
      (_, i) => `S${String(i + 1).padStart(2, "0")}`,
    ),
  ];
  const stocks = [],
    feeds = [];
  for (let i = 0; i < symbols.length; i++) {
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
        ".webp": "image/webp",
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
  page.setDefaultTimeout(45000);
  page.setDefaultNavigationTimeout(45000);
  page.on("pageerror", (e) => issues.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) issues.push(`${r.status()} ${r.url()}`);
  });
  let currentAccount = owner,
    currentChain = "0x1237",
    now = Number((await pc.getBlock()).timestamp) * 1000,
    failAggregate = false,
    declineNext = false,
    pendingNext = false;
  await page.exposeFunction("testWallet", async ({ method, params }) => {
    if (method === "eth_accounts" || method === "eth_requestAccounts")
      return [currentAccount];
    if (method === "eth_chainId") return currentChain;
    if (method === "wallet_switchEthereumChain") {
      currentChain = "0x1237";
      return null;
    }
    if (method === "eth_sendTransaction") {
      if (declineNext) {
        declineNext = false;
        throw Object.assign(new Error("User rejected the request."), {
          code: 4001,
        });
      }
      if (pendingNext) {
        pendingNext = false;
        await raw("evm_setAutomine", [false]);
      }
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
      const timer = window.setTimeout.bind(window);
      window.setTimeout = (fn, delay, ...args) =>
        timer(
          fn,
          window.__fastReceipt && delay === 180000 ? 500 : delay,
          ...args,
        );
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
    await page.locator("button.refresh").click();
    await page.locator("button.refresh").toBeEnabled?.();
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
  // Mine one block at an exact timestamp and sync the page clock to it.
  async function warpTo(timestamp) {
    await raw("evm_setNextBlockTimestamp", [Number(timestamp)]);
    await raw("evm_mine");
    now = Number(timestamp) * 1000;
    await page.evaluate((n) => (window.__clock = n), now);
  }
  const blockTime = async () =>
    BigInt((await raw("eth_getBlockByNumber", ["latest", false])).timestamp);
  // Before a deposit: if the vault is outside its hours, warp to the next
  // opening computed like the contract, checking the boundary on both sides.
  async function ensureOpen() {
    if (await rv("insideHours")) return;
    const cfg = await rv("settings");
    const t = nextOpening(await blockTime(), cfg.hoursFrom, cfg.dst);
    assert.equal(inside(t - 1n, cfg.hoursFrom, cfg.hoursTo, cfg.dst), false);
    assert.equal(inside(t, cfg.hoursFrom, cfg.hoursTo, cfg.dst), true);
    await warpTo(t - 1n);
    assert.equal(await rv("insideHours"), false, "closed one second before");
    await warpTo(t);
    assert.equal(await rv("insideHours"), true, "open at the next opening");
    checks.push("Warped to the next opening; insideHours flips exactly there");
  }
  // The next Saturday 8:00 pm New York time, which is outside every tested schedule.
  async function saturday() {
    const cfg = await rv("settings"),
      b = await blockTime(),
      target = 6n * 86400n + 72000n;
    let t = b + ((((target - weekSecond(b, cfg.dst)) % WEEK) + WEEK) % WEEK);
    if (t <= b) t += WEEK;
    assert.equal(inside(t, cfg.hoursFrom, cfg.hoursTo, cfg.dst), false);
    return t;
  }
  const action = (title) =>
    page.locator(".action-panel").filter({
      has: page
        .locator("summary")
        .filter({ hasText: new RegExp(`^${title}$`) }),
    });
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
          link && link !== previous && status.textContent.includes("Confirmed.")
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
    if (!(await box.evaluate((e) => e.open)))
      await box.locator("summary").first().click();
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
  const shots = [];
  async function screenshots(state) {
    for (const width of [1440, 375]) {
      await page.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
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
        await page.waitForFunction(
          () =>
            ![...document.querySelectorAll("p, small, button")].some((e) =>
              e.textContent.includes("Reading..."),
            ),
        );
        await page.waitForFunction(() => {
          const height = document.documentElement.scrollHeight;
          const now = performance.now();
          if (
            !window.__screenshotSize ||
            window.__screenshotSize.height !== height
          )
            window.__screenshotSize = { height, since: now };
          return now - window.__screenshotSize.since > 400;
        });
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
          `${state} ${name} overflow ${width}`,
        );
        const file = `${state}-${name.toLowerCase()}-${width}.jpg`;
        await page.screenshot({
          path: path.join(artifacts, file),
          type: "jpeg",
          quality: 40,
          fullPage: true,
        });
        shots.push(file);
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  console.log("Taking empty screenshots");
  await screenshots("empty");
  console.log("Empty screenshots complete");
  await nav("Owner");
  const indices = stocks.map((_, i) => i).filter((i) => i !== 3);
  const lines = indices
    .map(
      (i) =>
        `${symbols[i]} ${stocks[i]} ${feeds[i]} ${i === 0 ? pool : zeroAddress} ${i === 0 ? quoteFeed : zeroAddress} ${i === 0 ? "1" : "0"}`,
    )
    .join("\n");
  // Pool depth is an actual blocking pairing result, before any wallet prompt.
  await page
    .getByLabel("Listing rows")
    .fill(lines.split("\n")[0].replace(/ 1$/, " 2000000000000"));
  await page.getByRole("button", { name: "Check pairings / Retry" }).click();
  await page
    .getByText("30-minute pool liquidity is under minLiquidity.", {
      exact: true,
    })
    .waitFor();
  assert.ok(
    await page
      .getByRole("button", { name: "List stocks", exact: true })
      .isDisabled(),
  );
  checks.push("Pool liquidity below minLiquidity blocks listing");
  await raw("anvil_setStorageAt", [
    quoteFeed,
    toHex(2n, { size: 32 }),
    toHex(110n * 10n ** 8n, { size: 32 }),
  ]);
  await page.getByLabel("Listing rows").fill(lines.split("\n")[0]);
  await page.getByRole("button", { name: "Check pairings / Retry" }).click();
  await page
    .getByText("Pool-vs-feed gap is over poolDeviation.", { exact: true })
    .waitFor();
  assert.ok(
    await page
      .getByRole("button", { name: "List stocks", exact: true })
      .isDisabled(),
  );
  await raw("anvil_setStorageAt", [
    quoteFeed,
    toHex(2n, { size: 32 }),
    toHex(100n * 10n ** 8n, { size: 32 }),
  ]);
  checks.push("Pool/feed gap above poolDeviation blocks listing");
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
  console.log("Pairings checked; starting decline/recovery test");
  const genesisStart = sends.length;
  declineNext = true;
  await page.getByRole("button", { name: "List stocks", exact: true }).click();
  await page
    .getByRole("button", { name: "Resume listing", exact: true })
    .waitFor();
  assert.equal(
    sends.length,
    genesisStart,
    "Declined prompt never counts as listed",
  );
  console.log("Declined prompt recovered");
  pendingNext = true;
  await page.evaluate(() => (window.__fastReceipt = true));
  await page
    .getByRole("button", { name: "Resume listing", exact: true })
    .click();
  await page
    .getByText(/Receipt timed out or unreadable/)
    .first()
    .waitFor({ timeout: 45000 });
  assert.equal(sends.length, genesisStart + 1);
  assert.ok(
    await page.evaluate(
      () => JSON.parse(sessionStorage.getItem("basket-pending-4663")).hash,
    ),
  );
  await page.reload();
  await page
    .getByText(/A transaction is still pending/)
    .first()
    .waitFor();
  assert.equal(
    sends.length,
    genesisStart + 1,
    "Reload cannot prompt pending row",
  );
  console.log("Pending transaction blocked after reload");
  await raw("evm_setAutomine", [true]);
  await raw("evm_mine");
  console.log("Pending mined; waiting through UI");
  await page
    .getByRole("button", { name: "Wait for pending transaction / Retry" })
    .click();
  await page
    .getByRole("button", { name: "Resume listing", exact: true })
    .click();
  await page
    .getByText("All rows listed and matched against chain.", { exact: true })
    .waitFor({ timeout: 240000 });
  console.log("Listing complete");
  assert.equal(sends.length - genesisStart, 25);
  assert.deepEqual(
    sends.slice(genesisStart).map((s) => s.args[0].toLowerCase()),
    indices.map((i) => stocks[i].toLowerCase()),
  );
  await page.getByRole("button", { name: "List stocks", exact: true }).click();
  await page
    .getByText("All rows listed and matched against chain.", { exact: true })
    .waitFor({ timeout: 60000 });
  assert.equal(sends.length - genesisStart, 25);
  checks.push(
    "25-row listing: decline, resume, receipt timeout retains hash, pending nonce blocks reload, mine and resume without duplicate calldata",
  );
  console.log(
    "Direct aggregate reasons",
    (await rv("allAssets")).map((a) => a.reason),
  );
  await refresh();
  await form("Finalize genesis", {}, "Finalize genesis", "finalizeGenesis");
  await ensureOpen();
  // A US market holiday inside the hours: every feed three hours old.
  for (const f of feeds) await tx(f, compiled.TestFeed.abi, "setLag", [3 * 3600]);
  assert.equal(Number((await rv("depositStatus", [[]]))[0]), 14);
  await nav("Deposit");
  await refresh();
  await page.getByText(/^Deposits are closed until stock prices update \(at least 1 must have updated in the last 1 hour\(s\), e\.g\. a US market holiday\); no set time\. Redemptions are always open\.$/).waitFor();
  assert.equal(await page.getByText(/Deposits reopen /).count(), 0, "no reopen time on a holiday");
  await page.getByRole("button", { name: "Add FIG", exact: true }).click();
  await page.getByLabel("FIG amount", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Preview deposit", exact: true }).click();
  await page.getByText(/too few fresh prices/).first().waitFor();
  checks.push("US market holiday: Freshness refusal (reason 14) with no set time");
  // One feed updates and deposits pass again.
  await tx(feeds[1], compiled.TestFeed.abi, "setLag", [0]);
  assert.equal(Number((await rv("depositStatus", [[]]))[0]), 0);
  await refresh();
  checks.push("One updated feed reopens deposits after the holiday");
  // Same hash: reload so the holiday attempt's chosen stock is cleared.
  await page.reload();
  await nav("Deposit");
  await page.getByRole("button", { name: "Add FIG", exact: true }).click();
  await page
    .getByRole("button", { name: "Use full balance", exact: true })
    .click();
  assert.equal(
    await page.getByLabel("FIG amount", { exact: true }).inputValue(),
    "1000000",
  );
  await page.getByLabel("Search to add stocks", { exact: true }).fill("OAT");
  assert.equal(
    await page.getByLabel("FIG amount", { exact: true }).inputValue(),
    "1000000",
  );
  checks.push(
    "Exact full stock balance and chosen amount retained while searching",
  );
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
  await page.getByRole("button", { name: "Add OAT", exact: true }).click();
  await page.getByLabel("OAT amount", { exact: true }).fill("20");
  await page.getByLabel("Search to add stocks", { exact: true }).fill("S01");
  await page.getByRole("button", { name: "Add S01", exact: true }).click();
  await page.getByLabel("S01 amount", { exact: true }).fill("30");
  await page
    .getByRole("button", { name: "Preview deposit", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Deposit preview", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Preview deposit", exact: true })
    .hover();
  assert.deepEqual(
    await page
      .getByRole("button", { name: "Preview deposit", exact: true })
      .evaluate((e) => [
        getComputedStyle(e).color,
        getComputedStyle(e).backgroundColor,
      ]),
    ["rgb(255, 255, 255)", "rgb(20, 44, 84)"],
  );
  checks.push("Primary button label remains readable on hover");
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
  assert.equal(await page.getByLabel("FIG amount", { exact: true }).count(), 0);
  assert.equal(
    await page
      .getByRole("heading", { name: "Deposit preview", exact: true })
      .count(),
    0,
  );
  const dep = sends.at(-1);
  assert.deepEqual(
    dep.args[0].map((x) => x.toLowerCase()),
    [stocks[0], stocks[1], stocks[4]].map((x) => x.toLowerCase()),
  );
  assert.deepEqual(dep.args[1], [10n * 10n ** 18n, 20n * 10n ** 6n, 30n * 10n ** 18n]);
  assert.ok(dep.gas, "Three-stock deposit uses explicit padded gas");
  assert.equal(dep.args[2].toLowerCase(), owner.toLowerCase());
  checks.push(
    "Three-stock deposit succeeds with estimated gas +30%, exact approvals, preview invalidated after success",
  );
  // A Saturday: deposits refused (Hours) with the reopen time; redeem and claim still work.
  await warpTo(await saturday());
  assert.equal(await rv("insideHours"), false);
  assert.equal(Number((await rv("depositStatus", [[]]))[0]), 3);
  await page.reload();
  await nav("Deposit");
  await refresh();
  await page.getByText(/^Deposits reopen Sunday 8:00 pm New York time \(Sunday, .* in \d+ h \d+ min; your time .*\)\. On a US market holiday they reopen when prices update\. Redemptions are always open\.$/).waitFor();
  await page.getByRole("button", { name: "Add FIG", exact: true }).click();
  await page.getByLabel("FIG amount", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Preview deposit", exact: true }).click();
  await page.getByText(/outside deposit hours/).first().waitFor();
  checks.push("Saturday deposit refused (Hours) with the Sunday 8:00 pm reopening shown");
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
  checks.push("Saturday redeem, single claim and Claim all succeed outside deposit hours");
  // Immediate controls and each proposal form.
  await nav("Owner");
  const closeForm = action("Close a stock");
  await closeForm.locator("summary").click();
  assert.equal(
    await closeForm.getByLabel("Stock Token", { exact: true }).inputValue(),
    "",
  );
  assert.ok(
    await closeForm
      .getByRole("button", { name: "Close stock", exact: true })
      .isDisabled(),
  );
  const routeBeforeJump = new URL(page.url()).hash;
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  assert.equal(new URL(page.url()).hash, routeBeforeJump);
  assert.equal(await page.locator(":focus").getAttribute("id"), "owner-pause");
  checks.push(
    "Owner stock begins unselected; jump scrolls and focuses without routing",
  );
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
  await form("Recentre", { "Stock Token": stocks[0] }, "Propose Recentre");
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
    "RaiseCap",
    { "New size limit in dollars": "2000000" },
    "Propose RaiseCap",
  );
  await form(
    "FeeRecipient",
    { "Fee recipient address": owner },
    "Propose FeeRecipient",
  );
  await page.getByLabel("Setting name", { exact: true }).selectOption("5");
  const hoursBox = action("Set Hours");
  await hoursBox.locator("summary").first().click();
  await hoursBox.getByLabel("From (weekday and New York time, or Always open)", { exact: true }).fill("09:30");
  await hoursBox.getByLabel("To (weekday and New York time; Saturday 24:00 allowed)", { exact: true }).fill("Friday 4:00 pm");
  await hoursBox.getByText(/Use a weekday and New York time/).waitFor();
  checks.push("Hours form refuses a time without a weekday");
  await form(
    "Set Hours",
    {
      "From (weekday and New York time, or Always open)": "Monday 9:30 am",
      "To (weekday and New York time; Saturday 24:00 allowed)": "Friday 4:00 pm",
    },
    "Propose setting",
  );
  const hoursSend = sends.at(-1).args[0];
  assert.deepEqual([Number(hoursSend.setting), hoursSend.value, hoursSend.value2], [5, 120600n, 489600n]);
  await page.getByLabel("Setting name", { exact: true }).selectOption("6");
  await form("Set Dst", { "New dst value": "1" }, "Propose setting");
  assert.deepEqual([Number(sends.at(-1).args[0].setting), sends.at(-1).args[0].value], [6, 1n]);
  assert.deepEqual(
    sends
      .filter((s) => s.functionName === "propose")
      .map((s) => Number(s.args[0].kind)),
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10],
  );
  assert.match(
    await page.locator("body").textContent(),
    /executable from .* until .*Proposed event/,
  );
  checks.push("Proposals send the BaskVault.Action struct; executableAt shown from the Proposed event");
  // Waiting proposals cannot execute. Capture all pages with populated real fork reads.
  assert.ok(
    await page
      .getByRole("button", { name: "Execute", exact: true })
      .first()
      .isDisabled(),
  );
  await screenshots("stocks25");
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
      .locator(".marquee-track")
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
  for (let i = 0; i < 12; i++) {
    const card = page.locator("article.receipt").filter({
      has: page.getByRole("heading", {
        name: new RegExp(
          `^${["List", "Feed", "Recentre", "Reopen", "Retire", "Pool", "Resync", "Guardian", "RaiseCap", "FeeRecipient", "Setting", "Setting"][i]} · Proposal`,
        ),
      }),
    }).first();
    await sendClick(
      card.getByRole("button", { name: "Execute", exact: true }),
      "execute",
    );
  }
  assert.equal(await rv("feeRecipient"), owner);
  const after = await rv("settings");
  assert.deepEqual([after.hoursFrom, after.hoursTo, after.dst], [120600n, 489600n, 1n]);
  checks.push("Hours (120600-489600) and Dst 1 executed and read back from settings()");
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
    "lowerNAVCap",
  );
  await sendClick(
    page.getByRole("button", { name: "Unpause deposits", exact: true }),
    "unpauseDeposits",
  );
  // A Saturday under the new hours (deposits unpaused) shows the Monday 9:30 am reopening (UTC-5).
  await warpTo(await saturday());
  assert.equal(Number((await rv("depositStatus", [[]]))[0]), 3);
  await page.reload();
  await nav("Deposit");
  await refresh();
  await page.getByText(/^Deposits reopen Monday 9:30 am UTC-5 \(Monday, /).waitFor();
  checks.push("Saturday after the Hours change shows Deposits reopen Monday 9:30 am");
  await nav("Owner");
  // Cancel owner and guardian proposal boundaries, without changing the deployed roles.
  await form("Recentre", { "Stock Token": stocks[0] }, "Propose Recentre");
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
    [10n * 10n ** 18n, 20n * 10n ** 6n, 30n * 10n ** 18n],
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
          "Windows Chrome/Edge native display scaling is unavailable in this Linux worker; Chromium DPR emulation is separate evidence.",
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
    const failure = path.resolve("../test/scratch/fork-failure");
    fs.mkdirSync(failure, { recursive: true });
    fs.writeFileSync(
      path.join(failure, "browser-failure.txt"),
      await page.locator("body").textContent(),
    );
    await page
      .screenshot({
        path: path.join(failure, "browser-failure.jpg"),
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

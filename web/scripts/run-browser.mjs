import { checkVaultRpc } from "./vault-rpc-browser.mjs";
import { checkBaskGuide } from "./bask-guide-browser.mjs";
import { checkTokenomics } from "./tokenomics-browser.mjs";
import { losslessEvidence } from "./lossless-evidence.mjs";
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
  decodeFunctionResult,
  encodeFunctionResult,
  decodeEventLog,
  keccak256,
  zeroAddress,
  parseAbi,
  getContractAddress,
  encodeAbiParameters,
  toHex,
} from "viem";
import { VAULT, RUNTIME_HASH } from "../src/deployment.ts";
import { chain, vaultAbi, GAS } from "../src/chain.ts";
import { fmt } from "../src/model.ts";
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
// The walk-through lists stocks through genesis, so vault 6 must be empty and
// unfinalized. 83874298 is the last block where it was (same runtime hash);
// the live vault has since been listed and may be finalized.
const forkBlock = BigInt(process.env.BASKET_FORK_BLOCK || 83874298);
assert.ok(forkBlock > 83448310n);
// A pinned past block needs an archive endpoint; the public RPCs prune it.
const upstreamRpc =
  process.env.BASKET_RPC || "https://robinhood.api.pocket.network";
// Anvil forks through this local read-only proxy. It forwards read methods
// only, asks by block number where Anvil asks by block hash (archive backends
// refuse hash-addressed historical reads), keeps at most 8 upstream requests
// in flight (bursts get throttled) and retries transient failures.
const readMethods = new Set([
  "eth_chainId",
  "net_version",
  "web3_clientVersion",
  "eth_blockNumber",
  "eth_getBlockByNumber",
  "eth_getBlockByHash",
  "eth_getBlockReceipts",
  "eth_getBalance",
  "eth_getTransactionCount",
  "eth_getCode",
  "eth_getStorageAt",
  "eth_getProof",
  "eth_getAccount",
  "eth_getAccountInfo",
  "eth_call",
  "eth_gasPrice",
  "eth_maxPriorityFeePerGas",
  "eth_feeHistory",
  "eth_getTransactionByHash",
  "eth_getTransactionByBlockNumberAndIndex",
  "eth_getTransactionReceipt",
]);
let upstreamActive = 0;
const upstreamQueue = [];
async function upstream(method, params) {
  if (upstreamActive < 8) upstreamActive++;
  else await new Promise((r) => upstreamQueue.push(r));
  try {
    for (let attempt = 1; ; attempt++) {
      try {
        const r = await fetch(upstreamRpc, {
          signal: AbortSignal.timeout(60000),
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        });
        if (r.status === 429 || r.status >= 500)
          throw Error(`HTTP ${r.status}`);
        const j = await r.json(); // throws on an HTML challenge page
        const transient = /historical state|rate limit|too many|timeout/i;
        if (j.error && transient.test(j.error.message))
          throw Error(j.error.message);
        return j;
      } catch (e) {
        if (attempt === 6) throw e;
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
  } finally {
    const next = upstreamQueue.shift();
    if (next) next();
    else upstreamActive--;
  }
}
const blockNumbers = new Map();
function byNumber(p) {
  if (!p || typeof p !== "object" || !("blockHash" in p)) return p;
  if (!blockNumbers.has(p.blockHash))
    blockNumbers.set(
      p.blockHash,
      upstream("eth_getBlockByHash", [p.blockHash, false]).then(
        (j) => j.result.number,
        (e) => {
          blockNumbers.delete(p.blockHash);
          throw e;
        },
      ),
    );
  return blockNumbers.get(p.blockHash);
}
const proxy = http.createServer(async (req, res) => {
  let body = "";
  try {
    for await (const chunk of req) body += chunk;
  } catch {
    return res.destroy(); // Anvil dropped the request
  }
  const one = async (q) => {
    if (!readMethods.has(q?.method))
      return {
        jsonrpc: "2.0",
        id: q?.id ?? null,
        error: { code: -32601, message: "Read-only fork proxy" },
      };
    try {
      const params = await Promise.all((q.params ?? []).map(byNumber));
      return { ...(await upstream(q.method, params)), id: q.id };
    } catch (e) {
      return {
        jsonrpc: "2.0",
        id: q.id,
        error: { code: -32000, message: `Upstream: ${e.message}` },
      };
    }
  };
  let q = null;
  try {
    q = JSON.parse(body);
  } catch {}
  const answer = Array.isArray(q)
    ? await Promise.all(q.map(one))
    : await one(q);
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(answer));
});
await new Promise((r) => proxy.listen(0, "127.0.0.1", r));
const proc = spawn(
  "anvil",
  [
    "--fork-url",
    `http://127.0.0.1:${proxy.address().port}`,
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
// Drain child output even when an Anvil build logs with --silent.
proc.stdout.resume();
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
  // Some Anvil versions refuse eth_call on the forked head ("Excess blob gas
  // not set"); a locally mined block carries the blob-gas fields.
  await raw("evm_mine");
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
    if (!file.startsWith(dist + path.sep)) {
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
  // v11: the page's console errors; every wallet request by method, in order;
  // whether the page wrongly asked for wallet_revokePermissions; the hash of
  // the last send.
  const consoleErrors = [],
    asked = [],
    revoked = [];
  let lastSent, lastMined, speedNext = false, repricing;
  let holdConnect = false, releaseConnect, emptyAccounts = false;
  const v12Checks = [];
  const v13Checks = [];
  const v14Checks = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  let currentAccount = owner,
    currentChain = "0x1237",
    now = Number((await pc.getBlock()).timestamp) * 1000,
    failAggregate = false,
    declineNext = false,
    pendingNext = false,
    // v22: answer the next previewDeposit read with a 0.5% fee (the fee switch
    // between a preview and its press).
    feeNext = false;
  await page.exposeFunction("testWallet", async ({ method, params }) => {
    asked.push(method);
    if (method === "eth_requestAccounts" && holdConnect)
      return new Promise((resolve) => { releaseConnect = () => resolve([currentAccount]); });
    if (method === "eth_accounts" || method === "eth_requestAccounts")
      return emptyAccounts ? [] : [currentAccount];
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
      if (['deposit','redeem'].includes(decoded.functionName)) {
        const deadline=Number(decoded.args.at(-1));
        const clockSeconds=await page.evaluate(()=>Math.floor(Date.now()/1000));
        assert.ok(deadline<=clockSeconds+600&&deadline>=clockSeconds+590,'Deadline remains browser time plus 600 seconds (up to 10 seconds of simulation/request latency)');
      }
      sends.push({ to: t.to, ...decoded, gas: t.gas });
      // v12: reprice one existing deposit in the mock, without adding a page send.
      if (speedNext) {
        speedNext = false;
        await raw("evm_setAutomine", [false]);
        const nonce = await raw("eth_getTransactionCount", [t.from, "pending"]);
        const gasPrice = BigInt(await raw("eth_gasPrice")) * 2n;
        const original = await raw(method, [{ ...t, nonce, gasPrice: toHex(gasPrice) }]);
        repricing = { original, t, nonce, gasPrice, scheduled: false };
        return (lastSent = original);
      }
      lastMined = lastSent = await raw(method, params);
      return lastSent;
    }
    if (method === "wallet_revokePermissions") {
      // Disconnect is local to this page and must never make this request.
      // Keep the trap: both the Disconnect step and the final check require
      // this record to stay empty. It is never counted as a send.
      revoked.push({ params, refused: true });
      throw Object.assign(new Error("Method not found"), { code: -32601 });
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
      // v11: the count of answered wallet requests lets a step wait until the
      // page has had the wallet's answer. The page still gets the same result
      // or the same error, and an error it does not catch is still reported.
      const listeners = new Map();
      window.__accounts = (a) => listeners.get("accountsChanged")?.(a);
      window.ethereum = {
        request: async (a) => {
          try {
            return await window.testWallet(a);
          } finally {
            window.__walletAnswers = (window.__walletAnswers ?? 0) + 1;
          }
        },
        on(event, fn) { listeners.set(event, fn); },
        removeListener(event, fn) { if (listeners.get(event) === fn) listeners.delete(event); },
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
        if (
          feeNext &&
          b.method === "eth_call" &&
          b.params[0].data?.startsWith(previewDeposit) &&
          response.result
        ) {
          feeNext = false;
          const [shares, , value, nav] = decodeFunctionResult({
            abi: vaultAbi,
            functionName: "previewDeposit",
            data: response.result,
          });
          const fee = shares / 200n + (shares % 200n === 0n ? 0n : 1n);
          response.result = encodeFunctionResult({
            abi: vaultAbi,
            functionName: "previewDeposit",
            result: [shares - fee, fee, value, nav],
          });
        }
        if (response.error)
          console.log(
            "RPC error",
            b.method,
            b.params?.[0]?.data?.slice(0, 10),
            response.error,
          );
        // Wait until viem has asked for the original pending transaction, so it
        // can identify the same-nonce replacement on the next mined block.
        if (repricing && !repricing.scheduled && b.method === "eth_getTransactionByHash" && b.params[0] === repricing.original) {
          repricing.scheduled = true;
          setTimeout(async () => {
            try {
              const r = repricing;
              lastMined = await raw("eth_sendTransaction", [{ ...r.t, nonce: r.nonce, gasPrice: toHex(r.gasPrice * 2n) }]);
              await raw("evm_mine");
              await raw("evm_setAutomine", [true]);
            } catch (e) { issues.push("Speed up fixture: " + e.message); }
          }, 500);
        }
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
    // SPEC 3.5 decision A: the only new primary navigation entry.
    assert.deepEqual(await page.locator("nav a").allTextContents(), ["Vault", "Deposit", "Redeem", "Earn", "Docs"]);
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
  // v11 Deposit form. One row per stock, found by its amount box.
  const depositRow = (symbol) =>
    page.locator(".deposit-row").filter({
      has: page.getByLabel(`${symbol} amount`, { exact: true }),
    });
  // The rows as a visitor reads them, top to bottom: ticker, balance line and
  // the text in the amount box.
  const depositRows = () =>
    page
      .locator(".deposit-row")
      .evaluateAll((rows) =>
        rows.map((row) => [
          row.querySelector("label").textContent,
          row.querySelector("small").textContent,
          row.querySelector("input").value,
        ]),
      );
  const search = page.getByLabel("Add another stock", { exact: true });
  // The Add buttons the search offers now.
  const offered = () =>
    page.getByRole("button", { name: /^Add / }).allInnerTexts();
  // Waits until a row button, found by its exact name, can be pressed (Max is
  // off while the wallet's balances are read again).
  const pressable = (name) =>
    page.waitForFunction(
      (name) =>
        document.querySelector(`button[aria-label="${name}"]`)?.disabled ===
        false,
      name,
    );
  // Latest owner decision: no normal notice; retain the full closure/issue box.
  async function statusShown(shown = true) {
    const line = page.locator(".flow-layout .deposit-open"),
      box = page.locator(".flow-layout > section.panel > .deposit-state");
    assert.equal(await line.count(), 0);
    if (!shown) {
      assert.equal(await box.count(), 0, "normal deposits show no status box");
      assert.equal(await page.locator(".deposit-led-sign").count(), 0, "normal deposits show no sign");
      return [];
    }
    await box.waitFor();
    assert.equal(await box.count(), 1);
    const words = await box.locator("strong, p").allInnerTexts();
    const sign = box.locator(".deposit-led-sign");
    assert.equal(await sign.count(), 1, "known deposit status has its approved sign");
    assert.equal(await sign.getAttribute("role"), "img");
    assert.equal(await sign.getAttribute("aria-label"), "Closed", "only a known closure displays the Closed sign");
    return words;
  }
  // previewDeposit reads the page has made so far.
  const previewDeposit = encodeFunctionData({
    abi: vaultAbi,
    functionName: "previewDeposit",
    args: [[], []],
  }).slice(0, 10);
  const previews = () =>
    rpcCalls.filter(
      (c) =>
        c.method === "eth_call" && c.params[0].data?.startsWith(previewDeposit),
    ).length;
  // Runs a step and waits until the page has had the wallet's answers to the
  // `count` requests the step makes.
  async function walletAnswers(count, step) {
    const before = await page.evaluate(() => window.__walletAnswers ?? 0);
    await step();
    await page.waitForFunction(
      (n) => window.__walletAnswers >= n,
      before + count,
    );
  }
  const shots = [];
  const losslessShots = [];
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
        // v11: the Deposit form's rows come with the wallet's balances.
        await page.waitForFunction(
          () =>
            ![...document.querySelectorAll("p, small, button")].some(
              (e) =>
                e.textContent.includes("Reading...") ||
                e.textContent.includes("Reading your wallet..."),
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
        // 2026-10-16, Add liquidity build: only the four Owner captures join Docs' lossless encoding.
        const file = `${state}-${name.toLowerCase()}-${width}.${["Docs", "Owner"].includes(name) ? "webp" : "jpg"}`;
        // Quality 18 in v14 (26 in v12 and v13, 32 in v11, 36 in v9/v10, 40
        // before): the Docs page is five panels and a tab row longer, so the
        // 24 readable full-page screenshots keep at least 250,000 bytes
        // within the 8 MiB delivery budget, including the two share-picture
        // copies.
        if (["Docs", "Owner"].includes(name)) losslessShots.push(await losslessEvidence(page, artifacts, file));
        else await page.screenshot({
          path: path.join(artifacts, file),
          type: "jpeg",
          quality: 18,
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
  // v12 SPEC sections 1-5: exact visitor words and structure on real pages.
  await nav("Vault");
  await page.getByRole("heading", { name: "Always in stock", exact: true }).waitFor();
  assert.equal(await page.locator("h1").textContent(), "Always in stock");
  assert.equal(await page.locator(".page-title > p").count(), 0);
  assert.equal(await page.locator(".page-title p:empty").count(), 0);
  const capacityLabel = page.locator(".stats > div").nth(3).locator("span");
  assert.equal(await capacityLabel.evaluate(element => [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join("")), "Maximum Basket Capacity");
  assert.equal(await capacityLabel.locator("small").innerText(), "(eligible to be raised)");
  assert.ok(await capacityLabel.locator("small").evaluate(element => getComputedStyle(element).display === "block" && parseFloat(getComputedStyle(element).fontSize) < parseFloat(getComputedStyle(element.parentElement).fontSize)), "capacity qualification is a smaller separate line");
  const compactStatus = page.locator(".deposit-summary > .deposit-state");
  await compactStatus.waitFor();
  assert.equal(await compactStatus.count(), 1);
  assert.equal(await page.locator(".deposit-led-sign").count(), 0, "approved sign belongs only on Deposit");
  assert.equal(await compactStatus.locator(":scope > strong").innerText(), "Vault status:");
  const compactParagraphs = await compactStatus.locator(":scope > p").evaluateAll(elements => elements.map(element => ({text:element.textContent,visible:element.getClientRects().length > 0})));
  assert.equal(compactParagraphs.length, 1, "compact Vault has one plain closure paragraph");
  assert.deepEqual(compactParagraphs[0], {text:"Closed",visible:true}, "compact Vault uses the approved plain Closed notice");
  assert.ok(compactParagraphs.slice(1).every(paragraph => !paragraph.visible), "only the first status paragraph is visible on Vault");
  if (await compactStatus.locator(":scope > button").count()) assert.ok(await compactStatus.locator(":scope > button").isVisible(), "Retry vault remains visible");
  v12Checks.push("Vault: Always in stock, no sentence or empty paragraph; compact deposit status shows existing label and status only");
  await nav("Docs");
  await page.getByRole("heading", { name: "Docs", exact: true }).waitFor();
  assert.deepEqual(await page.locator(".docs-grid > section").first().locator("p").allTextContents().then(xs => xs.map(x => x.replace(/\s+/g, " ").trim())), ["One token, BASK, backed by a basket of Stock Tokens held in a vault on Robinhood Chain. Deposit one or more listed Stock Tokens at once and receive BASK. Redeeming BASK pays a share of every stock in the vault.","The basket has no set weights. Any listed stock can be deposited, in any amount, as long as the vault’s checks pass and the vault stays under its size limit. So the mix is whatever holders have put in, and it changes with every deposit and redemption.","BASK’s backing moves with every stock in the vault, so its market price can drift from the value behind it. Traders close that gap: they deposit stocks and sell BASK when it trades high, or buy BASK and redeem when it trades low. That keeps BASK near its backing.","The 0.5% fee on each deposit and redemption goes to ITEM staking, so more trading through the vault means more fees for ITEM."]);
  v12Checks.push("Docs: original paragraph and approved live-oriented copy, word for word");
  // v14: five ITEM panels between Risks and Find Basket, in the default Docs tab. v22: the walk itself was stale
  // since v19 ("If a stock goes missing" stands right after Safety, so the three panel indexes below moved up by one).
  assert.deepEqual(await page.locator("#docs-panel-0 .docs-grid > section > h2").allTextContents(), ["What Basket is", "Deposits", "Redemption", "FAQ", "NAV", "Numbers", "Safety", "If a stock goes missing", "Risks", "ITEM", "Earn ITEM by providing liquidity", "Earn BASK by staking ITEM", "Rewards FAQ", "ITEM risks", "Find Basket"]);
  assert.equal(await page.locator("#docs-panel-0 .docs-grid > section").nth(9).locator("p").first().textContent().then((x) => x.replace(/\s+/g, " ").trim()), "ITEM is Basket's reward token. It has two jobs: it pays the people who provide liquidity for BASK and ITEM, and staking it earns the vault's fees. Its supply is fixed at 1,000,000,000 and its reward schedules are written into contracts that have no owner, no pause and no upgrade. Nobody can change the amounts, speed them up or stop them.");
  assert.deepEqual(await page.locator("#docs-panel-0 .docs-grid > section").nth(10).locator("table tbody tr").evaluateAll((rows) => rows.map((r) => [...r.children].map((c) => c.textContent))), [["BASK/USDG", "490,000,000", "43.75%", "31.25%", "18.75%", "6.25%"], ["ITEM/ETH", "210,000,000", "43.75%", "31.25%", "18.75%", "6.25%"]]);
  assert.deepEqual(await page.locator("#docs-panel-0 .docs-grid > section").nth(12).locator("h3").allTextContents(), ["Can I claim whenever I want?", "Is anything locked?", "What if nobody uses the vault?", "Do rewards expire?", "Can the team change the rewards?"]);
  assert.equal(await page.locator("#docs-panel-0").getByText(/not live yet/).count(), 0, "no not-live wording in the Docs tab");
  v14Checks.push("Docs: five ITEM panels between Risks and Find Basket, headings in order, the ITEM paragraph, the gauge table and the five FAQ questions word for word; no not-live wording");
  const beforeTokenomics = {rpc:rpcCalls.length, wallet:asked.length};
  await page.evaluate(()=>{
    window.__docsStorageWrites=0;
    window.__docsStorageOriginals=Object.fromEntries(['setItem','removeItem','clear'].map(k=>[k,Storage.prototype[k]]));
    for(const key of ['setItem','removeItem','clear'])Storage.prototype[key]=function(...args){window.__docsStorageWrites++;return window.__docsStorageOriginals[key].apply(this,args);};
  });
  checks.push(await checkTokenomics(page));
  checks.push(await checkBaskGuide(page));
  const docsStorageWrites=await page.evaluate(()=>{const n=window.__docsStorageWrites;for(const [key,fn] of Object.entries(window.__docsStorageOriginals))Storage.prototype[key]=fn;delete window.__docsStorageWrites;delete window.__docsStorageOriginals;return n;});
  assert.equal(docsStorageWrites,0,'All local Docs tab visits add no storage write');
  checks.push('BASK: all local Docs tabs add zero storage writes');
  const afterTokenomics = {rpc:rpcCalls.length, wallet:asked.length};
  assert.deepEqual(afterTokenomics,beforeTokenomics,'Opening Tokenomics adds no RPC or wallet request');
  checks.push('Tokenomics: opening the tab adds zero RPC and zero wallet requests');
  await nav("Deposit");
  await page.getByRole("heading", { name: "Deposit Stock Tokens", exact: true }).waitFor();
  // v14: on desktop the notes sit under the form inside the panel; no aside.
  const beforeDeposit = page.locator(".deposit-main > .deposit-notes");
  assert.equal(await beforeDeposit.count(), 1);
  assert.equal(await page.locator("aside.panel").count(), 0, "v14: no Before-you-deposit aside on desktop");
  assert.equal(await beforeDeposit.locator("h2").textContent(), "Before you deposit");
  assert.equal(await beforeDeposit.locator("details").count(), 0);
  assert.equal(await beforeDeposit.getByText("Issuer restrictions and pool checks can temporarily halt deposits.", { exact: true }).count(), 1, "v14: the approved note");
  assert.equal(await page.getByText(/Feeds lag the market\. Issuer/).count(), 0, "the old note is gone");
  assert.equal(await beforeDeposit.getByText(/^Size limit: /).count(), 1, "Deposit aside retains Size limit");
  for (const text of ["You approve each stock for exactly the amount you deposit. Each approval is its own wallet prompt; the deposit prompt comes last.", "A prepared deposit must be sent within ten minutes. The BASK goes to your connected wallet."])
    assert.equal(await beforeDeposit.getByText(text, {exact:true}).count(), 1);
  const fullDepositStatus = page.locator(".flow-layout > section.panel > .deposit-state");
  await fullDepositStatus.waitFor();
  assert.equal(await fullDepositStatus.count(), 1);
  await fullDepositStatus.getByRole("img", {name:"Closed",exact:true}).waitFor();
  assert.equal(await fullDepositStatus.locator(".deposit-led-sign").count(), 1, "unfinalized initial fixture shows Closed");
  assert.equal(await page.locator(".flow-layout .deposit-open").count(), 0);
  assert.equal(await page.locator(".deposit-summary").count(), 0);
  assert.equal(await page.locator(".wallet-line").count(), 0, "owner removed the Deposit wallet instruction line");
  assert.equal(await fullDepositStatus.locator(":scope > strong").count(), 0, "Deposit notice has only its Closed sign and sentence");
  assert.ok(await fullDepositStatus.evaluate(element => element.previousElementSibling?.classList.contains("hours-tag") && element.parentElement.firstElementChild === element.previousElementSibling), "full deposit status follows the unchanged first-child 24/7 pill");
  assert.deepEqual(await fullDepositStatus.locator(":scope > p").allInnerTexts(), ["Deposits will be back open when “genesis not finished” is resolved."], "initial setup has exactly one approved issue sentence");
  v12Checks.push("Deposit: Before you deposit under the form on desktop shows both approved paragraphs and the approved note without a fold; full deposit status follows the 24/7 pill");
  await nav("Redeem");
  await page.getByRole("heading", { name: "Redeem BASK", exact: true }).waitFor();
  assert.equal(await page.locator(".flow-layout.one-column").count(), 1);
  assert.equal(await page.getByRole("heading", {name:"Take your basket home",exact:true}).count(), 0);
  assert.equal(await page.locator(".wallet-line").count(), 0, "owner removed the Redeem wallet instruction line");
  v12Checks.push("Redeem: one column, removed aside and no wallet instruction line");
  await page.getByText("Nothing is owed to this wallet.", {exact:true}).waitFor();
  assert.equal(await page.locator("section.claims").count(), 0);
  v12Checks.push("Claims: connected empty wallet shows quiet line without panel");
  const shell = await (await page.request.get(url)).text();
  assert.deepEqual(await page.evaluate(html => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return ["og:title", "og:description", "og:image", "twitter:card"].map(key =>
      doc.querySelector('meta[property="'+key+'"],meta[name="'+key+'"]')?.getAttribute("content"));
  }, shell), ["Basket Protocol", "Basket Protocol. View the BASK vault, deposit Stock Tokens, redeem and manage claims.", "https://basket-protocol.sites.imd.fun/share-card.jpg", "summary_large_image"]);
  const jpeg = Buffer.from(await (await page.request.get(url+"share-card.jpg")).body());
  assert.equal(jpeg.readUInt16BE(0), 0xffd8);
  assert.ok(jpeg.length <= 45000);
  assert.deepEqual(await page.evaluate(async (src) => {const i=new Image(); i.src=src; await i.decode(); return [i.naturalWidth,i.naturalHeight];}, url+"share-card.jpg"),[1200,630]);
  v12Checks.push("Link preview: served approved share tags and 1200x630 JPEG");
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
  // The earlier "All rows listed" text stays on screen while this second pass
  // re-reads the vault; wait for the pass to end so it cannot overlap the
  // Finalize send (its pending checks would clear that send's status link).
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll("button")].find(
        (b) => b.textContent === "List stocks",
      )?.disabled === false,
    null,
    { timeout: 60000 },
  );
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
  // v11: the Deposit form opens with the stocks the wallet holds. The test
  // wallet (the owner) holds 1,000,000 of each of the 25 listed stocks; for its
  // first look at the form it holds none of S22 and one base unit of S21 (far
  // under one cent). Both get their million back before deposits reopen.
  const listed = indices.map((i) => symbols[i]),
    million = 1000000n * 10n ** 18n,
    full = "Wallet balance: 1,000,000 · about $100,000,000",
    walletBalance = (i) =>
      pc.readContract({
        address: stocks[i],
        abi: compiled.TestStock.abi,
        functionName: "balanceOf",
        args: [owner],
      });
  await tx(stocks[25], compiled.TestStock.abi, "burn", [owner, million]);
  await tx(stocks[24], compiled.TestStock.abi, "burn", [owner, million - 1n]);
  assert.deepEqual(
    [await walletBalance(24), await walletBalance(25)],
    [1n, 0n],
  );
  // v10: the 24/7 redemption tag is always shown on Deposit (closed here, open below) and Redeem.
  const hoursTag = "Redemptions are open 24/7. Deposit hours apply to deposits only.";
  await nav("Deposit");
  await refresh();
  await page.getByText("Deposits will be back open when “too few fresh prices” is resolved.", {exact:true}).waitFor();
  await page.getByText(hoursTag, { exact: true }).waitFor();
  assert.equal(await page.getByText(/Deposits reopen /).count(), 0, "no reopen time on a holiday");
  // Latest owner wording: Closed sign and one short issue sentence.
  const closedBox = await statusShown();
  assert.deepEqual(closedBox, ["Deposits will be back open when “too few fresh prices” is resolved."]);
  assert.equal(await page.locator(".flow-layout .deposit-state > strong").count(), 0);
  assert.equal(await page.locator(".flow-layout .deposit-state").getByText(/^Hours:/).count(), 0);
  assert.equal(closedBox.length, 1);
  // v11: the wallet's stocks are rows from the start, in the vault's order
  // while their values are equal (v10 had to press "Add FIG" here).
  await page.getByLabel("FIG amount", { exact: true }).waitFor();
  assert.deepEqual(
    await depositRows(),
    listed.slice(0, 23).map((s) => [s, full, ""]),
  );
  assert.deepEqual(await offered(), []);
  checks.push(
    "Deposit form lists the test wallet's stocks without any Add press: 23 rows, not S22 (none held) nor S21 (under one cent)",
  );
  await page.getByLabel("FIG amount", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Preview deposit", exact: true }).click();
  await page.getByText(/too few fresh prices/).first().waitFor();
  // v11: the status box says these words too, so wait for the refusal itself.
  await page
    .getByText("too few fresh prices. Stock at fault: none.", { exact: true })
    .waitFor();
  checks.push("US market holiday: Freshness refusal (reason 14) with no set time");
  // v11: a balance worth under one cent waits behind a toggle.
  await page
    .getByRole("button", { name: "Show small balances (1)", exact: true })
    .click();
  await page.getByLabel("S21 amount", { exact: true }).waitFor();
  assert.deepEqual(await depositRows(), [
    ...listed.slice(0, 23).map((s) => [s, full, s === "FIG" ? "10" : ""]),
    ["S21", "Wallet balance: <0.0001 · under $0.01", ""],
  ]);
  await page
    .getByRole("button", { name: "Hide small balances", exact: true })
    .click();
  await page
    .getByLabel("S21 amount", { exact: true })
    .waitFor({ state: "detached" });
  await page
    .getByRole("button", { name: "Show small balances (1)", exact: true })
    .waitFor();
  checks.push(
    "Deposit form keeps a balance under one cent behind Show small balances (1)",
  );
  // v11: the search offers Add buttons only while text is typed, never for a
  // stock that is on screen, and six at most. "s2" matches S20, S21 and S22;
  // S20 has a row. With S10 to S16 removed, "s1" matches those seven.
  await search.fill("s2");
  await page.getByRole("button", { name: "Add S22", exact: true }).waitFor();
  assert.deepEqual(await offered(), ["Add S21", "Add S22"]);
  for (const s of listed.slice(12, 19))
    await page
      .getByRole("button", { name: `Remove ${s}`, exact: true })
      .click();
  await search.fill("s1");
  await page.getByText("1 more: keep typing.", { exact: true }).waitFor();
  assert.deepEqual(
    await offered(),
    listed.slice(12, 18).map((s) => `Add ${s}`),
  );
  await search.fill("");
  await page
    .getByRole("button", { name: "Add S10", exact: true })
    .waitFor({ state: "detached" });
  assert.deepEqual(await offered(), []);
  assert.equal(
    await page.getByLabel("FIG amount", { exact: true }).inputValue(),
    "10",
  );
  checks.push(
    "Deposit search: Add buttons only while text is typed, at most six, never for a stock on screen",
  );
  await tx(stocks[25], compiled.TestStock.abi, "mint", [owner, million]);
  await tx(stocks[24], compiled.TestStock.abi, "mint", [owner, million - 1n]);
  assert.deepEqual(
    [await walletBalance(24), await walletBalance(25)],
    [million, million],
  );
  // One feed updates and deposits pass again.
  await tx(feeds[1], compiled.TestFeed.abi, "setLag", [0]);
  assert.equal(Number((await rv("depositStatus", [[]]))[0]), 0);
  await refresh();
  checks.push("One updated feed reopens deposits after the holiday");
  // The latest owner decision removes the normal status notice. S22 is a row
  // now, and a removed row stays removed.
  assert.deepEqual(await statusShown(false), []);
  await page.getByLabel("S22 amount", { exact: true }).waitFor();
  assert.equal(await page.getByLabel("S10 amount", { exact: true }).count(), 0);
  checks.push(
    "Deposit status: no normal notice; Closed sign and one approved closure sentence",
  );
  // v14: on desktop (the walk's 1440px) the list is always open in the
  // right-hand column, never a fold; it holds every stock the vault takes
  // now. A stock that has a row is switched off; S10 to S16 were removed
  // above, so only they can be pressed. A press adds that stock's row,
  // empty, in its place, with the focus in its amount box. (This fixture
  // lists its stocks in A to Z order, so the walk does not show the list's
  // own sorting.) The reload below clears it all.
  const allStocks = page.locator(".deposit-right div.all-stocks.open-list"),
    tickers = () =>
      allStocks
        .locator("ul button")
        .evaluateAll((list) => list.map((b) => [b.textContent, b.disabled]));
  assert.equal(await allStocks.count(), 1);
  assert.equal(await page.locator("details.all-stocks").count(), 0);
  assert.equal(
    await allStocks.locator(".list-title").textContent(),
    "All stocks you can deposit (25)",
  );
  await allStocks
    .getByText("Press a stock to add it to your deposit.", { exact: true })
    .waitFor();
  assert.equal(await allStocks.getByText("Grey stocks are already in the form above.", { exact: true }).count(), 0, "v14: the grey-stocks sentence is gone");
  // The two columns: the form, its buttons and the notes left, the list right, side by side from the same top.
  const columns = await page.evaluate(() => {
    const main = document.querySelector(".deposit-main").getBoundingClientRect(), right = document.querySelector(".deposit-right").getBoundingClientRect(), notes = document.querySelector(".deposit-notes"), form = document.querySelector(".deposit-main form").getBoundingClientRect();
    return { sideBySide: right.left >= main.right - 1 && Math.abs(right.top - main.top) < 2, notesUnderForm: !!notes && notes.getBoundingClientRect().top >= form.bottom && !!main && document.querySelector(".deposit-main").contains(notes), aside: document.querySelectorAll("aside.panel").length, columnsTemplate: getComputedStyle(document.querySelector(".deposit-columns")).gridTemplateColumns.split(" ").length, overflow: document.documentElement.scrollWidth > innerWidth };
  });
  assert.deepEqual(columns, { sideBySide: true, notesUnderForm: true, aside: 0, columnsTemplate: 2, overflow: false }, JSON.stringify(columns));
  assert.deepEqual(
    await tickers(),
    listed.map((s) => [s, !listed.slice(12, 19).includes(s)]),
  );
  await allStocks.getByRole("button", { name: "S10", exact: true }).click();
  await page.getByLabel("S10 amount", { exact: true }).waitFor();
  assert.equal(
    await page.locator(":focus").getAttribute("aria-label"),
    "S10 amount",
  );
  assert.deepEqual(
    await tickers(),
    listed.map((s) => [s, !listed.slice(13, 19).includes(s)]),
  );
  assert.deepEqual(
    await depositRows(),
    listed
      .filter((s) => !listed.slice(13, 19).includes(s))
      .map((s) => [s, full, s === "FIG" ? "10" : ""]),
  );
  assert.deepEqual(await offered(), []);
  checks.push(
    "All stocks you can deposit (25): open in the right-hand column on desktop with the notes under the form, the tickers of all 25 open stocks, only the stocks without a row can be pressed, and a press adds that stock's empty row with the focus in its amount box",
  );
  // Same hash: reload so the holiday attempt's chosen stock is cleared.
  await page.reload();
  await nav("Deposit");
  await page.getByText(hoursTag, { exact: true }).waitFor();
  // v11: nothing of the form is kept across a reload: all 25 rows, empty.
  await page.getByLabel("FIG amount", { exact: true }).waitFor();
  assert.deepEqual(
    await depositRows(),
    listed.map((s) => [s, full, ""]),
  );
  // v11: a stock that fails its own check has a greyed row. S03's feed goes
  // older than maxAge (reason 9). S03 is not deposited below and the vault
  // holds none of it, so the vault's own deposit status stays 0.
  const grey = 6,
    feedLag = {
      address: feeds[grey],
      abi: compiled.TestFeed.abi,
      functionName: "lag",
    },
    lagBefore = await pc.readContract(feedLag),
    ownReason = async () =>
      (await rv("allAssets"))[indices.indexOf(grey)].reason,
    blockedWords =
      "Deposits of this stock are blocked right now: feed price missing or too old.",
    look = (symbol) =>
      depositRow(symbol).evaluate((row) => [
        getComputedStyle(row.querySelector("label")).color,
        getComputedStyle(row.querySelector("input")).backgroundColor,
      ]),
    plain = await look("S03");
  await tx(feeds[grey], compiled.TestFeed.abi, "setLag", [
    (await rv("settings")).maxAge + 3600n,
  ]);
  assert.equal(await ownReason(), 9);
  assert.equal(Number((await rv("depositStatus", [[]]))[0]), 0);
  await refresh();
  await depositRow("S03").getByText(blockedWords).waitFor();
  // Balances are read again, so Max S03 is off for the row's own reason.
  await pressable("Max FIG");
  assert.equal(
    await depositRow("S03").locator("p").textContent(),
    blockedWords + " Refresh",
  );
  assert.equal(
    await page
      .getByText(/^Deposits of this stock are blocked right now: /)
      .count(),
    1,
  );
  assert.deepEqual(
    [
      await page.getByLabel("S03 amount", { exact: true }).isDisabled(),
      await page
        .getByRole("button", { name: "Max S03", exact: true })
        .isDisabled(),
      await page
        .getByRole("button", { name: "Remove S03", exact: true })
        .isEnabled(),
      await page
        .getByRole("button", { name: "Refresh S03", exact: true })
        .isEnabled(),
      await page.getByLabel("FIG amount", { exact: true }).isEnabled(),
    ],
    [true, true, true, true, true],
  );
  const greyed = await look("S03");
  assert.ok(greyed[0] !== plain[0] && greyed[1] !== plain[1], "muted look");
  assert.deepEqual(await look("S02"), plain);
  assert.deepEqual(await statusShown(false), []);
  // Undo it on the chain; the row's own Refresh reads the vault again.
  await tx(feeds[grey], compiled.TestFeed.abi, "setLag", [lagBefore]);
  assert.equal(await pc.readContract(feedLag), lagBefore);
  assert.equal(await ownReason(), 0);
  await page.getByRole("button", { name: "Refresh S03", exact: true }).click();
  await page.getByText(blockedWords).waitFor({ state: "detached" });
  await pressable("Max S03");
  assert.ok(await page.getByLabel("S03 amount", { exact: true }).isEnabled());
  assert.deepEqual(await look("S03"), plain);
  assert.deepEqual(
    await depositRows(),
    listed.map((s) => [s, full, ""]),
  );
  checks.push(
    "Greyed row: a stock failing its own check (feed too old) says why; amount box and Max off, Remove and Refresh on; Refresh clears it once the feed is back",
  );
  // v11: "Max FIG" (v10: "Add FIG", then "Use full balance").
  await page.getByRole("button", { name: "Max FIG", exact: true }).click();
  assert.equal(
    await page.getByLabel("FIG amount", { exact: true }).inputValue(),
    "1000000",
  );
  await search.fill("OAT");
  assert.equal(
    await page.getByLabel("FIG amount", { exact: true }).inputValue(),
    "1000000",
  );
  // v11: OAT has a row, so the search does not offer it.
  assert.deepEqual(await offered(), []);
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
  // v11: OAT and S01 have rows already. Remove takes OAT's row away, the search
  // (any letter case) then offers it, and Add OAT brings back an empty row
  // with the focus in its amount box.
  await page.getByRole("button", { name: "Remove OAT", exact: true }).click();
  await page
    .getByLabel("OAT amount", { exact: true })
    .waitFor({ state: "detached" });
  assert.deepEqual(
    await depositRows(),
    listed
      .filter((s) => s !== "OAT")
      .map((s) => [s, full, s === "FIG" ? "10" : ""]),
  );
  await search.fill("oat");
  await page.getByRole("button", { name: "Add OAT", exact: true }).waitFor();
  assert.deepEqual(await offered(), ["Add OAT"]);
  await page.getByRole("button", { name: "Add OAT", exact: true }).click();
  await page.getByLabel("OAT amount", { exact: true }).waitFor();
  assert.equal(
    await page.locator(":focus").getAttribute("aria-label"),
    "OAT amount",
  );
  assert.equal(await search.inputValue(), "");
  assert.deepEqual(
    await depositRows(),
    listed.map((s) => [s, full, s === "FIG" ? "10" : ""]),
  );
  checks.push(
    "Deposit row: Remove takes OAT away, the search then offers Add OAT, and that brings back an empty row",
  );
  await page.getByLabel("OAT amount", { exact: true }).fill("20");
  // v11: Enter in the search never runs Preview. With no match it does
  // nothing; with matches it adds the first one (S01, not S02) and the focus
  // stays in the search. v10 typed "S01" and pressed "Add S01".
  const previewsBefore = previews();
  for (const s of ["S01", "S02"])
    await page
      .getByRole("button", { name: `Remove ${s}`, exact: true })
      .click();
  await search.fill("zzz");
  await page.getByText("No open stock matches.", { exact: true }).waitFor();
  await search.press("Enter");
  assert.equal(await search.inputValue(), "zzz");
  await search.fill("s0");
  await page.getByRole("button", { name: "Add S01", exact: true }).waitFor();
  assert.deepEqual(await offered(), ["Add S01", "Add S02"]);
  await search.press("Enter");
  await page.getByLabel("S01 amount", { exact: true }).waitFor();
  assert.equal(await page.locator(":focus").getAttribute("type"), "search");
  assert.equal(await search.inputValue(), "");
  assert.deepEqual(
    await depositRows(),
    listed
      .filter((s) => s !== "S02")
      .map((s) => [s, full, { FIG: "10", OAT: "20" }[s] ?? ""]),
  );
  await page.getByLabel("S01 amount", { exact: true }).fill("30");
  // v11: the running total of the three typed amounts, called an estimate.
  const total = await page.getByText(/^Total: about /).innerText();
  await page
    .getByText(
      "An estimate from the last vault read. Preview gives the exact figure.",
      { exact: true },
    )
    .waitFor();
  await page
    .getByRole("button", { name: "Preview deposit", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Deposit preview", exact: true })
    .waitFor();
  // Every read passes the route in order: had an Enter press started a
  // preview, its read would be counted here beside this one.
  assert.equal(previews(), previewsBefore + 1);
  checks.push("Enter in the search adds the first match and starts no preview");
  const dollars = await page
    .locator(".receipt dl > div")
    .filter({ has: page.locator("dt", { hasText: /^Dollar value$/ }) })
    .locator("dd")
    .innerText();
  assert.deepEqual([total, dollars], ["Total: about $6,000", "$6,000"]);
  checks.push(
    "Running total equals the preview's Dollar value for the three-stock deposit",
  );
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
  // v22: a fee that changed since the preview (the route answers the press's
  // previewDeposit read with a 0.5% fee) refuses the press with no wallet
  // prompt; the next press, with the fee unchanged, deposits as before.
  {
    const before = sends.length,
      asksBefore = asked.length;
    feeNext = true;
    await page.getByRole("button", { name: "Deposit", exact: true }).click();
    await page
      .getByText("Deposit changed. Preview again.", { exact: true })
      .first()
      .waitFor();
    assert.equal(feeNext, false, "v22: the fee was injected into the press's previewDeposit read");
    assert.equal(sends.length, before, "v22: no send when the fee changed since the preview");
    assert.ok(
      !asked.slice(asksBefore).includes("eth_sendTransaction"),
      "v22: no wallet prompt",
    );
    checks.push(
      "v22: Deposit refuses the press when the fee changed since the preview, with no wallet prompt; the next press deposits",
    );
  }
  speedNext = true;
  await sendClick(
    page.getByRole("button", { name: "Deposit", exact: true }),
    "deposit",
  );
  // v11: the typed amounts are gone with the preview, but FIG keeps its row
  // (in v10 the chosen rows went away: count 0).
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
    [stocks[0], stocks[1], stocks[4]].map((x) => x.toLowerCase()),
  );
  assert.deepEqual(dep.args[1], [10n * 10n ** 18n, 20n * 10n ** 6n, 30n * 10n ** 18n]);
  assert.ok(dep.gas, "Three-stock deposit uses explicit padded gas");
  assert.equal(dep.args[2].toLowerCase(), owner.toLowerCase());
  checks.push(
    "Three-stock deposit succeeds with estimated gas +30%, exact approvals, preview invalidated after success",
  );
  // v11: once the balances are read again, every wallet stock still has its
  // row with an empty box, S02 too although it was removed. The three
  // deposited stocks are worth less now, so they come last, largest first.
  await page
    .getByText("Wallet balance: 999,990 · about $99,999,000", { exact: true })
    .waitFor();
  assert.deepEqual(await depositRows(), [
    ...listed
      .filter((s) => !["FIG", "OAT", "S01"].includes(s))
      .map((s) => [s, full, ""]),
    ["FIG", "Wallet balance: 999,990 · about $99,999,000", ""],
    ["OAT", "Wallet balance: 999,980 · about $99,998,000", ""],
    ["S01", "Wallet balance: 999,970 · about $99,997,000", ""],
  ]);
  checks.push(
    "After the deposit the wallet's rows are still there with empty boxes",
  );
  // v11: "You received" is the shares of the Deposit event in the receipt of
  // that same transaction, read and decoded here.
  const minted = (await pc.getTransactionReceipt({ hash: lastMined })).logs
    .filter((l) => l.address.toLowerCase() === VAULT)
    .map((l) => {
      try {
        return decodeEventLog({
          abi: vaultAbi,
          data: l.data,
          topics: l.topics,
        });
      } catch {
        return undefined;
      }
    })
    .find((l) => l?.eventName === "Deposit");
  assert.equal(minted.args.receiver.toLowerCase(), owner.toLowerCase());
  await page
    .getByText(`You received ${fmt(minted.args.shares)} BASK.`, {
      exact: true,
    })
    .waitFor();
  assert.equal(await page.getByText(/^You received /).count(), 1);
  checks.push(
    `"You received ${fmt(minted.args.shares)} BASK." equals the shares of the Deposit event in the deposit's receipt`,
  );
  assert.ok(repricing?.scheduled && lastSent !== lastMined);
  await page.getByText("Deposit: Confirmed.", { exact:true }).waitFor();
  assert.ok((await page.locator(".wallet-status a").getAttribute("href")).endsWith(lastMined));
  const links = await page.locator("main a[href*='/tx/']").evaluateAll(es=>es.map(e=>e.getAttribute("href")));
  assert.ok(links.some(x=>x.endsWith(lastMined)));
  assert.ok(links.every(x=>!x.endsWith(lastSent)));
  const replacedTx = await pc.getTransaction({hash:lastMined});
  assert.equal(replacedTx.to.toLowerCase(), repricing.t.to.toLowerCase());
  assert.equal(replacedTx.input, repricing.t.data);
  assert.equal(replacedTx.nonce, Number(BigInt(repricing.nonce)));
  assert.ok(replacedTx.gasPrice > repricing.gasPrice);
  assert.equal(await raw("eth_getTransactionReceipt", [lastSent]), null);
  v12Checks.push("Speed up: existing deposit repriced with same nonce/to/data; Confirmed, received event amount, status and top links use mined hash");
  // v11 Disconnect: the page forgets the wallet and stays so across a reload,
  // until Connect wallet. It makes no wallet request or send, so no delayed
  // revocation from this page can undo a later connection.
  const header = page.locator("header"),
    address = page.locator(".connected-address"),
    short = `${owner.slice(0, 6)}…${owner.slice(-4)}`,
    before = [asked.length, sends.length, consoleErrors.length];
  assert.equal(await address.innerText(), short);
  await page.getByRole("button", { name: "Disconnect", exact: true }).click();
  await header
    .getByRole("button", { name: "Connect wallet", exact: true })
    .waitFor();
  assert.equal(
    await page.locator(".wallet-status").textContent(),
    "Wallet disconnected from this page. To use another wallet, switch the address in your wallet app, then press Connect wallet.",
  );
  await page
    .getByText("Connect your wallet to see the stocks you hold.", {
      exact: true,
    })
    .waitFor();
  assert.deepEqual(
    [
      await address.count(),
      await page
        .getByRole("button", { name: "Disconnect", exact: true })
        .count(),
      await page.locator(".deposit-row").count(),
      await page.getByText(/^You received /).count(),
    ],
    [0, 0, 0, 0],
  );
  assert.deepEqual(asked.slice(before[0]), []);
  assert.deepEqual(revoked, []);
  assert.equal(sends.length, before[1]);
  assert.deepEqual([issues, consoleErrors.slice(before[2])], [[], []]);
  // After a reload the wallet still answers eth_accounts with the account,
  // and the page does not take it.
  await page.reload();
  await nav("Deposit");
  await page.waitForFunction(() => window.__walletAnswers >= 2);
  await page
    .getByText("Connect your wallet to see the stocks you hold.", {
      exact: true,
    })
    .waitFor();
  assert.deepEqual(
    [...new Set(asked.slice(before[0]))],
    ["eth_accounts", "eth_chainId"],
  );
  assert.deepEqual(
    [await address.count(), await page.locator(".deposit-row").count()],
    [0, 0],
  );
  await header
    .getByRole("button", { name: "Connect wallet", exact: true })
    .waitFor();
  await walletAnswers(2, () =>
    header.getByRole("button", { name: "Connect wallet", exact: true }).click(),
  );
  await address.waitFor();
  assert.equal(await address.innerText(), short);
  assert.deepEqual(asked.slice(-2), ["eth_requestAccounts", "eth_chainId"]);
  assert.equal(await page.locator(".wallet-status").textContent(), "");
  await page.getByLabel("FIG amount", { exact: true }).waitFor();
  assert.equal(await page.locator(".deposit-row").count(), 25);
  assert.equal(sends.length, before[1]);
  assert.deepEqual([issues, consoleErrors.slice(before[2])], [[], []]);
  checks.push(
    "Disconnect: address gone, Connect wallet shown, the exact top message, still disconnected after a reload, Connect wallet brings the address back; Disconnect makes no wallet request or send",
  );
  // v13: the stock list under the search. With a wallet that holds listed
  // stock it is the closed fold (checked above); while the form is empty it is
  // shown open across the panel, with its heading as a plain line and no
  // details element, and it stays open for that account after a press. The
  // list reads from the vault only: no wallet request and no send.
  const openList = page.locator(".deposit-right div.all-stocks.open-list"),
    listFacts = () =>
      page.evaluate(() => {
        const ul = document.querySelector(".all-stocks ul"),
          title = document.querySelector(".all-stocks .list-title"),
          // v14: the list fills its right-hand column (the panel's content box on phones).
          panel = ul.closest(".deposit-right") ?? ul.closest("section.panel"),
          cs = getComputedStyle(panel),
          inner = panel.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
          u = ul.getBoundingClientRect();
        return {
          title: title?.textContent,
          titleTag: title?.tagName,
          summaries: document.querySelectorAll(".all-stocks summary").length,
          buttons: ul.querySelectorAll("button").length,
          ratio: u.width / inner,
          columns: getComputedStyle(ul).gridTemplateColumns.split(" ").length,
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
  const listRequests = asked.length, listSends = sends.length;
  // No wallet: the Deposit page after a Disconnect (and after the reload above
  // the page stayed disconnected). The owner's connected wallet above showed the
  // fold closed again: the list stays open only for the account it opened for.
  await page.getByRole("button", { name: "Disconnect", exact: true }).click();
  await page
    .getByText("Connect your wallet to see the stocks you hold.", { exact: true })
    .waitFor();
  await openList.waitFor();
  assert.equal(await page.locator("details.all-stocks").count(), 0);
  let facts = await listFacts();
  assert.deepEqual(
    [facts.title, facts.titleTag, facts.summaries, facts.buttons, facts.overflow],
    ["All stocks you can deposit (25)", "P", 0, 25, false],
    JSON.stringify(facts),
  );
  assert.ok(facts.ratio > 0.98 && facts.columns >= 5, JSON.stringify(facts));
  await openList
    .getByText("Press a stock to add it to your deposit.", { exact: true })
    .waitFor();
  // A wallet that holds no listed stock (the next owner's account, which never
  // held one): the same open list; a press adds the row and the list stays open.
  await walletAnswers(2, () =>
    header.getByRole("button", { name: "Connect wallet", exact: true }).click(),
  );
  await address.waitFor();
  await page.getByLabel("FIG amount", { exact: true }).waitFor();
  // v14: on desktop the owner's wallet sees the open list too (never a fold).
  assert.deepEqual([await page.locator("details.all-stocks").count(), await openList.count()], [0, 1]);
  await page.evaluate((a) => window.__accounts([a]), nextOwner);
  await page
    .getByText("No open listed stock in this wallet.", { exact: true })
    .waitFor();
  await openList.waitFor();
  assert.deepEqual(
    [await page.locator(".deposit-row").count(), await page.locator("details.all-stocks").count()],
    [0, 0],
  );
  facts = await listFacts();
  assert.deepEqual([facts.title, facts.summaries, facts.buttons], ["All stocks you can deposit (25)", 0, 25]);
  assert.ok(facts.ratio > 0.98 && facts.columns >= 5, JSON.stringify(facts));
  await openList.getByRole("button", { name: "FIG", exact: true }).click();
  await page.getByLabel("FIG amount", { exact: true }).waitFor();
  assert.equal(await page.locator(":focus").getAttribute("aria-label"), "FIG amount");
  assert.equal(await page.locator(".deposit-row").count(), 1);
  assert.equal(await openList.count(), 1);
  assert.equal(await openList.getByRole("button", { name: "FIG", exact: true }).isDisabled(), true);
  assert.equal(await page.locator("details.all-stocks").count(), 0);
  // Back to the owner's wallet: its rows, and (desktop) the list still open on the right.
  await page.evaluate((a) => window.__accounts([a]), owner);
  await page.waitForFunction(() => document.querySelectorAll(".deposit-row").length === 25);
  assert.deepEqual([await openList.count(), await page.locator("details.all-stocks").count()], [1, 0]);
  assert.equal(sends.length, listSends);
  assert.deepEqual([...new Set(asked.slice(listRequests))].sort(), ["eth_chainId", "eth_requestAccounts"]);
  assert.deepEqual([issues, consoleErrors.slice(before[2])], [[], []]);
  v13Checks.push(
    "Deposit stock list on desktop: always open in the right-hand column with a plain heading and no fold (no wallet; a wallet without a listed stock; the owner's wallet), a press adds the row and the list stays open; no wallet request or send",
  );
  // A Saturday: deposits refused (Hours) with the reopen time; redeem and claim still work.
  await warpTo(await saturday());
  assert.equal(await rv("insideHours"), false);
  assert.equal(Number((await rv("depositStatus", [[]]))[0]), 3);
  await page.reload();
  await nav("Deposit");
  await refresh();
  await page.getByText("Deposits reopen when the stock feed prices update around 8pm on Sundays.", {exact:true}).waitFor();
  await page.getByText(hoursTag, { exact: true }).waitFor();
  // v11: closed, so the full status box again. The wallet is still connected
  // after this reload and FIG has its row (v10 pressed "Add FIG" here).
  assert.deepEqual(await statusShown(), ["Deposits reopen when the stock feed prices update around 8pm on Sundays."]);
  assert.equal(await address.innerText(), short);
  await page.getByLabel("FIG amount", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Preview deposit", exact: true }).click();
  await page.getByText(/outside deposit hours/).first().waitFor();
  // v11: the status box says these words too, so wait for the refusal itself.
  await page
    .getByText("outside deposit hours. Stock at fault: none.", { exact: true })
    .waitFor();
  checks.push("Saturday deposit refused (Hours) with the Sunday 8:00 pm reopening shown");
  // Force a deferred leg, then claim it from the receiver wallet.
  await tx(stocks[0], compiled.TestStock.abi, "setFail", [true]);
  await nav("Redeem");
  await page.getByText(hoursTag, { exact: true }).waitFor();
  assert.equal(
    await page.getByText("Receive your share of every stock.", { exact: true }).count(),
    1,
  );
  await page.getByLabel("BASK amount", { exact: true }).fill("10");
  await page.getByLabel("Receiver", { exact: true }).fill(VAULT);
  await page.getByRole("button", { name: "Preview redemption" }).click();
  await page
    .getByText("The receiver must not be the vault.", { exact: true })
    .waitFor();
  await page.getByLabel("Receiver", { exact: true }).fill(owner);
  await page.getByRole("button", { name: "Preview redemption" }).click();
  await page.getByRole("heading", { name: "Redemption preview" }).waitFor();
  // v22: a shortfall between the preview and the press (half of a held stock
  // burned from the vault by a fixture) makes the fresh estimate fall under
  // the previewed legs: the press is refused with no wallet prompt. The stock
  // is minted back, Preview again, and the redeem below goes through as before.
  {
    const before = sends.length,
      asksBefore = asked.length;
    const held = await rv("managed", [stocks[1]]);
    assert.ok(held > 0n, "v22: the second stock is held");
    await tx(stocks[1], compiled.TestStock.abi, "burn", [VAULT, held / 2n]);
    await page.getByRole("button", { name: "Redeem", exact: true }).click();
    await page
      .getByText("Redemption changed. Preview again.", { exact: true })
      .first()
      .waitFor();
    assert.equal(sends.length, before, "v22: no send under the preview");
    assert.ok(
      !asked.slice(asksBefore).includes("eth_sendTransaction"),
      "v22: no wallet prompt",
    );
    await tx(stocks[1], compiled.TestStock.abi, "mint", [VAULT, held / 2n]);
    await page.getByRole("button", { name: "Preview redemption" }).click();
    await page.getByRole("heading", { name: "Redemption preview" }).waitFor();
    checks.push(
      "v22: Redeem refuses the press when a stock's fresh estimate is under the previewed one, with no wallet prompt; Preview again, then it sends",
    );
  }
  await sendClick(
    page.getByRole("button", { name: "Redeem", exact: true }),
    "redeem",
  );
  // v11: a confirmed redeem empties the amount box.
  assert.equal(
    await page.getByLabel("BASK amount", { exact: true }).inputValue(),
    "",
  );
  checks.push("Redeem: the BASK amount box is empty after a confirmed redeem");
  assert.ok(sends.at(-1).gas);
  assert.ok((await rv("owed", [owner, stocks[0]])) > 0n);
  // v12 SPEC 4: Claims finishes its own owed read after the wallet's vault refresh.
  // Wait for the newly owed stock before asserting the finished presentation.
  await page.getByRole("button", { name: "Claim FIG", exact: true }).waitFor();
  assert.equal(await page.locator("section.claims").count(),1);
  assert.equal(await page.locator("section.claims details").count(),0);
  assert.equal(await page.getByText(/^Claim all collects up to 10/).count(),0);
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
  assert.equal(
    await page.getByLabel("BASK amount", { exact: true }).inputValue(),
    "",
  );
  await page.getByText("Claim all collects up to 10 stocks per wallet prompt. If one stock can’t be paid, that batch stays owed: collect the others with their own Claim buttons.", {exact:true}).waitFor();
  assert.equal(await page.locator("section.claims details").count(),0);
  for (const t of stocks.slice(0, 2))
    await tx(t, compiled.TestStock.abi, "setFail", [false]);
  await refresh();
  await sendClick(
    page.getByRole("button", { name: "Claim all", exact: true }),
    "claim",
  );
  assert.equal(sends.at(-1).args[0].length, 2);
  checks.push("Saturday redeem, single claim and Claim all succeed outside deposit hours");
  await page.locator("section.claims").getByText("Nothing is owed to your connected wallet.", { exact: true }).waitFor();
  assert.equal(await page.locator("section.claims .claim-grid > .receipt").count(), 0);
  await page.waitForFunction(()=>document.querySelector("section.claims")?.textContent.includes("Confirmed."));
  assert.deepEqual(await Promise.all(stocks.slice(0,2).map(t=>rv("owed",[owner,t]))),[0n,0n]);
  await page.locator('nav a[href="#docs"]').click();
  await page.locator('nav a[href="#redeem"]').click();
  await page.locator("section.claims").getByText("Nothing is owed to your connected wallet.", { exact: true }).waitFor();
  assert.equal(await page.locator("section.claims .claim-grid > .receipt").count(), 0);
  await page.waitForFunction(()=>document.querySelector("section.claims")?.textContent.includes("Confirmed."));
  v12Checks.push("Claims: one/two owed show panel with exact conditional note and no zero fold; last claim confirmation survives navigation");
  // v13: the Claim all result line names what is still owed and no longer
  // counts the stocks that are not.
  const claimsText = await page.locator("section.claims").textContent();
  assert.match(claimsText, /Still owed to 0x[0-9a-fA-F]{40}: Nothing owed\./, claimsText);
  assert.ok(!/Nothing owed for \d+ other stocks/.test(claimsText), claimsText);
  v13Checks.push("Claim all result: the Still owed line ends with Nothing owed. and carries no other-stocks count");
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
  // v22: the Owner roles panel shows the current fee recipient: none yet.
  const feeRow = page
    .locator(".roles > div")
    .filter({ has: page.locator("strong", { hasText: /^Fee recipient$/ }) });
  assert.equal(await feeRow.count(), 1, "v22: one Fee recipient row");
  assert.equal(
    (await feeRow.innerText()).replace(/\s+/g, " ").trim(),
    "Fee recipient None",
  );
  // v22: a saved send without a receipt locks every send. A record whose nonce
  // has not passed refuses Pause deposits with the pending words, after a
  // reload too; once its nonce has passed it is refused once with the finished
  // words and the record goes. No wallet prompt either time; the real press
  // below then sends.
  {
    const before = sends.length,
      asksBefore = asked.length;
    const latest = Number(
      await raw("eth_getTransactionCount", [owner, "latest"]),
    );
    const unknown = keccak256(toHex("v22 saved send without a receipt"));
    const plant = async (nonce) => {
      await page.evaluate(
        ([key, record]) => sessionStorage.setItem(key, JSON.stringify(record)),
        [
          "basket-pending-4663",
          { hash: unknown, account: owner, functionName: "pauseDeposits", nonce },
        ],
      );
      await page.reload();
      await page.evaluate((n) => (window.__clock = n), now);
      await page.waitForFunction(
        () => !document.querySelector("button.refresh")?.disabled,
      );
    };
    await plant(latest);
    await page.getByRole("button", { name: "Pause deposits", exact: true }).click();
    await page
      .getByText(/This transaction may still be pending\. Wait for its receipt before retrying\./)
      .first()
      .waitFor();
    assert.equal(
      await page.evaluate(
        () => JSON.parse(sessionStorage.getItem("basket-pending-4663")).hash,
      ),
      unknown,
      "v22: the record stays while unresolved",
    );
    assert.equal(sends.length, before, "v22: no send while an earlier one is unresolved");
    await plant(latest - 1);
    await page.getByRole("button", { name: "Pause deposits", exact: true }).click();
    await page
      .getByText(/The earlier transaction is finished \(confirmed or replaced\)\. Refresh the vault before retrying\./)
      .first()
      .waitFor();
    await page.waitForFunction(
      () => sessionStorage.getItem("basket-pending-4663") === null,
    );
    assert.equal(sends.length, before, "v22: no send on the press that found the earlier one finished");
    assert.ok(
      !asked.slice(asksBefore).includes("eth_sendTransaction"),
      "v22: no wallet prompt",
    );
    await page.waitForFunction(
      () => !document.querySelector("button.refresh")?.disabled,
    );
    checks.push(
      "v22: a saved send without a receipt refuses the next send, after a reload too, until it is found finished; then it is refused once and forgotten; no wallet prompt",
    );
  }
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
  // v10: the strip's halves move as Web Animations; under reduced motion none exists (cancelled, not paused), no strip
  // element has a CSS animation, and the halves stand still side by side from the window's left edge.
  assert.equal(
    await page.locator(".marquee").evaluate((m) => {
      const w = m.querySelector(".marquee-window").getBoundingClientRect(),
        h = [...m.querySelectorAll(".marquee-half")]
          .map((e) => e.getBoundingClientRect())
          .sort((a, b) => a.left - b.left);
      return [
        m.getAnimations({ subtree: true }).length,
        [m, ...m.querySelectorAll("*")].filter(
          (e) => getComputedStyle(e).animationName !== "none",
        ).length,
        h.length === 2 &&
          Math.abs(h[0].left - w.left) < 0.01 &&
          Math.abs(h[1].left - h[0].right) < 0.01 &&
          h[1].right >= w.right - 0.01,
      ].join("/");
    }),
    "0/0/true",
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
  // v9 Stock shelves: the stocks are shelf-edge labels; with the aggregate
  // read failed every label says its price reason is unreadable.
  const shelfLabels = page.locator(".stock-section article.sa-label");
  assert.ok((await shelfLabels.first().innerText()).includes("unreadable"));
  assert.ok((await shelfLabels.count()) > 0);
  assert.deepEqual(
    [...new Set(await shelfLabels.locator(".sa-chip").allInnerTexts())],
    ["price reason: unreadable"],
  );
  assert.equal(
    await shelfLabels.locator(".sa-chip").count(),
    await shelfLabels.count(),
  );
  // v10: no price time on the labels or in the details drawer ("Feed price": the price only).
  const priceTime = /\bago\b|just now|price updated|price time|less than 1 min|\d+h \d+m/i;
  assert.doesNotMatch(await page.locator(".stock-section").innerText(), priceTime);
  await shelfLabels.first().locator("button.sa-more").click();
  const feedRow = page
    .locator("#sa-drawer dl > div")
    .filter({ has: page.locator("dt", { hasText: /^Feed price$/ }) });
  assert.match(
    await feedRow.locator("dd").innerText(),
    /^(\$[\d,]+(\.\d+)?|unreadable \/ invalid feed)$/,
  );
  assert.doesNotMatch(await page.locator("#sa-drawer").innerText(), priceTime);
  await page.locator("#sa-drawer").getByRole("button", { name: "Close", exact: true }).click();
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
  // v22: the roles row now shows the recipient (the snapshot refreshed after
  // the execute).
  assert.equal(
    (await feeRow.innerText()).replace(/\s+/g, " ").trim(),
    "Fee recipient " + owner,
  );
  checks.push(
    "v22: the Owner roles panel shows the fee recipient: None before, the address after the FeeRecipient proposal executes",
  );
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
  // Changed Hours/Dst still govern the chain; the notice uses the approved short issue sentence.
  await warpTo(await saturday());
  assert.equal(Number((await rv("depositStatus", [[]]))[0]), 3);
  await page.reload();
  await nav("Deposit");
  await refresh();
  await page.getByText("Deposits will be back open when “outside deposit hours” is resolved.", {exact:true}).waitFor();
  // v11: closed, so the full status box.
  assert.deepEqual(await statusShown(), ["Deposits will be back open when “outside deposit hours” is resolved."]);
  checks.push("Saturday after the Hours change shows the approved short outside-hours closure notice");
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
  // v11: Disconnect adds no wallet request. Connect wallet is pressed only
  // in the Disconnect step; the v10 walk never pressed it.
  assert.deepEqual(
    [...new Set(asked)].sort(),
    [
      "eth_accounts",
      "eth_chainId",
      "eth_requestAccounts",
      "eth_sendTransaction",
    ],
  );
  assert.equal(revoked.length, 0);
  // v12: late account answer may not undo a later Disconnect, even when an
  // accountsChanged event arrived first. No transaction is sent by this case.
  emptyAccounts = true;
  await page.evaluate(()=>localStorage.removeItem("basket-disconnected-4663"));
  await page.reload();
  await page.waitForFunction(()=>window.__walletAnswers>=2);
  await page.locator('nav a[href="#redeem"]').click();
  await page.getByText("Connect the receiver wallet to read and claim its owed stocks.",{exact:true}).waitFor();
  assert.equal(await page.locator("section.claims").count(),0);
  emptyAccounts = false;
  holdConnect = true;
  await page.getByRole("button",{name:"Connect wallet",exact:true}).click();
  await page.waitForFunction(()=>[...document.querySelectorAll("button")].some(b=>b.textContent.includes("Connecting")));
  await page.evaluate(a=>window.__accounts([a]),currentAccount);
  await page.getByRole("button",{name:"Disconnect",exact:true}).click();
  const requestsAfterDisconnect=asked.length;
  assert.equal(typeof releaseConnect,"function");
  releaseConnect(); holdConnect=false;
  await page.getByRole("button",{name:"Connect wallet",exact:true}).waitFor();
  await page.waitForFunction(()=>![...document.querySelectorAll("button")].find(b=>b.textContent==="Connect wallet")?.disabled);
  assert.equal(await page.locator(".connected-address").count(),0);
  assert.equal(await page.evaluate(()=>localStorage.getItem("basket-disconnected-4663")),"1");
  assert.equal(asked.length,requestsAfterDisconnect);
  assert.match(await page.locator(".wallet-status").innerText(),/^Wallet disconnected from this page/);
  await walletAnswers(2,()=>page.getByRole("button",{name:"Connect wallet",exact:true}).click());
  await page.locator(".connected-address").waitFor();
  assert.equal(await page.evaluate(()=>localStorage.getItem("basket-disconnected-4663")),null);
  v12Checks.push("Late Connect: early account event, Disconnect, held reply dropped without request; normal Connect then succeeds; no-wallet quiet claims line");
  // v12 portable wide-font stress: force the complete bold line wider than
  // its available space, then require whole words inside the pill and panel.
  for(const name of ["Deposit","Redeem"]) {
    await nav(name); await page.setViewportSize({width:661,height:1000});
    const facts=await page.evaluate(()=>{
      const tag=document.querySelector(".hours-tag"),strong=tag.querySelector("strong"),panel=tag.closest("section.panel");
      const probe=strong.cloneNode(true);probe.style.cssText="position:fixed;white-space:nowrap;width:max-content;visibility:hidden";tag.append(probe);
      let spacing=0;while(probe.getBoundingClientRect().width<Math.max(240,tag.getBoundingClientRect().width+30)&&spacing<20){spacing+=0.25;tag.style.letterSpacing=spacing+"px";}
      const natural=probe.getBoundingClientRect().width;probe.remove();
      const r=tag.getBoundingClientRect(),p=panel.getBoundingClientRect(),tops=new Set(),bad=[];
      for(const m of strong.firstChild.textContent.matchAll(/\S+/g)){const range=document.createRange();range.setStart(strong.firstChild,m.index);range.setEnd(strong.firstChild,m.index+m[0].length);const rects=[...range.getClientRects()].filter(x=>x.width);rects.forEach(x=>tops.add(x.top));if(new Set(rects.map(x=>x.top)).size!==1||rects.some(x=>x.left<r.left||x.right>r.right||x.top<r.top||x.bottom>r.bottom))bad.push(m[0]);}
      return {natural,lines:tops.size,bad,inside:r.left>=p.left&&r.right<=p.right,overflow:document.documentElement.scrollWidth>innerWidth};
    });
    assert.ok(facts.natural>=240&&facts.lines>1&&facts.inside&&!facts.overflow,JSON.stringify(facts));assert.deepEqual(facts.bad,[]);
  }
  v12Checks.push("24/7 label: widened text wraps at whole words inside pill and panel at 661px on Deposit and Redeem");
  checks.push(...v12Checks, ...v13Checks, ...v14Checks);
  assert.deepEqual([...new Set(asked)].sort(),["eth_accounts","eth_chainId","eth_requestAccounts","eth_sendTransaction"]);
  if (process.env.BASKET_PREVIOUS_WALK) {
    const previous = JSON.parse(fs.readFileSync(process.env.BASKET_PREVIOUS_WALK,'utf8'));
    const serialized = JSON.parse(JSON.stringify(sends,(_,v)=>typeof v==='bigint'?String(v):v));
    assert.equal(serialized.length,70,'All 70 prior wallet sends retained');
    // The existing fork clock advances with real elapsed time. Only its derived deadlines vary by run.
    // The gate separately compares exact calldata/deadlines at six fixed clocks; send capture checks live clock above.
    const normalized=records=>records.map(record=>['deposit','redeem'].includes(record.functionName)?{...record,args:[...record.args.slice(0,-1),'browser-clock-plus-600']}:record);
    assert.deepEqual(normalized(serialized),normalized(previous.sends),'All 70 sends equal the previous walk apart from wall-clock-derived deadlines');
    // The previous record is the walk of the live commit: every one of its checks is here under the same name in
    // the same order, with none renamed or left out; v22 adds its four documented checks (named "v22: ...") and nothing else.
    assert.deepEqual(checks.filter((c) => !c.startsWith("v22: ")),previous.checks,'Every page check of the previous walk retained under its name, in order, and none added beyond the v22 ones');
    assert.equal(checks.filter((c) => c.startsWith("v22: ")).length,4,'The four v22 checks');
    // 2026-10-16, Add liquidity build: only Docs/Owner containers change; every state and position stays required.
    const expectedShots=previous.shots.map(file=>/^(empty|stocks25)-(docs|owner)-(1440|375)\.jpg$/.test(file)?file.replace(/\.jpg$/,'.webp'):file);
    assert.equal(previous.shots.filter(file=>/^(empty|stocks25)-(docs|owner)-(1440|375)\.jpg$/.test(file)).length,8);
    assert.deepEqual(shots,expectedShots,'Every prior screenshot retained in order with exact eight-name lossless mapping');
  }
  // SPEC 6/7: compare each protected page against the untouched v16 export.
  const vaultRpcCounts = await checkVaultRpc(browser, process.env.BASKET_BASELINE_DIST, path.resolve("../dist"), rpc);
  assert.equal(revoked.length,0);
  assert.deepEqual(issues,[]);
  assert.equal(losslessShots.length,8,'All four Docs and four Owner states are lossless');
  fs.writeFileSync(path.join(artifacts,'screenshot-packaging.json'),JSON.stringify({
    status:'Current successful walk; all 24 required states retained in their original order.',
    method:'Four full Docs and four full Owner PNG captures encoded as lossless WebP; exact RGBA equality checked independently in Pillow and the browser. The other sixteen JPEG captures retain quality 18.',
    count:24,losslessCount:8,files:losslessShots
  })+'\n');
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
        vaultRpcCounts,
        tokenomicsRequests: {before:beforeTokenomics,after:afterTokenomics},
        docsStorageWrites,
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
  proxy.closeAllConnections?.();
  proxy.close();
}

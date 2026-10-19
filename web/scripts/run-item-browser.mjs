// ITEM transaction evidence. Only this check's local fork receives fixture or mock-wallet transactions.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createPublicClient, http as transport, parseAbi, encodeFunctionData, decodeFunctionData, decodeFunctionResult, decodeEventLog, encodeFunctionResult, encodeAbiParameters, multicall3Abi, formatUnits, parseUnits, keccak256 } from 'viem';
import { KNOWN, LAUNCH, itemReady } from '../src/itemConstants.ts';
import { RUNTIME_HASH } from '../src/deployment.ts';

assert.ok(itemReady(), 'The ITEM walk requires a complete validated configuration.');
const config = JSON.parse(fs.readFileSync(process.env.BASKET_ITEM_CONFIG, 'utf8'));
for (const [key, value] of Object.entries(LAUNCH)) assert.equal(config[key], value, `${key}: built configuration matches walk input`);
const mock = '0x00000000000000000000000000000000000a11ce';
const zero = '0x0000000000000000000000000000000000000000';
const upstream = config.RPC;
const isLocal = url => ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname);
assert.ok(isLocal(upstream) || ['rpc.mainnet.chain.robinhood.com', 'robinhood-rpc.publicnode.com'].includes(new URL(upstream).hostname), 'Only an approved chain RPC or local fixture RPC is permitted.');
const reuse = config.STANDINS === true && isLocal(upstream);
const rpc = reuse ? upstream : 'http://127.0.0.1:9523';
assert.ok(isLocal(rpc), 'Transactions are restricted to a local fork.');
const artifacts = path.resolve('../artifacts');
fs.mkdirSync(artifacts, { recursive: true });
const tokenAbi = parseAbi(['function balanceOf(address) view returns(uint256)', 'function allowance(address,address) view returns(uint256)', 'function approve(address,uint256) returns(bool)', 'function transfer(address,uint256) returns(bool)', 'function deposit() payable', 'function burn(address) returns(uint256,uint256)']);
const vaultAbi = JSON.parse(fs.readFileSync(new URL('../src/vault.abi.json', import.meta.url), 'utf8'));
const gaugeAbi = parseAbi(['function started() view returns(bool)', 'function pair() view returns(address)', 'function ALLOCATION() view returns(uint256)', 'function totalStaked() view returns(uint256)', 'function staked(address) view returns(uint256)', 'function earned(address) view returns(uint256)', 'function released() view returns(uint256)', 'function remaining() view returns(uint256)', 'function rate() view returns(uint256)', 'function start()', 'function stake(uint256)', 'function withdraw(uint256)', 'function claim()']);
const stakingAbi = parseAbi(['function totalStaked() view returns(uint256)', 'function staked(address) view returns(uint256)', 'function earned(address,address) view returns(uint256)', 'function stake(uint256)', 'function unstake(uint256)', 'function claim(address)', 'function sync(address)']); // 2026-10-17, round-3 review: the public sync, for the fixture dust stream.
// 2026-10-16 Add liquidity build: independent router and pair encodings for the five new sends.
const pairAbi = parseAbi(['function getReserves() view returns(uint112,uint112,uint32)', 'function token0() view returns(address)', 'function totalSupply() view returns(uint256)', 'function sync()', 'event Transfer(address indexed from,address indexed to,uint256 value)', 'event Mint(address indexed sender,uint256 amount0,uint256 amount1)']);
const routerAbi = parseAbi(['function addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256) returns(uint256,uint256,uint256)', 'function addLiquidityETH(address,uint256,uint256,uint256,address,uint256) payable returns(uint256,uint256,uint256)']);
const READS = new Set(['eth_chainId', 'net_version', 'web3_clientVersion', 'eth_blockNumber', 'eth_getBlockByNumber', 'eth_getBlockByHash', 'eth_getBlockReceipts', 'eth_getBalance', 'eth_getTransactionCount', 'eth_getCode', 'eth_getStorageAt', 'eth_getProof', 'eth_getAccount', 'eth_getAccountInfo', 'eth_call', 'eth_gasPrice', 'eth_maxPriorityFeePerGas', 'eth_feeHistory', 'eth_getTransactionByHash', 'eth_getTransactionByBlockNumberAndIndex', 'eth_getTransactionReceipt', 'eth_estimateGas']);
let requestId = 0;
async function rpcAt(url, method, params = []) {
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++requestId, method, params }), signal: AbortSignal.timeout(60000) });
  assert.ok(response.ok, `${method}: HTTP ${response.status}`);
  const json = await response.json();
  if (json.error) throw new Error(`${method}: ${json.error.message}`);
  return json.result;
}
const local = (method, params = []) => rpcAt(rpc, method, params);
const client = createPublicClient({ transport: transport(rpc, { timeout: 60000, retryCount: 0 }), ccipRead: false, batch: { multicall: false } });
const read = (address, abi, functionName, args = []) => client.readContract({ address, abi, functionName, args });
const balance = (token, account = mock) => read(token, tokenAbi, 'balanceOf', [account]);
const encode = (abi, functionName, args = []) => encodeFunctionData({ abi, functionName, args });
const lower = value => value.toLowerCase();
const checks = [], sends = [], fixtureSends = [], states = [], rpcLog = [], rpcByRoute = {};
const rewardComparisons = [], liquidityComparisons = [];
const walletRequests = [];
let liquidityReadHold, walletSendAttempts = 0, faultCall = null;
// 2026-10-17, round-4 review: the proof sends of the account-switch check (outside the seventeen), the account the mock wallet
// reports, and the lock check's late-failing reads.
const proofSends = [];
let walletAccount = mock, lockReadFault = null;
// 2026-10-17, v22 rebase: one hash lookup method fails for one hash (on both hosts, which the route serves alike) while every other read answers.
let lookupFault = null, lookupFaultEvidence = [];
const vaultValuesSeen = {};
let dollarValuation;
const shots = [];
let snapshot, anvil, proxy, server, browser, context, page, currentRoute = 'initial', fixture = null, expected = null, walletConnected = false;
let oldAutoMine;
function pass(text) { checks.push(text); console.log(`PASS ${text}`); }
async function fixtureSend(from, to, abi, fn, args = [], value) {
  assert.ok([KNOWN.OWNER, KNOWN.DEV, mock].map(lower).includes(lower(from)), 'Only owner, dev and the made-up mock account can be impersonated.');
  await local('anvil_impersonateAccount', [from]);
  await local('anvil_setBalance', [from, '0x56bc75e2d63100000']);
  const data = encode(abi, fn, args);
  const hash = await local('eth_sendTransaction', [{ from, to, data, gas: '0x1c9c380', ...(value ? { value: `0x${value.toString(16)}` } : {}) }]);
  const receipt = await client.waitForTransactionReceipt({ hash });
  assert.equal(receipt.status, 'success', `Fixture ${fn} succeeded.`);
  fixtureSends.push({ from, to, functionName: fn, data, hash, fixture: true });
  return receipt;
}
async function donor(token, minimum = 1n) {
  for (const account of [KNOWN.OWNER, KNOWN.DEV]) if (await balance(token, account) >= minimum) return account;
  throw new Error(`No authorized owner/dev donor holds enough ${token}.`);
}
async function ensureGauge(address) {
  if (await read(address, gaugeAbi, 'started')) return;
  const allocation = await read(address, gaugeAbi, 'ALLOCATION');
  const account = await donor(LAUNCH.ITEM, allocation);
  await fixtureSend(account, LAUNCH.ITEM, tokenAbi, 'approve', [address, allocation]);
  await fixtureSend(account, address, gaugeAbi, 'start');
}
async function ensureMockToken(token, target) {
  if (await balance(token) >= target) return;
  const account = await donor(token, target);
  await fixtureSend(account, token, tokenAbi, 'transfer', [mock, target]);
}
async function fundFees() {
  // 2026-10-17, audit review: the dev wallet's BASK/USDG pool tokens are redeemed on the local snapshot whenever the dev
  // wallet lacks working BASK or USDG for the liquidity fixture below (before: only when owner and dev both held zero
  // BASK, so vault fees paid to the dev wallet before the captured block, or BASK dust in the owner wallet, failed the walk at send 13).
  if ((await balance(KNOWN.BASK, KNOWN.DEV)) < 10n ** 17n || (await balance(KNOWN.USDG, KNOWN.DEV)) < 10n ** 5n) {
    const lp = await balance(KNOWN.BASK_USDG_PAIR, KNOWN.DEV) / 10n;
    assert.ok(lp > 0n, 'The authorized dev wallet holds BASK/USDG pool tokens to redeem on the local fork.');
    await fixtureSend(KNOWN.DEV, KNOWN.BASK_USDG_PAIR, tokenAbi, 'transfer', [KNOWN.BASK_USDG_PAIR, lp]);
    await fixtureSend(KNOWN.DEV, KNOWN.BASK_USDG_PAIR, tokenAbi, 'burn', [KNOWN.DEV]);
  }
  // 2026-10-17, round-3 review: anyone can start a BASK stream in ItemStaking before the captured block (one wei sent to it and a
  // public sync while nothing is staked); by the text a live stream is never restarted and later amounts wait behind it, so the
  // fee below streams only once it has run its seven staked days. The walk puts such a stream on the fork itself, before the fee,
  // so the recovery (seven staked days and a sync before the earnings are read) is proved in every run; on a launch day where one
  // already exists the fixture's sync finds the live stream and its wei waits too: the two cases converge. No view exposes a
  // stream, so nothing is read; the stake at the time is recorded, not required (a stranger's early stake must not fail the kit).
  const stakedAtDust = await read(LAUNCH.ITEM_STAKING, stakingAbi, 'totalStaked');
  const dustDonor = await donor(KNOWN.BASK, 2n);
  await fixtureSend(dustDonor, KNOWN.BASK, tokenAbi, 'transfer', [LAUNCH.ITEM_STAKING, 1n]);
  await fixtureSend(KNOWN.OWNER, LAUNCH.ITEM_STAKING, stakingAbi, 'sync', [KNOWN.BASK]);
  const amounts = { dustStream: { wei: '1', totalStakedAtSync: stakedAtDust.toString() } };
  for (const [name, maximum] of [['BASK', 10n ** 15n]]) {
    const account = await donor(KNOWN[name], 2n * maximum); // 2026-10-17, audit review: a wallet holding dust alone is never the fee donor.
    const held = await balance(KNOWN[name], account);
    const amount = held / 2n < maximum ? held / 2n : maximum;
    assert.ok(amount > 0n, `${name} fees are nonzero.`);
    await fixtureSend(account, KNOWN[name], tokenAbi, 'transfer', [LAUNCH.ITEM_STAKING, amount]);
    amounts[name] = amount.toString();
  }
  return amounts;
}
function callsIn(transaction) {
  try {
    const decoded = decodeFunctionData({ abi: multicall3Abi, data: transaction.data });
    if (decoded.functionName === 'aggregate3') return decoded.args[0].map(call => ({ to: call.target, data: call.callData }));
  } catch { /* ordinary direct call */ }
  return [transaction];
}
const itemTargets = new Set([LAUNCH.ITEM, LAUNCH.ITEM_STAKING, LAUNCH.BASK_USDG_GAUGE, LAUNCH.ITEM_ETH_GAUGE, LAUNCH.DEV_VESTING, LAUNCH.ITEM_WETH_PAIR, KNOWN.BASK_USDG_PAIR].map(lower));
function isItemCall(transaction) {
  if (itemTargets.has(lower(transaction.to ?? zero))) return true;
  try { const call = decodeFunctionData({ abi: tokenAbi, data: transaction.data }); return call.functionName === 'balanceOf' && lower(call.args[0]) === lower(LAUNCH.ITEM_STAKING); } catch { return false; }
}
const resultOf = (type, value) => encodeAbiParameters([{ type }], [value]);
function rememberVaultValue(transaction, data) {
  if (lower(transaction.to ?? zero) !== lower(KNOWN.BASK)) return;
  let name;
  try { name = decodeFunctionData({ abi: vaultAbi, data: transaction.data }).functionName; } catch { return; }
  if (!['allAssets', 'totalSupply'].includes(name)) return;
  vaultValuesSeen[name] = undefined;
  try { vaultValuesSeen[name] = decodeFunctionResult({ abi: vaultAbi, functionName: name, data }); } catch { /* An unreadable snapshot cannot establish a valuation. */ }
}
function fixtureResult(transaction) {
  if (!fixture) return undefined;
  const to = lower(transaction.to ?? zero), data = transaction.data ?? '0x';
  const fn = data.slice(0, 10);
  const started = encode(gaugeAbi, 'started');
  const pair = encode(gaugeAbi, 'pair');
  if (fixture === 'not-started' && to === lower(LAUNCH.BASK_USDG_GAUGE) && data === started) return resultOf('bool', false);
  if (fixture === 'pair-mismatch' && to === lower(LAUNCH.BASK_USDG_GAUGE) && data === pair) return resultOf('address', LAUNCH.ITEM_WETH_PAIR);
  if (fixture === 'unseeded' && [KNOWN.BASK_USDG_PAIR, LAUNCH.ITEM_WETH_PAIR].map(lower).includes(to) && data === encode(pairAbi, 'getReserves')) return encodeFunctionResult({ abi: pairAbi, functionName: 'getReserves', result: [0n, 0n, 0] });
  if (fixture === 'empty-wallet' && isItemCall(transaction)) {
    const user = `0x${data.slice(34, 74)}`;
    if (lower(user) === lower(mock) && [encode(tokenAbi, 'balanceOf', [mock]).slice(0, 10), encode(tokenAbi, 'allowance', [mock, LAUNCH.ITEM_STAKING]).slice(0, 10), encode(gaugeAbi, 'staked', [mock]).slice(0, 10), encode(gaugeAbi, 'earned', [mock]).slice(0, 10), encode(stakingAbi, 'earned', [mock, KNOWN.BASK]).slice(0, 10)].includes(fn)) return resultOf('uint256', 0n);
  }
  if (fixture === 'roles-unavailable' && to === lower(KNOWN.BASK)) {
    for (const role of ['owner', 'guardian']) if (data === encode(vaultAbi, role)) return '0x';
  }
  return undefined;
}
async function pageRpc(query) {
  assert.ok(READS.has(query.method), `Application HTTP RPC is read-only: ${query.method}`);
  const stats = rpcByRoute[currentRoute] ??= { requests: 0, itemCalls: 0, methods: {} };
  stats.requests++; stats.methods[query.method] = (stats.methods[query.method] ?? 0) + 1;
  const calls = query.method === 'eth_call' ? callsIn(query.params[0]) : [];
  for (const transaction of calls) { rpcLog.push({ method: query.method, ...transaction, route: currentRoute, fixture }); if (isItemCall(transaction)) stats.itemCalls++; }
  if (query.method === 'eth_getCode') rpcLog.push({ method: query.method, to: query.params[0], route: currentRoute, fixture });
  // 2026-10-16 Add liquidity build: delay one actual quote batch to exercise Disconnect during its await.
  if (liquidityReadHold && !liquidityReadHold.held && calls.some(call => lower(call.to) === lower(KNOWN.BASK_USDG_PAIR) && call.data === encode(pairAbi, 'getReserves'))) {
    const hold = liquidityReadHold;
    hold.held = true; hold.id = query.id; hold.entered();
    await hold.release;
  }
  // 2026-10-17, round-4 review: the lock check's transaction and count reads for one record are held, then fail (on both
  // RPC hosts), so an older check of that record ends only after a newer one has settled it.
  if (lockReadFault && ((query.method === 'eth_getTransactionByHash' && lower(String(query.params[0])) === lower(lockReadFault.hash)) || (query.method === 'eth_getTransactionCount' && lower(String(query.params[0])) === lower(lockReadFault.account)))) {
    const fault = lockReadFault;
    fault.entered++; await fault.release; fault.answered++; fault.lastAnswer = Date.now();
    return { jsonrpc: '2.0', id: query.id, error: { code: -32000, message: 'Injected late read failure.' } };
  }
  if (lookupFault && query.method === lookupFault.method && lower(String(query.params[0])) === lower(lookupFault.hash)) {
    lookupFault.answered++;
    return { jsonrpc: '2.0', id: query.id, error: { code: -32000, message: 'Injected lookup failure.' } };
  }
  let result = await local(query.method, query.params);
  // 2026-10-17, pre-launch review: one named read fails while every other read succeeds.
  if (faultCall && query.method === 'eth_call') {
    if (calls.length > 1 || query.params[0].data?.startsWith('0x82ad56cb')) {
      const values = decodeFunctionResult({ abi: multicall3Abi, functionName: 'aggregate3', data: result });
      result = encodeFunctionResult({ abi: multicall3Abi, functionName: 'aggregate3', result: values.map((value, i) => faultCall(calls[i]) ? { success: false, returnData: '0x' } : value) });
    } else if (faultCall(calls[0])) return { jsonrpc: '2.0', id: query.id, error: { code: -32000, message: 'Injected read failure.' } };
  }
  if (fixture && query.method === 'eth_call') {
    if (calls.length > 1 || query.params[0].data?.startsWith('0x82ad56cb')) {
      const values = decodeFunctionResult({ abi: multicall3Abi, functionName: 'aggregate3', data: result });
      const patched = values.map((value, i) => { const replacement = fixtureResult(calls[i]); return replacement === undefined ? value : { success: true, returnData: replacement }; });
      result = encodeFunctionResult({ abi: multicall3Abi, functionName: 'aggregate3', result: patched });
    } else result = fixtureResult(calls[0]) ?? result;
  }
  if (query.method === 'eth_call') {
    if (calls.length > 1 || query.params[0].data?.startsWith('0x82ad56cb')) {
      const values = decodeFunctionResult({ abi: multicall3Abi, functionName: 'aggregate3', data: result });
      calls.forEach((call, i) => rememberVaultValue(call, values[i].returnData));
    } else rememberVaultValue(calls[0], result);
  }
  return { jsonrpc: '2.0', id: query.id, result };
}
function expectedText(value, decimals = 18, pool = false) {
  const scale = 10n ** BigInt(decimals), integer = value / scale, remainder = value % scale;
  const digits = remainder.toString().padStart(decimals, '0').slice(0, pool ? decimals : Math.min(decimals, 6)).replace(/0+$/, '');
  return value > 0n && integer === 0n && !digits ? '<0.000001' : integer.toLocaleString('en-US') + (digits ? '.' + digits : '');
}
async function ready() {
  // 2026-10-16, Earn layout build (option B3): both pool cards stay mounted; the one the Pool selector names is the visible one.
  await page.locator('[data-item-card="bask"]').waitFor({ state: 'attached' });
  await page.locator('[data-pool-view]:not([hidden]) [data-item-card]').waitFor();
  await page.waitForFunction(() => !document.querySelector('.item-refresh [role="status"]') && !document.querySelector('.item-refresh button')?.disabled, null, { timeout: 60000 });
  assert.equal(await page.getByText('ITEM figures: unreadable. Retry.', { exact: true }).count(), 0);
}
async function refresh() { await page.locator('.item-refresh button').click(); await ready(); }
// 2026-10-16, Earn layout build (option B3): the Pool selector shows one pool card at a time, each card's actions sit in
// tabs (Add liquidity, Stake, Manage, Pool stats; ITEM staking: Stake, Manage, Staking stats) and the withdraw form and
// the liquidity details sit in disclosures. The walk drives the selector, the tabs and the disclosures the way a visitor
// does, right before each action; every send below keeps its original order, inputs and assertions.
const TABS = { bask: ['Add liquidity', 'Stake', 'Manage', 'Pool stats'], eth: ['Add liquidity', 'Stake', 'Manage', 'Pool stats'], staking: ['Stake', 'Manage', 'Staking stats'] };
const PLACE = { 'Approve BASK': 'Add liquidity', 'Approve USDG': 'Add liquidity', 'Approve ITEM': 'Add liquidity', 'Add liquidity': 'Add liquidity', Approve: 'Stake', Stake: 'Stake', Withdraw: 'Manage', Unstake: 'Manage', 'Use full staked amount': 'Manage', 'Claim ITEM': 'Manage', 'Claim BASK': 'Manage' };
const WITHDRAW = { bask: 'Withdraw pool tokens', eth: 'Withdraw pool tokens', staking: 'Unstake ITEM' };
const visited = { pools: new Set(), tabs: new Set(), disclosures: new Set(), keyboard: new Set() };
const typingEvidence = [];
const card = prefix => page.locator(`[data-item-card="${prefix}"]`);
async function showCard(prefix) {
  if (prefix === 'staking') return;
  const select = page.locator('#earn-pool-select');
  if (await select.inputValue() !== prefix) await select.selectOption(prefix);
  await page.locator(`[data-pool-view="${prefix}"]:not([hidden]) [data-item-card="${prefix}"]`).waitFor();
  assert.equal(await page.locator('[data-pool-view]:not([hidden])').count(), 1, 'The Pool selector shows exactly one pool card.');
  assert.equal(await page.locator('[data-pool-view][hidden] [data-item-card]').count(), 1, 'The other pool card stays mounted while hidden.');
  visited.pools.add(prefix);
}
async function openTab(prefix, name) {
  await showCard(prefix);
  const tab = card(prefix).getByRole('tab', { name, exact: true });
  if (await tab.getAttribute('aria-selected') !== 'true') await tab.click();
  const panel = page.locator('#' + await tab.getAttribute('aria-controls'));
  await panel.waitFor();
  assert.equal(await card(prefix).locator('[role="tabpanel"]:not([hidden])').count(), 1, `${prefix}: one tab panel shows at a time.`);
  visited.tabs.add(`${prefix}: ${name}`);
  return panel;
}
async function openDisclosure(prefix, summary) {
  const details = card(prefix).locator(`details:has(summary:text-is("${summary}"))`);
  assert.equal(await details.count(), 1, `${prefix}: one "${summary}" disclosure`);
  if (!(await details.evaluate(node => node.open))) await details.locator('summary').click();
  await details.locator(':scope > :not(summary)').first().waitFor();
  visited.disclosures.add(`${prefix}: ${summary}`);
  return details;
}
async function reach(prefix, label) {
  assert.ok(PLACE[label], `${label}: every walked action has a known tab`);
  await openTab(prefix, PLACE[label]);
  if (['Withdraw', 'Unstake', 'Use full staked amount'].includes(label)) await openDisclosure(prefix, WITHDRAW[prefix]);
}
const parseAmount = text => { if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(text)) return undefined; const amount = parseUnits(text, 18); return amount > 0n && amount < 2n ** 256n ? amount : undefined; };
function textBox() {
  // A plain text box: value, caret and selection anchor, moved only by the keys the typing check presses.
  const box = { value: '', caret: 0, anchor: 0 };
  const selection = () => [Math.min(box.caret, box.anchor), Math.max(box.caret, box.anchor)];
  const insert = text => { const [from, to] = selection(); box.value = box.value.slice(0, from) + text + box.value.slice(to); box.caret = box.anchor = from + text.length; };
  function press(key) {
    const [from, to] = selection();
    if (key === 'Backspace') { if (from !== to) insert(''); else if (from > 0) { box.value = box.value.slice(0, from - 1) + box.value.slice(from); box.caret = box.anchor = from - 1; } }
    else if (key === 'Delete') { if (from !== to) insert(''); else box.value = box.value.slice(0, from) + box.value.slice(from + 1); }
    else if (key === 'ArrowLeft') box.caret = box.anchor = from !== to ? from : Math.max(0, from - 1);
    else if (key === 'ArrowRight') box.caret = box.anchor = from !== to ? to : Math.min(box.value.length, from + 1);
    else if (key === 'Home') box.caret = box.anchor = 0;
    else if (key === 'End') box.caret = box.anchor = box.value.length;
    else if (key === 'Control+a') { box.anchor = 0; box.caret = box.value.length; }
    else if (key.length === 1) insert(key);
    else throw new Error(`The typing check has no model for the key ${key}.`);
  }
  return { box, insert, press };
}
async function figures(prefix) {
  const gauge = prefix !== 'staking', address = prefix === 'bask' ? LAUNCH.BASK_USDG_GAUGE : prefix === 'eth' ? LAUNCH.ITEM_ETH_GAUGE : LAUNCH.ITEM_STAKING;
  const abi = gauge ? gaugeAbi : stakingAbi, token = prefix === 'bask' ? KNOWN.BASK_USDG_PAIR : prefix === 'eth' ? LAUNCH.ITEM_WETH_PAIR : LAUNCH.ITEM;
  const values = { balance: await balance(token), staked: await read(address, abi, 'staked', [mock]), totalStaked: await read(address, abi, 'totalStaked') };
  if (gauge) for (const fn of ['earned', 'released', 'remaining', 'rate']) values[fn] = await read(address, abi, fn, fn === 'earned' ? [mock] : []);
  else values.BASK = await read(address, abi, 'earned', [mock, KNOWN.BASK]);
  for (const [key, value] of Object.entries(values)) {
    const unit = key === 'rate' ? 'ITEM a day' : gauge && ['balance', 'staked', 'totalStaked'].includes(key) ? 'pool tokens' : ['BASK', 'USDG', 'WETH'].includes(key) ? key : 'ITEM';
    const text = expectedText(key === 'rate' ? value * 86400n : value, key === 'USDG' ? 6 : 18, unit === 'pool tokens') + ' ' + unit;
    assert.equal((await page.locator(`[data-figure="${prefix}.${key}"]`).textContent()).trim(), text, `${prefix}.${key}: DOM agrees with chain`);
  }
  const share = values.totalStaked && values.staked ? values.staked * 100n * 10n ** 18n / values.totalStaked : 0n;
  const shareText = values.staked && values.totalStaked && share === 0n ? '<0.000001%' : expectedText(share) + '%';
  assert.equal((await page.locator(`[data-figure="${prefix}.share"]`).textContent()).trim(), shareText, `${prefix}.share: DOM agrees with chain`);
  if (gauge) {
    values.dailyPerToken = values.totalStaked ? values.rate * 86400n * 10n ** 18n / values.totalStaked : 0n;
    values.daily = values.totalStaked ? values.rate * 86400n * values.staked / values.totalStaked : 0n;
    for (const key of ['dailyPerToken', 'daily']) assert.equal((await page.locator(`[data-figure="${prefix}.${key}"]`).textContent()).trim(), expectedText(values[key]) + ' ITEM a day', `${prefix}.${key}: daily figure independently agrees with rate and stakes`);
  } else {
    values.pot = await balance(KNOWN.BASK, LAUNCH.ITEM_STAKING);
    values.estimatedBASK = values.totalStaked ? values.pot * values.staked / values.totalStaked : 0n;
    assert.equal((await page.locator('[data-figure="staking.pot"]').textContent()).trim(), expectedText(values.pot) + ' BASK', 'BASK fee pot agrees with the vault token balance.');
    assert.equal((await page.locator('[data-figure="staking.estimatedBASK"]').textContent()).trim(), expectedText(values.estimatedBASK) + ' BASK (of which ' + expectedText(values.BASK) + ' already earned)', 'Estimated BASK equals pot times share, with earned BASK identified.');
  }
  return values;
}
async function stakingDollarValue() {
  // Decode the vault responses already seen by the browser, so the comparison
  // uses the displayed snapshot even after the local reward clock advances.
  await page.waitForFunction(() => document.querySelector('[data-figure="staking.USDValue"]')?.textContent !== 'Reading...');
  const assets = vaultValuesSeen.allAssets, supply = vaultValuesSeen.totalSupply;
  const earned = await read(LAUNCH.ITEM_STAKING, stakingAbi, 'earned', [mock, KNOWN.BASK]);
  assert.ok(Array.isArray(assets) && typeof supply === 'bigint', 'Existing vault responses supplied readable valuation inputs.');
  let nav = 0n, readable = true, indicative = false;
  for (const asset of assets) {
    if (asset.managedBalance !== 0n && Number(asset.reason) !== 0) indicative = true;
    if (asset.config.retired || asset.managedBalance === 0n) continue;
    if (asset.answer <= 0n) { readable = false; continue; }
    nav += asset.managedBalance * asset.answer * 10n ** 18n / 10n ** BigInt(asset.config.tokenDecimals + asset.config.feedDecimals);
  }
  let expectedValue = 'Unavailable';
  if (readable && supply > 0n) {
    const numerator = earned * nav, centDenominator = supply * 10n ** 16n;
    const cents = numerator / centDenominator;
    expectedValue = numerator > 0n && cents === 0n ? '<$0.01' : '$' + (cents / 100n).toLocaleString('en-US') + '.' + (cents % 100n).toString().padStart(2, '0');
    if (indicative) expectedValue += ' (indicative)';
  }
  assert.equal((await page.locator('[data-figure="staking.USDValue"]').textContent()).trim(), expectedValue, 'Dollar estimate independently equals unclaimed BASK times vault NAV divided by total BASK supply.');
  assert.ok(earned > 0n && nav > 0n && supply > 0n, 'Dollar comparison exercises positive earned BASK and a nonzero vault valuation.');
  assert.equal(await page.getByText("Unclaimed rewards, paid in BASK. The USD estimate uses the vault's last read, not a sale price.", { exact: true }).count(), 1);
  dollarValuation = { earnedBask: earned.toString(), vaultNav: nav.toString(), baskSupply: supply.toString(), indicative, displayed: expectedValue, source: 'Existing browser vault snapshot responses; no extra application RPC reads.' };
  pass('Earn dollar estimate matches independent BASK times vault NAV divided by supply, with the last-read valuation explanation.');
}
async function baskOnlyStaking() {
  const text = await page.locator('[data-item-card="staking"]').textContent();
  assert.ok(!/USDG|WETH|Other token rewards|Other rewards/.test(text), 'Staking card contains no optional reward sections, balances or claim buttons.');
  assert.equal(await page.locator('[data-figure="staking.USDG"], [data-figure="staking.WETH"]').count(), 0);
  for (const name of ['Claim USDG', 'Claim WETH']) assert.equal(await page.getByRole('button', { name, exact: true }).count(), 0);
  const earnedSelector = encode(stakingAbi, 'earned', [mock, KNOWN.BASK]).slice(0, 10);
  const rewardCalls = rpcLog.filter(call => call.route === 'earn' && lower(call.to ?? zero) === lower(LAUNCH.ITEM_STAKING) && call.data?.startsWith(earnedSelector));
  assert.ok(rewardCalls.length > 0, 'Earn performed BASK reward reads.');
  for (const call of rewardCalls) assert.equal(call.data, encode(stakingAbi, 'earned', [mock, KNOWN.BASK]), 'Earn reads no USDG or WETH reward balances.');
  pass('ITEM staking shows BASK rewards and their USD estimate only; optional-token sections, claims and Earn reward reads are absent.');
}
async function capture(name, selector, detail = '') {
  const previousViewport = page.viewportSize();
  await page.setViewportSize({ width: 375, height: 900 });
  const buffer = await page.locator(selector).screenshot({ type: 'jpeg', quality: 65, animations: 'disabled' });
  await page.setViewportSize(previousViewport);
  assert.ok(buffer.length > 1000, `${name}: nonempty evidence image`);
  shots.push({ name, buffer, detail, fixture });
  states.push({ name, fixture: fixture ?? false, detail });
}
async function send(prefix, label, to, abi, fn, args = [], value, liquidity) {
  assert.equal(expected, null);
  const before = await figures(prefix);
  const data = encode(abi, fn, args), index = sends.length;
  let resolveSend, rejectSend;
  const sent = new Promise((resolve, reject) => { resolveSend = resolve; rejectSend = reject; });
  expected = { to, data, prefix, label, fn, args, value, liquidity, since: rpcLog.length, resolve: resolveSend, reject: rejectSend };
  await reach(prefix, label); // 2026-10-16, Earn layout build: open the tab (and disclosure) that holds this action first.
  await Promise.all([card(prefix).getByRole('button', { name: label, exact: true }).click(), sent]);
  await page.waitForFunction(({ prefix, label }) => document.querySelector(`[data-item-card="${prefix}"]`)?.textContent.includes(`${label}: Confirmed.`) && !document.querySelector('.item-refresh button')?.disabled, { prefix, label }, { timeout: 60000 });
  await ready();
  assert.equal(sends.length, index + 1, 'One wallet prompt creates one send.');
  const after = await figures(prefix);
  if (fn === 'stake') { assert.equal(after.staked - before.staked, args[0]); assert.equal(before.balance - after.balance, args[0]); }
  if (fn === 'withdraw' || fn === 'unstake') { assert.equal(before.staked - after.staked, args[0]); assert.equal(after.balance - before.balance, args[0]); }
  if (fn === 'approve') { const allowance = await read(to, tokenAbi, 'allowance', [mock, args[0]]); assert.equal(allowance, args[1], 'Approval is exactly the entered stake amount.'); }
  sends[index].figuresBefore = Object.fromEntries(Object.entries(before).map(([key, value]) => [key, value.toString()]));
  sends[index].figuresAfter = Object.fromEntries(Object.entries(after).map(([key, value]) => [key, value.toString()]));
  pass(`${sends.length}/17 ${prefix} ${label}: exact calldata${value === undefined ? '' : ' and ETH value'} and chain/DOM agreement`);
}
async function poolState(prefix) {
  const pair = prefix === 'bask' ? KNOWN.BASK_USDG_PAIR : LAUNCH.ITEM_WETH_PAIR;
  const token = prefix === 'bask' ? KNOWN.BASK : LAUNCH.ITEM;
  const [reserves, token0, supply, lp, tokenBalance, quoteBalance] = await Promise.all([
    read(pair, pairAbi, 'getReserves'), read(pair, pairAbi, 'token0'), read(pair, pairAbi, 'totalSupply'), balance(pair), balance(token),
    prefix === 'bask' ? balance(KNOWN.USDG) : client.getBalance({ address: mock }),
  ]);
  const first = lower(token0) === lower(token);
  return { pair, token, first, reserve: reserves[first ? 0 : 1], quoteReserve: reserves[first ? 1 : 0], supply, lp, tokenBalance, quoteBalance };
}
async function liquidityFigures(prefix, amount, state) {
  const matched = amount * state.quoteReserve / state.reserve;
  const tokenMint = amount * state.supply / state.reserve, quoteMint = matched * state.supply / state.quoteReserve;
  const estimate = tokenMint < quoteMint ? tokenMint : quoteMint;
  for (const [key, value, decimals, unit, pool] of [
    ['matched', matched, prefix === 'bask' ? 6 : 18, prefix === 'bask' ? 'USDG' : 'ETH', false],
    ['liquidityEstimate', estimate, 18, 'pool tokens', true],
    ['tokenBalance', state.tokenBalance, 18, prefix === 'bask' ? 'BASK' : 'ITEM', false],
    ['quoteBalance', state.quoteBalance, prefix === 'bask' ? 6 : 18, prefix === 'bask' ? 'USDG' : 'ETH', false],
  ]) assert.equal((await page.locator(`[data-figure="${prefix}.${key}"]`).textContent()).trim(), expectedText(value, decimals, pool) + ' ' + unit, `${prefix}.${key}: liquidity form agrees with fresh pair and wallet state`);
  return { matched, estimate };
}
async function disconnectDuringLiquidityRead(amount) {
  assert.equal(expected, null);
  const beforeSends = sends.length, beforePrompts = walletSendAttempts, beforeRequests = walletRequests.length;
  let entered, release, waitTimer;
  const waiting = new Promise((resolve, reject) => { entered = resolve; waitTimer = setTimeout(() => reject(new Error('The liquidity quote did not reach its held reserve read.')), 60000); });
  const delayed = new Promise(resolve => { release = resolve; });
  const hold = { entered, release: delayed, held: false, id: undefined };
  liquidityReadHold = hold;
  try {
    await Promise.all([page.locator('[data-liquidity="bask"]').getByRole('button', { name: 'Add liquidity', exact: true }).click(), waiting]);
    assert.equal(hold.held, true, 'The actual Add liquidity reserve batch is still pending.');
    await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
    await page.getByRole('button', { name: 'Connect wallet', exact: true }).waitFor();
    await ready();
    assert.equal(await page.locator('[data-figure="bask.balance"]').count(), 0, 'Disconnect removes the wallet card while its old quote awaits.');
    const response = page.waitForResponse(reply => {
      const payload = reply.request().postDataJSON();
      return (Array.isArray(payload) ? payload : [payload]).some(query => query?.id === hold.id);
    });
    release();
    await (await response).finished();
    // Drain the delivered response's promise continuations before asserting that no preflight started.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(walletRequests.length, beforeRequests, 'A disconnected pending quote never starts wallet preflight.');
    assert.equal(walletSendAttempts, beforePrompts, 'Disconnect during a pending quote produces no wallet prompt.');
    assert.equal(sends.length, beforeSends, 'Disconnect during a pending quote produces no transaction.');
  } finally { clearTimeout(waitTimer); release(); liquidityReadHold = undefined; }
  await page.getByRole('button', { name: 'Connect wallet', exact: true }).click();
  // 2026-10-17, round-2 review: the reconnected account's figures must be on the page before a tab is read; the cards remount when the account changes.
  await page.locator('[data-figure="bask.balance"]').first().waitFor({ state: 'attached' }); await ready();
  await openTab('bask', 'Add liquidity');
  await page.locator('#bask-add').fill(formatUnits(amount, 18));
  assert.ok(await page.locator('[data-liquidity="bask"]').getByRole('button', { name: 'Add liquidity', exact: true }).isEnabled(), 'A deliberate reconnect retains exact approvals and can add normally.');
  pass('Disconnect during the fresh liquidity read cancels before wallet preflight or any prompt; deliberate reconnect can add normally.');
}
// 2026-10-17, audit review: the pool moves after the page quoted; the press must refresh the figures and send nothing.
async function quoteMovedBeforePress(prefix, amount) {
  assert.equal(expected, null);
  const beforeSends = sends.length, beforePrompts = walletSendAttempts, beforeRequests = walletRequests.length;
  const shown = await poolState(prefix);
  const { matched: shownMatched } = await liquidityFigures(prefix, amount, shown);
  const nudge = shown.reserve / 10n;
  const account = await donor(shown.token, nudge);
  await fixtureSend(account, shown.token, tokenAbi, 'transfer', [shown.pair, nudge]);
  await fixtureSend(account, shown.pair, pairAbi, 'sync');
  const moved = await poolState(prefix);
  const freshMatched = amount * moved.quoteReserve / moved.reserve;
  assert.ok(moved.reserve === shown.reserve + nudge && freshMatched < shownMatched, 'The fixture moved the pool ratio after the page quoted.');
  assert.equal((await page.locator(`[data-figure="${prefix}.matched"]`).textContent()).trim(), expectedText(shownMatched, prefix === 'bask' ? 6 : 18) + ' ' + (prefix === 'bask' ? 'USDG' : 'ETH'), 'The page still shows the quote it last read; nothing polls.');
  await card(prefix).getByRole('button', { name: 'Add liquidity', exact: true }).click();
  await page.waitForFunction(prefix => document.querySelector(`[data-item-card="${prefix}"] .error[role="alert"]`)?.textContent === 'The request failed. Please retry.', prefix, { timeout: 60000 });
  await ready();
  assert.equal(walletRequests.length, beforeRequests, 'A changed quote never starts wallet preflight.');
  assert.equal(walletSendAttempts, beforePrompts, 'A changed quote produces no wallet prompt.');
  assert.equal(sends.length, beforeSends, 'A changed quote produces no transaction.');
  await liquidityFigures(prefix, amount, moved);
  pass(`${prefix} add: a pool that moved after the quote is refused at the press with no wallet prompt, and the form shows the moved pool's figures before the next press.`);
}
async function addLiquidity(prefix) {
  await openTab(prefix, 'Add liquidity');
  const form = page.locator(`[data-liquidity="${prefix}"]`);
  const before = await poolState(prefix);
  const affordable = before.quoteBalance * before.reserve / before.quoteReserve;
  const amount = prefix === 'bask' ? (before.tokenBalance < affordable ? before.tokenBalance : affordable) / 10n : 10n ** 18n;
  assert.ok(amount > 0n);
  await form.getByRole('button', { name: 'Use full balance', exact: true }).click();
  assert.equal(await page.locator(`#${prefix}-add`).inputValue(), formatUnits(before.tokenBalance, 18), 'Liquidity Use full balance retains exact token precision.');
  await page.locator(`#${prefix}-add`).fill(formatUnits(before.tokenBalance + 1n, 18));
  assert.ok(await form.getByRole('button', { name: 'Add liquidity', exact: true }).isDisabled());
  assert.equal(await form.getByText('More than your balance.', { exact: true }).count(), 1);
  await page.locator(`#${prefix}-add`).fill(formatUnits(amount, 18));
  const { matched, estimate } = await liquidityFigures(prefix, amount, before);
  assert.ok(matched > 0n && estimate > 0n && matched <= before.quoteBalance);
  await capture(`${prefix} liquidity ready`, `[data-liquidity="${prefix}"]`);
  if (prefix === 'bask') {
    await send(prefix, 'Approve BASK', KNOWN.BASK, tokenAbi, 'approve', [KNOWN.V2_ROUTER, amount]);
    await send(prefix, 'Approve USDG', KNOWN.USDG, tokenAbi, 'approve', [KNOWN.V2_ROUTER, matched]);
    await disconnectDuringLiquidityRead(amount);
  } else await send(prefix, 'Approve ITEM', LAUNCH.ITEM, tokenAbi, 'approve', [KNOWN.V2_ROUTER, amount]);
  if (prefix === 'eth') await quoteMovedBeforePress(prefix, amount); // 2026-10-17, audit review: the ETH side has no approval to cap it.
  // Same browser-clock convention as the vault; freeze one local-fork second so exact deadline bytes can be checked.
  const now = Number((await client.getBlock()).timestamp);
  await page.evaluate(seconds => { Date.now = () => seconds * 1000; }, now);
  const fresh = await poolState(prefix), quote = amount * fresh.quoteReserve / fresh.reserve;
  // 2026-10-18, round-5 review (Codex R5-01): the record's estimate is the fresh pool's, the state the press uses. On the ETH side the pool
  // moved after the first quote, so the form's figures are checked against the fresh state here too; the first estimate keeps its own name.
  await ready();
  const { estimate: freshEstimate } = await liquidityFigures(prefix, amount, fresh);
  const args = prefix === 'bask'
    ? [KNOWN.BASK, KNOWN.USDG, amount, quote, amount * 995n / 1000n, quote * 995n / 1000n, mock, BigInt(now + 600)]
    : [LAUNCH.ITEM, amount, amount * 995n / 1000n, quote * 995n / 1000n, mock, BigInt(now + 600)];
  assert.ok(args[prefix === 'bask' ? 4 : 2] > 0n && args[prefix === 'bask' ? 5 : 3] > 0n, 'Both exact minimums are nonzero.');
  await send(prefix, 'Add liquidity', KNOWN.V2_ROUTER, routerAbi, prefix === 'bask' ? 'addLiquidity' : 'addLiquidityETH', args, prefix === 'eth' ? quote : undefined, fresh);
  const after = await poolState(prefix), receipt = await client.getTransactionReceipt({ hash: sends.at(-1).hash });
  const logs = receipt.logs.filter(log => lower(log.address) === lower(fresh.pair)).map(log => { try { return decodeEventLog({ abi: pairAbi, ...log }); } catch { return null; } }).filter(Boolean);
  const mint = logs.find(log => log.eventName === 'Mint');
  const minted = logs.filter(log => log.eventName === 'Transfer' && lower(log.args.from) === zero && lower(log.args.to) === lower(mock)).reduce((sum, log) => sum + log.args.value, 0n);
  assert.ok(mint && minted > 0n, 'Router receipt contains the actual pair mint and LP transfer to the connected account.');
  const used = mint.args[fresh.first ? 'amount0' : 'amount1'], quoteUsed = mint.args[fresh.first ? 'amount1' : 'amount0'];
  assert.equal(after.lp - fresh.lp, minted, 'Pool token balance rises by the router receipt\'s actual minted amount.');
  assert.equal(after.reserve - fresh.reserve, used, 'Token reserves rise by the router\'s actual amount.');
  assert.equal(after.quoteReserve - fresh.quoteReserve, quoteUsed, 'Quote reserves rise by the router\'s actual amount.');
  assert.equal(fresh.tokenBalance - after.tokenBalance, used, 'Entered token wallet balance falls by the actual addition.');
  const gasPaid = prefix === 'eth' ? receipt.gasUsed * receipt.effectiveGasPrice : 0n;
  assert.equal(fresh.quoteBalance - after.quoteBalance, quoteUsed + gasPaid, 'Quote wallet balance falls by the actual addition, plus ETH gas where relevant.');
  assert.ok(used >= amount * 995n / 1000n && quoteUsed >= quote * 995n / 1000n, 'The minted addition meets both fixed minimums.');
  assert.equal((await page.locator(`[data-figure="${prefix}.balance"]`).textContent()).trim(), expectedText(after.lp, 18, true) + ' pool tokens', 'Confirmed add automatically refreshes the LP balance.');
  await liquidityFigures(prefix, amount, after); // 2026-10-16, Claude check: the form's matched amount, estimate and both wallet balances agree with the chain after the add too.
  await openTab(prefix, 'Stake');
  await page.locator(`[data-item-card="${prefix}"] .item-action:has(#${prefix}-stake)`).getByRole('button', { name: 'Use full balance', exact: true }).click();
  assert.equal(await page.locator(`#${prefix}-stake`).inputValue(), formatUnits(after.lp, 18), 'Stake immediately uses the post-add LP balance.');
  liquidityComparisons.push({ prefix, amount: amount.toString(), quote: quote.toString(), estimate: freshEstimate.toString(), estimateAtFirstQuote: estimate.toString(), actualMinted: minted.toString(), used: used.toString(), quoteUsed: quoteUsed.toString(), gasPaid: gasPaid.toString(), reservesBefore: [fresh.reserve.toString(), fresh.quoteReserve.toString()], reservesAfter: [after.reserve.toString(), after.quoteReserve.toString()], lpBefore: fresh.lp.toString(), lpAfter: after.lp.toString() });
  await openTab(prefix, 'Add liquidity');
  await capture(`${prefix} after liquidity add`, `[data-liquidity="${prefix}"]`);
  pass(`${prefix} add: actual router mint, both reserve increases, both wallet debits and immediate staking balance agree.`);
}
async function compareRewards(stage) {
  const values = {};
  for (const prefix of ['bask', 'eth', 'staking']) values[prefix] = Object.fromEntries(Object.entries(await figures(prefix)).map(([key, value]) => [key, value.toString()]));
  rewardComparisons.push({ stage, values });
  pass(`All reward figures match chain rates, stakes and BASK pot ${stage}.`);
}
async function advance(seconds) { await local('evm_increaseTime', [seconds]); await local('evm_mine'); }
async function navigate(route) { currentRoute = route; await page.evaluate(hash => { location.hash = hash; }, `#${route}`); await page.waitForFunction(hash => location.hash === hash, `#${route}`); }
async function sheets() {
  const sheetPage = await browser.newPage({ viewport: { width: 600, height: 800 }, deviceScaleFactor: 1 });
  for (let start = 0; start < shots.length; start += 4) {
    const group = shots.slice(start, start + 4);
    const html = '<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#fff;font:12px Arial;color:#111}.grid{display:grid;grid-template-columns:300px 300px}figure{margin:0;padding:10px;box-sizing:border-box;height:400px}figcaption{height:35px;font-weight:bold}img{width:280px;height:345px;object-fit:contain;object-position:top;background:#f5f5f5}</style><div class="grid">' + group.map(shot => `<figure><figcaption>${shot.name}${shot.fixture ? ' — read fixture' : ''}</figcaption><img src="data:image/jpeg;base64,${shot.buffer.toString('base64')}"></figure>`).join('') + '</div>';
    await sheetPage.setContent(html);
    await sheetPage.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
    const file = `item-states-${start / 4 + 1}.jpg`;
    await sheetPage.screenshot({ path: path.join(artifacts, file), type: 'jpeg', quality: 18, fullPage: true });
    group.forEach((shot, i) => { const state = states.find(state => state.name === shot.name); state.screenshot = file; state.cell = i + 1; });
  }
  await sheetPage.close();
}
async function layoutCheck() {
  // 2026-10-16, Earn layout build (option B3), run with the mock connected and both pools seeded: the selector, the hidden
  // pool, the tabs by click and keyboard, the figure hooks and the disclosures.
  await openTab('bask', 'Add liquidity'); await page.locator('#bask-add').fill('0.1');
  await openTab('eth', 'Add liquidity'); await page.locator('#eth-add').fill('0.2');
  assert.equal(await page.locator('#bask-add').inputValue(), '0.1', 'The hidden pool keeps its typed amount.');
  assert.notEqual((await page.locator('[data-figure="bask.matched"]').textContent()).trim(), '0 USDG', 'The hidden pool keeps its quote.');
  await showCard('bask');
  assert.equal(await page.locator('#bask-add').inputValue(), '0.1', 'An amount typed on one pool survives switching away and back.');
  assert.equal(await page.locator('#eth-add').inputValue(), '0.2', 'The amount typed on the other pool survives too.');
  await figures('eth');
  await page.locator('#earn-pool-select').focus();
  let stops = 0;
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press('Tab');
    const where = await page.evaluate(() => { const e = document.activeElement; return { section: !!e?.closest('.item-section'), hiddenPool: !!e?.closest('[data-pool-view][hidden]'), hiddenPanel: !!e?.closest('[role="tabpanel"][hidden]'), closedDetails: !!e?.closest('details:not([open]) > :not(summary)') }; });
    if (!where.section) break;
    stops++;
    assert.ok(!where.hiddenPool && !where.hiddenPanel && !where.closedDetails, 'Tab never reaches the hidden pool card, a hidden tab panel or closed disclosure content.');
  }
  assert.ok(stops >= 6 && stops < 80, `Tab walked ${stops} stops through the liquidity section and left it.`);
  const hiddenControls = await page.locator('[data-pool-view][hidden] :is(input, button, a, select, summary)').all();
  assert.ok(hiddenControls.length >= 10, `The hidden pool keeps its controls mounted (${hiddenControls.length} found).`);
  for (const control of hiddenControls) { await control.evaluate(node => node.focus()); assert.equal(await control.evaluate(node => document.activeElement === node), false, 'A hidden pool control refuses focus.'); }
  for (const prefix of ['bask', 'eth', 'staking']) {
    const gauge = prefix !== 'staking';
    await showCard(prefix);
    const hooks = await card(prefix).locator('[data-figure]').evaluateAll(nodes => nodes.map(node => node.dataset.figure));
    assert.equal(hooks.length, gauge ? 14 : 8, `${prefix}: every figure hook present`); assert.equal(new Set(hooks).size, hooks.length, `${prefix}: each figure hook exactly once`);
    assert.deepEqual((await card(prefix).locator(':scope > .item-figures [data-figure]').evaluateAll(nodes => nodes.map(node => node.dataset.figure))).sort(), [`${prefix}.staked`, `${prefix}.${gauge ? 'earned' : 'BASK'}`].sort(), `${prefix}: only You have staked and the earned total sit above the tabs`);
    // Where the owner's choice puts each figure: above the tabs (seen on every tab) or on exactly one tab.
    const place = gauge
      ? { staked: 'above', earned: 'above', matched: 'Add liquidity', tokenBalance: 'Add liquidity', quoteBalance: 'Add liquidity', liquidityEstimate: 'Add liquidity', balance: 'Stake', share: 'Manage', daily: 'Manage', released: 'Pool stats', remaining: 'Pool stats', rate: 'Pool stats', dailyPerToken: 'Pool stats', totalStaked: 'Pool stats' }
      : { staked: 'above', BASK: 'above', balance: 'Stake', share: 'Manage', estimatedBASK: 'Manage', USDValue: 'Manage', totalStaked: 'Staking stats', pot: 'Staking stats' };
    assert.deepEqual(Object.keys(place).map(key => `${prefix}.${key}`).sort(), [...hooks].sort(), `${prefix}: the placement map names every figure hook once`);
    const tabs = card(prefix).getByRole('tab');
    assert.deepEqual(await tabs.allTextContents(), TABS[prefix], `${prefix}: exact tab names in order`);
    for (const name of TABS[prefix]) {
      await openTab(prefix, name);
      for (const [key, where] of Object.entries(place)) assert.equal(await page.locator(`[data-figure="${prefix}.${key}"]`).isVisible(), where === 'above' || where === name, `${prefix}.${key}: shows ${where === 'above' ? 'above the tabs' : 'only on ' + where} (${name} open)`);
    }
    await openTab(prefix, TABS[prefix][0]); await tabs.nth(0).focus();
    const count = TABS[prefix].length;
    for (const [key, index] of [['End', count - 1], ['ArrowRight', 0], ['ArrowLeft', count - 1], ['Home', 0], ['ArrowDown', 1], ['ArrowUp', 0], ['ArrowRight', 1]]) {
      await page.keyboard.press(key);
      assert.equal(await tabs.nth(index).getAttribute('aria-selected'), 'true', `${prefix}: ${key} selects tab ${index}`);
      assert.ok(await tabs.nth(index).evaluate(node => node === document.activeElement), `${prefix}: ${key} moves focus with the selection`);
      assert.ok(await page.locator('#' + await tabs.nth(index).getAttribute('aria-controls')).isVisible(), `${prefix}: ${key} shows the controlled panel`);
      assert.equal(await card(prefix).locator('[role="tabpanel"]:not([hidden])').count(), 1, `${prefix}: one panel after ${key}`);
      assert.equal(await tabs.evaluateAll(nodes => nodes.filter(node => node.tabIndex === 0).length), 1, `${prefix}: one tab stop in the tablist`);
      visited.keyboard.add(`${prefix}: ${key}`);
    }
    await openTab(prefix, 'Manage'); const withdraw = await openDisclosure(prefix, WITHDRAW[prefix]);
    assert.ok(await page.locator(`#${prefix}-withdraw`).isVisible(), `${prefix}: the withdraw box shows once its disclosure opens`);
    await withdraw.locator('summary').click();
    assert.equal(await page.locator(`#${prefix}-withdraw`).isVisible(), false, `${prefix}: the withdraw box hides again`);
    if (gauge) {
      await openTab(prefix, 'Add liquidity'); const details = await openDisclosure(prefix, 'Details');
      assert.ok(await details.getByRole('link', { name: 'Add liquidity on Uniswap', exact: true }).isVisible(), `${prefix}: open Details shows the Uniswap link`);
      await details.locator('summary').click();
      assert.equal(await details.getByRole('link', { name: 'Add liquidity on Uniswap', exact: true }).count(), 0, `${prefix}: closed Details hides the Uniswap link`);
    }
  }
  await openTab('eth', 'Add liquidity'); await page.locator('#eth-add').fill('');
  await openTab('bask', 'Add liquidity'); await page.locator('#bask-add').fill('');
  await capture('Pool selector with BASK/USDG', '.refined-focused-section');
  await openTab('eth', 'Add liquidity'); await capture('ITEM/ETH pool selected', '[data-item-card="eth"]');
  await openTab('bask', 'Manage'); await openDisclosure('bask', 'Withdraw pool tokens'); await capture('Manage with withdraw open', '[data-item-card="bask"]');
  await openTab('bask', 'Pool stats'); await capture('Pool stats', '[data-item-card="bask"]');
  await openTab('bask', 'Add liquidity');
  pass('Earn layout: the Pool selector shows one mounted card at a time and keeps the other card\'s typed amounts and reads; the hidden pool and the hidden panels take no focus by Tab or by script; every tab works by click and keyboard with one panel showing; fourteen and eight figure hooks once each, the personal summary above the tabs and every other figure visible on its own tab only; the Details and withdraw disclosures open and close.');
}
async function typingCheck() {
  // 2026-10-16, Earn layout build: the owner has met amount boxes that could not be erased or edited. Every box of the
  // three cards is driven key by key (never fill): digits, a decimal point, Backspace and Delete in the middle, Home and
  // End, select-all and retype, and an inserted paste. After every key the box equals a plain text box, and the figures
  // or the reason line that follow it equal what the typed text means.
  const steps = [['type', '12.5'], ['press', 'ArrowLeft'], ['press', 'ArrowLeft'], ['press', 'Backspace'], ['type', '3'], ['press', 'Home'], ['press', 'Delete'], ['press', 'End'], ['press', 'Backspace'], ['type', '25'], ['press', 'Control+a'], ['type', '0.5'], ['press', 'ArrowLeft'], ['paste', '7'], ['press', 'Control+a'], ['press', 'Delete'], ['type', '1e'], ['press', 'Backspace'], ['press', 'Control+a'], ['press', 'Backspace']];
  let keystrokes = 0;
  for (const prefix of ['bask', 'eth', 'staking']) {
    const gauge = prefix !== 'staking';
    const boxes = gauge ? [['add', 'Add liquidity'], ['stake', 'Stake'], ['withdraw', 'Manage']] : [['stake', 'Stake'], ['withdraw', 'Manage']];
    const pool = gauge ? await poolState(prefix) : null;
    const chain = await figures(prefix);
    for (const [kind, tab] of boxes) {
      await openTab(prefix, tab);
      if (kind === 'withdraw') await openDisclosure(prefix, WITHDRAW[prefix]);
      const input = page.locator(`#${prefix}-${kind}`), model = textBox();
      await input.click(); await page.keyboard.press('Control+a'); await page.keyboard.press('Backspace');
      assert.equal(await input.inputValue(), '', `${prefix}-${kind}: cleared`);
      const values = [];
      for (const [action, payload] of steps) {
        if (action === 'type') { await input.pressSequentially(payload); for (const key of payload) model.press(key); keystrokes += payload.length; }
        else if (action === 'press') { await page.keyboard.press(payload); model.press(payload); keystrokes++; }
        else { await page.keyboard.insertText(payload); model.insert(payload); keystrokes++; }
        const value = await input.inputValue();
        assert.equal(value, model.box.value, `${prefix}-${kind}: after ${action} ${JSON.stringify(payload)} the box holds what a plain text box would`);
        values.push(value);
        const amount = parseAmount(value);
        const reason = (await page.locator(`.item-action:has(#${prefix}-${kind}) .disabled-reason`).allTextContents()).join('|');
        let expectedReason;
        if (kind === 'add') {
          const matched = amount === undefined ? 0n : amount * pool.quoteReserve / pool.reserve;
          const valid = amount !== undefined && matched > 0n && amount * 995n / 1000n > 0n && matched * 995n / 1000n > 0n;
          const fromToken = valid ? amount * pool.supply / pool.reserve : 0n, fromQuote = valid ? matched * pool.supply / pool.quoteReserve : 0n;
          assert.equal((await page.locator(`[data-figure="${prefix}.matched"]`).textContent()).trim(), expectedText(valid ? matched : 0n, prefix === 'bask' ? 6 : 18) + (prefix === 'bask' ? ' USDG' : ' ETH'), `${prefix}-add: the matched amount follows the typed text ${JSON.stringify(value)}`);
          assert.equal((await page.locator(`[data-figure="${prefix}.liquidityEstimate"]`).textContent()).trim(), expectedText(fromToken < fromQuote ? fromToken : fromQuote, 18, true) + ' pool tokens', `${prefix}-add: the pool-token estimate follows the typed text ${JSON.stringify(value)}`);
          expectedReason = !valid ? 'Enter an amount.' : amount > pool.tokenBalance || matched > pool.quoteBalance ? 'More than your balance.' : '';
        } else if (kind === 'stake') expectedReason = amount === undefined ? 'Enter an amount.' : amount > chain.balance ? 'More than your balance.' : '';
        else expectedReason = amount === undefined ? 'Enter an amount.' : amount > chain.staked ? 'More than you have staked.' : '';
        assert.equal(reason, expectedReason, `${prefix}-${kind}: the reason line follows the typed text ${JSON.stringify(value)}`);
      }
      typingEvidence.push({ box: `${prefix}-${kind}`, steps: steps.length, values });
    }
  }
  await openTab('bask', 'Add liquidity');
  pass(`Typing: every amount box of the three cards takes digits and a decimal point key by key, Backspace and Delete in the middle, Home and End, select-all and retype, and an inserted paste; after each of ${keystrokes} keystrokes the box, the matched figures and the reason line equal a plain text box's.`);
}

try {
  if (!reuse) {
    await new Promise((resolve, reject) => { const probe = net.createServer(); probe.once('error', reject); probe.listen(9523, '127.0.0.1', () => probe.close(resolve)); });
    const blockNumbers = new Map();
    proxy = http.createServer(async (request, response) => {
      try {
        let text = ''; for await (const chunk of request) text += chunk;
        const query = JSON.parse(text);
        const one = async q => {
          assert.ok(READS.has(q.method), 'Fork upstream is read-only.');
          const params = [];
          for (const param of q.params ?? []) {
            if (param && typeof param === 'object' && param.blockHash) {
              if (!blockNumbers.has(param.blockHash)) blockNumbers.set(param.blockHash, rpcAt(upstream, 'eth_getBlockByHash', [param.blockHash, false]).then(block => block.number));
              params.push(await blockNumbers.get(param.blockHash));
            } else params.push(param);
          }
          return { jsonrpc: '2.0', id: q.id, result: await rpcAt(upstream, q.method, params) };
        };
        response.setHeader('content-type', 'application/json'); response.end(JSON.stringify(Array.isArray(query) ? await Promise.all(query.map(one)) : await one(query)));
      } catch (error) { response.statusCode = 502; response.end(JSON.stringify({ error: error.message })); }
    });
    await new Promise((resolve, reject) => { proxy.once('error', reject); proxy.listen(9524, '127.0.0.1', resolve); });
    anvil = spawn(process.env.ANVIL || 'anvil', ['--host', '127.0.0.1', '--port', '9523', '--chain-id', '4663', '--fork-url', 'http://127.0.0.1:9524', '--fork-block-number', String(config.BLOCK_NUMBER), '--silent'], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
    let anvilError = ''; anvil.stderr.on('data', data => { anvilError += data; });
    for (let attempt = 0; ; attempt++) {
      try { await local('eth_chainId'); break; } catch (error) { if (attempt >= 120 || anvil.exitCode !== null) throw new Error(`Local fork failed: ${anvilError}`, { cause: error }); await new Promise(resolve => setTimeout(resolve, 250)); }
    }
    // 2026-10-19, launch day: anvil 1.8.1 refuses every eth_call at a forked Robinhood Chain header ("Excess blob gas not set") until a block of its own is mined; the vault walk mines one here too.
    await local('evm_mine');
    // 2026-10-19, launch day (real runs 3 and 4): the site's first load reads the vault, and depositStatus walks every feed; on a fresh
    // fork those reads fetch the archive one slot at a time for minutes while anvil holds its database lock and mines nothing, so the
    // first page send waited past the 60 s below. The same views are read once here, before the browser opens and before any send.
    const warm = async (functionName, args = []) => {
      const response = await fetch(rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++requestId, method: 'eth_call', params: [{ to: KNOWN.BASK, data: encode(vaultAbi, functionName, args) }, 'latest'] }), signal: AbortSignal.timeout(900000) });
      assert.ok(response.ok, `Fork warm-up ${functionName}: HTTP ${response.status}`);
      const answer = await response.json();
      assert.ok(!answer.error, `Fork warm-up ${functionName}: ${answer.error?.message}`);
    };
    for (const [functionName, args] of [['allAssets'], ['settings'], ['depositStatus', [[]]], ['previewRedeem', [await read(KNOWN.BASK, vaultAbi, 'totalSupply')]]]) await warm(functionName, args);
  }
  assert.equal(Number(await local('eth_chainId')), 4663);
  snapshot = await local('evm_snapshot');
  try { oldAutoMine = await local('anvil_getAutomine'); } catch { oldAutoMine = true; }
  await local('evm_setAutomine', [true]);
  await local('anvil_impersonateAccount', [mock]);
  await local('anvil_setBalance', [mock, '0x56bc75e2d63100000']);
  await ensureGauge(LAUNCH.BASK_USDG_GAUGE); await ensureGauge(LAUNCH.ITEM_ETH_GAUGE);
  await ensureMockToken(LAUNCH.ITEM, 1000n * 10n ** 18n);
  for (const pair of [KNOWN.BASK_USDG_PAIR, LAUNCH.ITEM_WETH_PAIR]) if (await balance(pair) < 100n) { const account = await donor(pair, 1000n); await fixtureSend(account, pair, tokenAbi, 'transfer', [mock, await balance(pair, account) / 10n]); }
  // Exact approvals remain observable on repeatable snapshots and real-launch forks.
  for (const [token, spender] of [[KNOWN.BASK_USDG_PAIR, LAUNCH.BASK_USDG_GAUGE], [LAUNCH.ITEM_WETH_PAIR, LAUNCH.ITEM_ETH_GAUGE], [LAUNCH.ITEM, LAUNCH.ITEM_STAKING]]) if (await read(token, tokenAbi, 'allowance', [mock, spender]) !== 0n) await fixtureSend(mock, token, tokenAbi, 'approve', [spender, 0n]);
  const dist = path.resolve('../dist');
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
  server = http.createServer((request, response) => {
    const requested = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = path.resolve(dist, '.' + (requested === '/' ? '/index.html' : requested));
    if (!file.startsWith(dist + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.statusCode = 404; response.end(); return; }
    response.setHeader('content-type', types[path.extname(file)] ?? 'application/octet-stream'); response.end(fs.readFileSync(file));
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(9525, '127.0.0.1', resolve); });
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === 'http://127.0.0.1:9525') return route.continue();
    if (['rpc.mainnet.chain.robinhood.com', 'robinhood-rpc.publicnode.com'].includes(url.hostname)) {
      try { const payload = request.postDataJSON(); const reply = Array.isArray(payload) ? await Promise.all(payload.map(pageRpc)) : await pageRpc(payload); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reply), headers: { 'access-control-allow-origin': '*' } }); }
      catch (error) { return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ jsonrpc: '2.0', id: request.postDataJSON()?.id, error: { code: -32000, message: error.message } }) }); }
    }
    return route.abort('blockedbyclient');
  });
  await context.exposeBinding('__itemMockRequest', async (_, { method, params = [] }) => {
    walletRequests.push(method);
    if (method === 'eth_accounts') return walletConnected ? [walletAccount] : []; // 2026-10-17, round-4 review: the account the wallet shows (the mock, except during the account-switch check)
    if (method === 'eth_requestAccounts') { walletConnected = true; return [mock]; }
    if (method === 'eth_chainId') return '0x1237';
    if (method === 'eth_sendTransaction') {
      walletSendAttempts++;
      try {
        assert.ok(expected, 'Unexpected eighteenth or unplanned wallet send refused.');
        assert.equal(params.length, 1); const tx = params[0];
        assert.equal(lower(tx.from), lower(mock)); assert.equal(lower(tx.to), lower(expected.to)); assert.equal(tx.data, expected.data);
        if (expected.value === undefined) assert.equal(tx.value, undefined, 'Only the ETH add may carry transaction value.');
        else { assert.equal(BigInt(tx.value), expected.value); assert.equal(expected.fn, 'addLiquidityETH'); }
        assert.deepEqual(Object.keys(tx).sort(), ['data', 'from', 'to', ...(expected.value === undefined ? [] : ['value'])], 'ITEM wallet payload has only from, to, exact calldata and the ETH add value when required.');
        const preflight = rpcLog.slice(expected.since);
        assert.ok(preflight.some(call => call.method === 'eth_getCode' && lower(call.to) === lower(tx.to)), 'Target code read before the wallet prompt.');
        assert.ok(preflight.some(call => call.method === 'eth_call' && lower(call.to) === lower(tx.to) && call.data === tx.data && (expected.value === undefined ? call.value === undefined : BigInt(call.value) === expected.value)), 'Exact call including any ETH value simulated before the wallet prompt.');
        if (expected.liquidity) for (const fn of ['getReserves', 'token0', 'totalSupply']) assert.ok(preflight.some(call => call.method === 'eth_call' && lower(call.to) === lower(expected.liquidity.pair) && call.data === encode(pairAbi, fn)), `${fn}: pool read afresh after pressing Add liquidity, before the wallet prompt.`);
        const code = await local('eth_getCode', [tx.to, 'latest']);
        const hashKey = lower(tx.to) === lower(KNOWN.BASK_USDG_PAIR) ? 'BASK_USDG_PAIR_HASH' : Object.keys(LAUNCH).find(key => !key.endsWith('_HASH') && typeof LAUNCH[key] === 'string' && lower(LAUNCH[key]) === lower(tx.to)) + '_HASH';
        const targetHash = lower(tx.to) === lower(KNOWN.V2_ROUTER) ? KNOWN.V2_ROUTER_HASH : lower(tx.to) === lower(KNOWN.USDG) ? KNOWN.USDG_HASH : lower(tx.to) === lower(KNOWN.BASK) ? RUNTIME_HASH : LAUNCH[hashKey];
        assert.equal(keccak256(code), targetHash);
        const hash = await local(method, [{ ...tx, gas: '0x1c9c380' }]);
        const list = expected.proof ? proofSends : sends; // 2026-10-17, round-4 review: the account-switch check's send is kept apart from the seventeen
        list.push({ number: list.length + 1, prefix: expected.prefix, label: expected.label, functionName: expected.fn, from: mock, to: tx.to, data: tx.data, ...(tx.value === undefined ? {} : { value: tx.value }), hash, codeHash: keccak256(code), simulationBeforePrompt: true });
        const done = expected.resolve; expected = null; done(hash); return hash;
      } catch (error) { expected?.reject(error); expected = null; throw error; }
    }
    throw new Error(`Unapproved mock-wallet method: ${method}`);
  });
  await context.addInitScript(() => { const listeners = new Map(); window.ethereum = { request: args => window.__itemMockRequest(args), on(name, fn) { const set = listeners.get(name) ?? new Set(); set.add(fn); listeners.set(name, set); }, removeListener(name, fn) { listeners.get(name)?.delete(fn); }, emit(name, value) { for (const fn of listeners.get(name) ?? []) fn(value); } }; });
  page = await context.newPage(); page.setDefaultTimeout(60000);
  currentRoute = 'earn'; await page.goto('http://127.0.0.1:9525/#earn'); await ready();
  assert.equal(await page.locator('[data-item-card]').count(), 3);
  assert.equal(await page.locator('[data-item-card] > p:text-is("Connect a wallet to view your position.")').count(), 3, 'Every card says what a wallet would show.');
  await openTab('bask', 'Stake');
  assert.ok(await card('bask').getByRole('button', { name: 'Stake', exact: true }).isDisabled());
  assert.equal(await page.locator('[data-figure="bask.balance"]').count(), 0);
  await capture('No wallet', '[data-item-card="bask"] .item-action:has(#bask-stake)'); pass('Without a wallet public figures show, wallet figures are absent and actions are disabled.');
  for (const prefix of ['bask', 'eth']) {
    await openTab(prefix, 'Add liquidity');
    const form = page.locator(`[data-liquidity="${prefix}"]`);
    assert.equal(await form.getByText('Connect a wallet to add liquidity.', { exact: true }).count(), 1);
    assert.ok(await form.getByRole('button', { name: 'Add liquidity', exact: true }).isDisabled());
    await openDisclosure(prefix, 'Details');
    assert.equal(await form.getByText('Minimums 0.5% under these amounts; the add fails instead of filling at a worse ratio.', { exact: true }).count(), 1);
    assert.equal(await form.getByRole('link', { name: 'Add liquidity on Uniswap', exact: true }).count(), 1, `${prefix}: the Uniswap alternative sits in the Details disclosure.`);
    await capture(`${prefix} liquidity without wallet`, `[data-liquidity="${prefix}"]`);
  }
  await showCard('bask');
  fixture = 'empty-wallet'; await page.getByRole('button', { name: 'Connect wallet', exact: true }).click(); await ready();
  assert.equal((await page.locator('[data-figure="bask.balance"]').textContent()).trim(), '0 pool tokens');
  await openTab('bask', 'Stake');
  await capture('Wallet with nothing', '[data-item-card="bask"]', 'Read-only account balances/stakes/earnings fixture.');
  fixture = null; await refresh(); await figures('bask'); await figures('eth'); await figures('staking');
  await openTab('bask', 'Stake');
  await capture('Wallet with pool tokens and ITEM', '[data-item-card="bask"]');
  await layoutCheck();
  await typingCheck();
  fixture = 'unseeded'; await refresh();
  for (const prefix of ['bask', 'eth']) {
    await openTab(prefix, 'Add liquidity');
    const form = page.locator(`[data-liquidity="${prefix}"]`);
    assert.equal(await form.getByText('Pool not seeded yet.', { exact: true }).count(), 1);
    assert.ok(await page.locator(`#${prefix}-add`).isDisabled());
    assert.ok(await form.getByRole('button', { name: 'Add liquidity', exact: true }).isDisabled());
    await capture(`${prefix} pool not seeded`, `[data-liquidity="${prefix}"]`, 'Read-only zero-reserves response fixture; no pool state changed.');
  }
  fixture = 'not-started'; await refresh();
  await openTab('bask', 'Stake');
  assert.equal(await page.getByText('Rewards for this pool have not started yet.', { exact: true }).count(), 2);
  assert.ok(await card('bask').getByRole('button', { name: 'Stake', exact: true }).isDisabled());
  await capture('Gauge not started', '[data-item-card="bask"] .item-action:has(#bask-stake)', 'Read-only started=false fixture.');
  await reach('bask', 'Withdraw');
  assert.equal(await card('bask').getByRole('button', { name: 'Withdraw', exact: true }).count(), 1);
  assert.equal(await card('bask').getByRole('button', { name: 'Claim ITEM', exact: true }).count(), 1);
  fixture = 'pair-mismatch'; await refresh();
  // 2026-10-16, Earn layout build: the tabs stay usable so the figures can still be read; every action in the card is off.
  assert.ok((await card('bask').locator('button:not([role="tab"])').evaluateAll(buttons => buttons.length > 0 && buttons.every(button => button.disabled))));
  assert.ok((await card('bask').locator('[role="tab"]').evaluateAll(tabs => tabs.length === 4 && tabs.every(tab => !tab.disabled))));
  await openTab('bask', 'Stake');
  await capture('Pair mismatch', '[data-item-card="bask"] .item-action:has(#bask-stake)', 'Read-only wrong pair fixture; every card action disabled.');
  fixture = null; await refresh();
  await openTab('bask', 'Stake');
  await page.evaluate(() => window.ethereum.emit('chainChanged', '0x1'));
  await page.getByText('Your wallet must be on Robinhood Chain (4663) to send. Public data remains available.', { exact: true }).waitFor();
  assert.ok(await page.locator('#bask-stake').isDisabled());
  await page.evaluate(() => window.ethereum.emit('chainChanged', '0x1237'));
  await page.locator('#bask-stake').waitFor();
  pass('Wrong-chain warning disables ITEM actions without changing public figures.');
  for (const [prefix, gauge, token] of [['bask', LAUNCH.BASK_USDG_GAUGE, KNOWN.BASK_USDG_PAIR], ['eth', LAUNCH.ITEM_ETH_GAUGE, LAUNCH.ITEM_WETH_PAIR]]) {
    const held = await balance(token), quantity = held / 2n; assert.ok(quantity > 1n);
    await openTab(prefix, 'Stake');
    await page.locator(`[data-item-card="${prefix}"] .item-action:has(#${prefix}-stake)`).getByRole('button', { name: 'Use full balance', exact: true }).click();
    assert.equal(await page.locator(`#${prefix}-stake`).inputValue(), formatUnits(held, 18), 'Use full balance keeps exact LP precision.');
    await page.locator(`#${prefix}-stake`).fill(formatUnits(quantity, 18));
    await send(prefix, 'Approve', token, tokenAbi, 'approve', [gauge, quantity]);
    await send(prefix, 'Stake', gauge, gaugeAbi, 'stake', [quantity]);
    await advance(3600); await refresh(); const earned = (await figures(prefix)).earned; assert.ok(earned > 0n);
    if (prefix === 'bask') { await openTab('bask', 'Manage'); await capture('Staked with earnings', '[data-item-card="bask"]'); }
    await reach(prefix, 'Use full staked amount');
    await card(prefix).getByRole('button', { name: 'Use full staked amount', exact: true }).click();
    assert.equal(await page.locator(`#${prefix}-withdraw`).inputValue(), formatUnits(await read(gauge, gaugeAbi, 'staked', [mock]), 18));
    const withdrawal = quantity / 2n; await page.locator(`#${prefix}-withdraw`).fill(formatUnits(withdrawal, 18));
    await send(prefix, 'Withdraw', gauge, gaugeAbi, 'withdraw', [withdrawal]);
    const before = await balance(LAUNCH.ITEM); await send(prefix, 'Claim ITEM', gauge, gaugeAbi, 'claim');
    assert.ok(await balance(LAUNCH.ITEM) > before, `${prefix} claim paid ITEM.`);
    assert.equal(await read(gauge, gaugeAbi, 'earned', [mock]), 0n, `${prefix} paid all currently earned ITEM.`);
  }
  await compareRewards('before a fee arrives');
  const feeAmounts = await fundFees();
  await refresh(); await compareRewards('after a fee arrives');
  const stakeAmount = 100n * 10n ** 18n;
  await refresh(); await openTab('staking', 'Stake'); await page.locator('#staking-stake').fill(formatUnits(stakeAmount, 18));
  await send('staking', 'Approve', LAUNCH.ITEM, tokenAbi, 'approve', [LAUNCH.ITEM_STAKING, stakeAmount]);
  await send('staking', 'Stake', LAUNCH.ITEM_STAKING, stakingAbi, 'stake', [stakeAmount]);
  // 2026-10-17, round-3 review: the fee waits behind the dust stream fundFees started, so after the hour the figure is recorded,
  // not asserted (by the text it is that stream's one wei at most; the site is checked against the chain here, the rule by the
  // runbook's source read); seven staked days end that stream, a sync starts the fee's, and an hour later the earnings must show.
  await advance(3600); await refresh();
  const earnedBehindEarlierStream = (await figures('staking')).BASK;
  await advance(7 * 86400 + 1);
  await fixtureSend(KNOWN.OWNER, LAUNCH.ITEM_STAKING, stakingAbi, 'sync', [KNOWN.BASK]);
  await advance(3600); await refresh();
  assert.ok((await figures('staking')).BASK > 0n, 'BASK stream earnings accrue once the fee stream started behind the earlier one.');
  pass(`A BASK stream started before the fee arrived (one wei and a public sync, with ${feeAmounts.dustStream.totalStakedAtSync} ITEM staked at the time) finishes on the fork before the walk's fee streams; after an hour behind it the site showed ${earnedBehindEarlierStream} BASK earned, and it shows the earnings once they flow.`);
  await compareRewards('with one ITEM staker and accrued fees');
  await openTab('staking', 'Manage');
  await capture('Staking pot share and estimated BASK', '[data-item-card="staking"]');
  await openTab('staking', 'Staking stats');
  await capture('Staking stats with the fee pot', '[data-item-card="staking"]');
  await openTab('staking', 'Manage');
  await stakingDollarValue();
  await baskOnlyStaking();
  await reach('staking', 'Unstake');
  await page.locator('#staking-withdraw').fill('50');
  await send('staking', 'Unstake', LAUNCH.ITEM_STAKING, stakingAbi, 'unstake', [50n * 10n ** 18n]);
  const beforeClaim = Object.fromEntries(await Promise.all(['BASK', 'USDG', 'WETH'].map(async token => [token, await balance(KNOWN[token])])));
  await send('staking', 'Claim BASK', LAUNCH.ITEM_STAKING, stakingAbi, 'claim', [KNOWN.BASK]);
  for (const token of ['BASK', 'USDG', 'WETH']) { const after = await balance(KNOWN[token]); if (token === 'BASK') assert.ok(after > beforeClaim[token], 'BASK claim paid BASK.'); else assert.equal(after, beforeClaim[token], `Claim BASK did not pay ${token}.`); }
  assert.equal(sends.length, 12); assert.equal(expected, null);
  pass('The original 12 UI sends retain their order; BASK staking rewards stream over time and the BASK claim pays only BASK.');
  // 2026-10-17, pre-launch review: one failed read (the USDG router allowance) must not hide the other figures or the exits.
  faultCall = call => lower(call.to) === lower(KNOWN.USDG) && call.data === encode(tokenAbi, 'allowance', [mock, KNOWN.V2_ROUTER]);
  await page.locator('.item-refresh button').click();
  await page.waitForFunction(() => !document.querySelector('.item-refresh [role="status"]') && !document.querySelector('.item-refresh button')?.disabled, null, { timeout: 60000 });
  assert.equal(await page.locator('.item-refresh [role="alert"]').count(), 0, 'One failed read does not fail the whole page.');
  assert.equal(await page.getByText('ITEM figures: unreadable. Retry.', { exact: true }).count(), 1, 'Only the one action that needs the failed read says so.');
  await openTab('bask', 'Add liquidity');
  assert.ok(await card('bask').getByRole('button', { name: 'Add liquidity', exact: true }).isDisabled(), 'The BASK/USDG add is off while its USDG allowance is unreadable.');
  assert.equal((await card('bask').locator('[data-liquidity="bask"] .disabled-reason').textContent()).trim(), 'ITEM figures: unreadable. Retry.');
  for (const prefix of ['bask', 'eth', 'staking']) {
    const values = await figures(prefix);
    const label = prefix === 'staking' ? 'Unstake' : 'Withdraw';
    await reach(prefix, label);
    if (values.staked > 0n) {
      await page.locator(`#${prefix}-withdraw`).fill(formatUnits(values.staked, 18));
      assert.ok(await card(prefix).getByRole('button', { name: label, exact: true }).isEnabled(), `${prefix} ${label} stays available while an unrelated read fails.`);
      await page.locator(`#${prefix}-withdraw`).fill('');
    } else assert.equal((await card(prefix).locator('.refined-withdraw .disabled-reason').textContent()).trim(), 'Enter an amount.', `${prefix} ${label} keeps its ordinary reason.`);
  }
  faultCall = null;
  await refresh();
  pass('Partial read: with the USDG router allowance unreadable, only the BASK/USDG Add liquidity action is off, with its reason; every figure of the three cards still agrees with the chain and Withdraw and Unstake stay available; a refresh restores the form.');
  // New fixture work follows the original sends, keeping their original inputs and ordering intact.
  for (const token of [KNOWN.BASK, KNOWN.USDG]) {
    const held = await balance(token, KNOWN.DEV);
    assert.ok(held > 100n, 'The authorized dev wallet funds both BASK/USDG inputs.');
    await fixtureSend(KNOWN.DEV, token, tokenAbi, 'transfer', [mock, held / 10n]);
  }
  for (const token of [KNOWN.BASK, KNOWN.USDG, LAUNCH.ITEM]) if (await read(token, tokenAbi, 'allowance', [mock, KNOWN.V2_ROUTER]) !== 0n) await fixtureSend(mock, token, tokenAbi, 'approve', [KNOWN.V2_ROUTER, 0n]);
  await refresh(); await addLiquidity('bask'); await addLiquidity('eth');
  assert.equal(sends.length, 17); assert.equal(expected, null);
  assert.equal(walletSendAttempts, 17, 'Exactly the seventeen approved prompts were attempted; cancelled reads cannot hide a rejected extra prompt.');
  assert.deepEqual(sends.map(send => send.functionName), ['approve', 'stake', 'withdraw', 'claim', 'approve', 'stake', 'withdraw', 'claim', 'approve', 'stake', 'unstake', 'claim', 'approve', 'approve', 'addLiquidity', 'approve', 'addLiquidityETH']);
  assert.deepEqual(sends.filter(send => send.value !== undefined).map(send => send.number), [17], 'ETH value appears only on send 17.');
  pass('Exactly 17 UI sends in the specified order; only the ITEM/ETH add carries ETH value.');
  for (const [contract, token, abi] of [[LAUNCH.BASK_USDG_GAUGE, KNOWN.BASK_USDG_PAIR, gaugeAbi], [LAUNCH.ITEM_ETH_GAUGE, LAUNCH.ITEM_WETH_PAIR, gaugeAbi], [LAUNCH.ITEM_STAKING, LAUNCH.ITEM, stakingAbi]]) {
    const amount = await read(contract, abi, 'staked', [mock]);
    if (await balance(token, KNOWN.DEV) < amount) { const account = await donor(token, amount); await fixtureSend(account, token, tokenAbi, 'transfer', [KNOWN.DEV, amount]); }
    await fixtureSend(KNOWN.DEV, token, tokenAbi, 'approve', [contract, amount]);
    await fixtureSend(KNOWN.DEV, contract, abi, 'stake', [amount]);
  }
  await refresh(); await compareRewards('after a second staker is funded and stakes in each pool');
  await openTab('staking', 'Manage');
  await capture('Rewards with a second staker', '[data-item-card="staking"]');
  for (const state of [null, 'roles-unavailable']) {
    fixture = state; currentRoute = 'transparency';
    // Force a new document so the existing vault snapshot reads each role state.
    await page.goto('about:blank');
    await page.goto('http://127.0.0.1:9525/#transparency');
    await page.locator('.item-source').waitFor();
    await page.waitForFunction(() => !document.querySelector('[data-role="owner"]')?.textContent.includes('Reading...'));
    assert.equal(await page.locator('.transparency-balances, .item-setup, .item-refresh').count(), 0, 'Transparency has no allocation table, launch checklist or ITEM refresh.');
    const devLink = await page.locator('[data-role="dev"] a').textContent();
    assert.equal(lower(devLink.trim()), lower(KNOWN.DEV), 'Developer address remains the specified beneficiary.');
    for (const role of ['owner', 'guardian']) {
      const row = page.locator(`[data-role="${role}"]`);
      if (state === null) {
        const address = await read(KNOWN.BASK, vaultAbi, role);
        assert.equal(lower((await row.locator('a').textContent()).trim()), lower(address), `${role} address agrees with the existing vault snapshot source.`);
      } else {
        assert.ok((await row.textContent()).includes('unreadable'), `${role} read failure is explicitly unreadable.`);
        assert.equal(await row.locator('a').count(), 0, `${role} read failure never substitutes a known wallet.`);
      }
    }
    assert.equal(await page.locator('.item-source a').filter({ hasText: LAUNCH.ITEM_REPO }).getAttribute('href'), LAUNCH.ITEM_REPO, 'Exact accepted source URL remains linked.');
    assert.equal(rpcByRoute.transparency?.itemCalls ?? 0, 0, 'Transparency reuses the vault snapshot without new ITEM RPC reads.');
    await capture(state === null ? 'Contracts and live role addresses' : 'Vault role addresses unavailable', '.item-source', state === null ? 'Configured contracts plus live vault owner and guardian addresses.' : 'Read-only owner/guardian response failure; developer and configured contract addresses stay visible.');
  }
  pass('Transparency shows contracts, exact source and developer/live vault roles, preserves unavailable roles honestly, and adds no ITEM reads.');
  fixture = null;
  await navigate('docs'); await page.getByRole('heading', { name: 'Find ITEM', exact: true }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'Add liquidity on Uniswap', exact: true }).count(), 2);
  await page.getByRole('tab', { name: 'Tokenomics', exact: true }).click(); await page.locator('.tm-live dd').first().waitFor();
  pass('Docs Find ITEM and the existing Tokenomics live block are reachable when filled.');
  for (const route of ['vault', 'deposit', 'redeem', 'owner', 'losses', 'transparency']) {
    await navigate(route); await page.waitForTimeout(300); const before = rpcLog.length;
    await page.waitForTimeout(1200);
    assert.equal(rpcLog.slice(before).filter(call => call.method === 'eth_call' && isItemCall(call)).length, 0, `${route}: no ITEM reads while ITEM pages are closed.`);
    assert.equal(rpcByRoute[route]?.itemCalls ?? 0, 0, `${route}: no ITEM calls on opening.`);
  }
  pass('Vault, Deposit, Redeem, Owner, Losses and Transparency make no ITEM reads while Earn is closed.');
  await navigate('earn'); await ready();
  // 2026-10-16, Earn layout build: at each width every pool, tab and disclosure is opened; every action that shows must be
  // reachable, the union over those states must cover every button and summary of the three cards, and the hidden pool's
  // and the hidden panels' controls must refuse focus.
  const layoutSweep = [];
  for (const width of [320, 375, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    const controls = '[data-item-card] button, [data-item-card] summary';
    const total = await page.locator(controls).count(), covered = new Set();
    let opened = 0;
    for (const prefix of ['bask', 'eth', 'staking']) for (const name of TABS[prefix]) {
      await openTab(prefix, name);
      if (name === 'Add liquidity') await openDisclosure(prefix, 'Details');
      if (name === 'Manage') await openDisclosure(prefix, WITHDRAW[prefix]);
      opened++;
      const geometry = await page.locator('main').evaluate(main => ({ width: main.clientWidth, scroll: main.scrollWidth, boxes: [...main.querySelectorAll('.panel')].map(panel => ({ width: panel.clientWidth, scroll: panel.scrollWidth })) }));
      assert.ok(geometry.scroll <= geometry.width + 1 && geometry.boxes.every(box => box.scroll <= box.width + 1), `Earn ${width} ${prefix} ${name}: panels do not overflow.`);
      for (const control of await page.locator(controls).all()) {
        const index = await control.evaluate((node, controls) => [...document.querySelectorAll(controls)].indexOf(node), controls);
        if (!(await control.isVisible())) continue;
        await control.scrollIntoViewIfNeeded(); const box = await control.boundingBox();
        assert.ok(box && box.width > 0 && box.height > 0 && box.x >= 0 && box.x + box.width <= width + 1, `${width} ${prefix} ${name}: action reachable`);
        covered.add(index);
      }
      const hidden = await page.locator('[data-pool-view][hidden] :is(input, button, a, select, summary), [role="tabpanel"][hidden] :is(input, button, a, select, summary)').all();
      assert.ok(hidden.length > 0, `${width} ${prefix} ${name}: the hidden pool and the hidden panels keep their controls mounted`);
      for (const control of hidden) { await control.evaluate(node => node.focus()); assert.equal(await control.evaluate(node => document.activeElement === node), false, `${width} ${prefix} ${name}: a hidden control refuses focus`); }
    }
    assert.equal(covered.size, total, `${width}: every one of the ${total} card actions and disclosures is reachable in the state that shows it.`);
    layoutSweep.push({ width, opened, controls: total });
  }
  await navigate('transparency'); await page.locator('.item-source').waitFor();
  for (const width of [320, 375, 1440, 1920]) { await page.setViewportSize({ width, height: 1000 }); assert.ok(await page.locator('main').evaluate(main => main.scrollWidth <= main.clientWidth + 1), `Transparency ${width}: content does not overflow.`); }
  pass('New page content fits 320, 375, 1440 and 1920; every action can be scrolled into view. Header visibility is checked separately.');
  // 2026-10-17, round-2 review: a saved send without a receipt locks every ITEM action in this tab, whoever sent it, until
  // its nonce has passed with nothing queued; a page load and Refresh read the record's own account. A made-up hash for the
  // owner wallet stands for a send this RPC cannot see; the record is the one wallet.tsx saves (same key and shape).
  // 2026-10-17, round-3 review: the page reads its saved record once, on load, so every change to the record below is followed
  // by a new document (about:blank first) before the lock is read; the record lives under the ITEM sends' own key, a vault
  // send's bookkeeping under the vault's key never touches it, and a record without a nonce whose hash the fork cannot find
  // stays locked until it is removed.
  {
    const pendingReason = 'Another transaction is pending. Finish it in your wallet or wait for its receipt.';
    const pendingKey = 'basket-item-pending-4663', vaultKey = 'basket-pending-4663', bogus = `0x${'ab'.repeat(32)}`;
    const ownerLatest = Number(await local('eth_getTransactionCount', [KNOWN.OWNER, 'latest']));
    assert.ok(ownerLatest >= 1, 'The owner wallet has sent fixture transactions on the fork.');
    const record = nonce => JSON.stringify({ hash: bogus, account: KNOWN.OWNER, functionName: 'stake', ...(nonce === undefined ? {} : { nonce }) });
    const saveRecord = nonce => page.evaluate(([key, value]) => sessionStorage.setItem(key, value), [pendingKey, record(nonce)]);
    const stored = () => page.evaluate(key => sessionStorage.getItem(key), pendingKey);
    const load = async () => { currentRoute = 'earn'; await page.goto('about:blank'); await page.goto('http://127.0.0.1:9525/#earn'); await ready(); }; // a new document: the saved record is read on load
    const lockState = async (expectedLocked, what) => {
      for (const prefix of ['bask', 'eth', 'staking']) {
        await page.waitForFunction(({ prefix, reason, locked }) => { const nodes = [...document.querySelectorAll(`[data-item-card="${prefix}"] .disabled-reason`)]; return nodes.length > 0 && (locked ? nodes.every(node => node.textContent.trim() === reason) : !nodes.some(node => node.textContent.trim() === reason)); }, { prefix, reason: pendingReason, locked: expectedLocked }, { timeout: 30000 });
        const buttons = await card(prefix).locator('button:not([role="tab"])').evaluateAll(list => list.map(button => button.disabled));
        if (expectedLocked) assert.ok(buttons.length > 0 && buttons.every(Boolean), `${prefix}: every action is off ${what}`);
        else assert.ok(buttons.some(disabled => !disabled), `${prefix}: actions are available again ${what}`);
      }
    };
    await saveRecord(ownerLatest); // the owner's next nonce: nothing has passed it yet
    await load(); await lockState(true, "while another account's send is unresolved, on load");
    await refresh(); await lockState(true, 'after Refresh while its nonce has not passed');
    // A vault send's bookkeeping writes and clears the vault's own key (wallet.tsx's vault branch): the ITEM record is untouched.
    await page.evaluate(([key, value]) => { sessionStorage.setItem(key, value); sessionStorage.removeItem(key); }, [vaultKey, JSON.stringify({ hash: bogus, account: KNOWN.OWNER, functionName: 'deposit', nonce: ownerLatest })]);
    assert.equal(await stored(), record(ownerLatest), "The ITEM record is untouched by a write and clear under the vault's key.");
    await load(); await lockState(true, "on load after a vault send's record was saved and cleared under the vault's key");
    // Its nonce has passed, but a queued transaction means the count may still move: the lock holds. The record with the passed
    // nonce must be the one the page holds, so it is loaded as a new document before the lock is read (round-3 review).
    await local('anvil_impersonateAccount', [KNOWN.OWNER]); await local('evm_setAutomine', [false]);
    const queuedHash = await local('eth_sendTransaction', [{ from: KNOWN.OWNER, to: KNOWN.OWNER, value: '0x0', gas: '0x5208' }]);
    assert.equal(Number(await local('eth_getTransactionCount', [KNOWN.OWNER, 'pending'])), ownerLatest + 1, 'The fork queues the unmined transaction.');
    await saveRecord(ownerLatest - 1);
    await load(); await lockState(true, 'on load while a transaction is queued, although the saved nonce has passed');
    await refresh(); await lockState(true, 'after Refresh while a transaction is queued, although the saved nonce has passed');
    await local('evm_mine'); await local('evm_setAutomine', [true]);
    const queuedReceipt = await client.waitForTransactionReceipt({ hash: queuedHash }); assert.equal(queuedReceipt.status, 'success');
    fixtureSends.push({ from: KNOWN.OWNER, to: KNOWN.OWNER, functionName: 'noop', data: '0x', hash: queuedHash, fixture: true });
    await refresh(); await lockState(false, 'once the saved nonce has passed with nothing queued');
    assert.equal(await stored(), null, 'The settled record is removed.');
    // A record without a nonce whose hash the fork cannot find has nothing to settle by: it stays locked until it is removed.
    await saveRecord(undefined);
    await load(); await lockState(true, 'on load for a record without a nonce whose hash the fork cannot find');
    await refresh(); await lockState(true, 'after Refresh for a record without a nonce whose hash the fork cannot find');
    await page.evaluate(key => sessionStorage.removeItem(key), pendingKey);
    await load(); await lockState(false, 'once the record without a nonce is removed');
    pass("Pending-send lock: a saved ITEM send of another account without a receipt turns every ITEM action off with the pending reason on load and after Refresh; a vault send's write and clear under the vault's key leaves the ITEM record and the lock in place; with the passed nonce in the record the page loaded, the lock holds on load and after Refresh while a transaction is queued, settles once nothing is, and the record is removed; a record without a nonce stays locked until it is removed.");
    // 2026-10-17, round-4 review: an ITEM send whose receipt arrives after the page changed under it. Two proof sends outside the
    // seventeen (a Claim ITEM of the mock wallet each), each held unmined until the change is done. (1) Earn is left and opened
    // again: the reopened page's check finds the send unmined and turns the lock on; the send's own receipt must turn it off, and
    // the refresh the send kept (from the page that was left) must read the figures on screen again. (2) The wallet switches to
    // another account: the account change's check turns the lock on the same way; the receipt must turn it off, and the earlier
    // account's refresh must leave the shown account's cards and figures in place. The other account holds nothing, so its
    // figures read "0 pool tokens" where the mock wallet's do not.
    const until = async (test, what, timeout = 30000) => { const end = Date.now() + timeout; while (!test()) { assert.ok(Date.now() < end, what); await new Promise(resolve => setTimeout(resolve, 50)); } };
    const countReads = () => rpcByRoute.earn?.methods.eth_getTransactionCount ?? 0; // only itemPending reads counts after the prompt (the receipt wait reads none)
    const holdClaim = async () => {
      await advance(3600); await load();
      assert.ok(await read(LAUNCH.BASK_USDG_GAUGE, gaugeAbi, 'earned', [mock]) > 0n, 'The mock wallet has ITEM to claim for the proof send.');
      await reach('bask', 'Claim ITEM');
      const claim = card('bask').getByRole('button', { name: 'Claim ITEM', exact: true });
      assert.equal(await claim.isDisabled(), false, 'Claim ITEM is available for the proof send.');
      let resolveProof, rejectProof;
      const proofSent = new Promise((resolve, reject) => { resolveProof = resolve; rejectProof = reject; });
      expected = { to: LAUNCH.BASK_USDG_GAUGE, data: encode(gaugeAbi, 'claim'), prefix: 'bask', label: 'Claim ITEM', fn: 'claim', args: [], since: rpcLog.length, resolve: resolveProof, reject: rejectProof, proof: true };
      await local('evm_setAutomine', [false]);
      const [, hash] = await Promise.all([claim.click(), proofSent]);
      assert.equal(await local('eth_getTransactionReceipt', [hash]), null, 'The proof send stays unmined until the page has changed.');
      return hash;
    };
    const confirmHeld = async hash => {
      await page.waitForTimeout(500); // the change's check has read the counts; let it set the lock before the receipt
      await local('evm_mine'); await local('evm_setAutomine', [true]);
      assert.equal((await client.waitForTransactionReceipt({ hash })).status, 'success');
      await page.waitForFunction(() => { const text = document.querySelector('.wallet-status')?.textContent ?? ''; return text.startsWith('Claim ITEM: Confirmed.') && !text.includes('Refreshing'); }, null, { timeout: 60000 });
    };
    const leftHash = await holdClaim();
    await navigate('docs'); await page.getByRole('heading', { name: 'Find ITEM', exact: true }).waitFor();
    let countsBefore = countReads();
    await navigate('earn');
    await page.locator('[data-pool-view]:not([hidden]) [data-item-card]').waitFor(); await page.locator('[data-figure="bask.earned"]').waitFor({ state: 'attached' });
    await until(() => countReads() >= countsBefore + 2, "The reopened page's check read the saved send's counts.");
    await confirmHeld(leftHash);
    const earnedAfter = expectedText(await read(LAUNCH.BASK_USDG_GAUGE, gaugeAbi, 'earned', [mock])) + ' ITEM';
    assert.equal((await page.locator('[data-figure="bask.earned"]').textContent()).trim(), earnedAfter, 'The reopened page shows the figures after the confirmed claim, without Refresh.');
    await lockState(false, 'after Earn was left and opened again during the send, without Refresh');
    assert.equal(await stored(), null, 'The confirmed send left no saved record.');
    pass('An ITEM send confirmed after Earn was left and opened again: the reopened page shows the figures after the receipt and its actions are available, without Refresh; no record stays saved.');
    const other = '0x0000000000000000000000000000000000000b0b';
    const mockStaked = async () => expectedText(await read(LAUNCH.BASK_USDG_GAUGE, gaugeAbi, 'staked', [mock]), 18, true) + ' pool tokens';
    assert.notEqual(await mockStaked(), '0 pool tokens', 'The mock wallet still has pool tokens staked, so the two accounts read apart.');
    const switchHash = await holdClaim();
    countsBefore = countReads();
    walletAccount = other;
    await page.evaluate(account => window.ethereum.emit('accountsChanged', [account]), other);
    await page.waitForFunction(() => document.querySelector('[data-figure="bask.staked"]')?.textContent.trim() === '0 pool tokens', null, { timeout: 30000 });
    await until(() => countReads() >= countsBefore + 2, "The account change's check read the saved send's counts.");
    await confirmHeld(switchHash);
    assert.equal(await page.locator('[data-item-card]').count(), 3, "The shown account's three cards stay after the earlier account's send is confirmed, without Refresh.");
    assert.equal((await page.locator('[data-figure="bask.staked"]').textContent()).trim(), '0 pool tokens', "The cards keep the shown account's figures, not the earlier account's.");
    pass("An ITEM send confirmed after the wallet switched to another account: the shown account's cards and figures stay without Refresh; the earlier account's refresh reads the shown account's figures again.");
    await lockState(false, "after the earlier account's send was confirmed, without Refresh");
    assert.equal(await stored(), null, 'The confirmed send left no saved record.');
    pass("The lock that the account change's check turned on while the send was unmined clears with the send's own receipt: the actions are available again without Refresh and no record stays saved.");
    walletAccount = mock;
    const mockText = await mockStaked();
    await page.evaluate(account => window.ethereum.emit('accountsChanged', [account]), mock);
    await page.waitForFunction(text => document.querySelector('[data-figure="bask.staked"]')?.textContent.trim() === text, mockText, { timeout: 30000 });
    await ready();
    assert.deepEqual([proofSends.length, sends.length, walletSendAttempts], [2, 17, 19], 'Two proof sends beside the seventeen; no other prompt.');
    // An older check whose transaction and count reads end only after a newer check found the receipt and removed the record
    // leaves the lock off: a cleared record leaves nothing to wait for. Its reads are held, then fail on both RPC hosts.
    const lateLatest = Number(await local('eth_getTransactionCount', [KNOWN.OWNER, 'latest']));
    await local('anvil_impersonateAccount', [KNOWN.OWNER]); await local('evm_setAutomine', [false]);
    const lateHash = await local('eth_sendTransaction', [{ from: KNOWN.OWNER, to: KNOWN.OWNER, value: '0x0', gas: '0x5208' }]);
    await page.evaluate(([key, value]) => sessionStorage.setItem(key, value), [pendingKey, JSON.stringify({ hash: lateHash, account: KNOWN.OWNER, functionName: 'stake', nonce: lateLatest })]);
    await load(); await lockState(true, 'on load while the saved send is unmined');
    let releaseLate;
    const fault = lockReadFault = { hash: lateHash, account: KNOWN.OWNER, entered: 0, answered: 0, lastAnswer: 0, release: new Promise(resolve => { releaseLate = resolve; }) };
    await refresh(); // the older check: its receipt read finds nothing; its transaction and count reads are held
    await until(() => fault.entered >= 3, 'The older check waits on its transaction and count reads.');
    await local('evm_mine'); await local('evm_setAutomine', [true]);
    assert.equal((await client.waitForTransactionReceipt({ hash: lateHash })).status, 'success');
    fixtureSends.push({ from: KNOWN.OWNER, to: KNOWN.OWNER, functionName: 'noop', data: '0x', hash: lateHash, fixture: true });
    await refresh(); await lockState(false, 'once a newer check found the receipt');
    assert.equal(await stored(), null, 'The newer check removed the settled record.');
    releaseLate();
    await until(() => fault.answered >= 3 && fault.answered >= fault.entered && Date.now() - fault.lastAnswer > 1500, "Every one of the older check's late reads was answered.");
    lockReadFault = null;
    await page.waitForTimeout(300);
    await lockState(false, 'after an older check whose reads failed only once a newer check had removed the record');
    assert.equal(await stored(), null, 'No record came back.');
    pass('An older lock check whose reads fail only after a newer check found the receipt and removed the record leaves the lock off.');
    // 2026-10-17, v22 rebase (Codex V22-02 for the ITEM lock): a lookup error is not "not found". For a saved record whose nonce has
    // passed with nothing queued (a record the lock would otherwise settle), the page's RPC answers its transaction lookup, and in a
    // second state its receipt lookup, with a JSON-RPC error on both hosts while the counts answer normally: the lock must hold on
    // load and after Refresh (every action off with the pending reason, no other error on the page, never the RPC's own words);
    // once the lookups answer normally again the record settles and is removed, as before.
    const settledLatest = Number(await local('eth_getTransactionCount', [KNOWN.OWNER, 'latest']));
    assert.equal(Number(await local('eth_getTransactionCount', [KNOWN.OWNER, 'pending'])), settledLatest, 'Nothing is queued for the owner wallet.');
    for (const method of ['eth_getTransactionByHash', 'eth_getTransactionReceipt']) {
      await saveRecord(settledLatest - 1);
      const fault = lookupFault = { method, hash: bogus, answered: 0 };
      // Each check's lookup must be answered (once per host) before the next step: the page shares identical in-flight reads.
      await load(); await until(() => fault.answered >= 2, `${method}: the lock check on load asked the failing lookup on both hosts`); await page.waitForTimeout(300);
      await lockState(true, `on load while ${method} fails on both hosts although the saved nonce has passed`);
      await refresh(); await until(() => fault.answered >= 4, `${method}: the lock check after Refresh asked the failing lookup on both hosts`); await page.waitForTimeout(300);
      await lockState(true, `after Refresh while ${method} fails on both hosts`);
      assert.equal(await stored(), record(settledLatest - 1), `${method}: the record stays while its lookup fails.`);
      assert.deepEqual((await page.locator('.item-refresh [role="alert"], [data-item-card] [role="alert"]').allTextContents()).filter(text => text.trim()), [], `${method}: no error line from the failed lookup.`);
      assert.equal(await page.getByText(/Injected lookup failure/).count(), 0, `${method}: the RPC's own message never shows.`);
      lookupFault = null;
      await refresh(); await lockState(false, `once ${method} answers normally again`);
      assert.equal(await stored(), null, `${method}: the record settles and is removed once the lookup answers.`);
      lookupFaultEvidence.push({ method, answered: fault.answered });
    }
    pass('Lookup error is not "not found": with the transaction lookup, then the receipt lookup, failing on both RPC hosts for a saved record whose nonce has passed with nothing queued, every ITEM action stays off with the pending reason on load and after Refresh, no other error shows, the record stays, and it settles once the lookups answer again.');
  }
  assert.deepEqual([...visited.pools].sort(), ['bask', 'eth'], 'The Pool selector drove both pools.');
  assert.equal(visited.tabs.size, 11, 'Every tab of the three cards was opened.');
  assert.equal(visited.disclosures.size, 5, 'Both Details and all three withdraw/unstake disclosures were opened.');
  await sheets();
  const record = { result: 'PASS', forkBlock: String(config.BLOCK_NUMBER), mock, sends, proofSends, walletSendAttempts, fixtureSends, checks, states, rpcByRoute, feeAmounts, earnedBehindEarlierStream: earnedBehindEarlierStream.toString(), dollarValuation, rewardComparisons, liquidityComparisons, layout: { pools: [...visited.pools], tabs: [...visited.tabs], disclosures: [...visited.disclosures], keyboard: [...visited.keyboard], sweep: layoutSweep }, typing: typingEvidence, screenshots: [...new Set(states.map(state => state.screenshot))], fixtureExplanation: 'Read-only response substitutions label empty-wallet, not-started, unseeded-pool, wrong-pair and unavailable-vault-role screenshots; the Disconnect regression delays one genuine read response without changing its contents; all seventeen transactions and their chain/DOM comparisons use unmodified fork responses; the round-4 checks send two more Claim ITEM (proofSends), each held unmined until Earn is left and opened again or the wallet account changes; the late-read lock check holds and then fails the transaction and count reads of one record; the lookup-error check answers one hash lookup method with a JSON-RPC error on both hosts while the counts answer.', lookupFaults: lookupFaultEvidence, snapshotRestored: false };
  assert.equal(await local('evm_revert', [snapshot]), true); snapshot = undefined; record.snapshotRestored = true;
  fs.writeFileSync(path.join(artifacts, 'browser-item-fork.json'), JSON.stringify(record) + '\n');
  console.log(`PASS ITEM browser walk: ${checks.length} checks, ${sends.length} sends, ${states.length} photographed states, ${record.screenshots.length} JPEG contact sheets; snapshot restored.`);
} catch (error) {
  fs.writeFileSync(path.join(artifacts, 'browser-item-fork-failure.json'), JSON.stringify({ result: 'FAIL', error: error.message, checks, sends, proofSends, walletSendAttempts, walletRequests, fixtureSends, states, rpcByRoute }, null, 2) + '\n');
  console.error(error); process.exitCode = 1;
} finally {
  if (snapshot) { try { await local('evm_revert', [snapshot]); } catch (error) { console.error(`Snapshot restore failed: ${error.message}`); process.exitCode = 1; } }
  if (reuse && oldAutoMine !== undefined) { try { await local('evm_setAutomine', [oldAutoMine]); } catch { process.exitCode = 1; } }
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
  if (anvil) anvil.kill();
  if (proxy) await new Promise(resolve => proxy.close(resolve));
}

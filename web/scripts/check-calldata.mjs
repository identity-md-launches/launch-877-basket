import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { build } from 'esbuild';
import { getAddress, encodeFunctionData } from 'viem';
const root=process.env.BASKET_SOURCE_ROOT||path.resolve('..');
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'});
// v24 retains every v23/v22 transaction comparison after exact generated restoration.
import {checkV24Sources, restoreV24} from './check-v24-source.mjs';
// 2026-10-20, vault stats build (v25) on the live v24 site: HEAD is the v24 commit; the v25 pieces of Vault.tsx and
// styles.css are put back first (v25-restore.mjs), then v24's, before every inherited comparison below.
import {restoreV25, V25_BASE, V25_NEW_SOURCES} from './v25-restore.mjs';
checkV24Sources(root);
const BASE='736affca69ad6aefe27b27d7e0ceeb405c236a96', LEGACY='3038c97b30503df69fd4760381e208df2ba54f34';
assert.equal(git(['rev-parse','HEAD']).trim(),V25_BASE,'exact v25 base commit (the live v24 site)');
const baseline=p=>git(['show',LEGACY+':'+p]);
const rawRead=p=>restoreV24(p,restoreV25(p,fs.readFileSync(path.join(root,p),'utf8')));
const read=p=>restoreApproved(p,rawRead(p));
const sha256=s=>createHash('sha256').update(s).digest('hex');
// ITEM pages on HEAD=v22 (3038c97b, the live site since 2026-10-17; the ITEM work was rebased from v16 onto v20 on
// 2026-10-16 and onto v22 on 2026-10-17). v17 to v22 (the contact links, addToWallet() and its Docs button, the short-stock
// notice and the Docs panel "If a stock goes missing", the check re-scopes, v22's vault-send settle sendPending(), the Redeem
// and Deposit preview checks and the Fee recipient row) are HEAD's own: every assertion below compares with HEAD itself,
// and only the ITEM additions are documented exceptions. Transactions remain HEAD's: send(), connect(), disconnect(),
// switchChain() and sendPending() keep their pins; the ITEM send path is pinned separately below.
// ITEM SPEC 2-7: approved edits are restored before every unchanged legacy AST/state/calldata assertion.
// Raw independent pins below bind every approved byte; regenerating the two marked lists cannot authorize edits.
const ITEM_NEW_SOURCES=["itemConstants.ts","itemAbi.ts","itemReads.ts","itemActions.ts","itemFormat.ts","Earn.tsx","Transparency.tsx","FindItem.tsx"];
// >>> item-site pieces (generated; every raw source also has an independent pin)
const editedFiles={
 "main.tsx":[
  ["import { LossesPage } from \"./Losses\";\n// SPEC 3: ITEM routes are mounted only while open.\nimport { EarnPage } from \"./Earn\";\nimport { TransparencyPage } from \"./Transparency\";\nimport { Marquee, StoreShelf } from \"./Scenery\";\nimport \"./styles.css\";\nconst pages = [\"Vault\", \"Deposit\", \"Redeem\", \"Earn\", \"Docs\"];\nconst routes = [...pages, \"Owner\", \"Losses\", \"Transparency\"];\nfunction currentPage() {\n",
   "import { LossesPage } from \"./Losses\";\nimport { Marquee, StoreShelf } from \"./Scenery\";\nimport \"./styles.css\";\nconst pages = [\"Vault\", \"Deposit\", \"Redeem\", \"Docs\"];\nconst routes = [...pages, \"Owner\", \"Losses\"];\nfunction currentPage() {\n"],
  ["          <RedeemPage snapshot={data} wallet={wallet} />\n        ) : page === \"Earn\" ? (\n          <EarnPage snapshot={data} wallet={wallet} />\n        ) : page === \"Transparency\" ? (\n          <TransparencyPage snapshot={data} />\n        ) : page === \"Owner\" ? (\n",
   "          <RedeemPage snapshot={data} wallet={wallet} />\n        ) : page === \"Owner\" ? (\n"],
  ["            </a>\n            <a href=\"#transparency\" aria-current={page === \"Transparency\" ? \"page\" : undefined}>Transparency</a>\n            <a href=\"#docs\">Docs</a>\n",
   "            </a>\n            <a href=\"#docs\">Docs</a>\n"],
  ["            </a>\n            <a href=\"https://medium.com/@protocolbasket\" target=\"_blank\" rel=\"noreferrer\">\n              Basket Protocol on Medium\n            </a>\n            <a href=\"mailto:protocolbasket@gmail.com\">protocolbasket@gmail.com</a>\n",
   "            </a>\n            <a href=\"mailto:protocolbasket@gmail.com\">protocolbasket@gmail.com</a>\n"]
 ],
 "components.tsx":[
  ["  character?: {\n    kind: \"vault\" | \"deposit\" | \"redeem\" | \"earn\" | \"transparency\"; // SPEC 5: approved title art.\n    src: string;\n",
   "  character?: {\n    kind: \"vault\" | \"deposit\" | \"redeem\";\n    src: string;\n"]
 ],
 "wallet.tsx":[
  ["import { useEffect, useRef, useState } from \"react\";\nimport { checkItemSend, itemError } from \"./itemActions\"; // SPEC 6: isolated ITEM checks and errors.\nimport { decodeEventLog, type Address, type Hex } from \"viem\";\n",
   "import { useEffect, useRef, useState } from \"react\";\nimport { decodeEventLog, type Address, type Hex } from \"viem\";\n"],
  ["  \"The earlier transaction is finished (confirmed or replaced). Press Resume listing.\";\n// 2026-10-17, pre-launch review: the ITEM pages' reason while an earlier send has no receipt yet (their existing words).\nexport const ITEM_PENDING = \"Another transaction is pending. Finish it in your wallet or wait for its receipt.\";\n// v22 (2026-10-17, live-site review): every send except genesis listing first\n",
   "  \"The earlier transaction is finished (confirmed or replaced). Press Resume listing.\";\n// v22 (2026-10-17, live-site review): every send except genesis listing first\n"],
  ["}\n// 2026-10-17, round-3 review: ITEM sends keep a saved record of their own, apart from the vault's, so a vault send in\n// this tab never overwrites or clears it.\nconst itemPendingKey = \"basket-item-pending-4663\";\nfunction savedItemPending(): PendingTx | undefined {\n  try {\n    return (\n      JSON.parse(sessionStorage.getItem(itemPendingKey) || \"null\") || undefined\n    );\n  } catch {\n    return undefined;\n  }\n}\n// Set by Disconnect and kept across reloads until Connect wallet is answered.\n",
   "}\n// Set by Disconnect and kept across reloads until Connect wallet is answered.\n"],
  ["  const pendingShown = useRef(!!pendingRef.current);\n  // 2026-10-17, round-3 review: the ITEM sends' own saved record, apart from the vault's slot above.\n  const itemRef = useRef<PendingTx | undefined>(savedItemPending());\n  function report(key: string, value: ActionProgress) {\n",
   "  const pendingShown = useRef(!!pendingRef.current);\n  function report(key: string, value: ActionProgress) {\n"],
  ["  }\n  // 2026-10-17, pre-launch review: ITEM actions stay off while a sent transaction has no receipt yet. Settles the\n  // saved one when it is mined, replaced or its nonce has passed; returns the hash still unresolved, if any.\n  async function itemPending(): Promise<Hex | undefined> {\n    const pending = itemRef.current;\n    if (!account || !pending) {\n      setUnresolved(undefined);\n      return undefined;\n    }\n    // 2026-10-17, v22 rebase (Codex V22-02, the rule of sendPending above): only viem's \"not found\" answer to a hash lookup\n    // counts as absent; any other error of the two lookups leaves this check unresolved (no settle by either nonce rule; the\n    // record and the lock stay) and never rejects, so Refresh and opening Earn keep working.\n    let failed = false;\n    const absent = (name: string) => (e: unknown) => {\n      if ((e as { name?: string } | null)?.name === name) return undefined;\n      failed = true;\n      return undefined;\n    };\n    let settled = !!(await client\n      .getTransactionReceipt({ hash: pending.hash })\n      .catch(absent(\"TransactionReceiptNotFoundError\")));\n    if (!settled && !failed) {\n      // 2026-10-17, round-2 review: the record's own account is read, so another account in this tab waits too; a nonce\n      // the node reports settles alone; the predicted one only while nothing is queued, as listingPending's second guard.\n      const [transaction, latest, queued] = await Promise.all([\n        client.getTransaction({ hash: pending.hash }).catch(absent(\"TransactionNotFoundError\")),\n        client.getTransactionCount({ address: pending.account, blockTag: \"latest\" }).catch(() => undefined),\n        client.getTransactionCount({ address: pending.account, blockTag: \"pending\" }).catch(() => undefined),\n      ]);\n      settled = !failed && latest !== undefined && (transaction !== undefined ? latest > transaction.nonce : pending.nonce !== undefined && latest > pending.nonce && latest === queued);\n    }\n    // 2026-10-17, round-3 review: a late answer settles only the record it examined; a newer send's record stays.\n    const current = itemRef.current;\n    if (settled && (current === pending || current === undefined)) {\n      itemRef.current = undefined;\n      try {\n        sessionStorage.removeItem(itemPendingKey);\n      } catch {\n        /* storage unavailable */\n      }\n      setUnresolved(undefined);\n      return undefined;\n    }\n    const hash = current?.hash; // 2026-10-17, round-4 review: a record cleared meanwhile (by its receipt or a check that settled it) leaves nothing to wait for.\n    setUnresolved(hash);\n    return hash;\n  }\n  const [account, setAccount] = useState<Address>();\n",
   "  }\n  const [account, setAccount] = useState<Address>();\n"],
  ["  const [busy, setBusy] = useState(false);\n  // 2026-10-17, pre-launch review: the hash of a sent transaction without a receipt yet; ITEM actions wait for it.\n  const [unresolved, setUnresolved] = useState<Hex | undefined>(itemRef.current?.hash);\n  const [confirmed, setConfirmed] = useState<{\n",
   "  const [busy, setBusy] = useState(false);\n  const [confirmed, setConfirmed] = useState<{\n"],
  ["  }\n  async function send(s: Spec, key = s.functionName, label = key, afterItem?: () => Promise<void>) {\n    const item = \"itemAction\" in s; // SPEC 6: explicit ITEM context, never inferred from claim name.\n    if (sending.current)\n",
   "  }\n  async function send(s: Spec, key = s.functionName, label = key) {\n    if (sending.current)\n"],
  ["        throw new Error(\"Connect a wallet to send this transaction.\");\n      // 2026-10-17, pre-launch review: an ITEM send waits for the earlier one to be mined, replaced or passed by its nonce.\n      if (item) { const earlier = await itemPending(); if (earlier) throw new PendingTransaction(ITEM_PENDING, earlier); }\n      const [id, accounts] = await Promise.all([\n",
   "        throw new Error(\"Connect a wallet to send this transaction.\");\n      const [id, accounts] = await Promise.all([\n"],
  ["      if (s.functionName === \"listGenesis\") await listingPending();\n      else if (!item) await sendPending(key); // 2026-10-17, v22 rebase: the vault settle, for vault sends; an ITEM send settled its own record above.\n      // SPEC 6: ITEM target code check; the vault path is unchanged.\n      if (item) await checkItemSend(s);\n      else await verifyNetwork();\n      await simulate(s, account);\n      const gas = !item && [\"deposit\", \"redeem\", \"claim\"].includes(s.functionName) // SPEC 6: no vault gas branch for ITEM.\n        ? ((await client.estimateGas({\n",
   "      if (s.functionName === \"listGenesis\") await listingPending();\n      else await sendPending(key);\n      await verifyNetwork();\n      await simulate(s, account);\n      const gas = [\"deposit\", \"redeem\", \"claim\"].includes(s.functionName)\n        ? ((await client.estimateGas({\n"],
  ["            ...(gas ? { gas: `0x${gas.toString(16)}` } : {}),\n            ...(s.value !== undefined ? { value: `0x${s.value.toString(16)}` } : {}), // 2026-10-16, Add liquidity build: ITEM-only ETH value.\n          },\n",
   "            ...(gas ? { gas: `0x${gas.toString(16)}` } : {}),\n          },\n"],
  ["      setHash(tx);\n      const record = { hash: tx, account, functionName: s.functionName, nonce };\n      // 2026-10-17, round-3 review: an ITEM send keeps a saved record of its own; the vault's slot is written by vault sends only.\n      if (item) {\n        itemRef.current = record;\n        try {\n          sessionStorage.setItem(itemPendingKey, JSON.stringify(record));\n        } catch {\n          /* storage unavailable */\n        }\n      } else {\n        pendingRef.current = record;\n        try {\n          sessionStorage.setItem(pendingKey, JSON.stringify(pendingRef.current));\n        } catch {\n          /* nonce guard also protects reloads */\n        }\n      }\n",
   "      setHash(tx);\n      pendingRef.current = { hash: tx, account, functionName: s.functionName, nonce };\n      try {\n        sessionStorage.setItem(pendingKey, JSON.stringify(pendingRef.current));\n      } catch {\n        /* nonce guard also protects reloads */\n      }\n"],
  ["      settled = true;\n      if (item) {\n        itemRef.current = undefined;\n        try {\n          sessionStorage.removeItem(itemPendingKey);\n        } catch {\n          /* storage unavailable */\n        }\n        setUnresolved(undefined); // 2026-10-17, round-4 review: this send's own receipt; the record it wrote is gone.\n      } else {\n        pendingRef.current = undefined;\n        try {\n          sessionStorage.removeItem(pendingKey);\n        } catch {\n          /* storage unavailable */\n        }\n      }\n",
   "      settled = true;\n      pendingRef.current = undefined;\n      try {\n        sessionStorage.removeItem(pendingKey);\n      } catch {\n        /* storage unavailable */\n      }\n"],
  ["        throw new TransactionCancelled(\n          item ? \"The transaction did not run. Refresh before retrying.\" : // SPEC 6: no vault words for ITEM.\n          replaced === \"cancelled\"\n",
   "        throw new TransactionCancelled(\n          replaced === \"cancelled\"\n"],
  ["      report(key, { message: `${label}: Confirmed. Refreshing…`, hash: mined });\n      // SPEC 6: refresh only the ITEM page; never run vault owed/proposal follow-ups.\n      if (item) {\n        await afterItem?.();\n        report(key, { message: `${label}: Confirmed.`, hash: mined });\n        return receipt;\n      }\n      let detail = \"\";\n",
   "      report(key, { message: `${label}: Confirmed. Refreshing…`, hash: mined });\n      let detail = \"\";\n"],
  ["      }\n      const message = item ? itemError(e) : await explainAction(e, s); // SPEC 6: vault decoding is vault-only.\n      const status =\n",
   "      }\n      const message = await explainAction(e, s);\n      const status =\n"],
  ["          : message;\n      if (item && sent && !settled) setUnresolved(sent); // 2026-10-17, pre-launch review: ITEM actions wait for this hash.\n      if (sent && !settled && s.functionName === \"listGenesis\")\n",
   "          : message;\n      if (sent && !settled && s.functionName === \"listGenesis\")\n"],
  ["    waitPending,\n    itemPending,\n    unresolved,\n    chainId,\n",
   "    waitPending,\n    chainId,\n"]
 ],
 "chain.ts":[
  ["  args?: readonly unknown[];\n} & ({ itemAction?: never; value?: never; itemUser?: never } | { itemAction: string; value?: bigint; itemUser?: Address }); // 2026-10-16, Add liquidity build: value belongs only to ITEM specs.\nexport const vault = (\n",
   "  args?: readonly unknown[];\n};\nexport const vault = (\n"],
  ["export async function simulate(s: Spec, account?: Address): Promise<void> {\n  // 2026-10-16, Add liquidity build: the router recipient is the sending account.\n  if (s.itemUser !== undefined && s.itemUser.toLowerCase() !== account?.toLowerCase()) throw new InputError(\"The wallet account changed. Please retry.\");\n  await client.call({\n",
   "export async function simulate(s: Spec, account?: Address): Promise<void> {\n  await client.call({\n"],
  ["    batch: false,\n    ...(s.value !== undefined ? { value: s.value } : {}), // 2026-10-16, Add liquidity build: simulate the exact ETH value.\n  });\n}\n\n// SPEC 6: ITEM-only target check; existing vault verification and reads stay unchanged.\nexport async function verifyItemTarget(address: Address, hash: Hex): Promise<void> {\n  const [id, code] = await Promise.all([client.getChainId(), client.getCode({ address })]);\n  if (id !== 4663 || !code || code === \"0x\" || keccak256(code) !== hash)\n    throw new InputError(\"ITEM contract code could not be verified. Transactions are unavailable.\");\n}\n",
   "    batch: false,\n  });\n}\n"]
 ],
 "Docs.tsx":[
  ["import { VAULT } from \"./deployment\";\nimport { FindItem } from \"./FindItem\"; // SPEC 3.3: address panel.\nexport function DocsPage({\n",
   "import { VAULT } from \"./deployment\";\nexport function DocsPage({\n"],
  ["          <p>\n            Add liquidity to one of the two Uniswap v2 pools, BASK/USDG or ITEM/ETH, and stake the pool token you receive on <a href=\"#earn\">the Earn page</a>. From that moment ITEM accrues to you every second, in proportion to your share of everything staked in that pool's gauge.\n          </p>\n",
   "          <p>\n            Add liquidity to one of the two Uniswap v2 pools, BASK/USDG or ITEM/ETH, and stake the pool token you receive on the Earn page. From that moment ITEM accrues to you every second, in proportion to your share of everything staked in that pool's gauge.\n          </p>\n"],
  ["          <p>\n            The 0.5% fee on each deposit and redemption goes to ITEM staking, so more trading through the vault means more fees for ITEM. Stake ITEM on <a href=\"#earn\">the Earn page</a> and you receive those fees in BASK, in proportion to your stake.\n          </p>\n",
   "          <p>\n            The 0.5% fee on each deposit and redemption goes to ITEM staking, so more trading through the vault means more fees for ITEM. Stake ITEM on the Earn page and you receive those fees in BASK, in proportion to your stake. The staking contract can also receive USDG and WETH, so other income can be sent to stakers the same way.\n          </p>\n"],
  ["          <p>\n            Stake and unstake at any time, with no lock or cooldown. Claim BASK pays the BASK you have earned so far. Unclaimed amounts stay owed to you. A reward token that cannot be transferred can never block staking or unstaking; it can only delay its own claim. BASK you claim can be redeemed for the Stock Tokens in the vault or sold in the BASK/USDG pool.\n          </p>\n",
   "          <p>\n            Stake and unstake at any time, with no lock or cooldown. Claim is per token: BASK, USDG and WETH are claimed separately, each paying what you have earned so far. Unclaimed amounts stay owed to you. A reward token that cannot be transferred can never block staking or unstaking; it can only delay its own claim. BASK you claim can be redeemed for the Stock Tokens in the vault or sold in the BASK/USDG pool.\n          </p>\n"],
  ["        </section>\n        {tab === 0 && <FindItem />}\n        <section className=\"panel\">\n",
   "        </section>\n        <section className=\"panel\">\n"],
  ["          </p>\n          <p>\n            <a href=\"https://medium.com/@protocolbasket\" target=\"_blank\" rel=\"noreferrer\">\n              Basket Protocol on Medium\n            </a>\n          </p>\n          <p>\n",
   "          </p>\n          <p>\n"]
 ],
 "tokenomicsData.ts":[
  ["import type { Address } from \"viem\";\nimport { LAUNCH, itemReady } from \"./itemConstants\"; // SPEC 2: all-slot guard, one address source.\n\n",
   "import type { Address } from \"viem\";\n\n"],
  ["export const ADDRESSES: Record<\"ITEM\" | \"ITEM_STAKING\" | \"BASK_USDG_GAUGE\" | \"ITEM_ETH_GAUGE\" | \"DEV_VESTING\", Address | null> = {\n  ITEM: itemReady(LAUNCH) ? LAUNCH.ITEM : null, ITEM_STAKING: itemReady(LAUNCH) ? LAUNCH.ITEM_STAKING : null, BASK_USDG_GAUGE: itemReady(LAUNCH) ? LAUNCH.BASK_USDG_GAUGE : null, ITEM_ETH_GAUGE: itemReady(LAUNCH) ? LAUNCH.ITEM_ETH_GAUGE : null, DEV_VESTING: itemReady(LAUNCH) ? LAUNCH.DEV_VESTING : null,\n};\n",
   "export const ADDRESSES: Record<\"ITEM\" | \"ITEM_STAKING\" | \"BASK_USDG_GAUGE\" | \"ITEM_ETH_GAUGE\" | \"DEV_VESTING\", Address | null> = {\n  ITEM: null, ITEM_STAKING: null, BASK_USDG_GAUGE: null, ITEM_ETH_GAUGE: null, DEV_VESTING: null,\n};\n"]
 ],
 "Tokenomics.tsx":[
  ["export function formatLive(value: bigint, lp = false) {\n  // Owner approval 2026-10-14: preserve nonzero live amounts and full pool-token precision.\n  const [whole, fraction = \"\"] = formatUnits(value, 18).split(\".\");\n  const decimals = fraction.slice(0, lp ? 18 : 6).replace(/0+$/, \"\");\n  if (value > 0n && whole === \"0\" && !decimals) return \"<0.000001\";\n  return BigInt(whole).toLocaleString(\"en-US\") + (decimals ? \".\" + decimals : \"\");\n",
   "export function formatLive(value: bigint, lp = false) {\n  if (!lp) return (value / 10n ** 18n).toLocaleString(\"en-US\");\n  const [whole, fraction = \"\"] = formatUnits(value, 18).split(\".\");\n  const decimals = fraction.slice(0, 6).replace(/0+$/, \"\");\n  return BigInt(whole).toLocaleString(\"en-US\") + (decimals ? \".\" + decimals : \"\");\n"]
 ]
};
// <<< item-site pieces
// SPEC 5: exact page-class extensions and additive ITEM styles. No selector affecting old pages may drift.
const ITEM_CSS_PIECES=[["  .page-title.character-redeem { --bw: 160px; }\n\n  .page-title.character-deposit,\n  .page-title.character-redeem,\n  .page-title.character-earn {\n    --col-gap: 12px;\n    display: grid;\n    grid-template-columns: calc(var(--w) + var(--col-gap)) minmax(0, 1fr);\n    grid-template-rows: minmax(0, 1fr) auto auto auto auto;\n  }\n  .page-title.character-deposit .title-character,\n  .page-title.character-redeem .title-character,\n  .page-title.character-earn .title-character {\n    --gx: 0px;\n    grid-area: 1 / 1 / 4 / 3;\n  }\n  .page-title.character-deposit > .eyebrow,\n  .page-title.character-redeem > .eyebrow,\n  .page-title.character-earn > .eyebrow { grid-area: 2 / 2; }\n  .page-title.character-deposit h1,\n  .page-title.character-redeem h1,\n  .page-title.character-earn h1 { grid-area: 3 / 2; margin-bottom: 17px; }\n  .page-title.character-deposit > p:last-of-type,\n  .page-title.character-redeem > p:last-of-type,\n  .page-title.character-earn > p:last-of-type { grid-area: 4 / 1 / 5 / 3; }\n  .page-title.character-deposit:after,\n  .page-title.character-redeem:after,\n  .page-title.character-earn:after { grid-area: 5 / 1 / 6 / 3; }\n}\n/* Smallest phones: a slightly smaller picture. Redeem keeps the side-by-side layout: its eyebrow\n   wraps to two lines beside her and the column gap shrinks so \"REDEEM\" fits. */\n","  .page-title.character-redeem { --bw: 160px; }\n\n  .page-title.character-deposit,\n  .page-title.character-redeem {\n    --col-gap: 12px;\n    display: grid;\n    grid-template-columns: calc(var(--w) + var(--col-gap)) minmax(0, 1fr);\n    grid-template-rows: minmax(0, 1fr) auto auto auto auto;\n  }\n  .page-title.character-deposit .title-character,\n  .page-title.character-redeem .title-character {\n    --gx: 0px;\n    grid-area: 1 / 1 / 4 / 3;\n  }\n  .page-title.character-deposit > .eyebrow,\n  .page-title.character-redeem > .eyebrow { grid-area: 2 / 2; }\n  .page-title.character-deposit h1,\n  .page-title.character-redeem h1 { grid-area: 3 / 2; margin-bottom: 17px; }\n  .page-title.character-deposit > p:last-of-type,\n  .page-title.character-redeem > p:last-of-type { grid-area: 4 / 1 / 5 / 3; }\n  .page-title.character-deposit:after,\n  .page-title.character-redeem:after { grid-area: 5 / 1 / 6 / 3; }\n}\n/* Smallest phones: a slightly smaller picture. Redeem keeps the side-by-side layout: its eyebrow\n   wraps to two lines beside her and the column gap shrinks so \"REDEEM\" fits. */\n"],["    width: calc(var(--pad) + var(--gx) + var(--w) + var(--col-gap) - 6px);\n  }\n}\n\n/* SPEC 5: approved ITEM title pictures and bubble placement. */\n.page-title.character-earn { --ratio: .453; --bx: .776; --tx: .57; --mouth: .173; --bw: 126px; --em1: 2.6; --em2: 2.6; }\n.page-title.character-transparency { --ratio: .4; --bx: 1.035; --tx: .71; --mouth: .199; --bw: 182px; --em1: 8.3; --em2: 8.3; }\n@media (max-width: 660px) {\n  .page-title.character-earn { --bw: 102px; --bx: .83; }\n  .page-title.character-transparency { --bw: 147px; --bx: 1.035; --tx: .69; }\n}\n/* SPEC 3: new pages only; existing page geometry is preserved. */\n.item-section { margin: 28px 0; }\n.item-section > h2 { margin-bottom: 12px; }\n.earn-gauges { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }\n.earn-card { min-width: 0; }\n.item-pool { margin-bottom: 20px; }\n.item-pool .address { display: block; }\n.item-figures, .item-setup { margin: 16px 0; }\n.item-figures > div, .item-setup > div { display: flex; justify-content: space-between; gap: 14px; padding: 10px 0; border-bottom: 1px solid var(--line); }\n.item-figures dt, .item-setup dt { min-width: 0; }\n.item-figures dd, .item-setup dd { margin: 0; text-align: right; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }\n.item-action { margin-top: 22px; padding-top: 18px; border-top: 2px solid var(--line); }\n.item-action label { display: block; }\n.item-action input { width: 100%; margin: 8px 0; }\n.item-buttons, .item-claims, .item-links { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 14px; }\n.item-refresh { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin: 18px 0; }\n.item-source, .find-item, .transparency-balances { overflow-wrap: anywhere; }\n.transparency-balances .item-table { max-width: 100%; overflow-x: auto; }\n.transparency-balances table { width: 100%; }\n.transparency-balances td, .transparency-balances th { padding: 14px 12px; vertical-align: top; }\n.transparency-balances small { display: block; margin-top: 6px; font-size: .85em; }\n.transparency-balances .address { display: block; min-width: 12ch; }\n@media (max-width: 660px) {\n  .earn-gauges { grid-template-columns: minmax(0, 1fr); }\n  .item-figures > div { gap: 10px; }\n  .transparency-balances table { min-width: 660px; }\n}\n\n/* SPEC 3.5 decision A: five primary navigation entries. */\nnav > div { grid-template-columns: repeat(5, 1fr); }\n\n/* SPEC 4: keep allocation and balance numbers whole in the scrolling table. */\n.transparency-balances td:nth-child(2), .transparency-balances td:nth-child(3) { white-space: nowrap; }\n/* SPEC 3.2: keep holder labels readable inside the scrolling table. */\n.transparency-balances th:first-child { min-width: 14ch; overflow-wrap: normal; }\n/* SPEC 3.3: the two new inline Earn links retain the existing paragraph geometry. */\n.docs-grid p a[href=\"#earn\"] { display: inline; min-height: 0; }\n/* Owner approval 2026-10-14: fit five nav labels below 360px; retain the existing row height. */\n@media (max-width: 359px) {\n  nav > div { gap: 6px; }\n  nav a { font-size: 18px; line-height: 25.2px; }\n}\n\n/* Revised Phase A: separate personal position, tasks and global statistics. */\n.refined-card { align-self: start; min-width: 0; }\n.refined-heading h3 { margin: 0; }\n.refined-personal { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 18px; padding: 18px 0 22px; margin: 0; }\n.refined-personal > div { display: block; border: 0; padding: 0; }\n.refined-personal dt { font-size: 13px; margin-bottom: 7px; }\n.refined-personal dd { text-align: left; max-width: none; font-size: 21px; line-height: 1.35; }\n.refined-personal > div:first-child dd { font-size: 15px; }\n.refined-empty { margin: 14px 0 22px; font-size: 14px; }\n.refined-workspace, .refined-panels, .refined-tab-panel { min-width: 0; }\n.refined-tabs { display: flex; gap: 0; margin: 0; border-bottom: 2px solid var(--royal); }\n.refined-tabs [role=\"tab\"] { flex: 1 1 0; min-width: 0; padding: 12px 6px; border: 0; border-radius: 0; background: transparent; font-size: 14px; line-height: 1.25; }\n.refined-tabs [role=\"tab\"][aria-selected=\"true\"] { background: var(--sun); color: var(--ink); }\n.refined-card [hidden] { display: none !important; }\n.refined-tab-panel { padding: 22px 0 0; }\n.refined-tab-panel h4 { margin: 0 0 14px; font-size: 20px; }\n.refined-explainer { font-size: 14px; line-height: 1.6; margin: 0 0 22px; }\n.refined-explainer strong { display: block; margin-bottom: 4px; }\n.refined-card .item-action { border: 0; margin: 0; padding: 0; }\n.refined-card .item-action label { font-weight: 700; font-size: 14px; }\n.refined-card .item-action input { margin: 8px 0; min-width: 0; height: 49px; }\n.refined-token-pair { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 18px; }\n.refined-token-entry { min-width: 0; }\n.refined-matched { margin: 0; }\n.refined-matched > div { display: block; border: 0; padding: 0; }\n.refined-matched dt { font-weight: 700; line-height: 1.5; }\n.refined-matched dt span { font-size: 11px; font-weight: 400; margin-left: 4px; }\n.refined-matched dd { display: flex; align-items: center; text-align: left; max-width: none; min-height: 49px; margin: 8px 0; border: 1px solid var(--line); background: var(--subtle); padding: 10px 12px; font-size: 18px; line-height: 1.4; }\n.refined-balance { margin: 0; font-size: 12px; }\n.refined-balance > div { display: block; border: 0; padding: 0; }\n.refined-balance dt { font-size: 12px; }\n.refined-balance dd { max-width: none; text-align: left; margin: 2px 0 4px; }\n.refined-card .refined-max { margin-top: 5px; padding: 5px 0; min-height: 36px; border: 0; background: transparent; color: var(--royal); font-size: 13px; text-decoration: underline; text-underline-offset: 3px; }\n.refined-card .refined-max:disabled { color: #53617a; }\n.refined-estimate { margin: 20px 0 0; font-size: 13px; }\n.refined-estimate > div { display: block; padding: 12px 0; border-top: 1px solid var(--line); border-bottom: 0; }\n.refined-estimate dd { text-align: left; max-width: none; margin-top: 4px; }\n.refined-card .item-buttons { gap: 8px; margin-top: 14px; }\n.refined-card .item-buttons button { padding: 9px 12px; }\n.refined-details { margin-top: 18px; border-top: 1px solid var(--line); padding-top: 8px; font-size: 13px; }\n.refined-details summary, .refined-withdraw summary { cursor: pointer; padding: 10px 0; color: var(--royal); font-weight: 700; }\n.refined-details .item-pool { margin: 8px 0 0; }\n.refined-card .refined-available { margin: 0 0 18px; padding: 12px; background: var(--subtle); }\n.refined-available > div { display: block; padding: 0; border: 0; }\n.refined-available dd { text-align: left; max-width: none; margin-top: 4px; }\n.refined-card .item-claims { margin-top: 16px; }\n.refined-card .item-claims button { background: var(--royal); color: var(--paper); border-color: var(--royal); }\n.refined-card .item-claims button:disabled { background: #e4e9f0; color: #53617a; border-color: #8c98ab; }\n.refined-manage-figures, .refined-global { font-size: 14px; margin: 0; }\n.refined-global > div, .refined-manage-figures > div { padding: 10px 0; }\n.refined-caption { margin: 14px 0 0; font-size: 13px; line-height: 1.6; }\n.refined-withdraw { margin-top: 24px; padding-top: 8px; border-top: 1px solid var(--line); }\n.refined-withdraw .refined-caption { margin: 4px 0 18px; }\n.refined-address { margin-top: 22px; margin-bottom: 0; font-size: 13px; }\n.refined-card > .error:empty { display: none; }\n@media (max-width: 660px) {\n  .refined-card { padding: 16px 12px; }\n  .refined-tabs [role=\"tab\"] { font-size: 12px; padding: 11px 4px; min-height: 52px; }\n  .refined-personal { gap: 12px; padding-bottom: 18px; }\n  .refined-personal dd { font-size: 18px; }\n  .refined-personal > div:first-child dd { font-size: 13px; }\n  .refined-tab-panel { padding-top: 18px; }\n  .refined-token-pair { grid-template-columns: minmax(0, 1fr); gap: 18px; }\n  .refined-balance > div { display: flex; flex-wrap: wrap; gap: 3px 8px; justify-content: space-between; }\n  .refined-balance dd { margin: 0; }\n  .refined-explainer { margin-bottom: 18px; font-size: 13px; }\n  .refined-global > div { display: block; }\n  .refined-global dd { max-width: none; text-align: left; margin-top: 3px; }\n}\n\n/* Revised Phase A B3: select one pool and give its task room to breathe. */\n.refined-pool-picker { display: flex; align-items: center; gap: 16px; margin: 24px 0 16px; }\n.refined-pool-picker label { font-size: 14px; font-weight: 700; }\n.refined-pool-picker select { width: 240px; max-width: 100%; margin: 0; }\n.refined-focused-gauges { grid-template-columns: minmax(0, 1fr); }\n.refined-focused-gauges > [hidden] { display: none !important; }\n.refined-focused-gauges > div { min-width: 0; }\n.refined-b3 .refined-workspace { max-width: 960px; margin-inline: auto; }\n.refined-b3 .refined-heading { margin-bottom: 12px; }\n.refined-b3 .refined-personal { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); max-width: 740px; padding-bottom: 28px; gap: 32px; }\n.refined-b3 .refined-tabs [role=\"tab\"] { flex: 0 1 auto; padding-inline: 24px; }\n.refined-b3 .refined-tab-panel { padding-top: 28px; }\n@media (min-width: 901px) {\n  .refined-b3 { padding: 30px 36px; }\n  .refined-b3 .refined-heading { max-width: 960px; margin: 0 auto; }\n  .refined-b3 .refined-personal, .refined-b3 .refined-empty { max-width: 960px; margin-inline: auto; }\n  .refined-b3 .refined-personal { padding-top: 20px; }\n  .refined-b3 .item-action[data-liquidity] { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.7fr); gap: 0 42px; }\n  .refined-b3 .item-action[data-liquidity] > .refined-explainer { grid-column: 1; grid-row: 1 / 7; font-size: 15px; line-height: 1.7; max-width: 32ch; margin: 0; }\n  .refined-b3 .item-action[data-liquidity] > .refined-explainer strong { font-size: 18px; line-height: 1.5; margin-bottom: 12px; }\n  .refined-b3 .item-action[data-liquidity] > :not(.refined-explainer) { grid-column: 2; }\n  .refined-b3 .refined-tab-panel:not(:has([data-liquidity])) { max-width: 740px; }\n  .refined-b3 .refined-tab-panel:not(:has([data-liquidity])) .item-action { max-width: 580px; }\n}\n@media (max-width: 660px) {\n  .refined-pool-picker { margin-top: 20px; gap: 12px; }\n  .refined-pool-picker select { flex: 1; min-width: 0; width: auto; }\n  .refined-b3 .refined-personal { gap: 12px; padding-bottom: 18px; }\n  .refined-b3 .refined-tabs [role=\"tab\"] { flex: 1 1 0; padding-inline: 4px; }\n  .refined-b3 .refined-tab-panel { padding-top: 18px; }\n}\n\n/* Revised preview review: align editable and calculated token amounts. */\n.refined-card .refined-token-entry label { margin-bottom: 8px; }\n\n/* Earn layout build, review fix: on desktop the state notes, the send status and the error line sit in the card's centred column too. */\n@media (min-width: 901px) {\n  .refined-b3 > .note, .refined-b3 > .action-status, .refined-b3 > .error { max-width: 960px; margin-inline: auto; }\n}\n","    width: calc(var(--pad) + var(--gx) + var(--w) + var(--col-gap) - 6px);\n  }\n}\n"]];
// Manual review pins: never generated by put-pieces, never changed by the launch kit.
// 2026-10-16 Add liquidity build: the eight changed source diffs were reviewed against the previous ITEM build;
// only their pins change. Existing vault builders remain byte-identical and all legacy comparisons still run.
const ITEM_REVIEWED_PINS={
 "main.tsx": "20581ffb29277bcb14dcd20526a3ea369f8ef40a0e3ff5b225d03f4d735abbeb",
 "components.tsx": "7b3f5c741ec81e3eef289c0179ad35056fa97641302165f4f72e4ebc8917b40b",
 "wallet.tsx": "6439fafab303be801bc8032ab9d492d94a58f99c3f3df0dbb015e8e1f550044d",
 "chain.ts": "8477f756be249b1446de21f6964124f9e3f22a6a91d90cfffdce123fbe6b01eb",
 "Docs.tsx": "036798a3209d330aaf175dd89984d4bd7c8a5bbee77e5be62dccf71938267ab9",
 "tokenomicsData.ts": "c84d346ab2bc6d04445a0bb0c288b08ab30d2a53b444eefe60bca771be3f3cba",
 "Tokenomics.tsx": "a5c036e37a0684b84c49141bff193c63f0967e39e275065c2da1032559420488",
 "itemConstants.ts": "6ee04472bcc387933d7f3b58234cb42573496e656847a261a009a11831568163",
 "itemAbi.ts": "42a4fb064c2bb1348948b7ea448136e13d97b57d005a2ccc3bce4d1679731d80",
 "itemReads.ts": "45f1b009807305f4c5003fcd6f59047f5fa09a8f095e82db5457f92d63453019",
 "itemActions.ts": "4c84ddbd80962d69c6315e33841e1562308bb2b32dcbda47512e2f34d8f2368a",
 "itemFormat.ts": "ad75601c2b32bc0c3be7ac7e874f765aefd141ef16ee43b7d3583f27a72eb811",
 "Earn.tsx": "9b1dc219c8582e800ca99b614879293ad4475851bebd57acfbc600331bf8e7ae",
 "Transparency.tsx": "3481af8504a07ab82e8b35982bb2ecbaedc4646c33e3763b68b6dd1623c63fad",
 "FindItem.tsx": "398170f167c1ae68286273aafffa60a4c79eea8286054bc376699182c13c5a8d",
 "styles.css": "0db9569699f5bc0aebb5b3734dbcf9d3c0d625c8919a7235fae4f5ce95569de5"
};
const LAUNCH_ADDRESSES=['ITEM','ITEM_STAKING','BASK_USDG_GAUGE','ITEM_ETH_GAUGE','DEV_VESTING','ITEM_WETH_PAIR'];
const LAUNCH_HASHES=[...LAUNCH_ADDRESSES.map(k=>k+'_HASH'),'BASK_USDG_PAIR_HASH'];
const LAUNCH_KEYS=[...LAUNCH_ADDRESSES,...LAUNCH_HASHES,'ITEM_REPO','ITEM_COMMIT'];
function launchText(text){
 const tree=ts.createSourceFile('itemConstants.ts',text,ts.ScriptTarget.Latest,true),nodes=[];
 for(const statement of tree.statements)if(ts.isVariableStatement(statement))for(const d of statement.declarationList.declarations)if(d.name.getText(tree)==='LAUNCH')nodes.push(d.initializer);
 assert.equal(nodes.length,1,'one LAUNCH initializer');const node=nodes[0];assert.ok(node&&ts.isObjectLiteralExpression(node),'LAUNCH is a plain object');
 const slots=JSON.parse(node.getText(tree));assert.deepEqual(Object.keys(slots).sort(),[...LAUNCH_KEYS].sort(),'exact launch slot keys, no omissions or extra keys');
 for(const key of LAUNCH_ADDRESSES)assert.ok(slots[key]===null||typeof slots[key]==='string'&&getAddress(slots[key])===slots[key]&&!/^0x0{40}$/.test(slots[key]),key+': null or checksummed nonzero address');
 for(const key of LAUNCH_HASHES)assert.ok(slots[key]===null||typeof slots[key]==='string'&&/^0x[0-9a-f]{64}$/.test(slots[key])&&!/^0x0{64}$/.test(slots[key]),key+': null or runtime hash');
 assert.ok(slots.ITEM_REPO===null||typeof slots.ITEM_REPO==='string'&&new URL(slots.ITEM_REPO).protocol==='https:'&&!new URL(slots.ITEM_REPO).username&&!new URL(slots.ITEM_REPO).password,'repository is null or HTTPS source repository');
 assert.ok(slots.ITEM_COMMIT===null||typeof slots.ITEM_COMMIT==='string'&&/^[0-9a-f]{40}$/.test(slots.ITEM_COMMIT),'commit is null or full commit');
 if(process.env.BASKET_ITEM_FINAL==='1')assert.ok(LAUNCH_KEYS.every(key=>slots[key]!==null),'final mode requires every launch slot');
 return {slots,normalized:text.slice(0,node.getStart(tree))+'__LAUNCH_JSON__'+text.slice(node.end)};
}
const itemLaunch=launchText(rawRead('web/src/itemConstants.ts'));
for(const [file,digest] of Object.entries(ITEM_REVIEWED_PINS)){
 const text=rawRead('web/src/'+file);
 assert.equal(sha256(file==='itemConstants.ts'?launchText(text).normalized:text),digest,file+': independently reviewed raw source; regeneration cannot authorize an edit');
}
// Owner-approved formatter exception: only the formatLive body may differ; declarations, reads, effects and words remain byte-frozen.
function outsideFormatLive(text){
 const tree=ts.createSourceFile('Tokenomics.tsx',text,ts.ScriptTarget.Latest,true),nodes=tree.statements.filter(node=>ts.isFunctionDeclaration(node)&&node.name?.getText(tree)==='formatLive');
 assert.equal(nodes.length,1,'one Tokenomics formatLive declaration');const body=nodes[0].body;assert.ok(body,'formatLive has a body');
 return text.slice(0,body.getStart(tree))+'__APPROVED_FORMAT_LIVE_BODY__'+text.slice(body.end);
}
assert.equal(outsideFormatLive(rawRead('web/src/Tokenomics.tsx')),outsideFormatLive(baseline('web/src/Tokenomics.tsx')),'Tokenomics is byte-frozen outside the approved formatLive body');
function restoreApproved(file,text){
 const name=file.startsWith('web/src/')?file.slice(8):'',pieces=name==='styles.css'?ITEM_CSS_PIECES:editedFiles[name]??[];
 for(const [now,old] of pieces){assert.equal(text.split(now).length,2,name+': exact approved piece occurs once');text=text.split(now).join(old);}
 return text;
}
for(const file of [...Object.keys(editedFiles),'styles.css'])assert.equal(read('web/src/'+file),baseline('web/src/'+file),file+': after the approved edits are reversed every original byte remains');
// Known BASK addresses already frozen in older vault files remain untouched. New ITEM modules contain no address or hash literals outside the single constants file.
for(const file of ITEM_NEW_SOURCES.filter(f=>f!=='itemConstants.ts'))assert.doesNotMatch(rawRead('web/src/'+file),/0x[0-9a-fA-F]{40}(?:[0-9a-fA-F]{24})?\b/,file+': no address or hash outside constants');
for(const [key,value] of Object.entries(itemLaunch.slots))if(value&&[...LAUNCH_ADDRESSES,...LAUNCH_HASHES].includes(key))for(const file of fs.readdirSync(path.join(root,'web/src')).filter(f=>f!=='itemConstants.ts'&&/\.(tsx?|json)$/.test(f)))assert.ok(!rawRead('web/src/'+file).toLowerCase().includes(value.toLowerCase()),file+': launch address/hash duplicated outside constants');
const protectedFiles=[
 "BaskGuide.tsx",
 "Flows.tsx",
 "Losses.tsx",
 "Owner.tsx",
 "Scenery.tsx",
 "Vault.tsx",
 "baskGuideData.ts",
 "deployment.ts",
 "governance.ts",
 "model.ts",
 "newYork.ts",
 "poolMath.ts",
 "vault.abi.json"
];
for(const f of protectedFiles) assert.equal(read('web/src/'+f),baseline('web/src/'+f),f);
// v16 adds no source file. The Docs module of v14 (four display-only sources) is part of HEAD: BaskGuide.tsx and
// baskGuideData.ts are frozen above; Tokenomics.tsx and tokenomicsData.ts are the two v16 files (documented pieces
// below). All four stay pinned by independently reviewed digests (the two v16 files by their new ones) and scanned
// for wallet, storage, network and send sinks; the ITEM statistics read stays behind the null-address guard.
// styles.css equals HEAD's text (its first 63880 bytes are still the exact approved module CSS).
const NEW_SOURCES=ITEM_NEW_SOURCES;
const MODULE_SOURCES=['Tokenomics.tsx','tokenomicsData.ts','BaskGuide.tsx','baskGuideData.ts'];
const allSources=fs.readdirSync(path.join(root,'web/src'),{recursive:true}).filter(p=>fs.statSync(path.join(root,'web/src',p)).isFile()).map(p=>p.replaceAll('\\','/')).sort();
assert.deepEqual(allSources,[...git(['ls-tree','-r','--name-only',LEGACY,'web/src']).trim().split('\n').map(p=>p.slice('web/src/'.length)),...NEW_SOURCES,...V25_NEW_SOURCES].sort(),'no new source beyond the ITEM files and the two v25 stats sources');
// 2026-10-20, vault stats build (v25) on the live v24 site: the Vault page gains Overview/Stats child tabs under its
// title and the Earn title joins the v15 phone focus-corner rule. Vault.tsx differs from v24 by exactly three pieces
// (the VaultViews import, the wrapper's opening and closing tags) and styles.css by two (the comment and the added Earn
// selector) plus the stats styles appended after the v24 text under one marker, formerly a separate stylesheet, kept in
// styles.css like every earlier module's rules so that no component imports CSS; v25-restore.mjs cuts that block (pinned
// by digest) and puts the pieces back before every inherited comparison, so Vault.tsx still equals LEGACY and the CSS
// prefix/tail pins hold. The two new sources are pinned by independent digests and scanned here: the only network
// use v25 adds to the site is one credential-free GET of the public stats report from VaultStats.tsx; the report is
// rebuilt as React elements from an allowlist (never inserted as HTML); no wallet, storage, send or chain read is touched.
for(const f of ['Vault.tsx','styles.css'])assert.equal(restoreV25('web/src/'+f,fs.readFileSync(path.join(root,'web/src/'+f),'utf8')),git(['show',V25_BASE+':web/src/'+f]),f+': equals the live v24 text once the v25 pieces are put back');
const V25_PINS={
 "VaultStats.tsx": "2a0f85f2c3494234204a20bdd83a6f0b713860e09cb84270215c097355f61d5c",
 "vaultStatsReport.tsx": "826a6871ec25257580eb9924d135d5a0371ad152c097cceb3fef2ac7ad6c68e7"
};
for(const [f,digest] of Object.entries(V25_PINS))assert.equal(sha256(fs.readFileSync(path.join(root,'web/src/'+f),'utf8')),digest,'independent reviewed v25 source pin: '+f);
const V25_ENDPOINT='https://monitor-production-2eae.up.railway.app/api/vault-stats';
{
 const stats=fs.readFileSync(path.join(root,'web/src/VaultStats.tsx'),'utf8'),report=fs.readFileSync(path.join(root,'web/src/vaultStatsReport.tsx'),'utf8'),stylesText=fs.readFileSync(path.join(root,'web/src/styles.css'),'utf8');
 const css=stylesText.slice(stylesText.indexOf('\n/* v25: Vault stats'));
 assert.equal(sha256(css),'844ee92940f9a8b1347bc165282256bf9bca5d7e140cf07a2a4669af08433fe8','styles.css: the appended v25 stats block is the reviewed one');
 const imports=s=>[...s.matchAll(/^import [^;]* from "([^"]+)";$/gm)].map(m=>m[1]).concat([...s.matchAll(/^import "([^"]+)";$/gm)].map(m=>m[1]));
 // Names, not prose: every identifier (also property names), every string and every dynamic import of the two files.
 const names=s=>{const tree=ts.createSourceFile('v25.tsx',s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),out={identifiers:new Set(),strings:new Set(),dynamicImports:0,requestCalls:0};(function v(n){if(ts.isIdentifier(n)||ts.isPrivateIdentifier(n))out.identifiers.add(n.text);if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='request')out.requestCalls++;if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n))out.strings.add(n.text);if(ts.isTemplateExpression(n))out.strings.add(n.head.text+n.templateSpans.map(x=>x.literal.text).join(''));if(ts.isCallExpression(n)&&n.expression.kind===ts.SyntaxKind.ImportKeyword)out.dynamicImports++;ts.forEachChild(n,v);})(tree);return out;};
 const SINK_NAMES=new Set(['ethereum','localStorage','sessionStorage','indexedDB','sendTransaction','writeContract','sendRawTransaction','XMLHttpRequest','WebSocket','EventSource','sendBeacon','importScripts','Worker','SharedWorker','serviceWorker','dangerouslySetInnerHTML','innerHTML','outerHTML','insertAdjacentHTML','eval','Function','Reflect','globalThis','window','self','document','location','history','navigator','postMessage','cookie']);
 for(const [f,s] of [['VaultStats.tsx',stats],['vaultStatsReport.tsx',report]]){
  const n=names(s);
  assert.deepEqual([...n.identifiers].filter(x=>SINK_NAMES.has(x)),[],f+': no wallet, storage, send, raw-HTML, global-object, navigation or worker name');
  assert.deepEqual([...n.strings].filter(x=>/^(?:eth_|wallet_|personal_)|sendTransaction|writeContract|javascript:/i.test(x)),[],f+': no wallet method or script string');
  assert.equal(n.dynamicImports,0,f+': no dynamic import');
  assert.equal(n.requestCalls,0,f+': no provider-style .request() call');
 }
 assert.deepEqual(imports(stats),['react','./vaultStatsReport'],'VaultStats.tsx imports only React and the report module');
 assert.deepEqual(imports(report),['react'],'vaultStatsReport.tsx imports only React');
 assert.equal((stats.match(/\bfetch\s*\(/g)??[]).length,1,'VaultStats.tsx: exactly one fetch');
 assert.ok(stats.includes('void fetch(url, { signal: controller.signal, credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer" })'),'VaultStats.tsx: the one fetch is a plain GET without credentials or referrer');
 assert.ok(stats.includes('const endpoint = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_VAULT_STATS_URL || "'+V25_ENDPOINT+'";'),'VaultStats.tsx: the production stats endpoint, overridable only at build time');
 assert.deepEqual([...stats.matchAll(/https?:\/\/[^\s"'`]+/g)].map(m=>m[0]),[V25_ENDPOINT],'VaultStats.tsx: the stats endpoint is its only address');
 assert.ok(stats.includes('const url = new URL(endpoint); url.searchParams.set("period", period);'),'VaultStats.tsx: the request carries only the period');
 assert.equal((report.match(/\bfetch\b/g)??[]).length,0,'vaultStatsReport.tsx: no network use');
 assert.ok(report.includes('else if (/^https:\\/\\/robin\\.etherscan\\.io\\/tx\\/0x[0-9a-fA-F]{64}$/.test(href)) {')&&report.includes('props.href = href; props.target = "_blank"; props.rel = "noopener noreferrer";')&&report.includes('if (period) { props.href = "#vault";')&&report.includes('else return createElement("span", { key }, el.textContent);'),'vaultStatsReport.tsx: a link is kept only as a Robinhood explorer transaction (new tab, noopener) or a #vault period switch; any other link becomes plain text');
 assert.doesNotMatch(css,/url\(|@import/,'the v25 stats styles load nothing');
}
const modulePins={
  "Tokenomics.tsx": "6d57c2f9d8629f7207368b6d00618da9351e72aba0de52fcff225490be47c85a",
  "tokenomicsData.ts": "8e2cfc45c8055f2dbfdc7a7610e57856809845d52dd103712dd8398f3b11a99a",
  "BaskGuide.tsx": "9427416f3e67521e3805bf0cc480ef4960d4d5058677327782a7175b61e8d01c",
  "baskGuideData.ts": "009ed45d5af35bbb34bc62c89bcc90b46253894d2aca60f793ec3e4ac465b169",
};
for(const [f,digest] of Object.entries(modulePins))assert.equal(sha256(read('web/src/'+f)),digest,'independent reviewed module pin: '+f);
for(const f of MODULE_SOURCES){
 const s=read('web/src/'+f);
 assert.ok(!/ethereum|\b(?:fetch|localStorage|sessionStorage|indexedDB|sendTransaction|writeContract|sendRawTransaction|eth_call)\b|\.request\s*\(/.test(s),f+': no wallet, storage, raw network or send sink');
 assert.deepEqual([...s.matchAll(/https?:[^\s\x60"']+/g)].map(m=>m[0]),f==='Tokenomics.tsx'?['https://robin.etherscan.io/address/${address}']:[],'only explorer link pattern');
}
assert.match(read('web/src/Tokenomics.tsx'),/if \(!hasAddresses\(addresses\)\) return null;[\s\S]*const results = await reader/,'null guard before the sole optional existing many reader');
assert.ok(read('web/src/styles.css').startsWith(baseline('web/src/styles.css')),'CSS additions only');
assert.equal(sha256(Buffer.from(read('web/src/styles.css')).subarray(0,63880)),'556616a829d32cd47a07e81280a030b9adcd49ffa1a665776ca894c63e593ad8','entire approved module CSS is an exact prefix; v14 Deposit rules follow it');
// v16: no style rule after HEAD's text (the v15 rules are HEAD's own now).
const cssTail=Buffer.from(read('web/src/styles.css')).subarray(Buffer.byteLength(baseline('web/src/styles.css'))).toString('utf8');
assert.equal(cssTail,'','v16: no style rule after the text of HEAD');
// The ITEM files: byte-identical to HEAD once their documented pieces [item-site, HEAD] are put back (each exactly once), so
// every word, call and attribute in them is pinned. The list between the two marker lines was generated from the
// difference to HEAD; the pins further down do not depend on it: they compare with HEAD itself or with texts written
// out in this file, so a piece cannot carry a change to a transaction, a wallet request or a chain read past them.

assert.deepEqual(Object.keys(editedFiles),["main.tsx","components.tsx","wallet.tsx","chain.ts","Docs.tsx","tokenomicsData.ts","Tokenomics.tsx"],'exact ITEM editable existing files');
const putBack=(text,pieces,what)=>{for(const [n,o] of pieces){assert.equal(text.split(n).length,2,what+': expected once: '+n);text=text.split(n).join(o);}return text;};
for(const [f,edits] of Object.entries(editedFiles)) assert.equal(putBack(rawRead('web/src/'+f),edits,f),baseline('web/src/'+f),f+' changed beyond the documented pieces');
// Calls that build, encode, simulate or send a transaction (or parse its arguments) or read the chain.
const names=new Set(['vault','token','feed','read','many','simulate','verifyNetwork','encode','depositArgs','redeemArgs','w.send','p.request',
 'safe','proposalSpec','proposalAction','settingValues','poolValues','parseLaunch','encodeFunctionData','client.call','client.estimateGas',
 'client.getTransactionCount','client.waitForTransactionReceipt','address','recipient','amount','uint']);
// JSX attributes that act, send or check, including every event handler and the wallet and snapshot handed to a
// component. The full HEAD coverage is retained for every v12 source.
const actionAttributes=new Set(['onClick','onSubmit','onChange','getSpec','disabled','disabledReason','label','scope','role','primary','value','claim','reason','build','wallet','snapshot']);
const isAction=name=>actionAttributes.has(name)||/^on[A-Z]/.test(name);
// The attributes that build or start a transaction: none may be added, removed or changed in any file.
const TX_ATTRIBUTES=new Set(['onSubmit','getSpec','build','claim']);
// A6 G-A: wallet sends and raw provider requests in any form are guarded calls too: a callee ending in one of these
// names (any receiver, optional chaining, casts, element access, string folding) or naming the provider (ethereum).
const SEND=new Set(['send','request','sendTransaction','sendRawTransaction','writeContract','sendAsync','sendCalls','signTransaction','sendUnsignedTransaction']);
const lit=n=>ts.isStringLiteralLike(n)?n.text:ts.isParenthesizedExpression(n)?lit(n.expression):ts.isBinaryExpression(n)&&n.operatorToken.kind===ts.SyntaxKind.PlusToken&&lit(n.left)!==undefined&&lit(n.right)!==undefined?lit(n.left)+lit(n.right):undefined;
const unwrap=n=>ts.isParenthesizedExpression(n)||ts.isNonNullExpression(n)||ts.isAsExpression(n)||ts.isTypeAssertionExpression(n)||ts.isSatisfiesExpression?.(n)?unwrap(n.expression):n;
const calleeName=c=>{const e=unwrap(c.expression);return ts.isIdentifier(e)?e.text:ts.isPropertyAccessExpression(e)?e.name.text:ts.isElementAccessExpression(e)?lit(e.argumentExpression):undefined;};
// v12: a guarded name is matched without line breaks or optional chaining ("client\n  .estimateGas" counts), and every
// method called on the public client (client.anything(...)) remains guarded, including the existing receipt read.
const onClient=c=>{const e=unwrap(c.expression);return (ts.isPropertyAccessExpression(e)||ts.isElementAccessExpression(e))&&ts.isIdentifier(unwrap(e.expression))&&unwrap(e.expression).text==='client';};
const isGuarded=(n,tree)=>ts.isCallExpression(n)&&(names.has(n.expression.getText(tree).replace(/\s+/g,'').replace(/\?\./g,'.'))||onClient(n)||SEND.has(calleeName(n))||/ethereum|(^|[.?\]])\s*(send|request|sendTransaction|sendRawTransaction|writeContract)\b/.test(n.expression.getText(tree)));
const parse=(text,file)=>ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
const printerOf=tree=>{const printer=ts.createPrinter({removeComments:true});return n=>printer.printNode(ts.EmitHint.Unspecified,n,tree).replace(/\s+/g,' ');};
// Where a node sits: the named functions around it, outermost first ("useWallet > disconnect"), then the action
// attribute it is inside, if any ("DepositPage, in onChange").
const place=(n,tree)=>{const fns=[];let attr='';for(let p=n.parent;p;p=p.parent){if(ts.isFunctionDeclaration(p)&&p.name)fns.unshift(p.name.text);if(!attr&&ts.isJsxAttribute(p)&&isAction(p.name.getText(tree)))attr=p.name.getText(tree);}return (fns.join(' > ')||'module')+(attr?', in '+attr:'');};
// The whole expression a name stands in: the property reads and calls chained to it ("p.request({...}).then(f)").
const wraps=(p,n)=>(ts.isPropertyAccessExpression(p)||ts.isElementAccessExpression(p)||ts.isCallExpression(p))&&p.expression===n||ts.isNonNullExpression(p)||ts.isParenthesizedExpression(p)||ts.isAsExpression(p)||ts.isTypeAssertionExpression(p)||!!ts.isSatisfiesExpression?.(p);
const top=n=>{if(n.parent&&ts.isPropertyAccessExpression(n.parent)&&n.parent.name===n)n=n.parent;while(n.parent&&wraps(n.parent,n))n=n.parent;return n;};
function calls(text,file) {
 const tree=parse(text,file),print=printerOf(tree),found=[],all=[],attributes=[];
 const guardedIn=node=>{const g=[];(function v(n){if(isGuarded(n,tree))g.push(print(n));ts.forEachChild(n,v);})(node);return g;};
 function where(attr){const owner=attr.parent.parent,tag=owner.tagName?.getText(tree)??'?';const named=attr.parent.properties.find(p=>ts.isJsxAttribute(p)&&['title','label','scope'].includes(p.name.getText(tree))&&p.initializer);return tag+(named?' '+named.name.getText(tree)+'='+named.initializer.getText(tree).replace(/\s+/g,' ').slice(0,60):'');}
 function visit(n){
   if(ts.isCallExpression(n)){const c={text:print(n),guarded:isGuarded(n,tree),place:place(n,tree),callee:calleeName(n)??'(expression)'};all.push(c);if(c.guarded)found.push(c);}
  if(ts.isJsxAttribute(n)&&isAction(n.name.getText(tree)))attributes.push({name:n.name.getText(tree),tag:n.parent.parent.tagName?.getText(tree)??'?',text:print(n),guarded:guardedIn(n),where:where(n)});
  ts.forEachChild(n,visit);
 }
 visit(tree);return {found,all,attributes};
}
// The difference of two lists of texts in order (longest common subsequence): the positions only in a (removed) and
// only in b (added). Everything else is the same text in the same order in both.
function difference(a,b){
 const n=a.length,m=b.length,L=Array.from({length:n+1},()=>new Uint16Array(m+1));
 for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)L[i][j]=a[i]===b[j]?L[i+1][j+1]+1:Math.max(L[i+1][j],L[i][j+1]);
 const removed=[],added=[];let i=0,j=0;
 while(i<n&&j<m){if(a[i]===b[j]){i++;j++;}else if(L[i+1][j]>=L[i][j+1])removed.push(i++);else added.push(j++);}
 while(i<n)removed.push(i++);while(j<m)added.push(j++);
 return {removed,added};
}
// Guarded calls: the exact, documented differences from HEAD, each added call with the place it must sit in
// (everything equals HEAD, in order and place). The existing receipt read and display-only amount parser are
// already part of HEAD (v18's addToWallet() calls included). v20 adds no guarded call, wallet request or chain read.
const expected={};
// Action attributes: the exact differences from HEAD, in page order, each [element, attribute, why]. Everything else
// equals HEAD in order, text for text. None of them builds or starts a transaction (no onSubmit, getSpec, build or
// claim) and none contains a guarded call (both asserted below). The list between the marker lines was generated
// from the difference to HEAD, as the pieces were; each why was written by hand, and an entry without one fails.
// >>> item-site attributes (generated from the difference to HEAD; each why written by hand)
const attributeChanges={
 "main.tsx":{
  removed:[],
  added:[
   ["EarnPage","snapshot={data}",
    "Owner correction: value earned BASK from the existing vault snapshot without adding reads or changing Vault behavior."],
   ["EarnPage","wallet={wallet}",
    "ITEM SPEC 3/5/6: exact approved page routing or ITEM transaction isolation; raw source independently pinned."],
   ["TransparencyPage","snapshot={data}",
    "ITEM SPEC 3/5/6: exact approved page routing or ITEM transaction isolation; raw source independently pinned."]]}
};
// <<< item-site attributes
// Every call expression: HEAD's calls, in order and place, are all still there, except the removed ones listed here;
// a call that only gained the documented piece inside it (put back before comparing) counts as kept. Every added
// call, including display helpers and effects, is independently pinned below, not only the guarded calls.
// Watched names: the names that build, parse, read or send (vault, token, read, many, simulate, encode, amount,
// depositArgs, redeemArgs, recipient, client, ...) and the state and refs the file had at HEAD (setInputs, setQuote,
// setAccount, sequence, sending, ...). Every use of one, a call or the bare name handed on or renamed, equals HEAD in
// order and place, apart from the new uses listed here, each printed with the calls chained to it and its place. So
// nothing new reaches the typed amounts, the quote, the balances or the account except by these. No v12 chain
// read is added; the existing receipt read and answer handling are independently byte-pinned.
// The guarded startup eth_accounts answer is part of HEAD and must remain exact.
const restoreAccountReply=(x)=>x.text;
// Reviewed v16 differences in calls and watched-name uses. Independent of the generated pieces.
// ITEM: in the restored text no call of HEAD is removed and no watched name gains a use; the ITEM additions are bound
// by their raw source pins above and the ITEM gate below.
const callChanges={};
const WATCHED=[...names].filter(x=>!x.includes('.')).concat('client');
// The state setters and refs a file declares: const [x, setX] = useState(...) gives setX, const r = useRef(...) gives r.
function stateNames(text,file){
 const tree=parse(text,file),out=[];
 (function v(n){
  if(ts.isVariableDeclaration(n)&&n.initializer&&ts.isCallExpression(n.initializer)){
   const made=n.initializer.expression.getText(tree);
   if(made==='useState'&&ts.isArrayBindingPattern(n.name)&&n.name.elements.length===2&&ts.isBindingElement(n.name.elements[1])&&ts.isIdentifier(n.name.elements[1].name))out.push(n.name.elements[1].name.text);
   if(made==='useRef'&&ts.isIdentifier(n.name))out.push(n.name.text);
  }
  ts.forEachChild(n,v);
 })(tree);
 return out;
}
// Every use of a watched name with its place: not where it is declared or imported, not as the name of a property,
// not inside a type.
function usesOf(text,file,watched){
 const tree=parse(text,file),print=printerOf(tree),out=[];
 const named=p=>(ts.isVariableDeclaration(p)||ts.isParameter(p)||ts.isBindingElement(p)||ts.isFunctionDeclaration(p)||ts.isFunctionExpression(p)||ts.isImportSpecifier(p)||ts.isImportClause(p)||ts.isPropertyAssignment(p)||ts.isPropertyAccessExpression(p)||ts.isJsxAttribute(p)||ts.isMethodDeclaration(p)||ts.isPropertySignature(p))&&p.name;
 (function v(n){
  if(ts.isTypeNode(n))return;
  if(ts.isIdentifier(n)&&watched.has(n.text)&&named(n.parent)!==n&&!(ts.isBindingElement(n.parent)&&n.parent.propertyName===n)&&!(ts.isImportSpecifier(n.parent)&&n.parent.propertyName===n))out.push({text:print(top(n)),place:place(n,tree)});
  ts.forEachChild(n,v);
 })(tree);
 return out;
}
// Vault.tsx (the Stock shelves labels): no read, check or send call at all (no guarded call here, and no send or
// request in the scan below). Its action attributes equal HEAD's and this pinned list, in page order: the Retry vault
// button and the vault, Stock Token and price feed address links, plus the shelves' controls (label Details, drawer
// Close and its Escape key, filters, search, Show all), which only change what is shown. SPEC 1 changes the title
// and its sentence; owner-approved deposit presentation adds only the LED image role. Every original control and
// StockShelves handler keeps its original pin.
// Owner-approved LED accessibility role; all original controls keep their exact order and text.
const vaultAttributes=['role="img"','onClick={s.retry}','snapshot={s}','value={VAULT}','snapshot={s}','onClick={onToggle}','onKeyDown={(e) => e.key === "Escape" && onClose()}','onClick={onClose}','value={a.token}','value={a.feed}','onClose={() => onClose(o.a.token)}','onToggle={() => onToggle(a.token)}','role="list"','role="group"','onClick={() => show(f, search)}','value={search}','onChange={(e) => show(filter, e.target.value)}','role="status"','onClick={() => show("all", "")}','onClick={() => show("all", "")}'];
const vaultHandlers={
 show:'const show = (f: ShelfFilter, text: string) => { stopRestock(); setOpenToken(undefined); setFilter(f); setSearch(text); };',
 toggle:'const toggle = (token: string) => setOpenToken(openToken === token ? undefined : token);',
 close:'const close = (token: string) => { setOpenToken(undefined); requestAnimationFrame(() => document.getElementById(`sa-more-${token}`)?.focus()); };',
 group:'const group = { nav, settings: s.globals.settings, openToken, onToggle: toggle, onClose: close };'};
// The variable statements declaring `list` inside the top-level function `fn`, printed without comments (one each).
function localDeclarations(file,text,fn,list){
 const tree=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),printer=ts.createPrinter({removeComments:true}),out={};
 const f=tree.statements.filter(st=>ts.isFunctionDeclaration(st)&&st.name?.text===fn);
 assert.equal(f.length,1,file+': one '+fn);
 (function v(n){if(ts.isVariableStatement(n))for(const d of n.declarationList.declarations)if(ts.isIdentifier(d.name)&&list.includes(d.name.text)){assert.ok(!out[d.name.text],file+': one '+d.name.text+' in '+fn);out[d.name.text]=printer.printNode(ts.EmitHint.Unspecified,n,tree).replace(/\s+/g,' ');}ts.forEachChild(n,v);})(f[0]);
 return out;
}
const sources=git(['ls-tree','-r','--name-only',LEGACY,'web/src']).trim().split('\n').filter(p=>/\.tsx?$/.test(p)).map(p=>p.slice(8));
assert.deepEqual(git(['ls-files','--cached','--others','--exclude-standard','web/src']).trim().split('\n').filter(p=>/\.tsx?$/.test(p)).map(p=>p.slice(8)).sort(),[...sources,...NEW_SOURCES,...V25_NEW_SOURCES.filter(f=>/\.tsx?$/.test(f))].sort(),'No source file added or removed beyond the ITEM files and the v25 stats sources');
// Every source is either frozen (byte-identical to HEAD) or a v16 file with its documented pieces (above).
assert.deepEqual([...sources].sort(),[...protectedFiles,...Object.keys(editedFiles)].filter(f=>/\.tsx?$/.test(f)).sort(),'every web/src source is frozen or an ITEM file with documented pieces (v22\'s three files are HEAD\'s own)');
const scans={},facts={attributes:{},guarded:{},calls:{}};
for(const f of sources){
 const old=calls(baseline('web/src/'+f),f),now=calls(read('web/src/'+f),f),c=callChanges[f]??{pieces:[],removed:[],uses:[]},used=c.pieces.map(()=>0);
 // A call that holds a documented piece is compared as HEAD wrote it.
 const restore=text=>c.pieces.reduce((t,[n,o],i)=>{const parts=t.split(n);assert.ok(parts.length<=2,f+': the call piece occurs twice in one call: '+n);if(parts.length===2)used[i]++;return parts.join(o);},text);
 const restored=now.all.map(x=>restore(x.text));
 const watched=new Set([...WATCHED,...stateNames(baseline('web/src/'+f),f)]),usesOld=usesOf(baseline('web/src/'+f),f,watched),usesNow=usesOf(read('web/src/'+f),f,watched),uses=difference(usesOld.map(x=>x.text+' @ '+x.place),usesNow.map(x=>restore(x.text)+' @ '+x.place));
 // Two calls are the same when their text and their place are; two attributes when their element and their text are.
 const attributes=difference(old.attributes.map(a=>a.tag+' '+a.text),now.attributes.map(a=>a.tag+' '+a.text)),guarded=difference(old.found.map(x=>x.text+' @ '+x.place),now.found.map(x=>restoreAccountReply(x,f)+' @ '+x.place)),all=difference(old.all.map(x=>x.text+' @ '+x.place),restored.map((x,i)=>x+' @ '+now.all[i].place));
  scans[f]={old,now,c,used,attributes,guarded,all,usesOld,usesNow,uses};
 if(attributes.removed.length+attributes.added.length)facts.attributes[f]={removed:attributes.removed.map(i=>[old.attributes[i].tag,old.attributes[i].text]),added:attributes.added.map(i=>[now.attributes[i].tag,now.attributes[i].text])};
 if(guarded.removed.length+guarded.added.length)facts.guarded[f]={removed:guarded.removed.map(i=>old.found[i].text),added:guarded.added.map(i=>[now.found[i].text,now.found[i].place])};
  if(all.removed.length+all.added.length)facts.calls[f]={removed:all.removed.map(i=>old.all[i].text),uses:uses.added.map(i=>[usesNow[i].text,usesNow[i].place]),usesRemoved:uses.removed.map(i=>usesOld[i].text),added:all.added.length,addedCalls:all.added.map(i=>[now.all[i].text,now.all[i].place]),callees:all.added.map(i=>now.all[i].callee).join(' ')};
}
// For the tool that generated the two lists between marker lines (it is not part of this tree): when BASKET_GATE_FACTS
// names a file, the differences computed from this tree are written to it before they are checked. Nothing is
// skipped or loosened by it.
for(const f of Object.keys(editedFiles)){const h=calls(baseline('web/src/'+f),f),n=calls(rawRead('web/src/'+f),f),d=difference(h.attributes.map(a=>a.tag+' '+a.text),n.attributes.map(a=>a.tag+' '+a.text));if(d.removed.length+d.added.length)facts.attributes[f]={removed:d.removed.map(i=>[h.attributes[i].tag,h.attributes[i].text]),added:d.added.map(i=>[n.attributes[i].tag,n.attributes[i].text])};}
if(process.env.BASKET_GATE_FACTS)fs.writeFileSync(process.env.BASKET_GATE_FACTS,JSON.stringify(facts,null,1)+'\n');
for(const [f,a] of Object.entries(facts.attributes)){const approved=attributeChanges[f]??{removed:[],added:[]};for(const kind of ['removed','added']){assert.deepEqual(a[kind],approved[kind].map(x=>x.slice(0,2)),f+': exact approved raw attribute changes');for(const x of approved[kind])assert.ok(typeof x[2]==='string'&&x[2].trim().length>20,f+': every ITEM attribute change needs its SPEC reason');}}
// Hand-reviewed complete ordered additions. SHA-256 binds JSON.stringify([[full printed call, place], ...]); the
// ordered callee names make the list readable without repeating large nested JSX bodies. No regeneration block
// includes these pins. Changing a callback, receiver, argument, location, order or count changes the digest.
// >>> reviewed calls (manual; never refreshed by put-pieces)
const addedCallPins={
 "main.tsx": {
  "sha256": "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
  "callees": ""
 },
 "components.tsx": {
  "sha256": "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
  "callees": ""
 },
 "wallet.tsx": {
  "sha256": "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
  "callees": ""
 },
 "chain.ts": {
  "sha256": "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
  "callees": ""
 },
 "Docs.tsx": {
  "sha256": "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
  "callees": ""
 },
 "tokenomicsData.ts": {
  "sha256": "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
  "callees": ""
 },
 "Tokenomics.tsx": {
  "sha256": "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
  "callees": ""
 }
};
// <<< reviewed calls
// The exact reviewed source of the two v14 files (frozen now) and of the two v16 files, beyond either generated block.
const reviewedSourcePins={
 "Docs.tsx": "4a017ccbabc92c33df85c32d34b9f4c2ad94ae8988b50c82eb1115141e413343",
 "main.tsx": "acbfbe99686e824d26720805002343722cc16c8bcfff75a095c1774bcac94e80",
 "wallet.tsx": "550eb23f8c890ee228c218a6e15ffa6e8c1f2f0a3da2aef7c17200103fffcd67",
 "Flows.tsx": "e8f727507de361e7c3f074b33d855867273083aa900f6c0132709c4c8a4246db",
 "Owner.tsx": "9f7b51477f4b3ea2410cad43073ac75c4c2ee3b17085fcf97797dade3942fd65",
 "Tokenomics.tsx": "6d57c2f9d8629f7207368b6d00618da9351e72aba0de52fcff225490be47c85a",
 "tokenomicsData.ts": "8e2cfc45c8055f2dbfdc7a7610e57856809845d52dd103712dd8398f3b11a99a"
};
for(const f of Object.keys(editedFiles)){
 const {now,all}=scans[f],list=all.added.map(i=>[now.all[i].text,now.all[i].place]);
 assert.equal(all.added.map(i=>now.all[i].callee).join(' '),addedCallPins[f]?.callees,f+': added-call order or count differs from its reviewed list');
 assert.equal(sha256(JSON.stringify(list)),addedCallPins[f]?.sha256,f+': the complete ordered added-call list differs from its reviewed pin');
}
// Direct writes and mutating methods on transaction state, including aliases. A separate check is needed because
// an assignment or delete can change inputs without adding a call. Compare the full ordered writes with HEAD;
// v12 adds none to these roots. Shallow copies have fresh containers but can still hold references to an original nested object.
function stateWrites(text,file){
 const tree=parse(text,file),print=printerOf(tree),host={getSourceFile:n=>n===file?tree:undefined,writeFile(){},getCurrentDirectory:()=>'',getDirectories:()=>[],fileExists:n=>n===file,readFile:n=>n===file?text:undefined,getCanonicalFileName:n=>n,useCaseSensitiveFileNames:()=>true,getNewLine:()=> '\n',getDefaultLibFileName:()=>''};
 const checker=ts.createProgram([file],{noLib:true,noResolve:true},host).getTypeChecker(),aliases=new Map(),roots=new Set(['inputs','open','quote','balances','allowances','s']),out=[];
 const symbol=n=>checker.getSymbolAtLocation(n),union=(...lists)=>[...new Set(lists.flat())];
 const member=(from,key)=>from.map(x=>x.startsWith('copy:')?x.slice(5):x.startsWith('spread:')?member([x.slice(7)],key)[0]:x==='s'?'s.'+key:x);
 const copied=(from,kind='copy:')=>from.map(x=>(x.match(/copy:|spread:/g)?.length??0)>=4?x:kind+x);
 const origin=n=>{
  if(!n)return [];n=unwrap(n);
  if(ts.isIdentifier(n))return union(roots.has(n.text)?[n.text]:[],aliases.get(symbol(n))??[]);
  if(ts.isPropertyAccessExpression(n))return member(origin(n.expression),n.name.text);
  if(ts.isElementAccessExpression(n))return member(origin(n.expression),lit(n.argumentExpression)??'*');
  if(ts.isConditionalExpression(n))return union(origin(n.whenTrue),origin(n.whenFalse));
  if(ts.isBinaryExpression(n)&&[ts.SyntaxKind.AmpersandAmpersandToken,ts.SyntaxKind.BarBarToken,ts.SyntaxKind.QuestionQuestionToken].includes(n.operatorToken.kind))return union(origin(n.left),origin(n.right));
  if(ts.isBinaryExpression(n)&&[ts.SyntaxKind.CommaToken,ts.SyntaxKind.EqualsToken].includes(n.operatorToken.kind))return origin(n.right);
  if(ts.isArrayLiteralExpression(n))return union(...n.elements.map(x=>copied(origin(ts.isSpreadElement(x)?x.expression:x))));
  if(ts.isObjectLiteralExpression(n))return union(...n.properties.map(x=>copied(origin(ts.isPropertyAssignment(x)?x.initializer:ts.isShorthandPropertyAssignment(x)?x.name:ts.isSpreadAssignment(x)?x.expression:undefined),ts.isSpreadAssignment(x)?'spread:':'copy:')));
  return [];
 };
 let changed;
 const bind=(name,from)=>{
  if(ts.isIdentifier(name)){const key=symbol(name);if(!key||!from.length)return;const was=aliases.get(key)??[],next=union(was,from);if(next.length!==was.length){aliases.set(key,next);changed=true;}}
  else if(ts.isObjectBindingPattern(name)||ts.isArrayBindingPattern(name)){
   for(const [i,e] of name.elements.entries())if(ts.isBindingElement(e))bind(e.name,union(e.dotDotDotToken?copied(from,ts.isObjectBindingPattern(name)?'spread:':'copy:'):member(from,ts.isObjectBindingPattern(name)?(e.propertyName?.getText(tree)??e.name.getText(tree)):i),origin(e.initializer)));
  }
  else if(ts.isObjectLiteralExpression(name)){
   for(const e of name.properties){
    if(ts.isPropertyAssignment(e)||ts.isShorthandPropertyAssignment(e))bind(ts.isPropertyAssignment(e)?e.initializer:e.name,union(member(from,e.name.getText(tree)),ts.isShorthandPropertyAssignment(e)?origin(e.objectAssignmentInitializer):[]));
    else if(ts.isSpreadAssignment(e))bind(e.expression,copied(from,'spread:'));
   }
  }
  else if(ts.isArrayLiteralExpression(name))name.elements.forEach((e,i)=>bind(ts.isSpreadElement(e)?e.expression:e,ts.isSpreadElement(e)?copied(from):member(from,i)));
  else if(ts.isBinaryExpression(name)&&name.operatorToken.kind===ts.SyntaxKind.EqualsToken)bind(name.left,union(from,origin(name.right)));
  else if(ts.isPropertyAccessExpression(name)||ts.isElementAccessExpression(name))bind(name.expression,copied(from));
 };
 // Fixed point catches alias chains even across declaration order. Symbols distinguish shadowed local names.
 do{changed=false;(function v(n){
  if(ts.isVariableDeclaration(n)&&n.initializer)bind(n.name,origin(n.initializer));
  if(ts.isBinaryExpression(n)&&[ts.SyntaxKind.EqualsToken,ts.SyntaxKind.BarBarEqualsToken,ts.SyntaxKind.AmpersandAmpersandEqualsToken,ts.SyntaxKind.QuestionQuestionEqualsToken].includes(n.operatorToken.kind))bind(n.left,origin(n.right));
  if(ts.isForOfStatement(n)){
   const from=member(origin(n.expression),'*');
   if(ts.isVariableDeclarationList(n.initializer))for(const d of n.initializer.declarations)bind(d.name,from);
   else bind(n.initializer,from);
  }
  ts.forEachChild(n,v);
 })(tree);}while(changed);
 const protectedOrigins=n=>origin(n).filter(x=>!/^copy:|^spread:/.test(x)&&(x!=='s'&&!x.startsWith('s.')||x==='s.assets'||x==='s.*'));
 const put=(n,target)=>{const from=protectedOrigins(target);if(from.length)out.push({text:print(n),place:place(n,tree),from:[...new Set(from)].sort()});};
 const target=(n,whole)=>{if(!n)return;n=unwrap(n);if(ts.isArrayLiteralExpression(n))n.elements.forEach(x=>target(x,whole));else if(ts.isObjectLiteralExpression(n))n.properties.forEach(x=>target(ts.isPropertyAssignment(x)?x.initializer:ts.isShorthandPropertyAssignment(x)?x.name:x.expression,whole));else put(whole,n);};
 const mutators=new Set(['sort','reverse','copyWithin','fill','push','pop','shift','unshift','splice','set','delete','clear']);
 (function v(n){
  if(ts.isBinaryExpression(n)&&n.operatorToken.kind>=ts.SyntaxKind.FirstAssignment&&n.operatorToken.kind<=ts.SyntaxKind.LastAssignment)target(n.left,n);
  if(ts.isDeleteExpression(n))target(n.expression,n);
  if((ts.isPrefixUnaryExpression(n)||ts.isPostfixUnaryExpression(n))&&[ts.SyntaxKind.PlusPlusToken,ts.SyntaxKind.MinusMinusToken].includes(n.operator))target(n.operand,n);
  if(ts.isCallExpression(n)){
   const e=unwrap(n.expression),method=calleeName(n);
   if((ts.isPropertyAccessExpression(e)||ts.isElementAccessExpression(e))&&mutators.has(method))put(n,e.expression);
   if((ts.isPropertyAccessExpression(e)||ts.isElementAccessExpression(e))&&['Object','Reflect'].includes(e.expression.getText(tree))&&['assign','defineProperty','defineProperties','set','deleteProperty','setPrototypeOf','freeze','seal','preventExtensions'].includes(method)&&n.arguments[0])put(n,n.arguments[0]);
  }
  ts.forEachChild(n,v);
 })(tree);
 return out;
}
const transactionStateWrites={};
for(const f of Object.keys(editedFiles)){
 const h=stateWrites(baseline('web/src/'+f),f),n=stateWrites(read('web/src/'+f),f);
 assert.deepEqual(n,h,f+': a direct or aliased write to transaction state differs from HEAD');
 transactionStateWrites[f]=n.length;
}
const counts={};
for(const f of sources){
 const {old,now,c,used,attributes,guarded,all,usesOld,usesNow,uses}=scans[f],e=expected[f]??{removed:[],added:[]},a={removed:[],added:[]};
 // Guarded calls: equal HEAD in order and place, apart from the documented ones, each added one in its documented place.
 assert.deepEqual({removed:guarded.removed.map(i=>old.found[i].text),added:guarded.added.map(i=>[now.found[i].text,now.found[i].place])},{removed:e.removed,added:e.added},f+' changed calldata/read/check/send call expressions beyond the documented ones');
 // Action attributes: equal HEAD in order, apart from the documented ones.
 assert.deepEqual({removed:attributes.removed.map(i=>[old.attributes[i].tag,old.attributes[i].text]),added:attributes.added.map(i=>[now.attributes[i].tag,now.attributes[i].text])},{removed:a.removed.map(x=>x.slice(0,2)),added:a.added.map(x=>x.slice(0,2))},f+' changed an action, send or check attribute beyond the documented ones');
 for(const x of [...a.removed,...a.added])assert.ok(typeof x[2]==='string'&&x[2].trim().length>20,f+': write the why of the documented attribute '+x[1]);
 for(const [list,i] of [...attributes.removed.map(i=>[old.attributes,i]),...attributes.added.map(i=>[now.attributes,i])]){
  assert.ok(!TX_ATTRIBUTES.has(list[i].name),f+': an attribute that builds or starts a transaction was added, removed or changed: '+list[i].text);
  assert.deepEqual(list[i].guarded,[],f+' '+list[i].where+': a guarded call inside an added or removed attribute: '+list[i].text);
 }
 // The attributes that build or start a transaction, spelled out: the same texts as at HEAD, in order.
 assert.deepEqual(now.attributes.filter(x=>TX_ATTRIBUTES.has(x.name)).map(x=>x.text),old.attributes.filter(x=>TX_ATTRIBUTES.has(x.name)).map(x=>x.text),f+': an onSubmit, getSpec, build or claim attribute differs from HEAD');
 // No guarded call moved into or out of an attribute: inside the attributes they are HEAD's, in order.
 assert.deepEqual(now.attributes.flatMap(x=>x.guarded),old.attributes.flatMap(x=>x.guarded),f+': the guarded calls inside action attributes differ from HEAD');
 // Every call expression (see callChanges).
 assert.deepEqual(all.removed.map(i=>old.all[i].text),c.removed,f+': a call of HEAD is gone or moved beyond the documented ones');
 c.pieces.forEach(([n],i)=>assert.ok(used[i]>0,f+': the call piece is in no call: '+n));
 assert.deepEqual(all.added.filter(i=>now.all[i].guarded).map(i=>now.all[i].text),e.added.map(x=>x[0]),f+': an added call is a guarded call that is not documented');
 // Watched names (see callChanges): the new uses are the documented ones; a use that is gone left with a removed call.
 assert.deepEqual(uses.added.map(i=>[usesNow[i].text,usesNow[i].place]),c.uses,f+': a new use of a name that builds, reads or sends, or of a state or ref of HEAD, is not documented');
 for(const i of uses.removed)assert.ok(c.removed.includes(usesOld[i].text),f+': a use of a watched name is gone or moved, and not with a documented removed call: '+usesOld[i].text);
 if(f==='Vault.tsx'){
  assert.deepEqual(now.found,[],'Vault.tsx makes no read, check or send call');
  assert.deepEqual(now.attributes.map(a=>a.text),vaultAttributes,'Vault.tsx action attributes differ from the pinned Stock shelves controls');
  for(const a of now.attributes) assert.deepEqual(a.guarded,[],'Vault.tsx '+a.where+': guarded call in an attribute');
  const h=localDeclarations('web/src/Vault.tsx',read('web/src/Vault.tsx'),'StockShelves',Object.keys(vaultHandlers));
  for(const [k,v] of Object.entries(vaultHandlers)) assert.equal(h[k],v,'Vault.tsx StockShelves '+k+' differs from the pinned text');
 }
 counts[f]={guarded:now.found.length,calls:now.all.length,attributes:now.attributes.length};
}
for(const f of [...Object.keys(expected),...Object.keys(attributeChanges),...Object.keys(callChanges)])assert.ok(f in editedFiles,f+': a documented difference in a file that is not a v12 file');
// A6 G-A: wallet sends and raw requests. Listed in order per file, each with its place: every use of a send/request
// name or of the provider (ethereum), with the call around it; every string that names a sending or signing method
// (folded across +); computed access to the global object with any key (window[...], also window["fetch"]); eval,
// Function, Reflect; and the retained scan of names by which a page reaches the network by itself (fetch,
// XMLHttpRequest, WebSocket, EventSource, sendBeacon, importScripts, a dynamic import), written as a name or as a
// plain string (folded across +). Every file equals HEAD directly, including the startup reply guard already present there.
// Disconnect is local-only and must have no provider request of its own.
const SEND_TEXT=/eth_send|eth_sign|personal_sign|wallet_send|signtypeddata|sendtransaction|sendrawtransaction|writecontract|^(send|request|ethereum)$/i;
const ESCAPES=new Set(['ethereum','eval','Function','Reflect','globalThis','fetch','XMLHttpRequest','WebSocket','EventSource','sendBeacon','importScripts']),GLOBAL=new Set(['window','globalThis','self','top','parent','frames']);
const sendText=s=>SEND_TEXT.test(s)||ESCAPES.has(s);
function sendsOf(text,file){
 const tree=parse(text,file),print=printerOf(tree),out=[],put=(n,shown)=>out.push({text:print(shown),place:place(n,tree)});
 (function v(n){
  const s=lit(n);
  if(ts.isIdentifier(n)&&(SEND.has(n.text)||ESCAPES.has(n.text)))put(n,top(n));
  else if(ts.isElementAccessExpression(n)&&GLOBAL.has(unwrap(n.expression).getText(tree)))put(n,n);
  else if(s!==undefined&&!(n.parent&&lit(n.parent)!==undefined)&&sendText(s))put(n,top(n));
  else if((ts.isTemplateExpression(n)||ts.isNoSubstitutionTemplateLiteral(n))&&sendText(ts.isTemplateExpression(n)?n.head.text+n.templateSpans.map(x=>x.literal.text).join(''):n.text))put(n,n);
  else if(ts.isCallExpression(n)&&n.expression.kind===ts.SyntaxKind.ImportKeyword)put(n,n);
  ts.forEachChild(n,v);
 })(tree);
 return out;
}
// v20 adds no provider use: every file's list equals HEAD's.
const sendAdded={};
const NO_SEND=['Vault.tsx','Scenery.tsx','main.tsx','Docs.tsx'],sendUses={};
for(const f of sources){
 const h=sendsOf(baseline('web/src/'+f),f),n=sendsOf(read('web/src/'+f),f),added=sendAdded[f]??[];
 const isAdded=x=>added.some(a=>a.place===x.place&&a.text===x.text);
 // The startup request, its answer handling and all provider uses already belong to HEAD and remain exact.
 // Guarded calls and named methods independently compare the requests without an exception.
 const restored=n.map(x=>({...x,text:restoreAccountReply(x,f)}));
 if(f==='wallet.tsx')assert.deepEqual(n.filter(x=>!isAdded(x)),h,'wallet.tsx: provider uses including the guarded startup reply equal HEAD');
 assert.deepEqual(restored.filter(x=>!isAdded(x)),h,f+': a wallet send, provider request, signing method or network call was added, removed, changed or moved');
 assert.deepEqual(n.filter(isAdded),added,f+': the added provider uses differ from the documented ones in text, place, order or count');
 for(const a of added)assert.equal(h.filter(x=>x.place===a.place&&x.text===a.text).length,0,f+': a documented added provider use already existed at HEAD: '+a.text);
 if(f==='wallet.tsx')assert.deepEqual(n.filter(x=>x.place==='useWallet > disconnect'),[],'wallet.tsx disconnect(): no provider request');
 if(NO_SEND.includes(f))assert.ok(n.every(x=>x.text==='window.ethereum'),f+' must contain no send or request (only the read of window.ethereum in main.tsx)');
 if(n.length)sendUses[f]=n.map(x=>x.text);
}
// components.tsx (the shared transaction button) keeps exactly HEAD's single wallet.send.
assert.deepEqual(sendUses['components.tsx'].filter(x=>/\(/.test(x)),['wallet.send(await getSpec(), scope, scope)'],'components.tsx sends');
// v12: what a page can load or open without any of those names. Listed in order per file, each with its place: the
// names in LOADS, written as a name, a property or a plain string (folded across +): a picture, sound or worker made
// in script; the address bar, the history and the navigator; a new window; an element or HTML built in script; a
// src, href, action or style set in script. Then every JSX attribute in LOAD_ATTRIBUTES (any letter case) with its
// whole value, and every spread of attributes onto an element. Every file equals HEAD, with no exception: v13 adds no
// link, picture, frame, style attribute or navigation. `open` alone is the list of open stocks in Flows.tsx, so it
// counts only as a property (window.open) or when it is called. This is a list of known ways, not a proof that no
// other way exists.
const LOADS=new Set(['Image','Audio','Worker','SharedWorker','serviceWorker','RTCPeerConnection','location','history','navigator','open','createElement','createElementNS','innerHTML','outerHTML','insertAdjacentHTML','setAttribute','setAttributeNS','write','writeln','src','srcset','srcdoc','href','action','formAction','style','cssText']);
const LOAD_ATTRIBUTES=new Set(['href','xlinkhref','xlink:href','src','srcset','srcdoc','action','formaction','data','poster','ping','style','dangerouslysetinnerhtml','httpequiv']);
function loadsOf(text,file){
 const tree=parse(text,file),print=printerOf(tree),out=[],put=(n,shown)=>out.push({text:print(shown),place:place(n,tree)});
 const plainOpen=n=>n.text==='open'&&!(ts.isPropertyAccessExpression(n.parent)&&n.parent.name===n)&&!(ts.isCallExpression(n.parent)&&n.parent.expression===n);
 (function v(n){
  const s=lit(n);
  if(ts.isJsxAttribute(n)){if(LOAD_ATTRIBUTES.has(n.name.getText(tree).toLowerCase()))put(n,n);if(n.initializer)v(n.initializer);return;}
  if(ts.isJsxSpreadAttribute(n))put(n,n);
  else if(ts.isIdentifier(n)&&LOADS.has(n.text)&&!plainOpen(n))put(n,top(n));
  else if(s!==undefined&&!(n.parent&&lit(n.parent)!==undefined)&&LOADS.has(s))put(n,top(n));
  ts.forEachChild(n,v);
 })(tree);
 return out;
}
// v20 adds, removes and moves nothing a page loads or opens: every file's list equals HEAD's (v19's Losses link move
// and Docs link included), in order and in place.
const loadDisplayAdded={};
const loadDisplayRemoved={};
const loadUses={};
for(const f of sources){
 const h=loadsOf(baseline('web/src/'+f),f),n=loadsOf(read('web/src/'+f),f),added=loadDisplayAdded[f]??[],removed=loadDisplayRemoved[f]??[];
 const isAdded=x=>added.some(a=>a.place===x.place&&a.text===x.text),kept=[...h];
 for(const r of removed){
  assert.equal(h.filter(x=>x.place===r.place&&x.text===r.text).length,1,f+': a documented removed link is not exactly once at HEAD: '+r.text);
  kept.splice(kept.findIndex(x=>x.place===r.place&&x.text===r.text),1);
 }
 assert.deepEqual(n.filter(x=>!isAdded(x)),kept,f+': something a page loads or opens (a picture, frame, worker or element made in script, a navigation, a link, a style attribute) was added, removed, changed or moved');
 assert.deepEqual(n.filter(isAdded),added,f+': the added links differ from the documented ones in text, place, order or count');
 for(const a of added)assert.equal(kept.filter(x=>x.place===a.place&&x.text===a.text).length,0,f+': a documented added link already existed at HEAD: '+a.text);
 if(n.length)loadUses[f]=n.length;
}
// v12: the wallet and RPC methods the pages name. Every `method` given as a property (or assigned) in web/src, in order
// with its place: exactly HEAD's list. Local-only Disconnect names no new wallet or RPC method.
// v20 names no new wallet or RPC method in any file. 2026-10-16 Add liquidity build:
// the ITEM-only client.getBalance({ address: account }) adds eth_getBalance, pinned below;
// no existing page or raw provider method changes.
const methodsAdded={};
const itemMethodsAdded=[{method:'eth_getBalance',file:'itemReads.ts',callee:'client.getBalance',scope:'readItemFigures',when:'Earn open, all launch slots filled, connected account only'}];
function methodsOf(text,file){
 const tree=parse(text,file),print=printerOf(tree),out=[],key=n=>ts.isIdentifier(n)||ts.isStringLiteralLike(n)?n.text:ts.isComputedPropertyName(n)?lit(n.expression):undefined;
 const put=(n,value)=>out.push({method:value?lit(value)??'not a plain string: '+print(value):'not a plain string: shorthand',place:place(n,tree)});
 (function v(n){
  if(ts.isPropertyAssignment(n)&&key(n.name)==='method')put(n,n.initializer);
  else if(ts.isShorthandPropertyAssignment(n)&&n.name.text==='method')put(n);
  else if(ts.isBinaryExpression(n)&&n.operatorToken.kind===ts.SyntaxKind.EqualsToken&&(ts.isPropertyAccessExpression(n.left)&&n.left.name.text==='method'||ts.isElementAccessExpression(n.left)&&lit(n.left.argumentExpression)==='method'))put(n,n.right);
  ts.forEachChild(n,v);
 })(tree);
 return out;
}
const methods={};
for(const f of sources){
 const h=methodsOf(baseline('web/src/'+f),f),n=methodsOf(read('web/src/'+f),f),added=methodsAdded[f]??[];
 const isAdded=x=>added.some(a=>a.place===x.place&&a.method===x.method);
 if(f==='wallet.tsx')assert.deepEqual(n.filter(x=>x.place==='useWallet > disconnect'),[],'wallet.tsx: no wallet or RPC method inside disconnect()');
 assert.deepEqual(n.filter(x=>!isAdded(x)),h,f+': a wallet or RPC method was added, removed, changed or moved');
 assert.deepEqual(n.filter(isAdded),added,f+': the added wallet or RPC methods differ from the documented ones in name, place, order or count');
 for(const a of added)assert.equal(h.filter(x=>x.place===a.place&&x.method===a.method).length,0,f+': a documented added method already existed at HEAD at that place: '+a.method);
 for(const x of n)methods[x.method]=(methods[x.method]||0)+1;
}
// v12: what the pages keep in the browser. Every use of localStorage, sessionStorage, indexedDB, cookie or caches, in
// order: HEAD's, including the three uses of the remembered "disconnected" flag in wallet.tsx (read once at start, cleared
// when Connect wallet is answered with an account, set by Disconnect). Its key is pinned with the names below.
const STORE=new Set(['localStorage','sessionStorage','indexedDB','cookie','caches']);
function storageOf(text,file){
 const tree=parse(text,file),print=printerOf(tree),out=[];
 (function v(n){if(ts.isIdentifier(n)&&STORE.has(n.text))out.push({text:print(top(n)),place:place(n,tree)});ts.forEachChild(n,v);})(tree);
 return out;
}
const storageAdded={};
for(const f of sources){
 const h=storageOf(baseline('web/src/'+f),f),n=storageOf(read('web/src/'+f),f),d=difference(h.map(x=>x.text+' @ '+x.place),n.map(x=>x.text+' @ '+x.place));
 assert.deepEqual({removed:d.removed.map(i=>h[i].text),added:d.added.map(i=>[n[i].text,n[i].place])},{removed:[],added:storageAdded[f]??[]},f+': browser storage is used differently from HEAD beyond the documented flag');
}
// The functions named `name` in a file (at any depth), printed without comments.
function functionsNamed(text,file,name){
 const tree=parse(text,file),print=printerOf(tree),out=[];
 (function v(n){if(ts.isFunctionDeclaration(n)&&n.name?.text===name)out.push(print(n));ts.forEachChild(n,v);})(tree);
 return out;
}
const pinnedFunctions={};
function sameFunction(f,name,what){
 const h=functionsNamed(baseline('web/src/'+f),f,name),n=functionsNamed(read('web/src/'+f),f,name);
 assert.equal(h.length,1,f+': one '+name+'() at HEAD');
 assert.deepEqual(n,h,f+' '+name+'() changed ('+what+')');
 pinnedFunctions[f+' '+name+'()']={equalToHead:true,length:n[0].length,sha256:sha256(n[0])};
}
// SPEC 6: compare the send head with HEAD itself byte for byte, including comments and whitespace.
function rawFunction(text,file,name){
 const tree=parse(text,file),found=[];
 (function visit(n){if(ts.isFunctionDeclaration(n)&&n.name?.text===name)found.push(n);ts.forEachChild(n,visit);})(tree);
 assert.equal(found.length,1,file+': one raw '+name+'()');
 return {tree,node:found[0],text:text.slice(found[0].getStart(tree),found[0].end)};
}
function sendParts(text){
 const f=rawFunction(text,'wallet.tsx','send'),wait=[];
 (function visit(n){if(ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>ts.isIdentifier(d.name)&&d.name.text==='receipt'&&d.initializer&&d.initializer.getText(f.tree).startsWith('await client.waitForTransactionReceipt(')))wait.push(n);ts.forEachChild(n,visit);})(f.node);
 assert.equal(wait.length,1,'wallet.tsx send(): one receipt wait statement');
 return {head:text.slice(f.node.getStart(f.tree),wait[0].end),tail:text.slice(wait[0].end,f.node.end)};
}
const headSend=sendParts(baseline('web/src/wallet.tsx')),nowSend=sendParts(read('web/src/wallet.tsx'));
assert.equal(nowSend.head,headSend.head,'wallet.tsx send(): byte-identical head through receipt wait');
// v16 does not touch wallet.tsx: send() is byte-identical to HEAD, head and tail (no piece); the mined-hash
// statements are pinned by sendTailWrites below as well.
const SEND_TAIL_PIECES=[
];
assert.equal(putBack(nowSend.tail,SEND_TAIL_PIECES,'wallet.tsx send() tail'),headSend.tail,'wallet.tsx send(): tail byte-identical to HEAD');
pinnedFunctions['wallet.tsx send()']={headEqualToHead:true,headBytes:Buffer.byteLength(nowSend.head,'utf8'),headSha256:sha256(nowSend.head),tailPieces:SEND_TAIL_PIECES.map(([now,head])=>({now,head}))};
// An explicit ordered pin of the changed transaction-status statements, independent of the piece list.
const sendTailWrites=[];
{const tree=parse(read('web/src/wallet.tsx'),'wallet.tsx'),print=printerOf(tree);
 (function visit(n){
  if(place(n,tree)==='useWallet > send'&&ts.isExpressionStatement(n)){
   const t=print(n);
   if(t==='sent = mined;'||t==='setHash(mined);'||t.startsWith('setConfirmed(')||t.startsWith('report(key, { message: `${label}: Confirmed.'))sendTailWrites.push(t);
  }
  ts.forEachChild(n,visit);
 })(tree);}
assert.deepEqual(sendTailWrites,[
 'sent = mined;',
 'setHash(mined);',
 'setConfirmed({ hash: mined, functionName: s.functionName });',
 'report(key, { message: `${label}: Confirmed. Refreshing…`, hash: mined });',
 'report(key, { message: `${label}: Confirmed.`, hash: mined, detail });',
],'wallet.tsx: exact ordered mined-hash state writes');
sameFunction('Flows.tsx','approveAll','SPEC 3/4 change presentation only');
const CONNECT="async function connect() { if (connectingLock.current) return; connectingLock.current = true; accountVersion.current++; const version = ++connectVersion.current; setConnecting(true); try { if (!window.ethereum) throw new Error(\"Open this page in your wallet app's browser\"); const a = await window.ethereum.request({ method: \"eth_requestAccounts\", }); if (version !== connectVersion.current) return; if (a[0]) { disconnected.current = false; try { localStorage.removeItem(disconnectedKey); } catch { } } setAccount(a[0]); setChainId(Number(await window.ethereum.request({ method: \"eth_chainId\" }))); setMessage(\"\"); } catch (e) { setMessage(explain(e)); } finally { connectingLock.current = false; setConnecting(false); } }";
const DISCONNECT="function disconnect() { if (sending.current) return; accountVersion.current++; connectVersion.current++; disconnected.current = true; try { localStorage.setItem(disconnectedKey, \"1\"); } catch { } setAccount(undefined); setHash(undefined); setMessage(\"Wallet disconnected from this page. To use another wallet, switch the address in your wallet app, then press Connect wallet.\"); }";
for(const [name,value] of [['connect',CONNECT],['disconnect',DISCONNECT]]){
 assert.deepEqual(functionsNamed(read('web/src/wallet.tsx'),'wallet.tsx',name),[value],'wallet.tsx '+name+'() differs from the pinned v12 text');
 pinnedFunctions['wallet.tsx '+name+'()']={pinnedText:true,length:value.length,sha256:sha256(value)};
}
// The existing startup guard stays exactly as at HEAD. A separate counter rejects a late Connect reply.
function intentStatements(text,name){
 const tree=parse(text,'wallet.tsx'),print=printerOf(tree),found=[];
 (function visit(n){if(ts.isIdentifier(n)&&n.text===name){let statement=n;while(statement.parent&&!ts.isStatement(statement))statement=statement.parent;found.push([print(statement),place(n,tree)]);}ts.forEachChild(n,visit);})(tree);
 return found;
}
const accountIntentUses=intentStatements(read('web/src/wallet.tsx'),'accountVersion');
assert.deepEqual(accountIntentUses,intentStatements(baseline('web/src/wallet.tsx'),'accountVersion'),'wallet.tsx: accountVersion guard equals HEAD');
assert.deepEqual(accountIntentUses,[['const accountVersion = useRef(0);','useWallet'],['accountVersion.current++;','useWallet'],['const version = accountVersion.current;','useWallet'],['if (version === accountVersion.current) accounts(a);','useWallet'],['accountVersion.current++;','useWallet'],['accountVersion.current++;','useWallet > connect'],['accountVersion.current++;','useWallet > disconnect']],'wallet.tsx: exact startup account intent guard');
assert.deepEqual(intentStatements(read('web/src/wallet.tsx'),'connectVersion'),[
 ['const connectVersion = useRef(0);','useWallet'],
 ['const version = ++connectVersion.current;','useWallet > connect'],
 ['if (version !== connectVersion.current) return;','useWallet > connect'],
 ['connectVersion.current++;','useWallet > disconnect'],
],'wallet.tsx: the separate counter advances only in connect/disconnect and is read only in connect');
function hookReturn(text){
 const tree=parse(text,'wallet.tsx'),print=printerOf(tree),hook=tree.statements.filter(st=>ts.isFunctionDeclaration(st)&&st.name?.text==='useWallet');
 assert.equal(hook.length,1,'wallet.tsx: one useWallet');
 const returns=hook[0].body.statements.filter(ts.isReturnStatement);
 assert.equal(returns.length,1,'wallet.tsx useWallet: one return');
 return print(returns[0]);
}
// v20: the hook's return list is HEAD's (with addToWallet after switchChain since v18), pinned here printed without
// comments; nothing in the list may change.
const HOOK_RETURN_HEAD="return { account, connecting, progress, report, fail, notice, listingPending, waitPending, chainId, message, hash, busy, confirmed, connect, disconnect, switchChain, addToWallet, send, setMessage, };";
assert.equal(hookReturn(baseline('web/src/wallet.tsx')),HOOK_RETURN_HEAD,'wallet.tsx: HEAD\'s hook return list as pinned');
assert.equal(hookReturn(read('web/src/wallet.tsx')),HOOK_RETURN_HEAD,'wallet.tsx: hook returns HEAD\'s unchanged list');
// SPEC protected code: raw bytes, including entire buttons and effects, independent of generated differences.
const protectedCode={sendTailWrites};
function rawProtected(label,file,select,count=1){
 const list=text=>{const tree=parse(text,file),found=[];(function visit(n){if(select(n,tree))found.push(text.slice(n.getStart(tree),n.end));ts.forEachChild(n,visit);})(tree);return found;};
 const h=list(baseline('web/src/'+file)),n=list(read('web/src/'+file));
 assert.equal(h.length,count,label+': protected baseline count');
 assert.deepEqual(n,h,label+': bytes differ from HEAD');
 protectedCode[label]=h.map(x=>({bytes:Buffer.byteLength(x,'utf8'),sha256:sha256(x)}));
}
for(const name of ['switchChain','listingPending','waitPending'])rawProtected('wallet '+name,'wallet.tsx',n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);
// Vault.tsx is frozen in v13 (byte-identical to HEAD above); DepositState keeps its raw pin with no piece.
const DEPOSIT_STATE_PIECES=[
];
const headDepositState=rawFunction(baseline('web/src/Vault.tsx'),'Vault.tsx','DepositState').text;
const nowDepositState=rawFunction(read('web/src/Vault.tsx'),'Vault.tsx','DepositState').text;
assert.equal(putBack(nowDepositState,DEPOSIT_STATE_PIECES,'Vault DepositState'),headDepositState,'Vault DepositState: only exact owner-approved issue-only presentation pieces');
protectedCode['Vault DepositState']={headBytes:Buffer.byteLength(headDepositState,'utf8'),headSha256:sha256(headDepositState),pieces:DEPOSIT_STATE_PIECES};
// These independent raw pins bind the reviewed local LED renderer and its glyph data outside regeneration.
const depositSignPins={DepositLedSign:"5261668a5c55b74287e3dc342168e9176be06b3c7bbd46b0ae98106dc733cf29",DEPOSIT_LETTERS:"4942959fd3db1936945a38cf0bb15be49da43088af5d080c224a19d8e33e44fd"};
for(const [name,digest] of Object.entries(depositSignPins)){
 const text=read('web/src/Vault.tsx'),tree=parse(text,'Vault.tsx');
 const found=tree.statements.filter(n=>(ts.isFunctionDeclaration(n)&&n.name?.text===name)||(ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>ts.isIdentifier(d.name)&&d.name.text===name)));
 assert.equal(found.length,1,'Vault: one top-level '+name);
 assert.equal(sha256(text.slice(found[0].getStart(tree),found[0].end)),digest,'Vault: exact reviewed '+name);
}
const depositStateUses=[];
for(const f of sources){const tree=parse(read('web/src/'+f),f),print=printerOf(tree);(function visit(n){if((ts.isJsxSelfClosingElement(n)||ts.isJsxOpeningElement(n))&&n.tagName.getText(tree)==='DepositState')depositStateUses.push([f,place(n,tree),print(n)]);ts.forEachChild(n,visit);})(tree);}
assert.deepEqual(depositStateUses,[['Flows.tsx','DepositPage','<DepositState snapshot={s} showSign/>'],['Vault.tsx','VaultPage','<DepositState snapshot={s}/>']],'DepositState: the approved sign is enabled only on Deposit');
protectedCode.depositSign={rawPins:depositSignPins,uses:depositStateUses};
rawProtected('Flows approveAll','Flows.tsx',n=>ts.isFunctionDeclaration(n)&&n.name?.text==='approveAll');
rawProtected('Flows onSubmit','Flows.tsx',n=>ts.isJsxAttribute(n)&&n.name.getText()==='onSubmit',2);
rawProtected('Flows getSpec','Flows.tsx',n=>ts.isJsxAttribute(n)&&n.name.getText()==='getSpec',3);
rawProtected('Flows transaction buttons','Flows.tsx',n=>ts.isJsxSelfClosingElement(n)&&n.tagName.getText()==='TxButton',3);
rawProtected('Claims Claim all handler','Flows.tsx',(n,t)=>ts.isJsxAttribute(n)&&n.name.getText(t)==='onClick'&&n.getText(t).includes('claimable.slice'));
const effect=(component,needle)=>(n,t)=>ts.isCallExpression(n)&&['useEffect','useLayoutEffect'].includes(n.expression.getText(t))&&place(n,t)===component&&n.getText(t).includes(needle);
rawProtected('Claims owed read','Flows.tsx',effect('Claims','vault("owed"'));
rawProtected('Deposit simulate effect','Flows.tsx',effect('DepositPage','simulate('));
rawProtected('Deposit confirmed reset','Flows.tsx',effect('DepositPage','setInputs({})'));
rawProtected('Deposit receipt read','Flows.tsx',effect('DepositPage','.getTransactionReceipt('));
for(const name of ['short','approvals'])rawProtected('Deposit '+name,'Flows.tsx',(n,t)=>ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&n.name.text===name&&place(n,t)==='DepositPage');


// Names. In the v12 files every name HEAD declares at the top of the file (imports included) and at the top of each
// component or hook (parameters included) is still declared there once, by the same text: the same import, the same
// useState or useRef, the same expression. So `vault`, `token`, `amount`, `depositArgs`, `VAULT`, `quote`, `inputs`,
// `open`, `approvals`, `account` and every other name the pinned transaction code uses still mean what they meant at
// HEAD. The names an update adds at the top of a file are listed here (two imports of the data file's constants in Tokenomics.tsx); a name it adds at the top of a component or hook
// must be new there and must not hide a name declared at the top of the file.
function scopes(text,file){
 const tree=parse(text,file),print=printerOf(tree),module=Object.create(null),functions=Object.create(null);
 const put=(map,name,what)=>(map[name]??=[]).push(what);
 const bound=(b,f)=>{if(ts.isIdentifier(b))f(b.text);else for(const e of b.elements)if(!ts.isOmittedExpression(e))bound(e.name,f);};
 const level=(statements,map)=>{for(const st of statements){
  if(ts.isVariableStatement(st))for(const d of st.declarationList.declarations)bound(d.name,name=>put(map,name,print(d)));
  if((ts.isFunctionDeclaration(st)||ts.isClassDeclaration(st))&&st.name)put(map,st.name.text,ts.isFunctionDeclaration(st)?'function':'class');
 }};
 for(const st of tree.statements)if(ts.isImportDeclaration(st)&&st.importClause){
  const from=' from '+st.moduleSpecifier.getText(tree),c=st.importClause,b=c.namedBindings;
  if(c.name)put(module,c.name.text,'import default'+from);
  if(b&&ts.isNamespaceImport(b))put(module,b.name.text,'import *'+from);
  if(b&&ts.isNamedImports(b))for(const e of b.elements)put(module,e.name.text,(c.isTypeOnly||e.isTypeOnly?'import type ':'import ')+(e.propertyName?e.propertyName.text+' as ':'')+e.name.text+from);
 }
 level(tree.statements,module);
 for(const st of tree.statements)if(ts.isFunctionDeclaration(st)&&st.name&&st.body){const map=functions[st.name.text]=Object.create(null);for(const p of st.parameters)bound(p.name,name=>put(map,name,'parameter '+print(p)));level(st.body.statements,map);}
 return {module,functions};
}
// Scoping. The transaction code of a v12 file is send(), approveAll() and every attribute that builds or starts a
// transaction or holds a guarded call. A name used in it is declared inside that code itself, at the top of its
// component or hook, at the top of the file, or by something wrapped around the code in between (as the `a` of a
// list's map() is at HEAD). This lists every name of the last kind with its declaration; the list must equal HEAD's,
// so no function or block put around unchanged transaction code can give one of its names another meaning.
function wrappedNames(text,file,functionNames){
 const tree=parse(text,file),print=printerOf(tree),out=[];
 const each=(b,f)=>{if(ts.isIdentifier(b))f(b.text);else for(const e of b.elements)if(!ts.isOmittedExpression(e))each(e.name,f);};
 // What a function, block, catch or loop declares itself: name -> printed declaration.
 const made=s=>{const d=new Map(),add=(b,node)=>each(b,name=>d.set(name,print(node)));
  if(ts.isFunctionLike(s)){for(const p of s.parameters)add(p.name,p);if(ts.isFunctionExpression(s)&&s.name)d.set(s.name.text,'its own name');}
  if(ts.isCatchClause(s)&&s.variableDeclaration)add(s.variableDeclaration.name,s.variableDeclaration);
  if((ts.isForStatement(s)||ts.isForOfStatement(s)||ts.isForInStatement(s))&&s.initializer&&ts.isVariableDeclarationList(s.initializer))for(const x of s.initializer.declarations)add(x.name,x);
  if(ts.isBlock(s)||ts.isCaseClause(s)||ts.isDefaultClause(s))for(const st of s.statements){if(ts.isVariableStatement(st))for(const x of st.declarationList.declarations)add(x.name,x);if((ts.isFunctionDeclaration(st)||ts.isClassDeclaration(st))&&st.name)d.set(st.name.text,'function or class '+st.name.text);}
  return d;},known=new Map(),declares=s=>known.get(s)??known.set(s,made(s)).get(s);
 const within=(n,x)=>{for(;n;n=n.parent)if(n===x)return true;return false;};
 let count=0;
 const code=(x,label)=>{const k=++count,component=(()=>{let c;for(let p=x;p;p=p.parent)if(ts.isFunctionDeclaration(p)&&ts.isSourceFile(p.parent))c=p;return c;})();
  (function v(n){
   if(ts.isTypeNode(n))return;
   if(ts.isIdentifier(n))for(let s=n.parent;s&&s!==component;s=s.parent){
    const how=declares(s).get(n.text);
    if(how===undefined)continue;
    if(!within(s,x)&&s!==component?.body)out.push('#'+k+' '+label+': '+n.text+' is declared around it by '+how);
    break;
   }
   ts.forEachChild(n,v);
  })(x);};
 (function v(n){
  if(ts.isFunctionDeclaration(n)&&n.name&&functionNames.includes(n.name.text))code(n,n.name.text+'()');
  else if(ts.isJsxAttribute(n)&&isAction(n.name.getText(tree))&&(TX_ATTRIBUTES.has(n.name.getText(tree))||(function g(m){return isGuarded(m,tree)||!!ts.forEachChild(m,g);})(n)))code(n,place(n.parent,tree)+' '+n.name.getText(tree));
  ts.forEachChild(n,v);
 })(tree);
 return {count,names:[...new Set(out)]};
}
const transactionCode={};
for(const f of Object.keys(editedFiles)){
 const pinnedHere=f==='wallet.tsx'?['send']:f==='Flows.tsx'?['approveAll']:[],h=wrappedNames(baseline('web/src/'+f),f,pinnedHere),n=wrappedNames(read('web/src/'+f),f,pinnedHere);
 assert.deepEqual(n,h,f+': a name used by the transaction code is declared around it differently from HEAD');
 transactionCode[f]={pieces:n.count,namesDeclaredAroundThem:n.names};
}
// ITEM: the restored text adds no name at the top of a file (the ITEM imports sit inside the pieces and the raw pins).
const namesAdded={
 "main.tsx": {},
 "components.tsx": {},
 "wallet.tsx": {},
 "chain.ts": {},
 "Docs.tsx": {},
 "tokenomicsData.ts": {},
 "Tokenomics.tsx": {}
};
// v16: the exact declarations that change at the top of the two files (two imports leave Tokenomics.tsx; four data
// declarations of tokenomicsData.ts carry the reviewed words); never generated by put-pieces.
const moduleChanges={};
// v16 changes no declaration at the top of a component or hook; never generated by put-pieces.
const scopeChanges={};
const newNames={};
for(const f of Object.keys(editedFiles)){
 const h=scopes(baseline('web/src/'+f),f),n=scopes(read('web/src/'+f),f);
 for(const name in h.module){
  const change=moduleChanges[f]?.find(x=>x.name===name);
  if(change){assert.deepEqual(h.module[name],change.head,f+': module exception baseline');assert.deepEqual(n.module[name]??null,change.now,f+': exact approved module declaration change');}
  else assert.deepEqual(n.module[name],h.module[name],f+': '+name+' is declared differently at the top of the file');
 }
 assert.deepEqual(Object.fromEntries(Object.keys(n.module).filter(name=>!(name in h.module)).map(name=>[name,n.module[name].join(' | ')])),namesAdded[f],f+': the names added at the top of the file (imports included) differ from the documented ones');
 for(const fn in h.functions){
  const was=h.functions[fn],is=n.functions[fn];
  assert.ok(is,f+': '+fn+' is gone');
  for(const name in was){
   const change=scopeChanges[f]?.find(x=>x.function===fn&&x.name===name);
   if(change){assert.deepEqual(was[name],change.head,f+' '+fn+': declaration exception baseline');assert.deepEqual(is[name]??null,change.now,f+' '+fn+': exact approved declaration change');}
   else assert.deepEqual(is[name],was[name],f+' '+fn+': '+name+' is declared differently');
  }
  const added=Object.keys(is).filter(name=>!(name in was));
  for(const name of added){assert.equal(is[name].length,1,f+' '+fn+': '+name+' is declared twice');assert.ok(!(name in n.module),f+' '+fn+': the new name '+name+' hides a name declared at the top of the file');}
  if(added.length)(newNames[f]??={})[fn]=added;
 }
}
// The whole-source digest is additional to the specific structural assertions above.
for(const [f,digest] of Object.entries(reviewedSourcePins))assert.equal(sha256(read('web/src/'+f)),digest,f+': reviewed source differs; regeneration does not authorize source edits');
// Differential encoding: HEAD and current governance/model/chain bundled side by side. For the same inputs the
// calldata must be byte-identical whenever the current page accepts; v12 adds no refusal, never accepts what HEAD
// refused, and refuses with HEAD's words (model.ts, chain.ts and governance.ts are byte-identical to HEAD in v12).
const scratch=path.join(root,'test/scratch/calldata');
fs.rmSync(scratch,{recursive:true,force:true});
for(const p of git(['ls-tree','-r','--name-only',LEGACY,'web/src']).trim().split('\n').filter(p=>/\.(tsx?|json)$/.test(p))){
 const out=path.join(scratch,'head',p.slice(4));fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,baseline(p));
}
const entry=src=>`export { proposalSpec, proposalAction } from "${src}/governance";\nexport { parseLaunch, address, recipient, amount, uint, deadline, depositArgs, redeemArgs } from "${src}/model";\nexport { encode, vault, token, VAULT } from "${src}/chain";\nexport { newOwner } from "${src}/governance";\n`;
fs.writeFileSync(path.join(scratch,'head-entry.ts'),entry('./head/src'));
fs.writeFileSync(path.join(scratch,'now-entry.ts'),entry('../../../web/src'));
const bundle=async name=>{const outfile=path.join(scratch,name+'.mjs');await build({entryPoints:[path.join(scratch,name+'-entry.ts')],bundle:true,format:'esm',platform:'node',outfile,nodePaths:[path.resolve('node_modules')],logLevel:'error'});return import(pathToFileURL(outfile).href);};
const head=await bundle('head'),now=await bundle('now');
const SPRING='Sunday 2:00-2:59 am New York is skipped on the spring-forward Sunday; choose another start.';
const U128='Minimum raw pool liquidity: enter an unsigned 128-bit whole number.';
const V=now.VAULT,A='0x1111111111111111111111111111111111111111',B='0x2222222222222222222222222222222222222222',Z='0x0000000000000000000000000000000000000000';
const badChecksum='0x'+V.slice(2).replace(/[a-f]/,c=>c.toUpperCase());
const addrs=[A,B,V,V.toUpperCase().replace('0X','0x'),Z,'bad','',badChecksum];
const liqs=['0','1','1000000',String(2n**128n-1n),String(2n**128n),String(2n**200n),String(2n**256n-1n),String(2n**256n),'-1','1.5',' 7',''];
const hourTexts=['Monday 9:30 am','Friday 4:00 pm','Sunday 8:00 pm','Saturday 24:00','Sunday 12:00 am','Sunday 1:59 am','Sunday 2:00 am','Sunday 2:30 am','Sunday 2:59 am','Sunday 3:00 am','Always open','Monday 24:00','junk'];
const values=['0','1','2','3','4','10','48','49','50','299','300','2000','3600','20000','86400','500000','500001',String(2n**256n-1n),String(2n**256n),'1.5',''];
const settingsList=[undefined,{dst:0n},{dst:1n},{dst:2n}];
const cases=[];
for(const token of [A,V,Z,'bad'])for(const feed of [B,V,Z])for(const pool of [A,V,Z])for(const quoteFeed of [B,Z])for(const minLiquidity of liqs)cases.push([0,{token,feed,pool,quoteFeed,minLiquidity}]);
for(const token of addrs)for(const feed of addrs)cases.push([1,{token,feed}]);
for(const k of [2,3,4,6])for(const token of addrs)cases.push([k,{token}]);
for(const token of [A,V,'bad'])for(const pool of [A,V,Z])for(const quoteFeed of [B,Z])for(const minLiquidity of liqs)cases.push([5,{token,pool,quoteFeed,minLiquidity}]);
for(const next of addrs)cases.push([7,{next}]);
for(const cap of ['0','1','1.5','10000000000','10000000000.000000000000000001','x',''])cases.push([8,{cap}]);
for(const recipient of addrs)cases.push([9,{recipient}]);
for(let k=0;k<=16;k++)if(k!==5)for(const value of values)cases.push([10,{setting:String(k),value}]);
for(const from of hourTexts)for(const to of hourTexts)for(const settings of settingsList)cases.push([10,{setting:'5',from,to},settings]);
for(const k of [11,-1])cases.push([k,{}]);
const attempt=f=>{try{return {hex:f()};}catch(e){return {error:e.message};}};
const tally={sameCalldata:0,bothRefused:0,newRefusals:{},refusedBoth:{}};
function compare(label,input,h,n,newRefusalAllowed,t=tally){
 if(n.hex!==undefined){assert.ok(h.hex!==undefined,label+' accepted input HEAD refused: '+JSON.stringify(input));assert.equal(n.hex,h.hex,label+' calldata changed for '+JSON.stringify(input));t.sameCalldata++;}
 else if(h.hex!==undefined){assert.ok(newRefusalAllowed(n.error),label+' new refusal not documented: '+n.error+' for '+JSON.stringify(input));t.newRefusals[n.error]=(t.newRefusals[n.error]||0)+1;}
 else {assert.equal(n.error,h.error,label+' refusal words changed for '+JSON.stringify(input));t.bothRefused++;if(t.refusedBoth)t.refusedBoth[n.error]=(t.refusedBoth[n.error]||0)+1;}
}
const json=x=>JSON.parse(JSON.stringify(x,(k,v)=>typeof v==='bigint'?String(v):v));
for(const [kind,v,settings] of cases){
 const h=attempt(()=>head.encode(head.proposalSpec(kind,v,settings))),n=attempt(()=>now.encode(now.proposalSpec(kind,v,settings)));
 compare('propose',json({kind,v,settings}),h,n,()=>false);
}
for(const next of addrs)compare('transferOwnership',{next},attempt(()=>head.encode(head.vault('transferOwnership',[head.newOwner(next)]))),attempt(()=>now.encode(now.vault('transferOwnership',[now.newOwner(next)]))),()=>false);
for(const pool of [A,Z])for(const quoteFeed of [B,Z])for(const minLiquidity of liqs){
 const text=`AAA ${A} ${B} ${pool} ${quoteFeed} ${minLiquidity}\nBBB ${B} ${A} ${Z} ${Z} 0`;
 const listing=m=>m.parseLaunch(text).map(r=>m.encode(m.vault('listGenesis',[r.token,r.feed,r.pool,r.quoteFeed,r.minLiquidity]))).join();
 compare('listGenesis',{text},attempt(()=>listing(head)),attempt(()=>listing(now)),()=>false);
}
// Deposit, redeem, claim, approve and owner-button calls built from the model parsers, compared under fixed clocks so
// deadline() (the clock plus 600 s, the last argument of every deposit and redeem) is compared too. Here no new
// refusal is allowed: every input must give the same calldata as HEAD or be refused by both.
const sends={},clock=Date.now;
const cmp=(label,input,f)=>compare(label,input,attempt(()=>f(head)),attempt(()=>f(now)),()=>false,sends[label]??={sameCalldata:0,bothRefused:0,newRefusals:{}});
const clocks=[0,999,1791000000000,1791000000999,1791006123456.7,4102444800000];
const amountTexts=['0','1','1.5','0.000001','0.0000001','1.000000000000000001','1.0000000000000000001','10000000000',
 '115792089237316195423570985008687907853269984665640564039457.584007913129639935','115792089237316195423570985008687907853269984665640564039457.584007913129639936',
 String(2n**256n-1n),String(2n**256n),' 2 ','2.','.5','-1','1e18','x',''];
const legsList=[[],[0n],[0n,3333n],[1n,999n,1000n,10n**18n,2n**200n]];
const depositInputs=[[[A,B],[1n,2n],A,1000n],[[A],[0n],B,0n],[[B,A,V],[10n**18n,3n,2n**255n],A,2n**256n-1n],[[],[],A,999n]];
try{
 for(const t of clocks){
  Date.now=()=>t;
  assert.equal(String(now.deadline()),String(head.deadline()),'deadline() at clock '+t);
  for(const args of depositInputs){
   assert.deepEqual(json(now.depositArgs(...args)),json(head.depositArgs(...args)),'depositArgs (all five arguments, deadline included) at clock '+t);
   cmp('deposit',json({clock:t,args}),m=>m.encode(m.vault('deposit',m.depositArgs(...args))));
  }
  for(const shares of [0n,10n,2n**256n-1n])for(const legs of legsList){
   assert.deepEqual(json(now.redeemArgs(shares,A,legs)),json(head.redeemArgs(shares,A,legs)),'redeemArgs (all four arguments, deadline included) at clock '+t);
   cmp('redeemArgs',json({clock:t,shares,legs}),m=>m.encode(m.vault('redeem',m.redeemArgs(shares,A,legs))));
  }
 }
 Date.now=()=>1791000000000;
 // Redeem as Flows builds it: amount(input) shares, recipient(to), redeemArgs(shares, receiver, previewRedeem amounts).
 for(const text of amountTexts)for(const to of addrs)for(const legs of legsList.slice(1,3))
  cmp('redeem',json({text,to,legs}),m=>m.encode(m.vault('redeem',m.redeemArgs(m.amount(text),m.recipient(to),legs))));
 // Deposit amounts (amount(input, false, tokenDecimals)) and the approve built from them.
 for(const text of amountTexts)for(const d of [0,6,8,18])cmp('approve',{text,d},m=>m.encode(m.token(A,'approve',[m.VAULT,m.amount(text,false,d)])));
 // Claim and Claim all: vault("claim", [tokens, recipient(to)]).
 for(const to of addrs)for(const tokens of [[A],[A,B],Array(10).fill(B)])cmp('claim',{to,tokens},m=>m.encode(m.vault('claim',[tokens,m.recipient(to)])));
 // Owner buttons: lowerNAVCap(amount(cap, true)), close and removeRetired(address(token)).
 for(const text of amountTexts)cmp('lowerNAVCap',{text},m=>m.encode(m.vault('lowerNAVCap',[m.amount(text,true)])));
 for(const fn of ['close','removeRetired'])for(const v of addrs)cmp(fn,{v},m=>m.encode(m.vault(fn,[m.address(v)])));
 // The parsers' values themselves.
 for(const v of [...liqs,...amountTexts])for(const bits of [128,256])cmp('uint',{v,bits},m=>String(m.uint(v,bits)));
 for(const v of addrs)for(const zero of [false,true])cmp('address',{v,zero},m=>m.address(v,zero));
}finally{Date.now=clock;}
for(const [label,t] of Object.entries(sends)){
 assert.ok(t.sameCalldata>0,label+': corpus has accepted inputs');
 if(!['deposit','redeemArgs'].includes(label))assert.ok(t.bothRefused>0,label+': corpus has refused inputs');
}
// The transaction-argument builders and parsers, printed without comments, also equal HEAD.
const pinned={'web/src/model.ts':['same','deadline','depositArgs','redeemArgs','amount','address','recipient','uint','parseLaunch'],'web/src/chain.ts':['vault','token','encode']};
function declarations(file,text,list){
 const tree=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS),printer=ts.createPrinter({removeComments:true}),out={};
 for(const st of tree.statements){
  if(ts.isFunctionDeclaration(st)&&st.name&&list.includes(st.name.text))out[st.name.text]=printer.printNode(ts.EmitHint.Unspecified,st,tree);
  if(ts.isVariableStatement(st))for(const d of st.declarationList.declarations)if(ts.isIdentifier(d.name)&&list.includes(d.name.text))out[d.name.text]=printer.printNode(ts.EmitHint.Unspecified,st,tree);
 }
 // Functions inside components (checkRows in LaunchListing): any depth, exactly one declaration.
 (function v(n){if(n!==tree&&ts.isFunctionDeclaration(n)&&n.name&&list.includes(n.name.text)&&n.parent!==tree){assert.ok(!out[n.name.text],file+': one '+n.name.text);out[n.name.text]=printer.printNode(ts.EmitHint.Unspecified,n,tree);}ts.forEachChild(n,v);})(tree);
 for(const n of list)assert.ok(out[n],file+': '+n+' found');
 return out;
}
for(const [file,list] of Object.entries(pinned)){
 const n=declarations(file,read(file),list),h=declarations(file,baseline(file),list);
 for(const k of list)assert.equal(n[k],h[k],file+': '+k+' changed');
}
// A6 G-B: where the send arguments come from. Printed without comments (whitespace folded), each declaration equals
// HEAD (v12 documents no piece: the [v12, HEAD] lists are empty), or equals the pinned v9 text: the Guardian and
// FeeRecipient proposal targets (newGuardian(v.next), feeRecipient(v.recipient)), the parsers they use, and the
// listing rows (checkRows) and the Finalize helpers.
const pinnedV9={
 'web/src/governance.ts':{
  proposalAction:[],
  proposalSpec:[],
  settingValues:[],
  poolValues:[],
  newOwner:'export function newOwner(v: string): Address { const next = address(v); if (same(next, VAULT)) throw new InputError("The new owner must not be the vault."); return next; }',
  newGuardian:'function newGuardian(v: string): Address { const next = address(v); if (same(next, VAULT)) throw new InputError("The new guardian must not be the vault."); return next; }',
  feeRecipient:'function feeRecipient(v: string): Address { const target = address(v); if (same(target, VAULT)) throw new InputError("The fee recipient must not be the vault."); return target; }',
  minLiquidityOf:'function minLiquidityOf(v: string) { try { return uint(v, 128); } catch { throw new InputError("Minimum raw pool liquidity: enter an unsigned 128-bit whole number."); } }',
  springForwardStart:'export function springForwardStart(from: bigint, dst: bigint) { return dst === 0n && from >= 7200n && from < 10800n; }',
  SPRING_FORWARD_START:'export const SPRING_FORWARD_START = "Sunday 2:00-2:59 am New York is skipped on the spring-forward Sunday; choose another start.";'},
 'web/src/Owner.tsx':{
  checkRows:[],
  listedDiffers:'function listedDiffers(assets: Asset[], r: ReturnType<typeof parseLaunch>[number]) { const a = assets.find((x) => same(x.token, r.token)); return (!!a && (!same(a.feed, r.feed) || !same(a.pool, r.pool) || !same(a.quoteFeed, r.quoteFeed) || a.minLiquidity !== r.minLiquidity)); }',
  differWords:'const differWords = (tickers: string[]) => `Listed with other values than the pasted lines: ${tickers.join(", ")}. Check pairings shows which field; paste the lines that were listed.`;',
  PASTE_FIRST:'const PASTE_FIRST = "Paste the listing rows first so the page can check none is missing.";'},
};
const one=s=>s.replace(/\s+/g,' ');
// The v9 text, as pinned, also stands at HEAD.
for(const [file,map] of Object.entries(pinnedV9)){
 const h=declarations(file,baseline(file),Object.keys(map));
 for(const [k,x] of Object.entries(map))if(typeof x==='string')assert.equal(one(h[k]),x,file+': '+k+' at HEAD differs from the pinned v9 text');
}
for(const [file,map] of Object.entries(pinnedV9)){
 const list=Object.keys(map),n=declarations(file,read(file),list),old=list.filter(k=>typeof map[k]!=='string'),h=declarations(file,baseline(file),old);
 for(const k of list)assert.equal(typeof map[k]==='string'?one(n[k]):putBack(one(n[k]),map[k],file+' '+k),typeof map[k]==='string'?map[k]:one(h[k]),file+': '+k+' differs from the pinned v9 text');
}
// The names those closures call are bound once, by the import from the module that defines them (no local
// declaration in any scope can stand in for newOwner, vault, read, ...).
const imports={'web/src/Owner.tsx':{newOwner:'./governance',inspectListing:'./governance',proposalSpec:'./governance',vault:'./chain',read:'./chain',InputError:'./chain',address:'./model',same:'./model',parseLaunch:'./model',loadSnapshot:'./model',TransactionCancelled:'./wallet'},
 'web/src/governance.ts':{vault:'./chain',VAULT:'./chain',InputError:'./chain',address:'./model',same:'./model',uint:'./model',amount:'./model'}};
for(const [file,map] of Object.entries(imports)){
 const tree=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS),bound={};
 (function v(n){
  const id=n.name&&ts.isIdentifier(n.name)&&(ts.isVariableDeclaration(n)||ts.isFunctionDeclaration(n)||ts.isFunctionExpression(n)||ts.isParameter(n)||ts.isBindingElement(n)||ts.isClassDeclaration(n)||ts.isImportSpecifier(n)||ts.isNamespaceImport(n)||ts.isImportClause(n))?n.name.text:undefined;
  if(id&&map[id])(bound[id]??=[]).push(ts.isImportSpecifier(n)&&!n.propertyName?n.parent.parent.parent.moduleSpecifier.text:'local '+ts.SyntaxKind[n.kind]);
  ts.forEachChild(n,v);
 })(tree);
 for(const [k,m] of Object.entries(map))assert.deepEqual(bound[k],[m],file+': '+k+' is bound only by its import from '+m);
}
assert.equal(now.VAULT,head.VAULT,'the vault address the encoders use');
// The v9 refusals (uint128 minLiquidity, vault as guardian or new owner, Sunday 2:00-2:59 am start under Dst 0) are
// still made, by HEAD and now alike, and v12 adds none.
for(const m of [U128,'The new guardian must not be the vault.','The new owner must not be the vault.',SPRING]) assert.ok(tally.refusedBoth[m]>0,'corpus exercises (refused by HEAD and now alike): '+m);
assert.deepEqual(tally.newRefusals,{},'no new refusal');
assert.ok(tally.sameCalldata>400,'corpus size '+JSON.stringify(tally));
assert.equal(tally.sameCalldata,496,'v12 retains all 496 accepted differential cases');
assert.equal(tally.bothRefused,1773,'v12 retains all 1773 refused differential cases');
fs.rmSync(scratch,{recursive:true,force:true});
// 2026-10-16 Add liquidity build: native value belongs only to the ITEM ETH add.
// These files also contain display/read values, so inspect their actual send builders, not unrelated JSX values.
const vaultNoValueBuilders={};
const vaultWriteNames=new Set(JSON.parse(rawRead('web/src/vault.abi.json')).filter(entry=>entry.type==='function'&&['payable','nonpayable'].includes(entry.stateMutability)).map(entry=>entry.name));
for(const file of ['model.ts','Flows.tsx','Owner.tsx','Losses.tsx']){
 const text=rawRead('web/src/'+file),tree=parse(text,file),builders=[];
 (function v(node){
  if(file==='model.ts'&&(ts.isFunctionDeclaration(node)||ts.isVariableDeclaration(node))&&['deadline','depositArgs','redeemArgs'].includes(node.name?.text))builders.push(node.getText(tree));
  if(ts.isJsxAttribute(node)&&['getSpec','build'].includes(node.name.getText(tree)))builders.push(node.getText(tree));
  if(ts.isCallExpression(node)&&/^(?:w|wallet)\.send$/.test(node.expression.getText(tree)))builders.push(node.arguments[0].getText(tree));
  if(ts.isCallExpression(node)){
   const callee=node.expression.getText(tree),name=callee==='vault'?node.arguments[0]:callee==='token'?node.arguments[1]:undefined;
   if(callee==='proposalSpec'||name&&ts.isStringLiteralLike(name)&&(callee==='vault'?vaultWriteNames.has(name.text):name.text==='approve'))builders.push(node.getText(tree));
  }
  ts.forEachChild(node,v);
 })(tree);
 assert.ok(builders.length,file+': vault send builders found');
 for(const builder of builders)assert.doesNotMatch(builder,/\bvalue\b/,file+': no vault send builder mentions native value');
 vaultNoValueBuilders[file]=builders.length;
}
// ITEM SPEC 6: independent structural/read/send checks supplement reviewed raw pins.
const itemSafety=[];
for(const file of ITEM_NEW_SOURCES){
 const text=rawRead('web/src/'+file),tree=parse(text,file);
 assert.deepEqual(storageOf(text,file),[],file+': ITEM introduces no browser storage');
 assert.deepEqual(methodsOf(text,file),[],file+': ITEM introduces no raw provider method');
 assert.doesNotMatch(text,/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|setInterval|setTimeout|eval|Function)\b|window\.ethereum|\b(?:start|fund|release|sync)\s*\(/,file+': no extra network, timer, code execution or setup transaction');
 const send=sendsOf(text,file);
 if(file==='Earn.tsx'){
  assert.equal(send.length,2,'2026-10-16 Add liquidity build: exactly two ITEM page wallet send sinks');
  assert.match(send[0].text,/^wallet\.send\(itemSend\(action, amount\), prefix, /,'all ITEM sends use checked allowlist constructor');
  assert.ok(send[0].text.endsWith(', refresh)'),'ITEM confirmation refresh is the current page callback');
  assert.equal(send[1].text,'wallet.send(spec, prefix, kind === "add" ? "Add liquidity" : "Approve " + (kind === "token" ? tokenSymbol : quoteSymbol), refresh)','new form sink uses the checked spec and current page refresh callback');
  assert.match(text,/const spec = itemSend\(action, kind === "quote" \? amounts\.matched : amount, LAUNCH, kind === "add" \? \{ user: account, matched: amounts\.matched, minimumA: amounts\.minimumA, minimumB: amounts\.minimumB, deadline: deadline\(\) \} : undefined\);/,'router send takes exact freshly quoted amounts, minima, connected user and site deadline');
 }else assert.deepEqual(send,[],file+': no wallet send sink');
 const urls=[...text.matchAll(/https?:[^\s\x60"']+/g)].map(m=>m[0]);
 assert.deepEqual(urls,file==='FindItem.tsx'?[
  'https://app.uniswap.org/positions/add/new?chain=robinhood&protocolVersion=v2&currencyA=NATIVE&currencyB=${LAUNCH.ITEM}',
  'https://app.uniswap.org/positions/add/new?chain=robinhood&protocolVersion=v2&currencyA=${KNOWN.BASK}&currencyB=${KNOWN.USDG}',
 ]:file==='itemConstants.ts'&&itemLaunch.slots.ITEM_REPO?[itemLaunch.slots.ITEM_REPO]:[],file+': exact permitted URL patterns');
 itemSafety.push({file,storage:0,providerMethods:0,sendSinks:send.length});
}
// Owner-approved source link: the sole direct anchor uses the already validated launch repository unchanged.
// Owner correction: Transparency keeps contracts/source and current protocol roles; no separate ITEM read hook.
const transparencyText=rawRead('web/src/Transparency.tsx'),transparencyTree=parse(transparencyText,'Transparency.tsx'),sourceAnchors=[];
function visitSourceAnchor(node){if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(transparencyTree)==='a'||ts.isJsxSelfClosingElement(node)&&node.tagName.getText(transparencyTree)==='a')sourceAnchors.push(node.getText(transparencyTree));ts.forEachChild(node,visitSourceAnchor);}
visitSourceAnchor(transparencyTree);
assert.deepEqual(sourceAnchors,['<a href={LAUNCH.ITEM_REPO} target="_blank" rel="noreferrer">{LAUNCH.ITEM_REPO}</a>'],'one exact source anchor to validated ITEM_REPO, with no substituted or appended destination');
assert.doesNotMatch(transparencyText,/useItemFigures|readItemFigures|Where the ITEM is|Launch setup/,'owner correction removes separate Transparency ITEM reads and inventory/setup panels');
assert.match(transparencyText,/<p data-role="dev">Developer: \{address\(KNOWN\.DEV\)\}<\/p>/,'developer address is the approved constant');
assert.match(transparencyText,/snapshot\.globals\[key\]/,'owner and guardian use the current existing vault snapshot');
for(const role of ['owner','guardian'])assert.ok(transparencyText.includes('<p data-role="'+role+'">Vault '+role+': {role("'+role+'")}</p>'),'exact live vault role '+role);
assert.match(rawRead('web/src/itemActions.ts'),/await verifyItemTarget\(expected\.address, expected\.itemHash\);/,'every ITEM send verifies its exact expected target hash');
assert.match(rawRead('web/src/wallet.tsx'),/if \(item\) await checkItemSend\(s\);\s*else await verifyNetwork\(\);\s*await simulate\(s, account\);/,'target hash check and exact simulation before wallet prompt');
assert.match(rawRead('web/src/Earn.tsx'),/act\(\(actionPrefix \+ "Approve"\) as ItemAction, stakeAmount\)/,'approval uses the stake input amount');
assert.match(rawRead('web/src/Earn.tsx'),/act\(\(actionPrefix \+ "Stake"\) as ItemAction, stakeAmount\)/,'stake uses the identical input amount');
// 2026-10-16 Add liquidity build: a disconnected wallet, changed chain or closed card cancels its pending pre-wallet quote.
assert.match(rawRead('web/src/Earn.tsx'),/useLayoutEffect\(\(\) => \(\) => \{ requestVersion\.current\+\+; \}, \[wallet\.account, wallet\.chainId\]\);/,'pending liquidity reads are invalidated before the old wallet context or card can continue');
assert.match(rawRead('web/src/Earn.tsx'),/const version = requestVersion\.current;[\s\S]*const fresh = await readItemFigures\("earn", account\);\s*if \(version !== requestVersion\.current\) return;/,'fresh quote is followed immediately by cancellation check before constructing or sending');
assert.match(rawRead('web/src/Earn.tsx'),/const fresh = await readItemFigures\("earn", account\);\s*if \(version !== requestVersion\.current\) return;[\s\S]*?const amounts = quote\(fresh, amount\);\s*if \(amount > \(fresh\[prefix \+ "\.tokenBalance"\] as bigint\) \|\| amounts\.matched > \(fresh\[prefix \+ "\.quoteBalance"\] as bigint\)\) throw new InputError\("More than your balance\."\);/,'2026-10-16 Claude check: the quote and the balance check come from the fresh read, never from the rendered figures');
assert.match(rawRead('web/src/Earn.tsx'),/\) \{ await refresh\(\); throw new InputError\("The request failed\. Please retry\."\); \}/,'2026-10-16 Claude check: a short allowance found by the fresh read refreshes the figures before the refusal, so the exact Approve button shows again');
// 2026-10-17 audit review: the matched amount the page showed is the accepted quote; a fresh read that differs refreshes and sends nothing.
assert.match(rawRead('web/src/Earn.tsx'),/const amounts = quote\(fresh, amount\);[\s\S]*?if \(kind === "add" && amounts\.matched !== liquidityQuote\?\.matched\) \{ await refresh\(\); throw new InputError\("The request failed\. Please retry\."\); \}[\s\S]*?const spec = itemSend\(/,'2026-10-17 audit review: when the fresh quote differs from the matched amount the page showed, the add refreshes the figures and sends nothing');
// 2026-10-17 pre-launch review: an ITEM send waits for an unresolved earlier transaction; a failed figure read is absent, never zero; actions that need an unreadable figure are off.
assert.match(rawRead('web/src/wallet.tsx'),/if \(item\) \{ const earlier = await itemPending\(\); if \(earlier\) throw new PendingTransaction\(ITEM_PENDING, earlier\); \}/,'2026-10-17 pre-launch review: an ITEM send first settles or refuses on an unresolved earlier transaction (v22 rebase: with the ITEM words and the hash, through the one PendingTransaction class)');
assert.match(rawRead('web/src/wallet.tsx'),/if \(item && sent && !settled\) setUnresolved\(sent\);/,'2026-10-17 pre-launch review: a receipt timeout marks the ITEM send unresolved');
// 2026-10-17 round-2 review: the lock holds for any saved send in the tab (the record's own account is read, both counts guarded); a predicted nonce settles only while nothing is queued; a node-reported nonce settles alone.
assert.match(rawRead('web/src/wallet.tsx'),/async function itemPending\(\): Promise<Hex \| undefined> \{\s*const pending = itemRef\.current;\s*if \(!account \|\| !pending\) \{\s*setUnresolved\(undefined\);\s*return undefined;\s*\}/,'2026-10-17 round-2 review: an unresolved record locks ITEM sends whichever account sent it (round-3 review: the ITEM sends\' own record)');
assert.match(rawRead('web/src/wallet.tsx'),/client\.getTransaction\(\{ hash: pending\.hash \}\)\.catch\(absent\("TransactionNotFoundError"\)\),\s*client\.getTransactionCount\(\{ address: pending\.account, blockTag: "latest" \}\)\.catch\(\(\) => undefined\),\s*client\.getTransactionCount\(\{ address: pending\.account, blockTag: "pending" \}\)\.catch\(\(\) => undefined\),/,'2026-10-17 round-2 review: both counts are read for the record account and a failed read is undefined, never a number (v22 rebase: the transaction lookup lets only viem\'s not-found class through)');
assert.match(rawRead('web/src/wallet.tsx'),/settled = !failed && latest !== undefined && \(transaction !== undefined \? latest > transaction\.nonce : pending\.nonce !== undefined && latest > pending\.nonce && latest === queued\);/,'2026-10-17 round-2 review: a node-reported nonce settles alone; the predicted nonce only while nothing is queued; an undefined count never settles (v22 rebase: nor does a failed lookup)');
// 2026-10-17, v22 rebase (Codex V22-02 for the ITEM lock, at the owner's word): only viem's "not found" answer to a hash lookup counts as absent, told apart by
// its name exactly as v22's sendPending does; any other error of either lookup leaves the check unresolved (no settle, the record and the lock stay) and the
// check never rejects. The vault's own settle (sendPending) is HEAD's, byte for byte, and runs for vault sends only; an ITEM send settles its own record.
{const w=rawRead('web/src/wallet.tsx'),ip=rawFunction(w,'wallet.tsx','itemPending').text,sp=rawFunction(w,'wallet.tsx','send').text;
 assert.match(ip,/let failed = false;\s*const absent = \(name: string\) => \(e: unknown\) => \{\s*if \(\(e as \{ name\?: string \} \| null\)\?\.name === name\) return undefined;\s*failed = true;\s*return undefined;\s*\};\s*let settled = !!\(await client\s*\.getTransactionReceipt\(\{ hash: pending\.hash \}\)\s*\.catch\(absent\("TransactionReceiptNotFoundError"\)\)\);\s*if \(!settled && !failed\) \{/,'v22 rebase: the receipt lookup lets only viem\'s not-found class through; any other error marks the check failed before the nonce reads');
 const count=(re)=>(ip.match(re)??[]).length;
 assert.deepEqual([count(/\.catch\(absent\("TransactionReceiptNotFoundError"\)\)/g),count(/\.catch\(absent\("TransactionNotFoundError"\)\)/g),count(/getTransactionReceipt[\s\S]{0,80}?\.catch\(\(\) => undefined\)/g),count(/getTransaction\(\{ hash: pending\.hash \}\)\.catch\(\(\) => undefined\)/g),count(/const absent = /g),count(/failed = true;/g),count(/!failed/g)],[1,1,0,0,1,1,2],'v22 rebase: each hash lookup catches with its own not-found name once, neither swallows every error, and the failed flag guards both the nonce reads and the settle');
 assert.ok(!/\bthrow\b/.test(ip),'v22 rebase: itemPending never rejects (Refresh and opening Earn never fail on a lookup error)');
 assert.equal(sp.split('      if (s.functionName === "listGenesis") await listingPending();\n      else if (!item) await sendPending(key); // 2026-10-17, v22 rebase: the vault settle, for vault sends; an ITEM send settled its own record above.\n      // SPEC 6: ITEM target code check; the vault path is unchanged.\n      if (item) await checkItemSend(s);\n      else await verifyNetwork();\n').length,2,'v22 rebase: every vault send except genesis listing settles the saved vault transaction first, exactly once, before verifyNetwork; an ITEM send settles its own record and skips the vault settle');
 assert.equal((sp.match(/sendPending\(/g)??[]).length,1,'v22 rebase: one call of the vault settle in send()');
 assert.equal(rawFunction(w,'wallet.tsx','sendPending').text,rawFunction(baseline('web/src/wallet.tsx'),'wallet.tsx','sendPending').text,'v22 rebase: the vault settle sendPending() is HEAD\'s byte for byte');
 assert.ok(!/itemRef|itemPendingKey|itemPending\(/.test(rawFunction(w,'wallet.tsx','sendPending').text),'v22 rebase: the vault settle never touches the ITEM record');
 assert.equal((w.match(/class PendingTransaction extends Error/g)??[]).length,1,'v22 rebase: one PendingTransaction class (HEAD\'s), the ITEM throw passing ITEM_PENDING and the hash');}
// 2026-10-17 round-3 review: ITEM sends keep a saved record of their own (itemRef, key basket-item-pending-4663) that the vault path never writes or clears;
// the vault's slot (pendingRef, key basket-pending-4663) is written and cleared only in the else branches, as at HEAD; a late settle clears only the record it examined.
{const w=rawRead('web/src/wallet.tsx');
 assert.match(w,/const itemPendingKey = "basket-item-pending-4663";\s*function savedItemPending\(\): PendingTx \| undefined \{\s*try \{\s*return \(\s*JSON\.parse\(sessionStorage\.getItem\(itemPendingKey\) \|\| "null"\) \|\| undefined\s*\);\s*\} catch \{\s*return undefined;\s*\}\s*\}/,'2026-10-17 round-3 review: the ITEM record has its own key and reader beside the vault\'s');
 assert.match(w,/const pendingRef = useRef<PendingTx \| undefined>\(savedPending\(\)\);[\s\S]{0,400}?const itemRef = useRef<PendingTx \| undefined>\(savedItemPending\(\)\);/,'2026-10-17 round-3 review: the ITEM record has its own ref, read once at load like the vault\'s');
 assert.match(w,/const \[unresolved, setUnresolved\] = useState<Hex \| undefined>\(itemRef\.current\?\.hash\);/,'2026-10-17 round-3 review: the lock starts from the ITEM record');
 assert.match(w,/const record = \{ hash: tx, account, functionName: s\.functionName, nonce \};\s*(?:\/\/[^\n]*\n\s*)?if \(item\) \{\s*itemRef\.current = record;\s*try \{\s*sessionStorage\.setItem\(itemPendingKey, JSON\.stringify\(record\)\);\s*\} catch \{\s*\/\*[^*]*\*\/\s*\}\s*\} else \{\s*pendingRef\.current = record;\s*try \{\s*sessionStorage\.setItem\(pendingKey, JSON\.stringify\(pendingRef\.current\)\);\s*\} catch \{\s*\/\* nonce guard also protects reloads \*\/\s*\}\s*\}/,'2026-10-17 round-3 review: a sent ITEM transaction is recorded in the ITEM slot and key only; the vault slot and key only in the else branch');
 assert.match(w,/settled = true;\s*if \(item\) \{\s*itemRef\.current = undefined;\s*try \{\s*sessionStorage\.removeItem\(itemPendingKey\);\s*\} catch \{\s*\/\*[^*]*\*\/\s*\}\s*setUnresolved\(undefined\);(?:[ \t]*\/\/[^\n]*)?\s*\} else \{\s*pendingRef\.current = undefined;\s*try \{\s*sessionStorage\.removeItem\(pendingKey\);\s*\} catch \{\s*\/\* storage unavailable \*\/\s*\}\s*\}/,'2026-10-17 round-3 review: the receipt clears the slot and key the send wrote, the ITEM ones inside if (item), the vault ones in the else branch (round-4 review: the ITEM receipt also clears the lock)');
 assert.match(w,/const current = itemRef\.current;\s*if \(settled && \(current === pending \|\| current === undefined\)\) \{\s*itemRef\.current = undefined;\s*try \{\s*sessionStorage\.removeItem\(itemPendingKey\);\s*\} catch \{\s*\/\*[^*]*\*\/\s*\}\s*setUnresolved\(undefined\);\s*return undefined;\s*\}\s*const hash = current\?\.hash;(?:[ \t]*\/\/[^\n]*)?\s*setUnresolved\(hash\);\s*return hash;/,'2026-10-17 round-3 review: a settle clears only the record it examined (or an already empty slot); otherwise the newest record stays unresolved (round-4 review: a record cleared meanwhile leaves the lock off)');
 const count=(re)=>(w.match(re)??[]).length;
 assert.deepEqual([count(/sessionStorage\.setItem\(pendingKey/g),count(/sessionStorage\.removeItem\(pendingKey\)/g),count(/pendingRef\.current = record;/g),count(/pendingRef\.current = \{/g)],[1,4,1,0],'2026-10-17 round-3 review: the vault slot and key are written once and cleared four times, as at HEAD (listingPending twice, v22\'s sendPending once, the receipt once)');
 assert.deepEqual([count(/sessionStorage\.getItem\(itemPendingKey\)/g),count(/sessionStorage\.setItem\(itemPendingKey/g),count(/sessionStorage\.removeItem\(itemPendingKey\)/g),count(/itemRef\.current = record;/g),count(/itemRef\.current = undefined;/g)],[1,1,2,1,2],'2026-10-17 round-3 review: the ITEM key is read once, written once and cleared twice (the receipt, the settle); the ITEM ref is set once and cleared twice');
 // 2026-10-17 round-4 review: the lock is cleared three times (no record, a settle, the ITEM receipt), set once by a receipt timeout and once to the newest record's hash.
 assert.deepEqual([count(/setUnresolved\(undefined\)/g),count(/setUnresolved\(sent\)/g),count(/setUnresolved\(hash\)/g),count(/setUnresolved\(/g)],[3,1,1,5],'2026-10-17 round-4 review: the lock is cleared with no record, at a settle and at the ITEM receipt; set at a receipt timeout and to the newest record only');
 const itemPendingText=rawFunction(w,'wallet.tsx','itemPending').text;
 assert.ok(!/pendingRef|pendingKey/.test(itemPendingText),'2026-10-17 round-3 review: itemPending never touches the vault slot or key');
 for(const name of ['listingPending','waitPending','sendPending'])assert.ok(!/itemRef|itemPendingKey/.test(rawFunction(w,'wallet.tsx',name).text),'2026-10-17 round-3 review: the vault\'s '+name+' never touches the ITEM slot or key');}
assert.match(rawRead('web/src/itemReads.ts'),/if \(!result\.ok\) return \[\];/,'2026-10-17 pre-launch review: a failed read leaves its key absent');
// 2026-10-17 round-4 review: a refresh kept by a send (the afterItem callback) whose page was left or whose account changed touches nothing of
// that page or account: it runs the refresh of the figures on screen instead, so they are read again after the receipt.
{const r=rawRead('web/src/itemReads.ts');
 assert.match(r,/\nlet shownRefresh: \(\(\) => Promise<void>\) \| undefined;\nexport function useItemFigures\(/,'2026-10-17 round-4 review: one module slot holds the refresh of the figures on screen');
 assert.match(r,/const currentScope = view \+ ":" \+ \(account \?\? ""\);\s*const liveScope = useRef<string \| undefined>\(currentScope\);\s*useLayoutEffect\(\(\) => \{ liveScope\.current = currentScope; return \(\) => \{ liveScope\.current = undefined; \}; \}, \[currentScope\]\);\s*const refresh = useCallback\(async \(\): Promise<void> => \{\s*if \(liveScope\.current !== view \+ ":" \+ \(account \?\? ""\)\) return shownRefresh === refresh \? undefined : shownRefresh\?\.\(\);\s*const current = \+\+revision\.current;/,'2026-10-17 round-4 review: an obsolete refresh returns before it touches the revision, loading, failure, figures or scope, running the shown one instead');
 assert.match(r,/\}, \[view, account\]\);\s*useLayoutEffect\(\(\) => \{ shownRefresh = refresh; return \(\) => \{ if \(shownRefresh === refresh\) shownRefresh = undefined; \}; \}, \[refresh\]\);\s*useEffect\(\(\) => \{\s*void refresh\(\);/,'2026-10-17 round-4 review: the slot holds the mounted hook\'s current refresh and is emptied when the page closes');
 assert.equal((r.match(/shownRefresh = /g)??[]).length,2,'2026-10-17 round-4 review: the slot is written only by the mounted hook (set and cleared)');}
assert.match(rawRead('web/src/Earn.tsx'),/const stakeReason = common \|\| \(!startedKnown \|\| !has\("balance", "allowance"\) \|\| \(gauge && !has\("pair"\)\) \? unreadable : /,'2026-10-17 pre-launch review: staking is off while a figure it needs is unreadable');
assert.match(rawRead('web/src/Earn.tsx'),/const withdrawReason = common \|\| \(!has\("staked"\) \? unreadable : /,'2026-10-17 pre-launch review: withdraw is off only while the staked figure is unreadable');
assert.match(rawRead('web/src/Earn.tsx'),/wallet\.busy \|\| pending \|\| wallet\.unresolved \? "Another transaction is pending\./,'2026-10-17 pre-launch review: every ITEM action is off while a sent transaction has no receipt yet');
// 2026-10-16 Earn layout build (option B3): layout and words only. Earn.tsx and styles.css were re-pinned by hand after
// reading their diffs; the two send sinks, the spec line, the cancellation line and the fresh-read block above are unchanged.
// The Pool selector shows one of two mounted pool cards; each card's actions sit in tabs and native disclosures; hidden
// parts carry the hidden attribute (no focus, no tab stop); the only new import is a type.
const earnLayout=rawRead('web/src/Earn.tsx');
assert.ok(earnLayout.startsWith('import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";\n'),'Earn layout build: the React import gains only the KeyboardEvent type');
assert.ok(earnLayout.includes('<div className="refined-pool-picker"><label htmlFor="earn-pool-select">Pool</label><select id="earn-pool-select" value={selectedPool} onChange={event => setSelectedPool(event.target.value as "bask" | "eth")}><option value="bask">BASK/USDG</option><option value="eth">ITEM/ETH</option></select></div>'),'Earn layout build: the exact Pool selector');
assert.ok(earnLayout.includes('<div data-pool-view="bask" hidden={selectedPool !== "bask"}><StakeCard key={"bask-" + wallet.account} prefix="bask" figures={data.figures} wallet={wallet} refresh={data.refresh} /></div><div data-pool-view="eth" hidden={selectedPool !== "eth"}><StakeCard key={"eth-" + wallet.account} prefix="eth" figures={data.figures} wallet={wallet} refresh={data.refresh} /></div>'),'Earn layout build: both pool cards stay mounted and the unselected one carries hidden');
assert.ok(earnLayout.includes('<div className="docs-tabs refined-tabs" role="tablist" aria-label={title}>'),'Earn layout build: one tablist per card, named by the card title');
assert.equal((earnLayout.match(/role="tabpanel"/g)??[]).length,4,'Earn layout build: four tab panels');
assert.equal(earnLayout.split('id={prefix + "-panel-0"} role="tabpanel" aria-labelledby={prefix + "-tab-0"} hidden={tab !== 0}').length,2,'Earn layout build: the first panel is labelled by tab 0 and hidden unless tab 0 is selected');
for(const tabName of ['stakeTab','manageTab','statsTab'])assert.equal(earnLayout.split('id={prefix + "-panel-" + '+tabName+'} role="tabpanel" aria-labelledby={prefix + "-tab-" + '+tabName+'} hidden={tab !== '+tabName+'}').length,2,'Earn layout build: the '+tabName+' panel is labelled by its own tab and hidden unless that tab is selected');
assert.ok(earnLayout.includes('onKeyDown={moveTab}')&&earnLayout.includes('tabIndex={tab === index ? 0 : -1}')&&earnLayout.includes('aria-selected={tab === index}')&&earnLayout.includes('aria-controls={prefix + "-panel-" + index}'),'Earn layout build: roving tabindex, aria-selected and aria-controls on every tab');
assert.equal((earnLayout.match(/<details className="refined-(?:details|withdraw)">/g)??[]).length,2,'Earn layout build: the Details and the withdraw disclosures are native details elements');
assert.match(rawRead('web/src/itemReads.ts'),/if \(!itemReady\(config\)\) return null;[\s\S]*const \[results, native\] = await Promise\.all\(\[reader\(specs\.map\(\(\[, spec\]\) => spec\)\), account \? balanceReader\(account\)\.catch\(\(\) => undefined\) : undefined\]\);/,'2026-10-16 Add liquidity build: all-slot guard precedes the one contract/native read batch');
assert.match(rawRead('web/src/itemReads.ts'),/balanceReader: \(account: Address\) => Promise<bigint> = account => client\.getBalance\(\{ address: account \}\)/,'the sole new RPC is eth_getBalance through the existing client for the connected account');
assert.equal((rawRead('web/src/itemReads.ts').match(/client\.getBalance\(/g)??[]).length,1,'one native balance read implementation');
const walletValueLine='...(s.value !== undefined ? { value: `0x${s.value.toString(16)}` } : {}), // 2026-10-16, Add liquidity build: ITEM-only ETH value.';
const simulationValueLine='...(s.value !== undefined ? { value: s.value } : {}), // 2026-10-16, Add liquidity build: simulate the exact ETH value.';
assert.equal(rawFunction(rawRead('web/src/wallet.tsx'),'wallet.tsx','send').text.split(walletValueLine).length,2,'one exact optional-value wallet line');
const rawSimulate=rawFunction(rawRead('web/src/chain.ts'),'chain.ts','simulate').text;
assert.equal(rawSimulate.split(simulationValueLine).length,2,'one exact optional-value simulation line');
assert.match(rawSimulate,/if \(s\.itemUser !== undefined && s\.itemUser\.toLowerCase\(\) !== account\?\.toLowerCase\(\)\) throw new InputError\("The wallet account changed\. Please retry\."\);/,'router recipient is the account simulated by the guarded wallet flow');
assert.match(rawRead('web/src/chain.ts'),/\} & \(\{ itemAction\?: never; value\?: never; itemUser\?: never \} \| \{ itemAction: string; value\?: bigint; itemUser\?: Address \}\);/,'native value and recipient are excluded at type level from non-ITEM specs');
assert.match(rawRead('web/src/tokenomicsData.ts'),/ITEM: itemReady\(LAUNCH\) \? LAUNCH\.ITEM : null/,'Tokenomics is behind the same all-slot guard');
fs.mkdirSync(scratch,{recursive:true});
const itemEntry=path.join(scratch,'item-entry.ts'),itemBundle=path.join(scratch,'item.mjs');
fs.writeFileSync(itemEntry,`export * from ${JSON.stringify(path.join(root,'web/src/itemConstants').replaceAll('\\','/'))};\nexport * from ${JSON.stringify(path.join(root,'web/src/itemActions').replaceAll('\\','/'))};\nexport * from ${JSON.stringify(path.join(root,'web/src/itemReads').replaceAll('\\','/'))};\nexport { ADDRESSES } from ${JSON.stringify(path.join(root,'web/src/tokenomicsData').replaceAll('\\','/'))};\nexport { RUNTIME_HASH } from ${JSON.stringify(path.join(root,'web/src/deployment').replaceAll('\\','/'))};\n`);
await build({entryPoints:[itemEntry],bundle:true,format:'esm',platform:'node',outfile:itemBundle,nodePaths:[path.resolve('node_modules')],logLevel:'error'});
const item=await import(pathToFileURL(itemBundle).href);
const fixture=Object.fromEntries(LAUNCH_ADDRESSES.map((key,i)=>[key,getAddress('0x'+BigInt(0x100+i).toString(16).padStart(40,'0'))]));
for(const [i,key] of LAUNCH_HASHES.entries())fixture[key]='0x'+BigInt(i+1).toString(16).padStart(64,'0');
fixture.ITEM_REPO='https://github.com/example/item';fixture.ITEM_COMMIT='a'.repeat(40);
const user=getAddress('0x'+BigInt(0xa11ce).toString(16).padStart(40,'0'));
assert.equal(item.itemReady(fixture),true,'complete launch config is ready');
// 2026-10-16 Add liquidity build: the twelve existing actions keep their order, followed by exactly five form actions.
const expectedActions=['baskApprove','baskStake','baskWithdraw','baskClaim','ethApprove','ethStake','ethWithdraw','ethClaim','itemApprove','itemStake','itemUnstake','claimBask','baskLiquidityApprove','usdgLiquidityApprove','baskAddLiquidity','itemLiquidityApprove','ethAddLiquidity'];
assert.deepEqual(item.ITEM_ACTIONS,expectedActions,'exactly seventeen ITEM actions; staking claims BASK only');
const liquidityActions=['baskAddLiquidity','ethAddLiquidity'];
const itemClock=1791000000000,itemDeadline=1791000600n;
// 2026-10-16 Claude check: the fixture's matched amount differs from the typed amount, so swapped minimums or a value
// that is not the matched ETH are caught by the exact argument and value comparisons below, not only by check-item.ts.
const liquidityFor=amount=>{const matched=amount/2n+7n;return {user,matched,minimumA:amount*995n/1000n,minimumB:matched*995n/1000n,deadline:itemDeadline};};
let nullCases=0,nullActionCases=0;
for(const key of LAUNCH_KEYS){
 const config={...fixture,[key]:null};let calls=0;
 assert.equal(item.itemReady(config),false,key+': any null slot disables ITEM');
 for(const view of ['earn'])assert.equal(await item.readItemFigures(view,user,config,async()=>{calls++;throw Error('null guard reached chain');},async()=>{calls++;throw Error('null guard reached native balance');}),null,key+': null reads are unreachable');
 assert.equal(calls,0,key+': zero ITEM contract or native-balance reader calls');
 for(const action of expectedActions){assert.throws(()=>item.itemSend(action,1000n,config,liquidityFor(1000n)),/ITEM figures: unreadable/,key+': '+action+' refuses a null slot');nullActionCases++;}nullCases++;
}
if(!LAUNCH_KEYS.every(key=>itemLaunch.slots[key]!==null))assert.ok(Object.values(item.ADDRESSES).every(x=>x===null),'any incomplete launch disables every Tokenomics address');
const expectedCall=(action,amount,liquidity)=>({
 baskApprove:[item.KNOWN.BASK_USDG_PAIR,'approve',[fixture.BASK_USDG_GAUGE,amount],'BASK_USDG_PAIR_HASH'],
 baskStake:[fixture.BASK_USDG_GAUGE,'stake',[amount],'BASK_USDG_GAUGE_HASH'],
 baskWithdraw:[fixture.BASK_USDG_GAUGE,'withdraw',[amount],'BASK_USDG_GAUGE_HASH'],
 baskClaim:[fixture.BASK_USDG_GAUGE,'claim',[],'BASK_USDG_GAUGE_HASH'],
 ethApprove:[fixture.ITEM_WETH_PAIR,'approve',[fixture.ITEM_ETH_GAUGE,amount],'ITEM_WETH_PAIR_HASH'],
 ethStake:[fixture.ITEM_ETH_GAUGE,'stake',[amount],'ITEM_ETH_GAUGE_HASH'],
 ethWithdraw:[fixture.ITEM_ETH_GAUGE,'withdraw',[amount],'ITEM_ETH_GAUGE_HASH'],
 ethClaim:[fixture.ITEM_ETH_GAUGE,'claim',[],'ITEM_ETH_GAUGE_HASH'],
 itemApprove:[fixture.ITEM,'approve',[fixture.ITEM_STAKING,amount],'ITEM_HASH'],
 itemStake:[fixture.ITEM_STAKING,'stake',[amount],'ITEM_STAKING_HASH'],
 itemUnstake:[fixture.ITEM_STAKING,'unstake',[amount],'ITEM_STAKING_HASH'],
 claimBask:[fixture.ITEM_STAKING,'claim',[item.KNOWN.BASK],'ITEM_STAKING_HASH'],
 baskLiquidityApprove:[item.KNOWN.BASK,'approve',[item.KNOWN.V2_ROUTER,amount],'RUNTIME_HASH'],
 usdgLiquidityApprove:[item.KNOWN.USDG,'approve',[item.KNOWN.V2_ROUTER,amount],'USDG_HASH'],
 baskAddLiquidity:[item.KNOWN.V2_ROUTER,'addLiquidity',[item.KNOWN.BASK,item.KNOWN.USDG,amount,liquidity.matched,liquidity.minimumA,liquidity.minimumB,liquidity.user,liquidity.deadline],'V2_ROUTER_HASH'],
 itemLiquidityApprove:[fixture.ITEM,'approve',[item.KNOWN.V2_ROUTER,amount],'ITEM_HASH'],
 ethAddLiquidity:[item.KNOWN.V2_ROUTER,'addLiquidityETH',[fixture.ITEM,amount,liquidity.minimumA,liquidity.minimumB,liquidity.user,liquidity.deadline],'V2_ROUTER_HASH',liquidity.matched],
}[action]);
let itemEncodingCases=0;
Date.now=()=>itemClock;
try{
 for(const originalAmount of [1n,1234567890123456789n,2n**255n])for(const action of expectedActions){
  // Keep all 36 old encoding cases. An add with a one-wei input has a zero minimum and must refuse;
  // its smallest encoding case therefore uses 1000 wei, with the one-wei refusal tested below.
  const amount=liquidityActions.includes(action)&&originalAmount===1n?1000n:originalAmount,liquidity=liquidityFor(amount);
  const spec=item.itemSend(action,amount,fixture,liquidityActions.includes(action)?liquidity:undefined),[address,functionName,args,hashKey,value]=expectedCall(action,amount,liquidity);
  const hash=fixture[hashKey]??item.KNOWN[hashKey]??item[hashKey];
  assert.ok(hash,action+': expected runtime hash exists');
  assert.deepEqual([spec.address,spec.functionName,spec.args,spec.itemHash,spec.value],[address,functionName,args,hash,value],action+': exact target, call, arguments, target hash and ETH value');
  assert.equal(Object.hasOwn(spec,'value'),action==='ethAddLiquidity',action+': value property only on ETH add');
  assert.equal(spec.itemUser,liquidityActions.includes(action)?user:undefined,action+': recipient bound only for router adds');
  const types=functionName==='approve'?['address','uint256']:functionName==='claim'?(args.length?['address']:[]):functionName==='addLiquidity'?['address','address','uint256','uint256','uint256','uint256','address','uint256']:functionName==='addLiquidityETH'?['address','uint256','uint256','uint256','address','uint256']:['uint256'];
  const expected=encodeFunctionData({abi:[{type:'function',name:functionName,inputs:types.map((type,i)=>({name:'arg'+i,type})),outputs:[],stateMutability:action==='ethAddLiquidity'?'payable':'nonpayable'}],functionName,args});
  assert.equal(encodeFunctionData(spec),expected,action+': independent exact calldata encoding');itemEncodingCases++;
 }
 assert.equal(itemEncodingCases,51,'seventeen actions times three independent encodings');
 for(const action of ['sync','start','fund','release','approveUnlimited','claimUsdg','claimWeth','removeLiquidity','swapExactTokensForTokens'])assert.throws(()=>item.itemSend(action,1000n,fixture),'no unapproved ITEM send '+action);
 for(const action of ['baskApprove','baskStake','baskWithdraw','ethApprove','ethStake','ethWithdraw','itemApprove','itemStake','itemUnstake','baskLiquidityApprove','usdgLiquidityApprove','baskAddLiquidity','itemLiquidityApprove','ethAddLiquidity'])for(const amount of [undefined,0n,-1n,2n**256n])assert.throws(()=>item.itemSend(action,amount,fixture,liquidityActions.includes(action)?liquidityFor(1000n):undefined),action+': amount bounds');
 for(const action of liquidityActions){
  assert.throws(()=>item.itemSend(action,1n,fixture,liquidityFor(1n)),action+': one-wei add refuses zero minimums');
  assert.throws(()=>item.itemSend(action,1000n,fixture),action+': add requires explicit liquidity terms');
  for(const change of [{minimumA:0n},{minimumB:0n},{minimumA:994n},{minimumB:996n},{matched:0n},{matched:-1n},{matched:2n**256n},{user:'0x'+'0'.repeat(40)},{deadline:itemDeadline+1n},{deadline:itemDeadline+31536000n},{deadline:BigInt(itemClock/1000)-1n}])assert.throws(()=>item.itemSend(action,1000n,fixture,{...liquidityFor(1000n),...change}),action+': malformed, zero-minimum, wrong-ratio or deadline terms refused');
 }
}finally{Date.now=clock;}
// Independent ordered read specifications: argument shapes, targets and count are all compared.
const readShape=s=>[s.address,s.functionName,s.args??[]];
const expectedReads=(view,account)=>{
 const out=[],add=(a,f,args=[])=>out.push([a,f,args]);
 for(const [gauge,pair] of [[fixture.BASK_USDG_GAUGE,item.KNOWN.BASK_USDG_PAIR],[fixture.ITEM_ETH_GAUGE,fixture.ITEM_WETH_PAIR]]){
  for(const fn of ['started','pair','totalStaked','released','remaining','rate'])add(gauge,fn);
  if(view==='earn'&&account){for(const fn of ['staked','earned'])add(gauge,fn,[account]);add(pair,'balanceOf',[account]);add(pair,'allowance',[account,gauge]);}
  for(const fn of ['getReserves','token0','totalSupply'])add(pair,fn);
 }
 add(fixture.ITEM_STAKING,'totalStaked');
 add(item.KNOWN.BASK,'balanceOf',[fixture.ITEM_STAKING]);
 if(view==='earn'&&account){add(fixture.ITEM_STAKING,'staked',[account]);add(fixture.ITEM,'balanceOf',[account]);add(fixture.ITEM,'allowance',[account,fixture.ITEM_STAKING]);add(fixture.ITEM_STAKING,'earned',[account,item.KNOWN.BASK]);}
 // ITEM's wallet balance is already read for staking above; the form reuses that same result.
 if(view==='earn'&&account)for(const token of [item.KNOWN.BASK,item.KNOWN.USDG,fixture.ITEM]){if(token!==fixture.ITEM)add(token,'balanceOf',[account]);add(token,'allowance',[account,item.KNOWN.V2_ROUTER]);}
 return out;
};
const itemReads=[];
for(const view of ['earn'])for(const account of [undefined,user]){
 let calls=0,nativeCalls=0,list;
 await item.readItemFigures(view,account,fixture,async specs=>{calls++;list=specs;return specs.map(s=>({ok:true,value:['started','funded'].includes(s.functionName)?false:s.functionName==='pair'?fixture.ITEM_WETH_PAIR:s.functionName==='token0'?(s.address===item.KNOWN.BASK_USDG_PAIR?item.KNOWN.BASK:fixture.ITEM):s.functionName==='getReserves'?[1000n,2000n,0]:0n}));},async address=>{nativeCalls++;assert.equal(address,user,'native balance is the connected account');return 1234n;});
 assert.equal(calls,1,'one batched ITEM read per explicit page refresh');assert.deepEqual(list.map(readShape),expectedReads(view,account),view+': exact permitted ordered reads');
 assert.equal(nativeCalls,account?1:0,'eth_getBalance only for the connected account in the same refresh');
 assert.equal(list.length,account?37:20,'exact contract read count including liquidity and fee-pot reads');
 itemReads.push({view,account:!!account,reads:list.length,nativeBalanceReads:nativeCalls});
}
console.log('PASS ITEM gate',expectedActions.length,'actions;',itemEncodingCases,'exact encodings;',nullCases,'independent null-slot guards;',nullActionCases,'null-action refusals; raw source pins and read allowlists');

// The report. The delivery is close to its size limit, so each piece is recorded by length and SHA-256, not repeated.
const pieceRecord=([v12,head])=>({v12:{length:v12.length,sha256:sha256(v12)},head:{length:head.length,sha256:sha256(head)}});
const brief=x=>x.length>120?{start:x.slice(0,80),length:x.length,sha256:sha256(x)}:x;
fs.writeFileSync('../artifacts/calldata-comparison.json',JSON.stringify({result:'PASS',v25:{base:V25_BASE,restoredBeforeInheritedChecks:['Vault.tsx','styles.css'],newSources:V25_NEW_SOURCES,independentRawSourcePins:V25_PINS,endpoint:V25_ENDPOINT},item:{mode:process.env.BASKET_ITEM_FINAL==='1'?'final':'null-or-filled',actions:expectedActions,encodingCases:itemEncodingCases,nullSlotCases:nullCases,nullActionCases,reads:itemReads,nativeRpcMethods:itemMethodsAdded,vaultNoValueBuilders,safety:itemSafety,independentRawSourcePins:ITEM_REVIEWED_PINS,legacyNormalization:'Exact approved pieces restored to base before unchanged legacy assertions'},baseline:git(['rev-parse','HEAD']).trim(),protectedFiles,editedFiles:Object.fromEntries(Object.entries(editedFiles).map(([f,x])=>[f,x.length+' documented pieces [v12, HEAD]'])),v12Pieces:Object.fromEntries(Object.entries(editedFiles).map(([f,x])=>[f,x.map(pieceRecord)])),counts,
 documentedGuardedCallChanges:expected,documentedAttributeChanges:Object.fromEntries(Object.entries(attributeChanges).map(([f,a])=>[f,{removed:a.removed.map(x=>'<'+x[0]+'> '+x[1]),added:a.added.map(x=>'<'+x[0]+'> '+x[1]),why:'each has its why in scripts/check-calldata.mjs'}])),
 documentedCallChanges:Object.fromEntries(Object.entries(callChanges).map(([f,c])=>[f,{why:c.why,piecesPutBackInsideCalls:c.pieces.map(pieceRecord),removed:c.removed.map(brief),newUsesOfWatchedNames:c.uses.map(([x,where])=>[brief(x),where])}])),
 vaultStockShelves:{attributes:vaultAttributes,handlers:vaultHandlers},pinnedFunctions,walletHookReturn:{equalToHead:true,text:HOOK_RETURN_HEAD},
 walletAndRpcMethods:{named:methods,addedInV19:methodsAdded},browserStorageAddedInV12:storageAdded,namesAddedAtTheTopOfAFile:namesAdded,moduleDeclarationChanges:moduleChanges,namesAddedInsideComponents:newNames,transactionCode,reviewedAddedCalls:addedCallPins,reviewedSourcePins,transactionStateWrites,protectedCode,
 differentialEncoding:{cases:cases.length,...tally},sendBuilders:{clocks,...sends},pinnedDeclarations:pinned,
 sendsAndRequests:{sendFreeFiles:NO_SEND,usesPerFile:Object.fromEntries(Object.entries(sendUses).map(([f,x])=>[f,x.length])),components:sendUses['components.tsx'].filter(x=>/\(/.test(x)),addedInV19:sendAdded},
 pageLoads:{names:[...LOADS],jsxAttributes:[...LOAD_ATTRIBUTES],usesPerFile:loadUses,equalToHeadExceptDisplayNames:{added:loadDisplayAdded,removed:loadDisplayRemoved}},
 pinnedV9Declarations:Object.fromEntries(Object.entries(pinnedV9).map(([f,m])=>[f,Object.fromEntries(Object.entries(m).map(([k,x])=>[k,typeof x==='string'?'v9 text (also at HEAD)':'equal to HEAD ('+x.length+' pieces)']))])),importBindings:imports,
 checks:[
  'v12 source scope: every other TypeScript source and ABI equal HEAD; edited sources equal HEAD once their exact pieces are restored, and also match independent reviewed SHA-256 pins outside regeneration blocks',
  'Every guarded reading, parsing, encoding, simulation, sending and provider call equals HEAD in order and place; no added chain read, wallet request, storage key or network call',
  'Action attributes equal HEAD except the documented approved presentation changes with a written reason; every onSubmit, getSpec, build and claim attribute equals HEAD',
  'Every removed call and added watched-name use is independently listed; complete ordered added calls match reviewed hashes and ordered callee lists outside regeneration blocks',
  'Direct and aliased transaction-state writes equal HEAD; send-tail receipt-hash writes are individually pinned with their ordered statements',
  'Wallet send head is byte-identical to HEAD through the receipt wait; its tail equals HEAD after exact receipt-hash replacements; connect and disconnect equal reviewed text and the new counter is used only at the pinned sites',
  'All protected wallet functions, flow effects, transaction buttons and handlers are byte-identical to HEAD; declaration and wrapper-scope checks prevent name rebinding',
  'Provider methods and uses, browser storage and network sinks equal HEAD; page loads equal HEAD; Disconnect makes no request; components retains the same single wallet.send',
  'The differential encoding corpus, six-clock send builders, parser declarations, pinned v9 decisions and imported bindings retain every prior assertion',
  'Only approved v12 source files change; shell and share-card bytes are separately pinned by check-bundle.mjs',
  'v25: Vault.tsx and styles.css equal the live v24 text once their five pieces and the appended stats block are put back; the two new stats sources are pinned by independent digests, import only React and each other, add one credential-free GET of the public stats report as the only new network use, rebuild the report from an allowlist and keep only explorer transaction links'
 ]},null,2)+'\n');
console.log('PASS baseline call-expression comparison',counts,'differential encoding',tally,'send builders',sends);

# Basket Protocol website

Static React + TypeScript website for **vault 6**, BaskVault [`0x739fd5b653aa092a434534fa1ade67c1770b5a5b`](https://robin.etherscan.io/address/0x739fd5b653aa092a434534fa1ade67c1770b5a5b), on Robinhood Chain (4663). The site title is Basket Protocol; the share is Basket (BASK). Hosting remains `basket-protocol.site.identitymd.eth`.

The website follows [launch-1110-basket at `50acd7248c2ce59907a963a648115900d629f352`](https://github.com/identity-md-launches/launch-1110-basket/tree/50acd7248c2ce59907a963a648115900d629f352). Its six Solidity source files (`BaskVault.sol` and the `BoundedCall`, `FullMath`, `NewYorkTime`, `PoolOracle` and `TickMath` libraries), upstream README, compiler settings, LICENSE and THIRD_PARTY notice are preserved in `web/pinned/`. Historical root contracts, tests and Foundry configuration are unchanged and are **not** used to generate this website's ABI. This task neither changes nor deploys a live contract. Earlier vaults are abandoned and appear in no page, source, artifact or export file.

## Install, preview and rebuild

Use Node.js 22.12 or later and npm. Dependency versions and the lockfile in `web/` are unchanged.

```sh
cd web
npm ci
npm run typecheck
npm run build
npm run preview
```

The build writes `dist/` at the repository root. `vite.config.ts` sets `base: './'`. All fonts, images, styles and scripts are local. Pages use hash navigation: Vault, Deposit, Redeem and Docs, with Owner controls and Losses in the footer. No rewrite server, backend, secret or private key is required. A browser wallet is required to send.

## Publish

Publish the **contents of the committed `dist/` directory** to the existing static host or IPFS deployment for `basket-protocol.site.identitymd.eth`. Keep `index.html` with its `assets/`, `art/` (including the food MIT license), fonts/license files and favicon. Test the export at a subpath such as `/preview/`; do not publish `web/`, package caches or test fixtures. The publisher serves the export without rebuilding. This assignment prepares the export and does not publish it.

## Integration

- Vault reads and simulations use 30,000,000 gas. Asset metadata is batched through Multicall3 only after checking its deployment. Heavy aggregate reads remain independent.
- Every send checks wallet account, chain 4663, public RPC chain and vault runtime hash, then simulates. Chain and account are checked again before requesting the transaction. Deposit, redemption and claim use estimated gas increased by 30%.
- `allAssets()` supplies `managedBalance`, `owedBalance`, `balanceReadable`, `shortfall` (short means shortfall above zero), prices, price reasons and pool prices. Failed aggregate reads fall back to `assetTokens()` and `asset(token)` per stock; pool checks and reasons remain unreadable. One `depositStatus([])` supplies the global status, and the latest block timestamp is read with every snapshot because the vault's hours and freshness use block time.
- Deposit hours are seconds since Sunday 00:00 New York time (`hoursFrom` inclusive, `hoursTo` exclusive; both zero means always open), with the `dst` setting choosing the US daylight saving rule, never daylight saving (UTC-5) or always daylight saving (UTC-4). `web/src/newYork.ts` ports `NewYorkTime.sol`; the deposit status says when deposits reopen (reason 3) or that they wait for a price update (reason 14), computed from `settings()` and the latest block, never the browser time zone.
- Deposits use token/amount arrays, exact short approvals, wallet receiver, 0.5% minimum-share tolerance and a ten-minute deadline. The contract preview checks the size limit. Successful deposits clear inputs and the old preview.
- Redemption refreshes its preview immediately before sending, uses a selected nonzero receiver other than the vault, and 0.1% minimum amounts in current `assetTokens` order. Unsent stocks are owed to that receiver. Claims read every listed token and send groups of at most ten; one failing stock reverts its whole batch, nothing is lost, and each stock has its own Claim button.
- Genesis listings use `listGenesis`, show each row as it is checked, preserve row order and re-read each listing after confirmation. Whether a token is listed comes from `assetTokens()` because `asset()` reverts for unlisted tokens. A set pool requires a `minLiquidity` above zero. Current `poolWindow` pool liquidity and pool/feed gap are checked before listing; failed or marked rows need correction. A declined prompt can resume after checks. Submitted hashes survive receipt timeouts in session storage; listing compares pending/latest nonces after reload and prefers the node's record of the saved transaction's nonce over the count saved before the prompt.
- The only browser storage is per-tab listing text and pending transaction recovery; there are no cookies, trackers or new services.
- Governance sends `propose(Action)` with the `BaskVault.Action` struct (kind, token, target, pool, quoteFeed, value, value2, setting), fields per kind as in the pinned source and unused fields zero. Proposals wait two days and are executable until nine days after creation (exclusive); the Proposed event's `executableAt` is shown after sending. Settings are in vault 6 order with `Dst` at index 6. The UI additionally requires deposits paused to execute Retire and Resync, and to propose Resync.

## Reproduce ABI and runtime

```sh
cd web
SOLC=/path/to/solc-0.8.26 npx tsx scripts/regenerate-abi.ts
npm run validate
node scripts/check-preservation.mjs
```

Compilation uses solc 0.8.26+commit.8a97fa7a via `--standard-json`, optimizer 200 runs, IR, Cancun, and metadata bytecode hash `none`, matching `web/pinned/foundry.toml`. Vault 6 has no immutables; the generator throws if the compiler reports any immutable reference, and never hand-edits its outputs.

- Runtime: `0x636a9477cd2d80694d0c8cc970f5008edb87d71a11b10ccfa82d9db04090a048`
- Canonical sorted-key ABI hash: `0x47d59929b6c6dd2b66c9d85d22a70b349f0c70496f2e2d06bc35369baa2d3eca`
- Runtime size: 23,913 bytes.

## Validation

`npm run validate` checks decimal-normalized NAV, indicative flags, all eleven proposal kinds as the Action struct (including Hours and Dst), minimums, receivers, listing input, revert wording, live aggregate reads and bytecode identity. `check-interface.ts` adds the New York hours parser, the `NewYorkTime` port's inside/nextOpening vectors for all three `dst` modes, setting words and the pool `minLiquidity` rule. `check-preservation.mjs` checks unchanged protected configuration/contracts, forbids every abandoned vault address fragment in every file and keeps the send-check invariants. `check-calldata.mjs` keeps `Losses.tsx`, `main.tsx`, `components.tsx` and `Scenery.tsx` byte-identical to HEAD and compares every call expression of `Flows.tsx` and `Vault.tsx` with HEAD.

The bounded browser/fork runner covers a 25-row listing with a declined prompt, receipt timeout, pending nonce and reload, a US market holiday (every feed three hours old) and a Saturday, the Hours and Dst proposals and every transaction control. It requires Anvil, solc 0.8.26, Playwright and Chromium (WebKit for `check-art.mjs`). The runner requires an unfinalized empty genesis state so that it can exercise initial listing. Install Playwright outside the repository if necessary, and set `PLAYWRIGHT_MODULE` to its `index.mjs` when it is not at the runner's environment default; `BASKET_RPC` selects the upstream RPC.

```sh
cd web
export SOLC=/path/to/solc-0.8.26
export PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs
npx tsx scripts/run-browser.mjs
node scripts/inspect-export.mjs
node scripts/check-guards.mjs
npx tsx scripts/check-interface.ts
node scripts/check-motion.mjs
node scripts/check-art.mjs
node scripts/check-fixes.mjs
node scripts/check-calldata.mjs
node scripts/check-bundle.mjs
```

It pins a fresh block after 83,448,310 (or `BASKET_FORK_BLOCK`), caches the needed genuine account/storage (vault 6 layout: words 0-41, the tokens array, the address and proposal mappings) and next 512 block-history ring reads before public RPC pruning, preserves the actual vault bytecode, creates disposable Stock Token/feed/pool fixtures on the fork (feeds have a settable lag), serves the actual production export at `/preview/`, exercises wallet actions and writes screenshots and decoded sends to `artifacts/`. Before each deposit it warps to the next opening when the fork is outside the hours and checks `insideHours()` on both sides of the boundary. All child services close when the command ends.

Actual results, design review coverage, screenshots and limitations are recorded in [artifacts/validation.md](artifacts/validation.md). The 2026-10-09 vault 6 production build, typecheck, live/ABI, guard, export, motion and fix checks and the fork walk-through passed (61 checks, 70 wallet sends). The 24 empty/25-stock screenshots cover all six pages at 1440 and 375px. WebKit was unavailable for `check-art.mjs`, so its manifest hash part was repeated separately and its WebKit render part is recorded as unperformed; the art files are unchanged. Native Windows display scaling and physical phones remain unverified. Fork evidence is local testing, not an independent certification or a live transaction.

Fonts are Anton and VT323 under the SIL Open Font License; notices are in `web/public/fonts/`. Art is original SVG/CSS plus the manifest files kept byte for byte: the owner’s character (the only person on the site) and Microsoft Fluent Emoji food (MIT). `artifacts/art-manifest.json` pins all 37 assets; the food license is `web/public/art/food/Fluent-Emoji-MIT.txt`. There are no borrowed characters. Decorative artwork carries no numbers, currency signs or real brand names; the project’s BASKET PROTOCOL name badge is allowed. The pinned Better Interface and Impeccable attribution and licenses are retained in `web/validation/DESIGN-GUIDANCE-LICENSE`.

The slogan strip always runs, with no pause control, except when the visitor requests reduced motion. Local art is loaded through relative image URLs; the shipped export makes no outside requests except chain RPC reads. The two food shelves and all three picture frames are documented in [DESIGN.md](DESIGN.md).

To compare phone visibility to a saved previous export, run `BASKET_BASELINE_DIST=/absolute/path/to/previous/dist node scripts/check-visibility.mjs` from `web/`. It checks six routes at 375×812, both without a wallet and with a read-only injected connection to the live owner.

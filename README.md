# Basket Protocol website

Static React + TypeScript website for **vault 5**, BaskVault [`0x4e19d7472e650399b06eeaa5ccc29da9b8efbebd`](https://robin.etherscan.io/address/0x4e19d7472e650399b06eeaa5ccc29da9b8efbebd), on Robinhood Chain (4663). The site title is Basket Protocol; the share is Basket (BASK). Hosting remains `basket-protocol.site.identitymd.eth`.

The website follows [launch-1020-basket at `0a88bde525aed4557b375cf60ee503d707570ac0`](https://github.com/identity-md-launches/launch-1020-basket/tree/0a88bde525aed4557b375cf60ee503d707570ac0). All five Solidity source files, upstream README, compiler settings and math licenses are preserved in `web/pinned/`. Historical root contracts, tests and Foundry configuration are unchanged and are **not** used to generate this website's ABI. This task neither changes nor deploys a live contract.

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

If the workspace disallows dependency installation there, copy `web/` into a disposable directory, run the same commands, and copy the resulting `dist/` back. This delivery used `/tmp/basket-task/web` and an npm cache under `/tmp`; no dependency or cache directory belongs in the submission.

## Publish

Publish the **contents of the committed `dist/` directory** to the existing static host or IPFS deployment for `basket-protocol.site.identitymd.eth`. Keep `index.html` with its `assets/`, fonts/license files and favicon. Test the export at a subpath such as `/preview/`; do not publish `web/`, package caches or test fixtures. The publisher serves the export without rebuilding. This assignment prepares the export and does not publish it.

## Integration

- Vault reads and simulations use 30,000,000 gas. Asset metadata is batched through Multicall3 only after checking its deployment. Heavy aggregate reads remain independent.
- Every send checks wallet account, chain 4663, public RPC chain and vault runtime hash, then simulates. Chain and account are checked again before requesting the transaction. Redemption and claim use estimated gas increased by 30%.
- `allAssets()` supplies normalized NAV, price reasons and pool prices. Failed aggregate reads fall back to each stock individually; pool checks and reasons remain unreadable. One `depositStatus([])` supplies global status. Hours and other settings come from `settings()`.
- Deposits use token/amount arrays, exact short approvals, wallet receiver, 0.5% minimum-share tolerance and a ten-minute deadline. The contract preview checks the size limit. Successful deposits clear inputs and the old preview.
- Redemption refreshes its preview immediately before sending, uses a selected nonzero receiver other than the vault, and 0.1% minimum amounts in current `assetTokens` order. Unsent stocks are owed to that receiver. Claims read every listed token and send groups of at most ten.
- Genesis listings show each row as it is checked, preserve row order, and re-read each listing after confirmation. Already-listed rows are skipped only when feed, pool, quoteFeed and minLiquidity match. Current 30-minute pool liquidity and pool/feed gap are checked before listing; failed or marked rows need correction. A declined prompt can resume after checks. Submitted hashes survive receipt timeouts in session storage; listing also compares pending/latest nonces after reload. Stock feed pairings are marked `check this pairing`; quote labels are shown without pairing marks and quote feeds may repeat.
- The only browser storage is per-tab listing text and pending transaction recovery; there are no cookies, trackers or new services.
- Governance encodings, enums, fields, errors and events come from the pinned source. Owner proposals wait two days; execution is owner-only within seven days. The UI additionally requires deposits paused to execute Retire and Resync, and to propose Resync.

## Reproduce ABI and runtime

```sh
cd web
SOLC=/path/to/solc-0.8.26 npx tsx scripts/regenerate-abi.ts
npm run validate
node scripts/check-preservation.mjs
```

Compilation uses optimizer 200 runs, IR, Cancun, and metadata bytecode hash `none`, matching `web/pinned/foundry.toml`. The generator fills every `transferTopic` immutable reference with the standard Transfer event topic before hashing runtime code.

- Runtime: `0x0419f8e9496a55eaafb9b3fa203d459cc7f82fdac17359c11f51c2e59a5f64fe`
- Canonical sorted-key ABI hash: `0x2ca94bfa453d0916a493f52ad214ffbc92948b7535854c9447810fbca2ff0b25`
- Runtime size: 23,736 bytes.

## Validation

`npm run validate` checks decimal-normalized NAV, indicative flags, all proposal payloads, minimums, receivers, listing input, hours, revert wording, live aggregate reads and bytecode identity. `check-preservation.mjs` checks unchanged protected configuration/contracts and current integration invariants; it replaces the old comparison against obsolete transaction expressions.

The bounded browser/fork runner covers a 25-row listing with a declined prompt, receipt timeout, pending nonce and reload, as well as the transaction controls. It requires Anvil, solc 0.8.26, Playwright and Chromium. The runner requires an unfinalized empty genesis state so that it can exercise initial listing. Install Playwright outside the repository if necessary, and set `PLAYWRIGHT_MODULE` to its `index.mjs` when it is not at the runner's environment default.

```sh
cd web
export SOLC=/path/to/solc-0.8.26
export PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs
npx tsx scripts/run-browser.mjs
node scripts/inspect-export.mjs
node scripts/check-guards.mjs
npx tsx scripts/check-interface.ts
node scripts/check-motion.mjs
```

It pins a fresh block after 83,448,310 (or `BASKET_FORK_BLOCK`), caches the needed genuine account/storage and next 512 block-history ring reads before public RPC pruning, preserves the actual vault bytecode, creates disposable Stock Token/feed/pool fixtures on the fork, serves the actual production export at `/preview/`, exercises wallet actions and writes screenshots and decoded sends to `artifacts/`. All child services close when the command ends. Historical-state retention differs across the RPC backends. Older attempts failed when state was pruned; the final runner pins a fresh block and caches the reads it needs without overwriting vault code or storage.

Actual results, design review coverage, screenshots and limitations are recorded in [artifacts/validation.md](artifacts/validation.md). Build, typecheck, live/ABI checks, four send guards, 24 viewport checks and the 51-check/67-send fork walkthrough passed. The 24 empty/25-stock screenshots cover all six pages at 1440 and 375px. Linux Chromium DPR checks passed; required native Windows Chrome/Edge display-scaling and physical-phone checks remain unverified. Fork evidence is local testing, not an independent certification or a live transaction. Root contract tests are outside this website migration and were not claimed as validation of vault 5.

Fonts are Anton and VT323 under the SIL Open Font License; notices are in `web/public/fonts/`. Supermarket illustrations are original SVG/CSS. The pinned Better Interface and Impeccable attribution and licenses are retained in `web/validation/DESIGN-GUIDANCE-LICENSE`.

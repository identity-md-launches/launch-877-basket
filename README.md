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
- Redemption refreshes its preview immediately before sending, uses a selected nonzero receiver other than the vault, and 0.1% minimum amounts in current `assetTokens` order. Unsent stocks are owed to that receiver (explained in the Docs FAQ). Claims read every listed token and send groups of at most ten; one failing stock reverts its whole batch, nothing is lost, and each stock has its own Claim button.
- Genesis listings use `listGenesis`, show each row as it is checked, preserve row order and re-read each listing after confirmation. Whether a token is listed comes from `assetTokens()` because `asset()` reverts for unlisted tokens. A set pool requires a `minLiquidity` above zero. Current `poolWindow` pool liquidity and pool/feed gap are checked before listing; failed or marked rows need correction. A declined prompt can resume after checks. Submitted hashes survive receipt timeouts in session storage; listing compares pending/latest nonces after reload and prefers the node's record of the saved transaction's nonce over the count saved before the prompt.
- The only browser storage is the pasted listing rows (kept for this tab and copied for new tabs) and pending transaction recovery; there are no cookies, trackers or new services.
- Governance sends `propose(Action)` with the `BaskVault.Action` struct (kind, token, target, pool, quoteFeed, value, value2, setting), fields per kind as in the pinned source and unused fields zero. Proposals wait two days and are executable until nine days after creation (exclusive); the Proposed event's `executableAt` and `expiresAt` are shown after sending. Settings are in vault 6 order with `Dst` at index 6. The UI additionally requires deposits paused to execute Retire and Resync, and to propose Resync.
- Dates are written in words with UTC and New York time, for example "Sun 11 Oct 2026, 04:40 UTC (00:40 New York)", never as a numeric date. A start ("executable from", "Wait until", a loss's recognition date) is rounded up to the next whole minute and an end is written "until just before" a time rounded down, so a waiting window never looks longer than it is.

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

`npm run validate` checks decimal-normalized NAV, indicative flags, all eleven proposal kinds as the Action struct (including Hours and Dst), minimums, receivers, listing input, revert wording, live aggregate reads and bytecode identity. `check-interface.ts` adds the New York hours parser, the `NewYorkTime` port's inside/nextOpening vectors for all three `dst` modes, setting words and the pool `minLiquidity` rule. `check-preservation.mjs` checks unchanged protected configuration/contracts, forbids every abandoned vault address fragment in every file and keeps the send-check invariants. `check-calldata.mjs` compares the source with the commit it was applied to (HEAD): see "Site update v9" below for what it allows.

The bounded browser/fork runner covers a 25-row listing with a declined prompt, receipt timeout, pending nonce and reload, a US market holiday (every feed three hours old) and a Saturday, the Hours and Dst proposals and every transaction control. It requires Anvil, solc 0.8.26, Playwright and Chromium (WebKit for `check-art.mjs`). The runner requires an unfinalized empty genesis state so that it can exercise initial listing. Install Playwright outside the repository if necessary, and set `PLAYWRIGHT_MODULE` to its `index.mjs` when it is not at the runner's environment default.

The runner forks block **83,874,298** by default: the last block where vault 6 is empty and not finalized, with the same code as today. The live vault now has 25 listed stocks and may be finalized, so a fresh block can no longer exercise the first listing. That block is older than what pruning RPCs keep, so the runner reads it from the archive RPC `https://robinhood.api.pocket.network` through a small read-only proxy built into the runner: only read methods pass, block-hash parameters become block numbers, at most eight requests run at once and busy or failed reads are retried. `BASKET_FORK_BLOCK` and `BASKET_RPC` still override both; an override RPC must be an archive node for chain 4663, and an override block must keep vault 6 empty and unfinalized. The runner also mines one local block before its first call (Anvil 1.8 needs it) and waits for the second "List stocks" pass to finish before Finalize.

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

It forks the block above (it must be after 83,448,310), caches the needed genuine account/storage (vault 6 layout: words 0-41, the tokens array, the address and proposal mappings) and next 512 block-history ring reads before public RPC pruning, preserves the actual vault bytecode, creates disposable Stock Token/feed/pool fixtures on the fork (feeds have a settable lag), serves the actual production export at `/preview/`, exercises wallet actions and writes screenshots and decoded sends to `artifacts/`. Before each deposit it warps to the next opening when the fork is outside the hours and checks `insideHours()` on both sides of the boundary. All child services close when the command ends.

Actual results, design review coverage, screenshots and limitations are recorded in [artifacts/validation.md](artifacts/validation.md). The 2026-10-09 vault 6 production build, typecheck, live/ABI, guard, export, motion and fix checks and the fork walk-through passed (61 checks, 70 wallet sends). The 24 empty/25-stock screenshots cover all six pages at 1440 and 375px. WebKit was unavailable for `check-art.mjs`, so its manifest hash part was repeated separately and its WebKit render part is recorded as unperformed; the art files are unchanged. Native Windows display scaling and physical phones remain unverified. Fork evidence is local testing, not an independent certification or a live transaction.

Fonts are Anton and VT323 under the SIL Open Font License; notices are in `web/public/fonts/`. Art is original SVG/CSS plus the manifest files kept byte for byte: the owner’s character (the only person on the site) and Microsoft Fluent Emoji food (MIT). `artifacts/art-manifest.json` pins all 37 assets; the food license is `web/public/art/food/Fluent-Emoji-MIT.txt`. There are no borrowed characters. Decorative artwork carries no numbers, currency signs or real brand names; the project’s BASKET PROTOCOL name badge is allowed. The pinned Better Interface and Impeccable attribution and licenses are retained in `web/validation/DESIGN-GUIDANCE-LICENSE`.

The slogan strip always runs, with no pause control, except when the visitor requests reduced motion. Local art is loaded through relative image URLs; the shipped export makes no outside requests except chain RPC reads. The two food shelves, the title characters and the slogan strip are documented in [DESIGN.md](DESIGN.md).

To compare phone visibility to a saved previous export, run `BASKET_BASELINE_DIST=/absolute/path/to/previous/dist node scripts/check-visibility.mjs` from `web/`. It checks six routes at 375×812, both without a wallet and with a read-only injected connection to the live owner.

## Site update v9

Look:

- The store worker pops out of the Vault, Deposit and Redeem title panels. She stands on the checker strip at the panel's right end, her head rises above its top edge and her speech bubble sits beside her head. On phones she stands on her own shelf at the top of the panel. The separate picture frames and the WOW! burst are gone; Fresh! on the stock shelves stays.
- The tagline is gone from the footer and from the Vault title. The footer keeps the basket mark, "Basket Protocol" and its links. The Vault title has no eyebrow; its heading and sentence sit centred beside her.
- The yellow note about unsent stocks left the Redeem page. A new FAQ panel in Docs, right after Redemption, explains it.
- The slogan strip shows only as many whole slogan lines as the screen needs (rule in DESIGN.md), so wide windows have no blank gap and phones keep drawing it.
- Stock shelves: each stock is a yellow shelf-edge label on a red store shelf (rule in DESIGN.md). Held stocks get big labels at the top, biggest share first; the rest get small labels in listing order. A tap opens the details (feed, pool check, owed amount, both addresses). Filters and search are kept, with "Show all" while one is on. The labels swing once when their shelf first comes into view (never under reduced motion). Values are cut to the cent like the NAV figure. Display only: no read, check or transaction changed.
- New favicon: a red panel with a yellow frame and the header's basket in yellow.

Fixes (the same inputs still give the same calldata; the only new behaviour near a send is a refusal before the wallet prompt):

1. Pool and List proposals take `minLiquidity` as a 128-bit number, like the listing rows.
2. BalanceGas and PayGas show the vault's combined gas rules and the current maximum.
3. Under Dst 1 or 2 the hours read "UTC-5" or "UTC-4" instead of New York time.
4. PaymentFailed and BalanceUnreadable name the stock; a failing Claim all says which stock blocked the batch.
5. MathOverflow and InvalidTick have plain words.
6. The reopen countdown follows block time; once the opening is reached the page re-reads the vault and says deposits may be open.
7. Dates are in words (see Integration).
8. FreshCount 0 reads "off"; other values read in words.
9. Vault and Deposit show the hours in words only; Owner keeps the raw seconds.
10. The Launch panel says when the listed stocks are unreadable.
11. Redeem preview amounts follow each stock's index and are hidden when the stock list is unreadable.
12. Pool liquidity words use the vault's `poolWindow` and `poolDeviation`.
13. Once a pending listing transaction is mined or replaced, the page says so; a transaction cancelled or replaced in the wallet is never reported as Confirmed.
14. Finalize needs the pasted listing rows and refuses rows listed with other values.
15. Under Dst 0 an Hours start on Sunday 2:00-2:59 am is refused (that hour is skipped on the spring-forward Sunday).
16. The vault itself is refused as new owner, guardian or fee recipient.

What the checks allow in this update:

- `check-bundle.mjs`: in `web/src` only the look files (components, Vault, Flows, Docs, styles, main, Scenery) and the fix files (chain, model, newYork, governance, Owner, wallet) change; Losses, poolMath, deployment and the ABI stay as they were; `web/pinned`, `web/index.html`, the build configuration and the validation fixtures are unchanged; in `web/public` only `favicon.svg` changes, and it and `dist/favicon.svg` must have the chosen icon's SHA-256; no file is added.
- `check-calldata.mjs`: main and Scenery equal HEAD once their one edit is put back. In every source file the vault, token, feed and read calls, the argument parsers and encoders and every wallet send or raw provider request equal HEAD, apart from the listed fix changes; sends and requests have no exception at all, and Vault, Scenery, main and Docs have none. Vault.tsx makes no read, check or send call; its controls equal a pinned list (the Retry vault button and address links, plus the Stock shelves' Details, Close, filters, search and Show all) and the shelves' handlers equal their pinned text. The changed Owner actions and the governance argument builders equal HEAD once their listed pieces are put back, and the new refusal helpers equal their pinned text. HEAD's and the new encoders are run side by side on thousands of inputs, under fixed clocks for the deadline: same calldata, and only the listed new refusals.
- `check-art.mjs` (Chromium and WebKit): the title characters, the tagline gone, the other pages' eyebrows unchanged, the footer, the slogan strip rule, and the Stock shelves (one label per listed stock with ticker, price, status and Details, inside the shelf unit, at least 44px to tap, no old stock cards, still under reduced motion; the unit's food strip shows its first row only). `check-motion.mjs` (Chromium, three display scales): the same strip rule while scrolling, and the shelves' swing runs once per label and stops.
- `check-visibility.mjs`: only the Vault tagline may disappear from the first phone screen; title text pushed down by her picture is listed with its reason.
- `check-interface.ts`: unit cases for the fixes and the date rounding.

The fork runner's 24 screenshots are JPEG quality 36 (40 before): with the Docs FAQ and the longer Owner texts the quality-40 set no longer fits the 8 MiB delivery budget. So run `run-browser.mjs` before `check-bundle.mjs` (as in the list above): until the runner rewrites the 24 screenshots, the tree still holds the quality-40 set and the bundle reads over the limit.

## Site update v10

- Docs: the deposits sentence starts with a capital letter: "Deposits open Sunday 8 pm to Friday 8 pm New York time, closed on US market holidays, redemptions always open".
- Deposit and Redeem: a small royal-blue tag at the top of the form, shown whether deposits are open or closed: "Redemptions are open 24/7. Deposit hours apply to deposits only." The Redeem title now reads "Receive your share of every stock." The Vault and Deposit closed messages still end "Redemptions are always open."
- Stock shelves: no price time on the labels or in the details drawer (feeds post only on a 0.5% move or every 24 hours, so a time like "17h 55m ago" looked stale when it was not). The drawer row is "Feed price". Only a price the vault refuses as too old (reason 9) keeps its dimmed price and "old price" tag. `age()` left `model.ts` and its styles left `styles.css`. Display only: no read, check or transaction changed.
- Slogan strip: the two identical halves now share one grid cell and each moves as its own Web Animation (started in `Scenery.tsx`; the CSS `shop-scroll` animation is gone): from one half width right to one half width left, the second half half a cycle behind the first, so each jumps back only while it is wholly off screen and no `animationiteration` event wakes the page at a reset. Same words, lines, look and speed (exactly 16px/s, 64px/s at 660px and below); reduced motion cancels the motion and leaves a still, full strip.

What the checks allow in this update:

- `check-bundle.mjs`: in `web/src` only Docs, Flows, Vault, model and styles change (and Scenery for the slogan strip fix); `web/public`, `web/pinned`, the page shell and the build configuration are unchanged; no file is added.
- `check-calldata.mjs`: every other source is byte-identical to HEAD; Docs, Flows, Vault, model and Scenery equal HEAD once their listed v10 pieces are put back, so the tag words and the strip's Marquee hook are pinned. No call, action attribute, send or encoder changes: HEAD's and the new encoders give the same calldata, add no refusal and refuse with the same words.
- `check-art.mjs` (Chromium and WebKit, 12 widths): the tag is first in the Deposit and Redeem forms with the exact words, at least 14px, white on royal blue, inside its panel with whole words and clear of the character and her bubble; the Redeem title and Docs sentences; no price time on any label or in the drawer, and "old price" only for reason 9. `inspect-export.mjs` and `run-browser.mjs` check the tag (deposits open and closed) and the drawer too.
- Slogan strip: `check-art.mjs` (Chromium and WebKit, 23 widths 320-5,760px) and `check-motion.mjs` (three display scales) check that the halves are the only moving blocks, each k whole lines, each its own endless Web Animation at exactly the speed, with no CSS animation, `will-change` or 3D and no endless CSS animation on the page; that at loop phases just before, at and just after each half's reset the window is covered with the normal word gap at every join and at the seam; and that real playback across both resets fires no `animationiteration` event. `check-art.mjs`, `inspect-export.mjs`, `run-browser.mjs` and `check-visibility.mjs` check that reduced motion leaves no animation and a still, full strip.
- `check-visibility.mjs` (baseline: the v9 build): nothing may leave the first phone screen, and the slogan strip keeps its place and height.

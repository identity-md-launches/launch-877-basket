# Basket Protocol website

The static website serves **BaskVault `0xd77a5f93f9d85e6990f389147713a9ad8ce5764c`**, Basket (BASK), on **Robinhood Chain, chain ID 4663**. Its existing hosting name remains **basket-protocol.site.identitymd.eth**. This update changes the website only; no contract has been changed or deployed.

`web/` contains the React, TypeScript and Vite source and the unchanged, pinned frontend package manifest and lockfile. `dist/` contains the complete production export. The primary menu is Vault, Deposit, Redeem and Docs. Public Owner controls (`#owner`) and Losses (`#losses`) are footer links. All six pages work without a wallet, and claims are shown on Redeem. Wallet transactions use an injected Ethereum-compatible provider.

## Install, preview and build

Use Node.js 22.12+ or 24 and npm. From the repository root:

```sh
npm ci --prefix web
npm run typecheck --prefix web
npm run build --prefix web
npm run preview --prefix web -- --host 127.0.0.1
```

Open the preview URL printed by Vite. For development use `npm run dev --prefix web`. Installation downloads the existing locked dependencies; no dependency archives or offline registry are required. Keep every `node_modules/`, compiler output and cache out of the submission.

The build empties and regenerates `dist/`. Vite uses `base: './'`, so HTML, JavaScript, CSS and the local favicon work under a static subpath. No backend, environment secret, remote font service or server route rewrite is needed. Original SVG/CSS scenery and the licensed Damion font are bundled locally. Public reads require access to either configured RPC endpoint.

## Publish

Publish the **contents of `dist/`** through the existing site's static/IPFS publishing process and update the existing name **basket-protocol.site.identitymd.eth** to that export. Retain `web/` (including `package.json` and `package-lock.json`) and all of `dist/` in the submission. The publisher serves the export directly and does not rebuild it. This assignment prepared the export locally; it did not publish it or change the hosting name.

## Redesign

The navy night sky, saucer awning, ringed planet, neon script, aisle signs and Memphis patterns surround plain financial panels. All six pages reflow at 375px, Owner pairings become cards, and links/buttons are at least 44px tall. A confirmed deposit clears its amount and preview, displays **Deposit confirmed** with its transaction link, and requires a new explicit preview before another send. Every successful transaction invalidates old previews. All prior warnings and Docs copy remain unchanged.

## Exact contract binding

The website's authority is [launch-929-basket at b12f8ecdaac0acc13e47646441b4f312a2aab160](https://github.com/identity-md-launches/launch-929-basket/tree/b12f8ecdaac0acc13e47646441b4f312a2aab160), specifically `src/BaskVault.sol`, `src/BaskMath.sol`, the compiler settings and README there. **Do not derive this website's ABI or runtime from this repository's root `src/` or historical contract documentation.** Those files belong to an earlier project iteration and remain unchanged.

- Runtime keccak256: `0x62b326b6d8b9191a8777932f5beb87bc1dd07765fdb83bad3c4463924da402d0` (22,258 bytes).
- Canonical ABI keccak256: `0xfb215ccf6f418f03f9bbd7b7a68b806d6fb3f4dd64fe47063dc84eac2f254d89`.
- Canonicalization recursively sorts object keys, preserves array order, serializes compact JSON and hashes its UTF-8 bytes.
- Compiler: Solidity 0.8.26, optimizer 200 runs, via IR, Cancun, no metadata bytecode hash, constant optimizer disabled, matching the pinned launch.

To reproduce the ABI and deployment constants, with a local solc 0.8.26 executable:

```sh
cd web
SOLC=/path/to/solc-0.8.26 ./node_modules/.bin/tsx scripts/regenerate-abi.ts
```

This fetches only the pinned launch source, compiles it in memory, requires the expected runtime hash, and writes `src/vault.abi.json` and `src/deployment.ts`. It never deploys. ABI functions, events and errors come from compiler output. Proposal enums, reason words, positional reads and fixtures match the pinned source. Every send checks public RPC chain/code, wallet chain/account and simulates the exact calldata before requesting a signature.

The Deposit page separately computes size and daily headroom using managed NAV and `decayedBucket()`, checks stock balance before approval, and simulates allowance-covered deposits from the wallet. Listing sends the exact chain-read table rows; unreadable/mismatched/already-listed entries disable List. Receipt uncertainty triggers a new vault read and displays what is listed before retrying.

## Validation

From `web/`:

```sh
npm run validate
SOLC=/path/to/solc-0.8.26 bash scripts/run-fork.sh
```

`validate` checks hashes, math, pairings, encodings and public read-only calls. The fork script downloads the pinned source into disposable `test/scratch/fork/`, uses a recent block greater than 82,708,976, and runs the website tests against the actual verified vault bytecode. Because live genesis is now finalized, the harness requires zero live supply and resets only the genesis flag and stock-array length in its disposable local fork before exercising the original launch scenarios. Mock stocks/feeds and factory substitution exist only inside the local fork. It never broadcasts, compiles root `src/`, or modifies the existing Foundry configuration. Override `BASKET_FORK_BLOCK` to reproduce a particular block if the RPC retains it.

Production-browser checks use Playwright installed outside the submission; for example:

```sh
npm install --prefix /tmp/basket-browser playwright@1.56.1
/tmp/basket-browser/node_modules/.bin/playwright install chromium
./node_modules/.bin/tsx scripts/make-browser-fixture.ts
./node_modules/.bin/tsx scripts/assemble-browser-check.ts
PLAYWRIGHT_MODULE=/tmp/basket-browser/node_modules/playwright/index.mjs node scripts/run-browser.mjs
./node_modules/.bin/tsx scripts/check-browser-transactions.ts
```

If using an existing Chromium, set `CHROMIUM_PATH` to its executable. The runner owns a temporary foreground HTTP server, serves the production export under `/preview/`, closes the browser/server when done, and writes evidence under `artifacts/`. Fixture wallets capture requests; rejected, timed-out and confirmed receipts are simulated locally. Dummy hashes are never broadcast. No real wallet or live send is used.

Actual results for this redesign are in [artifacts/validation.md](artifacts/validation.md): production build and typecheck passed; live chain/runtime checks and 23 read-only action simulations passed; 25 captured browser requests cover all 24 UI action functions; all four fork tests passed at block **82,830,094**. A structural source comparison proves **128 unchanged RPC/transaction call expressions** and 15 byte-identical core/configuration files. The browser suite covers confirmation resets, pairing/approval guards, wrong-chain/runtime rejection, permissions, all six public pages and phone layouts. All pages have 1440px and 375px screenshots, with additional confirmed-deposit and pairing-warning captures. No console/page errors were reported.

To compare the current source against an original checkout, run `node scripts/check-preservation.mjs` from `web/`; set `BASKET_BASELINE` to the original commit when HEAD has moved. `BASKET_SOURCE_ROOT` optionally points to that working repository. The check is read-only with respect to Git and writes `artifacts/preservation.json`.

Worker installation/build used an identical copy of `web/` in `/tmp/basket-redesign/web` so no repository dependency directory was created. The locked manifest, lockfile, Vite and TypeScript configuration were not edited. The built `dist/` was copied back intact. Tooling, compiler downloads, caches and temporary fork state stay outside the submission. Existing obsolete screenshots/hashed assets were replaced with current evidence/export files; required source, font license and runtime assets remain complete.

Limitations: the initial fork run encountered finalized genesis; the earlier historical block was unavailable from both RPCs. Those attempts and the local-fixture adjustment are documented. No live send, external deployment, screen-reader session, physical-device session or native browser zoom test was performed. The unchanged holiday wording describes a US-holiday closure, while the immutable contract implements weekdays and feed freshness rather than an explicit holiday calendar. Vite retains its non-fatal >500kB chunk advisory. The current npm audit reports four issues (two moderate, two high) in the pinned dependency tree; dependencies are immutable in this assignment and were not altered. The audit report is included. Public state and RPC availability can change; these are local worker results, not independent certification.

[DESIGN.md](DESIGN.md) documents the implemented night-supermarket design, source tokens, components and responsive behavior. The pinned Better Interface guide informed all six review domains; its retained attribution and licenses are in `web/validation/DESIGN-GUIDANCE-LICENSE`.

# 2026-10-09 — v9 patch applied (vault 6, BaskVault 0x739fd5b653aa092a434534fa1ade67c1770b5a5b)

This dated entry records the application of the supplied v9 patch on top of commit `c57830e` and the checks run on the result in this workspace. No contract was changed or deployed. The previous entries are retained below as history.

## Patch

- Downloaded from `https://gateway.pinata.cloud/ipfs/bafybeievv3nrpn3pagxusvug3wfcavnt4xejxl6lo3yc6otui2lpckj6a4`: 306,218 bytes, SHA-256 `136c66b2707c009280aaf5ff593a6be3a3202accaf4289acdba99ac835e92115` (both as required). `git apply --check` then `git apply` on `c57830e`: clean, 24 files (README.md, DESIGN.md, web/public/favicon.svg, web/validation/README.md, 10 files in web/scripts, 13 in web/src). Nothing in it was restyled, re-timed, re-worded or rewritten; no check was loosened.
- The build matches the expected output byte for byte: `dist/assets/index-CLHhkE-M.js` SHA-256 `a44be771be2176f9bcd62618208d441db32f49107b169e30776969223d42e80b`, `dist/assets/index-B0l62uGD.css` SHA-256 `a9403561f24ebf9368cd5ebe46b19ce63c78a454c7aa008a53c2a1c7a93f5354`.

## Actual verification (2026-10-09, this workspace)

- `npm ci` in `web/` from the unchanged lockfile; `npm run typecheck` and `npm run build`: **PASS** (Vite's existing >500 kB chunk advisory remains; main JS 566.42 kB).
- `npx tsx scripts/run-browser.mjs` (fork block **83874298**, vault 6 empty and unfinalized, runtime hash `0x636a9477…`; Anvil 1.8.3, solc 0.8.26, Playwright 1.63 Chromium 153): **PASS, 61 checks, 70 wallet sends, 24 screenshots** (JPEG quality 36). `browser-fork.json` records the decoded sends. The run took 3 min 53 s. A first attempt failed before genesis: Anvil 1.8.3 asks the archive RPC for balance, nonce and code **by block hash** as a bare string, and `robinhood.api.pocket.network` answers "historical state … is not available" to hash-addressed reads (its number-addressed reads at the same block succeed). The runner's built-in proxy only rewrites object-style `{blockHash}` parameters, so a disposable scratch proxy (`test/scratch/archive-proxy.mjs`, not delivered) was placed in front of the archive RPC through the documented `BASKET_RPC` override; it maps a trailing block-hash parameter to its number with `eth_getBlockByHash`, answers `eth_getProof`/`eth_getAccount` from the plain balance, nonce, code and storage reads at the same block, and forwards everything else unchanged. It never alters a value: every field is the archive's own answer at the pinned block, and the runner still verified the vault runtime hash on the fork. The failed attempt is not counted.
- `npm run validate` (live, block **84275451**): **PASS** — unit checks, canonical ABI, live code hash at the vault 6 address, snapshot, status, all 11 proposal kinds as Action. The live vault had listed stocks at that time; the site does not depend on its state.
- `node scripts/check-preservation.mjs`: **PASS** (protected files, send checks, ABI invariants, wording, obsolete integration scan; no file holds a vault 1–5 address fragment; 7,215,948 bytes before lib accounting).
- `npx tsx scripts/check-interface.ts`: **PASS** (interface arithmetic, parser, exact balances, setting units).
- `node scripts/check-calldata.mjs`: **PASS** — HEAD and current encoders give the same calldata on the same inputs; only the listed new refusals differ (see `calldata-comparison.json`).
- `node scripts/check-fixes.mjs`: **PASS** 9 site-fix regressions.
- `node scripts/check-art.mjs`: **PASS** art hashes and browser layout (74 asset copies, 32 layout groups) in Chromium and WebKit 26.6 (Playwright webkit-2359, installed outside the repository with its apt host libraries).
- `node scripts/check-motion.mjs`: **PASS** 39 motion/layout checks at DPR 1/1.25/1.5; native Windows display scaling NOT VERIFIED (Linux Chromium only, as the script states).
- `node scripts/inspect-export.mjs`: **PASS** 24 page/viewport checks. `node scripts/check-guards.mjs`: **PASS** four send guards, zero sends.
- `BASKET_BASELINE_DIST=<copy of the c57830e dist> node scripts/check-visibility.mjs`: **PASS** 375×812 baseline visibility, six pages, no-wallet and connected; 9 title elements moved by the v9 look, 2 tagline elements removed (Vault). `phone-visibility.json` regenerated.
- `node scripts/check-bundle.mjs`: **PASS** complete bundle 8,101,795 / 8,388,608 bytes, 228 files, lib included, production export 911,328 bytes.

### Browser build note (environment, not a check change)

`check-art` and `check-motion` assert that one slogan line is 720 px (75 glyphs × 9.6 px: VT323 has a 400/1000 em advance at 24 px). Playwright's **headless shell** build of Chromium forces full font hinting and rounds that advance to 10 px, so the line measures 750 px there and both checks fail on the first run. The full Chromium build (Playwright channel `chromium`, Chromium 153 and 154 both tested), WebKit, and the font's own `hmtx` table all give 720 px; `--font-render-hinting=none` on the headless shell also gives 720 px. The two checks were therefore run with `PLAYWRIGHT_MODULE` pointing at a scratch shim (`test/scratch/playwright-full-chromium.mjs`, not delivered) that re-exports Playwright unchanged except that `chromium.launch()` opens the full Chromium build, which is what visitors actually run. The patched scripts, their assertions and the CSS are untouched. inspect-export, check-guards and check-visibility were run through the same shim; run-browser ran on the headless shell and does not assert the strip width.

## Better Interface review of the v9 result

The pinned guide was applied as a review of the patched surfaces (title-panel characters and bubbles, Stock shelves, slogan strip, favicon, the Fixes list). Coverage: accessibility (shelf labels, filters and search at least 44 px, details drawer reachable by keyboard, nothing moves under reduced motion — `check-art`, `check-motion`, `inspect-export`); layout (six routes at 320/375/800/1440 without overflow, strip rule at 23 widths 320–5,760 px, title picture in a 320–2,560 px sweep); writing (the three exact bubble lines, no split words, FAQ panel, hours line without raw seconds, claim errors naming the stock); typography (Flyer/Pixel at the documented sizes; the 720 px line rule verified above); colours (red shelves, yellow shelf-edge labels, blue title panel per DESIGN.md); UI (Finalize disabled while the paste box is empty, the four new refusals before any wallet prompt). No applicable finding remained after the patch; nothing was changed to make a check pass. Native Windows scaling, RTL and 200 % browser zoom remain unverified as before.

## Limitations

- Worker-side evidence only; the verifier checks paths and bytes. The live vault's state was not relied on; the walk-through used the pinned empty-vault block through an archive RPC.
- The two scratch helpers above (archive proxy, full-Chromium shim) live in `test/scratch/` and are not delivered; without them this machine's Anvil cannot fork the pinned block through that archive RPC and Playwright's headless shell measures the strip at 750 px.


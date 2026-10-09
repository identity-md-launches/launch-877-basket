# 2026-10-09 — v10 pinned patch, vault 6

Complete for the stated scope. Applied the supplied patch unchanged to clean commit `7aea768c2197cde37353107b8d1a49533e33c942`, rebuilt the production export, and reran every requested gate. No contract, dependency, build configuration, public art, transaction, read or argument was changed beyond the patch's declared website scope. Nothing was deployed or published. Git metadata was not modified; the changed source, export and artifacts are ready for the worker's submission commit. The v9 entry below is historical evidence, not this run's results.

## Patch and export integrity

- Download: `https://gateway.pinata.cloud/ipfs/bafkreibkrptdvaztppyb5zzxapdorzw4s2vvhu5gzktxthr732oe2enzme`.
- Verified **153,792 bytes**, SHA-256 **`2a8be63a83337bf01ee73703c6e8e6dc96ab53d3a6caa7799e3fde9c4d11b961`** before application. `git apply --check` and `git apply` passed. All 16 patched files remain byte-identical to their immediately applied versions; reverse-application checking also passes. No assertion or patched text, styling or timing was revised.
- `dist/assets/index-DJaEP2OT.js`: SHA-256 `3dd75e0037c6c23adf7535fae4216a9f4b5baead3de59526ed69f68a6f33f288`.
- `dist/assets/index-CizpQbvD.css`: SHA-256 `1c601e5a9a136fd523a2d22c3c1d92690fd620d25448e6c09dc053d01cd25f58`.
- Both filenames and hashes match the requested outputs exactly. The complete relative-URL export includes the companion JavaScript chunk, local fonts, favicon, art and licenses. Production export: **910,824 bytes**. Final candidate accounting, including tracked `lib/` files and this report, is in `bundle-check.json`; it is below **8,388,608 bytes**. No dependency caches, tool packages, browser downloads or submodules are delivered.
- README installation, preview, rebuild and publication instructions and DESIGN.md's tokens, type, components and responsive behavior were reviewed against the final source. Both retain the exact patch text. Existing compiler evidence is historical; this task does not regenerate or change the ABI.

## Actual checks in this workspace

All commands run from `web/`. The browser walkthrough ran before the other checks. A fresh copy of **7aea768's dist** was saved with `git archive` under disposable scratch before rebuilding and supplied as `BASKET_BASELINE_DIST`.

| Command | Result |
| --- | --- |
| `npm ci --cache /tmp/basket-v10-npm-cache` | PASS; unchanged package manifest and lockfile |
| `npm run typecheck` | PASS |
| `npm run build` | PASS; final build log in `build-validation.txt`; existing >500 kB chunk advisory only |
| `node ../test/scratch/archive-runner.mjs` importing unchanged `scripts/run-browser.mjs`, with the TypeScript loader | PASS: **61 checks, 70 wallet sends, 24 screenshots**, fork **83874298**, zero recorded issues |
| `npm run validate` | PASS: unit checks, canonical ABI, live **verifyNetwork**, runtime hash, snapshot, status, all 11 proposal kinds; live block **84490444** |
| `node scripts/check-preservation.mjs` | PASS: protected files, send checks, ABI/wording invariants and obsolete integration scan |
| `node --import tsx scripts/check-interface.ts` | PASS: arithmetic, parsing, exact balances and setting units |
| `node scripts/check-calldata.mjs` | PASS against **7aea768**: frozen files, reads, guarded calls, raw sends, argument builders and differential calldata; no new refusals |
| `node scripts/check-art.mjs` | PASS in Chromium and WebKit: **74 asset copies, 32 layout groups**; manifest bytes/hashes, exact copy, shelves/drawer and loop rules |
| `node scripts/check-motion.mjs` | PASS: **39 checks**, DPR 1 / 1.25 / 1.5, loop boundaries, fixed track, half offsets, speeds and reduced motion |
| `node scripts/inspect-export.mjs` | PASS: **24 page/viewport checks**, six routes at 320 / 375 / 800 / 1440 px; subpath loading, fonts, overflow, keyboard smoke checks, seven contrast pairs, zero console/resource issues and only permitted external RPC requests |
| `node scripts/check-guards.mjs` | PASS: **four guards, zero sends** |
| `node scripts/check-fixes.mjs` | PASS: **nine regressions** using the actual wallet hook and Claims component |
| `BASKET_BASELINE_DIST=<saved 7aea768 dist> node scripts/check-visibility.mjs` | PASS: six routes at **375×812**, no-wallet and connected; **47** prior first-screen elements preserved, none moved or removed |
| `node scripts/check-bundle.mjs` | PASS: complete candidate within 8 MiB; required screenshots and art retained |

The successful browser run used Anvil 1.8.3, solc 0.8.26 and Chromium 154.0.8037.0. It verified the fork's actual vault runtime and exercised genesis listing, declined prompts, receipt/pending-nonce recovery and reload, holiday/weekend deposit refusals, deposit/approval, redemption, claims, proposal kinds and execution, immediate controls, losses and ownership. All sends were local fork transactions. `browser-fork.json` records the decoded sends. The 24 `empty-*.jpg` and `stocks25-*.jpg` captures were regenerated at 1440 and 375 px, JPEG quality 36.

## Environment repairs and reproduction limits

Node is 22.23.3. A first `npm ci` failed because the default npm cache was read-only; the explicit temporary cache resolved it. Bare Node could not resolve the scripts' extensionless TypeScript imports, so browser/check invocations used `NODE_OPTIONS='--import tsx'` (the existing locked dependency).

The unmodified fork runner initially failed before Anvil became ready. As in v9, a disposable read-only HTTP adapter was supplied through `BASKET_RPC`, with the runner's own read-only proxy still in the path. It translates bare string block-hash state references using `eth_getBlockByHash` to the corresponding block number, and otherwise forwards archive responses from `https://robinhood.api.pocket.network`. It does not synthesize account proofs, substitute state, or alter chain values. Unsupported `eth_getAccountInfo` responses passed through unchanged and Anvil fell back to standard reads. An initial adapter attempt encountered an archive service-limit response; the successful run used four concurrent upstream requests, coalesced identical reads and up to six bounded retries with 1–5 second backoff. The pinned block, vault bytecode and assertions remained unchanged.

Browser checks used `PLAYWRIGHT_MODULE` to select a disposable module that launches full Chromium 154 from the installed Playwright distribution, with a writable temporary XDG configuration directory. This follows v9's documented full-Chromium font-metrics setup. WebKit 26.6 (Playwright 1.63, webkit-2359) and its required Ubuntu libraries were installed under `/tmp`; no browser or library binary is part of the site. The first combined check process was externally terminated during `check-art`, before any result or assertion failure. The unchanged art check then passed standalone in 184 seconds with periodic progress output; all remaining checks passed afterwards. No interrupted attempt is counted as a pass.

Adapters, tool-selection modules, raw command logs, extra review captures and browser/compiler tooling are disposable scratch or external tools, not delivered runtime dependencies. Reproduction needs equivalent external tools and the archive adapter behavior above. The final rebuild preserved the exact tested production asset hashes.

## Better Interface: six-domain review

The pinned workflow and all six core domains were read and applied to the affected surfaces. Scope is the exact v10 patch within the existing supermarket-flyer design, with smoke coverage of all six routes and fork coverage of primary interactions. Source and rendered observations support this review; it is not an independent certification.

| Domain | Coverage and evidence |
| --- | --- |
| Accessibility — Checked | Native static paragraph for the pill, retained labeled controls and text statuses, shelf/filter/search targets at least 44 px, keyboard focus/skip-link smoke checks and owner jump focus; reduced motion cancels both strip animations. `art-validation.json`, `export-review.json`, `browser-fork.json`. Full keyboard-only wallet journeys and screen-reader sessions were not performed. |
| Layout — Checked | Four export widths; both engines' title geometry sweeps from 320–2560 px; strip coverage at 23 widths from 320–5760 px; pill inside its form without overlapping the title art; all 47 baseline phone elements retained. Native 200% browser zoom and RTL layout were not tested. |
| Writing — Checked | Exact capitalized Docs sentence (`web/src/Docs.tsx:22`), both exact pill sentences (`web/src/Flows.tsx:40`), Redeem introduction (`web/src/Flows.tsx:585`), “Feed price” drawer row and age-free “old price” tag (`web/src/Vault.tsx:343`, `:626`). Stock Tokens terminology and transaction/error copy remain pinned. |
| Typography — Checked | Local Flyer/Pixel faces load; body/forms retain system typography and 16 px inputs. Pill computes to 15 px / 1.4 line-height, and whole-word wrapping passes. The slogan's 720 px line geometry passes in full Chromium and WebKit. Native Windows font rasterization/scaling remains unverified. |
| Colors — Checked | Existing tokens retained. Both browsers verify the pill renders white on royal blue (`#ffffff` / `#174bc1`), contrast **7.4656:1**. All seven named solid-color pairs in `export-review.json` exceed 4.5:1. This does not establish every image/antialiased pixel or every focus/background combination. Dark theme is not applicable: the product has one light theme. |
| UI — Checked | Empty/populated forms, guarded and disabled actions, listing recovery, claims and failed-read retry states exercised. The two halves move independently while the track stays fixed, jump only offscreen, use 16 px/s desktop and 64 px/s phone speeds, and have no `will-change`; reduced motion is still. Phase sampling verifies reset geometry; a DevTools 10% speed review was not performed. |

Requested findings addressed by the unchanged patch: loop-reset flicker mechanism (`web/src/Scenery.tsx:3`, `web/src/styles.css:1017`); ambiguous placement of redemption-hours guidance (`web/src/Flows.tsx:40`, `web/src/styles.css:503`); Docs capitalization (`web/src/Docs.tsx:22`); misleading price-age displays (`web/src/Vault.tsx:315`, `:343`, `:626`). Rechecks above pass. The original flicker was not independently reproduced on a physical iPhone; the new geometry and wrap behavior were tested in both Linux browser engines. No additional applicable defect was found in the reviewed states, and no change beyond the supplied patch was made to address design preferences.

All 24 regenerated captures were reviewed in overview contact sheets; closer visual inspection included `empty-deposit-375.jpg`, `empty-redeem-1440.jpg`, `stocks25-vault-1440.jpg`, `empty-docs-1440.jpg`, and the WebKit 375 px Deposit title capture in scratch. This confirms the reviewed composition and text placement, not readability of every tiny element in the contact sheets. Physical phones, native Windows display scaling, full assistive-technology coverage and live wallet transactions remain unperformed. The existing no-pause-control strip design is retained; reduced-motion support is tested. No manual source change was permitted to reinterpret that design.

Final integrity includes unchanged protected paths, exact patch and asset hashes, and an additional scan of **every candidate file's bytes** (including root contracts and tracked libraries, excluding removed task inputs and disposable scratch): no vault 1–5 address fragment. `preservation.txt` and `bundle-check.json` record the final gates.

---

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


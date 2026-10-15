# 2026-10-15 — v18 exact Add BASK to MetaMask patch, vault 6

This run applies the supplied patch to `974ddd3ae983ba181df285f3b9791ac955b694a5` (v17). The Docs **Find Basket** panel ends with **Add BASK to MetaMask** and the exact explanatory sentence. All eight patched files retain their exact post-application bytes. No contract, dependency, lockfile, build configuration, stylesheet, ignore file or deployment parameter changed. No live transaction or publication was performed.

## Patch and production export

The Pinata download was **43,532 bytes**, SHA-256 `3e55a00a90961e57a9306f6d10f98bc52fcd163c5a2ccb80e5f9094d1ec32cca`. The initial worktree was clean. `git apply --check` and `git apply` passed; a reverse-application check and saved digests subsequently confirmed the patch was unmodified.

`npm ci --cache /tmp/basket-npm-cache`, `npm run typecheck` and `npm run build` passed in `web/`. npm reported the existing three advisories (one moderate, two high); dependencies were not changed. Vite retained its existing large-chunk advisory. The final build/typecheck transcript is `artifacts/build-validation.txt`.

All five required filenames and hashes match exactly; there is no production-build difference:

| File | SHA-256 |
| --- | --- |
| `dist/assets/index-CvjHh67d.js` | `91f57b4a37cbf3a7e2845e580d270868f083a742edc7ddbee28488eeb20cf3cc` |
| `dist/assets/index-BRdefnhV.css` | `6d9deadc70d0c2350019458324a868b605b929425e3f5352864dddc9bc97fa80` |
| `dist/assets/ccip-D_yNKjHn.js` | `5db326b6af802d44490cb7deca6eccde60ed1b3fe7d2f076db37d7782a707458` |
| `dist/index.html` | `8d961d84dd17d0c293ce2b9bafc33f4c1e6f152fac5d4c8603673e9404d459f2` |
| `dist/share-card.jpg` | `dc14dd6f4068ec9325426583104b1c6ae8748fbb17d8326863c9612280eacd85` |

The complete static export retains relative asset URLs, hash routes, local runtime assets, title, favicon, description, og:title and og:image. README.md retains installation, preview and rebuild instructions. DESIGN.md retains the implemented design system and the exact v18 addition. The tracked source and lockfile accompany the export; Git metadata was not modified.

## Required checks in this run

The original v17 `dist/` was extracted with `git archive` into temporary storage before rebuilding and supplied through `BASKET_BASELINE_DIST`. The archive walkthrough was attempted before all the checks below. Commands are from `web/`; browser tooling settings are described below.

| Command | Actual result |
| --- | --- |
| `NODE_OPTIONS='--import tsx' node scripts/run-browser.mjs` | **Archive refusal** at fork block **83874298**, before any browser, sends or screenshots. See below. |
| `npx --no-install tsx scripts/check-tokenomics.tsx` | PASS — supply, allocation, schedule, cliff, annual rows, null guards, configured reads and formatting. |
| `node scripts/check-tokenomics-live.mjs` | PASS — five null mounts without reads, mocked success/failure/Retry, zero external requests. |
| `npx --no-install tsx scripts/check-bask-guide.tsx` | PASS — audited arithmetic/rounding, five examples, flywheel figures and exact canonical copy. |
| `npm run validate` | PASS — live **verifyNetwork**, canonical ABI, runtime hash, snapshot/status and all 11 proposal kinds; block **88889867**. |
| `node scripts/check-preservation.mjs` | PASS — protected paths, send guards, ABI/wording invariants and obsolete-integration scan. |
| `npx --no-install tsx scripts/check-interface.ts` | PASS — arithmetic, parser, exact balances and setting units. |
| `node scripts/check-calldata.mjs` | PASS — v17 comparison, frozen sources, reviewed digests, restored pieces and complete added-call/attribute declarations; **496 identical encodings, 1,773 mutually refused cases, zero new refusals**, plus send-builder cases. |
| `node scripts/check-art.mjs` | PASS — **74** manifest asset copies and **56** layout groups in Chromium and WebKit, including 320–2560px title geometry and baseline/focus comparisons. |
| `node scripts/check-motion.mjs` | PASS — **39** motion/layout checks; DPR 1/1.25/1.5 captures regenerated. |
| `node scripts/inspect-export.mjs` | PASS — **24** page/viewport checks across six routes; subpath navigation, local fonts, keyboard skip link, reduced motion, seven contrast pairs and no recorded console/resource issues. |
| `node scripts/check-guards.mjs` | PASS — four pre-send guards, zero sends. |
| `node scripts/check-fixes.mjs` | PASS — **34** wallet/Claims regressions. |
| `node scripts/check-visibility.mjs` | **FAIL** — unchanged full-panel geometry assertion at line 357; approved Docs panel grows by **126px**. See below. |
| `node scripts/check-bundle.mjs` | PASS — complete candidate including tracked libraries, all required assets and 24 retained screenshots is below **8,388,608 bytes**. Final total is in `artifacts/bundle-check.json`. |

### Archive refusal and retained walkthrough evidence

The unchanged runner used its read-only proxy and `https://robinhood.api.pocket.network` at fork block **83874298**. Anvil failed to create genesis because the archive returned **`metadata is not found, 83874301`** on its account read. The subsequent local RPC call failed because Anvil had exited. No block, state, bytecode, proof or response was substituted. The brief explicitly permits delivery after this archive refusal.

This run completed **0 walkthrough checks, 0 walkthrough sends and 0 walkthrough screenshots**. The inherited `browser-fork.json` (91 checks, 70 sends, 24 screenshots), all 24 required `empty-*.jpg` / `stocks25-*.jpg` images and their prior packaging record are retained as **historical evidence**, not a current walkthrough pass. `rpc-debug.json` was regenerated by the failed runner and remains empty. Current export, art, motion and wallet-request tests are separate evidence.

### Visibility assertion conflicts with the approved addition

At **375×812**, normal state without a wallet, `web/scripts/check-visibility.mjs:357` asserts that every Docs panel has exactly the baseline position and size. The first 13 panels match. The final **Find Basket** panel keeps top **8011.11px**, while height grows from **352.75px** to **478.75px** and bottom from **8363.86px** to **8489.86px**: **126px**, occupied by the requested button and sentence at `web/src/Docs.tsx:264–267`.

This is below the first screen and is the owner's requested change. The exact patch does not update that old assertion. Neither the approved content nor the check was changed. The script exits at that assertion, so the retained `phone-visibility.json` is historical and is not claimed as a current pass. Passing export/reflow checks do not replace this failed check.

## Additional validation of the new wallet request

`artifacts/watch-asset-validation.json` records **16 cases** (eight in each engine) on the actual production export served under `/preview/`. Temporary synthetic EIP-1193 providers exercise: no provider; wallet acceptance; a false result; code-4001 decline; successful network switch; code-4902 add-chain fallback; a wallet remaining on the wrong chain; and a declined switch. External chain reads were disabled in this isolated fixture; no real wallet was used.

Each case asserts the exact ordered wallet-method list and exact status text. Successful listing paths assert the complete ERC20 request: vault 6, BASK, 18 decimals and the pinned IPFS image URL. Existing switch/add-chain arguments retain their original values and RPC order. There is no watchAsset call on page/tab visits, only on keyboard activation of the Docs button. No case writes storage, signs or sends a transaction. On the correct network there are exactly two `eth_chainId` reads before `wallet_watchAsset`; wrong-network paths also retain the existing `switchChain()` chain read. The two engines additionally pass **eight** layout checks at 320/390/800/1440px, checking exact panel order/copy, button containment, at least 44px height and no horizontal overflow.

The assigned browser tool independently inspected the live-reading export at 320, 390 and 1440px. The new button measured approximately **217.36×46px**; keyboard Tab from the contact link reached it with the existing visible ink/yellow focus ring, and Enter produced the exact no-wallet message in the existing status line. At 390px the first screen showed product branding, Connect wallet and Deposit/Redeem navigation; the approved character-before-figures layout remains. Adding AAPL to Deposit focused its amount input; removing it cleared the row while retaining the desktop stock list. Arrow keys moved between Docs, Tokenomics and BASK. The review reported zero console warnings/errors. No contact message was sent or external social link opened.

## Better Interface coverage and findings

The pinned workflow and all six core domains were read and applied to the changed surface. The visual idea remains the existing supermarket flyer for a Stock Token basket vault. The brief states, “The exact-patch rule above stands over any design-bar item.” That instruction and the owner's listed decisions take precedence over generic style thresholds. No additional source edit or redesign was made.

| Domain | Coverage and limitations |
| --- | --- |
| Accessibility — Checked | Native named button (`Docs.tsx:265`), keyboard activation and visible focus, minimum target height, existing status region (`main.tsx:224`) and unchanged reduced-motion behavior. Full screen-reader sessions, native-wallet dialogs and a complete keyboard-only transaction were not performed. |
| Layout — Checked | Button follows Contact and precedes its one sentence; responsive containment at 320/390/800/1440 in both engines. Current export checks cover all six routes; art checks cover title sweeps. The 126px Docs growth is the failed preservation assertion above, not hidden. Native 200% zoom, RTL and physical-device layouts were not verified. |
| Writing — Checked | Exact owner-approved label, sentence and all eight outcome paths (`wallet.tsx:295`); no claim of a transaction or movement of funds. Recovery instructions match the specified behavior. Existing terminology and contact copy remain pinned. |
| Typography — Checked | Existing system body/button typography and local Flyer/Pixel fonts retained; the button and sentence wrap without clipping at reviewed widths. Font loading passes export checks. Native Windows rasterization and text-resize/locale stress tests were not performed. |
| Colors — Checked | Existing ink `#142c54` on paper `#ffffff` measured on the new button; computed contrast **13.8337:1**. All seven named export contrast pairs exceed 4.5:1. The focused state was viewed; not every focus/background or image pixel was measured. There is no dark theme. |
| UI — Checked | Existing button style and status presentation reused; native keyboard response, acceptance/refusal/error/retry guidance, Docs tab isolation, Deposit add/remove and unchanged motion checks exercised. Native MetaMask confirmation, actual wallet logo retrieval and a 10%-speed DevTools motion review were not performed. |

Rendered captures viewed include `test/scratch/art-review/Chromium-deposit-375-screen.png`, `test/scratch/art-review/WebKit-vault-375-screen.png`, and the browser-tool screenshots of the 390px first screen and the new Docs panel at 320/390/1440px. Review captures remain in disposable scratch.

The pinned `taste.mjs --out test/scratch/taste` probe completed: **10/16 passed**. Render, layout, targets, contrast, eyebrows, glyphs, slogans, copy budget, reduced motion and sharing passed. Six generic style checks flag existing casing, tracking, type-size/family counts, repeated marquee text and border-plus-shadow treatments. These unchanged source choices are retained under the exact-patch rule; none is caused by the new button. The probe checks the entry route, not every interaction, and excludes one image/gradient text pair from contrast measurement. Its report/captures and current manual/art review screenshots are disposable review evidence, not substitutes for the retained historical walkthrough shots.

## Tooling, integrity and completion

Browser tooling was installed only under `/tmp`: Playwright 1.64.0, full Chromium 156.0.8078.4 and WebKit 27.2. `PLAYWRIGHT_MODULE` selects full Chromium to preserve the documented font metrics. WebKit runtime libraries were extracted under `/tmp`; its temporary launcher was adjusted to retain the library path, and software EGL rendering was selected. Playwright's host-package preflight was skipped only because its `ldconfig` cache cannot see those temporary libraries; the actual engines launched and executed the unchanged site assertions. Initial tooling failures were not counted as passes. No repository check was edited to accommodate the runtime. The supplementary fixture's RPC-order expectation was corrected to the original frozen `chain.ts` configuration before its successful run.

All 74 art copies match their manifest. A complete candidate-byte scan, including binary assets and tracked libraries, finds no vault 1–5 address fragment. Required runtime assets and all 24 inherited screenshots remain. No new dependency/cache directory, archive, browser binary, submodule or ignore-file change is included. Reports regenerated with identical contents may have no diff. Prior validation entries and reports remain explicitly historical.

**Status: exact implementation and production export delivered; validation is incomplete.** The archive walkthrough has the brief's permitted external-service limitation, and the unchanged visibility check fails on the approved panel growth. All other required checks pass. No failed check is represented as passing and no source was changed to manufacture a pass.

---

# 2026-10-15 — v17 exact contact-links patch, vault 6

This entry records this run against `27315d9974a065935f260dec29a52fa30fc7a109`. The owner-supplied patch is applied exactly. The footer and Docs **Find Basket** panel now show the Telegram and project e-mail links after X. No contract, dependency, lockfile, stylesheet, build configuration, ignore file, deployment parameter or transaction implementation changed. The seven patched files, including README.md and DESIGN.md, retain their exact post-application bytes.

## Patch and build

The Pinata download is **38,635 bytes**, SHA-256 `ffafe41d5de02854fb4ced73a13309782450e40c27dce759ac1bbe45a5e50dca`. The workspace was clean at the specified base. `git apply --check`, `git apply` and the later reverse-application check passed. Saved SHA-256 values verify that none of the seven patched files was subsequently edited.

From `web/`, `npm ci`, `npm run typecheck` and `npm run build` passed. The existing manifest and lockfile remain unchanged. npm reported three dependency advisories (one moderate, two high); no dependency update was made within this exact-patch assignment. Vite retains its large-chunk advisory. Actual build/typecheck output is recorded in `artifacts/build-validation.txt`.

All five required production filenames and hashes match; there is no build difference:

| File | SHA-256 |
| --- | --- |
| `dist/assets/index-CI-SOoQ1.js` | `6b14104f752b8acbbcf50aab5ca80ddcb995045beca2d59413bdefe376770282` |
| `dist/assets/index-BRdefnhV.css` | `6d9deadc70d0c2350019458324a868b605b929425e3f5352864dddc9bc97fa80` |
| `dist/assets/ccip-9XcyZzby.js` | `7d0a6c92ef8c45351ab69f3eb5fa729b7fc6f91908acb86cdf80cc9e8ed70924` |
| `dist/index.html` | `7a016413136b5ac1c7c143e6c8834a5a4b43c5806c9daf25e431aa55f7fa603b` |
| `dist/share-card.jpg` | `dc14dd6f4068ec9325426583104b1c6ae8748fbb17d8326863c9612280eacd85` |

The export retains relative asset URLs, hash navigation, title, favicon, description, og:title and og:image. README.md explains installation, preview and rebuild; DESIGN.md documents the existing tokens, typography, components, responsive behavior and exact v17 contact-link addition.

## Archive walkthrough limitation

`node scripts/run-browser.mjs` was attempted before the other checks, with the installed TypeScript loader supplied through `NODE_OPTIONS='--import tsx'`. Its old browser-module locations were unavailable; temporary Playwright tooling was installed outside the submission and selected through the runner's existing `PLAYWRIGHT_MODULE` setting. The runner and its assertions were unchanged.

With fork block **83874298** and the runner's read-only proxy, the archive endpoint `https://robinhood.api.pocket.network` refused Anvil's genesis account read with **`metadata is not found, 83874301`**. Anvil reported **`failed to create genesis`**, and the next local RPC call failed because the fork had exited. No block, state, bytecode or response was substituted.

The brief permits reporting an archive refusal and delivering the other work. This attempt reached no browser, wallet send or screenshot: **0 current walkthrough checks, 0 current sends, 0 current walkthrough screenshots**. The inherited `browser-fork.json` record (91 checks, 70 sends, 24 shots), all 24 required JPEGs and their packaging record are retained as historical evidence, not claimed as a successful v17 walkthrough. `rpc-debug.json` was regenerated by the failed runner. The visibility failure below is separate from this permitted archive exception.

## Required checks

The original **27315d9 dist** was extracted before rebuilding and provided as `BASKET_BASELINE_DIST`. Browser scripts use temporary Playwright 1.64.0 with full Chromium 156.0.8078.4; WebKit 27.2 uses downloaded runtime libraries and software rendering. A scratch launcher selects full Chromium, as in previous validation runs. Temporary tooling and caches are excluded from delivery. Initial browser checks that could not import a relative tooling path were rerun after correcting only that path. No source or check assertion was changed.

| Command, from `web/` | Result in this run |
| --- | --- |
| `npx --no-install tsx scripts/check-tokenomics.tsx` | PASS — supply, allocation, schedule, cliff, annual rows, null guards, configured reads and formatting. |
| `node scripts/check-tokenomics-live.mjs` | PASS — five null mounts with zero reads; mocked success, failure and Retry; zero external requests. |
| `npx --no-install tsx scripts/check-bask-guide.tsx` | PASS — integer arithmetic/rounding, five examples, flywheel figures and exact canonical copy. |
| `npm run validate` | PASS — live `verifyNetwork`, canonical ABI, code hash, snapshot/status and all 11 proposal kinds; block **88857943**. |
| `node scripts/check-preservation.mjs` | PASS — protected paths, send checks, current ABI invariants, wording and obsolete-integration scan. |
| `npx --no-install tsx scripts/check-interface.ts` | PASS — arithmetic, parser, exact balances and setting units. |
| `node scripts/check-calldata.mjs` | PASS — 27315d9 comparison, frozen sources, reviewed digests and restored pieces, unchanged calls/state/storage/wallet behavior, only four added link sinks; **496 identical encodings, 1,773 mutually refused cases, zero new refusals** and separate send-builder cases. |
| `node scripts/check-art.mjs` | PASS — 74 manifest asset copies and 56 layout groups in Chromium/WebKit, including full 320–2560px title sweeps and baseline/focus comparisons. |
| `node scripts/check-motion.mjs` | PASS — 39 motion/layout checks; DPR 1/1.25/1.5 captures regenerated. |
| `node scripts/inspect-export.mjs` | PASS — 24 page/viewport checks, static subpath navigation, fonts, keyboard skip link, reduced motion and contrast. |
| `node scripts/check-guards.mjs` | PASS — four pre-send guards, zero sends. |
| `node scripts/check-fixes.mjs` | PASS — 34 wallet/Claims regressions. |
| `node scripts/check-visibility.mjs` | **FAIL** — `check-visibility.mjs:357`, “Every Docs panel keeps its place and size”; details below. |
| `node scripts/check-bundle.mjs` | PASS — complete candidate, tracked libraries, all required assets and screenshots under 8,388,608 bytes; final accounting in `artifacts/bundle-check.json`. |

### Visibility failure: unchanged gate conflicts with the added contact rows

At **375×812**, normal state without a wallet, the unchanged check at `web/scripts/check-visibility.mjs:357` compares the geometry of every Docs panel with the 27315d9 export. The first 13 panels match. The last panel, **Find Basket**, retains top **8011.11px**, but its height changes from **251.63px** to **371.63px**, and bottom from **8262.73px** to **8382.73px**: exactly **120px** for the two approved paragraph/link rows at `web/src/Docs.tsx:252–259`.

This is the requested content addition, below the first screen. The supplied patch does not update the old full-panel-height assertion. The brief explicitly says to report a failed check instead of changing the patched code, so neither the contact rows nor the assertion was altered. No passing visibility result is claimed. The script stops at that assertion and does not write a new `phone-visibility.json`; the retained report is historical. The passing export review and current contact review provide separate evidence, not a replacement pass for this check.

## Better Interface review

The pinned Better Interface workflow and all six domain principles were applied to the two changed link surfaces. The visual idea remains the established supermarket flyer for a Stock Token basket vault. Existing owner decisions and the exact patch take precedence over the generic design bar.

The assigned browser tool inspected the built export at **320, 390, 800 and 1440px**. All four new links have the exact destination and label, Telegram opens in a new tab with `rel="noreferrer"`, and e-mail uses `mailto:protocolbasket@gmail.com`. No Telegram navigation or e-mail was sent. Both contact surfaces fit without horizontal overflow. Keyboard Tab moves from the footer Telegram link to e-mail with a visible focus ring. The 390px first screen visibly includes the product branding, Connect wallet and Deposit/Redeem navigation. The approved character-before-figures order remains.

Useful primary interactions were exercised: adding AAPL to Deposit focused its amount input and kept the stock list open; removing it cleared the row while retaining that list. Docs arrow-key navigation selected Tokenomics and then BASK. Tokenomics retains its total-available caption and one curve plus its filled area. The browser reported zero console warnings/errors during this review. No real wallet signing was performed.

| Domain | Coverage, findings and limitations |
| --- | --- |
| Accessibility — Checked | Native named anchors at `main.tsx:285–288` and `Docs.tsx:253–258`; intended order, destinations, target/rel, keyboard traversal and visible focus. Each new link measured 44px high at 320px and 1440px. Screen-reader output, physical wallets and a full keyboard-only transaction were not verified. |
| Layout — Checked | Contact links fit at 320/390/800/1440 without horizontal overflow; mobile and desktop screenshots viewed. The new Docs rows account for the documented 120px panel growth. Existing export checks cover six routes at 320/375/800/1440. Native zoom, RTL and physical devices were not verified. |
| Writing — Checked | Exact owner labels and URLs match the reviewed patch; Docs reads “Contact: protocolbasket@gmail.com”. Labels identify their destinations and match the existing X link. No other copy changed. |
| Typography — Checked | The new anchors reuse the existing 16px system text, underline and wrapping. Fonts loaded in the export checks; full e-mail text stays visible. Native Windows rasterization/display scaling was not verified. |
| Colors — Checked | Computed link foreground `rgb(23, 75, 193)` on Docs white gives **7.4656:1**; the same foreground on footer `rgb(255, 219, 41)` gives **5.4807:1**, both above 4.5:1. A complete image/gradient/focus contrast audit was not performed. Dark theme is not applicable. |
| UI — Checked | Existing link style is reused with no stylesheet addition. Footer/Docs grouping, focus feedback and local Docs tabs remain usable. Motion, send-guard and wallet/Claims checks pass. Physical phones, native scaling and DevTools slow-motion inspection remain unperformed. |

The unchanged design probe `node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste` ran with an explicitly selected temporary Playwright module. **10/16 checks passed**: render, layout, targets, contrast, eyebrows, glyphs, slogans, copy budget, motion and share. It found no horizontal scroll, text overlap, clipping or covering control at 320/390/1440; all 46 measured controls meet 24px-or-spacing, with 26 below the comfortable 44px guideline. First-screen prose is 60 words at 390 and 86 at 1440. Both endless animations stop under reduced motion. One text box over imagery was excluded from contrast measurement.

The six raw flags are inherited casing (`styles.css:108`), tracked figure label (`styles.css:393`), type-size count and four font families (`styles.css:1`, `:8`, `:26`), repeated Pixel marquee (`styles.css:174`, `:186`), and border-plus-shadow flyer surfaces (`styles.css:236`, `:299`). The 390px probe capture and contact-panel/footer screenshots were visually reviewed. These generic-bar limitations remain recorded; no new contact-link defect was observed. No restyling or rewording was authorized by the exact-patch task.

## Delivery and status

All **74** manifest asset copies have matching sizes and SHA-256 values. A complete candidate-byte scan, including tracked contract libraries and binary assets, finds no vault 1–5 address fragment. The production export, source and original lockfile remain complete. No dependency/cache archive, temporary runtime, extra screenshot, submodule or ignore-file change is delivered. Regenerated reports with identical contents may have no diff. Earlier validation entries, `validation-v15.json`, compiler evidence and the inherited walkthrough/visibility records remain explicitly historical.

**Status: exact implementation and rebuilt export delivered; validation is incomplete.** The archive walkthrough is unavailable under the brief's explicit exception, and the unchanged visibility check fails on the required contact-panel growth. The remaining required checks are recorded above. No check was loosened, and no source was changed to manufacture a pass. The dated machine-readable summary is `artifacts/validation-v17.json`.

Files are prepared in the worktree for submission. No staging or commit command was run because the task prohibits touching `.git/`; no local commit is claimed.

---


# 2026-10-14 — v16 exact Tokenomics patch, vault 6

This entry records this worker's run on 2026-10-13/14 UTC against `5110ca96c434441cdffaec727413c54ede26dafe`. Earlier entries and retained artifacts describe earlier runs. The owner-supplied patch was applied without alteration. No contract, dependency, lockfile, build configuration, ignore file, transaction source or deployment setting changed. No live transaction or publication was performed.

## Patch and production export

The Pinata download was exactly **75,439 bytes**, SHA-256 `70b48e86410f60901130e5297a48e148d43639908c33a1fdea345b9cf6a8863e`. The workspace was clean at the requested base. `git apply --check`, then `git apply`, succeeded for exactly the 11 named files. Saved post-application SHA-256 values and `git apply --reverse --check` confirm that every patched file still has the exact supplied contents. Only `Tokenomics.tsx` and `tokenomicsData.ts` changed under `web/src`; the stylesheet and all other source files equal the base.

`npm ci`, `npm run typecheck` and `npm run build` passed with the existing package manifest and lockfile. The first install encountered the read-only default npm cache; setting `npm_config_cache=/tmp/basket-v16-npm-cache` resolved it. Node 22.23.3, npm 10.9.9, TypeScript 5.9.3 and Vite 7.1.9 were used. The final typecheck/build output is in `artifacts/build-validation.txt`. Vite's existing chunk-size advisory remains. All five requested outputs match exactly, with no hash or filename difference:

| File | SHA-256 |
| --- | --- |
| `dist/assets/index-7uhBO_VC.js` | `036b131f57d9f0127c26722bc03a5e799b06285bf4279d54f33e0cbb350c07d2` |
| `dist/assets/index-BRdefnhV.css` | `6d9deadc70d0c2350019458324a868b605b929425e3f5352864dddc9bc97fa80` |
| `dist/assets/ccip-CsUE1brP.js` | `d6f00d46b4d91b8ae6f65164f8d72d7be969dfcd5b401bf7988d91c1bcdfaff4` |
| `dist/index.html` | `8d081d507edc3b60c38e9cd268bd7da86fb8660a75337c2ca3840da8febdedfe` |
| `dist/share-card.jpg` | `dc14dd6f4068ec9325426583104b1c6ae8748fbb17d8326863c9612280eacd85` |

The export retains relative URLs and hash navigation. Title, favicon, description, og:title and og:image are present. The patch's README install/preview/rebuild instructions and DESIGN.md v16 chart documentation remain unchanged. Existing design tokens, typography, components and responsive behavior remain documented there.

## Fork walkthrough: permitted archive exception

The walkthrough was attempted before the other checks. Plain Node could not resolve the source's extensionless TypeScript imports, so the unchanged runner was executed with the installed loader: `node --import tsx scripts/run-browser.mjs`. The first attempt timed out. A retry with loopback traffic explicitly excluded from the environment proxy reached the fork at **83874298**, then failed at `run-browser.mjs:255` while reading an account through the runner's read-only proxy. The archive endpoint `https://robinhood.api.pocket.network` returned:

> historical state 9ea3fbd1957abec5df2d9a4417b6cad5709e75647b2fe94e7af00e623cfe86d0 is not available

A direct read-only archive probe confirmed that `eth_getCode` at that block number succeeds but the equivalent hash-addressed read fails. A direct Anvil fork independently failed to create genesis with the same archive error. No fork block, state, bytecode, assertion or response value was substituted.

The brief explicitly permits delivery when the archive refuses the pinned fork block. **This run does not claim 91/92 completed walkthrough checks, 70 wallet sends or 24 newly generated walkthrough screenshots.** `browser-fork.json`, the 24 required empty/stocks25 JPEGs and screenshot-packaging record remain inherited evidence; they are retained as required. `rpc-debug.json` was regenerated by the failed runner. Fresh local interaction checks below concern this export and do not replace the unavailable fork walk. No real wallet was used.

## Actual checks

All commands ran from `web/` with the supplied scripts unchanged. `BASKET_BASELINE_DIST` pointed to a byte copy of the original **5110ca9 dist** saved before rebuilding. Browser checks used external Playwright 1.64, full Chromium 154.0.8037.0 and WebKit 26.6. A disposable `PLAYWRIGHT_MODULE` wrapper selects full Chromium for the fractional font metrics required by the existing checks. WebKit and its missing system libraries were installed/extracted under `/tmp`; its external launcher preserves that library path. No browser binary, library, dependency archive, cache or helper is delivered. The first art invocation terminated before producing a report; the final bounded retry passed in 8 minutes 35 seconds, with disposable logging of browser progress and no changed assertion, style or response.

| Check | Result in this run |
| --- | --- |
| `npx --no-install tsx scripts/check-tokenomics.tsx` | PASS — allocations, supply, four-year schedule, cliff, every-null guard, configured reader, rejected reads and formatting. |
| `node scripts/check-tokenomics-live.mjs` | PASS — five null mounts perform zero reads; mocked configured success, failure and Retry; zero external requests. |
| `npx --no-install tsx scripts/check-bask-guide.tsx` | PASS — integer arithmetic, rounding, five examples, flywheel figures and exact canonical copy. |
| `npm run validate` | PASS — live `verifyNetwork`, canonical ABI, vault code hash, snapshot/status and all 11 proposal kinds; block **87914816**. |
| `node scripts/check-preservation.mjs` | PASS — protected paths, pre-send checks, ABI invariants, wording and obsolete-integration scan. |
| `npx --no-install tsx scripts/check-interface.ts` | PASS — arithmetic, parser, exact balances and setting units. |
| `node scripts/check-calldata.mjs` | PASS — 5110ca9 base; frozen sources, restored/pinned display edits and sink scans; **496 identical encodings, 1,773 mutually refused cases, no new refusals**, with send builders checked separately. |
| `node scripts/check-art.mjs` | PASS — **74** manifest asset copies and **56** layout groups in Chromium/WebKit; full 320–2560px title sweeps, baseline equality, focus-marker checks and rejection of the old positioning. |
| `node scripts/check-motion.mjs` | PASS — **39** motion/layout checks; corrected slogan-only iteration counter; DPR 1/1.25/1.5 captures regenerated. |
| `node scripts/inspect-export.mjs` | PASS — **24** page/viewport checks, no issues; subpath navigation, fonts, keyboard skip link, reduced motion and seven solid-color contrast pairs. |
| `node scripts/check-guards.mjs` | PASS — four pre-send guards, zero sends. |
| `node scripts/check-fixes.mjs` | PASS — **34** site-fix regressions. |
| `node scripts/check-visibility.mjs` | PASS — six routes without/with mock account at 375×812; **70** previous first-screen elements preserve their words and vertical place; title geometry equals the 5110ca9 export. |
| `node scripts/check-bundle.mjs` | PASS — full candidate, including tracked libraries and every required asset/screenshot, below **8,388,608 bytes**. Final self-accounted size is in `artifacts/bundle-check.json`. |

The complete candidate's bytes were also scanned, including tracked libraries, contracts and binary assets: no vault 1–5 address fragment. Protected-path comparisons, absence of submodules, exact patch preservation and all five production hashes were checked again before delivery. Source and lockfile remain complete; no ignore rule was changed. Unchanged regenerated artifacts can have no Git diff; historical `compiler-validation.txt` and `validation-v15.json` are not new v16 evidence.

## Better Interface review and design probe

The pinned Better Interface workflow and all six core domains were applied to the two changed display sources and their surrounding Docs presentation. The design is the established supermarket flyer. The owner explicitly requires this exact patch: no copy, visual rule, transaction behavior or check was altered to satisfy a general design preference.

A disposable browser harness ran the existing `checkTokenomics` and `checkBaskGuide` helpers against the production export in **both Chromium and WebKit**. It additionally asserted the exact caption and one-entry legend, one royal-blue curve, four annual points, no dashed curve, and no overflow at 320/390/660/800/1440/1920. External RPCs were blocked for this isolated Docs review; no live figures were invented. Both engines passed with zero page errors. Phone/desktop charts and release tables were captured and visually inspected. The chart shows one total line; the table retains every breakdown number and the approved labels.

| Domain | Coverage and evidence |
| --- | --- |
| Accessibility — Checked | SVG role/labels and semantic table headers in `Tokenomics.tsx:8–22`; original keyboard tab helpers test Home/End/arrows, focus and hidden panels in both engines. Existing guard/fix tests cover disabled/error/retry states. No screen-reader or complete keyboard-only wallet session was performed. |
| Layout — Checked | Both chart variants and stacked phone records fit; original module helpers cover 320–1920px, including BASK's intermediate widths. Export suite covers all six routes at 320/375/800/1440. At 390px, the product branding, Connect wallet and Deposit/Redeem navigation are visible; the approved character-before-figures order remains. Native zoom and physical-device behavior were not tested. |
| Writing — Checked | Exact patch words at `tokenomicsData.ts:52–84` and `Tokenomics.tsx:22`: total-available caption/legend, explicit pool-staking assumption and unchanged breakdown figures. All arithmetic and canonical-copy tests pass. No wording was revised after applying the patch. |
| Typography — Checked | Local fonts load, chart labels fit and the new table labels wrap into phone records. The existing Flyer/Pixel/system-font hierarchy is preserved. Native Windows font rasterization and display scaling remain unverified. |
| Colors — Checked | The curve computes to `rgb(23, 75, 193)` in both engines and retains the `--royal` token. `inspect-export` measures seven named solid-color pairs above 4.5:1, including white/royal **7.4656:1** and ink/paper **13.8337:1**. The probe excludes one text box over imagery; no complete pixel/gradient/focus contrast audit is claimed. Dark theme is not applicable. |
| UI — Checked | Single static chart, semantic table and local tabs remain usable. Live-component success/failure/Retry tests, 34 fix regressions, four send guards and the corrected 39-check motion suite pass. No physical wallet send or DevTools 10%-speed motion review was performed. |

`node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste` completed: **10/16 passed**. Passing areas are render, layout, targets, contrast, eyebrows, glyphs, slogans, copy budget, reduced motion and share metadata. The six raw flags are inherited casing, tracking, type-size count, font-family count/Pixel prose, repeated scrolling slogan, and border-plus-shadow chrome. Evidence points to the frozen `styles.css` font rules (`:1`, `:8`, `:26`), heading transforms (`:105`), `.eyebrow` (`:393`), marquee (`:186`) and flyer surfaces (`:236`, `:299`). The rendered probe reports 13 repeated sizes at 390px, four font families, the “On-chain figures” label at 0.045em and the established repeated strip. These are recorded limitations against the generic bar; no new chart defect was observed. The brief says “apply it as it is” and forbids changing a look or text to make a check pass, so no restyling or rewording was authorized or performed.

Visual evidence reviewed in disposable scratch includes `taste/shots/390.png`, `taste/shots/1440.png`, Chromium chart captures at 390/1440, the Chromium 390 release table, and WebKit's 390 chart and 1440 release table. These captures support the stated observations only; they are not the required fork screenshots and are not submitted. The probe found no horizontal overflow, overlap, clipped text or covering control at its tested widths. It measured 60 first-screen prose words at 390px, and all measured text met its contrast thresholds. Physical phones, native zoom/scaling, RTL, screen-reader output and live signing remain unperformed.

The requested motion-check correction is delivered at `web/scripts/check-motion.mjs:299`: iteration events from the CLOSED sign no longer count as slogan-strip iterations; the original loop-reset assertions remain and now pass. Owner decisions concerning the one-line chart, local Docs tabs, desktop Deposit stock column, phone title/character order, wallet controls, conditional claims and CLOSED-only status presentation were retained exactly.

**Completion:** the exact patch, rebuilt static export and regenerated evidence are ready in the workspace, with the brief's explicit archive-fork exception. All other requested checks pass. No successful rerun of the unavailable fork walkthrough, physical device test or independent verifier certification is claimed.

**Local commit limitation:** `git add` failed with `fatal: Unable to create '.../.git/index.lock': Read-only file system`. Git metadata is read-only in this worker sandbox. No staging or commit succeeded, and no alternate-index or repository workaround was attempted. The completed worktree files remain available for the network worker's normal commit/submission step; this entry does not claim they were locally committed.

---


# 2026-10-13 — v15 exact phone-layout patch, vault 6

This entry describes this Codex run in UTC. Historical entries and artifacts are not evidence that a check ran in this session. The owner-provided patch is unchanged. No contract, dependency, lockfile, build configuration or ignore file changed; no live transaction or publication occurred.

## Patch and export integrity

Baseline: clean `c05c174f639d352fb6184636bcc6e083031daa65`. The Pinata download was 97,146 bytes with SHA-256 `8649818fb6f06658c236fbd6e7bf3cff7b0b918c4cc3d3cf38845a7c1115ad86`. `git apply --check` and `git apply` succeeded. All nine patched files were independently reconstructed from baseline plus the downloaded patch and compared byte for byte. Reverse-application checking also passed. Only `web/src/styles.css` changed in application source: exactly 39 appended lines. Every other tracked `web/src` file equals the baseline; no assertion, pin, wording, art or application script was edited after patch application.

`npm ci`, `npm run typecheck` and `npm run build` succeeded using the unchanged lockfile, Node 22.23.3, npm 10.9.9, TypeScript 5.9.3 and Vite 7.1.9. The initial npm install could not write its default cache (EROFS); rerunning with `npm_config_cache=/tmp/basket-v15-npm-cache` succeeded. Vite retains its existing large-chunk advisory. All five requested filenames and hashes match exactly:

| Production file | SHA-256 |
| --- | --- |
| `dist/assets/index-Ilfw5yUx.js` | `87776ebd6738dc3ab4f15f6a3a8f591ce5549e120fffe48a1e110046f352ef34` |
| `dist/assets/index-BRdefnhV.css` | `6d9deadc70d0c2350019458324a868b605b929425e3f5352864dddc9bc97fa80` |
| `dist/assets/ccip-DYKMBxXZ.js` | `c2ba7ecb68f43ee4c208425c879b63d3a4c2ca346111396c24850bc327171e60` |
| `dist/index.html` | `e73b2083579cda0f83ed66fefbff058f62204911182f5e57bfdfe7c119e0ecb1` |
| `dist/share-card.jpg` | `dc14dd6f4068ec9325426583104b1c6ae8748fbb17d8326863c9612280eacd85` |

The export keeps relative script, stylesheet, favicon, font and art URLs and hash navigation. Title, description, favicon, og:title and og:image are present. README retains install, preview and rebuild steps. DESIGN.md retains the implemented tokens, typography and components and the patch's exact v15 responsive documentation.

## Fork walkthrough exception

The unchanged `node scripts/run-browser.mjs` was attempted before other checks. Plain Node 22 cannot resolve the extensionless TypeScript imports, so it was rerun with the installed `tsx` loader (`node --import tsx scripts/run-browser.mjs`). Anvil 1.8.3 failed to create genesis through the runner's read-only proxy at the required block 83874298. The archive endpoint `https://robinhood.api.pocket.network` returned `historical state 9ea3fbd1957abec5df2d9a4417b6cad5709e75647b2fe94e7af00e623cfe86d0 is not available`. Repeated runner attempts, including with Node's environment-proxy support, failed before a browser or any wallet send. A direct read-only Anvil fork reproduced the archive refusal. A temporary wrapper redirected Anvil's silent-mode stdout errors to stderr solely so the runner could record the underlying error. No block, state, assertion, fork bytecode or response value was substituted.

The brief explicitly permits delivery with the other checks passing if the archive refuses this block. **This run does not claim 91/92 successful walkthrough checks, 70 sends or 24 regenerated screenshots.** `browser-fork.json`, the 24 empty/stocks25 JPEGs and screenshot-packaging record remain the inherited c05c174 evidence; they describe the previous build. The failed attempt produced no new walkthrough screenshots. The required screenshot files are retained. Fresh art/layout, motion, visibility, export and unit results below concern this build. No archive workaround or scratch tooling is shipped.

## Verification environment

The original c05c174 `dist/` was extracted with `git archive` and supplied as `BASKET_BASELINE_DIST` to both comparison suites. Checks ran from `web/` with their patched scripts unchanged. Browser tools are external Playwright 1.64, Chromium 154.0.8037.0 and WebKit 26.6. A scratch `PLAYWRIGHT_MODULE` re-exports Playwright with `chromium.launch` selecting its full Chromium build (`channel: chromium`) to preserve fractional font metrics, as documented by prior runs. XDG browser caches are in `/tmp`. WebKit's runtime libraries were downloaded and extracted outside the repository; its launcher retains that library search path. No browser package, binary, cache, library archive or tooling shim is submitted.

## Actual check results

All fourteen checks below were run, without removing or changing any assertion. Thirteen passed; the motion check failed.

| Command in `web/` | Actual result |
| --- | --- |
| `npx --no-install tsx scripts/check-tokenomics.tsx` | PASS — allocation/supply/schedule arithmetic, null guards, configured reader and formatting. |
| `node scripts/check-tokenomics-live.mjs` | PASS — five null mounts, mocked configured success/failure/Retry; zero external requests. |
| `npx --no-install tsx scripts/check-bask-guide.tsx` | PASS — audited arithmetic, flywheel figures, five examples, exact canonical prose/formulas/tables. |
| `npm run validate` | PASS — live verifyNetwork, ABI and code hash, snapshot, status, all 11 proposal kinds; block 87872980. |
| `node scripts/check-preservation.mjs` | PASS — protected files, send checks, ABI invariants, wording, obsolete integration scan. |
| `npx --no-install tsx scripts/check-interface.ts` | PASS — arithmetic, parser, exact balances and setting units. |
| `node scripts/check-calldata.mjs` | PASS — c05c174 baseline, every application script frozen, exact CSS append pin; 496 identical encodings and 1,773 mutually refused cases, no new refusal. |
| `node scripts/check-art.mjs` | PASS — 74 manifest asset copies and 56 layout groups, Chromium and WebKit, 320–2560px title sweep, baseline comparison, focus-marker checks and rejection of the old look. |
| `node scripts/check-motion.mjs` | FAIL — check-motion.mjs:314, “Loop ends 1920”: events=2, expected 0; both reset boundaries crossed. Identical failure on the untouched baseline. See diagnosis below. |
| `node scripts/inspect-export.mjs` | PASS — 24 page/viewport checks, zero issues; fonts, keyboard, subpath, reduced motion and seven solid contrast pairs. |
| `node scripts/check-guards.mjs` | PASS — four pre-send guards, zero wallet sends. |
| `node scripts/check-fixes.mjs` | PASS — 34 site-fix regressions. |
| `node scripts/check-visibility.mjs` | PASS — c05c174 dist, 375×812, six routes without/with mock account; all 70 prior first-screen elements retain words and vertical place, no exception. |
| `node scripts/check-bundle.mjs` | PASS — complete candidate including tracked lib, required assets and screenshots below 8,388,608 bytes; re-run after this entry. |


### Motion failure reproduced and isolated

`web/scripts/check-motion.mjs:299` attaches its iteration counter to `document`, then `:314` expects zero events while playing the marquee through its two reset boundaries. This run rendered the approved CLOSED sign. Its independent CSS animations `deposit-led-chase` and `deposit-led-glow` (`web/src/styles.css:528`, `:531`) each emitted an event, producing `{events:2,crossed:[true,true]}` at 1920px. A read-only event observer in a scratch Playwright wrapper identified both names and their sign elements on `#deposit`; it did not change styles, application state, event propagation, time or assertions. The same unchanged check against the untouched c05c174 export failed at the same assertion with the same result. This is inherited behavior, not a change introduced by the 39-line phone patch.

The exact-patch instruction says to report a failed check instead of changing the patched code or look, and forbids loosening checks. Neither the test nor the approved sign was changed, and the failed run is not counted as a pass. The freshly passing art suite separately verifies marquee resets, geometry, the sign and reduced-motion behavior in both engines, but does not replace the failed motion gate. `motion-validation.json` remains historical; it was not regenerated by the failing script. Only `redeem-title-dpr-1.png` was regenerated before failure; the 1.25 and 1.5 captures remain inherited. No full 39-check motion pass is claimed for this run.

## Better Interface review

Applied the supplied workflow and core principles for accessibility, layout, writing, typography, colors and UI to this exact patch. The site remains a Basket Protocol vault interface presented as a 1990s supermarket flyer. The explicit owner decisions take priority: centered phone Vault picture/heading and full shelf; unchanged focus marker joined by the shelf; unchanged desktop; local Docs tabs and live-product ITEM/Tokenomics/BASK copy without addresses; the desktop Deposit stock list open at right; Vault heading alone; character before phone vault figures; no Change wallet button; claims hidden when nothing is owed; no OPEN sign or normal-operation status line. No design preference was used to alter the patch.

| Domain | Coverage and limitations |
| --- | --- |
| Accessibility — Checked | Keyboard-generated heading focus and blur on the three title routes; visible focused Deposit/Redeem captures inspected; unchanged focus outline and forced-colors guard at `web/src/styles.css:3017`; keyboard/label/target and reduced-motion checks in the supplied suites. Physical-device and screen-reader sessions were not performed. |
| Layout — Checked | Vault centering, 138px three-line bubble, 4px minimum frame clearance, full-width shelf and heading alignment at `web/src/styles.css:2992`; unchanged heights and vertical positions against c05c174; both engine width sweeps and six-route phone comparison. Fresh 390px first screen shows brand, Connect wallet, Vault/Deposit/Redeem/Docs navigation and the character panel; financial figures remain below the owner-approved character. Native 200% browser zoom and RTL are unverified. |
| Writing — Checked | Every application source except the stylesheet equals c05c174. Bubble words and other copy remain pinned by existing tests. ITEM/Tokenomics/BASK unit tests check canonical text and examples; no words were changed. |
| Typography — Checked | Local Flyer/Anton and Pixel/VT323 WOFF2, system body stack and 16px inputs are preserved. Three-line Vault bubble and whole-word wrapping verified in rendered titles. The inherited larger type inventory is recorded by the taste probe rather than rewritten. |
| Colors — Checked | No palette token changed. The focus band retains the shelf's yellow, outline remains ink; the art checks measure the actual computed colors and dimensions. Export review checks seven named solid-color pairs. Taste's measured text pairs pass; one image/gradient-backed text box is unmeasured. No dark theme is implemented. |
| UI — Checked | Navigation, walletless prompt, focus, empty/read-failure states, guard and Claims regressions covered by the supplied checks; updated mobile title surfaces viewed directly. Motion/reduced-motion behavior retained. Real wallet transactions and the archive-backed walkthrough could not be exercised in this run; no claim of those successes is made. |

The two requested layout findings are addressed by the supplied changes: `web/src/styles.css:2992` corrects the Vault's horizontal title composition; `web/src/styles.css:3017` moves only the focused Deposit/Redeem shelf down 3px and ends it at the marker edge. The new checks also reject the previous look and compare the live baseline geometry. No new applicable defect was observed in the inspected changed surfaces; the inherited motion-gate failure above remains unresolved under the exact-patch constraint.

The unmodified design probe `node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste`, with `IMD_PLAYWRIGHT` naming the external browser shim, completed **10/16 checks**. Render, layout, targets, contrast, eyebrows, glyphs, slogans, copy-budget, motion and share passed. There was no horizontal overflow, text overlap, clipped text, obscured control, script error or missing local resource at 320/390/1440. All 44 measured controls meet the probe's 24px-or-spacing rule; 26 are below the comfortable 44px guideline. It measured 60 first-screen prose words at 390 and 86 at 1440. Both endless animations stop under reduced motion.

The six flags are inherited presentation choices: uppercase headings/stock symbols (`web/src/styles.css:108`), tracked figure labels (`:398`), type-size inventory and four families (`:26`, `:105`, `:186`, `:635`), repeated Pixel marquee (`:1100`), and border-plus-shadow flyer surfaces (`:221`). The exact-patch rule expressly outranks this design bar. No source, text, look, assertion or check threshold was changed to make the probe pass.

Rendered evidence was made with actual Playwright Chromium and WebKit. The separate MCP browser transport closed while attempting preview access; direct browser scripts provided the rendered checks and captures instead. Inspected fresh captures include `test/scratch/taste/shots/390.png`, `1440.png`, Chromium's 375px Vault and Deposit titles, 375px Deposit focus marker, 320px Redeem focus marker, and WebKit's 375px Vault title and 375px Deposit focus marker. Scratch captures are disposable and are not the inherited walkthrough JPEGs. Physical iPhone behavior, native Windows display scaling, a screen-reader walk, forced-colors screenshots, native zoom, RTL/localization stress and 10%-speed animation-panel inspection were not performed. These limits do not establish accessibility certification.

## Completion and delivery

Direct Git delivery limitation: `git add` could not create `.git/index.lock` because repository metadata is mounted read-only. No commit was created, no Git metadata or permissions were changed, and no alternate Git directory was used. All completed source/export/artifact changes remain in the working tree for the submission system.

The exact requested implementation and rebuilt static export are complete. Validation is **incomplete**: the archive-backed walkthrough could not start, and the inherited motion gate fails as detailed above. All 13 other requested checks pass. The archive exception is expressly allowed by the brief; the additional motion failure is reported without altering the patch or any check. These are worker observations, not independent certification.

Fresh regenerated artifacts and this dated record accompany the exact patched sources and production export. The older walkthrough JPEGs/record and motion artifacts identified above are retained as historical evidence, not relabeled as current successes. The license notices are preserved. Dependency/cache directories, tooling, downloaded archives, preview captures, baseline extraction and diagnostics remain outside the submission or in disposable `test/scratch/`. No ignore rule changed. A final candidate-byte scan covers all submitted files, including root contracts, libraries and binary assets; no vault 1–5 address fragment is present. `bundle-check.json` records the final full delivery size and production-file hashes after documentation.

---

# 2026-10-13 — v14 exact patch, vault 6 (Docs tabs, ITEM, Tokenomics, BASK, desktop Deposit columns)

This entry records the current run (commands ran on 2026-10-13 UTC on a Claude seat). Older entries below are historical. The requested patch, the rebuilt export and every regenerated artifact are prepared for the submission system. Git metadata was not modified. No contract or protected dependency/build file changed; no live transaction or publication occurred.

## Patch and build integrity

Applied to clean `2b7d55b`. The specified Pinata download was exactly **195,568 bytes**, SHA-256 **`0811371471e3257d861e0923d6da1a686094829b894e001461394359e01a5f35`**. `git apply --check` and `git apply` passed on 2b7d55b: 21 files, 1,484 insertions, 187 deletions, the seventeen listed paths changed and the four `web/src` modules plus six `web/scripts` files created. No patched file was edited afterwards; no wording, style, assertion or pin was changed to make a check pass.

`npm ci`, `npm run typecheck` and `npm run build` passed from `web/` (Node 22.23.3, npm 10.9.9, locked Vite 7.1.9 and TypeScript 5.9.3). `build-validation.txt` records the actual outcomes. **The produced hashes differ from the ones the task expected**:

| Production file | SHA-256 here | Expected by the task |
| --- | --- | --- |
| `dist/assets/index-Umm6XolT.js` (604,230 bytes) | `90cc85c37c1eb0985da14ef1223c4bdb6dd6415e0f3cd7d3eed7b3a2ac9280c1` | `index-Ci2_uPd-.js` `d2ff471d…` |
| `dist/assets/index-Dreu644d.css` (48,240 bytes) | `77f5e778fea7f585123a742b1eb4f06e7f89e9e07c62aa555637f4a4de619218` | `index-C-PJiW18.css` `cd80da1b…` |
| `dist/assets/ccip-ICDF8oEy.js` (2,610 bytes) | `283f8f98859d87c0aa4418dc2d8a116f3865ee23a1521b323c99a1a2408207ce` | `ccip-DNB2G4hs.js` `3385feaf…` |
| `dist/index.html` (1,330 bytes) | `f356259d028b318947983a3842ac603552bb2707b2e7f0cf79f64c916d14aaf5` | `2ee5b100…` |
| `dist/share-card.jpg` (44,831 bytes) | `dc14dd6f4068ec9325426583104b1c6ae8748fbb17d8326863c9612280eacd85` | matches |

How it differs: the untouched 2b7d55b sources, rebuilt here with the same `node_modules`, reproduce the committed 2b7d55b export byte for byte (`index-CFIsCDgK.js`, `index-93wOgsf7.css`, `ccip-DK1SzuxE.js`), so this machine's build is deterministic and matches the previous accepted build environment. `dist/index.html` differs from 2b7d55b only in the three hashed asset names. The applied sources are byte-identical to the patch, and check-calldata's reviewed digests for the four new modules and check-bundle's source scope passed, so the expected values came from a different build of the same sources (not from a source difference). The committed export is the one built here from the patched sources. The export is **1,004,821 bytes**, with relative script, stylesheet, favicon, font and art URLs and hash navigation. Title, description, favicon, og:title and og:image are present.

## Actual verification

The patched `scripts/run-browser.mjs` ran first, unchanged, with the `tsx` loader (`node --import tsx`), Anvil 1.8.3, solc 0.8.26 and external Playwright 1.64 (Chromium 154.0.8037.0). It **passed 91 checks, 70 wallet sends and 24 screenshots** at fork block **83874298**, zero recorded issues, 3,804 fork RPC calls, zero Docs storage writes, and the Tokenomics statistics block made no request (15 RPC and 2 wallet requests before and after the tab). The run began inside the vault's deposit hours, so no extra time-warp check was added. The 24 JPEGs were captured in their original names and order at the patch's quality 18. `browser-fork.json` and `rpc-debug.json` (empty, written by the runner) are this run's results.

Archive access: the runner's upstream, `https://robinhood.api.pocket.network`, is load-balanced and answered the pinned block on about half of its nodes (`historical state … is not available`, `missing trie node`, `metadata is not found`); the two public RPCs in `network.json` refuse archive reads outright. The first attempts failed at genesis. The successful run set the runner's documented `BASKET_RPC` to a disposable local relay (`test/scratch/relay.mjs`, not delivered) that forwards every request to the same Pocket endpoint and retries those answers; the runner's own read-only proxy, block, hash and assertions were untouched. The relay served 2,930 requests with 2,712 retries.

A pristine 2b7d55b `dist` was extracted before rebuilding and supplied as `BASKET_BASELINE_DIST` to check-visibility and check-art. Required commands below ran from `web/`.

| Command | Actual result |
| --- | --- |
| `node --import tsx scripts/check-tokenomics.tsx` | PASS: brief parsing, supply, schedule, cliff, four annual rows, every-null guard, absent live block, configured multicall, rejected read, formatting |
| `node scripts/check-tokenomics-live.mjs` | PASS: five null mounts, absent/zero reads, mocked success and explorer rows, failure-only notice, Retry, zero external requests |
| `node --import tsx scripts/check-bask-guide.tsx` | PASS: audited integer rounding, locked supply, mint/redeem/fee arithmetic, flywheel figures, five examples, exact canonical copy from the shipped `bask-guide-content.md` |
| `npm run validate` | PASS: live verifyNetwork, canonical ABI, live code hash, snapshot, status and all 11 proposal kinds; block 87798566 |
| `node scripts/check-preservation.mjs` | PASS: protected source/configuration, send checks, ABI invariants, wording, obsolete integration scan (no vault 1–5 address fragment); 7,683,724 bytes excluding lib and Git metadata. Ran in a clean clone overlaid with the staged tree because the seat's sandbox mounts unreadable device nodes (`.bash_profile` etc.) at the workspace root that the walker cannot open; those nodes are not files of the tree |
| `node --import tsx scripts/check-interface.ts` | PASS: arithmetic, parser, exact balances and setting units |
| `node scripts/check-calldata.mjs` | PASS against 2b7d55b: every source outside Docs/Flows byte-identical, both restored through their pieces, four modules pinned by digest and sink-scanned, send/connect/disconnect/approveAll/onSubmit/getSpec/Claim all/owed read equal; 496 identical encodings and 1,773 mutually refused cases, no new refusal |
| `node scripts/check-art.mjs` | PASS in Chromium 154 and WebKit 26.6 against the 2b7d55b baseline: 74 manifest copies, 48 layout groups, titles, strip and shelves across the widths, the pinned desktop and ITEM words; completed in 4 min 40 s (see the font-metrics note below) |
| `node scripts/check-motion.mjs` | PASS: 39 motion/layout checks at DPR 1 / 1.25 / 1.5 and reduced motion |
| `node scripts/inspect-export.mjs` | PASS: 24 page/viewport checks, zero issues, seven passing contrast pairs |
| `node scripts/check-guards.mjs` | PASS: four send guards; zero sends |
| `node scripts/check-fixes.mjs` | PASS: 34 site-fix regressions |
| `node scripts/check-visibility.mjs` | PASS at 375x812 against 2b7d55b: six pages, no-wallet and connected, 67 prior first-screen elements preserved; only the approved Docs tab row and copy edits displace content; header, strip and character retained |
| `node scripts/check-bundle.mjs` | PASS: complete bundle 7,893,994 / 8,388,608 bytes before this entry (lib included); re-run after documentation, see Completion |

Chromium font metrics: Playwright 1.64's Chromium 154 headless shell lays the 24px Pixel slogan line out at whole-pixel advances (750 px per line instead of 720), identically on the untouched 2b7d55b export and on this one, with both web fonts reported loaded; so check-art's and check-motion's first runs failed on the strip width. Chromium's `--font-render-hinting=none` restores 720.02 px, matching the earlier runs' setup (full-build Chromium). The passing runs used a mirrored browser directory outside the repository whose headless-shell entry is a wrapper adding only that flag; no script, assertion or style changed. WebKit: Playwright 1.64 wants webkit-2365, whose shared libraries are not installed on this machine; the self-contained webkit-2359 build left by an earlier job (WebKit 26.6, same version as the earlier accepted runs) was supplied under that name with `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1`.

## Better Interface review

Read the pinned workflow, the six domain cores and the design-critic thresholds, and applied them to the patched result without widening the exact-patch scope. The owner's accepted decisions were taken as settled: local Docs tabs with ITEM, Tokenomics and BASK text written as a live product without addresses or pre-launch warnings; on desktop the Deposit stock list always open in the right-hand column with the notes under the form, one column on phones; the Vault heading alone; the character before the vault figures on phones; no Change wallet button; the claims panel hidden when nothing is owed; no OPEN sign or normal-operation line, only the CLOSED sign during a known closure.

| Domain | Coverage and limits |
| --- | --- |
| Accessibility — Checked | Docs tabs are native buttons in a `role="tablist"` with `aria-selected`, `aria-controls`, roving `tabIndex` and arrow/Home/End handling (`web/src/Docs.tsx:21`), panels linked by id; the fork exercised keyboard navigation of the tabs. Focus styles and reduced motion unchanged. No screen-reader session. |
| Layout — Checked | Desktop Deposit two-column grid from 961px (`web/src/styles.css:2931`), driven by one `matchMedia` listener (`web/src/Flows.tsx:88`); at 960px and below the 375x812 comparison proves phones unchanged. The fork verified the open list in the right column and the notes under the form; inspect-export found no overflow at 320/375/800/1440. Native zoom and physical devices untested. |
| Writing — Checked | Approved copy only: the five ITEM panels between Risks and Find Basket, the Tokenomics and BASK text proven against the canonical fixture by check-bask-guide and check-tokenomics, the new warning sentence and the removed "Grey stocks" sentence pinned by the fork and check-art. Nothing rewritten. |
| Typography — Checked | Flyer and Pixel fonts loaded locally (document.fonts reported both loaded in the probe). The tab row and tables use the existing scale; the design probe still counts the inherited one-off sizes (see below). |
| Colors — Checked | Tokens unchanged; export review computes seven passing solid pairs; the taste probe measured all text contrast passing with one gradient/image box unmeasured. |
| UI — Checked | Tabs, ITEM panels, Tokenomics charts/tables with the statistics block reading nothing while all five addresses are null (`web/src/tokenomicsData.ts:62`), BASK worked examples, and the desktop Deposit columns, in the fork at 1440 and 375 and in the export checks; no wallet, storage or network use by the new modules (check-calldata sink scan, runner request counts). No real-wallet send. |

The probe `node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste` (external Playwright 1.64 named through `IMD_PLAYWRIGHT`) completed **9/16 checks**: render, layout, targets, contrast, eyebrows, slogans, motion and share passed; it found no horizontal scroll, overlap, obscured control or clipped text at 320/390/1440 and all 16 controls at least 24px. The 390 screenshot shows the brand, Connect wallet and the Vault/Deposit/Redeem/Docs navigation on the first screen. The seat's sandbox blocks the browser's requests to the public RPCs (CORS preflight refused by the egress proxy), so the probe saw the Vault page's read-failure state: that is why copy-budget (77 words at 390, bar 60; 60 in the previous run with a reachable RPC) and glyphs (two em dashes in the "unreadable — Retry" error lines) failed here; those states are unchanged by this patch. The remaining flags are the documented inherited style exceptions: uppercase headings and tracked figure labels (`web/src/styles.css:108`, `:398`), the type scale with one-offs and four families (`web/src/styles.css:26`, `:186`), the repeated Pixel marquee (`web/src/styles.css:1100`) and border-plus-shadow flyer surfaces (`web/src/styles.css:221`). The exact-patch rule stands over these; no source or gate was changed.

## Completion

`node scripts/check-bundle.mjs` was re-run after this entry and `build-validation.txt` were written: PASS, complete bundle **7,908,115 / 8,388,608 bytes** (lib included). The dated entry above, `build-validation.txt`, the regenerated `browser-fork.json`, `calldata-comparison.json`, `phone-visibility.json`, `export-review.json`, `live-validation.json`, `motion-validation.json`, `bundle-check.json`, `rpc-debug.json`, the three DPR PNGs and the 24 JPEGs are committed with the patched sources and the rebuilt `dist/`. Scratch relay, probes and browser mirrors live in `test/scratch/` and `$TMPDIR` and are not delivered. Ignore files are unchanged. These are worker-side results, not independent certification.

---

# 2026-10-14 — v13 exact patch, vault 6

This entry records the current run in Asia/Taipei (commands ran on 2026-10-13 UTC). Older entries below are historical. The requested patch, rebuilt export and regenerated artifacts are prepared for the submission system. Git metadata was not modified. No contract or protected dependency/build file changed; no live transaction or publication occurred.

## Patch and build integrity

Applied to clean `586998cf5eb2a6ccce05615ddf7f44874813042c`. The specified Pinata download was exactly **97,425 bytes**, SHA-256 **`3077b269a958f73f2bcaada91af1f9450bfc9a4d69a751dbc9fbe7ad3174fc05`**. `git apply --check`, `git apply` and reverse-application checking passed. All ten patched paths remain byte-identical to the applied patch. No wording, style, assertion or preservation pin was changed afterward.

`npm ci --cache /tmp/basket-v13-npm-cache`, `npm run typecheck` and `npm run build` passed from `web/`. `build-validation.txt` records the actual outcomes and tooling. Vite retains its existing large-chunk advisory; the package manifest and lockfile are unchanged. All five requested production filenames and SHA-256 values match:

| Production file | SHA-256 |
| --- | --- |
| `dist/assets/index-CFIsCDgK.js` | `14991f60318eacd64a0070b0e1cb29b591ce744ecbbb3cce6a44101b7ee8a973` |
| `dist/assets/index-93wOgsf7.css` | `de331fa183d2be573ade7f790289f8acfc79ee4a2322f3877520f9b4f349d281` |
| `dist/assets/ccip-DK1SzuxE.js` | `0ed8570a07accffdac034dec8c85a73f16b158e1e2576cad29024e7197482e19` |
| `dist/index.html` | `416333c1c6fc7f8918e84e783bd95b82a0df99ebf868c25335cd4eea404e3a56` |
| `dist/share-card.jpg` | `dc14dd6f4068ec9325426583104b1c6ae8748fbb17d8326863c9612280eacd85` |

The complete export is **969,187 bytes**. Its scripts, styles, favicon, fonts and art use relative URLs, with hash navigation suitable for static subpath hosting. Title, description, favicon, og:title and og:image are present. The preserved README explains installation, preview and rebuilding; the preserved DESIGN.md documents actual tokens, typography, components and responsive rules, with the new v13 list behavior. Those documents retain the exact patch text.

## Actual verification

The unchanged `node scripts/run-browser.mjs` ran before every required gate below, with the locked `tsx` loader, Anvil and external Playwright/solc paths. It **passed 86 checks, 70 wallet sends and 24 screenshots**, at fork block **83874298**, with zero recorded issues. The specified Pocket archive RPC succeeded through the runner's own read-only proxy; no extra adapter, alternate block, fabricated state or source change was needed. Both new v13 assertions executed. `browser-fork.json` and all 24 empty/populated JPEGs are new results for this update, captured in their original name/order at the pinned quality **26**. The existing v12 `screenshot-packaging.json` is historical packaging evidence only and does not describe these newly captured images.

An ordered trace comparison with the preceding committed artifact confirms identical destinations, functions and non-clock arguments for all 70 sends, and identical ordered screenshot names. Only the final deadline argument of one deposit and two redeems differs because the runner's test clock advanced by different amounts. Same-input calldata equality is established separately by check-calldata: **496 identical encodings, 1,773 mutually refused cases, no new refusal**. The unchanged send head and protected handlers/reads/requests/storage/network sinks passed their pins against 586998c.

A pristine `586998c` dist was extracted before rebuilding and supplied as `BASKET_BASELINE_DIST`. Required commands below ran from `web/`; `NODE_OPTIONS='--import tsx'` supplies the existing TypeScript loader.

| Command | Actual result |
| --- | --- |
| `npm run validate` | PASS: live verifyNetwork, runtime/ABI hashes, aggregate snapshot/status and 11 proposal kinds; block 87639398, 25 stocks |
| `node scripts/check-preservation.mjs` | PASS: protected paths, send checks, wording/ABI invariants and obsolete integration scan |
| `node scripts/check-interface.ts` | PASS: arithmetic, parsing, exact balances and setting units |
| `node scripts/check-calldata.mjs` | PASS against 586998c: exact source/call/handler pins, 496 identical encodings and 1,773 mutually refused cases; no new refusal |
| `node scripts/check-art.mjs` | PASS in Chromium and WebKit: 74 manifest copies, 48 layout groups, every title width 320–2560; full gate completed in 1,252.85 seconds |
| `node scripts/check-motion.mjs` | PASS: 39 checks, DPR 1 / 1.25 / 1.5 and reduced motion |
| `node scripts/inspect-export.mjs` | PASS: 24 page/viewport checks across six routes at 320 / 375 / 800 / 1440; zero recorded issues, seven passing contrast pairs |
| `node scripts/check-guards.mjs` | PASS: four send guards; zero sends |
| `node scripts/check-fixes.mjs` | PASS: 34 wallet-hook/Claims regressions |
| `node scripts/check-visibility.mjs` | PASS at 375x812 against 586998c: six pages, no-wallet/connected, 67 prior first-screen elements, only the pinned Deposit heading/displacement exception |
| `node scripts/check-bundle.mjs` | PASS: complete candidate within 8,388,608 bytes, including tracked libraries and all required artifacts; final count in bundle-check.json |

## Better Interface review

Read the pinned workflow, six domain cores, supporting design-critic thresholds and documentation method. Applied them to the supplied change and final export without widening the exact-patch scope. The visual idea remains a supermarket flyer around live vault figures and wallet controls.

| Domain | Coverage and limits |
| --- | --- |
| Accessibility — Checked | Native list buttons and amount labels, plain non-interactive list heading (`web/src/Flows.tsx:667`), visible focus (`web/src/styles.css:95`), stock-add focus, keyboard Tab/Enter removal, skip-link smoke tests and reduced motion. No screen-reader session, complete accessibility audit or full keyboard-only wallet journey. |
| Layout — Checked | New grid spans the panel at 390 and 1440 in the actual production export; 25 live-stock buttons wrap without horizontal overflow. Fork cases verify both empty states, persistence after adding a row and restoration of the owner's closed fold (`web/src/Flows.tsx:347`). Export checks, art sweeps and the 375x812 comparison cover other widths/states. At 390x844 the brand, Connect wallet and Deposit/Redeem navigation are visible; the character precedes the figures as approved. Native 200% zoom, RTL and physical devices remain untested. |
| Writing — Checked | All original Deposit words remain; the heading is a plain line and both explanatory sentences remain (`web/src/Flows.tsx:671`). Confirmed Claim all ends in the approved remaining-owed wording without the zero-stock count (`web/src/wallet.tsx:427`), verified by the fork. No copy was rewritten. |
| Typography — Checked | Flyer and Pixel fonts loaded locally. Rendered list heading is 14px/700 and amount/search inputs are 16px, matching the implemented CSS (`web/src/styles.css:1369`). Browser checks exercise wrapping and widened 24/7 text. Native Windows Chrome/Edge scaling and platform font rasterization are unverified. |
| Colors — Checked | Existing color tokens remain unchanged (`web/src/styles.css:16`). Export review computes seven passing solid pairs (minimum 4.7987:1 for white/red; white/royal 7.4656:1); the taste probe passes measured text contrast, with one image/gradient text box unmeasured. No comprehensive image-pixel or every-state focus contrast audit; only the existing light theme applies. |
| UI — Checked | Production Add/Remove and focused amount behavior in Chromium and WebKit at 390/1440; the fork's preview, approval, pending/recovery, deposit/redeem/claim, connection/account reset and owner/loss flows; empty/full Claims regressions and reduced-motion checks. No real-wallet or live-chain send. DevTools 10% animation playback was not performed. |

The assigned browser tool successfully inspected the export at `/preview/`, including the 390px first screen, the mobile open Deposit grid and the 1440px form after adding a stock. Adding AAPL retained the list and focused its amount field; keyboard removal removed the row while keeping the list open. The browser reported zero console errors/warnings during this review. A supplementary WebKit 26.6 production check passed at 390/1440 with 25 live stocks: Add/Remove, focused amount, plain heading, retained open list and no overflow or script errors. The generated 390px taste screenshot, new empty-Deposit fork capture, Chromium Deposit title, WebKit Redeem title and WebKit mobile open-list capture were also viewed.

The unchanged probe command `node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste`, using external Playwright, completed **10/16 checks**. Passing: render, layout, targets, contrast, eyebrows, glyphs, slogans, copy budget, reduced motion and share metadata. It found no horizontal overflow, text overlap, obscured controls or clipped text at 320/390/1440. First-screen prose was 60 words at 390 and 86 at 1440.

Six existing style flags remain: uppercase headings (`web/src/styles.css:108`), tracking on the figure label (`web/src/styles.css:398`), the established type scale/families (`web/src/styles.css:26`, `:105`, `:186`, `:270`), repeated Pixel marquee (`web/src/styles.css:1100`) and border/shadow flyer surfaces (`web/src/styles.css:221`, `:442`). These are documented exceptions to the general design bar. The explicit exact-patch requirement takes precedence; no source or gate was changed to suppress them. No new applicable defect was found in the changed presentation.

The owner's accepted decisions remain: empty Deposit list open across the panel and persistent for that account, closed fold for a wallet holding listed stock; standalone Vault heading; character before figures on phones; no Change wallet button; the supplied ITEM sentence and ITEM not-live status; initially hidden zero-owed Claims panel; CLOSED-only notice for known closure, with no OPEN sign or normal-operation status line.

## Tooling, packaging and completion

Node **24.21.0**, npm **11.19.0**, Anvil **1.8.5**, solc **0.8.26**, Chromium **153.0.8010.12** and WebKit **26.6** were used. Browser packages/downloads and shared libraries live outside the delivery under `/tmp`. The external WebKit launch configuration supplies the installed shared-library and Mesa paths; no browser workaround changes application code or test assertions. The initial WebKit startup lacked a library search path and was repaired before the rendered checks. The supplementary WebKit interaction test initially timed out using direct browser RPC access; the successful run forwarded only genuine permitted RPC reads through Node, as the required art check does. Its scratch Remove locator was also corrected to the existing stock-specific accessible name; no application or supplied-check change was made. Disposable scripts, logs and extra review captures remain under `test/scratch/`.

**Complete for the stated scope.** The build, typecheck, fork walkthrough and every required gate passed. Final patch/export hashes and all-candidate checks were repeated after documentation: no vault 1–5 address fragment, protected-path change, submodule, nested dependency/cache payload or unnecessary archive. All source, locked dependency manifests, runtime assets, 24 required JPEGs and three DPR PNGs remain complete. Ignore files are unchanged. The complete file-content budget, including tracked libraries and this entry, is recorded in `artifacts/bundle-check.json` and remains below **8,388,608 bytes**. No screenshot recompression was needed.

The six preserved design-probe style flags and the unperformed native-device, native-zoom and assistive-technology checks are the limitations described above. These are worker-side results, not independent certification.

---

# 2026-10-13 — v12 exact patch, vault 6 (incomplete fork verification)

**Incomplete:** the patch and production export are exact, and the independent checks below pass, but the required fork walkthrough could not complete because the archive RPC refused historical state. This run does **not** establish 84/85 browser checks, 70 wallet sends or 24 newly captured fork screenshots. `browser-fork.json` and the 24 `empty-*.jpg` / `stocks25-*.jpg` images retain the preceding run's evidence; their old 74-check result is not a result for this update. No live transaction or publication occurred. Git metadata was not modified, as required; these files are prepared for the submission system.

## Patch and export

Applied to clean `a6e1b4d2eb5988ab8eb7cfc404161f035aa96d84`. The Pinata download for CID `bafybeifqld4r6jdqr4ncmwqhzp53o5bpadu73l2mrx6alwhak3paypnnr4` was **395,142 bytes**, SHA-256 **`881cb6eb0973fca89e36e9df2a72502e319b7b83557f57036a32718d39029230`**. `git apply --check`, `git apply`, and subsequent reverse-application checking passed. SHA-256 values captured immediately after application still match all **18** patched paths. Nothing in the patch was reworded, restyled or rewritten; no check or preservation pin was loosened. Contracts, dependencies, lockfiles, build configuration, pinned integration and ignore files remain unchanged.

`npm ci --cache /tmp/basket-v12-npm-cache`, `npm run typecheck`, and `npm run build` passed in `web/`. The build log is `build-validation.txt`. All five requested production filenames and SHA-256 values match exactly:

| Production file | SHA-256 |
| --- | --- |
| `dist/assets/index-BFEYBx6O.js` | `c88a2cacd5068291197cc2526850ca31223184004fb827d37a52a169f745f7f6` |
| `dist/assets/index-DMUMxJ0Z.css` | `0480e963e928ad5adf873a0fd9b6285aedf474e209d20f0881b508a5210087f8` |
| `dist/assets/ccip-DaOwsnsF.js` | `1b46776c8efcfa1ab8458bb97b1e31acb5230bcd5d589cc80f33ac82f88f4164` |
| `dist/index.html` | `a60077e0ad16890a0d21be2051b52d38153e202a69a1db6acb4c307ae2e1b6c9` |
| `dist/share-card.jpg` | `dc14dd6f4068ec9325426583104b1c6ae8748fbb17d8326863c9612280eacd85` |

The complete export is **968,913 bytes**, with relative runtime asset URLs, local fonts, favicon, all manifest art and licenses. The source and export share cards are both 44,831 bytes and 1200×630. README installation/preview/rebuild instructions and DESIGN.md's implemented tokens, typography, components and responsive behavior were reviewed against the source and retained exactly as patched. Vite's existing >500 kB chunk advisory remains. npm reported one moderate and two high dependency advisories; the authorized locked dependencies were not changed.

## Actual check results

The unchanged `node scripts/run-browser.mjs` was attempted before the following gates. A pristine copy of **a6e1b4d's dist** was saved before the build and supplied as `BASKET_BASELINE_DIST` to the comparisons. Commands ran from `web/`, with the existing locked TypeScript loader (`NODE_OPTIONS='--import tsx'`) and external browser/compiler selections.

| Command | This run |
| --- | --- |
| `node scripts/run-browser.mjs` | **FAIL during fork setup**, before UI sends/captures; archive failure detailed below |
| `npm run validate` | PASS: unit cases, canonical ABI, live **verifyNetwork**, runtime hash, snapshot/status, all 11 proposal kinds; block **87341707**, 25 assets |
| `node scripts/check-preservation.mjs` | PASS: protected paths, integration/send invariants, obsolete-address scan |
| `node scripts/check-interface.ts` | PASS: arithmetic, parsing, balances and setting units |
| `node scripts/check-calldata.mjs` | PASS against a6e1b4d: seven source restorations and all other sources pinned; transaction builders, requests, storage and network sinks preserved; **496** identical encodings and **1,773** mutually refused cases; no new refusal |
| `node scripts/check-art.mjs` | PASS in Chromium and WebKit: **74** manifest asset copies, **48** layout groups; exact status/copy, full-width title sweeps, fallback-font wrapping, strip and shelf geometry |
| `node scripts/check-motion.mjs` | PASS: **39** checks, DPR 1 / 1.25 / 1.5, timing/reset geometry and reduced motion |
| `node scripts/inspect-export.mjs` | PASS: **24** page/viewport checks; six routes at 320 / 375 / 800 / 1440; subpath loading, fonts, keyboard smoke checks, seven contrast pairs, zero recorded issues |
| `node scripts/check-guards.mjs` | PASS: four send guards, zero sends |
| `node scripts/check-fixes.mjs` | PASS: **34** deterministic wallet-hook/Claims regressions; synthetic reads/sends, no external requests |
| `BASKET_BASELINE_DIST=<saved a6e1b4d dist> node scripts/check-visibility.mjs` | PASS: six routes, 375×812, no-wallet and connected; **67** prior first-screen elements considered with only the exact named v12 removals/Docs displacement; normal, freshness and weekend cases |
| `node scripts/check-bundle.mjs` | Initially FAIL at **8,460,795 bytes** with the old screenshot encodings. Final **PASS** after lossless artifact packaging; exact accounting is in `bundle-check.json`. Source/checks/runtime assets unchanged. |

## Archive/tooling limitation

Node 24.21.0, npm 11.19.0, Anvil 1.8.3, solc 0.8.26, full Chromium 153.0.8010.12 and WebKit 26.6 were used. The direct fork attempt failed to create genesis: the archive returned `historical state … is not available`. Disposable scratch adapters retained the runner's read-only proxy and pinned block **83874298**, translated hash references through genuine block responses, limited concurrency, coalesced/cached genuine successful reads and used bounded retries. Later attempts reached account/storage warming but failed with `RPC backend unavailable`, unavailable historical state, connection resets or the unchanged runner's timeout. Preloading the exact required storage reads also exhausted retries. No proof, account, storage value, bytecode or receipt was invented or substituted.

The specified Pocket endpoint and official mainnet RPC both refused a required historical storage read. PublicNode returned HTTP 403: `Archive requests require a personal token`. No credential was guessed or requested. These setup attempts do not count as successful browser validation. In particular the new Speed up receipt/link and delayed Connect/Disconnect walkthrough assertions were not executed here. Transaction equivalence is supported by the passing static/differential gate, not by a new 70-send trace.

Browser tooling and its shared libraries live outside the delivery under `/tmp`; the temporary launchers and adapters are disposable scratch. The browser MCP could not launch because `/opt/google/chrome/chrome` is absent; the actual rendered checks used local Playwright directly. WebKit's external launcher supplies its extracted libraries and Mesa paths. The visibility script's existing transport fallback handled HTTP 403 responses from the first public endpoint. No site asset or test assertion was changed for these environment conditions.

## Better Interface review

Read and applied the pinned workflow, all six domain cores and documentation method within the exact-patch scope. The site's visual idea remains a supermarket flyer around readable vault data and wallet controls. The following is worker-side evidence, not independent certification.

| Domain | Coverage and limitations |
| --- | --- |
| Accessibility — Checked | Native labels/buttons, conditional Claims text (`web/src/Flows.tsx:1141`), keyboard skip-link/focus smoke tests, target geometry and reduced motion. No screen-reader session, comprehensive accessibility audit or full keyboard-only wallet journey. |
| Layout — Checked | Export widths, both engines' 320–2560 title sweeps, 375 baseline comparisons and manually viewed 390×844 probe screenshot. Brand, Connect wallet and Deposit/Redeem navigation are visible on that first screen. Native 200% zoom, RTL and physical phones untested. |
| Writing — Checked | Exact standalone Vault heading/capacity (`web/src/Vault.tsx:199`, `:236`), direct Deposit guidance (`web/src/Flows.tsx:842`), Docs paragraphs (`web/src/Docs.tsx:19`) and quiet Claims state. Owner wording preserved. |
| Typography — Checked | Local Flyer/Pixel fonts load; inputs are 16 px; whole-word 24/7 fallback wrapping passes in both engines (`web/src/styles.css:596`). Native Windows font rasterization/scaling remains unverified. |
| Colors — Checked | Seven measured solid pairs pass: minimum 4.7987:1 for white/red; white/royal 7.4656:1. Probe contrast passes, with one image/gradient box unmeasured. Not every image pixel or focus/background combination was audited. One light theme; dark theme not applicable. |
| UI — Checked | No normal-operation status, CLOSED-only known-closure states, unknown-status retry, direct guidance, Claims visibility/persistence/reset/retry states and guarded sends exercised by the passing gates. Full fork transaction journey and DevTools 10% motion playback remain unperformed. |

The unmodified taste probe ran with `IMD_PLAYWRIGHT=<scratch launcher> node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste`: **10/16 checks passed**. Render, layout, targets, contrast, eyebrows, glyphs, slogans, copy budget, reduced motion and share metadata passed. No horizontal overflow, text overlap or clipped text was reported at 320/390/1440. First-screen prose: 60 words at 390, 86 at 1440. Six style flags remain in the prescribed design: uppercase headings (`styles.css:108`), tracked figure label (`:393`), the established type sizes/families, repeated Pixel marquee (`:1100`) and border/shadow flyer surfaces (`:221`). These are recorded exceptions to the general design bar; the explicit exact-patch rule prevents restyling them. No new source fix was made for a design preference.

Manually inspected the actual 390 and 1440 probe screenshots, the Chromium Deposit and WebKit Redeem 375 title captures, the live export captures and the supplied share card. Those new review captures remain scratch and are not replacements for the required fork captures. Accepted owner decisions are retained: standalone Vault heading; character before figures on phones; no Change wallet button; ITEM wording and not-live status; hidden zero-owed Claims panel; no OPEN sign or normal-operation status line.

## Delivery packaging and evidence boundary

The initial bundle failure was repaired without changing a pixel: the **24 historical screenshots** were losslessly repacked with `jpegtran -copy all -optimize -progressive`, saving **149,896 bytes**. Before repacking each source JPEG was checked against a6e1b4d; decoded PPM bytes were then compared exactly before/after. `screenshot-packaging.json` records original, packed and decoded-pixel SHA-256 values. Their original quality/content is preserved; they are **not** the requested new quality-26 fork screenshots. The bundle gate's static quality-26 description does not establish that regeneration happened.

All required source, runtime assets, screenshots, prior validation entries and regenerated passing reports are retained. No dependency/cache directory, browser/compiler binary, registry mirror or submodule is delivered. Final patch/export hashes, protected-path checks and a byte scan of every candidate file (tracked libraries included; task inputs and scratch excluded) were rechecked. No vault 1–5 address fragment was found. The complete byte count is in `bundle-check.json` and includes this entry and the packaging evidence. The remaining blocker is the required fork walkthrough and its regenerated trace/screenshots, not a requester design decision.

---

# 2026-10-13 — v11 exact patch delivered on vault 6

Complete for the stated scope, subject to the owner's explicitly accepted findings below. This entry records this run (Europe/Berlin date; machine logs begin on 2026-10-12 UTC). Applied the supplied patch unchanged to `507f2b164160ed7b1361bac55b67bac76a0f3d38`. Source, rebuilt `dist/`, and regenerated artifacts are prepared for the submission commit. Git metadata was not modified. No contract was changed, deployed, replaced or re-minted; no live transaction or publication occurred. Older entries below describe earlier runs only.

## Exact patch and export

- Downloaded the specified Pinata CID `bafkreialgxix5c44nx7prq64afjx3qxchcn3mqmevqdbhws42src7moebm`: **246,058 bytes**, SHA-256 **`0b35d17e8b9c6dfef8c3dc01537dc2e2389bb64184ac0613da5cd4a22fb1c40b`**. Both matched before `git apply --check` and `git apply`, which passed on the requested clean base.
- All **12** patched files match the post-patch Git blob hashes embedded in the patch; their full SHA-256 values were also captured immediately after application and checked again at completion. Reverse-application checking passes. No source, assertion, preservation pin, wording, style or transaction was changed beyond that patch. `Vault.tsx`, `web/index.html`, public art, pinned contracts, build configuration, package manifests and lockfiles remain unchanged.
- `dist/assets/index-O9B-ydQc.js`: **`b00c8fc2424b865d0cad1562d1a719509f2d59283c42a5c455b638b5a3f7c9ef`**.
- `dist/assets/index-D1E9mcXX.css`: **`cc2fbd60fd75bf20cf245e771ba6062f4f5a6e3b9e306ce8d9d0544ecd2c4330`**.
- Both filenames and output hashes match the requested values exactly. The complete **920,374-byte** static export includes relative asset URLs, the companion JavaScript chunk, local fonts, favicon, all art and license files. The final complete candidate count, including tracked libraries and this entry, is in `bundle-check.json` and remains below **8,388,608 bytes**. All 24 required JPEGs and three existing DPR captures are retained. No dependency directory, package cache, registry mirror, dependency archive or submodule is submitted; the ignore file was unchanged.
- The patched README explains installation, preview and rebuilding. The patched DESIGN.md was checked against the final source for tokens, local fonts, the one-column Deposit form, responsive rows, disclosure list and Disconnect sizing; its exact patch text is retained.

## Actual verification

Commands ran from `web/` unless stated otherwise. `npm ci --cache /tmp/basket-npm-cache`, `npm run typecheck` and `npm run build` passed. The regenerated `build-validation.txt` records the final typecheck/build. Vite retains its existing >500 kB chunk advisory. Dependencies and their lockfile were not updated.

The unchanged `scripts/run-browser.mjs` ran before the other gates. It used `NODE_OPTIONS='--import tsx'`, the existing locked TypeScript loader, and the external tool selections described below. A copy of **507f2b1's dist** was saved before rebuilding and used for visibility comparison.

| Command | Actual result |
| --- | --- |
| `node scripts/run-browser.mjs` via the temporary read-only archive adapter | **PASS: 74 checks, 70 wallet sends, 24 screenshots**, fork **83874298**, zero recorded issues |
| `npm run validate` | **PASS**: unit cases, canonical ABI, live **verifyNetwork**, runtime hash, aggregate snapshot/status, all 11 proposal kinds; live block **87068344**, 25 listed stocks |
| `node scripts/check-preservation.mjs` | **PASS**: protected source/configuration, send guards, ABI/wording invariants and obsolete integration scan |
| `node scripts/check-interface.ts` with the TypeScript loader | **PASS**: interface arithmetic, parsing, exact balances and setting units |
| `node scripts/check-calldata.mjs` | **PASS against 507f2b1**: frozen files/restored pieces, independently pinned calls/state writes, send/approveAll/onSubmit/getSpec equality, network/load sinks and differential calldata; no new refusals |
| `node scripts/check-art.mjs` | **PASS in Chromium and WebKit: 74 manifest asset copies, 32 layout groups**, full title-width sweeps and tag/strip/shelf assertions |
| `node scripts/check-motion.mjs` | **PASS: 39 checks**, DPR 1 / 1.25 / 1.5, strip timing/reset geometry, one-time shelf motion and reduced motion |
| `node scripts/inspect-export.mjs` | **PASS: 24 page/viewport checks**, six routes at 320 / 375 / 800 / 1440; subpath navigation, local fonts, overflow, keyboard smoke checks, seven contrast pairs; zero recorded issues |
| `node scripts/check-guards.mjs` | **PASS: four send guards, zero sends** |
| `node scripts/check-fixes.mjs` | **PASS: nine regressions** using the actual wallet hook and Claims component |
| `BASKET_BASELINE_DIST=<saved 507f2b1 dist> node scripts/check-visibility.mjs` | **PASS**: six routes at 375×812, no-wallet and connected; **47** prior first-screen elements retained with the same words, none moved or removed |
| `node scripts/check-bundle.mjs` | **PASS**: complete candidate below 8 MiB; required runtime assets and screenshots retained |

`browser-fork.json` records actual production UI actions against the original vault bytecode on the isolated fork. The 13 additional checks cover wallet-owned rows, small-balance disclosure, search/Enter behavior, the full open-stock disclosure, blocked-price rows and Refresh, open/closed status, estimated total, receipt-derived BASK, cleared redeem amount and local Disconnect/reload/reconnect without revoking permissions. The alphabetical comparator was reviewed in source; the runner's stock-list fixture is already alphabetical, so that fixture alone does not demonstrate sorting an unordered list. The existing listing/recovery, approvals, sends, ownership, losses and proposal coverage remains.

An additional ordered comparison against the original `artifacts/browser-fork.json` from 507f2b1 found **all 70 destinations, functions, arguments and gas values identical**, apart from the final deadline argument in one deposit and two redeems, which follows the test clock. The static/differential calldata gate separately verifies identical calldata for identical inputs with a fixed clock. All wallet sends were on the local fork. The 24 empty/populated screenshots were regenerated at 1440 and 375 pixels with the patch's JPEG quality **32**.

## Better Interface review and owner decisions

Read the pinned workflow, all six core domains and implementation-documentation guidance. Reviewed the affected forms/header within the established supermarket-flyer design, the actual production export, and the patched README/DESIGN.md. No design preference was used to rewrite the exact patch.

| Domain | Coverage and limits |
| --- | --- |
| Accessibility — Checked | Native labeled inputs/buttons/details, stock-specific accessible names, permanent search status region, receipt status, focus moved to added rows and away from removed controls (`Flows.tsx:108`, `:515`, `:617`, `:665`, `:849`). Fork interaction/focus checks, skip-link smoke test, target checks and reduced motion ran. Full keyboard-only wallet journeys, screen-reader sessions and a comprehensive accessibility audit were not performed. |
| Layout — Checked | One-column form and responsive rows (`styles.css:1148`, `:1175`, `:1442`), empty/populated phone and desktop captures, four-width export checks, baseline visibility and art geometry sweeps. The 390×844 first screen shows the brand, Connect wallet, Deposit/Redeem navigation and refresh; the character precedes the figures as approved. Native 200% browser zoom and RTL were not tested. |
| Writing — Checked | Exact search/disclosure labels, per-stock price reason and Refresh, explicitly estimated dollar total, receipt-derived "You received … BASK", and local Disconnect explanation. Source and browser checks agree with the supplied wording. No copy was rewritten. |
| Typography — Checked | Local Flyer/Pixel loaded, 16px inputs, desktop/phone row wrapping and amount controls inspected. Arial resolves to Liberation Sans on this machine. The existing multiple sizes/families, uppercase headings and pixel slogan remain intentional frozen design. Other platform font substitutions and native display scaling are not verified. |
| Colors — Checked | Existing tokens retained. `export-review.json` records seven solid pairs, from 4.80:1 (white/red) to 13.83:1 (ink/paper); white/royal is 7.47:1. The rendered taste probe passes measured text contrast, with one image/gradient text box unmeasured. This does not certify every pixel or focus/background pairing. Only the existing light theme applies. |
| UI — Checked | Empty/populated and blocked-price states, Max/Remove/search/list disclosure, preview/approval/success, local Disconnect and reload, receiver/claims and failed-read recovery exercised. Motion tests verify strip resets/speeds and cancellation under reduced motion. DevTools 10% playback, physical phones and native Windows scaling were not performed. |

The pinned design probe ran from the repository root using `node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste` with the external Playwright module. It completed, **9/16 checks passed**. Passing: render, layout, targets, contrast, eyebrows, glyphs, slogans, copy budget and reduced motion. Flagged: casing, tracking, type sizes, type families/monospace slogan, repeated animated slogan, border-plus-shadow decoration, and missing Open Graph tags. These concern the retained flyer system and frozen page shell (`styles.css:102`, `:174`, `:221`, `:393`, `:1030`; `Vault.tsx:183`; `web/index.html:3`). No horizontal scroll, overlapping text, obscured controls or clipped text was measured at 320/390/1440. The probe is supplemental evidence, not a replacement for the gates, and its raw style flags are not claimed as passes. The exact-patch instruction takes precedence over those design-bar preferences.

The owner's four accepted findings remain explicitly deferred, with no patch or pin edits:

1. **Phone ordering:** the character panel preceding vault figures is the approved design (`Vault.tsx:168`, `styles.css` phone title rules). The 390px screenshot confirms this order; no change was made.
2. **Pending Connect race:** a delayed `eth_requestAccounts` reply can undo a later Disconnect after an intervening account event (`wallet.tsx:202`, `:234`). The owner defers this scenario. This run does not claim a timing measurement or a fix; the required guarded initial account-read and normal Disconnect checks pass.
3. **Open Graph:** `og:title` and `og:image` are absent from the frozen shell (`web/index.html:3`). Title, favicon and description are present. The owner defers the missing tags; the probe reports them honestly.
4. **Fallback-only 24/7 label overflow:** the approved one-line tag remains unchanged (`styles.css:516`). The owner accepts the reported DejaVu Sans-only overflow where Arial/Helvetica and metric-compatible fallback fonts are unavailable. This environment has a metric-compatible fallback and the complete art check passed; the narrow fallback-font exception was **not invoked**.

Viewed the generated `empty-deposit-375.jpg`, `stocks25-deposit-375.jpg`, `stocks25-deposit-1440.jpg`, `stocks25-redeem-375.jpg` the probe's 390px first-screen screenshot, and the WebKit 375px Deposit title capture. These confirm the reviewed composition; they are not a claim of manual inspection of every pixel in all 24 captures. Probe and extra inspection captures remain disposable scratch. No additional source correction was authorized or made.

## Tooling and limitations

Node **24.21.0**, npm **11.19.0**, Anvil **1.8.3**, solc **0.8.26+commit.8a97fa7a**, Chromium **154.0.8037.0** and WebKit **26.6** were used. Playwright/browser/compiler tooling is external to the delivery. Chromium uses the full installed build, matching the prior runs' font-metrics setup. WebKit and missing shared libraries/Mesa components were installed only under `/tmp`; its launch environment supplies the library and EGL vendor paths. No font or site asset was substituted to satisfy a check.

The default fork attempt failed before the walkthrough because Anvil requested historical state by a bare block-hash string, which the archive refused. Early adapter attempts encountered HTTP 429 and a too-serial batch connection failure. The successful temporary adapter retained the runner's own read-only proxy, mapped state block-hash references through `eth_getBlockByHash`, forwarded genuine answers from `https://robinhood.api.pocket.network`, coalesced/cached exact reads, limited concurrency to four and spaced completed upstream reads by 150 ms with bounded transient retries. It did not fabricate proofs/accounts or overwrite vault state/bytecode. The pinned block and all assertions stayed unchanged. Failed setup attempts are not counted as successful validation.

The first art attempt stopped when WebKit could not create an EGL display. Missing external Mesa support was repaired. A later invocation was externally terminated with exit 143 before a result, so the unchanged check was rerun with periodic progress output; no assertion was removed or weakened. Only the completed result above counts. Source, artifact and export integrity were rechecked at completion, including a byte scan of every candidate file (tracked libraries included, task inputs and disposable scratch excluded): no vault 1–5 address fragment. Native devices, assistive-technology sessions, native zoom and live wallet transactions remain unperformed. Existing compiler evidence is historical; this task does not regenerate the ABI or change any contract. These are worker-side results, not independent certification.

---


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


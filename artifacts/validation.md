# 2026-10-09 — manifest art, slogan loop and bounded site fixes

This dated entry supersedes the earlier artwork/marquee descriptions and records the current delivery. The previous review is retained below as history. Scope: the six existing routes, current vault `0x4e19d7472e650399b06eeaa5ccc29da9b8efbebd`, chain 4663. No deployment or live transaction was performed. The supplied historical deployment input describes an older vault; this task explicitly preserves the current website integration, which was verified against its unchanged runtime and ABI.

## Implementation and integrity

- Downloaded the manifest from the required Pinata URL; SHA-256 `2d22583bb51557f412a6894d897cfc3bb839d31850fd676a6d0746cd61a588fa`. All 37 downloads matched both size and hash. The manifest and files remain byte for byte. `art-validation.json` lists all **74** public/export asset copies, their bytes and SHA-256 values, including the food MIT license.
- The only source changes are Scenery, styles, the specified picture/import lines in Vault/Flows and item 6’s gas, owed-read wording, directLimit wording and pending recovery. Contracts, chain, model, ABI, other routes, dependency manifests/lockfiles and existing build configuration are unchanged. `check-calldata.mjs` compares the baseline AST: **81** vault/token/feed/read/encode/simulation/wallet-request call expressions remain identical across the permitted files; protected integration files are byte-identical. Gas changes do not alter calldata.
- Local contained images replace the former people. The owner’s character is the only person. Static ordered food rows replace the old SVG pattern; both shelf locations use one responsive system. The original BasketIcon, flyer colors/frames, floor and word-only bursts remain. Two equal slogan halves loop continuously, clipped only by overflow, with reduced-motion disabling animation. No pause control, extra route, package, service, tracker or cookie was added.
- Deposit joins redeem/claim’s rounded estimate ×1.3 gas rule. Incomplete stock lists cannot say nothing is owed. directLimit now describes all-or-nothing direct attempts. Pending records save their nonce and clear a replaced hash once the confirmed account nonce passes it; queued nonces still block listing. Legacy records use the original transaction’s nonce when the RPC retains it, never a guessed nonce.

## Better Interface coverage and corrections

The pinned workflow, six domain cores, documentation method and licenses were read and applied within the assignment’s scope. Root DESIGN.md describes final tokens, typography, components and breakpoints; all contradictory README/DESIGN descriptions were updated. Guidance notices remain in `web/validation/DESIGN-GUIDANCE-LICENSE`.

| Domain | Coverage and evidence |
| --- | --- |
| Accessibility — Checked | Assigned alt text, empty-alt/aria-hidden food decoration, native controls and skip-link keyboard behavior, actual Retry vault recovery, readable loaded fonts, existing 44px controls, reduced motion. No screen-reader or full automated accessibility audit; the owner’s explicit no-pause requirement takes precedence over the guide’s autoplay-pause recommendation. |
| Layout — Checked | Six routes at 320, 375, 660, 661, 800, 960 and 1440px in Chromium/WebKit. No horizontal overflow; square shelf icons and complete repeated rows, including the Vault copy. Picture heights/containment, bubble bounds and responsive frames asserted. Final screenshots viewed at desktop, intermediate and phone widths. |
| Writing — Checked | Exact supplied speech, unchanged existing route copy except the specified gas/claims/directLimit fixes, consistent Stock Tokens wording. No invented prices, numbers or brands in decoration. |
| Typography — Checked | Existing local Flyer/Pixel faces and body typography retained; bubble Flyer at 18px/1.4 and 15px on phones, no case transformation. Narrow bubbles wrap without covering the character or escaping their frames. Inputs remain 16px. |
| Colors — Checked | Existing palette retained; new bubbles use ink/white. Seven existing solid-color pairs measured by export review, all ≥4.5:1; ink/white is 13.83:1. This does not certify every anti-aliased/image pixel. |
| UI — Checked | Whole character images, still food rows/bubbles, visible word bursts, unchanged control states and forms. Chromium/WebKit loop samples and reduced motion; Chromium title/brand/burst geometry at DPR 1/1.25/1.5. |

Findings and fixes:

- Medium, `web/src/styles.css:1031`, `web/src/Scenery.tsx:1`: paint containment and unequal old repeated content could leave the iOS marquee blank. Removed paint/isolation and pause state/control; equal halves cover the viewport throughout the loop. Both engines pass at 375/2560px; loop screenshots were visually inspected.
- Medium, `web/src/styles.css:1238`: larger shelves moved existing phone content below the screen. Baseline production exports were compared at **375×812**, on all six routes both without a wallet and with the live owner account connected read-only. A 50px shelf (22px icons, 3px ink-edged red planks) and 4px gap above its frame preserve every previously fully visible tested form control/message. Text and form layout were not reduced. `phone-visibility.json` records the original visible elements and zero regressions.
- Medium, `web/src/styles.css:1299`: early bubbles either floated too far from the head or became too narrow at the tablet boundary. Bubbles now occupy free space; the narrowest tablet Redeem stage grows upward above the bag. Whole frames, exact speech and no overflow were rechecked. Across **42** browser/page/width measurements, bubble rectangles intersect no source image pixel with alpha >128 at its rendered coordinates. Face, hands, props and WOW! remain unobscured; tails were inspected visually. Review-only extra captures stay in disposable scratch, not artifacts.
- High, `web/src/wallet.tsx:227`: three-stock deposits need the same gas padding already used by redemption/claim. The fork’s three-stock deposit succeeds with explicit padded gas and exact approvals; no transaction argument changes.
- Medium, `web/src/Flows.tsx:836`, `web/src/governance.ts:344`, `web/src/wallet.tsx:60`: missing stock reads could imply zero owed, directLimit wording implied partial direct attempts, and replaced pending hashes could hold listing indefinitely. Deterministic tests exercise actual components/hook: advanced nonce, retained/forgotten original hash, confirmed receipt, unchanged nonce, another queued transaction, wait/retry recovery, incomplete/complete owed states. Nine regression checks pass.

## Actual verification

The unchanged web lockfile was installed in `/tmp/basket-art-task/web`; npm/browser caches, Playwright, downloaded browser binaries and unpacked system libraries stayed outside the repository. No tool dependencies or archives are delivered. WebKit 27.2 ran using temporary Mesa/system libraries; Playwright’s host-package inventory probe was bypassed because it consults the system ldconfig cache rather than those temporary libraries. Actual WebKit launches, rendering and all behavioral assertions ran. No project check was disabled.

- `npm run typecheck`, `npm run build`: **PASS**. Latest build includes `tsc --noEmit`, 1099 transformed modules, local relative assets in root dist. Vite’s existing >500kB chunk advisory remains (543.47kB main JS); no build configuration was changed.
- `npm run validate`, `npx tsx scripts/check-interface.ts`: **PASS**. Current chain/runtime, canonical ABI, live aggregate/status reads, all eleven proposal payloads, amount/minimum/pool arithmetic and directLimit wording.
- `SOLC=... npx tsx scripts/regenerate-abi.ts`: **PASS** in the disposable copy. Canonical ABI `0x2ca94bfa453d0916a493f52ad214ffbc92948b7535854c9447810fbca2ff0b25`, runtime `0x0419f8e9496a55eaafb9b3fa203d459cc7f82fdac17359c11f51c2e59a5f64fe`, 23,736 bytes; generated copies match the protected originals.
- `node scripts/check-calldata.mjs`, `node scripts/check-preservation.mjs`: **PASS**, including unchanged protected sources/configuration, no abandoned integration text and the baseline call comparison.
- `node scripts/check-guards.mjs`: **PASS**, four injected account/chain/code/simulation failures, zero sends.
- `node scripts/check-fixes.mjs`: **PASS**, nine regression checks of actual wallet/Claims code with isolated mocked reads.
- `node scripts/inspect-export.mjs`: **PASS**, 24 page/viewport combinations at a relative hosting subpath, local fonts, keyboard skip link, no-wallet recovery, reduced motion and no console/resource errors. All observed outside requests are the two configured chain RPC endpoints; six pages at 1440/375px included.
- `node scripts/check-motion.mjs`: **PASS**, 33 scroll/loop checks at DPR 1, 1.25 and 1.5. Marquee geometry sampled at 375, 661, 1440, 1920 and 2560px.
- `node scripts/check-art.mjs`: **PASS**, 74 asset hashes/sizes, both engines at seven responsive widths across six pages, exact picture dimensions/speech, contained bubble boxes, and complete slogan loops at 375/2560px with no Pause button. Reduced motion remains still; normal loops remain 180s/45s.
- `BASKET_BASELINE_DIST=... node scripts/check-visibility.mjs`: **PASS**, twelve baseline/current phone comparisons, no-wallet and connected states.
- `BASKET_RPC=https://robinhood-rpc.publicnode.com npx tsx scripts/run-browser.mjs`: **PASS** on current-vault fork block **83771508**, **51 checks, 68 confirmed wallet sends and 24 screenshots**. Every original transaction control ran, including all eleven proposal payloads and execution, exact approvals, three-stock deposit, redemption, individual/aggregate claims, listing timeout/reload/resume, pause/unpause, close, retire/remove, lower cap, cancel, deficit/loss and transfer/accept ownership. The production vault runtime/storage were never overwritten. `browser-fork.json` records decoded sends and the actual fork results. Final conservative size accounting is in `bundle-check.json`. The 24 required JPEGs are retaken at **quality 40**, retaining all empty/25-stock views; no new artifact images are added. Earlier development attempts caught a search filter in the new third-stock test, an originally empty retirement fixture that the new deposit had funded, and the expected-approval list needing the third amount. Those assertions remain and were corrected to the explicit FIG/OAT/S01 fixture; every original button check is retained. An upstream RPC also briefly returned an HTML challenge; the final fork uses the other configured public RPC. Failed attempts are not counted as passes.

Completion: **Complete for this bounded assignment**, with the concrete limitations below. All requested automated/browser/fork checks passed against the final export; this is worker-side evidence, not independent certification.

Limitations: Linux Chromium/WebKit automation is not physical iPhone Safari or native Windows display scaling. Screen-reader sessions, native 200% zoom and every possible composited contrast pair were not tested. Fork fixtures are disposable and do not assert the availability/economics of future live Stock Tokens. A pre-update pending record without a saved nonce cannot reconstruct it if the RPC has already forgotten the original transaction; unknown state stays guarded.

---

## Previous validation entry (historical)

# Basket Protocol interface validation

This is a worker's evidence record, not independent certification. Scope: the six existing website pages and the original vault 5 integration at `0x4e19d7472e650399b06eeaa5ccc29da9b8efbebd`, chain 4663. No contract source, ABI, deployment constant, existing build configuration, dependency manifest or lockfile was changed. The supplied historical deployment manifest describes an earlier vault; the explicit assignment and existing verified vault 5 integration remain authoritative.

## Coverage and limitations

| Better Interface domain | Coverage | Evidence and limits |
| --- | --- | --- |
| Accessibility | Checked | Native forms/details/buttons, visible labels, action-local live regions, full wrapped addresses, disabled reasons, 44px targets, 16px inputs, keyboard skip link and section focus, reduced motion. No screen-reader or physical-device session. |
| Layout | Checked | All six production pages at 320, 375, 800 and 1440px; no horizontal overflow in the recorded export review. Empty/25-stock fork screenshots are separate evidence. Native 200% browser zoom and RTL are not verified. |
| Writing | Checked | Stock Tokens wording, unchanged banner, explicit receiver ownership, plain action sequence, loading/failure distinction, named approvals/batches, line-numbered parser errors, correction and pending recovery. |
| Typography | Checked | Local fonts; full addresses and exact balances; no text rotation or press scaling. Title eyebrows use Arial 14px/20px and fixed desktop heading size. Geometry checks at Chromium DPR 1/1.25/1.5 do not verify Windows glyph rasterization. |
| Colors | Checked | Solid pairs measured in `export-review.json`: white/royal 7.47:1; ink/paper 13.83:1; white/red 4.80:1; ink/sun 10.16:1; error/paper 8.01:1; disabled text/surface 5.12:1. Primary hover/focus/active explicitly use paper on ink. No dark theme exists. |
| UI | Checked | Paint-contained repeated marquee; original SVG wrist/shopper/cashier; fixed-aspect repeating shelf; compact stock cards, selected amount list, owed-first claims and folded zero rows; owner disclosures and pending recovery. Native Windows Chrome/Edge is unavailable. |

## Findings and fixes

- High — `web/src/styles.css:1100`: generic hover specificity overrode primary backgrounds. Explicit primary hover/focus/active colors retain readable labels; disabled primaries use the shared muted colors.
- Medium — `web/src/Scenery.tsx:2`, `web/src/styles.css:1088`: the original desktop track was shorter than the strip. Eight repeated units cover up to 2560px with a seamless half-track loop; phone text/45-second timing stays intact. Animation is paint-contained and reduced-motion/pausing still work.
- Medium — `web/src/styles.css:1292`: rotated sign/stickers and press scaling transformed text. Removed these transforms, used fixed heading dimensions and normal title eyebrow type. Linux DPR geometry checks pass; native Windows scrolling remains unverified.
- Medium — `web/src/Scenery.tsx:93`: detached waving wrist and cart embedded in the belt. Replaced the wrist with a continuous outline and provided distinct unloading/handover scenes. Shelf packages repeat in native SVG pattern units, filling the frame without stretching.
- High — `web/src/components.tsx:139`, `web/src/wallet.tsx:180`, `web/src/Flows.tsx:724`: consequential progress was remote from actions. Local status now names checks, wallet prompts, hashes, confirmations and refreshes. Rejections/timeouts retain failure state; confirmed redeem/claim rereads remaining debt and its owner, and proposal results reread ID/readyAt.
- High — `web/src/Owner.tsx:60`: unchosen dropdowns fell back to the first token. Every stock choice starts blank, must be explicitly chosen, shows symbol/address and survives refresh until removed.
- High — `web/src/Owner.tsx:320`, `web/src/model.ts:226`, `web/src/governance.ts:230`: listing errors discarded earlier results and skipped mismatched listed configurations. Progressive row results retain failures with line/symbol, block marked rows, compare all four configuration fields and block Finalize for unlisted pasted rows.
- High — `web/src/wallet.tsx:53`, `web/src/Owner.tsx:320`: listing retries could duplicate an unresolved transaction. Session storage retains the hash; receipt and pending/latest nonce checks gate resumption, including after reload. No cookies or services were added.
- High — `web/src/governance.ts:230`, `web/src/poolMath.ts:35`: missing pool depth/gap feedback. Exact wrapped cumulatives, floor-rounded tick and harmonic liquidity arithmetic mirror the pinned oracle; `observe([1800,0])` drives liquidity multiples, gap percentages, blocking thresholds and the 1.5× warning. An initial browser-clock comparison found by the fork test was corrected to use chain block time.
- Medium — `web/src/Flows.tsx:39`, `web/src/Vault.tsx:50`: expanded 25-stock content hid tasks. Search preserves selected amounts and contract order; Details keeps quantities and failures visible; claims lead with Claim all and nonzero/unreadable entries. Every amount has exact Use full balance.
- Medium — `web/src/Owner.tsx:558`, `web/src/governance.ts:346`: raw settings and long controls obscured intent. Added plain units beside raw current/proposed values, explicit UTC hours semantics, directLimit explanation, section focus controls and folded forms.

- Medium — `web/src/Flows.tsx:465`, `web/src/Owner.tsx:663`: successful reads still displayed Retry controls. Balance/claim Retry now appears only after failure; proposal refresh uses Reading, Refresh or Retry according to its state. A successful zero claim read explains that nothing is owed.

## Commands and evidence

Dependencies were installed from the unchanged `web/package-lock.json` in `/tmp/basket-task/web`; all package/cache directories remained outside the repository. Existing dependency installation reported three audit advisories; dependency changes were outside the authorized scope.

- `npm run typecheck` and `npm run build`: pass; static Vite export with relative asset URLs. Vite reports the existing single-chunk size advisory (about 547kB minified JavaScript).
- `npm run validate`: pass; live runtime hash, canonical ABI, aggregate reads, amount/minimum arithmetic, all eleven proposal payloads.
- `SOLC=... npx tsx scripts/regenerate-abi.ts`: pass in the disposable copy; generated ABI exactly matches the repository. Runtime is 23,736 bytes with the unchanged pinned hash.
- `npx tsx scripts/check-interface.ts`: pass; line/checksum/minLiquidity errors, exact units, settings, tick limits and harmonic liquidity arithmetic.
- Original-versus-final calldata comparison: pass for deposit/redeem inputs with frozen time and all eleven proposals; `calldata-comparison.json` records the comparison against task-start Git source.
- `node scripts/check-guards.mjs`: pass; injected account, chain, runtime-hash and simulation failures each produce zero sends.
- `node scripts/inspect-export.mjs`: pass; 24 page/width combinations at `/preview/`, local fonts, keyboard skip link, no-wallet recovery, reduced motion, no console/resource failures or overflow.
- `node scripts/check-motion.mjs`: pass; 33 geometry/loop checks. Six pages at Linux Chromium DPR 1, 1.25 and 1.5; strip coverage sampled at five loop positions at 375, 661, 1440, 1920 and 2560px. Native Windows Chrome and Edge were not available.

- `npx tsx scripts/run-browser.mjs`: pass on the vault 5 fork at block **83597609**; **51 checks, 67 confirmed wallet sends, 24 screenshots**, six pages at 1440px and 375×812px, empty and with 25 listed stocks. Every transaction control was exercised, including all eleven proposals and their execution, cancel, transfer/accept ownership, pause/unpause, close, remove retired, lower cap, deficit/loss, deposit, redeem, individual claim and Claim all.
- Listing checks additionally exercised insufficient pool liquidity, excessive pool/feed gap, a marked pairing, a declined wallet prompt, an accelerated receipt timeout (the production timeout remains 180 seconds), retained hash, pending nonce on reload, mining and resume without duplicate sends. Exact approval amounts, ordered tokens, minimum arithmetic and estimated redeem/claim gas were checked.
- `browser-fork.json` contains decoded sends and results. `empty-{page}-{1440|375}.jpg` and `stocks25-{page}-{1440|375}.jpg` are the 24 required captures. Named solid-color contrast tests do not certify every composited pixel; claim batching on the fork used two owed tokens, while the production loop still groups at most ten in original order.
- Repeated setup attempts stopped before UI checks when Anvil could not mine fixtures. An explicit diagnostic mine exposed a pruned block-history system-contract storage read. The runner now warms the next 512 genuine block-history slots, as well as account/vault reads, before the RPC prunes the pinned block; no code or storage is overwritten. It also warms the existing SDK Multicall3 deployment. Setup receipts use bounded direct polling. Failed setup attempts are not counted as passed UI checks; production receipt timing is unchanged. The successful final run also exercised the existing per-call fallback when optional Multicall3 discovery was unavailable after pruning. The added warm read prevents that avoidable setup condition on subsequent runs.
- A screenshot race briefly captured a large blank remainder after claim loading collapsed 25 rows. The final capture waits for read/layout stability. JPEG quality 48 preserves all required views within the byte budget. No runtime assets or source dependencies were removed for size.
- `node scripts/check-preservation.mjs` and `bundle-check.json` cover unchanged protected files, no submodules, no dependency/cache payloads, current integration identifiers and conservative complete candidate byte accounting including tracked contract libraries.

## Completion

Useful source and static export are delivered. Required native Windows Chrome/Edge scrolling checks at 100%, 125% and 150% remain unperformed; Linux Chromium emulation is not a substitute. Therefore full assignment verification is **incomplete**, even where the local checks pass.

Design guidance: pinned Better Interface (Jakub Krehel, MIT), with documentation method from Impeccable (Paul Bakaus, Apache-2.0). Both notices/licenses are preserved in `web/validation/DESIGN-GUIDANCE-LICENSE`. The six domain cores and document-web-design section were read and applied; the final implementation is documented in root `DESIGN.md`.

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

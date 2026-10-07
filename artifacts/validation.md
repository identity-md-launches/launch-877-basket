# Redesign validation — 2026-10-08 (Europe/Berlin)

## Scope and assumptions

Completed the existing Vite/React website redesign, four-item menu, public footer routes, deposit reset and phone card layouts. The deployed vault remains `0xd77a5f93f9d85e6990f389147713a9ad8ce5764c`, chain 4663. The supplied deployment metadata still describes the older launch; the assignment's explicit vault and the existing verified `web/src/deployment.ts` binding take precedence. No contract source, dependency, lockfile, existing build configuration, ignore file, Git metadata or external deployment was changed.

The Vault already used stock cards. Its stock fields/prices/availability/address links were preserved and made single-column on phones. Both uses of Owner's pairing table use one card per stock on phones, including the mismatch mark. Claims are displayed on Redeem and kept mounted under `hidden` elsewhere to preserve their existing reads.

The final production export is `dist/`. The bounded Playwright runner served that export under `/preview/`, exercised fixture and live contexts, and closed its browser/server. No new external service is used: runtime requests remain the existing RPCs and user-activated explorer/social links. The local Damion font carries its OFL license. All SVG/CSS artwork is original geometric work, without commercial brands, film references, numerals, currency or price tags. The existing Basket/BASK caption is retained; it is the site's own project identity, not a product label or price.

## Actual commands and outcomes

Dependencies were installed with the unchanged `web/package.json` and `web/package-lock.json` in `/tmp/basket-redesign/web`, using `npm ci --prefix /tmp/basket-redesign/web --cache /tmp/basket-npm-cache`. Source/public/scripts/validation were mirrored there for checks; outputs were copied back. No repository `node_modules` or cache was created. Commands below ran from that mirrored `web/`, except the read-only source-preservation check, which points back at the actual checkout.

| Command | Actual outcome / evidence |
| --- | --- |
| `npm run build` | Exit 0; final TypeScript/Vite production export. Non-fatal >500kB JS advisory. `build-validation.txt` |
| `npm run typecheck` | Exit 0, separate `tsc --noEmit`. `build-validation.txt` |
| `npm run validate` | Exit 0; canonical ABI, exact runtime hash/chain, input/math/feed-prefix/headroom checks and 23 live read-only action simulations. `live-check.txt`, `live-validation.json` |
| `SOLC=/tmp/basket-solc-0.8.26 bash scripts/run-fork.sh` | Exit 0; four tests passed at block **82,830,094**, using unchanged deployed runtime and local state fixtures. `fork-validation.txt` |
| `./node_modules/.bin/tsx scripts/make-browser-fixture.ts` | Generated disposable current-runtime fixture outside the deliverable |
| `./node_modules/.bin/tsx scripts/assemble-browser-check.ts` | Generated disposable browser scenario |
| `PLAYWRIGHT_MODULE=/opt/imd-tools/npm/node_modules/playwright/index.mjs CHROMIUM_PATH=/home/imd-worker/.cache/ms-playwright/chromium-1247/chrome-linux64/chrome node scripts/run-browser.mjs` | Exit 0; base flows, 65 existing regression assertions, 80 redesign assertions, final screenshots, live public routes. No console/page errors. `browser-check.txt`, `browser-interactions.json`, `browser-regressions.json`, `browser-redesign.json`, `browser-live.json` |
| `./node_modules/.bin/tsx scripts/check-browser-transactions.ts` | Exit 0; 25 captured requests cover all 24 transaction function names, target addresses, arguments, tolerances, deadlines, USD scaling, launch arrays and recipient order. `transaction-check.txt`, `transaction-mapping.json` |
| `BASKET_SOURCE_ROOT=<checkout> node scripts/check-preservation.mjs` | Exit 0; **128 unchanged RPC/transaction expressions**, 15 byte-identical core/configuration files and preserved JSX text. `preservation.json` |
| `npm audit --json` | Exit 1: four findings (two moderate, two high) in the immutable existing dependency tree. No dependencies changed. `package-audit.json` |
| `git diff --check` | Exit 0 after whitespace cleanup |

The local solc 0.8.26 executable was downloaded to `/tmp`; existing Foundry tools and vendored forge-std were used without modifying repository `lib/`. No actual wallet signed or broadcast a transaction. Receipt success/failure and wallet requests in browser checks are intercepted test fixtures.

### Validation adaptations and failed attempts

The original live check reached the correct custom error but expected only pre-genesis/unlisted messages. The live vault is now in its 72-hour opening delay. The assertion was expanded to recognize the existing legitimate opening/market/freshness wording; all action encodings and calls remain unchanged.

The first original fork run failed `live genesis changed` at block 82,827,765. The previous validation block 82,772,718 was unavailable from the primary RPC; the other configured RPC returned an archive-access error. Logs are retained in `fork-initial-live-state.txt` and `fork-validation-historical.txt`.

The fork harness now requires **zero live supply**, records the live 25-stock count, and resets only the genesis flag and stock-array length in its local fork. Owner/guardian reads, chain ID and deployed code-hash assertions remain; the vault bytecode is never replaced. Mock tokens/feed/factory state and time warps remain confined to that fork. All four original transaction scenarios then passed. This tests deployed bytecode with controlled local launch state, not successful execution against the live finalized state. A future nonzero supply requires a new fixture strategy; the current guard will fail clearly.

Browser navigation and refresh checks were corrected to wait for rendered headings/expected data instead of inspecting the previous React render. Owner navigation selectors now target its footer label. Existing Owner tests navigate to Redeem before claiming. No application guard was removed to make a test pass.

## Transaction and copy preservation

`preservation.json` records structural TypeScript comparisons against the original checkout for every `vault`, `token`, `feed`, read, batch, simulation, wallet request/send and argument-builder call. The chain implementation, model/calculations, ABI, deployment binding, shared transaction controls, Docs and Losses are byte-identical. Foundry/Vite/TypeScript configuration, Solidity source and the frontend manifest/lockfile are also byte-identical.

Wallet chain 4663, account identity, public chain/runtime hash, exact calldata simulation, final chain recheck, target and encoding are preserved. The only send-path change publishes confirmed UI state after a successful receipt and selects the explicitly requested deposit success wording. Layout effects invalidate the quote before paint and cancel stale async preview completions; a successful deposit also clears its amount. Browser tests verify the transaction link, absent Approve/Deposit controls, and the requirement for a new amount plus explicit preview. Confirmed approval, redemption and claim also invalidate previous previews.

The banner, warnings, labels, existing confirmation text, Docs, token-symbol-only and feed-cleaning logic are preserved. The new visible wording is limited to the requested navigation/footer label and `Deposit confirmed`; mobile field labels repeat existing table headings. Decorative menu numerals were removed. Rendering checks confirm all new SVG scenes have no text nodes, are hidden from assistive technology, and cannot introduce a price, currency, brand or film name. Manual inspection confirms the items are plain geometric packages, with no imported artwork or film characters.

## Better Interface six-domain review

The pinned contents/workflow, core principles of all six domains and final documentation method were read and applied during implementation. The original palette/token convention and interaction system were retained where appropriate. One fixed theme is supported; localization, dialogs, filters and downloads are absent and **Not applicable**.

| Domain | Coverage | Evidence / limits |
| --- | --- | --- |
| Accessibility | **Checked** | Native navigation/forms, one h1, skip link, keyboard focus, label/error wiring, native disabled guards, decorative hiding, 44px links/buttons/disclosures, reduced motion. Browser keyboard path and focus screenshot. No screen-reader session, physical phone or comprehensive AT matrix. |
| Layout | **Checked** | All six public pages reflow at 320/375/768/1440. Screenshots at 1440/375, realistic populated stock fixtures plus separate live data. Owner pasted/listed pairings stack with no internal horizontal scrolling. Vault cards preserve fields. Footer routes remain public. Docs at 200% CSS text enlargement; native browser zoom unperformed. |
| Writing | **Checked** | Preserved JSX copy inventory and byte-identical Docs, warnings/role confirmations inspected. No rewritten financial copy or added promotional text. Existing holiday-wording limitation retained below. |
| Typography | **Checked** | Local script only on display headings/brand, ordinary body/owner controls and tabular financial values, 16px inputs, wrapping addresses, semantic hierarchy. Local font asset loaded by production browser. No claim of identical rendering on every OS. |
| Colors | **Checked** | 214 computed rendered financial/warning/action/heading pairs across all six pages at desktop/375 passed 4.5:1; four shared pairs also measured by existing regressions. Solid wallet backing removes scenery interference. Glows/artwork are decorative and not scored as text. No claim of a full automated accessibility audit. |
| UI details | **Checked** | Default/hover/focus/active/disabled/busy/empty/error/confirmed states; plain owner buttons; 120ms press transform only, no continuous animation. Reduced-motion emulation shows no animation or transitions. No 10%-speed DevTools animation session; only the short press transform exists. |

### Findings, corrections and rechecks

| Severity | Source | Finding and correction | Recheck |
| --- | --- | --- | --- |
| High | `web/src/Flows.tsx:36`, `web/src/wallet.tsx:136` | A confirmed deposit retained its prior quote/amount. Successful receipt state now invalidates all previews before paint and clears deposited amount, preserving the transaction link. | Confirmed deposit/approval/redeem/claim assertions and `deposit-confirmed-375.webp` |
| Medium | `web/src/main.tsx:13`, `web/src/main.tsx:210` | Main menu had six items. Restricted it to the four requested pages, with Owner controls/Losses in footer and all routes retained. Claims visibly scoped to Redeem without removing reads. | Exact menu assertion, public route checks and 44px footer targets |
| Medium | `web/src/Owner.tsx:185`, `web/src/styles.css:1244` | Pairing tables required a wide phone table. Rows now stack into labelled cards using the existing data and mismatch warning. | Both listed/pasted variants at 375, warning disabled-state capture |
| Medium | `web/src/styles.css:1143` | Ordinary/footer links and the refresh control lacked uniform touch height. All links/buttons/disclosures now reach 44px. | All six pages at 375 and 1440; no short visible targets |
| Medium | `web/src/styles.css:1152`, `web/src/Scenery.tsx:30` | Header artwork could pass behind account text. Wallet now uses a solid navy backing; rocket moved out of that region. | Final phone/desktop screenshots and preserved high-contrast text |
| Medium | `web/src/styles.css:860` | Background transitions could briefly lighten a newly enabled primary button while its label was white. Removed background interpolation, retaining only the short press transform. | Primary text measured **7.074:1**, screenshot immediately after ready simulation |
| Low | `web/src/styles.css:123` | An offscreen translated skip link appeared in full-page screenshots of scrolled forms. It is now clipped until focus. | Keyboard skip still works; final full-page screenshots have no stray overlay |
| Low | `web/src/assets/`, `dist/` | Public-folder font placement duplicated the same font in the export. Moved source assets into Vite's asset pipeline; removed superseded export hashes and obsolete evidence screenshots. | Complete runtime/font/license output and bundle inventory |

Representative measured pairs: data/owner buttons `#18253c` on `#fffef8` **15.185:1**; supporting text **7.008:1**; warning text **7.515:1**; primary action and footer links **7.074:1**; error text **8.010:1**; lime display text on navy **14.487:1**; pink eyebrow on navy **9.519:1**. JSON records exact values and selectors. These measurements cover the tested states; they are not an exhaustive WCAG certification.

## Screenshots

The six pairs below are final full-page production captures with capture-only fixtures. All fixture values are test data, not live market quotes. Live captures are separately named.

| Page | Desktop, 1440px | Phone, 375px |
| --- | --- | --- |
| Vault | [vault-1440.webp](vault-1440.webp) | [vault-375.webp](vault-375.webp) |
| Deposit | [deposit-1440.webp](deposit-1440.webp) | [deposit-375.webp](deposit-375.webp) |
| Redeem / claims | [redeem-1440.webp](redeem-1440.webp) | [redeem-375.webp](redeem-375.webp) |
| Owner controls | [owner-1440.webp](owner-1440.webp) | [owner-375.webp](owner-375.webp) |
| Losses | [losses-1440.webp](losses-1440.webp) | [losses-375.webp](losses-375.webp) |
| Docs | [docs-1440.webp](docs-1440.webp) | [docs-375.webp](docs-375.webp) |

Additional evidence: [confirmed deposit](deposit-confirmed-375.webp), [phone pairing mismatch](owner-pairing-375.webp), [keyboard focus](keyboard-focus.png), [live Vault](vault-desktop-live.webp), [live Owner](owner-desktop-live.webp). Source/design review and screenshot inspection found no numbers/currency on decorative packages, no commercial brand/film imagery, and no clipped phone actions. Owner full-page captures are intentionally tall because every public control remains present. The initial Owner/Redeem captures raced asynchronous content; the final runner waits for network idle and fonts/layout, then asserts each screenshot height equals the complete rendered document height. All twelve page captures pass that assertion.

## Completion and limitations

**Complete for the stated scope.** Production build, typecheck, read-only live checks, fork scenarios, browser transaction decoding, requested phone behavior and all-page screenshots are delivered. The source, unchanged lockfile and complete relative-URL static export are included; the README describes install, preview, rebuild and publishing. `DESIGN.md` documents actual final tokens and components. Size/integrity is recorded in `bundle-check.json`.

No live transaction, contract deployment, hosting publication, screen-reader session, physical-device test or native browser zoom check was performed. The preserved holiday sentence is broader than the immutable contract's weekday/feed-freshness checks. Audit findings in immutable dependencies and the non-fatal Vite chunk warning are disclosed. RPC state can change, and the fork fixture is explicitly local. These are worker observations with no independent certification authority.

Guidance attribution/licenses: `web/validation/DESIGN-GUIDANCE-LICENSE`, including Better Interface (Jakub Krehel, MIT) and the adapted Impeccable documentation method (Paul Bakaus, Apache-2.0). Existing attribution is retained; this review records the current redesign.

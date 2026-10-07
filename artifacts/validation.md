# Website revision validation — 7 October 2026

Complete for the stated website scope. This is the worker's local evidence, not independent certification. The production export is `dist/`; the source and unchanged frontend manifest/lockfile are in `web/`. No contract, protected build configuration, dependency lockfile, ignore file or Git metadata was modified. No live transaction or publication occurred.

## Binding and implementation

Authoritative source: launch-929-basket, commit `b12f8ecdaac0acc13e47646441b4f312a2aab160`. The earlier repository contract source and deployment input were not used to build this website's ABI or fork target. The explicit task address takes precedence over the older supplied deployment notes.

Solidity 0.8.26 / via IR / 200 optimizer runs / Cancun / no bytecode metadata hash / constant optimizer disabled produced a 22,258-byte runtime with keccak256 `0x62b326b6d8b9191a8777932f5beb87bc1dd07765fdb83bad3c4463924da402d0`. The regenerated canonical ABI hash is `0xfb215ccf6f418f03f9bbd7b7a68b806d6fb3f4dd64fe47063dc84eac2f254d89`. Public RPC code at `0xd77a5f93f9d85e6990f389147713a9ad8ce5764c` matched it on chain 4663.

The binding includes positional deposit/redeem previews, six-field assets, deficit records, proposal IDs followed by detail/state reads, all seven kinds/states and all 20 deposit reasons. Removed obsolete probation and stock-limit UI. Every send retains chain/account/code verification and exact-call simulation. Deposit headroom solves the post-deposit NAV inequality with bigint rounding; allowance and stock balance gates precede sending. Pairing validation is tied to the exact pasted input and uses fresh listing-index reads. Listing receipt uncertainty triggers reconciliation before retry. Docs and X links retain the existing title, hosting name, banner and grocery theme.

## Actual commands and results

Commands are from repository root unless a `web/` working directory is stated.

| Check | Actual result |
| --- | --- |
| `npm ci --prefix web --cache /tmp/basket-npm-cache` | Passed using existing manifest and lockfile; neither changed. |
| From `web/`: `SOLC=/tmp/basket-solc-0.8.26 ./node_modules/.bin/tsx scripts/regenerate-abi.ts` | Passed; pinned compilation exactly matched expected runtime and generated ABI. |
| `npm run typecheck --prefix web` | Passed, exit 0. |
| `npm run build --prefix web` | Passed, exit 0; final output recorded in `build-validation.txt`. Main JS 519,570 bytes, 156.56 kB gzip. Vite's >500 kB advisory remains non-fatal. |
| `npm run validate --prefix web` | Passed, exit 0; live block 82,775,415, exact chain/code hash, canonical ABI, parsing, NAV/staleness, retired assets, feed prefixes, pairing boundaries, deposit headroom boundaries and 23 vault-action encodings/simulations. `live-validation.json` and `live-check.txt`. |
| Isolated Forge project under `test/scratch/fork/`, pinned source only; `BASKET_FORK_BLOCK=82772718 forge test --root test/scratch/fork --use /tmp/basket-solc-0.8.26 --remappings "forge-std/=$PWD/lib/forge-std/src/" -vv` | **4 passed, 0 failed**, against the real deployed bytecode after the required block. `fork-validation.txt`. Preparation is reproducible with `web/scripts/run-fork.sh` (shell syntax checked). |
| From `web/`: `tsx scripts/make-browser-fixture.ts`, `tsx scripts/assemble-browser-check.ts` using local `node_modules/.bin/tsx` | Passed; generated disposable fixture data using the regenerated ABI and live runtime. |
| From `web/`: `PLAYWRIGHT_MODULE=/tmp/basket-browser/node_modules/playwright/index.mjs CHROMIUM_PATH=/root/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome node scripts/run-browser.mjs` | Passed, exit 0; actual production export served at `/preview/` by a bounded local server. All sessions/server closed on completion. No browser console/page errors or live HTTP failure responses. `browser-check.txt`, `browser-interactions.json`, `browser-regressions.json`, `browser-live.json`. |
| From `web/`: `./node_modules/.bin/tsx scripts/check-browser-transactions.ts` | Passed; **25 captured requests, all 24 UI action function names**, vault/token targets, critical arguments, deposit receiver, minima, deadlines, cap scaling, launch arrays and claim recipient order. `transaction-mapping.json`. |
| `git diff --check` and submission integrity script | Passed; no abandoned-address bytes anywhere in deliverable candidates, no submodules/dependency caches/archives, protected paths unchanged and every relative HTML asset present. `package-audit.json`. |

The fork exercised launch listing and finalization, stock approval/deposit, redemption with owed legs, claims, flagging/recognising deficits, all seven proposal kinds, execution/cancellation, role controls, ownership transfer, fee recipient, cap changes, pause/unpause and closure. Added checks prove that previews can succeed before cap/bucket reverts, refill permits a later deposit, a single stock can hold the whole NAV, Waiting execution returns `InvalidProposal`, retirement voids a pending band and frees the feed, and guardian/cap proposals execute correctly.

The first fork attempt used an unavailable historical RPC state. A recent explicit block was selected instead. Additional time-warp tests initially exposed compiler caching of `block.timestamp` across cheatcode calls; using `vm.getBlockTimestamp()` in the test scaffold fixed those test failures. The final four-test run is the one reported above.

Browser fixtures cover amount-limit warnings, insufficient-balance approval prevention, post-allowance simulation failure, code changing before send, correctly cleaned pairing labels, edited/mismatched/unreadable pairings, already-listed tokens, receipt-timeout reconciliation, role permissions, pagination, fallback asset reads and retired claims. The capture-only test wallet rejects signatures; the receipt scenario returns a dummy hash and never broadcasts. Public preview checks also run after disconnecting. A separate fresh browser context used live public RPCs with **no injected wallet at all** on all six routes.

## Better Interface review

Applied the pinned workflow and core principles in accessibility, layout, writing, typography, colors and UI during implementation, then checked the production export. Preserved the existing tokens, typography, basket/shelf motifs and warm palette. No new theme, font, icon package or unrelated feature was introduced. The pinned guide and license were read from supplied inputs; attribution/licenses remain in `web/validation/DESIGN-GUIDANCE-LICENSE`.

| Domain | Coverage and evidence | Limits |
| --- | --- | --- |
| Accessibility — Checked | Native labeled controls; disabled List/Approve/Deposit with nearby explanations; explicit pairing warning text; keyboard skip link moves focus to main; a visible 3px focus outline inspected in `keyboard-focus.png`; route heading focus; no-wallet and non-owner access; reduced-motion check. | No screen-reader session, automated accessibility scanner or physical-device check; focus was sampled, not exhaustively inspected at every control/state. |
| Layout — Checked | All six populated fixture pages at 320, 768 and 1440 CSS pixels, no document overflow; scrollable labeled pairing tables; Docs changes from two columns to one; six-link mobile navigation wraps; live empty-genesis export inspected. | CSS 200% text enlargement checked on Docs, not native browser zoom. English/LTR only; no RTL or pseudo-localization check. |
| Writing — Checked | Plain 20-reason list and custom errors; Waiting includes execution date; proposal pause warning; cap/daily amounts and refill explanation; clear insufficient balance, pairing and receipt-recovery messages; requested Docs sections. | Requested US-holiday wording is preserved, but contract source has a weekday UTC gate, not an explicit holiday calendar. |
| Typography — Checked | Existing Georgia/Arial system stacks, descending heading hierarchy, tabular numbers, 16px inputs and Docs body; wrapped addresses; 65ch Docs measure; desktop/mobile screenshots reviewed. | Exact system-font glyphs vary; no physical iOS input-zoom check. |
| Colors — Checked | Existing semantic palette reused; yellow/brown pairing and proposal warnings also have text. Computed rendered foreground/background pairs measured below. | Measured representative pairs only; no blanket accessibility claim or unsupported dark theme. |
| UI — Checked | Loading, empty, blocked, mismatch, declined-signature, receipt-timeout and successful-simulation states exercised. Existing flat panels, receipt rules and local basket icon preserved. Reduced motion removes transitions. | No slow-motion Animations-panel inspection. No dialogs/themes/localization exist, so those variant checks are not applicable. |

Measured rendered pairs from `browser-regressions.json`:

- Restriction/warning text `#654810` on `#fff1cb`: **7.52:1**.
- Docs body text `#292e26` on `#fffef9`: **13.74:1**.
- Supporting text `#66695f` on `#f8f6ed`: **5.17:1**.
- Active navigation `#24513c` on `#fffef9`: **8.97:1**.

All measured text pairs exceeded 4.5:1. These are computed rendered solid-background pairs, not estimates.

## Findings, fixes and rechecks

| Severity | Source | Evidence, impact and correction | Recheck |
| --- | --- | --- | --- |
| High | `web/src/Flows.tsx:26`, `web/src/model.ts:274` | Old quote fields omitted the new receiver-share data and implied preview checked limits. Positional decoding, separately computed exact cap/bucket headroom and wallet simulation now control sending. | Browser quotes/limits/reverts; math boundaries; live encoding; fork cap/bucket tests pass. |
| High | `web/src/Flows.tsx:81` | A stock approval could be offered despite insufficient wallet stock. Display and pre-click balance checks now block it with a corrective message. | Browser low-balance case passes with no approval request. |
| High | `web/src/Owner.tsx:227` | Pasted pairings were not displayed/read until List. Added a chain-read table tied to input, mismatched/unreadable/duplicate/feed-reuse guards and listing-index rereads. | Prefix, edited input, mismatch, failed metadata and already-listed cases pass. |
| High | `web/src/Owner.tsx:237` | Receipt failure could offer duplicate listing. Reconciliation now reads and shows the current vault before another attempt, and keeps already-listed tokens blocked. | Simulated receipt timeout with a mined listing passes. |
| High | `web/src/Flows.tsx:546` | Browser refresh from populated to empty assets left a stale claim row dereferencing a missing asset, crashing the page. Guarded that transient row. | The same refresh/listing recovery scenario passes without console/page errors. |
| High | `web/src/Owner.tsx:580`, `web/src/chain.ts:194` | Old proposal tuple/state handling could mislabel waiting proposals or send the wrong cap selector. Switched to IDs plus positional details/state and exact new enums/functions; simulate before showing Execute and reread state on failure. | Browser Waiting/permissions/pagination; all proposal kinds and invalidation on fork pass. |
| Medium | `web/src/Owner.tsx:210`, `web/src/Owner.tsx:705` | Feed labels lacked requested cleanup/mismatch warning; pending changes lacked deposit-pause guidance. Added cleaned labels, warning text/color and exact pause guidance for List/Feed/Band/Retire. | Pairing screenshot, browser reads and source review pass. |
| Medium | `web/src/styles.css:1274` | Sixth navigation item needed narrow-screen space. Enabled wrapping while keeping every page visible. | All routes reflow at 320/768/1440px; mobile Docs screenshot reviewed. |
| Medium | `web/src/chain.ts:261` | Receipt timeout showed a long raw technical message/hash. Replaced it with a plain recovery message and retained transaction link. | Receipt scenario and focused-state screenshot show the new wording. |

No known required website behavior remains unfixed. Broader immutable-contract risks are documented in the requested Docs and pinned upstream README, not changed by this site update.

## Screenshots and delivery

Inspected actual production screenshots: `vault-desktop-live.png`, `owner-launch-live.png`, `deposit-desktop-fixture.png`, `redeem-mobile-fixture.png`, `docs-desktop.png`, `docs-mobile.png`, `pairing-warning.png`, `keyboard-focus.png`. “Fixture” and pairing images contain synthetic stocks/accounts; live images use public chain reads. Screenshots are evidence of the displayed states, not proof of live transactions.

Final design documentation is `DESIGN.md`. Install, preview, rebuild, publish and reproducible validation commands are in root `README.md`. The export has relative assets and hash routes. The source, existing lockfile and required runtime assets remain complete. `package-audit.json` records the final byte inventory; it is comfortably below 8 MiB even using an uncompressed full-snapshot estimate plus existing Git pack storage. No ignore-file change was needed.

Unperformed checks: screen reader, physical devices, native browser zoom, automated accessibility scan, cross-browser matrix, real wallet signatures/live transactions, independent audit and publishing. Public RPC state/inclusion and issuer behavior can change after this run. No network certification is claimed.

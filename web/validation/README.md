# Website checks

Run from `web/` after the production build. `../artifacts/validation.md` is the actual final evidence and limitation record.

- `npm run validate`: ABI, decimal arithmetic, reason/error wording, inputs, encodings and live read-only verification.
- `node scripts/check-preservation.mjs`: protected files, current integration invariants, obsolete integration scan and file budget. This supersedes the obsolete call-expression equality check.
- `npx tsx scripts/run-browser.mjs`: bounded isolated Anvil fork plus Playwright browser. It creates only disposable fork fixtures, runs actual production UI sends against the original vault bytecode and records screenshots and decoded arguments. Requires an empty, unfinalized fork state. `BASKET_RPC`, `BASKET_FORK_BLOCK`, `SOLC` and `PLAYWRIGHT_MODULE` can select local verification tools/endpoints.
- `node scripts/inspect-export.mjs`: subpath export, all pages at four widths, fonts, overflow, keyboard and reduced-motion checks.
- `node scripts/check-guards.mjs`: injected account/chain/code/simulation failures; no transaction broadcast.

Playwright, Chromium and WebKit are external verification tools, not runtime dependencies. Install them outside the repository if absent and point `PLAYWRIGHT_MODULE` at Playwright's `index.mjs`. The 2026-10-09 pass used external Playwright with Chromium 156 and WebKit 27.2. The fork caches genuine account, vault and block-history system-contract reads before RPC pruning; it never patches vault storage or bytecode. Tests own their server/browser/fork lifecycle and close them on completion.

`Fixtures.sol` is test-only; it is not imported by the website and is never deployed to a public chain. Its sample symbols do not describe the live vault. No generated dependency/cache directory or state dump belongs in Git.

Design review uses the pinned Better Interface guide (Jakub Krehel, MIT) and Impeccable documentation method (Paul Bakaus, Apache-2.0). Both copyright notices and license texts are in `DESIGN-GUIDANCE-LICENSE`; review coverage and source locations are in the artifact report.

Additional checks: `npx tsx scripts/check-interface.ts` verifies line-numbered refusals, exact balances and pool/setting arithmetic; `node scripts/check-motion.mjs` checks scrolling geometry and repeated-strip coverage in Linux Chromium at DPR 1/1.25/1.5. This is not native Windows display-scaling validation. The fork walkthrough covers 25 listing rows, decline/resume, an accelerated receipt timeout, pending transaction and reload, plus every transaction control. Screenshots wait for read/layout stability and use JPEG quality 40 to meet the submission budget.

- `node scripts/check-art.mjs`: manifest SHA-256/size inventory in public and dist, square full shelf rows, exact speech and contained picture geometry, Chromium/WebKit overflow checks, and both slogan loops at 375/2560px. Extra review captures stay in disposable scratch.
- `node scripts/check-fixes.mjs`: actual wallet hook and Claims component with deterministic missing receipts, advanced/non-advanced nonces, forgotten hashes, legacy nonce lookup, queued transactions, Retry vault and complete/incomplete owed states.

The 2026-10-09 pass uses only temporary external browser/compiler tooling; no tool packages, browser archives or system libraries are delivered. The three-stock fork deposit uses FIG/OAT/S01, leaving PEA empty for the original retirement/removal walkthrough. No check was removed when extending the deposit fixture.

`node scripts/check-calldata.mjs` compares guarded call expressions and protected integration files with task-start Git source. `node scripts/check-bundle.mjs` includes tracked lib files and all delivered assets in the 8 MiB budget. Set `BASKET_SOURCE_ROOT` to the repository when running either from a disposable copy. `BASKET_BASELINE_DIST=/absolute/previous/dist node scripts/check-visibility.mjs` compares the six phone routes with no wallet and a read-only owner connection.

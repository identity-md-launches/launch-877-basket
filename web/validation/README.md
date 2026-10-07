# Website validation

Run commands from `web/`. The repository README describes install/build and the exact pinned source. The root contract source is historical and is never compiled by these website checks.

- `npm run validate`: canonical ABI, input/math/pairing assertions, chain/code checks and public read-only action simulations.
- `SOLC=/path/to/solc-0.8.26 bash scripts/run-fork.sh`: prepare only launch-929 source in disposable scratch, then run `WebsiteFork.t.sol` against the deployed vault on a recent live-chain fork. Mock stocks and feed state are local only. `BASKET_FORK_BLOCK` can pin the block. Time-warp tests use `vm.getBlockTimestamp()` to avoid optimizer caching across cheatcode calls.
- `tsx scripts/make-browser-fixture.ts` and `tsx scripts/assemble-browser-check.ts` (using `node_modules/.bin/tsx`): generate disposable fixtures and the browser scenario function.
- `PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs CHROMIUM_PATH=/optional/chromium node scripts/run-browser.mjs`: run the bounded browser/server check against `dist/` at a relative subpath, then save screenshots and results. `CHROMIUM_PATH` is optional when Playwright's matching browser is installed.
- `tsx scripts/check-browser-transactions.ts`: decode captured wallet requests and assert target, functions, arguments, minimums and deadlines.

`browser-setup.js` intercepts only the fixture page's public RPC reads and injects a capture-only wallet. `browser-flows.js` and `browser-owner.js` cover all action mappings. `browser-regressions.js` covers deposit and pairing guards, receipt timeout, runtime mismatch and responsive public routes. The runner also opens a separate browser context using live public reads with no wallet. No real signature or network broadcast occurs.

Actual run evidence and six-domain review: `artifacts/validation.md`. Sources here are not bundled into the website. No node_modules, package cache, dependency archive or compiler build output is needed in the submitted bundle.

Attribution: Better Interface by Jakub Krehel, commit `267330e1adfc66a718fb65fa6918c1f06d0a689e` (MIT); documentation guidance adapted from Paul Bakaus's Impeccable, commit `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8` (Apache-2.0), https://github.com/pbakaus/impeccable/blob/9d715cc4f5564a990ca8345abfdd5df6dc9b41c8/skill/reference/document.md. Both licenses remain in `DESIGN-GUIDANCE-LICENSE`.

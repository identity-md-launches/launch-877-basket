# Browser/fork validation sources

These files are not imported by the website. `artifacts/validation.md` records the actual run. Captured wallet requests are deliberately rejected by the test wallet, so browser testing cannot broadcast a transaction.

For the fork suite, copy `WebsiteFork.t.sol` to `test/scratch/WebsiteFork.t.sol` and run the README's Forge command. The relative imports are designed for that scratch location.

For the browser tool suite, serve the repository at `http://127.0.0.1:4173` (production site at `/dist/`), then:

```sh
mkdir -p test/scratch
cd web
./node_modules/.bin/tsx scripts/make-browser-fixture.ts
./node_modules/.bin/tsx scripts/assemble-browser-check.ts
```

Run the generated `test/scratch/browser-check.js` with the Playwright browser tool's `browser_run_code_unsafe` filename argument. The function takes `page`; it intercepts the two public RPC hosts and injects an isolated test wallet. This requires a Playwright environment with page routing and init scripts. It is not a general Node script. Copy its Result object to `artifacts/browser-interactions.json` and run `scripts/check-browser-transactions.ts` with `tsx` from `web/` to check actual emitted calldata. The live `npm run validate` command is separate and only uses public `eth_call`.

The design references informed implementation; no reference file is a runtime dependency. Their retained license is `DESIGN-GUIDANCE-LICENSE`: Better Interface by Jakub Krehel, pinned `267330e1adfc66a718fb65fa6918c1f06d0a689e` (MIT); documentation guidance adapted from Paul Bakaus's Impeccable, pinned `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8` (Apache-2.0), https://github.com/pbakaus/impeccable/blob/9d715cc4f5564a990ca8345abfdd5df6dc9b41c8/skill/reference/document.md.

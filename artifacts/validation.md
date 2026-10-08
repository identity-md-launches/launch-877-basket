# Vault 5 website validation

Completed on 8 October 2026. This is the worker's local evidence, not an independent certification.

## Scope and implementation

The production export in `dist/` serves BaskVault `0x4e19d7472e650399b06eeaa5ccc29da9b8efbebd`, chain 4663. All six existing pages remain; Vault, Deposit, Redeem and Docs are in the main menu, with Owner controls and Losses in the footer. The site title, hosting name, banner and social link remain. Contract source and build/dependency configuration at the repository root are unchanged; web dependency manifests and lockfile are unchanged. No live transaction or publication occurred.

The five reference sources, upstream README, compiler settings and math licenses are in `web/pinned/`, from commit `0a88bde525aed4557b375cf60ee503d707570ac0`. Historical root contracts are not used by the website. The ABI was regenerated with solc 0.8.26, optimizer 200, IR, Cancun, metadata hash none, and the actual Transfer topic inserted at all immutable references. The resulting runtime is 23,736 bytes and hashes to the required `0x0419f8e9496a55eaafb9b3fa203d459cc7f82fdac17359c11f51c2e59a5f64fe`.

Design follows the pinned Better Interface guide across all six domains. The original supermarket artwork is inline SVG/CSS; Anton and VT323 WOFF2 fonts are local and openly licensed. Decorative slogans and stickers contain no financial figures or claims. Data, errors and owner actions use plain high-contrast surfaces.

## Commands and actual results

Commands ran from the identical source copy at `/tmp/basket-build/web` to keep installations and caches outside the repository. The final generated ABI is byte-identical to the delivered ABI, and the final export was copied back in full.

| Command | Result |
| --- | --- |
| `npm ci --cache /tmp/basket-npm-cache --no-audit --no-fund` | Pass; existing lockfile, no manifest edits |
| `SOLC=/root/.svm/0.8.26/solc-0.8.26 npx tsx scripts/regenerate-abi.ts` | Pass; required runtime hash, all five sources, Transfer immutable filled |
| `npm run typecheck` | Pass |
| `npm run build` | Pass; Vite warning: main chunk 523.38 kB, 159.01 kB gzip |
| `npm run validate` | Pass; canonical ABI, NAV/decimals/invalid-price handling, reasons, receiver/input validation, minimums, hours and all eleven proposal payloads; live chain/hash/snapshot at block 83,498,204 |
| `npx tsx scripts/run-browser.mjs` | Pass; fork block **83,496,825**, 46 checks, **45 successful wallet sends**, twelve screenshots, no captured page/resource errors |
| `node scripts/inspect-export.mjs` | Pass; all six pages at 320, 375, 800 and 1440 px; no horizontal overflow, local fonts loaded, keyboard skip link, no-wallet message, reduced motion |
| `node scripts/check-guards.mjs` | Pass; account-change, code mismatch, simulation rejection and wrong-chain cases; **zero wallet sends** |
| `node scripts/check-preservation.mjs` | Pass; protected files, current transaction safeguards, obsolete integration scan and file budget |

Detailed output: `compiler-validation.txt`, `build-validation.txt`, `live-validation.json`, `browser-fork.json`, `export-review.json`, `send-guards.json`, `preservation.txt` and `bundle-check.json`.

## Fork interaction coverage

The runner preserves the actual vault code and storage at a fresh pinned block, then creates disposable token/feed/pool fixtures on the isolated fork. Needed genuine account and storage reads are cached before the public RPC prunes old state. The fixture has tokens with both 6 and 18 decimals, feeds with both 8 and 10 decimals, and a pool/quote-feed configuration. These stocks and transactions are **test fixtures, not live listings or transactions**.

Verified through the production interface:

- A mismatched stock/feed label is marked `check this pairing` and blocks listing. Three rows each produce one ordered `genesisList` prompt. Repeating List skips every already-listed row. Finalize checks the aggregate rows and sends once after confirmation.
- An oversized deposit reports CapExceeded before approvals. A two-stock deposit approves exactly the required amounts and sends one array-based deposit to the wallet. Confirmation clears inputs and the old preview.
- Redemption rejects the vault as receiver, refreshes its preview, sends all positional minimums and explicitly supplies estimated gas with the implemented margin. A refusing token creates an owed claim. Individual claim and Claim all both recover deferred balances; Claim all was exercised with two tokens in one batch.
- All eleven proposal forms encode and send the correct action. After advancing fork time, all eleven execute through `execute(id)`. Retire and Resync use the paused state. Cancel, pause/unpause, close, lowerNavCap, removeRetired, flagDeficit, recognizeLoss, transferOwnership and acceptOwnership succeed.
- Injected aggregate failure preserves independent stock reads and labels pool checks unreadable. Heavy view requests carry 30,000,000 gas. The send path checks chain, account, runtime and simulation; separate injected-failure tests verify the blocking behavior.

Earlier attempts exposed test-runner issues: stale confirmation matching, a frozen browser clock that prevented timestamp-based refresh effects, case-sensitive test option matching against checksummed addresses, and missing explicit refresh after external fixture mutations. Those were corrected and the entire final sequence passed. Older forks also hit pruned historical state; the final fresh-block caching method passed without replacing vault code or storage.

## Better Interface review

| Domain | Coverage and evidence | Limits |
| --- | --- | --- |
| Accessibility — Checked | Native buttons, forms and links; visible field names; balance descriptions separated from names; keyboard skip link; visible focus; 44 px controls; reduced-motion check; high-contrast warnings | No screen-reader session or physical-device test; no claim of full WCAG certification |
| Layout — Checked | All six pages at four widths; phone stock/claim cards, wrapping addresses, single-column forms; no horizontal document overflow; desktop and phone screenshots | Native browser zoom and RTL were not tested; no localization is implemented |
| Writing — Checked | Banner preserved; Stock Tokens terminology; cleaned feed names and pairing marks; all reason words; transaction labels mapped to actual functions; recoverable read errors and Retry controls | Source and interaction review, not legal review |
| Typography — Checked | Both local fonts loaded in Chromium; condensed display hierarchy, system body/number text, 16 px inputs, tabular numerals and wrapping | No separate font-rendering checks on other operating systems |
| Colors — Checked | Solid rendered surface roles reviewed in screenshots and measured below; errors also carry words | Measurements cover named solid-color pairs, not every antialiased pixel |
| UI — Checked | Empty, populated, error, disabled, preview, confirmation and pending-proposal states; reduced motion; optional marquee pause; plain owner actions | Animation was not replayed at 10% speed; no native wallet extension was connected |

Measured contrast ratios (`export-review.json`): ink/white **13.83:1**, white/royal blue **7.47:1**, white/red **4.80:1**, ink/yellow **10.16:1**, error/white **8.01:1**, error/warning **7.29:1**, disabled text/surface **5.12:1**. These named text pairs exceed AA's 4.5:1 threshold.

## Findings and fixes

| Severity | Source | Finding, correction and recheck |
| --- | --- | --- |
| High | `web/src/deployment.ts:1`, `web/scripts/regenerate-abi.ts:1` | Obsolete vault identity and ABI assumptions were replaced with the five-source vault 5 compilation. Compiler, live code-hash check and every fork send pass. |
| High | `web/src/model.ts:66`, `web/src/model.ts:169`, `web/src/Vault.tsx:150` | Fixed decimals and legacy status logic could misstate NAV. Values now use stored token/feed decimals and contract reasons. Missing/nonpositive feed answers cannot appear as real zero-dollar prices. Unit and populated fork checks pass; invalid-price handling is explicitly unit-tested. |
| High | `web/src/Flows.tsx:28`, `web/src/Flows.tsx:362`, `web/src/Flows.tsx:513` | Old single-token and redemption interfaces were replaced with arrays, editable validated receiver, fresh redemption preview, exact approvals and owed-token batches. Deposit/redeem/claim browser flows pass. |
| High | `web/src/governance.ts:114`, `web/src/Owner.tsx:304`, `web/src/Owner.tsx:506` | Old governance entry points and waits were removed. Encodings, row sequencing, readyAt state, settings and roles now match vault 5. All eleven proposal/execution paths and immediate controls pass on the fork. |
| Medium | `web/src/Flows.tsx:221`, `web/src/Owner.tsx:119` | Implicit labels absorbed balance/option text. Explicit names and described balance text now keep names concise; browser forms resolve and complete through those accessible names. |
| Medium | `web/src/Flows.tsx:298`, `web/src/Flows.tsx:470` | Input changes could race asynchronous preparation. Revision checks now cancel changed forms, and inputs lock during the wallet phase. Source reviewed and primary flows rerun; no dedicated adversarial timing test is claimed. |
| Medium | `web/src/styles.css:1084` | Preview and Retry buttons touched in the first rendered review. Added 12 px separation; final desktop/phone screenshots reviewed. |
| Medium | `web/src/Scenery.tsx:24`, `web/src/styles.css:15` | Previous artwork did not match the requested supermarket. Replaced with original shelves, clerk, produce, basket, cart, checkout and floor art, yellow/red frames and sky-blue page. All six pages inspected. |
| Low | `web/src/Scenery.tsx:2` | Paused marquee's visible label differed from its accessible name. Both now use Resume; reduced motion remains authoritative. |

## Screenshots

Full-page screenshots of the final production export with populated fork state:

| Page | Desktop | Phone |
| --- | --- | --- |
| Vault | [1440 px](vault-1440.jpg) | [375 px](vault-375.jpg) |
| Deposit | [1440 px](deposit-1440.jpg) | [375 px](deposit-375.jpg) |
| Redeem | [1440 px](redeem-1440.jpg) | [375 px](redeem-375.jpg) |
| Docs | [1440 px](docs-1440.jpg) | [375 px](docs-375.jpg) |
| Owner | [1440 px](owner-1440.jpg) | [375 px](owner-375.jpg) |
| Losses | [1440 px](losses-1440.jpg) | [375 px](losses-375.jpg) |

The live vault was empty and genesis unfinished during validation; [live desktop](live-vault-1440.jpg) and [live phone](live-vault-375.jpg) show that genuine state. Screenshot figures elsewhere belong to the fork. An additional MCP browser session inspected the served export, loaded fonts and layout at 1280 px.

## Completion and limitations

**Complete for the stated implementation and worker-check scope.** Runtime, source integrity, build, typecheck, useful interactions and required screenshots are present. `DESIGN.md` documents the final implementation; `README.md` documents install, preview, rebuild and publication.

No real wallet extension or public-chain transaction was used. Fork mocks cannot reproduce every issuer upgrade, token restriction or pool behavior. The 250-asset boundary and a multi-batch claim across more than ten tokens were not load-tested; the ten-token batching loop was source-reviewed. All setting variants, every role permutation and adversarial timing races were not exhaustively exercised. Existing root contract tests were not run as evidence about this different deployed source. The normal Vite main-chunk warning remains; no dependency/configuration changes or vendored npm registry were introduced. Build and browser artifacts are worker evidence, not a security audit or independent certification.

Design guidance attribution: Jakub Krehel, Better Interface, MIT, commit `267330e1adfc66a718fb65fa6918c1f06d0a689e`. Documentation method: Paul Bakaus, Impeccable, Apache-2.0, commit `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8`. Both license texts and copyright notices are retained in `web/validation/DESIGN-GUIDANCE-LICENSE`.

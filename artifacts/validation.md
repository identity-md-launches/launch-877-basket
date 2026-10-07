# Website validation — 2026-10-07

## Scope and completion

**Complete for the stated scope.** Five static, hash-routed pages for the existing Basket Protocol vault; required source, frontend lockfile and production export are included. This is the worker's evidence, not independent certification. No live transaction was broadcast and no production contract was changed or deployed.

The live vault was still in empty genesis: zero listed stocks, zero BASK supply and no proposals. Therefore live public reads establish real connectivity/ABI behavior and empty-state usability; successful populated state transitions were tested on a local fork, and rendered populated interactions used a clearly isolated synthetic RPC/wallet fixture. The fixture is not bundled in `dist/`.

Assumptions: one injected Ethereum-compatible wallet provider; English, light theme, USD feed prices and 18-decimal Stock Tokens as enforced by the contract. User-entered new stock/feed/recipient addresses are the required form inputs. All existing asset/feed/role addresses are read from the vault. Multicall3 is read-only chain infrastructure, obtained from the SDK's canonical deployment and checked for code on chain 4663. The public RPC that worked reliably was `rpc.mainnet.chain.robinhood.com`; PublicNode returned HTTP 403 in an early shell probe and remains a configured fallback.

## Build and chain checks

| Check actually run | Result |
| --- | --- |
| `npm ci` equivalent initial install: `npm install --prefix web --no-audit --no-fund --cache /tmp/basket-npm-cache` | Passed; exact dependency versions and lockfile retained |
| `npm run --prefix web typecheck` | Passed (`tsc --noEmit`), including final sources |
| `npm run --prefix web build` | Passed, Vite 7.1.9; final main JS 509.63 kB / 153.33 kB gzip; CSS 18.41 kB / 4.60 kB gzip |
| `forge inspect src/BaskVault.sol:BaskVault abi --json` | Generated ABI from repository Solidity 0.8.26 source; recursive key-sorted canonical Keccak matches pinned `a544e4…8161` |
| Local deployed bytecode vs live `eth_getCode` | Exact byte-for-byte match; runtime hash `efc36b…2407` |
| `npm run --prefix web validate` | Passed input/18-decimal/USD/minimum/deadline/NAV/retirement/stale-price boundaries, negative-price formatting, custom-error decoding, network/runtime checks and 23 vault action encodings/simulations |
| `forge test --match-path test/scratch/WebsiteFork.t.sol -vv` | 2 passed, 0 failed; deployed vault fork, mock Stock Tokens/feeds only; successful deposit/redeem/deferred claim/loss and owner/governance sequences |
| `cd web && ./node_modules/.bin/tsx scripts/check-browser-transactions.ts` | Passed: 25 captured wallet requests cover all 24 action functions (23 vault functions plus stock approval) |

Initial compilation exposed JSX/narrowing errors during development; these were repaired before the successful builds. Vite's advisory about a chunk above 500 kB remains non-blocking; it is documented rather than suppressed. No extra dependency archives, source maps or runtime registry are packaged.

The fork suite used the **deployed vault address/code/state**, impersonated its read owner/guardian only in the local EVM, and attached local mock token/feed/factory behavior. It exercised `proposeAssets`, `finalizeGenesis`, stock `approve`, `deposit`, `redeem`, `claim`, `flagDeficit`, `recognizeLoss`, every proposal form, cancellation, execution, close/pause/unpause, cap lowering, fee recipient and both ownership steps. The chain and original source remained untouched. Copyable test source is retained in `web/validation/WebsiteFork.t.sol`; README documents the scratch location and launch-state assumption.

`live-validation.json` records every live call outcome. Real launch-state reverts (for example an unlisted stock, no pending owner or proposal) are expected evidence of reaching the right contract function, not successful funded actions. `transaction-mapping.json` independently decodes the actual calldata captured from rendered buttons: exact approval spender/amount, deposit receiver/minimum, every redemption leg/minimum, ten-minute deadlines, wallet-first `owed` reads, claim token/recipient order, USD × 10¹⁸, launch arrays, proposal IDs and pending-owner sender.

## Browser interaction evidence

Inspected the **production `dist/` export** at `http://127.0.0.1:4173/dist/`, verifying relative asset loading under a subpath. The pinned guide mentioned a managed preview file, but this environment provided no `test/scratch/browser/preview.json`; a local foreground Python preview and the supplied Playwright browser tool were used. The preview was stopped after checks.

Actual runs included:

- All five pages with live reads and no wallet at **320, 768 and 1440 CSS pixels**: correct page headings, restriction banner on each page, no page-level horizontal overflow, owner forms visible.
- All five pages again with populated mocked state at the same widths: open/closed/retired stocks, fees/minimums, proposals, claims and losses; no page-level horizontal overflow.
- Deposit/redeem previews, required fee text, retired redemption leg, approval gating, wallet rejection feedback, explicit chain switch, wrong-chain disabled transactions, pending-owner acceptance and guardian cancellation exception.
- Claims loaded immediately on connection, before any redemption. Both default and alternate recipients reached `claim(token,to)`; zero address was rejected before a wallet request.
- `DepositUnavailable(19,asset)` became “This deposit exceeds the NAV cap. Stock at fault: ALFA.” Other reason mappings are copied from the repository's enum/README, not inferred.
- Forced `allAssets` and one direct feed read to fail: every asset was recovered individually, the failed price and NAV became unreadable, healthy stocks remained priced and other pages remained usable.
- Observed every fixture `eth_call` carrying `0x989680` (10,000,000 gas), and asserted that `allAssets`, `depositStatus` and `previewDeposit` never entered the Multicall3 calldata. Small metadata/claim reads were batched.
- Pending proposals scanned by historical pages; non-executable proposals showed the simulated reason instead of Execute. Non-owner visitors could see all controls; permission checks matched owner/guardian/pending owner/anyone.
- Keyboard Tab from the amount input reached Preview deposit with a visible 3px blue outline and 3px offset (inspected screenshot). Form controls are native and labelled; route headings and skip link provide navigation landmarks.
- **200% CSS text enlargement** at desktop caused no page overflow. This is not a native browser zoom test. Reduced-motion emulation produced `0s` button transition duration.
- Final fresh live tab: **0 console errors, 0 warnings**; HTML, JS, CSS, favicon and all public RPC requests returned 200. Initial favicon 404 was fixed and rechecked.

The fixture wallet deliberately rejects signatures after recording the request; no test can broadcast. Full captured checks and calldata are in `browser-interactions.json`. Browser success receipts, real wallet-extension UI and a funded live transaction were not exercised; successful contract transitions were covered separately on the fork.

Screenshots viewed and saved from the final export:

- `owner-launch-live.png`: final launch workflow, listing → pairing verification → irreversible genesis confirmation; rechecked at 320/768/1440px.
- `vault-desktop-live.png`: 1440px, actual empty genesis, no wallet.
- `deposit-desktop-fixture.png`: 1440px, populated synthetic preview, fee/minimum, claim and visible keyboard focus. The rejected-wallet notice is expected test state.
- `redeem-mobile-fixture.png`: 320px, all three synthetic stock amounts including retirement, fee, minimums and alternate-recipient claim form.

## Better Interface consolidated review

Read the pinned workflow, the core principles in **all six domains**, and the final documentation method. Applied them during construction and reviewed the finished export. Attribution/licenses are retained in `web/validation/DESIGN-GUIDANCE-LICENSE`.

| Domain | Coverage | Evidence / limits |
| --- | --- | --- |
| Accessibility | **Checked** | Native controls and labels, heading hierarchy, named navigation/table region, text statuses, visible keyboard focus, connected/disconnected/role states, reduced motion, 320px reflow. No actual screen-reader or physical-device session; no claim of full WCAG conformance. |
| Layout | **Checked** | All five pages at 320/768/1440 with empty and populated content, wrapping full addresses, explicit table scroll region, stacked cards and claim form. Desktop 200% text enlargement checked; native browser zoom unperformed. |
| Writing | **Checked** | Exact restriction/price warning, required market hours and retirement consequences, Stock Token symbols only, exact feed-description text, actionable local errors, readable custom reasons and fault asset/none. No new marketing features. |
| Typography | **Checked** | Serif/sans hierarchy, 16px fields, tabular numbers, bounded text measure, full addresses and verbatim feed text. System fonts intentionally vary by OS; no external font-loading claim. |
| Colors | **Checked** | Rendered computed foreground/background pairs measured below; failing control border corrected and remeasured. Only light theme exists; dark theme not applicable. |
| UI details | **Checked** | Shelf/tag/basket motifs, consistent surfaces, native loading/disabled/hover/focus/error/empty states, scoped 120ms transitions and reduced-motion off switch. No modal, carousel, theme transition or staged entrance; those checks are not applicable. Slow-motion animation-panel replay unperformed. |

### Findings, repairs and rechecks

| Severity / source | Finding | Repair and evidence |
| --- | --- | --- |
| Medium — `web/src/chain.ts:40` | Final network/source review found the RPC library could follow a feed’s off-chain lookup error by default. | Set `ccipRead: false`, preserving the public-RPC-only boundary. Added a configuration assertion and reran live read/simulation validation and the production build. |
| Medium — `web/src/styles.css:5` | Rendered input boundary `#a29f90` against `#fffef9` measured **2.63:1**, below the 3:1 control-boundary target. | Darkened the shared border primitive to `#8c897b`; final rendered input boundary **3.48:1**. Rebuilt and inspected desktop/mobile forms. |
| Medium — `web/src/chain.ts:60`, `web/src/model.ts:187` | Local invalid amount errors were routed through the generic unreadable-preview fallback. | Added a local `InputError` distinction. Final browser entry `1e18` gives “Enter a decimal amount with up to 18 decimal places.” Unit check and rendered test passed. |
| Medium — `web/src/Flows.tsx:35` | Snapshot refresh after approval cleared the user's existing deposit preview, adding an unnecessary step. | Quote invalidation now follows stock/amount/account changes; allowance still refreshes after confirmation. Approval gating and deposit calldata were rechecked in the final browser suite. Actual browser success-receipt UI remains unperformed. |
| Medium — `web/src/Owner.tsx:267` | Final source review found the genesis confirmation preceded the pairing table. | Reordered the launch sequence to list → check pairings → finalize, with a stacked responsive layout. Rebuilt and rechecked the owner forms. |
| Low — `web/index.html:11`, `web/public/favicon.svg` | Initial fresh page requested a missing root favicon (404). | Added local basket SVG and relative icon link. Final subpath network log reports 200 and zero console errors. |
| Medium — `web/src/model.ts:229` | Source review found sub-dollar negative feed prices could lose their minus sign when the integer part was `-0`. | Preserve the signed zero when formatting. Unit assertion `fmt(-10_000_000n,8,4) === '-0.1'` passed. |

Final measured rendered color pairs (WCAG relative luminance formula; ratios rounded):

| Pair | Ratio |
| --- | ---: |
| Body `#292e26` / page `#f8f6ed` | 12.82:1 |
| Supporting text `#66695f` / surface `#fffef9` | 5.54:1 |
| Supporting text `#66695f` / green side panel `#e5eddf` | 4.67:1 |
| Banner `#654810` / `#fff1cb` | 7.52:1 |
| Primary label `#fffef9` / `#24513c` | 8.97:1 |
| Input border `#8c897b` / `#fffef9` | 3.48:1 |
| Focus ring `#185bac` / focused button background `#eceadd` | 5.55:1 |

No unresolved observed primary-flow or responsive blocker remains. Live launch conditions, public RPC availability, token issuer restrictions and wallet/provider behavior can change; simulations/previews are point-in-time observations. The fixed UTC contract gate has no explicit holiday calendar, as documented in README. These limitations are not hidden behind a simulated success claim.

## Packaging

`dist/` contains only the HTML, local favicon, CSS and two runtime JS assets. No dependency folders, caches, source maps or archive mirrors are included. `.gitignore` has an explicit 256-byte path budget and uses 201 bytes. Existing contract sources/configuration/dependencies are unchanged. Final conservative candidate byte totals and exported-file hashes are recorded in `package-audit.json`; the full raw candidate size is below the 8 MiB limit, before any Git compression.

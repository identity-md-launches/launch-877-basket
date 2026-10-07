# Local adversarial review

The review target is `src/BaskVault.sol` with the assignment's fixed economics and roles. No live contracts, forks, wallet keys or production transactions were used.

Original accepted-round local checks: `forge build`, `forge test` (59 passing tests, including three fuzz tests at 256 runs each), and `forge fmt --check` all passed with Solidity 0.8.26. BaskVault runtime is 20,951 bytes, below the 24,000-byte threshold. Foundry's heuristic lint warnings include the required timestamp arithmetic and events after guarded token interactions; the callback and timing tests exercise those paths.

The withdrawal attack surface is confined to bounded balance reads and isolated payments. Owner and guardian entry points cannot change the redemption loop, its fees or claim permissions. Closing, pausing, setting the NAV cap to zero and retiring every asset are exercised while redemption remains available. A fee recipient contract that reverts on every call receives BASK fee accounting successfully because it is never called.

Tests give redemption 27,900,000 gas, cool the vault and token accesses, and require every one of 64 positive legs to be paid or recorded as debt. Observed call gas:

| 64-asset scenario | Measured call gas |
| --- | ---: |
| All balance reads exhaust gas | 22,789,402 |
| All transfers exhaust gas | 19,916,698 |
| Mixture of paused, blocked, malformed and exact-transfer failures | 4,668,338 |
| All retired with missing token runtime | 3,891,515 |

Each token can consume at most 50,000 gas for its availability read and 250,000 gas for its payment self-call. That is 19,200,000 gas across 64 assets, before fixed vault accounting overhead. Return data is not copied into an unbounded dynamic buffer. If the payment changes a balance incorrectly, the self-call reverts those token effects before creating a claim. Arithmetic for legs uses a full precision product so a large managed balance cannot cause intermediate multiplication overflow.

Accounting tests check that managed funds plus reserved claims equal the actual vault balance in the absence of surplus or confiscation. Mixed-action fuzz tests separately account for donations and sum both users' debts and BASK balances. Confiscation tests check that managed accounting changes only through the specified loss process or redemption, that the seven-day wait cannot be reset by equal flags, and that recognizing a partially recovered loss uses its current size.

The claim path deliberately has no fixed payment or balance-read gas allowance. A test upgrades a token to require more than the redemption allowance, creates debt during redemption, and then successfully claims it. Claims still depend on the token ultimately returning valid data and moving funds. A token that lies consistently about balances is outside the properties any vault can establish from its ERC-20 interface.

Other checks cover constructor parameters, empty deployment, bytecode size and forbidden escape opcodes, double validation of listing/feed proposals, cancellation epochs, inclusive/exclusive time boundaries, price bands, retired-asset exclusion, probation, cap and bucket limits, no-price redemption, receiver minimums and deadlines, fee rounding, token callback reentrancy and internal payment authorization.

These are local implementation tests and self-review, not an independent audit. No Slither or Mythril run, live feed identity verification, chain execution benchmark or external upgrade review is claimed. The contract assumes the requested token and feed interfaces and raw 18-decimal Stock Token accounting. Verify actual token/feed pairing and review external upgrade powers before the owner finalizes genesis.

## Revision findings and disposition

All eight reports' behavioral scenarios reproduce. Production contracts, deployment parameters and economics are unchanged. Seven requests for different behavior are disputed because they add restrictions or recovery mechanisms outside the explicit brief; this does not dispute their economic or availability consequences. The retirement extraction report requested a note only and is addressed in the README. `test/RevisionFindings.t.sol` adds 13 local reproductions and controls. Its passing assertions demonstrate the risks, not their removal.

| Finding ID prefix | Local result | Disposition |
| --- | --- | --- |
| `6e714ebf9d08` | A 1000x execution-time band answer lets a 0.25-token deposit redeem `61.317677419354838709` of each of three other assets. The honest price then produces `OutsideBand`. The listing variant at its $5,000 probation cap pays `15.433972068853523871` of each live asset. | Disputed change: the brief specifies execution-time re-centering, positive-answer listing, permissionless execution, and no added safeguard. There is no old band for a new listing. Documentation now explains both risks and the limits of operator action. |
| `48206a61a1da` | Retirement followed by user redemption leaves `1e15` dead shares and `ZeroNAV`; new listings and donations do not cure it. Full loss recognition has the same result, including after all user shares burn. | Disputed change: the requested recovery contradicts the explicit deposit rule to revert when NAV is zero with existing supply. No reset, forced share burn or alternate mint formula is specified. |
| `837d258ed4ac` | A fresh $10 replacement fails against the $25–$400 band; the seven-day-old original feed prevents re-centering; another asset's deposit reports `StalePrice`. | Disputed change: both checks are expressly required. Documented the absence of a truthful repair path while these conditions persist and retirement's consequences. |
| `952288203837` | Retiring one of three fresh assets produces `MarketNotFresh`, including when another held asset keeps live NAV positive. | Disputed change: retirement must skip every deposit check, which includes the quorum. Documentation calls out the need for three fresh unretired assets. |
| `1a92e4b7aee8` | A readable zero balance lasting through recognition reduces managed to zero despite a deposit pause. After the real 100-token balance returns, redemption and claim pay zero. A control restores the read before recognition and preserves managed. | Disputed change: loss recognition is permissionless and applies to the current shortfall after seven days; recovery accounting and role cancellation are not authorized. Documented finality. |
| `95658eb9f8df` | Seven simultaneous listing proposals execute on days 7–13. The eighth hits `ChangeCooldown` just before day 14 and expires at day 14. | Disputed change: automatic scheduling or expiry extensions would change the specified cooldown/window. Documented the batching limitation. |
| `dcbe805bab63` | Direct ownership transfer to the guardian and guardian execution before pending ownership acceptance both combine the roles. | Disputed change: the brief imposes distinct constructor arguments, not a perpetual separation invariant. The advisory itself acknowledges that distinction. Documented operator responsibility. |
| `d3e5853ef3e9` | With $1 live NAV after retirement, a $100 deposit receives `98.509950248756218905` of the 100 retired tokens on redemption. | Note-only report addressed with quantified dilution and operational guidance. No mitigation is claimed or added. |

The unchanged supplied proofs were copied to `test/scratch/` and run with:

```sh
forge test --offline --match-path 'test/scratch/Proof_*.t.sol' -vv
```

All three supplied test cases failed as reported: the band proof compared `62317677419354838709 >= 1000000000000000000`; both zero-NAV proofs compared reason `18 != 0`. These proof failures remain disputed, not repaired. The band proof also has an independent assertion error: it seeds the executor with `1e18` of every stock, then requires its final balance of stock 1 to be **less** than `1e18`. Rejected execution/deposit leaves that balance unchanged, so either suggested prevention still fails the proof. The cancellation control in the new tests demonstrates this without changing the supplied proof. The zero-NAV proofs explicitly demand successful deposits in the precise state that the brief requires to revert.

Only the two primary proof files were present in the supplied inputs. The advisory's referenced `Proof_56bf3a113dc6.t.sol` was absent; both described ownership sequences were independently recreated. Scratch copies of the failing input proofs were removed after their results were recorded; the pinned inputs were not edited. Normal project tests remain runnable without those intentionally failing review assertions.

Revision validation with Foundry 1.8.3 and Solidity 0.8.26:

```sh
forge fmt
forge fmt --check
forge build --offline
forge test --offline -vv
forge test --offline --fuzz-seed 0x4b41534b --fuzz-runs 1024
```

Build and formatting passed. Both full project test runs passed all 72 tests with zero failures or skips; the second used 1,024 runs for each of the three fuzz tests. The four 64-asset withdrawal attacks reproduced the gas measurements above, all below 28,000,000 gas. Runtime remains 20,951 bytes. All eight response IDs and verdicts in `.imd-responses.json` were checked for completeness and valid JSON. These successful project checks do not supersede the recorded failures and disputes of the supplied review proofs.

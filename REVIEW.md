# Local adversarial review

The review target is `src/BaskVault.sol` with the assignment's fixed economics and roles. No live contracts, forks, wallet keys or production transactions were used.

Final local checks: `forge build`, `forge test` (59 passing tests, including three fuzz tests at 256 runs each), and `forge fmt --check` all passed with Solidity 0.8.26. BaskVault runtime is 20,951 bytes, below the 24,000-byte threshold. Foundry's heuristic lint warnings include the required timestamp arithmetic and events after guarded token interactions; the callback and timing tests exercise those paths.

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

# Basket Protocol

Basket is an immutable index vault for Stock Tokens on Robinhood Chain (chain ID **4663**). The vault itself is the **Basket / BASK** ERC-20 share, with 18 decimals, zero initial supply and no supply cap. Deposits mint shares; redemptions burn shares. This project contains contracts, local mocks, tests and a deployment manifest.

## Build and test

```sh
forge build
forge test
forge fmt --check
```

`foundry.toml` pins Solidity **0.8.26**, optimization with **200 runs**, **Cancun**, and `bytecode_hash = "none"`. Production contracts have no external library dependencies. Forge Standard Library v1.9.7 is vendored as ordinary files under `lib/forge-std`, with its licenses. Once Foundry and the pinned compiler are installed, compilation and tests need no network. Tests use chain ID 4663, local mocks and fixed timestamps; no fork, environment variables, FFI or filesystem cheatcodes are used.

## Deployment

Deploy `BaskVault(address owner_, address guardian_)` using the literal arguments in [launch.json](launch.json):

| Parameter | Value |
| --- | --- |
| Network | Robinhood Chain, 4663 |
| `owner_` | `0x30B57ECf51D19ABcED7F6f70974e6fBb6f3b9Da3` |
| `guardian_` | `0x5ed39AF86f2C00ad99913B5d727bD68f2A904B68` |
| `STOCK_FACTORY` source constant | `0x4783C67b63dE2B358Ac5951a7D41F47A38F3C046` |
| Initial `NAV_CAP` | USD 1,000,000, expressed as `1_000_000e18` |

The constructor makes no external calls and does not derive ownership from the deploying factory. It rejects zero or equal role arguments. Network selection is the deployer's responsibility; there is no additional chain-ID gate. The pinned factory address comes from the assignment and was exercised with local mocks, not verified against a live RPC. No transactions have been broadcast. The vault remains below 24,000 bytes, so a separate lens is unnecessary.

Before opening deposits, the owner must verify each token/feed pair, list at least three assets using `proposeAsset` or `proposeAssets`, and call `finalizeGenesis` once. During genesis these functions list directly and return proposal ID zero. Finalization opens deposits after 72 hours, subject to all other checks. The contract cannot determine whether a feed describes the correct stock; that pairing is an owner responsibility.

## Assets and accounting

Assets are append-only, in listing order, with a maximum of 64. Listing validates 18 token decimals, `uid()` registration at the factory, 8 feed decimals, a nonzero feed aggregator, unique feed use and a positive answer. Bands start at `answer / 4` and `answer * 4`; an answer too large to represent the upper band is rejected. Feeds answer USD per whole token. All USD amounts have 18 decimals: `value = floor(amount * answer / 1e8)`.

Only `managed[token]` contributes to NAV. Direct donations never mint shares or enter managed accounting. Physical balances are read to detect deficits, reserve debts and verify transfers; surplus can cover existing obligations but is never independently withdrawable. There is no rescue, sweep, asset trading or rebalancing entry point.

A closed asset still contributes to NAV and deposit health checks. A retired asset remains in the list and redemption basket, is permanently closed, contributes zero NAV, and is skipped by **every** deposit check, including the freshness quorum and deficit reads. Feed replacement preserves the existing band, listing timestamp and probation status. Genesis assets have no probation; later listings have 30 days of probation beginning at execution.

## Deposits

`deposit(token, amount, receiver, minSharesOut, deadline)` requires finalized genesis, the 72-hour delay, no deposit pause, an open asset, and a receiver other than zero or the vault. Deadlines are inclusive.

The market gate is exactly Monday through Friday, **15:30 inclusive to 19:30 exclusive UTC**, calculated from Unix time. It does not adjust for holidays or daylight saving time. At least three unretired listed assets must have a successfully read feed timestamp no more than four hours old and not in the future; closed assets can count. The quorum only tests timestamps. Full price validation separately applies to the deposited asset and every unretired asset with managed funds.

Full price validation requires a successful feed read, a positive answer inside the inclusive band, a nonfuture timestamp no more than 26 hours old, and `oraclePaused() == false`. Every unretired asset must have a readable balance and no accounting shortfall. The deposited asset's balance must cover all its outstanding claims.

The incoming transfer must increase the vault balance by exactly `amount`. Using pre-deposit NAV, gross shares equal deposit value for the first deposit, or `floor(value * totalSupply / NAV)` thereafter. Existing supply with zero NAV rejects deposits. The fee is `ceil(gross / 200)`; the receiver gets gross minus fee, less the first deposit's permanent `1e15` shares minted to `address(0xdEaD)`. The receiver must receive a positive amount meeting `minSharesOut`. When the fee recipient is unset, its fee shares are **not minted**, but the fee is still deducted from the receiver's allocation.

The following limits apply to the post-deposit value:

| Limit | Formula |
| --- | --- |
| Total NAV | `NAV2 <= NAV_CAP` |
| Deposited asset, ordinary | `max(floor(NAV2 * 5 / 100), 25_000e18)` |
| Deposited asset, probation | `max(floor(NAV2 / 100), 5_000e18)` |
| One global deposit bucket | `max(floor(NAV2 / 4), 100_000e18)` |

The bucket decays before adding deposit value: subtract `floor(bucket * elapsed / 86400)`, or set it to zero after at least a day. Only successful deposits update the stored bucket and its timestamp. A successful deposit also clears all unretired deficit records.

## Redemption, failed payments and claims

`redeem(shares, minAmountsOut, deadline)` never reads a feed or an oracle pause flag. It ignores genesis, market hours, deposit pauses, asset closes, retirement and caps. Its only administrative fee destination is an internal BASK balance update; the vault never calls `feeRecipient`.

The fee is `ceil(shares / 200)` and net shares are `shares - fee`. With a fee recipient, fee shares are transferred to that address and net shares burned. Otherwise all supplied shares are burned. Each leg uses total supply **before** burning:

```
available = max(vault balance - totalOwed[token], 0)
leg = floor(min(managed[token], available) * net / supplyBeforeBurn)
```

Each balance read for this calculation is a low-level static call with 50,000 gas and a 32-byte output buffer. Failure or a return size other than exactly 32 bytes uses `available = managed[token]`. All leg amounts are determined before any token payment. Missing minimum entries mean zero; entries past the asset list are ignored. A minimum checks the leg entitlement, which may become debt if payment fails.

Each nonzero leg reduces managed accounting and is paid in an external self-call capped at 250,000 gas. `payLeg` is callable only by the vault. It requires a successful transfer returning no data or exactly the boolean true, and an exact decrease in the vault balance. Failed postconditions revert the entire self-call, including any token movement. The outer redemption then records `owed[caller][token]` and `totalOwed[token]` and proceeds to the other assets. Bounded return buffers avoid copying hostile return data. Full precision multiplication avoids intermediate overflow in proportional legs.

`claim(token, to)` pays `min(caller's debt, current vault balance)`. Claims ignore all gates and role controls. The self-call and its balance reads have no fixed gas allowance on this path, permitting recovery after a token becomes more expensive. If a claim fails, its debt reduction rolls back. A blocked caller can nominate another receiving address. If actual funds cannot cover all creditors, claims use available funds in transaction order, as specified. Outgoing checks measure the vault's decrease; they do not guarantee what an externally modified token credits to its recipient.

Every user-facing state change holds the reentrancy guard and emits an event. The self-only payment helper runs under its caller's guard and emits `LegPaid`. No role can seize shares, move assets outside these flows, prohibit redeem/claim, upgrade the vault or change the fee.

## Deficits

`flagDeficit(token)` records `managed - available` only when positive and larger than the existing record; an increased record starts a new seven-day wait. An identical or smaller shortfall cannot reset the clock. `recognizeLoss(token)` becomes permissionless at seven days and reduces managed by the smaller of the recorded and current shortfall, then clears the record. Neither operation treats an unreadable balance as a proven loss. Nothing reduces managed automatically merely because tokens disappear. Donations can repair a deficit without increasing managed.

## Governance

The owner can propose listings, feed replacements, band re-centering, reopening, retirement, guardian replacement and NAV-cap increases. Anyone can execute from `createdAt + 7 days` inclusive until `createdAt + 14 days` exclusive. Listing and feed metadata checks repeat at execution. Replacement feed answers must fit the current band both times. Band re-centering uses the execution answer, which must be positive, nonfuture and **strictly less** than 26 hours old; it may be outside the old band.

Listing and feed replacement share one 24-hour execution cooldown. Genesis direct listings are exempt. Retirement requires closure at both proposal and execution. Every later close cancels earlier reopening proposals, including another close of an already closed asset. Lowering the NAV cap immediately cancels every pending increase; increases cannot exceed `10_000_000_000e18`. Zero is a valid lowered cap.

The owner can cancel any pending proposal. The guardian can cancel all except guardian replacement. Both can pause deposits or close an asset immediately; only the owner can unpause. The owner also has two-step ownership transfer with no renounce entry point, and a one-time `setFeeRecipient` that rejects zero and the vault. No function later changes that recipient. Pending ownership and other pending proposals are not implicitly discarded by an ownership transfer.

Reopening and cap-raise cancellation use version counters, so an arbitrary number of old proposals never makes a close or cap decrease expensive. `proposalState(id)` is the effective status, including these cancellations and time expiry. The raw `proposals(id)` getter preserves the stored record and may still show Pending for an effectively cancelled or expired proposal.

## Views and integration

| View | Meaning |
| --- | --- |
| `assets(index)`, `assetCount()`, `assetIndex(token)` | Stable asset order; token index is one-based, zero means unlisted |
| `allAssets()` | Feed, answer, timestamp, band, open/retired/probation flags, listing time, managed amount, short flag, read-success flags and total debt |
| `previewDeposit(token, amount)` | NAV, value, gross, fee, receiver shares, locked shares and updated bucket; enforces current eligibility and amount-dependent caps |
| `previewRedeem(shares)` | Fee, net and leg entitlements in asset order; does not simulate payment success |
| `depositStatus(token)` | Current token and vault eligibility, using the same shared checks and reason codes as deposit |
| `pendingProposals(start, count)` | Pending IDs and records within a page of historical IDs, starting at 1; start zero means 1 |
| `proposalState(id)` | Effective lifecycle state |

`depositStatus` has no amount, receiver, minimum or deadline arguments; use `previewDeposit` and transaction simulation for those checks. `DepositUnavailable(reason, asset)` uses the following enum values. Global faults have the zero address; amount-dependent caps report the deposited token.

| Code | Reason | Code | Reason |
| --- | --- | --- | --- |
| 0 | OK | 11 | FeedUnreadable |
| 1 | Genesis | 12 | NonpositivePrice |
| 2 | OpeningDelay | 13 | OutsideBand |
| 3 | Paused | 14 | FuturePrice |
| 4 | NotListed | 15 | StalePrice |
| 5 | Closed | 16 | OracleUnreadable |
| 6 | MarketClosed | 17 | OraclePaused |
| 7 | MarketNotFresh | 18 | ZeroNAV |
| 8 | BalanceUnreadable | 19 | NAVCap |
| 9 | OwedUncovered | 20 | AssetCap |
| 10 | Deficit | 21 | BucketCap |

An unreadable asset's `short` flag is false because available falls back to managed; consult `balanceReadable` to distinguish that from proven solvency. Prices in `allAssets` are raw observations, not assertions of price validity. Previews can change before execution; set deadlines and minimums.

## Review and operations

The accepted design includes these risks without additional mechanisms:

1. A deposit followed by redemption can profit if a feed lags more than the 1% round-trip fee.
2. The owner must pair each token with its true feed.
3. An untransferable asset retains its feed value until deposits are paused. The guardian and owner must monitor transfers and act promptly.
4. Retirement makes an asset worth zero in deposit NAV while preserving its redemption leg.

Operators must monitor feed freshness, token upgrades and restrictions, physical deficits, outstanding claims, pending proposals and cap usage. External token administrators and the chain can affect whether assets actually move. The vault can isolate a failed payment and preserve its claim; it cannot make an external token honor transfers.

The local adversarial suite covers paused, blocked, missing-runtime, malformed-return and gas-exhausting tokens; 64-asset redemptions; debt conservation; exact transfer rollback; reentrancy; price and market boundaries; proposal timing and roles; losses; fees and caps. Fuzzing checks arithmetic and mixed deposit/redeem/claim/donation sequences. All 64-asset attacks use cold accesses and a 27,900,000-gas call ceiling. See [REVIEW.md](REVIEW.md) for measured results and limitations. This implementation and its self-review still require independent adversarial review before a funded release.

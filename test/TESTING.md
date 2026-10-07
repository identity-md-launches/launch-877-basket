# Basket vault tests

Run from the repository root, with the existing local dependencies:

```sh
forge build --offline
forge test --offline
forge fmt --check
forge test --offline --fuzz-seed 0xb45c4663 --fuzz-runs 2048
```

The tests use chain id 4663, local Stock Token and feed stand-ins, and the factory
constant from BaskVault. They require no RPC, fork, environment lookup, or external
process. Source and build configuration are unchanged.

## Stateful accounting

`BasketInvariant.t.sol` runs four actors against three assets, both with fees unset
and with a fee recipient who also transfers and redeems shares. Each configuration
has 256 sequences of 64 calls, configured inline on the concrete invariant. The
runner targets only the handler's selected actions and fails on unexpected reverts.

Random actions include deposits, partial and full redemptions, share transfers and
allowances, failed token transfers, claims to alternate recipients, donations,
confiscations, deficit flags, loss recognition, time advancement, deposit pauses,
asset closes, and delayed reopens. Expected failures assert the specific error.
Every sequence starts with actual deposits. A deterministic handler test exercises
debt creation, a partial claim, recognition of a loss, recovery, and redemption
while deposits are paused and an asset is closed.

Independent cumulative token-flow counters support these exact identities after
every action, for each asset:

- `managed + totalOwed + paid + recognizedLosses = deposited`
- `vaultTokenBalance + paid + confiscated = deposited + donated`
- `totalOwed = sum(owed[actor])`
- `totalSupply = sum(actorShares) + permanentDeadShares`

Per-action assertions also check payment recipients, failed-claim rollback,
preview/actual redemption agreement, clearing of loss records after deposits, and
the seven-day recognition delay. The custody identity deliberately permits
deficits: confiscation does not automatically reduce managed balances. Donations
do not become managed assets.

## Additional adversarial properties

`BasketProperties.t.sol` uses 1,000 examples per property for first-deposit rounding
and receiver attribution, donation resistance, full-width fee rounding, and 16
consecutive deposit/redeem cycles without profit at fixed prices. Unit tests cover
late-leg slippage rollback (including an earlier payment and queued debt), rejected
deposit rollback, caller-specific and repeated claims, zero/one-wei redemptions,
infinite allowances, self-transfers, and deposit/payment/debt event beneficiaries.

`RedemptionAttack.t.sol` retains the 64-asset hostile-token scenarios, including
gas exhaustion, malformed returns, blocking, pauses, and erased token runtime.
The 27,900,000-gas external-call budget checks redemption liveness without comparing
`gasleft()` across Foundry's isolated calls.

An additional 128-run fuzz test mixes transfer and balance-read failures across all
64 assets, with existing claims belonging to another holder, partial deficits, and
direct donations. It checks redemption rounding with independent floor inequalities,
fee routing, preservation of prior claims, and exact payment-or-debt accounting.
Real custody is inspected after restoring mock reads, so a failed transfer cannot
silently move tokens. The same gas budget applies while deposit pauses, asset closes,
broken feeds, and a zero NAV cap are active.

The existing governance, price, cap, probation, loss, and access-control tests remain
part of the full suite. Fixed-price round-trip properties make no claim about the
accepted lagging-feed profit risk or retired assets' zero NAV contribution. Local
stand-ins do not establish which live feed belongs to a Stock Token, or validate
the deployed behavior of external contracts.

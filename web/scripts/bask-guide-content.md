# BASK

BASK represents a share of the Stock Tokens accounted for by the vault. Deposits create new BASK. Redemptions burn BASK and release a proportional amount of each stock. Its supply grows and shrinks with those actions; there is no fixed supply.

## What one BASK represents

The vault's net asset value, or NAV, is the sum of each stock's managed quantity multiplied by its feed price. Dividing that value by the total BASK supply gives the feed-based backing per BASK. The total supply includes fee BASK and the permanently locked first-deposit amount. BASK's trading price can be different.

**NAV = sum of managed stock quantities × their feed prices**

**Backing per BASK = NAV ÷ BASK supply**

Managed quantities are the vault's accounted holdings. Stock already owed to earlier redeemers is kept separate. Direct donations are not counted until a Resync updates the accounting.

## Minting BASK

You can deposit one or more eligible Stock Tokens. The vault values each amount using its feed price, then adds those values together. Your deposit receives the same backing per BASK as the existing supply, before the fee.

**Deposit value = sum of deposited quantities × their feed prices**

**Gross BASK = deposit value × BASK supply ÷ NAV before the deposit**

**BASK you receive = gross BASK − deposit fee**

The deposit fee is 0.5% of gross BASK. Fee BASK is minted to the fee recipient alongside the BASK minted to you. The Stock Tokens stay in the vault.

### Example 1: the first deposit

When the supply is zero, the first deposit creates 1 gross BASK per $1 of deposit value. It also locks 0.001 BASK forever. That lock is taken only on the first deposit. Here, you deposit 10 Stock A at a feed price of $100 each.

| Step | Amount |
| --- | --- |
| Deposit value: 10 Stock A × $100 | $1,000 |
| Gross BASK created | 1,000 BASK |
| Deposit fee: 1,000 × 0.5% | 5 BASK |
| Permanently locked | 0.001 BASK |
| You receive | 994.999 BASK |

The total supply is 1,000 BASK: your 994.999, the 5 paid as the fee and the 0.001 permanently locked.

### Example 2: adding to an existing basket

Suppose the vault has $20,000 of NAV and a total supply of 10,000 BASK. Each BASK has $2 of feed-based backing. You deposit 5 eligible Stock C at a feed price of $200 each, worth $1,000 in total.

| Step | Amount |
| --- | --- |
| Gross BASK: $1,000 × 10,000 ÷ $20,000 | 500 BASK |
| Deposit fee: 500 × 0.5% | 2.5 BASK |
| You receive | 497.5 BASK |
| NAV after the deposit | $21,000 |
| BASK supply after the deposit | 10,500 BASK |

At unchanged feed prices, $21,000 ÷ 10,500 is still $2 of backing per BASK. The fee changes how the new BASK is divided between you and the fee recipient.

## Redeeming BASK

You submit BASK and receive a share of each stock in the vault. The 0.5% redemption fee is transferred in BASK to the fee recipient. The remaining BASK is burned.

**BASK burned = BASK submitted − redemption fee**

**Your fraction = BASK burned ÷ BASK supply before the redemption**

**Each stock amount = that stock's redeemable quantity × your fraction**

For a readable balance, the redeemable quantity is the smaller of its managed quantity and the balance available after earlier claims are reserved. If the balance cannot be read, the calculation uses the managed quantity and an unsuccessful payment is queued. Redemption calculates quantities without using price feeds.

### Example 3: receiving both stocks

Consider a separate basket with a total supply of 10,000 BASK and the two stocks below. You redeem 1,000 BASK: 5 BASK is the fee, 995 BASK is burned, and your fraction is 995 ÷ 10,000 = 9.95%.

| Stock | Redeemable quantity | Your fraction | You receive |
| --- | --- | --- | --- |
| Stock A | 100 | 9.95% | 9.95 Stock A |
| Stock B | 60 | 9.95% | 5.97 Stock B |

For illustration, if Stock A's feed price is $80 and Stock B's is $200, the basket's NAV is $20,000 and these stock amounts have a combined feed value of $1,990. Those prices explain the value; they are not inputs to the redemption calculation. The BASK supply becomes 9,005 because only the 995 BASK is burned; the 5 fee BASK remains in circulation.

### Example 4: one stock is queued

Use the same redemption, but suppose Stock B cannot be transferred and the basket is within the direct-payout limit. Stock A can still be paid. The receiver's claim to Stock B is recorded separately.

| Stock | Paid now | Owed to the receiver |
| --- | --- | --- |
| Stock A | 9.95 Stock A | 0 |
| Stock B | 0 | 5.97 Stock B |

Only the receiver wallet can claim the queued stock. Choose a receiver you control. Claiming does not burn more BASK or charge another redemption fee; gas still applies. Payment depends on the token becoming transferable and the vault having an available balance. If the basket exceeds the direct-payout limit, all stock amounts are queued for claiming.

## The arbitrage flywheel

As the prices of the stocks inside BASK move, BASK’s market price can drift away from the value of the stocks it represents. That gap creates an opportunity for arbitrageurs:

• BASK trades above its backing value: deposit stocks to mint BASK, then sell that BASK on the market.

• BASK trades below its backing value: buy BASK on the market, then redeem it for its share of the underlying stocks.

When the difference covers fees and trading costs, arbitrageurs can profit from closing the gap. Their trades help bring BASK’s market price closer to its backing value. Each mint or redemption pays a 0.5% fee in BASK to ITEM staking.

**Stock prices move → price gaps open → arbitrageurs mint or redeem → BASK fees flow to ITEM stakers.**

## How TVL and liquidity support the flywheel

TVL is the total value of the stocks held by the vault. As TVL and basket diversity grow, so does the potential for arbitrage: a larger basket provides more backing to trade against, while a wider mix of stocks creates more individual price movements that can open up opportunities.

Liquidity in the BASK/USDG pool helps turn those opportunities into trades. A deeper pool lets arbitrageurs buy and sell larger amounts of BASK with less price impact, making more price gaps practical to capture.

Together, a larger and more diverse basket and deeper BASK/USDG liquidity can create more arbitrage opportunities and support larger trades. Each opportunity captured through minting or redemption generates BASK fees for ITEM stakers.

**More backing + more stock diversity + deeper liquidity → more room for arbitrage → more minting and redemption activity → more BASK fees for ITEM stakers.**

### A simple example: ten stocks in the basket

The basket holds 10 stocks worth $10,000 each, for $100,000 total. With 100,000 BASK outstanding, each BASK represents $1 of backing.

Two stocks rise 10%. Those holdings are now worth $11,000 each, while the other eight remain worth $10,000 each.

The basket is now worth $102,000, or $1.02 per BASK. But BASK is still available on the market for $1.

An arbitrageur:

1. Buys 1,000 BASK for $1,000.

2. Redeems it. The 0.5% fee sends 5 BASK to ITEM staking, and the remaining 995 BASK is burned.

3. Receives 0.995% of each stock holding:

| Holding | Received |
| --- | --- |
| Eight unchanged stocks: $99.50 each | $796 |
| Two stocks that rose: $109.45 each | $218.90 |
| Total stock value received | $1,014.90 |

4. Sells those stocks at the illustrated prices, capturing $14.90 before other trading costs and gas.

The arbitrageur captures the price difference, buying pressure helps move BASK’s market price toward its backing value, and ITEM stakers receive 5 BASK in fees.

## Reading a real preview

These are independent worked examples, with the 0.5% fee enabled and gas excluded. They are not live quotes. The contract charges the fee when a fee recipient is configured; otherwise it is zero.

BASK has 18 decimals. The contract rounds the BASK fee up to the smallest BASK unit, gross minting down to the smallest BASK unit, and each redemption amount down to that stock's smallest unit. The examples use amounts that divide exactly.

Deposits must pass the vault's price, balance, availability and size-limit checks. A new deposit is rejected if the vault's NAV falls to zero. Your transaction also carries an expiry and minimum amounts: a deposit reverts if it would mint less BASK than your minimum, and a redemption reverts if a stock allocation falls below its supplied minimum. A queued allocation can still satisfy a redemption minimum; the minimum does not guarantee immediate delivery.

Use the Deposit or Redeem preview for the amounts calculated from the current vault state.

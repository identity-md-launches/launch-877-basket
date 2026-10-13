// Static worked examples, derived in integer base units from the vault's arithmetic.
export const UNIT = 10n ** 18n;
export const LOCK = 10n ** 15n;
export const FEE_DENOMINATOR = 200n;
export function fee(amount: bigint, enabled = true) {
  return enabled ? amount / FEE_DENOMINATOR + (amount % FEE_DENOMINATOR === 0n ? 0n : 1n) : 0n;
}
export function value(amount: bigint, answer: bigint, tokenDecimals: number, feedDecimals: number) {
  const exponent = tokenDecimals + feedDecimals;
  return exponent >= 18 ? amount * answer / 10n ** BigInt(exponent - 18) : amount * answer * 10n ** BigInt(18 - exponent);
}
export function deposit(depositValue: bigint, supply: bigint, nav: bigint, enabled = true) {
  if (supply !== 0n && nav === 0n) throw new Error("Zero NAV");
  const gross = supply === 0n ? depositValue : depositValue * supply / nav;
  const charged = fee(gross, enabled), locked = supply === 0n ? LOCK : 0n;
  if (gross - charged <= locked) throw new Error("Zero shares");
  return { gross, fee: charged, locked, received: gross - charged - locked, supplyAfter: supply + gross, navAfter: nav + depositValue };
}
export function redeem(submitted: bigint, supply: bigint, enabled = true) {
  if (supply === 0n || submitted > supply) throw new Error("Invalid supply");
  const charged = fee(submitted, enabled), burned = submitted - charged;
  return { fee: charged, burned, supplyAfter: supply - burned };
}
export function allocation(managed: bigint, balance: bigint | null, owed: bigint, burned: bigint, supply: bigint) {
  const available = balance === null ? managed : balance > owed ? balance - owed : 0n;
  const redeemable = managed < available ? managed : available;
  return redeemable * burned / supply;
}
export function format(value: bigint, decimals = 18) {
  const unit = 10n ** BigInt(decimals), whole = value / unit;
  const fraction = (value % unit).toString().padStart(decimals, "0").replace(/0+$/, "");
  return whole.toLocaleString("en-US") + (fraction ? "." + fraction : "");
}
const u = (n: bigint) => n * UNIT;
export const FIRST = { quantity: u(10n), price: u(100n) };
export const FIRST_VALUE = value(FIRST.quantity, FIRST.price, 18, 18);
export const INITIAL = deposit(FIRST_VALUE, 0n, 0n);
export const EXISTING = { quantity: u(5n), price: u(200n), nav: u(20_000n), supply: u(10_000n) };
export const EXISTING_VALUE = value(EXISTING.quantity, EXISTING.price, 18, 18);
export const ADDED = deposit(EXISTING_VALUE, EXISTING.supply, EXISTING.nav);
export const REDEMPTION = { submitted: u(1_000n), supply: u(10_000n), stocks: [{ name: "Stock A", quantity: u(100n), price: u(80n) }, { name: "Stock B", quantity: u(60n), price: u(200n) }] };
export const REDEEMED = redeem(REDEMPTION.submitted, REDEMPTION.supply);
export const OUTPUTS = REDEMPTION.stocks.map(s => allocation(s.quantity, s.quantity, 0n, REDEEMED.burned, REDEMPTION.supply));
export const FRACTION = format(REDEEMED.burned * 100n * UNIT / REDEMPTION.supply) + "%";
export const REDEMPTION_NAV = REDEMPTION.stocks.reduce((n, s) => n + value(s.quantity, s.price, 18, 18), 0n);
export const OUTPUT_VALUE = REDEMPTION.stocks.reduce((n, s, i) => n + value(OUTPUTS[i], s.price, 18, 18), 0n);
export const FEE_PERCENT = format(100n * UNIT / FEE_DENOMINATOR) + "%";
// The arbitrage flywheel example (owner, 2026-10-13): ten holdings of 100 stock at $100 ($10,000 each, $100,000
// in all) against 100,000 BASK; two holdings rise 10% to $110; 1,000 BASK bought for $1,000 and redeemed.
export const FLYWHEEL = { holdings: 10n, risen: 2n, quantity: u(100n), price: u(100n), risenPrice: u(110n), supply: u(100_000n), bought: u(1_000n) };
export const FLYWHEEL_NAV_BEFORE = value(FLYWHEEL.quantity, FLYWHEEL.price, 18, 18) * FLYWHEEL.holdings;
export const FLYWHEEL_NAV_AFTER = value(FLYWHEEL.quantity, FLYWHEEL.price, 18, 18) * (FLYWHEEL.holdings - FLYWHEEL.risen) + value(FLYWHEEL.quantity, FLYWHEEL.risenPrice, 18, 18) * FLYWHEEL.risen;
export const FLYWHEEL_REDEEMED = redeem(FLYWHEEL.bought, FLYWHEEL.supply);
export const FLYWHEEL_OUTPUT = allocation(FLYWHEEL.quantity, FLYWHEEL.quantity, 0n, FLYWHEEL_REDEEMED.burned, FLYWHEEL.supply);
export const FLYWHEEL_UNCHANGED_VALUE = value(FLYWHEEL_OUTPUT, FLYWHEEL.price, 18, 18);
export const FLYWHEEL_RISEN_VALUE = value(FLYWHEEL_OUTPUT, FLYWHEEL.risenPrice, 18, 18);
export const FLYWHEEL_RECEIVED = FLYWHEEL_UNCHANGED_VALUE * (FLYWHEEL.holdings - FLYWHEEL.risen) + FLYWHEEL_RISEN_VALUE * FLYWHEEL.risen;
export const FLYWHEEL_GAIN = FLYWHEEL_RECEIVED - FLYWHEEL.bought;
export type Block = { kind: "p" | "formula"; text: string } | { kind: "table"; headers: string[]; rows: string[][] };
export type Example = { title: string; blocks: Block[] };
export type Section = Example & { examples: Example[] };

export const INTRO = "BASK represents a share of the Stock Tokens accounted for by the vault. Deposits create new BASK. Redemptions burn BASK and release a proportional amount of each stock. Its supply grows and shrinks with those actions; there is no fixed supply.";
export const SECTIONS: Section[] = [{"title": `What one BASK represents`,
"blocks": [{"kind": "p",
"text": `The vault's net asset value, or NAV, is the sum of each stock's managed quantity multiplied by its feed price. Dividing that value by the total BASK supply gives the feed-based backing per BASK. The total supply includes fee BASK and the permanently locked first-deposit amount. BASK's trading price can be different.`},
{"kind": "formula",
"text": `NAV = sum of managed stock quantities × their feed prices`},
{"kind": "formula",
"text": `Backing per BASK = NAV ÷ BASK supply`},
{"kind": "p",
"text": `Managed quantities are the vault's accounted holdings. Stock already owed to earlier redeemers is kept separate. Direct donations are not counted until a Resync updates the accounting.`}],
"examples": []},
{"title": `Minting BASK`,
"blocks": [{"kind": "p",
"text": `You can deposit one or more eligible Stock Tokens. The vault values each amount using its feed price, then adds those values together. Your deposit receives the same backing per BASK as the existing supply, before the fee.`},
{"kind": "formula",
"text": `Deposit value = sum of deposited quantities × their feed prices`},
{"kind": "formula",
"text": `Gross BASK = deposit value × BASK supply ÷ NAV before the deposit`},
{"kind": "formula",
"text": `BASK you receive = gross BASK − deposit fee`},
{"kind": "p",
"text": `The deposit fee is ${FEE_PERCENT} of gross BASK. Fee BASK is minted to the fee recipient alongside the BASK minted to you. The Stock Tokens stay in the vault.`}],
"examples": [{"title": `Example 1: the first deposit`,
"blocks": [{"kind": "p",
"text": `When the supply is zero, the first deposit creates 1 gross BASK per $1 of deposit value. It also locks ${format(INITIAL.locked)} BASK forever. That lock is taken only on the first deposit. Here, you deposit ${format(FIRST.quantity) + " Stock A"} at a feed price of ${"$" + format(FIRST.price)} each.`},
{"kind": "table",
"headers": [`Step`,
`Amount`],
"rows": [[`Deposit value: ${format(FIRST.quantity) + " Stock A"} × ${"$" + format(FIRST.price)}`,
`$${format(FIRST_VALUE)}`],
[`Gross BASK created`,
`${format(INITIAL.gross)} BASK`],
[`Deposit fee: ${format(INITIAL.gross)} × ${FEE_PERCENT}`,
`${format(INITIAL.fee) + " BASK"}`],
[`Permanently locked`,
`${format(INITIAL.locked)} BASK`],
[`You receive`,
`${format(INITIAL.received)} BASK`]]},
{"kind": "p",
"text": `The total supply is ${format(INITIAL.supplyAfter)} BASK: your ${format(INITIAL.received)}, ${"the " + format(INITIAL.fee) + " paid"} as the fee and the ${format(INITIAL.locked)} permanently locked.`}]},
{"title": `Example 2: adding to an existing basket`,
"blocks": [{"kind": "p",
"text": `Suppose the vault has $${format(EXISTING.nav)} of NAV and a total supply of ${format(EXISTING.supply)} BASK. Each BASK has ${"$" + format(EXISTING.nav * UNIT / EXISTING.supply)} of feed-based backing. You deposit ${format(EXISTING.quantity) + " eligible"} Stock C at a feed price of ${"$" + format(EXISTING.price)} each, worth $${format(EXISTING_VALUE)} in total.`},
{"kind": "table",
"headers": [`Step`,
`Amount`],
"rows": [[`Gross BASK: $${format(EXISTING_VALUE)} × ${format(EXISTING.supply)} ÷ $${format(EXISTING.nav)}`,
`${format(ADDED.gross) + " BASK"}`],
[`Deposit fee: ${format(ADDED.gross) + " ×"} ${FEE_PERCENT}`,
`${format(ADDED.fee)} BASK`],
[`You receive`,
`${format(ADDED.received)} BASK`],
[`NAV after the deposit`,
`$${format(ADDED.navAfter)}`],
[`BASK supply after the deposit`,
`${format(ADDED.supplyAfter)} BASK`]]},
{"kind": "p",
"text": `At unchanged feed prices, $${format(ADDED.navAfter)} ÷ ${format(ADDED.supplyAfter)} is still ${"$" + format(EXISTING.nav * UNIT / EXISTING.supply)} of backing per BASK. The fee changes how the new BASK is divided between you and the fee recipient.`}]}]},
{"title": `Redeeming BASK`,
"blocks": [{"kind": "p",
"text": `You submit BASK and receive a share of each stock in the vault. The ${FEE_PERCENT} redemption fee is transferred in BASK to the fee recipient. The remaining BASK is burned.`},
{"kind": "formula",
"text": `BASK burned = BASK submitted − redemption fee`},
{"kind": "formula",
"text": `Your fraction = BASK burned ÷ BASK supply before the redemption`},
{"kind": "formula",
"text": `Each stock amount = that stock's redeemable quantity × your fraction`},
{"kind": "p",
"text": `For a readable balance, the redeemable quantity is the smaller of its managed quantity and the balance available after earlier claims are reserved. If the balance cannot be read, the calculation uses the managed quantity and an unsuccessful payment is queued. Redemption calculates quantities without using price feeds.`}],
"examples": [{"title": `Example 3: receiving both stocks`,
"blocks": [{"kind": "p",
"text": `Consider a separate basket with a total supply of ${format(REDEMPTION.supply)} BASK and the two stocks below. You redeem ${format(REDEMPTION.submitted)} BASK: ${format(REDEEMED.fee) + " BASK"} is the fee, ${format(REDEEMED.burned)} BASK is burned, and your fraction is ${format(REDEEMED.burned)} ÷ ${format(REDEMPTION.supply)} = ${FRACTION}.`},
{"kind": "table",
"headers": [`Stock`,
`Redeemable quantity`,
`Your fraction`,
`You receive`],
"rows": [[`Stock A`,
`${format(REDEMPTION.stocks[0].quantity)}`,
`${FRACTION}`,
`${format(OUTPUTS[0]) + " Stock A"}`],
[`Stock B`,
`${format(REDEMPTION.stocks[1].quantity)}`,
`${FRACTION}`,
`${format(OUTPUTS[1]) + " Stock B"}`]]},
{"kind": "p",
"text": `For illustration, if Stock A's feed price is ${"$" + format(REDEMPTION.stocks[0].price)} and Stock B's is ${"$" + format(REDEMPTION.stocks[1].price)}, the basket's NAV is $${format(REDEMPTION_NAV)} and these stock amounts have a combined feed value of $${format(OUTPUT_VALUE)}. Those prices explain the value; they are not inputs to the redemption calculation. The BASK supply becomes ${format(REDEEMED.supplyAfter)} because only the ${format(REDEEMED.burned)} BASK is burned; the ${format(REDEEMED.fee) + " fee"} BASK remains in circulation.`}]},
{"title": `Example 4: one stock is queued`,
"blocks": [{"kind": "p",
"text": `Use the same redemption, but suppose Stock B cannot be transferred and the basket is within the direct-payout limit. Stock A can still be paid. The receiver's claim to Stock B is recorded separately.`},
{"kind": "table",
"headers": [`Stock`,
`Paid now`,
`Owed to the receiver`],
"rows": [[`Stock A`,
`${format(OUTPUTS[0]) + " Stock A"}`,
`0`],
[`Stock B`,
`0`,
`${format(OUTPUTS[1]) + " Stock B"}`]]},
{"kind": "p",
"text": `Only the receiver wallet can claim the queued stock. Choose a receiver you control. Claiming does not burn more BASK or charge another redemption fee; gas still applies. Payment depends on the token becoming transferable and the vault having an available balance. If the basket exceeds the direct-payout limit, all stock amounts are queued for claiming.`}]}]},
{"title": `The arbitrage flywheel`,
"blocks": [{"kind": "p",
"text": `As the prices of the stocks inside BASK move, BASK’s market price can drift away from the value of the stocks it represents. That gap creates an opportunity for arbitrageurs:`},
{"kind": "p",
"text": `• BASK trades above its backing value: deposit stocks to mint BASK, then sell that BASK on the market.`},
{"kind": "p",
"text": `• BASK trades below its backing value: buy BASK on the market, then redeem it for its share of the underlying stocks.`},
{"kind": "p",
"text": `When the difference covers fees and trading costs, arbitrageurs can profit from closing the gap. Their trades help bring BASK’s market price closer to its backing value. Each mint or redemption pays a 0.5% fee in BASK to ITEM staking.`},
{"kind": "formula",
"text": `Stock prices move → price gaps open → arbitrageurs mint or redeem → BASK fees flow to ITEM stakers.`}],
"examples": []},
{"title": `How TVL and liquidity support the flywheel`,
"blocks": [{"kind": "p",
"text": `TVL is the total value of the stocks held by the vault. As TVL and basket diversity grow, so does the potential for arbitrage: a larger basket provides more backing to trade against, while a wider mix of stocks creates more individual price movements that can open up opportunities.`},
{"kind": "p",
"text": `Liquidity in the BASK/USDG pool helps turn those opportunities into trades. A deeper pool lets arbitrageurs buy and sell larger amounts of BASK with less price impact, making more price gaps practical to capture.`},
{"kind": "p",
"text": `Together, a larger and more diverse basket and deeper BASK/USDG liquidity can create more arbitrage opportunities and support larger trades. Each opportunity captured through minting or redemption generates BASK fees for ITEM stakers.`},
{"kind": "formula",
"text": `More backing + more stock diversity + deeper liquidity → more room for arbitrage → more minting and redemption activity → more BASK fees for ITEM stakers.`}],
"examples": [{"title": `A simple example: ten stocks in the basket`,
"blocks": [{"kind": "p",
"text": `The basket holds 10 stocks worth $10,000 each, for $100,000 total. With 100,000 BASK outstanding, each BASK represents $1 of backing.`},
{"kind": "p",
"text": `Two stocks rise 10%. Those holdings are now worth $11,000 each, while the other eight remain worth $10,000 each.`},
{"kind": "p",
"text": `The basket is now worth $102,000, or $1.02 per BASK. But BASK is still available on the market for $1.`},
{"kind": "p",
"text": `An arbitrageur:`},
{"kind": "p",
"text": `1. Buys 1,000 BASK for $1,000.`},
{"kind": "p",
"text": `2. Redeems it. The 0.5% fee sends 5 BASK to ITEM staking, and the remaining 995 BASK is burned.`},
{"kind": "p",
"text": `3. Receives 0.995% of each stock holding:`},
{"kind": "table",
"headers": [`Holding`,
`Received`],
"rows": [[`Eight unchanged stocks: $99.50 each`,
`$796`],
[`Two stocks that rose: $109.45 each`,
`$218.90`],
[`Total stock value received`,
`$1,014.90`]]},
{"kind": "p",
"text": `4. Sells those stocks at the illustrated prices, capturing $14.90 before other trading costs and gas.`},
{"kind": "p",
"text": `The arbitrageur captures the price difference, buying pressure helps move BASK’s market price toward its backing value, and ITEM stakers receive 5 BASK in fees.`}]}]},
{"title": `Reading a real preview`,
"blocks": [{"kind": "p",
"text": `These are independent worked examples, with the ${FEE_PERCENT} fee enabled and gas excluded. They are not live quotes. The contract charges the fee when a fee recipient is configured; otherwise it is zero.`},
{"kind": "p",
"text": `BASK has 18 decimals. The contract rounds the BASK fee up to the smallest BASK unit, gross minting down to the smallest BASK unit, and each redemption amount down to that stock's smallest unit. The examples use amounts that divide exactly.`},
{"kind": "p",
"text": `Deposits must pass the vault's price, balance, availability and size-limit checks. A new deposit is rejected if the vault's NAV falls to zero. Your transaction also carries an expiry and minimum amounts: a deposit reverts if it would mint less BASK than your minimum, and a redemption reverts if a stock allocation falls below its supplied minimum. A queued allocation can still satisfy a redemption minimum; the minimum does not guarantee immediate delivery.`},
{"kind": "p",
"text": `Use the Deposit or Redeem preview for the amounts calculated from the current vault state.`}],
"examples": []}];

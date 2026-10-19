import type { Address } from "viem";
import { LAUNCH, itemReady } from "./itemConstants"; // SPEC 2: all-slot guard, one address source.

export const TOTAL_SUPPLY = 1_000_000_000;
export const DAY = 86_400;
export const T = 4 * 365 * DAY;
export const CLIFF = 365 * DAY;
export const VESTING_END = 1460 * DAY;
export const ALLOCATIONS = [
  {
    "share": 49,
    "amount": 490000000,
    "who": "BASK/USDG liquidity providers",
    "terms": "Released over four years, with more rewards at the start"
  },
  {
    "share": 21,
    "amount": 210000000,
    "who": "ITEM/ETH liquidity providers",
    "terms": "Same schedule, same rules"
  },
  {
    "share": 10,
    "amount": 100000000,
    "who": "ITEM/ETH launch pool",
    "terms": "Paired with ETH at launch; where ITEM first trades"
  },
  {
    "share": 10,
    "amount": 100000000,
    "who": "The IMD swarm that built and launched the contracts",
    "terms": "Paid to IMD's members under IMD's own rules"
  },
  {
    "share": 5,
    "amount": 50000000,
    "who": "Operations",
    "terms": "Seeding the two pools and the first stakes; held by the owner wallet"
  },
  {
    "share": 4,
    "amount": 40000000,
    "who": "Development, vested",
    "terms": "Nothing for 12 months, 25% at month 12, the rest evenly to month 48; cannot be revoked or sped up"
  },
  {
    "share": 1,
    "amount": 10000000,
    "who": "Development, unlocked",
    "terms": "Sent once at launch"
  }
] as const;
export const PARAGRAPHS = [
  "ITEM's supply is 1,000,000,000, created once at launch. Nothing can mint more. It is a plain token: anyone can hold, send or trade it.",
  "How the supply is divided:",
  "What is available when. At launch, 260,000,000 ITEM (26% of the supply) is available through the launch pool, the swarm's share, operations and the unlocked development amount. The remaining 740,000,000 ITEM is released over four years: 700,000,000 as liquidity rewards and 40,000,000 through development vesting. The chart and table show this schedule with liquidity providers staked in both reward pools from launch throughout the four years.",
  "The line shows the total ITEM available: the 260,000,000 available at launch plus the liquidity rewards and development tokens released by each date. The table shows the breakdown.",
  "Where value flows. ITEM pays the people who make BASK and ITEM tradable: liquidity providers earn ITEM from the gauges. ITEM holders who stake earn the vault's fees, 0.5% of every deposit and 0.5% of every redemption, paid in BASK. Trading fees in the two Uniswap v2 pools stay with the liquidity providers of those pools. Trades in the launch pool carry a 1.25% fee set by IMD: 1% to the protocol's operations wallet and 0.25% to IMD.",
  "What cannot change. The split above, the four-year gauge schedule, the 7-day fee stream and the vesting dates are constants in contracts with no owner. Nobody holds a key that can alter them."
] as const;
export const ALLOCATION_HEADERS = ["Share","ITEM","Who","Terms"] as const;
export const RELEASE_HEADERS = ["End of","Liquidity rewards released","Development unlocked","Total ITEM available"] as const;
export const ADDRESSES: Record<"ITEM" | "ITEM_STAKING" | "BASK_USDG_GAUGE" | "ITEM_ETH_GAUGE" | "DEV_VESTING", Address | null> = {
  ITEM: itemReady(LAUNCH) ? LAUNCH.ITEM : null, ITEM_STAKING: itemReady(LAUNCH) ? LAUNCH.ITEM_STAKING : null, BASK_USDG_GAUGE: itemReady(LAUNCH) ? LAUNCH.BASK_USDG_GAUGE : null, ITEM_ETH_GAUGE: itemReady(LAUNCH) ? LAUNCH.ITEM_ETH_GAUGE : null, DEV_VESTING: itemReady(LAUNCH) ? LAUNCH.DEV_VESTING : null,
};
export type Addresses = typeof ADDRESSES;
export const GAUGE_ALLOCATION = ALLOCATIONS[0].amount + ALLOCATIONS[1].amount;
export const VESTED_ALLOCATION = ALLOCATIONS[5].amount;
export const OUTSIDE_AT_LAUNCH = TOTAL_SUPPLY - GAUGE_ALLOCATION - VESTED_ALLOCATION;
export const formatItem = (n: number) => Math.round(n).toLocaleString("en-US");
export const gaugeReleased = (seconds: number, allocation = GAUGE_ALLOCATION) => {
  const t = Math.max(0, Math.min(seconds, T));
  const fraction = t / T;
  return allocation * fraction * (2 - fraction);
};
export const developmentVested = (seconds: number) => seconds < CLIFF ? 0 : VESTED_ALLOCATION * Math.min(seconds, VESTING_END) / VESTING_END;
export const outsideContracts = (seconds: number) => OUTSIDE_AT_LAUNCH + gaugeReleased(seconds) + developmentVested(seconds);
export const RELEASES = [1, 2, 3, 4].map(year => {
  const seconds = year * 365 * DAY;
  return {year, gauges:gaugeReleased(seconds), vested:developmentVested(seconds), outside:outsideContracts(seconds), share:Math.round(outsideContracts(seconds) / TOTAL_SUPPLY * 1000) / 10};
});
export const ALLOCATION_ROWS = ALLOCATIONS.map(r => [r.share + "%", formatItem(r.amount), r.who, r.terms]);
export const RELEASE_ROWS = RELEASES.map(r => ["Year " + r.year, formatItem(r.gauges), formatItem(r.vested), formatItem(r.outside) + " (" + r.share + "%)"]);
export const SUPPLY_LABEL = ALLOCATIONS.map(r => r.who + " " + r.share + "%").join(", ");
export const RELEASE_LABEL = "Total ITEM available: " + formatItem(OUTSIDE_AT_LAUNCH) + " at launch, " + RELEASES.map(r => formatItem(r.outside) + " at year " + r.year).join(", ") + ". Includes the launch allocation, liquidity rewards and unlocked development tokens, with liquidity providers staked in both reward pools throughout the four years.";

import { AddressLink } from "./components";
import { CONTRACT_KEYS, KNOWN, LAUNCH, itemReady } from "./itemConstants";

export const contractLabels = ["ITEM token", "ITEM staking", "BASK/USDG gauge", "ITEM/ETH gauge", "Development vesting"] as const;
export function LiquidityLink({ item = false }: { item?: boolean }) {
  if (!itemReady(LAUNCH)) return null;
  const href = item
    ? `https://app.uniswap.org/positions/add/new?chain=robinhood&protocolVersion=v2&currencyA=NATIVE&currencyB=${LAUNCH.ITEM}`
    : `https://app.uniswap.org/positions/add/new?chain=robinhood&protocolVersion=v2&currencyA=${KNOWN.BASK}&currencyB=${KNOWN.USDG}`;
  return <a href={href} target="_blank" rel="noreferrer">Add liquidity on Uniswap</a>;
}
export function FindItem() {
  if (!itemReady(LAUNCH)) return null;
  return <section className="panel find-item">
    <h2>Find ITEM</h2>
    {CONTRACT_KEYS.map((key, i) => <p key={key}>{contractLabels[i]}: <AddressLink value={LAUNCH[key]!} /></p>)}
    <p>BASK/USDG pool: <AddressLink value={KNOWN.BASK_USDG_PAIR} /><br /><LiquidityLink /></p>
    <p>ITEM/ETH pool: <AddressLink value={LAUNCH.ITEM_WETH_PAIR} /><br /><LiquidityLink item /></p>
    <p>ITEM first trades in IMD's launch pool. Liquidity for ITEM rewards goes in the ITEM/ETH Uniswap v2 pool above.</p>
    <p><a href="#transparency">Contracts and source on the Transparency page</a></p>
  </section>;
}

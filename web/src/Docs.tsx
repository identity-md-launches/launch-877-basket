import { PageTitle, AddressLink } from './components';
import { VAULT } from './deployment';
export function DocsPage() {
  return <>
    <PageTitle eyebrow="Know your basket" title="Docs">How Basket works, what it costs and what to watch for.</PageTitle>
    <div className="docs-grid">
      <section className="panel"><h2>What Basket is</h2><p>One token, BASK, backed by a basket of Stock Tokens held in a vault on Robinhood Chain. Anyone deposits one listed Stock Token and receives BASK. Redeeming BASK pays a share of every stock in the vault.</p></section>
      <section className="panel"><h2>Deposits</h2><p>Monday to Friday, 15:30 to 19:30 UTC, closed on US market holidays. Deposits need at least three stock prices updated in the last four hours.</p><p>Each stock is priced by its on-chain feed, which can differ from the market by about 0.5% either way.</p></section>
      <section className="panel"><h2>Redemption</h2><p>Always open, never paused. Redeeming BASK pays a share of every stock, retired ones included.</p><p>A stock that cannot be sent at that moment is kept for you as owed. You can claim it later on this site, on the <a href="#redeem">Redeem page</a>.</p></section>
      <section className="panel"><h2>NAV</h2><p>Each stock the vault holds times its feed price, added up. Retired stocks count 0. The vault accounts for accepted deposits and payments; direct donations do not increase NAV.</p></section>
      <section className="panel"><h2>Numbers</h2><p>Fees are fixed: 0.5% on deposit and 0.5% on redemption.</p><p>One daily limit covers all deposits together: the larger of 25% of NAV and $100,000, refilling over 24 hours. The check uses NAV after the deposit.</p><p>The vault size limit starts at $1,000,000. Raising it requires a 7-day proposal, and it can never exceed $10 billion. The vault can list up to 64 stocks.</p></section>
      <section className="panel"><h2>Safety</h2><p>New stocks, new feeds, new price bands, reopening, retiring, a new guardian and a higher size limit wait 7 days. The guardian can cancel these proposals, except its own replacement. Initial stocks are listed during genesis before deposits open.</p><p>A new owner, the fee recipient (set once), a lower size limit and unpausing deposits take effect at once. Ownership changes when the nominated owner accepts.</p><p>The owner or guardian can pause deposits or close a stock at once. A closed stock can be retired by a 7-day proposal: it then counts 0 for new deposits while redemption still pays it out.</p><p>Anyone can flag a shortfall; it can be recognised 7 days later. No one can move the stocks outside the vault’s deposit and redemption rules, mint BASK outside deposits, change a fee or upgrade the vault.</p></section>
      <section className="panel"><h2>Risks</h2><p>Feeds lag the market. The issuer of Stock Tokens can pause, block, burn or change them.</p><p>There is no per-stock limit. One stock may be most of the vault, and its problems reach every holder. Smart contracts can fail. Not for US persons.</p></section>
      <section className="panel"><h2>Find Basket</h2><p>BaskVault on Robinhood Chain:</p><AddressLink value={VAULT} /><p className="docs-social"><a href="https://x.com/Basket_IMD" target="_blank" rel="noreferrer">Basket Protocol on X</a></p></section>
    </div>
  </>;
}

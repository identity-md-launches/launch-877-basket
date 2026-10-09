import { PageTitle, AddressLink } from "./components";
import { VAULT } from "./deployment";
export function DocsPage() {
  return (
    <>
      <PageTitle eyebrow="Know your basket" title="Docs">
        How Basket works, what it costs and what to watch for.
      </PageTitle>
      <div className="docs-grid">
        <section className="panel">
          <h2>What Basket is</h2>
          <p>
            One token, BASK, backed by a basket of Stock Tokens held in a vault
            on Robinhood Chain. Deposit one or more listed Stock Tokens at once
            and receive BASK. Redeeming BASK pays a share of every stock in the
            vault.
          </p>
        </section>
        <section className="panel">
          <h2>Deposits</h2>
          <p>
            deposits open Sunday 8 pm to Friday 8 pm New York time, closed on US
            market holidays, redemptions always open
          </p>
          <p>
            Each stock’s price comes from its on-chain feed. Deposits also need
            at least one listed stock price updated within the last hour, so
            they close when prices stop until one updates.
          </p>
          <p>
            Every stock deposited or held must pass a pool check: a 30-minute
            pool average within 3% of the feed and enough liquidity. With no
            pool, the feed must be under 26 hours old. These are the initial
            settings; the owner can propose changes.
          </p>
        </section>
        <section className="panel">
          <h2>Redemption</h2>
          <p>
            Always open, never paused. Redeeming BASK pays a share of every
            stock, retired ones included.
          </p>
          <p>
            Anything not sent at once is kept as owed to the receiver. Only that
            wallet can claim it on the <a href="#redeem">Redeem page</a>. Choose
            a receiver you control.
          </p>
        </section>
        <section className="panel">
          <h2>FAQ</h2>
          <h3>What if a stock can’t be sent when I redeem?</h3>
          <p>
            Rarely, a stock can’t be sent at that moment (for example its issuer
            has paused transfers). The vault then keeps it for the receiver, who
            collects it later with Claim on the Redeem page. Only the receiver
            wallet can claim, so redeem to a wallet you control, not an exchange
            deposit address.
          </p>
        </section>
        <section className="panel">
          <h2>NAV</h2>
          <p>
            Each unretired stock’s managed quantity times its feed price, added
            up using that token’s and feed’s decimals. Retired stocks count 0.
            The vault accounts for accepted deposits and payments; direct
            donations do not increase NAV until a Resync executes.
          </p>
          <p>
            NAV is indicative unless every held stock has price reason OK. It is
            a feed-based value and may lag the market.
          </p>
        </section>
        <section className="panel">
          <h2>Numbers</h2>
          <p>
            Fees are 0.5% in and 0.5% out, only once the owner sets a fee
            recipient through a proposal. Until then there are no fees. The
            first deposit locks 0.001 BASK forever.
          </p>
          <p>
            The size limit starts at $1,000,000, raisable to $10 billion. The
            initial configuration supports up to 250 stocks. Asset capacity is a
            setting constrained by the contract’s gas limits.
          </p>
        </section>
        <section className="panel">
          <h2>Safety</h2>
          <p>
            Owner changes wait 2 days. Only the owner executes them, within 7
            days after they become ready. The guardian can cancel them, except
            its own replacement. Initial listings happen before genesis is
            finalized.
          </p>
          <p>
            Pause, close and a lower size limit act at once. Only the owner can
            unpause deposits. Ownership transfers in two steps.
          </p>
          <p>
            A retired stock counts 0 for new deposits but is still paid out.
            Retirement is permanent. A retired stock can be removed only with
            zero managed holdings and zero owed.
          </p>
          <p>
            Pause deposits before proposing Resync; unpause after it executes.
            Stock splits, donations and other balance increases can leave NAV
            understated until Resync.
          </p>
          <p>
            Anyone can flag a shortfall; it can be recognised 7 days later. No
            one can move the stocks outside the vault’s deposit and redemption
            rules, mint BASK outside deposits, change the fee rate or upgrade
            the vault.
          </p>
        </section>
        <section className="panel">
          <h2>Risks</h2>
          <p>
            Feeds lag the market. The issuer can pause, block, burn or change
            Stock Tokens. One stock may be most of the vault. Thin pools can be
            pushed to stop deposits. Smart contracts can fail. Not for US
            persons.
          </p>
          <p>
            Redemption minimums follow the current stock order. Removing an
            empty retired stock can change that order before execution. Failed
            transfers remain owed; a permanently blocked stock may never become
            transferable.
          </p>
        </section>
        <section className="panel">
          <h2>Find Basket</h2>
          <p>BaskVault on Robinhood Chain:</p>
          <AddressLink value={VAULT} />
          <p>
            <a href="https://x.com/Basket_IMD" target="_blank" rel="noreferrer">
              Basket Protocol on X
            </a>
          </p>
        </section>
      </div>
    </>
  );
}

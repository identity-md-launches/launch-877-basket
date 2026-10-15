import { useRef, useState, type KeyboardEvent } from "react";
import { Tokenomics } from "./Tokenomics";
import { BaskGuide } from "./BaskGuide";
import { PageTitle, AddressLink } from "./components";
import { VAULT } from "./deployment";
export function DocsPage({
  onAddToWallet,
}: {
  onAddToWallet: () => void;
}) {
  const [tab, setTab] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  function move(event: KeyboardEvent<HTMLButtonElement>) {
    const next = event.key === "Home" ? 0 : event.key === "End" ? 2 : event.key === "ArrowRight" ? (tab + 1) % 3 : event.key === "ArrowLeft" ? (tab + 2) % 3 : undefined;
    if (next === undefined) return;
    event.preventDefault();
    setTab(next);
    buttons.current[next]?.focus();
  }
  return (
    <>
      <PageTitle eyebrow="Know your basket" title="Docs">
        How Basket works, what it costs and what to watch for.
      </PageTitle>
      <div className="docs-tabs" role="tablist" aria-label="Docs">
        {["Docs", "Tokenomics", "BASK"].map((label, index) => (
          <button key={label} ref={node => { buttons.current[index] = node; }} type="button" role="tab" id={"docs-tab-" + index} aria-controls={"docs-panel-" + index} aria-selected={tab === index} tabIndex={tab === index ? 0 : -1} onClick={() => setTab(index)} onKeyDown={move}>{label}</button>
        ))}
      </div>
      <div id="docs-panel-0" role="tabpanel" aria-labelledby="docs-tab-0" hidden={tab !== 0}>
      <div className="docs-grid">
        <section className="panel">
          <h2>What Basket is</h2>
          <p>
            One token, BASK, backed by a basket of Stock Tokens held in a vault
            on Robinhood Chain. Deposit one or more listed Stock Tokens at once
            and receive BASK. Redeeming BASK pays a share of every stock in the
            vault.
          </p>
          <p>
            The basket has no set weights. Any listed stock can be deposited, in any amount, as long as the vault’s checks pass and the vault stays under its size limit. So the mix is whatever holders have put in, and it changes with every deposit and redemption.
          </p>
          <p>
            BASK’s backing moves with every stock in the vault, so its market price can drift from the value behind it. Traders close that gap: they deposit stocks and sell BASK when it trades high, or buy BASK and redeem when it trades low. That keeps BASK near its backing.
          </p>
          <p>
            The 0.5% fee on each deposit and redemption goes to ITEM staking, so more trading through the vault means more fees for ITEM.
          </p>
        </section>
        <section className="panel">
          <h2>Deposits</h2>
          <p>
            Deposits open Sunday 8 pm to Friday 8 pm New York time, closed on US
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
          <h2>ITEM</h2>
          <p>
            ITEM is Basket's reward token. It has two jobs: it pays the people who provide liquidity for BASK and ITEM, and staking it earns the vault's fees. Its supply is fixed at 1,000,000,000 and its reward schedules are written into contracts that have no owner, no pause and no upgrade. Nobody can change the amounts, speed them up or stop them.
          </p>
        </section>
        <section className="panel">
          <h2>Earn ITEM by providing liquidity</h2>
          <p>
            Add liquidity to one of the two Uniswap v2 pools, BASK/USDG or ITEM/ETH, and stake the pool token you receive on the Earn page. From that moment ITEM accrues to you every second, in proportion to your share of everything staked in that pool's gauge.
          </p>
          <p>
            There is no lock and no minimum time. Stake more, withdraw some or all, and claim whenever you like, in any order. Claiming pays everything you have earned so far and resets nothing. Unclaimed ITEM stays yours. Withdrawing moves only your pool token, so it always works, even if a claim could not go through.
          </p>
          <p>
            The schedule is fixed and front loaded. Each gauge releases its allocation over four years, fastest at the start and slowing in a straight line to zero at the end. The clock only runs while at least one person is staked, so an empty gauge releases nothing and loses nothing.
          </p>
          <div className="item-table">
            <table className="item-gauges">
              <thead>
                <tr>
                  <th>Gauge</th>
                  <th>Total ITEM</th>
                  <th>Year 1</th>
                  <th>Year 2</th>
                  <th>Year 3</th>
                  <th>Year 4</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th>BASK/USDG</th>
                  <td>490,000,000</td>
                  <td>43.75%</td>
                  <td>31.25%</td>
                  <td>18.75%</td>
                  <td>6.25%</td>
                </tr>
                <tr>
                  <th>ITEM/ETH</th>
                  <td>210,000,000</td>
                  <td>43.75%</td>
                  <td>31.25%</td>
                  <td>18.75%</td>
                  <td>6.25%</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Rewards are shared among everyone staked at the time. Fewer stakers means a larger share each; more stakers means a smaller one.
          </p>
        </section>
        <section className="panel">
          <h2>Earn BASK by staking ITEM</h2>
          <p>
            The 0.5% fee on each deposit and redemption goes to ITEM staking, so more trading through the vault means more fees for ITEM. Stake ITEM on the Earn page and you receive those fees in BASK, in proportion to your stake. The staking contract can also receive USDG and WETH, so other income can be sent to stakers the same way.
          </p>
          <p>
            Fees are not paid out the moment they arrive. Each batch is streamed to stakers evenly over 7 days, second by second, and you earn only for the time you are staked. This stops anyone from staking just before a large fee lands and leaving with it. While one stream is running, new fees wait and start their own 7-day stream when it ends.
          </p>
          <p>
            Stake and unstake at any time, with no lock or cooldown. Claim is per token: BASK, USDG and WETH are claimed separately, each paying what you have earned so far. Unclaimed amounts stay owed to you. A reward token that cannot be transferred can never block staking or unstaking; it can only delay its own claim. BASK you claim can be redeemed for the Stock Tokens in the vault or sold in the BASK/USDG pool.
          </p>
        </section>
        <section className="panel">
          <h2>Rewards FAQ</h2>
          <h3>Can I claim whenever I want?</h3>
          <p>Yes. Every claim pays what has accrued to that second.</p>
          <h3>Is anything locked?</h3>
          <p>No. Staked pool tokens and staked ITEM can be withdrawn at any time.</p>
          <h3>What if nobody uses the vault?</h3>
          <p>
            Then no fees are collected and ITEM stakers earn nothing for that time. Liquidity rewards keep running as long as someone is staked. Nothing is lost either way.
          </p>
          <h3>Do rewards expire?</h3>
          <p>No. Unclaimed rewards wait for you.</p>
          <h3>Can the team change the rewards?</h3>
          <p>No. The allocations, schedules and the 7-day stream are fixed in the contracts.</p>
        </section>
        <section className="panel">
          <h2>ITEM risks</h2>
          <p>
            Rewards depend on use. Liquidity rewards fall every day by design, and fee rewards are zero when nobody deposits or redeems. Providing liquidity carries the usual pool risk: if the two tokens move apart in price, you can end up with less value than holding them. ITEM's price can fall. The contracts cannot be changed or paused, which also means a defect could not be fixed.
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
          <p>
            <a href="https://t.me/basket_protocol" target="_blank" rel="noreferrer">
              Basket Protocol on Telegram
            </a>
          </p>
          <p>
            Contact: <a href="mailto:protocolbasket@gmail.com">protocolbasket@gmail.com</a>
          </p>
          <p>
            <button onClick={onAddToWallet}>Add BASK to MetaMask</button>
          </p>
          <p>Asks your wallet to list BASK with its logo. No transaction.</p>
        </section>
      </div>
      </div>
      <div id="docs-panel-1" role="tabpanel" aria-labelledby="docs-tab-1" hidden={tab !== 1}>
        {tab === 1 && <Tokenomics />}
      </div>
      <div id="docs-panel-2" role="tabpanel" aria-labelledby="docs-tab-2" hidden={tab !== 2}>
        {tab === 2 && <BaskGuide />}
      </div>
    </>
  );
}

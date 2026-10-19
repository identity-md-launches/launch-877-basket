import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { formatUnits, type Address } from "viem";
import { PageTitle, AddressLink, ActionStatus } from "./components";
import type { Wallet } from "./wallet";
import { KNOWN, LAUNCH, itemReady } from "./itemConstants";
import { itemSend, itemError, type ItemAction } from "./itemActions";
import { itemAmount, itemShare, itemRewardUsd, itemLiquidityQuote, itemRatioAmount, parseItemAmount, freshPriceTime, navUsdPrice, usdPrice } from "./itemFormat";
import { readItemFigures, type useItemFigures, type ItemFigures, type PoolPrices } from "./itemReads";
import { LiquidityLink } from "./FindItem";
import { deadline, navOf, type Snapshot } from "./model";
import { InputError } from "./chain";

type CardProps = { prefix: "bask" | "eth" | "staking"; figures: ItemFigures; wallet: Wallet; refresh: () => Promise<void>; snapshot?: Snapshot };
export function StakeCard({ prefix, figures, wallet, refresh, snapshot }: CardProps) {
  const [deposit, setDeposit] = useState("");
  const [withdraw, setWithdraw] = useState("");
  const [liquidity, setLiquidity] = useState("");
  const [tab, setTab] = useState(0);
  const tabButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const lock = useRef(false);
  const requestVersion = useRef(0);
  // 2026-10-16, Add liquidity build: cancel a pre-wallet read when its card or wallet context ends.
  useLayoutEffect(() => () => { requestVersion.current++; }, [wallet.account, wallet.chainId]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const number = (key: string) => figures[prefix + "." + key] as bigint;
  // 2026-10-17, pre-launch review: a figure the batch could not read is absent; it shows as Unavailable and only the actions that need it are off.
  const has = (...keys: string[]) => keys.every(key => figures[prefix + "." + key] !== undefined);
  const unreadable = "ITEM figures: unreadable. Retry.";
  const gauge = prefix !== "staking";
  const tabs = gauge ? ["Add liquidity", "Stake", "Claim/Withdraw", "Pool stats"] : ["Stake", "Claim/Withdraw", "Staking stats"];
  const stakeTab = gauge ? 1 : 0, manageTab = gauge ? 2 : 1, statsTab = gauge ? 3 : 2;
  function moveTab(event: KeyboardEvent<HTMLButtonElement>) {
    const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : event.key === "ArrowRight" || event.key === "ArrowDown" ? (tab + 1) % tabs.length : event.key === "ArrowLeft" || event.key === "ArrowUp" ? (tab + tabs.length - 1) % tabs.length : undefined;
    if (next === undefined) return;
    event.preventDefault(); setTab(next); tabButtons.current[next]?.focus();
  }
  const title = prefix === "bask" ? "BASK/USDG pool" : prefix === "eth" ? "ITEM/ETH pool" : "ITEM staking";
  const pair = prefix === "bask" ? KNOWN.BASK_USDG_PAIR : LAUNCH.ITEM_WETH_PAIR!;
  const startedKnown = !gauge || has("started");
  const started = !gauge || figures[prefix + ".started"] === true;
  const mismatch = gauge && started && has("pair") && String(figures[prefix + ".pair"]).toLowerCase() !== pair.toLowerCase();
  const balance = number("balance") ?? 0n, staked = number("staked") ?? 0n, allowance = number("allowance") ?? 0n;
  const stakeAmount = parseItemAmount(deposit), withdrawAmount = parseItemAmount(withdraw);
  const common = !wallet.account ? "Connect a wallet to stake." : wallet.chainId !== 4663 ? "Switch to Robinhood Chain to continue." : wallet.busy || pending || wallet.unresolved ? "Another transaction is pending. Finish it in your wallet or wait for its receipt." : mismatch ? "This gauge's pool does not match the pool listed here. Staking is off." : "";
  const stakeReason = common || (!startedKnown || !has("balance", "allowance") || (gauge && !has("pair")) ? unreadable : !started ? "Rewards for this pool have not started yet." : !stakeAmount ? "Enter an amount." : stakeAmount > balance ? "More than your balance." : "");
  const withdrawReason = common || (!has("staked") ? unreadable : !withdrawAmount ? "Enter an amount." : withdrawAmount > staked ? "More than you have staked." : "");
  const actionPrefix = prefix === "staking" ? "item" : prefix;
  const valuation = snapshot ? navOf(snapshot.assets, snapshot.complete) : undefined;
  const usdValue = !gauge && wallet.account ? snapshot?.loading ? "Reading..." : has("BASK") ? itemRewardUsd(number("BASK"), valuation?.nav, snapshot?.globals.totalSupply) : "Unavailable" : "Unavailable";
  const tokenSymbol = prefix === "bask" ? "BASK" : "ITEM", quoteSymbol = prefix === "bask" ? "USDG" : "ETH";
  const liquidityAmount = parseItemAmount(liquidity);
  const seededKnown = gauge && has("reserve0", "reserve1", "poolSupply", "token0");
  const seeded = seededKnown && number("reserve0") > 0n && number("reserve1") > 0n && number("poolSupply") > 0n;
  function quote(data: ItemFigures, amount: bigint) {
    const tokenA = prefix === "bask" ? KNOWN.BASK : LAUNCH.ITEM!;
    const tokenB = prefix === "bask" ? KNOWN.USDG : KNOWN.WETH;
    const token0 = String(data[prefix + ".token0"]).toLowerCase();
    if (token0 !== tokenA.toLowerCase() && token0 !== tokenB.toLowerCase()) throw new InputError("ITEM figures: unreadable. Retry.");
    const first = token0 === tokenA.toLowerCase();
    return itemLiquidityQuote(amount, data[prefix + (first ? ".reserve0" : ".reserve1")] as bigint, data[prefix + (first ? ".reserve1" : ".reserve0")] as bigint, data[prefix + ".poolSupply"] as bigint);
  }
  let liquidityQuote: ReturnType<typeof itemLiquidityQuote> | undefined;
  let quoteReason = "";
  if (gauge && seeded && liquidityAmount) {
    try { liquidityQuote = quote(figures, liquidityAmount); } catch (e) { quoteReason = itemError(e); }
  }
  const liquidityReason = !wallet.account ? "Connect a wallet to add liquidity." : common || (!seededKnown || !has("tokenBalance", "quoteBalance", "tokenAllowance") || (prefix === "bask" && !has("quoteAllowance")) ? unreadable : !seeded ? "Pool not seeded yet." : !liquidityAmount ? "Enter an amount." : quoteReason || (liquidityAmount > number("tokenBalance") || (liquidityQuote?.matched ?? 0n) > number("quoteBalance") ? "More than your balance." : ""));
  const tokenApproval = !!liquidityAmount && number("tokenAllowance") < liquidityAmount;
  const quoteApproval = prefix === "bask" && !!liquidityQuote && number("quoteAllowance") < liquidityQuote.matched;
  async function act(action: ItemAction, amount?: bigint) {
    if (lock.current) return;
    lock.current = true; setPending(true); setError("");
    try { await wallet.send(itemSend(action, amount), prefix, action.includes("Approve") ? "Approve" : action.includes("Unstake") ? "Unstake" : action.includes("Withdraw") ? "Withdraw" : action.includes("Stake") ? "Stake" : action === "claimBask" ? "Claim BASK" : "Claim ITEM", refresh); }
    catch (e) { setError(itemError(e)); }
    finally { lock.current = false; setPending(false); }
  }
  async function addLiquidity(kind: "token" | "quote" | "add") {
    if (lock.current) return;
    const version = requestVersion.current;
    lock.current = true; setPending(true); setError("");
    try {
      const account = wallet.account;
      if (!account) throw new InputError("Connect a wallet to add liquidity.");
      const amount = parseItemAmount(liquidity);
      if (!amount) throw new InputError("Enter an amount.");
      // 2026-10-16, Add liquidity build: every press quotes from one fresh Earn batch.
      const fresh = await readItemFigures("earn", account);
      if (version !== requestVersion.current) return;
      if (!fresh) throw new InputError("ITEM figures: unreadable. Retry.");
      // 2026-10-17, pre-launch review: every figure the add needs must have been read fresh.
      if (!["started", "pair", "token0", "reserve0", "reserve1", "poolSupply", "tokenBalance", "quoteBalance", "tokenAllowance", ...(prefix === "bask" ? ["quoteAllowance"] : [])].every(key => fresh[prefix + "." + key] !== undefined)) throw new InputError("ITEM figures: unreadable. Retry.");
      if (fresh[prefix + ".started"] && String(fresh[prefix + ".pair"]).toLowerCase() !== pair.toLowerCase()) throw new InputError("This gauge's pool does not match the pool listed here. Staking is off.");
      const amounts = quote(fresh, amount);
      if (amount > (fresh[prefix + ".tokenBalance"] as bigint) || amounts.matched > (fresh[prefix + ".quoteBalance"] as bigint)) throw new InputError("More than your balance.");
      // 2026-10-17, audit review: the matched amount the page showed is the quote the user accepted; a fresh read that differs refreshes the figures and sends nothing.
      if (kind === "add" && amounts.matched !== liquidityQuote?.matched) { await refresh(); throw new InputError("The request failed. Please retry."); }
      const action: ItemAction = kind === "token" ? prefix === "bask" ? "baskLiquidityApprove" : "itemLiquidityApprove" : kind === "quote" ? "usdgLiquidityApprove" : prefix === "bask" ? "baskAddLiquidity" : "ethAddLiquidity";
      // 2026-10-16, Claude check: when the pool moved after an exact approval, refresh so the Approve button shows again.
      if (kind === "add" && ((fresh[prefix + ".tokenAllowance"] as bigint) < amount || (prefix === "bask" && (fresh[prefix + ".quoteAllowance"] as bigint) < amounts.matched))) { await refresh(); throw new InputError("The request failed. Please retry."); }
      const spec = itemSend(action, kind === "quote" ? amounts.matched : amount, LAUNCH, kind === "add" ? { user: account, matched: amounts.matched, minimumA: amounts.minimumA, minimumB: amounts.minimumB, deadline: deadline() } : undefined);
      await wallet.send(spec, prefix, kind === "add" ? "Add liquidity" : "Approve " + (kind === "token" ? tokenSymbol : quoteSymbol), refresh);
    } catch (e) { setError(itemError(e)); }
    finally { lock.current = false; setPending(false); }
  }
  const figure = (label: string, key: string, unit: string, pool = false, decimals = 18) => <div><dt>{label}</dt><dd data-figure={prefix + "." + key}>{has(key) ? itemAmount(number(key), decimals, pool) + " " + unit : "Unavailable"}</dd></div>;
  return <section className="panel earn-card refined-card refined-b3" data-item-card={prefix}>
    <div className="refined-heading"><h3>{title}</h3></div>
    {startedKnown && !started && <p className="note">Rewards for this pool have not started yet.</p>}
    {mismatch && <p className="note warning">This gauge's pool does not match the pool listed here. Staking is off.</p>}
    {wallet.account ? <dl className="item-figures refined-personal">{figure("You have staked", "staked", gauge ? "pool tokens" : "ITEM", gauge)}{gauge ? figure("Your ITEM earned", "earned", "ITEM") : figure("Your BASK earned", "BASK", "BASK")}</dl> : <p className="refined-empty">Connect a wallet to view your position.</p>}
    <div className="refined-workspace">
    <div className="docs-tabs refined-tabs" role="tablist" aria-label={title}>
      {tabs.map((label, index) => <button key={label} ref={node => { tabButtons.current[index] = node; }} type="button" role="tab" id={prefix + "-tab-" + index} aria-controls={prefix + "-panel-" + index} aria-selected={tab === index} tabIndex={tab === index ? 0 : -1} onClick={() => setTab(index)} onKeyDown={moveTab}>{label === "Claim/Withdraw" ? <>Claim/<wbr />Withdraw</> : label}</button>)}
    </div>
    <div className="refined-panels">
    {gauge && <div className="refined-tab-panel" id={prefix + "-panel-0"} role="tabpanel" aria-labelledby={prefix + "-tab-0"} hidden={tab !== 0}>
      <div className="item-action" data-liquidity={prefix}>
        <p className="refined-explainer"><strong>This pool takes both {tokenSymbol} and {quoteSymbol}.</strong> Enter how much {tokenSymbol} you want to add. The required {quoteSymbol} amount is calculated automatically using the pool's current ratio. You must have enough of both tokens to continue.</p>
        <div className="refined-token-pair">
          <div className="refined-token-entry"><label htmlFor={prefix + "-add"}>{tokenSymbol} to add</label><input id={prefix + "-add"} inputMode="decimal" value={liquidity} onChange={e => setLiquidity(e.target.value)} disabled={!!common || !seeded} />
            {wallet.account && <dl className="item-figures refined-balance"><div><dt>{tokenSymbol} in your wallet</dt><dd data-figure={prefix + ".tokenBalance"}>{has("tokenBalance") ? itemAmount(number("tokenBalance")) + " " + tokenSymbol : "Unavailable"}</dd></div></dl>}
            <button type="button" className="refined-max" onClick={() => setLiquidity(formatUnits(number("tokenBalance") ?? 0n, 18))} disabled={!!common || !seeded || !has("tokenBalance")}>Use full balance</button>
          </div>
          <div className="refined-token-entry"><dl className="item-figures refined-matched"><div><dt>{quoteSymbol} required <span>Calculated</span></dt><dd data-figure={prefix + ".matched"}>{itemAmount(liquidityQuote?.matched ?? 0n, prefix === "bask" ? 6 : 18)} {quoteSymbol}</dd></div></dl>
            {wallet.account && <dl className="item-figures refined-balance"><div><dt>{quoteSymbol} in your wallet</dt><dd data-figure={prefix + ".quoteBalance"}>{has("quoteBalance") ? itemAmount(number("quoteBalance"), prefix === "bask" ? 6 : 18) + " " + quoteSymbol : "Unavailable"}</dd></div></dl>}
          </div>
        </div>
        <dl className="item-figures refined-estimate"><div><dt>You receive about</dt><dd data-figure={prefix + ".liquidityEstimate"}>{itemAmount(liquidityQuote?.poolTokens ?? 0n, 18, true)} pool tokens</dd></div></dl>
        <div className="item-buttons">{tokenApproval && <button type="button" disabled={!!liquidityReason} onClick={() => void addLiquidity("token")}>Approve {tokenSymbol}</button>}{quoteApproval && <button type="button" disabled={!!liquidityReason} onClick={() => void addLiquidity("quote")}>Approve USDG</button>}<button type="button" className="primary" disabled={!!liquidityReason || tokenApproval || quoteApproval} onClick={() => void addLiquidity("add")}>Add liquidity</button></div>{liquidityReason && <p className="disabled-reason">{liquidityReason}</p>}
        <details className="refined-details"><summary>Details</summary><p>Minimums 0.5% under these amounts; the add fails instead of filling at a worse ratio.</p><div className="item-pool"><LiquidityLink item={prefix === "eth"} /></div></details>
      </div>
    </div>}
    <div className="refined-tab-panel" id={prefix + "-panel-" + stakeTab} role="tabpanel" aria-labelledby={prefix + "-tab-" + stakeTab} hidden={tab !== stakeTab}>
      <p className="refined-explainer">{gauge ? "Stake your pool tokens to earn ITEM." : "Stake ITEM to earn BASK."}</p>
      {wallet.account && <dl className="item-figures refined-available">{figure(gauge ? "Pool tokens in your wallet" : "ITEM in your wallet", "balance", gauge ? "pool tokens" : "ITEM", gauge)}</dl>}
      <div className="item-action"><label htmlFor={prefix + "-stake"}>{gauge ? "Pool tokens to stake" : "ITEM to stake"}</label><input id={prefix + "-stake"} inputMode="decimal" value={deposit} onChange={e => setDeposit(e.target.value)} disabled={!!common || !started} /><button type="button" onClick={() => setDeposit(formatUnits(balance, 18))} disabled={!!common || !started || !has("balance")}>Use full balance</button><div className="item-buttons">{(!stakeAmount || allowance < stakeAmount) && <button type="button" disabled={!!stakeReason} onClick={() => void act((actionPrefix + "Approve") as ItemAction, stakeAmount)}>Approve</button>}<button type="button" className="primary" disabled={!!stakeReason || allowance < (stakeAmount ?? 0n)} onClick={() => void act((actionPrefix + "Stake") as ItemAction, stakeAmount)}>Stake</button></div>{stakeReason && <p className="disabled-reason">{stakeReason}</p>}</div>
    </div>
    <div className="refined-tab-panel" id={prefix + "-panel-" + manageTab} role="tabpanel" aria-labelledby={prefix + "-tab-" + manageTab} hidden={tab !== manageTab}>
      <div className="refined-rewards"><h4>Your rewards</h4>
      {wallet.account && <dl className="item-figures refined-manage-figures"><div><dt>Your share</dt><dd data-figure={prefix + ".share"}>{has("staked", "totalStaked") ? itemShare(staked, number("totalStaked")) : "Unavailable"}</dd></div>{gauge ? <div><dt>Your ITEM per day</dt><dd data-figure={prefix + ".daily"}>{has("rate", "staked", "totalStaked") ? itemRatioAmount(number("rate") * 86400n * staked, number("totalStaked")) + " ITEM a day" : "Unavailable"}</dd></div> : <><div><dt>Your estimated BASK</dt><dd data-figure="staking.estimatedBASK">{has("pot", "staked", "totalStaked", "BASK") ? itemRatioAmount(number("pot") * staked, number("totalStaked")) + " BASK (of which " + itemAmount(number("BASK")) + " already earned)" : "Unavailable"}</dd></div><div><dt>Estimated value in USD</dt><dd data-figure="staking.USDValue">{usdValue}{valuation?.indicative && usdValue !== "Unavailable" && usdValue !== "Reading..." ? " (indicative)" : ""}</dd></div></>}</dl>}
      {!gauge && wallet.account && <p className="refined-caption">Unclaimed rewards, paid in BASK. The USD estimate uses the vault's last read, not a sale price.</p>}
      <div className="item-claims">{(gauge ? [["Claim ITEM", actionPrefix + "Claim", "earned"]] : [["Claim BASK", "claimBask", "BASK"]]).map(([label, action, key]) => <div key={action}><button type="button" disabled={!!common || !has(key) || !number(key)} onClick={() => void act(action as ItemAction)}>{label}</button>{!common && (!has(key) ? <p className="disabled-reason">{unreadable}</p> : !number(key) && <p className="disabled-reason">Nothing to claim yet.</p>)}</div>)}</div>
      </div>
      <details className="refined-withdraw"><summary>{gauge ? "Withdraw pool tokens" : "Unstake ITEM"}</summary><p className="refined-caption">{gauge ? "Withdraw returns your pool tokens. Claim ITEM separately." : "Unstake returns your ITEM. Claim BASK separately."}</p><div className="item-action"><label htmlFor={prefix + "-withdraw"}>{gauge ? "Pool tokens to withdraw" : "ITEM to unstake"}</label><input id={prefix + "-withdraw"} inputMode="decimal" value={withdraw} onChange={e => setWithdraw(e.target.value)} disabled={!!common} /><button type="button" onClick={() => setWithdraw(formatUnits(staked, 18))} disabled={!!common || !has("staked")}>Use full staked amount</button><div className="item-buttons"><button type="button" disabled={!!withdrawReason} onClick={() => void act((actionPrefix + (gauge ? "Withdraw" : "Unstake")) as ItemAction, withdrawAmount)}>{gauge ? "Withdraw" : "Unstake"}</button></div>{withdrawReason && <p className="disabled-reason">{withdrawReason}</p>}</div></details>
    </div>
    <div className="refined-tab-panel" id={prefix + "-panel-" + statsTab} role="tabpanel" aria-labelledby={prefix + "-tab-" + statsTab} hidden={tab !== statsTab}>
      <h4>{gauge ? "Global release" : "Staking overview"}</h4>
      <dl className="item-figures refined-global">
        {gauge && <>{figure("Released so far", "released", "ITEM")}{figure("Left to release", "remaining", "ITEM")}<div><dt>Released per day now</dt><dd data-figure={prefix + ".rate"}>{has("rate") ? itemAmount(number("rate") * 86400n) + " ITEM a day" : "Unavailable"}</dd></div><div><dt>ITEM per day per pool token</dt><dd data-figure={prefix + ".dailyPerToken"}>{has("rate", "totalStaked") ? itemRatioAmount(number("rate") * 86400n * 10n ** 18n, number("totalStaked")) + " ITEM a day" : "Unavailable"}</dd></div></>}
        {figure("Staked by everyone", "totalStaked", gauge ? "pool tokens" : "ITEM", gauge)}
        {!gauge && figure("BASK in the fee pot", "pot", "BASK")}
      </dl>
      <p className="refined-caption">{gauge ? "The daily rate falls over the four years by design and is shared by everyone staked." : "Fees stream to stakers over 7 days; your share is applied to what is in the pot today."}</p>
      {gauge && <div className="item-pool refined-address"><p>Pool <AddressLink value={pair as Address} /></p></div>}
    </div>
    </div></div>
    <ActionStatus wallet={wallet} scope={prefix} /><p className="error" role="alert">{error}</p>
  </section>;
}
export function EarnPage({ wallet, snapshot, data }: { wallet: Wallet; snapshot: Snapshot; data: ReturnType<typeof useItemFigures> }) {
  const [selectedPool, setSelectedPool] = useState<"bask" | "eth">("bask");
  // 2026-10-17, pre-launch review: a transaction saved before a reload is settled (mined, replaced or passed) when the page opens.
  useLayoutEffect(() => { void wallet.itemPending(); }, [wallet.account]);
  return <>
    <PageTitle eyebrow="Rewards counter" title="Earn" character={{ kind: "earn", src: "art/character/earn.webp", width: 453, height: 1000, alt: "Store worker waving goodbye with a big smile", line: "same time tomorrow?" }}>Stake pool tokens to earn ITEM. Stake ITEM to earn the vault's fees in BASK.</PageTitle>
    {itemReady() && <div className="item-refresh"><button type="button" disabled={data.loading || wallet.busy} onClick={() => { void wallet.itemPending(); void data.refresh(); snapshot.retry?.(); }}>{data.failed ? "Retry" : "Refresh"}</button>{data.loading && <p role="status">Reading...</p>}{data.failed && <p role="alert">ITEM figures: unreadable. Retry.</p>}</div>}
    <section className="item-section refined-focused-section"><h2>Earn ITEM by providing liquidity</h2><p>Add liquidity to a pool, then stake the pool tokens you receive. There is no lock: withdraw and claim whenever you like.</p>{data.figures && <>
      <fieldset className="refined-pool-picker pool-buttons"><legend className="price-sr-only">Pool</legend>{([["bask", "BASK/USDG"], ["eth", "ITEM/ETH"]] as const).map(([value, label]) => <label key={value}><input type="radio" name="earn-pool" value={value} checked={selectedPool === value} onChange={() => setSelectedPool(value)} /><span>{label}</span></label>)}</fieldset>
      <div className="earn-gauges refined-gauges refined-focused-gauges"><div data-pool-view="bask" hidden={selectedPool !== "bask"}><StakeCard key={"bask-" + wallet.account} prefix="bask" figures={data.figures} wallet={wallet} refresh={data.refresh} /></div><div data-pool-view="eth" hidden={selectedPool !== "eth"}><StakeCard key={"eth-" + wallet.account} prefix="eth" figures={data.figures} wallet={wallet} refresh={data.refresh} /></div></div>
    </>}</section>
    <section className="item-section"><h2>Earn BASK by staking ITEM</h2><p>Fees reach stakers as a 7-day stream, second by second.</p>{data.figures && <StakeCard key={"staking-" + wallet.account} prefix="staking" figures={data.figures} wallet={wallet} refresh={data.refresh} snapshot={snapshot} />}</section>
    <p className="item-links"><a href="#docs">How rewards work</a><a href="#transparency">Contracts and source</a></p>
  </>;
}

// v24: the approved drawings are inline, without image requests.
export function PriceStrip({ prices, snapshot }: { prices: PoolPrices | null; snapshot?: Snapshot }) {
  const bask = freshPriceTime(prices?.baskUpdatedAt) ? prices?.bask : undefined;
  const item = freshPriceTime(prices?.itemUpdatedAt) ? prices?.item : undefined;
  return <div className="token-prices">
    <div className="token-price-values">
      <span className="token-price"><svg role="img" aria-label="BASK" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024"><rect width="1024" height="1024" fill="#df2029"/><g transform="translate(176 218) scale(8.4)" fill="none" stroke="#ffdb29" strokeWidth="7" strokeLinejoin="round" strokeLinecap="round"><path d="M9 28h62L63 62H17L9 28Z"/><path d="M23 28 35 8M57 28 45 8M28 39v12M40 39v12M52 39v12M6 28h68"/></g></svg><b>BASK</b><span>Pool <strong data-price="bask-pool">{usdPrice(bask, 2)}</strong> · NAV <strong data-price="bask-nav">{usdPrice(prices ? navUsdPrice(snapshot) : undefined, 2)}</strong></span></span>
      <span className="token-price"><svg role="img" aria-label="ITEM" xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><g transform="matrix(.65 0 0 .65 93.4 79.75)"><path fill="#ffdb29" fillRule="evenodd" d="M682 187C714 152 755 137 803 143L1083 180C1129 186 1152 221 1158 259L1197 550C1202 590 1189 616 1162 641L547 1155C515 1182 481 1195 447 1190C421 1186 394 1175 374 1156L119 907C81 869 80 815 103 769C109 756 120 742 133 729ZM1022 392A69 69 0 1 0 884 392A69 69 0 1 0 1022 392Z"/><path fill="#df2029" fillRule="evenodd" d="M722 224C743 207 764 198 793 203L1082 241C1097 243 1097 249 1099 261L1137 547C1142 572 1130 588 1110 605L511 1117C481 1141 450 1143 421 1124L167 875C141 849 140 815 162 786ZM1067 392A114 114 0 1 0 839 392A114 114 0 1 0 1067 392Z"/><circle cx="534" cy="602" r="59" fill="#ffdb29"/><circle cx="786" cy="666" r="59" fill="#ffdb29"/><path d="M453 719C486 831 643 870 743 790" fill="none" stroke="#ffdb29" strokeWidth="70" strokeLinecap="round"/></g></svg><b>ITEM</b><strong data-price="item-pool">{usdPrice(item, 6)}</strong></span>
    </div>
    <p>Pool prices and BASK stock value, read at the last refresh.</p>
  </div>;
}

import { useEffect, useRef, useState } from "react";
import type { Address } from "viem";
import { read, safe, many, vault, token, explain, VAULT } from "./chain";
import {
  amount,
  address,
  depositArgs,
  redeemArgs,
  fmt,
  exact,
  usd,
  same,
  type Snapshot,
} from "./model";
import { PageTitle, Note, Empty, TxButton, Addr } from "./components";
import { DepositState } from "./Vault";
import type { Wallet } from "./wallet";
type Props = { snapshot: Snapshot; wallet: Wallet };
export function DepositPage({ snapshot: s, wallet: w }: Props) {
  const open = s.assets.filter((a) => a.open && !a.retired);
  const [selected, setSelected] = useState("");
  const [input, setInput] = useState("");
  const [quote, setQuote] = useState<any>();
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [balance, setBalance] = useState<bigint>();
  const [allowance, setAllowance] = useState<bigint>();
  const stock = open.find((a) => a.token === selected) ?? open[0];
  const id = useRef(0);
  useEffect(() => {
    id.current++;
    setQuote(undefined);
    setError("");
    setWorking(false);
  }, [stock?.token, input, w.account]);
  useEffect(() => {
    let active = true;
    setBalance(undefined);
    setAllowance(undefined);
    if (stock && w.account)
      many([
        token(stock.token, "balanceOf", [w.account]),
        token(stock.token, "allowance", [w.account, VAULT]),
      ]).then((r) => {
        if (active) {
          setBalance(r[0].ok ? r[0].value : undefined);
          setAllowance(r[1].ok ? r[1].value : undefined);
        }
      });
    return () => {
      active = false;
    };
  }, [stock?.token, w.account, s.loadedAt]);
  const needsApproval =
    quote && (allowance === undefined || allowance < quote.amount);
  return (
    <>
      <PageTitle eyebrow="Add to the basket" title="Deposit Stock Tokens">
        Choose an open stock and preview how much Basket (BASK) you’ll receive.
      </PageTitle>
      <div className="flow-layout">
        <section className="panel">
          <h2>Make a deposit</h2>
          {!stock ? (
            <Empty
              title={
                s.complete ? "No open stocks yet" : "Open stocks are unreadable"
              }
            >
              Deposits become available after the owner lists stocks and
              completes the opening delay. Refresh to check again.
            </Empty>
          ) : (
            <>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const seq = ++id.current;
                  setError("");
                  setQuote(undefined);
                  setWorking(true);
                  try {
                    const n = amount(input);
                    const q = await read(
                      vault("previewDeposit", [stock.token, n]),
                    );
                    if (seq === id.current)
                      setQuote({ ...q, amount: n, token: stock.token });
                  } catch (e) {
                    if (seq === id.current)
                      setError(
                        explain(
                          e,
                          (a) =>
                            s.assets.find((x) => same(x.token, a))?.symbol ?? a,
                          true,
                        ),
                      );
                  } finally {
                    if (seq === id.current) setWorking(false);
                  }
                }}
              >
                <label>
                  Stock Token
                  <select
                    value={stock.token}
                    onChange={(e) => setSelected(e.target.value)}
                  >
                    {open.map((a) => (
                      <option key={a.token} value={a.token}>
                        {a.symbol}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Amount
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="0.00"
                    inputMode="decimal"
                    required
                    aria-describedby="deposit-error"
                    aria-invalid={!!error}
                  />
                </label>
                {w.account && (
                  <p className="muted">
                    Wallet balance: {fmt(balance)} <bdi>{stock.symbol}</bdi>
                  </p>
                )}
                <div className="note">
                  <DepositState asset={stock} snapshot={s} />
                </div>
                <button disabled={working} type="submit">
                  {working ? "Reading preview…" : "Preview deposit"}
                </button>
                <p id="deposit-error" role="alert" className="error">
                  {error}
                </p>
              </form>
              {quote && (
                <div className="receipt" role="status">
                  <h3>Deposit preview</h3>
                  <dl>
                    <div>
                      <dt>Stock value</dt>
                      <dd>{usd(quote.value)}</dd>
                    </div>
                    <div>
                      <dt>Gross shares</dt>
                      <dd>{fmt(quote.gross)} BASK</dd>
                    </div>
                    <div>
                      <dt>Fee · 0.5%</dt>
                      <dd>{fmt(quote.fee)} BASK</dd>
                    </div>
                    {quote.lockedShares > 0n && (
                      <div>
                        <dt>First-deposit locked shares</dt>
                        <dd>{fmt(quote.lockedShares)} BASK</dd>
                      </div>
                    )}
                    <div className="total">
                      <dt>You receive</dt>
                      <dd title={exact(quote.receiverShares)}>
                        {fmt(quote.receiverShares)} BASK
                      </dd>
                    </div>
                    <div>
                      <dt>Minimum received</dt>
                      <dd title={exact((quote.receiverShares * 995n) / 1000n)}>
                        {fmt((quote.receiverShares * 995n) / 1000n)} BASK
                      </dd>
                    </div>
                  </dl>
                  <p className="muted">
                    Minimum is 0.5% under this preview. Deadline: 10 minutes
                    from sending.
                  </p>
                  <div className="button-row">
                    <TxButton
                      label="1. Approve stock"
                      primary={!!needsApproval}
                      wallet={w}
                      snapshot={s}
                      disabled={!needsApproval}
                      getSpec={() =>
                        token(quote.token, "approve", [VAULT, quote.amount])
                      }
                    />
                    <TxButton
                      label="2. Deposit"
                      primary={!needsApproval}
                      wallet={w}
                      snapshot={s}
                      disabled={!!needsApproval}
                      getSpec={() =>
                        vault(
                          "deposit",
                          depositArgs(
                            quote.token,
                            quote.amount,
                            w.account!,
                            quote.receiverShares,
                          ),
                        )
                      }
                    />
                  </div>
                  {!w.account && (
                    <p>Connect a wallet to approve and deposit.</p>
                  )}
                </div>
              )}
              <Note warning>
                Deposits are credited at the on-chain feed price, which can
                differ from the market by about 0.5% either way.
              </Note>
            </>
          )}
        </section>
        <aside className="panel aside">
          <p className="eyebrow">Deposit hours</p>
          <h2>A window for fresh prices.</h2>
          <p>
            Monday to Friday, 15:30 to 19:30 UTC, closed on US market holidays.
          </p>
          <p>
            The preview checks current availability and amount limits. Prices
            and availability can change before a transaction confirms.
          </p>
          <dl>
            <div>
              <dt>Deposit fee</dt>
              <dd>0.5%</dd>
            </div>
            <div>
              <dt>Minimum tolerance</dt>
              <dd>0.5%</dd>
            </div>
            <div>
              <dt>Transaction deadline</dt>
              <dd>10 minutes</dd>
            </div>
          </dl>
        </aside>
      </div>
    </>
  );
}
export function RedeemPage({ snapshot: s, wallet: w }: Props) {
  const [input, setInput] = useState("");
  const [quote, setQuote] = useState<{
    fee: bigint;
    net: bigint;
    amounts: bigint[];
    shares: bigint;
  }>();
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [balance, setBalance] = useState<bigint>();
  const id = useRef(0);
  useEffect(() => {
    id.current++;
    setQuote(undefined);
    setError("");
    setWorking(false);
  }, [input, s.loadedAt, w.account]);
  useEffect(() => {
    let active = true;
    setBalance(undefined);
    if (w.account)
      safe(vault("balanceOf", [w.account])).then((r) => {
        if (active) setBalance(r.ok ? r.value : undefined);
      });
    return () => {
      active = false;
    };
  }, [w.account, s.loadedAt]);
  return (
    <>
      <PageTitle eyebrow="Take your share" title="Redeem BASK">
        Redemption is always open and pays a share of every stock, including
        retired stocks.
      </PageTitle>
      <div className="flow-layout">
        <section className="panel">
          <h2>Redeem Basket</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const seq = ++id.current;
              setError("");
              setQuote(undefined);
              setWorking(true);
              try {
                const n = amount(input);
                const [fee, net, amounts] = await read(
                  vault("previewRedeem", [n]),
                );
                if (seq === id.current)
                  setQuote({ fee, net, amounts, shares: n });
              } catch (e) {
                if (seq === id.current) setError(explain(e, undefined, true));
              } finally {
                if (seq === id.current) setWorking(false);
              }
            }}
          >
            <label>
              BASK amount
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                required
                aria-invalid={!!error}
                aria-describedby="redeem-error"
              />
            </label>
            {w.account && (
              <p className="muted">Wallet balance: {fmt(balance)} BASK</p>
            )}
            <button type="submit" disabled={working}>
              {working ? "Reading preview…" : "Preview redemption"}
            </button>
            <p role="alert" className="error" id="redeem-error">
              {error}
            </p>
          </form>
          {quote && (
            <div className="receipt" role="status">
              <h3>Redemption preview</h3>
              <dl>
                <div>
                  <dt>Fee · 0.5%</dt>
                  <dd>{fmt(quote.fee)} BASK</dd>
                </div>
                <div>
                  <dt>Net shares redeemed</dt>
                  <dd>{fmt(quote.net)} BASK</dd>
                </div>
              </dl>
              <h3>Stock Tokens you receive</h3>
              {quote.amounts.length === 0 ? (
                <p>No stock amounts in this preview.</p>
              ) : (
                <dl>
                  {quote.amounts.map((n, i) => {
                    const a = s.assets.find((a) => a.index === i);
                    return (
                      <div key={i}>
                        <dt>
                          {a ? (
                            <>
                              <bdi>{a.symbol}</bdi>
                              {a.retired ? " · retired" : ""}
                            </>
                          ) : (
                            `Stock ${i + 1} · unreadable`
                          )}
                        </dt>
                        <dd title={exact(n)}>
                          {fmt(n)}
                          <small>Minimum: {fmt((n * 999n) / 1000n)}</small>
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              )}
              <p className="muted">
                Each minimum is 0.1% under its preview. Deadline: 10 minutes
                from sending.
              </p>
              <TxButton
                label="Redeem BASK"
                primary
                wallet={w}
                snapshot={s}
                getSpec={() =>
                  vault("redeem", redeemArgs(quote.shares, quote.amounts))
                }
              />
              {!w.account && <p>Connect a wallet to redeem.</p>}
            </div>
          )}
        </section>
        <aside className="panel aside">
          <p className="eyebrow">Every stock, every time</p>
          <h2>The whole basket.</h2>
          <p>
            Closed and retired stocks are included. Deposit pauses and market
            hours do not stop redemption.
          </p>
          <p>
            A failed stock payment becomes a claim. A claim fails while the
            issuer pauses the stock; it can be retried later.
          </p>
          <p>
            If a stock refuses your wallet, enter another nonzero receiving
            address when claiming.
          </p>
        </aside>
      </div>
      {!w.account && (
        <Note>
          Connect a wallet to see any outstanding stock claims, even if you have
          not redeemed in this session.
        </Note>
      )}
    </>
  );
}
export function Claims({ snapshot: s, wallet: w }: Props) {
  const [debts, setDebts] = useState<{ token: Address; value?: bigint }[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setDebts([]);
    setLoading(true);
    if (w.account)
      many(s.assets.map((a) => vault("owed", [w.account, a.token]))).then(
        (r) => {
          if (active) {
            setDebts(
              r.map((v, i) => ({
                token: s.assets[i].token,
                value: v.ok ? v.value : undefined,
              })),
            );
            setLoading(false);
          }
        },
      );
    else setLoading(false);
    return () => {
      active = false;
    };
  }, [w.account, s.loadedAt]);
  if (!w.account) return null;
  const positive = debts.filter((d) => d.value !== undefined && d.value > 0n),
    failed = debts.filter((d) => d.value === undefined);
  return (
    <section className="panel claims">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Outstanding payments</p>
          <h2>Stock claims</h2>
        </div>
        <span className="badge">{positive.length} to claim</span>
      </div>
      <p className="muted">
        For <Addr value={w.account} />
      </p>
      {loading ? (
        <p role="status">Reading claims…</p>
      ) : (
        <>
          {!positive.length && <p>No readable stock claims above zero.</p>}
          {positive.map((d) => (
            <ClaimRow
              key={d.token}
              debt={d as { token: Address; value: bigint }}
              snapshot={s}
              wallet={w}
            />
          ))}
          {failed.map((d) => (
            <p className="error" key={d.token}>
              {s.assets.find((a) => a.token === d.token)?.symbol}: claim
              unreadable
            </p>
          ))}
          {!s.complete && (
            <p className="error">
              The stock list is incomplete; additional claims may be unreadable.
              Refresh to retry.
            </p>
          )}
        </>
      )}
      <p className="muted">
        Claims include retired stocks. A claim fails while the issuer pauses the
        stock; it can be retried later. Use another receiving address if a stock
        refuses your wallet.
      </p>
    </section>
  );
}
function ClaimRow({
  debt,
  snapshot: s,
  wallet: w,
}: Props & { debt: { token: Address; value: bigint } }) {
  const [to, setTo] = useState("");
  const a = s.assets.find((a) => a.token === debt.token)!;
  return (
    <div className="claim-row">
      <div>
        <h3>
          <bdi>{a.symbol}</bdi>
          {a.retired ? " · retired" : ""}
        </h3>
        <p title={exact(debt.value)}>{fmt(debt.value)} owed</p>
      </div>
      <label>
        Receiving address (optional)
        <input
          placeholder={w.account}
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
        <small>Leave blank to use the connected wallet.</small>
      </label>
      <TxButton
        label={`Claim ${a.symbol}`}
        wallet={w}
        snapshot={s}
        getSpec={() =>
          vault("claim", [debt.token, address(to.trim() || w.account!)])
        }
      />
    </div>
  );
}

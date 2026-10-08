import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Address } from "viem";
import {
  read,
  many,
  vault,
  token,
  explain,
  simulate,
  InputError,
  VAULT,
} from "./chain";
import {
  amount,
  recipient,
  depositArgs,
  redeemArgs,
  fmt,
  usd,
  same,
  type Snapshot,
} from "./model";
import { PageTitle, Note, Empty, TxButton, Addr } from "./components";
import { DepositState } from "./Vault";
import { Checkout } from "./Scenery";
import type { Wallet } from "./wallet";
type Props = { snapshot: Snapshot; wallet: Wallet };
export function DepositPage({ snapshot: s, wallet: w }: Props) {
  const open = s.assets.filter((a) => a.open && !a.retired);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [quote, setQuote] = useState<{
    tokens: Address[];
    amounts: bigint[];
    shares: bigint;
    fee: bigint;
    value: bigint;
  }>();
  const [error, setError] = useState(""),
    [working, setWorking] = useState(false),
    [balances, setBalances] = useState<Record<string, bigint | undefined>>({});
  const [allowances, setAllowances] = useState<
      Record<string, bigint | undefined>
    >({}),
    [simulated, setSimulated] = useState(false),
    [retry, setRetry] = useState(0);
  const sequence = useRef(0),
    lock = useRef(false);
  useLayoutEffect(() => {
    sequence.current++;
    setQuote(undefined);
    setSimulated(false);
    setError("");
    setWorking(false);
  }, [inputs, w.account, w.chainId]);
  useLayoutEffect(() => {
    if (w.confirmed?.functionName === "deposit") {
      setInputs({});
      setQuote(undefined);
      setSimulated(false);
      sequence.current++;
    }
  }, [w.confirmed]);
  useEffect(() => {
    let live = true;
    setBalances({});
    setAllowances({});
    if (w.account)
      many(
        open.flatMap((a) => [
          token(a.token, "balanceOf", [w.account]),
          token(a.token, "allowance", [w.account, VAULT]),
        ]),
      ).then((rs) => {
        if (!live) return;
        const b: typeof balances = {},
          al: typeof allowances = {};
        open.forEach((a, i) => {
          const br = rs[i * 2],
            ar = rs[i * 2 + 1];
          b[a.token] = br.ok ? br.value : undefined;
          al[a.token] = ar.ok ? ar.value : undefined;
        });
        setBalances(b);
        setAllowances(al);
      });
    return () => {
      live = false;
    };
  }, [w.account, s.loadedAt, retry]);
  useEffect(() => {
    let live = true;
    setSimulated(false);
    if (
      quote &&
      w.account &&
      quote.tokens.every(
        (t, i) =>
          balances[t] !== undefined &&
          balances[t]! >= quote.amounts[i] &&
          allowances[t] !== undefined &&
          allowances[t]! >= quote.amounts[i],
      )
    )
      simulate(
        vault(
          "deposit",
          depositArgs(quote.tokens, quote.amounts, w.account, quote.shares),
        ),
        w.account,
      )
        .then(() => {
          if (live) setSimulated(true);
        })
        .catch((e) => {
          if (live) setError(explain(e));
        });
    return () => {
      live = false;
    };
  }, [quote, balances, allowances, w.account, s.loadedAt]);
  const short = quote?.tokens.some(
    (t, i) => balances[t] === undefined || balances[t]! < quote.amounts[i],
  );
  const approvals =
    quote?.tokens.filter(
      (t, i) =>
        allowances[t] !== undefined && allowances[t]! < quote.amounts[i],
    ) ?? [];
  async function approveAll() {
    if (!quote || !w.account || lock.current) return;
    lock.current = true;
    setWorking(true);
    const seq = sequence.current;
    try {
      for (let i = 0; i < quote.tokens.length; i++) {
        if (sequence.current !== seq)
          throw new InputError("Deposit changed. Preview again.");
        const t = quote.tokens[i],
          n = quote.amounts[i];
        const [b, al] = await Promise.all([
          read(token(t, "balanceOf", [w.account])),
          read(token(t, "allowance", [w.account, VAULT])),
        ]);
        if (b < n)
          throw new InputError(
            "Your stock balance is too low. Reduce the amount.",
          );
        if (al < n) await w.send(token(t, "approve", [VAULT, n]));
      }
      setRetry((x) => x + 1);
    } catch (e) {
      setError(explain(e));
    } finally {
      lock.current = false;
      setWorking(false);
    }
  }
  return (
    <>
      <PageTitle eyebrow="Fill your basket" title="Deposit Stock Tokens">
        Choose one or more open stocks. They go into the vault together in one
        deposit.
      </PageTitle>
      <div className="flow-layout">
        <section className="panel">
          <h2>Make a deposit</h2>
          {!open.length ? (
            <Empty
              title={
                s.complete ? "No open stocks yet" : "Open stocks unreadable"
              }
            >
              The owner must list stocks and finalize genesis. Retry the vault
              to check again.
            </Empty>
          ) : (
            <>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const seq = ++sequence.current;
                  setWorking(true);
                  setError("");
                  setQuote(undefined);
                  try {
                    const chosen = open.filter((a) => inputs[a.token]?.trim());
                    if (!chosen.length)
                      throw new InputError(
                        "Enter an amount for at least one stock.",
                      );
                    const tokens = chosen.map((a) => a.token),
                      amounts = chosen.map((a) =>
                        amount(inputs[a.token], false, a.tokenDecimals),
                      );
                    const [shares, fee, value] = await read(
                      vault("previewDeposit", [tokens, amounts]),
                    );
                    if (seq === sequence.current)
                      setQuote({ tokens, amounts, shares, fee, value });
                  } catch (e) {
                    if (seq === sequence.current)
                      setError(
                        explain(
                          e,
                          (a) =>
                            s.assets.find((x) => same(x.token, a))?.symbol ?? a,
                          true,
                        ),
                      );
                  } finally {
                    if (seq === sequence.current) setWorking(false);
                  }
                }}
              >
                {open.map((a) => (
                  <label key={a.token}>
                    <span>
                      <bdi>{a.symbol}</bdi> amount
                    </span>
                    <input
                      aria-label={`${a.symbol} amount`}
                      aria-describedby={`balance-${a.token}`}
                      inputMode="decimal"
                      autoComplete="off"
                      value={inputs[a.token] ?? ""}
                      disabled={working || w.busy}
                      onChange={(e) =>
                        setInputs({ ...inputs, [a.token]: e.target.value })
                      }
                    />
                    <small id={`balance-${a.token}`}>
                      Wallet balance:{" "}
                      {w.account
                        ? fmt(balances[a.token], a.tokenDecimals)
                        : "Connect wallet"}
                    </small>
                  </label>
                ))}
                <button className="primary" disabled={working || w.busy}>
                  Preview deposit
                </button>
              </form>
              {quote && (
                <div className="receipt">
                  <h3>Deposit preview</h3>
                  <dl>
                    <div>
                      <dt>BASK received</dt>
                      <dd>{fmt(quote.shares)}</dd>
                    </div>
                    <div>
                      <dt>Fee in BASK</dt>
                      <dd>{fmt(quote.fee)}</dd>
                    </div>
                    <div>
                      <dt>Dollar value</dt>
                      <dd>{usd(quote.value)}</dd>
                    </div>
                  </dl>
                  <p>
                    Size-limit check passed. Minimum received:{" "}
                    {fmt((quote.shares * 995n) / 1000n)} BASK (0.5% below
                    preview).
                  </p>
                  {short && (
                    <Note warning>
                      Wallet balance unreadable or too low. Retry balances or
                      reduce the amount.
                    </Note>
                  )}
                  {quote.tokens.some((t) => allowances[t] === undefined) && (
                    <Note warning>
                      Allowance unreadable. Retry balances before continuing.
                    </Note>
                  )}
                  {approvals.length > 0 && (
                    <button
                      disabled={
                        working || w.busy || short || w.chainId !== 4663
                      }
                      onClick={approveAll}
                    >
                      Approve exact amounts
                    </button>
                  )}
                  <p role="status">
                    {simulated
                      ? "Deposit simulation passed. Prices and limits can change before confirmation."
                      : "Approvals and balances must be ready before the deposit simulation passes."}
                  </p>
                  <TxButton
                    snapshot={s}
                    wallet={w}
                    label="Deposit"
                    primary
                    disabled={!simulated || working || short}
                    getSpec={async () => {
                      const revision = sequence.current;
                      for (let i = 0; i < quote.tokens.length; i++) {
                        const b = await read(
                          token(quote.tokens[i], "balanceOf", [w.account]),
                        );
                        if (b < quote.amounts[i])
                          throw new InputError(
                            "Your stock balance is too low. Preview again.",
                          );
                      }
                      if (revision !== sequence.current)
                        throw new InputError("Deposit changed. Preview again.");
                      return vault(
                        "deposit",
                        depositArgs(
                          quote.tokens,
                          quote.amounts,
                          w.account!,
                          quote.shares,
                        ),
                      );
                    }}
                  />
                </div>
              )}
              <button
                disabled={working || w.busy}
                onClick={() => setRetry((x) => x + 1)}
              >
                Retry balances
              </button>
            </>
          )}
          <p className="error" role="alert">
            {error}
          </p>
        </section>
        <aside className="panel">
          <Checkout />
          <h2>Before you deposit</h2>
          <DepositState snapshot={s} />
          <p>Size limit: {usd(s.globals.NAV_CAP)}.</p>
          <p>
            First deposit: 0.001 BASK is locked forever. The preview already
            subtracts this lock and any fee.
          </p>
          <p>
            Each short allowance is set to exactly that stock’s amount.
            Approvals are separate wallet prompts; the deposit follows after
            simulation.
          </p>
          <p>
            The deadline is ten minutes from preparation. Your wallet receives
            the BASK.
          </p>
          <Note warning>
            Feeds lag the market. Issuer restrictions and pool checks can stop
            deposits.
          </Note>
        </aside>
      </div>
    </>
  );
}
export function RedeemPage({ snapshot: s, wallet: w }: Props) {
  const [input, setInput] = useState(""),
    [to, setTo] = useState(""),
    [balance, setBalance] = useState<bigint>(),
    [quote, setQuote] = useState<{
      shares: bigint;
      amounts: bigint[];
      fee: bigint;
    }>(),
    [error, setError] = useState(""),
    [working, setWorking] = useState(false),
    [retry, setRetry] = useState(0);
  const seq = useRef(0);
  useEffect(() => {
    setTo(w.account ?? "");
  }, [w.account]);
  useLayoutEffect(() => {
    seq.current++;
    setQuote(undefined);
    setWorking(false);
  }, [input, to, w.account, s.loadedAt]);
  useEffect(() => {
    let live = true;
    setBalance(undefined);
    if (w.account)
      read(vault("balanceOf", [w.account]))
        .then((v) => {
          if (live) setBalance(v);
        })
        .catch(() => {});
    return () => {
      live = false;
    };
  }, [w.account, s.loadedAt, retry]);
  return (
    <>
      <PageTitle eyebrow="At the checkout" title="Redeem BASK">
        Receive your share of every stock. Redemption is always open.
      </PageTitle>
      <div className="flow-layout">
        <section className="panel">
          <h2>Redeem shares</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              setWorking(true);
              const id = ++seq.current;
              try {
                recipient(to);
                const shares = amount(input);
                const [amounts, fee] = await read(
                  vault("previewRedeem", [shares]),
                );
                if (id === seq.current) setQuote({ shares, amounts, fee });
              } catch (e) {
                if (id === seq.current) setError(explain(e, undefined, true));
              } finally {
                if (id === seq.current) setWorking(false);
              }
            }}
          >
            <label>
              BASK amount
              <input
                disabled={w.busy}
                aria-label="BASK amount"
                aria-describedby="bask-balance"
                inputMode="decimal"
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <small id="bask-balance">
                Wallet balance: {w.account ? fmt(balance) : "Connect wallet"}
              </small>
            </label>
            <label>
              Receiver
              <input
                disabled={w.busy || working}
                value={to}
                onChange={(e) => setTo(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <button disabled={working || w.busy}>Preview redemption</button>
          </form>
          <button onClick={() => setRetry((x) => x + 1)}>Retry balance</button>
          {quote && (
            <div className="receipt">
              <h3>Redemption preview</h3>
              <p>Fee: {fmt(quote.fee)} BASK</p>
              {s.assets.map((a, i) => (
                <p key={a.token}>
                  <bdi>{a.symbol}</bdi>:{" "}
                  {fmt(quote.amounts[i], a.tokenDecimals)}
                </p>
              ))}
              <TxButton
                snapshot={s}
                wallet={w}
                label="Redeem"
                primary
                disabled={
                  balance === undefined || balance < quote.shares || !s.complete
                }
                getSpec={async () => {
                  const revision = seq.current;
                  const receiver = recipient(to);
                  const b = await read(vault("balanceOf", [w.account]));
                  if (b < quote.shares)
                    throw new InputError("Your BASK balance is too low.");
                  const [amounts] = await read(
                    vault("previewRedeem", [quote.shares]),
                  );
                  if (revision !== seq.current)
                    throw new InputError("Redemption changed. Preview again.");
                  return vault(
                    "redeem",
                    redeemArgs(quote.shares, receiver, amounts),
                  );
                }}
              />
            </div>
          )}
          <p role="alert" className="error">
            {error}
          </p>
        </section>
        <aside className="panel">
          <Checkout />
          <h2>Know your receiver</h2>
          <Note warning>
            Unsent stocks are owed to the receiver. Only that wallet can claim
            them. Choose a wallet you control that can call this vault.
          </Note>
          <p>
            Minimum amounts are 0.1% below a fresh preview taken just before
            sending, with zero kept as zero. They follow assetTokens order.
          </p>
          <p>
            Removal of an empty retired stock can change that order before
            execution. Minimums protect entitlements, not immediate payment.
          </p>
          <p>Redemption and claim gas is estimated, then increased by 30%.</p>
        </aside>
      </div>
    </>
  );
}
export function Claims({ snapshot: s, wallet: w }: Props) {
  const [owed, setOwed] = useState<Record<string, bigint | undefined>>({}),
    [to, setTo] = useState(""),
    [retry, setRetry] = useState(0),
    [error, setError] = useState(""),
    [working, setWorking] = useState(false);
  const lock = useRef(false);
  useEffect(() => setTo(w.account ?? ""), [w.account]);
  useEffect(() => {
    let live = true;
    setOwed({});
    if (w.account)
      many(s.assets.map((a) => vault("owed", [w.account, a.token]))).then(
        (rs) => {
          if (live)
            setOwed(
              Object.fromEntries(
                s.assets.map((a, i) => {
                  const r = rs[i];
                  return [a.token, r.ok ? r.value : undefined];
                }),
              ),
            );
        },
      );
    return () => {
      live = false;
    };
  }, [w.account, s.loadedAt, retry]);
  const claimable = s.assets.filter((a) => (owed[a.token] ?? 0n) > 0n);
  return (
    <section className="panel claims">
      <h2>Claim owed stocks</h2>
      <p>
        Claims belong to the connected wallet: <Addr value={w.account} />
      </p>
      <label>
        Send claimed stocks to
        <input
          disabled={w.busy || working}
          value={to}
          onChange={(e) => setTo(e.target.value)}
          spellCheck={false}
        />
      </label>
      <button onClick={() => setRetry((x) => x + 1)}>Retry claims</button>
      {!w.account ? (
        <p>Connect the receiver wallet to read and claim its owed stocks.</p>
      ) : (
        <>
          <div className="claim-grid">
            {s.assets.map((a) => (
              <div className="receipt" key={a.token}>
                <bdi>{a.symbol}</bdi>
                <p>Owed: {fmt(owed[a.token], a.tokenDecimals)}</p>
                <TxButton
                  snapshot={s}
                  wallet={w}
                  label={`Claim ${a.symbol}`}
                  disabled={
                    working ||
                    owed[a.token] === undefined ||
                    owed[a.token] === 0n
                  }
                  getSpec={() => vault("claim", [[a.token], recipient(to)])}
                />
              </div>
            ))}
          </div>
          {!s.assets.length && (
            <p>
              {s.complete
                ? "No listed stocks."
                : "Listed stocks unreadable. Retry the vault."}
            </p>
          )}
          <button
            disabled={
              working || w.busy || w.chainId !== 4663 || !claimable.length
            }
            onClick={async () => {
              if (lock.current) return;
              lock.current = true;
              setWorking(true);
              setError("");
              try {
                const receiver = recipient(to);
                for (let i = 0; i < claimable.length; i += 10)
                  await w.send(
                    vault("claim", [
                      claimable.slice(i, i + 10).map((a) => a.token),
                      receiver,
                    ]),
                  );
                setRetry((x) => x + 1);
              } catch (e) {
                setError(explain(e));
              } finally {
                setWorking(false);
                lock.current = false;
              }
            }}
          >
            Claim all
          </button>
          <p>
            Batches of up to 10 stocks, with one wallet prompt per batch. Failed
            payments remain owed and can be retried individually.
          </p>
        </>
      )}
      <p role="alert" className="error">
        {error}
      </p>
    </section>
  );
}

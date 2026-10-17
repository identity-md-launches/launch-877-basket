import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { decodeEventLog, type Address, type Hex } from "viem";
import {
  read,
  many,
  vault,
  token,
  explain,
  simulate,
  InputError,
  VAULT,
  client,
  vaultAbi,
  reasonWords,
} from "./chain";
import {
  amount,
  recipient,
  depositArgs,
  redeemArgs,
  fmt,
  exact,
  usd,
  same,
  type Asset,
  type Snapshot,
} from "./model";
import {
  PageTitle,
  Note,
  Empty,
  TxButton,
  Addr,
  ActionStatus,
  DisabledReason,
  actionReason,
  Receiver,
} from "./components";
import { DepositState } from "./Vault";
import type { Wallet } from "./wallet";
type Props = { snapshot: Snapshot; wallet: Wallet };
// Always shown at the top of the Deposit and Redeem forms (open or closed), so
// nobody reads the deposit hours as redemption hours.
function HoursTag() {
  return (
    <p className="hours-tag">
      <strong>Redemptions are open 24/7.</strong>{" "}
      <span>Deposit hours apply to deposits only.</span>
    </p>
  );
}
export function DepositPage({ snapshot: s, wallet: w }: Props) {
  const open = s.assets.filter((a) => a.open && !a.retired);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [reading, setReading] = useState(false);
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
  const [received, setReceived] = useState<{
    hash: Hex;
    receiver: Address;
    shares: bigint;
  }>();
  // The rows come from the last finished balance read, so they stay in place
  // while a new read runs. Never an input to a transaction.
  const [held, setHeld] = useState<Record<string, bigint | undefined>>();
  const [removed, setRemoved] = useState<Record<string, boolean>>({});
  const [showSmall, setShowSmall] = useState(false);
  // v13: the account ("" for none) for which the stock list under the search
  // was shown open because the form was empty; it stays open for it.
  const [listOpenFor, setListOpenFor] = useState<string>();
  // v14: wider than 960px the panel has two columns (the form left, the stock
  // list always open on the right); phones and tablets keep the one column.
  const [desktop, setDesktop] = useState(
    () => window.matchMedia("(min-width: 961px)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(min-width: 961px)");
    const update = () => setDesktop(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  // The stock an Add button just added, until its row is on screen.
  const focusRow = useRef<Address | undefined>(undefined);
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
  useLayoutEffect(() => {
    if (w.confirmed?.functionName === "deposit") setRemoved({});
  }, [w.confirmed]);
  // Another wallet's rows must not stay on screen.
  useLayoutEffect(() => {
    setHeld(undefined);
    setRemoved({});
  }, [w.account]);
  // The pressed Add button is gone: the new row's amount box takes its focus,
  // or the row itself when the stock is blocked and its box is off.
  useLayoutEffect(() => {
    const box = focusRow.current
      ? document.getElementById(`amount-${focusRow.current}`)
      : null;
    if (box instanceof HTMLInputElement && box.disabled)
      box.closest<HTMLElement>(".deposit-row")?.focus();
    else box?.focus();
    focusRow.current = undefined;
  }, [inputs]);
  // The BASK a confirmed deposit minted, from the Deposit event in its receipt.
  useEffect(() => {
    const done = w.confirmed;
    if (done?.functionName !== "deposit") return;
    let live = true;
    client
      .getTransactionReceipt({ hash: done.hash })
      .then((receipt) => {
        const event = receipt.logs
          .filter((l) => same(l.address, VAULT))
          .map((l) => {
            try {
              return decodeEventLog({
                abi: vaultAbi,
                data: l.data,
                topics: l.topics,
              });
            } catch {
              return undefined;
            }
          })
          .find((l) => l?.eventName === "Deposit");
        if (!live || !event) return;
        const { receiver, shares } = event.args as any;
        setReceived({ hash: done.hash, receiver, shares });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [w.confirmed]);
  useEffect(() => {
    let live = true;
    setBalances({});
    setAllowances({});
    setReading(!!w.account);
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
        setHeld(b);
        setAllowances(al);
        setReading(false);
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
    setError("");
    w.report("approvals", { message: "Checking approvals..." });
    try {
      let approval = 0;
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
        if (al < n) {
          approval++;
          await w.send(
            token(t, "approve", [VAULT, n]),
            "approvals",
            `Approval ${approval} of ${approvals.length}: ${s.assets.find((a) => same(a.token, t))?.symbol ?? t}`,
          );
        }
      }
      setRetry((x) => x + 1);
      w.report("approvals", { message: "Approvals done: press Deposit" });
    } catch (e) {
      setError(explain(e));
      w.fail("approvals", explain(e));
    } finally {
      lock.current = false;
      setWorking(false);
    }
  }
  // From the last finished vault read, kept while a new read runs so the form
  // does not jump; undefined before the first read or when unreadable.
  // Dollar value of n units at the feed price of the last vault read, 18
  // decimals; undefined when that price is unreadable.
  const worth = (a: Asset, n: bigint) =>
    a.answer !== undefined && a.answer > 0n
      ? (n * a.answer * 10n ** 18n) /
        10n ** BigInt(a.tokenDecimals + a.feedDecimals)
      : undefined;
  // "about $1,234.56"; usd() alone writes a value under one cent as "$<0.01".
  const about = (value: bigint) =>
    value < 10n ** 16n ? "under $0.01" : `about ${usd(value)}`;
  // Display only. Preview and Deposit read `inputs` in the vault's order.
  const stocks = open.map((a) => {
    const balance = held?.[a.token] ?? 0n,
      value = balance > 0n ? worth(a, balance) : undefined;
    return {
      a,
      value,
      inWallet: balance > 0n,
      // Under one cent. An unreadable price is unknown, never small.
      small: value !== undefined && value < 10n ** 16n,
      added: inputs[a.token] !== undefined,
    };
  });
  type Stock = (typeof stocks)[number];
  // A wallet stock the user has not removed.
  const kept = (x: Stock) => x.inWallet && !removed[x.a.token];
  const onScreen = (x: Stock) =>
    x.added || (kept(x) && (!x.small || showSmall));
  const hiddenSmall = stocks.filter((x) => kept(x) && !onScreen(x)).length;
  // Wallet stocks by value, largest first, unpriced ones after them; then the
  // stocks added by hand. Ties keep the vault's order.
  const rows = [
    ...stocks
      .filter((x) => onScreen(x) && x.inWallet)
      .sort((x, y) =>
        x.value === y.value
          ? 0
          : x.value === undefined
            ? 1
            : y.value === undefined || x.value > y.value
              ? -1
              : 1,
      ),
    ...stocks.filter((x) => onScreen(x) && !x.inWallet),
  ];
  // The last finished read covers every stock now listed.
  const ready = !!held && open.every((a) => a.token in held);
  // A gap in that read; it stays so while the next read runs.
  const unread = ready && open.some((a) => held[a.token] === undefined);
  // Tickers first (the exact one, then those that start with the text, then
  // those that contain it), then token addresses from four characters on.
  const query = search.trim().toLowerCase();
  const rank = (a: Asset) => {
    const ticker = a.symbol.toLowerCase();
    return ticker === query
      ? 0
      : ticker.startsWith(query)
        ? 1
        : ticker.includes(query)
          ? 2
          : query.length >= 4 && a.token.toLowerCase().includes(query)
            ? 3
            : 4;
  };
  const matches = query
    ? stocks
        .filter((x) => !onScreen(x) && rank(x.a) < 4)
        .map((x) => x.a)
        .sort((x, y) => rank(x) - rank(y))
    : [];
  // Every open stock by ticker, A to Z, for the list under the search. A copy
  // for display only: `open` keeps the vault's order.
  const listed = [...open].sort((x, y) => {
    const a = x.symbol.toLowerCase(),
      b = y.symbol.toLowerCase();
    return a < b ? -1 : a > b ? 1 : 0;
  });
  // v13: the form is empty with no wallet, or with a wallet whose balances
  // are read and hold no listed stock while no row is in the form. Then the
  // stock list is shown open across the panel, and it stays open for that
  // account until the account changes or the page is reloaded.
  const emptyForm =
    !w.account ||
    (ready && !unread && !rows.length && !stocks.some((x) => x.inWallet));
  const accountKey = w.account ?? "";
  useEffect(() => {
    if (emptyForm) setListOpenFor(accountKey);
  }, [emptyForm, accountKey]);
  const listOpen = desktop || emptyForm || listOpenFor === accountKey;
  const StockList = listOpen ? "div" : "details";
  // `focus` is false for Enter in the search box, which keeps the focus.
  function add(t: Address, focus = true) {
    if (focus) focusRow.current = t;
    setRemoved((old) => ({ ...old, [t]: false }));
    setInputs((old) => ({ ...old, [t]: "" }));
    setSearch("");
  }
  function remove(t: Address) {
    // The pressed button goes with its row: focus a row beside it or search.
    const row = document.getElementById(`amount-${t}`)?.closest(".deposit-row"),
      beside = row?.nextElementSibling ?? row?.previousElementSibling;
    if (row?.contains(document.activeElement)) {
      if (beside instanceof HTMLElement) beside.focus({ preventScroll: true });
      else
        document
          .querySelector<HTMLInputElement>(".stock-search input")
          ?.focus({ preventScroll: true });
    }
    setRemoved((old) => ({ ...old, [t]: true }));
    if (inputs[t] !== undefined)
      setInputs((old) => {
        const next = { ...old };
        delete next[t];
        return next;
      });
  }
  // An estimate of the typed amounts, for the same stocks Preview would send.
  let total = 0n,
    counted = 0;
  const badAmount: string[] = [],
    noPrice: string[] = [];
  for (const a of open) {
    const text = inputs[a.token];
    if (!text?.trim()) continue;
    let value: bigint | undefined;
    try {
      value = worth(a, amount(text, false, a.tokenDecimals));
    } catch {
      badAmount.push(a.symbol);
      continue;
    }
    if (value === undefined) noPrice.push(a.symbol);
    else {
      total += value;
      counted++;
    }
  }
  // Every stock the vault takes now. On phones: inside the form, closed until
  // pressed while the form has rows, open across the panel while the form is
  // empty (no wallet, or a wallet without a listed stock) and then for the
  // rest of the visit for that account (v13). On desktop: always open, in the
  // right-hand column (v14). A press is the same Add as in the search; a stock
  // that has a row stays in the list, switched off.
  const stockList = (
    <StockList className={listOpen ? "all-stocks open-list" : "all-stocks"}>
      {listOpen ? (
        <p className="list-title">All stocks you can deposit ({open.length})</p>
      ) : (
        <summary>All stocks you can deposit ({open.length})</summary>
      )}
      <p>Press a stock to add it to your deposit.</p>
      <ul>
        {listed.map((a) => (
          <li key={a.token} className={a.symbol.length > 5 ? "wide" : undefined}>
            <button
              type="button"
              className="quiet"
              disabled={
                working || w.busy || rows.some((x) => x.a.token === a.token)
              }
              onClick={() => add(a.token)}
            >
              <bdi>{a.symbol}</bdi>
            </button>
          </li>
        ))}
      </ul>
    </StockList>
  );
  // "Before you deposit": its own panel under the form on phones, under the
  // form inside the panel on desktop (v14).
  const notes = (
    <>
      <h2>Before you deposit</h2>
      <p>Size limit: {usd(s.globals.NAV_CAP)}.</p>
      <p>
        First deposit: 0.001 BASK is locked forever. The preview already
        subtracts this lock and any fee.
      </p>
      <p>
        You approve each stock for exactly the amount you deposit. Each approval is its own wallet prompt; the deposit prompt comes last.
      </p>
      <p>
        A prepared deposit must be sent within ten minutes. The BASK goes to your connected wallet.
      </p>
      <Note warning>
        Issuer restrictions and pool checks can temporarily halt deposits.
      </Note>
    </>
  );
  return (
    <>
      <PageTitle
        eyebrow="Fill your basket"
        title="Deposit Stock Tokens"
        character={{
          kind: "deposit",
          src: "./art/character/deposit.webp",
          width: 313,
          height: 1000,
          alt: "Store worker holding out a shopping basket",
          line: "Go ahead and put it in",
        }}
      >
        Choose one or more open stocks. They go into the vault together in one
        deposit.
      </PageTitle>
      <div className="flow-layout one-column">
        <section className="panel">
          <HoursTag />
          <DepositState snapshot={s} showSign />
          <p className="flow-steps">
            Choose amounts, preview, approve each stock, press Deposit.
          </p>
          <h2>Make a deposit</h2>
          {/* v14: two columns on desktop (the form, its preview and buttons and
              the notes left; the stock list right), one column otherwise. */}
          <div className="deposit-columns">
          <div className="deposit-main">
          {!open.length ? (
            <Empty
              title={
                s.loading
                  ? "Reading..."
                  : !s.complete
                    ? "Open stocks unreadable"
                    : s.globals.genesisFinalized
                      ? "Every stock is closed"
                      : "No Stock Tokens are listed yet."
              }
            >
              {s.loading
                ? "Please wait for current vault data."
                : !s.complete
                  ? "Retry the vault to read stocks."
                  : s.globals.genesisFinalized
                    ? "Deposits need an open, unretired stock. The owner can propose reopening a stock."
                    : "Deposits start after the owner finishes setup."}
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
                {!w.account ? (
                  <div className="wallet-connect">
                    <p>Connect your wallet to see the stocks you hold.</p>
                    <button
                      type="button"
                      onClick={w.connect}
                      disabled={w.connecting}
                    >
                      {w.connecting ? "Connecting..." : "Connect wallet"}
                    </button>
                  </div>
                ) : (
                  <>
                    {!ready && <p>Reading your wallet...</p>}
                    {unread ? (
                      <p>
                        Some balances could not be read. Press Retry balances
                        below.
                      </p>
                    ) : (
                      ready &&
                      !rows.length &&
                      !stocks.some((x) => x.inWallet) && (
                        <p>No open listed stock in this wallet.</p>
                      )
                    )}
                  </>
                )}
                <div className="deposit-rows">
                  {rows.map(({ a, value, inWallet }) => {
                    const blocked = a.reason !== undefined && a.reason !== 0,
                      balance = held?.[a.token];
                    return (
                      <div
                        className={
                          blocked ? "deposit-row blocked" : "deposit-row"
                        }
                        key={a.token}
                        tabIndex={-1}
                      >
                        <div className="row-stock">
                          <label htmlFor={`amount-${a.token}`}>
                            <bdi>{a.symbol}</bdi>
                          </label>
                          <small id={`balance-${a.token}`}>
                            Wallet balance:{" "}
                            {w.account
                              ? balance === undefined && (reading || !ready)
                                ? "Reading..."
                                : fmt(balance, a.tokenDecimals)
                              : "Connect wallet"}
                            {inWallet && value !== undefined && (
                              <span> · {about(value)}</span>
                            )}
                          </small>
                        </div>
                        <input
                          id={`amount-${a.token}`}
                          aria-label={`${a.symbol} amount`}
                          aria-describedby={`balance-${a.token}`}
                          inputMode="decimal"
                          autoComplete="off"
                          value={inputs[a.token] ?? ""}
                          disabled={working || w.busy || blocked}
                          onChange={(e) =>
                            setInputs({ ...inputs, [a.token]: e.target.value })
                          }
                        />
                        <button
                          type="button"
                          className="quiet"
                          aria-label={`Max ${a.symbol}`}
                          disabled={
                            working ||
                            w.busy ||
                            blocked ||
                            balances[a.token] === undefined
                          }
                          onClick={() =>
                            setInputs((old) => ({
                              ...old,
                              [a.token]: exact(
                                balances[a.token]!,
                                a.tokenDecimals,
                              ),
                            }))
                          }
                        >
                          Max
                        </button>
                        <button
                          type="button"
                          className="quiet remove"
                          aria-label={`Remove ${a.symbol}`}
                          disabled={working || w.busy}
                          onClick={() => remove(a.token)}
                        >
                          Remove
                        </button>
                        {blocked && (
                          <p className="row-note">
                            Deposits of this stock are blocked right now:{" "}
                            {reasonWords(a.reason, s.globals.settings)}.{" "}
                            <button
                              type="button"
                              className="quiet"
                              aria-label={`Refresh ${a.symbol}`}
                              disabled={working || w.busy || s.loading}
                              onClick={s.retry}
                            >
                              Refresh
                            </button>
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
                {(hiddenSmall > 0 || showSmall) && (
                  <button
                    type="button"
                    className="quiet small-toggle"
                    onClick={() => setShowSmall(!showSmall)}
                  >
                    {showSmall
                      ? "Hide small balances"
                      : `Show small balances (${hiddenSmall})`}
                  </button>
                )}
                <label className="stock-search">
                  Add another stock
                  <input
                    type="search"
                    placeholder="Ticker or token address"
                    autoComplete="off"
                    spellCheck={false}
                    value={search}
                    disabled={working || w.busy}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      // Enter adds the first match; it never runs Preview.
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      if (matches[0]) add(matches[0].token, false);
                    }}
                  />
                </label>
                {/* Always in the page, so that a screen reader hears what the
                    search found. */}
                <div className="stock-matches" role="status">
                  {matches.slice(0, 6).map((a) => (
                    <button
                      type="button"
                      key={a.token}
                      disabled={working || w.busy}
                      onClick={() => add(a.token)}
                    >
                      Add {a.symbol}
                    </button>
                  ))}
                  {matches.length > 6 && (
                    <p>{matches.length - 6} more: keep typing.</p>
                  )}
                  {!!query && !matches.length && (
                    <p>
                      {rows.some(
                        (x) =>
                          rank(x.a) === 0 || x.a.token.toLowerCase() === query,
                      )
                        ? "That stock is already in the list above."
                        : "No open stock matches."}
                    </p>
                  )}
                </div>
                {/* The stock list (above): in the form on phones, in the
                    right-hand column on desktop. */}
                {!desktop && stockList}
                {counted + badAmount.length + noPrice.length > 0 && (
                  <div className="deposit-total">
                    {counted > 0 && (
                      <>
                        <p>
                          <strong>Total: {about(total)}</strong>
                        </p>
                        <small>
                          An estimate from the last vault read. Preview gives
                          the exact figure.
                        </small>
                      </>
                    )}
                    {badAmount.length > 0 && (
                      <p>
                        Not counted: {badAmount.join(", ")} (check the amount
                        typed).
                      </p>
                    )}
                    {noPrice.length > 0 && (
                      <p>
                        Not counted: {noPrice.join(", ")} (price unreadable).
                      </p>
                    )}
                  </div>
                )}
                <button className="primary" disabled={working || w.busy}>
                  {working ? "Checking..." : "Preview deposit"}
                </button>
                {(working || w.busy) && (
                  <p className="disabled-reason">
                    Checking or waiting for the current transaction. Finish it
                    before previewing again.
                  </p>
                )}
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
                  {!reading && short && (
                    <Note warning>
                      Wallet balance unreadable or too low. Retry balances or
                      reduce the amount.
                    </Note>
                  )}
                  {!reading &&
                    quote.tokens.some((t) => allowances[t] === undefined) && (
                      <Note warning>
                        Allowance unreadable. Retry balances before continuing.
                      </Note>
                    )}
                  {approvals.length > 0 && (
                    <>
                      <button
                        disabled={
                          working || w.busy || short || w.chainId !== 4663
                        }
                        onClick={approveAll}
                      >
                        Approve exact amounts
                      </button>
                      <DisabledReason
                        wallet={w}
                        snapshot={s}
                        reason={
                          actionReason(w, s) ||
                          (working
                            ? "Approval pending. Finish each wallet prompt."
                            : short
                              ? "Balance too low or unreadable. Reduce amounts or retry balances."
                              : "")
                        }
                      />
                    </>
                  )}
                  <ActionStatus wallet={w} scope="approvals" />
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
                    disabledReason={
                      short
                        ? "Balance too low or unreadable. Reduce amounts or retry balances."
                        : working || approvals.length
                          ? "Approval pending. Approve each stock above, then press Deposit."
                          : "Checking deposit simulation. If it fails, correct the error and preview again."
                    }
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
                      // v22: the fee shown must be the fee charged; a fee that
                      // changed since the preview needs a new preview.
                      const [, fee] = await read(
                        vault("previewDeposit", [quote.tokens, quote.amounts]),
                      );
                      if (fee !== quote.fee)
                        throw new InputError("Deposit changed. Preview again.");
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
              {w.account &&
                !reading &&
                open.some(
                  (a) =>
                    balances[a.token] === undefined ||
                    allowances[a.token] === undefined,
                ) && (
                  <button onClick={() => setRetry((x) => x + 1)}>
                    Retry balances
                  </button>
                )}
            </>
          )}
          <ActionStatus wallet={w} scope="Deposit" />
          {/* Only under the status of that same deposit, never under a later
              attempt. */}
          {received &&
            received.hash === w.confirmed?.hash &&
            received.hash === w.progress.Deposit?.hash &&
            same(received.receiver, w.account) && (
              <p className="received" role="status">
                You received {fmt(received.shares)} BASK.
              </p>
            )}
          <p className="error" role="alert">
            {error}
          </p>
          {desktop && <div className="deposit-notes">{notes}</div>}
          </div>
          {desktop && open.length > 0 && (
            <div className="deposit-right">{stockList}</div>
          )}
          </div>
        </section>
        {!desktop && <aside className="panel">{notes}</aside>}
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
  const [reading, setReading] = useState(false);
  useEffect(() => {
    setTo(w.account ?? "");
  }, [w.account]);
  useLayoutEffect(() => {
    seq.current++;
    setQuote(undefined);
    setWorking(false);
  }, [input, to, w.account, s.loadedAt]);
  useLayoutEffect(() => {
    if (w.confirmed?.functionName === "redeem") setInput("");
  }, [w.confirmed]);
  useEffect(() => {
    let live = true;
    setBalance(undefined);
    setReading(!!w.account);
    if (w.account)
      read(vault("balanceOf", [w.account]))
        .then((v) => {
          if (live) setBalance(v);
        })
        .catch(() => {})
        .finally(() => {
          if (live) setReading(false);
        });
    return () => {
      live = false;
    };
  }, [w.account, s.loadedAt, retry]);
  return (
    <>
      <PageTitle
        eyebrow="At the checkout"
        title="Redeem BASK"
        character={{
          kind: "redeem",
          src: "./art/character/redeem.webp",
          width: 484,
          height: 1000,
          alt: "Store worker handing over a full grocery bag",
          line: "are you sure that’s all you came here for?",
        }}
      >
        Receive your share of every stock.
      </PageTitle>
      <div className="flow-layout one-column">
        <section className="panel">
          <HoursTag />
          <h2>Redeem shares</h2>
          <p>
            Choose BASK and a receiver, preview, then press Redeem. The estimate
            is read again just before sending. Minimums are 0.1% under it;
            stocks not sent stay owed to the receiver.
          </p>
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
                Wallet balance:{" "}
                {w.account
                  ? reading
                    ? "Reading..."
                    : fmt(balance)
                  : "Connect wallet"}
              </small>
            </label>
            <button
              type="button"
              disabled={w.busy || reading || balance === undefined}
              onClick={() => setInput(exact(balance!))}
            >
              Use full balance
            </button>
            {balance === undefined && (
              <p className="disabled-reason">
                {!w.account
                  ? "Connect wallet to read BASK balance."
                  : reading
                    ? "Reading..."
                    : "BASK balance unreadable. Retry balance below."}
              </p>
            )}
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
            <button disabled={working || w.busy}>
              {working ? "Checking..." : "Preview redemption"}
            </button>
            {(working || w.busy) && (
              <p className="disabled-reason">
                Checking or waiting for the current transaction before
                previewing again.
              </p>
            )}
          </form>
          {w.account && !reading && balance === undefined && (
            <button onClick={() => setRetry((x) => x + 1)}>
              Retry balance
            </button>
          )}
          {quote && (
            <div className="receipt">
              <h3>Redemption preview</h3>
              <p>Fee: {fmt(quote.fee)} BASK</p>
              {/* Each leg by the stock's own assetTokens index, and only from a
                  complete list of the same length as the preview. */}
              {s.complete && quote.amounts.length === s.assets.length ? (
                s.assets.map((a) => (
                  <p key={a.token}>
                    <bdi>{a.symbol}</bdi>:{" "}
                    {fmt(quote.amounts[a.index], a.tokenDecimals)}
                  </p>
                ))
              ) : (
                <p>
                  Amounts per stock are not shown: the stock list is unreadable
                  or has changed. Refresh vault and preview again.
                </p>
              )}
              <Receiver value={to} wallet={w} />
              <TxButton
                snapshot={s}
                wallet={w}
                label="Redeem"
                primary
                disabled={
                  balance === undefined || balance < quote.shares || !s.complete
                }
                disabledReason={
                  balance === undefined || !s.complete
                    ? "Data missing or balance unreadable. Retry balance and vault."
                    : "BASK balance too low. Reduce the amount or use full balance."
                }
                getSpec={async () => {
                  const revision = seq.current;
                  const receiver = recipient(to);
                  const b = await read(vault("balanceOf", [w.account]));
                  if (b < quote.shares)
                    throw new InputError("Your BASK balance is too low.");
                  const [amounts, fee] = await read(
                    vault("previewRedeem", [quote.shares]),
                  );
                  if (revision !== seq.current)
                    throw new InputError("Redemption changed. Preview again.");
                  // v22: the minimums are 0.1% under the preview on screen; a
                  // fresh estimate under them, or another fee, needs a new one.
                  if (
                    fee !== quote.fee ||
                    amounts.length !== quote.amounts.length ||
                    amounts.some(
                      (a: bigint, i: number) =>
                        a < (quote.amounts[i] * 999n) / 1000n,
                    )
                  )
                    throw new InputError("Redemption changed. Preview again.");
                  return vault(
                    "redeem",
                    redeemArgs(quote.shares, receiver, quote.amounts),
                  );
                }}
              />
            </div>
          )}
          <ActionStatus wallet={w} scope="Redeem" />
          <p role="alert" className="error">
            {error}
          </p>
        </section>
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
  const [reading, setReading] = useState(false);
  useEffect(() => setTo(w.account ?? ""), [w.account]);
  useEffect(() => {
    let live = true;
    setOwed({});
    setReading(!!w.account);
    if (w.account)
      many(s.assets.map((a) => vault("owed", [w.account, a.token]))).then(
        (rs) => {
          if (live) {
            setReading(false);
            setOwed(
              Object.fromEntries(
                s.assets.map((a, i) => {
                  const r = rs[i];
                  return [a.token, r.ok ? r.value : undefined];
                }),
              ),
            );
          }
        },
      );
    return () => {
      live = false;
    };
  }, [w.account, s.loadedAt, retry]);
  const claimable = s.assets.filter(
    (a) => owed[a.token] !== undefined && owed[a.token]! > 0n,
  );
  const visible = [
    ...claimable,
    ...s.assets.filter((a) => owed[a.token] === undefined),
  ];
  // Presentation only: keep the last finished visibility through refreshes.
  // Capture old account values so neither its owed result nor its status can
  // reveal the new account's panel before that account's first read finishes.
  const visit = useRef({ account: w.account, initialOwed: owed, progress: w.progress, error });
  const readStart = useRef(owed);
  useLayoutEffect(() => {
    readStart.current = owed;
  }, [w.account, s.loadedAt, retry]);
  const [display, setDisplay] = useState({ account: w.account, finished: false, shown: false, items: [] as Asset[], count: 0 });
  useLayoutEffect(() => {
    if (visit.current.account !== w.account) {
      visit.current = { account: w.account, initialOwed: owed, progress: w.progress, error };
      setDisplay({ account: w.account, finished: false, shown: false, items: [], count: 0 });
      return;
    }
    if (!w.account) return;
    const finished = !reading && !s.loading && owed !== readStart.current;
    const status = Object.keys(w.progress).some(
      (key) => (key === "claim-all" || key.startsWith("Claim ")) &&
        w.progress[key] !== visit.current.progress[key],
    );
    const shown = working || (error !== "" && error !== visit.current.error) || status ||
      (finished && (!s.complete || visible.length > 0));
    if (finished || shown)
      setDisplay((old) => ({
        account: w.account, finished: old.finished || finished, shown: old.shown || shown,
        items: finished ? visible : old.items, count: finished ? claimable.length : old.count,
      }));
  }, [w.account, owed, reading, s.loading, s.complete, working, error, w.progress]);
  if (!w.account)
    return <p className="claims-quiet">Connect the receiver wallet to read and claim its owed stocks.</p>;
  if (display.account !== w.account || !display.shown)
    return display.account === w.account && display.finished
      ? <p className="claims-quiet">Nothing is owed to this wallet.</p>
      : null;
  return (
    <section className="panel claims">
      <h2>Claim owed stocks</h2>
      <p>
        Claims belong to the connected wallet:{" "}
        {w.account ? (
          <Addr value={w.account} />
        ) : (
          "Connect wallet to read claims."
        )}
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
      {w.account &&
        !reading &&
        s.assets.some((a) => owed[a.token] === undefined) && (
          <button onClick={() => setRetry((x) => x + 1)}>Retry claims</button>
        )}
      {!w.account ? (
        <p>Connect the receiver wallet to read and claim its owed stocks.</p>
      ) : (
        <>
          <Receiver value={to} wallet={w} claim />
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
                    "claim-all",
                    `Claim batch ${Math.floor(i / 10) + 1} of ${Math.ceil(claimable.length / 10)}: ${claimable
                      .slice(i, i + 10)
                      .map((a) => a.symbol)
                      .join(", ")}`,
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
          <DisabledReason
            wallet={w}
            snapshot={s}
            reason={
              actionReason(w, s) ||
              (!s.complete
                ? "Owed balances unreadable. Retry vault."
                : working
                  ? "Claim batch pending. Wait for its receipt."
                  : reading
                    ? "Reading..."
                    : !claimable.length
                      ? visible.length
                        ? "Owed balances are unreadable. Retry claims above."
                        : "Nothing is owed to your connected wallet."
                      : "")
            }
          />
          <ActionStatus wallet={w} scope="claim-all" />
          <div className="claim-grid">
            {display.items.map((a) => (
              <div className="receipt" key={a.token}>
                <bdi>{a.symbol}</bdi>
                <p>
                  Still owed:{" "}
                  {reading ? "Reading..." : fmt(owed[a.token], a.tokenDecimals)}
                </p>
                <Receiver value={to} wallet={w} claim />
                <TxButton
                  snapshot={s}
                  wallet={w}
                  label={`Claim ${a.symbol}`}
                  scope={`Claim ${a.symbol} · ${a.token}`}
                  disabled={
                    working ||
                    owed[a.token] === undefined ||
                    owed[a.token] === 0n
                  }
                  disabledReason={
                    reading
                      ? "Reading... Wait for owed balances."
                      : owed[a.token] === undefined
                        ? "Owed balance unreadable. Retry claims above."
                        : "Nothing owed for this stock."
                  }
                  getSpec={() => vault("claim", [[a.token], recipient(to)])}
                />
              </div>
            ))}
          </div>
          {!s.assets.length && (
            <p>
              {s.loading
                ? "Reading..."
                : s.complete
                  ? "No listed stocks."
                  : "Listed stocks unreadable. Retry the vault."}
            </p>
          )}
          {display.count > 1 && (
            <p>
              Claim all collects up to 10 stocks per wallet prompt. If one stock can’t be paid, that batch stays owed: collect the others with their own Claim buttons.
            </p>
          )}
        </>
      )}
      {Object.keys(w.progress)
        .filter((key) => key.startsWith("Claim "))
        .map((key) => (
          <ActionStatus key={key} wallet={w} scope={key} />
        ))}
      <p role="alert" className="error">
        {error}
      </p>
    </section>
  );
}

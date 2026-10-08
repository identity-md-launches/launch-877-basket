import { useEffect, useState } from "react";
import { many, token, vault, VAULT } from "./chain";
import { date, fmt, type Snapshot } from "./model";
import {
  PageTitle,
  Empty,
  Note,
  TxButton,
  RoleInfo,
  ActionStatus,
} from "./components";
import type { Wallet } from "./wallet";
export function LossesPage({
  snapshot: s,
  wallet: w,
}: {
  snapshot: Snapshot;
  wallet: Wallet;
}) {
  const shorts = s.assets.filter((a) => a.short && a.balanceReadable);
  const [details, setDetails] = useState<
    Record<string, { shortfall?: bigint; amount?: bigint; flaggedAt?: bigint }>
  >({});
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let active = true;
    setDetails({});
    setLoading(true);
    many(
      shorts.flatMap((a) => [
        token(a.token, "balanceOf", [VAULT]),
        vault("deficits", [a.token]),
      ]),
    ).then((r) => {
      if (!active) return;
      const data: typeof details = {};
      shorts.forEach((a, i) => {
        const bal = r[i * 2],
          loss = r[i * 2 + 1];
        const available =
          bal.ok && a.totalOwed !== undefined
            ? bal.value > a.totalOwed
              ? bal.value - a.totalOwed
              : 0n
            : undefined;
        data[a.token] = {
          shortfall:
            available !== undefined && a.managed !== undefined
              ? a.managed > available
                ? a.managed - available
                : 0n
              : undefined,
          amount: loss.ok ? loss.value[0] : undefined,
          flaggedAt: loss.ok ? loss.value[1] : undefined,
        };
      });
      setDetails(data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [s.loadedAt]);
  return (
    <>
      <PageTitle eyebrow="Accounting health" title="Losses">
        Anyone can flag a shortfall and recognise a recorded loss after seven
        days. Retired stocks are included.
      </PageTitle>
      <Note>
        Recognition reduces managed funds by the smaller of the recorded and
        current shortfall. An increased flag starts a new seven-day wait.
      </Note>
      {!shorts.length && (
        <Empty
          title={
            s.loading
              ? "Reading..."
              : s.complete
                ? "No readable stock shortfalls"
                : "Stock shortfalls are unreadable"
          }
        >
          Shortfalls appear here when a readable stock balance is below the
          vault’s managed amount after reserving outstanding claims.
        </Empty>
      )}
      <div className="two-col">
        {shorts.map((a) => {
          const d = details[a.token];
          const ready =
            d?.flaggedAt !== undefined &&
            d?.amount !== undefined &&
            d.amount > 0n
              ? d.flaggedAt + 7n * 86400n
              : undefined;
          return (
            <article className="panel" key={a.token}>
              <div className="stock-top">
                <h2>
                  <bdi>{a.symbol}</bdi>
                </h2>
                <span className="badge">
                  {a.retired ? "Retired · short" : "Short"}
                </span>
              </div>
              <dl>
                <div>
                  <dt>Current shortfall</dt>
                  <dd>
                    {loading
                      ? "Reading..."
                      : fmt(d?.shortfall, a.tokenDecimals)}
                  </dd>
                </div>
                <div>
                  <dt>Recorded shortfall</dt>
                  <dd>
                    {loading ? "Reading..." : fmt(d?.amount, a.tokenDecimals)}
                  </dd>
                </div>
                <div>
                  <dt>Recognition available</dt>
                  <dd>
                    {loading
                      ? "Reading..."
                      : d?.amount === 0n
                        ? "Not flagged; seven days after flagging"
                        : date(ready)}
                  </dd>
                </div>
              </dl>
              <RoleInfo role="anyone" snapshot={s} />
              <div className="button-row">
                <TxButton
                  wallet={w}
                  snapshot={s}
                  label="Flag shortfall"
                  scope={`Loss flag: ${a.symbol} · ${a.token}`}
                  getSpec={() => vault("flagDeficit", [a.token])}
                />
                <TxButton
                  wallet={w}
                  snapshot={s}
                  label="Recognise loss"
                  scope={`Loss recognition: ${a.symbol} · ${a.token}`}
                  disabled={
                    ready === undefined ||
                    BigInt(Math.floor(Date.now() / 1000)) < ready
                  }
                  disabledReason={
                    loading
                      ? "Reading..."
                      : ready === undefined
                        ? "No readable flag yet. Flag the shortfall first, or retry vault if unreadable."
                        : `Wait until ${date(ready)} to recognise this loss.`
                  }
                  getSpec={() => vault("recognizeLoss", [a.token])}
                />
              </div>
            </article>
          );
        })}
      </div>
      {Object.keys(w.progress)
        .filter((key) => key.startsWith("Loss "))
        .map((key) => (
          <ActionStatus key={key} wallet={w} scope={key} />
        ))}
      {s.assets
        .filter((a) => !a.balanceReadable)
        .map((a) => (
          <p className="error" key={a.token}>
            <bdi>{a.symbol}</bdi>: shortfall unreadable. Refresh to retry.
          </p>
        ))}
    </>
  );
}

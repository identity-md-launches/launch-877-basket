import { useRef, useState, type ReactNode } from "react";
import type { Address } from "viem";
import { chain, explain, zeroAddress, type Spec } from "./chain";
import { same, type Snapshot } from "./model";
import type { Wallet } from "./wallet";
export function BasketIcon({ large = false }: { large?: boolean }) {
  return (
    <svg
      className={large ? "basket-art" : "basket-icon"}
      viewBox="0 0 80 72"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M9 28h62L63 62H17L9 28Z"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M23 28 35 8M57 28 45 8M28 39v12M40 39v12M52 39v12M6 28h68"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}
export function Addr({ value }: { value?: string }) {
  return value ? (
    <span className="address" dir="ltr">
      {value}
    </span>
  ) : (
    <span>unreadable</span>
  );
}
export function AddressLink({ value }: { value: Address }) {
  return (
    <a
      className="address"
      href={`${chain.blockExplorers.default.url}/address/${value}`}
      target="_blank"
      rel="noreferrer"
    >
      {value}
    </a>
  );
}
export function Note({
  children,
  warning = false,
}: {
  children: ReactNode;
  warning?: boolean;
}) {
  return <div className={warning ? "note warning" : "note"}>{children}</div>;
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty">
      <BasketIcon />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function PageTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="page-title">
      <p className="eyebrow">{eyebrow}</p>
      <h1 tabIndex={-1}>{title}</h1>
      <p>{children}</p>
    </div>
  );
}
export type Role = "owner" | "operator" | "pending" | "anyone";
export function RoleInfo({
  role,
  snapshot,
}: {
  role: Role;
  snapshot: Snapshot;
}) {
  const g = snapshot.globals;
  if (snapshot.loading) return <p className="role-info">Reading...</p>;
  return (
    <p className="role-info">
      {role === "anyone" ? (
        "Anyone may send this transaction."
      ) : (
        <>
          {role === "pending"
            ? "Allowed: pending owner"
            : role === "operator"
              ? "Allowed: owner or guardian"
              : "Allowed: owner"}
          <br />
          <Addr value={role === "pending" ? g.pendingOwner : g.owner} />
          {role === "operator" && (
            <>
              <br />
              <Addr value={g.guardian} />
            </>
          )}
        </>
      )}
    </p>
  );
}
export function permitted(role: Role, w: Wallet, s: Snapshot) {
  return (
    !!w.account &&
    w.chainId === 4663 &&
    (role === "anyone" ||
      (role === "owner" && same(w.account, s.globals.owner)) ||
      (role === "operator" &&
        (same(w.account, s.globals.owner) ||
          same(w.account, s.globals.guardian))) ||
      (role === "pending" &&
        s.globals.pendingOwner !== zeroAddress &&
        same(w.account, s.globals.pendingOwner)))
  );
}
export function ActionStatus({
  wallet,
  scope,
}: {
  wallet: Wallet;
  scope: string;
}) {
  const value = wallet.progress[scope];
  return (
    <div className="action-status" role="status" aria-live="polite">
      {value && (
        <>
          <p>{value.message}</p>
          {value.hash && (
            <a
              href={`${chain.blockExplorers.default.url}/tx/${value.hash}`}
              target="_blank"
              rel="noreferrer"
            >
              View submitted transaction
            </a>
          )}
          {value.detail && <p>{value.detail}</p>}
        </>
      )}
    </div>
  );
}
export function actionReason(w: Wallet, s: Snapshot, role: Role = "anyone") {
  if (!w.account) return "Connect your wallet to continue.";
  if (w.chainId !== 4663) return "Switch to Robinhood Chain to continue.";
  if (w.busy)
    return "Another transaction is pending. Finish it in your wallet or wait for its receipt.";
  if (s.loading) return "Reading... Wait for current vault data.";
  if (
    ((role === "owner" || role === "operator") && !s.globals.owner) ||
    (role === "pending" && !s.globals.pendingOwner)
  )
    return "Role data missing or unreadable. Retry vault.";
  if (!permitted(role, w, s))
    return "Not your role. Connect the allowed wallet shown above.";
  return "";
}
export function DisabledReason({
  reason,
  wallet,
  snapshot,
}: {
  reason?: string;
  wallet: Wallet;
  snapshot: Snapshot;
}) {
  return reason ? (
    <div className="disabled-reason">
      <p>{reason}</p>
      {!wallet.account ? (
        <button onClick={wallet.connect} disabled={wallet.connecting}>
          {wallet.connecting ? "Connecting..." : "Connect wallet"}
        </button>
      ) : wallet.chainId !== 4663 ? (
        <button onClick={wallet.switchChain}>Switch to Robinhood Chain</button>
      ) : /unreadable|data missing/i.test(reason) && snapshot.retry ? (
        <button onClick={snapshot.retry}>Retry vault</button>
      ) : null}
    </div>
  ) : null;
}
export function Receiver({
  value,
  wallet,
  claim = false,
}: {
  value: string;
  wallet: Wallet;
  claim?: boolean;
}) {
  return (
    <div className="receiver">
      <strong>
        Receiver ·{" "}
        {same(value, wallet.account)
          ? "your connected wallet"
          : "a different wallet"}
      </strong>
      <Addr value={value} />
      {!same(value, wallet.account) && (
        <p>
          {claim
            ? "Existing claims belong to your connected wallet. Any stocks still owed stay with that wallet."
            : "A different receiver must connect to claim any stocks still owed to it."}
        </p>
      )}
    </div>
  );
}
export function TxButton({
  label,
  getSpec,
  role = "anyone",
  wallet,
  snapshot,
  disabled = false,
  primary = false,
  disabledReason = "Data missing. Complete the fields or refresh the vault.",
  scope = label,
}: {
  label: string;
  getSpec: () => Spec | Promise<Spec>;
  role?: Role;
  wallet: Wallet;
  snapshot: Snapshot;
  disabled?: boolean;
  primary?: boolean;
  disabledReason?: string;
  scope?: string;
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const reason =
    actionReason(wallet, snapshot, role) ||
    (pending
      ? "Checking... Wait for this action."
      : disabled
        ? disabledReason
        : "");
  return (
    <div className="tx-control">
      <button
        type="button"
        className={primary ? "primary" : ""}
        disabled={!!reason}
        onClick={async () => {
          if (lock.current) return;
          lock.current = true;
          setError("");
          setPending(true);
          wallet.report(scope, { message: `${label}: Checking…` });
          try {
            await wallet.send(await getSpec(), scope, scope);
          } catch (e) {
            setError(explain(e));
            wallet.fail(scope, explain(e));
          } finally {
            setPending(false);
            lock.current = false;
          }
        }}
      >
        {pending ? `${label}…` : label}
      </button>
      <DisabledReason reason={reason} wallet={wallet} snapshot={snapshot} />
      <ActionStatus wallet={wallet} scope={scope} />
      <p role="alert" className="error">
        {error}
      </p>
    </div>
  );
}

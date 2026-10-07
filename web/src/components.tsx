import { useState, type ReactNode } from "react";
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
export function TxButton({
  label,
  getSpec,
  role = "anyone",
  wallet,
  snapshot,
  disabled = false,
  primary = false,
}: {
  label: string;
  getSpec: () => Spec | Promise<Spec>;
  role?: Role;
  wallet: Wallet;
  snapshot: Snapshot;
  disabled?: boolean;
  primary?: boolean;
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <div className="tx-control">
      <button
        type="button"
        className={primary ? "primary" : ""}
        disabled={
          disabled ||
          pending ||
          wallet.busy ||
          !permitted(role, wallet, snapshot)
        }
        onClick={async () => {
          setError("");
          setPending(true);
          try {
            await wallet.send(await getSpec());
          } catch (e) {
            setError(explain(e));
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? `${label}…` : label}
      </button>
      <p role="alert" className="error">
        {error}
      </p>
    </div>
  );
}

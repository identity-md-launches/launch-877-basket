import { useEffect, useState } from "react";
import { parseAbi, formatUnits, type Address } from "viem";
import { many } from "./chain";
import { ADDRESSES, ALLOCATIONS, ALLOCATION_HEADERS, ALLOCATION_ROWS, RELEASE_HEADERS, RELEASE_ROWS, PARAGRAPHS, T, gaugeReleased, developmentVested, outsideContracts, formatItem, SUPPLY_LABEL, RELEASE_LABEL, type Addresses } from "./tokenomicsData";

const colors = ["var(--royal)", "var(--sky)", "var(--sun)", "var(--red)", "var(--ink)", "#93aaca", "#dbe6f4"];
function Table({ headers, rows, kind }: { headers: readonly string[]; rows: readonly (readonly string[])[]; kind: string }) {
  return <table className={"tm-table " + kind}><thead><tr>{headers.map(h => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{r.map((cell, j) => j === 0 ? <th key={j} scope="row" data-label={headers[j]}>{cell}</th> : <td key={j} data-label={headers[j]}>{cell}</td>)}</tr>)}</tbody></table>;
}
function SupplyChart() {
  return <figure className="tm-chart tm-supply" aria-label="How the supply is divided"><svg viewBox="0 0 1000 48" preserveAspectRatio="none" role="img" aria-label={SUPPLY_LABEL}>{ALLOCATIONS.map((r, i) => <rect key={r.who} x={ALLOCATIONS.slice(0, i).reduce((n, a) => n + a.share, 0) * 10} y="0" width={r.share * 10} height="48" fill={colors[i]} stroke="var(--paper)" strokeWidth="2" />)}</svg><figcaption className="tm-supply-legend">{ALLOCATIONS.map((r, i) => <div key={r.who}><span className="tm-key" style={{ background: colors[i] }} /><span>{r.who}</span><strong>{r.share}%</strong></div>)}</figcaption></figure>;
}
function Curve({ width, height }: { width: number; height: number }) {
  const l = 44, r = 12, t = 12, b = 28, w = width - l - r, h = height - t - b;
  const x = (m: number) => l + m / 48 * w, y = (n: number) => t + h - n / 1e9 * h;
  // Both sides of the cliff are sampled: there is no gradual vesting in month 11.
  const samples = [...Array.from({ length: 12 }, (_, i) => i), 11.999999, ...Array.from({ length: 37 }, (_, i) => i + 12)];
  const line = (fn: (seconds: number) => number) => samples.map((m, i) => `${i ? "L" : "M"}${x(m).toFixed(3)},${y(fn(m / 48 * T)).toFixed(3)}`).join(" ");
  return <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={RELEASE_LABEL}>{[0, 250, 500, 750, 1000].map(n => <g key={n}><line x1={l} x2={width - r} y1={y(n * 1e6)} y2={y(n * 1e6)} stroke="var(--line)" strokeOpacity=".4" /><text x={l - 8} y={y(n * 1e6) + 4} textAnchor="end">{formatItem(n)}</text></g>)}{[0, 12, 24, 36, 48].map(m => <text key={m} x={x(m)} y={height - 6} textAnchor={m === 48 ? "end" : "middle"}>{m}</text>)}<path d={`${line(outsideContracts)} L${x(48)},${y(0)} L${x(0)},${y(0)} Z`} fill="var(--royal)" fillOpacity=".05" /><path d={line(outsideContracts)} fill="none" stroke="var(--royal)" strokeWidth="3" /><path d={line(gaugeReleased)} fill="none" stroke="var(--ink)" strokeWidth="2.5" strokeDasharray="7 4" /><path d={line(developmentVested)} fill="none" stroke="var(--red)" strokeWidth="2.5" />{[12, 24, 36, 48].map(m => <circle key={m} cx={x(m)} cy={y(outsideContracts(m / 48 * T))} r="3.5" fill="var(--royal)" />)}</svg>;
}
function ReleaseChart() {
  return <figure className="tm-chart tm-release"><figcaption>Released over four years</figcaption><div className="tm-unit">Million ITEM</div><div className="tm-plot-wide"><Curve width={1000} height={310} /></div><div className="tm-plot-phone"><Curve width={248} height={228} /></div><div className="tm-x-label">Months after launch</div><div className="tm-series"><span><i className="tm-line outside" />Outside the contracts, at most</span><span><i className="tm-line liquidity" />Liquidity rewards released</span><span><i className="tm-line vested" />Development vested</span></div></figure>;
}
const liveAbi = parseAbi(["function totalSupply() view returns (uint256)", "function released() view returns (uint256)", "function remaining() view returns (uint256)", "function totalStaked() view returns (uint256)", "function vested() view returns (uint256)"]);
export const hasAddresses = (addresses: Addresses): addresses is Record<keyof Addresses, Address> => Object.values(addresses).every(value => value !== null);
export async function readLiveFigures(addresses: Addresses, reader: typeof many = many) {
  if (!hasAddresses(addresses)) return null;
  const views = [[addresses.ITEM, "totalSupply"], [addresses.BASK_USDG_GAUGE, "released"], [addresses.BASK_USDG_GAUGE, "remaining"], [addresses.BASK_USDG_GAUGE, "totalStaked"], [addresses.ITEM_ETH_GAUGE, "released"], [addresses.ITEM_ETH_GAUGE, "remaining"], [addresses.ITEM_ETH_GAUGE, "totalStaked"], [addresses.DEV_VESTING, "vested"], [addresses.DEV_VESTING, "released"], [addresses.ITEM_STAKING, "totalStaked"]] as const;
  const results = await reader(views.map(([address, functionName]) => ({ address, abi: liveAbi, functionName })));
  return results.map(result => {
    if (!result.ok || typeof result.value !== "bigint") throw new Error("Live figures unreadable.");
    return result.value;
  });
}
const liveLabels = ["ITEM supply", "BASK/USDG gauge: released", "remaining", "LP staked", "ITEM/ETH gauge: released", "remaining", "LP staked", "Development vesting: vested", "released", "ITEM staking: ITEM staked"];
const addressLabels = ["ITEM", "ITEM staking", "BASK/USDG gauge", "ITEM/ETH gauge", "Development vesting"];
export function formatLive(value: bigint, lp = false) {
  if (!lp) return (value / 10n ** 18n).toLocaleString("en-US");
  const [whole, fraction = ""] = formatUnits(value, 18).split(".");
  const decimals = fraction.slice(0, 6).replace(/0+$/, "");
  return BigInt(whole).toLocaleString("en-US") + (decimals ? "." + decimals : "");
}
export function LiveFigures({ addresses = ADDRESSES, reader = many }: { addresses?: Addresses; reader?: typeof many }) {
  const [values, setValues] = useState<readonly bigint[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!hasAddresses(addresses)) return;
    let active = true;
    setValues(null); setFailed(false);
    readLiveFigures(addresses, reader).then(result => { if (active) setValues(result); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [addresses, reader, attempt]);
  if (!hasAddresses(addresses)) return null;
  return <section className="tm-live"><h3>Live figures</h3>{failed ? <><p>Live figures unreadable.</p><button type="button" onClick={() => setAttempt(n => n + 1)}>Retry</button></> : values && <><dl>{values.map((value, i) => <div key={i}><dt>{liveLabels[i]}</dt><dd>{formatLive(value, i === 3 || i === 6)}</dd></div>)}</dl><h3>Addresses</h3><div className="tm-addresses">{Object.values(addresses).map((address, i) => <div key={address}><span>{addressLabels[i]} </span><a href={`https://robin.etherscan.io/address/${address}`} target="_blank" rel="noreferrer">{address}</a></div>)}</div></>}</section>;
}
function Prose({ index }: { index: number }) {
  const text = PARAGRAPHS[index];
  const split = text.indexOf(".") + 1;
  return <p><strong>{text.slice(0, split)}</strong>{text.slice(split)}</p>;
}
export function Tokenomics() {
  return <section id="tokenomics" className="panel tm-module"><h2>Tokenomics</h2><p>{PARAGRAPHS[0]}</p><p>{PARAGRAPHS[1]}</p><SupplyChart /><Table headers={ALLOCATION_HEADERS} rows={ALLOCATION_ROWS} kind="tm-allocations" /><Prose index={2} /><ReleaseChart /><Table headers={RELEASE_HEADERS} rows={RELEASE_ROWS} kind="tm-releases" /><p>{PARAGRAPHS[3]}</p><Prose index={4} /><Prose index={5} /><LiveFigures /></section>;
}

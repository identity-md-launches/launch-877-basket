import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { readStatsReport, renderStatsReport, type StatsPeriod, type StatsReport } from "./vaultStatsReport";

const endpoint = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_VAULT_STATS_URL || "https://monitor-production-2eae.up.railway.app/api/vault-stats";
export function VaultViews({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  function move(event: KeyboardEvent<HTMLButtonElement>) {
    const next = event.key === "Home" ? 0 : event.key === "End" ? 1 : event.key === "ArrowRight" || event.key === "ArrowLeft" ? 1 - tab : undefined;
    if (next === undefined) return;
    event.preventDefault();
    setTab(next);
    buttons.current[next]?.focus();
  }
  return <>
    <div className="docs-tabs vault-view-tabs" role="tablist" aria-label="Vault view">
      {["Overview", "Stats"].map((label, index) => <button key={label} ref={node => { buttons.current[index] = node; }} type="button" role="tab" id={"vault-view-tab-" + index} aria-controls={"vault-view-panel-" + index} aria-selected={tab === index} tabIndex={tab === index ? 0 : -1} onClick={() => setTab(index)} onKeyDown={move}>{label}</button>)}
    </div>
    <div id="vault-view-panel-0" role="tabpanel" aria-labelledby="vault-view-tab-0" hidden={tab !== 0}>{children}</div>
    <div id="vault-view-panel-1" role="tabpanel" aria-labelledby="vault-view-tab-1" hidden={tab !== 1}>{tab === 1 && <VaultStatsPage />}</div>
  </>;
}

export function VaultStatsPage() {
  const [period, setPeriod] = useState<StatsPeriod>("all");
  const [report, setReport] = useState<StatsReport>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  useEffect(() => {
    const request = ++generation.current;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    setLoading(true); setError("");
    const url = new URL(endpoint); url.searchParams.set("period", period);
    void fetch(url, { signal: controller.signal, credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer" })
      .then(async response => {
        if (!response.ok) throw new Error("Stats unavailable");
        if (Number(response.headers.get("content-length") || 0) > 2_097_152) throw new Error("Stats too large"); // 2026-10-20 review: the adapter's own 2 MiB envelope bound, applied before the body is read.
        const result = readStatsReport(await response.json(), period);
        if (generation.current === request) setReport(result);
      })
      .catch(() => { if (generation.current === request) { setReport(undefined); setError("Vault stats are unavailable right now. Please try again."); } })
      .finally(() => { clearTimeout(timeout); if (generation.current === request) setLoading(false); });
    return () => { ++generation.current; clearTimeout(timeout); controller.abort(); };
  }, [period, attempt]);
  const choosePeriod = useCallback((next: StatsPeriod) => setPeriod(next), []);
  const content = useMemo(() => {
    if (!report) return null;
    try { return renderStatsReport(report.html, choosePeriod); }
    catch { return <div className="note warning" role="alert">Vault stats could not be displayed. Please try again.</div>; } // 2026-10-20 review: never unmount the page over a bad report.
  }, [report, choosePeriod]);
  return <div className="basket-vault-stats">
    <p className="vault-stats-intro">The vault holds tokens linked to stock prices. BASK represents a share of that basket.</p>
    <div className="vault-stats-toolbar">
      <span role="status">{loading ? "Reading vault stats…" : report ? (report.preview ? "Preview · captured monitor readings" : "Report updated " + new Date(report.generatedAt).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " New York") : "Stats connection unavailable"}</span>
      <button disabled={loading} onClick={() => setAttempt(v => v + 1)}>{loading ? "Reading…" : error ? "Retry stats" : "Refresh stats"} <span aria-hidden="true">↻</span></button>
    </div>
    {report?.preview && <p className="note">Design preview using captured readings from the reference monitor. These figures are not live.</p>}
    {error && <div className="note warning" role="alert">{error}</div>}
    <div aria-busy={loading}>{content || (loading ? <div className="vault-stats-loading"><p>Reading BASK value, holdings and history…</p></div> : null)}</div>
  </div>;
}

import { createElement, type ReactNode } from "react";

export const statsPeriods = ["1d", "7d", "30d", "all"] as const;
export type StatsPeriod = (typeof statsPeriods)[number];
export type StatsReport = { schemaVersion: 1; period: StatsPeriod; generatedAt: string; html: string; preview?: boolean };

export function readStatsReport(value: unknown, period: StatsPeriod): StatsReport {
  if (!value || typeof value !== "object") throw new Error("Invalid stats response");
  const v = value as Partial<StatsReport>;
  if (v.schemaVersion !== 1 || v.period !== period || typeof v.generatedAt !== "string" ||
      !Number.isFinite(Date.parse(v.generatedAt)) || typeof v.html !== "string" || v.html.length > 1_000_000 ||
      !v.html.includes('class="vault-page"')) throw new Error("Invalid stats response");
  const doc = new DOMParser().parseFromString(v.html, "text/html");
  // 2026-10-20 review: a bounded node count keeps a hostile report from exhausting the renderer below.
  if (!doc.querySelector("div.vault-page") || doc.querySelectorAll("*").length > 50_000) throw new Error("Invalid stats report");
  return { schemaVersion: 1, period, generatedAt: v.generatedAt, html: v.html, preview: v.preview === true };
}

// Reconstruct an inert report as React elements. Never insert remotely supplied HTML.
// The server owns the exact integer arithmetic; this adapter accepts only presentation.
const tags = new Set("div section aside p h2 h3 dl dt dd nav a svg line text polyline circle title span strong ul li small meter figure figcaption details summary table thead tr th tbody td ol br".split(" "));
const attrs = new Set("class id role aria-label aria-labelledby aria-current scope viewBox x y x1 x2 y1 y2 cx cy r points text-anchor min max value".split(" "));
const names: Record<string, string> = { class: "className", "text-anchor": "textAnchor" };
export function renderStatsReport(html: string, choosePeriod: (period: StatsPeriod) => void): ReactNode {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const root = doc.querySelector(".vault-page");
  if (!root) throw new Error("Missing stats report");
  // 2026-10-20 review: <title> is kept only inside SVG (React 19 would hoist a stray one into the document head),
  // and children are passed as one keyed array, never spread, so a wide element cannot overflow the call.
  const render = (node: Node, key: string, inSvg = false): ReactNode => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    const el = node as Element, tag = el.tagName.toLowerCase();
    if (!tags.has(tag) || el.classList.contains("vault-intro") || (tag === "title" && !inSvg)) return null;
    const props: Record<string, unknown> = { key };
    for (const a of Array.from(el.attributes)) {
      if (!attrs.has(a.name)) continue;
      if (a.name === "id") props.id = "stats-" + a.value;
      else if (a.name === "aria-labelledby") props[a.name] = a.value.split(/\s+/).map(v => "stats-" + v).join(" ");
      else if (a.name === "class") props.className = a.value.split(/\s+/).filter(v => /^(vault-[a-z-]+|card|section|section-head|small|muted|below|above|replay|sample|deposit|redemption)$/.test(v)).join(" ");
      else props[names[a.name] || a.name] = a.value;
    }
    if (tag === "svg") { props.viewBox = el.getAttribute("viewBox") || "0 0 760 240"; props.role = "img"; }
    if (tag === "a") {
      const href = el.getAttribute("href") || "";
      const period = /^\/vault\?period=(1d|7d|30d|all)$/.exec(href)?.[1] as StatsPeriod | undefined;
      if (period) { props.href = "#vault"; props.onClick = (event: { preventDefault: () => void }) => { event.preventDefault(); choosePeriod(period); }; }
      else if (/^https:\/\/robin\.etherscan\.io\/tx\/0x[0-9a-fA-F]{64}$/.test(href)) {
        props.href = href; props.target = "_blank"; props.rel = "noopener noreferrer";
      } else return createElement("span", { key }, el.textContent);
    }
    if (tag === "br") return createElement(tag, props);
    return createElement(tag, props, Array.from(el.childNodes).map((child, i) => render(child, key + "." + i, inSvg || tag === "svg")));
  };
  return render(root, "report");
}

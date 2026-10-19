import type { Address } from "viem";
import { AddressLink, PageTitle } from "./components";
import type { Snapshot } from "./model";
import { CONTRACT_KEYS, KNOWN, LAUNCH, itemReady } from "./itemConstants";
import { contractLabels } from "./FindItem";

export function TransparencyPage({ snapshot }: { snapshot: Snapshot }) {
  const address = (value: Address) => <AddressLink value={value} />;
  const role = (key: "owner" | "guardian") => snapshot.loading ? "Reading..." : snapshot.globals[key] ? address(snapshot.globals[key]) : "unreadable";
  return <>
    <PageTitle eyebrow="Open books" title="Transparency" character={{ kind: "transparency", src: "art/character/transparency.webp", width: 400, height: 1000, alt: "Store worker looking at you through a magnifying glass", line: "go ahead and take a closer look" }}>Contract addresses, protocol roles and source code.</PageTitle>
    {itemReady(LAUNCH) && <section className="panel item-source">
      <h2>Contracts and source</h2>
      {CONTRACT_KEYS.map((key, i) => <p key={key}>{contractLabels[i]}: {address(LAUNCH[key]!)}</p>)}
      <p>BASK/USDG pool: {address(KNOWN.BASK_USDG_PAIR)}</p>
      <p>ITEM/ETH pool: {address(LAUNCH.ITEM_WETH_PAIR)}</p>
      <p data-role="dev">Developer: {address(KNOWN.DEV)}</p>
      <p data-role="owner">Vault owner: {role("owner")}</p>
      <p data-role="guardian">Vault guardian: {role("guardian")}</p>
      <p>Source code: <a href={LAUNCH.ITEM_REPO} target="_blank" rel="noreferrer">{LAUNCH.ITEM_REPO}</a> at commit {LAUNCH.ITEM_COMMIT.slice(0, 7)}</p>
    </section>}
  </>;
}

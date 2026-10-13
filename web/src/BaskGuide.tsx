import { INTRO, SECTIONS, type Block, type Example } from "./baskGuideData";
function Blocks({ blocks }: { blocks: Block[] }) {
  return <>{blocks.map((block, index) => block.kind === "table" ? <table key={index} className="bg-table"><thead><tr>{block.headers.map(h => <th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{block.rows.map((row, r) => <tr key={r}>{row.map((cell, c) => c === 0 ? <th scope="row" key={c}>{cell}</th> : <td key={c} data-label={block.headers[c]}>{cell}</td>)}</tr>)}</tbody></table> : block.kind === "formula" ? <div className="bg-formula" key={index}>{block.text}</div> : <p key={index}>{block.text}</p>)}</>;
}
function WorkedExample({ example }: { example: Example }) {
  return <article className="bg-example"><h4>{example.title}</h4><Blocks blocks={example.blocks} /></article>;
}
export function BaskGuide() {
  return <section className="panel bg-module" aria-labelledby="bask-guide-heading"><h2 id="bask-guide-heading">BASK</h2><p className="bg-intro">{INTRO}</p>{SECTIONS.map(section => <section className="bg-section" key={section.title}><h3>{section.title}</h3><Blocks blocks={section.blocks} />{section.examples.length > 0 && <div className={section.title === "Minting BASK" ? "bg-examples bg-deposits" : "bg-examples"}>{section.examples.map(example => <WorkedExample key={example.title} example={example} />)}</div>}</section>)}</section>;
}

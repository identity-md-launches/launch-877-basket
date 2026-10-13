import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { build } from 'esbuild';
const root=process.env.BASKET_SOURCE_ROOT||path.resolve('..');
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'});
const baseline=p=>git(['show','HEAD:'+p]);
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const sha256=s=>createHash('sha256').update(s).digest('hex');
// v12 on HEAD=v11: the approved presentation changes, mined-receipt hash and connection intent guard.
// Transactions and all chain reads remain HEAD's. main keeps Claims mounted by owner-approved Activity.
const protectedFiles=[
 "Losses.tsx",
 "Owner.tsx",
 "Scenery.tsx",
 "chain.ts",
 "deployment.ts",
 "governance.ts",
 "model.ts",
 "newYork.ts",
 "poolMath.ts",
 "vault.abi.json"
];
for(const f of protectedFiles) assert.equal(read('web/src/'+f),baseline('web/src/'+f),f);
// The v12 files: byte-identical to HEAD once their documented pieces [v12, HEAD] are put back (each exactly once), so
// every word, call and attribute in them is pinned. The list between the two marker lines was generated from the
// difference to HEAD; the pins further down do not depend on it: they compare with HEAD itself or with texts written
// out in this file, so a piece cannot carry a change to a transaction, a wallet request or a chain read past them.
// >>> v12 pieces (generated from the difference to HEAD, not edited by hand)
const editedFiles={
 "Vault.tsx": [
  [
   "  return now;\n}\n// Owner-approved display: no reads, requests or transaction state.\nconst DEPOSIT_LETTERS: Record<string, string[]> = {\n  O: [\"01110\", \"10001\", \"10001\", \"10001\", \"10001\", \"10001\", \"01110\"],\n  E: [\"11111\", \"10000\", \"10000\", \"11110\", \"10000\", \"10000\", \"11111\"],\n  C: [\"01111\", \"10000\", \"10000\", \"10000\", \"10000\", \"10000\", \"01111\"],\n  L: [\"10000\", \"10000\", \"10000\", \"10000\", \"10000\", \"10000\", \"11111\"],\n  S: [\"01111\", \"10000\", \"10000\", \"01110\", \"00001\", \"00001\", \"11110\"],\n  D: [\"11110\", \"10001\", \"10001\", \"10001\", \"10001\", \"10001\", \"11110\"],\n};\n\nfunction DepositLedSign() {\n  const label = \"Closed\";\n  const word = label.toUpperCase();\n  const step = 4.8;\n  const start = (220 - ((word.length * 6 - 2) * step)) / 2;\n  return (\n    <svg className=\"deposit-led-sign\" viewBox=\"0 0 220 80\" width=\"220\" height=\"80\" role=\"img\" aria-label={label}>\n      <rect x=\"1\" y=\"1\" width=\"218\" height=\"78\" rx=\"14\" fill=\"#080b14\" stroke=\"#263144\" strokeWidth=\"2\" />\n      <rect className=\"deposit-led-border\" x=\"9\" y=\"9\" width=\"202\" height=\"62\" rx=\"9\" />\n      <rect className=\"deposit-led-chase\" x=\"9\" y=\"9\" width=\"202\" height=\"62\" rx=\"9\" />\n      <g className=\"deposit-led-letters\">\n        {[...word].flatMap((letter, index) => DEPOSIT_LETTERS[letter].flatMap((row, y) => [...row].map((on, x) => (\n          <circle key={`${index}-${y}-${x}`} cx={start + (index * 6 + x) * step} cy={25.6 + y * step} r=\"1.7\" fill={on === \"1\" ? \"#ff373d\" : \"#3e111c\"} />\n        ))))}\n      </g>\n    </svg>\n  );\n}\n\nexport function DepositState({ snapshot: s, showSign = false }: { snapshot: Snapshot; showSign?: boolean }) {\n  const r = s.status;\n  const reason = r?.ok && !s.loading ? Number(r.value[0]) : undefined;\n",
   "  return now;\n}\nexport function DepositState({ snapshot: s }: { snapshot: Snapshot }) {\n  const r = s.status;\n  const reason = r?.ok && !s.loading ? Number(r.value[0]) : undefined;\n"
  ],
  [
   "      ? closedWords(reason, s.globals.settings, s.blockTime, now)\n      : undefined;\n  // The owner wants a notice only for closed deposits or an unreadable status.\n  const statusUnreadable =\n    !s.complete || !r?.ok || s.globals.genesisFinalized === undefined;\n  const operational =\n    !statusUnreadable && reason === 0 && s.globals.genesisFinalized === true &&\n    s.assets.some((a) => a.open && !a.retired);\n  if (s.loading || operational || closed === mayBeOpen) return null;\n  const issueReason = s.globals.genesisFinalized === false ? 1\n    : !s.assets.length ? 4\n      : s.assets.every((a) => !a.open || a.retired) ? 5\n        : reason === 13 ? 9 : reason;\n  const issue = reasonWords(issueReason, s.globals.settings).split(\" (\")[0];\n  const weekendHours = reason === 3 &&\n    s.globals.settings?.hoursFrom === 72000n && s.globals.settings?.hoursTo === 504000n;\n  return (\n    <div className={showSign ? \"deposit-state deposit-notice\" : \"deposit-state\"}>\n      {statusUnreadable ? (\n        <>\n          {!showSign && <strong>Vault status:</strong>}\n          <p>unreadable — Retry vault</p>\n          <button onClick={s.retry}>Retry vault</button>\n        </>\n      ) : showSign ? (\n        <>\n          <DepositLedSign />\n          <p>{weekendHours\n            ? \"Deposits reopen when the stock feed prices update around 8pm on Sundays.\"\n            : `Deposits will be back open when “${issue}” is resolved.`}</p>\n        </>\n      ) : (\n        <><strong>Vault status:</strong><p>Closed</p></>\n      )}\n    </div>\n",
   "      ? closedWords(reason, s.globals.settings, s.blockTime, now)\n      : undefined;\n  return (\n    <div className=\"deposit-state\">\n      <strong>Vault deposit status</strong>\n      <p>\n        {s.loading\n          ? \"Reading...\"\n          : !s.assets.length &&\n              s.complete &&\n              s.globals.genesisFinalized === false\n            ? \"No Stock Tokens are listed yet. Deposits start after the owner finishes setup.\"\n            : s.assets.length > 0 &&\n                s.assets.every((a) => !a.open || a.retired) &&\n                s.globals.genesisFinalized\n              ? \"Every stock is closed. The owner must reopen a stock before deposits.\"\n              : !r || !r.ok\n                ? \"unreadable — Retry vault\"\n                : reasonWords(Number(r.value[0]), s.globals.settings)}\n      </p>\n      {r?.ok && r.value[1] !== zeroAddress && (\n        <p>\n          Stock at fault:{\" \"}\n          {s.assets.find(\n            (a) => a.token.toLowerCase() === r.value[1].toLowerCase(),\n          )?.symbol ?? r.value[1]}\n        </p>\n      )}\n      {closed && <p className=\"reopen\">{closed}</p>}\n      <p>Hours: {s.loading ? \"Reading...\" : hoursLine(s.globals.settings)}</p>\n      {!s.loading && (!r || !r.ok) && (\n        <button onClick={s.retry}>Retry vault</button>\n      )}\n    </div>\n"
  ],
  [
   "    <>\n      <PageTitle\n        title=\"Always in stock\"\n        character={{\n          kind: \"vault\",\n",
   "    <>\n      <PageTitle\n        title=\"A basket of stocks.\"\n        character={{\n          kind: \"vault\",\n"
  ],
  [
   "          line: \"I was hoping you would come through my aisle\",\n        }}\n      />\n      <section className=\"panel\">\n        <div className=\"section-heading\">\n",
   "          line: \"I was hoping you would come through my aisle\",\n        }}\n      >\n        Meet Basket (BASK): your share of the Stock Tokens in this vault.\n      </PageTitle>\n      <section className=\"panel\">\n        <div className=\"section-heading\">\n"
  ],
  [
   "          </div>\n          <div>\n            <span>Maximum Basket Capacity<small>(eligible to be raised)</small></span>\n            <strong>{s.loading ? \"Reading...\" : usd(s.globals.NAV_CAP)}</strong>\n          </div>\n",
   "          </div>\n          <div>\n            <span>Size limit</span>\n            <strong>{s.loading ? \"Reading...\" : usd(s.globals.NAV_CAP)}</strong>\n          </div>\n"
  ],
  [
   "        )}\n        <div className=\"two-col\">\n          <div className=\"deposit-summary\">\n            <DepositState snapshot={s} />\n          </div>\n          <div>\n            <strong>Fees</strong>\n",
   "        )}\n        <div className=\"two-col\">\n          <DepositState snapshot={s} />\n          <div>\n            <strong>Fees</strong>\n"
  ]
 ],
 "components.tsx": [
  [
   "  eyebrow?: string;\n  title: string;\n  children?: ReactNode;\n  character?: {\n    kind: \"vault\" | \"deposit\" | \"redeem\";\n",
   "  eyebrow?: string;\n  title: string;\n  children: ReactNode;\n  character?: {\n    kind: \"vault\" | \"deposit\" | \"redeem\";\n"
  ],
  [
   "      {eyebrow && <p className=\"eyebrow\">{eyebrow}</p>}\n      <h1 tabIndex={-1}>{title}</h1>\n      {children != null && <p>{children}</p>}\n      {character && (\n        <div className=\"title-character\">\n",
   "      {eyebrow && <p className=\"eyebrow\">{eyebrow}</p>}\n      <h1 tabIndex={-1}>{title}</h1>\n      <p>{children}</p>\n      {character && (\n        <div className=\"title-character\">\n"
  ]
 ],
 "Docs.tsx": [
  [
   "            vault.\n          </p>\n          <p>\n            The basket has no set weights. Any listed stock can be deposited, in any amount, as long as the vault’s checks pass and the vault stays under its size limit. So the mix is whatever holders have put in, and it changes with every deposit and redemption.\n          </p>\n          <p>\n            BASK’s backing moves with every stock in the vault, so its market price can drift from the value behind it. Traders close that gap: they deposit stocks and sell BASK when it trades high, or buy BASK and redeem when it trades low. That keeps BASK near its backing.\n          </p>\n          <p>\n            The 0.5% fee on each deposit and redemption is set to go to ITEM staking once ITEM is live, so more trading through the vault means more fees for ITEM.\n          </p>\n          <p>\n            ITEM is not live yet. Its address will be listed here when it is.\n          </p>\n        </section>\n        <section className=\"panel\">\n",
   "            vault.\n          </p>\n        </section>\n        <section className=\"panel\">\n"
  ]
 ],
 "Flows.tsx": [
  [
   "  Receiver,\n} from \"./components\";\nimport { DepositState } from \"./Vault\";\nimport type { Wallet } from \"./wallet\";\ntype Props = { snapshot: Snapshot; wallet: Wallet };\n",
   "  Receiver,\n} from \"./components\";\nimport { DepositState, hoursLine } from \"./Vault\";\nimport type { Wallet } from \"./wallet\";\ntype Props = { snapshot: Snapshot; wallet: Wallet };\n"
  ],
  [
   "  // From the last finished vault read, kept while a new read runs so the form\n  // does not jump; undefined before the first read or when unreadable.\n  // Dollar value of n units at the feed price of the last vault read, 18\n  // decimals; undefined when that price is unreadable.\n",
   "  // From the last finished vault read, kept while a new read runs so the form\n  // does not jump; undefined before the first read or when unreadable.\n  const r = s.status;\n  const reason = r?.ok ? Number(r.value[0]) : undefined;\n  // Dollar value of n units at the feed price of the last vault read, 18\n  // decimals; undefined when that price is unreadable.\n"
  ],
  [
   "        <section className=\"panel\">\n          <HoursTag />\n          <DepositState snapshot={s} showSign />\n          <p className=\"flow-steps\">\n            Choose amounts, preview, approve each stock, press Deposit.\n",
   "        <section className=\"panel\">\n          <HoursTag />\n          {/* One line while the vault takes deposits; otherwise, and while the\n              status is unread or unreadable, the full box with its reason. */}\n          {reason === 0 && open.length > 0 ? (\n            <p className=\"deposit-open\">\n              <strong>Deposits are open.</strong> Hours:{\" \"}\n              {hoursLine(s.globals.settings)}\n            </p>\n          ) : (\n            <DepositState snapshot={s} />\n          )}\n          <p className=\"flow-steps\">\n            Choose amounts, preview, approve each stock, press Deposit.\n"
  ],
  [
   "                  <>\n                    {!ready && <p>Reading your wallet...</p>}\n                    {unread ? (\n                      <p>\n",
   "                  <>\n                    {!ready && <p>Reading your wallet...</p>}\n                    <p className=\"wallet-line\">\n                      Showing {w.account.slice(0, 6)}…{w.account.slice(-4)}. To\n                      use another wallet, switch the address in your wallet app:\n                      this page follows it.\n                    </p>\n                    {unread ? (\n                      <p>\n"
  ],
  [
   "            subtracts this lock and any fee.\n          </p>\n          <p>\n            You approve each stock for exactly the amount you deposit. Each approval is its own wallet prompt; the deposit prompt comes last.\n          </p>\n          <p>\n            A prepared deposit must be sent within ten minutes. The BASK goes to your connected wallet.\n          </p>\n          <Note warning>\n            Feeds lag the market. Issuer restrictions and pool checks can stop\n",
   "            subtracts this lock and any fee.\n          </p>\n          <details>\n            <summary>Transaction details</summary>\n            <p>\n              Each short allowance is set to exactly that stock’s amount.\n              Approvals are separate wallet prompts; the deposit follows after\n              simulation.\n            </p>\n            <p>\n              The deadline is ten minutes from preparation. Your wallet receives\n              the BASK.\n            </p>\n          </details>\n          <Note warning>\n            Feeds lag the market. Issuer restrictions and pool checks can stop\n"
  ],
  [
   "        Receive your share of every stock.\n      </PageTitle>\n      <div className=\"flow-layout one-column\">\n        <section className=\"panel\">\n          <HoursTag />\n",
   "        Receive your share of every stock.\n      </PageTitle>\n      <div className=\"flow-layout\">\n        <section className=\"panel\">\n          <HoursTag />\n"
  ],
  [
   "          </p>\n        </section>\n      </div>\n    </>\n",
   "          </p>\n        </section>\n        <aside className=\"panel\">\n          <h2>Take your basket home</h2>\n          <details>\n            <summary>Transaction details</summary>\n            <p>\n              Minimum amounts are 0.1% below a fresh preview taken just before\n              sending, with zero kept as zero. They follow assetTokens order.\n            </p>\n            <p>\n              Removal of an empty retired stock can change that order before\n              execution. Minimums protect entitlements, not immediate payment.\n            </p>\n            <p>Deposit, redemption and claim gas is estimated, then increased by 30%.</p>\n          </details>\n        </aside>\n      </div>\n    </>\n"
  ],
  [
   "    (a) => owed[a.token] !== undefined && owed[a.token]! > 0n,\n  );\n  const visible = [\n    ...claimable,\n    ...s.assets.filter((a) => owed[a.token] === undefined),\n  ];\n  // Presentation only: keep the last finished visibility through refreshes.\n  // Capture old account values so neither its owed result nor its status can\n  // reveal the new account's panel before that account's first read finishes.\n  const visit = useRef({ account: w.account, initialOwed: owed, progress: w.progress, error });\n  const readStart = useRef(owed);\n  useLayoutEffect(() => {\n    readStart.current = owed;\n  }, [w.account, s.loadedAt, retry]);\n  const [display, setDisplay] = useState({ account: w.account, finished: false, shown: false, items: [] as Asset[], count: 0 });\n  useLayoutEffect(() => {\n    if (visit.current.account !== w.account) {\n      visit.current = { account: w.account, initialOwed: owed, progress: w.progress, error };\n      setDisplay({ account: w.account, finished: false, shown: false, items: [], count: 0 });\n      return;\n    }\n    if (!w.account) return;\n    const finished = !reading && !s.loading && owed !== readStart.current;\n    const status = Object.keys(w.progress).some(\n      (key) => (key === \"claim-all\" || key.startsWith(\"Claim \")) &&\n        w.progress[key] !== visit.current.progress[key],\n    );\n    const shown = working || (error !== \"\" && error !== visit.current.error) || status ||\n      (finished && (!s.complete || visible.length > 0));\n    if (finished || shown)\n      setDisplay((old) => ({\n        account: w.account, finished: old.finished || finished, shown: old.shown || shown,\n        items: finished ? visible : old.items, count: finished ? claimable.length : old.count,\n      }));\n  }, [w.account, owed, reading, s.loading, s.complete, working, error, w.progress]);\n  if (!w.account)\n    return <p className=\"claims-quiet\">Connect the receiver wallet to read and claim its owed stocks.</p>;\n  if (display.account !== w.account || !display.shown)\n    return display.account === w.account && display.finished\n      ? <p className=\"claims-quiet\">Nothing is owed to this wallet.</p>\n      : null;\n  return (\n    <section className=\"panel claims\">\n",
   "    (a) => owed[a.token] !== undefined && owed[a.token]! > 0n,\n  );\n  const zeros = s.assets.filter((a) => owed[a.token] === 0n);\n  const visible = [\n    ...claimable,\n    ...s.assets.filter((a) => owed[a.token] === undefined),\n  ];\n  return (\n    <section className=\"panel claims\">\n"
  ],
  [
   "          <ActionStatus wallet={w} scope=\"claim-all\" />\n          <div className=\"claim-grid\">\n            {display.items.map((a) => (\n              <div className=\"receipt\" key={a.token}>\n                <bdi>{a.symbol}</bdi>\n",
   "          <ActionStatus wallet={w} scope=\"claim-all\" />\n          <div className=\"claim-grid\">\n            {visible.map((a) => (\n              <div className=\"receipt\" key={a.token}>\n                <bdi>{a.symbol}</bdi>\n"
  ],
  [
   "            ))}\n          </div>\n          {!s.assets.length && (\n            <p>\n",
   "            ))}\n          </div>\n          {zeros.length > 0 && (\n            <details>\n              <summary>Nothing owed for {zeros.length} other stocks</summary>\n              <p>{zeros.map((a) => a.symbol).join(\", \")}</p>\n            </details>\n          )}\n          {!s.assets.length && (\n            <p>\n"
  ],
  [
   "            </p>\n          )}\n          {display.count > 1 && (\n            <p>\n              Claim all collects up to 10 stocks per wallet prompt. If one stock can’t be paid, that batch stays owed: collect the others with their own Claim buttons.\n            </p>\n          )}\n        </>\n      )}\n",
   "            </p>\n          )}\n          <p>\n            Batches of up to 10 stocks, with one wallet prompt per batch. If one\n            stock’s payment fails, the vault reverts that whole batch: nothing is\n            lost and every stock in it stays owed. Use each stock’s own Claim\n            button to collect the others.\n          </p>\n        </>\n      )}\n"
  ]
 ],
 "wallet.tsx": [
  [
   "  const disconnected = useRef(savedDisconnected());\n  const accountVersion = useRef(0);\n  // Advanced by Connect wallet and Disconnect only: a Connect answer that\n  // arrives after a later Disconnect is dropped.\n  const connectVersion = useRef(0);\n  const [connecting, setConnecting] = useState(false);\n  const [progress, setProgress] = useState<Record<string, ActionProgress>>({});\n",
   "  const disconnected = useRef(savedDisconnected());\n  const accountVersion = useRef(0);\n  const [connecting, setConnecting] = useState(false);\n  const [progress, setProgress] = useState<Record<string, ActionProgress>>({});\n"
  ],
  [
   "    connectingLock.current = true;\n    accountVersion.current++;\n    const version = ++connectVersion.current;\n    setConnecting(true);\n    try {\n",
   "    connectingLock.current = true;\n    accountVersion.current++;\n    setConnecting(true);\n    try {\n"
  ],
  [
   "        method: \"eth_requestAccounts\",\n      });\n      // Disconnect was pressed while the wallet was asked: it stands.\n      if (version !== connectVersion.current) return;\n      if (a[0]) {\n        disconnected.current = false;\n",
   "        method: \"eth_requestAccounts\",\n      });\n      if (a[0]) {\n        disconnected.current = false;\n"
  ],
  [
   "    if (sending.current) return;\n    accountVersion.current++;\n    connectVersion.current++;\n    disconnected.current = true;\n    try {\n",
   "    if (sending.current) return;\n    accountVersion.current++;\n    disconnected.current = true;\n    try {\n"
  ],
  [
   "            : \"The transaction was replaced in the wallet by a different one; it did not run. Refresh the vault before retrying.\",\n        );\n      // After a Speed up the transaction is mined under another hash than the\n      // one the wallet returned: from here on the mined one is shown and read.\n      const mined = receipt.transactionHash;\n      sent = mined;\n      setHash(mined);\n      if (receipt.status !== \"success\")\n        throw new Error(\n          \"The transaction reverted. Refresh the data before retrying.\",\n        );\n      setConfirmed({ hash: mined, functionName: s.functionName });\n      report(key, { message: `${label}: Confirmed. Refreshing…`, hash: mined });\n      let detail = \"\";\n      try {\n",
   "            : \"The transaction was replaced in the wallet by a different one; it did not run. Refresh the vault before retrying.\",\n        );\n      if (receipt.status !== \"success\")\n        throw new Error(\n          \"The transaction reverted. Refresh the data before retrying.\",\n        );\n      setConfirmed({ hash: tx, functionName: s.functionName });\n      report(key, { message: `${label}: Confirmed. Refreshing…`, hash: tx });\n      let detail = \"\";\n      try {\n"
  ],
  [
   "          \"Refresh unreadable. Retry vault / claims to read the confirmed result.\";\n      }\n      report(key, { message: `${label}: Confirmed.`, hash: mined, detail });\n      return receipt;\n    } catch (e) {\n",
   "          \"Refresh unreadable. Retry vault / claims to read the confirmed result.\";\n      }\n      report(key, { message: `${label}: Confirmed.`, hash: tx, detail });\n      return receipt;\n    } catch (e) {\n"
  ]
 ],
 "main.tsx": [
  [
   "import { Activity, useCallback, useEffect, useRef, useState } from \"react\";\nimport { createRoot } from \"react-dom/client\";\nimport { chain, verifyNetwork, VAULT } from \"./chain\";\n",
   "import { useCallback, useEffect, useRef, useState } from \"react\";\nimport { createRoot } from \"react-dom/client\";\nimport { chain, verifyNetwork, VAULT } from \"./chain\";\n"
  ],
  [
   "          <LossesPage snapshot={data} wallet={wallet} />\n        )}\n        <Activity mode={page === \"Redeem\" ? \"visible\" : \"hidden\"}>\n          <Claims key={wallet.account} snapshot={data} wallet={wallet} />\n        </Activity>\n      </main>\n      <div className=\"floor-strip\" aria-hidden=\"true\" />\n",
   "          <LossesPage snapshot={data} wallet={wallet} />\n        )}\n        {page === \"Redeem\" && <Claims snapshot={data} wallet={wallet} />}\n      </main>\n      <div className=\"floor-strip\" aria-hidden=\"true\" />\n"
  ]
 ]
};
// <<< v12 pieces
assert.deepEqual(Object.keys(editedFiles),[
 "Vault.tsx",
 "components.tsx",
 "Docs.tsx",
 "Flows.tsx",
 "wallet.tsx",
 "main.tsx"
],'the v12 files');
const putBack=(text,pieces,what)=>{for(const [n,o] of pieces){assert.equal(text.split(n).length,2,what+': expected once: '+n);text=text.split(n).join(o);}return text;};
for(const [f,edits] of Object.entries(editedFiles)) assert.equal(putBack(read('web/src/'+f),edits,f),baseline('web/src/'+f),f+' changed beyond the documented pieces');
// Calls that build, encode, simulate or send a transaction (or parse its arguments) or read the chain.
const names=new Set(['vault','token','feed','read','many','simulate','verifyNetwork','encode','depositArgs','redeemArgs','w.send','p.request',
 'safe','proposalSpec','proposalAction','settingValues','poolValues','parseLaunch','encodeFunctionData','client.call','client.estimateGas',
 'client.getTransactionCount','client.waitForTransactionReceipt','address','recipient','amount','uint']);
// JSX attributes that act, send or check, including every event handler and the wallet and snapshot handed to a
// component. The full HEAD coverage is retained for every v12 source.
const actionAttributes=new Set(['onClick','onSubmit','onChange','getSpec','disabled','disabledReason','label','scope','role','primary','value','claim','reason','build','wallet','snapshot']);
const isAction=name=>actionAttributes.has(name)||/^on[A-Z]/.test(name);
// The attributes that build or start a transaction: none may be added, removed or changed in any file.
const TX_ATTRIBUTES=new Set(['onSubmit','getSpec','build','claim']);
// A6 G-A: wallet sends and raw provider requests in any form are guarded calls too: a callee ending in one of these
// names (any receiver, optional chaining, casts, element access, string folding) or naming the provider (ethereum).
const SEND=new Set(['send','request','sendTransaction','sendRawTransaction','writeContract','sendAsync','sendCalls','signTransaction','sendUnsignedTransaction']);
const lit=n=>ts.isStringLiteralLike(n)?n.text:ts.isParenthesizedExpression(n)?lit(n.expression):ts.isBinaryExpression(n)&&n.operatorToken.kind===ts.SyntaxKind.PlusToken&&lit(n.left)!==undefined&&lit(n.right)!==undefined?lit(n.left)+lit(n.right):undefined;
const unwrap=n=>ts.isParenthesizedExpression(n)||ts.isNonNullExpression(n)||ts.isAsExpression(n)||ts.isTypeAssertionExpression(n)||ts.isSatisfiesExpression?.(n)?unwrap(n.expression):n;
const calleeName=c=>{const e=unwrap(c.expression);return ts.isIdentifier(e)?e.text:ts.isPropertyAccessExpression(e)?e.name.text:ts.isElementAccessExpression(e)?lit(e.argumentExpression):undefined;};
// v12: a guarded name is matched without line breaks or optional chaining ("client\n  .estimateGas" counts), and every
// method called on the public client (client.anything(...)) remains guarded, including the existing receipt read.
const onClient=c=>{const e=unwrap(c.expression);return (ts.isPropertyAccessExpression(e)||ts.isElementAccessExpression(e))&&ts.isIdentifier(unwrap(e.expression))&&unwrap(e.expression).text==='client';};
const isGuarded=(n,tree)=>ts.isCallExpression(n)&&(names.has(n.expression.getText(tree).replace(/\s+/g,'').replace(/\?\./g,'.'))||onClient(n)||SEND.has(calleeName(n))||/ethereum|(^|[.?\]])\s*(send|request|sendTransaction|sendRawTransaction|writeContract)\b/.test(n.expression.getText(tree)));
const parse=(text,file)=>ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
const printerOf=tree=>{const printer=ts.createPrinter({removeComments:true});return n=>printer.printNode(ts.EmitHint.Unspecified,n,tree).replace(/\s+/g,' ');};
// Where a node sits: the named functions around it, outermost first ("useWallet > disconnect"), then the action
// attribute it is inside, if any ("DepositPage, in onChange").
const place=(n,tree)=>{const fns=[];let attr='';for(let p=n.parent;p;p=p.parent){if(ts.isFunctionDeclaration(p)&&p.name)fns.unshift(p.name.text);if(!attr&&ts.isJsxAttribute(p)&&isAction(p.name.getText(tree)))attr=p.name.getText(tree);}return (fns.join(' > ')||'module')+(attr?', in '+attr:'');};
// The whole expression a name stands in: the property reads and calls chained to it ("p.request({...}).then(f)").
const wraps=(p,n)=>(ts.isPropertyAccessExpression(p)||ts.isElementAccessExpression(p)||ts.isCallExpression(p))&&p.expression===n||ts.isNonNullExpression(p)||ts.isParenthesizedExpression(p)||ts.isAsExpression(p)||ts.isTypeAssertionExpression(p)||!!ts.isSatisfiesExpression?.(p);
const top=n=>{if(n.parent&&ts.isPropertyAccessExpression(n.parent)&&n.parent.name===n)n=n.parent;while(n.parent&&wraps(n.parent,n))n=n.parent;return n;};
function calls(text,file) {
 const tree=parse(text,file),print=printerOf(tree),found=[],all=[],attributes=[];
 const guardedIn=node=>{const g=[];(function v(n){if(isGuarded(n,tree))g.push(print(n));ts.forEachChild(n,v);})(node);return g;};
 function where(attr){const owner=attr.parent.parent,tag=owner.tagName?.getText(tree)??'?';const named=attr.parent.properties.find(p=>ts.isJsxAttribute(p)&&['title','label','scope'].includes(p.name.getText(tree))&&p.initializer);return tag+(named?' '+named.name.getText(tree)+'='+named.initializer.getText(tree).replace(/\s+/g,' ').slice(0,60):'');}
 function visit(n){
   if(ts.isCallExpression(n)){const c={text:print(n),guarded:isGuarded(n,tree),place:place(n,tree),callee:calleeName(n)??'(expression)'};all.push(c);if(c.guarded)found.push(c);}
  if(ts.isJsxAttribute(n)&&isAction(n.name.getText(tree)))attributes.push({name:n.name.getText(tree),tag:n.parent.parent.tagName?.getText(tree)??'?',text:print(n),guarded:guardedIn(n),where:where(n)});
  ts.forEachChild(n,visit);
 }
 visit(tree);return {found,all,attributes};
}
// The difference of two lists of texts in order (longest common subsequence): the positions only in a (removed) and
// only in b (added). Everything else is the same text in the same order in both.
function difference(a,b){
 const n=a.length,m=b.length,L=Array.from({length:n+1},()=>new Uint16Array(m+1));
 for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)L[i][j]=a[i]===b[j]?L[i+1][j+1]+1:Math.max(L[i+1][j],L[i][j+1]);
 const removed=[],added=[];let i=0,j=0;
 while(i<n&&j<m){if(a[i]===b[j]){i++;j++;}else if(L[i+1][j]>=L[i][j+1])removed.push(i++);else added.push(j++);}
 while(i<n)removed.push(i++);while(j<m)added.push(j++);
 return {removed,added};
}
// Guarded calls: the exact, documented differences from HEAD, each added call with the place it must sit in
// (everything equals HEAD, in order and place). The existing receipt read and display-only amount parser are
// already part of HEAD. The v12 connection guard adds no guarded call or wallet request.
// SPEC 1-6 add no guarded call: receipt reading and display amount parsing already belong to HEAD.
const expected={
 "Vault.tsx": {
  "removed": [],
  "added": []
 },
 "components.tsx": {
  "removed": [],
  "added": []
 },
 "Docs.tsx": {
  "removed": [],
  "added": []
 },
 "Flows.tsx": {
  "removed": [],
  "added": []
 },
 "wallet.tsx": {
  "removed": [],
  "added": []
 },
 "main.tsx": {
  "removed": [],
  "added": []
 }
};
// Action attributes: the exact differences from HEAD, in page order, each [element, attribute, why]. Everything else
// equals HEAD in order, text for text. None of them builds or starts a transaction (no onSubmit, getSpec, build or
// claim) and none contains a guarded call (both asserted below). The list between the marker lines was generated
// from the difference to HEAD, as the pieces were; each why was written by hand, and an entry without one fails.
// >>> v12 attributes (generated from the difference to HEAD; each why written by hand)
const attributeChanges={
 "Vault.tsx": {
  "removed": [],
  "added": [
   [
    "svg",
    "role=\"img\"",
    "The owner-approved Deposit LED sign is an inline SVG image with an accessible Closed label, shown only for a known closure using the existing snapshot status. This role is presentation only and performs no action or read."
   ]
  ]
 }
};
// <<< v12 attributes
// Every call expression: HEAD's calls, in order and place, are all still there, except the removed ones listed here;
// a call that only gained the documented piece inside it (put back before comparing) counts as kept. Every added
// call, including display helpers and effects, is independently pinned below, not only the guarded calls.
// Watched names: the names that build, parse, read or send (vault, token, read, many, simulate, encode, amount,
// depositArgs, redeemArgs, recipient, client, ...) and the state and refs the file had at HEAD (setInputs, setQuote,
// setAccount, sequence, sending, ...). Every use of one, a call or the bare name handed on or renamed, equals HEAD in
// order and place, apart from the new uses listed here, each printed with the calls chained to it and its place. So
// nothing new reaches the typed amounts, the quote, the balances or the account except by these. No v12 chain
// read is added; the existing receipt read and answer handling are independently byte-pinned.
// The guarded startup eth_accounts answer is part of HEAD and must remain exact.
const restoreAccountReply=(x)=>x.text;
// Reviewed v12 differences in calls and watched-name uses. Independent of the generated pieces.
const callChanges={
 "Vault.tsx": {
  "why": "SPEC 1 and owner-approved short closure notice: the heading and removed sentence, compact Closed status on Vault, and Closed LED plus one sentence on Deposit. The exact local display tail uses the existing snapshot and settings; original r/reason/clock/closed calculations remain byte-identical. Normal, loading and reopening-boundary states show no notice; unreadable status retains Retry.",
  "pieces": [],
  "removed": [
   "reasonWords(Number(r.value[0]), s.globals.settings)",
   "Number(r.value[0])",
   "s.assets.find((a) => a.token.toLowerCase() === r.value[1].toLowerCase())",
   "a.token.toLowerCase()",
   "r.value[1].toLowerCase()",
   "hoursLine(s.globals.settings)"
  ],
  "uses": []
 },
 "components.tsx": {
  "why": "SPEC 1: PageTitle renders no empty paragraph when there are no children.",
  "pieces": [],
  "removed": [],
  "uses": []
 },
 "Docs.tsx": {
  "why": "SPEC 2: four approved paragraphs in the existing panel.",
  "pieces": [],
  "removed": [],
  "uses": []
 },
 "Flows.tsx": {
  "why": "SPEC 3/4 and owner-approved presentation: direct Deposit paragraphs, the short DepositState sign notice, one-column Redeem, removed redundant wallet instruction lines and Claims presentation. The unused hoursLine import, display calls and r/reason declarations are removed; all transaction builders and reads stay byte-identical.",
  "pieces": [],
  "removed": [
   "Number(r.value[0])",
   "hoursLine(s.globals.settings)",
   "w.account.slice(0, 6)",
   "w.account.slice(-4)",
   "s.assets.filter((a) => owed[a.token] === 0n)",
   "visible.map((a) => (<div className=\"receipt\" key={a.token}> <bdi>{a.symbol}</bdi> <p> Still owed:{\" \"} {reading ? \"Reading...\" : fmt(owed[a.token], a.tokenDecimals)} </p> <Receiver value={to} wallet={w} claim/> <TxButton snapshot={s} wallet={w} label={`Claim ${a.symbol}`} scope={`Claim ${a.symbol} · ${a.token}`} disabled={working || owed[a.token] === undefined || owed[a.token] === 0n} disabledReason={reading ? \"Reading... Wait for owed balances.\" : owed[a.token] === undefined ? \"Owed balance unreadable. Retry claims above.\" : \"Nothing owed for this stock.\"} getSpec={() => vault(\"claim\", [[a.token], recipient(to)])}/> </div>))",
   "zeros.map((a) => a.symbol).join(\", \")",
   "zeros.map((a) => a.symbol)"
  ],
  "uses": []
 },
 "wallet.tsx": {
  "why": "SPEC 6: a separate connection intent counter and mined-receipt hash propagation after the protected send head.",
  "pieces": [],
  "removed": [
   "setConfirmed({ hash: tx, functionName: s.functionName })",
   "report(key, { message: `${label}: Confirmed. Refreshing…`, hash: tx })",
   "report(key, { message: `${label}: Confirmed.`, hash: tx, detail })"
  ],
  "uses": [
   [
    "setHash(mined)",
    "useWallet > send"
   ],
   [
    "setConfirmed({ hash: mined, functionName: s.functionName })",
    "useWallet > send"
   ]
  ]
 },
 "main.tsx": {
  "why": "Owner-approved persistence: React Activity keeps Claims mounted across navigation and pauses its effects while hidden.",
  "pieces": [],
  "removed": [],
  "uses": []
 }
};
const WATCHED=[...names].filter(x=>!x.includes('.')).concat('client');
// The state setters and refs a file declares: const [x, setX] = useState(...) gives setX, const r = useRef(...) gives r.
function stateNames(text,file){
 const tree=parse(text,file),out=[];
 (function v(n){
  if(ts.isVariableDeclaration(n)&&n.initializer&&ts.isCallExpression(n.initializer)){
   const made=n.initializer.expression.getText(tree);
   if(made==='useState'&&ts.isArrayBindingPattern(n.name)&&n.name.elements.length===2&&ts.isBindingElement(n.name.elements[1])&&ts.isIdentifier(n.name.elements[1].name))out.push(n.name.elements[1].name.text);
   if(made==='useRef'&&ts.isIdentifier(n.name))out.push(n.name.text);
  }
  ts.forEachChild(n,v);
 })(tree);
 return out;
}
// Every use of a watched name with its place: not where it is declared or imported, not as the name of a property,
// not inside a type.
function usesOf(text,file,watched){
 const tree=parse(text,file),print=printerOf(tree),out=[];
 const named=p=>(ts.isVariableDeclaration(p)||ts.isParameter(p)||ts.isBindingElement(p)||ts.isFunctionDeclaration(p)||ts.isFunctionExpression(p)||ts.isImportSpecifier(p)||ts.isImportClause(p)||ts.isPropertyAssignment(p)||ts.isPropertyAccessExpression(p)||ts.isJsxAttribute(p)||ts.isMethodDeclaration(p)||ts.isPropertySignature(p))&&p.name;
 (function v(n){
  if(ts.isTypeNode(n))return;
  if(ts.isIdentifier(n)&&watched.has(n.text)&&named(n.parent)!==n&&!(ts.isBindingElement(n.parent)&&n.parent.propertyName===n)&&!(ts.isImportSpecifier(n.parent)&&n.parent.propertyName===n))out.push({text:print(top(n)),place:place(n,tree)});
  ts.forEachChild(n,v);
 })(tree);
 return out;
}
// Vault.tsx (the Stock shelves labels): no read, check or send call at all (no guarded call here, and no send or
// request in the scan below). Its action attributes equal HEAD's and this pinned list, in page order: the Retry vault
// button and the vault, Stock Token and price feed address links, plus the shelves' controls (label Details, drawer
// Close and its Escape key, filters, search, Show all), which only change what is shown. SPEC 1 changes the title
// and its sentence; owner-approved deposit presentation adds only the LED image role. Every original control and
// StockShelves handler keeps its original pin.
// Owner-approved LED accessibility role; all original controls keep their exact order and text.
const vaultAttributes=['role="img"','onClick={s.retry}','snapshot={s}','value={VAULT}','snapshot={s}','onClick={onToggle}','onKeyDown={(e) => e.key === "Escape" && onClose()}','onClick={onClose}','value={a.token}','value={a.feed}','onClose={() => onClose(o.a.token)}','onToggle={() => onToggle(a.token)}','role="list"','role="group"','onClick={() => show(f, search)}','value={search}','onChange={(e) => show(filter, e.target.value)}','role="status"','onClick={() => show("all", "")}','onClick={() => show("all", "")}'];
const vaultHandlers={
 show:'const show = (f: ShelfFilter, text: string) => { stopRestock(); setOpenToken(undefined); setFilter(f); setSearch(text); };',
 toggle:'const toggle = (token: string) => setOpenToken(openToken === token ? undefined : token);',
 close:'const close = (token: string) => { setOpenToken(undefined); requestAnimationFrame(() => document.getElementById(`sa-more-${token}`)?.focus()); };',
 group:'const group = { nav, settings: s.globals.settings, openToken, onToggle: toggle, onClose: close };'};
// The variable statements declaring `list` inside the top-level function `fn`, printed without comments (one each).
function localDeclarations(file,text,fn,list){
 const tree=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),printer=ts.createPrinter({removeComments:true}),out={};
 const f=tree.statements.filter(st=>ts.isFunctionDeclaration(st)&&st.name?.text===fn);
 assert.equal(f.length,1,file+': one '+fn);
 (function v(n){if(ts.isVariableStatement(n))for(const d of n.declarationList.declarations)if(ts.isIdentifier(d.name)&&list.includes(d.name.text)){assert.ok(!out[d.name.text],file+': one '+d.name.text+' in '+fn);out[d.name.text]=printer.printNode(ts.EmitHint.Unspecified,n,tree).replace(/\s+/g,' ');}ts.forEachChild(n,v);})(f[0]);
 return out;
}
const sources=git(['ls-tree','-r','--name-only','HEAD','web/src']).trim().split('\n').filter(p=>/\.tsx?$/.test(p)).map(p=>p.slice(8));
assert.deepEqual(git(['ls-files','--cached','--others','--exclude-standard','web/src']).trim().split('\n').filter(p=>/\.tsx?$/.test(p)).map(p=>p.slice(8)).sort(),[...sources].sort(),'No source file added or removed');
// Every source is either frozen (byte-identical to HEAD) or a v12 file with its documented pieces (above).
assert.deepEqual([...sources].sort(),[...protectedFiles,...Object.keys(editedFiles)].filter(f=>/\.tsx?$/.test(f)).sort(),'every web/src source is frozen or a documented v12 file');
const scans={},facts={attributes:{},guarded:{},calls:{}};
for(const f of sources){
 const old=calls(baseline('web/src/'+f),f),now=calls(read('web/src/'+f),f),c=callChanges[f]??{pieces:[],removed:[],uses:[]},used=c.pieces.map(()=>0);
 // A call that holds a documented piece is compared as HEAD wrote it.
 const restore=text=>c.pieces.reduce((t,[n,o],i)=>{const parts=t.split(n);assert.ok(parts.length<=2,f+': the call piece occurs twice in one call: '+n);if(parts.length===2)used[i]++;return parts.join(o);},text);
 const restored=now.all.map(x=>restore(x.text));
 const watched=new Set([...WATCHED,...stateNames(baseline('web/src/'+f),f)]),usesOld=usesOf(baseline('web/src/'+f),f,watched),usesNow=usesOf(read('web/src/'+f),f,watched),uses=difference(usesOld.map(x=>x.text+' @ '+x.place),usesNow.map(x=>restore(x.text)+' @ '+x.place));
 // Two calls are the same when their text and their place are; two attributes when their element and their text are.
 const attributes=difference(old.attributes.map(a=>a.tag+' '+a.text),now.attributes.map(a=>a.tag+' '+a.text)),guarded=difference(old.found.map(x=>x.text+' @ '+x.place),now.found.map(x=>restoreAccountReply(x,f)+' @ '+x.place)),all=difference(old.all.map(x=>x.text+' @ '+x.place),restored.map((x,i)=>x+' @ '+now.all[i].place));
  scans[f]={old,now,c,used,attributes,guarded,all,usesOld,usesNow,uses};
 if(attributes.removed.length+attributes.added.length)facts.attributes[f]={removed:attributes.removed.map(i=>[old.attributes[i].tag,old.attributes[i].text]),added:attributes.added.map(i=>[now.attributes[i].tag,now.attributes[i].text])};
 if(guarded.removed.length+guarded.added.length)facts.guarded[f]={removed:guarded.removed.map(i=>old.found[i].text),added:guarded.added.map(i=>[now.found[i].text,now.found[i].place])};
  if(all.removed.length+all.added.length)facts.calls[f]={removed:all.removed.map(i=>old.all[i].text),uses:uses.added.map(i=>[usesNow[i].text,usesNow[i].place]),usesRemoved:uses.removed.map(i=>usesOld[i].text),added:all.added.length,addedCalls:all.added.map(i=>[now.all[i].text,now.all[i].place]),callees:all.added.map(i=>now.all[i].callee).join(' ')};
}
// For the tool that generated the two lists between marker lines (it is not part of this tree): when BASKET_GATE_FACTS
// names a file, the differences computed from this tree are written to it before they are checked. Nothing is
// skipped or loosened by it.
if(process.env.BASKET_GATE_FACTS)fs.writeFileSync(process.env.BASKET_GATE_FACTS,JSON.stringify(facts,null,1)+'\n');
// Hand-reviewed complete ordered additions. SHA-256 binds JSON.stringify([[full printed call, place], ...]); the
// ordered callee names make the list readable without repeating large nested JSX bodies. No regeneration block
// includes these pins. Changing a callback, receiver, argument, location, order or count changes the digest.
// >>> reviewed calls (manual; never refreshed by put-pieces)
const addedCallPins={
 "Vault.tsx": {
  "sha256": "4f11db85cbd213b7a60ff309a42fc122b75f2408685534c1596c381656a0347d",
  "callees": "toUpperCase flatMap flatMap map some split reasonWords"
 },
 "components.tsx": {
  "sha256": "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
  "callees": ""
 },
 "Docs.tsx": {
  "sha256": "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
  "callees": ""
 },
 "Flows.tsx": {
  "sha256": "a300e32681affcedb9a06c8a18f5f3278b503113fe7752c4b7f6705fcefc19f1",
  "callees": "useRef useRef useLayoutEffect useState useLayoutEffect setDisplay some keys startsWith setDisplay map"
 },
 "wallet.tsx": {
  "sha256": "4aa092bccb8c851943d0ea97214d6e4be2efb19245eea9383a4a4380efdf23c8",
  "callees": "useRef setHash setConfirmed report report"
 },
 "main.tsx": {
  "sha256": "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
  "callees": ""
 }
};
// <<< reviewed calls
// SPEC 1-6 and the owner's mounting decision: exact reviewed source, beyond either generated block.
const reviewedSourcePins={
 "Vault.tsx": "d8936edd240c7571e4e65bdf878f65bea73b889c5541873f8fe2b128633a7582",
 "components.tsx": "d9ae83c4ad85ca3762e24914efd4669e22916bb5a2e29bbfd778bcdec5041730",
 "Docs.tsx": "5f24a982beba7124f0af8e06496b5e64f79b052978ff37785ff6700279f984c5",
 "Flows.tsx": "3b380cc8bcdf5d2cc81ed46fef7274e00a0ac83025200cdc046bf8fb18c49e3b",
 "wallet.tsx": "488b62c80121b3302ea8cbdac7d23e0a32d8fc874082dfab6499388949b083de",
 "main.tsx": "2745de3906186f90b599d7b3675d602be6cc5ed0ed055813de8b4dd7b0f0e04e"
};
for(const f of Object.keys(editedFiles)){
 const {now,all}=scans[f],list=all.added.map(i=>[now.all[i].text,now.all[i].place]);
 assert.equal(all.added.map(i=>now.all[i].callee).join(' '),addedCallPins[f]?.callees,f+': added-call order or count differs from its reviewed list');
 assert.equal(sha256(JSON.stringify(list)),addedCallPins[f]?.sha256,f+': the complete ordered added-call list differs from its reviewed pin');
}
// Direct writes and mutating methods on transaction state, including aliases. A separate check is needed because
// an assignment or delete can change inputs without adding a call. Compare the full ordered writes with HEAD;
// v12 adds none to these roots. Shallow copies have fresh containers but can still hold references to an original nested object.
function stateWrites(text,file){
 const tree=parse(text,file),print=printerOf(tree),host={getSourceFile:n=>n===file?tree:undefined,writeFile(){},getCurrentDirectory:()=>'',getDirectories:()=>[],fileExists:n=>n===file,readFile:n=>n===file?text:undefined,getCanonicalFileName:n=>n,useCaseSensitiveFileNames:()=>true,getNewLine:()=> '\n',getDefaultLibFileName:()=>''};
 const checker=ts.createProgram([file],{noLib:true,noResolve:true},host).getTypeChecker(),aliases=new Map(),roots=new Set(['inputs','open','quote','balances','allowances','s']),out=[];
 const symbol=n=>checker.getSymbolAtLocation(n),union=(...lists)=>[...new Set(lists.flat())];
 const member=(from,key)=>from.map(x=>x.startsWith('copy:')?x.slice(5):x.startsWith('spread:')?member([x.slice(7)],key)[0]:x==='s'?'s.'+key:x);
 const copied=(from,kind='copy:')=>from.map(x=>(x.match(/copy:|spread:/g)?.length??0)>=4?x:kind+x);
 const origin=n=>{
  if(!n)return [];n=unwrap(n);
  if(ts.isIdentifier(n))return union(roots.has(n.text)?[n.text]:[],aliases.get(symbol(n))??[]);
  if(ts.isPropertyAccessExpression(n))return member(origin(n.expression),n.name.text);
  if(ts.isElementAccessExpression(n))return member(origin(n.expression),lit(n.argumentExpression)??'*');
  if(ts.isConditionalExpression(n))return union(origin(n.whenTrue),origin(n.whenFalse));
  if(ts.isBinaryExpression(n)&&[ts.SyntaxKind.AmpersandAmpersandToken,ts.SyntaxKind.BarBarToken,ts.SyntaxKind.QuestionQuestionToken].includes(n.operatorToken.kind))return union(origin(n.left),origin(n.right));
  if(ts.isBinaryExpression(n)&&[ts.SyntaxKind.CommaToken,ts.SyntaxKind.EqualsToken].includes(n.operatorToken.kind))return origin(n.right);
  if(ts.isArrayLiteralExpression(n))return union(...n.elements.map(x=>copied(origin(ts.isSpreadElement(x)?x.expression:x))));
  if(ts.isObjectLiteralExpression(n))return union(...n.properties.map(x=>copied(origin(ts.isPropertyAssignment(x)?x.initializer:ts.isShorthandPropertyAssignment(x)?x.name:ts.isSpreadAssignment(x)?x.expression:undefined),ts.isSpreadAssignment(x)?'spread:':'copy:')));
  return [];
 };
 let changed;
 const bind=(name,from)=>{
  if(ts.isIdentifier(name)){const key=symbol(name);if(!key||!from.length)return;const was=aliases.get(key)??[],next=union(was,from);if(next.length!==was.length){aliases.set(key,next);changed=true;}}
  else if(ts.isObjectBindingPattern(name)||ts.isArrayBindingPattern(name)){
   for(const [i,e] of name.elements.entries())if(ts.isBindingElement(e))bind(e.name,union(e.dotDotDotToken?copied(from,ts.isObjectBindingPattern(name)?'spread:':'copy:'):member(from,ts.isObjectBindingPattern(name)?(e.propertyName?.getText(tree)??e.name.getText(tree)):i),origin(e.initializer)));
  }
  else if(ts.isObjectLiteralExpression(name)){
   for(const e of name.properties){
    if(ts.isPropertyAssignment(e)||ts.isShorthandPropertyAssignment(e))bind(ts.isPropertyAssignment(e)?e.initializer:e.name,union(member(from,e.name.getText(tree)),ts.isShorthandPropertyAssignment(e)?origin(e.objectAssignmentInitializer):[]));
    else if(ts.isSpreadAssignment(e))bind(e.expression,copied(from,'spread:'));
   }
  }
  else if(ts.isArrayLiteralExpression(name))name.elements.forEach((e,i)=>bind(ts.isSpreadElement(e)?e.expression:e,ts.isSpreadElement(e)?copied(from):member(from,i)));
  else if(ts.isBinaryExpression(name)&&name.operatorToken.kind===ts.SyntaxKind.EqualsToken)bind(name.left,union(from,origin(name.right)));
  else if(ts.isPropertyAccessExpression(name)||ts.isElementAccessExpression(name))bind(name.expression,copied(from));
 };
 // Fixed point catches alias chains even across declaration order. Symbols distinguish shadowed local names.
 do{changed=false;(function v(n){
  if(ts.isVariableDeclaration(n)&&n.initializer)bind(n.name,origin(n.initializer));
  if(ts.isBinaryExpression(n)&&[ts.SyntaxKind.EqualsToken,ts.SyntaxKind.BarBarEqualsToken,ts.SyntaxKind.AmpersandAmpersandEqualsToken,ts.SyntaxKind.QuestionQuestionEqualsToken].includes(n.operatorToken.kind))bind(n.left,origin(n.right));
  if(ts.isForOfStatement(n)){
   const from=member(origin(n.expression),'*');
   if(ts.isVariableDeclarationList(n.initializer))for(const d of n.initializer.declarations)bind(d.name,from);
   else bind(n.initializer,from);
  }
  ts.forEachChild(n,v);
 })(tree);}while(changed);
 const protectedOrigins=n=>origin(n).filter(x=>!/^copy:|^spread:/.test(x)&&(x!=='s'&&!x.startsWith('s.')||x==='s.assets'||x==='s.*'));
 const put=(n,target)=>{const from=protectedOrigins(target);if(from.length)out.push({text:print(n),place:place(n,tree),from:[...new Set(from)].sort()});};
 const target=(n,whole)=>{if(!n)return;n=unwrap(n);if(ts.isArrayLiteralExpression(n))n.elements.forEach(x=>target(x,whole));else if(ts.isObjectLiteralExpression(n))n.properties.forEach(x=>target(ts.isPropertyAssignment(x)?x.initializer:ts.isShorthandPropertyAssignment(x)?x.name:x.expression,whole));else put(whole,n);};
 const mutators=new Set(['sort','reverse','copyWithin','fill','push','pop','shift','unshift','splice','set','delete','clear']);
 (function v(n){
  if(ts.isBinaryExpression(n)&&n.operatorToken.kind>=ts.SyntaxKind.FirstAssignment&&n.operatorToken.kind<=ts.SyntaxKind.LastAssignment)target(n.left,n);
  if(ts.isDeleteExpression(n))target(n.expression,n);
  if((ts.isPrefixUnaryExpression(n)||ts.isPostfixUnaryExpression(n))&&[ts.SyntaxKind.PlusPlusToken,ts.SyntaxKind.MinusMinusToken].includes(n.operator))target(n.operand,n);
  if(ts.isCallExpression(n)){
   const e=unwrap(n.expression),method=calleeName(n);
   if((ts.isPropertyAccessExpression(e)||ts.isElementAccessExpression(e))&&mutators.has(method))put(n,e.expression);
   if((ts.isPropertyAccessExpression(e)||ts.isElementAccessExpression(e))&&['Object','Reflect'].includes(e.expression.getText(tree))&&['assign','defineProperty','defineProperties','set','deleteProperty','setPrototypeOf','freeze','seal','preventExtensions'].includes(method)&&n.arguments[0])put(n,n.arguments[0]);
  }
  ts.forEachChild(n,v);
 })(tree);
 return out;
}
const transactionStateWrites={};
for(const f of Object.keys(editedFiles)){
 const h=stateWrites(baseline('web/src/'+f),f),n=stateWrites(read('web/src/'+f),f);
 assert.deepEqual(n,h,f+': a direct or aliased write to transaction state differs from HEAD');
 transactionStateWrites[f]=n.length;
}
const counts={};
for(const f of sources){
 const {old,now,c,used,attributes,guarded,all,usesOld,usesNow,uses}=scans[f],e=expected[f]??{removed:[],added:[]},a=attributeChanges[f]??{removed:[],added:[]};
 // Guarded calls: equal HEAD in order and place, apart from the documented ones, each added one in its documented place.
 assert.deepEqual({removed:guarded.removed.map(i=>old.found[i].text),added:guarded.added.map(i=>[now.found[i].text,now.found[i].place])},{removed:e.removed,added:e.added},f+' changed calldata/read/check/send call expressions beyond the documented ones');
 // Action attributes: equal HEAD in order, apart from the documented ones.
 assert.deepEqual({removed:attributes.removed.map(i=>[old.attributes[i].tag,old.attributes[i].text]),added:attributes.added.map(i=>[now.attributes[i].tag,now.attributes[i].text])},{removed:a.removed.map(x=>x.slice(0,2)),added:a.added.map(x=>x.slice(0,2))},f+' changed an action, send or check attribute beyond the documented ones');
 for(const x of [...a.removed,...a.added])assert.ok(typeof x[2]==='string'&&x[2].trim().length>20,f+': write the why of the documented attribute '+x[1]);
 for(const [list,i] of [...attributes.removed.map(i=>[old.attributes,i]),...attributes.added.map(i=>[now.attributes,i])]){
  assert.ok(!TX_ATTRIBUTES.has(list[i].name),f+': an attribute that builds or starts a transaction was added, removed or changed: '+list[i].text);
  assert.deepEqual(list[i].guarded,[],f+' '+list[i].where+': a guarded call inside an added or removed attribute: '+list[i].text);
 }
 // The attributes that build or start a transaction, spelled out: the same texts as at HEAD, in order.
 assert.deepEqual(now.attributes.filter(x=>TX_ATTRIBUTES.has(x.name)).map(x=>x.text),old.attributes.filter(x=>TX_ATTRIBUTES.has(x.name)).map(x=>x.text),f+': an onSubmit, getSpec, build or claim attribute differs from HEAD');
 // No guarded call moved into or out of an attribute: inside the attributes they are HEAD's, in order.
 assert.deepEqual(now.attributes.flatMap(x=>x.guarded),old.attributes.flatMap(x=>x.guarded),f+': the guarded calls inside action attributes differ from HEAD');
 // Every call expression (see callChanges).
 assert.deepEqual(all.removed.map(i=>old.all[i].text),c.removed,f+': a call of HEAD is gone or moved beyond the documented ones');
 c.pieces.forEach(([n],i)=>assert.ok(used[i]>0,f+': the call piece is in no call: '+n));
 assert.deepEqual(all.added.filter(i=>now.all[i].guarded).map(i=>now.all[i].text),e.added.map(x=>x[0]),f+': an added call is a guarded call that is not documented');
 // Watched names (see callChanges): the new uses are the documented ones; a use that is gone left with a removed call.
 assert.deepEqual(uses.added.map(i=>[usesNow[i].text,usesNow[i].place]),c.uses,f+': a new use of a name that builds, reads or sends, or of a state or ref of HEAD, is not documented');
 for(const i of uses.removed)assert.ok(c.removed.includes(usesOld[i].text),f+': a use of a watched name is gone or moved, and not with a documented removed call: '+usesOld[i].text);
 if(f==='Vault.tsx'){
  assert.deepEqual(now.found,[],'Vault.tsx makes no read, check or send call');
  assert.deepEqual(now.attributes.map(a=>a.text),vaultAttributes,'Vault.tsx action attributes differ from the pinned Stock shelves controls');
  for(const a of now.attributes) assert.deepEqual(a.guarded,[],'Vault.tsx '+a.where+': guarded call in an attribute');
  const h=localDeclarations('web/src/Vault.tsx',read('web/src/Vault.tsx'),'StockShelves',Object.keys(vaultHandlers));
  for(const [k,v] of Object.entries(vaultHandlers)) assert.equal(h[k],v,'Vault.tsx StockShelves '+k+' differs from the pinned text');
 }
 counts[f]={guarded:now.found.length,calls:now.all.length,attributes:now.attributes.length};
}
for(const f of [...Object.keys(expected),...Object.keys(attributeChanges),...Object.keys(callChanges)])assert.ok(f in editedFiles,f+': a documented difference in a file that is not a v12 file');
// A6 G-A: wallet sends and raw requests. Listed in order per file, each with its place: every use of a send/request
// name or of the provider (ethereum), with the call around it; every string that names a sending or signing method
// (folded across +); computed access to the global object with any key (window[...], also window["fetch"]); eval,
// Function, Reflect; and the retained scan of names by which a page reaches the network by itself (fetch,
// XMLHttpRequest, WebSocket, EventSource, sendBeacon, importScripts, a dynamic import), written as a name or as a
// plain string (folded across +). Every file equals HEAD directly, including the startup reply guard already present there.
// Disconnect is local-only and must have no provider request of its own.
const SEND_TEXT=/eth_send|eth_sign|personal_sign|wallet_send|signtypeddata|sendtransaction|sendrawtransaction|writecontract|^(send|request|ethereum)$/i;
const ESCAPES=new Set(['ethereum','eval','Function','Reflect','globalThis','fetch','XMLHttpRequest','WebSocket','EventSource','sendBeacon','importScripts']),GLOBAL=new Set(['window','globalThis','self','top','parent','frames']);
const sendText=s=>SEND_TEXT.test(s)||ESCAPES.has(s);
function sendsOf(text,file){
 const tree=parse(text,file),print=printerOf(tree),out=[],put=(n,shown)=>out.push({text:print(shown),place:place(n,tree)});
 (function v(n){
  const s=lit(n);
  if(ts.isIdentifier(n)&&(SEND.has(n.text)||ESCAPES.has(n.text)))put(n,top(n));
  else if(ts.isElementAccessExpression(n)&&GLOBAL.has(unwrap(n.expression).getText(tree)))put(n,n);
  else if(s!==undefined&&!(n.parent&&lit(n.parent)!==undefined)&&sendText(s))put(n,top(n));
  else if((ts.isTemplateExpression(n)||ts.isNoSubstitutionTemplateLiteral(n))&&sendText(ts.isTemplateExpression(n)?n.head.text+n.templateSpans.map(x=>x.literal.text).join(''):n.text))put(n,n);
  else if(ts.isCallExpression(n)&&n.expression.kind===ts.SyntaxKind.ImportKeyword)put(n,n);
  ts.forEachChild(n,v);
 })(tree);
 return out;
}
const NO_SEND=['Vault.tsx','Scenery.tsx','main.tsx','Docs.tsx'],sendUses={};
for(const f of sources){
 const h=sendsOf(baseline('web/src/'+f),f),n=sendsOf(read('web/src/'+f),f);
 // The startup request, its answer handling and all provider uses already belong to HEAD and remain exact.
 // Guarded calls and named methods independently compare the requests without an exception.
 const restored=n.map(x=>({...x,text:restoreAccountReply(x,f)}));
 if(f==='wallet.tsx')assert.deepEqual(n,h,'wallet.tsx: provider uses including the guarded startup reply equal HEAD');
 assert.deepEqual(restored,h,f+': a wallet send, provider request, signing method or network call was added, removed, changed or moved');
 if(f==='wallet.tsx')assert.deepEqual(n.filter(x=>x.place==='useWallet > disconnect'),[],'wallet.tsx disconnect(): no provider request');
 if(NO_SEND.includes(f))assert.ok(n.every(x=>x.text==='window.ethereum'),f+' must contain no send or request (only the read of window.ethereum in main.tsx)');
 if(n.length)sendUses[f]=n.map(x=>x.text);
}
// components.tsx (the shared transaction button) keeps exactly HEAD's single wallet.send.
assert.deepEqual(sendUses['components.tsx'].filter(x=>/\(/.test(x)),['wallet.send(await getSpec(), scope, scope)'],'components.tsx sends');
// v12: what a page can load or open without any of those names. Listed in order per file, each with its place: the
// names in LOADS, written as a name, a property or a plain string (folded across +): a picture, sound or worker made
// in script; the address bar, the history and the navigator; a new window; an element or HTML built in script; a
// src, href, action or style set in script. Then every JSX attribute in LOAD_ATTRIBUTES (any letter case) with its
// whole value, and every spread of attributes onto an element. Every file equals HEAD, with no exception: v12 adds no
// link, picture, frame, style attribute or navigation. `open` alone is the list of open stocks in Flows.tsx, so it
// counts only as a property (window.open) or when it is called. This is a list of known ways, not a proof that no
// other way exists.
const LOADS=new Set(['Image','Audio','Worker','SharedWorker','serviceWorker','RTCPeerConnection','location','history','navigator','open','createElement','createElementNS','innerHTML','outerHTML','insertAdjacentHTML','setAttribute','setAttributeNS','write','writeln','src','srcset','srcdoc','href','action','formAction','style','cssText']);
const LOAD_ATTRIBUTES=new Set(['href','xlinkhref','xlink:href','src','srcset','srcdoc','action','formaction','data','poster','ping','style','dangerouslysetinnerhtml','httpequiv']);
function loadsOf(text,file){
 const tree=parse(text,file),print=printerOf(tree),out=[],put=(n,shown)=>out.push({text:print(shown),place:place(n,tree)});
 const plainOpen=n=>n.text==='open'&&!(ts.isPropertyAccessExpression(n.parent)&&n.parent.name===n)&&!(ts.isCallExpression(n.parent)&&n.parent.expression===n);
 (function v(n){
  const s=lit(n);
  if(ts.isJsxAttribute(n)){if(LOAD_ATTRIBUTES.has(n.name.getText(tree).toLowerCase()))put(n,n);if(n.initializer)v(n.initializer);return;}
  if(ts.isJsxSpreadAttribute(n))put(n,n);
  else if(ts.isIdentifier(n)&&LOADS.has(n.text)&&!plainOpen(n))put(n,top(n));
  else if(s!==undefined&&!(n.parent&&lit(n.parent)!==undefined)&&LOADS.has(s))put(n,top(n));
  ts.forEachChild(n,v);
 })(tree);
 return out;
}
// The retained scanner treats the asset flag a.open as a load name. This one new display-only
// entry belongs to the independently raw-pinned operational declaration; no network sink is exempted.
const loadDisplayAdded={'Vault.tsx':[{text:'a.open',place:'DepositState'}]};
const loadUses={};
for(const f of sources){
 const h=loadsOf(baseline('web/src/'+f),f),n=loadsOf(read('web/src/'+f),f);
 assert.deepEqual(n,[...(loadDisplayAdded[f]??[]),...h],f+': something a page loads or opens (a picture, frame, worker or element made in script, a navigation, a link, a style attribute) was added, removed, changed or moved');
 if(n.length)loadUses[f]=n.length;
}
// v12: the wallet and RPC methods the pages name. Every `method` given as a property (or assigned) in web/src, in order
// with its place: exactly HEAD's list. Local-only Disconnect names no new wallet or RPC method.
function methodsOf(text,file){
 const tree=parse(text,file),print=printerOf(tree),out=[],key=n=>ts.isIdentifier(n)||ts.isStringLiteralLike(n)?n.text:ts.isComputedPropertyName(n)?lit(n.expression):undefined;
 const put=(n,value)=>out.push({method:value?lit(value)??'not a plain string: '+print(value):'not a plain string: shorthand',place:place(n,tree)});
 (function v(n){
  if(ts.isPropertyAssignment(n)&&key(n.name)==='method')put(n,n.initializer);
  else if(ts.isShorthandPropertyAssignment(n)&&n.name.text==='method')put(n);
  else if(ts.isBinaryExpression(n)&&n.operatorToken.kind===ts.SyntaxKind.EqualsToken&&(ts.isPropertyAccessExpression(n.left)&&n.left.name.text==='method'||ts.isElementAccessExpression(n.left)&&lit(n.left.argumentExpression)==='method'))put(n,n.right);
  ts.forEachChild(n,v);
 })(tree);
 return out;
}
const methods={};
for(const f of sources){
 const h=methodsOf(baseline('web/src/'+f),f),n=methodsOf(read('web/src/'+f),f);
 if(f==='wallet.tsx')assert.deepEqual(n.filter(x=>x.place==='useWallet > disconnect'),[],'wallet.tsx: no wallet or RPC method inside disconnect()');
 assert.deepEqual(n,h,f+': a wallet or RPC method was added, removed, changed or moved');
 for(const x of n)methods[x.method]=(methods[x.method]||0)+1;
}
// v12: what the pages keep in the browser. Every use of localStorage, sessionStorage, indexedDB, cookie or caches, in
// order: HEAD's, including the three uses of the remembered "disconnected" flag in wallet.tsx (read once at start, cleared
// when Connect wallet is answered with an account, set by Disconnect). Its key is pinned with the names below.
const STORE=new Set(['localStorage','sessionStorage','indexedDB','cookie','caches']);
function storageOf(text,file){
 const tree=parse(text,file),print=printerOf(tree),out=[];
 (function v(n){if(ts.isIdentifier(n)&&STORE.has(n.text))out.push({text:print(top(n)),place:place(n,tree)});ts.forEachChild(n,v);})(tree);
 return out;
}
const storageAdded={};
for(const f of sources){
 const h=storageOf(baseline('web/src/'+f),f),n=storageOf(read('web/src/'+f),f),d=difference(h.map(x=>x.text+' @ '+x.place),n.map(x=>x.text+' @ '+x.place));
 assert.deepEqual({removed:d.removed.map(i=>h[i].text),added:d.added.map(i=>[n[i].text,n[i].place])},{removed:[],added:storageAdded[f]??[]},f+': browser storage is used differently from HEAD beyond the documented flag');
}
// The functions named `name` in a file (at any depth), printed without comments.
function functionsNamed(text,file,name){
 const tree=parse(text,file),print=printerOf(tree),out=[];
 (function v(n){if(ts.isFunctionDeclaration(n)&&n.name?.text===name)out.push(print(n));ts.forEachChild(n,v);})(tree);
 return out;
}
const pinnedFunctions={};
function sameFunction(f,name,what){
 const h=functionsNamed(baseline('web/src/'+f),f,name),n=functionsNamed(read('web/src/'+f),f,name);
 assert.equal(h.length,1,f+': one '+name+'() at HEAD');
 assert.deepEqual(n,h,f+' '+name+'() changed ('+what+')');
 pinnedFunctions[f+' '+name+'()']={equalToHead:true,length:n[0].length,sha256:sha256(n[0])};
}
// SPEC 6: compare the send head with HEAD itself byte for byte, including comments and whitespace.
function rawFunction(text,file,name){
 const tree=parse(text,file),found=[];
 (function visit(n){if(ts.isFunctionDeclaration(n)&&n.name?.text===name)found.push(n);ts.forEachChild(n,visit);})(tree);
 assert.equal(found.length,1,file+': one raw '+name+'()');
 return {tree,node:found[0],text:text.slice(found[0].getStart(tree),found[0].end)};
}
function sendParts(text){
 const f=rawFunction(text,'wallet.tsx','send'),wait=[];
 (function visit(n){if(ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>ts.isIdentifier(d.name)&&d.name.text==='receipt'&&d.initializer&&d.initializer.getText(f.tree).startsWith('await client.waitForTransactionReceipt(')))wait.push(n);ts.forEachChild(n,visit);})(f.node);
 assert.equal(wait.length,1,'wallet.tsx send(): one receipt wait statement');
 return {head:text.slice(f.node.getStart(f.tree),wait[0].end),tail:text.slice(wait[0].end,f.node.end)};
}
const headSend=sendParts(baseline('web/src/wallet.tsx')),nowSend=sendParts(read('web/src/wallet.tsx'));
assert.equal(nowSend.head,headSend.head,'wallet.tsx send(): byte-identical head through receipt wait');
// SPEC 6: mined hash, sent error-link hash, top link, confirmation record and both Confirmed reports.
// These exact replacements are independent of both regeneration blocks and each must occur exactly once.
const SEND_TAIL_PIECES=[
 ['      // After a Speed up the transaction is mined under another hash than the\n      // one the wallet returned: from here on the mined one is shown and read.\n      const mined = receipt.transactionHash;\n      sent = mined;\n      setHash(mined);\n',''],
 ['setConfirmed({ hash: mined, functionName: s.functionName });','setConfirmed({ hash: tx, functionName: s.functionName });'],
 ['report(key, { message: `${label}: Confirmed. Refreshing…`, hash: mined });','report(key, { message: `${label}: Confirmed. Refreshing…`, hash: tx });'],
 ['report(key, { message: `${label}: Confirmed.`, hash: mined, detail });','report(key, { message: `${label}: Confirmed.`, hash: tx, detail });'],
];
assert.equal(putBack(nowSend.tail,SEND_TAIL_PIECES,'wallet.tsx send() tail'),headSend.tail,'wallet.tsx send(): only exact receipt-hash tail replacements');
pinnedFunctions['wallet.tsx send()']={headEqualToHead:true,headBytes:Buffer.byteLength(nowSend.head,'utf8'),headSha256:sha256(nowSend.head),tailPieces:SEND_TAIL_PIECES.map(([now,head])=>({now,head}))};
// An explicit ordered pin of the changed transaction-status statements, independent of the piece list.
const sendTailWrites=[];
{const tree=parse(read('web/src/wallet.tsx'),'wallet.tsx'),print=printerOf(tree);
 (function visit(n){
  if(place(n,tree)==='useWallet > send'&&ts.isExpressionStatement(n)){
   const t=print(n);
   if(t==='sent = mined;'||t==='setHash(mined);'||t.startsWith('setConfirmed(')||t.startsWith('report(key, { message: `${label}: Confirmed.'))sendTailWrites.push(t);
  }
  ts.forEachChild(n,visit);
 })(tree);}
assert.deepEqual(sendTailWrites,[
 'sent = mined;',
 'setHash(mined);',
 'setConfirmed({ hash: mined, functionName: s.functionName });',
 'report(key, { message: `${label}: Confirmed. Refreshing…`, hash: mined });',
 'report(key, { message: `${label}: Confirmed.`, hash: mined, detail });',
],'wallet.tsx: exact ordered mined-hash state writes');
sameFunction('Flows.tsx','approveAll','SPEC 3/4 change presentation only');
const CONNECT="async function connect() { if (connectingLock.current) return; connectingLock.current = true; accountVersion.current++; const version = ++connectVersion.current; setConnecting(true); try { if (!window.ethereum) throw new Error(\"Open this page in your wallet app's browser\"); const a = await window.ethereum.request({ method: \"eth_requestAccounts\", }); if (version !== connectVersion.current) return; if (a[0]) { disconnected.current = false; try { localStorage.removeItem(disconnectedKey); } catch { } } setAccount(a[0]); setChainId(Number(await window.ethereum.request({ method: \"eth_chainId\" }))); setMessage(\"\"); } catch (e) { setMessage(explain(e)); } finally { connectingLock.current = false; setConnecting(false); } }";
const DISCONNECT="function disconnect() { if (sending.current) return; accountVersion.current++; connectVersion.current++; disconnected.current = true; try { localStorage.setItem(disconnectedKey, \"1\"); } catch { } setAccount(undefined); setHash(undefined); setMessage(\"Wallet disconnected from this page. To use another wallet, switch the address in your wallet app, then press Connect wallet.\"); }";
for(const [name,value] of [['connect',CONNECT],['disconnect',DISCONNECT]]){
 assert.deepEqual(functionsNamed(read('web/src/wallet.tsx'),'wallet.tsx',name),[value],'wallet.tsx '+name+'() differs from the pinned v12 text');
 pinnedFunctions['wallet.tsx '+name+'()']={pinnedText:true,length:value.length,sha256:sha256(value)};
}
// The existing startup guard stays exactly as at HEAD. A separate counter rejects a late Connect reply.
function intentStatements(text,name){
 const tree=parse(text,'wallet.tsx'),print=printerOf(tree),found=[];
 (function visit(n){if(ts.isIdentifier(n)&&n.text===name){let statement=n;while(statement.parent&&!ts.isStatement(statement))statement=statement.parent;found.push([print(statement),place(n,tree)]);}ts.forEachChild(n,visit);})(tree);
 return found;
}
const accountIntentUses=intentStatements(read('web/src/wallet.tsx'),'accountVersion');
assert.deepEqual(accountIntentUses,intentStatements(baseline('web/src/wallet.tsx'),'accountVersion'),'wallet.tsx: accountVersion guard equals HEAD');
assert.deepEqual(accountIntentUses,[['const accountVersion = useRef(0);','useWallet'],['accountVersion.current++;','useWallet'],['const version = accountVersion.current;','useWallet'],['if (version === accountVersion.current) accounts(a);','useWallet'],['accountVersion.current++;','useWallet'],['accountVersion.current++;','useWallet > connect'],['accountVersion.current++;','useWallet > disconnect']],'wallet.tsx: exact startup account intent guard');
assert.deepEqual(intentStatements(read('web/src/wallet.tsx'),'connectVersion'),[
 ['const connectVersion = useRef(0);','useWallet'],
 ['const version = ++connectVersion.current;','useWallet > connect'],
 ['if (version !== connectVersion.current) return;','useWallet > connect'],
 ['connectVersion.current++;','useWallet > disconnect'],
],'wallet.tsx: the separate counter advances only in connect/disconnect and is read only in connect');
function hookReturn(text){
 const tree=parse(text,'wallet.tsx'),print=printerOf(tree),hook=tree.statements.filter(st=>ts.isFunctionDeclaration(st)&&st.name?.text==='useWallet');
 assert.equal(hook.length,1,'wallet.tsx: one useWallet');
 const returns=hook[0].body.statements.filter(ts.isReturnStatement);
 assert.equal(returns.length,1,'wallet.tsx useWallet: one return');
 return print(returns[0]);
}
assert.equal(hookReturn(read('web/src/wallet.tsx')),hookReturn(baseline('web/src/wallet.tsx')),'wallet.tsx: hook returns HEAD\'s unchanged list');
// SPEC protected code: raw bytes, including entire buttons and effects, independent of generated differences.
const protectedCode={sendTailWrites};
function rawProtected(label,file,select,count=1){
 const list=text=>{const tree=parse(text,file),found=[];(function visit(n){if(select(n,tree))found.push(text.slice(n.getStart(tree),n.end));ts.forEachChild(n,visit);})(tree);return found;};
 const h=list(baseline('web/src/'+file)),n=list(read('web/src/'+file));
 assert.equal(h.length,count,label+': protected baseline count');
 assert.deepEqual(n,h,label+': bytes differ from HEAD');
 protectedCode[label]=h.map(x=>({bytes:Buffer.byteLength(x,'utf8'),sha256:sha256(x)}));
}
for(const name of ['switchChain','listingPending','waitPending'])rawProtected('wallet '+name,'wallet.tsx',n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);
// Owner-approved issue-only notice and Deposit-only Closed LED: only these exact pieces may differ.
// Every original calculation, status branch, clock use and Retry handler restores byte-for-byte to HEAD.
const DEPOSIT_STATE_PIECES=[
 [
  "export function DepositState({ snapshot: s, showSign = false }: { snapshot: Snapshot; showSign?: boolean }) {",
  "export function DepositState({ snapshot: s }: { snapshot: Snapshot }) {"
 ],
 [
  "\n  // The owner wants a notice only for closed deposits or an unreadable status.\n  const statusUnreadable =\n    !s.complete || !r?.ok || s.globals.genesisFinalized === undefined;\n  const operational =\n    !statusUnreadable && reason === 0 && s.globals.genesisFinalized === true &&\n    s.assets.some((a) => a.open && !a.retired);\n  if (s.loading || operational || closed === mayBeOpen) return null;\n  const issueReason = s.globals.genesisFinalized === false ? 1\n    : !s.assets.length ? 4\n      : s.assets.every((a) => !a.open || a.retired) ? 5\n        : reason === 13 ? 9 : reason;\n  const issue = reasonWords(issueReason, s.globals.settings).split(\" (\")[0];\n  const weekendHours = reason === 3 &&\n    s.globals.settings?.hoursFrom === 72000n && s.globals.settings?.hoursTo === 504000n;\n  return (\n    <div className={showSign ? \"deposit-state deposit-notice\" : \"deposit-state\"}>\n      {statusUnreadable ? (\n        <>\n          {!showSign && <strong>Vault status:</strong>}\n          <p>unreadable — Retry vault</p>\n          <button onClick={s.retry}>Retry vault</button>\n        </>\n      ) : showSign ? (\n        <>\n          <DepositLedSign />\n          <p>{weekendHours\n            ? \"Deposits reopen when the stock feed prices update around 8pm on Sundays.\"\n            : `Deposits will be back open when “${issue}” is resolved.`}</p>\n        </>\n      ) : (\n        <><strong>Vault status:</strong><p>Closed</p></>\n      )}\n    </div>\n  );\n}",
  "\n  return (\n    <div className=\"deposit-state\">\n      <strong>Vault deposit status</strong>\n      <p>\n        {s.loading\n          ? \"Reading...\"\n          : !s.assets.length &&\n              s.complete &&\n              s.globals.genesisFinalized === false\n            ? \"No Stock Tokens are listed yet. Deposits start after the owner finishes setup.\"\n            : s.assets.length > 0 &&\n                s.assets.every((a) => !a.open || a.retired) &&\n                s.globals.genesisFinalized\n              ? \"Every stock is closed. The owner must reopen a stock before deposits.\"\n              : !r || !r.ok\n                ? \"unreadable — Retry vault\"\n                : reasonWords(Number(r.value[0]), s.globals.settings)}\n      </p>\n      {r?.ok && r.value[1] !== zeroAddress && (\n        <p>\n          Stock at fault:{\" \"}\n          {s.assets.find(\n            (a) => a.token.toLowerCase() === r.value[1].toLowerCase(),\n          )?.symbol ?? r.value[1]}\n        </p>\n      )}\n      {closed && <p className=\"reopen\">{closed}</p>}\n      <p>Hours: {s.loading ? \"Reading...\" : hoursLine(s.globals.settings)}</p>\n      {!s.loading && (!r || !r.ok) && (\n        <button onClick={s.retry}>Retry vault</button>\n      )}\n    </div>\n  );\n}"
 ]
];
const headDepositState=rawFunction(baseline('web/src/Vault.tsx'),'Vault.tsx','DepositState').text;
const nowDepositState=rawFunction(read('web/src/Vault.tsx'),'Vault.tsx','DepositState').text;
assert.equal(putBack(nowDepositState,DEPOSIT_STATE_PIECES,'Vault DepositState'),headDepositState,'Vault DepositState: only exact owner-approved issue-only presentation pieces');
protectedCode['Vault DepositState']={headBytes:Buffer.byteLength(headDepositState,'utf8'),headSha256:sha256(headDepositState),pieces:DEPOSIT_STATE_PIECES};
// These independent raw pins bind the reviewed local LED renderer and its glyph data outside regeneration.
const depositSignPins={DepositLedSign:"5261668a5c55b74287e3dc342168e9176be06b3c7bbd46b0ae98106dc733cf29",DEPOSIT_LETTERS:"4942959fd3db1936945a38cf0bb15be49da43088af5d080c224a19d8e33e44fd"};
for(const [name,digest] of Object.entries(depositSignPins)){
 const text=read('web/src/Vault.tsx'),tree=parse(text,'Vault.tsx');
 const found=tree.statements.filter(n=>(ts.isFunctionDeclaration(n)&&n.name?.text===name)||(ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>ts.isIdentifier(d.name)&&d.name.text===name)));
 assert.equal(found.length,1,'Vault: one top-level '+name);
 assert.equal(sha256(text.slice(found[0].getStart(tree),found[0].end)),digest,'Vault: exact reviewed '+name);
}
const depositStateUses=[];
for(const f of sources){const tree=parse(read('web/src/'+f),f),print=printerOf(tree);(function visit(n){if((ts.isJsxSelfClosingElement(n)||ts.isJsxOpeningElement(n))&&n.tagName.getText(tree)==='DepositState')depositStateUses.push([f,place(n,tree),print(n)]);ts.forEachChild(n,visit);})(tree);}
assert.deepEqual(depositStateUses,[['Flows.tsx','DepositPage','<DepositState snapshot={s} showSign/>'],['Vault.tsx','VaultPage','<DepositState snapshot={s}/>']],'DepositState: the approved sign is enabled only on Deposit');
protectedCode.depositSign={rawPins:depositSignPins,uses:depositStateUses};
rawProtected('Flows approveAll','Flows.tsx',n=>ts.isFunctionDeclaration(n)&&n.name?.text==='approveAll');
rawProtected('Flows onSubmit','Flows.tsx',n=>ts.isJsxAttribute(n)&&n.name.getText()==='onSubmit',2);
rawProtected('Flows getSpec','Flows.tsx',n=>ts.isJsxAttribute(n)&&n.name.getText()==='getSpec',3);
rawProtected('Flows transaction buttons','Flows.tsx',n=>ts.isJsxSelfClosingElement(n)&&n.tagName.getText()==='TxButton',3);
rawProtected('Claims Claim all handler','Flows.tsx',(n,t)=>ts.isJsxAttribute(n)&&n.name.getText(t)==='onClick'&&n.getText(t).includes('claimable.slice'));
const effect=(component,needle)=>(n,t)=>ts.isCallExpression(n)&&['useEffect','useLayoutEffect'].includes(n.expression.getText(t))&&place(n,t)===component&&n.getText(t).includes(needle);
rawProtected('Claims owed read','Flows.tsx',effect('Claims','vault("owed"'));
rawProtected('Deposit simulate effect','Flows.tsx',effect('DepositPage','simulate('));
rawProtected('Deposit confirmed reset','Flows.tsx',effect('DepositPage','setInputs({})'));
rawProtected('Deposit receipt read','Flows.tsx',effect('DepositPage','.getTransactionReceipt('));
for(const name of ['short','approvals'])rawProtected('Deposit '+name,'Flows.tsx',(n,t)=>ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&n.name.text===name&&place(n,t)==='DepositPage');


// Names. In the v12 files every name HEAD declares at the top of the file (imports included) and at the top of each
// component or hook (parameters included) is still declared there once, by the same text: the same import, the same
// useState or useRef, the same expression. So `vault`, `token`, `amount`, `depositArgs`, `VAULT`, `quote`, `inputs`,
// `open`, `approvals`, `account` and every other name the pinned transaction code uses still mean what they meant at
// HEAD. The names v12 adds at the top of a file are listed here; a name v12 adds at the top of a component or hook
// must be new there and must not hide a name declared at the top of the file.
function scopes(text,file){
 const tree=parse(text,file),print=printerOf(tree),module=Object.create(null),functions=Object.create(null);
 const put=(map,name,what)=>(map[name]??=[]).push(what);
 const bound=(b,f)=>{if(ts.isIdentifier(b))f(b.text);else for(const e of b.elements)if(!ts.isOmittedExpression(e))bound(e.name,f);};
 const level=(statements,map)=>{for(const st of statements){
  if(ts.isVariableStatement(st))for(const d of st.declarationList.declarations)bound(d.name,name=>put(map,name,print(d)));
  if((ts.isFunctionDeclaration(st)||ts.isClassDeclaration(st))&&st.name)put(map,st.name.text,ts.isFunctionDeclaration(st)?'function':'class');
 }};
 for(const st of tree.statements)if(ts.isImportDeclaration(st)&&st.importClause){
  const from=' from '+st.moduleSpecifier.getText(tree),c=st.importClause,b=c.namedBindings;
  if(c.name)put(module,c.name.text,'import default'+from);
  if(b&&ts.isNamespaceImport(b))put(module,b.name.text,'import *'+from);
  if(b&&ts.isNamedImports(b))for(const e of b.elements)put(module,e.name.text,(c.isTypeOnly||e.isTypeOnly?'import type ':'import ')+(e.propertyName?e.propertyName.text+' as ':'')+e.name.text+from);
 }
 level(tree.statements,module);
 for(const st of tree.statements)if(ts.isFunctionDeclaration(st)&&st.name&&st.body){const map=functions[st.name.text]=Object.create(null);for(const p of st.parameters)bound(p.name,name=>put(map,name,'parameter '+print(p)));level(st.body.statements,map);}
 return {module,functions};
}
// Scoping. The transaction code of a v12 file is send(), approveAll() and every attribute that builds or starts a
// transaction or holds a guarded call. A name used in it is declared inside that code itself, at the top of its
// component or hook, at the top of the file, or by something wrapped around the code in between (as the `a` of a
// list's map() is at HEAD). This lists every name of the last kind with its declaration; the list must equal HEAD's,
// so no function or block put around unchanged transaction code can give one of its names another meaning.
function wrappedNames(text,file,functionNames){
 const tree=parse(text,file),print=printerOf(tree),out=[];
 const each=(b,f)=>{if(ts.isIdentifier(b))f(b.text);else for(const e of b.elements)if(!ts.isOmittedExpression(e))each(e.name,f);};
 // What a function, block, catch or loop declares itself: name -> printed declaration.
 const made=s=>{const d=new Map(),add=(b,node)=>each(b,name=>d.set(name,print(node)));
  if(ts.isFunctionLike(s)){for(const p of s.parameters)add(p.name,p);if(ts.isFunctionExpression(s)&&s.name)d.set(s.name.text,'its own name');}
  if(ts.isCatchClause(s)&&s.variableDeclaration)add(s.variableDeclaration.name,s.variableDeclaration);
  if((ts.isForStatement(s)||ts.isForOfStatement(s)||ts.isForInStatement(s))&&s.initializer&&ts.isVariableDeclarationList(s.initializer))for(const x of s.initializer.declarations)add(x.name,x);
  if(ts.isBlock(s)||ts.isCaseClause(s)||ts.isDefaultClause(s))for(const st of s.statements){if(ts.isVariableStatement(st))for(const x of st.declarationList.declarations)add(x.name,x);if((ts.isFunctionDeclaration(st)||ts.isClassDeclaration(st))&&st.name)d.set(st.name.text,'function or class '+st.name.text);}
  return d;},known=new Map(),declares=s=>known.get(s)??known.set(s,made(s)).get(s);
 const within=(n,x)=>{for(;n;n=n.parent)if(n===x)return true;return false;};
 let count=0;
 const code=(x,label)=>{const k=++count,component=(()=>{let c;for(let p=x;p;p=p.parent)if(ts.isFunctionDeclaration(p)&&ts.isSourceFile(p.parent))c=p;return c;})();
  (function v(n){
   if(ts.isTypeNode(n))return;
   if(ts.isIdentifier(n))for(let s=n.parent;s&&s!==component;s=s.parent){
    const how=declares(s).get(n.text);
    if(how===undefined)continue;
    if(!within(s,x)&&s!==component?.body)out.push('#'+k+' '+label+': '+n.text+' is declared around it by '+how);
    break;
   }
   ts.forEachChild(n,v);
  })(x);};
 (function v(n){
  if(ts.isFunctionDeclaration(n)&&n.name&&functionNames.includes(n.name.text))code(n,n.name.text+'()');
  else if(ts.isJsxAttribute(n)&&isAction(n.name.getText(tree))&&(TX_ATTRIBUTES.has(n.name.getText(tree))||(function g(m){return isGuarded(m,tree)||!!ts.forEachChild(m,g);})(n)))code(n,place(n.parent,tree)+' '+n.name.getText(tree));
  ts.forEachChild(n,v);
 })(tree);
 return {count,names:[...new Set(out)]};
}
const transactionCode={};
for(const f of Object.keys(editedFiles)){
 const pinnedHere=f==='wallet.tsx'?['send']:f==='Flows.tsx'?['approveAll']:[],h=wrappedNames(baseline('web/src/'+f),f,pinnedHere),n=wrappedNames(read('web/src/'+f),f,pinnedHere);
 assert.deepEqual(n,h,f+': a name used by the transaction code is declared around it differently from HEAD');
 transactionCode[f]={pieces:n.count,namesDeclaredAroundThem:n.names};
}
const namesAdded={
 "Vault.tsx": {
  "DEPOSIT_LETTERS": "DEPOSIT_LETTERS: Record<string, string[]> = { O: [\"01110\", \"10001\", \"10001\", \"10001\", \"10001\", \"10001\", \"01110\"], E: [\"11111\", \"10000\", \"10000\", \"11110\", \"10000\", \"10000\", \"11111\"], C: [\"01111\", \"10000\", \"10000\", \"10000\", \"10000\", \"10000\", \"01111\"], L: [\"10000\", \"10000\", \"10000\", \"10000\", \"10000\", \"10000\", \"11111\"], S: [\"01111\", \"10000\", \"10000\", \"01110\", \"00001\", \"00001\", \"11110\"], D: [\"11110\", \"10001\", \"10001\", \"10001\", \"10001\", \"10001\", \"11110\"], }",
  "DepositLedSign": "function"
 },
 "components.tsx": {},
 "Docs.tsx": {},
 "Flows.tsx": {},
 "wallet.tsx": {},
 "main.tsx": {
  "Activity": "import Activity from \"react\""
 }
};
// Exact removal of the unused display-only hoursLine import for the owner-approved status move.
const moduleChanges={
 "Vault.tsx": [],
 "components.tsx": [],
 "Docs.tsx": [],
 "Flows.tsx": [
  {
   "name": "hoursLine",
   "head": [
    "import hoursLine from \"./Vault\""
   ],
   "now": null
  }
 ],
 "wallet.tsx": [],
 "main.tsx": []
};
// Narrow exact declarations changed by SPEC 1/4 and the owner-approved status move; never generated by put-pieces.
const scopeChanges={
 "Vault.tsx": [
  {
   "function": "DepositState",
   "name": "s",
   "head": [
    "parameter { snapshot: s }: { snapshot: Snapshot; }"
   ],
   "now": [
    "parameter { snapshot: s, showSign = false }: { snapshot: Snapshot; showSign?: boolean; }"
   ]
  }
 ],
 "components.tsx": [
  {
   "function": "PageTitle",
   "name": "eyebrow",
   "head": [
    "parameter { eyebrow, title, children, character, }: { eyebrow?: string; title: string; children: ReactNode; character?: { kind: \"vault\" | \"deposit\" | \"redeem\"; src: string; width: number; height: number; alt: string; line: string; }; }"
   ],
   "now": [
    "parameter { eyebrow, title, children, character, }: { eyebrow?: string; title: string; children?: ReactNode; character?: { kind: \"vault\" | \"deposit\" | \"redeem\"; src: string; width: number; height: number; alt: string; line: string; }; }"
   ]
  },
  {
   "function": "PageTitle",
   "name": "title",
   "head": [
    "parameter { eyebrow, title, children, character, }: { eyebrow?: string; title: string; children: ReactNode; character?: { kind: \"vault\" | \"deposit\" | \"redeem\"; src: string; width: number; height: number; alt: string; line: string; }; }"
   ],
   "now": [
    "parameter { eyebrow, title, children, character, }: { eyebrow?: string; title: string; children?: ReactNode; character?: { kind: \"vault\" | \"deposit\" | \"redeem\"; src: string; width: number; height: number; alt: string; line: string; }; }"
   ]
  },
  {
   "function": "PageTitle",
   "name": "children",
   "head": [
    "parameter { eyebrow, title, children, character, }: { eyebrow?: string; title: string; children: ReactNode; character?: { kind: \"vault\" | \"deposit\" | \"redeem\"; src: string; width: number; height: number; alt: string; line: string; }; }"
   ],
   "now": [
    "parameter { eyebrow, title, children, character, }: { eyebrow?: string; title: string; children?: ReactNode; character?: { kind: \"vault\" | \"deposit\" | \"redeem\"; src: string; width: number; height: number; alt: string; line: string; }; }"
   ]
  },
  {
   "function": "PageTitle",
   "name": "character",
   "head": [
    "parameter { eyebrow, title, children, character, }: { eyebrow?: string; title: string; children: ReactNode; character?: { kind: \"vault\" | \"deposit\" | \"redeem\"; src: string; width: number; height: number; alt: string; line: string; }; }"
   ],
   "now": [
    "parameter { eyebrow, title, children, character, }: { eyebrow?: string; title: string; children?: ReactNode; character?: { kind: \"vault\" | \"deposit\" | \"redeem\"; src: string; width: number; height: number; alt: string; line: string; }; }"
   ]
  }
 ],
 "Docs.tsx": [],
 "Flows.tsx": [
  {
   "function": "DepositPage",
   "name": "r",
   "head": [
    "r = s.status"
   ],
   "now": null
  },
  {
   "function": "DepositPage",
   "name": "reason",
   "head": [
    "reason = r?.ok ? Number(r.value[0]) : undefined"
   ],
   "now": null
  },
  {
   "function": "Claims",
   "name": "zeros",
   "head": [
    "zeros = s.assets.filter((a) => owed[a.token] === 0n)"
   ],
   "now": null
  }
 ],
 "wallet.tsx": [],
 "main.tsx": []
};
const newNames={};
for(const f of Object.keys(editedFiles)){
 const h=scopes(baseline('web/src/'+f),f),n=scopes(read('web/src/'+f),f);
 for(const name in h.module){
  const change=moduleChanges[f]?.find(x=>x.name===name);
  if(change){assert.deepEqual(h.module[name],change.head,f+': module exception baseline');assert.deepEqual(n.module[name]??null,change.now,f+': exact approved module declaration change');}
  else assert.deepEqual(n.module[name],h.module[name],f+': '+name+' is declared differently at the top of the file');
 }
 assert.deepEqual(Object.fromEntries(Object.keys(n.module).filter(name=>!(name in h.module)).map(name=>[name,n.module[name].join(' | ')])),namesAdded[f],f+': the names added at the top of the file (imports included) differ from the documented ones');
 for(const fn in h.functions){
  const was=h.functions[fn],is=n.functions[fn];
  assert.ok(is,f+': '+fn+' is gone');
  for(const name in was){
   const change=scopeChanges[f]?.find(x=>x.function===fn&&x.name===name);
   if(change){assert.deepEqual(was[name],change.head,f+' '+fn+': declaration exception baseline');assert.deepEqual(is[name]??null,change.now,f+' '+fn+': exact approved declaration change');}
   else assert.deepEqual(is[name],was[name],f+' '+fn+': '+name+' is declared differently');
  }
  const added=Object.keys(is).filter(name=>!(name in was));
  for(const name of added){assert.equal(is[name].length,1,f+' '+fn+': '+name+' is declared twice');assert.ok(!(name in n.module),f+' '+fn+': the new name '+name+' hides a name declared at the top of the file');}
  if(added.length)(newNames[f]??={})[fn]=added;
 }
}
// The whole-source digest is additional to the specific structural assertions above.
for(const [f,digest] of Object.entries(reviewedSourcePins))assert.equal(sha256(read('web/src/'+f)),digest,f+': reviewed v12 source differs; regeneration does not authorize source edits');
// Differential encoding: HEAD and current governance/model/chain bundled side by side. For the same inputs the
// calldata must be byte-identical whenever the current page accepts; v12 adds no refusal, never accepts what HEAD
// refused, and refuses with HEAD's words (model.ts, chain.ts and governance.ts are byte-identical to HEAD in v12).
const scratch=path.join(root,'test/scratch/calldata');
fs.rmSync(scratch,{recursive:true,force:true});
for(const p of git(['ls-tree','-r','--name-only','HEAD','web/src']).trim().split('\n').filter(p=>/\.(tsx?|json)$/.test(p))){
 const out=path.join(scratch,'head',p.slice(4));fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,baseline(p));
}
const entry=src=>`export { proposalSpec, proposalAction } from "${src}/governance";\nexport { parseLaunch, address, recipient, amount, uint, deadline, depositArgs, redeemArgs } from "${src}/model";\nexport { encode, vault, token, VAULT } from "${src}/chain";\nexport { newOwner } from "${src}/governance";\n`;
fs.writeFileSync(path.join(scratch,'head-entry.ts'),entry('./head/src'));
fs.writeFileSync(path.join(scratch,'now-entry.ts'),entry('../../../web/src'));
const bundle=async name=>{const outfile=path.join(scratch,name+'.mjs');await build({entryPoints:[path.join(scratch,name+'-entry.ts')],bundle:true,format:'esm',platform:'node',outfile,nodePaths:[path.resolve('node_modules')],logLevel:'error'});return import(pathToFileURL(outfile).href);};
const head=await bundle('head'),now=await bundle('now');
const SPRING='Sunday 2:00-2:59 am New York is skipped on the spring-forward Sunday; choose another start.';
const U128='Minimum raw pool liquidity: enter an unsigned 128-bit whole number.';
const V=now.VAULT,A='0x1111111111111111111111111111111111111111',B='0x2222222222222222222222222222222222222222',Z='0x0000000000000000000000000000000000000000';
const badChecksum='0x'+V.slice(2).replace(/[a-f]/,c=>c.toUpperCase());
const addrs=[A,B,V,V.toUpperCase().replace('0X','0x'),Z,'bad','',badChecksum];
const liqs=['0','1','1000000',String(2n**128n-1n),String(2n**128n),String(2n**200n),String(2n**256n-1n),String(2n**256n),'-1','1.5',' 7',''];
const hourTexts=['Monday 9:30 am','Friday 4:00 pm','Sunday 8:00 pm','Saturday 24:00','Sunday 12:00 am','Sunday 1:59 am','Sunday 2:00 am','Sunday 2:30 am','Sunday 2:59 am','Sunday 3:00 am','Always open','Monday 24:00','junk'];
const values=['0','1','2','3','4','10','48','49','50','299','300','2000','3600','20000','86400','500000','500001',String(2n**256n-1n),String(2n**256n),'1.5',''];
const settingsList=[undefined,{dst:0n},{dst:1n},{dst:2n}];
const cases=[];
for(const token of [A,V,Z,'bad'])for(const feed of [B,V,Z])for(const pool of [A,V,Z])for(const quoteFeed of [B,Z])for(const minLiquidity of liqs)cases.push([0,{token,feed,pool,quoteFeed,minLiquidity}]);
for(const token of addrs)for(const feed of addrs)cases.push([1,{token,feed}]);
for(const k of [2,3,4,6])for(const token of addrs)cases.push([k,{token}]);
for(const token of [A,V,'bad'])for(const pool of [A,V,Z])for(const quoteFeed of [B,Z])for(const minLiquidity of liqs)cases.push([5,{token,pool,quoteFeed,minLiquidity}]);
for(const next of addrs)cases.push([7,{next}]);
for(const cap of ['0','1','1.5','10000000000','10000000000.000000000000000001','x',''])cases.push([8,{cap}]);
for(const recipient of addrs)cases.push([9,{recipient}]);
for(let k=0;k<=16;k++)if(k!==5)for(const value of values)cases.push([10,{setting:String(k),value}]);
for(const from of hourTexts)for(const to of hourTexts)for(const settings of settingsList)cases.push([10,{setting:'5',from,to},settings]);
for(const k of [11,-1])cases.push([k,{}]);
const attempt=f=>{try{return {hex:f()};}catch(e){return {error:e.message};}};
const tally={sameCalldata:0,bothRefused:0,newRefusals:{},refusedBoth:{}};
function compare(label,input,h,n,newRefusalAllowed,t=tally){
 if(n.hex!==undefined){assert.ok(h.hex!==undefined,label+' accepted input HEAD refused: '+JSON.stringify(input));assert.equal(n.hex,h.hex,label+' calldata changed for '+JSON.stringify(input));t.sameCalldata++;}
 else if(h.hex!==undefined){assert.ok(newRefusalAllowed(n.error),label+' new refusal not documented: '+n.error+' for '+JSON.stringify(input));t.newRefusals[n.error]=(t.newRefusals[n.error]||0)+1;}
 else {assert.equal(n.error,h.error,label+' refusal words changed for '+JSON.stringify(input));t.bothRefused++;if(t.refusedBoth)t.refusedBoth[n.error]=(t.refusedBoth[n.error]||0)+1;}
}
const json=x=>JSON.parse(JSON.stringify(x,(k,v)=>typeof v==='bigint'?String(v):v));
for(const [kind,v,settings] of cases){
 const h=attempt(()=>head.encode(head.proposalSpec(kind,v,settings))),n=attempt(()=>now.encode(now.proposalSpec(kind,v,settings)));
 compare('propose',json({kind,v,settings}),h,n,()=>false);
}
for(const next of addrs)compare('transferOwnership',{next},attempt(()=>head.encode(head.vault('transferOwnership',[head.newOwner(next)]))),attempt(()=>now.encode(now.vault('transferOwnership',[now.newOwner(next)]))),()=>false);
for(const pool of [A,Z])for(const quoteFeed of [B,Z])for(const minLiquidity of liqs){
 const text=`AAA ${A} ${B} ${pool} ${quoteFeed} ${minLiquidity}\nBBB ${B} ${A} ${Z} ${Z} 0`;
 const listing=m=>m.parseLaunch(text).map(r=>m.encode(m.vault('listGenesis',[r.token,r.feed,r.pool,r.quoteFeed,r.minLiquidity]))).join();
 compare('listGenesis',{text},attempt(()=>listing(head)),attempt(()=>listing(now)),()=>false);
}
// Deposit, redeem, claim, approve and owner-button calls built from the model parsers, compared under fixed clocks so
// deadline() (the clock plus 600 s, the last argument of every deposit and redeem) is compared too. Here no new
// refusal is allowed: every input must give the same calldata as HEAD or be refused by both.
const sends={},clock=Date.now;
const cmp=(label,input,f)=>compare(label,input,attempt(()=>f(head)),attempt(()=>f(now)),()=>false,sends[label]??={sameCalldata:0,bothRefused:0,newRefusals:{}});
const clocks=[0,999,1791000000000,1791000000999,1791006123456.7,4102444800000];
const amountTexts=['0','1','1.5','0.000001','0.0000001','1.000000000000000001','1.0000000000000000001','10000000000',
 '115792089237316195423570985008687907853269984665640564039457.584007913129639935','115792089237316195423570985008687907853269984665640564039457.584007913129639936',
 String(2n**256n-1n),String(2n**256n),' 2 ','2.','.5','-1','1e18','x',''];
const legsList=[[],[0n],[0n,3333n],[1n,999n,1000n,10n**18n,2n**200n]];
const depositInputs=[[[A,B],[1n,2n],A,1000n],[[A],[0n],B,0n],[[B,A,V],[10n**18n,3n,2n**255n],A,2n**256n-1n],[[],[],A,999n]];
try{
 for(const t of clocks){
  Date.now=()=>t;
  assert.equal(String(now.deadline()),String(head.deadline()),'deadline() at clock '+t);
  for(const args of depositInputs){
   assert.deepEqual(json(now.depositArgs(...args)),json(head.depositArgs(...args)),'depositArgs (all five arguments, deadline included) at clock '+t);
   cmp('deposit',json({clock:t,args}),m=>m.encode(m.vault('deposit',m.depositArgs(...args))));
  }
  for(const shares of [0n,10n,2n**256n-1n])for(const legs of legsList){
   assert.deepEqual(json(now.redeemArgs(shares,A,legs)),json(head.redeemArgs(shares,A,legs)),'redeemArgs (all four arguments, deadline included) at clock '+t);
   cmp('redeemArgs',json({clock:t,shares,legs}),m=>m.encode(m.vault('redeem',m.redeemArgs(shares,A,legs))));
  }
 }
 Date.now=()=>1791000000000;
 // Redeem as Flows builds it: amount(input) shares, recipient(to), redeemArgs(shares, receiver, previewRedeem amounts).
 for(const text of amountTexts)for(const to of addrs)for(const legs of legsList.slice(1,3))
  cmp('redeem',json({text,to,legs}),m=>m.encode(m.vault('redeem',m.redeemArgs(m.amount(text),m.recipient(to),legs))));
 // Deposit amounts (amount(input, false, tokenDecimals)) and the approve built from them.
 for(const text of amountTexts)for(const d of [0,6,8,18])cmp('approve',{text,d},m=>m.encode(m.token(A,'approve',[m.VAULT,m.amount(text,false,d)])));
 // Claim and Claim all: vault("claim", [tokens, recipient(to)]).
 for(const to of addrs)for(const tokens of [[A],[A,B],Array(10).fill(B)])cmp('claim',{to,tokens},m=>m.encode(m.vault('claim',[tokens,m.recipient(to)])));
 // Owner buttons: lowerNAVCap(amount(cap, true)), close and removeRetired(address(token)).
 for(const text of amountTexts)cmp('lowerNAVCap',{text},m=>m.encode(m.vault('lowerNAVCap',[m.amount(text,true)])));
 for(const fn of ['close','removeRetired'])for(const v of addrs)cmp(fn,{v},m=>m.encode(m.vault(fn,[m.address(v)])));
 // The parsers' values themselves.
 for(const v of [...liqs,...amountTexts])for(const bits of [128,256])cmp('uint',{v,bits},m=>String(m.uint(v,bits)));
 for(const v of addrs)for(const zero of [false,true])cmp('address',{v,zero},m=>m.address(v,zero));
}finally{Date.now=clock;}
for(const [label,t] of Object.entries(sends)){
 assert.ok(t.sameCalldata>0,label+': corpus has accepted inputs');
 if(!['deposit','redeemArgs'].includes(label))assert.ok(t.bothRefused>0,label+': corpus has refused inputs');
}
// The transaction-argument builders and parsers, printed without comments, also equal HEAD.
const pinned={'web/src/model.ts':['same','deadline','depositArgs','redeemArgs','amount','address','recipient','uint','parseLaunch'],'web/src/chain.ts':['vault','token','encode']};
function declarations(file,text,list){
 const tree=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS),printer=ts.createPrinter({removeComments:true}),out={};
 for(const st of tree.statements){
  if(ts.isFunctionDeclaration(st)&&st.name&&list.includes(st.name.text))out[st.name.text]=printer.printNode(ts.EmitHint.Unspecified,st,tree);
  if(ts.isVariableStatement(st))for(const d of st.declarationList.declarations)if(ts.isIdentifier(d.name)&&list.includes(d.name.text))out[d.name.text]=printer.printNode(ts.EmitHint.Unspecified,st,tree);
 }
 // Functions inside components (checkRows in LaunchListing): any depth, exactly one declaration.
 (function v(n){if(n!==tree&&ts.isFunctionDeclaration(n)&&n.name&&list.includes(n.name.text)&&n.parent!==tree){assert.ok(!out[n.name.text],file+': one '+n.name.text);out[n.name.text]=printer.printNode(ts.EmitHint.Unspecified,n,tree);}ts.forEachChild(n,v);})(tree);
 for(const n of list)assert.ok(out[n],file+': '+n+' found');
 return out;
}
for(const [file,list] of Object.entries(pinned)){
 const n=declarations(file,read(file),list),h=declarations(file,baseline(file),list);
 for(const k of list)assert.equal(n[k],h[k],file+': '+k+' changed');
}
// A6 G-B: where the send arguments come from. Printed without comments (whitespace folded), each declaration equals
// HEAD (v12 documents no piece: the [v12, HEAD] lists are empty), or equals the pinned v9 text: the Guardian and
// FeeRecipient proposal targets (newGuardian(v.next), feeRecipient(v.recipient)), the parsers they use, and the
// listing rows (checkRows) and the Finalize helpers.
const pinnedV9={
 'web/src/governance.ts':{
  proposalAction:[],
  proposalSpec:[],
  settingValues:[],
  poolValues:[],
  newOwner:'export function newOwner(v: string): Address { const next = address(v); if (same(next, VAULT)) throw new InputError("The new owner must not be the vault."); return next; }',
  newGuardian:'function newGuardian(v: string): Address { const next = address(v); if (same(next, VAULT)) throw new InputError("The new guardian must not be the vault."); return next; }',
  feeRecipient:'function feeRecipient(v: string): Address { const target = address(v); if (same(target, VAULT)) throw new InputError("The fee recipient must not be the vault."); return target; }',
  minLiquidityOf:'function minLiquidityOf(v: string) { try { return uint(v, 128); } catch { throw new InputError("Minimum raw pool liquidity: enter an unsigned 128-bit whole number."); } }',
  springForwardStart:'export function springForwardStart(from: bigint, dst: bigint) { return dst === 0n && from >= 7200n && from < 10800n; }',
  SPRING_FORWARD_START:'export const SPRING_FORWARD_START = "Sunday 2:00-2:59 am New York is skipped on the spring-forward Sunday; choose another start.";'},
 'web/src/Owner.tsx':{
  checkRows:[],
  listedDiffers:'function listedDiffers(assets: Asset[], r: ReturnType<typeof parseLaunch>[number]) { const a = assets.find((x) => same(x.token, r.token)); return (!!a && (!same(a.feed, r.feed) || !same(a.pool, r.pool) || !same(a.quoteFeed, r.quoteFeed) || a.minLiquidity !== r.minLiquidity)); }',
  differWords:'const differWords = (tickers: string[]) => `Listed with other values than the pasted lines: ${tickers.join(", ")}. Check pairings shows which field; paste the lines that were listed.`;',
  PASTE_FIRST:'const PASTE_FIRST = "Paste the listing rows first so the page can check none is missing.";'},
};
const one=s=>s.replace(/\s+/g,' ');
// The v9 text, as pinned, also stands at HEAD.
for(const [file,map] of Object.entries(pinnedV9)){
 const h=declarations(file,baseline(file),Object.keys(map));
 for(const [k,x] of Object.entries(map))if(typeof x==='string')assert.equal(one(h[k]),x,file+': '+k+' at HEAD differs from the pinned v9 text');
}
for(const [file,map] of Object.entries(pinnedV9)){
 const list=Object.keys(map),n=declarations(file,read(file),list),old=list.filter(k=>typeof map[k]!=='string'),h=declarations(file,baseline(file),old);
 for(const k of list)assert.equal(typeof map[k]==='string'?one(n[k]):putBack(one(n[k]),map[k],file+' '+k),typeof map[k]==='string'?map[k]:one(h[k]),file+': '+k+' differs from the pinned v9 text');
}
// The names those closures call are bound once, by the import from the module that defines them (no local
// declaration in any scope can stand in for newOwner, vault, read, ...).
const imports={'web/src/Owner.tsx':{newOwner:'./governance',inspectListing:'./governance',proposalSpec:'./governance',vault:'./chain',read:'./chain',InputError:'./chain',address:'./model',same:'./model',parseLaunch:'./model',loadSnapshot:'./model',TransactionCancelled:'./wallet'},
 'web/src/governance.ts':{vault:'./chain',VAULT:'./chain',InputError:'./chain',address:'./model',same:'./model',uint:'./model',amount:'./model'}};
for(const [file,map] of Object.entries(imports)){
 const tree=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS),bound={};
 (function v(n){
  const id=n.name&&ts.isIdentifier(n.name)&&(ts.isVariableDeclaration(n)||ts.isFunctionDeclaration(n)||ts.isFunctionExpression(n)||ts.isParameter(n)||ts.isBindingElement(n)||ts.isClassDeclaration(n)||ts.isImportSpecifier(n)||ts.isNamespaceImport(n)||ts.isImportClause(n))?n.name.text:undefined;
  if(id&&map[id])(bound[id]??=[]).push(ts.isImportSpecifier(n)&&!n.propertyName?n.parent.parent.parent.moduleSpecifier.text:'local '+ts.SyntaxKind[n.kind]);
  ts.forEachChild(n,v);
 })(tree);
 for(const [k,m] of Object.entries(map))assert.deepEqual(bound[k],[m],file+': '+k+' is bound only by its import from '+m);
}
assert.equal(now.VAULT,head.VAULT,'the vault address the encoders use');
// The v9 refusals (uint128 minLiquidity, vault as guardian or new owner, Sunday 2:00-2:59 am start under Dst 0) are
// still made, by HEAD and now alike, and v12 adds none.
for(const m of [U128,'The new guardian must not be the vault.','The new owner must not be the vault.',SPRING]) assert.ok(tally.refusedBoth[m]>0,'corpus exercises (refused by HEAD and now alike): '+m);
assert.deepEqual(tally.newRefusals,{},'no new refusal');
assert.ok(tally.sameCalldata>400,'corpus size '+JSON.stringify(tally));
assert.equal(tally.sameCalldata,496,'v12 retains all 496 accepted differential cases');
assert.equal(tally.bothRefused,1773,'v12 retains all 1773 refused differential cases');
fs.rmSync(scratch,{recursive:true,force:true});
// The report. The delivery is close to its size limit, so each piece is recorded by length and SHA-256, not repeated.
const pieceRecord=([v12,head])=>({v12:{length:v12.length,sha256:sha256(v12)},head:{length:head.length,sha256:sha256(head)}});
const brief=x=>x.length>120?{start:x.slice(0,80),length:x.length,sha256:sha256(x)}:x;
fs.writeFileSync('../artifacts/calldata-comparison.json',JSON.stringify({result:'PASS',baseline:git(['rev-parse','HEAD']).trim(),protectedFiles,editedFiles:Object.fromEntries(Object.entries(editedFiles).map(([f,x])=>[f,x.length+' documented pieces [v12, HEAD]'])),v12Pieces:Object.fromEntries(Object.entries(editedFiles).map(([f,x])=>[f,x.map(pieceRecord)])),counts,
 documentedGuardedCallChanges:expected,documentedAttributeChanges:Object.fromEntries(Object.entries(attributeChanges).map(([f,a])=>[f,{removed:a.removed.map(x=>'<'+x[0]+'> '+x[1]),added:a.added.map(x=>'<'+x[0]+'> '+x[1]),why:'each has its why in scripts/check-calldata.mjs'}])),
 documentedCallChanges:Object.fromEntries(Object.entries(callChanges).map(([f,c])=>[f,{why:c.why,piecesPutBackInsideCalls:c.pieces.map(pieceRecord),removed:c.removed.map(brief),newUsesOfWatchedNames:c.uses.map(([x,where])=>[brief(x),where])}])),
 vaultStockShelves:{attributes:vaultAttributes,handlers:vaultHandlers},pinnedFunctions,walletHookReturn:{equalToHead:true},
 walletAndRpcMethods:{named:methods,addedInV12:[]},browserStorageAddedInV12:storageAdded,namesAddedAtTheTopOfAFile:namesAdded,moduleDeclarationChanges:moduleChanges,namesAddedInsideComponents:newNames,transactionCode,reviewedAddedCalls:addedCallPins,reviewedSourcePins,transactionStateWrites,protectedCode,
 differentialEncoding:{cases:cases.length,...tally},sendBuilders:{clocks,...sends},pinnedDeclarations:pinned,
 sendsAndRequests:{sendFreeFiles:NO_SEND,usesPerFile:Object.fromEntries(Object.entries(sendUses).map(([f,x])=>[f,x.length])),components:sendUses['components.tsx'].filter(x=>/\(/.test(x)),addedInV12:[]},
 pageLoads:{names:[...LOADS],jsxAttributes:[...LOAD_ATTRIBUTES],usesPerFile:loadUses,equalToHeadExceptDisplayNames:loadDisplayAdded},
 pinnedV9Declarations:Object.fromEntries(Object.entries(pinnedV9).map(([f,m])=>[f,Object.fromEntries(Object.entries(m).map(([k,x])=>[k,typeof x==='string'?'v9 text (also at HEAD)':'equal to HEAD ('+x.length+' pieces)']))])),importBindings:imports,
 checks:[
  'v12 source scope: every other TypeScript source and ABI equal HEAD; edited sources equal HEAD once their exact pieces are restored, and also match independent reviewed SHA-256 pins outside regeneration blocks',
  'Every guarded reading, parsing, encoding, simulation, sending and provider call equals HEAD in order and place; no added chain read, wallet request, storage key or network call',
  'Action attributes equal HEAD except the documented approved presentation changes with a written reason; every onSubmit, getSpec, build and claim attribute equals HEAD',
  'Every removed call and added watched-name use is independently listed; complete ordered added calls match reviewed hashes and ordered callee lists outside regeneration blocks',
  'Direct and aliased transaction-state writes equal HEAD; send-tail receipt-hash writes are individually pinned with their ordered statements',
  'Wallet send head is byte-identical to HEAD through the receipt wait; its tail equals HEAD after exact receipt-hash replacements; connect and disconnect equal reviewed text and the new counter is used only at the pinned sites',
  'All protected wallet functions, flow effects, transaction buttons and handlers are byte-identical to HEAD; declaration and wrapper-scope checks prevent name rebinding',
  'Provider methods, browser storage, network and page-load sinks equal HEAD; Disconnect makes no request; components retains the same single wallet.send',
  'The differential encoding corpus, six-clock send builders, parser declarations, pinned v9 decisions and imported bindings retain every prior assertion',
  'Only approved v12 source files change; shell and share-card bytes are separately pinned by check-bundle.mjs'
 ]},null,2)+'\n');
console.log('PASS baseline call-expression comparison',counts,'differential encoding',tally,'send builders',sends);

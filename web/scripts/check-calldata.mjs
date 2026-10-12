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
// v11 (on top of v10, which is HEAD). Flows.tsx: the Deposit form is rebuilt (the wallet's stocks as rows with Max and
// Remove, one search box "Add another stock", a closed list of every stock that can be deposited, an estimated total,
// one status line while deposits are open); a confirmed deposit says "You received ... BASK", read from that deposit's
// own receipt (the one new chain read: client.getTransactionReceipt); the Redeem amount box is emptied after a
// confirmed redeem. main.tsx: a Disconnect button beside the address. wallet.tsx, outside send(): a remembered
// "disconnected" flag and local-only disconnect(), which makes no wallet request. No transaction changes: what is
// previewed, approved, deposited, redeemed and claimed is
// built and sent exactly as at HEAD. Every other web/src source is byte-identical to HEAD.
const protectedFiles=['Docs.tsx','Losses.tsx','Owner.tsx','Scenery.tsx','Vault.tsx','chain.ts','components.tsx','deployment.ts','governance.ts','model.ts','newYork.ts','poolMath.ts','vault.abi.json'];
for(const f of protectedFiles) assert.equal(read('web/src/'+f),baseline('web/src/'+f),f);
// The v11 files: byte-identical to HEAD once their documented pieces [v11, HEAD] are put back (each exactly once), so
// every word, call and attribute in them is pinned. The list between the two marker lines was generated from the
// difference to HEAD; the pins further down do not depend on it: they compare with HEAD itself or with texts written
// out in this file, so a piece cannot carry a change to a transaction, a wallet request or a chain read past them.
// >>> v11 pieces (generated from the difference to HEAD, not edited by hand)
const editedFiles={
 "Flows.tsx":[
  ["import { useEffect, useLayoutEffect, useRef, useState } from \"react\";\nimport { decodeEventLog, type Address, type Hex } from \"viem\";\nimport {\n",
   "import { useEffect, useLayoutEffect, useRef, useState } from \"react\";\nimport type { Address } from \"viem\";\nimport {\n"],
  ["  VAULT,\n  client,\n  vaultAbi,\n  reasonWords,\n} from \"./chain\";\n",
   "  VAULT,\n} from \"./chain\";\n"],
  ["  same,\n  type Asset,\n  type Snapshot,\n",
   "  same,\n  type Snapshot,\n"],
  ["} from \"./components\";\nimport { DepositState, hoursLine } from \"./Vault\";\nimport type { Wallet } from \"./wallet\";\n",
   "} from \"./components\";\nimport { DepositState } from \"./Vault\";\nimport type { Wallet } from \"./wallet\";\n"],
  ["    [retry, setRetry] = useState(0);\n  const [received, setReceived] = useState<{\n    hash: Hex;\n    receiver: Address;\n    shares: bigint;\n  }>();\n  // The rows come from the last finished balance read, so they stay in place\n  // while a new read runs. Never an input to a transaction.\n  const [held, setHeld] = useState<Record<string, bigint | undefined>>();\n  const [removed, setRemoved] = useState<Record<string, boolean>>({});\n  const [showSmall, setShowSmall] = useState(false);\n  // The stock an Add button just added, until its row is on screen.\n  const focusRow = useRef<Address | undefined>(undefined);\n  const sequence = useRef(0),\n",
   "    [retry, setRetry] = useState(0);\n  const sequence = useRef(0),\n"],
  ["  }, [w.confirmed]);\n  useLayoutEffect(() => {\n    if (w.confirmed?.functionName === \"deposit\") setRemoved({});\n  }, [w.confirmed]);\n  // Another wallet's rows must not stay on screen.\n  useLayoutEffect(() => {\n    setHeld(undefined);\n    setRemoved({});\n  }, [w.account]);\n  // The pressed Add button is gone: the new row's amount box takes its focus,\n  // or the row itself when the stock is blocked and its box is off.\n  useLayoutEffect(() => {\n    const box = focusRow.current\n      ? document.getElementById(`amount-${focusRow.current}`)\n      : null;\n    if (box instanceof HTMLInputElement && box.disabled)\n      box.closest<HTMLElement>(\".deposit-row\")?.focus();\n    else box?.focus();\n    focusRow.current = undefined;\n  }, [inputs]);\n  // The BASK a confirmed deposit minted, from the Deposit event in its receipt.\n  useEffect(() => {\n    const done = w.confirmed;\n    if (done?.functionName !== \"deposit\") return;\n    let live = true;\n    client\n      .getTransactionReceipt({ hash: done.hash })\n      .then((receipt) => {\n        const event = receipt.logs\n          .filter((l) => same(l.address, VAULT))\n          .map((l) => {\n            try {\n              return decodeEventLog({\n                abi: vaultAbi,\n                data: l.data,\n                topics: l.topics,\n              });\n            } catch {\n              return undefined;\n            }\n          })\n          .find((l) => l?.eventName === \"Deposit\");\n        if (!live || !event) return;\n        const { receiver, shares } = event.args as any;\n        setReceived({ hash: done.hash, receiver, shares });\n      })\n      .catch(() => {});\n    return () => {\n      live = false;\n    };\n  }, [w.confirmed]);\n  useEffect(() => {\n",
   "  }, [w.confirmed]);\n  useEffect(() => {\n"],
  ["        setBalances(b);\n        setHeld(b);\n        setAllowances(al);\n",
   "        setBalances(b);\n        setAllowances(al);\n"],
  ["  }\n  // From the last finished vault read, kept while a new read runs so the form\n  // does not jump; undefined before the first read or when unreadable.\n  const r = s.status;\n  const reason = r?.ok ? Number(r.value[0]) : undefined;\n  // Dollar value of n units at the feed price of the last vault read, 18\n  // decimals; undefined when that price is unreadable.\n  const worth = (a: Asset, n: bigint) =>\n    a.answer !== undefined && a.answer > 0n\n      ? (n * a.answer * 10n ** 18n) /\n        10n ** BigInt(a.tokenDecimals + a.feedDecimals)\n      : undefined;\n  // \"about $1,234.56\"; usd() alone writes a value under one cent as \"$<0.01\".\n  const about = (value: bigint) =>\n    value < 10n ** 16n ? \"under $0.01\" : `about ${usd(value)}`;\n  // Display only. Preview and Deposit read `inputs` in the vault's order.\n  const stocks = open.map((a) => {\n    const balance = held?.[a.token] ?? 0n,\n      value = balance > 0n ? worth(a, balance) : undefined;\n    return {\n      a,\n      value,\n      inWallet: balance > 0n,\n      // Under one cent. An unreadable price is unknown, never small.\n      small: value !== undefined && value < 10n ** 16n,\n      added: inputs[a.token] !== undefined,\n    };\n  });\n  type Stock = (typeof stocks)[number];\n  // A wallet stock the user has not removed.\n  const kept = (x: Stock) => x.inWallet && !removed[x.a.token];\n  const onScreen = (x: Stock) =>\n    x.added || (kept(x) && (!x.small || showSmall));\n  const hiddenSmall = stocks.filter((x) => kept(x) && !onScreen(x)).length;\n  // Wallet stocks by value, largest first, unpriced ones after them; then the\n  // stocks added by hand. Ties keep the vault's order.\n  const rows = [\n    ...stocks\n      .filter((x) => onScreen(x) && x.inWallet)\n      .sort((x, y) =>\n        x.value === y.value\n          ? 0\n          : x.value === undefined\n            ? 1\n            : y.value === undefined || x.value > y.value\n              ? -1\n              : 1,\n      ),\n    ...stocks.filter((x) => onScreen(x) && !x.inWallet),\n  ];\n  // The last finished read covers every stock now listed.\n  const ready = !!held && open.every((a) => a.token in held);\n  // A gap in that read; it stays so while the next read runs.\n  const unread = ready && open.some((a) => held[a.token] === undefined);\n  // Tickers first (the exact one, then those that start with the text, then\n  // those that contain it), then token addresses from four characters on.\n  const query = search.trim().toLowerCase();\n  const rank = (a: Asset) => {\n    const ticker = a.symbol.toLowerCase();\n    return ticker === query\n      ? 0\n      : ticker.startsWith(query)\n        ? 1\n        : ticker.includes(query)\n          ? 2\n          : query.length >= 4 && a.token.toLowerCase().includes(query)\n            ? 3\n            : 4;\n  };\n  const matches = query\n    ? stocks\n        .filter((x) => !onScreen(x) && rank(x.a) < 4)\n        .map((x) => x.a)\n        .sort((x, y) => rank(x) - rank(y))\n    : [];\n  // Every open stock by ticker, A to Z, for the list under the search. A copy\n  // for display only: `open` keeps the vault's order.\n  const listed = [...open].sort((x, y) => {\n    const a = x.symbol.toLowerCase(),\n      b = y.symbol.toLowerCase();\n    return a < b ? -1 : a > b ? 1 : 0;\n  });\n  // `focus` is false for Enter in the search box, which keeps the focus.\n  function add(t: Address, focus = true) {\n    if (focus) focusRow.current = t;\n    setRemoved((old) => ({ ...old, [t]: false }));\n    setInputs((old) => ({ ...old, [t]: \"\" }));\n    setSearch(\"\");\n  }\n  function remove(t: Address) {\n    // The pressed button goes with its row: focus a row beside it or search.\n    const row = document.getElementById(`amount-${t}`)?.closest(\".deposit-row\"),\n      beside = row?.nextElementSibling ?? row?.previousElementSibling;\n    if (row?.contains(document.activeElement)) {\n      if (beside instanceof HTMLElement) beside.focus({ preventScroll: true });\n      else\n        document\n          .querySelector<HTMLInputElement>(\".stock-search input\")\n          ?.focus({ preventScroll: true });\n    }\n    setRemoved((old) => ({ ...old, [t]: true }));\n    if (inputs[t] !== undefined)\n      setInputs((old) => {\n        const next = { ...old };\n        delete next[t];\n        return next;\n      });\n  }\n  // An estimate of the typed amounts, for the same stocks Preview would send.\n  let total = 0n,\n    counted = 0;\n  const badAmount: string[] = [],\n    noPrice: string[] = [];\n  for (const a of open) {\n    const text = inputs[a.token];\n    if (!text?.trim()) continue;\n    let value: bigint | undefined;\n    try {\n      value = worth(a, amount(text, false, a.tokenDecimals));\n    } catch {\n      badAmount.push(a.symbol);\n      continue;\n    }\n    if (value === undefined) noPrice.push(a.symbol);\n    else {\n      total += value;\n      counted++;\n    }\n  }\n  return (\n",
   "  }\n  return (\n"],
  ["      </PageTitle>\n      <div className=\"flow-layout one-column\">\n        <section className=\"panel\">\n          <HoursTag />\n          {/* One line while the vault takes deposits; otherwise, and while the\n              status is unread or unreadable, the full box with its reason. */}\n          {reason === 0 && open.length > 0 ? (\n            <p className=\"deposit-open\">\n              <strong>Deposits are open.</strong> Hours:{\" \"}\n              {hoursLine(s.globals.settings)}\n            </p>\n          ) : (\n            <DepositState snapshot={s} />\n          )}\n          <p className=\"flow-steps\">\n",
   "      </PageTitle>\n      <div className=\"flow-layout\">\n        <section className=\"panel\">\n          <HoursTag />\n          <DepositState snapshot={s} />\n          <p className=\"flow-steps\">\n"],
  ["              >\n                {!w.account ? (\n                  <div className=\"wallet-connect\">\n                    <p>Connect your wallet to see the stocks you hold.</p>\n                    <button\n                      type=\"button\"\n                      onClick={w.connect}\n                      disabled={w.connecting}\n                    >\n                      {w.connecting ? \"Connecting...\" : \"Connect wallet\"}\n                    </button>\n                  </div>\n                ) : (\n                  <>\n                    {!ready && <p>Reading your wallet...</p>}\n                    <p className=\"wallet-line\">\n                      Showing {w.account.slice(0, 6)}…{w.account.slice(-4)}. To\n                      use another wallet, switch the address in your wallet app:\n                      this page follows it.\n                    </p>\n                    {unread ? (\n                      <p>\n                        Some balances could not be read. Press Retry balances\n                        below.\n                      </p>\n                    ) : (\n                      ready &&\n                      !rows.length &&\n                      !stocks.some((x) => x.inWallet) && (\n                        <p>No open listed stock in this wallet.</p>\n                      )\n                    )}\n                  </>\n                )}\n                <div className=\"deposit-rows\">\n                  {rows.map(({ a, value, inWallet }) => {\n                    const blocked = a.reason !== undefined && a.reason !== 0,\n                      balance = held?.[a.token];\n                    return (\n                      <div\n                        className={\n                          blocked ? \"deposit-row blocked\" : \"deposit-row\"\n                        }\n                        key={a.token}\n                        tabIndex={-1}\n                      >\n                        <div className=\"row-stock\">\n                          <label htmlFor={`amount-${a.token}`}>\n                            <bdi>{a.symbol}</bdi>\n                          </label>\n                          <small id={`balance-${a.token}`}>\n                            Wallet balance:{\" \"}\n                            {w.account\n                              ? balance === undefined && (reading || !ready)\n                                ? \"Reading...\"\n                                : fmt(balance, a.tokenDecimals)\n                              : \"Connect wallet\"}\n                            {inWallet && value !== undefined && (\n                              <span> · {about(value)}</span>\n                            )}\n                          </small>\n                        </div>\n                        <input\n                          id={`amount-${a.token}`}\n                          aria-label={`${a.symbol} amount`}\n",
   "              >\n                {open.length > 6 && (\n                  <>\n                    <label className=\"stock-search\">\n                      Search to add stocks\n                      <input\n                        type=\"search\"\n                        value={search}\n                        onChange={(e) => setSearch(e.target.value)}\n                      />\n                    </label>\n                    <div className=\"add-stocks\">\n                      {open\n                        .filter(\n                          (a) =>\n                            inputs[a.token] === undefined &&\n                            (a.symbol\n                              .toLowerCase()\n                              .includes(search.toLowerCase()) ||\n                              a.token\n                                .toLowerCase()\n                                .includes(search.toLowerCase())),\n                        )\n                        .map((a) => (\n                          <button\n                            type=\"button\"\n                            key={a.token}\n                            disabled={working || w.busy}\n                            onClick={() =>\n                              setInputs((old) => ({ ...old, [a.token]: \"\" }))\n                            }\n                          >\n                            Add {a.symbol}\n                          </button>\n                        ))}\n                    </div>\n                  </>\n                )}\n                {open\n                  .filter(\n                    (a) => open.length <= 6 || inputs[a.token] !== undefined,\n                  )\n                  .map((a) => (\n                    <div className=\"amount-row\" key={a.token}>\n                      <label>\n                        <span>\n                          <bdi>{a.symbol}</bdi> amount\n                        </span>\n                        <input\n                          aria-label={`${a.symbol} amount`}\n"],
  ["                          value={inputs[a.token] ?? \"\"}\n                          disabled={working || w.busy || blocked}\n                          onChange={(e) =>\n",
   "                          value={inputs[a.token] ?? \"\"}\n                          disabled={working || w.busy}\n                          onChange={(e) =>\n"],
  ["                        />\n                        <button\n                          type=\"button\"\n                          className=\"quiet\"\n                          aria-label={`Max ${a.symbol}`}\n                          disabled={\n                            working ||\n                            w.busy ||\n                            blocked ||\n                            balances[a.token] === undefined\n                          }\n                          onClick={() =>\n                            setInputs((old) => ({\n                              ...old,\n                              [a.token]: exact(\n                                balances[a.token]!,\n                                a.tokenDecimals,\n                              ),\n                            }))\n                          }\n                        >\n                          Max\n                        </button>\n                        <button\n                          type=\"button\"\n                          className=\"quiet remove\"\n                          aria-label={`Remove ${a.symbol}`}\n                          disabled={working || w.busy}\n                          onClick={() => remove(a.token)}\n                        >\n                          Remove\n                        </button>\n                        {blocked && (\n                          <p className=\"row-note\">\n                            Deposits of this stock are blocked right now:{\" \"}\n                            {reasonWords(a.reason, s.globals.settings)}.{\" \"}\n                            <button\n                              type=\"button\"\n                              className=\"quiet\"\n                              aria-label={`Refresh ${a.symbol}`}\n                              disabled={working || w.busy || s.loading}\n                              onClick={s.retry}\n                            >\n                              Refresh\n                            </button>\n                          </p>\n                        )}\n                      </div>\n                    );\n                  })}\n                </div>\n                {(hiddenSmall > 0 || showSmall) && (\n                  <button\n                    type=\"button\"\n                    className=\"quiet small-toggle\"\n                    onClick={() => setShowSmall(!showSmall)}\n                  >\n                    {showSmall\n                      ? \"Hide small balances\"\n                      : `Show small balances (${hiddenSmall})`}\n                  </button>\n                )}\n                <label className=\"stock-search\">\n                  Add another stock\n                  <input\n                    type=\"search\"\n                    placeholder=\"Ticker or token address\"\n                    autoComplete=\"off\"\n                    spellCheck={false}\n                    value={search}\n                    disabled={working || w.busy}\n                    onChange={(e) => setSearch(e.target.value)}\n                    onKeyDown={(e) => {\n                      // Enter adds the first match; it never runs Preview.\n                      if (e.key !== \"Enter\") return;\n                      e.preventDefault();\n                      if (matches[0]) add(matches[0].token, false);\n                    }}\n                  />\n                </label>\n                {/* Always in the page, so that a screen reader hears what the\n                    search found. */}\n                <div className=\"stock-matches\" role=\"status\">\n                  {matches.slice(0, 6).map((a) => (\n                    <button\n                      type=\"button\"\n                      key={a.token}\n                      disabled={working || w.busy}\n                      onClick={() => add(a.token)}\n                    >\n                      Add {a.symbol}\n                    </button>\n                  ))}\n                  {matches.length > 6 && (\n                    <p>{matches.length - 6} more: keep typing.</p>\n                  )}\n                  {!!query && !matches.length && (\n                    <p>\n                      {rows.some(\n                        (x) =>\n                          rank(x.a) === 0 || x.a.token.toLowerCase() === query,\n                      )\n                        ? \"That stock is already in the list above.\"\n                        : \"No open stock matches.\"}\n                    </p>\n                  )}\n                </div>\n                {/* Every stock the vault takes now, closed until pressed. A\n                    press is the same Add as in the search; a stock that has a\n                    row stays in the list, switched off. */}\n                <details className=\"all-stocks\">\n                  <summary>All stocks you can deposit ({open.length})</summary>\n                  <p>Press a stock to add it to your deposit.</p>\n                  <p>Grey stocks are already in the form above.</p>\n                  <ul>\n                    {listed.map((a) => (\n                      <li\n                        key={a.token}\n                        className={a.symbol.length > 5 ? \"wide\" : undefined}\n                      >\n                        <button\n                          type=\"button\"\n                          className=\"quiet\"\n                          disabled={\n                            working ||\n                            w.busy ||\n                            rows.some((x) => x.a.token === a.token)\n                          }\n                          onClick={() => add(a.token)}\n                        >\n                          <bdi>{a.symbol}</bdi>\n                        </button>\n                      </li>\n                    ))}\n                  </ul>\n                </details>\n                {counted + badAmount.length + noPrice.length > 0 && (\n                  <div className=\"deposit-total\">\n                    {counted > 0 && (\n                      <>\n                        <p>\n                          <strong>Total: {about(total)}</strong>\n                        </p>\n                        <small>\n                          An estimate from the last vault read. Preview gives\n                          the exact figure.\n                        </small>\n                      </>\n                    )}\n                    {badAmount.length > 0 && (\n                      <p>\n                        Not counted: {badAmount.join(\", \")} (check the amount\n                        typed).\n                      </p>\n                    )}\n                    {noPrice.length > 0 && (\n                      <p>\n                        Not counted: {noPrice.join(\", \")} (price unreadable).\n                      </p>\n                    )}\n                  </div>\n                )}\n                <button className=\"primary\" disabled={working || w.busy}>\n",
   "                        />\n                        <small id={`balance-${a.token}`}>\n                          Wallet balance:{\" \"}\n                          {w.account\n                            ? reading\n                              ? \"Reading...\"\n                              : fmt(balances[a.token], a.tokenDecimals)\n                            : \"Connect wallet\"}\n                        </small>\n                      </label>\n                      <button\n                        type=\"button\"\n                        disabled={\n                          working || w.busy || balances[a.token] === undefined\n                        }\n                        onClick={() =>\n                          setInputs((old) => ({\n                            ...old,\n                            [a.token]: exact(\n                              balances[a.token]!,\n                              a.tokenDecimals,\n                            ),\n                          }))\n                        }\n                      >\n                        Use full balance\n                      </button>\n                      {balances[a.token] === undefined && (\n                        <p className=\"disabled-reason\">\n                          {!w.account\n                            ? \"Connect wallet to read your balance.\"\n                            : reading\n                              ? \"Reading...\"\n                              : \"Balance unreadable. Retry balances below.\"}\n                        </p>\n                      )}\n                    </div>\n                  ))}\n                <button className=\"primary\" disabled={working || w.busy}>\n"],
  ["          <ActionStatus wallet={w} scope=\"Deposit\" />\n          {/* Only under the status of that same deposit, never under a later\n              attempt. */}\n          {received &&\n            received.hash === w.confirmed?.hash &&\n            received.hash === w.progress.Deposit?.hash &&\n            same(received.receiver, w.account) && (\n              <p className=\"received\" role=\"status\">\n                You received {fmt(received.shares)} BASK.\n              </p>\n            )}\n          <p className=\"error\" role=\"alert\">\n",
   "          <ActionStatus wallet={w} scope=\"Deposit\" />\n          <p className=\"error\" role=\"alert\">\n"],
  ["  }, [input, to, w.account, s.loadedAt]);\n  useLayoutEffect(() => {\n    if (w.confirmed?.functionName === \"redeem\") setInput(\"\");\n  }, [w.confirmed]);\n  useEffect(() => {\n",
   "  }, [input, to, w.account, s.loadedAt]);\n  useEffect(() => {\n"]
 ],
 "wallet.tsx":[
  ["}\n// Set by Disconnect and kept across reloads until Connect wallet is answered.\nconst disconnectedKey = \"basket-disconnected-4663\";\nfunction savedDisconnected() {\n  try {\n    return localStorage.getItem(disconnectedKey) === \"1\";\n  } catch {\n    return false;\n  }\n}\nexport function useWallet(refresh: () => Promise<Snapshot>) {\n",
   "}\nexport function useWallet(refresh: () => Promise<Snapshot>) {\n"],
  ["    connectingLock = useRef(false);\n  // Mirrors the saved flag, so Disconnect also holds without storage.\n  const disconnected = useRef(savedDisconnected());\n  const accountVersion = useRef(0);\n  const [connecting, setConnecting] = useState(false);\n",
   "    connectingLock = useRef(false);\n  const [connecting, setConnecting] = useState(false);\n"],
  ["    if (!p) return;\n    // After Disconnect the page takes no account until Connect wallet.\n    const accounts = (a: Address[]) => {\n      accountVersion.current++;\n      if (!disconnected.current) setAccount(a[0]);\n    };\n    const network = (n: string) => setChainId(Number(n));\n    const version = accountVersion.current;\n    p.request({ method: \"eth_accounts\" })\n      .then((a) => {\n        // A later wallet event or user action takes precedence over this read.\n        if (version === accountVersion.current) accounts(a);\n      })\n      .catch(() => {});\n",
   "    if (!p) return;\n    const accounts = (a: Address[]) => setAccount(a[0]);\n    const network = (n: string) => setChainId(Number(n));\n    p.request({ method: \"eth_accounts\" })\n      .then(accounts)\n      .catch(() => {});\n"],
  ["    return () => {\n      accountVersion.current++;\n      p.removeListener?.(\"accountsChanged\", accounts);\n",
   "    return () => {\n      p.removeListener?.(\"accountsChanged\", accounts);\n"],
  ["    connectingLock.current = true;\n    accountVersion.current++;\n    setConnecting(true);\n",
   "    connectingLock.current = true;\n    setConnecting(true);\n"],
  ["      });\n      if (a[0]) {\n        disconnected.current = false;\n        try {\n          localStorage.removeItem(disconnectedKey);\n        } catch {\n          /* storage unavailable */\n        }\n      }\n      setAccount(a[0]);\n",
   "      });\n      setAccount(a[0]);\n"],
  ["  }\n  // Forget the wallet on this page only; a reload stays disconnected.\n  function disconnect() {\n    if (sending.current) return;\n    accountVersion.current++;\n    disconnected.current = true;\n    try {\n      localStorage.setItem(disconnectedKey, \"1\");\n    } catch {\n      /* the ref above still holds for this visit */\n    }\n    setAccount(undefined);\n    setHash(undefined);\n    setMessage(\n      \"Wallet disconnected from this page. To use another wallet, switch the address in your wallet app, then press Connect wallet.\",\n    );\n  }\n  async function switchChain() {\n",
   "  }\n  async function switchChain() {\n"],
  ["    connect,\n    disconnect,\n    switchChain,\n",
   "    connect,\n    switchChain,\n"]
 ],
 "main.tsx":[
  ["                </span>\n                <button\n                  className=\"disconnect\"\n                  onClick={wallet.disconnect}\n                  disabled={wallet.busy}\n                >\n                  Disconnect\n                </button>\n                {wallet.chainId !== 4663 && (\n",
   "                </span>\n                {wallet.chainId !== 4663 && (\n"]
 ]
};
// <<< v11 pieces
assert.deepEqual(Object.keys(editedFiles),['Flows.tsx','wallet.tsx','main.tsx'],'the v11 files');
const putBack=(text,pieces,what)=>{for(const [n,o] of pieces){assert.equal(text.split(n).length,2,what+': expected once: '+n);text=text.split(n).join(o);}return text;};
for(const [f,edits] of Object.entries(editedFiles)) assert.equal(putBack(read('web/src/'+f),edits,f),baseline('web/src/'+f),f+' changed beyond the documented pieces');
// Calls that build, encode, simulate or send a transaction (or parse its arguments) or read the chain.
const names=new Set(['vault','token','feed','read','many','simulate','verifyNetwork','encode','depositArgs','redeemArgs','w.send','p.request',
 'safe','proposalSpec','proposalAction','settingValues','poolValues','parseLaunch','encodeFunctionData','client.call','client.estimateGas',
 'client.getTransactionCount','client.waitForTransactionReceipt','address','recipient','amount','uint']);
// JSX attributes that act, send or check. v11 adds every event handler (on...) and the wallet and snapshot handed to a
// component, so the new Enter handler of the stock search and the wallet each page receives are compared too.
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
// v11: a guarded name is matched without line breaks or optional chaining ("client\n  .estimateGas" counts), and every
// method called on the public client (client.anything(...)) is a chain read, so the new receipt read is listed below.
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
// (everything else equals HEAD, in order and place). v11 removes none and adds the receipt read and the display-only
// amount() in Flows.tsx. Local-only Disconnect adds no guarded call or wallet request.
const expected={
 'Flows.tsx':{why:'"You received ... BASK": one read of the receipt of the visitor\'s own confirmed deposit (the hash send() reported), to take the minted shares from its Deposit event; it runs after the deposit is confirmed and feeds only that line. The running total parses each typed amount with the page\'s own amount() to show an estimate in dollars; it runs while the form is drawn, outside every handler, and its result goes into no preview, approval or deposit (those still parse inputs[a.token] themselves, as at HEAD).',
  removed:[],
  added:[['client .getTransactionReceipt({ hash: done.hash })','DepositPage'],['amount(text, false, a.tokenDecimals)','DepositPage']]},
 'wallet.tsx':{why:'Disconnect forgets the wallet only on this page. It adds no provider request, avoiding a late permission revocation undoing a later Connect in this page or another tab.',removed:[],added:[]},
};
// Action attributes: the exact differences from HEAD, in page order, each [element, attribute, why]. Everything else
// equals HEAD in order, text for text. None of them builds or starts a transaction (no onSubmit, getSpec, build or
// claim) and none contains a guarded call (both asserted below). The list between the marker lines was generated
// from the difference to HEAD, as the pieces were; each why was written by hand, and an entry without one fails.
// >>> v11 attributes (generated from the difference to HEAD; each why written by hand)
const attributeChanges={
 "Flows.tsx":{
  removed:[
   ["input","value={search}",
    "The search box. HEAD showed it above the amount rows, v11 shows it below them, so the same attribute is listed once as removed and once as added."],
   ["input","onChange={(e) => setSearch(e.target.value)}",
    "The search box (see value={search}): HEAD's handler, moved with the box. It only sets the search text."],
   ["button","disabled={working || w.busy}",
    "HEAD's rule for a button of the Deposit form: off while a preview, approval or send is running. HEAD had it on its Add buttons and on Preview deposit; v11 has it on Remove, on the Add buttons under the search and on Preview deposit. The comparison pairs equal texts in order, so one use of HEAD shows as removed and two of v11 as added: the rule itself did not change."],
   ["button","onClick={() => setInputs((old) => ({ ...old, [a.token]: \"\" }))}",
    "HEAD's Add button. Adding a stock is now add(), which makes the same write: an empty amount box for that stock (see the writes in callChanges)."],
   ["input","disabled={working || w.busy}",
    "HEAD's rule for a text box of the form: off while a preview, approval or send is running. HEAD had it on the amount boxes, which now also go off while their stock is blocked (the added rule with `blocked`); v11 puts it on the search box."],
   ["button","disabled={working || w.busy || balances[a.token] === undefined}",
    "HEAD's Use full balance. The button is called Max now and also goes off while its stock is blocked (the added rule with `blocked`). Its onClick, which fills in the exact wallet balance, is HEAD's and is in neither list."]],
  added:[
   ["button","onClick={w.connect}",
    "Connect wallet inside the Deposit form, shown while no wallet is connected. It calls the hook's connect(), the one the header button calls."],
   ["button","disabled={w.connecting}",
    "That Connect wallet button is off while a connection request is open, like the header button."],
   ["input","disabled={working || w.busy || blocked}",
    "An amount box: HEAD's rule, and also off while the vault's own check of that stock fails (blocked). It can only switch the box off."],
   ["button","disabled={working || w.busy || blocked || balances[a.token] === undefined}",
    "Max (HEAD's Use full balance): HEAD's rule, and also off while that stock is blocked. It can only switch the button off."],
   ["button","onClick={() => remove(a.token)}",
    "Remove takes a stock's row off the form: remove() deletes its typed amount from the inputs (a documented write in callChanges) and remembers the stock as removed. It reads nothing from the chain and sends nothing."],
   ["button","disabled={working || w.busy || s.loading}",
    "Refresh on a blocked row: off while a preview, approval or send is running or while the vault is being read."],
   ["button","onClick={s.retry}",
    "Refresh on a blocked row reads the vault again with s.retry, as the Retry vault buttons do. A read; it sends nothing."],
   ["button","onClick={() => setShowSmall(!showSmall)}",
    "Shows or hides the wallet's stocks worth under one cent. Display only: a row with a typed amount is never hidden."],
   ["input","value={search}",
    "The search box. HEAD showed it above the amount rows, v11 shows it below them, so the same attribute is listed once as removed and once as added."],
   ["input","disabled={working || w.busy}",
    "HEAD's rule for a text box of the form: off while a preview, approval or send is running. HEAD had it on the amount boxes, which now also go off while their stock is blocked (the added rule with `blocked`); v11 puts it on the search box."],
   ["input","onChange={(e) => setSearch(e.target.value)}",
    "The search box (see value={search}): HEAD's handler, moved with the box. It only sets the search text."],
   ["input","onKeyDown={(e) => { if (e.key !== \"Enter\") return; e.preventDefault(); if (matches[0]) add(matches[0].token, false); }}",
    "Enter in the search box adds the first match with add(), as an Add button does, and never submits the form, so Enter there cannot start a preview. Every other key is left alone."],
   ["div","role=\"status\"",
    "The matches under the search box are read out by screen readers when they change."],
   ["button","disabled={working || w.busy}",
    "HEAD's rule for a button of the Deposit form: off while a preview, approval or send is running. HEAD had it on its Add buttons and on Preview deposit; v11 has it on Remove, on the Add buttons under the search and on Preview deposit. The comparison pairs equal texts in order, so one use of HEAD shows as removed and two of v11 as added: the rule itself did not change."],
   ["button","onClick={() => add(a.token)}",
    "An Add button under the search box, or a ticker in the list of every stock that can be deposited: add() puts an empty amount box for that stock in the form (a documented write in callChanges), takes it off the removed list and empties the search. It reads nothing from the chain and sends nothing."],
   ["button","disabled={working || w.busy || rows.some((x) => x.a.token === a.token)}",
    "A ticker in the list of every stock that can be deposited: off while a preview, approval or send is running, and while that stock already has a row in the form. It can only switch the button off."],
   ["button","onClick={() => add(a.token)}",
    "An Add button under the search box, or a ticker in the list of every stock that can be deposited: add() puts an empty amount box for that stock in the form (a documented write in callChanges), takes it off the removed list and empties the search. It reads nothing from the chain and sends nothing."],
   ["button","disabled={working || w.busy}",
    "HEAD's rule for a button of the Deposit form: off while a preview, approval or send is running. HEAD had it on its Add buttons and on Preview deposit; v11 has it on Remove, on the Add buttons under the search and on Preview deposit. The comparison pairs equal texts in order, so one use of HEAD shows as removed and two of v11 as added: the rule itself did not change."],
   ["p","role=\"status\"",
    "The line \"You received ... BASK.\" under a confirmed deposit is read out by screen readers."]]},
 "main.tsx":{
  removed:[],
  added:[
   ["button","onClick={wallet.disconnect}",
    "The Disconnect button beside the address calls the hook's disconnect(), which is pinned word for word in this file."],
   ["button","disabled={wallet.busy}",
    "Disconnect is off while a transaction is being checked, sent or confirmed."]]}
};
// <<< v11 attributes
// Every call expression: HEAD's calls, in order and place, are all still there, except the removed ones listed here;
// a call that only gained the documented piece inside it (put back before comparing) counts as kept. Every added
// call, including display helpers and effects, is independently pinned below, not only the guarded calls.
// Watched names: the names that build, parse, read or send (vault, token, read, many, simulate, encode, amount,
// depositArgs, redeemArgs, recipient, client, ...) and the state and refs the file had at HEAD (setInputs, setQuote,
// setAccount, sequence, sending, ...). Every use of one, a call or the bare name handed on or renamed, equals HEAD in
// order and place, apart from the new uses listed here, each printed with the calls chained to it and its place. So
// nothing new reaches the typed amounts, the quote, the balances or the account except by these, and the one new
// chain read is pinned together with everything that is done with its answer.
// Exact startup read callback: ignore its answer after a newer account event, user action or cleanup.
// The provider request expression and method are unchanged. This pair never comes from generated pieces.
const ACCOUNT_REPLY=['p.request({ method: "eth_accounts" }) .then((a) => { if (version === accountVersion.current) accounts(a); })','p.request({ method: "eth_accounts" }) .then(accounts)'];
const restoreAccountReply=(x,file)=>file==='wallet.tsx'&&x.place==='useWallet'?(x.text===ACCOUNT_REPLY[0]?ACCOUNT_REPLY[1]:x.text===ACCOUNT_REPLY[0]+' .catch(() => { })'?ACCOUNT_REPLY[1]+' .catch(() => { })':x.text):x.text;
const callChanges={
 'Flows.tsx':{why:'The balance read keeps a copy of what it read for the rows (setHeld(b), one added line; the effect and its read are otherwise HEAD\'s). Removed with the old form: the search handler in its old place, the grid of Add buttons with its filter, and the amount rows with their filter and balance text; the new rows, search and Add are added calls. New uses: the receipt read with its whole answer handling (it keeps the vault\'s Deposit event of that receipt and remembers its receiver and shares for the "You received" line, nothing else); Add and Remove change the typed amounts only for the stock pressed and Add empties the search text; the estimate\'s amount(); the search box sets the search text; a confirmed redeem empties the Redeem amount box.',
  pieces:[['setBalances(b); setHeld(b); setAllowances(al);','setBalances(b); setAllowances(al);']],
  removed:['setSearch(e.target.value)',
   'open .filter((a) => inputs[a.token] === undefined && (a.symbol .toLowerCase() .includes(search.toLowerCase()) || a.token .toLowerCase() .includes(search.toLowerCase()))) .map((a) => (<button type="button" key={a.token} disabled={working || w.busy} onClick={() => setInputs((old) => ({ ...old, [a.token]: "" }))}> Add {a.symbol} </button>))',
   'open .filter((a) => inputs[a.token] === undefined && (a.symbol .toLowerCase() .includes(search.toLowerCase()) || a.token .toLowerCase() .includes(search.toLowerCase())))',
   'a.symbol .toLowerCase() .includes(search.toLowerCase())','a.symbol .toLowerCase()','search.toLowerCase()',
   'a.token .toLowerCase() .includes(search.toLowerCase())','a.token .toLowerCase()','search.toLowerCase()',
   'setInputs((old) => ({ ...old, [a.token]: "" }))',
   'open .filter((a) => open.length <= 6 || inputs[a.token] !== undefined) .map((a) => (<div className="amount-row" key={a.token}> <label> <span> <bdi>{a.symbol}</bdi> amount </span> <input aria-label={`${a.symbol} amount`} aria-describedby={`balance-${a.token}`} inputMode="decimal" autoComplete="off" value={inputs[a.token] ?? ""} disabled={working || w.busy} onChange={(e) => setInputs({ ...inputs, [a.token]: e.target.value })}/> <small id={`balance-${a.token}`}> Wallet balance:{" "} {w.account ? reading ? "Reading..." : fmt(balances[a.token], a.tokenDecimals) : "Connect wallet"} </small> </label> <button type="button" disabled={working || w.busy || balances[a.token] === undefined} onClick={() => setInputs((old) => ({ ...old, [a.token]: exact(balances[a.token]!, a.tokenDecimals), }))}> Use full balance </button> {balances[a.token] === undefined && (<p className="disabled-reason"> {!w.account ? "Connect wallet to read your balance." : reading ? "Reading..." : "Balance unreadable. Retry balances below."} </p>)} </div>))',
   'open .filter((a) => open.length <= 6 || inputs[a.token] !== undefined)',
   'fmt(balances[a.token], a.tokenDecimals)'],
  uses:[['client .getTransactionReceipt({ hash: done.hash }) .then((receipt) => { const event = receipt.logs .filter((l) => same(l.address, VAULT)) .map((l) => { try { return decodeEventLog({ abi: vaultAbi, data: l.data, topics: l.topics, }); } catch { return undefined; } }) .find((l) => l?.eventName === "Deposit"); if (!live || !event) return; const { receiver, shares } = event.args as any; setReceived({ hash: done.hash, receiver, shares }); }) .catch(() => { })','DepositPage'],
   ['setInputs((old) => ({ ...old, [t]: "" }))','DepositPage > add'],['setSearch("")','DepositPage > add'],
   ['setInputs((old) => { const next = { ...old }; delete next[t]; return next; })','DepositPage > remove'],
   ['amount(text, false, a.tokenDecimals)','DepositPage'],
   ['setSearch(e.target.value)','DepositPage, in onChange'],['setInput("")','RedeemPage']]},
 'wallet.tsx':{why:'The handler for the wallet\'s accounts (the first read and accountsChanged) takes no account while the disconnected flag is set; its startup answer is ignored after a newer event, user action or cleanup. The four exact pieces restore HEAD\'s effect and each must occur. New uses, all in disconnect(): it looks at the send lock (and returns while a send is running), forgets the account and the last transaction link and sets the top message.',
  pieces:[['const accounts = (a: Address[]) => { accountVersion.current++; if (!disconnected.current) setAccount(a[0]); };','const accounts = (a: Address[]) => setAccount(a[0]);'],
   ['const version = accountVersion.current; p.request({ method: "eth_accounts" })','p.request({ method: "eth_accounts" })'],
   ACCOUNT_REPLY,
   ['return () => { accountVersion.current++; p.removeListener?.("accountsChanged", accounts);','return () => { p.removeListener?.("accountsChanged", accounts);']],
  removed:[],
  uses:[['sending.current','useWallet > disconnect'],['setAccount(undefined)','useWallet > disconnect'],['setHash(undefined)','useWallet > disconnect'],
   ['setMessage("Wallet disconnected from this page. To use another wallet, switch the address in your wallet app, then press Connect wallet.")','useWallet > disconnect']]},
 'main.tsx':{why:'No call added or removed: the Disconnect button is markup with two attributes.',pieces:[],removed:[],uses:[]},
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
// Close and its Escape key, filters, search, Show all), which only change what is shown. v11 does not touch the file;
// the list is longer than in v10 only because every event handler and the snapshot handed to a component now count as
// action attributes. The StockShelves handlers behind those controls are pinned too.
const vaultAttributes=['onClick={s.retry}','snapshot={s}','value={VAULT}','snapshot={s}','onClick={onToggle}','onKeyDown={(e) => e.key === "Escape" && onClose()}','onClick={onClose}','value={a.token}','value={a.feed}','onClose={() => onClose(o.a.token)}','onToggle={() => onToggle(a.token)}','role="list"','role="group"','onClick={() => show(f, search)}','value={search}','onChange={(e) => show(filter, e.target.value)}','role="status"','onClick={() => show("all", "")}','onClick={() => show("all", "")}'];
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
// Every source is either frozen (byte-identical to HEAD) or a v11 file with its documented pieces (above).
assert.deepEqual([...sources].sort(),[...protectedFiles,...Object.keys(editedFiles)].filter(f=>/\.tsx?$/.test(f)).sort(),'every web/src source is frozen or a documented v11 file');
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
 "Flows.tsx": {
  "sha256": "2a444f9a1180a8f5e693d9ae7db5e8b4efd2899e4e6aab2724bfee440d741d8c",
  "callees": "useState useState useState useState useRef useLayoutEffect setRemoved useLayoutEffect setHeld setRemoved useLayoutEffect getElementById focus closest focus useEffect catch then getTransactionReceipt find map filter same decodeEventLog setReceived setHeld Number BigInt usd map worth kept filter kept onScreen sort filter onScreen filter onScreen every some toLowerCase trim toLowerCase startsWith includes includes toLowerCase sort map filter onScreen rank rank rank sort toLowerCase toLowerCase setRemoved setInputs setSearch closest getElementById contains focus focus querySelector setRemoved setInputs trim worth amount push push hoursLine slice slice some map fmt about remove reasonWords setShowSmall setSearch preventDefault add map slice add some rank toLowerCase map some add about join join same fmt useLayoutEffect setInput"
 },
 "wallet.tsx": {
  "sha256": "76209004bfb699f033e9ba9e7e42a5b08029064f660c535033933e46caf4cdb8",
  "callees": "getItem useRef savedDisconnected useRef accounts removeItem setItem setAccount setHash setMessage"
 },
 "main.tsx": {
  "sha256": "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
  "callees": ""
 }
};
// <<< reviewed calls
for(const f of Object.keys(editedFiles)){
 const {now,all}=scans[f],list=all.added.map(i=>[now.all[i].text,now.all[i].place]);
 assert.equal(all.added.map(i=>now.all[i].callee).join(' '),addedCallPins[f]?.callees,f+': added-call order or count differs from its reviewed list');
 assert.equal(sha256(JSON.stringify(list)),addedCallPins[f]?.sha256,f+': the complete ordered added-call list differs from its reviewed pin');
}
// Direct writes and mutating methods on transaction state, including aliases. A separate check is needed because
// an assignment or delete can change inputs without adding a call. Compare the full ordered writes with HEAD;
// v11 adds none. Shallow copies have fresh containers but can still hold references to an original nested object.
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
for(const f of [...Object.keys(expected),...Object.keys(attributeChanges),...Object.keys(callChanges)])assert.ok(f in editedFiles,f+': a documented difference in a file that is not a v11 file');
// A6 G-A: wallet sends and raw requests. Listed in order per file, each with its place: every use of a send/request
// name or of the provider (ethereum), with the call around it; every string that names a sending or signing method
// (folded across +); computed access to the global object with any key (window[...], also window["fetch"]); eval,
// Function, Reflect; and (new in v11) the names by which a page reaches the network by itself (fetch,
// XMLHttpRequest, WebSocket, EventSource, sendBeacon, importScripts, a dynamic import), written as a name or as a
// plain string (folded across +). Every file equals HEAD after the one exact startup reply guard below is restored.
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
 // Only the answer handling of the existing startup read changes, exactly once in its original scope.
 // The request itself is also compared directly by guarded calls and named methods, without any exception.
 const restored=n.map(x=>({...x,text:restoreAccountReply(x,f)}));
 if(f==='wallet.tsx')assert.equal(n.filter(x=>x.place==='useWallet'&&x.text===ACCOUNT_REPLY[0]+' .catch(() => { })').length,1,'wallet.tsx: one exact guarded startup reply');
 assert.deepEqual(restored,h,f+': a wallet send, provider request, signing method or network call was added, removed, changed or moved');
 if(f==='wallet.tsx')assert.deepEqual(n.filter(x=>x.place==='useWallet > disconnect'),[],'wallet.tsx disconnect(): no provider request');
 if(NO_SEND.includes(f))assert.ok(n.every(x=>x.text==='window.ethereum'),f+' must contain no send or request (only the read of window.ethereum in main.tsx)');
 if(n.length)sendUses[f]=n.map(x=>x.text);
}
// components.tsx (the shared transaction button) keeps exactly HEAD's single wallet.send.
assert.deepEqual(sendUses['components.tsx'].filter(x=>/\(/.test(x)),['wallet.send(await getSpec(), scope, scope)'],'components.tsx sends');
// v11: what a page can load or open without any of those names. Listed in order per file, each with its place: the
// names in LOADS, written as a name, a property or a plain string (folded across +): a picture, sound or worker made
// in script; the address bar, the history and the navigator; a new window; an element or HTML built in script; a
// src, href, action or style set in script. Then every JSX attribute in LOAD_ATTRIBUTES (any letter case) with its
// whole value, and every spread of attributes onto an element. Every file equals HEAD, with no exception: v11 adds no
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
const loadUses={};
for(const f of sources){
 const h=loadsOf(baseline('web/src/'+f),f),n=loadsOf(read('web/src/'+f),f);
 assert.deepEqual(n,h,f+': something a page loads or opens (a picture, frame, worker or element made in script, a navigation, a link, a style attribute) was added, removed, changed or moved');
 if(n.length)loadUses[f]=n.length;
}
// v11: the wallet and RPC methods the pages name. Every `method` given as a property (or assigned) in web/src, in order
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
// v11: what the pages keep in the browser. Every use of localStorage, sessionStorage, indexedDB, cookie or caches, in
// order: HEAD's, plus the three uses of the remembered "disconnected" flag in wallet.tsx (read once at start, cleared
// when Connect wallet is answered with an account, set by Disconnect). Its key is pinned with the names below.
const STORE=new Set(['localStorage','sessionStorage','indexedDB','cookie','caches']);
function storageOf(text,file){
 const tree=parse(text,file),print=printerOf(tree),out=[];
 (function v(n){if(ts.isIdentifier(n)&&STORE.has(n.text))out.push({text:print(top(n)),place:place(n,tree)});ts.forEachChild(n,v);})(tree);
 return out;
}
const storageAdded={'wallet.tsx':[['localStorage.getItem(disconnectedKey)','savedDisconnected'],['localStorage.removeItem(disconnectedKey)','useWallet > connect'],['localStorage.setItem(disconnectedKey, "1")','useWallet > disconnect']]};
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
// wallet.tsx send(), the only function that asks the wallet for a transaction: printed without comments it equals
// HEAD (v11 documents no piece in it), so from, to, data, gas (estimate x 1.3), nonce, the chain and account
// rechecks, the simulation and the eth_sendTransaction request are unchanged. There is one function of that name.
sameFunction('wallet.tsx','send','v11 changes nothing in it');
// Flows.tsx approveAll(), the approvals before a deposit: equal to HEAD, so each approval is still
// token(t, "approve", [VAULT, n]) with n the previewed amount of that stock, after the same balance and allowance reads.
sameFunction('Flows.tsx','approveAll','v11 changes nothing in it');
// wallet.tsx disconnect(), the whole local-only function, word for word. It returns at once while a send is running,
// forgets the account and last transaction link on this page and sets the flag. It makes no provider request and
// changes no chain id, no pending transaction and nothing a send reads but the account.
const DISCONNECT="function disconnect() { if (sending.current) return; accountVersion.current++; disconnected.current = true; try { localStorage.setItem(disconnectedKey, \"1\"); } catch { } setAccount(undefined); setHash(undefined); setMessage(\"Wallet disconnected from this page. To use another wallet, switch the address in your wallet app, then press Connect wallet.\"); }";
assert.deepEqual(functionsNamed(baseline('web/src/wallet.tsx'),'wallet.tsx','disconnect'),[],'wallet.tsx: no disconnect() at HEAD');
assert.deepEqual(functionsNamed(read('web/src/wallet.tsx'),'wallet.tsx','disconnect'),[DISCONNECT],'wallet.tsx disconnect() differs from the pinned text');
pinnedFunctions['wallet.tsx disconnect()']={pinnedText:true,length:DISCONNECT.length,sha256:sha256(DISCONNECT)};
// Connect keeps HEAD's complete function after these two exact intent changes: invalidate the startup read,
// and clear the saved Disconnect flag only when the explicit account request returns an account.
const CONNECT_PIECES=[['connectingLock.current = true; accountVersion.current++;','connectingLock.current = true;'],
 ['if (a[0]) { disconnected.current = false; try { localStorage.removeItem(disconnectedKey); } catch { } } setAccount(a[0]);','setAccount(a[0]);']];
const connectNow=functionsNamed(read('web/src/wallet.tsx'),'wallet.tsx','connect');
assert.equal(connectNow.length,1,'wallet.tsx: one connect()');
assert.deepEqual(connectNow.map(x=>putBack(x,CONNECT_PIECES,'wallet.tsx connect()')),functionsNamed(baseline('web/src/wallet.tsx'),'wallet.tsx','connect'),'wallet.tsx connect(): only the two reviewed intent changes');
pinnedFunctions['wallet.tsx connect()']={pinnedText:true,length:connectNow[0].length,sha256:sha256(connectNow[0])};
// Pin every mention of the new generation ref, including its declaration and complete containing statement.
// This catches a removed increment, changed guard, alias or extra assignment after either regeneration mode.
const accountIntentUses=[];
{const tree=parse(read('web/src/wallet.tsx'),'wallet.tsx'),print=printerOf(tree);
 (function visit(n){if(ts.isIdentifier(n)&&n.text==='accountVersion'){let statement=n;while(statement.parent&&!ts.isStatement(statement))statement=statement.parent;accountIntentUses.push([print(statement),place(n,tree)]);}ts.forEachChild(n,visit);})(tree);}
assert.deepEqual(accountIntentUses,[['const accountVersion = useRef(0);','useWallet'],['accountVersion.current++;','useWallet'],['const version = accountVersion.current;','useWallet'],['if (version === accountVersion.current) accounts(a);','useWallet'],['accountVersion.current++;','useWallet'],['accountVersion.current++;','useWallet > connect'],['accountVersion.current++;','useWallet > disconnect']],'wallet.tsx: the exact startup account intent guard');
// What the wallet hook hands to the pages: HEAD's list with `disconnect` added. `send` is handed over by its own name,
// so the pages still call the function pinned above (the names check below finds one `send` in the hook).
function hookReturn(text){
 const tree=parse(text,'wallet.tsx'),print=printerOf(tree),hook=tree.statements.filter(st=>ts.isFunctionDeclaration(st)&&st.name?.text==='useWallet');
 assert.equal(hook.length,1,'wallet.tsx: one useWallet');
 const returns=hook[0].body.statements.filter(ts.isReturnStatement);
 assert.equal(returns.length,1,'wallet.tsx useWallet: one return');
 return print(returns[0]);
}
const HOOK_RETURN_PIECE=['connect, disconnect, switchChain,','connect, switchChain,'];
assert.equal(putBack(hookReturn(read('web/src/wallet.tsx')),[HOOK_RETURN_PIECE],'wallet.tsx useWallet return'),hookReturn(baseline('web/src/wallet.tsx')),'wallet.tsx: the hook returns something other than HEAD\'s list plus disconnect');
// Names. In the v11 files every name HEAD declares at the top of the file (imports included) and at the top of each
// component or hook (parameters included) is still declared there once, by the same text: the same import, the same
// useState or useRef, the same expression. So `vault`, `token`, `amount`, `depositArgs`, `VAULT`, `quote`, `inputs`,
// `open`, `approvals`, `account` and every other name the pinned transaction code uses still mean what they meant at
// HEAD. The names v11 adds at the top of a file are listed here; a name v11 adds at the top of a component or hook
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
// Scoping. The transaction code of a v11 file is send(), approveAll() and every attribute that builds or starts a
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
 // decodeEventLog, client and vaultAbi read and decode the receipt of the confirmed deposit ("You received"),
 // reasonWords says why a row is blocked, hoursLine writes the hours in the one-line status; Hex and Asset are types.
 'Flows.tsx':{decodeEventLog:'import decodeEventLog from "viem"',Hex:'import type Hex from "viem"',client:'import client from "./chain"',vaultAbi:'import vaultAbi from "./chain"',reasonWords:'import reasonWords from "./chain"',Asset:'import type Asset from "./model"',hoursLine:'import hoursLine from "./Vault"'},
 // The key of the remembered flag and the function that reads it once when the page starts.
 'wallet.tsx':{disconnectedKey:'disconnectedKey = "basket-disconnected-4663"',savedDisconnected:'function'},
 'main.tsx':{},
};
const newNames={};
for(const f of Object.keys(editedFiles)){
 const h=scopes(baseline('web/src/'+f),f),n=scopes(read('web/src/'+f),f);
 for(const name in h.module)assert.deepEqual(n.module[name],h.module[name],f+': '+name+' is declared differently at the top of the file');
 assert.deepEqual(Object.fromEntries(Object.keys(n.module).filter(name=>!(name in h.module)).map(name=>[name,n.module[name].join(' | ')])),namesAdded[f],f+': the names added at the top of the file (imports included) differ from the documented ones');
 for(const fn in h.functions){
  const was=h.functions[fn],is=n.functions[fn];
  assert.ok(is,f+': '+fn+' is gone');
  for(const name in was)assert.deepEqual(is[name],was[name],f+' '+fn+': '+name+' is declared differently');
  const added=Object.keys(is).filter(name=>!(name in was));
  for(const name of added){assert.equal(is[name].length,1,f+' '+fn+': '+name+' is declared twice');assert.ok(!(name in n.module),f+' '+fn+': the new name '+name+' hides a name declared at the top of the file');}
  if(added.length)(newNames[f]??={})[fn]=added;
 }
}
// Differential encoding: HEAD and current governance/model/chain bundled side by side. For the same inputs the
// calldata must be byte-identical whenever the current page accepts; v11 adds no refusal, never accepts what HEAD
// refused, and refuses with HEAD's words (model.ts, chain.ts and governance.ts are byte-identical to HEAD in v11).
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
// HEAD (v11 documents no piece: the [v11, HEAD] lists are empty), or equals the pinned v9 text: the Guardian and
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
// still made, by HEAD and now alike, and v11 adds none.
for(const m of [U128,'The new guardian must not be the vault.','The new owner must not be the vault.',SPRING]) assert.ok(tally.refusedBoth[m]>0,'corpus exercises (refused by HEAD and now alike): '+m);
assert.deepEqual(tally.newRefusals,{},'no new refusal');
assert.ok(tally.sameCalldata>400,'corpus size '+JSON.stringify(tally));
fs.rmSync(scratch,{recursive:true,force:true});
// The report. The delivery is close to its size limit, so each piece is recorded by length and SHA-256, not repeated.
const pieceRecord=([v11,head])=>({v11:{length:v11.length,sha256:sha256(v11)},head:{length:head.length,sha256:sha256(head)}});
const brief=x=>x.length>120?{start:x.slice(0,80),length:x.length,sha256:sha256(x)}:x;
fs.writeFileSync('../artifacts/calldata-comparison.json',JSON.stringify({result:'PASS',baseline:git(['rev-parse','HEAD']).trim(),protectedFiles,editedFiles:Object.fromEntries(Object.entries(editedFiles).map(([f,x])=>[f,x.length+' documented pieces [v11, HEAD]'])),v11Pieces:Object.fromEntries(Object.entries(editedFiles).map(([f,x])=>[f,x.map(pieceRecord)])),counts,
 documentedGuardedCallChanges:expected,documentedAttributeChanges:Object.fromEntries(Object.entries(attributeChanges).map(([f,a])=>[f,{removed:a.removed.map(x=>'<'+x[0]+'> '+x[1]),added:a.added.map(x=>'<'+x[0]+'> '+x[1]),why:'each has its why in scripts/check-calldata.mjs'}])),
 documentedCallChanges:Object.fromEntries(Object.entries(callChanges).map(([f,c])=>[f,{why:c.why,piecesPutBackInsideCalls:c.pieces.map(pieceRecord),removed:c.removed.map(brief),newUsesOfWatchedNames:c.uses.map(([x,where])=>[brief(x),where])}])),
 vaultStockShelves:{attributes:vaultAttributes,handlers:vaultHandlers},pinnedFunctions,walletHookReturn:{equalToHeadPlus:'disconnect'},
 walletAndRpcMethods:{named:methods,addedInV11:[]},browserStorageAddedInV11:storageAdded,namesAddedAtTheTopOfAFile:namesAdded,namesAddedInsideComponents:newNames,transactionCode,reviewedAddedCalls:addedCallPins,transactionStateWrites,
 differentialEncoding:{cases:cases.length,...tally},sendBuilders:{clocks,...sends},pinnedDeclarations:pinned,
 sendsAndRequests:{sendFreeFiles:NO_SEND,usesPerFile:Object.fromEntries(Object.entries(sendUses).map(([f,x])=>[f,x.length])),components:sendUses['components.tsx'].filter(x=>/\(/.test(x)),addedInV11:[]},
 pageLoads:{names:[...LOADS],jsxAttributes:[...LOAD_ATTRIBUTES],usesPerFile:loadUses,equalToHead:true},
 pinnedV9Declarations:Object.fromEntries(Object.entries(pinnedV9).map(([f,m])=>[f,Object.fromEntries(Object.entries(m).map(([k,x])=>[k,typeof x==='string'?'v9 text (also at HEAD)':'equal to HEAD ('+x.length+' pieces)']))])),importBindings:imports,
 checks:['v11 scope: Docs, Losses, Owner, Scenery, Vault, chain, components, deployment, governance, model, newYork, poolMath and the ABI byte-identical to HEAD; Flows.tsx, wallet.tsx and main.tsx byte-identical to HEAD once their documented v11 pieces are put back, each exactly once (Flows: the rebuilt Deposit form, the "You received ... BASK" line, the Redeem amount box emptied after a confirmed redeem; wallet: the remembered disconnected flag and disconnect(); main: the Disconnect button); the pieces are recorded here by length and SHA-256; no source file added or removed',
  'Every vault/token/feed/read call, transaction argument parser, encoding, simulation and send, and every method called on the public client (the guarded calls), equals the HEAD AST in order in every web/src source, apart from two documented additions in Flows.tsx: the one new chain read, client.getTransactionReceipt of the visitor\'s own confirmed deposit, and the display-only amount() of the estimated total, both in DepositPage outside every handler; wallet.tsx adds no guarded call or provider request',
  'Action, send and check JSX attributes (every event handler, the wallet and snapshot handed to a component, and the listed names) equal HEAD in every file, in order, apart from the documented ones of Flows.tsx and main.tsx, each listed with its element and a why; no onSubmit, getSpec, build or claim attribute is added, removed or changed in any file (their texts equal HEAD in order), and no added or removed attribute contains a guarded call; Vault.tsx has no guarded call at all, its attributes equal the pinned list and its StockShelves handlers equal their pinned text',
  'Every call expression of HEAD in Flows.tsx, wallet.tsx and main.tsx is still there, in order, apart from the documented removed ones (the old grid of Add buttons, the old search filter and the old amount rows in Flows.tsx; a call that only gained a documented piece inside it counts as kept); the complete ordered added calls, including their callbacks and places, match independently reviewed SHA-256 pins and ordered callee lists that the piece-regeneration tool never refreshes',
  'Direct and aliased assignments, deletion, updates and mutating methods on inputs, open, quote and its arrays, balances, allowances and s.assets equal HEAD in order; shallow copies retain tracking of nested references',
  'Watched names (the names that build, parse, read or send, and the state setters and refs each file had at HEAD): every use, a call or the bare name handed on or renamed, equals HEAD in order and place, apart from the documented new uses: the receipt read with its whole answer handling, the writes of Add and Remove to the typed amounts and to the search text, the amount() of the estimated total, the search box, the emptied Redeem amount box, and in disconnect() the look at the send lock and the forgetting of the account, the transaction link and the top message',
  'Wallet sends and raw requests: in every web/src file the uses of a send/request name or of the provider (ethereum) with their calls, every string naming a sending or signing method, computed access to the global object with any key, eval/Function/Reflect and the listed names that reach the network (fetch, XMLHttpRequest, WebSocket, EventSource, sendBeacon, importScripts, dynamic import; as a name or as a plain string) equal HEAD in order and place after restoring the exact guarded startup eth_accounts reply once; the request expression and every method still equal HEAD directly; Vault, Scenery, main and Docs have no send or request (main only reads window.ethereum), components keeps the single wallet.send of HEAD',
  'What a page can load or open without those names equals HEAD in every web/src file, in order and place, with no exception: the listed names (a picture, sound or worker made in script, the address bar, the history, the navigator, a new window, an element or HTML built in script, a src, href, action or style set in script; as a name, a property or a plain string), the JSX attributes that carry an address, a style or HTML, and attributes spread onto an element. A list of known ways, not a proof that no other exists',
  'The wallet and RPC methods named in web/src equal HEAD with no additions; browser storage is used as at HEAD plus the three documented uses of the disconnected flag (key "basket-disconnected-4663")',
  'wallet.tsx send() (the only function that asks the wallet for a transaction) equals HEAD: from, to, data, gas, nonce, chain and account rechecks, simulation and the eth_sendTransaction request unchanged; disconnect() equals its pinned text; the hook returns HEAD\'s list plus disconnect, so the pages call the same send',
  'Flows.tsx approveAll() equals HEAD, and so does every onSubmit and getSpec (the two previews, Deposit, Redeem and Claim); in the three v11 files every name HEAD declares at the top of the file (imports included) and at the top of each component or hook is still declared once by the same text, the names added at the top of a file are the documented ones, and a new name inside a component hides none of them',
  'Argument sources: governance.ts proposalAction (Guardian target newGuardian(v.next), FeeRecipient target feeRecipient(v.recipient)), proposalSpec, settingValues and poolValues equal HEAD; newOwner, newGuardian, feeRecipient, minLiquidityOf and the spring-forward rule equal the pinned v9 text (at HEAD and now); Owner.tsx checkRows equals HEAD and the Finalize helpers equal the pinned v9 text; the names these call are bound only by their imports; the encoders use the same vault address',
  'Differential encoding of HEAD and current governance/model/chain: identical calldata for every input the page accepts (proposals of every kind, transfer ownership, genesis listing); no new refusal, nothing HEAD refused is accepted, and every refusal has HEAD\'s words (the v9 refusals, uint128 minLiquidity, vault as guardian or new owner, Sunday 2:00-2:59 am start under Dst 0, are still made by both)',
  'Under six fixed clocks: deadline() and the full depositArgs and redeemArgs tuples (deadline included) equal HEAD, and so does the encoded deposit and redeem calldata; redeem built as Flows does (amount, recipient, redeemArgs), approve (amount with 0/6/8/18 decimals), claim (recipient), lowerNAVCap (amount, zero allowed), close and removeRetired (address), and the uint and address parsers give the same value or are refused by both, with no new refusal',
  'The printed text (no comments) of same, deadline, depositArgs, redeemArgs, amount, address, recipient, uint and parseLaunch in model.ts and of vault, token and encode in chain.ts equals HEAD',
  'Only the v11 files change in web/src (check-bundle.mjs)']},null,2)+'\n');
console.log('PASS baseline call-expression comparison',counts,'differential encoding',tally,'send builders',sends);

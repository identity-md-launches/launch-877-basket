import assert from "node:assert/strict";
import fs from "node:fs";
import {
  exact,
  amount,
  parseLaunch,
  depositArgs,
  redeemArgs,
  date,
  hoursWords,
} from "../src/model";
import {
  settingWords,
  proposalAction,
  poolValues,
  settingValues,
  gasMaximum,
  settingBoundsWords,
  freshWords,
  proposalWords,
  newOwner,
  SPRING_FORWARD_START,
} from "../src/governance";
import { sqrtAtTick, poolMetrics } from "../src/poolMath";
import { VAULT, zeroAddress, reasonWords, minutesOf } from "../src/chain";
import {
  inside,
  nextOpening,
  parseHours,
  weekdayWords,
  hoursWordsOf,
  dstWords,
  dateWords,
} from "../src/newYork";
import {
  closedWords,
  reopenAt,
  mayBeOpen,
  localWords,
  hoursLine,
} from "../src/Vault";
// A wrong-checksum address built from VAULT itself: flip the case of its letters.
const badChecksum = VAULT.replace(/[a-f]/g, (c) => c.toUpperCase());
assert.notEqual(badChecksum, VAULT);
const line = `BASK ${VAULT} ${VAULT} ${zeroAddress} ${zeroAddress} 0`;
assert.equal(parseLaunch(line)[0].line, 1);
assert.throws(() => parseLaunch(""), /Line 1/);
assert.equal(parseLaunch("\n" + line)[0].line, 2);
for (const [field, index, value] of [
  ["token", 1, "bad"],
  ["feed", 2, badChecksum],
  ["minLiquidity", 5, "-1"],
] as const) {
  const parts = line.split(" ");
  parts[index] = value;
  assert.throws(
    () => parseLaunch("\n" + parts.join(" ")),
    new RegExp(`Line 2: ${field}`),
  );
}
assert.throws(() => parseLaunch(line + "\n" + line), /Line 2/);
const value = 12345678901234567890123456789n;
assert.equal(amount(exact(value)), value);
assert.equal(exact(1000001n, 6), "1.000001");
assert.equal(settingWords(8, 300n), "3% (300 basis points)");
assert.match(settingWords(2, 93600n), /26 hours/);
assert.equal(settingWords(15, 3n), "With at most 3 held stocks, every leg is tried now; with more, every leg is owed for claims. Zero disables direct attempts.");
assert.match(settingWords(0, 4n), /centre \/4 to ×4/);
assert.match(settingWords(5, 0n), /always open/);
assert.equal(
  settingWords(5, 72000n, 504000n),
  "Sunday 8:00 pm to Friday 8:00 pm New York time",
);
assert.equal(settingWords(6, 1n), "never daylight saving (UTC-5)");
assert.deepEqual(dstWords.length, 3);
// Hours: seconds since Sunday 00:00 New York; start inclusive, end exclusive.
assert.deepEqual(parseHours("Monday 9:30 am", "Friday 4:00 pm"), [120600n, 489600n]);
assert.deepEqual(parseHours("Sunday 20:00", "Saturday 24:00"), [72000n, 604800n]);
assert.deepEqual(parseHours("Always open", "always open"), [0n, 0n]);
assert.throws(() => parseHours("Friday 4:00 pm", "Monday 9:30 am"), /earlier/);
assert.throws(() => parseHours("Monday 24:00", "Friday 4:00 pm"));
assert.throws(() => parseHours("09:30", "16:00"), /weekday/);
assert.throws(() => parseHours("Always open", "Friday 4:00 pm"), /both/);
assert.equal(weekdayWords(120600n), "Monday 9:30 am");
assert.equal(hoursWordsOf(72000n, 504000n), "Sunday 8:00 pm to Friday 8:00 pm New York time");
// NewYorkTime port against the brief's vectors (dst 0, 72000-504000 unless stated).
assert.equal(inside(1791507677n, 72000n, 504000n, 0n), true);
assert.equal(nextOpening(1791648000n, 72000n, 0n), 1791763200n);
assert.equal(nextOpening(1793404800n, 72000n, 0n), 1793581200n);
assert.equal(nextOpening(1804899600n, 72000n, 0n), 1805068800n);
assert.equal(nextOpening(1791648000n, 72000n, 1n), 1791766800n);
assert.equal(nextOpening(1793404800n, 72000n, 2n), 1793577600n);
assert.equal(nextOpening(1791648000n, 120600n, 1n), 1791815400n);
for (const [from, to] of [[72000n, 504000n], [120600n, 489600n]] as const)
  for (const dst of [0n, 1n, 2n]) {
    const t = nextOpening(1791648000n, from, dst);
    assert.equal(inside(t - 1n, from, to, dst), false);
    assert.equal(inside(t, from, to, dst), true);
  }
// Action struct per kind; a set pool refuses minLiquidity 0 (audit L2).
const hours = proposalAction(10, { setting: "5", from: "Monday 9:30 am", to: "Friday 4:00 pm" });
assert.deepEqual([hours.kind, hours.setting, hours.value, hours.value2], [10, 5, 120600n, 489600n]);
const dst = proposalAction(10, { setting: "6", value: "1" });
assert.deepEqual([dst.setting, dst.value, dst.value2], [6, 1n, 0n]);
assert.throws(() => proposalAction(10, { setting: "6", value: "3" }), /0, 1 or 2/);
const list = proposalAction(0, { token: VAULT, feed: VAULT, pool: zeroAddress, quoteFeed: zeroAddress, minLiquidity: "0" });
assert.equal(list.target, VAULT);
assert.equal(list.pool, zeroAddress);
assert.throws(() => poolValues({ pool: VAULT, quoteFeed: VAULT, minLiquidity: "0" }), /above zero/);
assert.throws(() => parseLaunch(`BASK ${VAULT} ${VAULT} ${VAULT} ${VAULT} 0`), /above zero/);
assert.equal(sqrtAtTick(0n), 2n ** 96n);
assert.equal(sqrtAtTick(-887272n), 4295128739n);
assert.equal(
  sqrtAtTick(887272n),
  1461446703485210103287273052203988822378723970342n,
);
const metrics = poolMetrics(
  [0n, 0n],
  [0n, (1800n << 128n) / 1000000000000n],
  1800n,
  true,
  18,
  18,
  100n * 10n ** 8n,
  8,
);
assert.equal(metrics.liquidity, 1000000000000n);
assert.equal(metrics.price, 100n * 10n ** 18n);
assert.throws(() =>
  poolMetrics([0n, 0n], [0n, 0n], 1800n, true, 18, 18, 1n, 8),
);
assert.equal(depositArgs([VAULT], [1n], VAULT, 1000n)[3], 995n);
assert.deepEqual(redeemArgs(1n, VAULT, [0n, 3333n])[2], [0n, 3329n]);
// ---- v9 low fixes ----
const other = "0x1111111111111111111111111111111111111111";
// F1: minLiquidity of a Pool or List proposal is a 128-bit number, like the listing parser.
const u128 = 2n ** 128n - 1n;
assert.equal(
  poolValues({ pool: VAULT, quoteFeed: VAULT, minLiquidity: String(u128) })[2],
  u128,
);
for (const big of [2n ** 128n, 2n ** 256n - 1n])
  assert.throws(
    () =>
      poolValues({ pool: VAULT, quoteFeed: VAULT, minLiquidity: String(big) }),
    /Minimum raw pool liquidity: enter an unsigned 128-bit whole number\./,
  );
assert.throws(
  () => poolValues({ pool: VAULT, quoteFeed: VAULT, minLiquidity: "0" }),
  /above zero/,
);
assert.equal(
  proposalAction(5, {
    token: VAULT,
    pool: VAULT,
    quoteFeed: VAULT,
    minLiquidity: String(u128),
  }).value,
  u128,
);
assert.throws(
  () =>
    proposalAction(0, {
      token: VAULT,
      feed: VAULT,
      pool: VAULT,
      quoteFeed: VAULT,
      minLiquidity: String(2n ** 128n),
    }),
  /128-bit/,
);
assert.throws(
  () => parseLaunch(`BASK ${VAULT} ${VAULT} ${VAULT} ${VAULT} ${2n ** 128n}`),
  /128-bit/,
);
// F2: BalanceGas/PayGas maximum, checked against the combined rule in
// BaskVault._changedSettings (bounds 20,000-500,000 too).
const allowed = (c: any) =>
  c.balanceGas >= 20_000n &&
  c.balanceGas <= 500_000n &&
  c.payGas >= 20_000n &&
  c.payGas <= 500_000n &&
  c.maxAssets <= 28_000_000n / (c.balanceGas + 60_000n) &&
  c.directLimit <= 28_000_000n / (c.balanceGas + c.payGas + 70_000n);
const gasCases = [
  { maxAssets: 100n, directLimit: 100n, balanceGas: 100_000n, payGas: 100_000n },
  { maxAssets: 40n, directLimit: 3n, balanceGas: 50_000n, payGas: 300_000n },
  { maxAssets: 25n, directLimit: 0n, balanceGas: 50_000n, payGas: 50_000n },
  { maxAssets: 350n, directLimit: 254n, balanceGas: 20_000n, payGas: 20_000n },
];
for (const c of gasCases) {
  // Current settings always pass the vault's own check.
  assert.ok(allowed(c));
  for (const [key, field] of [
    [12, "balanceGas"],
    [13, "payGas"],
  ] as const) {
    const max = gasMaximum(key, c)!;
    if (max >= 20_000n)
      assert.ok(allowed({ ...c, [field]: max }), `${field} ${max} allowed`);
    assert.ok(!allowed({ ...c, [field]: max + 1n }), `${field} ${max + 1n} refused`);
  }
}
assert.equal(gasMaximum(12, gasCases[0]), 110_000n);
assert.equal(gasMaximum(13, gasCases[0]), 110_000n);
assert.equal(gasMaximum(13, gasCases[2]), 500_000n);
assert.match(
  settingBoundsWords(12, gasCases[0]),
  /maxAssets × \(balanceGas \+ 60,000\) ≤ 28,000,000 and directLimit × \(balanceGas \+ payGas \+ 70,000\) ≤ 28,000,000\. Current maximum 110,000 /,
);
assert.match(
  settingBoundsWords(13, gasCases[0]),
  /directLimit × \(balanceGas \+ payGas \+ 70,000\) ≤ 28,000,000\. Current maximum 110,000 /,
);
assert.equal(gasMaximum(12, gasCases[3]), 20_000n);
assert.equal(gasMaximum(13, gasCases[3]), 20_236n);
// Words for a maximum under 20,000 (settings the vault would not hold).
assert.match(
  settingBoundsWords(12, { ...gasCases[3], maxAssets: 400n }),
  /no value fits: lower MaxAssets or DirectLimit first/,
);
assert.match(settingBoundsWords(13, undefined), /Current maximum unreadable/);
assert.equal(gasMaximum(11, gasCases[0]), undefined);
// F3: Dst 1 or 2 hours are a fixed UTC-5 / UTC-4, not New York time.
assert.equal(
  hoursWordsOf(72000n, 504000n, 1n),
  "Sunday 8:00 pm to Friday 8:00 pm UTC-5",
);
assert.equal(
  hoursWordsOf(72000n, 504000n, 2n),
  "Sunday 8:00 pm to Friday 8:00 pm UTC-4",
);
assert.equal(
  hoursWordsOf(72000n, 504000n, 0n),
  "Sunday 8:00 pm to Friday 8:00 pm New York time",
);
const hoursSettings = (dst: bigint) => ({
  hoursFrom: 72000n,
  hoursTo: 504000n,
  dst,
  freshCount: 1n,
  freshHours: 1n,
  poolWindow: 1800n,
  poolDeviation: 300n,
});
assert.equal(
  hoursWords(hoursSettings(1n)),
  "Sunday 8:00 pm to Friday 8:00 pm UTC-5",
);
assert.equal(
  settingWords(5, 72000n, 504000n, hoursSettings(2n)),
  "Sunday 8:00 pm to Friday 8:00 pm UTC-4",
);
// F9: the Vault and Deposit pages show the hours in words only.
assert.equal(
  hoursLine(hoursSettings(0n)),
  "Sunday 8:00 pm to Friday 8:00 pm New York time",
);
// F6: the countdown follows now (block time plus the seconds since the read)
// and never shows next week's time at the boundary.
const saturdayNoon = BigInt(Date.UTC(2026, 9, 10, 16, 0) / 1000); // Sat 10 Oct 2026, 12:00 New York
for (const dst of [0n, 1n, 2n]) {
  const s = hoursSettings(dst),
    t = nextOpening(saturdayNoon, 72000n, dst);
  assert.equal(reopenAt(s, t - 1n), t);
  assert.equal(reopenAt(s, t), undefined, "read block already inside the hours");
  const zone = dst === 0n ? "New York time" : dst === 1n ? "UTC-5" : "UTC-4";
  assert.match(
    closedWords(3, s, t - 7260n, t - 7260n)!,
    new RegExp(
      `^Deposits reopen Sunday 8:00 pm ${zone} \\(.*, in 2 h 1 min; your time .*\\)\\.`,
    ),
  );
  assert.match(closedWords(3, s, t - 7260n, t - 7200n)!, /, in 2 h 0 min; /);
  assert.match(closedWords(3, s, t - 7260n, t - 1n)!, /, in 0 h 0 min; /);
  assert.equal(closedWords(3, s, t - 7260n, t), mayBeOpen);
  assert.equal(
    closedWords(3, s, t, t),
    mayBeOpen,
    "status reason 3 read on an earlier block",
  );
  assert.equal(closedWords(3, s, t + 3600n, t + 3600n), mayBeOpen);
}
assert.equal(mayBeOpen, "Deposits may be open now. Press Refresh vault.");
// F7: dates in words, never a numeric date.
const oct11 = BigInt(Date.UTC(2026, 9, 11, 4, 40) / 1000);
assert.equal(dateWords(oct11), "Sun 11 Oct 2026, 04:40 UTC (00:40 New York)");
assert.equal(date(oct11), "Sun 11 Oct 2026, 04:40 UTC (00:40 New York)");
assert.equal(
  date(BigInt(Date.UTC(2026, 9, 11, 2, 5) / 1000)),
  "Sun 11 Oct 2026, 02:05 UTC (Sat 22:05 New York)",
);
assert.equal(
  date(BigInt(Date.UTC(2027, 0, 4, 15, 0) / 1000)),
  "Mon 4 Jan 2027, 15:00 UTC (10:00 New York)",
);
assert.equal(date(0n), "Not set");
assert.equal(date(undefined), "unreadable");
assert.equal(date(2n ** 64n), "unreadable");
// v9 A5: a window start ("executable from", "Wait until", Losses' recognition date; the default) is rounded up to
// the next whole minute when it has seconds, an end ("until just before") down; whole minutes stay as they are.
const at0440 = "Sun 11 Oct 2026, 04:40 UTC (00:40 New York)",
  at0441 = "Sun 11 Oct 2026, 04:41 UTC (00:41 New York)";
assert.equal(date(oct11, "start"), at0440);
assert.equal(date(oct11, "end"), at0440);
for (const s of [1n, 30n, 59n]) {
  assert.equal(date(oct11 + s), at0441, `start + ${s} s rounds up`);
  assert.equal(date(oct11 + s, "start"), at0441);
  assert.equal(date(oct11 + s, "end"), at0440, `end + ${s} s rounds down`);
}
assert.equal(date(oct11 + 60n, "end"), at0441);
assert.equal(date(oct11 - 1n, "end"), "Sun 11 Oct 2026, 04:39 UTC (00:39 New York)");
// Rounding up crosses the hour, the day (and the New York weekday) and the year.
assert.equal(
  date(BigInt(Date.UTC(2026, 9, 11, 3, 59, 1) / 1000)),
  "Sun 11 Oct 2026, 04:00 UTC (00:00 New York)",
);
assert.equal(
  date(BigInt(Date.UTC(2026, 9, 11, 3, 59, 1) / 1000), "end"),
  "Sun 11 Oct 2026, 03:59 UTC (Sat 23:59 New York)",
);
assert.equal(
  date(BigInt(Date.UTC(2026, 11, 31, 23, 59, 30) / 1000)),
  "Fri 1 Jan 2027, 00:00 UTC (Thu 19:00 New York)",
);
// Never earlier than the real start, never later than the real end, at every second of a sample hour.
for (let s = 0n; s < 3600n; s += 7n) {
  const t = oct11 + s,
    words = (x: string) => {
      const m = x.match(/^\w{3} (\d+) \w{3} 2026, (\d{2}):(\d{2}) UTC/)!;
      return BigInt(Date.UTC(2026, 9, Number(m[1]), Number(m[2]), Number(m[3])) / 1000);
    };
  const up = words(date(t)),
    down = words(date(t, "end"));
  assert.ok(up >= t && up - t < 60n && up % 60n === 0n, `start ${t}`);
  assert.ok(down <= t && t - down < 60n && down % 60n === 0n, `end ${t}`);
}
assert.equal(date(1n), "Thu 1 Jan 1970, 00:01 UTC (Wed 19:01 New York)");
assert.equal(date(253402300740n), "Fri 31 Dec 9999, 23:59 UTC (18:59 New York)");
assert.equal(date(253402300741n), "unreadable", "rounding up past year 9999");
assert.equal(date(253402300799n, "end"), "Fri 31 Dec 9999, 23:59 UTC (18:59 New York)");
// Every date() shown on the pages: "until just before" (the end of a proposal's window) rounds down, every other one
// (executable from, Wait until, Losses' recognition date) is a start and rounds up.
{
  const shown: string[] = [];
  for (const f of ["Owner.tsx", "wallet.tsx", "Losses.tsx", "Vault.tsx", "Flows.tsx", "main.tsx", "components.tsx", "Docs.tsx"]) {
    const text = fs.readFileSync(`src/${f}`, "utf8");
    for (const m of text.matchAll(/(.{0,40})\bdate\(([^()]*)\)/g)) shown.push(`${f}: ${m[1].trim()} date(${m[2]})`);
  }
  assert.deepEqual(shown.filter((x) => /"end"/.test(x)).map((x) => /until just before \$\{ ?date\(/.test(x)), [true, true], "the two window ends round down");
  for (const x of shown.filter((x) => !/"end"/.test(x))) assert.ok(!/until just before/.test(x), "an end rounded up: " + x);
  assert.equal(shown.length, 7, "date() uses on the pages: " + JSON.stringify(shown));
}
const local = localWords(oct11);
assert.equal(
  local,
  new Date(Number(oct11) * 1000).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }),
);
assert.doesNotMatch(local, /\d{1,2}:\d{2}:\d{2}/, "no seconds");
assert.doesNotMatch(
  local,
  /\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}/,
  "no numeric date",
);
assert.ok(
  closedWords(3, hoursSettings(0n), oct11 - 90000n, oct11 - 90000n)!.includes(
    `your time ${localWords(nextOpening(oct11 - 90000n, 72000n, 0n))})`,
  ),
);
// F8: FreshCount in words, with singular and plural.
assert.equal(freshWords(0n, 1n), "off: deposits stay open when prices stop");
assert.equal(
  freshWords(1n, 1n),
  "at least 1 listed stock price updated within the last 1 hour; deposits close when prices stop (US market holidays) until one updates",
);
assert.equal(
  freshWords(3n, 2n),
  "at least 3 listed stock prices updated within the last 2 hours; deposits close when prices stop (US market holidays) until one updates",
);
assert.equal(
  settingWords(3, 2n, 0n, { freshHours: 1n }),
  "at least 2 listed stock prices updated within the last 1 hour; deposits close when prices stop (US market holidays) until one updates",
);
assert.equal(settingWords(3, 0n), "off: deposits stay open when prices stop");
assert.match(settingWords(4, 1n), /^1 hour; /);
assert.match(settingWords(4, 48n), /^48 hours; /);
// F12: reason 12 and the pairing label use settings().poolWindow and poolDeviation.
assert.equal(
  reasonWords(12, hoursSettings(0n)),
  "pool check failed (30-minute pool price over 3% off the feed, unreadable, under its floor or quote feed bad)",
);
assert.equal(
  reasonWords(12, { poolWindow: 900n, poolDeviation: 150n }),
  "pool check failed (15-minute pool price over 1.5% off the feed, unreadable, under its floor or quote feed bad)",
);
assert.doesNotMatch(reasonWords(12, null), /30-minute|3%/);
assert.equal(reasonWords(3, hoursSettings(0n)), "outside deposit hours");
assert.equal(minutesOf(1800n), "30-minute");
assert.equal(minutesOf(600n), "10-minute");
// F15: under Dst 0 an Hours start on Sunday 2:00-2:59 am is refused (skipped
// on the spring-forward Sunday); unreadable settings count as Dst 0.
const springForward = new RegExp(
  SPRING_FORWARD_START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
);
assert.equal(
  SPRING_FORWARD_START,
  "Sunday 2:00-2:59 am New York is skipped on the spring-forward Sunday; choose another start.",
);
for (const from of [
  "Sunday 2:00 am",
  "Sunday 2:30 am",
  "Sunday 2:59 am",
  "Sunday 02:15",
])
  for (const settings of [{ dst: 0n }, undefined]) {
    assert.throws(
      () => settingValues({ setting: "5", from, to: "Friday 4:00 pm" }, settings),
      springForward,
    );
    assert.throws(
      () =>
        proposalAction(10, { setting: "5", from, to: "Friday 4:00 pm" }, settings),
      springForward,
    );
  }
for (const dst of [1n, 2n])
  assert.deepEqual(
    settingValues(
      { setting: "5", from: "Sunday 2:30 am", to: "Friday 4:00 pm" },
      { dst },
    ),
    [5, 9000n, 489600n],
  );
for (const from of ["Sunday 1:59 am", "Sunday 3:00 am", "Monday 2:30 am"])
  assert.equal(
    settingValues({ setting: "5", from, to: "Friday 4:00 pm" }, { dst: 0n })[0],
    5,
  );
assert.deepEqual(
  settingValues(
    { setting: "5", from: "Sunday 1:00 am", to: "Sunday 2:30 am" },
    { dst: 0n },
  ),
  [5, 3600n, 9000n],
  "only the start is refused",
);
assert.deepEqual(
  settingValues(
    { setting: "5", from: "Always open", to: "Always open" },
    { dst: 0n },
  ),
  [5, 0n, 0n],
);
// F16: the vault is refused as new owner, guardian and fee recipient (zero was already refused).
for (const v of [VAULT, VAULT.toLowerCase()]) {
  assert.throws(() => newOwner(v), /The new owner must not be the vault\./);
  assert.throws(
    () => proposalAction(7, { next: v }),
    /The new guardian must not be the vault\./,
  );
  assert.throws(
    () => proposalAction(9, { recipient: v }),
    /The fee recipient must not be the vault\./,
  );
}
for (const k of [7, 9])
  assert.throws(
    () => proposalAction(k, { next: zeroAddress, recipient: zeroAddress }),
    /valid nonzero address/,
  );
assert.throws(() => newOwner(zeroAddress), /valid nonzero address/);
assert.equal(newOwner(other), other);
assert.equal(proposalAction(7, { next: other }).target, other);
assert.equal(proposalAction(9, { recipient: other }).target, other);
assert.match(
  proposalWords(
    proposalAction(10, {
      setting: "5",
      from: "Monday 9:30 am",
      to: "Friday 4:00 pm",
    }),
    hoursSettings(1n),
  ),
  /Monday 9:30 am to Friday 4:00 pm UTC-5$/,
);
fs.mkdirSync("../artifacts", { recursive: true });
fs.writeFileSync(
  "../artifacts/interface-unit.json",
  JSON.stringify(
    {
      result: "PASS",
      checks: [
        "line-numbered parser refusals including blank lines and checksum",
        "exact balances with no rounding or commas",
        "plain setting units, New York hours and Dst words, hours parser",
        "NewYorkTime port: inside and nextOpening vectors for dst 0, 1 and 2",
        "Action struct per proposal kind; set pool refuses minLiquidity 0",
        "TickMath boundaries and harmonic liquidity formula",
        "unchanged deposit/redeem minimum arithmetic",
        "v9 F1: Pool/List minLiquidity limited to 128 bits; a set pool with 0 still refused",
        "v9 F2: BalanceGas/PayGas maximum equals the vault's combined rule at max and max+1; bounds words",
        "v9 F3/F9: Dst 1 and 2 hours in UTC-5/UTC-4 words; Vault/Deposit hours in words only",
        "v9 F6: countdown follows the vault clock; boundary and inside-hours cases say Deposits may be open now",
        "v9 F7: dates in words (UTC and New York, US rule), your time without seconds or a numeric date",
        "v9 A5: a waiting window's start rounded up to the next whole minute, its end ('until just before') down",
        "v9 F8: FreshCount words with singular and plural; 0 is off",
        "v9 F12: reason 12 and the pairing label from settings().poolWindow and poolDeviation",
        "v9 F15: Sunday 2:00-2:59 am Hours start refused under Dst 0 (and unreadable Dst), allowed under Dst 1 and 2",
        "v9 F16: the vault refused as new owner, guardian and fee recipient",
      ],
    },
    null,
    2,
  ),
);
console.log(
  "PASS interface arithmetic, parser, exact balances and setting units",
);

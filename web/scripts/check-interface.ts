import assert from "node:assert/strict";
import fs from "node:fs";
import {
  exact,
  amount,
  parseLaunch,
  depositArgs,
  redeemArgs,
} from "../src/model";
import { settingWords, proposalAction, poolValues } from "../src/governance";
import { sqrtAtTick, poolMetrics } from "../src/poolMath";
import { VAULT, zeroAddress } from "../src/chain";
import {
  inside,
  nextOpening,
  parseHours,
  weekdayWords,
  hoursWordsOf,
  dstWords,
} from "../src/newYork";
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
      ],
    },
    null,
    2,
  ),
);
console.log(
  "PASS interface arithmetic, parser, exact balances and setting units",
);

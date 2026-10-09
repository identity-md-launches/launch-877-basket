import assert from "node:assert/strict";
import fs from "node:fs";
import {
  exact,
  amount,
  parseLaunch,
  depositArgs,
  redeemArgs,
} from "../src/model";
import { settingWords, parseTime } from "../src/governance";
import { sqrtAtTick, poolMetrics } from "../src/poolMath";
import { VAULT, zeroAddress } from "../src/chain";
const line = `BASK ${VAULT} ${VAULT} ${zeroAddress} ${zeroAddress} 0`;
assert.equal(parseLaunch(line)[0].line, 1);
assert.throws(() => parseLaunch(""), /Line 1/);
assert.equal(parseLaunch("\n" + line)[0].line, 2);
for (const [field, index, value] of [
  ["token", 1, "bad"],
  ["feed", 2, "0x4e19d7472e650399b06eeaa5ccc29da9b8efBebd"],
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
assert.equal(settingWords(7, 300n), "3% (300 basis points)");
assert.match(settingWords(2, 93600n), /26 hours/);
assert.equal(settingWords(14, 3n), "With at most 3 held stocks, every leg is tried now; with more, every leg is owed for claims. Zero disables direct attempts.");
assert.match(settingWords(0, 4n), /centre \/4 to ×4/);
assert.match(settingWords(5, 0n), /always open/);
assert.match(settingWords(5, parseTime("24:00")), /Monday to Friday only/);
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
        "plain setting units and hours semantics",
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

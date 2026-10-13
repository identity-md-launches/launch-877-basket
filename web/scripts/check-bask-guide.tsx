import assert from "node:assert/strict";
import fs from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BaskGuide } from "../src/BaskGuide";
import { fee, value, deposit, redeem, allocation, format, UNIT, LOCK, INITIAL, ADDED, REDEEMED, OUTPUTS, FRACTION, OUTPUT_VALUE, INTRO, SECTIONS, FLYWHEEL, FLYWHEEL_NAV_BEFORE, FLYWHEEL_NAV_AFTER, FLYWHEEL_REDEEMED, FLYWHEEL_OUTPUT, FLYWHEEL_UNCHANGED_VALUE, FLYWHEEL_RISEN_VALUE, FLYWHEEL_RECEIVED, FLYWHEEL_GAIN } from "../src/baskGuideData";

// Independent expectations audited against web/pinned/src/BaskVault.sol, not computed by the page.
assert.equal(fee(1n), 1n);
assert.equal(fee(200n), 1n);
assert.equal(fee(201n), 2n);
assert.equal(fee(201n, false), 0n);
assert.equal(value(1_234_567n, 100_000_000n, 6, 8), 1_234_567_000_000_000_000n);
assert.equal(value(1_234_567_890_123_456_789n, 12_345_678n, 18, 8), 152_415_776_406_035_777n);
assert.deepEqual(INITIAL, { gross: 1000n * UNIT, fee: 5n * UNIT, locked: 10n ** 15n, received: 994_999n * 10n ** 15n, supplyAfter: 1000n * UNIT, navAfter: 1000n * UNIT });
assert.equal(deposit(2n * LOCK, 0n, 0n, false).received, LOCK);
assert.throws(() => deposit(LOCK, 0n, 0n, false), /Zero shares/);
assert.equal(deposit(10n, 7n, 3n, false).gross, 23n);
assert.throws(() => deposit(UNIT, UNIT, 0n), /Zero NAV/);
assert.equal(ADDED.gross, 500n * UNIT);
assert.equal(ADDED.received, 4975n * 10n ** 17n);
assert.equal(ADDED.fee, 25n * 10n ** 17n);
assert.equal(ADDED.navAfter, 21000n * UNIT);
assert.equal(ADDED.supplyAfter, 10500n * UNIT);
assert.equal(INITIAL.received + INITIAL.fee + INITIAL.locked, INITIAL.supplyAfter);
assert.deepEqual(REDEEMED, { fee: 5n * UNIT, burned: 995n * UNIT, supplyAfter: 9005n * UNIT });
assert.equal(REDEEMED.supplyAfter, 10000n * UNIT - 1000n * UNIT + 5n * UNIT, "fee transfers; only net BASK burns");
assert.deepEqual(redeem(201n, 1000n, false), { fee: 0n, burned: 201n, supplyAfter: 799n });
assert.deepEqual(OUTPUTS, [995n * 10n ** 16n, 597n * 10n ** 16n]);
assert.equal(FRACTION, "9.95%");
assert.equal(OUTPUT_VALUE, 1990n * UNIT);
// Raw stock units deliberately differ: zero, six and eighteen token decimals.
assert.equal(allocation(7n, 7n, 0n, 1n, 3n), 2n);
assert.equal(allocation(1_000_001n, 1_000_001n, 0n, 1n, 3n), 333_333n);
assert.equal(allocation(10n ** 18n + 1n, null, 999n, 1n, 3n), 333_333_333_333_333_333n);
assert.equal(allocation(100n, 90n, 30n, 1n, 3n), 20n, "reserved debt cap");
assert.equal(allocation(100n, 500n, 0n, 1n, 3n), 33n, "donations do not increase managed");
assert.equal(allocation(100n, 20n, 30n, 1n, 3n), 0n, "deficit floors available at zero");
assert.equal(allocation(100n, null, 1000n, 1n, 3n), 33n, "unreadable balance falls back to managed");
// The arbitrage flywheel example (owner, 2026-10-13): the figures in the text come from the audited helpers.
assert.equal(FLYWHEEL_NAV_BEFORE, 100_000n * UNIT, "$100,000 of backing for 100,000 BASK, $1 each");
assert.equal(FLYWHEEL_NAV_AFTER, 102_000n * UNIT, "two holdings up 10%: $102,000, $1.02 per BASK");
assert.equal(FLYWHEEL_NAV_AFTER * UNIT / FLYWHEEL.supply, 102n * UNIT / 100n);
assert.deepEqual(FLYWHEEL_REDEEMED, { fee: 5n * UNIT, burned: 995n * UNIT, supplyAfter: 99_005n * UNIT });
assert.equal(FLYWHEEL_REDEEMED.burned * 100n * UNIT / FLYWHEEL.supply, 995n * UNIT / 1000n, "0.995% of each holding");
assert.equal(FLYWHEEL_OUTPUT, 995n * UNIT / 1000n, "0.995 of each 100-stock holding");
assert.equal(FLYWHEEL_UNCHANGED_VALUE, 995n * UNIT / 10n, "$99.50 from an unchanged holding");
assert.equal(FLYWHEEL_RISEN_VALUE, 10_945n * UNIT / 100n, "$109.45 from a holding that rose");
assert.equal(FLYWHEEL_UNCHANGED_VALUE * 8n, 796n * UNIT);
assert.equal(FLYWHEEL_RISEN_VALUE * 2n, 2189n * UNIT / 10n);
assert.equal(FLYWHEEL_RECEIVED, 101_490n * UNIT / 100n, "$1,014.90 of stock received");
assert.equal(FLYWHEEL_GAIN, 1490n * UNIT / 100n, "$14.90 before other trading costs and gas");
assert.equal(format(333333n, 6), "0.333333");
assert.equal(format(2n, 0), "2");

const file = process.env.BASKET_BASK_CONTENT || new URL("./bask-guide-content.md", import.meta.url);
const content = fs.readFileSync(file, "utf8");
const actual: string[] = ["BASK", INTRO];
for (const section of SECTIONS) {
  actual.push(section.title);
  for (const group of [section, ...section.examples]) {
    if (group !== section) actual.push(group.title);
    for (const block of group.blocks) {
      if (block.kind === "table") actual.push(...block.headers, ...block.rows.flat());
      else actual.push(block.text);
    }
  }
}
const expected = content.split(/\r?\n/).filter(l => l.trim() && !/^\|[ -]+\|/.test(l)).flatMap(l => l.startsWith("|") ? l.slice(1, -1).split("|").map(s => s.trim()) : [l.replace(/^#+ /, "").replace(/^\*\*|\*\*$/g, "")]);
assert.deepEqual(actual, expected, "every displayed paragraph, formula, table cell and heading equals the canonical draft");
const markup = renderToStaticMarkup(<BaskGuide />);
assert.equal((markup.match(/<table /g) || []).length, 5);
assert.equal((markup.match(/<article /g) || []).length, 5);
assert.equal((markup.match(/class="bg-formula"/g) || []).length, 10);
assert.ok(!/<input|<button|href=|not live yet|pre-launch/.test(markup));
console.log("PASS BASK: audited integer rounding, locked supply, established mint, zero NAV, reserved/deficit/unreadable balances, fee transfer/burn, the arbitrage flywheel figures, five examples and exact canonical copy; input=" + file);

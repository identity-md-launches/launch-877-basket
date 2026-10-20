import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

// A new, independently pinned gate. The existing source gates remain untouched.
const baseline = "66bf0100cbc5b333b6184cd9b87071886d04742e";
const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const git = (...args) => execFileSync("git", args, { cwd: root, maxBuffer: 16 << 20 });
const paths = (prefix) => git("ls-tree", "-r", "--name-only", baseline, ...(prefix ? [prefix] : [])).toString().trim().split("\n").filter(Boolean);
// cat-file --filters applies the repository's checkout line endings. It permits
// Windows CRLF checkouts while still comparing every checked-out byte exactly.
const original = (file) => git("cat-file", "--filters", `${baseline}:${file}`);
const actual = (file) => fs.readFileSync(path.join(root, file));
const equal = (file, expected = original(file)) => assert.ok(actual(file).equals(expected), `${file}: exact baseline checkout bytes`);

const sources = paths("web/src");
const added = ["web/src/VaultStats.tsx", "web/src/vaultStatsReport.tsx"];
const walk = (directory) => fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(entry => {
  const name = `${directory}/${entry.name}`;
  return entry.isDirectory() ? walk(name) : [name];
});
assert.deepEqual(walk("web/src").sort(), [...sources, ...added].sort(), "Only the two reviewed stats sources may be added; no original source may be removed");
for (const file of sources) if (!["web/src/Vault.tsx", "web/src/styles.css"].includes(file)) equal(file);

const vault = "web/src/Vault.tsx";
let expectedVault = original(vault).toString("utf8");
const newline = expectedVault.includes("\r\n") ? "\r\n" : "\n";
const edits = [
  [
    'import { PageTitle, AddressLink, Note, Empty } from "./components";',
    `import { PageTitle, AddressLink, Note, Empty } from "./components";${newline}import { VaultViews } from "./VaultStats";`,
  ],
  [
    `      />${newline}      <section className="panel">`,
    `      />${newline}      <VaultViews>${newline}      <section className="panel">`,
  ],
  [
    '      <StockShelves snapshot={s} />',
    `      <StockShelves snapshot={s} />${newline}      </VaultViews>`,
  ],
];
for (const [before, after] of edits) {
  assert.equal(expectedVault.split(before).length, 2, `One exact integration point: ${before.split(newline)[0]}`);
  expectedVault = expectedVault.replace(before, after);
}
equal(vault, Buffer.from(expectedVault));

const styles = "web/src/styles.css";
let expectedStyles = original(styles).toString("utf8");
const stylesNewline = expectedStyles.includes("\r\n") ? "\r\n" : "\n";
const stylesEdits = [
  [
    "/* v15: Deposit and Redeem on phones. iPhone browsers draw the focus marker",
    "/* Deposit, Redeem and Earn on phones. iPhone browsers draw the focus marker",
  ],
  [
    "  .page-title.character-redeem:has(> h1:focus-visible) .title-character:after {",
    `  .page-title.character-redeem:has(> h1:focus-visible) .title-character:after,${stylesNewline}  .page-title.character-earn:has(> h1:focus-visible) .title-character:after {`,
  ],
];
for (const [before, after] of stylesEdits) {
  assert.equal(expectedStyles.split(before).length, 2, `One exact Earn focus-corner edit: ${before}`);
  expectedStyles = expectedStyles.replace(before, after);
}
// 2026-10-20, release: the stats styles (formerly a separate stylesheet) are appended after the edited v24 text under one
// marker, like every earlier module's rules, so that no component imports CSS; the block is pinned by its digest.
const stylesActual = actual(styles).toString("utf8"), marker = `${stylesNewline}/* v25: Vault stats`;
assert.equal(stylesActual.split(marker).length, 2, "styles.css: one appended v25 stats block");
assert.ok(stylesActual.startsWith(expectedStyles) && stylesActual.indexOf(marker) === expectedStyles.length, "styles.css: exactly the edited v24 text precedes the v25 stats block");
assert.equal(createHash("sha256").update(stylesActual.slice(expectedStyles.length)).digest("hex"), "844ee92940f9a8b1347bc165282256bf9bca5d7e140cf07a2a4669af08433fe8", "styles.css: the appended v25 stats block is the reviewed one");

const protectedPaths = paths("").filter(file =>
  /(^|\/)(package(?:-lock)?\.json|(?:npm|pnpm|yarn|bun)\.lockb?|pnpm-lock\.yaml)$/.test(file) ||
  file.startsWith("web/scripts/") ||
  ["web/tsconfig.json", "web/vite.config.ts", "foundry.toml", "remappings.txt"].includes(file)
);
// 2026-10-20, release: four inherited check scripts are narrowly extended for this build (v25-restore.mjs puts the
// Vault.tsx and styles.css pieces back before their inherited comparisons, the two new sources are allowed and
// pinned, and the phone visibility check measures the Vault tab bar's displacement). They are reviewed by hand and
// listed here rather than byte-pinned; every other dependency, configuration and check file equals the baseline.
const extendedChecks = ["web/scripts/check-calldata.mjs", "web/scripts/check-v24-source.mjs", "web/scripts/check-bundle.mjs", "web/scripts/check-visibility.mjs"];
for (const file of protectedPaths) if (!extendedChecks.includes(file)) equal(file);
// 2026-10-20, release review: the built export must carry the pinned production endpoint and nothing else for it. A
// build-time override (VITE_VAULT_STATS_URL from a web/.env* file or the environment) would otherwise reach the export
// unseen by the source pins: no env file may exist under web/, and the one built module script must resolve the
// endpoint through the pinned fallback exactly once, with no override value and no other Railway address.
const ENDPOINT = "https://monitor-production-2eae.up.railway.app/api/vault-stats";
assert.deepEqual(fs.readdirSync(path.join(root, "web")).filter(name => /^\.env/.test(name)), [], "no env file under web/");
const shell = fs.readFileSync(path.join(root, "dist/index.html"), "utf8");
const scripts = [...shell.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map(m => m[1].replace(/^\.?\//, ""));
assert.equal(scripts.length, 1, "one built module script");
const built = fs.readFileSync(path.join(root, "dist", scripts[0]), "utf8");
assert.equal(built.split('VITE_VAULT_STATS_URL||"' + ENDPOINT + '"').length, 2, "the built script resolves the endpoint through the pinned fallback exactly once");
assert.equal((built.match(/VITE_VAULT_STATS_URL/g) ?? []).length, 1, "no build-time endpoint override reached the export");
assert.deepEqual([...built.matchAll(/https?:\/\/[^"'`\s)]*railway\.app[^"'`\s)]*/g)].map(m => m[0]), [ENDPOINT], "the stats endpoint is the only Railway address in the export");
console.log(`PASS stats source preservation: ${sources.length - 2} original sources byte-identical (including main.tsx), Vault.tsx has exactly three approved import/wrapper edits, styles.css has exactly two approved Earn focus-corner replacements and the appended v25 stats block, two new stats sources, and ${protectedPaths.length - extendedChecks.length} dependency/configuration/legacy-check files unchanged against ${baseline} (the four narrowly extended check scripts are listed in this gate); the built export carries the pinned stats endpoint only, with no env file under web/.`);

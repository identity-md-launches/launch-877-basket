import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
// 2026-10-20, vault stats build (v25) on the live v24 site 66bf0100. Two existing sources change: Vault.tsx gains the
// VaultViews import and wraps its overview content (three pieces); styles.css adds the Earn title to the v15 phone
// focus-corner rule, rewords its comment (two pieces) and carries the stats styles appended after the v24 text under
// one marker (pinned by digest), so that no component imports a stylesheet. restoreV25 cuts that block and puts the
// pieces back, so every inherited gate (check-v24-source.mjs, then check-calldata.mjs's v23/v22 comparisons) still
// sees the exact v24 text. The two new sources are listed here and pinned by independent digests and scanned in
// check-calldata.mjs; this file restores nothing in them. check-vault-stats-source.mjs holds its own independent copy
// of these edits, byte-compared forward.
export const V25_BASE='66bf0100cbc5b333b6184cd9b87071886d04742e';
export const V25_NEW_SOURCES=['VaultStats.tsx','vaultStatsReport.tsx'];
export const V25_STYLES_MARKER='\n/* v25: Vault stats';
export const V25_STYLES_BLOCK_SHA256='844ee92940f9a8b1347bc165282256bf9bca5d7e140cf07a2a4669af08433fe8';
const pieces={
 'Vault.tsx':[
  ['import { PageTitle, AddressLink, Note, Empty } from "./components";\nimport { VaultViews } from "./VaultStats";\n',
   'import { PageTitle, AddressLink, Note, Empty } from "./components";\n'],
  ['      />\n      <VaultViews>\n      <section className="panel">\n',
   '      />\n      <section className="panel">\n'],
  ['      <StockShelves snapshot={s} />\n      </VaultViews>\n',
   '      <StockShelves snapshot={s} />\n'],
 ],
 'styles.css':[
  ['/* Deposit, Redeem and Earn on phones. iPhone browsers draw the focus marker',
   '/* v15: Deposit and Redeem on phones. iPhone browsers draw the focus marker'],
  ['  .page-title.character-redeem:has(> h1:focus-visible) .title-character:after,\n  .page-title.character-earn:has(> h1:focus-visible) .title-character:after {',
   '  .page-title.character-redeem:has(> h1:focus-visible) .title-character:after {'],
 ],
};
export function restoreV25(file,text){
 const name=file.replace(/^web\/src\//,'');
 if(name==='styles.css'){
  assert.equal(text.split(V25_STYLES_MARKER).length,2,file+': one appended v25 stats block');
  const at=text.indexOf(V25_STYLES_MARKER);
  assert.equal(createHash('sha256').update(text.slice(at)).digest('hex'),V25_STYLES_BLOCK_SHA256,file+': the appended v25 stats block is the reviewed one');
  text=text.slice(0,at);
 }
 for(const [now,old] of pieces[name]??[]){assert.equal(text.split(now).length,2,file+': one exact v25 piece');text=text.replace(now,old);}
 return text;
}

import fs from 'node:fs';
// Run after make-browser-fixture.ts, then pass the generated file to the
// browser_run_code_unsafe tool while the production export is served at /dist/.
const fixture=fs.readFileSync('../test/scratch/browser-fixture.json','utf8');
let setup=fs.readFileSync('validation/browser-setup.js','utf8').replace('FIXTURE',fixture);
const flow=fs.readFileSync('validation/browser-flows.js','utf8');
const owner=fs.readFileSync('validation/browser-owner.js','utf8');
setup=setup.replace("return {stocks:await page.locator('.stock-card').count(),claim:await page.getByRole('button',{name:'Claim CHAR'}).count(),errors:observations.errors};",`const flow=${flow};const ownerTest=${owner};return {flows:await flow(page),owner:await ownerTest(page)};`);
fs.writeFileSync('../test/scratch/browser-check.js',setup);
console.log('Wrote test/scratch/browser-check.js. This is a test-only Playwright tool function, not a production module.');

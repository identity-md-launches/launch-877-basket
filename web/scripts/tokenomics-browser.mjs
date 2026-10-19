import { itemReady } from "../src/itemConstants.ts"; // SPEC 3.3: optional live figures.
import assert from 'node:assert/strict';
import { ALLOCATION_HEADERS, ALLOCATION_ROWS, RELEASE_HEADERS, RELEASE_ROWS, PARAGRAPHS, SUPPLY_LABEL, RELEASE_LABEL } from '../src/tokenomicsData.ts';
export async function checkTokenomics(page) {
  const tabs=page.getByRole('tab');
  assert.deepEqual(await tabs.allTextContents(),['Docs','Tokenomics','BASK']);
  assert.equal(await tabs.nth(0).getAttribute('aria-selected'),'true');
  assert.equal(await page.locator('#tokenomics').count(),0);
  const navigation=await page.locator('nav a').allTextContents();
  assert.deepEqual(navigation.map(x=>x.trim()),['Vault','Deposit','Redeem','Earn','Docs'] /* SPEC 3.5 decision A */);
  await tabs.nth(0).focus();await page.keyboard.press('ArrowRight');
  assert.equal(await tabs.nth(1).getAttribute('aria-selected'),'true');
  assert.equal(await tabs.nth(1).evaluate(e=>e===document.activeElement),true);
  const module=page.locator('#tokenomics');await module.waitFor();
  assert.equal(await page.locator('#docs-panel-0').isVisible(),false);
  assert.equal(await page.locator('#docs-panel-1').getAttribute('aria-labelledby'),'docs-tab-1');
  assert.equal(await tabs.nth(1).getAttribute('aria-controls'),'docs-panel-1');
  assert.equal(await module.locator(':scope > h2').textContent(),'Tokenomics');
  assert.deepEqual(await module.locator(':scope > p').allTextContents(),PARAGRAPHS);
  for(const [selector,headers,rows] of [['.tm-allocations',ALLOCATION_HEADERS,ALLOCATION_ROWS],['.tm-releases',RELEASE_HEADERS,RELEASE_ROWS]]){
    assert.deepEqual(await module.locator(selector+' thead th').allTextContents(),headers);
    assert.deepEqual(await module.locator(selector+' tbody tr').evaluateAll(rs=>rs.map(r=>[...r.children].map(c=>c.textContent))),rows);
  }
  assert.equal(await module.locator('.tm-live').count(),Number(itemReady()));assert(!/not live|planned numbers|pre.launch/i.test(await module.textContent()));
  assert.equal(await module.locator('.tm-supply svg').getAttribute('role'),'img');assert.equal(await module.locator('.tm-supply svg').getAttribute('aria-label'),SUPPLY_LABEL);
  for(const svg of await module.locator('.tm-release svg').all()){assert.equal(await svg.getAttribute('role'),'img');assert.equal(await svg.getAttribute('aria-label'),RELEASE_LABEL);}
  const initial=page.viewportSize();
  for(const width of [320,375,1440,1920]){
    await page.setViewportSize({width,height:900});
    const geometry=await module.evaluate(panel=>{
      const p=panel.getBoundingClientRect(),visible=e=>{const b=e.getBoundingClientRect();return b.width>0&&b.height>0;};
      const charts=[...panel.querySelectorAll('svg')].filter(visible);
      const overlap=(a,b)=>a.left<b.right-.1&&a.right>b.left+.1&&a.top<b.bottom-.1&&a.bottom>b.top+.1;
      return {overflow:document.documentElement.scrollWidth>innerWidth,escaped:[...panel.querySelectorAll('table,figure,svg')].filter(visible).filter(e=>{const b=e.getBoundingClientRect();return b.left<p.left-.5||b.right>p.right+.5;}).length,overlaps:charts.flatMap(svg=>{const labels=[...svg.querySelectorAll('text')].map(e=>e.getBoundingClientRect());return labels.flatMap((a,i)=>labels.slice(i+1).filter(b=>overlap(a,b)));}).length};
    });assert.deepEqual(geometry,{overflow:false,escaped:0,overlaps:0},'tables/charts and text at '+width);
  }
  await page.setViewportSize(initial);
  await tabs.nth(1).focus();await page.keyboard.press('Home');assert.equal(await tabs.nth(0).getAttribute('aria-selected'),'true');
  await page.keyboard.press('End');assert.equal(await tabs.nth(2).getAttribute('aria-selected'),'true');
  await page.keyboard.press('ArrowLeft');assert.equal(await tabs.nth(1).getAttribute('aria-selected'),'true');
  await page.keyboard.press('Home');
  return 'Tokenomics: Docs-local keyboard tabs; exact approved prose/tables/labels; all-null live block absent; both SVG charts and contained layout at 320/375/1440/1920';
}

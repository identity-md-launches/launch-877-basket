import assert from 'node:assert/strict';
import {INTRO, SECTIONS} from '../src/baskGuideData.ts';
export async function checkBaskGuide(page) {
  const tabs=page.getByRole('tab'), initial=page.viewportSize();
  const selected=async i=>{
    assert.equal(await tabs.nth(i).getAttribute('aria-selected'),'true');
    assert.equal(await tabs.nth(i).getAttribute('tabindex'),'0');
    assert.equal(await tabs.nth(i).evaluate(e=>e===document.activeElement),true);
    for(let j=0;j<3;j++) {
      assert.equal(await tabs.nth(j).getAttribute('aria-controls'),'docs-panel-'+j);
      assert.equal(await page.locator('#docs-panel-'+j).getAttribute('aria-labelledby'),'docs-tab-'+j);
      assert.equal(await page.locator('#docs-panel-'+j).isVisible(),j===i);
      if(j!==i)assert.equal(await tabs.nth(j).getAttribute('tabindex'),'-1');
    }
  };
  await tabs.nth(0).focus();await page.keyboard.press('End');await selected(2);
  const module=page.locator('.bg-module');await module.waitFor();
  assert.equal(await module.locator('.bg-intro').textContent(),INTRO);
  const blocks=SECTIONS.flatMap(s=>[...s.blocks,...s.examples.flatMap(e=>e.blocks)]);
  assert.deepEqual(await module.locator('p').allTextContents(),[INTRO,...blocks.filter(b=>b.kind==='p').map(b=>b.text)]);
  assert.deepEqual(await module.locator('.bg-formula').allTextContents(),blocks.filter(b=>b.kind==='formula').map(b=>b.text));
  assert.deepEqual(await module.locator('h3').allTextContents(),SECTIONS.map(s=>s.title));
  assert.deepEqual(await module.locator('h4').allTextContents(),SECTIONS.flatMap(s=>s.examples.map(e=>e.title)));
  const tables=module.locator('table'),expected=blocks.filter(b=>b.kind==='table');
  assert.equal(await tables.count(),5);
  for(let i=0;i<4;i++){
    assert.deepEqual(await tables.nth(i).locator('thead th').allTextContents(),expected[i].headers);
    assert.deepEqual(await tables.nth(i).locator('tbody tr').evaluateAll(rows=>rows.map(r=>[...r.children].map(c=>c.textContent))),expected[i].rows);
  }
  assert.equal(await page.locator('#tokenomics').count(),0);
  for(const width of [320,375,661,1000,1440,1920]) {
    await page.setViewportSize({width,height:1000});
    const geometry=await page.evaluate(()=>{
      const module=document.querySelector('.bg-module'),bounds=module.getBoundingClientRect();
      const tabs=[...document.querySelectorAll('[role=tab]')].map(e=>e.getBoundingClientRect());
      return {overflow:document.documentElement.scrollWidth>innerWidth,tabRows:new Set(tabs.map(b=>b.top)).size,escaped:[...module.querySelectorAll('table,article,.bg-formula')].filter(e=>{const b=e.getBoundingClientRect();return b.left<bounds.left-.5||b.right>bounds.right+.5||e.scrollWidth>e.clientWidth+1;}).length};
    });
    assert.deepEqual(geometry,{overflow:false,tabRows:1,escaped:0},'BASK layout at '+width);
  }
  await page.setViewportSize(initial);
  await tabs.nth(2).focus();await page.keyboard.press('ArrowRight');await selected(0);
  assert.equal(await page.locator('.bg-module').count(),0);
  await page.keyboard.press('ArrowLeft');await selected(2);
  await page.keyboard.press('ArrowLeft');await selected(1);
  assert.equal(await page.locator('.bg-module').count(),0);
  await page.keyboard.press('ArrowRight');await selected(2);
  await page.keyboard.press('Home');await selected(0);
  assert.equal(await page.locator('.bg-module').count(),0);
  return 'BASK: exact canonical prose/formulas/five tables; three-tab ARIA, focus, Home/End/arrow wrap; no overflow at 320/375/661/1000/1440/1920; inactive modules unmounted';
}

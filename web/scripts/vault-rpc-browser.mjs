// SPEC 6/7: compare actual browser RPC requests with the untouched v16 export.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
export async function checkVaultRpc(browser, baseline, candidate, rpc) {
  const result = {};
  const account = '0x00000000000000000000000000000000000a11ce';
  const mime = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.webp':'image/webp', '.woff2':'font/woff2' };
  for (const name of ['vault','deposit','redeem','owner','losses']) {
    const records = [];
    for (const [kind, dist] of [['baseline',baseline],['candidate',candidate]]) {
      const context = await browser.newContext({ viewport:{width:375,height:812}, reducedMotion:'reduce' });
      const page = await context.newPage();
      const calls = [], failures = [];
      let pending = 0;
      await page.addInitScript(({account}) => {
        window.ethereum = { request:async({method}) => {
          if (method === 'eth_chainId') return '0x1237';
          if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [account];
          throw Error('Read-only vault comparison refuses ' + method);
        }, on(){}, removeListener(){} };
      }, {account});
      await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.hostname === '127.0.0.1' && url.port === '9541') {
          const file = path.resolve(dist, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
          assert.ok(file.startsWith(path.resolve(dist) + path.sep));
          return route.fulfill({ body:fs.readFileSync(file), contentType:mime[path.extname(file)] || 'application/octet-stream' });
        }
        assert.ok(/^https:\/\/(rpc\.mainnet\.chain\.robinhood\.com|robinhood-rpc\.publicnode\.com)\/?$/.test(url.href));
        pending++;
        try {
          const body = route.request().postDataJSON();
          for (const call of Array.isArray(body) ? body : [body]) {
            assert.ok(['eth_chainId','eth_getCode','eth_call','eth_blockNumber','eth_getBlockByNumber'].includes(call.method));
            calls.push({method:call.method,params:call.params ?? []});
          }
          const response = await fetch(rpc,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
          const json = await response.json();
          for (const answer of Array.isArray(json) ? json : [json]) if (answer.error) failures.push(answer.error.message);
          await route.fulfill({json});
        } finally { pending--; }
      });
      try {
        await page.goto('http://127.0.0.1:9541/#' + name);
        await page.waitForFunction(() => !document.querySelector('button.refresh')?.disabled,{},{timeout:120000});
        for (let i=0;i<100 && pending;i++) await page.waitForTimeout(100);
        await page.waitForTimeout(500);
        assert.equal(pending,0,'all RPC requests settled: '+name+'/'+kind);
        if (kind === 'candidate') assert.deepEqual(await page.locator('nav a').allTextContents(),['Vault','Deposit','Redeem','Earn','Docs']);
        records.push({count:calls.length, requests:calls.map(c=>JSON.stringify(c)).sort(), failures:failures.sort()});
      } finally { await context.close(); }
    }
    assert.deepEqual(records[1],records[0],name+': exact v16 RPC requests, multiplicities and read outcomes');
    result[name] = {baseline:records[0].count,candidate:records[1].count,requests:records[1].requests.map(s=>JSON.parse(s)),readFailures:records[1].failures};
  }
  return result;
}

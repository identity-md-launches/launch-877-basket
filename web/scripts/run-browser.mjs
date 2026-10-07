// Bounded production-export check. Dependencies and browser binaries stay outside Git.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = http.createServer((req, res) => {
  const suffix = decodeURIComponent(new URL(req.url, 'http://local').pathname).replace(/^\/preview\/?/, '');
  const file = path.resolve('../dist', suffix || 'index.html');
  if (!file.startsWith(path.resolve('../dist') + path.sep)) { res.writeHead(404).end(); return; }
  try {
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream');
    res.end(fs.readFileSync(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/preview/`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(12000);
const failures = [];
page.on('pageerror', error => failures.push(error.message));
page.on('console', msg => { if (msg.type() === 'error') failures.push(msg.text()); });
try {
  const run = eval('(' + fs.readFileSync('../test/scratch/browser-check.js', 'utf8').replace('http://127.0.0.1:4173/dist/', url) + ')');
  const results = await run(page);
  fs.writeFileSync('../artifacts/browser-interactions.json', JSON.stringify(results, null, 2) + '\n');
  console.log('PASS base flows:', results.flows.results, results.owner.results);
  if (fs.existsSync('validation/browser-regressions.js')) {
    const regression = eval('(' + fs.readFileSync('validation/browser-regressions.js', 'utf8') + ')');
    const extra = await regression(page);
    fs.writeFileSync('../artifacts/browser-regressions.json', JSON.stringify(extra, null, 2) + '\n');
    console.log('PASS regressions:', extra);
  }
  const live = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const liveIssues = [];
  live.on('pageerror', e => liveIssues.push(e.message));
  live.on('response', r => { if (r.status() >= 400) liveIssues.push(`${r.status()} ${r.url()}`); });
  await live.goto(url);
  await live.waitForFunction(() => document.querySelector('button.refresh')?.disabled === false, { timeout: 60000 });
  await live.screenshot({ path: '../artifacts/vault-desktop-live.png', fullPage: true });
  await live.getByRole('navigation').getByRole('link', { name: 'Owner', exact: true }).click();
  await live.getByRole('heading', { name: 'Pending proposals', exact: true }).waitFor();
  await live.screenshot({ path: '../artifacts/owner-launch-live.png', fullPage: true });
  const liveRoutes=[];
  for(const name of ['Vault','Deposit','Redeem','Owner','Losses','Docs']) {
    await live.getByRole('navigation').getByRole('link',{name,exact:true}).click();
    liveRoutes.push({page:name,heading:await live.locator('h1').innerText(),noWallet:await live.evaluate(()=>!window.ethereum)});
  }
  await live.screenshot({path:'../artifacts/docs-desktop.png',fullPage:true});
  await live.setViewportSize({width:320,height:1000});
  await live.screenshot({path:'../artifacts/docs-mobile.png',fullPage:true});
  fs.writeFileSync('../artifacts/browser-live.json', JSON.stringify({routes:liveRoutes,issues:liveIssues},null,2)+'\n');
  failures.push(...liveIssues);
  await live.close();
  console.log('Browser console/page errors:', failures);
  if (failures.length) throw Error(failures.join('\n'));
} catch (e) {
  console.error(e, failures);
  fs.writeFileSync('../test/scratch/browser-failure.txt', await page.locator('body').innerText());
  await page.screenshot({ path: '../test/scratch/browser-failure.png', fullPage: true });
  process.exitCode = 1;
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

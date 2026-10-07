async (page) => {
  const {fixture:f,observations:o}=globalThis.basketTest;
  const {encodeFunctionData,encodeFunctionResult}=await import('viem');
  const abi=JSON.parse(fs.readFileSync('src/vault.abi.json','utf8'));
  const results=[],layouts=[],contrast=[];
  const ensure=(ok,label)=>{if(!ok)throw Error(label);results.push(label);};
  const nav=async name=>{await (['Owner','Losses'].includes(name)?page.locator('footer').getByRole('link',{name:name==='Owner'?'Owner controls':name,exact:true}):page.getByRole('navigation').getByRole('link',{name,exact:true})).click();await page.getByRole('heading',{level:1,name:{Vault:'A basket of stocks.',Deposit:'Deposit Stock Tokens',Redeem:'Redeem BASK',Owner:'Owner',Losses:'Losses',Docs:'Docs'}[name],exact:name!=='Vault'}).waitFor();};
  const refresh=async()=>{await page.getByRole('button',{name:'Refresh vault'}).click();await page.waitForFunction(()=>!document.querySelector('button.refresh').disabled);};
  const preview=async()=>{await page.getByLabel('Amount',{exact:true}).fill('10');await page.getByRole('button',{name:'Preview deposit',exact:true}).click();await page.getByRole('heading',{name:'Deposit preview'}).waitFor();};
  await page.setViewportSize({width:1440,height:1000});
  await page.evaluate(owner=>window.__testWallet.change(owner,'0x1237'),f.owner);
  o.allowance=true;await nav('Deposit');await refresh();await preview();
  o.confirmReceipt=true;await page.evaluate(()=>{window.__testWallet.receiptMode=true;});
  await page.getByRole('button',{name:'2. Deposit',exact:true}).click();
  await page.getByText('Deposit confirmed',{exact:false}).first().waitFor();
  ensure(await page.getByLabel('Amount',{exact:true}).inputValue()==='','Confirmed deposit clears amount');
  ensure(await page.locator('.receipt').count()===0,'Confirmed deposit removes old preview');
  ensure(await page.getByRole('button',{name:'1. Approve stock',exact:true}).count()===0&&await page.getByRole('button',{name:'2. Deposit',exact:true}).count()===0,'Confirmed deposit offers neither Approve nor Deposit');
  ensure((await page.locator('.wallet-status a').getAttribute('href')).endsWith('/tx/0x'+'1'.repeat(64)),'Deposit confirmation retains transaction link');
  await page.setViewportSize({width:375,height:1000});
  await page.screenshot({path:'../artifacts/deposit-confirmed-375.webp',type:'webp',quality:80,fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  await page.getByLabel('Amount',{exact:true}).fill('10');ensure(await page.locator('.receipt').count()===0,'New amount alone does not reuse preview');
  await page.getByRole('button',{name:'Preview deposit',exact:true}).click();await page.getByRole('button',{name:'2. Deposit',exact:true}).waitFor();
  ensure(await page.locator('.receipt').count()===1,'Explicit new preview restores deposit flow');
  o.allowance=false;await refresh();await page.getByRole('button',{name:'1. Approve stock',exact:true}).click();
  await page.getByText('Transaction confirmed. Vault data refreshed.',{exact:false}).first().waitFor();
  ensure(await page.locator('.receipt').count()===0,'Confirmed approval invalidates old deposit preview');
  ensure(await page.getByLabel('Amount',{exact:true}).inputValue()==='10','Approval retains amount for new preview');
  o.allowance=true;await nav('Redeem');await page.getByLabel('BASK amount').fill('10');await page.getByRole('button',{name:'Preview redemption',exact:true}).click();
  await page.getByRole('button',{name:'Redeem BASK',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.receipt'));
  ensure(await page.locator('.receipt').count()===0,'Confirmed redemption invalidates preview');
  await page.getByLabel('BASK amount').fill('10');await page.getByRole('button',{name:'Preview redemption',exact:true}).click();
  await page.getByRole('button',{name:'Claim CHAR'}).click();await page.waitForFunction(()=>!document.querySelector('.receipt'));
  ensure(await page.locator('.receipt').count()===0,'Confirmed claim invalidates redemption preview');
  o.confirmReceipt=false;await page.evaluate(()=>{window.__testWallet.receiptMode=false;});
  ensure(JSON.stringify(await page.getByRole('navigation').getByRole('link').allTextContents())===JSON.stringify(['Vault','Deposit','Redeem','Docs']),'Main menu has exactly four requested links');
  ensure(await page.locator('.claims').isVisible(),'Claims remain on Redeem');
  await nav('Vault');ensure(!(await page.locator('.claims').isVisible()),'Claims hidden outside Redeem while existing reads remain mounted');
  await page.reload();await page.waitForFunction(()=>!document.querySelector('button.refresh').disabled);
  await page.evaluate(()=>document.fonts.ready);
  for(const width of [1440,375]) {
    await page.setViewportSize({width,height:1000});
    for(const name of ['Vault','Deposit','Redeem','Owner','Losses','Docs']) {
      await nav(name);
      if(name==='Deposit'){await preview();await page.waitForFunction(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='2. Deposit')?.disabled===false);}
      if(name==='Redeem'){await page.getByLabel('BASK amount').fill('10');await page.getByRole('button',{name:'Preview redemption',exact:true}).click();}
      await page.waitForLoadState('networkidle');
      await page.evaluate(async()=>{await document.fonts.ready;window.scrollTo(0,0);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
      const shot=await page.screenshot({path:`../artifacts/${name.toLowerCase()}-${width}.webp`,type:'webp',quality:78,fullPage:true});
      const tag=shot.toString('ascii',12,16);
      const imageHeight=tag==='VP8 '?shot.readUInt16LE(28)&16383:1+shot.readUIntLE(27,3);
      const layout=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,
        smallTargets:[...document.querySelectorAll('a,button,summary')].filter(e=>e.getClientRects().length&&!e.classList.contains('skip')&&e.getBoundingClientRect().height<44).map(e=>({text:e.textContent,height:e.getBoundingClientRect().height})),
        tables:[...document.querySelectorAll('.table-wrap')].map(e=>({width:e.clientWidth,scrollWidth:e.scrollWidth})),
        stockCards:[...document.querySelectorAll('.stock-card')].map(e=>e.getBoundingClientRect().width),
        decoration:[...document.querySelectorAll('.night-sky,.planet-sign,.storefront')].map(e=>({text:e.textContent,hidden:e.getAttribute('aria-hidden')}))}));
      ensure(layout.width===layout.scrollWidth,`${name} no sideways page scrolling at ${width}px`);
      ensure(layout.smallTargets.length===0,`${name} links and buttons at least 44px tall at ${width}px`);
      ensure(layout.decoration.every(e=>e.text===''&&e.hidden==='true'),`${name} SVG decoration is text-free and hidden from assistive technology`);
      if(width===375&&name==='Owner'){
        ensure(layout.tables.length>0&&layout.tables.every(t=>t.width===t.scrollWidth),'Owner pairing tables fit without internal scrolling');
        ensure(await page.locator('.table-wrap tbody tr').first().evaluate(e=>getComputedStyle(e).display)==='block','Owner uses one stacked card per stock');
        ensure((await page.locator('.table-wrap').first().innerText()).includes('Current price'),'Owner cards retain price labels');
      }
      if(width===375&&name==='Vault')ensure(layout.stockCards.length===3&&new Set(layout.stockCards).size===1,'Vault retains all stocks as equal-width stacked cards');
      const pairs=await page.evaluate(()=>{
        const selectors=['.restriction','.metric','.stock-price','.role-info','.page-title h1','.page-title .eyebrow','.page-title > p:last-child','.note.warning','button.primary:not(:disabled)','.action-panel button:not(:disabled)','footer a','.muted','.error:not(:empty)'];
        return selectors.flatMap(selector=>[...document.querySelectorAll(selector)].filter(e=>e.getClientRects().length).map(el=>{
          const style=getComputedStyle(el);let bg=style.backgroundColor,p=el;
          while(bg==='rgba(0, 0, 0, 0)'&&p.parentElement){p=p.parentElement;bg=getComputedStyle(p).backgroundColor;}
          return {selector,foreground:style.color,background:bg};
        }));
      });
      const lum=c=>{const v=c.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;});return .2126*v[0]+.7152*v[1]+.0722*v[2];};
      for(const pair of pairs){const a=lum(pair.foreground),b=lum(pair.background);pair.ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);}
      ensure(pairs.every(p=>p.ratio>=4.5),`${name} rendered financial, warning, action and heading text pairs meet 4.5:1 at ${width}px`);
      contrast.push({page:name,width,pairs});
      ensure(imageHeight===layout.height,`${name} full-page screenshot includes the complete rendered height at ${width}px`);
      layouts.push({page:name,imageHeight,...layout});
    }
  }
  const set=(name,value)=>{const key=f.VAULT+':'+encodeFunctionData({abi,functionName:name}).toLowerCase();f.calls[key]=encodeFunctionResult({abi,functionName:name,result:value});};
  set('genesisFinalized',false);set('allAssets',[]);set('assetCount',0n);
  for(const k of Object.keys(f.calls).filter(k=>k.includes(f.indexSelector)))f.calls[k]='0x'+'0'.repeat(64);
  const descKey=Object.keys(f.calls).find(k=>k.startsWith(f.assets[0].feed.toLowerCase()+':0x7284e416'));
  const original=f.calls[descKey];f.calls[descKey]=f.calls[Object.keys(f.calls).find(k=>k.startsWith(f.assets[2].feed.toLowerCase()+':0x7284e416'))];
  await nav('Owner');await refresh();
  const listing=page.locator('.panel').filter({has:page.getByRole('heading',{name:'List the launch basket',exact:true})});
  await listing.getByLabel('Stock Token and feed pairs').fill(['ALFA','BRAV','CHAR'].map((s,i)=>`${s} ${f.assets[i].token} ${f.assets[i].feed}`).join('\n'));
  await listing.getByText('check this pairing',{exact:true}).waitFor();
  ensure(await listing.getByRole('button',{name:'List all stocks',exact:true}).isDisabled(),'Phone pairing mismatch visible and blocks listing');
  ensure(await listing.locator('.table-wrap').evaluate(e=>e.clientWidth===e.scrollWidth),'Launch preview also uses phone pairing cards');
  await listing.screenshot({path:'../artifacts/owner-pairing-375.webp',type:'webp',quality:80});
  f.calls[descKey]=original;
  await page.emulateMedia({reducedMotion:'reduce'});
  ensure(await page.evaluate(()=>[...document.querySelectorAll('*')].every(e=>getComputedStyle(e).animationName==='none'&&getComputedStyle(e).transitionDuration==='0s')),'Reduced motion disables all animations and transitions');
  return {results,layouts,contrast,limitations:['Fixture wallet only: no live signature or transaction.','No screen reader, physical phone or native zoom session.']};
}

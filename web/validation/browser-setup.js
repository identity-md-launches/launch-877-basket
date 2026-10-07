async (page) => {
  const fixture = FIXTURE;
  const observations = {calls:[], errors:[], failAggregate:false, failFeed:false, allowance:true};
  const word = (n) => BigInt(n).toString(16).padStart(64,'0');
  const encodeResults = (values) => {
    const tuples=values.map(v=>word(v.success?1:0)+word(64)+word((v.data.length-2)/2)+v.data.slice(2).padEnd(Math.ceil((v.data.length-2)/64)*64,'0'));
    let offset=tuples.length*32;
    const offsets=tuples.map(t=>{const v=word(offset);offset+=t.length/2;return v;}).join('');
    return '0x'+word(32)+word(tuples.length)+offsets+tuples.join('');
  };
  const resolve=(address,data)=>{
    if(observations.unreadableDescription===address.toLowerCase()&&data.startsWith('0x7284e416'))return {success:false,data:'0x'};
    if(observations.depositFailure&&data.startsWith(fixture.depositSelector))return {success:false,data:observations.depositFailure};
    if(fixture.errors[data])return {success:false,data:fixture.errors[data]};
    const key=address.toLowerCase()+':'+data.toLowerCase();
    if(!observations.allowance&&fixture.allowanceKeys.includes(key))return {success:true,data:'0x'+word(0)};
    if(observations.failFeed&&address.toLowerCase()===fixture.assets[1].feed.toLowerCase()&&data.startsWith('0xfeaf968c'))return {success:false,data:'0x'};
    return {success:true,data:fixture.calls[key]??'0x'};
  };
  await page.route(/https:\/\/(rpc\.mainnet\.chain\.robinhood\.com|robinhood-rpc\.publicnode\.com)/,async route=>{
    const req=route.request().postDataJSON();observations.calls.push(req);
    let result='0x',error;
    if(req.method==='eth_chainId')result='0x1237';
    else if(req.method==='eth_getCode')result=req.params[0].toLowerCase()===fixture.VAULT?(observations.badCode?'0x01':fixture.runtime):'0x01';
    else if(req.method==='eth_getTransactionReceipt'){
      if(observations.listOnSubmit){
        fixture.calls[fixture.VAULT+':'+fixture.selector.allAssets]=fixture.populatedAssets;
        fixture.calls[fixture.VAULT+':'+fixture.countData]='0x'+word(3);
        const indexKeys=Object.keys(fixture.calls).filter(k=>k.includes(fixture.indexSelector));
        for(const k of indexKeys)fixture.calls[k]='0x'+word(1);
      }
      result=observations.confirmReceipt?{
        transactionHash:'0x'+'1'.repeat(64),transactionIndex:'0x0',blockHash:'0x'+'2'.repeat(64),blockNumber:'0x5000000',
        from:fixture.owner,to:fixture.VAULT,cumulativeGasUsed:'0x5208',gasUsed:'0x5208',contractAddress:null,
        logs:[],logsBloom:'0x'+'0'.repeat(512),status:'0x1',effectiveGasPrice:'0x1',type:'0x2'
      }:null;
    }
    else if(req.method==='eth_blockNumber')result='0x5000000';
    else if(req.method==='eth_call'){
      const {to,data,gas}=req.params[0];
      if(gas!=='0x989680')observations.errors.push('wrong gas '+gas);
      if(observations.failAggregate&&data.startsWith(fixture.selector.allAssets))error={code:3,message:'execution reverted',data:'0x'};
      else if(data.startsWith(fixture.selector.aggregate3)){
        const d=data.slice(10),num=(pos)=>Number(BigInt('0x'+d.slice(pos,pos+64)));
        const start=num(0)*2,count=num(start),base=start+64,values=[];
        for(let i=0;i<count;i++){
          const at=base+num(base+i*64)*2,target='0x'+d.slice(at+24,at+64),bytesAt=at+num(at+128)*2,length=num(bytesAt),callData='0x'+d.slice(bytesAt+64,bytesAt+64+length*2);
          if(['0xb8f82b26','0xf3205dfa',fixture.selector.allAssets].includes(callData.slice(0,10)))observations.errors.push('heavy batch');
          values.push(resolve(target,callData));
        }
        result=encodeResults(values);
      }else {const value=resolve(to,data);if(value.success)result=value.data;else error={code:3,message:'execution reverted',data:value.data};}
    }
    await route.fulfill({contentType:'application/json',body:JSON.stringify({jsonrpc:'2.0',id:req.id,...(error?{error}:{result})})});
  });
  await page.addInitScript(({owner})=>{
    const listeners={};window.__testWallet={account:owner,chain:'0x1237',sent:[],change(account,chain){this.account=account;this.chain=chain;listeners.accountsChanged?.([account]);listeners.chainChanged?.(chain)}};
    window.ethereum={on:(n,f)=>listeners[n]=f,removeListener:(n)=>delete listeners[n],request:async({method,params})=>{
      if(method==='eth_accounts'||method==='eth_requestAccounts')return [window.__testWallet.account];
      if(method==='eth_chainId')return window.__testWallet.chain;
      if(method==='wallet_switchEthereumChain'){window.__testWallet.chain=params[0].chainId;listeners.chainChanged?.(params[0].chainId);return null;}
      if(method==='eth_sendTransaction'){window.__testWallet.sent.push({...params[0],capturedAt:Date.now()});if(window.__testWallet.receiptMode)return '0x'+'1'.repeat(64);throw {code:4001,message:'User rejected test signature'};}
      throw Error('Unexpected wallet request '+method);
    }};
  },{owner:fixture.owner});
  globalThis.basketTest={fixture,observations};
  await page.goto('http://127.0.0.1:4173/dist/');
  await page.waitForFunction(()=>!document.querySelector('button.refresh').disabled);
  return {stocks:await page.locator('.stock-card').count(),claim:await page.getByRole('button',{name:'Claim CHAR'}).count(),errors:observations.errors};
}

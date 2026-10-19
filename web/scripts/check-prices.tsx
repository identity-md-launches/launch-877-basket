import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {poolUsdPrice, navUsdPrice, usdPrice, freshPriceTime} from '../src/itemFormat';
import {readPoolPrices} from '../src/itemReads';
import {KNOWN, LAUNCH, PRICE_FEEDS, ADDRESS_KEYS, HASH_KEYS} from '../src/itemConstants';
import {PriceStrip} from '../src/Earn';
import type {Snapshot} from '../src/model';
import type {ReadResult} from '../src/chain';
const now=1800000000n, e18=10n**18n;
let checks=0;
const check=(name:string,fn:()=>void)=>{fn();checks++;console.log('PASS',name);};
const round=[10n,102000000n,now-10n,now-10n,10n];
const quote=(r:unknown,t:unknown=KNOWN.BASK,f:unknown=round,d:unknown=8)=>poolUsdPrice(r,t,KNOWN.BASK,KNOWN.USDG,6,f,d,now);
check('100 BASK for 200 USDG at USDG/USD 1.02 gives BASK/USD 2.04',()=>assert.equal(quote([100n*e18,200000000n]),204n*10n**16n));
check('reversed pair token order gives the same BASK price',()=>assert.equal(quote([200000000n,100n*e18],KNOWN.USDG),204n*10n**16n));
check('10000 ITEM for one ETH at USD 3000 gives ITEM/USD 0.30',()=>assert.equal(poolUsdPrice([10000n*e18,e18],LAUNCH.ITEM!,LAUNCH.ITEM!,KNOWN.WETH,18,[1n,3000n*10n**8n,now,now,1n],8,now),3n*10n**17n));
check('empty, negative, malformed reserves and unknown token order have no price',()=>{
 for(const reserves of [undefined,[],[0n,1n],[1n,0n],[-1n,1n],[1,2]])assert.equal(quote(reserves),undefined);
 assert.equal(quote([1n,2n],KNOWN.WETH),undefined);
});
check('nonpositive, incomplete, future and older than 26h feeds have no price',()=>{
 for(const feed of [undefined,[],[1n,0n,now,now,1n],[1n,-1n,now,now,1n],[2n,1n,now,now,1n],[1n,1n,now,now+1n,1n],[1n,1n,now,now-93601n,1n]])assert.equal(poolUsdPrice([e18,1000000n],KNOWN.BASK,KNOWN.BASK,KNOWN.USDG,6,feed,8,now),undefined);
 assert.equal(freshPriceTime(now-93600n,now),true);assert.equal(freshPriceTime(now-93601n,now),false);
});
check('missing and malformed feed decimals have no price; zero feed decimals work',()=>{
 for(const decimals of [undefined,-1,256,1.5,'8'])assert.equal(poolUsdPrice([e18,1000000n],KNOWN.BASK,KNOWN.BASK,KNOWN.USDG,6,round,decimals,now),undefined);
 assert.equal(quote([e18,1000000n],KNOWN.BASK,[1n,2n,now,now,1n],0),2n*e18);
});
check('USD display keeps two BASK and six ITEM decimals, huge amounts, and positive tiny values',()=>{
 assert.equal(usdPrice(123n*10n**16n,2),'$1.23');assert.equal(usdPrice(4567n*10n**12n,6),'$0.004567');
 assert.equal(usdPrice(undefined,2),'—');assert.equal(usdPrice(0n,2),'$0.00');
 assert.equal(usdPrice(1n,2),'<$0.01');assert.equal(usdPrice(1n,6),'<$0.000001');
 assert.equal(usdPrice(123456789012345678901n*e18,2),'$123,456,789,012,345,678,901.00');
});
const snapshot:Snapshot={loadedAt:Number(now*1000n),complete:true,aggregate:true,errors:[],globals:{totalSupply:10n*e18},assets:[{retired:false,managed:2n*e18,answer:15n*10n**8n,updatedAt:now,tokenDecimals:18,feedDecimals:8,reason:0} as Snapshot['assets'][number]]};
check('NAV per share: two stocks at USD 15 backing ten BASK gives USD 3',()=>assert.equal(navUsdPrice(snapshot,now),3n*e18));
check('incomplete, loading, zero supply, missing or stale NAV inputs show no value',()=>{
 for(const s of [undefined,{...snapshot,complete:false},{...snapshot,loading:true},{...snapshot,globals:{totalSupply:0n}},{...snapshot,assets:[{...snapshot.assets[0],answer:undefined}]},{...snapshot,assets:[{...snapshot.assets[0],updatedAt:now-93601n}]}])assert.equal(navUsdPrice(s,now),undefined);
});
check('header has the approved caption, two inline logos and distinct price labels',()=>{
 const html=renderToStaticMarkup(createElement(PriceStrip,{prices:null}));
 assert.equal((html.match(/<svg /g)??[]).length,2);assert.match(html,/aria-label="BASK"/);assert.match(html,/aria-label="ITEM"/);
 assert.match(html,/Pool prices and BASK stock value, read at the last refresh\./);
 assert.doesNotMatch(html,/<img|unavailable|couldn.t|https?:\/\/(?!www.w3.org)/i);
 assert.equal((html.match(/data-price=/g)??[]).length,3);
});
const shape=(s:any)=>[s.address.toLowerCase(),s.functionName,s.args??[]];
const expected=[
 [KNOWN.BASK_USDG_PAIR,'getReserves',[]],[KNOWN.BASK_USDG_PAIR,'token0',[]],
 [LAUNCH.ITEM_WETH_PAIR,'getReserves',[]],[LAUNCH.ITEM_WETH_PAIR,'token0',[]],
 [PRICE_FEEDS.USDG,'latestRoundData',[]],[PRICE_FEEDS.USDG,'decimals',[]],
 [PRICE_FEEDS.ETH,'latestRoundData',[]],[PRICE_FEEDS.ETH,'decimals',[]],
].map(([a,f,args])=>[String(a).toLowerCase(),f,args]);
const responses:ReadResult[]=[{ok:true,value:[100n*e18,200000000n,0]},{ok:true,value:KNOWN.BASK},{ok:true,value:[10000n*e18,e18,0]},{ok:true,value:LAUNCH.ITEM},{ok:true,value:round},{ok:true,value:8},{ok:true,value:[1n,3000n*10n**8n,now,now,1n]},{ok:true,value:8}];
let batches=0;
const result=await readPoolPrices(undefined,LAUNCH,async specs=>{batches++;assert.deepEqual(specs.map(shape),expected);return responses;},now);
check('header reads only two pairs and two feeds in one batch, with no account arguments',()=>{assert.equal(batches,1);assert.equal(result.bask,204n*10n**16n);assert.equal(result.item,3n*10n**17n);});
const partial=await readPoolPrices(undefined,LAUNCH,async()=>responses.map((r,i)=>i===4?{ok:false,error:'fixture failure'}:r),now);
check('one failed feed clears only its token price',()=>{assert.equal(partial.bask,undefined);assert.equal(partial.item,3n*10n**17n);});
const failed=await readPoolPrices(undefined,LAUNCH,async()=>{throw Error('fixture');},now);
check('a failed refresh yields no cached quote',()=>assert.deepEqual(failed,{bask:undefined,item:undefined}));
const reused=await readPoolPrices({'bask.reserve0':100n*e18,'bask.reserve1':200000000n,'bask.token0':KNOWN.BASK,'eth.reserve0':10000n*e18,'eth.reserve1':e18,'eth.token0':LAUNCH.ITEM!},LAUNCH,async specs=>{assert.deepEqual(specs.map(shape),expected.slice(4));return responses.slice(4);},now);
check('Earn reuses its fresh reserves and token order; only four feed reads are added',()=>assert.deepEqual(reused,result));
for(const key of [...ADDRESS_KEYS,...HASH_KEYS,'ITEM_REPO','ITEM_COMMIT'] as const){let calls=0;assert.deepEqual(await readPoolPrices(undefined,{...LAUNCH,[key]:null},async()=>{calls++;return [];},now),{});assert.equal(calls,0);}
check('every incomplete launch configuration makes zero price requests',()=>{});
console.log('PASS',checks,'price checks; independent arithmetic, fresh-feed boundaries, exact read allowlist, failure isolation, NAV and approved header');

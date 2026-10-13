import fs from 'node:fs';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { ADDRESSES, ALLOCATIONS, TOTAL_SUPPLY, T, CLIFF, VESTING_END, RELEASES, gaugeReleased, developmentVested, PARAGRAPHS } from '../src/tokenomicsData';
import { Tokenomics, LiveFigures, readLiveFigures, formatLive } from '../src/Tokenomics';
const brief = process.env.BASKET_TOKEN_BRIEF ? fs.readFileSync(process.env.BASKET_TOKEN_BRIEF,'utf8') : `ITEM supply after launch:
  10%   swarm (IMD's share)                                            automatic
  10%   IMD launch pool, ITEM/ETH on Uniswap v4                        automatic
  49%   490,000,000 ITEM  BaskUsdgGauge (stake BASK/USDG v2 LP)        approve + start()
  21%   210,000,000 ITEM  ItemEthGauge  (stake ITEM/ETH v2 LP)         approve + start()
   4%    40,000,000 ITEM  DevVesting (25% at month 12, linear to 48)   approve + fund()
   1%    10,000,000 ITEM  dev wallet, unlocked                         plain transfer
   5%    50,000,000 ITEM  operations, including owner pool seeding and ITEM staking
GAUGES: stake a v2 LP, earn ITEM; one abstract base, two contracts. BaskUsdgGauge: tokenA BASK, tokenB USDG, ALLOCATION 490,000,000e18. ItemEthGauge: tokenA ITEM, tokenB WETH, ALLOCATION 210,000,000e18.
- released(t) = ALLOCATION * t * (2T - t) / T^2, T = 4 * 365 days, t = seconds since start with totalStaked > 0, capped at T; paid pro rata to staked LP.
DEVVESTING: ALLOCATION 40,000,000e18. fund(): once, pulls exactly ALLOCATION of ITEM from the caller; not revocable. elapsed = seconds since deployment; vested = 0 before 365 days, then ALLOCATION * min(elapsed, 1460 days) / 1460 days. release(), by anyone after fund(), sends vested - released to the beneficiary.`;
const header=brief.split('ITEM supply after launch:')[1].split('GAUGES:')[0];
const table=[...header.matchAll(/^\s+(\d+)%\s+(?:(\d[\d,]*) ITEM\s+)?([^\n]+)/gm)].slice(0,7).map(m=>({share:Number(m[1]),amount:m[2]?Number(m[2].replaceAll(',','')):TOTAL_SUPPLY*Number(m[1])/100,who:m[3]}));
assert.equal(table.length,7,'parse all seven brief header allocations');
for(const [index,label] of [[0,'BaskUsdgGauge'],[1,'ItemEthGauge'],[2,'IMD launch pool'],[3,'swarm'],[4,'operations'],[5,'DevVesting'],[6,'dev wallet']] as const){const row=table.find(r=>r.who.includes(label));assert(row);assert.deepEqual([ALLOCATIONS[index].share,ALLOCATIONS[index].amount],[row.share,row.amount]);}
const gaugeLine=brief.split('\n').find(l=>l.startsWith('GAUGES:'))!;
assert.deepEqual([...gaugeLine.matchAll(/ALLOCATION ([\d,]+)e18/g)].map(m=>Number(m[1].replaceAll(',',''))),ALLOCATIONS.slice(0,2).map(r=>r.amount));
const devLine=brief.split('\n').find(l=>l.startsWith('DEVVESTING:'))!;
assert.equal(Number(devLine.match(/ALLOCATION ([\d,]+)e18/)![1].replaceAll(',','')),ALLOCATIONS[5].amount);
assert.match(brief,/T = 4 \* 365 days/);assert.match(devLine,/before 365 days/);assert.match(devLine,/1460 days/);
assert.equal(T,126144000);assert.equal(CLIFF,365*86400);assert.equal(VESTING_END,1460*86400);
assert.equal(ALLOCATIONS.reduce((n,r)=>n+r.amount,0),TOTAL_SUPPLY);assert.equal(TOTAL_SUPPLY,1000000000);assert.equal(ALLOCATIONS.reduce((n,r)=>n+r.share,0),100);
assert.deepEqual([1,2,3,4].map(y=>(gaugeReleased(y*T/4,100)-gaugeReleased((y-1)*T/4,100))),[43.75,31.25,18.75,6.25]);
assert.deepEqual(RELEASES.map(r=>[r.gauges,r.vested,r.outside,r.share]),[[306250000,10000000,576250000,57.6],[525000000,20000000,805000000,80.5],[656250000,30000000,946250000,94.6],[700000000,40000000,1000000000,100]]);
assert.equal(developmentVested(CLIFF-1),0);assert.equal(developmentVested(CLIFF),10000000);assert.equal(developmentVested(VESTING_END+1),40000000);assert.equal(gaugeReleased(T+1),700000000);
const configured=Object.fromEntries(Object.keys(ADDRESSES).map((k,i)=>[k,('0x'+String(i+1).padStart(40,'0'))])) as typeof ADDRESSES;
let calls=0;let contractNames:string[]=[];
const reader=async (specs: {functionName:string;address:string}[])=>{calls++;contractNames=specs.map(c=>c.functionName);return Array(10).fill({ok:true,value:1234567890123456789n});};
assert.deepEqual(Object.values(ADDRESSES),[null,null,null,null,null]);
for(const key of Object.keys(ADDRESSES)){const addresses={...configured,[key]:null};assert.equal(await readLiveFigures(addresses,reader),null);assert.equal(renderToStaticMarkup(<LiveFigures addresses={addresses} reader={reader}/>),'');}
assert.equal(calls,0,'every single-null configuration has zero calls and no block');
assert(!renderToStaticMarkup(<Tokenomics/>).includes('Live figures'));
assert.deepEqual(await readLiveFigures(configured,reader),Array(10).fill(1234567890123456789n));assert.equal(calls,1);assert.deepEqual(contractNames,['totalSupply','released','remaining','totalStaked','released','remaining','totalStaked','vested','released','totalStaked']);
await assert.rejects(readLiveFigures(configured,async()=>{throw Error('fixture unavailable');}),/fixture unavailable/);
await assert.rejects(readLiveFigures(configured,async()=>[{ok:false,error:'fixture unavailable'}]),/Live figures unreadable/);
assert.equal(formatLive(1234567890123456789012345n),'1,234,567');assert.equal(formatLive(1234567890123456789n,true),'1.234567');assert.equal(formatLive(1000000000000000001n,true),'1');
assert.equal(PARAGRAPHS.length,6);
console.log('PASS tokenomics: brief parsing, supply, schedule, cliff, four annual rows, every-null guard, absent live block, configured multicall, rejected read, formatting');

import { parseAbi } from "viem";

export const itemTokenAbi = parseAbi([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
]);
// 2026-10-16, Add liquidity build: pair views and the two allowed router calls.
export const itemPairAbi = parseAbi([
  "function getReserves() view returns (uint112,uint112,uint32)",
  "function token0() view returns (address)",
  "function totalSupply() view returns (uint256)",
]);
export const itemRouterAbi = parseAbi([
  "function addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256) returns (uint256,uint256,uint256)",
  "function addLiquidityETH(address,uint256,uint256,uint256,address,uint256) payable returns (uint256,uint256,uint256)",
]);
export const gaugeAbi = parseAbi([
  "function item() view returns (address)",
  "function tokenA() view returns (address)",
  "function tokenB() view returns (address)",
  "function V2_FACTORY() view returns (address)",
  "function ALLOCATION() view returns (uint256)",
  "function pair() view returns (address)",
  "function started() view returns (bool)",
  "function stakedSeconds() view returns (uint256)",
  "function released() view returns (uint256)",
  "function rate() view returns (uint256)",
  "function remaining() view returns (uint256)",
  "function totalStaked() view returns (uint256)",
  "function staked(address) view returns (uint256)",
  "function earned(address) view returns (uint256)",
  "function stake(uint256)",
  "function withdraw(uint256)",
  "function claim()",
]);
export const stakingAbi = parseAbi([
  "function item() view returns (address)",
  "function BASK() view returns (address)",
  "function USDG() view returns (address)",
  "function WETH() view returns (address)",
  "function totalStaked() view returns (uint256)",
  "function staked(address) view returns (uint256)",
  "function earned(address,address) view returns (uint256)",
  "function stake(uint256)",
  "function unstake(uint256)",
  "function claim(address)",
]);
export const vestingAbi = parseAbi([
  "function item() view returns (address)",
  "function beneficiary() view returns (address)",
  "function ALLOCATION() view returns (uint256)",
  "function deployedAt() view returns (uint256)",
  "function funded() view returns (bool)",
  "function vested() view returns (uint256)",
  "function released() view returns (uint256)",
]);

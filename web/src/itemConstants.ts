import type { Address, Hex } from "viem";

// SPEC 2: the single source of ITEM addresses and launch evidence.
export const KNOWN = {
  BASK: "0x739fD5B653aA092a434534FA1aDE67C1770b5a5B",
  USDG: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
  WETH: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
  V2_FACTORY: "0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f",
  V2_ROUTER: "0x89e5DB8B5aA49aA85AC63f691524311AEB649eba",
  BASK_USDG_PAIR: "0xCC23688c49D58c5FF1f3Bf77e3cAB1927cBa6e70",
  OWNER: "0x30B57ECf51D19ABcED7F6f70974e6fBb6f3b9Da3",
  DEV: "0xc5e21e7A89F1fBDc5554e31702e627dD6262C856",
  V2_ROUTER_HASH: "0xbd55ea26b2f8d42a8ff151511cef92a326a9817686899fe96a8a8f81ee7fc55e",
  USDG_HASH: "0x864cc9ad53b338b82da1f7cab85ab0b3d5c8861acb422b6fec63cf36234f36a6",
} as const satisfies Record<string, Address | Hex>;
export const CONTRACT_KEYS = ["ITEM", "ITEM_STAKING", "BASK_USDG_GAUGE", "ITEM_ETH_GAUGE", "DEV_VESTING"] as const;
export const ADDRESS_KEYS = [...CONTRACT_KEYS, "ITEM_WETH_PAIR"] as const;
export const HASH_KEYS = [...ADDRESS_KEYS.map(key => `${key}_HASH` as const), "BASK_USDG_PAIR_HASH"] as const;
export type Launch = Record<typeof ADDRESS_KEYS[number], Address | null> & Record<typeof HASH_KEYS[number], Hex | null> & { ITEM_REPO: string | null; ITEM_COMMIT: string | null };
export type ReadyLaunch = { [K in keyof Launch]: NonNullable<Launch[K]> };
// BEGIN LAUNCH SLOTS
export const LAUNCH: Launch = {
  "ITEM": "0x4F1b7a5aAF3768F7500E9ab5CBBF3762834e8B57",
  "ITEM_STAKING": "0x7E82d352D3F6336e474bA28040785414A8E2E1D3",
  "BASK_USDG_GAUGE": "0xF5eBBF7A60B22FB38270AB4942585AD1654a9A11",
  "ITEM_ETH_GAUGE": "0x5a2fc207f7d9f84426B8C0f7908a492450E0add6",
  "DEV_VESTING": "0xf1670d095d32b1011aA843E7b7d44Eeb7bA222C7",
  "ITEM_WETH_PAIR": "0x9a2B386290Cbfeb40be6EDA694de73B97D66B269",
  "ITEM_HASH": "0x88e6958c93593f86b2ce10ddb6aad48e7fe950c2d77b3ad17bd20135b54dd094",
  "ITEM_STAKING_HASH": "0xb1a29155cc3f1181b3f7d2fb201b8a341234312c8fc4ca757a4350b50147ac26",
  "BASK_USDG_GAUGE_HASH": "0x393b4efe68a8fe743ec9e0df52c9a278a2f11cbcecd85c0ad369083e422d67af",
  "ITEM_ETH_GAUGE_HASH": "0x08bb4f4a8857373753a0f79a7fbfb38e90556593abb4774f1e873d9462ac3d8f",
  "DEV_VESTING_HASH": "0x6562ef49618a0becdacdd132444e5f6a5b460bd36bf2b9e1a4b522a1b4db4b47",
  "ITEM_WETH_PAIR_HASH": "0x5b83bdbcc56b2e630f2807bbadd2b0c21619108066b92a58de081261089e9ce5",
  "BASK_USDG_PAIR_HASH": "0x5b83bdbcc56b2e630f2807bbadd2b0c21619108066b92a58de081261089e9ce5",
  "ITEM_REPO": "https://github.com/identity-md-launches/launch-2241-item",
  "ITEM_COMMIT": "f0f84fcd6637ea334d50af06b8f694c19b643461"
};
// END LAUNCH SLOTS
// SPEC 2/6: every slot is required, including the known pair's approval-target hash.
export function itemReady(config: Launch = LAUNCH): config is ReadyLaunch {
  return [...ADDRESS_KEYS, ...HASH_KEYS, "ITEM_REPO", "ITEM_COMMIT"].every(key => config[key as keyof Launch] !== null);
}

// SPDX-License-Identifier: GPL-2.0-or-later
// Tick arithmetic ported from web/pinned/src/libraries/TickMath.sol.
// Preserve exact integer rounding used by BaskOracle; no floating-point prices.
const factors = [
  0xfffcb933bd6fad37aa2d162d1a594001n,
  0xfff97272373d413259a46990580e213an,
  0xfff2e50f5f656932ef12357cf3c7fdccn,
  0xffe5caca7e10e4e61c3624eaa0941cd0n,
  0xffcb9843d60f6159c9db58835c926644n,
  0xff973b41fa98c081472e6896dfb254c0n,
  0xff2ea16466c96a3843ec78b326b52861n,
  0xfe5dee046a99a2a811c461f1969c3053n,
  0xfcbe86c7900a88aedcffc83b479aa3a4n,
  0xf987a7253ac413176f2b074cf7815e54n,
  0xf3392b0822b70005940c7a398e4b70f3n,
  0xe7159475a2c29b7443b29c7fa6e889d9n,
  0xd097f3bdfd2022b8845ad8f792aa5825n,
  0xa9f746462d870fdf8a65dc1f90e061e5n,
  0x70d869a156d2a1b890bb3df62baf32f7n,
  0x31be135f97d08fd981231505542fcfa6n,
  0x9aa508b5b7a84e1c677de54f3e99bc9n,
  0x5d6af8dedb81196699c329225ee604n,
  0x2216e584f5fa1ea926041bedfe98n,
  0x48a170391f7dc42444e8fa2n,
];
export function sqrtAtTick(tick: bigint) {
  const abs = tick < 0n ? -tick : tick;
  if (abs > 887272n) throw new Error("Pool mean tick out of bounds.");
  let ratio = 1n << 128n;
  for (let i = 0; i < factors.length; i++)
    if (abs & (1n << BigInt(i))) ratio = (ratio * factors[i]) >> 128n;
  if (tick > 0n) ratio = ((1n << 256n) - 1n) / ratio;
  return (ratio >> 32n) + (ratio % (1n << 32n) ? 1n : 0n);
}
export function poolMetrics(
  ticks: bigint[],
  liquidities: bigint[],
  seconds: bigint,
  tokenIs0: boolean,
  tokenDecimals: number,
  quoteDecimals: number,
  quoteAnswer: bigint,
  quoteFeedDecimals: number,
) {
  if (ticks.length !== 2 || liquidities.length !== 2)
    throw new Error("Pool observations unreadable.");
  const dt = BigInt.asIntN(56, ticks[1] - ticks[0]);
  const dl = BigInt.asUintN(160, liquidities[1] - liquidities[0]);
  if (!dl) throw new Error("Pool liquidity observation is zero.");
  const liquidity = (seconds * ((1n << 160n) - 1n)) / (dl << 32n);
  if (liquidity >= 1n << 128n) throw new Error("Pool liquidity out of bounds.");
  const mean = dt / seconds - (dt < 0n && dt % seconds ? 1n : 0n);
  const sqrt = sqrtAtTick(mean);
  const small = sqrt < 1n << 128n;
  const ratio = small ? sqrt * sqrt : (sqrt * sqrt) / (1n << 64n);
  const unit = 1n << (small ? 192n : 128n);
  const base = 10n ** BigInt(18 + tokenDecimals - quoteDecimals);
  const rawQuote = tokenIs0 ? (ratio * base) / unit : (unit * base) / ratio;
  return {
    liquidity,
    price: (rawQuote * quoteAnswer) / 10n ** BigInt(quoteFeedDecimals),
  };
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice Full precision floor(x * y / d), including 512-bit intermediate products.
library BaskMath {
    error MathOverflow();

    function mulDiv(uint256 x, uint256 y, uint256 d) internal pure returns (uint256 result) {
        unchecked {
            uint256 lo;
            uint256 hi;
            assembly ("memory-safe") {
                let mm := mulmod(x, y, not(0))
                lo := mul(x, y)
                hi := sub(sub(mm, lo), lt(mm, lo))
            }
            if (d == 0 || hi >= d) revert MathOverflow();
            if (hi == 0) return lo / d;
            uint256 remainder;
            assembly ("memory-safe") {
                remainder := mulmod(x, y, d)
                hi := sub(hi, gt(remainder, lo))
                lo := sub(lo, remainder)
            }
            uint256 twos = d & (0 - d);
            assembly ("memory-safe") {
                d := div(d, twos)
                lo := div(lo, twos)
                twos := add(div(sub(0, twos), twos), 1)
            }
            lo |= hi * twos;
            uint256 inverse = (3 * d) ^ 2;
            inverse *= 2 - d * inverse;
            inverse *= 2 - d * inverse;
            inverse *= 2 - d * inverse;
            inverse *= 2 - d * inverse;
            inverse *= 2 - d * inverse;
            inverse *= 2 - d * inverse;
            result = lo * inverse;
        }
    }

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    function max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? a : b;
    }

    function fee(uint256 amount) internal pure returns (uint256) {
        return amount / 200 + (amount % 200 == 0 ? 0 : 1);
    }
}

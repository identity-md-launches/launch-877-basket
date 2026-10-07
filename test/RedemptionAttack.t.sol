// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {BaskTestBase} from "./BaskVault.t.sol";
import {BaskVault} from "../src/BaskVault.sol";
import {MockStock, MockFeed} from "./mocks/Mocks.sol";

contract RedemptionAttackTest is BaskTestBase {
    struct LegState {
        uint256 managed;
        uint256 custody;
        uint256 holderBalance;
        uint256 backing;
        bool pays;
    }

    function setUp() public override {
        _setup(64);
        for (uint256 i; i < 64; ++i) {
            _deposit(i, 1e18);
        }
    }

    function _boundedRedeem() internal returns (uint256[] memory legs) {
        uint256 shares = vault.balanceOf(ALICE);
        bytes memory data = abi.encodeCall(vault.redeem, (shares, new uint256[](0), block.timestamp));
        for (uint256 i; i < 64; ++i) {
            vm.cool(address(stocks[i]));
        }
        vm.cool(address(vault));
        vm.prank(ALICE);
        // A bounded call proves the gas ceiling even when Foundry isolates calls.
        // gasleft() subtraction across those call boundaries is not reliable.
        (bool ok, bytes memory result) = address(vault).call{gas: 27_900_000}(data);
        assertTrue(ok, "hostile asset blocked redemption");
        legs = abi.decode(result, (uint256[]));
        assertEq(legs.length, 64);
        assertEq(vault.balanceOf(ALICE), 0);
        for (uint256 i; i < 64; ++i) {
            assertGt(legs[i], 0);
        }
    }

    function test64GasExhaustingTransfersStayUnderGasLimit() public {
        for (uint256 i; i < 64; ++i) {
            stocks[i].setMode(MockStock.Mode.GasBomb);
        }
        uint256[] memory legs = _boundedRedeem();
        for (uint256 i; i < 64; ++i) {
            assertEq(vault.owed(ALICE, address(stocks[i])), legs[i]);
        }
    }

    function test64GasExhaustingBalanceReadsStayUnderGasLimit() public {
        for (uint256 i; i < 64; ++i) {
            stocks[i].setReadMode(MockStock.ReadMode.GasBomb);
        }
        uint256[] memory legs = _boundedRedeem();
        for (uint256 i; i < 64; ++i) {
            assertEq(vault.owed(ALICE, address(stocks[i])), legs[i]);
        }
    }

    function test64PausedBlockedUpgradedAndMalformedTokens() public {
        for (uint256 i; i < 64; ++i) {
            feeds[i].setBroken(true);
            stocks[i].setPaused(true);
            uint256 variant = i % 8;
            if (variant == 0) stocks[i].setMode(MockStock.Mode.RevertCall);
            if (variant == 1) stocks[i].blockAddress(ALICE, true);
            if (variant == 2) stocks[i].setMode(MockStock.Mode.FalseReturn);
            if (variant == 3) stocks[i].setMode(MockStock.Mode.LargeReturn);
            if (variant == 4) stocks[i].setReadMode(MockStock.ReadMode.ShortReturn);
            if (variant == 5) stocks[i].setMode(MockStock.Mode.NoMovement);
            if (variant == 6) stocks[i].setMode(MockStock.Mode.ExtraDebit);
            if (variant == 7) stocks[i].setMode(MockStock.Mode.NoReturn);
            vm.prank(GUARDIAN);
            vault.closeAsset(address(stocks[i]));
        }
        vm.prank(GUARDIAN);
        vault.pauseDeposits();
        vm.prank(OWNER);
        vault.lowerNAVCap(0);
        vm.warp(block.timestamp + 60 days);
        uint256[] memory legs = _boundedRedeem();
        for (uint256 i; i < 64; ++i) {
            assertEq(vault.owed(ALICE, address(stocks[i])), i % 8 == 7 ? 0 : legs[i]);
        }
    }

    function test64RetiredUnreadableTokensCannotBlockRedemption() public {
        uint256[] memory ids = new uint256[](64);
        for (uint256 i; i < 64; ++i) {
            vm.startPrank(OWNER);
            vault.closeAsset(address(stocks[i]));
            ids[i] = vault.proposeRetire(address(stocks[i]));
            vm.stopPrank();
        }
        vm.warp(block.timestamp + 7 days);
        for (uint256 i; i < 64; ++i) {
            vault.executeProposal(ids[i]);
            // Simulates a destructive token upgrade: empty runtime and no readable balance.
            vm.etch(address(stocks[i]), hex"");
        }
        uint256[] memory legs = _boundedRedeem();
        for (uint256 i; i < 64; ++i) {
            assertEq(vault.totalOwed(address(stocks[i])), legs[i]);
        }
    }

    /// forge-config: default.fuzz.runs = 128
    function testFuzz64MixedFailuresPreserveOtherClaimantsAndAccounting(uint256 seed, bool feesEnabled) public {
        // Give Bob an existing claim on every asset before Alice exits.
        vm.prank(ALICE);
        vault.transfer(BOB, 100e18);
        for (uint256 i; i < 64; ++i) {
            stocks[i].setMode(MockStock.Mode.RevertCall);
        }
        vm.prank(BOB);
        uint256[] memory priorDebt = vault.redeem(100e18, new uint256[](0), block.timestamp);
        if (feesEnabled) {
            vm.prank(OWNER);
            vault.setFeeRecipient(BOB);
        }

        LegState[64] memory beforeState;
        for (uint256 i; i < 64; ++i) {
            seed = uint256(keccak256(abi.encode(seed, i)));
            assertGt(priorDebt[i], 0, "prior claimant was not funded");
            beforeState[i] = _mixFailure(i, seed, priorDebt[i]);
        }
        vm.prank(GUARDIAN);
        vault.pauseDeposits();
        vm.prank(OWNER);
        vault.lowerNAVCap(0);
        vm.warp(block.timestamp + 60 days);

        uint256 supply = vault.totalSupply();
        uint256 shares = vault.balanceOf(ALICE);
        uint256 fee = (shares * 50 + 9999) / 10000;
        uint256[] memory legs = _boundedRedeem();
        assertEq(vault.totalSupply(), supply - shares + (feesEnabled ? fee : 0));
        assertEq(vault.balanceOf(BOB), feesEnabled ? fee : 0);
        assertEq(vault.totalSupply(), vault.balanceOf(BOB) + vault.balanceOf(address(0xdEaD)));

        for (uint256 i; i < 64; ++i) {
            LegState memory s = beforeState[i];
            address token = address(stocks[i]);
            // Floor inequalities independently check the leg, including the pre-burn denominator.
            uint256 numerator = s.backing * (shares - fee);
            assertLe(legs[i] * supply, numerator);
            assertLt(numerator - legs[i] * supply, supply);
            uint256 paid = s.pays ? legs[i] : 0;
            uint256 queued = s.pays ? 0 : legs[i];
            assertEq(vault.managed(token) + legs[i], s.managed);
            assertEq(vault.owed(BOB, token), priorDebt[i], "redemption consumed another claimant's debt");
            assertEq(vault.owed(ALICE, token), queued);
            assertEq(vault.totalOwed(token), priorDebt[i] + queued);

            // Restore only the mock's read behavior to inspect real custody after a failed payment.
            stocks[i].setReadMode(MockStock.ReadMode.Normal);
            assertEq(stocks[i].balanceOf(address(vault)) + paid, s.custody);
            assertEq(stocks[i].balanceOf(ALICE), s.holderBalance + paid);
            assertEq(stocks[i].balanceOf(BOB), 0);
        }
    }

    function _mixFailure(uint256 i, uint256 seed, uint256 reserved) internal returns (LegState memory s) {
        MockStock stock = stocks[i];
        s.managed = vault.managed(address(stock));
        // Positive but short custody, exact backing, or an ignored direct donation.
        uint256 custodyMode = seed % 3;
        if (custodyMode == 0) stock.confiscate(address(vault), 0.5e18);
        if (custodyMode == 2) stock.mint(address(vault), 1e18);
        s.custody = stock.balanceOf(address(vault));
        s.holderBalance = stock.balanceOf(ALICE);
        MockStock.Mode mode = MockStock.Mode((seed >> 8) % 9);
        uint256 readVariant = (seed >> 16) % 8;
        MockStock.ReadMode readMode = readVariant < 4 ? MockStock.ReadMode.Normal : MockStock.ReadMode(readVariant - 3);
        bool blocked = (seed >> 24) % 8 == 0;
        stock.setMode(mode);
        stock.setReadMode(readMode);
        stock.blockAddress(ALICE, blocked);
        stock.setPaused(true);
        feeds[i].setBroken(true);
        vm.prank(i % 2 == 0 ? OWNER : GUARDIAN);
        vault.closeAsset(address(stock));
        s.backing = s.managed;
        if (readMode == MockStock.ReadMode.Normal && s.custody - reserved < s.backing) {
            s.backing = s.custody - reserved;
        }
        s.pays = readMode == MockStock.ReadMode.Normal && !blocked
            && (mode == MockStock.Mode.Normal || mode == MockStock.Mode.NoReturn);
    }

    function testAssetLimitAndGlobalBucket() public {
        MockStock extra = new MockStock(bytes32(uint256(65)));
        MockFeed feed = new MockFeed();
        factory.register(extra.uid(), address(extra));
        vm.prank(OWNER);
        vm.expectRevert(BaskVault.AssetLimit.selector);
        vault.proposeAsset(address(extra), address(feed));
        // 6,400 already deposited. Reach 100,000 across four separate assets.
        _deposit(0, 249e18);
        _deposit(1, 249e18);
        _deposit(2, 249e18);
        _deposit(3, 189e18);
        assertEq(vault.bucket(), 100_000e18);
        vm.expectRevert(
            abi.encodeWithSelector(
                BaskVault.DepositUnavailable.selector, BaskVault.Reason.BucketCap, address(stocks[4])
            )
        );
        _deposit(4, 1e18);
        vm.warp(block.timestamp + 1 hours);
        _refresh();
        _deposit(4, 1e18);
    }
}

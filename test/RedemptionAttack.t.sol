// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {BaskTestBase} from "./BaskVault.t.sol";
import {BaskVault} from "../src/BaskVault.sol";
import {MockStock, MockFeed} from "./mocks/Mocks.sol";

contract RedemptionAttackTest is BaskTestBase {
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

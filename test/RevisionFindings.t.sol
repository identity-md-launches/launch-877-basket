// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {BaskTestBase} from "./BaskVault.t.sol";
import {BaskVault} from "../src/BaskVault.sol";
import {MockStock, MockFeed} from "./mocks/Mocks.sol";

/// @notice Reproduces review reports under the specified rules; passing does not mean the risks are fixed.
contract RevisionFindingsTest is BaskTestBase {
    function setUp() public override {
        _setup(4);
    }

    function _statusFor(uint256 index, BaskVault.Reason expected, address expectedFault) internal {
        (BaskVault.Reason reason, address fault) = vault.depositStatus(address(stocks[index]));
        assertEq(uint256(reason), uint256(expected));
        assertEq(fault, expectedFault);
        vm.expectRevert(abi.encodeWithSelector(BaskVault.DepositUnavailable.selector, expected, expectedFault));
        _deposit(index, 1e18);
    }

    function _fundBob(uint256 index, uint256 amount) internal {
        stocks[index].mint(BOB, amount);
        vm.prank(BOB);
        stocks[index].approve(address(vault), type(uint256).max);
    }

    function _retirement(uint256 index) internal returns (uint256 id) {
        vm.startPrank(OWNER);
        vault.closeAsset(address(stocks[index]));
        id = vault.proposeRetire(address(stocks[index]));
        vm.stopPrank();
    }

    function testBandOutlierExtractionAndRecoveredPriceLockout() public {
        for (uint256 i = 1; i < 4; ++i) {
            _deposit(i, 240e18);
        }
        _fundBob(0, 1e18);
        vm.prank(OWNER);
        uint256 id = vault.proposeBand(address(stocks[0]));
        vm.warp(block.timestamp + 7 days);
        _refresh();
        feeds[0].set(100_000e8, block.timestamp);
        _statusFor(0, BaskVault.Reason.OutsideBand, address(stocks[0]));

        vm.prank(BOB);
        vault.executeProposal(id);
        BaskVault.AssetView memory asset = vault.allAssets()[0];
        assertEq(asset.minAnswer, 25_000e8);
        assertEq(asset.maxAnswer, 400_000e8);
        vm.startPrank(BOB);
        uint256 shares = vault.deposit(address(stocks[0]), 0.25e18, BOB, 0, block.timestamp);
        uint256[] memory legs = vault.redeem(shares, new uint256[](0), block.timestamp);
        vm.stopPrank();
        for (uint256 i = 1; i < 4; ++i) {
            assertGt(legs[i], 61e18);
            assertEq(stocks[i].balanceOf(BOB), legs[i]);
        }
        emit log_named_uint("live asset leg after outlier re-centre", legs[1]);

        feeds[0].set(100e8, block.timestamp);
        _statusFor(1, BaskVault.Reason.OutsideBand, address(stocks[0]));
        MockFeed honest = new MockFeed();
        vm.prank(OWNER);
        vm.expectRevert(abi.encodeWithSelector(BaskVault.InvalidFeed.selector, address(honest)));
        vault.proposeFeed(address(stocks[0]), address(honest));
    }

    function testPostGenesisListingOutlierExtractionDespiteProbationCap() public {
        for (uint256 i = 1; i < 4; ++i) {
            _deposit(i, 240e18);
        }
        (MockStock stock, MockFeed feed) = _newPair();
        _fundBob(4, 1e18);
        vm.prank(OWNER);
        uint256 id = vault.proposeAsset(address(stock), address(feed));
        vm.warp(block.timestamp + 7 days);
        _refresh();
        feed.set(100_000e8, block.timestamp);

        vm.startPrank(BOB);
        vault.executeProposal(id);
        uint256 shares = vault.deposit(address(stock), 0.05e18, BOB, 0, block.timestamp);
        uint256[] memory legs = vault.redeem(shares, new uint256[](0), block.timestamp);
        vm.stopPrank();
        assertTrue(vault.allAssets()[4].probation);
        assertEq(vault.allAssets()[4].minAnswer, 25_000e8);
        // $5 honest cost buys more than $4,500 of the other holders' live assets.
        assertGt((legs[1] + legs[2] + legs[3]) * 100, 4_500e18);
        emit log_named_uint("live asset leg after outlier listing", legs[1]);
    }

    function testCancelledBandShowsSuppliedProofBalanceBaselineError() public {
        // The supplied proof seeds the executor with one whole token of EVERY asset.
        stocks[1].mint(BOB, 1e18);
        vm.startPrank(OWNER);
        uint256 id = vault.proposeBand(address(stocks[0]));
        vault.cancelProposal(id);
        vm.stopPrank();
        vm.warp(block.timestamp + 7 days);
        _refresh();
        feeds[0].set(100_000e8, block.timestamp);
        vm.prank(BOB);
        (bool executed,) = address(vault).call(abi.encodeCall(vault.executeProposal, (id)));
        assertFalse(executed);
        assertEq(stocks[1].balanceOf(BOB), 1e18);
        // Its final assertLt(balance, 1e18) would fail even though no attack executed.
        assertFalse(stocks[1].balanceOf(BOB) < 1e18);
    }

    function testZeroNAVPersistsAfterRetirementRedemptionNewListingAndDonation() public {
        _deposit(0, 10e18);
        uint256 id = _retirement(0);
        vm.warp(block.timestamp + 7 days);
        vault.executeProposal(id);
        _redeem(vault.balanceOf(ALICE));
        assertEq(vault.totalSupply(), 1e15);
        assertEq(vault.balanceOf(address(0xdEaD)), 1e15);
        assertGt(vault.managed(address(stocks[0])), 0);
        _refresh();
        _statusFor(1, BaskVault.Reason.ZeroNAV, address(0));

        (MockStock stock, MockFeed feed) = _newPair();
        vm.prank(OWNER);
        id = vault.proposeAsset(address(stock), address(feed));
        vm.warp(block.timestamp + 7 days);
        vault.executeProposal(id);
        _refresh();
        _statusFor(4, BaskVault.Reason.ZeroNAV, address(0));
        stock.mint(address(vault), 10e18);
        assertEq(vault.managed(address(stock)), 0);
        _statusFor(4, BaskVault.Reason.ZeroNAV, address(0));
    }

    function testZeroNAVPersistsAfterFullLossAndAllUserSharesBurned() public {
        _deposit(0, 10e18);
        stocks[0].confiscate(address(vault), 10e18);
        vault.flagDeficit(address(stocks[0]));
        vm.warp(block.timestamp + 7 days);
        vault.recognizeLoss(address(stocks[0]));
        _refresh();
        assertEq(vault.managed(address(stocks[0])), 0);
        _statusFor(1, BaskVault.Reason.ZeroNAV, address(0));
        _redeem(vault.balanceOf(ALICE));
        assertEq(vault.totalSupply(), 1e15);
        _statusFor(1, BaskVault.Reason.ZeroNAV, address(0));
    }

    function testStaleFeedAndOutOfBandReplacementCannotRepairHeldAsset() public {
        _deposit(0, 100e18);
        MockFeed replacement = new MockFeed();
        replacement.set(10e8, block.timestamp);
        vm.prank(OWNER);
        vm.expectRevert(abi.encodeWithSelector(BaskVault.InvalidFeed.selector, address(replacement)));
        vault.proposeFeed(address(stocks[0]), address(replacement));
        vm.prank(OWNER);
        uint256 id = vault.proposeBand(address(stocks[0]));
        vm.warp(block.timestamp + 7 days);
        for (uint256 i = 1; i < 4; ++i) {
            feeds[i].set(100e8, block.timestamp);
        }
        vm.expectRevert(abi.encodeWithSelector(BaskVault.InvalidFeed.selector, address(feeds[0])));
        vault.executeProposal(id);
        _statusFor(1, BaskVault.Reason.StalePrice, address(stocks[0]));
    }

    function testTemporaryZeroReadRecognizedDuringPauseStrandsRecoveredTokens() public {
        _deposit(0, 100e18);
        vm.mockCall(
            address(stocks[0]), abi.encodeWithSignature("balanceOf(address)", address(vault)), abi.encode(uint256(0))
        );
        vault.flagDeficit(address(stocks[0]));
        vm.prank(GUARDIAN);
        vault.pauseDeposits();
        vm.warp(block.timestamp + 7 days);
        vault.recognizeLoss(address(stocks[0]));
        vm.clearMockedCalls();
        assertEq(vault.managed(address(stocks[0])), 0);
        assertEq(stocks[0].balanceOf(address(vault)), 100e18);
        uint256[] memory legs = _redeem(vault.balanceOf(ALICE));
        assertEq(legs[0], 0);
        vm.prank(ALICE);
        assertEq(vault.claim(address(stocks[0]), ALICE), 0);
        assertEq(stocks[0].balanceOf(address(vault)), 100e18);
    }

    function testRecoveryBeforeRecognitionPreservesManagedBalance() public {
        _deposit(0, 100e18);
        vm.mockCall(
            address(stocks[0]), abi.encodeWithSignature("balanceOf(address)", address(vault)), abi.encode(uint256(0))
        );
        vault.flagDeficit(address(stocks[0]));
        vm.warp(block.timestamp + 7 days);
        vm.clearMockedCalls();
        vault.recognizeLoss(address(stocks[0]));
        assertEq(vault.managed(address(stocks[0])), 100e18);
        (uint256 recorded,) = vault.losses(address(stocks[0]));
        assertEq(recorded, 0);
        uint256[] memory legs = _redeem(vault.balanceOf(ALICE));
        assertGt(legs[0], 99e18);
    }

    function testEighthSimultaneousListingExpiresBeforeCooldownEnds() public {
        address[] memory tokens = new address[](8);
        address[] memory prices = new address[](8);
        for (uint256 i; i < 8; ++i) {
            (MockStock stock, MockFeed feed) = _newPair();
            tokens[i] = address(stock);
            prices[i] = address(feed);
        }
        vm.prank(OWNER);
        uint256[] memory ids = vault.proposeAssets(tokens, prices);
        uint256 createdAt = block.timestamp;
        for (uint256 i; i < 7; ++i) {
            vm.warp(createdAt + 7 days + i * 1 days);
            _refresh();
            vault.executeProposal(ids[i]);
        }
        vm.warp(createdAt + 14 days - 1);
        vm.expectRevert(BaskVault.ChangeCooldown.selector);
        vault.executeProposal(ids[7]);
        vm.warp(createdAt + 14 days);
        vm.expectRevert(abi.encodeWithSelector(BaskVault.InvalidProposal.selector, ids[7]));
        vault.executeProposal(ids[7]);
        assertEq(uint256(vault.proposalState(ids[7])), uint256(BaskVault.State.Expired));
        assertEq(vault.assetCount(), 11);
    }

    function testOwnershipCanBeTransferredToCurrentGuardian() public {
        vm.prank(OWNER);
        vault.transferOwnership(GUARDIAN);
        vm.prank(GUARDIAN);
        vault.acceptOwnership();
        assertEq(vault.owner(), GUARDIAN);
        assertEq(vault.owner(), vault.guardian());
    }

    function testGuardianProposalCanExecuteBeforePendingOwnerAccepts() public {
        vm.startPrank(OWNER);
        uint256 id = vault.proposeGuardian(BOB);
        vault.transferOwnership(BOB);
        vm.stopPrank();
        vm.warp(block.timestamp + 7 days);
        vault.executeProposal(id);
        vm.prank(BOB);
        vault.acceptOwnership();
        assertEq(vault.owner(), BOB);
        assertEq(vault.owner(), vault.guardian());
    }

    function testRetiredPositionExtractionAmplifiesWhenLiveNAVIsSmall() public {
        _deposit(0, 100e18); // $10,000 position to be retired.
        _deposit(1, 1e16); // $1 of live NAV remains afterwards.
        uint256 id = _retirement(0);
        _fundBob(1, 1e18);
        vm.warp(block.timestamp + 7 days);
        _refresh();
        vm.startPrank(BOB);
        vault.executeProposal(id);
        assertEq(vault.previewDeposit(address(stocks[1]), 1e18).nav, 1e18);
        uint256 shares = vault.deposit(address(stocks[1]), 1e18, BOB, 0, block.timestamp);
        uint256[] memory legs = vault.redeem(shares, new uint256[](0), block.timestamp);
        vm.stopPrank();
        assertGt(legs[0], 98e18);
        assertEq(stocks[0].balanceOf(BOB), legs[0]);
        emit log_named_uint("retired asset paid on a $100 deposit", legs[0]);
    }
}

contract RevisionQuorumTest is BaskTestBase {
    function testRetiringOneOfThreeRemovesQuorumDespitePositiveLiveNAV() public {
        _deposit(0, 10e18);
        _deposit(1, 1e18); // Keep positive NAV to isolate the quorum failure.
        vm.startPrank(OWNER);
        vault.closeAsset(address(stocks[0]));
        uint256 id = vault.proposeRetire(address(stocks[0]));
        vm.stopPrank();
        vm.warp(block.timestamp + 7 days);
        _refresh();
        vault.executeProposal(id);
        (BaskVault.Reason reason, address fault) = vault.depositStatus(address(stocks[1]));
        assertEq(uint256(reason), uint256(BaskVault.Reason.MarketNotFresh));
        assertEq(fault, address(0));
        assertGt(vault.managed(address(stocks[1])), 0);
        vm.expectRevert(
            abi.encodeWithSelector(BaskVault.DepositUnavailable.selector, BaskVault.Reason.MarketNotFresh, address(0))
        );
        _deposit(1, 1e18);
    }
}

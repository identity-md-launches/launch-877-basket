// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {BaskTestBase} from "./BaskVault.t.sol";
import {BaskVault} from "../src/BaskVault.sol";
import {MockFeed, MockStock} from "./mocks/Mocks.sol";

contract GovernanceTest is BaskTestBase {
    function testGenesisBatchAndDelay() public {
        BaskVault fresh = new BaskVault(OWNER, GUARDIAN);
        address[] memory tokens = new address[](2);
        address[] memory prices = new address[](2);
        for (uint256 i; i < 2; ++i) {
            tokens[i] = address(stocks[i]);
            prices[i] = address(feeds[i]);
        }
        vm.startPrank(OWNER);
        uint256[] memory ids = fresh.proposeAssets(tokens, prices);
        assertEq(ids[0], 0);
        assertEq(fresh.assetCount(), 2);
        vm.expectRevert(BaskVault.InvalidState.selector);
        fresh.finalizeGenesis();
        fresh.proposeAsset(address(stocks[2]), address(feeds[2]));
        (BaskVault.Reason reason,) = fresh.depositStatus(tokens[0]);
        assertEq(uint256(reason), uint256(BaskVault.Reason.Genesis));
        fresh.finalizeGenesis();
        uint256 openAt = block.timestamp + 72 hours;
        assertEq(fresh.depositsOpenAt(), openAt);
        vm.expectRevert(BaskVault.InvalidState.selector);
        fresh.finalizeGenesis();
        vm.stopPrank();
        vm.warp(openAt - 1);
        (reason,) = fresh.depositStatus(tokens[0]);
        assertEq(uint256(reason), uint256(BaskVault.Reason.OpeningDelay));
        BaskVault.AssetView[] memory all = fresh.allAssets();
        assertEq(all[0].minAnswer, 25e8);
        assertEq(all[0].maxAnswer, 400e8);
        assertFalse(all[0].probation);
        assertTrue(all[0].open);
    }

    function testListingChecksAtProposalAndExecution() public {
        (MockStock stock, MockFeed feed) = _newPair();
        stock.setDecimals(6);
        vm.prank(OWNER);
        vm.expectRevert(abi.encodeWithSelector(BaskVault.InvalidAsset.selector, address(stock)));
        vault.proposeAsset(address(stock), address(feed));
        stock.setDecimals(18);
        factory.register(stock.uid(), BOB);
        vm.prank(OWNER);
        vm.expectRevert(abi.encodeWithSelector(BaskVault.InvalidAsset.selector, address(stock)));
        vault.proposeAsset(address(stock), address(feed));
        factory.register(stock.uid(), address(stock));
        feed.setDecimals(18);
        vm.prank(OWNER);
        vm.expectRevert(abi.encodeWithSelector(BaskVault.InvalidFeed.selector, address(feed)));
        vault.proposeAsset(address(stock), address(feed));
        feed.setDecimals(8);
        feed.setAggregator(address(0));
        vm.prank(OWNER);
        vm.expectRevert(abi.encodeWithSelector(BaskVault.InvalidFeed.selector, address(feed)));
        vault.proposeAsset(address(stock), address(feed));
        feed.setAggregator(address(1));
        feed.set(0, block.timestamp);
        vm.prank(OWNER);
        vm.expectRevert(abi.encodeWithSelector(BaskVault.InvalidFeed.selector, address(feed)));
        vault.proposeAsset(address(stock), address(feed));
        feed.set(100e8, block.timestamp);
        vm.prank(OWNER);
        uint256 id = vault.proposeAsset(address(stock), address(feed));
        vm.warp(block.timestamp + 7 days);
        factory.register(stock.uid(), BOB);
        vm.expectRevert(abi.encodeWithSelector(BaskVault.InvalidAsset.selector, address(stock)));
        vault.executeProposal(id);
        factory.register(stock.uid(), address(stock));
        feed.setDecimals(7);
        vm.expectRevert(abi.encodeWithSelector(BaskVault.InvalidFeed.selector, address(feed)));
        vault.executeProposal(id);
        feed.setDecimals(8);
        feed.set(200e8, block.timestamp);
        vm.prank(BOB);
        vault.executeProposal(id);
        BaskVault.AssetView[] memory all = vault.allAssets();
        assertEq(all[3].minAnswer, 50e8);
        assertEq(all[3].maxAnswer, 800e8);
        assertTrue(all[3].probation);
        assertEq(all[3].listedAt, block.timestamp);
    }

    function testDuplicateTokenFeedAndArrayMismatch() public {
        (MockStock stock, MockFeed feed) = _newPair();
        vm.startPrank(OWNER);
        vm.expectRevert(abi.encodeWithSelector(BaskVault.InvalidAsset.selector, address(stocks[0])));
        vault.proposeAsset(address(stocks[0]), address(feed));
        vm.expectRevert(abi.encodeWithSelector(BaskVault.InvalidFeed.selector, address(feeds[0])));
        vault.proposeAsset(address(stock), address(feeds[0]));
        vm.expectRevert(BaskVault.InvalidArray.selector);
        vault.proposeAssets(new address[](1), new address[](0));
        vm.stopPrank();
    }

    function testProposalSevenDayWaitAndSevenDayExecutionWindow() public {
        vm.prank(OWNER);
        uint256 id = vault.proposeNAVCap(2_000_000e18);
        uint256 time = block.timestamp;
        vm.warp(time + 7 days - 1);
        vm.expectRevert(abi.encodeWithSelector(BaskVault.ProposalNotReady.selector, id));
        vault.executeProposal(id);
        vm.warp(time + 7 days);
        vault.executeProposal(id);
        assertEq(vault.NAV_CAP(), 2_000_000e18);
        vm.expectRevert(abi.encodeWithSelector(BaskVault.InvalidProposal.selector, id));
        vault.executeProposal(id);
        vm.prank(OWNER);
        id = vault.proposeNAVCap(3_000_000e18);
        vm.warp(block.timestamp + 14 days);
        assertEq(uint256(vault.proposalState(id)), uint256(BaskVault.State.Expired));
        vm.expectRevert(abi.encodeWithSelector(BaskVault.InvalidProposal.selector, id));
        vault.executeProposal(id);
    }

    function testListingAndFeedReplacementShareCooldown() public {
        (MockStock stock, MockFeed feed) = _newPair();
        MockFeed replacement = new MockFeed();
        vm.startPrank(OWNER);
        uint256 listId = vault.proposeAsset(address(stock), address(feed));
        uint256 feedId = vault.proposeFeed(address(stocks[0]), address(replacement));
        vm.stopPrank();
        vm.warp(block.timestamp + 7 days);
        vault.executeProposal(listId);
        vm.expectRevert(BaskVault.ChangeCooldown.selector);
        vault.executeProposal(feedId);
        vm.warp(block.timestamp + 24 hours - 1);
        vm.expectRevert(BaskVault.ChangeCooldown.selector);
        vault.executeProposal(feedId);
        vm.warp(block.timestamp + 1);
        vault.executeProposal(feedId);
        assertEq(vault.feedAsset(address(feeds[0])), address(0));
        assertEq(vault.feedAsset(address(replacement)), address(stocks[0]));
    }

    function testFeedReplacementBandAndMetadataRechecked() public {
        MockFeed feed = new MockFeed();
        feed.set(401e8, block.timestamp);
        vm.prank(OWNER);
        vm.expectRevert(abi.encodeWithSelector(BaskVault.InvalidFeed.selector, address(feed)));
        vault.proposeFeed(address(stocks[0]), address(feed));
        feed.set(100e8, block.timestamp);
        vm.prank(OWNER);
        uint256 id = vault.proposeFeed(address(stocks[0]), address(feed));
        vm.warp(block.timestamp + 7 days);
        feed.setAggregator(address(0));
        vm.expectRevert(abi.encodeWithSelector(BaskVault.InvalidFeed.selector, address(feed)));
        vault.executeProposal(id);
        feed.setAggregator(address(1));
        feed.set(401e8, block.timestamp);
        vm.expectRevert(abi.encodeWithSelector(BaskVault.InvalidFeed.selector, address(feed)));
        vault.executeProposal(id);
        feed.set(25e8, block.timestamp);
        vault.executeProposal(id);
        BaskVault.AssetView[] memory all = vault.allAssets();
        assertEq(all[0].minAnswer, 25e8);
        assertEq(all[0].maxAnswer, 400e8);
    }

    function testBandUsesFreshExecutionAnswerOutsideOldBand() public {
        vm.prank(OWNER);
        uint256 id = vault.proposeBand(address(stocks[0]));
        vm.warp(block.timestamp + 7 days);
        feeds[0].set(1000e8, block.timestamp - 26 hours);
        vm.expectRevert(abi.encodeWithSelector(BaskVault.InvalidFeed.selector, address(feeds[0])));
        vault.executeProposal(id);
        feeds[0].set(1000e8, block.timestamp + 1);
        vm.expectRevert(abi.encodeWithSelector(BaskVault.InvalidFeed.selector, address(feeds[0])));
        vault.executeProposal(id);
        feeds[0].set(1000e8, block.timestamp - 26 hours + 1);
        vault.executeProposal(id);
        BaskVault.AssetView[] memory all = vault.allAssets();
        assertEq(all[0].minAnswer, 250e8);
        assertEq(all[0].maxAnswer, 4000e8);
    }

    function testLaterCloseCancelsEveryEarlierReopen() public {
        vm.startPrank(OWNER);
        vault.closeAsset(address(stocks[0]));
        uint256 first = vault.proposeReopen(address(stocks[0]));
        uint256 second = vault.proposeReopen(address(stocks[0]));
        vm.stopPrank();
        vm.prank(GUARDIAN);
        vault.closeAsset(address(stocks[0]));
        assertEq(uint256(vault.proposalState(first)), uint256(BaskVault.State.Cancelled));
        assertEq(uint256(vault.proposalState(second)), uint256(BaskVault.State.Cancelled));
        vm.warp(block.timestamp + 7 days);
        vm.expectRevert(abi.encodeWithSelector(BaskVault.InvalidProposal.selector, first));
        vault.executeProposal(first);
        vm.prank(OWNER);
        uint256 next = vault.proposeReopen(address(stocks[0]));
        vm.warp(block.timestamp + 7 days);
        vault.executeProposal(next);
        assertTrue(vault.allAssets()[0].open);
    }

    function testRetirementRequiresClosedAtBothTimesAndIsPermanent() public {
        vm.startPrank(OWNER);
        vm.expectRevert(BaskVault.InvalidState.selector);
        vault.proposeRetire(address(stocks[0]));
        vault.closeAsset(address(stocks[0]));
        uint256 retireId = vault.proposeRetire(address(stocks[0]));
        uint256 reopenId = vault.proposeReopen(address(stocks[0]));
        vm.stopPrank();
        vm.warp(block.timestamp + 7 days);
        vault.executeProposal(reopenId);
        vm.expectRevert(BaskVault.InvalidState.selector);
        vault.executeProposal(retireId);
        vm.prank(GUARDIAN);
        vault.closeAsset(address(stocks[0]));
        vault.executeProposal(retireId);
        vm.prank(OWNER);
        vm.expectRevert(BaskVault.InvalidState.selector);
        vault.proposeReopen(address(stocks[0]));
        assertTrue(vault.allAssets()[0].retired);
        assertFalse(vault.allAssets()[0].open);
        assertEq(vault.assetCount(), 3);
    }

    function testRetiredAssetSkippedByEveryDepositCheckButStillRedeemed() public {
        _deposit(0, 10e18);
        _deposit(1, 10e18);
        (MockStock stock, MockFeed feed) = _newPair();
        vm.startPrank(OWNER);
        uint256 listId = vault.proposeAsset(address(stock), address(feed));
        vault.closeAsset(address(stocks[0]));
        uint256 retireId = vault.proposeRetire(address(stocks[0]));
        vm.stopPrank();
        stocks[0].confiscate(address(vault), 1e18);
        vault.flagDeficit(address(stocks[0]));
        vm.warp(block.timestamp + 7 days);
        vault.executeProposal(listId);
        vault.executeProposal(retireId);
        _refresh();
        feeds[0].setBroken(true);
        stocks[0].setReadMode(MockStock.ReadMode.RevertCall);
        stocks[0].setPaused(true);
        BaskVault.DepositQuote memory q = vault.previewDeposit(address(stocks[1]), 1e18);
        assertEq(q.nav, 1000e18);
        _deposit(1, 1e18);
        (uint256 loss,) = vault.losses(address(stocks[0]));
        assertEq(loss, 1e18); // successful deposits only clear unretired records
        uint256[] memory legs = _redeem(100e18);
        assertGt(legs[0], 0);
        assertEq(vault.owed(ALICE, address(stocks[0])), legs[0]);
    }

    function testProbationCapAndThirtyDayBoundary() public {
        (MockStock stock, MockFeed feed) = _newPair();
        vm.prank(OWNER);
        uint256 id = vault.proposeAsset(address(stock), address(feed));
        vm.warp(block.timestamp + 7 days);
        vault.executeProposal(id);
        uint256 listedAt = block.timestamp;
        _refresh();
        vm.expectRevert(
            abi.encodeWithSelector(BaskVault.DepositUnavailable.selector, BaskVault.Reason.AssetCap, address(stock))
        );
        _deposit(3, 50e18 + 1);
        _deposit(3, 50e18);
        vm.warp(listedAt + 30 days - 1);
        assertTrue(vault.allAssets()[3].probation);
        vm.warp(listedAt + 30 days);
        assertFalse(vault.allAssets()[3].probation);
        vm.warp(listedAt + 32 days); // Monday
        _refresh();
        _deposit(3, 200e18);
        assertEq(vault.managed(address(stock)), 250e18);
    }

    function testLoweringNAVCapCancelsAllRaisesAndMaximumIsEnforced() public {
        vm.startPrank(OWNER);
        vm.expectRevert(BaskVault.InvalidCap.selector);
        vault.proposeNAVCap(10_000_000_000e18 + 1);
        uint256 first = vault.proposeNAVCap(2_000_000e18);
        uint256 second = vault.proposeNAVCap(3_000_000e18);
        vault.lowerNAVCap(999_999e18);
        assertEq(uint256(vault.proposalState(first)), uint256(BaskVault.State.Cancelled));
        assertEq(uint256(vault.proposalState(second)), uint256(BaskVault.State.Cancelled));
        uint256 third = vault.proposeNAVCap(10_000_000_000e18);
        vm.stopPrank();
        vm.warp(block.timestamp + 7 days);
        vault.executeProposal(third);
        assertEq(vault.NAV_CAP(), 10_000_000_000e18);
    }

    function testGuardianCanCancelExceptItsOwnReplacement() public {
        vm.startPrank(OWNER);
        uint256 cap = vault.proposeNAVCap(2_000_000e18);
        uint256 guardian = vault.proposeGuardian(BOB);
        vm.stopPrank();
        vm.startPrank(GUARDIAN);
        vault.cancelProposal(cap);
        vm.expectRevert(BaskVault.Unauthorized.selector);
        vault.cancelProposal(guardian);
        vm.stopPrank();
        vm.warp(block.timestamp + 7 days);
        vm.prank(ALICE);
        vault.executeProposal(guardian);
        assertEq(vault.guardian(), BOB);
        vm.prank(GUARDIAN);
        vm.expectRevert(BaskVault.Unauthorized.selector);
        vault.pauseDeposits();
        vm.prank(BOB);
        vault.pauseDeposits();
    }

    function testOwnerCanCancelGuardianReplacement() public {
        vm.startPrank(OWNER);
        uint256 id = vault.proposeGuardian(BOB);
        vault.cancelProposal(id);
        vm.stopPrank();
        assertEq(uint256(vault.proposalState(id)), uint256(BaskVault.State.Cancelled));
    }

    function testOwnershipTwoStepsNoRenounceAndGuardianCannotUnpause() public {
        vm.prank(GUARDIAN);
        vault.pauseDeposits();
        vm.prank(GUARDIAN);
        vm.expectRevert(BaskVault.Unauthorized.selector);
        vault.unpauseDeposits();
        vm.startPrank(OWNER);
        vm.expectRevert(BaskVault.InvalidAddress.selector);
        vault.transferOwnership(address(0));
        vault.transferOwnership(BOB);
        vm.stopPrank();
        assertEq(vault.owner(), OWNER);
        vm.prank(ALICE);
        vm.expectRevert(BaskVault.Unauthorized.selector);
        vault.acceptOwnership();
        vm.prank(BOB);
        vault.acceptOwnership();
        assertEq(vault.owner(), BOB);
        assertEq(vault.pendingOwner(), address(0));
        vm.prank(OWNER);
        vm.expectRevert(BaskVault.Unauthorized.selector);
        vault.unpauseDeposits();
        vm.prank(BOB);
        vault.unpauseDeposits();
    }

    function testPendingProposalPaginationExcludesCancelledAndExpired() public {
        vm.startPrank(OWNER);
        uint256 first = vault.proposeNAVCap(2_000_000e18);
        uint256 second = vault.proposeGuardian(BOB);
        uint256 third = vault.proposeBand(address(stocks[0]));
        vault.cancelProposal(second);
        vm.stopPrank();
        (uint256[] memory ids, BaskVault.Proposal[] memory pending) = vault.pendingProposals(0, 3);
        assertEq(ids.length, 2);
        assertEq(ids[0], first);
        assertEq(ids[1], third);
        assertEq(uint256(pending[0].kind), uint256(BaskVault.Kind.NAVCap));
        (ids,) = vault.pendingProposals(2, 1);
        assertEq(ids.length, 0);
        (ids,) = vault.pendingProposals(100, 1);
        assertEq(ids.length, 0);
        vm.warp(block.timestamp + 14 days);
        (ids,) = vault.pendingProposals(1, type(uint256).max);
        assertEq(ids.length, 0);
    }

    function testUnauthorizedAdministrativeCalls() public {
        bytes[] memory calls = new bytes[](16);
        calls[0] = abi.encodeCall(vault.proposeAsset, (BOB, BOB));
        calls[1] = abi.encodeCall(vault.proposeAssets, (new address[](0), new address[](0)));
        calls[2] = abi.encodeCall(vault.proposeFeed, (address(stocks[0]), BOB));
        calls[3] = abi.encodeCall(vault.proposeBand, (address(stocks[0])));
        calls[4] = abi.encodeCall(vault.proposeReopen, (address(stocks[0])));
        calls[5] = abi.encodeCall(vault.proposeRetire, (address(stocks[0])));
        calls[6] = abi.encodeCall(vault.proposeGuardian, (BOB));
        calls[7] = abi.encodeCall(vault.proposeNAVCap, (2_000_000e18));
        calls[8] = abi.encodeCall(vault.lowerNAVCap, (0));
        calls[9] = abi.encodeCall(vault.setFeeRecipient, (BOB));
        calls[10] = abi.encodeCall(vault.transferOwnership, (BOB));
        calls[11] = abi.encodeCall(vault.finalizeGenesis, ());
        calls[12] = abi.encodeCall(vault.pauseDeposits, ());
        calls[13] = abi.encodeCall(vault.unpauseDeposits, ());
        calls[14] = abi.encodeCall(vault.closeAsset, (address(stocks[0])));
        calls[15] = abi.encodeCall(vault.cancelProposal, (1));
        for (uint256 i; i < calls.length; ++i) {
            vm.prank(ALICE);
            (bool ok, bytes memory result) = address(vault).call(calls[i]);
            assertFalse(ok);
            assertEq(result, abi.encodeWithSelector(BaskVault.Unauthorized.selector));
        }
    }
}

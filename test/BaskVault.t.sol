// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {BaskVault} from "../src/BaskVault.sol";
import {MockFactory, MockFeed, MockStock, RejectCalls} from "./mocks/Mocks.sol";

abstract contract BaskTestBase is Test {
    address internal constant OWNER = 0x30B57ECf51D19ABcED7F6f70974e6fBb6f3b9Da3;
    address internal constant GUARDIAN = 0x5ed39AF86f2C00ad99913B5d727bD68f2A904B68;
    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    uint256 internal constant MONDAY = 1_728_259_200; // 2024-10-07 00:00 UTC
    BaskVault internal vault;
    MockFactory internal factory;
    MockStock[] internal stocks;
    MockFeed[] internal feeds;

    function setUp() public virtual {
        _setup(3);
    }

    function _setup(uint256 count) internal {
        vm.chainId(4663);
        vm.warp(MONDAY + 55800);
        vault = new BaskVault(OWNER, GUARDIAN);
        MockFactory template = new MockFactory();
        vm.etch(vault.STOCK_FACTORY(), address(template).code);
        factory = MockFactory(vault.STOCK_FACTORY());
        _addGenesis(count);
        vm.prank(OWNER);
        vault.finalizeGenesis();
        vm.warp(block.timestamp + 72 hours);
        _refresh();
    }

    function _newPair() internal returns (MockStock stock, MockFeed feed) {
        stock = new MockStock(bytes32(stocks.length + 1));
        feed = new MockFeed();
        factory.register(stock.uid(), address(stock));
        stocks.push(stock);
        feeds.push(feed);
        stock.mint(ALICE, 1_000_000e18);
        vm.prank(ALICE);
        stock.approve(address(vault), type(uint256).max);
    }

    function _addGenesis(uint256 count) internal {
        for (uint256 i; i < count; ++i) {
            (MockStock stock, MockFeed feed) = _newPair();
            vm.prank(OWNER);
            vault.proposeAsset(address(stock), address(feed));
        }
    }

    function _refresh() internal {
        for (uint256 i; i < feeds.length; ++i) {
            feeds[i].set(100e8, block.timestamp);
        }
    }

    function _deposit(uint256 i, uint256 amount) internal returns (uint256) {
        vm.prank(ALICE);
        return vault.deposit(address(stocks[i]), amount, ALICE, 0, block.timestamp);
    }

    function _redeem(uint256 shares) internal returns (uint256[] memory) {
        vm.prank(ALICE);
        return vault.redeem(shares, new uint256[](0), block.timestamp);
    }

    function _status(BaskVault.Reason reason, address fault) internal {
        (BaskVault.Reason actual, address asset) = vault.depositStatus(address(stocks[0]));
        assertEq(uint256(actual), uint256(reason));
        assertEq(asset, fault);
        if (reason != BaskVault.Reason.OK) {
            vm.expectRevert(abi.encodeWithSelector(BaskVault.DepositUnavailable.selector, reason, fault));
            _deposit(0, 1e18);
        }
    }
}

contract BaskVaultTest is BaskTestBase {
    function testDeploymentAndConstructorValidation() public {
        BaskVault fresh = new BaskVault(OWNER, GUARDIAN);
        assertEq(fresh.name(), "Basket");
        assertEq(fresh.symbol(), "BASK");
        assertEq(fresh.decimals(), 18);
        assertEq(fresh.totalSupply(), 0);
        assertEq(fresh.assetCount(), 0);
        assertEq(fresh.owner(), OWNER);
        assertEq(fresh.guardian(), GUARDIAN);
        assertLe(address(fresh).code.length, 24_000);
        vm.expectRevert(BaskVault.InvalidAddress.selector);
        new BaskVault(address(0), GUARDIAN);
        vm.expectRevert(BaskVault.InvalidAddress.selector);
        new BaskVault(OWNER, address(0));
        vm.expectRevert(BaskVault.InvalidAddress.selector);
        new BaskVault(OWNER, OWNER);
    }

    function testFirstDepositAndUnsetFee() public {
        BaskVault.DepositQuote memory q = vault.previewDeposit(address(stocks[0]), 10e18);
        assertEq(q.gross, 1000e18);
        assertEq(q.fee, 5e18);
        assertEq(q.lockedShares, 1e15);
        uint256 shares = _deposit(0, 10e18);
        assertEq(shares, 995e18 - 1e15);
        assertEq(vault.totalSupply(), 995e18);
        assertEq(vault.balanceOf(address(0xdEaD)), 1e15);
        assertEq(vault.managed(address(stocks[0])), 10e18);
        assertEq(vault.bucket(), 1000e18);
    }

    function testFeeRecipientIsFinalAndNeverCalled() public {
        RejectCalls recipient = new RejectCalls();
        vm.prank(OWNER);
        vault.setFeeRecipient(address(recipient));
        _deposit(0, 10e18);
        assertEq(vault.totalSupply(), 1000e18);
        assertEq(vault.balanceOf(address(recipient)), 5e18);
        uint256 supply = vault.totalSupply();
        uint256 shares = 101e18 + 1;
        uint256 fee = shares / 200 + 1;
        _redeem(shares);
        assertEq(vault.totalSupply(), supply - shares + fee);
        assertEq(vault.balanceOf(address(recipient)), 5e18 + fee);
        vm.prank(OWNER);
        vm.expectRevert(BaskVault.InvalidState.selector);
        vault.setFeeRecipient(BOB);
    }

    function testDonationsAreExcludedAndShareMathUsesManagedNAV() public {
        _deposit(0, 10e18);
        stocks[0].mint(address(vault), 1000e18);
        BaskVault.DepositQuote memory q = vault.previewDeposit(address(stocks[1]), 10e18);
        assertEq(q.nav, 1000e18);
        assertEq(q.gross, 995e18);
        _deposit(1, 10e18);
        (,, uint256[] memory amounts) = vault.previewRedeem(vault.balanceOf(ALICE));
        assertLe(amounts[0], 10e18);
        assertLe(amounts[1], 10e18);
    }

    function testDepositSlippageDeadlineReceiverAndExactTransfer() public {
        vm.startPrank(ALICE);
        vm.expectRevert(BaskVault.Expired.selector);
        vault.deposit(address(stocks[0]), 1e18, ALICE, 0, block.timestamp - 1);
        vm.expectRevert(BaskVault.InvalidAddress.selector);
        vault.deposit(address(stocks[0]), 1e18, address(vault), 0, block.timestamp);
        vm.expectRevert(BaskVault.InvalidAddress.selector);
        vault.deposit(address(stocks[0]), 1e18, address(0), 0, block.timestamp);
        vm.expectRevert(BaskVault.Slippage.selector);
        vault.deposit(address(stocks[0]), 1e18, ALICE, 100e18, block.timestamp);
        vm.stopPrank();
        stocks[0].setIncomingFee(1);
        vm.expectRevert(abi.encodeWithSelector(BaskVault.TransferFailed.selector, address(stocks[0])));
        _deposit(0, 1e18);
        assertEq(vault.totalSupply(), 0);
        stocks[0].setIncomingFee(0);
        stocks[0].setMode(MockStock.Mode.FalseReturn);
        vm.expectRevert(abi.encodeWithSelector(BaskVault.TransferFailed.selector, address(stocks[0])));
        _deposit(0, 1e18);
        stocks[0].setMode(MockStock.Mode.NoReturn);
        assertGt(_deposit(0, 1e18), 0);
    }

    function testMarketGateBoundaries() public {
        uint256 dayStart = block.timestamp / 86400 * 86400;
        vm.warp(dayStart + 55799);
        _status(BaskVault.Reason.OpeningDelay, address(0));
        vm.warp(dayStart + 55800);
        _status(BaskVault.Reason.OK, address(0));
        vm.warp(dayStart + 70199);
        _status(BaskVault.Reason.OK, address(0));
        vm.warp(dayStart + 70200);
        _status(BaskVault.Reason.MarketClosed, address(0));
        vm.warp(MONDAY + 5 days + 55800);
        _status(BaskVault.Reason.MarketClosed, address(0));
        vm.warp(MONDAY + 6 days + 55800);
        _status(BaskVault.Reason.MarketClosed, address(0));
        vm.warp(MONDAY + 7 days + 55799);
        _status(BaskVault.Reason.MarketClosed, address(0));
    }

    function testFreshnessAndEveryHeldAssetPrice() public {
        _deposit(1, 1e18);
        feeds[1].set(100e8, block.timestamp - 4 hours);
        _status(BaskVault.Reason.OK, address(0));
        feeds[1].set(100e8, block.timestamp - 4 hours - 1);
        _status(BaskVault.Reason.MarketNotFresh, address(0));
        feeds[1].set(100e8, block.timestamp - 26 hours - 1);
        _status(BaskVault.Reason.StalePrice, address(stocks[1]));
        feeds[1].set(100e8, block.timestamp + 1);
        _status(BaskVault.Reason.FuturePrice, address(stocks[1]));
        feeds[1].set(0, block.timestamp);
        _status(BaskVault.Reason.NonpositivePrice, address(stocks[1]));
        feeds[1].set(-1, block.timestamp);
        _status(BaskVault.Reason.NonpositivePrice, address(stocks[1]));
        feeds[1].set(24e8, block.timestamp);
        _status(BaskVault.Reason.OutsideBand, address(stocks[1]));
        feeds[1].set(401e8, block.timestamp);
        _status(BaskVault.Reason.OutsideBand, address(stocks[1]));
        feeds[1].set(400e8, block.timestamp);
        _status(BaskVault.Reason.OK, address(0));
        feeds[1].setBroken(true);
        _status(BaskVault.Reason.FeedUnreadable, address(stocks[1]));
        feeds[1].setBroken(false);
        stocks[1].setPaused(true);
        _status(BaskVault.Reason.OraclePaused, address(stocks[1]));
    }

    function testUnreadableUnheldAssetBlocksDeposits() public {
        stocks[2].setReadMode(MockStock.ReadMode.ShortReturn);
        _status(BaskVault.Reason.BalanceUnreadable, address(stocks[2]));
    }

    function testNAVCapAssetCapAndGlobalBucket() public {
        vm.expectRevert(
            abi.encodeWithSelector(BaskVault.DepositUnavailable.selector, BaskVault.Reason.AssetCap, address(stocks[0]))
        );
        _deposit(0, 250e18 + 1);
        _deposit(0, 250e18);
        vm.prank(OWNER);
        vault.lowerNAVCap(25_000e18);
        vm.expectRevert(
            abi.encodeWithSelector(BaskVault.DepositUnavailable.selector, BaskVault.Reason.NAVCap, address(stocks[1]))
        );
        _deposit(1, 1);
    }

    function testBucketDecayIsLinearAndFloorsAtZero() public {
        _deposit(0, 100e18);
        vm.warp(block.timestamp + 1 hours);
        assertEq(vault.decayedBucket(), 10_000e18 - uint256(10_000e18) / 24);
        _refresh();
        _deposit(1, 100e18);
        assertEq(vault.bucket(), 20_000e18 - uint256(10_000e18) / 24);
        vm.warp(block.timestamp + 24 hours);
        assertEq(vault.decayedBucket(), 0);
    }

    function testRedeemReadsNoFeedAndIgnoresAllAdministrativeGates() public {
        _deposit(0, 10e18);
        _deposit(1, 10e18);
        vm.startPrank(GUARDIAN);
        vault.pauseDeposits();
        vault.closeAsset(address(stocks[0]));
        vault.closeAsset(address(stocks[1]));
        vm.stopPrank();
        vm.prank(OWNER);
        vault.lowerNAVCap(0);
        for (uint256 i; i < feeds.length; ++i) {
            feeds[i].setBroken(true);
            stocks[i].setPaused(true);
        }
        vm.warp(MONDAY + 6 days);
        uint256 shares = vault.balanceOf(ALICE);
        uint256 supply = vault.totalSupply();
        uint256 expected = 10e18 * (shares - (shares + 199) / 200) / supply;
        uint256[] memory amounts = _redeem(shares);
        assertEq(amounts[0], expected);
        assertEq(amounts[1], expected);
        assertEq(vault.totalSupply(), 1e15);
        assertEq(vault.totalOwed(address(stocks[0])), 0);
    }

    function testRedeemMinimumsAndDeadlineAreUserControls() public {
        _deposit(0, 10e18);
        uint256[] memory mins = new uint256[](1);
        mins[0] = 11e18;
        vm.startPrank(ALICE);
        vm.expectRevert(BaskVault.Slippage.selector);
        vault.redeem(100e18, mins, block.timestamp);
        vm.expectRevert(BaskVault.Expired.selector);
        vault.redeem(100e18, new uint256[](0), block.timestamp - 1);
        vm.stopPrank();
        assertEq(vault.managed(address(stocks[0])), 10e18);
    }

    function testBlockedRecipientDebtAndAlternateClaim() public {
        _deposit(0, 10e18);
        _deposit(1, 10e18);
        stocks[0].blockAddress(ALICE, true);
        uint256[] memory legs = _redeem(500e18);
        assertEq(vault.owed(ALICE, address(stocks[0])), legs[0]);
        assertEq(vault.totalOwed(address(stocks[0])), legs[0]);
        assertEq(vault.totalOwed(address(stocks[1])), 0);
        vm.prank(GUARDIAN);
        vault.pauseDeposits();
        vm.prank(ALICE);
        vault.claim(address(stocks[0]), BOB);
        assertEq(stocks[0].balanceOf(BOB), legs[0]);
        assertEq(vault.totalOwed(address(stocks[0])), 0);
    }

    function testClaimFailurePreservesDebtAndPartialClaimUsesWholeBalance() public {
        _deposit(0, 10e18);
        stocks[0].setMode(MockStock.Mode.RevertCall);
        _redeem(500e18);
        uint256 debt = vault.owed(ALICE, address(stocks[0]));
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(BaskVault.TransferFailed.selector, address(stocks[0])));
        vault.claim(address(stocks[0]), ALICE);
        assertEq(vault.owed(ALICE, address(stocks[0])), debt);
        stocks[0].confiscate(address(vault), 10e18 - 1e18);
        stocks[0].setMode(MockStock.Mode.Normal);
        vm.prank(ALICE);
        assertEq(vault.claim(address(stocks[0]), BOB), 1e18);
        assertEq(vault.owed(ALICE, address(stocks[0])), debt - 1e18);
        assertEq(vault.totalOwed(address(stocks[0])), debt - 1e18);
    }

    function testPaymentFailureRollsBackMaliciousTransferEffects() public {
        _deposit(0, 10e18);
        uint256 aliceBalance = stocks[0].balanceOf(ALICE);
        stocks[0].setMode(MockStock.Mode.ExtraDebit);
        uint256[] memory legs = _redeem(100e18);
        assertEq(stocks[0].balanceOf(address(vault)), 10e18);
        assertEq(stocks[0].balanceOf(ALICE), aliceBalance);
        assertEq(vault.owed(ALICE, address(stocks[0])), legs[0]);
    }

    function testUnreadableBalanceUsesManagedAndCreatesDebt() public {
        _deposit(0, 10e18);
        stocks[0].setReadMode(MockStock.ReadMode.LargeReturn);
        uint256[] memory legs = _redeem(100e18);
        assertGt(legs[0], 0);
        assertEq(vault.owed(ALICE, address(stocks[0])), legs[0]);
        stocks[0].setReadMode(MockStock.ReadMode.Normal);
        stocks[0].setMode(MockStock.Mode.NoReturn);
        vm.prank(ALICE);
        vault.claim(address(stocks[0]), ALICE);
        assertEq(vault.totalOwed(address(stocks[0])), 0);
    }

    function testExpensiveTokenCanClaimWithoutPaymentGasLimit() public {
        _deposit(0, 10e18);
        stocks[0].setMode(MockStock.Mode.Expensive);
        uint256[] memory legs = _redeem(100e18);
        assertEq(vault.owed(ALICE, address(stocks[0])), legs[0]);
        stocks[0].setReadMode(MockStock.ReadMode.Expensive);
        vm.prank(ALICE);
        assertEq(vault.claim(address(stocks[0]), BOB), legs[0]);
        assertEq(vault.totalOwed(address(stocks[0])), 0);
    }

    function testDeficitsNeedSevenDaysAndNeverReduceManagedAutomatically() public {
        _deposit(0, 10e18);
        stocks[0].confiscate(address(vault), 4e18);
        _status(BaskVault.Reason.Deficit, address(stocks[0]));
        assertEq(vault.managed(address(stocks[0])), 10e18);
        vault.flagDeficit(address(stocks[0]));
        (uint256 recorded, uint256 time) = vault.losses(address(stocks[0]));
        assertEq(recorded, 4e18);
        vm.warp(time + 7 days - 1);
        vm.expectRevert(BaskVault.LossNotReady.selector);
        vault.recognizeLoss(address(stocks[0]));
        stocks[0].mint(address(vault), 1e18);
        vm.warp(time + 7 days);
        vault.recognizeLoss(address(stocks[0]));
        assertEq(vault.managed(address(stocks[0])), 7e18);
        (recorded,) = vault.losses(address(stocks[0]));
        assertEq(recorded, 0);
    }

    function testLargerDeficitResetsClockButSameDeficitCannot() public {
        _deposit(0, 10e18);
        stocks[0].confiscate(address(vault), 1e18);
        vault.flagDeficit(address(stocks[0]));
        vm.warp(block.timestamp + 6 days);
        vm.expectRevert(BaskVault.InvalidState.selector);
        vault.flagDeficit(address(stocks[0]));
        stocks[0].confiscate(address(vault), 1e18);
        vault.flagDeficit(address(stocks[0]));
        (uint256 recorded, uint256 time) = vault.losses(address(stocks[0]));
        assertEq(recorded, 2e18);
        assertEq(time, block.timestamp);
        vm.warp(block.timestamp + 1 days);
        vm.expectRevert(BaskVault.LossNotReady.selector);
        vault.recognizeLoss(address(stocks[0]));
    }

    function testRecoveredDeficitClearedByDeposit() public {
        _deposit(0, 10e18);
        stocks[0].confiscate(address(vault), 1e18);
        vault.flagDeficit(address(stocks[0]));
        stocks[0].mint(address(vault), 1e18);
        _deposit(1, 1e18);
        (uint256 recorded, uint256 time) = vault.losses(address(stocks[0]));
        assertEq(recorded, 0);
        assertEq(time, 0);
    }

    function testShortRedemptionUsesAvailableLessExistingDebt() public {
        _deposit(0, 10e18);
        stocks[0].setMode(MockStock.Mode.RevertCall);
        _redeem(100e18);
        uint256 debt = vault.totalOwed(address(stocks[0]));
        stocks[0].confiscate(address(vault), 5e18);
        uint256 supply = vault.totalSupply();
        uint256[] memory legs = _redeem(100e18);
        assertEq(legs[0], (5e18 - debt) * 99.5e18 / supply);
    }

    function testReentrancyFromDepositAndRedeemAndClaim() public {
        stocks[0].setMode(MockStock.Mode.Reenter);
        stocks[0].setCallback(address(vault), abi.encodeCall(vault.approve, (BOB, 1)));
        _deposit(0, 10e18);
        assertFalse(stocks[0].callbackSucceeded());
        stocks[0].setCallback(address(vault), abi.encodeCall(vault.redeem, (0, new uint256[](0), block.timestamp)));
        _redeem(100e18);
        assertFalse(stocks[0].callbackSucceeded());
        stocks[0].setMode(MockStock.Mode.RevertCall);
        _redeem(100e18);
        stocks[0].setMode(MockStock.Mode.Reenter);
        stocks[0].setCallback(address(vault), abi.encodeCall(vault.claim, (address(stocks[0]), BOB)));
        vm.prank(ALICE);
        vault.claim(address(stocks[0]), ALICE);
        assertFalse(stocks[0].callbackSucceeded());
        vm.expectRevert(BaskVault.Unauthorized.selector);
        vault.payLeg(address(stocks[0]), BOB, 1e18);
    }

    function testERC20TransfersAllowancesAndNoRoleSeizure() public {
        _deposit(0, 10e18);
        vm.prank(ALICE);
        vault.approve(BOB, 10e18);
        vm.prank(BOB);
        vault.transferFrom(ALICE, BOB, 10e18);
        assertEq(vault.balanceOf(BOB), 10e18);
        assertEq(vault.allowance(ALICE, BOB), 0);
        vm.prank(OWNER);
        vm.expectRevert(BaskVault.InsufficientAllowance.selector);
        vault.transferFrom(ALICE, OWNER, 1);
        vm.prank(BOB);
        vault.transfer(ALICE, 10e18);
    }

    function testFuzzDepositRedeemConservation(uint96 rawAmount, uint16 rawSharePart) public {
        uint256 amount = bound(uint256(rawAmount), 1e18, 250e18);
        uint256 shares = _deposit(0, amount);
        uint256 redeemShares = shares * bound(uint256(rawSharePart), 1, 10_000) / 10_000;
        _redeem(redeemShares);
        assertEq(stocks[0].balanceOf(address(vault)), vault.managed(address(stocks[0])));
        assertEq(vault.totalSupply(), vault.balanceOf(ALICE) + vault.balanceOf(address(0xdEaD)));
        assertEq(stocks[0].balanceOf(ALICE) + stocks[0].balanceOf(address(vault)), 1_000_000e18);
    }
}

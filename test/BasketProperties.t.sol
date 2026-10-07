// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {BaskVault} from "src/BaskVault.sol";
import {BaskMath} from "src/BaskMath.sol";
import {BaskTestBase} from "./BaskVault.t.sol";
import {MockStock, MockFeed, RejectCalls} from "./mocks/Mocks.sol";

contract BasketPropertiesTest is BaskTestBase {
    /// forge-config: default.fuzz.runs = 1000
    function testFuzzFirstDepositRoundingAndDistinctReceiver(uint256 rawAmount, uint256 rawPrice, bool feesEnabled)
        public
    {
        uint256 amount = bound(rawAmount, 1e14, 50e18);
        uint256 price = bound(rawPrice, 25e8, 400e8);
        feeds[0].set(int256(price), block.timestamp);
        address recipient = address(new RejectCalls());
        if (feesEnabled) {
            vm.prank(OWNER);
            vault.setFeeRecipient(recipient);
        }
        BaskVault.DepositQuote memory q = vault.previewDeposit(address(stocks[0]), amount);
        // Characterize floors and ceilings by inequalities, without calling BaskMath again.
        assertLe(q.value * 1e8, amount * price);
        assertLt(amount * price - q.value * 1e8, 1e8);
        assertEq(q.gross, q.value);
        assertGe(q.fee * 200, q.gross);
        assertLt((q.fee - 1) * 200, q.gross);
        uint256 beforeBalance = stocks[0].balanceOf(ALICE);
        vm.prank(ALICE);
        uint256 actual = vault.deposit(address(stocks[0]), amount, BOB, q.receiverShares, block.timestamp);
        assertEq(actual, q.receiverShares);
        assertEq(vault.balanceOf(ALICE), 0, "payer was credited instead of receiver");
        assertEq(vault.balanceOf(BOB), actual);
        assertEq(actual + vault.balanceOf(address(0xdEaD)) + q.fee, q.gross);
        assertEq(vault.balanceOf(recipient), feesEnabled ? q.fee : 0);
        assertEq(vault.totalSupply(), q.gross - (feesEnabled ? 0 : q.fee));
        assertEq(stocks[0].balanceOf(ALICE) + amount, beforeBalance);
    }

    /// forge-config: default.fuzz.runs = 1000
    function testFuzzDonationCannotChangeNAVQuotesOrManaged(uint256 rawDonation) public {
        _deposit(0, 1e18);
        BaskVault.DepositQuote memory beforeQuote = vault.previewDeposit(address(stocks[1]), 1e18);
        uint256 donation = bound(rawDonation, 0, type(uint128).max);
        stocks[0].mint(address(vault), donation);
        stocks[1].mint(address(vault), donation);
        BaskVault.DepositQuote memory afterQuote = vault.previewDeposit(address(stocks[1]), 1e18);
        assertEq(abi.encode(beforeQuote), abi.encode(afterQuote));
        assertEq(vault.managed(address(stocks[0])), 1e18);
        assertEq(vault.managed(address(stocks[1])), 0);
        assertEq(_deposit(1, 1e18), beforeQuote.receiverShares);
    }

    /// forge-config: default.fuzz.runs = 1000
    function testFuzzRepeatedRoundTripsCannotCreateValue(uint256 rawAmount, bool feesEnabled) public {
        if (feesEnabled) {
            vm.prank(OWNER);
            vault.setFeeRecipient(address(0xFEE));
        }
        for (uint256 i; i < 3; ++i) {
            _deposit(i, 10e18);
            stocks[i].mint(BOB, 100e18);
            vm.prank(BOB);
            stocks[i].approve(address(vault), type(uint256).max);
        }
        uint256 amount = bound(rawAmount, 1e13, 1e18);
        // All three Stock Tokens have a fixed $100 price. Sum whole-token units to
        // measure value across the basket, including legs received in other tokens.
        uint256 previous = 300e18;
        for (uint256 cycle; cycle < 16; ++cycle) {
            vm.startPrank(BOB);
            uint256 shares = vault.deposit(address(stocks[cycle % 3]), amount, BOB, 0, block.timestamp);
            vault.redeem(shares, new uint256[](0), block.timestamp);
            vm.stopPrank();
            uint256 current;
            for (uint256 i; i < 3; ++i) {
                current += stocks[i].balanceOf(BOB);
            }
            assertLe(current, previous, "a repeated rounding cycle extracted value");
            assertEq(vault.balanceOf(BOB), 0, "round trip did not fully exit");
            previous = current;
        }
    }

    /// forge-config: default.fuzz.runs = 1000
    function testFuzzFeeCeilingAtFullUint256Range(uint256 amount) public pure {
        uint256 fee = BaskMath.fee(amount);
        assertLe(fee, amount);
        if (amount == 0) {
            assertEq(fee, 0);
            return;
        }
        assertGt(fee, 0);
        // Require 200 * fee >= amount and 200 * (fee - 1) < amount.
        // Move one fee term to the other side to avoid overflow at uint256.max.
        assertLe(amount - fee, fee * 199);
        assertGt(amount - (fee - 1), (fee - 1) * 199);
    }

    function testLateRedeemSlippageRollsBackEarlierPaymentsDebtsAndFees() public {
        vm.prank(OWNER);
        vault.setFeeRecipient(BOB);
        for (uint256 i; i < 3; ++i) {
            _deposit(i, 10e18);
        }
        stocks[1].setMode(MockStock.Mode.RevertCall);
        uint256 supply = vault.totalSupply();
        uint256 holder = vault.balanceOf(ALICE);
        uint256 feeBalance = vault.balanceOf(BOB);
        uint256[3] memory balances;
        for (uint256 i; i < 3; ++i) {
            balances[i] = stocks[i].balanceOf(ALICE);
        }
        (,, uint256[] memory minimums) = vault.previewRedeem(100e18);
        minimums[2] += 1; // leg zero pays, leg one queues debt, then leg two fails
        vm.expectRevert(BaskVault.Slippage.selector);
        vm.prank(ALICE);
        vault.redeem(100e18, minimums, block.timestamp);
        assertEq(vault.totalSupply(), supply);
        assertEq(vault.balanceOf(ALICE), holder);
        assertEq(vault.balanceOf(BOB), feeBalance);
        for (uint256 i; i < 3; ++i) {
            assertEq(stocks[i].balanceOf(ALICE), balances[i]);
            assertEq(stocks[i].balanceOf(address(vault)), 10e18);
            assertEq(vault.managed(address(stocks[i])), 10e18);
            assertEq(vault.owed(ALICE, address(stocks[i])), 0);
            assertEq(vault.totalOwed(address(stocks[i])), 0);
        }
        // A reverted self-call must also leave the guard usable.
        assertGt(_redeem(100e18)[0], 0);
    }

    function testRejectedDepositRollsBackPullAllowanceBucketAndShares() public {
        _deposit(1, 1e18);
        uint256 supply = vault.totalSupply();
        uint256 bucket = vault.bucket();
        uint256 userBalance = stocks[0].balanceOf(ALICE);
        uint256 allowed = stocks[0].allowance(ALICE, address(vault));
        stocks[0].setIncomingFee(1);
        vm.expectRevert(abi.encodeWithSelector(BaskVault.TransferFailed.selector, address(stocks[0])));
        _deposit(0, 1e18);
        assertEq(stocks[0].balanceOf(ALICE), userBalance);
        assertEq(stocks[0].balanceOf(address(vault)), 0);
        assertEq(stocks[0].allowance(ALICE, address(vault)), allowed);
        assertEq(vault.managed(address(stocks[0])), 0);
        assertEq(vault.totalSupply(), supply);
        assertEq(vault.bucket(), bucket);
    }

    function testClaimIsCallerSpecificAndCannotBeRepeated() public {
        _deposit(0, 10e18);
        stocks[0].setMode(MockStock.Mode.RevertCall);
        uint256 leg = _redeem(100e18)[0];
        stocks[0].setMode(MockStock.Mode.Normal);
        vm.prank(BOB);
        assertEq(vault.claim(address(stocks[0]), BOB), 0);
        assertEq(vault.owed(ALICE, address(stocks[0])), leg);
        vm.prank(ALICE);
        assertEq(vault.claim(address(stocks[0]), BOB), leg);
        vm.prank(ALICE);
        assertEq(vault.claim(address(stocks[0]), BOB), 0);
        assertEq(stocks[0].balanceOf(BOB), leg);
        assertEq(vault.totalOwed(address(stocks[0])), 0);
    }

    function testZeroAndOneWeiRedeemsDoNotPayFreeTokens() public {
        _deposit(0, 1e18);
        uint256 managed = vault.managed(address(stocks[0]));
        uint256 supply = vault.totalSupply();
        assertEq(_redeem(0)[0], 0);
        assertEq(vault.totalSupply(), supply);
        assertEq(_redeem(1)[0], 0); // the one-wei fee consumes the whole input
        assertEq(vault.totalSupply(), supply - 1);
        assertEq(vault.managed(address(stocks[0])), managed);
    }

    function testInfiniteAllowanceSelfTransfersAndFailedTransferAtomicity() public {
        uint256 shares = _deposit(0, 1e18);
        vm.startPrank(ALICE);
        vault.transfer(ALICE, shares);
        vault.approve(BOB, type(uint256).max);
        vm.stopPrank();
        vm.startPrank(BOB);
        vault.transferFrom(ALICE, ALICE, shares);
        vm.expectRevert(BaskVault.InsufficientShares.selector);
        vault.transferFrom(ALICE, BOB, shares + 1);
        assertEq(vault.allowance(ALICE, BOB), type(uint256).max);
        vm.expectRevert(BaskVault.InvalidAddress.selector);
        vault.transferFrom(ALICE, address(0), shares);
        vault.transferFrom(ALICE, BOB, shares);
        vm.stopPrank();
        assertEq(vault.balanceOf(ALICE), 0);
        assertEq(vault.balanceOf(BOB), shares);
        assertEq(vault.allowance(ALICE, BOB), type(uint256).max);
    }

    function testPaymentAndDebtEventsIdentifyActualBeneficiary() public {
        vm.expectEmit(true, true, true, true, address(vault));
        emit BaskVault.Deposit(ALICE, ALICE, address(stocks[0]), 1e18, 99.5e18 - 1e15, 0.5e18);
        _deposit(0, 1e18);
        (,, uint256[] memory legs) = vault.previewRedeem(10e18);
        stocks[0].setMode(MockStock.Mode.RevertCall);
        vm.expectEmit(true, true, false, true, address(vault));
        emit BaskVault.LegOwed(ALICE, address(stocks[0]), legs[0]);
        _redeem(10e18);
        stocks[0].setMode(MockStock.Mode.Normal);
        vm.expectEmit(true, true, false, true, address(vault));
        emit BaskVault.LegPaid(address(stocks[0]), BOB, legs[0]);
        vm.expectEmit(true, true, true, true, address(vault));
        emit BaskVault.Claimed(ALICE, address(stocks[0]), BOB, legs[0]);
        vm.prank(ALICE);
        vault.claim(address(stocks[0]), BOB);
    }
}

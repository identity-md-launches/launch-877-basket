// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {BaskTestBase} from "./BaskVault.t.sol";
import {BaskVault} from "../src/BaskVault.sol";
import {BaskMath} from "../src/BaskMath.sol";
import {MockStock, MockFeed} from "./mocks/Mocks.sol";

contract MathHarness {
    function mulDiv(uint256 x, uint256 y, uint256 d) external pure returns (uint256) {
        return BaskMath.mulDiv(x, y, d);
    }
}

contract AccountingEdgesTest is BaskTestBase {
    function testFeeRoundsUpOnBothPathsAndTinyDepositsCannotMint() public {
        uint256 amount = 1e18 + 1;
        BaskVault.DepositQuote memory quote = vault.previewDeposit(address(stocks[0]), amount);
        assertEq(quote.gross, 100e18 + 100);
        assertEq(quote.fee, 0.5e18 + 1);
        _deposit(0, amount);
        uint256 supply = vault.totalSupply();
        uint256 managed = vault.managed(address(stocks[0]));
        (uint256 fee, uint256 net, uint256[] memory legs) = vault.previewRedeem(201);
        assertEq(fee, 2);
        assertEq(net, 199);
        assertEq(legs[0], managed * 199 / supply);
        _redeem(201);
        assertEq(vault.totalSupply(), supply - 201);
    }

    function testFirstDepositMustCoverLockedSharesAndReceiverGetsPositiveAmount() public {
        vm.expectRevert(BaskVault.InsufficientShares.selector);
        _deposit(0, 0);
        vm.expectRevert(BaskVault.InsufficientShares.selector);
        _deposit(0, 1);
        vm.expectRevert(BaskVault.InsufficientShares.selector);
        _deposit(0, 1e13);
        assertGt(_deposit(0, 2e13), 0);
    }

    function testFeeRecipientCanRedeemItsOwnShares() public {
        vm.prank(OWNER);
        vault.setFeeRecipient(ALICE);
        _deposit(0, 10e18);
        uint256 shares = vault.balanceOf(ALICE);
        uint256 fee = (shares + 199) / 200;
        _redeem(shares);
        assertEq(vault.balanceOf(ALICE), fee);
        assertEq(vault.totalSupply(), fee + 1e15);
    }

    function testTwoClaimantsReserveDebtBeforeLaterRedemption() public {
        _deposit(0, 10e18);
        vm.prank(ALICE);
        vault.transfer(BOB, 400e18);
        stocks[0].setMode(MockStock.Mode.RevertCall);
        uint256[] memory first = _redeem(200e18);
        vm.prank(BOB);
        uint256[] memory second = vault.redeem(200e18, new uint256[](0), block.timestamp);
        assertEq(vault.totalOwed(address(stocks[0])), first[0] + second[0]);
        assertEq(vault.managed(address(stocks[0])) + vault.totalOwed(address(stocks[0])), 10e18);
        stocks[0].setMode(MockStock.Mode.Normal);
        _redeem(100e18);
        assertEq(
            vault.managed(address(stocks[0])) + vault.totalOwed(address(stocks[0])), stocks[0].balanceOf(address(vault))
        );
        vm.prank(BOB);
        assertEq(vault.claim(address(stocks[0]), BOB), second[0]);
        assertEq(vault.owed(ALICE, address(stocks[0])), first[0]);
        vm.prank(ALICE);
        vault.claim(address(stocks[0]), ALICE);
        assertEq(vault.managed(address(stocks[0])), stocks[0].balanceOf(address(vault)));
    }

    function testOwedUncoveredStopsTargetDepositEvenWithZeroManaged() public {
        _deposit(0, 10e18);
        stocks[0].setMode(MockStock.Mode.RevertCall);
        _redeem(500e18);
        stocks[0].confiscate(address(vault), 10e18);
        vault.flagDeficit(address(stocks[0]));
        vm.warp(block.timestamp + 7 days);
        vault.recognizeLoss(address(stocks[0]));
        assertEq(vault.managed(address(stocks[0])), 0);
        _refresh();
        _status(BaskVault.Reason.OwedUncovered, address(stocks[0]));
    }

    function testZeroNAVWithExistingSupplyReverts() public {
        _deposit(0, 10e18);
        stocks[0].confiscate(address(vault), 10e18);
        vault.flagDeficit(address(stocks[0]));
        vm.warp(block.timestamp + 7 days);
        vault.recognizeLoss(address(stocks[0]));
        _refresh();
        _status(BaskVault.Reason.ZeroNAV, address(0));
        _redeem(vault.balanceOf(ALICE));
        assertEq(vault.totalSupply(), 1e15);
    }

    function testPriceExactlyTwentySixHoursOldAndSeparateMarketQuorum() public {
        (MockStock stock, MockFeed feed) = _newPair();
        vm.prank(OWNER);
        uint256 id = vault.proposeAsset(address(stock), address(feed));
        vm.warp(block.timestamp + 7 days);
        vault.executeProposal(id);
        _refresh();
        feeds[0].set(100e8, block.timestamp - 26 hours);
        _status(BaskVault.Reason.OK, address(0));
        _deposit(0, 1e18);
        feeds[0].set(100e8, block.timestamp - 26 hours - 1);
        _status(BaskVault.Reason.StalePrice, address(stocks[0]));
    }

    function testOracleMalformedReturnIsUnavailableButCannotBlockRedeem() public {
        _deposit(0, 1e18);
        vm.mockCall(address(stocks[0]), abi.encodeWithSignature("oraclePaused()"), abi.encode(uint256(2)));
        _status(BaskVault.Reason.OracleUnreadable, address(stocks[0]));
        _redeem(10e18);
    }

    function testStatusCodesForPauseCloseAndUnlisted() public {
        (BaskVault.Reason reason, address fault) = vault.depositStatus(BOB);
        assertEq(uint256(reason), uint256(BaskVault.Reason.NotListed));
        assertEq(fault, BOB);
        vm.prank(GUARDIAN);
        vault.pauseDeposits();
        _status(BaskVault.Reason.Paused, address(0));
        vm.prank(OWNER);
        vault.unpauseDeposits();
        vm.prank(GUARDIAN);
        vault.closeAsset(address(stocks[0]));
        _status(BaskVault.Reason.Closed, address(stocks[0]));
    }

    function testFullPrecisionArithmeticAndOverflowErrors() public {
        MathHarness math = new MathHarness();
        uint256 large = uint256(1) << 200;
        assertEq(math.mulDiv(large, large, large), large);
        assertEq(math.mulDiv(type(uint256).max, type(uint256).max, type(uint256).max), type(uint256).max);
        assertEq(math.mulDiv(large + 1, large - 1, large), large - 1);
        vm.expectRevert(BaskMath.MathOverflow.selector);
        math.mulDiv(1, 1, 0);
        vm.expectRevert(BaskMath.MathOverflow.selector);
        math.mulDiv(large, large, 1);
    }

    function testFuzzFullPrecisionAgainstQuotientRemainder(uint256 x, uint128 y, uint128 d) public pure {
        // d >= y guarantees a uint256 result; this identity exercises 512-bit products.
        uint256 divisor = (d > y ? uint256(d) : uint256(y)) + 1;
        uint256 expected = (x / divisor) * uint256(y) + (x % divisor) * uint256(y) / divisor;
        assertEq(BaskMath.mulDiv(x, y, divisor), expected);
    }

    function testFuzzMixedActionAccounting(uint256 seed) public {
        vm.prank(OWNER);
        vault.setFeeRecipient(BOB);
        _deposit(0, 10e18);
        uint256 donations;
        for (uint256 i; i < 24; ++i) {
            seed = uint256(keccak256(abi.encode(seed, i)));
            uint256 action = seed % 6;
            if (action == 0) _deposit(0, 1e18);
            if (action == 1) {
                stocks[0].mint(address(vault), 1e18);
                donations += 1e18;
            }
            if (action == 2) {
                stocks[0].setMode(MockStock.Mode.RevertCall);
                _redeem(vault.balanceOf(ALICE) / 10);
            }
            if (action == 3) {
                stocks[0].setMode(MockStock.Mode.Normal);
                _redeem(vault.balanceOf(ALICE) / 10);
            }
            if (action == 4) {
                stocks[0].setMode(MockStock.Mode.Normal);
                vm.prank(ALICE);
                vault.claim(address(stocks[0]), ALICE);
            }
            if (action == 5) {
                uint256 bobShares = vault.balanceOf(BOB);
                vm.prank(BOB);
                vault.redeem(bobShares, new uint256[](0), block.timestamp);
            }
            assertEq(
                vault.managed(address(stocks[0])) + vault.totalOwed(address(stocks[0])) + donations,
                stocks[0].balanceOf(address(vault))
            );
            assertEq(
                vault.totalOwed(address(stocks[0])),
                vault.owed(ALICE, address(stocks[0])) + vault.owed(BOB, address(stocks[0]))
            );
            assertEq(
                vault.totalSupply(), vault.balanceOf(ALICE) + vault.balanceOf(BOB) + vault.balanceOf(address(0xdEaD))
            );
        }
    }

    function testRuntimeHasNoForbiddenEscapeOpcodes() public view {
        bytes memory code = address(vault).code;
        for (uint256 i; i < code.length; ++i) {
            uint8 opcode = uint8(code[i]);
            if (opcode >= 0x60 && opcode <= 0x7f) {
                i += opcode - 0x5f;
                continue;
            }
            assertTrue(opcode != 0xf4 && opcode != 0xf2 && opcode != 0xff);
        }
    }
}

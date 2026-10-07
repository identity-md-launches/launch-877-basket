// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {BaskVault} from "src/BaskVault.sol";
import {BaskTestBase} from "./BaskVault.t.sol";
import {MockStock, MockFeed} from "./mocks/Mocks.sol";

/// @dev Ghosts record inputs and actual token movement, independently of the vault's ledger.
/// Prices stay at $100: oracle lag and retired-asset repricing are accepted design risks,
/// not assumptions behind these conservation properties. No vault storage is written by cheatcodes.
contract BasketHandler is Test {
    BaskVault public immutable vault;
    address internal immutable owner;
    address internal immutable guardian;
    MockStock[3] internal stocks;
    MockFeed[3] internal feeds;
    address[4] public actors;
    uint256[3] public deposited;
    uint256[3] public donated;
    uint256[3] public paid;
    uint256[3] public confiscated;
    uint256[3] public recognized;
    uint256 public deposits;
    uint256 public redemptions;
    uint256 public claims;
    uint256 public lossRecognitions;

    constructor(BaskVault v, MockStock[3] memory tokens, MockFeed[3] memory prices) {
        vault = v;
        owner = v.owner();
        guardian = v.guardian();
        stocks = tokens;
        feeds = prices;
        actors = [address(0xA11CE), address(0xB0B), address(0xCA11), address(0xFEE)];
        for (uint256 a; a < actors.length; ++a) {
            for (uint256 i; i < 3; ++i) {
                tokens[i].mint(actors[a], 1_000_000e18);
                vm.prank(actors[a]);
                tokens[i].approve(address(v), type(uint256).max);
            }
        }
    }

    function _market() internal {
        uint256 today = block.timestamp / 1 days * 1 days;
        uint256 next = today + 55800;
        if (next < block.timestamp) next += 1 days;
        while ((next / 1 days + 4) % 7 == 0 || (next / 1 days + 4) % 7 == 6) next += 1 days;
        vm.warp(next);
        for (uint256 i; i < 3; ++i) {
            feeds[i].set(100e8, next);
        }
    }

    function deposit(uint256 who, uint256 asset, uint256 rawAmount) public {
        _market();
        uint256 i = asset % 3;
        address actor = actors[who % 4];
        MockStock token = stocks[i];
        uint256 amount = bound(rawAmount, 1e14, 1e18);
        // Keep the bounded success path below the $25,000 per-asset floor.
        // Oversized/cap failures are covered by unit tests, not discarded fuzz runs.
        if (vault.managed(address(token)) + amount > 250e18) return;
        token.setMode(MockStock.Mode.Normal);
        (BaskVault.Reason reason, address fault) = vault.depositStatus(address(token));
        if (reason != BaskVault.Reason.OK) {
            vm.expectRevert(abi.encodeWithSelector(BaskVault.DepositUnavailable.selector, reason, fault));
            vm.prank(actor);
            vault.deposit(address(token), amount, actor, 0, block.timestamp);
            return;
        }
        uint256 beforeBalance = token.balanceOf(address(vault));
        vm.prank(actor);
        uint256 shares = vault.deposit(address(token), amount, actor, 0, block.timestamp);
        assertGt(shares, 0, "successful deposit minted no receiver shares");
        assertEq(token.balanceOf(address(vault)) - beforeBalance, amount, "deposit custody delta");
        for (uint256 j; j < 3; ++j) {
            (uint256 recorded, uint256 time) = vault.losses(address(stocks[j]));
            assertEq(recorded, 0, "deposit left an unretired loss record");
            assertEq(time, 0);
        }
        deposited[i] += amount;
        ++deposits;
    }

    function redeem(uint256 who, uint256 rawShares, bool entireBalance) public {
        address actor = actors[who % 4];
        uint256 shares = vault.balanceOf(actor);
        if (!entireBalance) shares = bound(rawShares, 0, shares);
        uint256[3] memory balances;
        uint256[3] memory actorBalances;
        uint256[3] memory debts;
        uint256[3] memory managedBefore;
        for (uint256 i; i < 3; ++i) {
            address token = address(stocks[i]);
            balances[i] = stocks[i].balanceOf(address(vault));
            actorBalances[i] = stocks[i].balanceOf(actor);
            debts[i] = vault.owed(actor, token);
            managedBefore[i] = vault.managed(token);
        }
        (,, uint256[] memory quoted) = vault.previewRedeem(shares);
        vm.prank(actor);
        uint256[] memory legs = vault.redeem(shares, new uint256[](0), block.timestamp);
        for (uint256 i; i < 3; ++i) {
            address token = address(stocks[i]);
            uint256 sent = balances[i] - stocks[i].balanceOf(address(vault));
            uint256 debtAdded = vault.owed(actor, token) - debts[i];
            assertEq(legs[i], quoted[i], "preview differs from redemption");
            assertEq(legs[i], sent + debtAdded, "leg neither paid nor owed, or counted twice");
            assertEq(stocks[i].balanceOf(actor) - actorBalances[i], sent, "payment went to wrong actor");
            assertEq(vault.managed(token) + legs[i], managedBefore[i], "wrong managed reduction");
            paid[i] += sent;
        }
        ++redemptions;
    }

    function claim(uint256 who, uint256 asset, uint256 recipient, bool repairToken) public {
        uint256 i = asset % 3;
        MockStock token = stocks[i];
        address actor = actors[who % 4];
        if (repairToken) token.setMode(MockStock.Mode.Normal);
        uint256 debt = vault.owed(actor, address(token));
        uint256 actual = token.balanceOf(address(vault));
        uint256 recipientBefore = token.balanceOf(actors[recipient % 4]);
        uint256 expected = debt < actual ? debt : actual;
        {
            MockStock.Mode mode = token.mode();
            if (mode != MockStock.Mode.Normal && mode != MockStock.Mode.NoReturn && expected > 0) {
                vm.expectRevert(abi.encodeWithSelector(BaskVault.TransferFailed.selector, address(token)));
                vm.prank(actor);
                vault.claim(address(token), actors[recipient % 4]);
                assertEq(vault.owed(actor, address(token)), debt, "failed claim erased debt");
                assertEq(token.balanceOf(address(vault)), actual, "failed claim changed custody");
                return;
            }
        }
        vm.prank(actor);
        uint256 amount = vault.claim(address(token), actors[recipient % 4]);
        assertEq(amount, expected, "claim is not min(debt, balance)");
        assertEq(token.balanceOf(address(vault)) + amount, actual, "claim custody delta");
        assertEq(token.balanceOf(actors[recipient % 4]), recipientBefore + amount, "claim recipient delta");
        assertEq(vault.owed(actor, address(token)) + amount, debt, "claim debt delta");
        paid[i] += amount;
        if (amount != 0) ++claims;
    }

    function transferShares(uint256 from, uint256 to, uint256 rawAmount, bool useAllowance) public {
        address sender = actors[from % 4];
        address recipient = actors[to % 4];
        uint256 amount = bound(rawAmount, 0, vault.balanceOf(sender));
        if (useAllowance) {
            vm.prank(sender);
            vault.approve(address(this), amount);
            vault.transferFrom(sender, recipient, amount);
            assertEq(vault.allowance(sender, address(this)), 0);
        } else {
            vm.prank(sender);
            vault.transfer(recipient, amount);
        }
    }

    function tokenFailure(uint256 asset, uint256 rawMode) public {
        MockStock.Mode[7] memory modes = [
            MockStock.Mode.Normal,
            MockStock.Mode.RevertCall,
            MockStock.Mode.FalseReturn,
            MockStock.Mode.NoReturn,
            MockStock.Mode.NoMovement,
            MockStock.Mode.ExtraDebit,
            MockStock.Mode.ShortReturn
        ];
        stocks[asset % 3].setMode(modes[rawMode % modes.length]);
    }

    function donate(uint256 asset, uint256 rawAmount, bool coverAllDebt) public {
        uint256 i = asset % 3;
        address token = address(stocks[i]);
        uint256 amount = bound(rawAmount, 0, 100e18);
        if (coverAllDebt) {
            uint256 obligation = vault.managed(token) + vault.totalOwed(token);
            uint256 actual = stocks[i].balanceOf(address(vault));
            if (obligation > actual) amount += obligation - actual;
        }
        stocks[i].mint(address(vault), amount);
        donated[i] += amount;
    }

    function confiscate(uint256 asset, uint256 rawAmount) public {
        uint256 i = asset % 3;
        uint256 amount = bound(rawAmount, 0, stocks[i].balanceOf(address(vault)));
        uint256 beforeManaged = vault.managed(address(stocks[i]));
        stocks[i].confiscate(address(vault), amount);
        confiscated[i] += amount;
        assertEq(vault.managed(address(stocks[i])), beforeManaged, "loss was recognized automatically");
    }

    function _shortfall(uint256 i) internal view returns (uint256) {
        address token = address(stocks[i]);
        uint256 balance = stocks[i].balanceOf(address(vault));
        uint256 debt = vault.totalOwed(token);
        uint256 available = balance > debt ? balance - debt : 0;
        uint256 managed = vault.managed(token);
        return managed > available ? managed - available : 0;
    }

    function flag(uint256 asset) public {
        uint256 i = asset % 3;
        address token = address(stocks[i]);
        (uint256 recorded, uint256 time) = vault.losses(token);
        uint256 shortfall = _shortfall(i);
        if (shortfall <= recorded) {
            vm.expectRevert(BaskVault.InvalidState.selector);
            vault.flagDeficit(token);
            (uint256 stillRecorded, uint256 stillTime) = vault.losses(token);
            assertEq(stillRecorded, recorded);
            assertEq(stillTime, time, "same/smaller deficit reset the clock");
        } else {
            vault.flagDeficit(token);
            (recorded, time) = vault.losses(token);
            assertEq(recorded, shortfall);
            assertEq(time, block.timestamp);
        }
    }

    function recognize(uint256 asset, bool mature) public {
        uint256 i = asset % 3;
        address token = address(stocks[i]);
        (uint256 recorded, uint256 time) = vault.losses(token);
        if (mature && recorded != 0 && block.timestamp < time + 7 days) vm.warp(time + 7 days);
        if (recorded == 0 || block.timestamp < time + 7 days) {
            vm.expectRevert(BaskVault.LossNotReady.selector);
            vault.recognizeLoss(token);
            return;
        }
        uint256 current = _shortfall(i);
        uint256 loss = recorded < current ? recorded : current;
        uint256 beforeManaged = vault.managed(token);
        vault.recognizeLoss(token);
        assertEq(vault.managed(token) + loss, beforeManaged);
        recognized[i] += loss;
        (recorded, time) = vault.losses(token);
        assertEq(recorded, 0);
        assertEq(time, 0);
        ++lossRecognitions;
    }

    function advance(uint256 elapsed) public {
        vm.warp(block.timestamp + bound(elapsed, 0, 8 days));
    }

    function operator(uint256 asset, bool pause, bool close) public {
        vm.prank(pause ? guardian : owner);
        if (pause) vault.pauseDeposits();
        else vault.unpauseDeposits();
        address token = address(stocks[asset % 3]);
        if (close) {
            vm.prank(guardian);
            vault.closeAsset(token);
        } else {
            vm.prank(owner);
            uint256 id = vault.proposeReopen(token);
            vm.warp(block.timestamp + 7 days);
            vault.executeProposal(id);
        }
    }
}

abstract contract BasketInvariantBase is BaskTestBase {
    BasketHandler internal handler;

    function _invariantSetup(bool withFee) internal {
        _setup(3);
        MockStock[3] memory tokens = [stocks[0], stocks[1], stocks[2]];
        MockFeed[3] memory prices = [feeds[0], feeds[1], feeds[2]];
        handler = new BasketHandler(vault, tokens, prices);
        if (withFee) {
            address recipient = handler.actors(3);
            vm.prank(OWNER);
            vault.setFeeRecipient(recipient);
        }
        // Every campaign starts funded through the real public deposit path.
        for (uint256 i; i < 3; ++i) {
            handler.deposit(i, i, 1e18);
        }
        bytes4[] memory selectors = new bytes4[](12);
        selectors[0] = BasketHandler.deposit.selector;
        selectors[1] = BasketHandler.redeem.selector;
        selectors[2] = BasketHandler.claim.selector;
        selectors[3] = BasketHandler.transferShares.selector;
        selectors[4] = BasketHandler.tokenFailure.selector;
        selectors[5] = BasketHandler.donate.selector;
        selectors[6] = BasketHandler.confiscate.selector;
        selectors[7] = BasketHandler.flag.selector;
        selectors[8] = BasketHandler.recognize.selector;
        selectors[9] = BasketHandler.advance.selector;
        selectors[10] = BasketHandler.operator.selector;
        // Give successful deposits extra weight among the hostile-state actions.
        selectors[11] = BasketHandler.deposit.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
        targetContract(address(handler));
    }

    function _assertAccounting() internal view {
        uint256 sumShares = vault.balanceOf(address(0xdEaD));
        for (uint256 a; a < 4; ++a) {
            sumShares += vault.balanceOf(handler.actors(a));
        }
        assertEq(vault.totalSupply(), sumShares, "BASK supply differs from all holders");
        assertEq(vault.balanceOf(address(0xdEaD)), 1e15, "permanent first-deposit shares changed");
        assertGt(handler.deposits(), 0, "unfunded invariant campaign");
        for (uint256 i; i < 3; ++i) {
            address token = address(stocks[i]);
            uint256 sumDebt;
            for (uint256 a; a < 4; ++a) {
                sumDebt += vault.owed(handler.actors(a), token);
            }
            assertEq(vault.totalOwed(token), sumDebt, "debt aggregate differs from claimants");
            assertEq(
                vault.managed(token) + sumDebt + handler.paid(i) + handler.recognized(i),
                handler.deposited(i),
                "accounting created or destroyed a token obligation"
            );
            assertEq(
                stocks[i].balanceOf(address(vault)) + handler.paid(i) + handler.confiscated(i),
                handler.deposited(i) + handler.donated(i),
                "custody differs from independent token flows"
            );
        }
    }

    /// @dev Deterministically exercises every accounting branch so random no-ops cannot mask an inert harness.
    function testHandlerReachesDebtPartialClaimLossRecoveryAndFullExit() public {
        handler.tokenFailure(0, 1);
        handler.redeem(0, 40e18, false);
        assertGt(vault.owed(handler.actors(0), address(stocks[0])), 0);
        handler.confiscate(0, type(uint256).max);
        handler.donate(0, 1, false);
        handler.claim(0, 0, 1, true);
        assertEq(handler.claims(), 1);
        assertGt(vault.owed(handler.actors(0), address(stocks[0])), 0);
        handler.flag(0);
        handler.recognize(0, false);
        handler.recognize(0, true);
        assertEq(handler.lossRecognitions(), 1);
        handler.donate(0, 0, true);
        handler.claim(0, 0, 0, true);
        handler.deposit(0, 0, 1e18);
        handler.transferShares(0, 1, 10e18, true);
        handler.operator(0, true, true);
        handler.redeem(1, 0, true);
        handler.operator(0, false, false);
        handler.deposit(1, 0, 1e18);
        _assertAccounting();
    }
}

contract BasketFeesUnsetInvariantTest is BasketInvariantBase {
    function setUp() public override {
        _invariantSetup(false);
    }

    /// forge-config: default.invariant.runs = 256
    /// forge-config: default.invariant.depth = 64
    /// forge-config: default.invariant.fail-on-revert = true
    function invariant_CustodyDebtLossAndShareConservation() public view {
        _assertAccounting();
    }
}

contract BasketFeesSetInvariantTest is BasketInvariantBase {
    function setUp() public override {
        _invariantSetup(true);
    }

    /// forge-config: default.invariant.runs = 256
    /// forge-config: default.invariant.depth = 64
    /// forge-config: default.invariant.fail-on-revert = true
    function invariant_CustodyDebtLossAndShareConservation() public view {
        _assertAccounting();
    }
}

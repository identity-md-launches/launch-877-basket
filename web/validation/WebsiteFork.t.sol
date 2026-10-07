// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;
import {Test} from "forge-std/Test.sol";
import {stdStorage, StdStorage} from "forge-std/StdStorage.sol";
import {BaskVault} from "../src/BaskVault.sol";
import {MockStock, MockFeed, MockFactory} from "./Mocks.sol";
contract WebsiteForkTest is Test {
    using stdStorage for StdStorage;
    BaskVault v;
    MockStock[4] stocks;
    MockFeed[4] feeds;
    address owner;
    address guardian;
    address user = address(0x123456);
    function setUp() public {
        uint forkBlock = vm.envUint("BASKET_FORK_BLOCK");
        require(forkBlock > 82708976, "fork must be after deployment");
        vm.createSelectFork("https://rpc.mainnet.chain.robinhood.com", forkBlock);
        emit log_named_uint("Fork block", forkBlock);
        v = BaskVault(0xd77a5F93F9d85E6990f389147713a9ad8Ce5764C);
        assertEq(block.chainid, 4663);
        assertEq(address(v).codehash, 0x62b326b6d8b9191a8777932f5beb87bc1dd07765fdb83bad3c4463924da402d0);
        owner = v.owner(); guardian = v.guardian();
        // The live vault has now finalized genesis. Isolate the original launch
        // scenarios in fork-only storage, retaining and verifying deployed code.
        // No state change is broadcast and no replacement vault is deployed.
        require(v.totalSupply() == 0, "fixture requires pre-deposit live state");
        emit log_named_uint("Live stock count before local fixture reset", v.assetCount());
        stdstore.target(address(v)).sig("genesisFinalized()").enable_packed_slots().checked_write(false);
        stdstore.target(address(v)).sig("assetCount()").checked_write(uint256(0));
        assertEq(address(v).codehash, 0x62b326b6d8b9191a8777932f5beb87bc1dd07765fdb83bad3c4463924da402d0);
        vm.etch(v.STOCK_FACTORY(), address(new MockFactory()).code);
        for(uint i; i<4; i++) {
            stocks[i] = new MockStock(bytes32(i+1)); feeds[i] = new MockFeed();
            MockFactory(v.STOCK_FACTORY()).register(bytes32(i+1), address(stocks[i]));
            stocks[i].mint(user,1000e18);
        }
    }
    function launch() internal {
        address[] memory ts = new address[](3); address[] memory fs = new address[](3);
        for(uint i;i<3;i++){ts[i]=address(stocks[i]);fs[i]=address(feeds[i]);}
        vm.prank(owner); v.proposeAssets(ts,fs);
        vm.prank(owner); v.finalizeGenesis();
        market(v.depositsOpenAt());
    }
    function market(uint t) internal {
        t = (t / 86400 + 1) * 86400 + 16 hours;
        while ((t / 86400 + 4) % 7 == 0 || (t / 86400 + 4) % 7 == 6) t += 1 days;
        vm.warp(t);
        for(uint i;i<4;i++) feeds[i].set(100e8,t);
    }
    function deposit() internal returns(uint shares) {
        vm.startPrank(user);
        stocks[0].approve(address(v),10e18);
        (uint receiverShares,,)=v.previewDeposit(address(stocks[0]),10e18);
        shares=v.deposit(address(stocks[0]),10e18,user,receiverShares*995/1000,vm.getBlockTimestamp()+10 minutes);
        vm.stopPrank();
    }
    function testWebsiteLaunchDepositRedeemClaimLoss() public {
        launch(); uint shares=deposit();
        assertGt(shares,0); assertEq(v.assetCount(),3);
        stocks[0].setMode(MockStock.Mode.RevertCall);
        (uint[] memory amounts,)=v.previewRedeem(shares/2);
        uint[] memory mins=new uint[](amounts.length);for(uint i;i<mins.length;i++)mins[i]=amounts[i]*999/1000;
        vm.prank(user);v.redeem(shares/2,mins,vm.getBlockTimestamp()+10 minutes);
        assertGt(v.owed(user,address(stocks[0])),0);
        stocks[0].setMode(MockStock.Mode.Normal);
        vm.prank(user);v.claim(address(stocks[0]),address(0x98765));
        assertEq(v.owed(user,address(stocks[0])),0);
        stocks[0].confiscate(address(v),1e18);
        vm.prank(user);v.flagDeficit(address(stocks[0]));
        vm.warp(vm.getBlockTimestamp()+7 days);
        vm.prank(user);v.recognizeLoss(address(stocks[0]));
        (uint loss,)=v.deficits(address(stocks[0]));assertEq(loss,0);
    }
    function testWebsiteAllOwnerControlsAndProposalKinds() public {
        launch();deposit();
        vm.startPrank(guardian);v.closeAsset(address(stocks[1]));v.pauseDeposits();vm.stopPrank();
        vm.startPrank(owner);v.unpauseDeposits();
        uint id=v.proposeAsset(address(stocks[3]),address(feeds[3]));
        MockFeed replacement=new MockFeed();uint feedId=v.proposeFeed(address(stocks[0]),address(replacement));
        uint bandId=v.proposeBand(address(stocks[0]));
        uint reopenId=v.proposeReopen(address(stocks[1]));
        uint retireId=v.proposeRetire(address(stocks[1]));
        uint guardianId=v.proposeGuardian(address(0x998877));
        uint capId=v.proposeNavCap(2_000_000e18);
        v.lowerNavCap(900_000e18); assertEq(uint(v.proposalState(capId)),6);
        v.setFeeRecipient(address(0x55555));
        v.transferOwnership(address(0x88888));vm.stopPrank();
        vm.prank(address(0x88888));v.acceptOwnership();
        vm.prank(guardian);v.cancelProposal(reopenId);
        vm.prank(address(0x88888));v.cancelProposal(guardianId);
        uint[] memory ids=v.pendingProposals(1,20);assertGt(ids.length,0);
        market(vm.getBlockTimestamp()+7 days);replacement.set(100e8,vm.getBlockTimestamp());
        vm.prank(user);v.executeProposal(bandId);
        vm.prank(user);v.executeProposal(retireId);
        vm.prank(user);v.executeProposal(id);
        market(vm.getBlockTimestamp()+1 days);replacement.set(100e8,vm.getBlockTimestamp());
        vm.prank(user);v.executeProposal(feedId);
        assertTrue(v.allAssets()[1].retired);
    }
    function testWebsiteCapsBucketAndWaitingState() public {
        launch();
        stocks[0].mint(user, 10000e18);
        vm.prank(owner); v.lowerNavCap(500e18);
        (uint quoted,,) = v.previewDeposit(address(stocks[0]), 10e18);
        assertGt(quoted, 0);
        vm.startPrank(user);
        stocks[0].approve(address(v), type(uint).max);
        vm.expectRevert(BaskVault.CapExceeded.selector);
        v.deposit(address(stocks[0]), 10e18, user, 0, vm.getBlockTimestamp() + 600);
        vm.stopPrank();
        vm.prank(owner); uint id = v.proposeNavCap(1_000_000e18);
        assertEq(uint(v.proposalState(id)), 1);
        vm.expectRevert(abi.encodeWithSelector(BaskVault.InvalidProposal.selector, id));
        v.executeProposal(id);
        market(vm.getBlockTimestamp() + 7 days);
        v.executeProposal(id);
        assertEq(v.NAV_CAP(), 1_000_000e18);
        vm.startPrank(user);
        v.deposit(address(stocks[0]), 1000e18, user, 0, vm.getBlockTimestamp() + 600);
        (quoted,,) = v.previewDeposit(address(stocks[0]), 1e18);
        assertGt(quoted, 0);
        vm.expectRevert(BaskVault.BucketExceeded.selector);
        v.deposit(address(stocks[0]), 1e18, user, 0, vm.getBlockTimestamp() + 600);
        vm.stopPrank();
        assertEq(v.managed(address(stocks[1])), 0); // One stock is the entire deposit NAV.
        vm.warp(vm.getBlockTimestamp() + 1 hours);
        vm.prank(user); v.deposit(address(stocks[0]), 1e18, user, 0, vm.getBlockTimestamp() + 600);
    }
    function testWebsiteRetirementVoidsProposalsAndFreesFeed() public {
        launch();
        vm.startPrank(owner);
        vm.expectRevert(abi.encodeWithSelector(BaskVault.InvalidFeed.selector, address(feeds[0])));
        v.proposeAsset(address(stocks[3]), address(feeds[0]));
        v.closeAsset(address(stocks[0]));
        uint band = v.proposeBand(address(stocks[0]));
        uint retire = v.proposeRetire(address(stocks[0]));
        uint guard = v.proposeGuardian(address(0x998877));
        vm.stopPrank();
        market(vm.getBlockTimestamp() + 7 days);
        v.executeProposal(retire);
        assertEq(uint(v.proposalState(band)), 6);
        v.executeProposal(guard);
        assertEq(v.guardian(), address(0x998877));
        vm.prank(owner); uint listing = v.proposeAsset(address(stocks[3]), address(feeds[0]));
        market(vm.getBlockTimestamp() + 7 days);
        v.executeProposal(listing);
        assertEq(v.allAssets()[3].feed, address(feeds[0]));
    }
}

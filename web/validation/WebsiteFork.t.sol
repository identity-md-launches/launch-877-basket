// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;
import {Test} from "forge-std/Test.sol";
import {BaskVault} from "../../src/BaskVault.sol";
import {MockStock, MockFeed, MockFactory} from "../mocks/Mocks.sol";
contract WebsiteForkTest is Test {
    BaskVault v;
    MockStock[4] stocks;
    MockFeed[4] feeds;
    address owner;
    address guardian;
    address user = address(0x123456);
    function setUp() public {
        vm.createSelectFork("https://rpc.mainnet.chain.robinhood.com");
        v = BaskVault(0x518AA023c1b982a0A64B207b7D3a19Bf973796E1);
        owner = v.owner(); guardian = v.guardian();
        require(!v.genesisFinalized(), "live genesis changed");
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
        BaskVault.DepositQuote memory q=v.previewDeposit(address(stocks[0]),10e18);
        shares=v.deposit(address(stocks[0]),10e18,user,q.receiverShares*995/1000,block.timestamp+10 minutes);
        vm.stopPrank();
    }
    function testWebsiteLaunchDepositRedeemClaimLoss() public {
        launch(); uint shares=deposit();
        assertGt(shares,0); assertEq(v.assetCount(),3);
        stocks[0].setMode(MockStock.Mode.RevertCall);
        (,,uint[] memory amounts)=v.previewRedeem(shares/2);
        uint[] memory mins=new uint[](amounts.length);for(uint i;i<mins.length;i++)mins[i]=amounts[i]*999/1000;
        vm.prank(user);v.redeem(shares/2,mins,block.timestamp+10 minutes);
        assertGt(v.owed(user,address(stocks[0])),0);
        stocks[0].setMode(MockStock.Mode.Normal);
        vm.prank(user);v.claim(address(stocks[0]),address(0x98765));
        assertEq(v.owed(user,address(stocks[0])),0);
        stocks[0].confiscate(address(v),1e18);
        vm.prank(user);v.flagDeficit(address(stocks[0]));
        vm.warp(block.timestamp+7 days);
        vm.prank(user);v.recognizeLoss(address(stocks[0]));
        (uint loss,)=v.losses(address(stocks[0]));assertEq(loss,0);
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
        uint capId=v.proposeNAVCap(2_000_000e18);
        v.lowerNAVCap(900_000e18); assertEq(uint(v.proposalState(capId)),3);
        v.setFeeRecipient(address(0x55555));
        v.transferOwnership(address(0x88888));vm.stopPrank();
        vm.prank(address(0x88888));v.acceptOwnership();
        vm.prank(guardian);v.cancelProposal(reopenId);
        vm.prank(address(0x88888));v.cancelProposal(guardianId);
        (uint[] memory ids,)=v.pendingProposals(1,20);assertGt(ids.length,0);
        market(block.timestamp+7 days);replacement.set(100e8,block.timestamp);
        vm.prank(user);v.executeProposal(bandId);
        vm.prank(user);v.executeProposal(retireId);
        vm.prank(user);v.executeProposal(id);
        market(block.timestamp+1 days);replacement.set(100e8,block.timestamp);
        vm.prank(user);v.executeProposal(feedId);
        assertTrue(v.allAssets()[1].retired);
    }
}

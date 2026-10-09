// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;
// Disposable local-fork fixtures. Never deployed to a public chain.
contract TestStock {
 string public symbol; uint8 public decimals; bool public fail; bool public oraclePaused;
 mapping(address=>uint256) public balanceOf; mapping(address=>mapping(address=>uint256)) public allowance;
 constructor(string memory s,uint8 d){symbol=s;decimals=d;}
 function mint(address to,uint256 n) external {balanceOf[to]+=n;}
 function burn(address from,uint256 n) external {balanceOf[from]-=n;}
 function setFail(bool v) external {fail=v;}
 function approve(address to,uint256 n) external returns(bool){allowance[msg.sender][to]=n;return true;}
 function transfer(address to,uint256 n) external returns(bool){require(!fail);balanceOf[msg.sender]-=n;balanceOf[to]+=n;return true;}
 function transferFrom(address from,address to,uint256 n) external returns(bool){require(!fail);allowance[from][msg.sender]-=n;balanceOf[from]-=n;balanceOf[to]+=n;return true;}
}
contract TestFeed {
 string public description; uint8 public decimals; int256 public answer; uint256 public lag;
 constructor(string memory s,uint8 d,int256 a){description=s;decimals=d;answer=a;}
 function setLag(uint256 l) external {lag=l;}
 function latestRoundData() external view returns(uint80,int256,uint256,uint256,uint80){uint256 t=block.timestamp-lag;return(1,answer,t,t,1);}
}
contract TestPool {
 address public token0;address public token1;
 constructor(address a,address b){(token0,token1)=a<b?(a,b):(b,a);}
 function observe(uint32[] calldata ago) external pure returns(int56[] memory tick,uint160[] memory liq){tick=new int56[](2);liq=new uint160[](2);liq[1]=uint160((uint256(ago[0])<<128)/1e12);}
}

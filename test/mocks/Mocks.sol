// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

contract MockFactory {
    mapping(bytes32 => address) public tokenAddress;

    function register(bytes32 id, address token) external {
        tokenAddress[id] = token;
    }
}

contract MockFeed {
    uint8 public decimals = 8;
    address public aggregator = address(1);
    int256 public answer = 100e8;
    uint256 public updatedAt;
    bool public broken;

    constructor() {
        updatedAt = block.timestamp;
    }

    function set(int256 answer_, uint256 time_) external {
        answer = answer_;
        updatedAt = time_;
    }

    function setDecimals(uint8 d) external {
        decimals = d;
    }

    function setAggregator(address a) external {
        aggregator = a;
    }

    function setBroken(bool b) external {
        broken = b;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        require(!broken, "feed broken");
        return (1, answer, updatedAt, updatedAt, 1);
    }
}

contract MockStock {
    enum Mode {
        Normal,
        RevertCall,
        FalseReturn,
        NoReturn,
        NoMovement,
        ExtraDebit,
        GasBomb,
        LargeReturn,
        ShortReturn,
        Reenter,
        Expensive
    }
    enum ReadMode {
        Normal,
        RevertCall,
        GasBomb,
        LargeReturn,
        ShortReturn,
        Expensive
    }
    bytes32 public uid;
    uint8 public decimals = 18;
    bool public oraclePaused;
    bool public oracleBroken;
    mapping(address => uint256) private balances;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => bool) public blocked;
    Mode public mode;
    ReadMode public readMode;
    address public callback;
    bytes public callbackData;
    bool public callbackSucceeded;
    uint256 public incomingFee;
    uint256 public work;

    constructor(bytes32 id) {
        uid = id;
    }

    function mint(address to, uint256 amount) external {
        balances[to] += amount;
    }

    function confiscate(address from, uint256 amount) external {
        balances[from] -= amount;
    }

    function setMode(Mode m) external {
        mode = m;
    }

    function setReadMode(ReadMode m) external {
        readMode = m;
    }

    function setDecimals(uint8 d) external {
        decimals = d;
    }

    function setPaused(bool p) external {
        oraclePaused = p;
    }

    function blockAddress(address account, bool b) external {
        blocked[account] = b;
    }

    function setIncomingFee(uint256 f) external {
        incomingFee = f;
    }

    function setCallback(address target, bytes calldata data) external {
        callback = target;
        callbackData = data;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function balanceOf(address who) external view returns (uint256) {
        ReadMode m = readMode;
        if (m == ReadMode.RevertCall) revert("unreadable");
        if (m == ReadMode.GasBomb) {
            assembly { for {} 1 {} {} }
        }
        if (m == ReadMode.LargeReturn) {
            assembly {
                mstore(0, 1)
                return(0, 65536)
            }
        }
        if (m == ReadMode.ShortReturn) {
            assembly { return(0, 1) }
        }
        if (m == ReadMode.Expensive) {
            uint256 end = gasleft() - 70_000;
            while (gasleft() > end) {}
        }
        return balances[who];
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(allowance[from][msg.sender] >= amount, "allowance");
        allowance[from][msg.sender] -= amount;
        require(!blocked[from] && !blocked[to], "blocked");
        balances[from] -= amount;
        balances[to] += amount - incomingFee;
        if (mode == Mode.Reenter) _callback();
        if (mode == Mode.FalseReturn) return false;
        if (mode == Mode.NoReturn) {
            assembly { return(0, 0) }
        }
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        Mode m = mode;
        require(!blocked[msg.sender] && !blocked[to], "blocked");
        if (m == Mode.RevertCall) revert("paused");
        if (m == Mode.GasBomb) {
            assembly { for {} 1 {} {} }
        }
        if (m == Mode.Expensive) {
            uint256 end = gasleft() - 300_000;
            while (gasleft() > end) {}
            work++;
        }
        if (m != Mode.NoMovement) {
            balances[msg.sender] -= amount + (m == Mode.ExtraDebit ? 1 : 0);
            balances[to] += amount;
        }
        if (m == Mode.FalseReturn) return false;
        if (m == Mode.NoReturn) {
            assembly { return(0, 0) }
        }
        if (m == Mode.LargeReturn) {
            assembly {
                mstore(0, 1)
                return(0, 65536)
            }
        }
        if (m == Mode.ShortReturn) {
            assembly { return(0, 1) }
        }
        if (m == Mode.Reenter) _callback();
        return true;
    }

    function _callback() internal {
        (callbackSucceeded,) = callback.call(callbackData);
        require(!callbackSucceeded, "reentrancy was allowed");
    }
}

contract RejectCalls {
    fallback() external {
        revert("must never be called");
    }
}

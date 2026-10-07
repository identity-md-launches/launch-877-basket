// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {BaskMath as M} from "./BaskMath.sol";

/// @notice Basket Protocol vault for Stock Tokens on Robinhood Chain (4663).
contract BaskVault {
    string public constant name = "Basket";
    string public constant symbol = "BASK";
    uint8 public constant decimals = 18;
    address public constant STOCK_FACTORY = 0x4783C67b63dE2B358Ac5951a7D41F47A38F3C046;
    address public constant DEAD = address(0xdEaD);
    uint256 public constant MAX_ASSETS = 64;
    uint256 public constant MAX_NAV_CAP = 10_000_000_000e18;
    uint256 public constant LOCKED_SHARES = 1e15;

    enum Reason {
        OK,
        Genesis,
        OpeningDelay,
        Paused,
        NotListed,
        Closed,
        MarketClosed,
        MarketNotFresh,
        BalanceUnreadable,
        OwedUncovered,
        Deficit,
        FeedUnreadable,
        NonpositivePrice,
        OutsideBand,
        FuturePrice,
        StalePrice,
        OracleUnreadable,
        OraclePaused,
        ZeroNAV,
        NAVCap,
        AssetCap,
        BucketCap
    }
    enum Kind {
        List,
        Feed,
        Band,
        Reopen,
        Retire,
        Guardian,
        NAVCap
    }
    enum State {
        None,
        Pending,
        Executed,
        Cancelled,
        Expired
    }

    struct Asset {
        address token;
        address feed;
        bool open;
        bool retired;
        bool genesisAsset;
        uint256 minAnswer;
        uint256 maxAnswer;
        uint256 listedAt;
    }

    struct Proposal {
        Kind kind;
        address token;
        address target;
        uint256 value;
        uint256 createdAt;
        uint256 version;
        State state;
    }

    struct Loss {
        uint256 amount;
        uint256 flaggedAt;
    }

    struct AssetView {
        address token;
        address feed;
        int256 answer;
        uint256 updatedAt;
        uint256 minAnswer;
        uint256 maxAnswer;
        bool open;
        bool retired;
        bool probation;
        uint256 listedAt;
        uint256 managed;
        bool short;
        bool balanceReadable;
        bool feedReadable;
        uint256 totalOwed;
    }

    struct DepositQuote {
        uint256 nav;
        uint256 value;
        uint256 gross;
        uint256 fee;
        uint256 receiverShares;
        uint256 lockedShares;
        uint256 bucketAfter;
    }

    error Unauthorized();
    error Reentrancy();
    error InvalidAddress();
    error InvalidAsset(address token);
    error InvalidFeed(address feed);
    error AssetLimit();
    error InvalidArray();
    error InvalidState();
    error InvalidProposal(uint256 id);
    error ProposalNotReady(uint256 id);
    error ChangeCooldown();
    error InvalidCap();
    error Expired();
    error InsufficientShares();
    error InsufficientAllowance();
    error Slippage();
    error TransferFailed(address token);
    error BalanceUnreadable(address token);
    error DepositUnavailable(Reason reason, address asset);
    error LossNotReady();

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);
    event OwnershipTransferStarted(address indexed owner, address indexed pendingOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed owner);
    event GuardianChanged(address indexed guardian);
    event FeeRecipientSet(address indexed recipient);
    event DepositsPaused(bool paused);
    event GenesisFinalized(uint256 depositsOpenAt);
    event AssetListed(address indexed token, address indexed feed, bool genesisAsset);
    event AssetClosed(address indexed token);
    event AssetReopened(address indexed token);
    event AssetRetired(address indexed token);
    event FeedChanged(address indexed token, address indexed feed);
    event BandChanged(address indexed token, uint256 minAnswer, uint256 maxAnswer);
    event NAVCapChanged(uint256 cap);
    event ProposalCreated(uint256 indexed id, Kind kind, address indexed token, address target, uint256 value);
    event ProposalExecuted(uint256 indexed id);
    event ProposalCancelled(uint256 indexed id);
    event NAVRaisesCancelled(uint256 version);
    event Deposit(
        address indexed caller,
        address indexed receiver,
        address indexed token,
        uint256 amount,
        uint256 shares,
        uint256 fee
    );
    event Redeem(address indexed caller, uint256 shares, uint256 net, uint256 fee);
    event LegPaid(address indexed token, address indexed to, uint256 amount);
    event LegOwed(address indexed account, address indexed token, uint256 amount);
    event Claimed(address indexed account, address indexed token, address indexed to, uint256 amount);
    event DeficitFlagged(address indexed token, uint256 amount, uint256 flaggedAt);
    event LossRecognized(address indexed token, uint256 amount);
    event DeficitCleared(address indexed token);

    address public owner;
    address public pendingOwner;
    address public guardian;
    address public feeRecipient;
    bool public genesisFinalized;
    bool public depositsPaused;
    uint256 public depositsOpenAt;
    uint256 public NAV_CAP = 1_000_000e18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    Asset[] public assets;
    mapping(address => uint256) public assetIndex; // index + 1; zero means unlisted
    mapping(address => address) public feedAsset;
    mapping(address => uint256) public managed;
    mapping(address => mapping(address => uint256)) public owed;
    mapping(address => uint256) public totalOwed;
    mapping(address => Loss) public losses;
    mapping(uint256 => Proposal) public proposals;
    uint256 public proposalCount;
    mapping(address => uint256) public closeVersion;
    uint256 public capVersion;
    uint256 public nextAssetChangeAt;
    uint256 public bucket;
    uint256 public bucketUpdatedAt;
    uint256 private entered = 1;

    constructor(address owner_, address guardian_) {
        if (owner_ == address(0) || guardian_ == address(0) || owner_ == guardian_) revert InvalidAddress();
        owner = owner_;
        guardian = guardian_;
        emit OwnershipTransferred(address(0), owner_);
        emit GuardianChanged(guardian_);
    }

    modifier nonReentrant() {
        if (entered != 1) revert Reentrancy();
        entered = 2;
        _;
        entered = 1;
    }
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }
    modifier onlyOperator() {
        if (msg.sender != owner && msg.sender != guardian) revert Unauthorized();
        _;
    }

    function transfer(address to, uint256 amount) external nonReentrant returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external nonReentrant returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external nonReentrant returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            if (allowed < amount) revert InsufficientAllowance();
            allowance[from][msg.sender] = allowed - amount;
            emit Approval(from, msg.sender, allowed - amount);
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        if (to == address(0)) revert InvalidAddress();
        if (balanceOf[from] < amount) revert InsufficientShares();
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function _burn(address from, uint256 amount) internal {
        if (balanceOf[from] < amount) revert InsufficientShares();
        balanceOf[from] -= amount;
        totalSupply -= amount;
        emit Transfer(from, address(0), amount);
    }

    function transferOwnership(address next) external nonReentrant onlyOwner {
        if (next == address(0)) revert InvalidAddress();
        pendingOwner = next;
        emit OwnershipTransferStarted(owner, next);
    }

    function acceptOwnership() external nonReentrant {
        if (msg.sender != pendingOwner) revert Unauthorized();
        address previous = owner;
        owner = msg.sender;
        pendingOwner = address(0);
        emit OwnershipTransferred(previous, msg.sender);
    }

    function setFeeRecipient(address recipient) external nonReentrant onlyOwner {
        if (feeRecipient != address(0)) revert InvalidState();
        if (recipient == address(0) || recipient == address(this)) revert InvalidAddress();
        feeRecipient = recipient;
        emit FeeRecipientSet(recipient);
    }

    function pauseDeposits() external nonReentrant onlyOperator {
        depositsPaused = true;
        emit DepositsPaused(true);
    }

    function unpauseDeposits() external nonReentrant onlyOwner {
        depositsPaused = false;
        emit DepositsPaused(false);
    }

    function closeAsset(address token) external nonReentrant onlyOperator {
        _asset(token).open = false;
        ++closeVersion[token];
        emit AssetClosed(token);
    }

    function lowerNAVCap(uint256 cap) external nonReentrant onlyOwner {
        if (cap >= NAV_CAP) revert InvalidCap();
        NAV_CAP = cap;
        ++capVersion;
        emit NAVRaisesCancelled(capVersion);
        emit NAVCapChanged(cap);
    }

    function finalizeGenesis() external nonReentrant onlyOwner {
        if (genesisFinalized || assets.length < 3) revert InvalidState();
        genesisFinalized = true;
        depositsOpenAt = block.timestamp + 72 hours;
        emit GenesisFinalized(depositsOpenAt);
    }

    function proposeAsset(address token, address feed) external nonReentrant onlyOwner returns (uint256) {
        return _proposeAsset(token, feed);
    }

    function proposeAssets(address[] calldata tokens, address[] calldata feeds)
        external
        nonReentrant
        onlyOwner
        returns (uint256[] memory ids)
    {
        if (tokens.length != feeds.length) revert InvalidArray();
        ids = new uint256[](tokens.length);
        for (uint256 i; i < tokens.length; ++i) {
            ids[i] = _proposeAsset(tokens[i], feeds[i]);
        }
    }

    function _proposeAsset(address token, address feed) internal returns (uint256) {
        uint256 answer = _checkListing(token, feed);
        if (!genesisFinalized) {
            _list(token, feed, answer);
            return 0;
        }
        return _propose(Kind.List, token, feed, 0, 0);
    }

    function proposeFeed(address token, address feed) external nonReentrant onlyOwner returns (uint256) {
        _checkReplacement(token, feed);
        return _propose(Kind.Feed, token, feed, 0, 0);
    }

    function proposeBand(address token) external nonReentrant onlyOwner returns (uint256) {
        _liveAsset(token);
        return _propose(Kind.Band, token, address(0), 0, 0);
    }

    function proposeReopen(address token) external nonReentrant onlyOwner returns (uint256) {
        _liveAsset(token);
        return _propose(Kind.Reopen, token, address(0), 0, closeVersion[token]);
    }

    function proposeRetire(address token) external nonReentrant onlyOwner returns (uint256) {
        if (_liveAsset(token).open) revert InvalidState();
        return _propose(Kind.Retire, token, address(0), 0, 0);
    }

    function proposeGuardian(address next) external nonReentrant onlyOwner returns (uint256) {
        if (next == address(0) || next == owner) revert InvalidAddress();
        return _propose(Kind.Guardian, address(0), next, 0, 0);
    }

    function proposeNAVCap(uint256 cap) external nonReentrant onlyOwner returns (uint256) {
        if (cap <= NAV_CAP || cap > MAX_NAV_CAP) revert InvalidCap();
        return _propose(Kind.NAVCap, address(0), address(0), cap, capVersion);
    }

    function _propose(Kind kind, address token, address target, uint256 value, uint256 version)
        internal
        returns (uint256 id)
    {
        id = ++proposalCount;
        proposals[id] = Proposal(kind, token, target, value, block.timestamp, version, State.Pending);
        emit ProposalCreated(id, kind, token, target, value);
    }

    function proposalState(uint256 id) public view returns (State) {
        Proposal storage p = proposals[id];
        if (p.state != State.Pending) return p.state;
        if (
            (p.kind == Kind.Reopen && p.version != closeVersion[p.token])
                || (p.kind == Kind.NAVCap && p.version != capVersion)
        ) return State.Cancelled;
        if (block.timestamp >= p.createdAt + 14 days) return State.Expired;
        return State.Pending;
    }

    function cancelProposal(uint256 id) external nonReentrant {
        Proposal storage p = proposals[id];
        if (msg.sender != owner && (msg.sender != guardian || p.kind == Kind.Guardian)) revert Unauthorized();
        if (proposalState(id) != State.Pending) revert InvalidProposal(id);
        p.state = State.Cancelled;
        emit ProposalCancelled(id);
    }

    function executeProposal(uint256 id) external nonReentrant {
        if (proposalState(id) != State.Pending) revert InvalidProposal(id);
        Proposal storage p = proposals[id];
        if (block.timestamp < p.createdAt + 7 days) revert ProposalNotReady(id);
        p.state = State.Executed;
        if (p.kind == Kind.List || p.kind == Kind.Feed) {
            if (block.timestamp < nextAssetChangeAt) revert ChangeCooldown();
            nextAssetChangeAt = block.timestamp + 24 hours;
        }
        if (p.kind == Kind.List) {
            _list(p.token, p.target, _checkListing(p.token, p.target));
        } else if (p.kind == Kind.Feed) {
            _checkReplacement(p.token, p.target);
            Asset storage a = _asset(p.token);
            delete feedAsset[a.feed];
            a.feed = p.target;
            feedAsset[p.target] = p.token;
            emit FeedChanged(p.token, p.target);
        } else if (p.kind == Kind.Band) {
            Asset storage a = _liveAsset(p.token);
            (bool ok, int256 answer, uint256 updatedAt) = _readFeed(a.feed);
            if (!ok || answer <= 0 || updatedAt > block.timestamp || block.timestamp - updatedAt >= 26 hours) {
                revert InvalidFeed(a.feed);
            }
            _band(a, uint256(answer));
        } else if (p.kind == Kind.Reopen) {
            _liveAsset(p.token).open = true;
            emit AssetReopened(p.token);
        } else if (p.kind == Kind.Retire) {
            Asset storage a = _liveAsset(p.token);
            if (a.open) revert InvalidState();
            a.retired = true;
            emit AssetRetired(p.token);
        } else if (p.kind == Kind.Guardian) {
            if (p.target == owner) revert InvalidAddress();
            guardian = p.target;
            emit GuardianChanged(p.target);
        } else {
            if (p.value <= NAV_CAP || p.value > MAX_NAV_CAP) revert InvalidCap();
            NAV_CAP = p.value;
            emit NAVCapChanged(p.value);
        }
        emit ProposalExecuted(id);
    }

    function _checkListing(address token, address feed) internal view returns (uint256) {
        if (assetIndex[token] != 0 || token == address(0)) revert InvalidAsset(token);
        if (assets.length >= MAX_ASSETS) revert AssetLimit();
        (bool ok, uint256 value) = _word(token, abi.encodeWithSignature("decimals()"));
        if (!ok || value != 18) revert InvalidAsset(token);
        (ok, value) = _word(token, abi.encodeWithSignature("uid()"));
        if (!ok) revert InvalidAsset(token);
        (ok, value) = _word(STOCK_FACTORY, abi.encodeWithSignature("tokenAddress(bytes32)", bytes32(value)));
        if (!ok || value != uint256(uint160(token))) revert InvalidAsset(token);
        uint256 answer = _checkFeed(token, feed);
        if (answer > type(uint256).max / 4) revert InvalidFeed(feed);
        return answer;
    }

    function _checkFeed(address token, address feed) internal view returns (uint256) {
        if (feedAsset[feed] != address(0) && feedAsset[feed] != token) revert InvalidFeed(feed);
        (bool ok, uint256 word) = _word(feed, abi.encodeWithSignature("decimals()"));
        if (!ok || word != 8) revert InvalidFeed(feed);
        (ok, word) = _word(feed, abi.encodeWithSignature("aggregator()"));
        if (!ok || word == 0 || word > type(uint160).max) revert InvalidFeed(feed);
        (bool read, int256 answer,) = _readFeed(feed);
        if (!read || answer <= 0) revert InvalidFeed(feed);
        return uint256(answer);
    }

    function _checkReplacement(address token, address feed) internal view {
        Asset storage a = _liveAsset(token);
        uint256 answer = _checkFeed(token, feed);
        if (answer < a.minAnswer || answer > a.maxAnswer) revert InvalidFeed(feed);
    }

    function _list(address token, address feed, uint256 answer) internal {
        assets.push(Asset(token, feed, true, false, !genesisFinalized, 0, 0, block.timestamp));
        assetIndex[token] = assets.length;
        feedAsset[feed] = token;
        _band(assets[assets.length - 1], answer);
        emit AssetListed(token, feed, !genesisFinalized);
    }

    function _band(Asset storage a, uint256 answer) internal {
        if (answer > type(uint256).max / 4) revert InvalidFeed(a.feed);
        a.minAnswer = answer / 4;
        a.maxAnswer = answer * 4;
        emit BandChanged(a.token, a.minAnswer, a.maxAnswer);
    }

    function _asset(address token) internal view returns (Asset storage a) {
        uint256 index = assetIndex[token];
        if (index == 0) revert InvalidAsset(token);
        return assets[index - 1];
    }

    function _liveAsset(address token) internal view returns (Asset storage a) {
        a = _asset(token);
        if (a.retired) revert InvalidState();
    }

    function _probation(Asset storage a) internal view returns (bool) {
        return !a.genesisAsset && block.timestamp < a.listedAt + 30 days;
    }

    // Only copies the expected word, including when a hostile contract returns excessive data.
    function _word(address target, bytes memory data) internal view returns (bool ok, uint256 value) {
        assembly ("memory-safe") {
            let ptr := mload(0x40)
            ok := staticcall(gas(), target, add(data, 32), mload(data), ptr, 32)
            ok := and(ok, eq(returndatasize(), 32))
            value := mload(ptr)
        }
    }

    function _readFeed(address feed) internal view returns (bool ok, int256 answer, uint256 updatedAt) {
        bytes memory data = abi.encodeWithSignature("latestRoundData()");
        assembly ("memory-safe") {
            let ptr := mload(0x40)
            mstore(0x40, add(ptr, 160))
            ok := staticcall(gas(), feed, add(data, 32), 4, ptr, 160)
            ok := and(ok, iszero(lt(returndatasize(), 160)))
            answer := mload(add(ptr, 32))
            updatedAt := mload(add(ptr, 96))
        }
        if (!ok) return (false, 0, 0);
    }

    function _balance(address token) internal view returns (bool ok, uint256 value) {
        return _balanceWithGas(token, 50_000);
    }

    function _balanceWithGas(address token, uint256 gasLimit) internal view returns (bool ok, uint256 value) {
        bytes memory data = abi.encodeWithSignature("balanceOf(address)", address(this));
        assembly ("memory-safe") {
            let ptr := mload(0x40)
            ok := staticcall(gasLimit, token, add(data, 32), mload(data), ptr, 32)
            ok := and(ok, eq(returndatasize(), 32))
            value := mload(ptr)
        }
        if (!ok) value = 0;
    }

    function _available(address token) internal view returns (bool readable, uint256 available) {
        uint256 actual;
        (readable, actual) = _balance(token);
        if (!readable) return (false, managed[token]);
        uint256 debt = totalOwed[token];
        return (true, actual > debt ? actual - debt : 0);
    }

    function _priceReason(Asset storage a, bool ok, int256 answer, uint256 updatedAt) internal view returns (Reason) {
        if (!ok) return Reason.FeedUnreadable;
        if (answer <= 0) return Reason.NonpositivePrice;
        if (uint256(answer) < a.minAnswer || uint256(answer) > a.maxAnswer) return Reason.OutsideBand;
        if (updatedAt > block.timestamp) return Reason.FuturePrice;
        if (block.timestamp - updatedAt > 26 hours) return Reason.StalePrice;
        (bool readable, uint256 paused) = _word(a.token, abi.encodeWithSignature("oraclePaused()"));
        if (!readable || paused > 1) return Reason.OracleUnreadable;
        if (paused == 1) return Reason.OraclePaused;
        return Reason.OK;
    }

    function _depositContext(address token)
        internal
        view
        returns (Reason reason, address fault, uint256 nav, uint256 price)
    {
        if (!genesisFinalized) return (Reason.Genesis, address(0), 0, 0);
        if (block.timestamp < depositsOpenAt) return (Reason.OpeningDelay, address(0), 0, 0);
        if (depositsPaused) return (Reason.Paused, address(0), 0, 0);
        if (assetIndex[token] == 0) return (Reason.NotListed, token, 0, 0);
        if (!_asset(token).open || _asset(token).retired) return (Reason.Closed, token, 0, 0);
        uint256 day = (block.timestamp / 86400 + 4) % 7;
        uint256 secondsToday = block.timestamp % 86400;
        if (day == 0 || day == 6 || secondsToday < 55800 || secondsToday >= 70200) {
            return (Reason.MarketClosed, address(0), 0, 0);
        }
        uint256 fresh;
        for (uint256 i; i < assets.length; ++i) {
            Asset storage a = assets[i];
            if (a.retired) continue;
            (bool readable, uint256 actual) = _balance(a.token);
            if (!readable) return (Reason.BalanceUnreadable, a.token, 0, 0);
            if (a.token == token && actual < totalOwed[token]) return (Reason.OwedUncovered, token, 0, 0);
            uint256 available = actual > totalOwed[a.token] ? actual - totalOwed[a.token] : 0;
            if (available < managed[a.token]) return (Reason.Deficit, a.token, 0, 0);
            (bool ok, int256 answer, uint256 updatedAt) = _readFeed(a.feed);
            if (ok && updatedAt <= block.timestamp && block.timestamp - updatedAt <= 4 hours) ++fresh;
            if (managed[a.token] > 0 || a.token == token) {
                reason = _priceReason(a, ok, answer, updatedAt);
                if (reason != Reason.OK) return (reason, a.token, 0, 0);
                nav += M.mulDiv(managed[a.token], uint256(answer), 1e8);
                if (a.token == token) price = uint256(answer);
            }
        }
        if (fresh < 3) return (Reason.MarketNotFresh, address(0), 0, 0);
        if (totalSupply > 0 && nav == 0) return (Reason.ZeroNAV, address(0), 0, 0);
        return (Reason.OK, address(0), nav, price);
    }

    function depositStatus(address token) external view returns (Reason reason, address fault) {
        (reason, fault,,) = _depositContext(token);
    }

    function decayedBucket() public view returns (uint256) {
        uint256 elapsed = block.timestamp - bucketUpdatedAt;
        return elapsed >= 86400 ? 0 : bucket - M.mulDiv(bucket, elapsed, 86400);
    }

    function _quote(address token, uint256 amount) internal view returns (DepositQuote memory q) {
        (Reason reason, address fault, uint256 nav, uint256 price) = _depositContext(token);
        if (reason != Reason.OK) revert DepositUnavailable(reason, fault);
        q.nav = nav;
        q.value = M.mulDiv(amount, price, 1e8);
        q.gross = totalSupply == 0 ? q.value : M.mulDiv(q.value, totalSupply, nav);
        q.fee = M.fee(q.gross);
        q.lockedShares = totalSupply == 0 ? LOCKED_SHARES : 0;
        if (q.gross - q.fee <= q.lockedShares) revert InsufficientShares();
        q.receiverShares = q.gross - q.fee - q.lockedShares;
        uint256 nav2 = nav + q.value;
        if (nav2 > NAV_CAP) revert DepositUnavailable(Reason.NAVCap, token);
        bool probation = _probation(_asset(token));
        uint256 cap = probation ? M.max(nav2 / 100, 5_000e18) : M.max(M.mulDiv(nav2, 5, 100), 25_000e18);
        if (M.mulDiv(managed[token] + amount, price, 1e8) > cap) revert DepositUnavailable(Reason.AssetCap, token);
        q.bucketAfter = decayedBucket() + q.value;
        if (q.bucketAfter > M.max(nav2 / 4, 100_000e18)) revert DepositUnavailable(Reason.BucketCap, token);
    }

    function previewDeposit(address token, uint256 amount) external view returns (DepositQuote memory) {
        return _quote(token, amount);
    }

    function deposit(address token, uint256 amount, address receiver, uint256 minSharesOut, uint256 deadline)
        external
        nonReentrant
        returns (uint256 shares)
    {
        if (block.timestamp > deadline) revert Expired();
        if (receiver == address(this) || receiver == address(0)) revert InvalidAddress();
        DepositQuote memory q = _quote(token, amount);
        if (q.receiverShares < minSharesOut) revert Slippage();
        (bool ok, uint256 beforeBalance) = _balance(token);
        if (!ok) revert BalanceUnreadable(token);
        _callToken(
            token, abi.encodeWithSignature("transferFrom(address,address,uint256)", msg.sender, address(this), amount)
        );
        (ok, shares) = _balance(token);
        if (!ok || shares < beforeBalance || shares - beforeBalance != amount) revert TransferFailed(token);
        managed[token] += amount;
        bucket = q.bucketAfter;
        bucketUpdatedAt = block.timestamp;
        for (uint256 i; i < assets.length; ++i) {
            address t = assets[i].token;
            if (!assets[i].retired && losses[t].amount != 0) {
                delete losses[t];
                emit DeficitCleared(t);
            }
        }
        if (q.lockedShares != 0) _mint(DEAD, q.lockedShares);
        if (feeRecipient != address(0) && q.fee != 0) _mint(feeRecipient, q.fee);
        shares = q.receiverShares;
        _mint(receiver, shares);
        emit Deposit(msg.sender, receiver, token, amount, shares, q.fee);
    }

    function previewRedeem(uint256 shares) public view returns (uint256 fee, uint256 net, uint256[] memory amounts) {
        fee = M.fee(shares);
        net = shares - fee;
        amounts = new uint256[](assets.length);
        uint256 supply = totalSupply;
        if (shares > supply) revert InsufficientShares();
        if (supply == 0) return (fee, net, amounts);
        for (uint256 i; i < assets.length; ++i) {
            address token = assets[i].token;
            (, uint256 available) = _available(token);
            amounts[i] = M.mulDiv(M.min(managed[token], available), net, supply);
        }
    }

    function redeem(uint256 shares, uint256[] calldata minAmountsOut, uint256 deadline)
        external
        nonReentrant
        returns (uint256[] memory amounts)
    {
        if (block.timestamp > deadline) revert Expired();
        if (shares > balanceOf[msg.sender]) revert InsufficientShares();
        (uint256 fee, uint256 net, uint256[] memory legs) = previewRedeem(shares);
        if (feeRecipient == address(0)) {
            _burn(msg.sender, shares);
        } else {
            _transfer(msg.sender, feeRecipient, fee);
            _burn(msg.sender, net);
        }
        // Compute all legs before any transfer can change another token's observed balance.
        for (uint256 i; i < assets.length; ++i) {
            uint256 leg = legs[i];
            if (i < minAmountsOut.length && leg < minAmountsOut[i]) revert Slippage();
            address token = assets[i].token;
            managed[token] -= leg;
            if (leg == 0) continue;
            bytes memory data = abi.encodeCall(this.payLeg, (token, msg.sender, leg));
            bool success;
            assembly ("memory-safe") {
                success := call(250000, address(), 0, add(data, 32), mload(data), 0, 0)
            }
            if (!success) {
                owed[msg.sender][token] += leg;
                totalOwed[token] += leg;
                emit LegOwed(msg.sender, token, leg);
            }
        }
        emit Redeem(msg.sender, shares, net, fee);
        return legs;
    }

    /// @dev Self-call isolation rolls back a transfer that fails its postcondition.
    /// The outer redeem/claim holds the reentrancy guard; this is not a user entry point.
    function payLeg(address token, address to, uint256 amount) external {
        if (msg.sender != address(this)) revert Unauthorized();
        (bool ok, uint256 beforeBalance) = _balanceWithGas(token, gasleft());
        if (!ok) revert BalanceUnreadable(token);
        _callToken(token, abi.encodeWithSignature("transfer(address,uint256)", to, amount));
        (bool afterOK, uint256 afterBalance) = _balanceWithGas(token, gasleft());
        if (!afterOK || beforeBalance < afterBalance || beforeBalance - afterBalance != amount) {
            revert TransferFailed(token);
        }
        emit LegPaid(token, to, amount);
    }

    function _callToken(address token, bytes memory data) internal {
        bool ok;
        assembly ("memory-safe") {
            let ptr := mload(0x40)
            ok := call(gas(), token, 0, add(data, 32), mload(data), ptr, 32)
            switch returndatasize()
            case 0 {}
            case 32 { ok := and(ok, eq(mload(ptr), 1)) }
            default { ok := 0 }
        }
        if (!ok) revert TransferFailed(token);
    }

    function claim(address token, address to) external nonReentrant returns (uint256 amount) {
        (bool ok, uint256 actual) = _balanceWithGas(token, gasleft());
        if (!ok) revert BalanceUnreadable(token);
        amount = M.min(owed[msg.sender][token], actual);
        owed[msg.sender][token] -= amount;
        totalOwed[token] -= amount;
        if (amount != 0) this.payLeg(token, to, amount);
        emit Claimed(msg.sender, token, to, amount);
    }

    function flagDeficit(address token) external nonReentrant {
        _asset(token);
        (bool readable, uint256 available) = _available(token);
        if (!readable) revert BalanceUnreadable(token);
        uint256 shortfall = managed[token] > available ? managed[token] - available : 0;
        if (shortfall <= losses[token].amount) revert InvalidState();
        losses[token] = Loss(shortfall, block.timestamp);
        emit DeficitFlagged(token, shortfall, block.timestamp);
    }

    function recognizeLoss(address token) external nonReentrant {
        Loss memory loss = losses[token];
        if (loss.amount == 0 || block.timestamp < loss.flaggedAt + 7 days) revert LossNotReady();
        (bool readable, uint256 available) = _available(token);
        if (!readable) revert BalanceUnreadable(token);
        uint256 shortfall = managed[token] > available ? managed[token] - available : 0;
        uint256 amount = M.min(loss.amount, shortfall);
        managed[token] -= amount;
        delete losses[token];
        emit LossRecognized(token, amount);
    }

    function assetCount() external view returns (uint256) {
        return assets.length;
    }

    function allAssets() external view returns (AssetView[] memory result) {
        result = new AssetView[](assets.length);
        for (uint256 i; i < assets.length; ++i) {
            Asset storage a = assets[i];
            (bool feedReadable, int256 answer, uint256 updatedAt) = _readFeed(a.feed);
            (bool balanceReadable, uint256 available) = _available(a.token);
            result[i] = AssetView(
                a.token,
                a.feed,
                answer,
                updatedAt,
                a.minAnswer,
                a.maxAnswer,
                a.open,
                a.retired,
                _probation(a),
                a.listedAt,
                managed[a.token],
                available < managed[a.token],
                balanceReadable,
                feedReadable,
                totalOwed[a.token]
            );
        }
    }

    /// @notice Scans at most `count` proposal IDs starting at `start` (IDs begin at 1).
    function pendingProposals(uint256 start, uint256 count)
        external
        view
        returns (uint256[] memory ids, Proposal[] memory pending)
    {
        if (start == 0) start = 1;
        uint256 length = start > proposalCount ? 0 : M.min(count, proposalCount - start + 1);
        ids = new uint256[](length);
        pending = new Proposal[](length);
        uint256 n;
        for (uint256 i; i < length; ++i) {
            uint256 id = start + i;
            if (proposalState(id) == State.Pending) {
                ids[n] = id;
                pending[n++] = proposals[id];
            }
        }
        assembly ("memory-safe") {
            mstore(ids, n)
            mstore(pending, n)
        }
    }
}

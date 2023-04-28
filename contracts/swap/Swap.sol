/**
 *Submitted for verification at BscScan.com on 2021-08-24
 */

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PancakePredictionV2
 */
contract PancakePredictionV2 is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // bool public genesisLockOnce = false;
    bool public genesisStartOnce = false;

    address public adminAddress; // address of the admin
    address public operatorAddress; // address of the operator

    address public token0;
    address public token1;

    uint256 public bufferSeconds; // number of seconds for valid execution of a prediction round
    uint256 public intervalSeconds; // interval in seconds between two prediction rounds

    uint256 public minBetAmount; // minimum betting amount (denominated in wei)
    uint256 public treasuryFee; // treasury rate (e.g. 200 = 2%, 150 = 1.50%)
    uint256 public treasuryAmount0; // treasury amount that was not claimed
    uint256 public treasuryAmount1; // treasury amount that was not claimed

    uint256 public currentEpoch; // current epoch for prediction round

    uint256 public constant MAX_TREASURY_FEE = 1000; // 10%

    mapping(uint256 => mapping(address => uint256)) public token0_user_deposit;
    mapping(uint256 => mapping(address => uint256)) public token1_user_deposit;

    mapping(uint256 => uint256) public total_token0;
    mapping(uint256 => uint256) public total_token1;

    mapping(uint256 => mapping(address => DepositInfo)) public ledger;
    mapping(uint256 => Round) public rounds;
    mapping(address => uint256[]) public userRounds;

    enum Position {
        Token0,
        Token1
    }

    struct Round {
        uint256 epoch;
        uint256 startTimestamp;
        uint256 closeTimestamp;
        uint256 token0Amount;
        uint256 token1Amount;
        uint256 rewardAmount0;
        uint256 rewardAmount1;
    }

    struct DepositInfo {
        Position position;
        uint256 amount;
        bool claimed; // default false
    }

    event Deposit(
        address indexed sender,
        uint256 indexed epoch,
        uint256 amount
    );
    event Claim(address indexed sender, uint256 indexed epoch, uint256 amount);
    event EndRound(
        uint256 indexed epoch,
        uint256 indexed roundId,
        int256 price
    );

    event NewAdminAddress(address admin);
    event NewBufferAndIntervalSeconds(
        uint256 bufferSeconds,
        uint256 intervalSeconds
    );
    event NewMinBetAmount(uint256 indexed epoch, uint256 minBetAmount);
    event NewTreasuryFee(uint256 indexed epoch, uint256 treasuryFee);
    event NewOperatorAddress(address operator);

    event Pause(uint256 indexed epoch);
    event RewardsCalculated(
        uint256 indexed epoch,
        uint256 rewardAmount0,
        uint256 rewardAmount1,
        uint256 treasuryAmount0,
        uint256 treasuryAmount1
    );

    event StartRound(uint256 indexed epoch);
    event TokenRecovery(address indexed token, uint256 amount);
    event TreasuryClaim(uint256 amount);
    event Unpause(uint256 indexed epoch);

    modifier onlyAdmin() {
        require(msg.sender == adminAddress, "Not admin");
        _;
    }

    modifier onlyAdminOrOperator() {
        require(
            msg.sender == adminAddress || msg.sender == operatorAddress,
            "Not operator/admin"
        );
        _;
    }

    modifier onlyOperator() {
        require(msg.sender == operatorAddress, "Not operator");
        _;
    }

    modifier notContract() {
        require(!_isContract(msg.sender), "Contract not allowed");
        require(msg.sender == tx.origin, "Proxy contract not allowed");
        _;
    }

    /**
     * @notice Constructor
     * @param _adminAddress: admin address
     * @param _operatorAddress: operator address
     * @param _intervalSeconds: number of time within an interval
     * @param _bufferSeconds: buffer of time for resolution of price
     * @param _minBetAmount: minimum bet amounts (in wei)
     * @param _treasuryFee: treasury fee (1000 = 10%)
     */
    constructor(
        address _adminAddress,
        address _operatorAddress,
        uint256 _intervalSeconds,
        uint256 _bufferSeconds,
        uint256 _minBetAmount,
        uint256 _treasuryFee
    ) {
        require(_treasuryFee <= MAX_TREASURY_FEE, "Treasury fee too high");

        adminAddress = _adminAddress;
        operatorAddress = _operatorAddress;
        intervalSeconds = _intervalSeconds;
        bufferSeconds = _bufferSeconds;
        minBetAmount = _minBetAmount;
        treasuryFee = _treasuryFee;
    }

    /**
     * @notice Returns true if `account` is a contract.
     * @param account: account address
     */
    function _isContract(address account) internal view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(account)
        }
        return size > 0;
    }

    // deposit token
    function deposit(
        uint256 epoch,
        uint256 token0_amount,
        uint256 token1_amount
    ) external payable whenNotPaused nonReentrant notContract {
        require(epoch == currentEpoch, "Round not start");
        require(_depositable(epoch), "Round not depositable");

        require(
            ledger[epoch][msg.sender].amount == 0,
            "Can only deposit once per round"
        );

        // require token0_amount or token1_amount greater than 0, then transfer
        require(token0_amount > 0 || token1_amount > 0, "Amount can not be 0");

        // transfer
        {
            // scope for _token{0,1}, avoids stack too deep errors
            address _token0 = token0;
            address _token1 = token1;

            if (token0_amount > 0)
                IERC20(_token0).transfer(address(this), token0_amount); // optimistically transfer tokens
            if (token1_amount > 0)
                IERC20(_token1).transfer(address(this), token1_amount); // optimistically transfer tokens
        }

        // Update round data
        Round storage round = rounds[epoch];
        round.token0Amount = round.token0Amount + token0_amount;
        round.token1Amount = round.token1Amount + token1_amount;

        // Update user data
        DepositInfo storage depostiInfo = ledger[epoch][msg.sender];

        if (token0_amount > 0) {
            depostiInfo.position = Position.Token0;
        } else {
            depostiInfo.position = Position.Token1;
        }
        userRounds[msg.sender].push(epoch);

        emit Deposit(msg.sender, epoch, token0_amount);
    }

    /**
     * @notice Start the next round n, lock price for round n-1, end round n-2
     * @dev Callable by operator
     */
    function executeRound() external whenNotPaused onlyOperator {
        require(
            genesisStartOnce,
            "Can only run after genesisStartRound and genesisLockRound is triggered"
        );

        _calculateRewards(currentEpoch);

        // Increment currentEpoch to current round (n)
        currentEpoch = currentEpoch + 1;
        _safeStartRound(currentEpoch);
    }

    // 由用户提款
    // 如果要批量返还的话需要保证所有地址都是非合约地址

    /**
     * @notice Claim reward
     * @param epoch:
     */
    function claim(uint256 epoch) external nonReentrant notContract {
        require(rounds[epoch].startTimestamp != 0, "Round has not started");
        require(
            block.timestamp > rounds[epoch].closeTimestamp,
            "Round has not ended"
        );

        uint256 reward = 0;

        require(claimable(epoch, msg.sender), "Not eligible for claim");
        Round memory round = rounds[epoch];

        // cacaulate the amount to claim
        if (ledger[epoch][msg.sender].position == Position.Token0) {
            reward =
                (ledger[epoch][msg.sender].amount / round.token0Amount) *
                round.rewardAmount1;
        }
        if (ledger[epoch][msg.sender].position == Position.Token1) {
            reward =
                (ledger[epoch][msg.sender].amount / round.token1Amount) *
                round.rewardAmount0;
        }

        ledger[epoch][msg.sender].claimed = true;

        emit Claim(msg.sender, epoch, reward);

        if (reward > 0) {
            // token transfer
            address _token0 = token0;
            address _token1 = token1;

            if (ledger[epoch][msg.sender].position == Position.Token0) {
                IERC20(_token1).transfer(msg.sender, reward);
            }
            if (ledger[epoch][msg.sender].position == Position.Token1) {
                IERC20(_token0).transfer(msg.sender, reward);
            }
        }
    }

    /**
     * @notice Start genesis round
     * @dev Callable by admin or operator
     */
    function genesisStartRound() external whenNotPaused onlyOperator {
        require(!genesisStartOnce, "Can only run genesisStartRound once");

        currentEpoch = currentEpoch + 1;
        _startRound(currentEpoch);
        genesisStartOnce = true;
    }

    // /**
    //  * @notice called by the admin to pause, triggers stopped state
    //  * @dev Callable by admin or operator
    //  */
    // function pause() external whenNotPaused onlyAdminOrOperator {
    //     _pause();

    //     emit Pause(currentEpoch);
    // }

    // /**
    //  * @notice Claim all rewards in treasury
    //  * @dev Callable by admin
    //  */
    // function claimTreasury() external nonReentrant onlyAdmin {
    //     uint256 currentTreasuryAmount = treasuryAmount;
    //     treasuryAmount = 0;
    //     _safeTransferBNB(adminAddress, currentTreasuryAmount);

    //     emit TreasuryClaim(currentTreasuryAmount);
    // }

    // /**
    //  * @notice called by the admin to unpause, returns to normal state
    //  * Reset genesis state. Once paused, the rounds would need to be kickstarted by genesis
    //  */
    // function unpause() external whenPaused onlyAdmin {
    //     genesisStartOnce = false;
    //     genesisLockOnce = false;
    //     _unpause();

    //     emit Unpause(currentEpoch);
    // }

    // /**
    //  * @notice Set buffer and interval (in seconds)
    //  * @dev Callable by admin
    //  */
    // function setBufferAndIntervalSeconds(
    //     uint256 _bufferSeconds,
    //     uint256 _intervalSeconds
    // ) external whenPaused onlyAdmin {
    //     require(
    //         _bufferSeconds < _intervalSeconds,
    //         "bufferSeconds must be inferior to intervalSeconds"
    //     );
    //     bufferSeconds = _bufferSeconds;
    //     intervalSeconds = _intervalSeconds;

    //     emit NewBufferAndIntervalSeconds(_bufferSeconds, _intervalSeconds);
    // }

    // /**
    //  * @notice Set minBetAmount
    //  * @dev Callable by admin
    //  */
    // function setMinBetAmount(
    //     uint256 _minBetAmount
    // ) external whenPaused onlyAdmin {
    //     require(_minBetAmount != 0, "Must be superior to 0");
    //     minBetAmount = _minBetAmount;

    //     emit NewMinBetAmount(currentEpoch, minBetAmount);
    // }

    // /**
    //  * @notice Set operator address
    //  * @dev Callable by admin
    //  */
    // function setOperator(address _operatorAddress) external onlyAdmin {
    //     require(_operatorAddress != address(0), "Cannot be zero address");
    //     operatorAddress = _operatorAddress;

    //     emit NewOperatorAddress(_operatorAddress);
    // }

    // /**
    //  * @notice Set oracle update allowance
    //  * @dev Callable by admin
    //  */
    // function setOracleUpdateAllowance(
    //     uint256 _oracleUpdateAllowance
    // ) external whenPaused onlyAdmin {
    //     oracleUpdateAllowance = _oracleUpdateAllowance;

    //     emit NewOracleUpdateAllowance(_oracleUpdateAllowance);
    // }

    // /**
    //  * @notice Set treasury fee
    //  * @dev Callable by admin
    //  */
    // function setTreasuryFee(
    //     uint256 _treasuryFee
    // ) external whenPaused onlyAdmin {
    //     require(_treasuryFee <= MAX_TREASURY_FEE, "Treasury fee too high");
    //     treasuryFee = _treasuryFee;

    //     emit NewTreasuryFee(currentEpoch, treasuryFee);
    // }

    // /**
    //  * @notice It allows the owner to recover tokens sent to the contract by mistake
    //  * @param _token: token address
    //  * @param _amount: token amount
    //  * @dev Callable by owner
    //  */
    // function recoverToken(address _token, uint256 _amount) external onlyOwner {
    //     IERC20(_token).safeTransfer(address(msg.sender), _amount);

    //     emit TokenRecovery(_token, _amount);
    // }

    // /**
    //  * @notice Set admin address
    //  * @dev Callable by owner
    //  */
    // function setAdmin(address _adminAddress) external onlyOwner {
    //     require(_adminAddress != address(0), "Cannot be zero address");
    //     adminAddress = _adminAddress;

    //     emit NewAdminAddress(_adminAddress);
    // }

    // /**
    //  * @notice Returns round epochs and bet information for a user that has participated
    //  * @param user: user address
    //  * @param cursor: cursor
    //  * @param size: size
    //  */
    // function getUserRounds(
    //     address user,
    //     uint256 cursor,
    //     uint256 size
    // ) external view returns (uint256[] memory, BetInfo[] memory, uint256) {
    //     uint256 length = size;

    //     if (length > userRounds[user].length - cursor) {
    //         length = userRounds[user].length - cursor;
    //     }

    //     uint256[] memory values = new uint256[](length);
    //     BetInfo[] memory betInfo = new BetInfo[](length);

    //     for (uint256 i = 0; i < length; i++) {
    //         values[i] = userRounds[user][cursor + i];
    //         betInfo[i] = ledger[values[i]][user];
    //     }

    //     return (values, betInfo, cursor + length);
    // }

    // /**
    //  * @notice Returns round epochs length
    //  * @param user: user address
    //  */
    // function getUserRoundsLength(address user) external view returns (uint256) {
    //     return userRounds[user].length;
    // }

    /**
     * @notice Get the claimable stats of specific epoch and user account
     * @param epoch: epoch
     * @param user: user address
     */
    function claimable(uint256 epoch, address user) public view returns (bool) {
        DepositInfo memory depositInfo = ledger[epoch][user];
        Round memory round = rounds[epoch];
        return
            !depositInfo.claimed &&
            block.timestamp > round.closeTimestamp + bufferSeconds &&
            depositInfo.amount != 0;
    }

    /**
     * @notice Calculate rewards for round
     * @param epoch: epoch
     */
    function _calculateRewards(uint256 epoch) internal {
        require(rounds[epoch].rewardAmount0 == 0 && rounds[epoch].rewardAmount1 == 0, "Rewards calculated");
        Round storage round = rounds[epoch];
        uint256 treasuryAmt0;
        uint256 treasuryAmt1;

        // 两个池子都收手续费
        treasuryAmt0 = (round.token0Amount * treasuryFee) / 10000;
        treasuryAmt1 = (round.token1Amount * treasuryFee) / 10000;

        round.rewardAmount0 = round.token0Amount - treasuryAmt0;
        round.rewardAmount1 = round.token1Amount - treasuryAmt1;

        // Add to treasury
        treasuryAmount0 += treasuryAmt0;
        treasuryAmount1 += treasuryAmt1;

        emit RewardsCalculated(
            epoch,
            round.rewardAmount0,
            round.rewardAmount1,
            treasuryAmt0,
            treasuryAmt1
        );
    }

    /**
     * @notice Start round
     * Previous round n-1 must end
     * @param epoch: epoch
     */
    function _safeStartRound(uint256 epoch) internal {
        require(
            genesisStartOnce,
            "Can only run after genesisStartRound is triggered"
        );
        require(
            rounds[epoch - 1].closeTimestamp != 0,
            "Can only start round after round n-1 has ended"
        );
        require(
            block.timestamp >= rounds[epoch - 1].closeTimestamp,
            "Can only start new round after round n-1 closeTimestamp"
        );
        _startRound(epoch);
    }

    /**
     * @notice Start round
     * Previous round n-1 must end
     * @param epoch: epoch
     */
    function _startRound(uint256 epoch) internal {
        Round storage round = rounds[epoch];
        round.startTimestamp = block.timestamp;
        round.closeTimestamp = block.timestamp + intervalSeconds;
        round.epoch = epoch;
        round.token0Amount = 0;
        round.token1Amount = 0;

        emit StartRound(epoch);
    }

    /**
     * @notice Determine if a round is valid for receiving deposit
     * Round must have started
     * Current timestamp must be within startTimestamp and closeTimestamp
     */
    function _depositable(uint256 epoch) internal view returns (bool) {
        return
            rounds[epoch].startTimestamp != 0 &&
            rounds[epoch].closeTimestamp != 0 &&
            block.timestamp > rounds[epoch].startTimestamp &&
            block.timestamp < rounds[epoch].closeTimestamp;
    }
}

/**
 *Submitted for verification at BscScan.com on 2021-08-24
 */

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title Swapdemo
 */
contract Swapdemo is Ownable, Pausable, ReentrancyGuard {
    using SafeMath for uint256;

    IERC20 private _token0;
    IERC20 private _token1;

    // 新增轮次
    uint256 public currentRound;

    // 记录每一轮存储的token0
    mapping(uint256 => mapping(address => uint256)) token0_deposit;
    mapping(uint256 => mapping(address => uint256)) token1_deposit;

    // 每一轮的claim记录
    mapping(uint256 => mapping(address => bool)) claim_record;

    // 记录每一轮总的池子
    mapping(uint256 => uint256) token0_pool;
    mapping(uint256 => uint256) token1_pool;

    struct RoundData {
        uint256 round;
        bool start;
        bool end;
        bool success;
    }

    mapping(uint256 => RoundData) round_datas;

    constructor(address token0, address token1) {
        _token0 = IERC20(token0);
        _token1 = IERC20(token1);
        _new_round();
    }

    // Modifier to check token allowance
    modifier checkAllowance(uint256 amount0, uint256 amount1) {
        require(
            _token0.allowance(msg.sender, address(this)) >= amount0,
            "Not allowance token0"
        );
        require(
            _token1.allowance(msg.sender, address(this)) >= amount1,
            "Not allowance token1"
        );
        _;
    }

    event Deposit(
        address indexed sender,
        uint256 indexed round,
        uint256 token0amount,
        uint256 token1amount
    );

    event Claim(
        address indexed claimer,
        uint256 indexed round,
        uint256 token0amount,
        uint256 token1amount
    );

    event Failed(uint256 round);
    event Success(uint256 round);

    function _new_round() private onlyOwner {
        currentRound = currentRound + 1;
        RoundData memory round_data = RoundData(
            currentRound,
            true,
            false,
            false
        );
        round_datas[currentRound] = round_data;
    }

    function deposit(
        uint256 round,
        uint256 amount0,
        uint256 amount1
    ) external checkAllowance(amount0, amount1) {
        require(
            amount0 > 0 || amount1 > 0,
            "deposit: INSUFFICIENT_INPUT_AMOUNT"
        );
        RoundData memory roundData = round_datas[round];
        require(roundData.start == true, "deposit failed, round not start");
        require(roundData.end == false, "deposit failed, round have ended");

        if (amount0 > 0) {
            _token0.transferFrom(msg.sender, address(this), amount0);
            token0_deposit[round][msg.sender] =
                token0_deposit[round][msg.sender] +
                amount0;
            token0_pool[round] = token0_pool[round] + amount0;
        }
        if (amount1 > 0) {
            _token1.transferFrom(msg.sender, address(this), amount1);
            token1_deposit[round][msg.sender] =
                token1_deposit[round][msg.sender] +
                amount1;
            token1_pool[round] = token1_pool[round] + amount1;
        }
        emit Deposit(msg.sender, round, amount0, amount1);
    }

    function claim(uint256 round) external nonReentrant {
        RoundData memory roundData = round_datas[round];
        require(roundData.end == true, "claim failed, round not end");

        bool claimed = claim_record[round][msg.sender];
        require(claimed == false, "claim failed, have claimed");

        claim_record[round][msg.sender] = true;

        uint256 swap_token0 = 0;
        uint256 swap_token1 = 0;

        // 如果该轮swap成功
        if (roundData.success == true) {
            swap_token1 = (
                token0_deposit[round][msg.sender].mul(token1_pool[round])
            ).div(token0_pool[round]);
            swap_token0 = (
                token1_deposit[round][msg.sender].mul(token0_pool[round])
            ).div(token1_pool[round]);
        } else {
            // 如果该轮swap没有成功，则原路返回
            swap_token0 = token0_deposit[round][msg.sender];
            swap_token1 = token1_deposit[round][msg.sender];
        }

        if (swap_token1 > 0) {
            _token1.transfer(msg.sender, swap_token1);
        }

        if (swap_token0 > 0) {
            _token0.transfer(msg.sender, swap_token0);
        }

        emit Claim(msg.sender, round, swap_token0, swap_token1);
    }

    function endRound() external onlyOwner {
        RoundData storage roundData = round_datas[currentRound];
        require(roundData.start == true, "endRound failed, round not start");
        require(roundData.end == false, "endRound failed, round have ended");
        roundData.end = true;

        if (token0_pool[currentRound] > 0 && token1_pool[currentRound] > 0) {
            roundData.success = true;
            emit Success(currentRound);
        } else {
            emit Failed(currentRound);
        }

        _new_round();
    }

    function queryClaimableBalance(
        uint256 round
    ) external view returns (uint256[2] memory) {
        uint256 swap_token1 = (token0_deposit[round][msg.sender] *
            token1_pool[round]) / token0_pool[round];
        uint256 swap_token0 = (token1_deposit[round][msg.sender] *
            token0_pool[round]) / token1_pool[round];
        return [swap_token0, swap_token1];
    }

    // Allow you to show how many tokens owns this smart contract
    function getTokenBalance() external view returns (uint256[2] memory) {
        return [
            _token0.balanceOf(address(this)),
            _token1.balanceOf(address(this))
        ];
    }
}

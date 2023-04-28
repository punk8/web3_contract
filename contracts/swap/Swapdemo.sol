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
 * @title Swapdemo
 */
contract Swapdemo is Ownable, Pausable, ReentrancyGuard {
    IERC20 private _token0;
    IERC20 private _token1;

    mapping(address => uint256) token0Reverse;
    mapping(address => uint256) token1Reverse;

    uint256 token0Pool;
    uint256 token1Pool;

    constructor(address token0, address token1) {
        _token0 = IERC20(token0);
        _token1 = IERC20(token1);
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

    event DEPOSIT(
        address indexed sender,
        address indexed to,
        address indexed token,
        uint256 amount
    );

    function deposit(
        uint256 amount0,
        uint256 amount1
    ) external checkAllowance(amount0, amount1) {
        require(
            amount0 > 0 || amount1 > 0,
            "deposit: INSUFFICIENT_INPUT_AMOUNT"
        );
        if (amount0 > 0) {
            _token0.transferFrom(msg.sender, address(this), amount0);
            token0Reverse[msg.sender] = token0Reverse[msg.sender] + amount0;
            token0Pool = token0Pool + amount0;
        }
        if (amount1 > 0) {
            _token1.transferFrom(msg.sender, address(this), amount1);
            token1Reverse[msg.sender] = token1Reverse[msg.sender] + amount1;
            token1Pool = token1Pool + amount1;
        }
        // emit DEPOSIT(msg.sender, to, address(_token), amount);
    }

    function claim() external {
        uint256 swap_token1 = (token0Reverse[msg.sender] * token1Pool) /
            token0Pool;
        uint256 swap_token0 = (token1Reverse[msg.sender] * token0Pool) /
            token1Pool;

        if (swap_token1 > 0) {
            _token1.transfer(msg.sender, swap_token1);
        }

        if (swap_token0 > 0) {
            _token0.transfer(msg.sender, swap_token0);
        }
    }

    function querySwapBalance() external view returns (uint256[2] memory) {
        uint256 swap_token1 = (token0Reverse[msg.sender] * token1Pool) /
            token0Pool;
        uint256 swap_token0 = (token1Reverse[msg.sender] * token0Pool) /
            token1Pool;

        return [swap_token1, swap_token0];
    }

    function endGame() external onlyOwner {
        // 判断时间是否满足
    }

    // Allow you to show how many tokens owns this smart contract
    function getToken0Balance() external view returns (uint) {
        return _token0.balanceOf(address(this));
    }

    // Allow you to show how many tokens owns this smart contract
    function getToken1Balance() external view returns (uint) {
        return _token1.balanceOf(address(this));
    }
}

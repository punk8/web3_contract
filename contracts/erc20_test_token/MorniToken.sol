// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// Uncomment this line to use console.log
// import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MorniToken is ERC20, Ownable {
    uint256 private constant MAX = ~uint256(0);

    constructor() ERC20("MorniToken", "MOR") {
        _mint(msg.sender, MAX);
    }
}

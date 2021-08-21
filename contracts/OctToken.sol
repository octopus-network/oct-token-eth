// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract OctToken is ERC20, Ownable {
    // Total supply: 100 million
    uint256 private constant TOTAL_SUPPLY = 100000000;

    /**
     * @dev Initializes the contract, mint total supply to the deployer (owner).
     */
    constructor() ERC20("Octopus Network Token", "OCT") {
        _mint(msg.sender, TOTAL_SUPPLY * 10**(uint256(decimals())));
    }
}

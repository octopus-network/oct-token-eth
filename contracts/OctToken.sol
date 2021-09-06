// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract OctToken is ERC20, Ownable {
    /**
     * @dev Initializes the contract, mint total supply of 100 million to the deployer (owner).
     */
    constructor() ERC20("Octopus Network Token", "OCT") {
        _mint(msg.sender, 100_000_000 * 10**(uint256(decimals())));
    }
}

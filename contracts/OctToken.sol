// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract OctToken is ERC20, Ownable {
    // Total supply: 100 million
    uint256 private constant TOTAL_SUPPLY = 100000000;

    // Flag of unlocking transfer for accounts other than the owner
    bool private _transferUnlocked = false;

    /**
     * @dev Initializes the contract, mint total supply to the deployer (owner).
     */
    constructor() ERC20("OctToken", "OCT") {
        _mint(msg.sender, TOTAL_SUPPLY * 10**(uint256(decimals())));
    }

    /**
     * @dev Unlocks transfer for all other accounts
     */
    function unlockTransfer() public onlyOwner {
        _transferUnlocked = true;
    }

    /**
     * @dev Throws if called by any account other than the owner while the contract is still locked.
     */
    modifier onlyOwnerOrTransferUnlocked() {
        require(
            owner() == _msgSender() || _transferUnlocked == true,
            "OctToken: Caller is not the owner and transfer is still locked"
        );
        _;
    }

    /**
     * @dev Override default implementation by simply add modifier `onlyOwnerOrContractUnlocked`
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override onlyOwnerOrTransferUnlocked {}
}

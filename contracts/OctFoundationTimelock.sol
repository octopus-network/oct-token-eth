// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// The storage data of a beneficiary
//
// Because the smart contract can NOT automatically execute over time,
// the value of 'unreleasedBalance', 'unreleasedSupervisedBalance' and 'releasedBalance'
// will be updated ONLY when 'unreleasedBalance' or 'unreleasedSupervisedBalance'
// need to be modified during release period (from EARLIEST_RELEASE_START_TIME to RELEASE_END_TIME)
// by calling function '_benefit(address, amount, supervised)' or 'decreaseBenefitOf(address, amount)'
struct Beneficiary {
    // The amount of unreleased balance of the beneficiary.
    //
    // This value may NOT be equal to the actual unreleased balance,
    // call function 'unreleasedBalanceOf(address)' to get actual value.
    uint256 unreleasedBalance;
    // The amount of unreleased supervised balance of the beneficiary.
    //
    // This value may NOT be equal to the actual unreleased supervised balance,
    // call function 'unreleasedSupervisedBalanceOf(address)' to get actual value.
    uint256 unreleasedSupervisedBalance;
    // The amount of released balance of the beneficiary.
    //
    // This value may NOT be equal to the actual total released balance,
    // call function 'releasedBalanceOf(address)' to get actual value.
    uint256 releasedBalance;
    // The amount of withdrawed balance of the beneficiary.
    //
    // This value will be updated on each withdraw operation.
    uint256 withdrawedBalance;
    // The start time when the beneficiary can withdraw held tokens.
    //
    // This value will be updated ONLY when 'unreleasedBalance' or 'unreleasedSupervisedBalance'
    // is changed during release period (from EARLIEST_RELEASE_START_TIME to RELEASE_END_TIME)
    // for recalculating the time lock amount of held balance of beneficiary.
    uint256 releaseStartTime;
}

/**
 * @dev A token holder contract that will allow a beneficiary to withdraw the
 * tokens after a given release time.
 */
contract OctFoundationTimelock is Ownable {
    using SafeERC20 for IERC20;

    // Seconds of a day
    uint256 private constant SECONDS_OF_A_DAY = 86400;

    // The earliest timestamp of token release period (2021/09/01 00:00:00 GMT).
    //
    // Before this time NO ONE can withdraw any token from this contract.
    uint256 private constant EARLIEST_RELEASE_START_TIME = 1630454400;

    // The end timestamp of token release period (2024/09/01 00:00:00 GMT).
    //
    // After this time, ANY ONE can withdraw any amount of tokens they held.
    uint256 private constant RELEASE_END_TIME = 1725148800;

    // The OctToken contract
    IERC20 private immutable _token;

    // Map of all beneficiaries
    mapping(address => Beneficiary) private _beneficiaries;
    // Total balance of supervised benefit
    uint256 private _total_supervised_benefit;
    // Total balance of unsupervised benefit
    uint256 private _total_unsupervised_benefit;

    event BenefitAdded(
        address indexed beneficiary,
        uint256 amount,
        bool supervised
    );
    event BenefitReduced(address indexed beneficiary, uint256 amount);
    event BenefitTransfered(
        address indexed from,
        address indexed to,
        uint256 amount
    );
    event BenefitWithdrawed(address indexed beneficiary, uint256 amount);

    constructor(IERC20 token_) {
        _token = token_;
        _total_supervised_benefit = 0;
        _total_unsupervised_benefit = 0;
    }

    /**
     * @return the token being held.
     */
    function token() public view returns (IERC20) {
        return _token;
    }

    /**
     * @return the total balance of supervised benefit
     */
    function totalBalanceOfSupervisedBenefit() public view returns (uint256) {
        return _total_supervised_benefit;
    }

    /**
     * @return the total balance of unsupervised benefit
     */
    function totalBalanceOfUnsupervisedBenefit() public view returns (uint256) {
        return _total_unsupervised_benefit;
    }

    /**
     * @return the (supervised) balance to release for the given beneficiary at the moment
     */
    function _balanceToReleaseTo(address addr, bool supervised)
        private
        view
        returns (uint256)
    {
        Beneficiary memory beneficiary = _beneficiaries[addr];
        if (block.timestamp <= beneficiary.releaseStartTime) return 0;
        if (block.timestamp > RELEASE_END_TIME) {
            if (supervised) return beneficiary.unreleasedSupervisedBalance;
            else return beneficiary.unreleasedBalance;
        }
        uint256 passedDays = (block.timestamp - beneficiary.releaseStartTime) /
            SECONDS_OF_A_DAY;
        uint256 totalDays = (RELEASE_END_TIME - beneficiary.releaseStartTime) /
            SECONDS_OF_A_DAY;
        if (supervised)
            return
                (beneficiary.unreleasedSupervisedBalance * passedDays) /
                totalDays;
        else return (beneficiary.unreleasedBalance * passedDays) / totalDays;
    }

    /**
     * @return the unreleased balance of the given beneficiary at the moment
     */
    function unreleasedBalanceOf(address addr) public view returns (uint256) {
        return
            _beneficiaries[addr].unreleasedBalance -
            _balanceToReleaseTo(addr, false);
    }

    /**
     * @return the unreleased supervised balance of the given beneficiary at the moment
     */
    function unreleasedSupervisedBalanceOf(address addr)
        public
        view
        returns (uint256)
    {
        return
            _beneficiaries[addr].unreleasedSupervisedBalance -
            _balanceToReleaseTo(addr, true);
    }

    /**
     * @return the balance which can be withdrawed by the given beneficiary at the moment
     */
    function releasedBalanceOf(address addr) public view returns (uint256) {
        return
            _beneficiaries[addr].releasedBalance +
            _balanceToReleaseTo(addr, false) +
            _balanceToReleaseTo(addr, true);
    }

    /**
     * @return the withdrawed balance of the given beneficiary at the moment
     */
    function withdrawedBalanceOf(address addr) public view returns (uint256) {
        return _beneficiaries[addr].withdrawedBalance;
    }

    /**
     * @notice Withdraws tokens to beneficiary
     */
    function withdraw(uint256 amount) public {
        uint256 withdrawedBalance = _beneficiaries[_msgSender()]
            .withdrawedBalance;
        require(
            releasedBalanceOf(_msgSender()) - withdrawedBalance >= amount,
            "OctFoundationTimelock: withdraw amount exceeds available released balance"
        );
        require(
            token().balanceOf(address(this)) >= amount,
            "OctFoundationTimelock: deposited amount is not enough"
        );

        _beneficiaries[_msgSender()].withdrawedBalance =
            withdrawedBalance +
            amount;

        token().safeTransfer(_msgSender(), amount);

        emit BenefitWithdrawed(_msgSender(), amount);
    }

    /**
     * @notice Add amount of balance to the given beneficiary (address), with a flag of supervised.
     */
    function _benefit(
        address addr,
        uint256 amount,
        bool supervised
    ) private {
        Beneficiary storage beneficiary = _beneficiaries[addr];
        if (block.timestamp < EARLIEST_RELEASE_START_TIME) {
            if (supervised) {
                beneficiary.unreleasedSupervisedBalance += amount;
            } else {
                beneficiary.unreleasedBalance += amount;
            }
            beneficiary.releaseStartTime = EARLIEST_RELEASE_START_TIME;
        } else {
            beneficiary.releasedBalance = releasedBalanceOf(addr);
            if (supervised) {
                beneficiary.unreleasedSupervisedBalance =
                    unreleasedSupervisedBalanceOf(addr) +
                    amount;
                beneficiary.unreleasedBalance = unreleasedBalanceOf(addr);
            } else {
                beneficiary
                    .unreleasedSupervisedBalance = unreleasedSupervisedBalanceOf(
                    addr
                );
                beneficiary.unreleasedBalance =
                    unreleasedBalanceOf(addr) +
                    amount;
            }
            beneficiary.releaseStartTime =
                block.timestamp -
                (block.timestamp % SECONDS_OF_A_DAY);
        }
    }

    /**
     * @notice Add amount of balance to the given beneficiary (address), with a flag of supervised, which can ONLY be called by the owner.
     */
    function benefit(
        address addr,
        uint256 amount,
        bool supervised
    ) public onlyOwner {
        require(
            token().balanceOf(address(this)) >=
                _total_supervised_benefit + _total_unsupervised_benefit,
            "OctFoundationTimelock: not enough deposit to benefit"
        );
        _benefit(addr, amount, supervised);
        if (supervised) {
            _total_supervised_benefit += amount;
        } else {
            _total_unsupervised_benefit += amount;
        }

        emit BenefitAdded(addr, amount, supervised);
    }

    /**
     * @notice Transfer amount of unreleased balance of the caller to another account (address).
     */
    function transferUnreleasedBalance(
        address addr,
        uint256 amount,
        bytes32 msgHash,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public {
        require(
            unreleasedBalanceOf(_msgSender()) >= amount,
            "OctFoundationTimelock: transfer amount exceeds unreleased balance"
        );
        require(
            ecrecover(msgHash, v, r, s) == addr,
            "OctFoundationTimelock: beneficiary MUST be an EOA"
        );
        Beneficiary storage beneficiary = _beneficiaries[_msgSender()];
        if (block.timestamp < EARLIEST_RELEASE_START_TIME) {
            beneficiary.unreleasedBalance -= amount;
            beneficiary.releaseStartTime = EARLIEST_RELEASE_START_TIME;
        } else {
            beneficiary.releasedBalance = releasedBalanceOf(_msgSender());
            beneficiary.unreleasedBalance =
                unreleasedBalanceOf(_msgSender()) -
                amount;
            beneficiary
                .unreleasedSupervisedBalance = unreleasedSupervisedBalanceOf(
                _msgSender()
            );
            beneficiary.releaseStartTime =
                block.timestamp -
                (block.timestamp % SECONDS_OF_A_DAY);
        }
        _benefit(addr, amount, false);

        emit BenefitTransfered(_msgSender(), addr, amount);
    }

    /**
     * @notice Decrease amount of unreleased supervised balance of a beneficiary (address), which can ONLY be called by the owner.
     */
    function decreaseBenefitOf(address addr, uint256 amount) public onlyOwner {
        require(
            unreleasedSupervisedBalanceOf(addr) >= amount,
            "OctFoundationTimelock: decrease amount exceeds unreleased supervised balance"
        );
        Beneficiary storage beneficiary = _beneficiaries[addr];
        if (block.timestamp < EARLIEST_RELEASE_START_TIME) {
            beneficiary.unreleasedSupervisedBalance -= amount;
            beneficiary.releaseStartTime = EARLIEST_RELEASE_START_TIME;
        } else {
            beneficiary.releasedBalance = releasedBalanceOf(addr);
            beneficiary.unreleasedBalance = unreleasedBalanceOf(addr);
            beneficiary.unreleasedSupervisedBalance =
                unreleasedSupervisedBalanceOf(addr) -
                amount;
            beneficiary.releaseStartTime =
                block.timestamp -
                (block.timestamp % SECONDS_OF_A_DAY);
        }
        _total_supervised_benefit -= amount;

        emit BenefitReduced(addr, amount);
    }
}

// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @dev A token holder contract that will allow a beneficiary to withdraw the
 * tokens after a given release time.
 */
contract UnsupervisedTimelock {
    using SafeERC20 for IERC20;
    // Seconds of a day
    uint256 private constant SECONDS_OF_A_DAY = 86400;
    // beneficiary of tokens after they are released
    address private immutable _beneficiary;
    // The start timestamp of token release period.
    //
    // Before this time, the beneficiary can NOT withdraw any token from this contract.
    uint256 private immutable _releaseStartTime;
    // The days that the timelock will last.
    uint256 private immutable _daysOfTimelock;
    // The OctToken contract
    IERC20 private immutable _token;
    // Total balance of benefit
    uint256 private immutable _totalBenefit;
    // The amount of withdrawed balance of the beneficiary.
    //
    // This value will be updated on each withdraw operation.
    uint256 _withdrawedBalance;

    event BenefitWithdrawed(address indexed beneficiary, uint256 amount);

    constructor(
        IERC20 token_,
        address beneficiary_,
        uint256 startTime_,
        uint256 daysOfTimelock_,
        uint256 totalBenefit_
    ) {
        _token = token_;
        _beneficiary = beneficiary_;
        _releaseStartTime = startTime_ - (startTime_ % SECONDS_OF_A_DAY);
        _daysOfTimelock = daysOfTimelock_;
        _totalBenefit = totalBenefit_;
        _withdrawedBalance = 0;
    }

    /**
     * @return the token being held.
     */
    function token() public view returns (IERC20) {
        return _token;
    }

    /**
     * @return the total balance of benefit
     */
    function totalBenefit() public view returns (uint256) {
        return _totalBenefit;
    }

    /**
     * @return the balance to release for the beneficiary at the moment
     */
    function releasedBalance() public view returns (uint256) {
        if (block.timestamp <= _releaseStartTime) return 0;
        if (
            block.timestamp >
            _releaseStartTime + SECONDS_OF_A_DAY * _daysOfTimelock
        ) {
            return _totalBenefit;
        }
        uint256 passedDays = (block.timestamp - _releaseStartTime) /
            SECONDS_OF_A_DAY;
        return (_totalBenefit * passedDays) / _daysOfTimelock;
    }

    /**
     * @return the unreleased balance of the beneficiary at the moment
     */
    function unreleasedBalance() public view returns (uint256) {
        return _totalBenefit - releasedBalance();
    }

    /**
     * @return the withdrawed balance of beneficiary
     */
    function withdrawedBalance() public view returns (uint256) {
        return _withdrawedBalance;
    }

    /**
     * @notice Withdraws tokens to beneficiary
     */
    function withdraw() public {
        uint256 balanceShouldBeReleased = releasedBalance();
        require(
            balanceShouldBeReleased > _withdrawedBalance,
            "UnsupervisedTimelock: no more benefit can be withdrawed now"
        );
        uint256 balanceShouldBeTransfered = balanceShouldBeReleased - _withdrawedBalance;
        require(
            token().balanceOf(address(this)) >= balanceShouldBeTransfered,
            "UnsupervisedTimelock: deposited balance is not enough"
        );

        _withdrawedBalance = balanceShouldBeReleased;

        token().safeTransfer(_beneficiary, balanceShouldBeTransfered);

        emit BenefitWithdrawed(_beneficiary, balanceShouldBeTransfered);
    }
}

// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @dev A token holder contract that will allow a beneficiary to withdraw the
 * tokens after a given release time.
 */
contract SupervisedTimelock is Ownable {
    using SafeERC20 for IERC20;
    // Seconds of a day
    uint256 private constant SECONDS_OF_A_DAY = 86400;
    // The OctToken contract
    IERC20 private immutable _token;
    // beneficiary of tokens after they are released
    address private immutable _beneficiary;
    // The start timestamp of token release period.
    //
    // Before this time, the beneficiary can NOT withdraw any token from this contract.
    uint256 private immutable _releaseStartTime;
    // The end timestamp of token release period.
    //
    // After this time, the beneficiary can withdraw all amount of benefit.
    uint256 private _releaseEndTime;
    // Total balance of benefit
    uint256 private _totalBenefit;
    // The amount of withdrawed balance of the beneficiary.
    //
    // This value will be updated on each withdraw operation.
    uint256 private _withdrawedBalance;
    // The flag of whether this contract is terminated.
    bool private _isTerminated;

    event BenefitWithdrawed(address indexed beneficiary, uint256 amount);
    event ContractIsTerminated(address indexed beneficiary, uint256 amount);

    constructor(
        IERC20 token_,
        address beneficiary_,
        uint256 releaseStartTime_,
        uint256 daysOfTimelock_,
        uint256 totalBenefit_
    ) {
        _token = token_;
        _beneficiary = beneficiary_;
        releaseStartTime_ -= (releaseStartTime_ % SECONDS_OF_A_DAY);
        _releaseStartTime = releaseStartTime_;
        _releaseEndTime =
            releaseStartTime_ +
            daysOfTimelock_ *
            SECONDS_OF_A_DAY;
        require(
            _releaseEndTime > timeNow(),
            "SupervisedTimelock: release end time is before current time"
        );
        _totalBenefit = totalBenefit_;
        _withdrawedBalance = 0;
        _isTerminated = false;
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier isNotTerminated() {
        require(
            _isTerminated == false,
            "SupervisedTimelock: this contract is terminated"
        );
        _;
    }

    
    /**
     * @dev timeNow() returns current timestamp its cost 2 gas
     */ 
    function timeNow() public view returns (uint256) {
        uint256 time = block.timestamp;
        return time;
    }

    /**
     * @return the token being held.
     */
    function token() public view returns (IERC20) {
        return _token;
    }

    /**
     * @return the amount of total benefit
     */
    function totalBenefit() external view returns (uint256) {
        return _totalBenefit;
    }

    /**
     * @return the balance which can be withdrawed at the moment
     */
    function releasedBalance() public view returns (uint256) {
        if (timeNow() <= _releaseStartTime) return 0;
        if (timeNow() > _releaseEndTime) {
            return _totalBenefit;
        }
        uint256 passedDays = (timeNow() - _releaseStartTime) /
            SECONDS_OF_A_DAY;
        uint256 totalDays = (_releaseEndTime - _releaseStartTime) /
            SECONDS_OF_A_DAY;
        return (_totalBenefit * passedDays) / totalDays;
    }

    /**
     * @return the unreleased balance at the moment
     */
    function unreleasedBalance() external view returns (uint256) {
        return _totalBenefit - releasedBalance();
    }

    /**
     * @return the withdrawed balance at the moment
     */
    function withdrawedBalance() external view returns (uint256) {
        return _withdrawedBalance;
    }

    /**
     * @notice Withdraws tokens to beneficiary
     */
    function withdraw() public {
        require(
            releasedBalance() > _withdrawedBalance,
            "SupervisedTimelock: no more benefit to withdraw"
        );
        uint256 amount = releasedBalance() - _withdrawedBalance;
        require(
            token().balanceOf(address(this)) >= amount,
            "SupervisedTimelock: deposited amount is not enough"
        );

        _withdrawedBalance += amount;
        token().safeTransfer(_beneficiary, amount);

        emit BenefitWithdrawed(_beneficiary, amount);
    }

    /**
     * @notice Teminate this contract and withdraw all amount of unreleased balance to the owner.
     * After the contract is terminated, the beneficiary can still withdraw all amount of
     * released balance.
     */
    function terminate() public onlyOwner isNotTerminated {
        _totalBenefit = releasedBalance();
        _releaseEndTime =
            timeNow() -
            (timeNow() % SECONDS_OF_A_DAY);
        _isTerminated = true;

        uint256 amountToWithdraw = token().balanceOf(address(this)) -
            (_totalBenefit - _withdrawedBalance);
        token().safeTransfer(owner(), amountToWithdraw);

        emit ContractIsTerminated(owner(), amountToWithdraw);
    }
}

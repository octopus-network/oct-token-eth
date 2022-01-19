// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @dev A token holder contract that will allow a beneficiary to withdraw the
 * tokens after a given release time.
 */
contract SupervisedMultiTimelock is Ownable {
    using SafeERC20 for IERC20;
    // Seconds of a day
    uint256 private constant SECONDS_OF_A_DAY = 86400;
    // The OctToken contract
    IERC20 private immutable _token;
    // The start timestamp of token release period.
    //
    // Before this time, the beneficiary can NOT withdraw any token from this contract.
    uint256 private immutable _releaseStartTime;
    // The end timestamp of token release period.
    //
    // After this time, the beneficiary can withdraw all amount of benefit.
    uint256 private _releaseEndTime;
    // Total amount of all issued benefits.
    uint256 private _totalBenefitAmount;
    // Total amount of all benefits which are already withdrawn by the beneficiaries.
    uint256 private _totalWithdrawnAmount;
    // The mapping of personal benefit.
    mapping(address => uint256) private _benefitAmount;
    // The mapping of withdrawn amount of beneficiaries.
    //
    // This value will be updated on each withdraw operation.
    mapping(address => uint256) private _withdrawnAmount;

    event BenefitIsIssued(address indexed beneficiary, uint256 amount);
    event BenefitIsWithdrawn(address indexed beneficiary, uint256 amount);
    event BenefitIsTerminated(address indexed beneficiary, uint256 amount);

    constructor(
        IERC20 token_,
        uint256 releaseStartTime_,
        uint256 daysOfTimelock_
    ) {
        _token = token_;
        releaseStartTime_ -= (releaseStartTime_ % SECONDS_OF_A_DAY);
        _releaseStartTime = releaseStartTime_;
        _releaseEndTime =
            releaseStartTime_ +
            daysOfTimelock_ *
            SECONDS_OF_A_DAY;
        require(
            _releaseEndTime > block.timestamp,
            "SupervisedMultiTimelock: release end time is before current time."
        );
        _totalBenefitAmount = 0;
        _totalWithdrawnAmount = 0;
    }

    /**
     * @return the token being held.
     */
    function token() public view returns (IERC20) {
        return _token;
    }

    /**
     * @return the amount of total benefits
     */
    function totalBenefits() public view returns (uint256) {
        return _totalBenefitAmount;
    }

    /**
     * @return the amount of total withdrawn amount
     */
    function totalWithdrawnAmount() public view returns (uint256) {
        return _totalWithdrawnAmount;
    }

    /**
     * @return the issued benefit of a beneficiary
     */
    function issuedBenefitOf(address addr) public view returns (uint256) {
        return _benefitAmount[addr];
    }

    /**
     * @return the amount which can be withdrawn by a beneficiary at the moment
     */
    function releasedAmountOf(address addr) public view returns (uint256) {
        uint256 benefit = _benefitAmount[addr];
        if (benefit == 0) return 0;
        if (block.timestamp <= _releaseStartTime) return 0;
        if (block.timestamp > _releaseEndTime) {
            return benefit;
        }
        uint256 passedDays = (block.timestamp - _releaseStartTime) /
            SECONDS_OF_A_DAY;
        uint256 totalDays = (_releaseEndTime - _releaseStartTime) /
            SECONDS_OF_A_DAY;
        return (benefit * passedDays) / totalDays;
    }

    /**
     * @return the unreleased amount of a beneficiary at the moment
     */
    function unreleasedAmountOf(address addr) public view returns (uint256) {
        uint256 benefit = _benefitAmount[addr];
        if (benefit == 0) return 0;
        return benefit - releasedAmountOf(addr);
    }

    /**
     * @return the withdrawn amount of a beneficiary at the moment
     */
    function withdrawnAmountOf(address addr) public view returns (uint256) {
        return _withdrawnAmount[addr];
    }

    /**
     * @notice Issue a certain amount benefit to a beneficiary.
     * An address of a beneficiary can only be used once.
     */
    function issueBenefitTo(address addr, uint256 amount) public onlyOwner {
        require(
            amount > 0,
            "SupervisedMultiTimelock: the amount should be greater than 0."
        );
        require(
            issuedBenefitOf(addr) == 0,
            "SupervisedMultiTimelock: the address is already a beneficiary."
        );
        _benefitAmount[addr] = amount;
        _totalBenefitAmount += amount;

        emit BenefitIsIssued(addr, amount);
    }

    /**
     * @notice Withdraws benefit of a beneficiary.
     * This function can be called by any account.
     */
    function withdrawBenefitOf(address addr) public {
        require(
            releasedAmountOf(addr) > withdrawnAmountOf(addr),
            "SupervisedMultiTimelock: no more benefit to withdraw."
        );
        uint256 amount = releasedAmountOf(addr) - withdrawnAmountOf(addr);
        require(
            token().balanceOf(address(this)) >= amount,
            "SupervisedMultiTimelock: deposited amount is not enough."
        );

        _withdrawnAmount[addr] += amount;
        _totalWithdrawnAmount += amount;
        token().safeTransfer(addr, amount);

        emit BenefitIsWithdrawn(addr, amount);
    }

    /**
     * @notice Remove a certain beneficiary from this contract.
     * The removed beneficiary can not withdraw benefit from this contract any more.
     */
    function terminateBenefitOf(address addr) public onlyOwner {
        uint256 remainingAmount = issuedBenefitOf(addr) -
            withdrawnAmountOf(addr);
        _totalBenefitAmount -= remainingAmount;
        _benefitAmount[addr] = withdrawnAmountOf(addr);

        emit BenefitIsTerminated(addr, remainingAmount);
    }

    /**
     * @notice Withdraw remaining benefit to the owner.
     */
    function withdrawRemainingBenefit() public onlyOwner {
        uint256 remainingAmount = token().balanceOf(address(this));
        token().safeTransfer(owner(), remainingAmount);

        emit BenefitIsWithdrawn(owner(), remainingAmount);
    }
}

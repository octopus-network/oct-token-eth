# oct-token-eth

This repository contains contracts for OCT token on Ethereum network.

Contents

* [Contract 'OctToken'](#contract-octtoken)
* [Contract 'UnsupervisedTimelock'](#contract-unsupervisedtimelock)
* [Contract 'SupervisedTimelock'](#contract-supervisedtimelock)
* [Installation](#installation)
  * [Install dependencies](#install-dependencies)
  * [Install dependencies for development](#install-dependencies-for-development)
* [Test](#test)
* [Audit](#audit)

## Contract 'OctToken'

This is a contract based on standard [openzeppelin-contracts](https://github.com/OpenZeppelin/openzeppelin-contracts) `ERC20` and `Ownable`, with following functions added:

* The token has name `Octopus Network Token` and symbol `OCT`.
* The token has fixed total supply - 100 million (100,000,000).
* All of the OCT tokens will be minted to the owner (deployer) of the contract at construction time. After this, there is NO WAY to mint or burn OCT tokens.

## Contract 'UnsupervisedTimelock'

This contract will lock a certain amount of OCT token and release them linearly by the passed days in timelock duration.

This contract have the following constants and state variables:

```c++
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
    uint256 private _withdrawedBalance;
```

This contract will be initialized by following parameters:

* `token_`: The address of ERC20 contract `OctToken`.
* `beneficiary_`: The address of beneficiary, who can withdraw benefit by time passed.
* `releaseStartTime_`: The start time from which the benefit locked in this contract can be withdrawed. It should be a UNIX timestamp in seconds.
* `daysOfTimelock_`: The days in timelock duration (from the `_releaseStartTime`).
* `totalBenefit_`: The total amount of OCT token that the `beneficiary` can withdraw during the timelock duration.

The value of this parameters will be used to initialize the state variables of this contract. The `releaseStartTime_` will be truncated to `00:00:00` of the day which the `releaseStartTime_` is in.

The benefit issuer should transfer the `totalBenefit_` amount of OCT token to this contract after the contract is deployed.

This contract has only one function which can change the state of the contract: `withdraw()`, with no parameter. Anyone can call this function to transfer a certain amount of OCT token that is locked in this contract to the `_beneficiary`.

The processing steps of function `withdraw()` are as follow:

* Calculate `releasedBalance`:

```javascript
releasedBalance = <totalBenefit_> * <the days passed since releaseStartTime_> / <daysOfTimelock_>
```

* The `releasedBalance` must be bigger than `_withdrawedBalance`.
* The `transferAmount` of this call is calclulated by:

```javascript
transferAmount = releasedBalance - _withdrawedBalance
```

* The amount of OCT token held by this contract must be not smaller than `transferAmount`.
* Add `transferAmount` to `_withdrawedAmount`.
* Perform token transfer by calling `safeTransfer` function of `_token`.
* Emit event for this withdraw action.

This contract also have view functions for querying the value of `unreleasedBalance`, `releasedBalance` and `withdrawedBalance`.

## Contract 'SupervisedTimelock'

This contract will lock a certain amount of OCT token and release them linearly by the passed days in timelock duration. The owner of the contract can terminate it at any time, and withdraw unreleased benefit at the time.

This contract have the following constants and state variables:

```c++
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
```

This contract will be initialized by following parameters:

* `token_`: The address of ERC20 contract `OctToken`.
* `beneficiary_`: The address of beneficiary, who can withdraw benefit by time passed.
* `releaseStartTime_`: The start time from which the benefit locked in this contract can be withdrawed. It should be a UNIX timestamp in seconds.
* `daysOfTimelock_`: The days in timelock duration (from the `_releaseStartTime`).
* `totalBenefit_`: The total amount of OCT token that the `beneficiary` can withdraw during the timelock duration.

The value of this parameters will be used to initialize the state variables of this contract. The `releaseStartTime_` will be truncated to `00:00:00` of the day which the `releaseStartTime_` is in. The `_withdrawedBlance` is set to `0`. The `_isTerminated` is set to `false`. And the `_releaseEndTime` is calculated by:

```javascript
_releaseEndTime = releaseStartTime_ + SECONDS_OF_A_DAY * daysOfTimelock_
```

The benefit issuer should transfer the `totalBenefit_` amount of OCT token to this contract after the contract is deployed.

This contract has a function `withdraw()`. Anyone can call this function to transfer a certain amount of OCT token that is locked in this contract to the `_beneficiary`. The processing steps of the function are as follow:

* Calculate `releasedBalance`:

```javascript
releasedBalance = _totalBenefit * <the days passed since _releaseStartTime> / <total days from _releaseStartTime to _releaseEndTime>
```

* The `releasedBalance` must be bigger than `_withdrawedBalance`.
* The `transferAmount` of this call is calclulated by:

```javascript
transferAmount = releasedBalance - _withdrawedBalance
```

* The amount of OCT token held by this contract must be not smaller than `transferAmount`.
* Add `transferAmount` to `_withdrawedAmount`.
* Perform token transfer by calling `safeTransfer` function of `_token`.
* Emit event for this withdraw action.

This contract also has a function `terminate()`. Only the owner of this contract can call this function while `_isTerminated` is `false`, to teminate this contract and withdraw all unreleased benefit. The processing steps of this function are as follow:

* The `_totalBenefit` is set to `releasedBalance`.
* The `_releaseEndTime` is set to `block.timestamp - (block.timestamp % SECONDS_OF_A_DAY)`.
* The `_isTerminated` is set to `true`.
* Transfer all unreleased benefit which is locked in this contract at the time to the address of `owner` of this contract.
* Emit event for the terminate action.

This contract also have view functions for querying the value of `totalBenefit`, `unreleasedBalance`, `releasedBalance` and `withdrawedBalance`.

## Installation

### Install dependencies

Install openzeppelin/contracts.

```shell
npm install @openzeppelin/contracts
```

### Install dependencies for development

Install hardhat for testing.

```shell
npm install --save-dev hardhat
```

Install modules for running testing scripts compatible with Waffle.

```shell
npm install --save-dev @nomiclabs/hardhat-waffle ethereum-waffle chai @nomiclabs/hardhat-ethers ethers
```

## Test

You can run the tests by:

```shell
npx hardhat test
```

or

```shell
npm run test
```

## Audit

These contracts had audited by SlowMist Security Team. Refer to [audit report](https://github.com/octopus-network/oct-token-eth/blob/main/SlowMist%20Audit%20Report%20-%20Octopus%20Network%20Token.pdf).

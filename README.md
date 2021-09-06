# oct-token-eth

This repository contains contracts for OCT token on Ethereum network.

Contents

* [Contract 'OctToken'](#contract-octtoken)
* [Contract 'OctFoundationTimelock'](#contract-octfoundationtimelock)
  * [Initialization](#initialization)
  * [View functions](#view-functions)
  * [Benefit a beneficiary](#benefit-a-beneficiary)
  * [Withdraw benefit](#withdraw-benefit)
  * [Transfer unreleased balance](#transfer-unreleased-balance)
  * [Decrease benefit](#decrease-benefit)
* [Contract 'UnsupervisedTimelock'](#contract-unsupervisedtimelock)
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

## Contract 'OctFoundationTimelock'

This is a contract based on standard [openzeppelin-contracts](https://github.com/OpenZeppelin/openzeppelin-contracts) `Ownable`, with the following functions added:

This contract has the following constants:

```c++
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
```

The `beneficiary` of this contract is defined as follow:

```c++
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
```

### Initialization

This contract will accept an address of contract `OctToken` at construction time, and the address will be immutable after construction.

### View functions

This contract has a private view function `_balanceToReleaseTo(address, supervised)` which implements the following logic:

* Get beneficiary corresponding to param `address`.
* If `block.timestamp` is smaller than `releaseStartTime`, return 0
* If `block.timestamp` is larger than `RELEASE_END_TIME` :
  * If param `supervised` is `true`, return `unreleasedSupervisedBalance`
  * If param `supervised` is `false`, return `unreleasedBalance`
* Calculate `passedDays` : (`block.timestamp` - `releaseStartTime`) / `SECONDS_OF_A_DAY`
* Calculate `totalDays` : (`RELEASE_END_TIME` - `releaseStartTime`) / `SECONDS_OF_A_DAY`
* If param `supervised` is `true`, return `unreleasedSupervisedBalance` * `passedDays` / `totalDays`
* If param `supervised` is `false`, return `unreleasedBalance` * `passedDays` / `totalDays`

This contract also has the following public view functions:

* `token()`: Get the address of contract `OctToken` bonded to this contract.
* `unreleasedBalanceOf(address)`: Get the total unreleased balance of a certain beneficiary corresponding to param `address`.
  * Get beneficiary corresponding to param `address`.
  * The result of this function is calculated by: `unreleasedBalance` - `_balanceToReleaseTo(address, false)`
* `withdrawedBalanceOf(address)`: Get the `withdrawedBalance` of a certain beneficiary corresponding to param `address`.
* `unreleasedSupervisedBalanceOf(address)`: Get the total unreleased supervised balance of a certain beneficiary corresponding to param `address`.
  * Get beneficiary corresponding to param `address`.
  * The result of this function is calculated by: `unreleasedSupervisedBalance` - `_balanceToReleaseTo(address, true)`
* `releasedBalanceOf(address)`: Get the total released balance of a certain beneficiary corresponding to param `address`.
  * Get beneficiary corresponding to param `address`.
  * The result of this function is calculated by: `releasedBalance` + `_balanceToReleaseTo(address, true)` + `_balanceToReleaseTo(address, false)`

### Benefit a beneficiary

This contract has a private function `_benefit(address, amount, supervised)` which implements the following logic:

* If `block.timestamp` is smaller than `EARLIEST_RELEASE_START_TIME`, update the properties of the beneficiary corresponding to param `address` as follow:
  * `unreleasedBalance` :
    * If param `supervised` is `true` : NO change
    * If param `supervised` is `false` : `unreleasedBalance` + `amount`
  * `releaseStartTime` : `EARLIEST_RELEASE_START_TIME`
  * `releasedBalance` : NO change
  * `withdrawedBalance` : NO change
  * `unreleasedSupervisedBalance` :
    * If param `supervised` is `true` : `unreleasedSupervisedBalance` + `amount`
    * If param `supervised` is `false` : NO change
* If `block.timestamp` is larger than `EARLIEST_RELEASE_START_TIME`, update the properties of the beneficiary corresponding to param `address` as follow:
  * `releasedBalance` : `releasedBalanceOf(address)`
  * `unreleasedBalance` :
    * If param `supervised` is `true` : `unreleasedBalanceOf(address)`
    * If param `supervised` is `false` : `unreleasedBalanceOf(address)` + `amount`
  * `withdrawedBalance` : NO change
  * `unreleasedSupervisedBalance` :
    * If param `supervised` is `true` : `unreleasedSupervisedBalanceOf(address)` + `amount`
    * If param `supervised` is `false` : `unreleasedSupervisedBalanceOf(address)`
  * `releaseStartTime` : `block.timestamp` - (`block.timestamp` % `SECONDS_OF_A_DAY`)

Only the owner (deployer) of this contract can call function `benefit(address, amount, supervised)` to increase benefit of a certain beneficiary corresponding to param `address`.

* The balance of OCT token which this contract is holding, must not be less than `totalSupervisedBenefit` + `totalUnsupervisedBenefit`.
* This function is a simple wraper of private function `_benefit(address, amount, supervised)`.
* If `supervised` is `true` add `amount` to `totalSupervisedBenefit`. Otherwise, add `amount` to `totalUnsupervisedBenefit`.
* The param `address` MUST be an EOA address. (This will be verified by the owner of this contract rather than by contract code.)

### Withdraw benefit

Anyone can call function `withdraw(amount)` to withdraw a certain amount tokens to the address of himself. This function implements the following logic:

* Get beneficiary corresponding to `_msgSender()`.
* The param `amount` must be less or equal to avaialable balance, which is calculated by: `releasedBalanceOf(_msgSender())` - `withdrawedBalance`
* The param `amount` must be less or equal to `token().balanceOf(address(this))`.
* Increase `withdrawedBalance` by `amount`.
* Transfer `amount` of OCT tokens to `_msgSender()`.

### Transfer unreleased balance

Anyone can call function `transferUnreleasedBalance(address, amount, msgHash, v, r, s)` to transfer a part or whole of his unreleased balance to another account (address). This function implements the following logic:

* Get beneficiary corresponding to `_msgSender()`.
* The param `amount` must be less or equal to `unreleasedBalanceOf(_msgSender())`
* The param `address` MUST be an EOA. (The param `address` should be equal to the address recovered by solidity global function `ecrecover` using param `msgHash`, `v`, `r` and `s`).
* If `block.timestamp` is smaller than `EARLIEST_RELEASE_START_TIME`, update the properties of the beneficiary corresponding to `_msgSender()` as follow:
  * `unreleasedBalance` : `unreleasedBalance` - `amount`
  * `releaseStartTime` : `EARLIEST_RELEASE_START_TIME`
  * `releasedBalance` : NO change
  * `withdrawedBalance` : NO change
  * `unreleasedSupervisedBalance` : NO change
* If `block.timestamp` is larger than `EARLIEST_RELEASE_START_TIME`, update the properties of the beneficiary corresponding to `_msgSender()` as follow:
  * `releasedBalance` : `releasedBalanceOf(_msgSender())`
  * `unreleasedBalance` : `unreleasedBalanceOf(_msgSender())` - `amount`
  * `withdrawedBalance` : NO change
  * `unreleasedSupervisedBalance` : `unreleasedSupervisedBalanceOf(_msgSender())`
  * `releaseStartTime` : `block.timestamp` - (`block.timestamp` % `SECONDS_OF_A_DAY`)
* Call private function `_benefit(address, amount, false)`.

### Decrease benefit

Only the owner (deployer) of this contract can call function `decreaseBenefitOf(address, amount)` to decrease the benefit of a certain beneficiary corresponding to param `address`. This function implements the following logic:

* Get beneficiary corresponding to param `address`.
* The param `amount` must be less or equal to `unreleasedSupervisedBalanceOf(address)`
* If `block.timestamp` is smaller than `EARLIEST_RELEASE_START_TIME`, update the properties of the beneficiary corresponding to `address` as follow:
  * `unreleasedBalance` : NO change
  * `releaseStartTime` : `EARLIEST_RELEASE_START_TIME`
  * `releasedBalance` : NO change
  * `withdrawedBalance` : NO change
  * `unreleasedSupervisedBalance` : `unreleasedSupervisedBalance` - `amount`
* If `block.timestamp` is larger than `EARLIEST_RELEASE_START_TIME`, update the properties of the beneficiary corresponding to `address` as follow:
  * `releasedBalance` : `releasedBalanceOf(address)`
  * `unreleasedBalance` : `unreleasedBalanceOf(address)`
  * `withdrawedBalance` : NO change
  * `unreleasedSupervisedBalance` : `unreleasedSupervisedBalanceOf(address)` - `amount`
  * `releaseStartTime` : `block.timestamp` - (`block.timestamp` % `SECONDS_OF_A_DAY`)
* Reduce `totalSupervisedBenefit` by `amount`.

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
* `daysOfTimelock_`: The days in timelock duration (from the `releaseStartTime`).
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
* `daysOfTimelock_`: The days in timelock duration (from the `releaseStartTime`).
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

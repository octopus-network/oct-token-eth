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

These contracts had audited by SlowMist Security Team. Refer to [audit report](https://github.com/octopus-network/oct-token-eth/blob/main/SlowMist%20Audit%20Report%20-%20OctToken.pdf).

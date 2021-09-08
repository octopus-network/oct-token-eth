# Audit report

|    Name    | Information                                                                                                       |
| :--------: | ----------------------------------------------------------------------------------------------------------------- |
| Repository | https://github.com/octopus-network/oct-token-eth                                                                  |
|  Checked   | [OctToken.sol](https://github.com/octopus-network/oct-token-eth/blob/main/contracts/OctToken.sol), [SupervisedTimelock.sol](https://github.com/octopus-network/oct-token-eth/blob/main/contracts/SupervisedTimelock.sol), [UnsupervisedTimelock.sol](https://github.com/octopus-network/oct-token-eth/blob/main/contracts/UnsupervisedTimelock.sol) |
|   Branch   | [main](https://github.com/octopus-network/oct-token-eth/tree/main)                                                |
|    Time    | Wednesday, 08 Sep 2021 15:39:37 UTC                                                                               |
|   Author   | Francis Isberto                                                                                                   |


# Result

| Severity Level | Count | Link                                                                    |
| :------: | ----: | ---------------------------------------------------                           |
| Critical |     0 |                                                                               |
|   High   |     0 |                                                                               |
|  Medium  |     0 |                                                                               |
|   Low    |     3 |                                                                               |
|          |       | [L01 - block.timestamp can be manipulated by miners](#L01)                    |
|          |       | [L02 - Import ReentrancyGuard.sol](#L02)                                      |
|          |       | [L03 - Assertion Error Solidity](#L03)                                        |


<a name="L01"/>

## L01 - block.timestamp can be manipulated by miners 
|       Contract           | Severity | Count  | Lines                                                                                                           |
| :----------------------: | :------- | -----: | --------------------------------------------------------------------------------------------------------------: |
| SupervisedTimelock.sol   | Low      |      6 | [93-97](https://github.com/icebert04/oct-token-eth/blob/main/contracts/SupervisedTimelock.sol#L93-L97)          |
|                          |          |        | [146-147](https://github.com/icebert04/oct-token-eth/blob/main/contracts/SupervisedTimelock.sol#L146-L147)      |
|                          |          |        | [56](https://github.com/icebert04/oct-token-eth/blob/main/contracts/SupervisedTimelock.sol#L56)                 |
| UnsupervisedTimelock.sol | Low      |      4 | [77-84](https://github.com/icebert04/oct-token-eth/blob/main/contracts/UnsupervisedTimelock.sol#L77-L84)        |
|                          |          |        | [51](https://github.com/icebert04/oct-token-eth/blob/main/contracts/UnsupervisedTimelock.sol#L51)               |

`block.timestamp` can be manipulated by miners if they have the incentive to do so. 

The time units and Suffixes of Solidity such as seconds after literal numbers can be used to convert between units of time.

It is much better to use `block.number` which sets the current block number which is difficult to manipulate, 

and apply an avarage block time of (10 to 20 seconds) for an additional security.

<a name="L02"/>

## L02 - Required to Import ReentrancyGuard.sol

|       Contract          | Severity | Count | Lines                                                                                                |
| :------------------:    | :------- | ----: | ---------------------------------------------------------------------------------------------------: |
|SupervisedTimelock.sol   | Low      |   1   | [5-6](https://github.com/icebert04/oct-token-eth/blob/main/contracts/SupervisedTimelock.sol#L5-L6)   |
|UnsupervisedTimelock.sol | Low      |   1   | [5-6](https://github.com/icebert04/oct-token-eth/blob/main/contracts/UnsupervisedTimelock.sol#L5-L6) |

In order to avoid Re-entrancy attacks, it is recommended to `import "@openzeppelin/contracts/security/ReentrancyGuard.sol"`

A reentrancy guard is a piece of code that causes execution to fail when reentrancy is detected. 

Applying this modifier to a function will render it “non-reentrant”, and attempts to re-enter this function will be rejected by reverting the transaction.
  
<a name="L03"/>

## L03 - Assertion Error Solidity 
|          Contract           | Severity | Count | Lines                                                                                                                   |
| :-------------------------: | :------- | ----: | ----------------------------------------------------------------------------------------------------------------------: |
|test-unsupervised-timelock.js| Low      |    1  | [47-54](https://github.com/icebert04/oct-token-eth/blob/main/test/test-unsupervised-timelock.js#L47-L54)                |

When running `npx hardhat test` on Windows, an Assertion Error occurred stating that    
it `Expected "100000000000000000000000" to be equal 500000000000000000000000` related to `_isBigNumber: true`

Although this may be just a warning or an error generated program,  
it is suggested to check if this specified lines of code validates its existence and applies accordingly to the smart contract.

see image below
![screenshot](/screenshot.png)

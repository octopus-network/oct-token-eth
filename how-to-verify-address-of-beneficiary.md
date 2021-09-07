# How to verify address of beneficiary

By using function `ecrecover` of Solidity, we can create a function to verify an address of Ethereum, to ensure that it is a public key corresponding to a real private key of an EOA. For example:

```c++
    require(
        ecrecover(msgHash, v, r, s) == address,
        "TimelockContract: beneficiary MUST be an EOA"
    );
```

The function needs 5 parameters:

* `address`: The address of the new beneficiary.
* `msgHash`: The hash of a message specified by the new beneficiary.
* `v`, `r`, `s`: The 3 parts of the signature of the message specified by the new beneficiary. The message used here MUST be exactly the same as the one used in calculating param `msgHash`.

**Note that, the value of param `msgHash`, `v`, `r` and `s` should be provided by the new beneficiary (the owner of the param `address`), rather than the caller of the function.**

## Calculating the value of param `msgHash`, `v`, `r` and `s`

The new beneficiary can use [web3.js library](https://web3js.readthedocs.io/en/v1.2.11) or other Ethereum client APIs to calculate param `msgHash`, `v`, `r` and `s`.

The following command can get param `msgHash`:

```js
web3.eth.accounts.hashMessage("<custom message>");
```

For example, if the `<custom message>` is `transfer benefit`, the command will return `0xa9dcce4e2c7a1f58dfc73d103356cac37e9fc97106aa7b604e9e0332a94a1ad7`. And the new beneficiary can directly use this string as the value of param `msgHash`.

> The `<custom message>` above can be any texts specified by the beneficiary.

And the following command can get signature of `<custom message>`:

```js
// You should first unlock your account corresponding to specified address at your web3 provider before running this command
web3.eth.personal.sign("<custom message>", "<address of beneficiay>");
```

> For more information of this command, please refer to [web3js docs](https://web3js.readthedocs.io/en/v1.2.11/web3-eth-personal.html#sign).

The signature will be a string which includes 130 hex characters with `0x` prefixed.

Split the signature into values of r, s and v.

* r: the first 32 bytes (the first 64 hex characters) of the signature.
* s: the 33 to 64 bytes (65 to 128 hex characters) of the signature.
* v: the last byte (the last 2 hex characters) of the signature.

The actual value of these params should be strings prefixed by `0x`. For example, if the signature is `0xc58329d32219f653ab4483e310ddef1eac266a94c875d3f3dcca3c7da7a4f2c84ab5d1582987845d6697bbba8fd8aec1ab79450d45db978d1713ed8333c0290a1b`, the param values should be:

* v: "0x1b"
* r: "0xc58329d32219f653ab4483e310ddef1eac266a94c875d3f3dcca3c7da7a4f2c8"
* s: "0x4ab5d1582987845d6697bbba8fd8aec1ab79450d45db978d1713ed8333c0290a"

Now, the new beneficiary can pass param `msgHash`, `v`, `r` and `s` to the beneficiary who wants to transfer their unreleased balances.

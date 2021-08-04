const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers")

describe("OctToken", function () {
  it("Testing scenario for contract 'OctToken'", async function () {
    const OctToken = await ethers.getContractFactory("OctToken");
    const oct = await OctToken.deploy();
    await oct.deployed();
    const decimals = BigNumber.from('1000000000000000000');

    expect(await oct.totalSupply()).to.equal(BigNumber.from('100000000').mul(decimals));

    const [owner, account1, account2] = await ethers.getSigners();
    const ownerAddress = await owner.getAddress();
    const address1 = await account1.getAddress();
    const address2 = await account2.getAddress();

    console.log('Address of owner: %s', ownerAddress);
    expect(await oct.balanceOf(ownerAddress)).to.equal(BigNumber.from('100000000').mul(decimals));

    console.log('Transfer 20000000 from %s to %s', ownerAddress, address1);
    var tx = await oct.transfer(address1, BigNumber.from('20000000').mul(decimals));
    await tx.wait();
    expect(await oct.balanceOf(address1)).to.equal(BigNumber.from('20000000').mul(decimals));

    console.log('Transfer 30000000 from %s to %s', ownerAddress, address2);
    tx = await oct.transfer(address2, BigNumber.from('30000000').mul(decimals));
    await tx.wait();
    expect(await oct.balanceOf(address2)).to.equal(BigNumber.from('30000000').mul(decimals));

    console.log('Transfer 5000000 from %s to %s while transfer is locked, should fail.', address1, address2);
    await oct.connect(account1).transfer(address2, BigNumber.from('5000000').mul(decimals)).catch((error) => {
      console.log('Successfully catched error: %s', error);
    });

    console.log('Unlock transfer.')
    tx = await oct.connect(owner).unlockTransfer();
    await tx.wait();

    console.log('Transfer 5000000 from %s to %s while transfer is unlocked, should success.', address1, address2);
    tx = await oct.connect(account1).transfer(address2, BigNumber.from('5000000').mul(decimals));
    await tx.wait();
    expect(await oct.balanceOf(address1)).to.equal(BigNumber.from('15000000').mul(decimals));
    expect(await oct.balanceOf(address2)).to.equal(BigNumber.from('35000000').mul(decimals));

    console.log('Transfer 10000000 from %s to %s while transfer is unlocked, should success.', address2, address1);
    tx = await oct.connect(account2).transfer(address1, BigNumber.from('10000000').mul(decimals));
    await tx.wait();
    expect(await oct.balanceOf(address1)).to.equal(BigNumber.from('25000000').mul(decimals));
    expect(await oct.balanceOf(address2)).to.equal(BigNumber.from('25000000').mul(decimals));
  });
});

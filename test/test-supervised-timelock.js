const { expect } = require("chai");
const { id } = require("ethers/lib/utils");
const { hashMessage } = require("ethers/lib/utils");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers")

async function withdraw(octTimelock, signer) {
  var tx = await octTimelock.connect(signer).withdraw();
  var receipt = await tx.wait();
  console.log(receipt.events?.filter((x) => { return x.event == "BenefitWithdrawed" }));
}

async function terminate(octTimelock) {
  var tx = await octTimelock.terminate();
  var receipt = await tx.wait();
  console.log(receipt.events?.filter((x) => { return x.event == "ContractIsTerminated" }));
}

describe("OctFoundationTimelock", function () {
  it("Testing scenario for contract 'SupervisedTimelock'", async function () {
    /**
     * Initialize contract 'OctToken' and contract 'SupervisedTimelock'
     */
    const decimals = BigNumber.from('1000000000000000000');

    const [owner, account1, account2] = await ethers.getSigners();
    const ownerAddress = await owner.getAddress();
    const address1 = await account1.getAddress();
    const address2 = await account2.getAddress();

    const OctToken = await ethers.getContractFactory("OctToken");
    const oct = await OctToken.deploy();
    await oct.deployed();

    const OctTimelock = await ethers.getContractFactory("SupervisedTimelock");
    const octTimelock = await OctTimelock.deploy(oct.address, address1, Math.floor(Date.now() / 1000), 5, BigNumber.from('500000').mul(decimals));
    await octTimelock.deployed();

    console.log("Address of contract 'OctToken': %s", oct.address);
    console.log("Address of contract 'SupervisedTimelock': %s", octTimelock.address);

    expect(await oct.totalSupply()).to.equal(BigNumber.from('100000000').mul(decimals));
    expect(await octTimelock.token()).to.equal(oct.address);

    console.log('Address of owner: %s', ownerAddress);
    expect(await oct.balanceOf(ownerAddress)).to.equal(BigNumber.from('100000000').mul(decimals));
    /**
     * Test initial status
     */
    console.log('Transfer 500000 from %s to %s', ownerAddress, octTimelock.address);
    var tx = await oct.transfer(octTimelock.address, BigNumber.from('500000').mul(decimals));
    await tx.wait();
    expect(await oct.balanceOf(octTimelock.address)).to.equal(BigNumber.from('500000').mul(decimals));

    expect(await octTimelock.unreleasedBalance()).to.equal(BigNumber.from('500000').mul(decimals));
    expect(await octTimelock.releasedBalance()).to.equal(0);
    expect(await octTimelock.withdrawedBalance()).to.equal(0);
    await octTimelock.connect(account1).withdraw().catch((error) => {
      console.log('Successfully catched error: %s', error);
    });
    /**
     * Test after a day passed
     */
    await hre.network.provider.send("evm_increaseTime", [86400]);
    await hre.network.provider.send("evm_mine");

    expect(await octTimelock.unreleasedBalance()).to.equal(BigNumber.from('400000').mul(decimals));
    expect(await octTimelock.releasedBalance()).to.equal(BigNumber.from('100000').mul(decimals));
    expect(await octTimelock.withdrawedBalance()).to.equal(0);
    await withdraw(octTimelock, account2);
    expect(await oct.balanceOf(address2)).to.equal(0);
    expect(await oct.balanceOf(address1)).to.equal(BigNumber.from('100000').mul(decimals));
    expect(await octTimelock.unreleasedBalance()).to.equal(BigNumber.from('400000').mul(decimals));
    expect(await octTimelock.releasedBalance()).to.equal(BigNumber.from('100000').mul(decimals));
    expect(await octTimelock.withdrawedBalance()).to.equal(BigNumber.from('100000').mul(decimals));
    await octTimelock.connect(account1).withdraw().catch((error) => {
      console.log('Successfully catched error: %s', error);
    });
    /**
     * Test after 3 days passed
     */
    await hre.network.provider.send("evm_increaseTime", [86400 * 2]);
    await hre.network.provider.send("evm_mine");

    expect(await octTimelock.unreleasedBalance()).to.equal(BigNumber.from('200000').mul(decimals));
    expect(await octTimelock.releasedBalance()).to.equal(BigNumber.from('300000').mul(decimals));
    expect(await octTimelock.withdrawedBalance()).to.equal(BigNumber.from('100000').mul(decimals));
    await withdraw(octTimelock, account2);
    expect(await oct.balanceOf(address2)).to.equal(0);
    expect(await oct.balanceOf(address1)).to.equal(BigNumber.from('300000').mul(decimals));
    expect(await octTimelock.unreleasedBalance()).to.equal(BigNumber.from('200000').mul(decimals));
    expect(await octTimelock.releasedBalance()).to.equal(BigNumber.from('300000').mul(decimals));
    expect(await octTimelock.withdrawedBalance()).to.equal(BigNumber.from('300000').mul(decimals));
    await octTimelock.connect(account1).withdraw().catch((error) => {
      console.log('Successfully catched error: %s', error);
    });
    /**
     * Test after 4 days passed
     */
    await hre.network.provider.send("evm_increaseTime", [86400]);
    await hre.network.provider.send("evm_mine");

    expect(await octTimelock.unreleasedBalance()).to.equal(BigNumber.from('100000').mul(decimals));
    expect(await octTimelock.releasedBalance()).to.equal(BigNumber.from('400000').mul(decimals));
    expect(await octTimelock.withdrawedBalance()).to.equal(BigNumber.from('300000').mul(decimals));
    await octTimelock.connect(account1).terminate().catch((error) => {
      console.log('Successfully catched error: %s', error);
    });
    await octTimelock.connect(account2).terminate().catch((error) => {
      console.log('Successfully catched error: %s', error);
    });
    await terminate(octTimelock);
    expect(await oct.balanceOf(octTimelock.address)).to.equal(BigNumber.from('100000').mul(decimals));
    expect(await oct.balanceOf(address2)).to.equal(0);
    expect(await oct.balanceOf(address1)).to.equal(BigNumber.from('300000').mul(decimals));
    expect(await oct.balanceOf(ownerAddress)).to.equal(BigNumber.from('99600000').mul(decimals));
    await withdraw(octTimelock, account2);
    expect(await oct.balanceOf(address2)).to.equal(0);
    expect(await oct.balanceOf(address1)).to.equal(BigNumber.from('400000').mul(decimals));
    expect(await octTimelock.unreleasedBalance()).to.equal(0);
    expect(await octTimelock.releasedBalance()).to.equal(BigNumber.from('400000').mul(decimals));
    expect(await octTimelock.withdrawedBalance()).to.equal(BigNumber.from('400000').mul(decimals));
    await octTimelock.connect(account1).withdraw().catch((error) => {
      console.log('Successfully catched error: %s', error);
    });
    await octTimelock.terminate().catch((error) => {
      console.log('Successfully catched error: %s', error);
    });
  });
});

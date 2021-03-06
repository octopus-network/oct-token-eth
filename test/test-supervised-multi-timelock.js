const { expect } = require("chai");
const { id } = require("ethers/lib/utils");
const { hashMessage } = require("ethers/lib/utils");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers")

async function issueBenefitTo(multiTimelock, address, amount, releaseStartTime, daysOfTimelock) {
  var tx = await multiTimelock.issueBenefitTo(address, amount, releaseStartTime, daysOfTimelock);
  var receipt = await tx.wait();
  console.log(receipt.events?.filter((x) => { return x.event == "BenefitIsIssued" }));
}

async function withdrawBenefitOf(multiTimelock, signer, address) {
  var tx = await multiTimelock.connect(signer).withdrawBenefitOf(address);
  var receipt = await tx.wait();
  console.log(receipt.events?.filter((x) => { return x.event == "BenefitIsWithdrawn" }));
}

async function terminateBenefitOf(multiTimelock, address) {
  var tx = await multiTimelock.terminateBenefitOf(address);
  var receipt = await tx.wait();
  console.log(receipt.events?.filter((x) => { return x.event == "BenefitIsTerminated" }));
}

async function withdrawRemainingBenefit(multiTimelock, amount) {
  var tx = await multiTimelock.withdrawRemainingBenefit(amount);
  var receipt = await tx.wait();
  console.log(receipt.events?.filter((x) => { return x.event == "BenefitIsWithdrawn" }));
}

describe("SupervisedMultiTimelock", function () {
  it("Testing scenario for contract 'SupervisedMultiTimelock'", async function () {
    /**
     * Initialize contract 'OctToken' and contract 'SupervisedMultiTimelock'
     */
    const decimals = BigNumber.from('1000000000000000000');

    const [owner, account1, account2, account3, account4] = await ethers.getSigners();
    const ownerAddress = await owner.getAddress();
    const address1 = await account1.getAddress();
    const address2 = await account2.getAddress();
    const address3 = await account3.getAddress();
    const address4 = await account4.getAddress();

    const OctToken = await ethers.getContractFactory("OctToken");
    const oct = await OctToken.deploy();
    await oct.deployed();

    const OctTimelock = await ethers.getContractFactory("SupervisedMultiTimelock");
    const multiTimelock = await OctTimelock.deploy(oct.address);
    await multiTimelock.deployed();

    console.log("Address of contract 'OctToken': %s", oct.address);
    console.log("Address of contract 'SupervisedMultiTimelock': %s", multiTimelock.address);

    expect(await oct.totalSupply()).to.equal(BigNumber.from('100000000').mul(decimals));
    expect(await multiTimelock.token()).to.equal(oct.address);

    console.log('Address of owner: %s', ownerAddress);
    expect(await oct.balanceOf(ownerAddress)).to.equal(BigNumber.from('100000000').mul(decimals));
    /**
     * Transfer OCT token to contract
     */
    console.log('Transfer 500000 from %s to %s', ownerAddress, multiTimelock.address);
    var tx = await oct.transfer(multiTimelock.address, BigNumber.from('500000').mul(decimals));
    await tx.wait();
    expect(await oct.balanceOf(multiTimelock.address)).to.equal(BigNumber.from('500000').mul(decimals));

    console.log('Withdraw remaining benefit');
    await withdrawRemainingBenefit(multiTimelock, BigNumber.from('500000').mul(decimals));
    expect(await oct.balanceOf(multiTimelock.address)).to.equal(BigNumber.from('0').mul(decimals));
    expect(await oct.balanceOf(ownerAddress)).to.equal(BigNumber.from('100000000').mul(decimals));

    console.log('Transfer 1150000 from %s to %s', ownerAddress, multiTimelock.address);
    var tx = await oct.transfer(multiTimelock.address, BigNumber.from('1150000').mul(decimals));
    await tx.wait();
    expect(await oct.balanceOf(multiTimelock.address)).to.equal(BigNumber.from('1150000').mul(decimals));
    /**
     * Issue benefit to address1
     */
    await issueBenefitTo(multiTimelock, address1, BigNumber.from('500000').mul(decimals), Math.floor(Date.now() / 1000), 5);
    expect(await multiTimelock.issuedBenefitOf(address1)).to.equal(BigNumber.from('500000').mul(decimals));
    expect(await multiTimelock.unreleasedAmountOf(address1)).to.equal(BigNumber.from('500000').mul(decimals));
    expect(await multiTimelock.releasedAmountOf(address1)).to.equal(BigNumber.from('0').mul(decimals));
    expect(await multiTimelock.withdrawnAmountOf(address1)).to.equal(BigNumber.from('0').mul(decimals));
    await multiTimelock.issueBenefitTo(address1, BigNumber.from('200000').mul(decimals), Math.floor(Date.now() / 1000), 5).catch((error) => {
      console.log('Successfully catched error: %s', error);
    });
    await multiTimelock.connect(account1).withdrawBenefitOf(address1).catch((error) => {
      console.log('Successfully catched error: %s', error);
    });
    /**
     * Issue benefit to address3
     */
    await issueBenefitTo(multiTimelock, address3, BigNumber.from('500000').mul(decimals), Math.floor(Date.now() / 1000), 4);
    expect(await multiTimelock.issuedBenefitOf(address3)).to.equal(BigNumber.from('500000').mul(decimals));
    expect(await multiTimelock.unreleasedAmountOf(address3)).to.equal(BigNumber.from('500000').mul(decimals));
    expect(await multiTimelock.releasedAmountOf(address3)).to.equal(BigNumber.from('0').mul(decimals));
    expect(await multiTimelock.withdrawnAmountOf(address3)).to.equal(BigNumber.from('0').mul(decimals));
    await multiTimelock.issueBenefitTo(address3, BigNumber.from('300000').mul(decimals), Math.floor(Date.now() / 1000), 3).catch((error) => {
      console.log('Successfully catched error: %s', error);
    });
    await multiTimelock.connect(account2).withdrawBenefitOf(address3).catch((error) => {
      console.log('Successfully catched error: %s', error);
    });
    /**
     * Issue benefit to address4
     */
    await issueBenefitTo(multiTimelock, address4, BigNumber.from('360000').mul(decimals), Math.floor(Date.now() / 1000), 3);
    expect(await multiTimelock.issuedBenefitOf(address4)).to.equal(BigNumber.from('360000').mul(decimals));
    expect(await multiTimelock.unreleasedAmountOf(address4)).to.equal(BigNumber.from('360000').mul(decimals));
    expect(await multiTimelock.releasedAmountOf(address4)).to.equal(BigNumber.from('0').mul(decimals));
    expect(await multiTimelock.withdrawnAmountOf(address4)).to.equal(BigNumber.from('0').mul(decimals));
    await multiTimelock.issueBenefitTo(address4, BigNumber.from('400000').mul(decimals), Math.floor(Date.now() / 1000), 4).catch((error) => {
      console.log('Successfully catched error: %s', error);
    });
    await multiTimelock.connect(account1).withdrawBenefitOf(address4).catch((error) => {
      console.log('Successfully catched error: %s', error);
    });
    /**
     * Terminate benefit of address4 and issue benefit again
     */
    await terminateBenefitOf(multiTimelock, address4);
    expect(await multiTimelock.issuedBenefitOf(address4)).to.equal(BigNumber.from('0').mul(decimals));
    expect(await multiTimelock.unreleasedAmountOf(address4)).to.equal(BigNumber.from('0').mul(decimals));
    expect(await multiTimelock.releasedAmountOf(address4)).to.equal(BigNumber.from('0').mul(decimals));
    expect(await multiTimelock.withdrawnAmountOf(address4)).to.equal(BigNumber.from('0').mul(decimals));
    await issueBenefitTo(multiTimelock, address4, BigNumber.from('330000').mul(decimals), Math.floor(Date.now() / 1000), 3);
    expect(await multiTimelock.issuedBenefitOf(address4)).to.equal(BigNumber.from('330000').mul(decimals));
    expect(await multiTimelock.unreleasedAmountOf(address4)).to.equal(BigNumber.from('330000').mul(decimals));
    expect(await multiTimelock.releasedAmountOf(address4)).to.equal(BigNumber.from('0').mul(decimals));
    expect(await multiTimelock.withdrawnAmountOf(address4)).to.equal(BigNumber.from('0').mul(decimals));
    await multiTimelock.issueBenefitTo(address4, BigNumber.from('400000').mul(decimals), Math.floor(Date.now() / 1000), 4).catch((error) => {
      console.log('Successfully catched error: %s', error);
    });
    await multiTimelock.connect(account1).withdrawBenefitOf(address4).catch((error) => {
      console.log('Successfully catched error: %s', error);
    });
    /**
     * Pass a day
     */
    await hre.network.provider.send("evm_increaseTime", [86400]);
    await hre.network.provider.send("evm_mine");
    /**
     * Confirm status of address1
     */
    expect(await multiTimelock.issuedBenefitOf(address1)).to.equal(BigNumber.from('500000').mul(decimals));
    expect(await multiTimelock.unreleasedAmountOf(address1)).to.equal(BigNumber.from('400000').mul(decimals));
    expect(await multiTimelock.releasedAmountOf(address1)).to.equal(BigNumber.from('100000').mul(decimals));
    expect(await multiTimelock.withdrawnAmountOf(address1)).to.equal(BigNumber.from('0').mul(decimals));
    await withdrawBenefitOf(multiTimelock, account2, address1);
    expect(await oct.balanceOf(address2)).to.equal(BigNumber.from('0').mul(decimals));
    expect(await oct.balanceOf(address1)).to.equal(BigNumber.from('100000').mul(decimals));
    expect(await oct.balanceOf(multiTimelock.address)).to.equal(BigNumber.from('1050000').mul(decimals));
    expect(await multiTimelock.issuedBenefitOf(address1)).to.equal(BigNumber.from('500000').mul(decimals));
    expect(await multiTimelock.unreleasedAmountOf(address1)).to.equal(BigNumber.from('400000').mul(decimals));
    expect(await multiTimelock.releasedAmountOf(address1)).to.equal(BigNumber.from('100000').mul(decimals));
    expect(await multiTimelock.withdrawnAmountOf(address1)).to.equal(BigNumber.from('100000').mul(decimals));
    await multiTimelock.connect(account1).withdrawBenefitOf(address1).catch((error) => {
      console.log('Successfully catched error: %s', error);
    });
    /**
     * Confirm status of address3
     */
    expect(await multiTimelock.issuedBenefitOf(address3)).to.equal(BigNumber.from('500000').mul(decimals));
    expect(await multiTimelock.unreleasedAmountOf(address3)).to.equal(BigNumber.from('375000').mul(decimals));
    expect(await multiTimelock.releasedAmountOf(address3)).to.equal(BigNumber.from('125000').mul(decimals));
    expect(await multiTimelock.withdrawnAmountOf(address3)).to.equal(BigNumber.from('0').mul(decimals));
    await withdrawBenefitOf(multiTimelock, account2, address3);
    expect(await oct.balanceOf(address2)).to.equal(BigNumber.from('0').mul(decimals));
    expect(await oct.balanceOf(address3)).to.equal(BigNumber.from('125000').mul(decimals));
    expect(await oct.balanceOf(multiTimelock.address)).to.equal(BigNumber.from('925000').mul(decimals));
    expect(await multiTimelock.issuedBenefitOf(address3)).to.equal(BigNumber.from('500000').mul(decimals));
    expect(await multiTimelock.unreleasedAmountOf(address3)).to.equal(BigNumber.from('375000').mul(decimals));
    expect(await multiTimelock.releasedAmountOf(address3)).to.equal(BigNumber.from('125000').mul(decimals));
    expect(await multiTimelock.withdrawnAmountOf(address3)).to.equal(BigNumber.from('125000').mul(decimals));
    await multiTimelock.connect(account3).withdrawBenefitOf(address3).catch((error) => {
      console.log('Successfully catched error: %s', error);
    });
    /**
     * Confirm status of address4
     */
    expect(await multiTimelock.issuedBenefitOf(address4)).to.equal(BigNumber.from('330000').mul(decimals));
    expect(await multiTimelock.unreleasedAmountOf(address4)).to.equal(BigNumber.from('220000').mul(decimals));
    expect(await multiTimelock.releasedAmountOf(address4)).to.equal(BigNumber.from('110000').mul(decimals));
    expect(await multiTimelock.withdrawnAmountOf(address4)).to.equal(BigNumber.from('0').mul(decimals));
    await withdrawBenefitOf(multiTimelock, account2, address4);
    expect(await oct.balanceOf(address2)).to.equal(BigNumber.from('0').mul(decimals));
    expect(await oct.balanceOf(address4)).to.equal(BigNumber.from('110000').mul(decimals));
    expect(await oct.balanceOf(multiTimelock.address)).to.equal(BigNumber.from('815000').mul(decimals));
    expect(await multiTimelock.issuedBenefitOf(address4)).to.equal(BigNumber.from('330000').mul(decimals));
    expect(await multiTimelock.unreleasedAmountOf(address4)).to.equal(BigNumber.from('220000').mul(decimals));
    expect(await multiTimelock.releasedAmountOf(address4)).to.equal(BigNumber.from('110000').mul(decimals));
    expect(await multiTimelock.withdrawnAmountOf(address4)).to.equal(BigNumber.from('110000').mul(decimals));
    await multiTimelock.connect(account4).withdrawBenefitOf(address4).catch((error) => {
      console.log('Successfully catched error: %s', error);
    });
    /**
     * Pass 3 days
     */
    await hre.network.provider.send("evm_increaseTime", [86400 * 2]);
    await hre.network.provider.send("evm_mine");
    /**
     * Confirm status of address1
     */
    expect(await multiTimelock.issuedBenefitOf(address1)).to.equal(BigNumber.from('500000').mul(decimals));
    expect(await multiTimelock.unreleasedAmountOf(address1)).to.equal(BigNumber.from('200000').mul(decimals));
    expect(await multiTimelock.releasedAmountOf(address1)).to.equal(BigNumber.from('300000').mul(decimals));
    expect(await multiTimelock.withdrawnAmountOf(address1)).to.equal(BigNumber.from('100000').mul(decimals));
    await withdrawBenefitOf(multiTimelock, account2, address1);
    expect(await oct.balanceOf(address2)).to.equal(BigNumber.from('0').mul(decimals));
    expect(await oct.balanceOf(address1)).to.equal(BigNumber.from('300000').mul(decimals));
    expect(await oct.balanceOf(multiTimelock.address)).to.equal(BigNumber.from('615000').mul(decimals));
    expect(await multiTimelock.issuedBenefitOf(address1)).to.equal(BigNumber.from('500000').mul(decimals));
    expect(await multiTimelock.unreleasedAmountOf(address1)).to.equal(BigNumber.from('200000').mul(decimals));
    expect(await multiTimelock.releasedAmountOf(address1)).to.equal(BigNumber.from('300000').mul(decimals));
    expect(await multiTimelock.withdrawnAmountOf(address1)).to.equal(BigNumber.from('300000').mul(decimals));
    await multiTimelock.connect(account1).withdrawBenefitOf(address1).catch((error) => {
      console.log('Successfully catched error: %s', error);
    });
    /**
     * Confirm status of address3
     */
    expect(await multiTimelock.issuedBenefitOf(address3)).to.equal(BigNumber.from('500000').mul(decimals));
    expect(await multiTimelock.unreleasedAmountOf(address3)).to.equal(BigNumber.from('125000').mul(decimals));
    expect(await multiTimelock.releasedAmountOf(address3)).to.equal(BigNumber.from('375000').mul(decimals));
    expect(await multiTimelock.withdrawnAmountOf(address3)).to.equal(BigNumber.from('125000').mul(decimals));
    await withdrawBenefitOf(multiTimelock, account2, address3);
    expect(await oct.balanceOf(address2)).to.equal(BigNumber.from('0').mul(decimals));
    expect(await oct.balanceOf(address3)).to.equal(BigNumber.from('375000').mul(decimals));
    expect(await oct.balanceOf(multiTimelock.address)).to.equal(BigNumber.from('365000').mul(decimals));
    expect(await multiTimelock.issuedBenefitOf(address3)).to.equal(BigNumber.from('500000').mul(decimals));
    expect(await multiTimelock.unreleasedAmountOf(address3)).to.equal(BigNumber.from('125000').mul(decimals));
    expect(await multiTimelock.releasedAmountOf(address3)).to.equal(BigNumber.from('375000').mul(decimals));
    expect(await multiTimelock.withdrawnAmountOf(address3)).to.equal(BigNumber.from('375000').mul(decimals));
    await multiTimelock.connect(account3).withdrawBenefitOf(address3).catch((error) => {
      console.log('Successfully catched error: %s', error);
    });
    /**
     * Confirm status of address4
     */
    expect(await multiTimelock.issuedBenefitOf(address4)).to.equal(BigNumber.from('330000').mul(decimals));
    expect(await multiTimelock.unreleasedAmountOf(address4)).to.equal(BigNumber.from('0').mul(decimals));
    expect(await multiTimelock.releasedAmountOf(address4)).to.equal(BigNumber.from('330000').mul(decimals));
    expect(await multiTimelock.withdrawnAmountOf(address4)).to.equal(BigNumber.from('110000').mul(decimals));
    await withdrawBenefitOf(multiTimelock, account2, address4);
    expect(await oct.balanceOf(address2)).to.equal(BigNumber.from('0').mul(decimals));
    expect(await oct.balanceOf(address4)).to.equal(BigNumber.from('330000').mul(decimals));
    expect(await oct.balanceOf(multiTimelock.address)).to.equal(BigNumber.from('145000').mul(decimals));
    expect(await multiTimelock.issuedBenefitOf(address4)).to.equal(BigNumber.from('330000').mul(decimals));
    expect(await multiTimelock.unreleasedAmountOf(address4)).to.equal(BigNumber.from('0').mul(decimals));
    expect(await multiTimelock.releasedAmountOf(address4)).to.equal(BigNumber.from('330000').mul(decimals));
    expect(await multiTimelock.withdrawnAmountOf(address4)).to.equal(BigNumber.from('330000').mul(decimals));
    await multiTimelock.connect(account4).withdrawBenefitOf(address4).catch((error) => {
      console.log('Successfully catched error: %s', error);
    });
    /**
     * Terminate benefit of address3
     */
    await terminateBenefitOf(multiTimelock, address3);
    expect(await multiTimelock.issuedBenefitOf(address3)).to.equal(BigNumber.from('0').mul(decimals));
    expect(await multiTimelock.unreleasedAmountOf(address3)).to.equal(BigNumber.from('0').mul(decimals));
    expect(await multiTimelock.releasedAmountOf(address3)).to.equal(BigNumber.from('0').mul(decimals));
    expect(await multiTimelock.withdrawnAmountOf(address3)).to.equal(BigNumber.from('0').mul(decimals));
    await multiTimelock.issueBenefitTo(address3, BigNumber.from('200000').mul(decimals), Math.floor(Date.now() / 1000), 5);
    expect(await multiTimelock.issuedBenefitOf(address3)).to.equal(BigNumber.from('200000').mul(decimals));
    expect(await multiTimelock.unreleasedAmountOf(address3)).to.equal(BigNumber.from('80000').mul(decimals));
    expect(await multiTimelock.releasedAmountOf(address3)).to.equal(BigNumber.from('120000').mul(decimals));
    expect(await multiTimelock.withdrawnAmountOf(address3)).to.equal(BigNumber.from('0').mul(decimals));
    /**
     * Pass 6 days
     */
    await hre.network.provider.send("evm_increaseTime", [86400 * 3]);
    await hre.network.provider.send("evm_mine");
    /**
     * Confirm status of address1
     */
    expect(await multiTimelock.issuedBenefitOf(address1)).to.equal(BigNumber.from('500000').mul(decimals));
    expect(await multiTimelock.unreleasedAmountOf(address1)).to.equal(BigNumber.from('0').mul(decimals));
    expect(await multiTimelock.releasedAmountOf(address1)).to.equal(BigNumber.from('500000').mul(decimals));
    expect(await multiTimelock.withdrawnAmountOf(address1)).to.equal(BigNumber.from('300000').mul(decimals));
    await multiTimelock.connect(account1).withdrawBenefitOf(address1).catch((error) => {
      console.log('Successfully catched error: %s', error);
    });
    console.log('Transfer 400000 from %s to %s', ownerAddress, multiTimelock.address);
    var tx = await oct.transfer(multiTimelock.address, BigNumber.from('400000').mul(decimals));
    await tx.wait();
    expect(await oct.balanceOf(multiTimelock.address)).to.equal(BigNumber.from('545000').mul(decimals));
    await withdrawBenefitOf(multiTimelock, account2, address1);
    expect(await oct.balanceOf(address2)).to.equal(BigNumber.from('0').mul(decimals));
    expect(await oct.balanceOf(address1)).to.equal(BigNumber.from('500000').mul(decimals));
    expect(await oct.balanceOf(multiTimelock.address)).to.equal(BigNumber.from('345000').mul(decimals));
    expect(await multiTimelock.issuedBenefitOf(address1)).to.equal(BigNumber.from('500000').mul(decimals));
    expect(await multiTimelock.unreleasedAmountOf(address1)).to.equal(BigNumber.from('0').mul(decimals));
    expect(await multiTimelock.releasedAmountOf(address1)).to.equal(BigNumber.from('500000').mul(decimals));
    expect(await multiTimelock.withdrawnAmountOf(address1)).to.equal(BigNumber.from('500000').mul(decimals));
    await multiTimelock.connect(account1).withdrawBenefitOf(address1).catch((error) => {
      console.log('Successfully catched error: %s', error);
    });
    /**
     * Confirm status of address3
     */
    expect(await multiTimelock.issuedBenefitOf(address3)).to.equal(BigNumber.from('200000').mul(decimals));
    expect(await multiTimelock.unreleasedAmountOf(address3)).to.equal(BigNumber.from('0').mul(decimals));
    expect(await multiTimelock.releasedAmountOf(address3)).to.equal(BigNumber.from('200000').mul(decimals));
    expect(await multiTimelock.withdrawnAmountOf(address3)).to.equal(BigNumber.from('0').mul(decimals));
    await withdrawBenefitOf(multiTimelock, account2, address3);
    expect(await oct.balanceOf(address2)).to.equal(BigNumber.from('0').mul(decimals));
    expect(await oct.balanceOf(address3)).to.equal(BigNumber.from('575000').mul(decimals));
    expect(await oct.balanceOf(multiTimelock.address)).to.equal(BigNumber.from('145000').mul(decimals));
    expect(await multiTimelock.issuedBenefitOf(address3)).to.equal(BigNumber.from('200000').mul(decimals));
    expect(await multiTimelock.unreleasedAmountOf(address3)).to.equal(BigNumber.from('0').mul(decimals));
    expect(await multiTimelock.releasedAmountOf(address3)).to.equal(BigNumber.from('200000').mul(decimals));
    expect(await multiTimelock.withdrawnAmountOf(address3)).to.equal(BigNumber.from('200000').mul(decimals));
    await multiTimelock.connect(account3).withdrawBenefitOf(address3).catch((error) => {
      console.log('Successfully catched error: %s', error);
    });
    /**
    * Confirm status of address4
    */
    expect(await multiTimelock.issuedBenefitOf(address4)).to.equal(BigNumber.from('330000').mul(decimals));
    expect(await multiTimelock.unreleasedAmountOf(address4)).to.equal(BigNumber.from('0').mul(decimals));
    expect(await multiTimelock.releasedAmountOf(address4)).to.equal(BigNumber.from('330000').mul(decimals));
    expect(await multiTimelock.withdrawnAmountOf(address4)).to.equal(BigNumber.from('330000').mul(decimals));
    await multiTimelock.connect(account4).withdrawBenefitOf(address4).catch((error) => {
      console.log('Successfully catched error: %s', error);
    });
    /**
     * Withdraw remaining benefit
     */
    console.log('Withdraw remaining benefit');
    await withdrawRemainingBenefit(multiTimelock, BigNumber.from('145000').mul(decimals));
    expect(await oct.balanceOf(multiTimelock.address)).to.equal(BigNumber.from('0').mul(decimals));
    expect(await oct.balanceOf(ownerAddress)).to.equal(BigNumber.from('98595000').mul(decimals));
  });
});

const { expect } = require("chai");
const { id } = require("ethers/lib/utils");
const { ethers } = require("hardhat");

async function benefit(octTimelock, addr, amount, supervised) {
  var tx = await octTimelock.benefit(addr, amount, supervised);
  var receipt = await tx.wait();
  console.log(receipt.events?.filter((x) => { return x.event == "BenefitAdded" }));
}

async function transferUnreleasedBalance(octTimelock, signer, addr, amount) {
  var tx = await octTimelock.connect(signer).transferUnreleasedBalance(addr, amount);
  var receipt = await tx.wait();
  console.log(receipt.events?.filter((x) => { return x.event == "BenefitTransfered" }));
}

async function decreaseBenefitOf(octTimelock, addr, amount) {
  var tx = await octTimelock.decreaseBenefitOf(addr, amount);
  var receipt = await tx.wait();
  console.log(receipt.events?.filter((x) => { return x.event == "BenefitReduced" }));
}

async function withdraw(octTimelock, signer, amount) {
  var tx = await octTimelock.connect(signer).withdraw(amount);
  var receipt = await tx.wait();
  console.log(receipt.events?.filter((x) => { return x.event == "BenefitWithdrawed" }));
}

describe("OctFoundationTimelock", function () {
  it("Testing scenario for contract 'OctFoundationTimelock'", async function () {
    /**
     * Initialize contract 'OctToken' and contract 'OctFoundationTimelock'
     */
    const OctToken = await ethers.getContractFactory("OctToken");
    const oct = await OctToken.deploy();
    await oct.deployed();

    const OctTimelock = await ethers.getContractFactory("OctFoundationTimelock");
    const octTimelock = await OctTimelock.deploy(oct.address);
    await octTimelock.deployed();

    console.log("Address of contract 'OctToken': %s", oct.address);
    console.log("Address of contract 'OctFoundationTimelock': %s", octTimelock.address);

    expect(await oct.totalSupply()).to.equal(100000000);
    expect(await octTimelock.token()).to.equal(oct.address);

    const [owner, account1, account2] = await ethers.getSigners();
    const ownerAddress = await owner.getAddress();
    const address1 = await account1.getAddress();
    const address2 = await account2.getAddress();

    console.log('Address of owner: %s', ownerAddress);
    expect(await oct.balanceOf(ownerAddress)).to.equal(100000000);

    console.log('Transfer 30000000 from %s to %s', ownerAddress, octTimelock.address);
    var tx = await oct.transfer(octTimelock.address, 30000000);
    await tx.wait();
    expect(await oct.balanceOf(octTimelock.address)).to.equal(30000000);
    /**
     * Test contract 'OctFundationTimelock', before 'EARLIST_RELEASE_START_TIME'
     */
    await benefit(octTimelock, address1, 4000000, false);
    expect(await octTimelock.unreleasedBalanceOf(address1)).to.equal(4000000);
    expect(await octTimelock.unreleasedSupervisedBalanceOf(address1)).to.equal(0);
    expect(await octTimelock.releasedBalanceOf(address1)).to.equal(0);
    expect(await octTimelock.withdrawedBalanceOf(address1)).to.equal(0);
    await benefit(octTimelock, address1, 1000000, false);
    expect(await octTimelock.unreleasedBalanceOf(address1)).to.equal(5000000);
    expect(await octTimelock.unreleasedSupervisedBalanceOf(address1)).to.equal(0);
    expect(await octTimelock.releasedBalanceOf(address1)).to.equal(0);
    expect(await octTimelock.withdrawedBalanceOf(address1)).to.equal(0);
    await benefit(octTimelock, address1, 2000000, true);
    expect(await octTimelock.unreleasedBalanceOf(address1)).to.equal(5000000);
    expect(await octTimelock.unreleasedSupervisedBalanceOf(address1)).to.equal(2000000);
    expect(await octTimelock.releasedBalanceOf(address1)).to.equal(0);
    expect(await octTimelock.withdrawedBalanceOf(address1)).to.equal(0);
    await octTimelock.connect(account1).withdraw(1000000).catch((error) => {
      console.log('Successfully catched error: %s', error);
    });
    await octTimelock.connect(account1).benefit(address2, 1000000, false).catch((error) => {
      console.log('Successfully catched error: %s', error);
    });
    await transferUnreleasedBalance(octTimelock, account1, address2, 1000000);
    expect(await octTimelock.unreleasedBalanceOf(address1)).to.equal(4000000);
    expect(await octTimelock.unreleasedSupervisedBalanceOf(address1)).to.equal(2000000);
    expect(await octTimelock.releasedBalanceOf(address1)).to.equal(0);
    expect(await octTimelock.withdrawedBalanceOf(address1)).to.equal(0);
    expect(await octTimelock.unreleasedBalanceOf(address2)).to.equal(1000000);
    expect(await octTimelock.unreleasedSupervisedBalanceOf(address2)).to.equal(0);
    expect(await octTimelock.releasedBalanceOf(address2)).to.equal(0);
    expect(await octTimelock.withdrawedBalanceOf(address2)).to.equal(0);
    await decreaseBenefitOf(octTimelock, address1, 1000000);
    expect(await octTimelock.unreleasedBalanceOf(address1)).to.equal(4000000);
    expect(await octTimelock.unreleasedSupervisedBalanceOf(address1)).to.equal(1000000);
    expect(await octTimelock.releasedBalanceOf(address1)).to.equal(0);
    expect(await octTimelock.withdrawedBalanceOf(address1)).to.equal(0);
    await octTimelock.decreaseBenefitOf(address2, 1000000).catch((error) => {
      console.log('Successfully catched error: %s', error);
    });
    /**
     * Unlock transfer on OctToken
     */
    console.log("Unlock transfer in contract 'OctToken'.");
    tx = await oct.connect(owner).unlockTransfer();
    await tx.wait();
    /**
     * Change network time to '2022/09/01 00:00:00'
     */
    var secondsToEarlisestReleaseTime = 1630454400 - Math.floor(Date.now() / 1000);
    await hre.network.provider.send("evm_increaseTime", [secondsToEarlisestReleaseTime + 1661990400 - 1630454400]);
    await hre.network.provider.send("evm_mine");
    expect(await octTimelock.unreleasedBalanceOf(address1)).to.equal(2667884);
    expect(await octTimelock.unreleasedSupervisedBalanceOf(address1)).to.equal(666971);
    expect(await octTimelock.releasedBalanceOf(address1)).to.equal(1665145);
    expect(await octTimelock.withdrawedBalanceOf(address1)).to.equal(0);
    expect(await octTimelock.unreleasedBalanceOf(address2)).to.equal(666971);
    expect(await octTimelock.unreleasedSupervisedBalanceOf(address2)).to.equal(0);
    expect(await octTimelock.releasedBalanceOf(address2)).to.equal(333029);
    expect(await octTimelock.withdrawedBalanceOf(address2)).to.equal(0);
    /**
     * Test 'withdraw'
     */
    await withdraw(octTimelock, account1, 1000000);
    expect(await octTimelock.unreleasedBalanceOf(address1)).to.equal(2667884);
    expect(await octTimelock.unreleasedSupervisedBalanceOf(address1)).to.equal(666971);
    expect(await octTimelock.releasedBalanceOf(address1)).to.equal(1665145);
    expect(await octTimelock.withdrawedBalanceOf(address1)).to.equal(1000000);
    await octTimelock.connect(account1).withdraw(665146).catch((error) => {
      console.log('Successfully catched error: %s', error);
    });
    await withdraw(octTimelock, account1, 665145);
    expect(await octTimelock.unreleasedBalanceOf(address1)).to.equal(2667884);
    expect(await octTimelock.unreleasedSupervisedBalanceOf(address1)).to.equal(666971);
    expect(await octTimelock.releasedBalanceOf(address1)).to.equal(1665145);
    expect(await octTimelock.withdrawedBalanceOf(address1)).to.equal(1665145);
    /**
     * Test 'transferUnreleasedBalance'
     */
    await octTimelock.connect(account1).transferUnreleasedBalance(address2, 2800000).catch((error) => {
      console.log('Successfully catched error: %s', error);
    });
    await transferUnreleasedBalance(octTimelock, account1, address2, 1000000);
    expect(await octTimelock.unreleasedBalanceOf(address1)).to.equal(1667884);
    expect(await octTimelock.unreleasedSupervisedBalanceOf(address1)).to.equal(666971);
    expect(await octTimelock.releasedBalanceOf(address1)).to.equal(1665145);
    expect(await octTimelock.withdrawedBalanceOf(address1)).to.equal(1665145);
    expect(await octTimelock.unreleasedBalanceOf(address2)).to.equal(1666971);
    expect(await octTimelock.unreleasedSupervisedBalanceOf(address2)).to.equal(0);
    expect(await octTimelock.releasedBalanceOf(address2)).to.equal(333029);
    expect(await octTimelock.withdrawedBalanceOf(address2)).to.equal(0);
    /**
     * Test 'decreaseBenefitOf'
     */
    await octTimelock.decreaseBenefitOf(address2, 100000).catch((error) => {
      console.log('Successfully catched error: %s', error);
    });
    await octTimelock.decreaseBenefitOf(address1, 695000).catch((error) => {
      console.log('Successfully catched error: %s', error);
    });
    await decreaseBenefitOf(octTimelock, address1, 200000);
    expect(await octTimelock.unreleasedBalanceOf(address1)).to.equal(1667884);
    expect(await octTimelock.unreleasedSupervisedBalanceOf(address1)).to.equal(466971);
    expect(await octTimelock.releasedBalanceOf(address1)).to.equal(1665145);
    expect(await octTimelock.withdrawedBalanceOf(address1)).to.equal(1665145);
    expect(await octTimelock.unreleasedBalanceOf(address2)).to.equal(1666971);
    expect(await octTimelock.unreleasedSupervisedBalanceOf(address2)).to.equal(0);
    expect(await octTimelock.releasedBalanceOf(address2)).to.equal(333029);
    expect(await octTimelock.withdrawedBalanceOf(address2)).to.equal(0);
    /**
     * Test 'benefit'
     */
    await benefit(octTimelock, address1, 100000, true);
    expect(await octTimelock.unreleasedBalanceOf(address1)).to.equal(1667884);
    expect(await octTimelock.unreleasedSupervisedBalanceOf(address1)).to.equal(566971);
    expect(await octTimelock.releasedBalanceOf(address1)).to.equal(1665145);
    expect(await octTimelock.withdrawedBalanceOf(address1)).to.equal(1665145);
    await benefit(octTimelock, address2, 1000000, false);
    expect(await octTimelock.unreleasedBalanceOf(address2)).to.equal(2666971);
    expect(await octTimelock.unreleasedSupervisedBalanceOf(address2)).to.equal(0);
    expect(await octTimelock.releasedBalanceOf(address2)).to.equal(333029);
    expect(await octTimelock.withdrawedBalanceOf(address2)).to.equal(0);
    /**
     * Change network time to '2023/09/01 00:00:00'
     */
    await hre.network.provider.send("evm_increaseTime", [secondsToEarlisestReleaseTime + 1693526400 - 1661990400]);
    await hre.network.provider.send("evm_mine");
    expect(await octTimelock.unreleasedBalanceOf(address1)).to.equal(771197);
    expect(await octTimelock.unreleasedSupervisedBalanceOf(address1)).to.equal(262157);
    expect(await octTimelock.releasedBalanceOf(address1)).to.equal(2866646);
    expect(await octTimelock.withdrawedBalanceOf(address1)).to.equal(1665145);
    expect(await octTimelock.unreleasedBalanceOf(address2)).to.equal(1233155);
    expect(await octTimelock.unreleasedSupervisedBalanceOf(address2)).to.equal(0);
    expect(await octTimelock.releasedBalanceOf(address2)).to.equal(1766845);
    expect(await octTimelock.withdrawedBalanceOf(address2)).to.equal(0);
    /**
     * Change network time to '2025/09/01 00:00:00'
     */
    await hre.network.provider.send("evm_increaseTime", [secondsToEarlisestReleaseTime + 1756684800 - 1693526400]);
    await hre.network.provider.send("evm_mine");
    expect(await octTimelock.unreleasedBalanceOf(address1)).to.equal(0);
    expect(await octTimelock.unreleasedSupervisedBalanceOf(address1)).to.equal(0);
    expect(await octTimelock.releasedBalanceOf(address1)).to.equal(3900000);
    expect(await octTimelock.withdrawedBalanceOf(address1)).to.equal(1665145);
    expect(await octTimelock.unreleasedBalanceOf(address2)).to.equal(0);
    expect(await octTimelock.unreleasedSupervisedBalanceOf(address2)).to.equal(0);
    expect(await octTimelock.releasedBalanceOf(address2)).to.equal(3000000);
    expect(await octTimelock.withdrawedBalanceOf(address2)).to.equal(0);
  });
});

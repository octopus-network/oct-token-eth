const { expect } = require("chai");
const { ethers } = require("hardhat");

async function benefit(octTimelock, addr, amount, supervised) {
  console.log('Benefit %s by %d with %s supervised', addr, amount, supervised);
  var tx = await octTimelock.benefit(addr, amount, supervised);
  await tx.wait();
}

async function transferUnreleasedBalance(octTimelock, signer, addr, amount) {
  console.log('Transfer unreleased balance %d from %s to %s', amount, await signer.getAddress(), addr);
  var tx = await octTimelock.connect(signer).transferUnreleasedBalance(addr, amount);
  await tx.wait();
}

async function decreaseBenefitOf(octTimelock, addr, amount) {
  console.log('Decrease unreleased supervised balance %d of %s', amount, addr);
  var tx = await octTimelock.decreaseBenefitOf(addr, amount);
  await tx.wait();
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
     * Start testing contract 'OctFundationTimelock', before 'EARLIST_RELEASE_START_TIME'
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
  });
});

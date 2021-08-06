const { expect } = require("chai");
const { id } = require("ethers/lib/utils");
const { hashMessage } = require("ethers/lib/utils");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers")

async function benefit(octTimelock, addr, amount, supervised) {
  var tx = await octTimelock.benefit(addr, amount, supervised);
  var receipt = await tx.wait();
  console.log(receipt.events?.filter((x) => { return x.event == "BenefitAdded" }));
}

async function transferUnreleasedBalance(octTimelock, signer, accountOfAddr, addr, amount) {
  var msg = "transfer benefit";
  var sig = await accountOfAddr.signMessage(msg);
  var r = '0x' + sig.slice(2, 64 + 2)
  var s = '0x' + sig.slice(64 + 2, 128 + 2)
  var v = '0x' + sig.slice(128 + 2, 130 + 2);
  var msgHash = hashMessage(msg);
  var tx = await octTimelock.connect(signer).transferUnreleasedBalance(addr, amount, msgHash, v, r, s);
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

    const decimals = BigNumber.from('1000000000000000000');
    expect(await oct.totalSupply()).to.equal(BigNumber.from('100000000').mul(decimals));
    expect(await octTimelock.token()).to.equal(oct.address);

    const [owner, account1, account2] = await ethers.getSigners();
    const ownerAddress = await owner.getAddress();
    const address1 = await account1.getAddress();
    const address2 = await account2.getAddress();

    console.log('Address of owner: %s', ownerAddress);
    expect(await oct.balanceOf(ownerAddress)).to.equal(BigNumber.from('100000000').mul(decimals));

    console.log('Transfer 30000000 from %s to %s', ownerAddress, octTimelock.address);
    var tx = await oct.transfer(octTimelock.address, BigNumber.from('30000000').mul(decimals));
    await tx.wait();
    expect(await oct.balanceOf(octTimelock.address)).to.equal(BigNumber.from('30000000').mul(decimals));
    /**
     * Test contract 'OctFundationTimelock', before 'EARLIST_RELEASE_START_TIME'
     */
    await benefit(octTimelock, address1, BigNumber.from('4000000').mul(decimals), false);
    expect(await octTimelock.unreleasedBalanceOf(address1)).to.equal(BigNumber.from('4000000').mul(decimals));
    expect(await octTimelock.unreleasedSupervisedBalanceOf(address1)).to.equal(0);
    expect(await octTimelock.releasedBalanceOf(address1)).to.equal(0);
    expect(await octTimelock.withdrawedBalanceOf(address1)).to.equal(0);
    await benefit(octTimelock, address1, BigNumber.from('1000000').mul(decimals), false);
    expect(await octTimelock.unreleasedBalanceOf(address1)).to.equal(BigNumber.from('5000000').mul(decimals));
    expect(await octTimelock.unreleasedSupervisedBalanceOf(address1)).to.equal(0);
    expect(await octTimelock.releasedBalanceOf(address1)).to.equal(0);
    expect(await octTimelock.withdrawedBalanceOf(address1)).to.equal(0);
    await benefit(octTimelock, address1, BigNumber.from('2000000').mul(decimals), true);
    expect(await octTimelock.unreleasedBalanceOf(address1)).to.equal(BigNumber.from('5000000').mul(decimals));
    expect(await octTimelock.unreleasedSupervisedBalanceOf(address1)).to.equal(BigNumber.from('2000000').mul(decimals));
    expect(await octTimelock.releasedBalanceOf(address1)).to.equal(0);
    expect(await octTimelock.withdrawedBalanceOf(address1)).to.equal(0);
    await octTimelock.connect(account1).withdraw(BigNumber.from('1000000').mul(decimals)).catch((error) => {
      console.log('Successfully catched error: %s', error);
    });
    await octTimelock.connect(account1).benefit(address2, BigNumber.from('1000000').mul(decimals), false).catch((error) => {
      console.log('Successfully catched error: %s', error);
    });
    await transferUnreleasedBalance(octTimelock, account1, account2, address2, BigNumber.from('1000000').mul(decimals));
    expect(await octTimelock.unreleasedBalanceOf(address1)).to.equal(BigNumber.from('4000000').mul(decimals));
    expect(await octTimelock.unreleasedSupervisedBalanceOf(address1)).to.equal(BigNumber.from('2000000').mul(decimals));
    expect(await octTimelock.releasedBalanceOf(address1)).to.equal(0);
    expect(await octTimelock.withdrawedBalanceOf(address1)).to.equal(0);
    expect(await octTimelock.unreleasedBalanceOf(address2)).to.equal(BigNumber.from('1000000').mul(decimals));
    expect(await octTimelock.unreleasedSupervisedBalanceOf(address2)).to.equal(0);
    expect(await octTimelock.releasedBalanceOf(address2)).to.equal(0);
    expect(await octTimelock.withdrawedBalanceOf(address2)).to.equal(0);
    await decreaseBenefitOf(octTimelock, address1, BigNumber.from('1000000').mul(decimals));
    expect(await octTimelock.unreleasedBalanceOf(address1)).to.equal(BigNumber.from('4000000').mul(decimals));
    expect(await octTimelock.unreleasedSupervisedBalanceOf(address1)).to.equal(BigNumber.from('1000000').mul(decimals));
    expect(await octTimelock.releasedBalanceOf(address1)).to.equal(0);
    expect(await octTimelock.withdrawedBalanceOf(address1)).to.equal(0);
    await octTimelock.decreaseBenefitOf(address2, BigNumber.from('1000000').mul(decimals)).catch((error) => {
      console.log('Successfully catched error: %s', error);
    });
    /**
     * Change network time to '2022/09/01 00:00:00'
     */
    var secondsToEarlisestReleaseTime = 1630454400 - Math.floor(Date.now() / 1000);
    await hre.network.provider.send("evm_increaseTime", [secondsToEarlisestReleaseTime + 1661990400 - 1630454400]);
    await hre.network.provider.send("evm_mine");
    expect(await octTimelock.unreleasedBalanceOf(address1)).to.equal(BigNumber.from('2667883211678832116788322'));
    expect(await octTimelock.unreleasedSupervisedBalanceOf(address1)).to.equal(BigNumber.from('666970802919708029197081'));
    expect(await octTimelock.releasedBalanceOf(address1)).to.equal(BigNumber.from('1665145985401459854014597'));
    expect(await octTimelock.withdrawedBalanceOf(address1)).to.equal(0);
    expect(await octTimelock.unreleasedBalanceOf(address2)).to.equal(BigNumber.from('666970802919708029197081'));
    expect(await octTimelock.unreleasedSupervisedBalanceOf(address2)).to.equal(0);
    expect(await octTimelock.releasedBalanceOf(address2)).to.equal(BigNumber.from('333029197080291970802919'));
    expect(await octTimelock.withdrawedBalanceOf(address2)).to.equal(0);
    /**
     * Test 'withdraw'
     */
    await withdraw(octTimelock, account1, BigNumber.from('1000000').mul(decimals));
    expect(await octTimelock.unreleasedBalanceOf(address1)).to.equal(BigNumber.from('2667883211678832116788322'));
    expect(await octTimelock.unreleasedSupervisedBalanceOf(address1)).to.equal(BigNumber.from('666970802919708029197081'));
    expect(await octTimelock.releasedBalanceOf(address1)).to.equal(BigNumber.from('1665145985401459854014597'));
    expect(await octTimelock.withdrawedBalanceOf(address1)).to.equal(BigNumber.from('1000000').mul(decimals));
    await octTimelock.connect(account1).withdraw(BigNumber.from('665145985401459854014598')).catch((error) => {
      console.log('Successfully catched error: %s', error);
    });
    await withdraw(octTimelock, account1, BigNumber.from('665145985401459854014597'));
    expect(await octTimelock.unreleasedBalanceOf(address1)).to.equal(BigNumber.from('2667883211678832116788322'));
    expect(await octTimelock.unreleasedSupervisedBalanceOf(address1)).to.equal(BigNumber.from('666970802919708029197081'));
    expect(await octTimelock.releasedBalanceOf(address1)).to.equal(BigNumber.from('1665145985401459854014597'));
    expect(await octTimelock.withdrawedBalanceOf(address1)).to.equal(BigNumber.from('1665145985401459854014597'));
    /**
     * Test 'transferUnreleasedBalance'
     */
    await octTimelock.connect(account1).transferUnreleasedBalance(address2, BigNumber.from('2667883211678832116788323'), "0x0101010101010101010101010101010101010101010101010101010101010101", "0x01", "0x0101010101010101010101010101010101010101010101010101010101010101", "0x0101010101010101010101010101010101010101010101010101010101010101").catch((error) => {
      console.log('Successfully catched error: %s', error);
    });
    await octTimelock.connect(account1).transferUnreleasedBalance(address2, BigNumber.from('2667883211678832116788322'), "0x0101010101010101010101010101010101010101010101010101010101010101", "0x01", "0x0101010101010101010101010101010101010101010101010101010101010101", "0x0101010101010101010101010101010101010101010101010101010101010101").catch((error) => {
      console.log('Successfully catched error: %s', error);
    });
    await transferUnreleasedBalance(octTimelock, account1, account2, address2, BigNumber.from('1000000').mul(decimals));
    expect(await octTimelock.unreleasedBalanceOf(address1)).to.equal(BigNumber.from('1667883211678832116788322'));
    expect(await octTimelock.unreleasedSupervisedBalanceOf(address1)).to.equal(BigNumber.from('666970802919708029197081'));
    expect(await octTimelock.releasedBalanceOf(address1)).to.equal(BigNumber.from('1665145985401459854014597'));
    expect(await octTimelock.withdrawedBalanceOf(address1)).to.equal(BigNumber.from('1665145985401459854014597'));
    expect(await octTimelock.unreleasedBalanceOf(address2)).to.equal(BigNumber.from('1666970802919708029197081'));
    expect(await octTimelock.unreleasedSupervisedBalanceOf(address2)).to.equal(0);
    expect(await octTimelock.releasedBalanceOf(address2)).to.equal(BigNumber.from('333029197080291970802919'));
    expect(await octTimelock.withdrawedBalanceOf(address2)).to.equal(0);
    /**
     * Test 'decreaseBenefitOf'
     */
    await octTimelock.decreaseBenefitOf(address2, 1).catch((error) => {
      console.log('Successfully catched error: %s', error);
    });
    await octTimelock.decreaseBenefitOf(address1, BigNumber.from('666970802919708029197082')).catch((error) => {
      console.log('Successfully catched error: %s', error);
    });
    await decreaseBenefitOf(octTimelock, address1, BigNumber.from('200000').mul(decimals));
    expect(await octTimelock.unreleasedBalanceOf(address1)).to.equal(BigNumber.from('1667883211678832116788322'));
    expect(await octTimelock.unreleasedSupervisedBalanceOf(address1)).to.equal(BigNumber.from('466970802919708029197081'));
    expect(await octTimelock.releasedBalanceOf(address1)).to.equal(BigNumber.from('1665145985401459854014597'));
    expect(await octTimelock.withdrawedBalanceOf(address1)).to.equal(BigNumber.from('1665145985401459854014597'));
    expect(await octTimelock.unreleasedBalanceOf(address2)).to.equal(BigNumber.from('1666970802919708029197081'));
    expect(await octTimelock.unreleasedSupervisedBalanceOf(address2)).to.equal(0);
    expect(await octTimelock.releasedBalanceOf(address2)).to.equal(BigNumber.from('333029197080291970802919'));
    expect(await octTimelock.withdrawedBalanceOf(address2)).to.equal(0);
    /**
     * Test 'benefit'
     */
    await benefit(octTimelock, address1, BigNumber.from('100000').mul(decimals), true);
    expect(await octTimelock.unreleasedBalanceOf(address1)).to.equal(BigNumber.from('1667883211678832116788322'));
    expect(await octTimelock.unreleasedSupervisedBalanceOf(address1)).to.equal(BigNumber.from('566970802919708029197081'));
    expect(await octTimelock.releasedBalanceOf(address1)).to.equal(BigNumber.from('1665145985401459854014597'));
    expect(await octTimelock.withdrawedBalanceOf(address1)).to.equal(BigNumber.from('1665145985401459854014597'));
    await benefit(octTimelock, address2, BigNumber.from('1000000').mul(decimals), false);
    expect(await octTimelock.unreleasedBalanceOf(address2)).to.equal(BigNumber.from('2666970802919708029197081'));
    expect(await octTimelock.unreleasedSupervisedBalanceOf(address2)).to.equal(0);
    expect(await octTimelock.releasedBalanceOf(address2)).to.equal(BigNumber.from('333029197080291970802919'));
    expect(await octTimelock.withdrawedBalanceOf(address2)).to.equal(0);
    /**
     * Change network time to '2023/09/01 00:00:00'
     */
    await hre.network.provider.send("evm_increaseTime", [secondsToEarlisestReleaseTime + 1693526400 - 1661990400]);
    await hre.network.provider.send("evm_mine");
    expect(await octTimelock.unreleasedBalanceOf(address1)).to.equal(BigNumber.from('778041279319400481292501'));
    expect(await octTimelock.unreleasedSupervisedBalanceOf(address1)).to.equal(BigNumber.from('264482960048728369297134'));
    expect(await octTimelock.releasedBalanceOf(address1)).to.equal(BigNumber.from('2857475760631871149410365'));
    expect(await octTimelock.withdrawedBalanceOf(address1)).to.equal(BigNumber.from('1665145985401459854014597'));
    expect(await octTimelock.unreleasedBalanceOf(address2)).to.equal(BigNumber.from('1244099923113023854933249'));
    expect(await octTimelock.unreleasedSupervisedBalanceOf(address2)).to.equal(0);
    expect(await octTimelock.releasedBalanceOf(address2)).to.equal(BigNumber.from('1755900076886976145066751'));
    expect(await octTimelock.withdrawedBalanceOf(address2)).to.equal(0);
    /**
     * Change network time to '2025/09/01 00:00:00'
     */
    await hre.network.provider.send("evm_increaseTime", [secondsToEarlisestReleaseTime + 1756684800 - 1693526400]);
    await hre.network.provider.send("evm_mine");
    expect(await octTimelock.unreleasedBalanceOf(address1)).to.equal(0);
    expect(await octTimelock.unreleasedSupervisedBalanceOf(address1)).to.equal(0);
    expect(await octTimelock.releasedBalanceOf(address1)).to.equal(BigNumber.from('3900000').mul(decimals));
    expect(await octTimelock.withdrawedBalanceOf(address1)).to.equal(BigNumber.from('1665145985401459854014597'));
    expect(await octTimelock.unreleasedBalanceOf(address2)).to.equal(0);
    expect(await octTimelock.unreleasedSupervisedBalanceOf(address2)).to.equal(0);
    expect(await octTimelock.releasedBalanceOf(address2)).to.equal(BigNumber.from('3000000').mul(decimals));
    expect(await octTimelock.withdrawedBalanceOf(address2)).to.equal(0);
  });
});

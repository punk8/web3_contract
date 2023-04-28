import { ethers } from "hardhat";
import { swap } from "../../typechain-types/contracts";

async function main() {

    const [owner, otherAccount] = await ethers.getSigners();


    const MorniToken = await ethers.getContractFactory("MorniToken");
    const morni = await MorniToken.deploy();

    await morni.deployed();

    console.log(
        `morni deployed to ${morni.address}`
    );

    const PunkToken = await ethers.getContractFactory("PunkToken");
    const punk = await PunkToken.deploy();

    await punk.deployed();

    console.log(
        `punk deployed to ${punk.address}`
    );

    const token0 = morni.address;
    const token1 = punk.address;

    const Swapdemo = await ethers.getContractFactory("Swapdemo");
    const swapdemo = await Swapdemo.deploy(token0, token1);

    await swapdemo.deployed();

    console.log(
        `swapdemo deployed to ${swapdemo.address}`
    );

    // 查询round
    console.log(`init round ${await swapdemo.currenRound()}`)

    const swap_demo = swapdemo.address

    const erc20 = await ethers.getContractFactory("ERC20");
    const erc20_token0 = erc20.attach(token0);
    const erc20_token1 = erc20.attach(token1);

    // 转账
    const call_token0_transfer = await erc20_token0.connect(owner).transfer(otherAccount.address, ethers.utils.parseEther("10000"));
    await call_token0_transfer.wait(1)
    const call_token1_transfer = await erc20_token1.connect(owner).transfer(otherAccount.address, ethers.utils.parseEther("10000"));
    await call_token1_transfer.wait(1)


    // 授权
    const call_token0_approve = await erc20_token0.connect(owner).approve(swap_demo, ethers.utils.parseEther("1000"));
    await call_token0_approve.wait(1)
    const call_token1_approve = await erc20_token1.connect(owner).approve(swap_demo, ethers.utils.parseEther("1000"));
    await call_token1_approve.wait(1)


    // 授权
    const call_token0_approve_other = await erc20_token0.connect(otherAccount).approve(swap_demo, ethers.utils.parseEther("1000"));
    await call_token0_approve_other.wait(1)
    const call_token1_approve_other = await erc20_token1.connect(otherAccount).approve(swap_demo, ethers.utils.parseEther("1000"));
    await call_token1_approve_other.wait(1)

    // deposit 第一轮
    const call_deposit = await swapdemo.connect(owner).deposit(1, ethers.utils.parseEther("300"), ethers.utils.parseEther("100"));
    const call_deposit_other = await swapdemo.connect(otherAccount).deposit(1, ethers.utils.parseEther("200"), ethers.utils.parseEther("600"));

    console.log(`deposit round 1 owner deposit ${call_deposit.hash}, other deposit ${call_deposit_other.hash}`)
    await call_deposit.wait(1)
    await call_deposit_other.wait(1)

    const [token0_balance, token1_balance] = await swapdemo.getTokenBalance()

    console.log(`current contract balance:token0 balance ${token0_balance} token1 balance ${token1_balance}`)


    // end 第一轮
    const end = await swapdemo.endRound()
    console.log(`end round ${end.hash}`)
    await end.wait(1)

    const claim_owner = await swapdemo.connect(owner).claim(1)
    const claim_otherAccount = await swapdemo.connect(otherAccount).claim(1)

    console.log(`owner claim ${claim_owner.hash}, other claim ${claim_otherAccount.hash}`)

    await claim_owner.wait(1)
    await claim_otherAccount.wait(1)

    const resposne = await swapdemo.getTokenBalance()

    console.log(`current contract balance:token0 balance ${resposne[0]} token1 balance ${resposne[1]}`)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

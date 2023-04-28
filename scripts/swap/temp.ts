import { ethers } from "hardhat";
import { swap } from "../../typechain-types/contracts";

async function main() {

    const [owner, otherAccount] = await ethers.getSigners();

    // 查询round
    const swap_demo = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9"
    const Swapdemo = await ethers.getContractFactory("Swapdemo");
    const swapdemo = Swapdemo.attach(swap_demo)
    console.log(await swapdemo.currenRound())

    const token0 = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"
    const token1 = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"

    const erc20 = await ethers.getContractFactory("ERC20");
    const erc20_token0 = erc20.attach(token0);
    const erc20_token1 = erc20.attach(token1);

    // // 转账
    // const call_token0_transfer = await erc20_token0.connect(owner).transfer(otherAccount.address, ethers.utils.parseEther("10000"));
    // await call_token0_transfer.wait(1)
    // const call_token1_transfer = await erc20_token1.connect(owner).transfer(otherAccount.address, ethers.utils.parseEther("10000"));
    // await call_token1_transfer.wait(1)


    // // 授权
    // const call_token0_approve = await erc20_token0.connect(owner).approve(swap_demo, ethers.utils.parseEther("1000"));
    // await call_token0_approve.wait(1)
    // const call_token1_approve = await erc20_token1.connect(owner).approve(swap_demo, ethers.utils.parseEther("1000"));
    // await call_token1_approve.wait(1)


    // // 授权
    // const call_token0_approve_other = await erc20_token0.connect(otherAccount).approve(swap_demo, ethers.utils.parseEther("1000"));
    // await call_token0_approve_other.wait(1)
    // const call_token1_approve_other = await erc20_token1.connect(otherAccount).approve(swap_demo, ethers.utils.parseEther("1000"));
    // await call_token1_approve_other.wait(1)

    // deposit 第一轮
    // const call_deposit = await swapdemo.connect(owner).deposit(1, ethers.utils.parseEther("300"), ethers.utils.parseEther("100"));
    // const call_deposit_other = await swapdemo.connect(otherAccount).deposit(1, ethers.utils.parseEther("200"), ethers.utils.parseEther("600"));

    // console.log(call_deposit.hash);
    // await call_deposit.wait(1)
    // await call_deposit_other.wait(1)

    // const token0_balance = await swapdemo.getToken0Balance()
    // const token1_balance = await swapdemo.getToken1Balance()

    // console.log(`token0 balance ${token0_balance} token1 balance ${token1_balance}`)

    // const response = await swapdemo.connect(owner).querySwapBalance()

    // console.log(response)


    // const response1 = await swapdemo.connect(otherAccount).querySwapBalance()

    // console.log(response1)
    // await (await swapdemo.connect(owner).endRound()).wait(1)

    // const claim_owner = await swapdemo.connect(owner).claim(1)
    const claim_otherAccount = await swapdemo.connect(otherAccount).claim(1)

    // await claim_owner.wait(1)
    await claim_otherAccount.wait(1)


    console.log(`token0 balance ${await swapdemo.getToken0Balance()} token1 balance ${await swapdemo.getToken1Balance()}`)


}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

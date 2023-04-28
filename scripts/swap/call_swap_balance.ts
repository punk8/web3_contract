import { ethers } from "hardhat";
import { swap } from "../../typechain-types/contracts";

async function main() {

    const [owner, otherAccount] = await ethers.getSigners();


    const token0 = "0x5FbDB2315678afecb367f032d93F642f64180aa3"
    const token1 = "0x0165878A594ca255338adfa4d48449f69242Eb8F"
    const swap_demo = "0x9A676e781A523b5d0C0e43731313A708CB607508"



    const erc20 = await ethers.getContractFactory("ERC20");
    const erc20_token0 = erc20.attach(token0);
    const erc20_token1 = erc20.attach(token1);

    // // 授权
    // const call_token0_approve = await erc20_token0.approve(swap_demo, ethers.utils.parseEther("1000"));
    // await call_token0_approve.wait(1)
    // const call_token1_approve = await erc20_token1.approve(swap_demo, ethers.utils.parseEther("1000"));
    // await call_token1_approve.wait(1)



    const Swapdemo = await ethers.getContractFactory("Swapdemo");
    const swapdemo = Swapdemo.attach(swap_demo);

    const response = await swapdemo.querySwapBalance()

    console.log(response)


}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

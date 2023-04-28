import { ethers } from "hardhat";

async function main() {

    const token0 = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"
    const token1 = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"
    const Swapdemo = await ethers.getContractFactory("Swapdemo");
    const swapdemo = await Swapdemo.deploy(token0, token1);

    await swapdemo.deployed();

    console.log(
        `swapdemo deployed to ${swapdemo.address}`
    );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

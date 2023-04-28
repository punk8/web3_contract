import { ethers } from "hardhat";

async function main() {
    const PunkToken = await ethers.getContractFactory("PunkToken");
    const punk = await PunkToken.deploy();

    await punk.deployed();

    console.log(
        `punk deployed to ${punk.address}`
    );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

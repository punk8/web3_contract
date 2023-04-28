import { ethers } from "hardhat";

async function main() {
    const MorniToken = await ethers.getContractFactory("MorniToken");
    const morni = await MorniToken.deploy();

    await morni.deployed();

    console.log(
        `morni deployed to ${morni.address}`
    );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

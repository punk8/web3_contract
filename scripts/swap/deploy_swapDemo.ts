import { ethers } from "hardhat";

async function main() {

    const token0 = "0x5FbDB2315678afecb367f032d93F642f64180aa3"
    const token1 = "0x0165878A594ca255338adfa4d48449f69242Eb8F"
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

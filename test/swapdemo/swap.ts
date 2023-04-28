import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";

describe("SwapDemo", function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deployFixture() {
        // Contracts are deployed using the first signer/account by default
        const [owner, otherAccount] = await ethers.getSigners();

        const MorniToken = await ethers.getContractFactory("MorniToken");
        const morni = await MorniToken.deploy();
        await morni.deployed();

        const PunkToken = await ethers.getContractFactory("PunkToken");
        const punk = await PunkToken.deploy();

        await punk.deployed();

        const Swapdemo = await ethers.getContractFactory("Swapdemo");
        const swapdemo = await Swapdemo.deploy(punk.address, morni.address);

        await swapdemo.deployed();

        const erc20 = await ethers.getContractFactory("ERC20");
        const erc20_token0 = erc20.attach(punk.address);
        const erc20_token1 = erc20.attach(morni.address);

        // 转账
        const call_token0_transfer = erc20_token0.connect(owner).transfer(otherAccount.address, ethers.utils.parseEther("10000"));

        const call_token1_transfer = erc20_token1.connect(owner).transfer(otherAccount.address, ethers.utils.parseEther("10000"));

        await (await call_token0_transfer).wait(1)
        await (await call_token1_transfer).wait(1)


        // 授权
        const call_token0_approve = erc20_token0.connect(owner).approve(swapdemo.address, ethers.utils.parseEther("1000"));
        const call_token1_approve = erc20_token1.connect(owner).approve(swapdemo.address, ethers.utils.parseEther("1000"));

        // 授权
        const call_token0_approve_other = erc20_token0.connect(otherAccount).approve(swapdemo.address, ethers.utils.parseEther("1000"));
        const call_token1_approve_other = erc20_token1.connect(otherAccount).approve(swapdemo.address, ethers.utils.parseEther("1000"));

        await (await call_token0_approve).wait(1)
        await (await call_token1_approve).wait(1)
        await (await call_token0_approve_other).wait(1)
        await (await call_token1_approve_other).wait(1)
        return { swapdemo, punk, morni, owner, otherAccount };
    }

    describe("Deployment", function () {
        it("Should init round with 1", async function () {
            const { swapdemo } = await loadFixture(deployFixture);

            expect(await swapdemo.currenRound()).to.equal(1);
        });
    });

    describe("Swap", function () {
        describe("Validations", function () {
            it("Should revert with the depoist if round not start", async function () {
                const { swapdemo, owner } = await loadFixture(
                    deployFixture
                );
                await expect(swapdemo.deposit(2, ethers.utils.parseEther("11"), ethers.utils.parseEther("11")))
                    .to.be.revertedWith(
                        "deposit failed, round not start"
                    );
            });
            it("Should revert with the depoist if amounts are all zero", async function () {
                const { swapdemo, owner } = await loadFixture(
                    deployFixture
                );
                await expect(swapdemo.deposit(1, ethers.utils.parseEther("0"), ethers.utils.parseEther("0")))
                    .to.be.revertedWith(
                        "deposit: INSUFFICIENT_INPUT_AMOUNT"
                    );
            });
            it("Should revert with the claim if round is not end", async function () {
                const { swapdemo, owner } = await loadFixture(
                    deployFixture
                );
                await expect(swapdemo.claim(1))
                    .to.be.revertedWith(
                        "claim failed, round not end"
                    );
            });

            it("Should revert with the deposit if round have end", async function () {
                const { swapdemo, owner } = await loadFixture(
                    deployFixture
                );
                await swapdemo.deposit(1, ethers.utils.parseEther("100"), ethers.utils.parseEther("200"))
                await swapdemo.endRound()
                expect(await swapdemo.currenRound()).to.equal(2);

                // round 2

                await expect(swapdemo.deposit(1, ethers.utils.parseEther("100"), ethers.utils.parseEther("200")))
                    .to.be.revertedWith(
                        "deposit failed, round have ended"
                    );



                await swapdemo.claim(1)
                // await expect(swapdemo.claim(1))
                //     .to.be.revertedWith(
                //         "deposit failed, round have ended"
                //     );
            });
        });
        describe("Transfers", function () {
            it("Should transfer the token to contract", async function () {
                const { swapdemo, owner, otherAccount } = await loadFixture(
                    deployFixture
                );
                await swapdemo.deposit(1, ethers.utils.parseEther("100"), ethers.utils.parseEther("200"))
                expect(await swapdemo.getTokenBalance()).to.deep.equals(
                    [ethers.utils.parseUnits("100", "ether"), ethers.utils.parseUnits("200", "ether")]
                );

                await swapdemo.endRound()
                expect(await swapdemo.currenRound()).to.equal(2);

                await swapdemo.claim(1)

                expect(await swapdemo.getTokenBalance()).to.deep.equals(
                    [BigNumber.from("0"), BigNumber.from("0")]
                );


                // round 2
                await swapdemo.deposit(2, ethers.utils.parseEther("100"), ethers.utils.parseEther("200"))
                await swapdemo.connect(otherAccount).deposit(2, ethers.utils.parseEther("200"), ethers.utils.parseEther("500"))
                expect(await swapdemo.getTokenBalance()).to.deep.equals(
                    [ethers.utils.parseUnits("300", "ether"), ethers.utils.parseUnits("700", "ether")]
                );

                await swapdemo.endRound()

                await swapdemo.claim(2)

                console.log(await swapdemo.getTokenBalance())

                await swapdemo.connect(otherAccount).claim(2)

                console.log(await swapdemo.getTokenBalance())




            });
        });

        // describe("Events", function () {
        //     it("Should emit an event on withdrawals", async function () {
        //         const { lock, unlockTime, lockedAmount } = await loadFixture(
        //             deployOneYearLockFixture
        //         );

        //         await time.increaseTo(unlockTime);

        //         await expect(lock.withdraw())
        //             .to.emit(lock, "Withdrawal")
        //             .withArgs(lockedAmount, anyValue); // We accept any value as `when` arg
        //     });
        // });


    });
});

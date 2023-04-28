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

            expect(await swapdemo.currentRound()).to.equal(1);
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
                expect(await swapdemo.currentRound()).to.equal(2);

                // round 2

                await expect(swapdemo.deposit(1, ethers.utils.parseEther("100"), ethers.utils.parseEther("200")))
                    .to.be.revertedWith(
                        "deposit failed, round have ended"
                    );
            });

            it("Should revert with the claim if caller have claimed", async function () {
                const { swapdemo, owner } = await loadFixture(
                    deployFixture
                );
                await swapdemo.deposit(1, ethers.utils.parseEther("100"), ethers.utils.parseEther("200"))
                await swapdemo.endRound()
                expect(await swapdemo.currentRound()).to.equal(2);

                await swapdemo.claim(1)

                await expect(swapdemo.claim(1))
                    .to.be.revertedWith(
                        "claim failed, have claimed"
                    );
            });
        });
        describe("Deposit and claim", function () {
            it("Should success swap", async function () {
                const { swapdemo, owner, otherAccount } = await loadFixture(
                    deployFixture
                );
                await swapdemo.deposit(1, ethers.utils.parseEther("100"), ethers.utils.parseEther("200"))

                expect(await swapdemo.getTokenBalance()).to.deep.equals(
                    [ethers.utils.parseUnits("100", "ether"), ethers.utils.parseUnits("200", "ether")]
                );

                await swapdemo.endRound()
                expect(await swapdemo.currentRound()).to.equal(2);

                console.log(`fee ${await swapdemo.token0_fee()}`)
                console.log(`fee ${await swapdemo.token1_fee()}`)

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

                expect(await swapdemo.getTokenBalance()).to.deep.equals(
                    [BigNumber.from("214285714285714285715"), BigNumber.from("466666666666666666667")]
                );

                await swapdemo.connect(otherAccount).claim(2)

                expect(await swapdemo.getTokenBalance()).to.deep.equals(
                    [BigNumber.from("1"), BigNumber.from("1")]
                );

            });
            it("Should refund", async function () {
                const { swapdemo, owner, otherAccount } = await loadFixture(
                    deployFixture
                );
                await swapdemo.deposit(1, ethers.utils.parseEther("100"), ethers.utils.parseEther("0"))

                expect(await swapdemo.getTokenBalance()).to.deep.equals(
                    [ethers.utils.parseUnits("100", "ether"), ethers.utils.parseUnits("0", "ether")]
                );

                await expect(swapdemo.endRound())
                    .to.emit(swapdemo, "Failed")
                    .withArgs(1); // We accept any value as `when` arg


                expect(await swapdemo.currentRound()).to.equal(2);

                await swapdemo.claim(1)

                expect(await swapdemo.getTokenBalance()).to.deep.equals(
                    [BigNumber.from("0"), BigNumber.from("0")]
                );

            });
        });

        describe("QueryClaimableBalance", function () {
            it("Should return the real amount of token", async function () {
                const { swapdemo, owner, otherAccount } = await loadFixture(
                    deployFixture
                );
                await swapdemo.deposit(1, ethers.utils.parseEther("100"), ethers.utils.parseEther("200"))

                expect(await swapdemo.queryClaimableBalance(1)).to.deep.equals(
                    [ethers.utils.parseUnits("100", "ether"), ethers.utils.parseUnits("200", "ether")]
                );

            });
        });


        describe("Events", function () {
            it("Should emit an event on deposit", async function () {

                const { swapdemo, owner, otherAccount } = await loadFixture(
                    deployFixture
                );
                await swapdemo.deposit(1, ethers.utils.parseEther("100"), ethers.utils.parseEther("200"))

                await expect(swapdemo.deposit(1, ethers.utils.parseEther("100"), ethers.utils.parseEther("200")))
                    .to.emit(swapdemo, "Deposit")
                    .withArgs(owner.address, 1, ethers.utils.parseUnits("100", "ether"), ethers.utils.parseUnits("200", "ether")); // We accept any value as `when` arg


            });
            it("Should emit an failed event on endRound", async function () {

                const { swapdemo, owner, otherAccount } = await loadFixture(
                    deployFixture
                );
                await swapdemo.deposit(1, ethers.utils.parseEther("100"), ethers.utils.parseEther("0"))
                await expect(swapdemo.endRound())
                    .to.emit(swapdemo, "Failed")
                    .withArgs(1); // We accept any value as `when` arg

            });
            it("Should emit an success event on endRound", async function () {

                const { swapdemo, owner, otherAccount } = await loadFixture(
                    deployFixture
                );
                await swapdemo.deposit(1, ethers.utils.parseEther("100"), ethers.utils.parseEther("10"))
                await expect(swapdemo.endRound())
                    .to.emit(swapdemo, "Success")
                    .withArgs(1); // We accept any value as `when` arg

            });

            it("Should emit an event on claim", async function () {

                const { swapdemo, owner, otherAccount } = await loadFixture(
                    deployFixture
                );
                await swapdemo.deposit(1, ethers.utils.parseEther("100"), ethers.utils.parseEther("200"))
                await swapdemo.endRound()
                await expect(swapdemo.claim(1))
                    .to.emit(swapdemo, "Claim")
                    .withArgs(owner.address, 1, ethers.utils.parseUnits("100", "ether"), ethers.utils.parseUnits("200", "ether")); // We accept any value as `when` arg

            });
        });


    });
});

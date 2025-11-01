const hre = require("hardhat");

async function main() {
    // 1. 部署 BetToken (ERC20) - 使用正确的合约名称
    const BetToken = await hre.ethers.getContractFactory("BetToken");
    const betToken = await BetToken.deploy();
    console.log("BetToken deployed to:", betToken.address);

    // 2. 部署 LotteryTicket (ERC721)
    const LotteryTicket = await hre.ethers.getContractFactory("LotteryTicket");
    const lotteryTicket = await LotteryTicket.deploy();
    console.log("LotteryTicket deployed to:", lotteryTicket.address);

    // 3. 部署 TicketMarketplace (DEX)
    const TicketMarketplace = await hre.ethers.getContractFactory("TicketMarketplace");
    const marketplace = await TicketMarketplace.deploy(
        betToken.address,      
        lotteryTicket.address  
    );
    console.log("Marketplace deployed to:", marketplace.address);

    // 4. 部署 DecentralizedLottery (Main)
    const DecentralizedLottery = await hre.ethers.getContractFactory("DecentralizedLottery");
    const lottery = await DecentralizedLottery.deploy(
        betToken.address,
        lotteryTicket.address
    );
    console.log("DecentralizedLottery deployed to:", lottery.address);

    // --- 关键的授权步骤 ---
    // 允许主合约 (lottery) 铸造/销毁 NFT
    const tx = await lotteryTicket.setLotteryContract(lottery.address);
    await tx.wait();
    console.log("LotteryTicket contract authorized.");

    // 查询一下余额,应该会直接给部署者钱
    const [deployer] = await hre.ethers.getSigners();
    const deployerBalance = await betToken.balanceOf(deployer.address);
    console.log("Deployer balance:", ethers.utils.formatEther(deployerBalance), "BET");

    console.log("🎉所有合约部署完成！");
    console.log("==================================");
    console.log("BetToken:", betToken.address);
    console.log("LotteryTicket:", lotteryTicket.address);
    console.log("TicketMarketplace:", marketplace.address);
    console.log("DecentralizedLottery:", lottery.address);
    console.log("==================================");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
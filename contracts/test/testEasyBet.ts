const { expect } = require("chai");
const { ethers } = require("hardhat");

// 辅助函数，方便处理代币单位
const { parseEther, formatEther } = ethers;

describe("DecentralizedLottery System Test", function () {
    // 定义我们将在测试中重复使用的变量
    let betToken, lotteryTicket, marketplace, lottery;
    let owner, oracle, alice, bob; // signers
    let projectId_0; // 我们将创建的项目ID

    // beforeEach 会在每个 "it" 测试用例运行前执行
    // 这确保了每个测试都是在"干净"的合约状态下开始的
   beforeEach(async function () {
        // 1. 获取签名者
        // owner/oracle 是合约部署者
        [owner, alice, bob] = await ethers.getSigners();
        oracle = owner; // 为清晰起见，将owner指定为oracle

        // 2. 部署 BetToken (ERC20)
        const BetToken = await ethers.getContractFactory("BetToken");
        betToken = await BetToken.deploy();
        // await betToken.waitForDeployment(); // 已移除

        // 3. 部署 LotteryTicket (ERC721)
        const LotteryTicket = await ethers.getContractFactory("LotteryTicket");
        lotteryTicket = await LotteryTicket.deploy();
        // await lotteryTicket.waitForDeployment(); // 已移除
        
        // 4. 部署 TicketMarketplace
        const TicketMarketplace = await ethers.getContractFactory("TicketMarketplace");
        marketplace = await TicketMarketplace.deploy(
            await betToken.getAddress(),
            await lotteryTicket.getAddress()
        );
        // await marketplace.waitForDeployment(); // 已移除

        // 5. 部署主合约 DecentralizedLottery
        const DecentralizedLottery = await ethers.getContractFactory("DecentralizedLottery");
        lottery = await DecentralizedLottery.deploy(
            await betToken.getAddress(),
            await lotteryTicket.getAddress()
        );
        // await lottery.waitForDeployment(); // 已移除

        // 6. 关键步骤：授权主合约 (lottery) 来铸造/销毁 NFT
        await lotteryTicket.connect(owner).setLotteryContract(await lottery.getAddress());

        // 7. 为 Alice 和 Bob 发放测试代币 (BTOK)
        await betToken.connect(alice).faucet();
        await betToken.connect(bob).faucet();

        // 8. (可选) 检查 Alice 和 Bob 的初始 BTOK 余额
        expect(await betToken.balanceOf(alice.address)).to.equal(parseEther("1000"));
        expect(await betToken.balanceOf(bob.address)).to.equal(parseEther("1000"));

        projectId_0 = 0; // 我们知道第一个项目的ID将是0
    });

    // --- 测试用例 ---

    it("1. Oracle 应该能成功创建一个竞猜项目", async function () {
        const oraclePool = parseEther("100");
        const options = ["Team A Wins", "Team B Wins"];

        // Oracle 必须先授权 BTOK 给主合约
        await betToken.connect(oracle).approve(await lottery.getAddress(), oraclePool);

        // 创建项目
        await expect(lottery.connect(oracle).createProject("F1 Finals", options, oraclePool))
            .to.emit(lottery, "ProjectCreated") // 检查是否发B了事件
            .withArgs(projectId_0, "F1 Finals", oraclePool); // 检查事件参数

        // 验证项目数据是否正确
        const project = await lottery.projects(projectId_0);
        expect(project.name).to.equal("F1 Finals");
        expect(project.oraclePrizePool).to.equal(oraclePool);
        expect(project.isOpen).to.be.true;

        // 验证合约的 BTOK 余额（公证人奖池）
        expect(await betToken.balanceOf(await lottery.getAddress())).to.equal(oraclePool);
    });

    it("2. 玩家应该能下注并收到 NFT 凭证", async function () {
        // --- 先创建项目 (复用上一个测试的设置) ---
        const oraclePool = parseEther("100");
        await betToken.connect(oracle).approve(await lottery.getAddress(), oraclePool);
        await lottery.connect(oracle).createProject("F1 Finals", ["Team A", "Team B"], oraclePool);
        
        // --- Alice 下注 ---
        const aliceBetAmount = parseEther("50");
        const aliceOptionId = 0; // Team A

        // Alice 授权 BTOK 给主合约
        await betToken.connect(alice).approve(await lottery.getAddress(), aliceBetAmount);
        
        // Alice 下注
        // 我们期望它发出 BetPlaced 事件，并正确铸造 TokenID 0
        await expect(lottery.connect(alice).bet(projectId_0, aliceOptionId, aliceBetAmount))
            .to.emit(lottery, "BetPlaced")
            .withArgs(projectId_0, aliceOptionId, alice.address, aliceBetAmount, 0); // 0 是第一个NFT的 tokenId

        // 验证 NFT 归属
        expect(await lotteryTicket.ownerOf(0)).to.equal(alice.address);
        
        // 验证 NFT 内部信息
        const ticketInfo = await lotteryTicket.ticketInfo(0);
        expect(ticketInfo.projectId).to.equal(projectId_0);
        expect(ticketInfo.optionId).to.equal(aliceOptionId);
        expect(ticketInfo.betAmount).to.equal(aliceBetAmount);

        // 验证主合约的总奖池（Oracle + Alice）
        const expectedTotalPool = oraclePool + aliceBetAmount;
        expect(await betToken.balanceOf(await lottery.getAddress())).to.equal(expectedTotalPool);

        // 验证项目数据中的下注额
        const project = await lottery.projects(projectId_0);
        expect(project.options[aliceOptionId].totalBetAmount).to.equal(aliceBetAmount);
        expect(project.totalPlayerBets).to.equal(aliceBetAmount);
    });

    it("3. 玩家应该能挂单和购买彩票 (ERC721 交易)", async function () {
        // --- 1. 设置: 创建项目, Alice 下注 (TokenID 0) ---
        const oraclePool = parseEther("100");
        await betToken.connect(oracle).approve(await lottery.getAddress(), oraclePool);
        await lottery.connect(oracle).createProject("F1 Finals", ["Team A", "Team B"], oraclePool);
        
        const aliceBetAmount = parseEther("50");
        await betToken.connect(alice).approve(await lottery.getAddress(), aliceBetAmount);
        await lottery.connect(alice).bet(projectId_0, 0, aliceBetAmount); // Alice 获得 TokenID 0

        // --- 2. Alice 挂单她的 NFT (TokenID 0) ---
        const listingPrice = parseEther("80"); // Alice想用80 BTOK卖掉她50的赌注
        
        // Alice 必须先授权 Marketplace 合约转移她的 NFT
        await lotteryTicket.connect(alice).approve(await marketplace.getAddress(), 0); // 0 是 TokenID
        
        // Alice 挂单
        await expect(marketplace.connect(alice).listTicket(0, listingPrice))
            .to.emit(marketplace, "TicketListed")
            .withArgs(0, projectId_0, 0, alice.address, listingPrice); // (tokenId, projId, optionId, seller, price)

        // 验证挂单信息
        const listing = await marketplace.listings(0);
        expect(listing.seller).to.equal(alice.address);
        expect(listing.price).to.equal(listingPrice);

        // --- 3. Bob 购买 Alice 的 NFT (TokenID 0) ---
        
        // Bob 必须先授权 Marketplace 合约转移他的 BTOK
        await betToken.connect(bob).approve(await marketplace.getAddress(), listingPrice);
        
        // 记录双方余额
        const aliceBalanceBefore = await betToken.balanceOf(alice.address);
        const bobBalanceBefore = await betToken.balanceOf(bob.address);

        // Bob 购买
        await expect(marketplace.connect(bob).buyTicket(0)) // 0 是 TokenID
            .to.emit(marketplace, "TicketSold");

        // 验证 NFT 归属已转移
        expect(await lotteryTicket.ownerOf(0)).to.equal(bob.address);

        // 验证挂单已被清除
        const listingAfter = await marketplace.listings(0);
        expect(listingAfter.price).to.equal(0);

        // 验证 BTOK 转移
        const aliceBalanceAfter = await betToken.balanceOf(alice.address);
        const bobBalanceAfter = await betToken.balanceOf(bob.address);

        expect(aliceBalanceAfter).to.equal(aliceBalanceBefore + listingPrice);
        expect(bobBalanceAfter).to.equal(bobBalanceBefore - listingPrice);
    });


    it("4. Oracle 结算和赢家兑奖 (单一赢家)", async function () {
        // --- 1. 设置: 项目(100 BTOK pool) + Alice(50) + Bob(20) ---
        const oraclePool = parseEther("100");
        await betToken.connect(oracle).approve(await lottery.getAddress(), oraclePool);
        await lottery.connect(oracle).createProject("F1 Finals", ["Team A", "Team B"], oraclePool);
        
        const aliceBetAmount = parseEther("50"); // 押 Team A (Option 0)
        await betToken.connect(alice).approve(await lottery.getAddress(), aliceBetAmount);
        await lottery.connect(alice).bet(projectId_0, 0, aliceBetAmount); // Alice 获得 TokenID 0

        const bobBetAmount = parseEther("20"); // 押 Team B (Option 1)
        await betToken.connect(bob).approve(await lottery.getAddress(), bobBetAmount);
        await lottery.connect(bob).bet(projectId_0, 1, bobBetAmount); // Bob 获得 TokenID 1

        // --- 2. Oracle 结算 ---
        const winningOptionId = 0; // Team A 获胜
        await expect(lottery.connect(oracle).resolveProject(projectId_0, winningOptionId))
            .to.emit(lottery, "ProjectResolved")
            .withArgs(projectId_0, winningOptionId);

        // 验证项目状态
        const project = await lottery.projects(projectId_0);
        expect(project.isResolved).to.be.true;
        expect(project.isOpen).to.be.false;

        // --- 3. 赢家 (Alice) 兑奖 ---
        // 总奖池 = 100 (Oracle) + 50 (Alice) + 20 (Bob) = 170
        // 获胜方总下注 = 50 (Alice)
        // Alice 份额 = (50 / 50) * 170 = 170
        const expectedPayout = parseEther("170");

        const aliceBalanceBefore = await betToken.balanceOf(alice.address);

        // Alice 兑换 TokenID 0
        await expect(lottery.connect(alice).claimWinnings(0)) // 0 是 Alice 的 TokenID
            .to.emit(lottery, "WinningsClaimed")
            .withArgs(0, alice.address, expectedPayout);
        
        // 验证 Alice 余额
        const aliceBalanceAfter = await betToken.balanceOf(alice.address);
        expect(aliceBalanceAfter).to.equal(aliceBalanceBefore + expectedPayout);

        // 验证 NFT 已被销毁 (防止二次兑奖)
        await expect(lotteryTicket.ownerOf(0)).to.be.revertedWith("ERC721: invalid token ID");

        // --- 4. 输家 (Bob) 尝试兑奖 ---
        await expect(lottery.connect(bob).claimWinnings(1)) // 1 是 Bob 的 TokenID
            .to.be.revertedWith("Not a winning ticket");
    });

    it("5. 应该正确处理多个赢家平分奖池", async function () {
        // --- 1. 设置: 项目(100 pool) + Alice(50) + Bob(50) 都押 0 ---
        const oraclePool = parseEther("100");
        await betToken.connect(oracle).approve(await lottery.getAddress(), oraclePool);
        await lottery.connect(oracle).createProject("F1 Finals", ["Team A", "Team B"], oraclePool);
        
        const aliceBetAmount = parseEther("50"); // 押 Team A (Option 0)
        await betToken.connect(alice).approve(await lottery.getAddress(), aliceBetAmount);
        await lottery.connect(alice).bet(projectId_0, 0, aliceBetAmount); // Alice 获得 TokenID 0

        const bobBetAmount = parseEther("50"); // 押 Team A (Option 0)
        await betToken.connect(bob).approve(await lottery.getAddress(), bobBetAmount);
        await lottery.connect(bob).bet(projectId_0, 0, bobBetAmount); // Bob 获得 TokenID 1

        // --- 2. Oracle 结算 ---
        await lottery.connect(oracle).resolveProject(projectId_0, 0); // Team A 获胜

        // --- 3. 计算奖金 ---
        // 总奖池 = 100 (Oracle) + 50 (Alice) + 50 (Bob) = 200
        // 获胜方总下注 = 50 (Alice) + 50 (Bob) = 100
        
        // Alice 奖金 = (50 / 100) * 200 = 100
        const aliceExpectedPayout = parseEther("100");
        // Bob 奖金 = (50 / 100) * 200 = 100
        const bobExpectedPayout = parseEther("100");

        // --- 4. 双方兑奖 ---
        const aliceBalanceBefore = await betToken.balanceOf(alice.address);
        await lottery.connect(alice).claimWinnings(0); // Alice (TokenID 0)
        const aliceBalanceAfter = await betToken.balanceOf(alice.address);
        expect(aliceBalanceAfter).to.equal(aliceBalanceBefore + aliceExpectedPayout);
        
        const bobBalanceBefore = await betToken.balanceOf(bob.address);
        await lottery.connect(bob).claimWinnings(1); // Bob (TokenID 1)
        const bobBalanceAfter = await betToken.balanceOf(bob.address);
        expect(bobBalanceAfter).to.equal(bobBalanceBefore + bobExpectedPayout);

        // 验证合约奖池清空 (或接近清空，可能有极小精度损失，但用 integer 应该是0)
        expect(await betToken.balanceOf(await lottery.getAddress())).to.equal(0);
    });

    it("6. 应该拒绝非法的操作 (Reverts)", async function () {
        // --- 1. 非 Oracle 尝试创建项目 ---
        await expect(lottery.connect(alice).createProject("Test", ["A", "B"], 100))
            .to.be.revertedWith("Not oracle");
        
        // --- 2. 在项目结算后尝试下注 ---
        // (先创建并结算项目)
        await betToken.connect(oracle).approve(await lottery.getAddress(), 100);
        await lottery.connect(oracle).createProject("Test", ["A", "B"], 100);
        await lottery.connect(oracle).resolveProject(projectId_0, 0);

        await betToken.connect(alice).approve(await lottery.getAddress(), 50);
        await expect(lottery.connect(alice).bet(projectId_0, 0, 50))
            .to.be.revertedWith("Project is closed");

        // --- 3. 尝试购买未挂单的 NFT ---
        await expect(marketplace.connect(bob).buyTicket(99)) // 99 是一个不存在的 TokenID
            .to.be.revertedWith("Not listed"); // 或者 ERC721 错误，取决于实现

        // --- 4. 尝试挂单不属于自己的 NFT ---
        // (Alice 投注获得 TokenID 0)
        await lottery.connect(oracle).createProject("Test 2", ["A", "B"], 0); // 创建新项目 1
        await betToken.connect(alice).approve(await lottery.getAddress(), 10);
        await lottery.connect(alice).bet(1, 0, 10); // Alice 获得 TokenID 0 (因为是新部署的)
        
        // (Bob 尝试挂单 Alice 的 TokenID 0)
        await expect(marketplace.connect(bob).listTicket(0, 100))
            .to.be.revertedWith("Not owner");
    });
});
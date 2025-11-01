// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./BetToken.sol";
import "./LotteryTicket.sol";

/**
 * @title DecentralizedLottery
 * @dev 主合约，管理竞猜项目、下注和结算。
 */
contract DecentralizedLottery is Ownable {
    address public immutable betTokenAddress;
    address public immutable ticketNftAddress;
    
    // 公证人（部署者）
    address public oracle;

    struct Option {
        string name;
        uint256 totalBetAmount; // 押注在该选项上的总金额
    }

    struct Project {
        string name;
        uint256 oraclePrizePool; // 公证人提供的基础奖池
        uint256 totalPlayerBets; // 玩家总下注金额
        bool isOpen;
        bool isResolved;
        uint256 winningOptionId;
        Option[] options;
    }

    mapping(uint256 => Project) public projects;
    uint256 public nextProjectId;

    event ProjectCreated(uint256 indexed projectId, string name, uint256 oraclePool);
    event BetPlaced(uint256 indexed projectId, uint256 indexed optionId, address indexed player, uint256 amount, uint256 tokenId);
    event ProjectResolved(uint256 indexed projectId, uint256 winningOptionId);
    event WinningsClaimed(uint256 indexed tokenId, address indexed player, uint256 payout);

    modifier onlyOracle() {
        require(msg.sender == oracle, "Not oracle");
        _;
    }

    constructor(address _betToken, address _ticketNft) Ownable(msg.sender) {
        oracle = msg.sender;
        betTokenAddress = _betToken;
        ticketNftAddress = _ticketNft;
    }

    /**
     * @dev 公证人创建新项目
     */
    function createProject(
        string memory name,
        string[] memory optionNames,
        uint256 oraclePoolAmount
    ) public onlyOracle {
        // 公证人必须先授权 BTOK 给本合约
        IERC20(betTokenAddress).transferFrom(msg.sender, address(this), oraclePoolAmount);

        Project storage newProject = projects[nextProjectId];
        newProject.name = name;
        newProject.oraclePrizePool = oraclePoolAmount;
        newProject.isOpen = true;

        for (uint i = 0; i < optionNames.length; i++) {
            newProject.options.push(Option(optionNames[i], 0));
        }

        emit ProjectCreated(nextProjectId, name, oraclePoolAmount);
        nextProjectId++;
    }

    /**
     * @dev 玩家下注
     */
    function bet(uint256 projectId, uint256 optionId, uint256 amount) public {
        Project storage project = projects[projectId];
        require(project.isOpen, "Project is closed");
        require(optionId < project.options.length, "Invalid option");
        
        // 1. 玩家转移 BTOK 到本合约
        IERC20(betTokenAddress).transferFrom(msg.sender, address(this), amount);

        // 2. 更新项目数据
        project.options[optionId].totalBetAmount += amount;
        project.totalPlayerBets += amount;

        // 3. 铸造 NFT 彩票凭证
        uint256 tokenId = LotteryTicket(ticketNftAddress).mintTicket(
            msg.sender,
            projectId,
            optionId,
            amount
        );

        emit BetPlaced(projectId, optionId, msg.sender, amount, tokenId);
    }

    /**
     * @dev 公证人公布结果
     */
    function resolveProject(uint256 projectId, uint256 winningOptionId) public onlyOracle {
        Project storage project = projects[projectId];
        require(project.isOpen, "Project not open");
        require(!project.isResolved, "Already resolved");
        
        project.isOpen = false;
        project.isResolved = true;
        project.winningOptionId = winningOptionId;

        emit ProjectResolved(projectId, winningOptionId);
    }

    /**
     * @dev 赢家兑换奖励
     */
    function claimWinnings(uint256 tokenId) public {
        // 1. 验证 NFT
        LotteryTicket nft = LotteryTicket(ticketNftAddress);
        require(nft.ownerOf(tokenId) == msg.sender, "Not ticket owner");
        
        // 分别接收三个返回值
        (uint256 projectId, uint256 optionId, uint256 betAmount) = nft.ticketInfo(tokenId);
        Project storage project = projects[projectId];

        // 2. 验证项目状态和是否中奖
        require(project.isResolved, "Project not resolved");
        require(optionId == project.winningOptionId, "Not a winning ticket");

        // 3. 计算奖金
        // 总奖池 = 公证人奖池 + 玩家总下注
        uint256 totalPool = project.oraclePrizePool + project.totalPlayerBets;
        // 获胜选项的总下注额
        uint256 totalWinningBets = project.options[project.winningOptionId].totalBetAmount;
        
        // 你的奖金 = (你的下注额 / 获胜方总下注额) * 总奖池
        uint256 payout = (betAmount * totalPool) / totalWinningBets;

        // 4. 销毁 NFT（防止重复兑奖）
        nft.burnTicket(tokenId);

        // 5. 支付奖金
        IERC20(betTokenAddress).transfer(msg.sender, payout);

        emit WinningsClaimed(tokenId, msg.sender, payout);
    }
    /**
 * @dev 获取项目的选项数量
 */function getProjectOptionCount(uint256 projectId) public view returns (uint256) {
    return projects[projectId].options.length;}/**
 * @dev 获取项目的选项信息
 */function getProjectOption(uint256 projectId, uint256 optionIndex) public view returns (string memory name, uint256 totalBetAmount) {
    Option storage option = projects[projectId].options[optionIndex];
    return (option.name, option.totalBetAmount);}/**
 * @dev 获取完整项目信息（便于前端显示）
 */function getProjectInfo(uint256 projectId) public view returns (
    string memory name,
    uint256 oraclePrizePool,
    uint256 totalPlayerBets,
    bool isOpen,
    bool isResolved,
    uint256 winningOptionId,
    uint256 optionCount) {
    Project storage project = projects[projectId];
    return (
        project.name,
        project.oraclePrizePool,
        project.totalPlayerBets,
        project.isOpen,
        project.isResolved,
        project.winningOptionId,
        project.options.length
    );} 
}
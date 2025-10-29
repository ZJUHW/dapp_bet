// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract LotteryTicket is ERC721, Ownable {
    uint256 private _nextTokenId;
    
    // 只有主合约地址才能调用铸造/销毁
    address public lotteryContractAddress;

    // 每个TokenID对应的下注信息
    struct TicketInfo {
        uint256 projectId;  // 对应的项目ID
        uint256 optionId;   // 对应的选项ID
        uint256 betAmount;  // 原始下注金额
    }

    mapping(uint256 => TicketInfo) public ticketInfo;

    modifier onlyLotteryContract() {
        require(msg.sender == lotteryContractAddress, "Only lottery contract");
        _;
    }

    constructor() ERC721("Lottery Ticket", "LTK") Ownable(msg.sender) {}

    /**
     * @dev 设置主合约地址，只有Owner（部署者）能调用
     */
    function setLotteryContract(address _address) public onlyOwner {
        lotteryContractAddress = _address;
    }

    /**
     * @dev 铸造一张新彩票（只能由主合约调用）
     */
    function mintTicket(
        address to,
        uint256 projectId,
        uint256 optionId,
        uint256 betAmount
    ) public onlyLotteryContract returns (uint256) {
        uint256 tokenId = _nextTokenId;
        _safeMint(to, tokenId);
        ticketInfo[tokenId] = TicketInfo(projectId, optionId, betAmount);
        _nextTokenId++;
        return tokenId;
    }

    
    function burnTicket(uint256 tokenId) public onlyLotteryContract {
        _burn(tokenId);
        delete ticketInfo[tokenId];
    }
}
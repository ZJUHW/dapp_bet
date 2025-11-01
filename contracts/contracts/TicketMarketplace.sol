// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./LotteryTicket.sol"; // 导入Ticket合约以获取TicketInfo结构

/**
 * @title TicketMarketplace
 * @dev 允许用户买卖 LotteryTicket NFT 的市场。
 */
contract TicketMarketplace {
    address public immutable betTokenAddress;
    address public immutable ticketNftAddress;

    // 挂单信息
    struct Listing {
        address seller;
        uint256 price; // BTOK 价格
    }

    // 核心：TokenID -> 挂单信息
    mapping(uint256 => Listing) public listings;


    // 当挂单时，我们把彩票的“类别”也作为 indexed 参数，以便前端过滤
    event TicketListed(
        uint256 indexed tokenId,
        uint256 indexed projectId,
        uint256 indexed optionId,
        address seller,
        uint256 price
    );
    event TicketSold(
        uint256 indexed tokenId,
        address seller,
        address buyer,
        uint256 price
    );
    event ListingCancelled(uint256 indexed tokenId);

    constructor(address _betToken, address _ticketNft) {
        betTokenAddress = _betToken;
        ticketNftAddress = _ticketNft;
    }

    /**
     * @dev 挂单出售一张彩票
     */
    function listTicket(uint256 tokenId, uint256 price) public {
        IERC721 nft = IERC721(ticketNftAddress);
        // 确认调用者是NFT的拥有者
        require(nft.ownerOf(tokenId) == msg.sender, "Not owner");
        // 必须授权给本合约
        require(nft.getApproved(tokenId) == address(this), "Not approved");
        require(price > 0, "Price must be positive");

        listings[tokenId] = Listing(msg.sender, price);

        // 从NFT合约获取项目和选项ID，用于发B事件
        (uint256 projectId, uint256 optionId, uint256 betAmount) = LotteryTicket(ticketNftAddress).ticketInfo(tokenId);
        emit TicketListed(tokenId, projectId, optionId, msg.sender, price);
    }

    /**
     * @dev 取消挂单
     */
    function cancelListing(uint256 tokenId) public {
        Listing storage listing = listings[tokenId];
        require(listing.seller == msg.sender, "Not seller");
        
        delete listings[tokenId];
        emit ListingCancelled(tokenId);
    }

    /**
     * @dev 购买一张彩票
     */
    function buyTicket(uint256 tokenId) public {
        Listing memory listing = listings[tokenId];
        require(listing.price > 0, "Not listed");
        require(listing.seller != msg.sender, "Cannot buy own");

        IERC20 token = IERC20(betTokenAddress);
        IERC721 nft = IERC721(ticketNftAddress);

        // 1. 转移 BTOK（从 购买者 -> 出售者）
        // 购买者必须先授权BTOK给本合约
        token.transferFrom(msg.sender, listing.seller, listing.price);

        // 2. 转移 NFT（从 出售者 -> 购买者）
        // 出售者已在listTicket时授权
        nft.transferFrom(listing.seller, msg.sender, tokenId);

        // 3. 清除挂单
        delete listings[tokenId];
        emit TicketSold(tokenId, listing.seller, msg.sender, listing.price);
    }
}
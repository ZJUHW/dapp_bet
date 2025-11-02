// src/config.ts

// 1. 导入你的 ABI JSON 文件
// (确保这些文件在 'src/' 目录的某个地方，并相应地调整路径)
import BetTokenABI from './artifacts/BetToken.json';
import LotteryTicketABI from './artifacts/LotteryTicket.json';
import TicketMarketplaceABI from './artifacts/TicketMarketplace.json';
import DecentralizedLotteryABI from './artifacts/DecentralizedLottery.json';

// 2. 你的 Ganache 链 ID
// (通常是 1337 或 5777。 0x539 是 1337)
export const GANACHE_CHAIN_ID = '0x539'; 

// 3. 粘贴你刚刚部署的新地址
export const addresses = {
    betToken: "0x03feEB2177CDab4417Ee6fD8701b5d0b0782F5f4",
    lotteryTicket: "0xf2D9c6C659579baAf6D301eB13Ed2d5525D51097",
    marketplace: "0x839aDBa51C33697bc59e15f1193e41B4d6354052",
    lottery: "0x170d1ACBd046ACd4502E481AE95e97362772BE18"
};

// 4. 提取 ABIs
export const abis = {
    betToken: BetTokenABI.abi,
    lotteryTicket: LotteryTicketABI.abi,
    marketplace: TicketMarketplaceABI.abi,
    lottery: DecentralizedLotteryABI.abi
};
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
    betToken: "0x3Ee127e79cdD19a4Cd5F4a7a6f1d74111C96E3f2",
    lotteryTicket: "0xb6BF103141694d0Ac2421D49c11E3c44e94f9E98",
    marketplace: "0x8ae6D60466B252D1D572f9C2469Ff10948153894",
    lottery: "0x9807C64B361cb6004885465b85a422768Cae8040"
};

// 4. 提取 ABIs
export const abis = {
    betToken: BetTokenABI.abi,
    lotteryTicket: LotteryTicketABI.abi,
    marketplace: TicketMarketplaceABI.abi,
    lottery: DecentralizedLotteryABI.abi
};
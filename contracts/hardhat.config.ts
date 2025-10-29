import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  networks: {
    ganache: {
      // rpc url, change it according to your ganache configuration
      url: 'HTTP://127.0.0.1:8545',
      // the private key of signers, change it according to your ganache user
      accounts: [
        '0x6feca58f7c3076baaee59275603ce82d92b144f332847f4a841fe1dfd2ab8f98'
      ]
    },
  },
};

export default config;

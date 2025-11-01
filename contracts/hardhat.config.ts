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
        '0x6feca58f7c3076baaee59275603ce82d92b144f332847f4a841fe1dfd2ab8f98',
        '0x4c6825b578ebc2035d3b4e432c9066866fcd4b90421669145a03159faa045011',  
        '0x30c41bd2a9435e0757e8b293e7947ae19cec0012ac962a4bbba642c88146097c',
        '0x87333b29f0cf1466e105e48d59e19d1cefd5915a8109ffa493a1c09365ef775f'      
      ]
    },
  },
};

export default config;

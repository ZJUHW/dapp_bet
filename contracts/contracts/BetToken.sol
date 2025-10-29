// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
//发币
contract BetToken is ERC20, Ownable {
    constructor() 
    ERC20("Betting Token", "BET") 
    Ownable(msg.sender) { 
        _mint(msg.sender, 1000000 * 10**18);
    }

   
    function faucet() public {
        require(balanceOf(msg.sender) == 0, "You already have tokens.");
        _mint(msg.sender, 1000 * 10**18); 
    }
}


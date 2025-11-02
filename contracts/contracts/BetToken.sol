// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
//发币
contract BetToken is ERC20, Ownable {
    mapping(address => bool) public hasClaimed;
    
    constructor() 
    ERC20("Betting Token", "BET") 
    Ownable(msg.sender) { 
        _mint(msg.sender, 1000000 * 10**18);
    }

    function faucet() public {
        require(!hasClaimed[msg.sender], "You already claimed tokens.");
        hasClaimed[msg.sender] = true;
        _mint(msg.sender, 1000 * 10**18); 
    }
}

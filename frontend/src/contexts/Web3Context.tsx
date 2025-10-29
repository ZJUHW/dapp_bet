// src/contexts/Web3Context.tsx

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { ethers, BrowserProvider, Signer, Contract } from 'ethers';
// 确保你的 config.ts 路径正确
import { addresses, abis, GANACHE_CHAIN_ID } from '../config'; 
import { Toaster, toast } from 'react-hot-toast';
declare global {
    interface Window {
        ethereum?: any;
    }
}
// 定义 Context 状态的类型
interface Web3ContextState {
    provider: BrowserProvider | null;
    signer: Signer | null;
    account: string | null;
    betToken: Contract | null;
    lotteryTicket: Contract | null;
    marketplace: Contract | null;
    lottery: Contract | null;
    isConnected: boolean;
    connectWallet: () => Promise<void>;
}

// 创建 Context
const Web3Context = createContext<Web3ContextState | undefined>(undefined);

// Context Provider 组件
export const Web3Provider = ({ children }: { children: ReactNode }) => {
    const [provider, setProvider] = useState<BrowserProvider | null>(null);
    const [signer, setSigner] = useState<Signer | null>(null);
    const [account, setAccount] = useState<string | null>(null);
    const [betToken, setBetToken] = useState<Contract | null>(null);
    const [lotteryTicket, setLotteryTicket] = useState<Contract | null>(null);
    const [marketplace, setMarketplace] = useState<Contract | null>(null);
    const [lottery, setLottery] = useState<Contract | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    const connectWallet = async () => {
        if (typeof window.ethereum === 'undefined') {
            toast.error('请安装 MetaMask！');
            return;
        }

        try {
            // 使用 ethers.BrowserProvider
            const browserProvider = new ethers.BrowserProvider(window.ethereum);

            // 检查网络
            const network = await browserProvider.getNetwork();
            if (network.chainId.toString() !== BigInt(GANACHE_CHAIN_ID).toString()) {
                toast.error(`请切换到 Ganache 网络 (ChainID: ${parseInt(GANACHE_CHAIN_ID, 16)})`);
                try {
                    await window.ethereum.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: GANACHE_CHAIN_ID }],
                    });
                } catch (switchError: any) {
                    toast.error('网络切换失败，请手动切换。');
                    return;
                }
            }

            // 请求账户
            const userSigner = await browserProvider.getSigner();
            const userAccount = await userSigner.getAddress();

            // 实例化合约
            const bt = new ethers.Contract(addresses.betToken, abis.betToken, userSigner);
            const lt = new ethers.Contract(addresses.lotteryTicket, abis.lotteryTicket, userSigner);
            const mp = new ethers.Contract(addresses.marketplace, abis.marketplace, userSigner);
            const l = new ethers.Contract(addresses.lottery, abis.lottery, userSigner);

            // 更新状态
            setProvider(browserProvider);
            setSigner(userSigner);
            setAccount(userAccount);
            setBetToken(bt);
            setLotteryTicket(lt);
            setMarketplace(mp);
            setLottery(l);
            setIsConnected(true);

            toast.success('钱包已连接！');

        } catch (error) {
            console.error(error);
            toast.error('连接钱包失败。');
        }
    };

    // 监听账户和网络变化
    useEffect(() => {
        const handleAccountsChanged = (accounts: string[]) => {
            if (accounts.length === 0) {
                setIsConnected(false);
                setAccount(null);
                toast('钱包已断开连接');
            } else {
                connectWallet(); // 自动重新连接
            }
        };

        const handleChainChanged = () => {
            window.location.reload(); // 切换网络后重载页面
        };

        if (window.ethereum) {
            window.ethereum.on('accountsChanged', handleAccountsChanged);
            window.ethereum.on('chainChanged', handleChainChanged);
        }

        return () => {
            if (window.ethereum) {
                window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
                window.ethereum.removeListener('chainChanged', handleChainChanged);
            }
        };
    }, []);


    return (
        <Web3Context.Provider
            value={{
                provider,
                signer,
                account,
                betToken,
                lotteryTicket,
                marketplace,
                lottery,
                isConnected,
                connectWallet,
            }}
        >
            {/* 引入 react-hot-toast */}
            <Toaster position="top-right" reverseOrder={false} />
            {children}
        </Web3Context.Provider>
    );
};

// 自定义 Hook
export const useWeb3 = () => {
    const context = useContext(Web3Context);
    if (context === undefined) {
        throw new Error('useWeb3 必须在 Web3Provider 中使用');
    }
    return context;
};
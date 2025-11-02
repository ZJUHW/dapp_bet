// src/App.tsx

import React, { useState, useEffect, FormEvent } from 'react';
import { ethers, Contract, parseEther, formatEther } from 'ethers';
import { useWeb3, Web3Provider } from './contexts/Web3Context'; 
import { GANACHE_CHAIN_ID } from './config'; // 导入 ChainID
import { toast } from 'react-hot-toast';

// --- 类型定义 ---
interface Project {
  id: number;
  name: string;
  oraclePrizePool: bigint;
  totalPlayerBets: bigint;
  isOpen: boolean;
  isResolved: boolean;
  winningOptionId: bigint;
  options: Option[];
}

interface Option {
  name: string;
  totalBetAmount: bigint;
}

interface MyTicket {
  tokenId: bigint;
  projectId: bigint;
  optionId: bigint;
  betAmount: bigint;
  projectName: string;
  optionName: string;
  isWinning: boolean;
  isResolved: boolean;
  listingPrice: bigint;
}

// 替换 'Listing' 接口为新的聚合结构
interface PriceLevel {
  price: bigint;
  tokenIds: bigint[]; // 所有在此价格出售的 tokenIds
  count: number;
}

interface AggregatedListing {
  key: string; // 唯一的聚合 Key (project-option-betAmount)
  projectId: bigint;
  optionId: bigint;
  betAmount: bigint;
  
  // 显示名称
  projectName: string;
  optionName: string;
  
  // 聚合后的订单簿
  priceLevels: PriceLevel[]; 
}

// --- 简单样式 ---
const styles: { [key: string]: React.CSSProperties } = {
  container: { fontFamily: 'Arial, sans-serif', padding: '20px', maxWidth: '1200px', margin: 'auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #ccc', paddingBottom: '10px' },
  section: { background: '#f9f9f9', border: '1px solid #ddd', padding: '15px', marginTop: '20px', borderRadius: '8px' },
  sectionTitle: { fontSize: '1.5em', borderBottom: '1px solid #ccc', paddingBottom: '5px', marginBottom: '15px' },
  button: { cursor: 'pointer', background: '#007bff', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '4px', margin: '5px' },
  input: { padding: '8px', margin: '5px', border: '1px solid #ccc', borderRadius: '4px' },
  item: { border: '1px solid #eee', background: 'white', padding: '10px', margin: '10px 0', borderRadius: '4px' },
  subItem: { borderTop: '1px dashed #ccc', margin: '10px 0', paddingTop: '10px' },
  //为新的订单簿添加样式
  orderBookGroup: { border: '1px solid #007bff', background: 'white', padding: '15px', margin: '15px 0', borderRadius: '8px' },
  orderBookHeader: { fontSize: '1.2em', fontWeight: 'bold', marginBottom: '10px' },
  priceLevelRow: { display: 'flex', justifyContent: 'space-between', padding: '5px', borderBottom: '1px solid #f0f0f0' }
};

// 连接 & 水龙头
const Header: React.FC<{ refreshTrigger: number, onRefresh: () => void }> = ({ refreshTrigger, onRefresh }) => {
  const { isConnected, connectWallet, account, betToken, lottery } = useWeb3();
  const [oracleAddress, setOracleAddress] = useState('');
  const [balance, setBalance] = useState<string>('0');

  useEffect(() => {
    const checkOracle = async () => {
      if (lottery) {
        try {
          const oracle = await lottery.oracle();
          setOracleAddress(oracle);
        } catch (e) {
          console.error("无法获取公证人地址", e);
        }
      }
    };
    checkOracle();
  }, [lottery, account]);

  useEffect(() => {
    const fetchBalance = async () => {
      if (betToken && account) {
        try {
          const balanceWei = await betToken.balanceOf(account);
          setBalance(formatEther(balanceWei));
        } catch (e) {
          console.error("无法获取 BET 余额", e);
          setBalance('0');
        }
      }
    };
    fetchBalance();
  }, [account, betToken, refreshTrigger]); 

  const handleGetFaucet = async () => {
    if (!betToken) return toast.error('钱包未连接');
    try {
      const tx = await betToken.faucet();
      toast.promise(tx.wait(), {
        loading: '正在领取 1000 BET...',
        success: (result) => {
          onRefresh(); 
          return '成功领取 1000 BET！';
        },
        error: (err) => {
          if (err.message?.includes("You already have tokens")) {
            return "你已经有代币了，无法重复领取。";
          }
          return '领取失败';
        },
      });
    } catch (e: any) {
      console.error(e);
      if (e.data?.message?.includes("You already have tokens") || e.message?.includes("You already have tokens")) {
        toast.error("你已经有代币了，无法重复领取。");
      } else {
        toast.error('领取失败');
      }
    }
  };

  return (
    <div style={styles.header}>
      <h2>去中心化彩票 - 超级控制台</h2>
      <div>
        {isConnected ? (
          <>
            <button onClick={handleGetFaucet} style={styles.button}>
              领取 BET
            </button>
            <span style={{ marginLeft: '15px', fontWeight: 'bold' }}>
              {parseFloat(balance).toFixed(2)} BET
            </span>
            <span style={{ marginLeft: '15px' }}>
              {account?.substring(0, 6)}...{account?.substring(account.length - 4)}
              {account?.toLowerCase() === oracleAddress.toLowerCase() && ' (公证人)'}
            </span>
          </>
        ) : (
          <button onClick={connectWallet} style={styles.button}>
            连接钱包
          </button>
        )}
      </div>
    </div>
  );
};

// 公证人面板 
const AdminPanel: React.FC<{ onRefresh: () => void }> = ({ onRefresh }) => {
  const { lottery, betToken } = useWeb3();
  const [name, setName] = useState('');
  const [options, setOptions] = useState<string[]>(['选项A', '选项B']);
  const [poolAmount, setPoolAmount] = useState('0');

  const handleAddOption = () => setOptions([...options, `选项${options.length + 1}`]);
  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleCreateProject = async (e: FormEvent) => {
    e.preventDefault();
    if (!lottery || !betToken) return toast.error('钱包未连接');
    if (options.length < 2) return toast.error('至少需要2个选项');

    const loadingToast = toast.loading('正在处理...');
    try {
      const amountWei = parseEther(poolAmount);
      toast.loading('请授权 BET...', { id: loadingToast });
      const approveTx = await betToken.approve(await lottery.getAddress(), amountWei);
      await approveTx.wait();
      toast.loading('正在创建项目...', { id: loadingToast });
      const createTx = await lottery.createProject(name, options, amountWei);
      await createTx.wait();
      toast.success('项目创建成功！', { id: loadingToast });
      onRefresh(); 
    } catch (e: any) {
      console.error(e);
      toast.error(e.data?.message || e.message || '创建失败', { id: loadingToast });
    }
  };

  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>公证人面板 (仅公证人可操作)</h3>
      <form onSubmit={handleCreateProject}>
         <div>
          项目名称:
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={styles.input} required />
          基础奖池 (BET):
          <input type="number" value={poolAmount} onChange={(e) => setPoolAmount(e.target.value)} style={styles.input} required min="0" />
        </div>
        <div>
          选项:
          {options.map((option, index) => (
            <input key={index} type="text" value={option} onChange={(e) => handleOptionChange(index, e.target.value)} style={styles.input} />
          ))}
          <button type="button" onClick={handleAddOption} style={styles.button}> + 添加选项 </button>
        </div>
        <button type="submit" style={styles.button}> 创建项目 </button>
      </form>
    </div>
  );
};

//项目列表 & 交互 
const ProjectList: React.FC<{ refreshTrigger: number, onRefresh: () => void }> = ({ refreshTrigger, onRefresh }) => {
  const { lottery, betToken } = useWeb3();
  const [projects, setProjects] = useState<Project[]>([]);
  const [betAmounts, setBetAmounts] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    const fetchProjects = async () => {
      if (!lottery) return;
      try {
        const nextId = await lottery.nextProjectId();
        const projectPromises: Promise<Project>[] = [];
        for (let i = 0; i < nextId; i++) {
          projectPromises.push(
            (async () => {
              const pInfo = await lottery.getProjectInfo(i);
              const optionCount = pInfo.optionCount;
              const optionsPromises: Promise<Option>[] = [];
              for (let j = 0; j < optionCount; j++) {
                optionsPromises.push(lottery.getProjectOption(i, j));
              }
              const optionsResults = await Promise.all(optionsPromises);
              const fetchedOptions: Option[] = optionsResults.map(opt => ({
                name: opt.name,
                totalBetAmount: opt.totalBetAmount
              }));
              
              return {
                id: i,
                name: pInfo.name,
                oraclePrizePool: pInfo.oraclePrizePool,
                totalPlayerBets: pInfo.totalPlayerBets,
                isOpen: pInfo.isOpen,
                isResolved: pInfo.isResolved,
                winningOptionId: pInfo.winningOptionId,
                options: fetchedOptions,
              };
            })()
          );
        }
        const resolvedProjects = await Promise.all(projectPromises);
        setProjects(resolvedProjects.reverse());
      } catch (e) {
        console.error("获取项目失败:", e);
        toast.error('获取项目失败。');
      }
    };
    fetchProjects();
  }, [lottery, refreshTrigger]); 

  const handleBet = async (projectId: number, optionId: number) => {
    if (!lottery || !betToken) return toast.error('钱包未连接');
    const amount = betAmounts[`${projectId}-${optionId}`] || '0';
    if (parseFloat(amount) <= 0) return toast.error('金额必须大于0');

    const loadingToast = toast.loading('正在处理下注...');
    try {
      const amountWei = parseEther(amount);
      toast.loading('请授权 BET...', { id: loadingToast });
      const approveTx = await betToken.approve(await lottery.getAddress(), amountWei);
      await approveTx.wait();
      toast.loading('正在下注...', { id: loadingToast });
      const betTx = await lottery.bet(projectId, optionId, amountWei);
      await betTx.wait();
      toast.success('下注成功！', { id: loadingToast });
      setBetAmounts(prev => ({ ...prev, [`${projectId}-${optionId}`]: '' }));
      onRefresh(); 
    } catch (e: any) {
      console.error(e);
      toast.error(e.data?.message || e.message || '下注失败', { id: loadingToast });
    }
  };

  const handleResolve = async (projectId: number, winningOptionId: number) => {
    if (!lottery) return toast.error('钱包未连接');
    const loadingToast = toast.loading('正在结算...');
    try {
      const tx = await lottery.resolveProject(projectId, winningOptionId);
      await tx.wait();
      toast.success('项目已结算！', { id: loadingToast });
      onRefresh(); 
    } catch (e: any) {
      console.error(e);
      toast.error(e.data?.message || e.message || '结算失败', { id: loadingToast });
    }
  };

  const handleBetAmountChange = (key: string, value: string) => {
    setBetAmounts(prev => ({ ...prev, [key]: value }));
  };

  if (projects.length === 0) return <div style={styles.section}>暂无项目</div>;

  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>项目列表</h3>
      {projects.map(p => (
        <div key={p.id} style={styles.item}>
          <h4>{p.name} (ID: {p.id}) - {p.isResolved ? '已结束' : (p.isOpen ? '进行中' : '已关闭')}</h4>
          <p>总奖池: {formatEther(p.oraclePrizePool + p.totalPlayerBets)} BET</p>
          
          {p.options.map((opt, optId) => (
            <div key={optId} style={styles.subItem}>
              <span>{opt.name} (总下注: {formatEther(opt.totalBetAmount)} BET)</span>
              {p.isResolved && p.winningOptionId === BigInt(optId) && ' 🏆'}
              {p.isOpen && (
                <>
                  <input type="number" placeholder="BET 金额" style={styles.input} value={betAmounts[`${p.id}-${optId}`] || ''} onChange={(e) => handleBetAmountChange(`${p.id}-${optId}`, e.target.value)} />
                  <button style={styles.button} onClick={() => handleBet(p.id, optId)}> 下注 </button>
                </>
              )}
            </div>
          ))}

          {p.isOpen && (
            <div style={styles.subItem}>
              <strong>公证人结算: </strong>
              {p.options.map((opt, optId) => (
                <button key={optId} style={styles.button} onClick={() => handleResolve(p.id, optId)}> 宣布 "{opt.name}" 获胜 </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

//  我的彩票 
const MyTickets: React.FC<{ refreshTrigger: number, onRefresh: () => void }> = ({ refreshTrigger, onRefresh }) => {
  const { lotteryTicket, marketplace, lottery, account } = useWeb3();
  const [tickets, setTickets] = useState<MyTicket[]>([]);
  const [listPrices, setListPrices] = useState<{ [key: string]: string }>({});

  useEffect(() => {
  const fetchTickets = async () => {
    if (!lotteryTicket || !account || !lottery || !marketplace) return;
    
    setTickets([]);
    
    try {
      const filter = lotteryTicket.filters.Transfer(null, account);
      const mintEvents = await lotteryTicket.queryFilter(filter, 0, 'latest');
      
      const ticketPromises = mintEvents.map(async (event: any) => {
        try {
          const tokenId = event.args.tokenId;
          const currentOwner = await lotteryTicket.ownerOf(tokenId);
          if (currentOwner.toLowerCase() !== account.toLowerCase()) {
            return null; 
          }
          
          const info = await lotteryTicket.ticketInfo(tokenId);
          const projectInfo = await lottery.getProjectInfo(info.projectId);
          const optionInfo = await lottery.getProjectOption(info.projectId, info.optionId);
          const listing = await marketplace.listings(tokenId);

          return {
            tokenId: tokenId,
            projectId: info.projectId,
            optionId: info.optionId,
            betAmount: info.betAmount,
            projectName: projectInfo.name,
            optionName: optionInfo.name,
            isResolved: projectInfo.isResolved,
            isWinning: projectInfo.isResolved && projectInfo.winningOptionId === info.optionId,
            listingPrice: listing.price,
          };
        } catch (e) {
          console.error('获取票信息失败:', e);
          return null;
        }
      });

      const resolvedTickets = (await Promise.all(ticketPromises)).filter(t => t !== null) as MyTicket[];
      setTickets(resolvedTickets);
      
    } catch (e) {
      console.error("获取彩票失败:", e);
    }
  };
  
  fetchTickets();
}, [lotteryTicket, account, lottery, marketplace, refreshTrigger]);

  // 挂单
  const handleListTicket = async (tokenId: bigint) => {
    if (!marketplace || !lotteryTicket) return toast.error('钱包未连接');
    const price = listPrices[tokenId.toString()] || '0';
    if (parseFloat(price) <= 0) return toast.error('价格必须大于0'); 

    const loadingToast = toast.loading('正在处理挂单...');
    try {
      const priceWei = parseEther(price);
      toast.loading('请授权 NFT...', { id: loadingToast });
      const approveTx = await lotteryTicket.approve(await marketplace.getAddress(), tokenId);
      await approveTx.wait();
      toast.loading('正在挂单...', { id: loadingToast });
      const listTx = await marketplace.listTicket(tokenId, priceWei);
      await listTx.wait();
      toast.success('挂单成功！', { id: loadingToast });
      onRefresh(); 
    } catch (e: any) {
      console.error(e);
      toast.error(e.data?.message || e.message || '挂单失败', { id: loadingToast });
    }
  };

  // 取消挂单
  const handleCancelListing = async (tokenId: bigint) => {
    if (!marketplace) return toast.error('钱包未连接');
    const loadingToast = toast.loading('正在取消...');
    try {
      const tx = await marketplace.cancelListing(tokenId);
      await tx.wait();
      toast.success('取消成功！', { id: loadingToast });
      onRefresh(); 
    } catch (e: any) {
      console.error(e);
      toast.error(e.data?.message || e.message || '取消失败', { id: loadingToast });
    }
  };

  // 兑奖
  const handleClaim = async (tokenId: bigint) => {
    if (!lottery) return toast.error('钱包未连接');
    const loadingToast = toast.loading('正在兑奖...');
    try {
      const tx = await lottery.claimWinnings(tokenId); 
      await tx.wait();
      toast.success('兑奖成功！', { id: loadingToast });
      onRefresh(); 
    } catch (e: any) {
      console.error(e);
      toast.error(e.data?.message || e.message || '兑奖失败', { id: loadingToast });
    }
  };

  if (tickets.length === 0) return <div style={styles.section}>你目前没有彩票</div>;

  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>我的彩票</h3>
      {tickets.map(t => (
        <div key={t.tokenId.toString()} style={styles.item}>
          <strong>Token ID: {t.tokenId.toString()}</strong>
          <p>
            项目: {t.projectName} (ID: {t.projectId.toString()}) <br />
            选项: {t.optionName} <br />
            原始下注: {formatEther(t.betAmount)} BET
          </p>
          
          {t.isResolved ? (
            t.isWinning ? (
              <button style={styles.button} onClick={() => handleClaim(t.tokenId)}>
                🏆 兑换奖金
              </button>
            ) : (
              <span>未中奖</span>
            )
          ) : t.listingPrice > 0n ? (
            <>
              <span>正在出售: {formatEther(t.listingPrice)} BET</span>
              <button style={styles.button} onClick={() => handleCancelListing(t.tokenId)}>
                取消挂单
              </button>
            </>
          ) : (
            <>
              <input type="number" placeholder="出售价格 (BET)" style={styles.input} onChange={(e) => setListPrices(p => ({ ...p, [t.tokenId.toString()]: e.target.value }))} />
              <button style={styles.button} onClick={() => handleListTicket(t.tokenId)}>
                挂单出售
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
};

// --- 5. 订单簿 (市场) ---
const OrderBook: React.FC<{ refreshTrigger: number, onRefresh: () => void }> = ({ refreshTrigger, onRefresh }) => {
  const { marketplace, betToken, lottery, lotteryTicket, account } = useWeb3();
  
  const [aggregatedListings, setAggregatedListings] = useState<AggregatedListing[]>([]);

  useEffect(() => {
    const fetchListings = async () => {
      // 确保所有合约都已加载
      if (!marketplace || !lottery || !account || !lotteryTicket) return;


      // Key: "${projectId}-${optionId}-${betAmount}"
      // Value: AggregatedListing
      const aggregator = new Map<string, AggregatedListing>();

      // 2. 获取所有 TicketListed 事件
      const filter = marketplace.filters.TicketListed();
      const events = await marketplace.queryFilter(filter, 0, 'latest');
      

      for (const event of (events as any[])) {
        const { tokenId, projectId, optionId, seller, price } = event.args;

        try {
          // 4. 检查是否是自己的挂单
          if (seller.toLowerCase() === account.toLowerCase()) {
             continue; // 是自己的挂单，跳到下一个 event
          }
          
          // 5. 检查该 tokenId 是否还在售
          const currentListing = await marketplace.listings(tokenId);
          if (currentListing.price === 0n) {
             continue; // 已售出或取消
          }
          // 确保事件价格和当前挂单价格一致
          if (currentListing.price !== price) {
             continue;
          }
          // 检查这个 NFT 是否还存在
          try {
              // 我们尝试获取 owner。如果 NFT 被销毁了，
              await lotteryTicket.ownerOf(tokenId);
          } catch (ownerError) {
              //  NFT 已被销毁 (卖家已兑奖)
              console.warn(`过滤掉僵尸挂单: Token ID ${tokenId} 已被销毁`);
              continue; 
          }
          // 6. 获取 betAmount，这是聚合的关键！
          const info = await lotteryTicket.ticketInfo(tokenId);
          const betAmount = info.betAmount;

          // 7. 创建唯一的聚合 Key
          const key = `${projectId}-${optionId}-${betAmount}`;

          // 8. 检查此聚合组是否已存在
          if (!aggregator.has(key)) {
            // 如果不存在，创建新组 (需要 await 来获取名称)
            const projectInfo = await lottery.getProjectInfo(projectId);
            const optionInfo = await lottery.getProjectOption(projectId, optionId);
            
            aggregator.set(key, {
              key: key,
              projectId: projectId,
              optionId: optionId,
              betAmount: betAmount,
              projectName: projectInfo.name,
              optionName: optionInfo.name,
              priceLevels: [], // 初始化为空
            });
          }

          // 9. 将此 tokenId 添加到其聚合组
          const group = aggregator.get(key)!; // 我们知道它现在一定存在

          // 查找此价格水平是否已存在
          let priceLevel = group.priceLevels.find(p => p.price === price);

          if (!priceLevel) {
            // 如果此价格水平不存在，创建它
            priceLevel = { price: price, tokenIds: [], count: 0 };
            group.priceLevels.push(priceLevel);
          }

          // 添加 tokenId 并增加计数
          priceLevel.tokenIds.push(tokenId);
          priceLevel.count++;

        } catch (e) {
          console.error("处理挂单事件时出错:", e);
          // 继续处理下一个 event
        }
      } // 串行循环结束
      
      // 10. 将 Map 转换为数组
      const allListings = Array.from(aggregator.values());
      

      // 首先，按项目ID对外部组进行排序 (可选)
      allListings.sort((a, b) => Number(a.projectId) - Number(b.projectId));
      
      // 对每个组内部的 priceLevels 按价格升序排序
      for (const group of allListings) {
        //  使用正确的 bigint 排序
        group.priceLevels.sort((a, b) => {
          if (a.price < b.price) return -1; // a (低价) 在前
          if (a.price > b.price) return 1;  // b (低价) 在前
          return 0;
        });
      }

      setAggregatedListings(allListings);
    };

    fetchListings();
  }, [marketplace, lottery, lotteryTicket, account, refreshTrigger]);

  // 购买彩票
  const handleBuy = async (tokenToBuy: bigint, price: bigint) => {
    if (!marketplace || !betToken) return toast.error('钱包未连接');
    
    const loadingToast = toast.loading('正在处理购买...');
    try {
      // 1. 授权 BET
      toast.loading('请授权 BET...', { id: loadingToast });
      const approveTx = await betToken.approve(await marketplace.getAddress(), price);
      await approveTx.wait();

      // 2. 购买
      toast.loading('正在购买 NFT...', { id: loadingToast });
      // 购买此价格水平的第一个可用 tokenId
      const buyTx = await marketplace.buyTicket(tokenToBuy);
      await buyTx.wait();

      toast.success('购买成功！', { id: loadingToast });
      onRefresh(); // 刷新
    } catch (e: any) {
      console.error(e);
      toast.error(e.data?.message || e.message || '购买失败', { id: loadingToast });
    }
  };

  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>彩票市场 (订单簿)</h3>
      {aggregatedListings.length === 0 ? (
        <p>市场暂无挂单</p>
      ) : (
        aggregatedListings.map(group => (
          // 外部循环：每个 "聚合彩票"
          <div key={group.key} style={styles.orderBookGroup}>
            <div style={styles.orderBookHeader}>
              {group.projectName} - {group.optionName}
            </div>
            <p>
              <strong>原始赌注: {formatEther(group.betAmount)} BET</strong>
            </p>
            
            {/* 内部循环：每个 "价格水平" */}
            <div style={{...styles.subItem, padding: '5px'}}>
              <div style={{...styles.priceLevelRow, fontWeight: 'bold'}}>
                <span>价格 (BET)</span>
                <span>数量</span>
                <span>操作</span>
              </div>
              {group.priceLevels.map(level => (
                <div key={level.price.toString()} style={styles.priceLevelRow}>
                  <span>{formatEther(level.price)}</span>
                  <span>{level.count}</span>
                  <button 
                    style={{...styles.button, margin: 0, padding: '4px 8px'}} 
                    // 默认购买此价格水平的第一个 tokenId (FIFO)
                    onClick={() => handleBuy(level.tokenIds[0], level.price)}
                  >
                    购买
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
};
//  主应用 
function AppContent() {
  const { isConnected } = useWeb3();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const triggerRefresh = () => {
    console.log("刷新按钮被点击! 触发器 +1"); 
    setRefreshTrigger(t => t + 1);
  }
  

  return (
    <div style={styles.container}>
      <Header refreshTrigger={refreshTrigger} onRefresh={triggerRefresh} />

      {!isConnected ? (
        <div style={styles.section}>
            <h2>请先连接你的钱包</h2>
            <p>请确保你已连接到 Ganache/Hardhat 网络 (ChainID: {parseInt(GANACHE_CHAIN_ID, 16)})</p>
        </div>
      ) : (
        <>
          <button 
            style={{...styles.button, background: '#28a745', width: '100%', padding: '15px', fontSize: '1.2em'}}
            onClick={triggerRefresh}
          >
            🔄 手动刷新所有数据
          </button>
          
          <AdminPanel onRefresh={triggerRefresh} />
          <ProjectList refreshTrigger={refreshTrigger} onRefresh={triggerRefresh} />
          <MyTickets refreshTrigger={refreshTrigger} onRefresh={triggerRefresh} />
          <OrderBook refreshTrigger={refreshTrigger} onRefresh={triggerRefresh} />
        </>
      )}
    </div>
  );
}


function App() {
  return (
    <Web3Provider>
      <AppContent />
    </Web3Provider>
  );
}

export default App;
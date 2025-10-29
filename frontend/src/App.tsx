// src/App.tsx

import React, { useState, useEffect, FormEvent } from 'react';
import { ethers, Contract, parseEther, formatEther } from 'ethers';
// 确保路径正确
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

interface Listing {
  tokenId: bigint;
  projectId: bigint;
  optionId: bigint;
  seller: string;
  price: bigint;
  projectName: string;
  optionName: string;
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
  subItem: { borderTop: '1px dashed #ccc', margin: '10px 0', paddingTop: '10px' }
};

// --- 1. 头部组件 (连接 & 水龙头) ---
const Header: React.FC = () => {
  const { isConnected, connectWallet, account, betToken, lottery } = useWeb3();
  const [oracleAddress, setOracleAddress] = useState('');

  // 检查当前账户是否是公证人
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

  // 领取测试币
  const handleGetFaucet = async () => {
    if (!betToken) return toast.error('钱包未连接');
    try {
      const tx = await betToken.faucet();
      toast.promise(tx.wait(), {
        loading: '正在领取 1000 BET...',
        success: '成功领取 1000 BET！',
        error: (err) => {
          // 处理 BetToken.sol 中的 require
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

// --- 2. 公证人面板 ---
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

  // 创建项目
  const handleCreateProject = async (e: FormEvent) => {
    e.preventDefault();
    if (!lottery || !betToken) return toast.error('钱包未连接');
    if (options.length < 2) return toast.error('至少需要2个选项');

    const loadingToast = toast.loading('正在处理...');
    try {
      const amountWei = parseEther(poolAmount);

      // 步骤1: 授权
      toast.loading('请授权 BET...', { id: loadingToast });
      const approveTx = await betToken.approve(await lottery.getAddress(), amountWei);
      await approveTx.wait();

      // 步骤2: 创建
      toast.loading('正在创建项目...', { id: loadingToast });
      const createTx = await lottery.createProject(name, options, amountWei);
      await createTx.wait();

      toast.success('项目创建成功！', { id: loadingToast });
      onRefresh(); // 触发全局刷新
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

// --- 3. 项目列表 & 交互 ---
const ProjectList: React.FC<{ refreshTrigger: number, onRefresh: () => void }> = ({ refreshTrigger, onRefresh }) => {
  const { lottery, betToken } = useWeb3();
  const [projects, setProjects] = useState<Project[]>([]);
  const [betAmounts, setBetAmounts] = useState<{ [key: string]: string }>({});

  // 获取所有项目数据
  useEffect(() => {
    const fetchProjects = async () => {
      if (!lottery) return;
      try {
        const nextId = await lottery.nextProjectId();
        const projectPromises: Promise<Project>[] = [];

        for (let i = 0; i < nextId; i++) {
          projectPromises.push(
            (async () => {
              // 1. 调用你新的 getProjectInfo 函数
              const pInfo = await lottery.getProjectInfo(i);
              const optionCount = pInfo.optionCount; // 这是一个 BigInt

              // 2. 循环获取每个 Option
              const optionsPromises: Promise<Option>[] = [];
              for (let j = 0; j < optionCount; j++) {
                // 调用你新的 getProjectOption 函数
                optionsPromises.push(lottery.getProjectOption(i, j));
              }
              const optionsResults = await Promise.all(optionsPromises);

              const fetchedOptions: Option[] = optionsResults.map(opt => ({
                name: opt.name,
                totalBetAmount: opt.totalBetAmount
              }));
              
              // 3. 组合数据
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
        setProjects(resolvedProjects.reverse()); // 最近的在最上面
      } catch (e) {
        console.error("获取项目失败:", e);
        toast.error('获取项目失败。');
      }
    };
    fetchProjects();
  }, [lottery, refreshTrigger]); // 依赖 refreshTrigger 来刷新

  // 处理下注
  const handleBet = async (projectId: number, optionId: number) => {
    if (!lottery || !betToken) return toast.error('钱包未连接');
    const amount = betAmounts[`${projectId}-${optionId}`] || '0';
    if (parseFloat(amount) <= 0) return toast.error('金额必须大于0');

    const loadingToast = toast.loading('正在处理下注...');
    try {
      const amountWei = parseEther(amount);
      // 1. 授权
      toast.loading('请授权 BET...', { id: loadingToast });
      const approveTx = await betToken.approve(await lottery.getAddress(), amountWei);
      await approveTx.wait();

      // 2. 下注
      toast.loading('正在下注...', { id: loadingToast });
      const betTx = await lottery.bet(projectId, optionId, amountWei);
      await betTx.wait();

      toast.success('下注成功！', { id: loadingToast });
      setBetAmounts(prev => ({ ...prev, [`${projectId}-${optionId}`]: '' }));
      onRefresh(); // 刷新
    } catch (e: any) {
      console.error(e);
      toast.error(e.data?.message || e.message || '下注失败', { id: loadingToast });
    }
  };

  // 处理结算
  const handleResolve = async (projectId: number, winningOptionId: number) => {
    if (!lottery) return toast.error('钱包未连接');
    const loadingToast = toast.loading('正在结算...');
    try {
      const tx = await lottery.resolveProject(projectId, winningOptionId);
      await tx.wait();
      toast.success('项目已结算！', { id: loadingToast });
      onRefresh(); // 刷新
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

// --- 4. 我的彩票 (NFTs) ---
const MyTickets: React.FC<{ refreshTrigger: number, onRefresh: () => void }> = ({ refreshTrigger, onRefresh }) => {
  const { lotteryTicket, marketplace, lottery, account } = useWeb3();
  const [tickets, setTickets] = useState<MyTicket[]>([]);
  const [listPrices, setListPrices] = useState<{ [key: string]: string }>({});

  useEffect(() => {
  const fetchTickets = async () => {
    if (!lotteryTicket || !account || !lottery || !marketplace) return;
    
    setTickets([]);
    
    try {
      // 方法1：通过事件查询（推荐）
      const filter = lotteryTicket.filters.Transfer(ethers.ZeroAddress, account);
      const mintEvents = await lotteryTicket.queryFilter(filter, 0, 'latest');
      
      const ticketPromises = mintEvents.map(async (event: any) => {
        try {
          const tokenId = event.args.tokenId;
          
          // 检查当前所有者是否还是这个账户
          const currentOwner = await lotteryTicket.ownerOf(tokenId);
          if (currentOwner.toLowerCase() !== account.toLowerCase()) {
            return null; // NFT 已经转移
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
      // 1. 授权 NFT
      toast.loading('请授权 NFT...', { id: loadingToast });
      const approveTx = await lotteryTicket.approve(await marketplace.getAddress(), tokenId);
      await approveTx.wait();

      // 2. 挂单
      toast.loading('正在挂单...', { id: loadingToast });
      const listTx = await marketplace.listTicket(tokenId, priceWei);
      await listTx.wait();

      toast.success('挂单成功！', { id: loadingToast });
      onRefresh(); // 刷新
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
      onRefresh(); // 刷新
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
      onRefresh(); // 刷新
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
          
          {/* 状态 */}
          {t.isResolved ? (
            t.isWinning ? (
              <button style={styles.button} onClick={() => handleClaim(t.tokenId)}>
                🏆 兑换奖金
              </button>
            ) : (
              <span>未中奖</span>
            )
          ) : t.listingPrice > 0n ? (
            // 正在挂单
            <>
              <span>正在出售: {formatEther(t.listingPrice)} BET</span>
              <button style={styles.button} onClick={() => handleCancelListing(t.tokenId)}>
                取消挂单
              </button>
            </>
          ) : (
            // 未挂单
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
  const { marketplace, betToken, lottery, account } = useWeb3();
  const [listings, setListings] = useState<Listing[]>([]);

  useEffect(() => {
    const fetchListings = async () => {
      if (!marketplace || !lottery) return;

      // 1. 获取所有 TicketListed 事件
      const filter = marketplace.filters.TicketListed();
      const events = await marketplace.queryFilter(filter, 0, 'latest');
      
      const listingPromises: Promise<Listing | null>[] = [];

      for (const event of (events as any[])) {
        const { tokenId, projectId, optionId, seller, price } = event.args;

        listingPromises.push(
          (async () => {
            try {
              // 2. 检查该 tokenId 是否还在售
              const currentListing = await marketplace.listings(tokenId);
              if (currentListing.price === 0n ||currentListing.seller.toLowerCase() === account?.toLowerCase()) {
                 return null; // 已售出/取消 或 是自己的挂单
              }
              
              // 3. 获取项目和选项名称 (使用新函数)
              const projectInfo = await lottery.getProjectInfo(projectId);
              const optionInfo = await lottery.getProjectOption(projectId, optionId);
              
              return {
                tokenId: tokenId, projectId: projectId, optionId: optionId, seller: seller, price: price,
                projectName: projectInfo.name, 
                optionName: optionInfo.name,
              };
            } catch (e) {
              console.error(e);
              return null;
            }
          })()
        );
      }
      
      let allListings = (await Promise.all(listingPromises)).filter(l => l !== null) as Listing[];
      
      // 4. 按价格排序
      allListings.sort((a, b) => Number(a.price) - Number(b.price));
      setListings(allListings);
    };

    fetchListings();
  }, [marketplace, lottery, account, refreshTrigger]);

  // 购买彩票
  const handleBuy = async (tokenId: bigint, price: bigint) => {
    if (!marketplace || !betToken) return toast.error('钱包未连接');
    
    const loadingToast = toast.loading('正在处理购买...');
    try {
      // 1. 授权 BET
      toast.loading('请授权 BET...', { id: loadingToast });
      const approveTx = await betToken.approve(await marketplace.getAddress(), price);
      await approveTx.wait();

      // 2. 购买
      toast.loading('正在购买 NFT...', { id: loadingToast });
      const buyTx = await marketplace.buyTicket(tokenId);
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
      {listings.length === 0 ? (
        <p>市场暂无挂单</p>
      ) : (
        listings.map(l => (
          <div key={l.tokenId.toString()} style={styles.item}>
            <p><strong>{l.projectName} - {l.optionName}</strong> (Token ID: {l.tokenId.toString()})</p>
            <p>价格: <strong>{formatEther(l.price)} BET</strong></p>
            <p><small>卖家: {l.seller}</small></p>
            <button style={styles.button} onClick={() => handleBuy(l.tokenId, l.price)}>
              购买
            </button>
          </div>
        ))
      )}
    </div>
  );
};


// --- 主应用 ---
function AppContent() {
  const { isConnected } = useWeb3();
  // 这个 state 用于触发子组件刷新
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const triggerRefresh = () => {
    console.log("刷新按钮被点击! 触发器 +1"); // <--- 添加这一行
    setRefreshTrigger(t => t + 1);
  }
  
  if (!isConnected) {
    return (
      <div style={styles.container}>
        <Header />
        <div style={styles.section}>
          <h2>请先连接你的钱包</h2>
          <p>请确保你已连接到 Ganache 网络 (ChainID: {parseInt(GANACHE_CHAIN_ID, 16)})</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <Header />
      <button 
        style={{...styles.button, background: '#28a745', width: '100%', padding: '15px', fontSize: '1.2em'}}
        onClick={triggerRefresh}
      >
        🔄 手动刷新所有数据
      </button>
      
      {/* 1. 公证人面板 */}
      <AdminPanel onRefresh={triggerRefresh} />
      
      {/* 2. 项目列表 (下注 & 结算) */}
      <ProjectList refreshTrigger={refreshTrigger} onRefresh={triggerRefresh} />
      
      {/* 3. 我的彩票 (挂单 & 兑奖) */}
      <MyTickets refreshTrigger={refreshTrigger} onRefresh={triggerRefresh} />
      
      {/* 4. 订单簿 (购买) */}
      <OrderBook refreshTrigger={refreshTrigger} onRefresh={triggerRefresh} />
    </div>
  );
}

// --- 最终导出 ---
function App() {
  return (
    // 确保 Web3Provider 包裹了你的应用
    <Web3Provider>
      <AppContent />
    </Web3Provider>
  );
}

export default App;
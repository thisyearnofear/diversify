import { describe, expect, it, vi } from 'vitest';
import { ethers } from 'ethers';

const transferInterface = new ethers.utils.Interface([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);
const tokenAddress = '0x3600000000000000000000000000000000000000';
const agentAddress = '0x6D5967e30dF504834DFD0aE38eFaC5DA4ac2DaC8';
const recipientAddress = '0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B';

function buildTransferLog(params: {
  txHash: string;
  amountUSDC: string;
  blockNumber: number;
  logIndex: number;
}) {
  const { data, topics } = transferInterface.encodeEventLog(
    transferInterface.getEvent('Transfer'),
    [
      agentAddress,
      recipientAddress,
      ethers.utils.parseUnits(params.amountUSDC, 6),
    ],
  );

  return {
    address: tokenAddress,
    blockNumber: params.blockNumber,
    logIndex: params.logIndex,
    transactionHash: params.txHash,
    data,
    topics,
  };
}

describe('getArcSettlementStats', () => {
  it('derives counts and totals from Arc USDC transfer logs', async () => {
    vi.resetModules();
    const { getArcSettlementStats } = await import('../arc-settlement');
    const provider = {
      getBlockNumber: vi.fn().mockResolvedValue(120),
      getLogs: vi.fn().mockResolvedValue([
        buildTransferLog({
          txHash: '0x' + '11'.repeat(32),
          amountUSDC: '0.004000',
          blockNumber: 101,
          logIndex: 1,
        }),
        buildTransferLog({
          txHash: '0x' + '22'.repeat(32),
          amountUSDC: '0.005000',
          blockNumber: 105,
          logIndex: 2,
        }),
      ]),
    } as any;

    const stats = await getArcSettlementStats({
      agentAddress,
      recipientAddress,
      provider,
      maxRecentTransfers: 5,
    });

    expect(stats).not.toBeNull();
    expect(stats?.proofSource).toBe('arc_usdc_transfer_logs');
    expect(stats?.transferCount).toBe(2);
    expect(stats?.totalSettledUSDC).toBe('0.009000');
    expect(stats?.recentTransfers[0].txHash).toBe('0x' + '22'.repeat(32));
    expect(stats?.recentTransfers[1].txHash).toBe('0x' + '11'.repeat(32));
  });

  it('updates cached totals incrementally when new blocks arrive', async () => {
    vi.resetModules();
    const { getArcSettlementStats } = await import('../arc-settlement');
    const provider = {
      getBlockNumber: vi.fn().mockResolvedValueOnce(200).mockResolvedValueOnce(205),
      getLogs: vi.fn()
        .mockResolvedValueOnce([
          buildTransferLog({
            txHash: '0x' + '33'.repeat(32),
            amountUSDC: '0.004000',
            blockNumber: 199,
            logIndex: 1,
          }),
        ])
        .mockResolvedValueOnce([
          buildTransferLog({
            txHash: '0x' + '44'.repeat(32),
            amountUSDC: '0.006000',
            blockNumber: 203,
            logIndex: 1,
          }),
        ]),
    } as any;

    const first = await getArcSettlementStats({
      agentAddress,
      recipientAddress,
      provider,
      maxRecentTransfers: 5,
    });
    const second = await getArcSettlementStats({
      agentAddress,
      recipientAddress,
      provider,
      maxRecentTransfers: 5,
    });

    expect(first?.transferCount).toBe(1);
    expect(second?.transferCount).toBe(2);
    expect(second?.totalSettledUSDC).toBe('0.010000');
    expect(provider.getLogs).toHaveBeenCalledTimes(2);
  });
});

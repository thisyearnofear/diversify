import React, { useState, useEffect, useCallback } from 'react';
import { useWalletContext } from '../wallet/WalletProvider';
import DashboardCard from '../shared/DashboardCard';
import { GoodDollarService, StreamInfo } from '../../services/gooddollar-service';

// Example GoodCollective & Social Impact Pools
const COLLECTIVES = [
  { 
    name: 'Climate Action Pool', 
    address: '0x1234567890123456789012345678901234567890', // Placeholder
    icon: '🌱',
    description: 'Offsets carbon by supporting verified regenerative projects.'
  },
  { 
    name: 'Universal Basic Income', 
    address: '0xD7aC544F8A570C4d8764c3AAbCF6870CBD960D0D', // UBI Scheme
    icon: '🌍',
    description: 'Directly supports the G$ UBI distribution mechanism.'
  }
];

export default function GStreamingWidget() {
  const { address, isConnected } = useWalletContext();
  const [streams, setStreams] = useState<StreamInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'view' | 'create'>('view');
  const [newStreamTarget, setNewStreamTarget] = useState('');
  const [newStreamAmount, setNewStreamAmount] = useState('50'); // 50 G$ per month
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'none', msg: string }>({ type: 'none', msg: '' });

  // Fetch active streams
  const fetchStreams = useCallback(async () => {
    if (!address || !isConnected) return;
    
    setIsLoading(true);
    try {
      const service = GoodDollarService.createReadOnly();
      
      // For demo, we check some collectives and a random address
      const checks = [
        ...COLLECTIVES.map(c => c.address),
        '0x0000000000000000000000000000000000000000' // Example friend
      ];
      
      const results = await Promise.all(
        checks.map(target => service.getStreamInfo(address, target))
      );
      
      setStreams(results.filter(s => s.isActive));
    } catch (e) {
      console.error('[Streaming] Fetch error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [address, isConnected]);

  useEffect(() => {
    fetchStreams();
  }, [fetchStreams]);

  // Handle stream creation
  const handleCreateStream = async () => {
    if (!address || !window.ethereum) return;
    
    setIsLoading(true);
    setStatus({ type: 'none', msg: '' });
    
    try {
      const service = await GoodDollarService.fromWeb3Provider(window.ethereum);
      const result = await service.createStream(newStreamTarget, newStreamAmount);
      
      if (result.success) {
        setStatus({ type: 'success', msg: 'Stream started successfully!' });
        fetchStreams();
        setActiveTab('view');
      } else {
        setStatus({ type: 'error', msg: result.error || 'Failed to start stream' });
      }
    } catch (e: unknown) {
      const error = e as Error;
      setStatus({ type: 'error', msg: error.message || 'Error occurred' });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle stream deletion
  const handleDeleteStream = async (receiver: string) => {
    if (!address || !window.ethereum) return;
    
    setIsLoading(true);
    try {
      const service = await GoodDollarService.fromWeb3Provider(window.ethereum);
      const result = await service.deleteStream(receiver);
      
      if (result.success) {
        fetchStreams();
      }
    } catch (e) {
      console.error('[Streaming] Delete error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isConnected) return null;

  return (
    <DashboardCard
      title="G$ Real-Time Streaming"
      icon="🌊"
      color="blue"
      size="md"
    >
      <div className="space-y-4 mt-2">
        {/* Tabs */}
        <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
          <button
            onClick={() => setActiveTab('view')}
            className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${
              activeTab === 'view' ? 'bg-white dark:bg-gray-700 shadow-sm' : 'text-gray-500'
            }`}
          >
            ACTIVE STREAMS
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${
              activeTab === 'create' ? 'bg-white dark:bg-gray-700 shadow-sm' : 'text-gray-500'
            }`}
          >
            START STREAM
          </button>
        </div>

        {activeTab === 'view' ? (
          <div className="space-y-3 min-h-[120px]">
            {streams.length > 0 ? (
              streams.map((stream, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-xl border border-blue-100 dark:border-blue-900 animate-in fade-in slide-in-from-left-2 duration-300">
                  <div>
                    <div className="text-xs font-black text-gray-500 truncate w-32">
                      TO: {stream.receiver}
                    </div>
                    <div className="text-lg font-black text-blue-600 dark:text-blue-400">
                      {parseFloat(stream.monthlyAmount).toFixed(1)} G$ <span className="text-[10px] text-gray-400 uppercase font-bold">/ MONTH</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteStream(stream.receiver)}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    ⏹️
                  </button>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <div className="text-3xl mb-2 opacity-50">💨</div>
                <p className="text-xs text-gray-500 font-medium">No active streams found.</p>
              </div>
            )}
            
            {/* Superfluid explanation */}
            <p className="text-[10px] text-gray-500 italic text-center px-4 leading-relaxed">
              Streams move value second-by-second. Powered by Superfluid on Celo.
            </p>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
            {/* Quick Select Collectives */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Impact Collectives
              </label>
              <div className="grid grid-cols-1 gap-2">
                {COLLECTIVES.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => setNewStreamTarget(c.address)}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                      newStreamTarget === c.address 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                        : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900'
                    }`}
                  >
                    <span className="text-xl">{c.icon}</span>
                    <div>
                      <div className="text-xs font-black">{c.name}</div>
                      <div className="text-[10px] text-gray-500 leading-tight mt-0.5">{c.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Input */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Monthly Amount (G$)
              </label>
              <input
                type="number"
                value={newStreamAmount}
                onChange={(e) => setNewStreamAmount(e.target.value)}
                className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="50"
              />
            </div>

            {status.type !== 'none' && (
              <div className={`p-3 rounded-xl text-xs font-bold ${
                status.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
              }`}>
                {status.msg}
              </div>
            )}

            <button
              onClick={handleCreateStream}
              disabled={isLoading || !newStreamTarget}
              className={`w-full py-4 rounded-xl font-black text-sm transition-all shadow-lg ${
                isLoading || !newStreamTarget
                  ? 'bg-gray-200 text-gray-400'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-600/20'
              }`}
            >
              {isLoading ? 'EXECUTING...' : 'START STREAMING →'}
            </button>
          </div>
        )}
      </div>
    </DashboardCard>
  );
}

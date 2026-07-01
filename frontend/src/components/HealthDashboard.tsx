import React, { useState, useEffect } from 'react';
import { Database, Zap, Clock, Users, Play, Pause, Activity, RefreshCw } from 'lucide-react';

interface HealthData {
  success: boolean;
  status: string;
  database: {
    status: string;
    latencyMs: number;
  };
  redis: {
    status: string;
    latencyMs: number;
  };
  queue: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    totalWorkers: number;
  };
  cron: {
    timezone: string;
    lastCheckAt: string | null;
  };
  serverTime: string;
}

export const HealthDashboard: React.FC = () => {
  const [data, setData] = useState<HealthData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setError(null);
      } else {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.error || 'System reported diagnostic warnings.');
      }
    } catch (e: any) {
      setError('Connection failure: Backend server is unreachable.');
    } finally {
      setIsLoading(false);
      setLastRefreshed(new Date());
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchHealth();
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const toggleAutoRefresh = () => setAutoRefresh(!autoRefresh);

  if (isLoading && !data) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="glass-panel p-6 rounded-2xl border border-glass-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">System Status & Queue</h1>
          <p className="text-gray-400 text-sm max-w-xl">
            Live observability monitoring database operations, Redis broker state, cron routines, and BullMQ worker workloads.
          </p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-center">
          {/* Auto Refresh Toggle */}
          <button
            onClick={toggleAutoRefresh}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border transition-all duration-200 ${
              autoRefresh
                ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-600/20'
                : 'bg-gray-800/40 text-gray-400 border-glass-border hover:bg-gray-800/80 hover:text-gray-200'
            }`}
          >
            {autoRefresh ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {autoRefresh ? 'Pause Live Update' : 'Resume Live Update'}
          </button>
          {/* Manual Refresh */}
          <button
            onClick={fetchHealth}
            className="p-2.5 rounded-xl bg-gray-800/40 text-gray-400 border border-glass-border hover:text-gray-200 hover:bg-gray-800/80 active:scale-95 transition-all duration-150"
            title="Refresh Diagnostics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="glass-panel p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 text-rose-400 text-xs flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          {error}
        </div>
      )}

      {data && (
        <>
          {/* Top Row: System Component Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Database Card */}
            <div className="glass-panel p-5 rounded-2xl border border-glass-border flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
                <Database className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-gray-400 text-xs font-semibold block">PostgreSQL Database</span>
                <span className="text-white text-lg font-bold mt-1 block">
                  {data.database.status === 'connected' ? 'Connected' : 'Offline'}
                </span>
                <span className="text-[10px] text-gray-500 mt-1 block">
                  Response Latency: <span className="text-emerald-400 font-mono font-semibold">{data.database.latencyMs}ms</span>
                </span>
              </div>
            </div>

            {/* Redis Card */}
            <div className="glass-panel p-5 rounded-2xl border border-glass-border flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-gray-400 text-xs font-semibold block">Redis Broker</span>
                <span className="text-white text-lg font-bold mt-1 block">
                  {data.redis.status === 'connected' ? 'Active' : 'Unreachable'}
                </span>
                <span className="text-[10px] text-gray-500 mt-1 block">
                  Ping Latency: <span className="text-emerald-400 font-mono font-semibold">{data.redis.latencyMs}ms</span>
                </span>
              </div>
            </div>

            {/* BullMQ Worker Card */}
            <div className="glass-panel p-5 rounded-2xl border border-glass-border flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-gray-400 text-xs font-semibold block">Active Queue Workers</span>
                <span className="text-white text-lg font-bold mt-1 block">
                  {data.queue.totalWorkers} Worker{data.queue.totalWorkers !== 1 ? 's' : ''}
                </span>
                <span className="text-[10px] text-gray-500 mt-1 block">
                  Decoupled commit worker is listening
                </span>
              </div>
            </div>

            {/* Cron Card */}
            <div className="glass-panel p-5 rounded-2xl border border-glass-border flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-gray-400 text-xs font-semibold block">Nightly Summarizer</span>
                <span className="text-white text-lg font-bold mt-1 block">
                  {data.cron.lastCheckAt ? 'Active' : 'Awaiting Run'}
                </span>
                <span className="text-[10px] text-gray-500 mt-1 block truncate">
                  Last Checked: {data.cron.lastCheckAt ? new Date(data.cron.lastCheckAt).toLocaleTimeString() : 'Never'}
                </span>
              </div>
            </div>
          </div>

          {/* Queue backlogs */}
          <div className="glass-panel p-6 rounded-2xl border border-glass-border">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">BullMQ Backlog Distribution</h3>
              </div>
              <span className="text-[10px] text-gray-500">
                Stats auto-refreshed: {lastRefreshed.toLocaleTimeString()}
              </span>
            </div>

            {/* Stats list */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-gray-900/40 p-4 rounded-xl border border-glass-border text-center">
                <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider block">Active Jobs</span>
                <span className={`text-xl font-bold mt-1 block ${data.queue.active > 0 ? 'text-indigo-400' : 'text-gray-300'}`}>
                  {data.queue.active}
                </span>
              </div>

              <div className="bg-gray-900/40 p-4 rounded-xl border border-glass-border text-center">
                <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider block">Waiting in Queue</span>
                <span className={`text-xl font-bold mt-1 block ${data.queue.waiting > 0 ? 'text-amber-400 animate-pulse' : 'text-gray-300'}`}>
                  {data.queue.waiting}
                </span>
              </div>

              <div className="bg-gray-900/40 p-4 rounded-xl border border-glass-border text-center">
                <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider block">Completed</span>
                <span className="text-xl font-bold text-emerald-400 mt-1 block">
                  {data.queue.completed}
                </span>
              </div>

              <div className="bg-gray-900/40 p-4 rounded-xl border border-glass-border text-center">
                <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider block">Failed (Retries Exhausted)</span>
                <span className={`text-xl font-bold mt-1 block ${data.queue.failed > 0 ? 'text-rose-400' : 'text-gray-300'}`}>
                  {data.queue.failed}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

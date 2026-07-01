import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, Star, Code, Check, AlertTriangle } from 'lucide-react';

interface Repository {
  id: string;
  fullName: string;
  isTracked: boolean;
  lastSyncAt: string | null;
  language: string | null;
  stars: number;
}

interface RepoSettingsProps {
  showToast: (type: 'success' | 'error', message: string) => void;
  onTrackedChange?: () => void;
}

export const RepoSettings: React.FC<RepoSettingsProps> = ({ showToast, onTrackedChange }) => {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchRepos = async () => {
    try {
      const res = await fetch('/api/repos');
      if (res.ok) {
        const data = await res.json();
        setRepos(data.repositories || []);
      } else {
        showToast('error', 'Failed to retrieve repository configurations.');
      }
    } catch (e: any) {
      console.error(e.message);
      showToast('error', 'Failed to communicate with repository service.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/repos/sync-all', {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setRepos(data.repositories || []);
        showToast('success', `Synced ${data.count} repositories from GitHub.`);
      } else {
        showToast('error', data.error || 'Failed to sync repositories.');
      }
    } catch (e: any) {
      console.error(e.message);
      showToast('error', 'Failed to trigger repository synchronization.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleTrack = async (id: string, name: string, currentTracked: boolean) => {
    try {
      const res = await fetch(`/api/repos/${id}/toggle`, {
        method: 'PATCH',
      });
      if (res.ok) {
        setRepos(prev =>
          prev.map(r => (r.id === id ? { ...r, isTracked: !r.isTracked } : r))
        );
        showToast(
          'success',
          currentTracked
            ? `Stopped tracking ${name}.`
            : `Now tracking ${name}. Commits will be ingested.`
        );
        if (onTrackedChange) {
          onTrackedChange();
        }
      } else {
        showToast('error', 'Failed to update tracking configuration.');
      }
    } catch (e: any) {
      console.error(e.message);
      showToast('error', 'Failed to update tracking settings.');
    }
  };

  useEffect(() => {
    fetchRepos();
  }, []);

  const filteredRepos = repos.filter(repo =>
    repo.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const trackedCount = repos.filter(r => r.isTracked).length;

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="glass-panel p-6 rounded-2xl border border-glass-border flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Repository Manager</h1>
          <p className="text-gray-400 text-sm max-w-xl">
            Choose which GitHub repositories Devlog tracks. Webhooks and manual commit synchronizations will only ingest commit diffs from checked repositories.
          </p>
          <div className="flex gap-4 mt-4 text-xs font-semibold">
            <span className="px-3 py-1 rounded-full bg-indigo-600/10 text-indigo-400 border border-indigo-500/20">
              Total Found: {repos.length}
            </span>
            <span className="px-3 py-1 rounded-full bg-emerald-600/10 text-emerald-400 border border-emerald-500/20">
              Actively Tracked: {trackedCount}
            </span>
          </div>
        </div>
        <button
          onClick={handleSyncAll}
          disabled={isSyncing}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 active:scale-95 disabled:opacity-50 disabled:pointer-events-none transition-all duration-200 shadow-md shadow-indigo-600/20 self-start md:self-center"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing Repos...' : 'Sync from GitHub'}
        </button>
      </div>

      {/* Control panel and list */}
      <div className="glass-panel rounded-2xl border border-glass-border overflow-hidden">
        {/* Search Bar */}
        <div className="p-4 border-b border-glass-border bg-gray-900/20 flex items-center gap-3">
          <Search className="w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search synced repositories..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-0 text-white text-sm focus:outline-none placeholder-gray-500"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          </div>
        ) : filteredRepos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <AlertTriangle className="w-12 h-12 text-indigo-500/40 mb-4" />
            <h3 className="text-base font-semibold text-white mb-1">No Repositories Found</h3>
            <p className="text-gray-500 text-xs max-w-sm">
              {searchQuery
                ? `No repositories match your search "${searchQuery}".`
                : 'Connect your repositories by clicking "Sync from GitHub" at the top right.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-glass-border max-h-[500px] overflow-y-auto custom-scrollbar">
            {filteredRepos.map(repo => (
              <div
                key={repo.id}
                className={`p-4 flex items-center justify-between gap-4 transition-all duration-150 ${
                  repo.isTracked
                    ? 'bg-indigo-600/5 hover:bg-indigo-600/10'
                    : 'hover:bg-gray-800/20'
                }`}
              >
                {/* Repo Info */}
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-sm text-gray-200 truncate">
                    {repo.fullName}
                  </span>
                  <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                    {repo.language && (
                      <span className="flex items-center gap-1 text-[11px] text-gray-400 font-medium">
                        <Code className="w-3.5 h-3.5 text-indigo-400" />
                        {repo.language}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-[11px] text-gray-400 font-medium">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500/10" />
                      {repo.stars}
                    </span>
                    {repo.lastSyncAt && (
                      <span className="text-[10px] text-gray-500">
                        Last Synced: {new Date(repo.lastSyncAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Track Button */}
                <button
                  onClick={() => handleToggleTrack(repo.id, repo.fullName, repo.isTracked)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-200 ${
                    repo.isTracked
                      ? 'bg-emerald-600/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-600/20'
                      : 'bg-gray-800/40 text-gray-400 border-glass-border hover:bg-gray-800/80 hover:text-gray-200'
                  }`}
                >
                  {repo.isTracked ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      Tracked
                    </>
                  ) : (
                    'Track Repo'
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

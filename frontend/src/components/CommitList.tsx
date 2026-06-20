import React, { useState } from 'react';
import { GitBranch, Clock, Layers, ArrowLeft } from 'lucide-react';

interface Commit {
  id: string;
  sha: string;
  repository: string;
  message: string;
  diffText: string | null;
  commitDate: string;
}

interface CommitListProps {
  commits: Commit[];
}

export const CommitList: React.FC<CommitListProps> = ({ commits }) => {
  const [selectedCommit, setSelectedCommit] = useState<Commit | null>(null);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Group commits by YYYY-MM-DD
  const groupCommitsByDay = () => {
    const groups: { [key: string]: Commit[] } = {};
    commits.forEach((commit) => {
      const date = new Date(commit.commitDate);
      const dayKey = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }); // "MM/DD/YYYY"
      const [m, d, y] = dayKey.split('/');
      const formattedDay = `${y}-${m}-${d}`;

      if (!groups[formattedDay]) {
        groups[formattedDay] = [];
      }
      groups[formattedDay].push(commit);
    });
    return groups;
  };

  const grouped = groupCommitsByDay();
  const sortedDays = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  if (selectedCommit) {
    return (
      <div className="flex flex-col h-[calc(100vh-100px)]">
        <div className="flex items-center justify-between pb-4 border-b border-glass-border mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedCommit(null)}
              className="p-2 hover:bg-gray-800/50 rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-lg font-bold text-white">
                Commit: {selectedCommit.sha.substring(0, 7)}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {selectedCommit.repository} • {formatDate(selectedCommit.commitDate)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col gap-4">
          <div className="p-5 glass-panel rounded-2xl border border-glass-border">
            <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block">
              Message
            </span>
            <h3 className="text-base font-semibold text-gray-200 mt-1">
              {selectedCommit.message}
            </h3>
          </div>

          <div className="flex-1 min-h-0 flex flex-col glass-panel rounded-2xl border border-glass-border p-4">
            <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block mb-3">
              Filtered Diff Patch Details
            </span>
            <div className="flex-1 overflow-y-auto font-mono text-xs text-gray-300 whitespace-pre bg-gray-950/80 p-4 rounded-xl border border-glass-border">
              {selectedCommit.diffText || 'No file changes or diff available for this commit.'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6 rounded-2xl border border-glass-border">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-indigo-400" />
          Raw Ingested Commits
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          A list of all commits pushed to monitored repositories and ingested via Webhooks.
        </p>
      </div>

      {commits.length === 0 ? (
        <div className="glass-panel p-12 text-center rounded-2xl border border-glass-border">
          <Clock className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-300">No Commits Ingested Yet</h3>
          <p className="text-sm text-gray-500 mt-2 max-w-sm mx-auto">
            Integrate your GitHub Webhook and start pushing commits to sync your repository history.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDays.map((day) => {
            const date = new Date(day);
            const formattedDayTitle = date.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            });

            return (
              <div key={day} className="space-y-3">
                <h3 className="text-xs font-bold text-gray-400 tracking-wider uppercase pl-2 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-400/80" />
                  {formattedDayTitle}
                </h3>

                <div className="glass-panel rounded-2xl border border-glass-border divide-y divide-glass-border overflow-hidden">
                  {grouped[day].map((commit) => (
                    <div
                      key={commit.id}
                      onClick={() => setSelectedCommit(commit)}
                      className="p-4 hover:bg-gray-800/25 transition-all duration-200 cursor-pointer flex items-center justify-between group"
                    >
                      <div className="min-w-0 flex-1 pr-4">
                        <p className="text-sm font-semibold text-gray-200 line-clamp-1 group-hover:text-indigo-400 transition-colors">
                          {commit.message}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-mono text-gray-400 bg-gray-800/40 border border-gray-700/30 px-1.5 py-0.5 rounded">
                            {commit.sha.substring(0, 7)}
                          </span>
                          <span className="text-[10px] text-gray-500">
                            {commit.repository}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {new Date(commit.commitDate).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

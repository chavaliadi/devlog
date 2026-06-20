import React from 'react';
import { GitCommit, FileText, FileEdit, CheckCircle2 } from 'lucide-react';

interface StatsProps {
  totalCommits: number;
  totalEntries: number;
  draftsCount: number;
  publishedCount: number;
}

export const Stats: React.FC<StatsProps> = ({
  totalCommits,
  totalEntries,
  draftsCount,
  publishedCount,
}) => {
  const cards = [
    {
      label: 'Total Commits Ingested',
      value: totalCommits,
      icon: GitCommit,
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-500/10',
      borderColor: 'border-indigo-500/20',
    },
    {
      label: 'Summarized Days',
      value: totalEntries,
      icon: FileText,
      color: 'text-violet-400',
      bgColor: 'bg-violet-500/10',
      borderColor: 'border-violet-500/20',
    },
    {
      label: 'Pending Drafts',
      value: draftsCount,
      icon: FileEdit,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/20',
    },
    {
      label: 'Published Summaries',
      value: publishedCount,
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/20',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className={`glass-card p-5 rounded-2xl border ${card.borderColor} flex items-center justify-between`}
          >
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                {card.label}
              </p>
              <h3 className="text-2xl font-bold text-white mt-2 tracking-tight">
                {card.value}
              </h3>
            </div>
            <div className={`w-10 h-10 rounded-xl ${card.bgColor} flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${card.color}`} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

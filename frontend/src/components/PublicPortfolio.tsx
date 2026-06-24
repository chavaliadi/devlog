import React, { useState } from 'react';
import { BookOpen, User, Calendar, Eye, FileText, ArrowLeft, GitCommit, GitBranch, Flame, ExternalLink, Activity, X } from 'lucide-react';

interface Entry {
  id: string;
  date: string;
  content: string;
  status: string;
  createdAt: string;
}

interface PublicPortfolioProps {
  entries: Entry[];
  profile: {
    username: string;
    avatarUrl: string | null;
  } | null;
  stats: {
    totalCommits: number;
    totalRepositories: number;
    topRepositories: string[];
    activeDays: number;
    currentStreak: number;
  };
  recentActivity: {
    sha: string;
    repository: string;
    message: string;
    date: string;
  }[];
  isGuest?: boolean;
}

// Simple local Markdown parser
const renderMarkdown = (markdown: string) => {
  if (!markdown) return '';

  const lines = markdown.split('\n');
  let inList = false;
  const htmlLines = lines.map((line) => {
    let cleanLine = line.trim();

    if (cleanLine.startsWith('## ')) {
      if (inList) { inList = false; return '</ul><h2 class="text-lg font-bold text-indigo-400 mt-6 mb-3 border-b border-gray-800 pb-1">' + cleanLine.substring(3) + '</h2>'; }
      return '<h2 class="text-lg font-bold text-indigo-400 mt-6 mb-3 border-b border-gray-800 pb-1">' + cleanLine.substring(3) + '</h2>';
    }
    if (cleanLine.startsWith('### ')) {
      if (inList) { inList = false; return '</ul><h3 class="text-md font-bold text-gray-200 mt-4 mb-2">' + cleanLine.substring(4) + '</h3>'; }
      return '<h3 class="text-md font-bold text-gray-200 mt-4 mb-2">' + cleanLine.substring(4) + '</h3>';
    }

    if (cleanLine.startsWith('* ') || cleanLine.startsWith('- ')) {
      const content = cleanLine.substring(2);
      let out = '';
      if (!inList) {
        inList = true;
        out += '<ul class="list-disc pl-5 space-y-2 text-gray-300 text-sm my-3">';
      }
      const formattedContent = content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/`(.*?)`/g, '<code class="bg-gray-800/80 px-1.5 py-0.5 rounded text-indigo-400 text-xs font-mono">$1</code>');
      
      out += '<li>' + formattedContent + '</li>';
      return out;
    }

    let prefix = '';
    if (inList && cleanLine !== '') {
      inList = false;
      prefix = '</ul>';
    }

    if (cleanLine === '') {
      return prefix;
    }

    const formattedParagraph = cleanLine
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.*?)`/g, '<code class="bg-gray-800/80 px-1.5 py-0.5 rounded text-indigo-400 text-xs font-mono">$1</code>');
    
    return prefix + '<p class="text-gray-300 text-sm leading-relaxed mb-4">' + formattedParagraph + '</p>';
  });

  if (inList) {
    htmlLines.push('</ul>');
  }

  return htmlLines.join('\n');
};

const getRelativeTime = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) {
    return `${Math.max(1, diffMins)}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else {
    return `${diffDays}d ago`;
  }
};

export const PublicPortfolio: React.FC<PublicPortfolioProps> = ({
  entries,
  profile,
  stats,
  recentActivity,
  isGuest = false,
}) => {
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [copyLinkText, setCopyLinkText] = useState('Copy Share Link');

  // Filter only published entries for the view
  const publishedEntries = entries.filter((e) => e.status === 'published');

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getTeaser = (markdown: string) => {
    const cleanText = markdown.replace(/[#*`_-]/g, '').trim();
    return cleanText.substring(0, 160) + (cleanText.length > 160 ? '...' : '');
  };

  const handleCopyLink = () => {
    if (!profile) return;
    const shareUrl = `${window.location.origin}/#/portfolio/${profile.username}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopyLinkText('Copied!');
      setTimeout(() => setCopyLinkText('Copy Share Link'), 2000);
    });
  };

  // Detail view is now handled via an overlay modal

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fadeIn">
      {/* Portfolio User Profile Header */}
      <div className="glass-panel p-6 rounded-3xl border border-glass-border flex flex-col md:flex-row items-center gap-6">
        <div className="relative">
          {profile?.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={profile.username}
              className="w-20 h-20 rounded-2xl border-2 border-indigo-500/20 object-cover shadow-lg"
            />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-indigo-500/10 border-2 border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-lg">
              <User className="w-10 h-10" />
            </div>
          )}
        </div>

        <div className="flex-grow text-center md:text-left">
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center justify-center md:justify-start gap-2">
            @{profile?.username || 'developer'}
            {isGuest && (
              <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Recruiter View
              </span>
            )}
          </h1>
          <p className="text-xs text-indigo-400 font-medium mt-1 uppercase tracking-wider flex items-center justify-center md:justify-start gap-1">
            <BookOpen className="w-3.5 h-3.5" />
            Developer Progress Log
          </p>
        </div>

        {profile && !isGuest && (
          <button
            onClick={handleCopyLink}
            className="px-4 py-2 border border-indigo-500/20 hover:border-indigo-500/40 bg-indigo-500/5 hover:bg-indigo-500/10 rounded-xl text-xs font-semibold text-indigo-400 flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {copyLinkText}
          </button>
        )}
      </div>

      {/* Developer Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Commits */}
        <div className="glass-card p-5 rounded-2xl border border-glass-border flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Commits</p>
            <h3 className="text-2xl font-bold text-white mt-1.5 tracking-tight">{stats.totalCommits}</h3>
            <span className="text-[10px] text-gray-500">Ingested from repositories</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
            <GitCommit className="w-5 h-5 text-indigo-400" />
          </div>
        </div>

        {/* Metric 2: Repositories Count & Top list */}
        <div className="glass-card p-5 rounded-2xl border border-glass-border flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Monitored Repos</p>
            <h3 className="text-2xl font-bold text-white mt-1.5 tracking-tight">{stats.totalRepositories}</h3>
            <div className="flex flex-wrap gap-1 mt-1 min-w-0">
              {stats.topRepositories && stats.topRepositories.map((repo, idx) => (
                <span
                  key={idx}
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/10 truncate max-w-[80px]"
                  title={repo}
                >
                  {repo.split('/')[1] || repo}
                </span>
              ))}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
            <GitBranch className="w-5 h-5 text-indigo-400" />
          </div>
        </div>

        {/* Metric 3: Active Days */}
        <div className="glass-card p-5 rounded-2xl border border-glass-border flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Active Days</p>
            <h3 className="text-2xl font-bold text-white mt-1.5 tracking-tight">{stats.activeDays}</h3>
            <span className="text-[10px] text-gray-500">Total days with activity</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-indigo-400" />
          </div>
        </div>

        {/* Metric 4: Streak */}
        <div className="glass-card p-5 rounded-2xl border border-glass-border flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Commit Streak</p>
            <h3 className="text-2xl font-bold text-white mt-1.5 tracking-tight flex items-center gap-1.5">
              {stats.currentStreak} Days
              {stats.currentStreak > 0 && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
              )}
            </h3>
            <span className="text-[10px] text-gray-500">Consecutive active days</span>
          </div>
          <div className={`w-10 h-10 rounded-xl ${stats.currentStreak > 0 ? 'bg-amber-500/15' : 'bg-gray-800/40'} flex items-center justify-center`}>
            <Flame className={`w-5 h-5 ${stats.currentStreak > 0 ? 'text-amber-400 fill-amber-400/10' : 'text-gray-500'}`} />
          </div>
        </div>
      </div>

      {/* Main Grid View */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Side: Journals Feed (2/3) */}
        <div className="w-full lg:w-2/3 space-y-4">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider pl-2 flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-400/80" />
            Engineering Journals
          </h2>

          {publishedEntries.length === 0 ? (
            <div className="glass-panel p-12 text-center rounded-3xl border border-glass-border w-full">
              <BookOpen className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-400">No Journals Published Yet</h3>
              <p className="text-sm text-gray-500 mt-2 max-w-sm mx-auto">
                No entries have been published to this developer portfolio. Check back later!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 w-full">
              {publishedEntries.map((entry) => (
                <div
                  key={entry.id}
                  onClick={() => setSelectedEntry(entry)}
                  className="glass-card p-6 rounded-2xl cursor-pointer flex flex-col gap-3 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                      <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                      {formatDate(entry.date)}
                    </div>
                    <span className="text-[10px] text-indigo-400 flex items-center gap-1 group-hover:underline font-semibold">
                      <Eye className="w-3.5 h-3.5" />
                      Read Log
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-gray-200 group-hover:text-indigo-400 transition-colors">
                    Log Entry — {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </h3>
                  <p className="text-sm text-gray-400 line-clamp-3 leading-relaxed">
                    {getTeaser(entry.content)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Side: Recent Activity Timeline (1/3) */}
        <div className="w-full lg:w-1/3 space-y-4">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider pl-2 flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-400/80" />
            Recent Activity
          </h2>

          <div className="glass-panel p-5 rounded-3xl border border-glass-border space-y-5">
            {recentActivity.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-6">No recent commits ingested.</p>
            ) : (
              <div className="relative border-l border-gray-800 pl-4 space-y-5">
                {recentActivity.map((commit, idx) => (
                  <div key={idx} className="relative">
                    {/* Circle Node */}
                    <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-indigo-500/80 border-2 border-[#030712] shadow" />
                    
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[9px] font-mono bg-gray-800/60 border border-gray-700/30 px-1.5 py-0.5 rounded text-gray-400 truncate max-w-[60px]" title={commit.sha}>
                          {commit.sha.substring(0, 7)}
                        </span>
                        <span className="text-[10px] text-gray-500 whitespace-nowrap">
                          {getRelativeTime(commit.date)}
                        </span>
                      </div>
                      
                      <span className="text-[9px] font-semibold text-indigo-400 truncate max-w-[200px]" title={commit.repository}>
                        {commit.repository}
                      </span>
                      
                      <p className="text-xs text-gray-300 font-medium line-clamp-2 leading-relaxed">
                        {commit.message}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Immersive Glassmorphic Detail Log Modal Overlay */}
      {selectedEntry && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/70 backdrop-blur-md transition-all duration-300 animate-fadeIn"
          onClick={() => setSelectedEntry(null)}
        >
          <div 
            className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto glass-panel p-6 md:p-8 rounded-3xl border border-glass-border shadow-2xl flex flex-col gap-4 animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-glass-border pb-4">
              <div className="flex items-center gap-2 text-xs text-indigo-400 font-bold uppercase tracking-wider">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(selectedEntry.date)}
              </div>
              <button
                onClick={() => setSelectedEntry(null)}
                className="p-1.5 rounded-lg border border-glass-border text-gray-400 hover:text-white hover:bg-gray-800/40 transition-all cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {/* Modal Title */}
            <h2 className="text-xl font-bold text-white tracking-tight">
              Developer Log — {new Date(selectedEntry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </h2>
            
            {/* Modal Body */}
            <div
              className="prose prose-invert max-w-none text-gray-300 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedEntry.content) }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

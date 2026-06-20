import React from 'react';
import { FileEdit, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

interface Entry {
  id: string;
  date: string;
  content: string;
  status: string;
  createdAt: string;
}

interface LogTimelineProps {
  entries: Entry[];
  onSelectEntry: (id: string) => void;
}

export const LogTimeline: React.FC<LogTimelineProps> = ({ entries, onSelectEntry }) => {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Helper to extract a clean teaser text from the entry markdown
  const getTeaser = (markdown: string) => {
    // Look for content after the first header (e.g. ## Overview)
    const lines = markdown.split('\n');
    const overviewIndex = lines.findIndex(line => line.toLowerCase().includes('overview'));
    
    if (overviewIndex !== -1 && lines[overviewIndex + 1]) {
      // Find the first non-empty line after the overview heading
      for (let i = overviewIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line && !line.startsWith('#')) return line;
      }
    }
    
    // Fallback: just return the first few words of the first paragraph
    const cleanText = markdown.replace(/[#*`_-]/g, '').trim();
    return cleanText.substring(0, 140) + (cleanText.length > 140 ? '...' : '');
  };

  return (
    <div className="glass-panel rounded-2xl border border-glass-border overflow-hidden">
      <div className="p-6 border-b border-glass-border flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-white">Daily Summaries</h2>
          <p className="text-xs text-gray-400 mt-1">
            Review, edit, and publish your daily developer journals.
          </p>
        </div>
        <span className="text-xs font-semibold text-gray-500 bg-gray-800/40 px-3 py-1 rounded-full border border-gray-700/30">
          {entries.length} Entries
        </span>
      </div>

      {entries.length === 0 ? (
        <div className="p-12 text-center">
          <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-300">No Summaries Yet</h3>
          <p className="text-sm text-gray-500 mt-2 max-w-sm mx-auto">
            Try committing code to your repository, or use the "Trigger Today's Summary" button at the top to compile.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-glass-border">
          {entries.map((entry) => {
            const isPublished = entry.status === 'published';
            return (
              <div
                key={entry.id}
                onClick={() => onSelectEntry(entry.id)}
                className="p-6 hover:bg-gray-800/20 transition-all duration-200 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-100">
                      {formatDate(entry.date)}
                    </span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-medium inline-flex items-center gap-1 border ${
                        isPublished
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}
                    >
                      {isPublished ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" /> Published
                        </>
                      ) : (
                        <>
                          <FileEdit className="w-3 h-3" /> Draft
                        </>
                      )}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mt-2 line-clamp-2 max-w-3xl pr-4">
                    {getTeaser(entry.content)}
                  </p>
                </div>

                <div className="flex items-center justify-end shrink-0">
                  <button className="flex items-center gap-2 text-sm text-gray-400 hover:text-indigo-400 bg-gray-800/40 border border-gray-700/20 group-hover:border-indigo-500/30 group-hover:text-indigo-400 px-4 py-2 rounded-xl transition-all duration-200">
                    Edit Entry
                    <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
